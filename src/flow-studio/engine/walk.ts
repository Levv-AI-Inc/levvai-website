import type { EngineContext } from '../model/context';
import type { WalkResult } from '../model/results';
import type { CondNode, CondPath, Out, WfNode } from '../model/workflow';
import { checkResult, isCheck } from './checks';
import { evalCondition, missingFields, type Rec } from './conditions';
import { copy } from './copy';
import { roleName } from './resolve';
import { conditionText, title } from './text';

const STRUCTURAL_FOR_STEPS: WfNode['kind'][] = ['trigger', 'cond', 'plan', 'parallel', 'end'];
const WALK_GUARD = 800;

type WalkCtx = Pick<EngineContext, 'catalog' | 'dws'>;

/** The outcome stored on the sample for a step, by node id then by title (engine §10.3). */
export function simulatedOutcome(rec: Rec, node: WfNode): string | undefined {
  const byId = rec.outcomes as Record<string, string> | undefined;
  const byLabel = rec.outcomesL as Record<string, string> | undefined;
  return byId?.[node.id] ?? byLabel?.[title(node)];
}

/** Engine §2.4 and the If case of §4: returns the out taken, or null when Needs information stops the If. */
function takeIf(node: CondNode, rec: Rec, ctx: WalkCtx, result: WalkResult, reason: Record<string, string>): (Out & Partial<CondPath>)[] | null {
  const missing = missingFields(node, rec);
  let values = rec;
  if (missing.length > 0 && node.onMissing !== 'otherwise') {
    const cautious = node.onMissing === 'cautious' && missing.every((f) => ctx.catalog.FIELD[f]?.risk);
    if (!cautious) {
      result.decisions.push({ nodeId: node.id, label: copy.needsInformation });
      result.needInfo.push({ nodeId: node.id, missing });
      return null;
    }
    values = { ...rec };
    for (const field of missing) values[field] = true;
  }
  const outs = node.outs as (Out & Partial<CondPath>)[];
  const hit =
    outs.find((out) => out.key !== 'else' && evalCondition({ join: out.join, rows: out.rows }, values)) ??
    outs.find((out) => out.key === 'else');
  if (!hit) return [];
  result.decisions.push({ nodeId: node.id, label: hit.label ?? '' });
  if (hit.key !== 'else') reason[hit.to] = `${hit.label}: ${conditionText({ join: hit.join, rows: hit.rows }, ctx.catalog)}`;
  return [hit];
}

/** One If, decided on its own: what the runtime calls when a run reaches it (05 §3.4.1). `missing` means Needs information. */
export function decideIf(node: CondNode, rec: Rec, ctx: WalkCtx): { taken: Out[]; missing: string[] | null } {
  const result: WalkResult = { seen: [], path: new Set<string>(), edges: [], steps: [], decisions: [], needInfo: [] };
  const taken = takeIf(node, rec, ctx, result, {});
  return taken === null ? { taken: [], missing: result.needInfo[0].missing } : { taken, missing: null };
}

/**
 * Engine §4. `rec` is the record after the change-amount basis is applied (§6.2). One walk per run (D1).
 * `taken` is for a real run: exits it has already taken are facts, and a Failed exit is one no record can predict.
 */
export function walkWorkflow(nodes: Record<string, WfNode>, rec: Rec, ctx: WalkCtx, taken0: Record<string, string[]> = {}): WalkResult {
  const result: WalkResult = { seen: [], path: new Set<string>(), edges: [], steps: [], decisions: [], needInfo: [] };
  const reason: Record<string, string> = {};
  const queue = ['T'];
  const visited = new Set<string>();

  for (let guard = 0; queue.length > 0 && guard < WALK_GUARD; guard += 1) {
    const id = queue.shift() as string;
    if (visited.has(id) || !nodes[id]) continue;
    visited.add(id);
    result.seen.push(id);
    result.path.add(id);
    const node = nodes[id];
    const allOuts: Out[] = node.outs ?? [];
    const followed = taken0[id];
    let taken: Out[];

    if (followed && node.kind === 'cond') {
      taken = allOuts.filter((out) => followed.includes(out.key));
      for (const out of taken as (Out & Partial<CondPath>)[]) {
        result.decisions.push({ nodeId: id, label: out.label ?? '' });
        if (out.key !== 'else' && out.rows) reason[out.to] = `${out.label}: ${conditionText({ join: out.join, rows: out.rows }, ctx.catalog)}`;
      }
    } else if (node.kind === 'cond') {
      const outs = takeIf(node, rec, ctx, result, reason);
      if (outs === null) continue;
      taken = outs;
    } else if (node.kind === 'plan') {
      const inPlan = ((rec.budget_left_after as number | null | undefined) ?? 0) >= 0;
      const hit = allOuts.find((out) => out.key === (inPlan ? 'in' : 'out'));
      const label = inPlan ? copy.insidePlan : copy.outsidePlan;
      taken = hit ? [hit] : [];
      result.decisions.push({ nodeId: id, label });
      if (hit) reason[hit.to] = label;
    } else if (node.kind === 'dw' && isCheck(node.worker, ctx)) {
      const check = checkResult(node.worker, rec, ctx);
      const hit = allOuts.find((out) => out.key === (check.ok ? 'pass' : 'flag'));
      taken = hit ? [hit] : [];
      result.decisions.push({ nodeId: id, label: check.ok ? copy.passed : copy.flagged });
      if (hit) reason[hit.to] = `${ctx.dws.DW[node.worker].n}: ${check.m}`;
    } else if (node.kind === 'parallel') {
      taken = allOuts;
    } else if (node.kind === 'collect' && allOuts.some((out) => out.key === 'fail')) {
      const key = simulatedOutcome(rec, node) === 'fail' ? 'fail' : 'next';
      taken = allOuts.filter((out) => out.key === key);
    } else {
      taken = allOuts.slice(0, 1);
    }

    if (followed && node.kind !== 'cond') taken = allOuts.filter((out) => followed.includes(out.key));

    if (!STRUCTURAL_FOR_STEPS.includes(node.kind)) result.steps.push({ nodeId: id, why: reason[id] ?? null });

    for (const out of taken) {
      result.path.add(`${id}:${out.key}`);
      result.edges.push({ from: id, key: out.key, to: out.to });
      queue.push(out.to);
    }
  }
  return result;
}

/** Engine §4: how the walk ended. Stopped carries who is told (§16.4). */
export function walkOutcome(nodes: Record<string, WfNode>, walk: WalkResult, ctx: Pick<EngineContext, 'people'>) {
  const endOf = (outcome: string) => walk.seen.find((id) => nodes[id]?.kind === 'end' && (nodes[id] as { outcome?: string }).outcome === outcome);
  const senderOf = (id: string) => walk.edges.find((edge) => edge.to === id)?.from;

  const rejectedEnd = endOf('rejected');
  let rejected: { nodeId: string; by: string } | null = null;
  if (rejectedEnd) {
    const from = senderOf(rejectedEnd);
    rejected = { nodeId: from ?? rejectedEnd, by: from ? title(nodes[from]) : title(nodes[rejectedEnd]) };
  }

  const stoppedEnd = endOf('stopped');
  let stopped: { nodeId: string; by: string; told: string[] } | null = null;
  if (stoppedEnd) {
    const from = senderOf(stoppedEnd);
    const notify = from ? nodes[from] : undefined;
    // A generated stop is If or check → "tell them it stopped" → End: the step that stopped it is the one before the Notify.
    const decider = notify?.kind === 'notify' ? senderOf(notify.id) : undefined;
    const by = decider ?? from ?? stoppedEnd;
    stopped = {
      nodeId: by,
      by: title(nodes[by]),
      told: notify?.kind === 'notify' ? notify.recipients.map((role) => roleName(ctx, role)) : [],
    };
  }
  return { rejected, stopped };
}
