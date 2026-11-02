import type { ApprovalPlan, StepResult } from '../model/results';
import type { PolicyNode, WfNode } from '../model/workflow';
import type { Rec } from './conditions';
import { copy } from './copy';

/** Engine §9: Fits plan?. */
export const fitsPlan = (rec: Rec): boolean => ((rec.budget_left_after as number | null | undefined) ?? 0) >= 0;

export function planStepResult(rec: Rec): StepResult {
  return fitsPlan(rec)
    ? { st: 'ok', short: copy.insideThePlan, m: copy.fitsBudget }
    : { st: 'ok', short: copy.outsideThePlan, m: copy.outsideBudget };
}

/** Engine §9: Auto-approve approves only when nobody is asked anywhere on the path. */
export function policyStepResult(node: PolicyNode, plan: ApprovalPlan | null): StepResult {
  return plan?.auto
    ? { st: 'ok', short: copy.approvedAutomatically, m: node.receipt || copy.approvedAutomatically }
    : { st: 'ok', short: copy.notUsed, m: copy.someoneApproves };
}

/** Engine §6.11 item 3 (D6): never approve automatically when an Approve step on the path has no approvers. */
export function isAutoApproved(
  plan: Pick<ApprovalPlan, 'stages' | 'policies' | 'needInfo' | 'rejected' | 'stopped' | 'walk'>,
  nodes: Record<string, WfNode>,
): boolean {
  const emptyApprove = plan.walk.steps.some((step) => {
    const node = nodes[step.nodeId];
    return node.kind === 'appr' && node.roles.length === 0;
  });
  return plan.stages.length === 0 && plan.policies.length > 0 && plan.needInfo.length === 0 && !plan.rejected && !plan.stopped && !emptyApprove;
}
