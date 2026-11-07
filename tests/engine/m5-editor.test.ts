import { describe, expect, it } from 'vitest';
import { createEditor } from '@flow-studio/engine/edit';
import { laneSteps, pathMode, rowsText } from '@flow-studio/engine/text';
import type { CollectNode, CondNode, DwNode, Out, SystemNode, WfNode } from '@flow-studio/model/workflow';
import { makeContext } from '../support/context';

describe('M5 editor additions', () => {
  const graph = (id: string): Record<string, WfNode> => structuredClone((makeContext().workflows.find((workflow) => workflow.id === id) as { draft: { nodes: Record<string, WfNode> } }).draft.nodes);
  it('06 UI-I11: rowsText returns the path rule in words', () => {
    const ctx = makeContext();
    const text = rowsText(
      [{ f: 'engagement', op: 'in', v: ['Off-payroll'] }, { join: 'any', rows: [{ f: 'total_value', op: '>=', v: 250000 }, { f: 'role_regulated', op: 'yes' }] }],
      'all',
      ctx.catalog,
    );
    expect(text).toBe('Engagement type is Off-payroll and (Total value ≥ $250K or Regulated role is yes)');
  });

  it('deleting a generated step leaves its owner coherent', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const check = ed.deleteStep(graph('wf-wo-sub'), 'RA_CDe');
    expect((check.RA_CD as DwNode).flagDo).toBe('note');
    expect((check.RA_CD as DwNode).flagNode).toBeNull();

    const collect = ed.deleteStep(graph('wf-onboard'), 'ID_fail');
    const id = collect.ID as CollectNode;
    expect(id.failTo).toBe('approval');
    expect(id.failNode).toBeUndefined();
    expect(id.outs.map((out) => out.key)).toEqual(['next']);

    const withPath = ed.setPathThen(graph('wf-wo-sub'), 'RA_C1', 'else', 'escalate') as Record<string, WfNode>;
    const cond = ed.deleteStep(withPath, 'RA_C1_else').RA_C1 as CondNode;
    expect(cond.elseDo).toBe('continue');
    expect(cond.elseNode).toBeNull();
    expect(pathMode(ed.deleteStep(withPath, 'RA_C1_else'), 'RA_C1', 'else')).toBe('continue');
  });

  it('deleting a step on a System Failed path does not take the path away', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const failing = ed.setSystemOnFail(graph('wf-offboard'), 'RV', 'path');
    const extended = ed.insertStep(failing, 'RV', 'failed', { kind: 'notify' });
    const added = (extended.RV.outs as Out[]).find((out) => out.key === 'failed')?.to as string;
    const after = ed.deleteStep(extended, added);
    expect((after.RV as SystemNode).sys.onFail).toBe('path');
    expect((after.RV.outs as Out[]).find((out) => out.key === 'failed')?.to).toBe('RVf');

    const gone = ed.deleteStep(failing, 'RVf');
    expect((gone.RV as SystemNode).sys.onFail).toBe('task');
    expect((gone.RV.outs as Out[]).map((out) => out.key)).toEqual(['next']);
  });

  it('laneSteps lists a path in path order, a step after what leads to it', () => {
    const nodes = {
      C: { id: 'C', kind: 'cond', label: 'C', mergeAt: 'M', outs: [{ key: 'p1', to: 'A', label: 'p', join: 'all', rows: [] }, { key: 'else', to: 'M', label: 'Otherwise' }] },
      A: { id: 'A', kind: 'parallel', label: 'A', outs: [{ key: 'b1', to: 'B', label: 'x' }, { key: 'b2', to: 'D', label: 'y' }] },
      B: { id: 'B', kind: 'task', label: 'B', role: 'hm', title: 't', outs: [{ key: 'next', to: 'D' }] },
      D: { id: 'D', kind: 'task', label: 'D', role: 'hm', title: 't', outs: [{ key: 'next', to: 'M' }] },
      M: { id: 'M', kind: 'end', label: '', outcome: 'completed', outs: [] },
    } as unknown as Record<string, WfNode>;
    expect(laneSteps(nodes, 'C', 'p1')).toEqual(['A', 'B', 'D']);
  });

  it('setWorker renames the step and a generated escalation that still has the worker’s name', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const base = ed.insertStep(graph('wf-ts-sub'), 'T', 'next', { kind: 'dw', worker: 'budget' });
    const id = (base.T.outs as Out[])[0].to;
    const flagged = ed.setFlag(base, id, 'escalate');
    const changed = ed.setWorker(flagged, id, 'rate');
    expect(changed[id].label).toBe('Rate check');
    expect(changed[`${id}f`].label).toBe('Rate flagged: escalation');
  });

  it('every operation the panels use is pure: the input is untouched', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const input = graph('wf-wo-sub');
    const frozen = JSON.stringify(input);
    ed.setPathCondition(input, 'RA_C1', 'p1', { join: 'any', rows: [] });
    ed.setFields(input, 'RA_A1', { label: 'x', remind: 1 });
    ed.setWhenCondition(input, 'RA_A1', { join: 'all', rows: [] });
    expect(JSON.stringify(input)).toBe(frozen);
  });
});
