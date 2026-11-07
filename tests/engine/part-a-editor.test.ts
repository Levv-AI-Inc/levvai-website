import { describe, expect, it } from 'vitest';
import { runTest } from '@flow-studio/engine/compose';
import { evalRow } from '@flow-studio/engine/conditions';
import { copy } from '@flow-studio/engine/copy';
import { createEditor, isRefusal, type Editor, type EditResult, type Nodes } from '@flow-studio/engine/edit';
import { lintWorkflow } from '@flow-studio/engine/lint';
import { parseWhen, parseWhenRules, whenMessage, type CallGPT } from '@flow-studio/engine/nova-parse';
import { chaserFor, conditionText, fmt, rowText, subtitle } from '@flow-studio/engine/text';
import type { ApproveNode, CollectNode, CondNode, EngineContext, TaskNode, WfNode, Workflow } from '@flow-studio/model';
import { applySetup, docEntry, expectedOf, iGraph, normDeep, setupOf, tableOf, type Setup } from '../support/acceptance-doc';
import { makeContext, workflowById } from '../support/context';

/** 06 A.4: a context, its editor bound to it, and `wf(id)` a fresh clone of that seed workflow's normalised draft.nodes. */
interface Harness {
  ctx: EngineContext;
  ed: Editor;
  wf: (id: string) => Nodes;
  wfObj: (id: string) => Workflow;
}

function harness(openWorkflowId?: string): Harness {
  const ctx = makeContext();
  if (openWorkflowId) ctx.idGen.reserve([openWorkflowId]);
  return {
    ctx,
    ed: createEditor(ctx),
    wf: (id) => {
      ctx.idGen.reserve([id]);
      return structuredClone(workflowById(ctx, id).draft.nodes);
    },
    wfObj: (id) => workflowById(ctx, id),
  };
}

const ok = (result: EditResult): Nodes => {
  if (isRefusal(result)) throw new Error(`Refused: ${result.message}`);
  return result;
};

/** The graph a setup describes, applied to the same starting nodes (06 §1.6). */
function withSetup(nodes: Nodes, setup: Setup): Nodes {
  const holder = { draft: { nodes: structuredClone(nodes) } } as unknown as Workflow;
  applySetup(holder, setup);
  return holder.draft.nodes;
}

/** 06 A.4: compare the changed nodes with the expected data; other nodes must be untouched. */
function expectOnlyChanged(before: Nodes, after: Nodes, changed: Record<string, unknown>): void {
  expect(normDeep(pick(after, Object.keys(changed)))).toEqual(normDeep(changed));
  const others = Object.keys(before).filter((id) => !(id in changed));
  expect(pick(after, others)).toEqual(pick(before, others));
  expect(Object.keys(after).sort()).toEqual(Array.from(new Set([...Object.keys(before), ...Object.keys(changed)])).sort());
}

const pick = (nodes: Nodes, ids: string[]): Record<string, WfNode> => Object.fromEntries(ids.filter((id) => id in nodes).map((id) => [id, nodes[id]]));

const next = (node: WfNode): string => (node.outs as { to: string }[])[0].to;

const toastOf = (id: string): string => docEntry(id).lines.join(' ');

describe('A.3: each I graph is what the editor writes from the one before (06 §1.6)', () => {
  const steps: [string, string, (ed: Editor, nodes: Nodes) => EditResult][] = [
    ['I4', 'I5', (ed, n) => ed.setPathThen(n, 'n103', 'else', 'escalate', 'cco')],
    ['I5', 'I6', (ed, n) => ed.addPath(n, 'n103')],
    ['I6', 'I7', (ed, n) => ed.setPathThen(n, 'n103', 'p104', 'approve', 'proc')],
    ['I7', 'I8', (ed, n) => ed.setPathThen(n, 'n103', 'p1', 'reject')],
    ['I8', 'I9', (ed, n) => ed.setPathThen(n, 'n103', 'p104', 'reject')],
    ['I9', 'I10', (ed, n) => ed.deletePath(n, 'n103', 'p104')],
    ['I10', 'I11', (ed, n) => ed.addEitherOr(n, 'n103', 'p1')],
    ['I11', 'I12', (ed, n) => ed.removeRow(ed.removeRow(n, 'n103', 'p1', 1), 'n103', 'p1', 0)],
  ];
  it.each(steps)('%s → %s', (from, to, edit) => {
    const { ed } = harness('nf101');
    expect(ok(edit(ed, iGraph(from)))).toEqual(iGraph(to));
  });
});

describe('Part A.4 · Editor operations', () => {
  it('EN-098 setFlag → Reject is exactly the setup of EN-042', () => {
    const { ed, wf } = harness();
    const before = wf('wf-wo-sub-wo-uk-tech');
    const after = ed.setFlag(before, 'RA_CD', 'reject');
    expect(after).toEqual(withSetup(before, expectedOf('EN-098') as Setup));
    expect(expectedOf('EN-098')).toEqual(setupOf('EN-042'));
  });

  it('EN-099 setFlag back to Escalate', () => {
    const { ed, wf } = harness();
    const start = ed.setFlag(wf('wf-wo-sub-wo-uk-tech'), 'RA_CD', 'reject');
    const after = ed.setFlag(start, 'RA_CD', 'escalate');
    const expected = expectedOf('EN-099') as Record<string, Record<string, unknown>>;
    expect(normDeep(after.RA_CDf)).toEqual(normDeep(expected.RA_CDf));
    expect(after.RA_CD).toMatchObject(expected.RA_CD);
    const others = Object.keys(start).filter((id) => id !== 'RA_CD' && id !== 'RA_CDf');
    expect(pick(after, others)).toEqual(pick(start, others));
  });

  it.each(['EN-100', 'EN-101', 'EN-102'])('%s setPathThen on Otherwise', (id) => {
    const { ed, wf } = harness();
    const before = wf('wf-wo-sub');
    const call: Record<string, () => EditResult> = {
      'EN-100': () => ed.setPathThen(before, 'RA_C1', 'else', 'reject'),
      'EN-101': () => ed.setPathThen(before, 'RA_C1', 'else', 'escalate', 'g:fin_ctrl'),
      'EN-102': () => ed.setPathThen(before, 'RA_C1', 'else', 'approve', 'p:Chloe Martin'),
    };
    expect(ok(call[id]())).toEqual(withSetup(before, expectedOf(id) as Setup));
  });

  it.each(['reject', 'escalate', 'approve'] as const)('EN-103 %s then Carry on restores the line', (mode) => {
    const { ctx, ed, wf, wfObj } = harness();
    const seed = wf('wf-wo-sub');
    const after = ok(ed.setPathThen(ok(ed.setPathThen(seed, 'RA_C1', 'else', mode)), 'RA_C1', 'else', 'continue'));

    const cond = after.RA_C1 as CondNode;
    expect(cond.outs.find((o) => o.key === 'else')).toEqual({ key: 'else', to: 'RA_C2', label: 'Otherwise' });
    expect(cond.elseDo).toBe('continue');
    expect(cond.elseNode).toBeNull();
    expect(cond.mergeAt).toBe('RA_C2');
    const { elseDo: _d, elseNode: _n, elseWho: _w, ...bare } = cond;
    expect({ ...after, RA_C1: bare }).toEqual(seed);

    const workflow = wfObj('wf-wo-sub');
    workflow.draft.nodes = after;
    const record = ctx.samples.find((s) => s.id === 'WO-2231');
    expect(normDeep(runTest({ workflow, record: record as (typeof ctx.samples)[number], ctx }))).toStrictEqual(normDeep(expectedOf('EN-017')));
  });

  it('EN-104 insertStep Approve on a new workflow (02 §5.14 settles who and remind; see the override below)', () => {
    const { ed } = harness('nf101');
    const graph: Nodes = {
      T: { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: 'END' }] },
      END: { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] },
    };
    const after = ed.insertStep(graph, 'T', 'next', { kind: 'appr' });
    // 06 EN-104 lists the node without `who` and `remind`. 02 §5.14 (Approve row) and 03 §16.1 ("Create the node (DM §5.14)")
    // give it who:'roles', remind:24, and 02 outranks 06. Nothing else in the transcribed object is changed.
    const settledByDataModel = { who: 'roles', remind: 24 };
    const expected = expectedOf('EN-104') as Record<string, Record<string, unknown>>;
    expect(after).toEqual({ ...expected, n102: { ...expected.n102, ...settledByDataModel } });
  });

  it('EN-105 insertStep If in front of it', () => {
    const { ed } = harness('nf101');
    const before = iGraph('I2');
    const after = ed.insertStep(before, 'T', 'next', { kind: 'cond' });
    expect(after.n103).toEqual(expectedOf('EN-105'));
    expect(after.T.outs).toEqual([{ key: 'next', to: 'n103' }]);
    expect(pick(after, ['n102', 'END'])).toEqual(pick(before, ['n102', 'END']));
  });

  it('EN-106 addPath: the If as listed, and the rest is the I6 graph (the generated “No: escalation” follows the rename)', () => {
    const { ed } = harness('nf101');
    const after = ed.addPath(iGraph('I5'), 'n103');
    expect(after.n103).toEqual(expectedOf('EN-106'));
    expect(after).toEqual(iGraph('I6'));
  });

  it('EN-107 setPathThen approve', () => {
    const { ed } = harness('nf101');
    const before = iGraph('I6');
    expectOnlyChanged(before, ok(ed.setPathThen(before, 'n103', 'p104', 'approve', 'proc')), expectedOf('EN-107') as Record<string, unknown>);
  });

  it('EN-108 setPathThen reject', () => {
    const { ed } = harness('nf101');
    const before = iGraph('I7');
    expectOnlyChanged(before, ok(ed.setPathThen(before, 'n103', 'p1', 'reject')), expectedOf('EN-108') as Record<string, unknown>);
  });

  it('EN-109 the last carrying-on path cannot reject', () => {
    const { ed } = harness('nf101');
    const i8 = iGraph('I8');
    const withPath2 = ok(ed.setPathThen(i8, 'n103', 'p104', 'reject'));
    expect(withPath2).toEqual(expectedOf('EN-109'));
    const refused = ed.setPathThen(withPath2, 'n103', 'else', 'reject');
    expect(refused).toEqual({ ok: false, message: 'At least one path has to carry on' });
    expect(withPath2).toEqual(expectedOf('EN-109'));
  });

  it('EN-110 deletePath', () => {
    const { ed } = harness('nf101');
    expect(ed.deletePath(iGraph('I9'), 'n103', 'p104')).toEqual(expectedOf('EN-110'));
  });

  it('EN-111 addEitherOr, and the text it reads', () => {
    const { ctx, ed } = harness('nf101');
    const after = ed.addEitherOr(iGraph('I10'), 'n103', 'p1');
    expect(after.n103).toEqual(expectedOf('EN-111'));
    const path = (after.n103 as CondNode).outs[0] as CondNode['outs'][0] & { join: 'all'; rows: [] };
    expect(conditionText(path, ctx.catalog)).toBe('Engagement type is Off-payroll and (Total value ≥ $250K or Regulated role is yes)');
  });

  it('EN-112 deleteStep reconnects', () => {
    const { ed, wf } = harness();
    const before = wf('wf-wo-sub');
    const after = ed.deleteStep(before, 'RA_CB');
    expect(after).toEqual(withSetup(before, expectedOf('EN-112') as Setup));
    expect(next(after.T)).toBe('RA_CD');
  });

  it('EN-113 setSystemOnFail: Failed path, then back', () => {
    const { ed, wf } = harness();
    const seed = wf('wf-offboard');
    const expected = expectedOf('EN-113') as {
      added: Record<string, WfNode>;
      removed: string[];
      changed: { RV: { outs: { from: unknown; to: unknown }; sys: { from: unknown; to: unknown } } };
    };
    expect((seed.RV as { outs: unknown }).outs).toEqual(expected.changed.RV.outs.from);
    expect((seed.RV as { sys: unknown }).sys).toEqual(expected.changed.RV.sys.from);

    const first = ed.setSystemOnFail(seed, 'RV', 'path');
    expect(first.RVf).toEqual(expected.added.RVf);
    expect((first.RV as { outs: unknown }).outs).toEqual(expected.changed.RV.outs.to);
    expect((first.RV as { sys: unknown }).sys).toEqual(expected.changed.RV.sys.to);
    const { RVf: _added, RV: _changed, ...rest } = first;
    const { RV: _seedRV, ...seedRest } = seed;
    expect(rest).toEqual(seedRest);

    expect(ed.setSystemOnFail(first, 'RV', 'task')).toEqual(seed);
  });

  it('EN-114 setField: only ID.from changes', () => {
    const { ed, wf } = harness();
    const before = wf('wf-access');
    expect((before.ID as CollectNode).from).toBe('worker');
    const after = ed.setField(before, 'ID', 'from', 'sponsor');
    expect(after).toEqual({ ...before, ID: { ...before.ID, from: 'sponsor' } });
  });

  describe('EN-115 setApprovers', () => {
    const start = () => {
      const h = harness();
      return { ed: h.ed, before: h.wf('wf-wo-sub') };
    };
    const approver = (nodes: Nodes) => nodes.RA_A2 as ApproveNode;

    it('EN-115 switching to a named person starts empty, then picks', () => {
      const { ed, before } = start();
      const switched = ed.setApprovers(before, 'RA_A2', { who: 'person' });
      expect(approver(switched)).toMatchObject({ who: 'person', roles: [], backup: '' });
      expect(approver(ed.setApprovers(switched, 'RA_A2', { who: 'person', person: 'Chloe Martin' })).roles).toEqual(['p:Chloe Martin']);
      expect(approver(ed.setApprovers(before, 'RA_A2', { who: 'person', person: 'Chloe Martin' })).roles).toEqual(['p:Chloe Martin']);
    });

    it('EN-115 switching to a group starts empty, then picks', () => {
      const { ed, before } = start();
      const switched = ed.setApprovers(before, 'RA_A2', { who: 'group' });
      expect(approver(switched)).toMatchObject({ who: 'group', roles: [] });
      expect(approver(ed.setApprovers(switched, 'RA_A2', { who: 'group', group: 'fin_ctrl' })).roles).toEqual(['g:fin_ctrl']);
    });

    it('EN-115 switching back to Roles restores ["proc"]', () => {
      const { ed, before } = start();
      const person = ed.setApprovers(before, 'RA_A2', { who: 'person', person: 'Chloe Martin' });
      const back = ed.setApprovers(person, 'RA_A2', { who: 'roles' });
      expect(approver(back).roles).toEqual(['proc']);
      expect(approver(back).who).toBe('roles');
    });

    it('EN-115 the backup: set, and cleared when picked as the person', () => {
      const { ed, before } = start();
      const person = ed.setApprovers(before, 'RA_A2', { who: 'person', person: 'Chloe Martin', backup: 'Lena Fischer' });
      expect(approver(person).backup).toBe('Lena Fischer');
      expect(approver(ed.setApprovers(person, 'RA_A2', { who: 'person', person: 'Lena Fischer' })).backup).toBe('');
    });
  });

  describe('EN-116 one escalation timer', () => {
    it('EN-116 the If path: RA_C1_else.sla = 72, nothing on RA_C1', () => {
      const { ed, wf } = harness();
      const escalated = ok(ed.setPathThen(wf('wf-wo-sub'), 'RA_C1', 'else', 'escalate', 'g:fin_ctrl'));
      const after = ed.setEscalateAfter(escalated, 'RA_C1', 'else', 72);
      expect((after.RA_C1_else as ApproveNode).sla).toBe(72);
      expect(after.RA_C1).toEqual(escalated.RA_C1);
      expect(ed.getEscalateAfter(after, 'RA_C1', 'else')).toBe(72);
    });

    it('EN-116 the check: RA_CDe.sla = 24', () => {
      const { ed, wf } = harness();
      const after = ed.setEscalateAfter(wf('wf-wo-sub'), 'RA_CD', null, 24);
      expect((after.RA_CDe as ApproveNode).sla).toBe(24);
      expect(ed.getEscalateAfter(after, 'RA_CD')).toBe(24);
    });

    it('EN-116 editing the generated step’s Chaser changes what the panel reads', () => {
      const { ed, wf } = harness();
      expect(ed.getEscalateAfter(ed.setField(wf('wf-wo-sub'), 'RA_CDe', 'sla', 60), 'RA_CD')).toBe(60);
    });

    it('EN-116 no elseSla, flagSla or path sla field exists', () => {
      const { ed, wf } = harness();
      const on = ed.setEscalateAfter(ok(ed.setPathThen(wf('wf-wo-sub'), 'RA_C1', 'else', 'escalate', 'g:fin_ctrl')), 'RA_C1', 'else', 72);
      const cond = on.RA_C1 as unknown as Record<string, unknown>;
      expect(cond.elseSla).toBeUndefined();
      expect((cond.outs as Record<string, unknown>[]).every((out) => out.sla === undefined)).toBe(true);
      expect((ed.setEscalateAfter(wf('wf-wo-sub'), 'RA_CD', null, 24).RA_CD as unknown as Record<string, unknown>).flagSla).toBeUndefined();
    });

    it('EN-116 switching to “Ask someone to approve” and back to Escalate: still 72', () => {
      const { ed, wf } = harness();
      const on = ed.setEscalateAfter(ok(ed.setPathThen(wf('wf-wo-sub'), 'RA_C1', 'else', 'escalate', 'g:fin_ctrl')), 'RA_C1', 'else', 72);
      const approve = ok(ed.setPathThen(on, 'RA_C1', 'else', 'approve', 'p:Chloe Martin'));
      const back = ok(ed.setPathThen(approve, 'RA_C1', 'else', 'escalate', 'g:fin_ctrl'));
      expect(ed.getEscalateAfter(back, 'RA_C1', 'else')).toBe(72);
    });
  });

  describe('EN-117 Collect & verify escalation', () => {
    // wf() is normalised, so ID_fail already exists: "adds" cannot be literal, 03 §16.12 says "create or update" (see the notes).
    const expectEndState = (nodes: Nodes) => {
      expect(nodes.ID_fail).toMatchObject({
        label: 'Identity & eligibility failed: escalation',
        roles: ['people_ops'],
        who: 'roles',
        escalation: true,
        failOf: 'ID',
        reject: 'requester',
        remind: 24,
        sla: 48,
      });
      const collect = nodes.ID as CollectNode;
      expect((nodes.ID_fail as ApproveNode).outs).toEqual([{ key: 'next', to: collect.outs.find((o) => o.key === 'next')?.to }]);
      expect(collect.failTo).toBe('role');
      expect(collect.failNode).toBe('ID_fail');
      expect(collect.outs.map((o) => o.key)).toEqual(['next', 'fail']);
      expect(collect.outs[1]).toEqual({ key: 'fail', to: 'ID_fail', label: 'Failed' });
    };

    it('EN-117 setCollectFail(…, "role", "people_ops") on the normalised seed', () => {
      const { ed, wf } = harness();
      expectEndState(ed.setCollectFail(wf('wf-onboard'), 'ID', 'role', 'people_ops'));
    });

    it('EN-117 setCollectFail(…, "approval") removes the out and the node', () => {
      const { ed, wf } = harness();
      const after = ed.setCollectFail(wf('wf-onboard'), 'ID', 'approval');
      expect(after.ID_fail).toBeUndefined();
      expect((after.ID as CollectNode).outs.map((o) => o.key)).toEqual(['next']);
    });

    it('EN-117 from "approval" back to "role" really adds it', () => {
      const { ed, wf } = harness();
      const removed = ed.setCollectFail(wf('wf-onboard'), 'ID', 'approval');
      expectEndState(ed.setCollectFail(removed, 'ID', 'role', 'people_ops'));
    });

    it('EN-117 "approval" also removes the “Done” label, so a step that asks people to decide round-trips to the seed', () => {
      const { ed, wf } = harness();
      const seed = wf('wf-onboard');
      const after = ed.setCollectFail(seed, 'ID', 'approval');
      expect((after.ID as CollectNode).outs[0].label).toBeUndefined();
      expect((seed.BG as CollectNode).failTo).toBe('approval');
      expect(ed.setCollectFail(ed.setCollectFail(seed, 'BG', 'role'), 'BG', 'approval')).toEqual(seed);
    });
  });

  describe('EN-118 Stop on an If path and on a check', () => {
    it('EN-118 the If path is exactly the setup of EN-069', () => {
      const { ed, wf } = harness();
      const before = wf('wf-wo-sub');
      expect(ok(ed.setPathThen(before, 'RA_C1', 'else', 'stop', 'hm'))).toEqual(withSetup(before, setupOf('EN-069') as Setup));
    });

    it('EN-118 the check is exactly the setup of EN-070', () => {
      const { ed, wf } = harness();
      const before = wf('wf-wo-sub-wo-uk-tech');
      expect(ed.setFlag(before, 'RA_CD', 'stop', 'proc')).toEqual(withSetup(before, setupOf('EN-070') as Setup));
    });

    it('EN-118 the guard counts Stop like Reject', () => {
      const { ed } = harness('nf101');
      const stopped = ok(ed.setPathThen(iGraph('I8'), 'n103', 'p104', 'stop', 'hm'));
      expect(ed.setPathThen(stopped, 'n103', 'else', 'reject')).toEqual({ ok: false, message: 'At least one path has to carry on' });
    });
  });

  it('EN-119 createWorkflow defaults', () => {
    const { ed, wfObj } = harness();
    const created = ed.createWorkflow(wfObj('wf-wo-sub'));
    expect(created).toEqual({
      id: 'nf101',
      name: 'New workflow',
      records: ['work_order'],
      event: 'submitted',
      scope: {},
      status: 'draft',
      version: 0,
      effective: '2026-12-01',
      owner: 'Procurement operations',
      priority: null,
      source: 'levv',
      onReject: { recipients: ['hm'], resubmitDays: 5 },
      draft: {
        nodes: {
          T: { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: 'END' }] },
          END: { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] },
        },
      },
      published: null,
    });
    expect(toastOf('EN-119')).toContain(copy.newDraftToast);
    const after = ed.insertStep(created.draft.nodes, 'T', 'next', { kind: 'appr' });
    expect(after[next(after.T)].label).toBe('Approval');
  });

  it('EN-120 Background check preset defaults', () => {
    const { ctx, ed, wf, wfObj } = harness();
    const after = ed.insertStep(wf('wf-onboard'), 'BG', 'next', { kind: 'collect', preset: 'bgcheck' });
    const created = after[next(after.BG)] as CollectNode;
    expect(created).toMatchObject({
      label: 'Background check',
      failTo: 'approval',
      failRoles: ['hrbp', 'legal'],
      failMode: 'all',
      items: ['Criminal record', 'Employment history'],
      checker: 'checkr',
      verify: 'auto',
    });
    const workflow = wfObj('wf-onboard');
    workflow.draft.nodes = after;
    expect(lintWorkflow(workflow, ctx).issues.filter((issue) => issue.sev === 'bad')).toEqual([]);
    expect(ctx.presets.PRESETS.bgcheck.d).toBe('Criminal, credit and sanctions checks; adverse results go to the people set under “If it fails”');
  });

  it('EN-121 Chaser numbers are stored on the step', () => {
    const { ed, wf } = harness();
    const after = ed.setField(wf('wf-wo-sub'), 'RA_A1', 'remind', 12);
    expect((after.RA_A1 as ApproveNode).remind).toBe(12);
    expect((after.RA_A1 as ApproveNode).sla).toBe(48);
  });

  describe('EN-122 Chaser defaults and wording per step kind', () => {
    const places: Record<string, [string, string]> = {
      'Work order submitted → Business sign-off (`RA_A1`)': ['wf-wo-sub', 'RA_A1'],
      'Assignment ending → Extend or end? (`K1`)': ['wf-ending', 'K1'],
      'Contractor onboarding → Background check (`BG`), provided by Worker': ['wf-onboard', 'BG'],
      'Site access request → Identity & site details (`ID`), provided by Worker': ['wf-access', 'ID'],
    };
    it.each(tableOf('EN-122'))('EN-122 %s', (step, _kind, remind, escalate, escalateTo, label) => {
      const [workflowId, nodeId] = places[step];
      const node = workflowById(makeContext(), workflowId).draft.nodes[nodeId] as ApproveNode | TaskNode | CollectNode;
      expect(normDeep(chaserFor(node))).toEqual(
        normDeep({
          remindAfterHours: Number(remind),
          escalateAfterHours: Number(escalate),
          escalateTo,
          label: label.replace(/^“|”$/g, ''),
        }),
      );
    });

    it('EN-122 the Test line on a waiting Approve card', () => {
      const ctx = makeContext();
      const result = runTest({ workflow: workflowById(ctx, 'wf-wo-sub'), record: ctx.samples.find((s) => s.id === 'WO-2231') as (typeof ctx.samples)[number], ctx });
      expect(result.steps.find((step) => step.id === 'RA_A1')?.message).toContain('. Chaser reminds after 24h and escalates to their manager after 48h');
    });
  });

  describe('EN-123 Nova writes a condition from plain words', () => {
    const TEXT = 'rate is more than 15% over the rate card';

    it('EN-123 parseWhen and the read-back sentence', async () => {
      const { catalog } = makeContext();
      const when = await parseWhen(TEXT, catalog);
      expect(when).toEqual({ join: 'all', rows: [{ f: 'rate_vs_card_pct', op: '>', v: 15 }] });
      expect(normDeep(whenMessage(when, catalog))).toBe(normDeep('Read as: asked only if Rate vs rate card (%) > 15%. Check it below, then Test.'));
    });

    it('EN-123 storing it is exactly the setup of EN-052, and the card and the skipped step read as listed', async () => {
      const { ctx, ed, wf, wfObj } = harness();
      const when = await parseWhen(TEXT, ctx.catalog);
      const before = wf('wf-wo-sub');
      const after = ed.setField(ed.setField(before, 'RA_A2', 'when', when), 'RA_A2', 'whenPrompt', TEXT);
      expect(after).toEqual(withSetup(before, setupOf('EN-052') as Setup));

      const workflow = wfObj('wf-wo-sub');
      workflow.draft.nodes = after;
      expect(subtitle(workflow, after.RA_A2, ctx)).toBe('Procurement · only if Rate vs rate card (%) > 15%');
      const result = runTest({ workflow, record: ctx.samples.find((s) => s.id === 'WO-2214') as (typeof ctx.samples)[number], ctx });
      const step = result.steps.find((s) => s.id === 'RA_A2');
      expect(step?.status).toBe('Not needed');
      expect(step?.message).toBe('Only needed when Rate vs rate card (%) > 15%');
    });
  });

  describe('EN-124 Condition text and evaluation edge cases', () => {
    const { catalog } = makeContext();

    it('EN-124 rowText prints list values with spaces', () => {
      expect(rowText({ f: 'changed_fields', op: 'includes', v: 'bill_rate' }, catalog)).toBe('Fields changed includes bill rate');
    });

    it('EN-124 an empty number never matches', () => {
      expect(evalRow({ f: 'total_value', op: '>=', v: null }, { total_value: 0 })).toBe(false);
      expect(evalRow({ f: 'total_value', op: '>=', v: '' }, { total_value: 0 })).toBe(false);
    });

    it('EN-124 condition and row text', () => {
      expect(conditionText({ join: 'all', rows: [] }, catalog)).toBe('Always');
      expect(rowText({ f: 'rate_vs_card_pct', op: '>', v: 15 }, catalog)).toBe('Rate vs rate card (%) > 15%');
      expect(rowText({ f: 'total_value', op: '>=', v: 1000000 }, catalog)).toBe('Total value ≥ $1M');
    });

    it.each([
      [0, '$0'],
      [950, '$950'],
      [1500, '$1.5K'],
      [62500, '$62.5K'],
      [120000, '$120K'],
      [1000000, '$1M'],
      [1060000, '$1.06M'],
      [2400000, '$2.4M'],
      [-36000, '−$36K'],
      [12345678, '$12.35M'],
    ])('EN-124 fmt(%d) = %s', (n, expected) => {
      expect(fmt(n)).toBe(expected);
    });
  });

  describe('EN-125 Plain-words parser oracle', () => {
    const { catalog } = makeContext();

    /** Reads a Rows cell of the table in 06: "rate_change_pct > 5; country in [UK]". */
    const parseRows = (cell: string) => {
      if (cell === '(none)') return [];
      return cell.split('; ').map((part) => {
        const [f, op, ...rest] = part.split(' ');
        const raw = rest.join(' ');
        if (op === 'yes' || op === 'no') return { f, op };
        if (op === 'in' || op === 'not_in') return { f, op, v: raw.slice(1, -1).split(', ') };
        if (op === 'includes') return { f, op, v: raw };
        return { f, op, v: Number(raw) };
      });
    };

    it('EN-125 the table has its 26 cases', () => {
      expect(tableOf('EN-125')).toHaveLength(26);
    });

    it.each(tableOf('EN-125'))('EN-125 %s', async (input, rows, join) => {
      expect(parseWhenRules(input, catalog)).toEqual(parseRows(rows));
      const when = await parseWhen(input, catalog);
      expect(when.rows).toEqual(parseRows(rows));
      if (join !== '—') expect(when.join).toBe(join);
    });

    it('EN-125 no rows: the message, and the empty-input toast', async () => {
      const when = await parseWhen('hello world', catalog);
      expect(normDeep(whenMessage(when, catalog))).toBe(
        normDeep('I couldn’t match that to a field. Try naming the field and value, e.g. “work country is Canada” or “total value over $250K”.'),
      );
      expect(copy.sayWhen).toBe('Say when this approver is needed');
    });

    const answer = (rows: unknown): CallGPT => () => Promise.resolve(JSON.stringify({ join: 'all', rows }));

    it('EN-125 model first: a valid answer is used', async () => {
      const rows = [{ f: 'country', op: 'in', v: ['Canada'] }];
      expect(await parseWhen('total value over $250K', catalog, { callGPT: answer(rows) })).toEqual({ join: 'all', rows });
    });

    it('EN-125 model first: an unknown field or a wrong operator is discarded for the parser result', async () => {
      const parser = { join: 'all', rows: [{ f: 'total_value', op: '>', v: 250000 }] };
      expect(await parseWhen('total value over $250K', catalog, { callGPT: answer([{ f: 'nope', op: '>', v: 1 }]) })).toEqual(parser);
      expect(await parseWhen('total value over $250K', catalog, { callGPT: answer([{ f: 'total_value', op: 'in', v: 1 }]) })).toEqual(parser);
    });

    it('EN-125 model first: a timeout falls back to the parser', async () => {
      const never: CallGPT = () => new Promise(() => undefined);
      expect(await parseWhen('total value over $250K', catalog, { callGPT: never, timeoutMs: 1 })).toEqual({
        join: 'all',
        rows: [{ f: 'total_value', op: '>', v: 250000 }],
      });
    });
  });
});
