import { describe, expect, it } from 'vitest';
import { runTest } from '@flow-studio/engine/compose';
import { createEditor } from '@flow-studio/engine/edit';
import { lintWorkflow, novaCount, novaHeader } from '@flow-studio/engine/lint';
import {
  approvePublish,
  canApprove,
  defaultGoLive,
  findOverlaps,
  goLiveError,
  othersCanApprove,
  publishedToast,
  publishReview,
  sendForApproval,
  statusText,
  type ActingUser,
} from '@flow-studio/engine/publish';
import { copy } from '@flow-studio/engine/copy';
import type { ApproveNode, CollectNode, CondNode, CondPath, EngineContext, Issue, SystemNode, TaskNode, WfNode, Workflow } from '@flow-studio/model';
import { applySetup, casesOf, iGraph, newWorkflow, normDeep, setupOf, tableOf, type Setup } from '../support/acceptance-doc';
import { loadTestActors, makeContext, workflowById } from '../support/context';

/** 06 Part C: "Where several items are listed they may come in any order unless stated." */
const sorted = (issues: Issue[]) => [...issues].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const expectIssues = (actual: Issue[], expected: Issue[]) => expect(normDeep(sorted(actual))).toStrictEqual(normDeep(sorted(expected)));

const lint = (wf: Workflow, ctx: EngineContext) => lintWorkflow(wf, ctx).issues;

const OVERLAP_NEW: Issue = {
  sev: 'bad',
  overlap: 'wf-wo-sub',
  m: 'Overlaps with “Work order submitted” on 140 past records (Everywhere and Everywhere). Set which one wins before publishing.',
};

const usersOf = (set: 'default' | 'author-only-approver'): ActingUser[] => loadTestActors().actorSets[set].users;
const user = (name: string): ActingUser => {
  const found = usersOf('default').find((u) => u.name === name);
  if (!found) throw new Error(`No actor ${name}`);
  return found;
};

function livePatched(id: string, patch: (nodes: Record<string, WfNode>) => void): { ctx: EngineContext; wf: Workflow } {
  const ctx = makeContext();
  const wf = workflowById(ctx, id);
  patch(wf.draft.nodes);
  return { ctx, wf };
}

describe('Part C · engine halves', () => {
  it('LP-01 An Approve step with nobody chosen blocks publish', () => {
    const ctx = makeContext();
    const wf = newWorkflow(iGraph('I1'));
    const l11: Issue = { sev: 'bad', node: 'n102', m: '“Approval” doesn’t say who approves yet.' };
    expectIssues(lint(wf, ctx), [l11, OVERLAP_NEW]);
    expect(novaCount(lint(wf, ctx))).toBe(2);
    expect(normDeep(publishReview(wf, ctx))).toStrictEqual(
      normDeep({
        impact: 140,
        mustFix: [l11],
        overlaps: [{ id: 'wf-wo-sub', name: 'Work order submitted', scope: {}, priority: null, count: 140 }],
        openOverlaps: [{ id: 'wf-wo-sub', name: 'Work order submitted', scope: {}, priority: null, count: 140 }],
        canSend: false,
        effective: '2026-12-01',
      }),
    );
  });

  it('LP-02 A named Approve step emptied on a live workflow', () => {
    const { ctx, wf } = livePatched('wf-wo-sub', (n) => {
      (n.RA_A2 as ApproveNode).roles = [];
    });
    expectIssues(lint(wf, ctx), [{ sev: 'bad', node: 'RA_A2', m: '“Rate review” doesn’t say who approves yet.' }]);
    expect(novaCount(lint(wf, ctx))).toBe(1);
    expect(statusText(wf)).toBe('Live v1 · unpublished changes');
    expect(publishReview(wf, ctx).canSend).toBe(false);
  });

  it('LP-03 An escalation step with nobody', () => {
    const { ctx, wf } = livePatched('wf-wo-sub', (n) => {
      (n.RA_CDe as ApproveNode).roles = [];
    });
    expectIssues(lint(wf, ctx), [{ sev: 'bad', node: 'RA_CDe', m: '“Duplicate found: escalation” doesn’t say who approves yet.' }]);
    expect(publishReview(wf, ctx).canSend).toBe(false);
  });

  it('LP-04 Ask people to decide with nobody chosen', () => {
    const { ctx, wf } = livePatched('wf-onboard', (n) => {
      (n.BG as CollectNode).failRoles = [];
    });
    expectIssues(lint(wf, ctx), [{ sev: 'bad', node: 'BG', m: '“Background check” doesn’t say who decides when it fails.' }]);
    expect(publishReview(wf, ctx).canSend).toBe(false);
  });

  describe('LP-05 Empty path', () => {
    it('LP-05 the I12 graph: the L10 item, plus the overlap item', () => {
      const ctx = makeContext();
      expectIssues(lint(newWorkflow(iGraph('I12')), ctx), [
        { sev: 'warn', node: 'n103', m: 'Path “Off-payroll” in “Over $500K?” has no conditions, so it matches everything.' },
        OVERLAP_NEW,
      ]);
    });

    it('LP-05 live RA_C1', () => {
      const { ctx, wf } = livePatched('wf-wo-sub', (n) => {
        ((n.RA_C1 as CondNode).outs[0] as CondPath).rows = [];
      });
      expectIssues(lint(wf, ctx), [{ sev: 'warn', node: 'RA_C1', m: 'Path “Over 10%” in “Rate over card?” has no conditions, so it matches everything.' }]);
      expect(publishReview(wf, ctx).canSend).toBe(true);
    });

    it('LP-05 live RA_C2, not the last path', () => {
      const { ctx, wf } = livePatched('wf-wo-sub', (n) => {
        ((n.RA_C2 as CondNode).outs[0] as CondPath).rows = [];
      });
      expectIssues(lint(wf, ctx), [
        { sev: 'warn', node: 'RA_C2', m: 'Path “Over $1M” in “Value band” has no conditions, so it matches everything and the paths below it never run.' },
      ]);
      expect(publishReview(wf, ctx).canSend).toBe(true);
    });
  });

  describe('LP-06 Named person without a backup', () => {
    const withChloe = () => {
      const ctx = makeContext();
      const wf = workflowById(ctx, 'wf-wo-sub');
      applySetup(wf, setupOf('EN-055') as Setup);
      return { ctx, wf };
    };

    it('LP-06 warns, and warnings do not block', () => {
      const { ctx, wf } = withChloe();
      expectIssues(lint(wf, ctx), [{ sev: 'warn', node: 'RA_A2', m: '“Rate review” names Chloe Martin with no backup. If they’re away, it pauses.' }]);
      expect(publishReview(wf, ctx).canSend).toBe(true);
    });

    it('LP-06 with backup Lena Fischer the list is empty and Test is unchanged', () => {
      const { ctx, wf } = withChloe();
      const record = ctx.samples.find((s) => s.id === 'WO-2214') as (typeof ctx.samples)[number];
      const before = runTest({ workflow: wf, record, ctx });
      (wf.draft.nodes.RA_A2 as ApproveNode).backup = 'Lena Fischer';
      expect(lint(wf, ctx)).toEqual([]);
      expect(runTest({ workflow: wf, record, ctx })).toEqual(before);
      expect(before.steps.find((s) => s.id === 'RA_A2')?.rounds?.[0].people).toBe('Chloe Martin');
    });

    it('LP-06 the same warning for “Otherwise: approval”', () => {
      const ctx = makeContext();
      const wf = workflowById(ctx, 'wf-wo-sub');
      applySetup(wf, setupOf('EN-046') as Setup);
      expect(lint(wf, ctx).map((i) => i.m)).toContain('“Otherwise: approval” names Chloe Martin with no backup. If they’re away, it pauses.');
    });

    it('LP-06 the same warning for Hannah Brooks in EN-067', () => {
      const ctx = makeContext();
      const wf = workflowById(ctx, 'wf-wo-sub');
      applySetup(wf, setupOf('EN-067') as Setup);
      expect(normDeep(lint(wf, ctx).map((i) => i.m))).toContain(normDeep('“Rate review” names Hannah Brooks with no backup. If they’re away, it pauses.'));
    });
  });

  describe('LP-07 An If that sends every path to the same place', () => {
    it('LP-07 live', () => {
      const { ctx, wf } = livePatched('wf-wo-sub', (n) => {
        (n.RA_C1 as CondNode).outs[0].to = 'RA_C2';
      });
      // 06 lists only the L4 item, but this setup leaves Rate review with no way in, and L13 (03 §12.2, required by D24) reports that.
      // 03 outranks 06, so the L13 item is asserted too. The L4 item is exactly as written in 06.
      expectIssues(lint(wf, ctx), [
        { sev: 'warn', node: 'RA_C1', m: '“Rate over card?” sends every path to the same place, so it does nothing yet.' },
        { sev: 'warn', node: 'RA_A2', m: '“Rate review” can’t be reached from Start, so it never runs.' },
      ]);
    });

    it('LP-07 the I3 graph, plus the overlap item', () => {
      const ctx = makeContext();
      expectIssues(lint(newWorkflow(iGraph('I3')), ctx), [
        { sev: 'warn', node: 'n103', m: '“Over $500K?” sends every path to the same place, so it does nothing yet.' },
        OVERLAP_NEW,
      ]);
    });
  });

  it('LP-08 Collect & verify that asks for nothing', () => {
    const { ctx, wf } = livePatched('wf-onboard', (n) => {
      (n.LB as CollectNode).items = [];
    });
    expectIssues(lint(wf, ctx), [{ sev: 'warn', node: 'LB', m: '“Laptop and badge” doesn’t ask for anything yet.' }]);
  });

  describe('LP-09 Seed workflows: Nova and impact counts', () => {
    const ids: Record<string, string> = Object.fromEntries(makeContext().workflows.map((w) => [w.name, w.id]));
    const unquote = (cell: string) => cell.replace(/^“/, '').replace(/”$/, '');

    it.each(tableOf('LP-09'))('LP-09 %s: %s records', (name, records, header, items, dialog) => {
      const ctx = makeContext();
      const wf = workflowById(ctx, ids[name]);
      const result = lintWorkflow(wf, ctx);
      expect(result.recs).toBe(Number(records));
      expect(normDeep(novaHeader(result.recs))).toBe(normDeep(unquote(header)));
      const review = publishReview(wf, ctx);
      expect(review.impact).toBe(Number(records));
      if (name === 'Data and AI hires') {
        expect(result.issues.map((i) => i.sev)).toEqual(['bad']);
        expect(items).toContain(result.issues[0].m);
        expect(novaCount(result.issues)).toBe(1);
        expect(dialog).toContain(copy.overlapQuestion(review.overlaps[0].name, review.overlaps[0].count));
        expect(review.canSend).toBe(false);
      } else {
        expect(result.issues).toEqual([]);
        expect(novaCount(result.issues)).toBe(0);
        expect(unquote(dialog)).toBe(copy.readyToSend);
        expect(review.canSend).toBe(true);
      }
      expect(normDeep(copy.impact(result.recs))).toBe(
        normDeep(`Applies to new runs. ${records} records in the last 90 days would have started this workflow. Anything already running keeps its current version.`),
      );
    });

    it('LP-09 covers all 15 workflows', () => {
      expect(tableOf('LP-09')).toHaveLength(15);
    });
  });

  describe('LP-10 Overlap on publish: “Data and AI hires” vs “UK Technology work orders”', () => {
    const overlap = {
      id: 'wf-wo-sub-wo-uk-tech',
      name: 'UK Technology work orders',
      scope: { country: ['UK'], business_unit: ['Technology'] },
      priority: null,
      count: 2,
    };
    const choice = [{ otherId: 'wf-wo-sub-wo-uk-tech', winner: 'self' as const }];

    it('LP-10 publishReview before and after a choice', () => {
      const ctx = makeContext();
      const wf = workflowById(ctx, 'wf-wo-sub-wo-data');
      expect(publishReview(wf, ctx)).toMatchObject({ impact: 26, mustFix: [], overlaps: [overlap], openOverlaps: [overlap], canSend: false });
      expect(publishReview(wf, ctx, choice)).toMatchObject({ openOverlaps: [], canSend: true });
    });

    it('LP-10 the choice waits on pending; both priorities stay null', () => {
      const ctx = makeContext();
      const wf = workflowById(ctx, 'wf-wo-sub-wo-data');
      const sent = sendForApproval(wf, ctx, { author: 'Flow Admin', precedence: choice });
      if (!sent.ok) throw new Error(sent.message);
      // 02 §4 and §14 type this as an array; 06 and 03 §13.3 write one entry. Every workflow can overlap several.
      expect(sent.workflow.pending?.precedence).toEqual([{ otherId: 'wf-wo-sub-wo-uk-tech', winner: 'self' }]);
      expect(sent.workflow.priority).toBeNull();
      expect(workflowById(ctx, 'wf-wo-sub-wo-uk-tech').priority).toBeNull();
      expect(statusText(sent.workflow)).toBe('Waiting for approval');
      expect(normDeep(sent.message)).toBe(normDeep('Sent for approval. Anyone with the “Approve flow changes” permission can approve it. You can’t approve your own change.'));
    });

    it('LP-10 Samira Khan approves: priorities apply, v1, live, the version names both people', () => {
      const ctx = makeContext();
      const sent = sendForApproval(workflowById(ctx, 'wf-wo-sub-wo-data'), ctx, { author: 'Flow Admin', precedence: choice });
      if (!sent.ok) throw new Error(sent.message);
      const approved = approvePublish(sent.workflow, user('Samira Khan'), ctx);
      if (!approved.ok) throw new Error(approved.message);
      expect(approved.workflow).toMatchObject({ id: 'wf-wo-sub-wo-data', priority: 1, version: 1, status: 'live', pending: null });
      expect(approved.others).toHaveLength(1);
      expect(approved.others[0]).toMatchObject({ id: 'wf-wo-sub-wo-uk-tech', priority: 2 });
      const versions = approved.workflow.versions ?? [];
      expect(versions[versions.length - 1]).toMatchObject({ version: 1, submittedBy: 'Flow Admin', approvedBy: 'Samira Khan' });
      expect(statusText(approved.workflow)).toBe('Live v1');
      expect(approved.toast).toBe('Published as v1, live on 20 Oct 2026');
    });

    it('LP-10 the author’s attempt returns an error and changes nothing', () => {
      const ctx = makeContext();
      const sent = sendForApproval(workflowById(ctx, 'wf-wo-sub-wo-data'), ctx, { author: 'Flow Admin', precedence: choice });
      if (!sent.ok) throw new Error(sent.message);
      const before = structuredClone(sent.workflow);
      const attempt = approvePublish(sent.workflow, user('Flow Admin'), ctx);
      expect(attempt.ok).toBe(false);
      expect(sent.workflow).toEqual(before);
    });

    it('LP-10 publishing UK Technology work orders shows no overlap (the other one is a draft)', () => {
      const ctx = makeContext();
      expect(publishReview(workflowById(ctx, 'wf-wo-sub-wo-uk-tech'), ctx).overlaps).toEqual([]);
    });
  });

  describe('LP-11 Site access request is ready to send: 0 records', () => {
    it('LP-11 publishReview and lint', () => {
      const ctx = makeContext();
      const wf = workflowById(ctx, 'wf-access');
      expect(publishReview(wf, ctx)).toMatchObject({ impact: 0, mustFix: [], overlaps: [], openOverlaps: [], canSend: true });
      expect(lint(wf, ctx)).toEqual([]);
    });

    it('LP-11 today, not the past effective date; after approval v2', () => {
      const ctx = makeContext();
      const wf = workflowById(ctx, 'wf-access');
      expect(defaultGoLive(wf, ctx)).toBe('2026-10-20');
      expect(publishReview(wf, ctx).effective).toBe('2026-10-20');
      const sent = sendForApproval(wf, ctx, { author: 'Flow Admin' });
      if (!sent.ok) throw new Error(sent.message);
      const approved = approvePublish(sent.workflow, user('Samira Khan'), ctx);
      if (!approved.ok) throw new Error(approved.message);
      expect(approved.workflow.version).toBe(2);
      expect(approved.toast).toBe('Published as v2, live on 20 Oct 2026');
    });

    it('LP-11 a past date is refused with the exact text', () => {
      const ctx = makeContext();
      expect(goLiveError('2026-10-19', ctx)).toBe('Pick today or a later date.');
      expect(goLiveError('2026-10-20', ctx)).toBeNull();
      const sent = sendForApproval(workflowById(ctx, 'wf-access'), ctx, { author: 'Flow Admin', effective: '2026-10-01' });
      expect(sent).toEqual({ ok: false, message: 'Pick today or a later date.' });
    });
  });

  describe('LP-12 Identical “Everywhere” scopes overlap', () => {
    const everywhere = { id: 'wf-wo-sub', name: 'Work order submitted', scope: {}, priority: null, count: 140 };

    it('LP-12 lint and publishReview', () => {
      const ctx = makeContext();
      const wf = newWorkflow(iGraph('I2'));
      expectIssues(lint(wf, ctx), [OVERLAP_NEW]);
      expect(publishReview(wf, ctx)).toMatchObject({ impact: 140, overlaps: [everywhere], openOverlaps: [everywhere], mustFix: [], canSend: false });
      expect(findOverlaps(wf, ctx).map((o) => o.id)).toEqual(['wf-wo-sub']);
    });

    it.each(['self', 'other'] as const)('LP-12 choosing %s empties openOverlaps; priorities change only on approval', (winner) => {
      const ctx = makeContext();
      const wf = newWorkflow(iGraph('I2'));
      const precedence = [{ otherId: 'wf-wo-sub', winner }];
      expect(publishReview(wf, ctx, precedence)).toMatchObject({ openOverlaps: [], canSend: true });
      const sent = sendForApproval(wf, ctx, { author: 'Flow Admin', precedence });
      if (!sent.ok) throw new Error(sent.message);
      expect(workflowById(ctx, 'wf-wo-sub').priority).toBeNull();
      expect(sent.workflow.priority).toBeNull();
      const approved = approvePublish(sent.workflow, user('Samira Khan'), ctx);
      if (!approved.ok) throw new Error(approved.message);
      expect(approved.workflow.priority).toBe(winner === 'self' ? 1 : 2);
      expect(approved.others[0].priority).toBe(winner === 'self' ? 2 : 1);
    });
  });

  describe('LP-13 The approver is anyone with “Approve flow changes” except the author', () => {
    const pending = { submittedBy: 'Flow Admin' };

    it.each([
      ['Samira Khan', true],
      ['Flow Admin', false],
      ['Grace Kim', false],
    ] as const)('LP-13 canApprove %s = %s', (name, expected) => {
      expect(canApprove(user(name), pending)).toBe(expected);
    });

    it('LP-13 nobody else can approve: the must-fix row', () => {
      const users = usersOf('author-only-approver');
      expect(othersCanApprove('Flow Admin', users)).toBe(false);
      expect(othersCanApprove('Flow Admin', usersOf('default'))).toBe(true);
      const ctx = makeContext({ approverAvailability: { othersCanApprove: false } });
      const review = publishReview(workflowById(ctx, 'wf-access'), ctx);
      expect(normDeep(review.mustFix)).toContainEqual(
        normDeep({ sev: 'bad', m: 'Nobody else can approve flow changes yet. Ask an admin to give someone the “Approve flow changes” permission.' }),
      );
      expect(review.canSend).toBe(false);
    });
  });

  describe('LP-14 Chaser: escalation has to come after the reminder', () => {
    it.each([
      ['RA_A1 sla 24', 'wf-wo-sub', 'RA_A1', 24, 24, '“Business sign-off”: escalation has to come after the reminder.'],
      ['RA_A1 sla 12', 'wf-wo-sub', 'RA_A1', 24, 12, '“Business sign-off”: escalation has to come after the reminder.'],
      ['K1 96/96', 'wf-ending', 'K1', 96, 96, '“Extend or end?”: escalation has to come after the reminder.'],
      ['RA_CDe sla 24', 'wf-wo-sub', 'RA_CDe', undefined, 24, '“Duplicate found: escalation”: escalation has to come after the reminder.'],
    ])('LP-14 %s', (_name, workflowId, nodeId, remind, sla, message) => {
      const { ctx, wf } = livePatched(workflowId, (n) => {
        const node = n[nodeId] as ApproveNode | TaskNode;
        if (remind !== undefined) node.remind = remind;
        node.sla = sla;
      });
      const expected: Issue = { sev: 'bad', node: nodeId, m: message };
      expectIssues(lint(wf, ctx), [expected]);
      const review = publishReview(wf, ctx);
      expect(normDeep(review.mustFix)).toContainEqual(normDeep(expected));
      expect(review.canSend).toBe(false);
    });

    it('LP-14 RA_A1.sla = 25 is valid', () => {
      const { ctx, wf } = livePatched('wf-wo-sub', (n) => {
        (n.RA_A1 as ApproveNode).remind = 24;
        (n.RA_A1 as ApproveNode).sla = 25;
      });
      expect(lint(wf, ctx)).toEqual([]);
    });
  });

  describe('LP-15 Production-only Nova checks and L8/L9', () => {
    it('LP-15 unreachable step', () => {
      const { ctx, wf } = livePatched('wf-wo-sub', (n) => {
        n.OLD = { id: 'OLD', kind: 'notify', label: 'Old reminder', recipients: ['hm'], channel: 'Email', outs: [{ key: 'next', to: 'END' }] };
      });
      expectIssues(lint(wf, ctx), [{ sev: 'warn', node: 'OLD', m: '“Old reminder” can’t be reached from Start, so it never runs.' }]);
    });

    it('LP-15 the worker as an approver', () => {
      const { ctx, wf } = livePatched('wf-wo-sub', (n) => {
        (n.RA_A2 as ApproveNode).roles = ['worker'];
      });
      expectIssues(lint(wf, ctx), [{ sev: 'bad', node: 'RA_A2', m: '“Rate review” asks the worker to approve or decide. The worker can’t approve, review or be escalated to.' }]);
    });

    it('LP-15 Run workflow with no target (the D19 graph, new-workflow case: plus the overlap item)', () => {
      const ctx = makeContext();
      const nodes = casesOf('EN-074').inlineGraph as Record<string, WfNode>;
      delete (nodes.RW1 as unknown as Record<string, unknown>).target;
      expectIssues(lint(newWorkflow(nodes), ctx), [{ sev: 'bad', node: 'RW1', m: '“Run workflow” doesn’t say which workflow to start.' }, OVERLAP_NEW]);
    });

    it('LP-15 a Wait with no date (new workflow: plus the overlap item)', () => {
      const ctx = makeContext();
      const nodes = createEditor(ctx).createWorkflow(null).draft.nodes;
      // 06 lists the node without `outs`; it sits on the Start line so the only finding is the missing date.
      nodes.HOLD = { id: 'HOLD', kind: 'wait', label: 'Hold', w: { mode: 'at' }, outs: [{ key: 'next', to: 'END' }] };
      nodes.T.outs = [{ key: 'next', to: 'HOLD' }];
      expectIssues(lint(newWorkflow(nodes), ctx), [{ sev: 'warn', node: 'HOLD', m: '“Hold” doesn’t have a date and time yet.' }, OVERLAP_NEW]);
    });

    it('LP-15 the Coupa graph (new workflow: plus the overlap item)', () => {
      const ctx = makeContext();
      const nodes = casesOf('EN-073').inlineGraph as Record<string, WfNode>;
      expect((nodes.CP as SystemNode).system).toBe('Coupa');
      expectIssues(lint(newWorkflow(nodes), ctx), [
        { sev: 'warn', node: 'CP', m: '“Raise purchase order” uses Coupa, which isn’t connected yet. It will give the work to a person until it is.' },
        OVERLAP_NEW,
      ]);
    });

    it('LP-15 a Notify with no recipients', () => {
      const { ctx, wf } = livePatched('wf-wo-sub', (n) => {
        (n.RW as unknown as { recipients: string[] }).recipients = [];
      });
      expectIssues(lint(wf, ctx), [{ sev: 'warn', node: 'RW', m: '“Tell the supplier” doesn’t tell anyone yet.' }]);
    });
  });

  describe('LP-16 “1 record” in the impact sentence', () => {
    it('LP-16 impact = 1 with a history fixture holding exactly one matching record', () => {
      const ctx = makeContext();
      const wf = workflowById(ctx, 'wf-access');
      const one = ctx.history.find((h) => h.record === 'work_order') as (typeof ctx.history)[number];
      ctx.history = [{ ...one, record: 'access_request', event: 'submitted' }];
      expect(publishReview(wf, ctx).impact).toBe(1);
    });

    it('LP-16 the sentence', () => {
      expect(copy.impact(1)).toBe('Applies to new runs. 1 record in the last 90 days would have started this workflow. Anything already running keeps its current version.');
    });
  });

  it('Toast date format', () => {
    expect(publishedToast(1, '2026-10-20')).toBe('Published as v1, live on 20 Oct 2026');
  });
});
