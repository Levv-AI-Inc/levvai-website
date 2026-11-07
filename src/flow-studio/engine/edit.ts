import type { Group, Row } from '../model/condition';
import type { EngineContext } from '../model/context';
import { ensurePseudoRole, type RoleKey } from '../model/people';
import type {
  ApproveNode,
  CollectNode,
  CondNode,
  CondPath,
  DwNode,
  Out,
  ParallelNode,
  PathThen,
  PlanNode,
  SystemNode,
  TaskNode,
  WfNode,
  Workflow,
} from '../model/workflow';
import { isCheck } from './checks';
import { copy } from './copy';
import { ensureSys, pathMode, title, whoMode } from './text';

export type Nodes = Record<string, WfNode>;

/** A refused edit: the graph is unchanged and the UI shows `message` as a toast. */
export interface EditRefusal {
  ok: false;
  message: string;
}
export type EditResult = Nodes | EditRefusal;

export const isRefusal = (result: EditResult): result is EditRefusal => (result as EditRefusal).ok === false;

const refuse = (message: string): EditRefusal => ({ ok: false, message });

const fieldsOf = (node: WfNode): Record<string, unknown> => node as unknown as Record<string, unknown>;

/** Node id → breadth-first distance from `from`, in visit order. `from` itself is included at distance 0. */
function reachable(nodes: Nodes, from: string): Map<string, number> {
  const distance = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    for (const out of nodes[id]?.outs ?? []) {
      if (!distance.has(out.to)) {
        distance.set(out.to, (distance.get(id) as number) + 1);
        queue.push(out.to);
      }
    }
  }
  return distance;
}

/** Engine §16.2: where an If's paths meet. Used on load and when `mergeAt` is missing; never while editing paths (D22). */
export function computeMergeAt(nodes: Nodes, condId: string): string {
  const cond = nodes[condId] as CondNode;
  const starts: string[] = [];
  for (const out of cond.outs as Out[]) {
    const isElse = out.key === 'else';
    const path = out as Out & { do?: string; node?: string | null };
    const stored = isElse ? cond.elseDo : path.do;
    const generated = isElse ? cond.elseNode : path.node;
    const target = nodes[out.to];
    const endsHere = target?.kind === 'end' && (target.outcome === 'rejected' || target.outcome === 'stopped');
    if (endsHere || stored === 'reject' || stored === 'stop') continue;
    if (generated && out.to === generated) {
      const exits = target.outs as Out[];
      starts.push((exits.find((o) => o.key === 'approved') ?? exits[0]).to);
    } else {
      starts.push(out.to);
    }
  }
  if (starts.length === 0) return 'END';
  if (starts.length === 1) return starts[0];

  const reach = starts.map((start) => reachable(nodes, start));
  // Map iteration is breadth-first from the If, so the first common node has the smallest distance.
  for (const id of Array.from(reachable(nodes, condId).keys())) {
    if (id !== condId && reach.every((r) => r.has(id))) return id;
  }
  return starts[starts.length - 1];
}

/**
 * Engine §16.12 step 1: create or update the generated "{Step} failed: escalation" step of a Collect & verify,
 * put it on a "Failed" exit after `next`, and label the normal exit "Done" (04 §4.5). Changes `nodes` in place.
 */
export function ensureCollectEscalation(nodes: Nodes, collectId: string, role?: string): void {
  const collect = nodes[collectId] as CollectNode;
  const id = `${collect.id}_fail`;
  const next = collect.outs.find((o) => o.key === 'next') as Out;
  const existing = nodes[id] as ApproveNode | undefined;
  const failRole = role ?? collect.failRole;

  if (existing) {
    existing.roles = [failRole];
    existing.outs[0].to = next.to;
  } else {
    nodes[id] = {
      id,
      kind: 'appr',
      label: copy.collectFailedLabel(title(collect)),
      roles: [failRole],
      who: 'roles',
      mode: 'all',
      authority: false,
      material: [],
      reaskOnDecrease: true,
      reject: 'requester',
      remind: 24,
      sla: 48,
      escalation: true,
      failOf: collect.id,
      outs: [{ key: 'next', to: next.to }],
    };
  }

  collect.failRole = failRole;
  collect.failNode = id;
  next.label = copy.systemExitDone;
  if (!collect.outs.some((o) => o.key === 'fail')) {
    collect.outs.push({ key: 'fail', to: id, label: copy.collectExitFailed });
  }
}

/** Engine §16.8: delete every node not reachable from T, except END. Changes `nodes` in place. */
export function gc(nodes: Nodes): void {
  const keep = reachable(nodes, 'T');
  for (const id of Object.keys(nodes)) {
    if (id !== 'END' && !keep.has(id)) delete nodes[id];
  }
}

function moveExits(nodes: Nodes, from: string, to: string): void {
  for (const node of Object.values(nodes)) {
    for (const out of node.outs ?? []) if (out.to === from) out.to = to;
  }
}

/** Engine §16.5: "+ Add a condition" and "+ Add another option". */
export const defaultConditionRow = (): Row => ({ f: 'total_value', op: '>=', v: 250000 });

/** Engine §16.5: "+ Add an either/or condition". */
export const defaultEitherOr = (): Group => ({
  join: 'any',
  rows: [defaultConditionRow(), { f: 'role_regulated', op: 'yes' }],
});

/** Engine §16.5: changing a row's field resets it. */
export function rowForField(field: string, catalog: Pick<EngineContext['catalog'], 'FIELD' | 'OPS'>): Row {
  const def = catalog.FIELD[field];
  const op = catalog.OPS[def.t][0];
  if (def.t === 'enum') return { f: field, op, v: [] };
  if (def.t === 'list') return { f: field, op, v: def.o?.[0] };
  if (def.t === 'bool') return { f: field, op };
  if (def.t === 'text') return { f: field, op, v: '' };
  return { f: field, op, v: 0 };
}

/** What to add: a step kind, a ready-made step, or a Digital Worker. */
export interface StepSpec {
  kind: WfNode['kind'];
  preset?: string;
  worker?: string;
}

/** The Approve fields every generated and new Approve step shares (02 §5.4). `prechecks` is legacy; 06 EN-099, EN-101 and EN-104 expect it stored. */
function approveDefaults(): Pick<ApproveNode, 'mode' | 'authority' | 'material' | 'reaskOnDecrease' | 'sla' | 'reject'> & { prechecks: string[] } {
  return { mode: 'all', authority: false, material: [], reaskOnDecrease: true, sla: 48, reject: 'requester', prechecks: ['brief'] };
}

const whoKind = (who: RoleKey): 'group' | 'person' | 'roles' => (who.startsWith('g:') ? 'group' : who.startsWith('p:') ? 'person' : 'roles');

/** Binds the graph operations of engine §16 to a context. All of them take node ids and return a new `nodes` map. */
export function createEditor(ctx: EngineContext) {
  /** "Back to Roles" restores the last role list. Transient (02 §17): it lives here, never on the node. */
  const savedRoles = new Map<string, RoleKey[]>();

  const start = (nodes: Nodes): Nodes => {
    const ids = new Set<string>();
    for (const node of Object.values(nodes)) {
      ids.add(node.id);
      for (const out of node.outs ?? []) ids.add(out.key);
    }
    ctx.idGen.reserve(ids);
    return structuredClone(nodes);
  };

  const collectDefaults = (id: string, next: string): CollectNode => ({
    id,
    kind: 'collect',
    label: copy.newStep.collect,
    items: [],
    verify: 'person',
    checker: 'persona',
    reviewer: 'people_ops',
    failTo: 'role',
    failRole: 'people_ops',
    gives: '',
    reverse: '',
    reverseWhen: 'after',
    reverseBy: 'hm',
    outs: [{ key: 'next', to: next }],
  });

  const systemDefaults = (id: string, next: string): SystemNode => {
    const node = {
      id,
      kind: 'system',
      label: copy.newStep.system,
      system: 'Workday',
      via: '',
      gives: '',
      reverse: '',
      reverseWhen: 'after',
      reverseBy: 'it',
      outs: [{ key: 'next', to: next }],
    } as unknown as SystemNode;
    node.sys = ensureSys(node, ctx.systems);
    return node;
  };

  const taskDefaults = (id: string, next: string): TaskNode => ({
    id,
    kind: 'task',
    label: copy.newStep.task,
    role: 'proc',
    title: copy.newStep.taskTitle,
    outs: [{ key: 'next', to: next }],
  });

  /** 02 §5.14, Preset row: the kind's defaults, then `p`, then `preset`. */
  const presetNode = (id: string, key: string, next: string): WfNode => {
    const preset = ctx.presets.PRESETS[key as keyof typeof ctx.presets.PRESETS];
    const base: WfNode =
      preset.kind === 'collect' ? collectDefaults(id, next) : preset.kind === 'system' ? systemDefaults(id, next) : taskDefaults(id, next);
    const node = { ...base, ...structuredClone(preset.p), label: preset.n, preset: key } as Record<string, unknown>;
    if (key === 'bgcheck') {
      delete node.failFlow;
      node.failTo = 'approval';
      node.failRoles = ['hrbp', 'legal'];
      node.failMode = 'all';
    }
    if (preset.kind === 'system') {
      const system = node as unknown as SystemNode & { actions?: string[] };
      system.sys = ensureSys(system, ctx.systems);
    }
    return node as unknown as WfNode;
  };

  /** 02 §5.14. Adds any step that comes with the new node (Outside plan, the failed escalation). */
  const createNode = (nodes: Nodes, spec: StepSpec, next: string): WfNode => {
    const id = ctx.idGen.next('node');
    const line = [{ key: 'next', to: next }];
    let node: WfNode;
    if (spec.preset) {
      node = presetNode(id, spec.preset, next);
    } else {
      switch (spec.kind) {
        case 'cond':
          node = {
            id,
            kind: 'cond',
            label: copy.newStep.cond,
            outs: [
              { key: 'p1', to: next, label: copy.labelYes, join: 'all', rows: [{ f: 'total_value', op: '>=', v: 500000 }] },
              { key: 'else', to: next, label: copy.labelNo },
            ],
            mergeAt: next,
          } as CondNode;
          break;
        case 'appr':
          // 02 §5.14 and 03 §16.1 list `who` and `remind` on a new Approve step; 06 EN-104 omits them (see the notes).
          node = { id, kind: 'appr', label: copy.newStep.appr, roles: [], who: 'roles', remind: 24, ...approveDefaults(), outs: line } as ApproveNode;
          break;
        case 'policy':
          node = { id, kind: 'policy', label: copy.newStep.policy, receipt: copy.newStep.receipt, fyi: '', outs: [line[0]] };
          break;
        case 'plan': {
          const outsideId = `${id}x`;
          node = {
            id,
            kind: 'plan',
            label: copy.newStep.plan,
            plan: copy.newStep.planName,
            outs: [
              { key: 'in', to: next, label: copy.insidePlan },
              { key: 'out', to: outsideId, label: copy.outsidePlan },
            ],
          } as PlanNode;
          nodes[outsideId] = { id: outsideId, kind: 'appr', label: copy.outsidePlan, roles: ['cco'], who: 'roles', remind: 24, ...approveDefaults(), outs: [{ key: 'next', to: next }] } as ApproveNode;
          break;
        }
        case 'collect':
          node = collectDefaults(id, next);
          break;
        case 'task':
          node = taskDefaults(id, next);
          break;
        case 'system':
          node = systemDefaults(id, next);
          break;
        case 'notify':
          node = { id, kind: 'notify', label: copy.newStep.notify, recipients: ['cco'], channel: 'Email', outs: [line[0]] };
          break;
        case 'wait':
          node = {
            id,
            kind: 'wait',
            label: copy.newStep.wait,
            w: { mode: 'date', field: 'start_date', amount: 5, unit: 'business_days', dir: 'before', time: '09:00', tz: 'worker' },
            outs: line,
          };
          break;
        case 'parallel':
          node = {
            id,
            kind: 'parallel',
            label: copy.newStep.parallel,
            outs: [
              { key: 'b1', to: next, label: copy.branchLabel(1) },
              { key: 'b2', to: next, label: copy.branchLabel(2) },
            ],
          } as ParallelNode;
          break;
        case 'runwf':
          node = { id, kind: 'runwf', label: copy.newStep.runwf, target: 'wf-ending', outs: [line[0]] };
          break;
        case 'dw': {
          const worker = spec.worker as string;
          const name = ctx.dws.DW[worker].n;
          node = isCheck(worker, ctx)
            ? ({ id, kind: 'dw', label: name, worker, flagDo: 'note', outs: [{ key: 'flag', to: next, label: copy.flagged }, { key: 'pass', to: next, label: copy.passed }] } as DwNode)
            : ({ id, kind: 'dw', label: name, worker, fallback: 'proc', outs: line } as DwNode);
          break;
        }
        default:
          throw new Error(`A ${spec.kind} step can't be added`);
      }
    }
    nodes[node.id] = node;
    if (node.kind === 'collect' && node.failTo === 'role') ensureCollectEscalation(nodes, node.id);
    return node;
  };

  /** Engine §16.1. */
  const insertStep = (input: Nodes, fromId: string, outKey: string, spec: StepSpec): Nodes => {
    const nodes = start(input);
    const out = (nodes[fromId].outs as Out[]).find((o) => o.key === outKey) as Out;
    const created = createNode(nodes, spec, out.to);
    out.to = created.id;
    const from = nodes[fromId];
    if (from.kind === 'collect' && from.failNode && outKey === 'next') {
      (nodes[from.failNode] as ApproveNode).outs[0].to = created.id;
    }
    return nodes;
  };

  const pathOut = (cond: CondNode, key: string) => cond.outs.find((o) => o.key === key) as Out & Partial<CondPath>;

  /** Engine §16.4. */
  const setPathThen = (input: Nodes, condId: string, outKey: string, mode: PathThen, who?: RoleKey): EditResult => {
    if (mode === 'custom') return input; // Derived from the path's own steps; never chosen (02 §5.3).
    if (mode === 'reject' || mode === 'stop') {
      const others = (input[condId] as CondNode).outs.filter((o) => o.key !== outKey);
      if (!others.some((o) => !['reject', 'stop'].includes(pathMode(input, condId, o.key)))) return refuse(copy.atLeastOnePath);
    }
    const nodes = start(input);
    const cond = nodes[condId] as CondNode;
    const out = pathOut(cond, outKey);
    const isElse = outKey === 'else';
    const previousId = isElse ? cond.elseNode : out.node;
    const previous = previousId ? nodes[previousId] : undefined;
    const previousSla = previous?.kind === 'appr' ? previous.sla : undefined;
    if (previousId) delete nodes[previousId];

    const target = who ?? (isElse ? cond.elseWho : out.who) ?? (mode === 'stop' ? 'hm' : mode === 'approve' ? 'proc' : 'cco');
    if (['approve', 'escalate', 'stop'].includes(mode)) ensurePseudoRole(ctx.people, target);

    const id = `${cond.id}_${out.key}`;
    const lab = out.label || copy.otherwise;
    const mergeAt = cond.mergeAt as string;
    let generated: string | null = null;
    if (mode === 'approve' || mode === 'escalate') {
      nodes[id] = {
        id,
        kind: 'appr',
        label: mode === 'escalate' ? copy.pathEscalationLabel(lab) : copy.pathApprovalLabel(lab),
        roles: [target],
        ...approveDefaults(),
        who: whoKind(target),
        remind: 24,
        sla: previousSla ?? 48,
        escalation: mode === 'escalate',
        outs: [{ key: 'next', to: mergeAt }],
      } as ApproveNode;
      generated = id;
    } else if (mode === 'reject') {
      nodes[id] = { id, kind: 'end', label: copy.rejected, outcome: 'rejected', outs: [] };
      generated = id;
    } else if (mode === 'stop') {
      const endId = `${id}_end`;
      nodes[id] = { id, kind: 'notify', label: copy.pathStopLabel(lab), recipients: [target], channel: 'Email', outs: [{ key: 'next', to: endId }] };
      nodes[endId] = { id: endId, kind: 'end', label: copy.stopped, outcome: 'stopped', outs: [] };
      generated = id;
    }
    out.to = generated ?? mergeAt;

    if (isElse) {
      cond.elseDo = mode;
      cond.elseNode = generated;
      cond.elseWho = target;
    } else {
      out.do = mode;
      out.node = generated;
      out.who = target;
    }
    gc(nodes);
    return nodes;
  };

  /** Engine §16.4: renaming a path renames its generated step. */
  const syncGeneratedLabel = (nodes: Nodes, cond: CondNode, out: Out & Partial<CondPath>): void => {
    const isElse = out.key === 'else';
    const id = isElse ? cond.elseNode : out.node;
    const generated = id ? nodes[id] : undefined;
    const lab = out.label || copy.otherwise;
    if (generated?.kind === 'appr') generated.label = generated.escalation ? copy.pathEscalationLabel(lab) : copy.pathApprovalLabel(lab);
    if (generated?.kind === 'notify') generated.label = copy.pathStopLabel(lab);
  };

  const renamePath = (input: Nodes, condId: string, outKey: string, label: string): Nodes => {
    const nodes = start(input);
    const cond = nodes[condId] as CondNode;
    const out = pathOut(cond, outKey);
    out.label = label;
    syncGeneratedLabel(nodes, cond, out);
    return nodes;
  };

  /** Engine §16.5. */
  const addPath = (input: Nodes, condId: string): Nodes => {
    const nodes = start(input);
    const cond = nodes[condId] as CondNode;
    const outs = cond.outs as (Out & Partial<CondPath>)[];
    const elseAt = outs.findIndex((o) => o.key === 'else');
    const paths = outs.filter((o) => o.key !== 'else').length;
    outs.splice(elseAt, 0, {
      key: ctx.idGen.next('path'),
      to: cond.mergeAt as string,
      label: copy.pathLabel(paths + 1),
      join: 'all',
      do: 'continue',
      rows: [{ f: 'total_value', op: '>=', v: 100000 }],
    });
    const otherwise = outs[outs.length - 1];
    if (otherwise.label === copy.labelNo) {
      otherwise.label = copy.otherwise;
      syncGeneratedLabel(nodes, cond, otherwise);
    }
    return nodes;
  };

  /** Engine §16.5. The UI shows `copy.pathDeleted`. */
  const deletePath = (input: Nodes, condId: string, outKey: string): Nodes => {
    const nodes = start(input);
    const cond = nodes[condId] as CondNode;
    const outs = cond.outs as (Out & Partial<CondPath>)[];
    const at = outs.findIndex((o) => o.key === outKey);
    const generated = outs[at].node;
    if (generated) delete nodes[generated];
    outs.splice(at, 1);
    const paths = outs.filter((o) => o.key !== 'else');
    const otherwise = outs[outs.length - 1];
    if (paths.length === 1 && otherwise.label === copy.otherwise && paths[0].label === copy.labelYes) {
      otherwise.label = copy.labelNo;
      syncGeneratedLabel(nodes, cond, otherwise);
    }
    gc(nodes);
    return nodes;
  };

  const rowsOf = (nodes: Nodes, condId: string, outKey: string) => pathOut(nodes[condId] as CondNode, outKey).rows as (Row | Group)[];

  /** Engine §16.5: "+ Add a condition". */
  const addCondition = (input: Nodes, condId: string, outKey: string): Nodes => {
    const nodes = start(input);
    rowsOf(nodes, condId, outKey).push(defaultConditionRow());
    return nodes;
  };

  /** Engine §16.5: "+ Add an either/or condition". */
  const addEitherOr = (input: Nodes, condId: string, outKey: string): Nodes => {
    const nodes = start(input);
    rowsOf(nodes, condId, outKey).push(defaultEitherOr());
    return nodes;
  };

  /** Engine §16.5: "+ Add another option" in a group. */
  const addOption = (input: Nodes, condId: string, outKey: string, groupIndex: number): Nodes => {
    const nodes = start(input);
    (rowsOf(nodes, condId, outKey)[groupIndex] as Group).rows.push(defaultConditionRow());
    return nodes;
  };

  /** Engine §16.5: × removes a row or group; `optionIndex` picks a row inside a group. */
  const removeRow = (input: Nodes, condId: string, outKey: string, rowIndex: number, optionIndex?: number): Nodes => {
    const nodes = start(input);
    const rows = rowsOf(nodes, condId, outKey);
    if (optionIndex === undefined) rows.splice(rowIndex, 1);
    else (rows[rowIndex] as Group).rows.splice(optionIndex, 1);
    return nodes;
  };

  const newRow = (field: string): Row => rowForField(field, ctx.catalog);

  const setRowField = (input: Nodes, condId: string, outKey: string, rowIndex: number, field: string, optionIndex?: number): Nodes => {
    const nodes = start(input);
    const rows = rowsOf(nodes, condId, outKey);
    if (optionIndex === undefined) rows[rowIndex] = newRow(field);
    else (rows[rowIndex] as Group).rows[optionIndex] = newRow(field);
    return nodes;
  };

  /** The If panel's condition editor: a path's join and rows as they now stand. */
  const setPathCondition = (input: Nodes, condId: string, outKey: string, condition: { join?: 'all' | 'any'; rows?: (Row | Group)[] }): Nodes => {
    const nodes = start(input);
    const out = pathOut(nodes[condId] as CondNode, outKey);
    if (condition.join) out.join = condition.join;
    if (condition.rows) out.rows = condition.rows;
    return nodes;
  };

  /** Engine §16.6. */
  const setFlag = (input: Nodes, dwId: string, mode: NonNullable<DwNode['flagDo']>, who?: RoleKey): Nodes => {
    const nodes = start(input);
    const dw = nodes[dwId] as DwNode;
    const previous = dw.flagNode ? nodes[dw.flagNode] : undefined;
    const previousSla = previous?.kind === 'appr' && previous.escalation ? previous.sla : undefined;
    if (dw.flagNode) delete nodes[dw.flagNode];

    const flag = dw.outs.find((o) => o.key === 'flag') as Out;
    const cont = (dw.outs.find((o) => o.key === 'pass') as Out).to;
    dw.flagDo = mode;
    if (who) dw.flagWho = who;

    if (mode === 'note') {
      flag.to = cont;
      dw.flagNode = null;
    } else {
      const id = `${dw.id}f`;
      const target = dw.flagWho ?? (mode === 'stop' ? 'hm' : 'proc');
      if (mode !== 'reject') dw.flagWho = target;
      ensurePseudoRole(ctx.people, target);
      if (mode === 'escalate') {
        nodes[id] = {
          id,
          kind: 'appr',
          label: copy.flagEscalationLabel(ctx.dws.DW[dw.worker].n.replace(' check', '')),
          roles: [target],
          ...approveDefaults(),
          who: whoKind(target),
          remind: 24,
          sla: previousSla ?? 48,
          escalation: true,
          outs: [{ key: 'next', to: cont }],
        } as ApproveNode;
      } else if (mode === 'reject') {
        nodes[id] = { id, kind: 'end', label: copy.rejected, outcome: 'rejected', outs: [] };
      } else {
        const endId = `${id}_end`;
        nodes[id] = { id, kind: 'notify', label: copy.flagStopLabel, recipients: [target], channel: 'Email', outs: [{ key: 'next', to: endId }] };
        nodes[endId] = { id: endId, kind: 'end', label: copy.stopped, outcome: 'stopped', outs: [] };
      }
      flag.to = id;
      dw.flagNode = id;
    }
    gc(nodes);
    return nodes;
  };

  /**
   * A step an option created can be opened and deleted. The option that owned it must then read as what the line now
   * does, or its panel would offer an hours box for a step that no longer exists (notes, M5).
   */
  const forgetGenerated = (owner: WfNode, id: string): void => {
    if (owner.kind === 'cond') {
      if (owner.elseNode === id) {
        owner.elseNode = null;
        owner.elseDo = 'continue';
      }
      for (const out of owner.outs as (Out & Partial<CondPath>)[]) {
        if (out.node === id) {
          out.node = null;
          out.do = 'continue';
        }
      }
    } else if (owner.kind === 'dw' && owner.flagNode === id) {
      owner.flagNode = null;
      owner.flagDo = 'note';
    } else if (owner.kind === 'collect' && owner.failNode === id) {
      delete owner.failNode;
      owner.failTo = 'approval';
      owner.failRoles ??= [];
      owner.failMode ??= 'all';
      owner.outs = (owner.outs as Out[]).filter((out) => out.key !== 'fail') as CollectNode['outs'];
      const next = owner.outs.find((out) => out.key === 'next');
      if (next) delete next.label;
    } else if (owner.kind === 'system' && id === `${owner.id}f`) {
      owner.sys.onFail = 'task';
      owner.outs = (owner.outs as Out[]).filter((out) => out.key !== 'failed');
      const normal = (owner.outs as Out[])[0];
      if (normal) delete normal.label;
    }
  };

  /** Engine §16.7. Start and End can't be deleted. The UI shows `copy.stepDeleted` and keeps the `input` graph for Undo. */
  const deleteStep = (input: Nodes, id: string): Nodes => {
    const target = input[id];
    if (!target || target.kind === 'trigger' || target.kind === 'end') return input;
    const nodes = start(input);
    const node = nodes[id];
    const outs = node.outs as Out[];
    const usesLast = node.kind === 'cond' || node.kind === 'plan' || (node.kind === 'dw' && isCheck(node.worker, ctx));
    const keep = (usesLast ? outs[outs.length - 1] : outs[0]).to;
    moveExits(nodes, id, keep);
    for (const other of Object.values(nodes)) {
      if (other.kind === 'cond' && other.mergeAt === id) other.mergeAt = keep;
      forgetGenerated(other, id);
    }
    delete nodes[id];
    gc(nodes);
    return nodes;
  };

  /** Engine §16.9. */
  const addBranch = (input: Nodes, parallelId: string): Nodes => {
    const nodes = start(input);
    const outs = nodes[parallelId].outs as Out[];
    outs.push({ key: ctx.idGen.next('branch'), to: outs[0].to, label: copy.branchLabel(outs.length + 1) });
    return nodes;
  };

  /** Engine §16.9: only with 3+ branches. */
  const removeBranch = (input: Nodes, parallelId: string, outKey: string): Nodes => {
    if ((input[parallelId].outs as Out[]).length < 3) return input;
    const nodes = start(input);
    const parallel = nodes[parallelId] as ParallelNode;
    parallel.outs = parallel.outs.filter((o) => o.key !== outKey);
    gc(nodes);
    return nodes;
  };

  /** 04 §7.14: branch names are exit labels. */
  const renameBranch = (input: Nodes, parallelId: string, outKey: string, label: string): Nodes => {
    const nodes = start(input);
    ((nodes[parallelId].outs as Out[]).find((o) => o.key === outKey) as Out).label = label;
    return nodes;
  };

  /** Engine §16.10. The UI shows `copy.addedAfterPathsMeet`. */
  const insertAfterMerge = (input: Nodes, id: string, spec: StepSpec): EditResult => {
    const nodes = start(input);
    const source = nodes[id];
    const fromEach = (source.outs as Out[]).map((out) => reachable(nodes, out.to));
    const meet = Array.from(reachable(nodes, id).keys()).find((candidate) => candidate !== id && fromEach.every((r) => r.has(candidate)));
    if (!meet) return refuse(copy.pathsNeverMeet);

    const afterMeet = reachable(nodes, meet);
    const before = Array.from(reachable(nodes, id).keys()).filter((candidate) => !afterMeet.has(candidate));
    const created = createNode(nodes, spec, meet);
    for (const nodeId of before) {
      for (const out of nodes[nodeId].outs ?? []) if (out.to === meet) out.to = created.id;
    }
    if (source.kind === 'cond') source.mergeAt = created.id;
    return nodes;
  };

  /** Engine §16.11: System "If it fails". */
  const setSystemOnFail = (input: Nodes, systemId: string, mode: SystemNode['sys']['onFail']): Nodes => {
    const nodes = start(input);
    const system = nodes[systemId] as SystemNode;
    const normal = (system.outs as Out[]).find((o) => o.key !== 'failed') as Out;
    system.sys.onFail = mode;
    if (mode === 'path') {
      if (!(system.outs as Out[]).some((o) => o.key === 'failed')) {
        const id = `${system.id}f`;
        nodes[id] = {
          id,
          kind: 'task',
          label: copy.fixSystemLabel(system.system),
          role: 'people_ops',
          title: copy.fixSystemTitle(system.system),
          outs: [{ key: 'next', to: normal.to }],
        };
        normal.label = copy.systemExitDone;
        (system.outs as Out[]).push({ key: 'failed', to: id, label: copy.systemExitFailed });
      }
    } else {
      system.outs = (system.outs as Out[]).filter((o) => o.key !== 'failed');
      delete normal.label;
      gc(nodes);
    }
    return nodes;
  };

  /** Engine §16.11: changing the System rebuilds `sys`, keeping the previous action unless it was 'create'. */
  const setSystem = (input: Nodes, systemId: string, system: string): Nodes => {
    const nodes = start(input);
    const node = nodes[systemId] as SystemNode;
    const previousAction = node.sys?.action;
    node.system = system;
    node.sys = ensureSys(node, ctx.systems);
    if (previousAction && previousAction !== 'create') node.sys.action = previousAction;
    return nodes;
  };

  /** Engine §16.11: changing "What" resets the field map. */
  const setSystemObject = (input: Nodes, systemId: string, object: string): Nodes => {
    const nodes = start(input);
    const node = nodes[systemId] as SystemNode;
    node.sys.object = object;
    node.sys.map = (ctx.systems.SYS_MAP[object] ?? ctx.systems.SYS_MAP._).map(([from, to]): [string, string] => [from, to]);
    return nodes;
  };

  /** Engine §16.11: Fits plan? "If outside the plan, send it to". */
  const setPlanOutside = (input: Nodes, planId: string, role: RoleKey): Nodes => {
    const nodes = start(input);
    const plan = nodes[planId] as PlanNode;
    const out = plan.outs.find((o) => o.key === 'out') as Out;
    const target = nodes[out.to];
    if (target?.kind === 'appr') {
      target.roles = [role];
    } else {
      const id = `${plan.id}x`;
      nodes[id] = { id, kind: 'appr', label: copy.outsidePlan, roles: [role], who: 'roles', remind: 24, ...approveDefaults(), outs: [{ key: 'next', to: out.to }] } as ApproveNode;
      out.to = id;
    }
    return nodes;
  };

  /** Engine §16.11: Approve "Who approves". Nothing is auto-picked (D6). */
  const setApprovers = (
    input: Nodes,
    apprId: string,
    choice: { who: 'roles'; roles?: RoleKey[] } | { who: 'group'; group?: string } | { who: 'person'; person?: string; backup?: string },
  ): Nodes => {
    const nodes = start(input);
    const node = nodes[apprId] as ApproveNode;
    if (whoMode(node) === 'roles' && choice.who !== 'roles' && node.roles.length > 0) savedRoles.set(apprId, node.roles);

    if (choice.who === 'roles') {
      node.who = 'roles';
      node.roles = choice.roles ?? savedRoles.get(apprId) ?? [];
      delete node.backup;
      return nodes;
    }
    node.mode = 'all';
    if (choice.who === 'group') {
      node.who = 'group';
      node.roles = choice.group ? [`g:${choice.group.replace(/^g:/, '')}`] : [];
      delete node.backup;
      return nodes;
    }
    const switching = node.who !== 'person';
    node.who = 'person';
    const person = choice.person?.replace(/^p:/, '');
    node.roles = person ? [`p:${person}`] : switching ? [] : node.roles;
    if (person) ensurePseudoRole(ctx.people, `p:${person}`);
    node.backup = choice.backup ?? (switching ? '' : node.backup ?? '');
    if (person && node.backup === person) node.backup = '';
    return nodes;
  };

  /** Engine §16.11: any other single-field edit stores the value as given; no other node changes. */
  const setField = (input: Nodes, id: string, field: string, value: unknown): Nodes => {
    const nodes = start(input);
    const node = nodes[id] as unknown as Record<string, unknown>;
    node[field] = value;
    if (field === 'kit') node.gives = (value as string[]).join(' and ');
    return nodes;
  };

  /** Several single-field edits that belong together (04 §6.4 switching Gives off clears two fields). */
  const setFields = (input: Nodes, id: string, fields: Record<string, unknown>): Nodes =>
    Object.entries(fields).reduce<Nodes>((nodes, [field, value]) => setField(nodes, id, field, value), input);

  /** Engine §16.11: an edit inside a System step's `sys`; no other node changes. */
  const setSysFields = (input: Nodes, id: string, fields: Partial<SystemNode['sys']>): Nodes => {
    const nodes = start(input);
    const node = nodes[id] as SystemNode;
    node.sys = { ...node.sys, ...fields };
    return nodes;
  };

  /** 04 §7.6, §7.7: changing the Digital Worker renames the step, and its generated escalation if it still has the worker's name. */
  const setWorker = (input: Nodes, id: string, worker: string): Nodes => {
    const nodes = start(input);
    const node = nodes[id] as DwNode;
    const generated = node.flagNode ? nodes[node.flagNode] : undefined;
    const label = (workerId: string): string => copy.flagEscalationLabel(ctx.dws.DW[workerId].n.replace(' check', ''));
    if (generated?.kind === 'appr' && generated.label === label(node.worker)) generated.label = label(worker);
    node.worker = worker;
    node.label = ctx.dws.DW[worker].n;
    return nodes;
  };

  /** The Approve panel's condition editor: "Only needed when" as it now stands, keeping the words typed. */
  const setWhenCondition = (input: Nodes, apprId: string, when: NonNullable<ApproveNode['when']>): Nodes => {
    const nodes = start(input);
    (nodes[apprId] as ApproveNode).when = when;
    return nodes;
  };

  /** Engine §17.1 step 3: what ✦ Set stores, with the words as typed. */
  const setWhen = (input: Nodes, apprId: string, when: NonNullable<ApproveNode['when']>, text: string): Nodes => {
    const nodes = start(input);
    const node = nodes[apprId] as ApproveNode;
    node.when = when;
    node.whenPrompt = text.trim();
    return nodes;
  };

  /** Engine §17.1 step 5: "Always ask this approver". */
  const clearWhen = (input: Nodes, apprId: string): Nodes => {
    const nodes = start(input);
    const node = nodes[apprId] as ApproveNode;
    delete node.when;
    node.whenPrompt = '';
    return nodes;
  };

  /** Engine §16.12. */
  const setCollectFail = (input: Nodes, collectId: string, failTo: CollectNode['failTo'], role?: RoleKey): Nodes => {
    const nodes = start(input);
    const collect = nodes[collectId] as CollectNode;
    collect.failTo = failTo;
    if (failTo === 'role') {
      ensureCollectEscalation(nodes, collectId, role);
      return nodes;
    }
    if (collect.failNode) delete nodes[collect.failNode];
    delete collect.failNode;
    collect.outs = (collect.outs as Out[]).filter((o) => o.key !== 'fail') as CollectNode['outs'];
    const next = collect.outs.find((o) => o.key === 'next');
    if (next) delete next.label;
    collect.failRoles ??= [];
    collect.failMode ??= 'all';
    gc(nodes);
    return nodes;
  };

  /** Engine §16.13: the generated step behind an "Escalate after (hours)" box. */
  const escalationId = (nodes: Nodes, ownerId: string, outKey: string | null): string | undefined => {
    const owner = nodes[ownerId];
    if (owner.kind === 'cond' && outKey) {
      const out = pathOut(owner, outKey);
      return (outKey === 'else' ? owner.elseNode : out.node) ?? undefined;
    }
    if (owner.kind === 'dw') return owner.flagNode ?? undefined;
    if (owner.kind === 'collect') return owner.failNode;
    return undefined;
  };

  const getEscalateAfter = (nodes: Nodes, ownerId: string, outKey: string | null = null): number | undefined => {
    const id = escalationId(nodes, ownerId, outKey);
    const node = id ? nodes[id] : undefined;
    return node?.kind === 'appr' ? node.sla : undefined;
  };

  const setEscalateAfter = (input: Nodes, ownerId: string, outKey: string | null, hours: number): Nodes => {
    const nodes = start(input);
    const id = escalationId(nodes, ownerId, outKey);
    if (id) (nodes[id] as ApproveNode).sla = hours;
    return nodes;
  };

  /** Engine §16.13: dropping a Digital Worker on a step (a line "+" is `insertStep`). */
  const dropWorker = (input: Nodes, targetId: string, workerId: string): { nodes: Nodes; toast: string } => {
    const target = input[targetId];
    const name = ctx.dws.DW[workerId].n;
    if (target.kind === 'collect') {
      const nodes = start(input);
      const collect = nodes[targetId] as CollectNode;
      collect.checker = `dw:${workerId}`;
      if (collect.verify === 'person') collect.verify = 'auto_person';
      return { nodes, toast: copy.workerNowVerifies(name, title(collect)) };
    }
    if (target.kind === 'system') {
      const nodes = start(input);
      (nodes[targetId] as SystemNode).via = workerId;
      return { nodes, toast: copy.workerNowDoes(name, title(target)) };
    }
    return { nodes: input, toast: copy.checksGoOnLine };
  };

  /** Engine §12.2: Nova's one-click fixes ('rev:<id>', 'gr:<id>'). */
  const applyLintFix = (input: Nodes, fix: string): { nodes: Nodes; toast: string } => {
    const [kind, id] = fix.split(':');
    const nodes = start(input);
    const node = fieldsOf(nodes[id]);
    if (kind === 'rev') {
      node.reverse = copy.l2Reverse(node.gives as string);
      return { nodes, toast: copy.l2Toast(node.reverse as string) };
    }
    node.gives = copy.l3Gives(node.system as string);
    node.reverse = copy.l3Reverse(node.system as string);
    return { nodes, toast: copy.l3Toast };
  };

  /** Engine §16.13: "+ New workflow". The UI shows `copy.newDraftToast`. */
  const createWorkflow = (from: Workflow | null): Workflow => createWorkflowIn(from, ctx);

  return {
    insertStep,
    setPathThen,
    renamePath,
    addPath,
    deletePath,
    addCondition,
    addEitherOr,
    addOption,
    removeRow,
    setRowField,
    setPathCondition,
    setFlag,
    deleteStep,
    addBranch,
    removeBranch,
    renameBranch,
    insertAfterMerge,
    setSystemOnFail,
    setSystem,
    setSystemObject,
    setPlanOutside,
    setApprovers,
    setField,
    setFields,
    setSysFields,
    setWorker,
    setWhenCondition,
    setWhen,
    clearWhen,
    setCollectFail,
    getEscalateAfter,
    setEscalateAfter,
    dropWorker,
    applyLintFix,
    createWorkflow,
    gc: (input: Nodes): Nodes => {
      const nodes = structuredClone(input);
      gc(nodes);
      return nodes;
    },
  };
}

export type Editor = ReturnType<typeof createEditor>;

/** The first day of the month after `asOf` + 30 days (02 §4): 2026-10-20 → 2026-12-01. No system clock. */
function newWorkflowEffective(asOf: string): string {
  const [year, month, day] = asOf.split('-').map(Number);
  const plus30 = new Date(Date.UTC(year, month - 1, day + 30));
  const next = new Date(Date.UTC(plus30.getUTCFullYear(), plus30.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

/** Engine §16.13. */
export function createWorkflowIn(from: Workflow | null, ctx: Pick<EngineContext, 'idGen' | 'asOf'>): Workflow {
  return {
    id: ctx.idGen.next('workflow'),
    name: copy.newStep.workflow,
    records: from ? [from.records[0]] : ['work_order'],
    event: from ? from.event : 'submitted',
    scope: {},
    status: 'draft',
    version: 0,
    effective: newWorkflowEffective(ctx.asOf),
    owner: copy.newStep.owner,
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
  };
}
