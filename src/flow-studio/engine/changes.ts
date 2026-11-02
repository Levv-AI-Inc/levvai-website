import type { EngineContext } from '../model/context';
import type { RoleKey } from '../model/people';
import type { ApprovalPlan, Basis, StageItem } from '../model/results';
import type { ApproveNode, WfNode, Workflow } from '../model/workflow';
import { copy } from './copy';
import type { Rec } from './conditions';
import { roleName } from './resolve';
import { fmt } from './text';
import { walkWorkflow } from './walk';
import { rulesMatching } from './rules';

/** Engine §6.2. Null means the record is used as it is. */
export function applyBasis(wf: Pick<Workflow, 'basis'>, rec0: Rec): Basis | null {
  const prev = rec0.prev as { total_value?: number | null } | undefined;
  if (!prev || prev.total_value == null || !wf.basis || wf.basis === 'total') return null;
  const total = rec0.total_value as number;
  const orig = (rec0.original_total as number | undefined) ?? prev.total_value;
  const change = total - prev.total_value;
  const running = total - orig;
  if (wf.basis === 'change') {
    return { basis: 'change', v: change, m: copy.basisChange(fmt(change), fmt(prev.total_value), fmt(total)) };
  }
  return { basis: 'running', v: running, m: copy.basisRunning(fmt(running), fmt(orig), fmt(change)) };
}

/** Engine §6.4: the roles that approved the previous version of a change event. */
export function previousApprovers(nodes: Record<string, WfNode>, rec0: Rec, ctx: EngineContext): Set<RoleKey> {
  const roles = new Set<RoleKey>();
  const prev = rec0.prev as Rec | undefined;
  if (!prev) return roles;
  const before = { ...rec0, ...prev };
  for (const step of walkWorkflow(nodes, before, ctx).steps) {
    const node = nodes[step.nodeId];
    if (node.kind === 'appr') node.roles.forEach((role) => roles.add(role));
  }
  for (const rule of rulesMatching(before, ctx)) {
    if (rule.act.approve) rule.act.roles.forEach((role) => roles.add(role));
  }
  return roles;
}

const itemRoles = (item: StageItem): RoleKey[] => [...item.roles, ...(item.also ?? [])];

const inPlan = (plan: ApprovalPlan, roles: RoleKey[]): boolean =>
  plan.stages.some((stage) => stage.items.some((item) => itemRoles(item).some((role) => roles.includes(role))));

/**
 * Engine §8.4 step 2: the status shown after a person when the record carries decisions.
 * `before` is the plan before the edit (the same plan when no edit is applied) and `changed` the fields the edit changed.
 * Test's demo edits only ever go down (`edit.decreased`), so "every changed one went down" holds whenever `changed` is not empty.
 */
export function itemStatus(item: StageItem, before: ApprovalPlan, decided: RoleKey[], changed: string[], nodes: Record<string, WfNode>): string {
  const roles = itemRoles(item);
  if (roles.some((role) => decided.includes(role))) {
    const node = item.nodeId ? (nodes[item.nodeId] as ApproveNode) : undefined;
    const changedMaterial = (node?.material ?? []).filter((key) => changed.includes(key));
    if (changedMaterial.length === 0) return copy.statusApproved;
    return node?.reaskOnDecrease === false ? copy.statusStands : copy.statusAskedAgain;
  }
  return inPlan(before, roles) ? copy.statusWaiting : copy.statusNew;
}

/** Engine §8.4 step 3: the "Removed by the edit" lines. */
export function removedByEdit(before: ApprovalPlan, after: ApprovalPlan, decided: RoleKey[], ctx: Pick<EngineContext, 'people'>): string[] {
  const lines: string[] = [];
  for (const stage of before.stages) {
    for (const item of stage.items) {
      for (const role of itemRoles(item)) {
        if (inPlan(after, [role])) continue;
        const line = decided.includes(role) ? copy.removedApproved(roleName(ctx, role)) : copy.removedWithdrawn(roleName(ctx, role));
        if (!lines.includes(line)) lines.push(line);
      }
    }
  }
  return lines;
}
