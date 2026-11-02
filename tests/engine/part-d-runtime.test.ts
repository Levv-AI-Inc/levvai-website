import { beforeEach, describe, expect, it } from 'vitest';
import { createWorld, hoursAfter, recordOf, START, type World } from '../support/runtime-world';

/**
 * 06 Part D: expected values are taken from the document as written. The engine half runs on the real runtime and the
 * real store logic (memory driver) with a clock the test moves; tests/e2e/part-d-runtime.spec.ts is the browser half.
 */

const FORBIDDEN = { ok: false, code: 'FORBIDDEN', message: 'Only the workflow owner or an admin can pause, resume or stop it.' };
const STOPPED = { ok: false, code: 'RUN_STOPPED', message: 'This workflow is stopped. It can’t be resumed.' };

let world: World;
let run: Awaited<ReturnType<World['start']>>;

beforeEach(async () => {
  world = await createWorld();
  run = await world.start('WO-2231');
});

const manualEntries = (log: { type: string }[]) => log.filter((event) => ['paused', 'resumed', 'stopped'].includes(event.type));

describe('5.1 fixture', () => {
  it('Budget check and Duplicate pass, Business sign-off waits on Raj Patel with the Chaser, Tell the supplier has not started', () => {
    expect(run.status).toBe('running');
    expect(run.workflowId).toBe('wf-wo-sub');
    expect(run.steps.RA_CB.status).toBe('done');
    expect(run.steps.RA_CD.status).toBe('done');
    expect(run.steps.RA_A1.status).toBe('waiting');
    expect(run.steps.RA_A1.assignees).toEqual(['Raj Patel']);
    expect(run.steps.RA_A1.remindAt).toBe('2026-10-21T09:00:00.000Z');
    expect(run.steps.RA_A1.escalateAt).toBe('2026-10-22T09:00:00.000Z');
    expect(run.steps.RW.status).toBe('pending');
  });
});

describe('RT', () => {
  it('RT-01 Running → paused', async () => {
    world.clock.set('2026-10-20T10:00:00Z');
    const result = await world.pause(run, { by: 'Owen Clarke', reason: 'Supplier dispute' });
    expect(result.ok).toBe(true);
    expect(result.run.status).toBe('paused');
    expect(result.run.pausedBy).toBe('Owen Clarke');
    expect(result.run.pausedAt).toBe('2026-10-20T10:00:00.000Z');
    expect(result.run.pauseReason).toBe('manual');
    expect(result.run.steps.RA_A1.status).toBe('waiting');
    expect(result.run.log).toContainEqual({ at: '2026-10-20T10:00:00.000Z', by: 'Owen Clarke', type: 'paused', m: 'Supplier dispute' });
  });

  it('RT-02 Paused → running', async () => {
    world.clock.set('2026-10-20T10:00:00Z');
    await world.pause(run, { by: 'Owen Clarke', reason: 'Supplier dispute' });
    world.clock.set('2026-10-20T12:00:00Z');
    const result = await world.resume(run, { by: 'Owen Clarke' });
    expect(result.ok).toBe(true);
    expect(result.run.status).toBe('running');
    expect(result.run.pausedBy).toBeUndefined();
    expect(result.run.pausedAt).toBeUndefined();
    expect(result.run.pauseReason).toBeUndefined();
    expect(result.run.log).toContainEqual({ at: '2026-10-20T12:00:00.000Z', by: 'Owen Clarke', type: 'resumed', m: '' });
  });

  it('RT-03 Pause reason is optional', async () => {
    const result = await world.pause(run, { by: 'Owen Clarke' });
    expect(result.ok).toBe(true);
    expect(manualEntries(result.run.log)[0]).toMatchObject({ type: 'paused', m: '' });
  });

  it('RT-04 Running → stopped needs a reason', async () => {
    const before = await world.run(run.id);
    for (const reason of ['', '   ']) {
      expect(await world.stop(run, { by: 'Owen Clarke', reason })).toEqual({ ok: false, code: 'REASON_REQUIRED', message: 'A reason is required to stop a workflow.' });
    }
    expect(await world.run(run.id)).toEqual(before);
    const result = await world.stop(run, { by: 'Owen Clarke', reason: 'Request withdrawn by the hiring manager' });
    expect(result.ok).toBe(true);
    expect(result.run.status).toBe('stopped');
    expect(result.run.stoppedBy).toBe('Owen Clarke');
    expect(result.run.stopReason).toBe('Request withdrawn by the hiring manager');
    expect(result.run.endedAt).toBeDefined();
    expect(result.run.steps.RA_A1.status).toBe('cancelled');
    expect(result.run.steps.RW.status).toBe('pending');
    expect(result.run.log).toContainEqual({ at: '2026-10-20T09:00:00.000Z', by: 'Owen Clarke', type: 'stopped', m: 'Request withdrawn by the hiring manager' });
  });

  it('RT-05 Paused → stopped', async () => {
    await world.pause(run, { by: 'Owen Clarke', reason: 'Supplier dispute' });
    const result = await world.stop(run, { by: 'Samira Khan', reason: 'Duplicate request' });
    expect(result.ok).toBe(true);
    expect(result.run.status).toBe('stopped');
    const manual = manualEntries(result.run.log);
    expect(manual[0]).toMatchObject({ type: 'paused', m: 'Supplier dispute' });
    expect(manual[1]).toMatchObject({ by: 'Samira Khan', type: 'stopped', m: 'Duplicate request' });
  });

  it('RT-06 Stopped is final', async () => {
    await world.stop(run, { by: 'Owen Clarke', reason: 'Request withdrawn by the hiring manager' });
    const before = await world.run(run.id);
    expect(await world.resume(run, { by: 'Owen Clarke' })).toEqual(STOPPED);
    expect(await world.pause(run, { by: 'Owen Clarke' })).toEqual(STOPPED);
    expect(await world.stop(run, { by: 'Owen Clarke', reason: 'again' })).toEqual(STOPPED);
    expect(await world.run(run.id)).toEqual(before);
  });

  it('RT-07 Invalid transitions on a running or paused run', async () => {
    expect(await world.resume(run, { by: 'Owen Clarke' })).toEqual({ ok: false, code: 'NOT_PAUSED', message: 'This workflow isn’t paused.' });
    await world.pause(run, { by: 'Owen Clarke' });
    const after = (await world.run(run.id)).log.length;
    expect(await world.pause(run, { by: 'Owen Clarke' })).toEqual({ ok: false, code: 'ALREADY_PAUSED', message: 'This workflow is already paused.' });
    expect((await world.run(run.id)).log.length).toBe(after);
  });

  it('RT-08 Steps after a Stop never start', async () => {
    const item = await world.itemFor(run.id, 'Raj Patel');
    await world.stop(run, { by: 'Owen Clarke', reason: 'Request withdrawn by the hiring manager' });
    const stoppedAt = Date.parse((await world.run(run.id)).stoppedAt as string);
    const refused = await world.decide(item.id, 'Raj Patel', 'approved');
    expect(refused).toMatchObject({ ok: false, code: 'RUN_STOPPED' });
    expect((await world.store.workItems.get(item.id))?.status).toBe('cancelled');
    const detail = await world.service.itemDetail({ name: 'Raj Patel', permissions: [], ownerTeams: {} }, item.id);
    expect(detail.runStatus).toBe('stopped');
    await world.advanceTo(hoursAfter(7 * 24));
    const later = await world.run(run.id);
    expect(later.steps.RW.status).toBe('pending');
    const sent = (await world.outbox({ runId: run.id })).filter((message) => Date.parse(message.createdAt) > stoppedAt);
    expect(sent).toEqual([]);
    expect((await world.items(run.id)).filter((candidate) => candidate.status === 'open')).toEqual([]);
  });

  it('RT-09 Chaser reminders are suspended while paused', async () => {
    const reminders = async () => (await world.outbox({ runId: run.id })).filter((message) => message.subject.startsWith('Reminder:'));
    const escalations = async () => (await world.outbox({ runId: run.id })).filter((message) => message.subject.endsWith('needs you'));
    world.clock.set(hoursAfter(10));
    await world.pause(run, { by: 'Owen Clarke' });
    await world.advanceTo(hoursAfter(40));
    expect(await reminders()).toEqual([]);
    expect(await escalations()).toEqual([]);
    const paused = await world.run(run.id);
    expect(paused.steps.RA_A1.remindAt).toBe('2026-10-21T09:00:00.000Z');
    await world.resume(run, { by: 'Owen Clarke' });
    const resumed = await world.run(run.id);
    expect(resumed.steps.RA_A1.remindAt).toBe('2026-10-22T15:00:00.000Z');
    expect(resumed.steps.RA_A1.escalateAt).toBe('2026-10-23T15:00:00.000Z');
    await world.advanceTo(hoursAfter(53.9));
    expect(await reminders()).toEqual([]);
    await world.advanceTo(hoursAfter(54));
    expect((await reminders()).length).toBe(1);
    expect((await reminders())[0].to).toBe('Raj Patel');
    await world.advanceTo(hoursAfter(77.9));
    expect(await escalations()).toEqual([]);
    await world.advanceTo(hoursAfter(78));
    expect((await reminders()).length).toBe(1);
    expect((await escalations()).length).toBe(1);
    expect((await escalations())[0].to).toBe('Nadia Rahman');
    expect((await world.run(run.id)).steps.RA_A1.escalatedTo).toBe('Nadia Rahman');
    expect((await world.run(run.id)).log).toContainEqual(expect.objectContaining({ type: 'escalated', m: 'No answer after 48h, so it went to Nadia Rahman (their manager).' }));
  });

  it('RT-10 Nothing starts while paused', async () => {
    const item = await world.itemFor(run.id, 'Raj Patel');
    world.clock.set(hoursAfter(1));
    await world.pause(run, { by: 'Owen Clarke' });
    await world.advanceTo(hoursAfter(2));
    expect((await world.decide(item.id, 'Raj Patel', 'approved')).ok).toBe(true);
    let current = await world.run(run.id);
    expect(current.steps.RA_A1.status).toBe('done');
    expect(current.steps.RA_A1.decisions?.[0]).toMatchObject({ by: 'Raj Patel', decision: 'approved', at: '2026-10-20T11:00:00.000Z' });
    expect(current.steps.RW.status).toBe('pending');
    await world.advanceTo(hoursAfter(5));
    expect((await world.run(run.id)).steps.RW.status).toBe('pending');
    await world.resume(run, { by: 'Owen Clarke' });
    current = await world.run(run.id);
    expect(current.steps.RW.status).toBe('done');
    expect(current.steps.RW.startedAt).toBe('2026-10-20T14:00:00.000Z');
    expect(current.status).toBe('completed');
  });

  it('RT-11 Only the workflow owner or an admin', async () => {
    const before = await world.run(run.id);
    for (const by of ['Grace Kim', 'Raj Patel']) {
      expect(await world.pause(run, { by })).toEqual(FORBIDDEN);
      expect(await world.stop(run, { by, reason: 'No' })).toEqual(FORBIDDEN);
    }
    expect(await world.run(run.id)).toEqual(before);
    expect((await world.pause(run, { by: 'Owen Clarke' })).ok).toBe(true);
    expect((await world.resume(run, { by: 'Owen Clarke' })).ok).toBe(true);
    expect((await world.pause(run, { by: 'Samira Khan' })).ok).toBe(true);
    expect((await world.stop(run, { by: 'Samira Khan', reason: 'Yes' })).ok).toBe(true);
  });

  it('RT-12 Every action is recorded with who, when and why', async () => {
    world.clock.set(hoursAfter(1));
    await world.pause(run, { by: 'Owen Clarke', reason: 'Waiting for budget' });
    world.clock.set(hoursAfter(3));
    await world.resume(run, { by: 'Samira Khan' });
    world.clock.set(hoursAfter(4));
    await world.stop(run, { by: 'Owen Clarke', reason: 'Budget withdrawn' });
    const { log } = await world.run(run.id);
    expect(manualEntries(log)).toEqual([
      { at: '2026-10-20T10:00:00.000Z', by: 'Owen Clarke', type: 'paused', m: 'Waiting for budget' },
      { at: '2026-10-20T12:00:00.000Z', by: 'Samira Khan', type: 'resumed', m: '' },
      { at: '2026-10-20T13:00:00.000Z', by: 'Owen Clarke', type: 'stopped', m: 'Budget withdrawn' },
    ]);
  });

  it('RT-13 Every running workflow has the controls', async () => {
    const samira = { name: 'Samira Khan', permissions: ['admin' as const], ownerTeams: {} };
    const started = [
      ['wf-onboard', 'WO-2214-A'],
      ['wf-offboard', 'OFF-902'],
      ['wf-access', 'AR-301'],
      ['wf-invoice', 'INV-8812'],
      ['wf-wo-sub', 'WO-2231'],
    ];
    for (const [workflowId, recordId] of started) {
      const current = recordId === 'WO-2231' ? run : await world.start(recordId);
      expect(current.workflowId).toBe(workflowId);
      expect(current.status).toBe('running');
      expect((await world.service.runDetail(samira, current.id)).canControl).toBe(true);
      const paused = await world.pause(current, { by: 'Samira Khan', reason: 'Checking' });
      expect(paused.ok).toBe(true);
      expect(paused.run.status).toBe('paused');
    }
    const timesheet = await world.start('TS-9934');
    expect(timesheet.workflowId).toBe('wf-ts-sub');
    expect(timesheet.status).toBe('completed');
    expect((await world.service.runDetail(samira, timesheet.id)).canControl).toBe(false);
  });

  it('RT-14 Turning a workflow Inactive does not pause or stop its runs', async () => {
    await world.store.workflows.setActive('wf-wo-sub', false, 'Flow Admin');
    await world.tick();
    expect((await world.run(run.id)).status).toBe('running');
    const item = await world.itemFor(run.id, 'Raj Patel');
    expect((await world.pause(run, { by: 'Owen Clarke' })).ok).toBe(true);
    expect((await world.resume(run, { by: 'Owen Clarke' })).ok).toBe(true);
    await world.decide(item.id, 'Raj Patel', 'approved');
    const finished = await world.run(run.id);
    expect(finished.status).toBe('completed');
    expect(finished.version).toBe(1);
    expect((await world.event('WO-2231', { event: 'submitted' })).outcome).toBe('no_workflow');
  });

  it('RT-15 Resuming a run paused by a failed system call', async () => {
    await world.publishEdited('wf-offboard', (nodes) => {
      (nodes.RV as { sys: { onFail: string } }).sys.onFail = 'pause';
    });
    const off = await world.start('OFF-902', {}, { fail_system: 'Okta' });
    expect(off.steps.XC.status).toBe('done');
    await world.done((await world.itemFor(off.id, 'Sam Patel')).id, 'Sam Patel');
    await world.decide((await world.itemFor(off.id, 'Tom Reed', 'collect_review')).id, 'Tom Reed', 'verified');
    await world.advanceTo('2026-10-23T16:00:00Z');
    const failing = await world.run(off.id);
    expect(failing.steps.M1.status).toBe('done');
    expect(failing.steps.RV.status).toBe('active');
    for (const at of ['2026-10-23T16:05:00Z', '2026-10-23T16:20:00Z', '2026-10-23T17:00:00Z']) await world.advanceTo(at);

    const paused = await world.run(off.id);
    expect(paused.status).toBe('paused');
    expect(paused.pauseReason).toBe('system_failure');
    expect(paused.pausedBy).toBe('Levv');
    expect(paused.steps.RV.status).toBe('failed');
    expect(paused.log.filter((event) => event.m.startsWith('Retry ')).map((event) => event.m.slice(0, 18))).toEqual(['Retry 1 of 3 for O', 'Retry 2 of 3 for O', 'Retry 3 of 3 for O']);
    const alert = (await world.outbox({ runId: off.id })).filter((message) => message.subject === 'Paused: Contractor offboarding for Cloud engineer, not extended');
    expect(alert.map((message) => message.to)).toEqual(['HR operations']);

    await world.service.editRecord('offboarding', 'OFF-902', { fail_system: null });
    const resumed = await world.resume(paused, { by: 'Samira Khan' });
    expect(resumed.ok).toBe(true);
    const going = await world.run(off.id);
    expect(going.status).toBe('running');
    expect(going.steps.RV.status).toBe('done');
    const manual = manualEntries(going.log);
    expect(manual[manual.length - 2]).toMatchObject({ by: 'Levv', type: 'paused' });
    expect(manual[manual.length - 1]).toMatchObject({ by: 'Samira Khan', type: 'resumed' });
    const stopped = await world.stop(going, { by: 'Samira Khan', reason: 'Enough' });
    expect(stopped.ok).toBe(true);
    expect(stopped.run.status).toBe('stopped');
  });

  it('RT-15, the first failure is at the wait, and stop works while paused by a system', async () => {
    await world.publishEdited('wf-offboard', (nodes) => {
      (nodes.RV as { sys: { onFail: string } }).sys.onFail = 'pause';
    });
    const off = await world.start('OFF-902', {}, { fail_system: 'Okta' });
    await world.done((await world.itemFor(off.id, 'Sam Patel')).id, 'Sam Patel');
    await world.decide((await world.itemFor(off.id, 'Tom Reed', 'collect_review')).id, 'Tom Reed', 'verified');
    // One leap past all of them: the tick catches up rather than losing retries.
    await world.advanceTo('2026-10-23T16:00:00Z');
    await world.advanceTo('2026-10-23T18:00:00Z');
    const paused = await world.run(off.id);
    expect(paused.status).toBe('paused');
    expect((await world.stop(paused, { by: 'Samira Khan', reason: 'Okta is gone' })).ok).toBe(true);
    expect((await world.run(off.id)).steps.RV.status).toBe('cancelled');
  });
});

describe('recordOf fixture sanity', () => {
  it('every Part D record is in the fixture', () => {
    for (const id of ['WO-2231', 'WO-2214-A', 'OFF-902', 'AR-301', 'INV-8812', 'TS-9934']) expect(recordOf(id).id).toBe(id);
    expect(START).toBe('2026-10-20T09:00:00Z');
  });
});
