import { describe, expect, it } from 'vitest';
import type { PublishRequest, WorkItem } from '../../src/flow-studio/model/runtime';
import type { Workflow } from '../../src/flow-studio/model/workflow';
import { actor, createWorld, hoursAfter, type World, type WorldOptions } from './runtime-world';

/**
 * 05 §3.2 step 5: "Save with optimistic concurrency (`rev`)". Each race really runs at once, and the assertions are about
 * what must hold whoever wins, because the store decides who wins. The same suite runs on the memory store in test:engine
 * and on Django with real connections to Postgres in test:django, where a loser is turned back by `UPDATE … WHERE rev`.
 */

const ROUNDS = 6;
let counter = 0;
const nextRecord = (): string => `RACE-${Date.now().toString(36)}-${(counter += 1)}`;

const countLog = (log: { m: string; type: string }[], test: (entry: { m: string; type: string }) => boolean): number => log.filter(test).length;

export function runtimeRaces(name: string, options: () => Promise<WorldOptions>): void {
  const fresh = async (): Promise<World> => createWorld(await options());

  describe(`Races on ${name}`, () => {
    it('two overlapping drafts approved at once: they never both go live with nothing to choose between them', async () => {
      const world = await fresh();
      for (let round = 0; round < ROUNDS; round += 1) {
        const made: { id: string; request: PublishRequest }[] = [];
        for (const scope of [{ business_unit: ['Finance'] }, { country: ['Canada'] }]) {
          const created = await world.store.workflows.create({ fromWorkflowId: 'wf-wo-sub-wo-data' }, 'Owen Clarke');
          const found = (await world.store.workflows.get(created.id)) as NonNullable<Awaited<ReturnType<typeof world.store.workflows.get>>>;
          await world.store.workflows.saveDraft(created.id, { ...found.workflow, scope }, found.draftRev, 'Owen Clarke');
          const current = (await world.store.workflows.get(created.id))?.workflow as Workflow;
          const pending = { submittedBy: 'Owen Clarke', submittedAt: world.clock.now(), effective: world.clock.asOf(), precedence: [] };
          const snapshot = { ...current };
          delete snapshot.versions;
          const request = await world.store.publishRequests.create({ workflowId: created.id, snapshot, goLive: world.clock.asOf(), precedence: [], review: { impact: 0, mustFix: [], overlaps: [], openOverlaps: [], canSend: true, effective: world.clock.asOf() }, requestedBy: 'Owen Clarke' }, pending, ['Samira Khan']);
          made.push({ id: created.id, request });
        }
        await Promise.allSettled(made.map(({ id, request }) => world.store.workflows.publishVersion(id, request, 'Samira Khan')));
        const stored = await world.store.workflows.all();
        // One can win, or neither if Postgres broke a deadlock between them; both winning is the bug.
        expect(made.filter(({ id }) => stored.find((workflow) => workflow.id === id)?.status === 'live').length).toBeLessThanOrEqual(1);
        // Out of the way, so the next round starts with neither live.
        for (const { id, request } of made) {
          if (stored.find((workflow) => workflow.id === id)?.status === 'live') await world.store.workflows.setActive(id, false, 'Owen Clarke');
          else await world.store.publishRequests.decide(request.id, 'rejected', 'Samira Khan', 'Next round');
        }
      }
    }, 300_000);

    it('two simultaneous approvals of one item advance the run once', async () => {
      const world = await fresh();
      for (let round = 0; round < ROUNDS; round += 1) {
        const run = await world.start('WO-2231', { recordId: nextRecord() });
        const item = await world.itemFor(run.id, 'Raj Patel');
        const answers = await Promise.all([world.decide(item.id, 'Raj Patel', 'approved'), world.decide(item.id, 'Raj Patel', 'approved')]);
        expect(answers.filter((answer) => answer.ok)).toHaveLength(1);
        expect(answers.find((answer) => !answer.ok)).toMatchObject({ ok: false, code: 'ALREADY_DONE' });
        const after = await world.run(run.id);
        expect(after.status).toBe('completed');
        expect(countLog(after.log, (entry) => entry.m === 'Raj Patel approved.')).toBe(1);
        expect(countLog(after.log, (entry) => entry.m === 'Completed.')).toBe(1);
        expect(after.steps.RA_A1.decisions).toHaveLength(1);
        expect((await world.outbox({ runId: run.id })).filter((message) => message.subject.endsWith('Tell the supplier'))).toHaveLength(1);
      }
    }, 300_000);

    it('approve against reject on one item: one wins, and the run does what the winner said', async () => {
      const world = await fresh();
      for (let round = 0; round < ROUNDS; round += 1) {
        const run = await world.start('WO-2231', { recordId: nextRecord() });
        const item = await world.itemFor(run.id, 'Raj Patel');
        const [approve, reject] = await Promise.all([world.decide(item.id, 'Raj Patel', 'approved'), world.decide(item.id, 'Raj Patel', 'rejected', 'No')]);
        expect([approve.ok, reject.ok].filter(Boolean)).toHaveLength(1);
        const after = await world.run(run.id);
        if (approve.ok) {
          expect(after.status).toBe('completed');
        } else {
          expect(after.status).toBe('running');
          expect(after.steps.RW.status).toBe('pending');
          expect((await world.items(run.id, { kind: 'resubmit' }))).toHaveLength(1);
        }
        expect(after.steps.RA_A1.decisions).toHaveLength(1);
      }
    }, 300_000);

    it('a decision racing a Stop: Stop is final, and nothing runs after it', async () => {
      const world = await fresh();
      for (let round = 0; round < ROUNDS; round += 1) {
        const run = await world.start('WO-2231', { recordId: nextRecord() });
        const item = await world.itemFor(run.id, 'Raj Patel');
        const [decision, stop] = await Promise.all([world.decide(item.id, 'Raj Patel', 'approved'), world.stop(run, { by: 'Owen Clarke', reason: 'Withdrawn' })]);
        const after = await world.run(run.id);
        if (stop.ok) {
          expect(after.status).toBe('stopped');
          expect(after.steps.RW.status).toBe('pending');
          expect((await world.outbox({ runId: run.id })).filter((message) => message.subject.endsWith('Tell the supplier'))).toHaveLength(0);
          // Either it lost and was refused, or it landed before the Stop and the run was still mid-way.
          if (!decision.ok) expect(decision).toMatchObject({ code: 'RUN_STOPPED' });
        } else {
          expect(decision.ok).toBe(true);
          expect(after.status).toBe('completed');
          expect(stop).toMatchObject({ ok: false, code: 'RUN_ENDED' });
        }
      }
    }, 300_000);

    it('a decision racing a Stop on a longer run: nothing starts after the stop', async () => {
      const world = await fresh();
      for (let round = 0; round < ROUNDS; round += 1) {
        // WO-2214 asks several people at once, so an approval landing first still leaves the run open for the Stop.
        const run = await world.start('WO-2214', { recordId: nextRecord() });
        const items = (await world.items(run.id)).filter((item) => item.status === 'open' && item.kind === 'approve');
        expect(items.length).toBeGreaterThan(1);
        const results = await Promise.all([
          ...items.map((item) => world.decide(item.id, item.assignee, 'approved')),
          world.stop(run, { by: 'Owen Clarke', reason: 'Withdrawn' }),
        ]);
        const stop = results[results.length - 1];
        expect(stop.ok).toBe(true);
        const after = await world.run(run.id);
        expect(after.status).toBe('stopped');
        const stopAt = after.log.findIndex((entry) => entry.type === 'stopped');
        expect(after.log.slice(stopAt + 1)).toEqual([]);
        expect((await world.items(run.id)).filter((item) => item.status === 'open')).toEqual([]);
        expect(after.steps.RW.status).toBe('pending');
      }
    }, 300_000);

    it('two Stops: one succeeds, the other is told it is stopped; Pause and Resume racing Stop never bring it back', async () => {
      const world = await fresh();
      for (let round = 0; round < ROUNDS; round += 1) {
        const run = await world.start('WO-2231', { recordId: nextRecord() });
        const [a, b] = await Promise.all([world.stop(run, { by: 'Owen Clarke', reason: 'One' }), world.stop(run, { by: 'Samira Khan', reason: 'Two' })]);
        expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
        expect((a.ok ? b : a)).toMatchObject({ code: 'RUN_STOPPED' });
        const after = await world.run(run.id);
        expect(countLog(after.log, (entry) => entry.type === 'stopped')).toBe(1);

        const second = await world.start('WO-2231', { recordId: nextRecord() });
        await world.pause(second, { by: 'Owen Clarke' });
        const [resume, stop] = await Promise.all([world.resume(second, { by: 'Owen Clarke' }), world.stop(second, { by: 'Owen Clarke', reason: 'Final' })]);
        expect(stop.ok).toBe(true);
        if (!resume.ok) expect(resume).toMatchObject({ code: 'RUN_STOPPED' });
        expect((await world.run(second.id)).status).toBe('stopped');
      }
    }, 300_000);

    it('simultaneous ticks send one reminder and one escalation', async () => {
      const world = await fresh();
      const run = await world.start('WO-2231', { recordId: nextRecord() });
      world.clock.set(hoursAfter(24));
      const first = await Promise.all([world.tick(), world.tick(), world.tick()]);
      expect(first.some((result) => result.processed >= 1)).toBe(true);
      const reminders = async () => (await world.outbox({ runId: run.id })).filter((message) => message.subject.startsWith('Reminder:'));
      expect(await reminders()).toHaveLength(1);
      world.clock.set(hoursAfter(48));
      await Promise.all([world.tick(), world.tick(), world.tick()]);
      const after = await world.run(run.id);
      expect((await world.outbox({ runId: run.id })).filter((message) => message.subject.endsWith('needs you'))).toHaveLength(1);
      expect((await world.items(run.id)).filter((item: WorkItem) => item.chaserOf)).toHaveLength(1);
      expect(countLog(after.log, (entry) => entry.type === 'reminder')).toBe(1);
      expect(countLog(after.log, (entry) => entry.type === 'escalated')).toBe(1);
    }, 300_000);

    it('simultaneous ticks over a due Wait and a due retry do the work once', async () => {
      const world = await fresh();
      const recordId = nextRecord();
      const run = await world.start('OFF-902', { recordId }, { fail_system: 'Okta' });
      await world.done((await world.itemFor(run.id, 'Sam Patel')).id, 'Sam Patel');
      await world.decide((await world.itemFor(run.id, 'Tom Reed', 'collect_review')).id, 'Tom Reed', 'verified');
      world.clock.set('2026-10-23T16:00:00Z');
      await Promise.all([world.tick(), world.tick()]);
      const failing = await world.run(run.id);
      expect(failing.steps.M1.status).toBe('done');
      expect(countLog(failing.log, (entry) => entry.m === 'Remove access: started.')).toBe(1);
      world.clock.set('2026-10-23T16:05:00Z');
      await Promise.all([world.tick(), world.tick()]);
      const retried = await world.run(run.id);
      expect(countLog(retried.log, (entry) => entry.m.startsWith('Retry 1 of 3'))).toBe(1);
      expect(countLog(retried.log, (entry) => entry.m.startsWith('Retry 2 of 3'))).toBe(0);
    }, 300_000);

    it('duplicate inbound events at once start one run', async () => {
      const world = await fresh();
      for (let round = 0; round < ROUNDS; round += 1) {
        const recordId = nextRecord();
        const answers = await Promise.all([1, 2, 3, 4].map(() => world.event('WO-2231', { recordId })));
        expect(answers.filter((answer) => answer.outcome === 'started')).toHaveLength(1);
        expect(answers.filter((answer) => answer.outcome === 'duplicate')).toHaveLength(3);
        const runs = await world.store.runs.list({ recordId });
        expect(runs).toHaveLength(1);
        expect((await world.items(runs[0].id)).filter((item) => item.kind === 'approve')).toHaveLength(1);
        expect((await world.outbox({ runId: runs[0].id })).filter((message) => message.subject.startsWith('Approval needed:'))).toHaveLength(1);
        const events = await world.store.inbound.findByRecord(recordId);
        expect(events.map((event) => event.outcome).sort()).toEqual(['duplicate', 'duplicate', 'duplicate', 'started']);
      }
    }, 300_000);

    it('a decision racing a tick that escalates it: one answer, one completion', async () => {
      const world = await fresh();
      for (let round = 0; round < ROUNDS; round += 1) {
        const before = world.clock.now();
        const run = await world.start('WO-2231', { recordId: nextRecord() });
        const item = await world.itemFor(run.id, 'Raj Patel');
        world.clock.set(hoursAfter(48, before));
        const [decision] = await Promise.all([world.decide(item.id, 'Raj Patel', 'approved'), world.tick()]);
        expect(decision.ok).toBe(true);
        const after = await world.run(run.id);
        expect(after.status).toBe('completed');
        expect(countLog(after.log, (entry) => entry.m === 'Completed.')).toBe(1);
        expect((await world.items(run.id)).filter((candidate) => candidate.status === 'open')).toEqual([]);
        world.clock.set(before);
      }
    }, 300_000);

    it('a record edit racing a decision: both land and the plan is current', async () => {
      const world = await fresh();
      for (let round = 0; round < ROUNDS; round += 1) {
        const recordId = nextRecord();
        const run = await world.start('WO-2231', { recordId });
        const item = await world.itemFor(run.id, 'Raj Patel');
        const [decision] = await Promise.all([world.decide(item.id, 'Raj Patel', 'approved'), world.service.editRecord('work_order', recordId, { site: `Site ${round}` })]);
        expect(decision.ok).toBe(true);
        const data = (await world.store.records.get('work_order', recordId))?.data as Record<string, unknown>;
        expect(data.site).toBe(`Site ${round}`);
        expect((await world.run(run.id)).status).toBe('completed');
      }
    }, 300_000);

    it('two approvers on an “any one” item: the step completes once', async () => {
      const world = await fresh();
      await world.publishEdited('wf-wo-sub', (nodes) => {
        (nodes.RA_A1 as { mode: string }).mode = 'any';
      });
      for (let round = 0; round < ROUNDS; round += 1) {
        const run = await world.start('WO-2231', { recordId: nextRecord() }, { requester: 'Coordinator' });
        const open = (await world.items(run.id)).filter((item) => item.kind === 'approve' && item.status === 'open');
        expect(open.map((item) => item.assignee).sort()).toEqual(['Grace Kim', 'Raj Patel']);
        const answers = await Promise.all(open.map((item) => world.decide(item.id, item.assignee, 'approved')));
        expect(answers.some((answer) => answer.ok)).toBe(true);
        const after = await world.run(run.id);
        expect(after.status).toBe('completed');
        expect(countLog(after.log, (entry) => entry.m === 'Completed.')).toBe(1);
        expect((await world.outbox({ runId: run.id })).filter((message) => message.subject.endsWith('Tell the supplier'))).toHaveLength(1);
      }
      // Leave the shared workflow as it was: later versions are fine, but later tests read mode 'all'.
      await world.publishEdited('wf-wo-sub', (nodes) => {
        (nodes.RA_A1 as { mode: string }).mode = 'all';
      });
    }, 300_000);

    it('two approvers of one flow change: it publishes once', async () => {
      const world = await fresh();
      const found = await world.store.workflows.get('wf-jp');
      const version = found?.workflow.version as number;
      await world.publishEdited('wf-jp', (nodes) => {
        (nodes.T as { label: string }).label = '';
      });
      const after = await world.store.workflows.get('wf-jp');
      expect(after?.workflow.version).toBe(version + 1);
      const snapshot = { ...(after?.workflow as NonNullable<typeof after>['workflow']) };
      delete snapshot.versions;
      const request = await world.store.publishRequests.create(
        { workflowId: 'wf-jp', snapshot, goLive: world.clock.asOf(), precedence: [], review: { impact: 0, mustFix: [], overlaps: [], openOverlaps: [], canSend: true, effective: world.clock.asOf() }, requestedBy: 'Flow Admin' },
        { submittedBy: 'Flow Admin', submittedAt: world.clock.now(), effective: world.clock.asOf(), precedence: [] },
        ['Samira Khan', 'Owen Clarke'],
      );
      const results = await Promise.allSettled([world.store.workflows.publishVersion('wf-jp', request, 'Samira Khan'), world.store.workflows.publishVersion('wf-jp', request, 'Owen Clarke')]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect((await world.store.workflows.get('wf-jp'))?.workflow.version).toBe(version + 2);
    }, 300_000);

    it('the record’s own fields survive two writers', async () => {
      const world = await fresh();
      const recordId = nextRecord();
      await world.start('WO-2231', { recordId });
      await Promise.all([world.service.editRecord('work_order', recordId, { site: 'A' }), world.service.editRecord('work_order', recordId, { cost_center: 'B' })]);
      const data = (await world.store.records.get('work_order', recordId))?.data as Record<string, unknown>;
      expect(data).toMatchObject({ site: 'A', cost_center: 'B' });
      expect(actor('Raj Patel').name).toBe('Raj Patel');
    }, 300_000);
  });
}
