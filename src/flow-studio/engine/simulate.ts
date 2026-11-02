import type { EngineContext } from '../model/context';
import type { RecordData, SampleRecord } from '../model/records';
import type { ApprovalPlan, RoundLine, Stage, StageItem, StepResult, TestRun, TestRunOptions } from '../model/results';
import type { ApproveNode, CollectNode, NotifyNode, RunWorkflowNode, SystemNode, TaskNode, WaitNode, WfNode, Workflow } from '../model/workflow';
import { planStepResult, policyStepResult } from './auto';
import { applyBasis, itemStatus, removedByEdit } from './changes';
import { checkResult, helperMessage, isCheck } from './checks';
import type { Rec } from './conditions';
import { copy } from './copy';
import { needsPlan, planApprovals, planFailedCheck, planRecord, itemLabel } from './plan';
import { personLabel, roleName } from './resolve';
import { chaseDefaults, chaseTo, dispOf, sysSentence, title, waitText } from './text';
import { simulatedOutcome, walkWorkflow } from './walk';

/** Engine §10.4: a stage as one round line. */
function roundLine(stage: Stage, ctx: EngineContext, statusOf?: (item: StageItem) => string): RoundLine {
  return {
    people: stage.items.map((item) => itemLabel(item, ctx, statusOf?.(item))).join(', '),
    notes: stage.items.flatMap((item) => item.notes.map((note) => note.m)),
  };
}

const joinRound = (line: RoundLine): string => (line.notes.length > 0 ? `${line.people} · ${line.notes.join('; ')}` : line.people);

const taskLines = (stages: Stage[], ctx: EngineContext): string[] =>
  stages.flatMap((stage) => stage.tasks.map((task) => copy.ruleTaskLine(task.title, roleName(ctx, task.role), task.person)));

function withRounds(result: StepResult, lines: RoundLine[]): StepResult {
  return lines.length > 0 ? { ...result, roundLines: lines, rounds: lines.map(joinRound) } : result;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Engine §10.4. */
function approveResult(node: ApproveNode, plan: ApprovalPlan, ctx: EngineContext, statusOf?: (item: StageItem) => string): StepResult {
  const stages = plan.stages.filter((stage) => stage.items.some((item) => item.nodeId === node.id));
  if (node.roles.length === 0) return { st: 'fail', short: copy.chooseWhoApproves, m: copy.pickWhoApproves };

  if (stages.length > 0) {
    const lines = stages.map((stage) => roundLine(stage, ctx, statusOf));
    const tasks = taskLines(stages, ctx);
    const withTasks = (result: StepResult): StepResult => withRounds(tasks.length > 0 ? { ...result, tasks } : result, lines);
    if (stages.some((stage) => stage.items.some((item) => item.paused))) {
      return withTasks({ st: 'fail', short: copy.paused, m: copy.pausedMessage });
    }
    const { remind, sla } = chaseDefaults(node);
    const chaser = copy.chaserLine(remind, chaseTo(node), sla);
    if (node.escalation) return withTasks({ st: 'review', short: copy.escalated, m: copy.escalatedMessage + chaser });
    const prefix = node.roles.length > 1 ? copy.modePrefix[node.mode ?? 'all'] : '';
    return withTasks({ st: 'review', short: copy.approval, m: prefix + copy.ifRejected[node.reject ?? 'requester'] + chaser });
  }

  const notNeeded = plan.notNeeded.find((entry) => entry.nodeId === node.id);
  if (notNeeded) return { st: 'ok', short: copy.notNeeded, m: capitalise(notNeeded.m) };
  const skipped = plan.skipped.filter((entry) => entry.nodeId === node.id);
  if (skipped.length > 0) {
    return { st: 'ok', short: copy.notAskedAgain, m: skipped.map((entry) => `${roleName(ctx, entry.role)}: ${entry.m}`).join('; ') };
  }
  return { st: 'ok', short: copy.covered, m: copy.coveredMessage };
}

const askText = (node: CollectNode, rec: Rec, ctx: EngineContext): string =>
  copy.askedOf(personLabel(node.from ?? 'worker', rec, ctx), node.items.join(', ') || copy.nothingListedYet);

const seesFor = (node: CollectNode, st: StepResult['st']): string => {
  if (st === 'ok') return copy.done;
  if (st === 'fail') return copy.seesInProgress;
  if (st === 'wait') return copy.seesNotStarted;
  return node.verify === 'auto' ? copy.seesInProgress : copy.seesWaitingForReview;
};

/** Engine §10.3: Collect & verify. */
function collectResult(node: CollectNode, rec: Rec, wf: Workflow, ctx: EngineContext): StepResult {
  const outcome = simulatedOutcome(rec, node);
  const ask = askText(node, rec, ctx);
  const checker = ctx.presets.CHECKERS[node.checker] ?? node.checker;
  let result: StepResult;

  if (outcome === 'fail') {
    if (node.failTo === 'approval') {
      const roles = node.failRoles ?? [];
      if (roles.length > 0) {
        const m = copy.failedMustDecide(ask, roles.map((role) => roleName(ctx, role)));
        const lines = planFailedCheck(node, rec, wf, ctx).map((stage) => roundLine(stage, ctx));
        result = withRounds({ st: 'fail', short: copy.failedDecisionNeeded, m }, lines);
      } else {
        result = { st: 'fail', short: copy.failedDecisionNeeded, m: copy.failedNobodySet(ask) };
      }
    } else {
      result = { st: 'fail', short: copy.failedEscalated, m: copy.failedEscalatedTo(ask, personLabel(node.failRole, rec, ctx)) };
    }
  } else if (node.verify === 'person') {
    result = { st: 'review', short: copy.review(roleName(ctx, node.reviewer)), m: copy.waitingFor(ask, personLabel(node.reviewer, rec, ctx)) };
  } else if (node.verify === 'auto_person' && outcome === 'unsure') {
    result = { st: 'review', short: copy.unsure(roleName(ctx, node.reviewer)), m: copy.checkerUnsure(ask, checker, personLabel(node.reviewer, rec, ctx)) };
  } else {
    result = { st: 'ok', short: copy.verifiedAutomatically, m: copy.verifiedBy(ask, checker) };
  }
  return { ...result, sees: seesFor(node, result.st) };
}

function taskResult(node: TaskNode, rec: Rec, ctx: EngineContext): StepResult {
  const who = personLabel(node.role, rec, ctx);
  return simulatedOutcome(rec, node) === 'done'
    ? { st: 'ok', short: copy.done, m: copy.taskDone(node.title, who) }
    : { st: 'review', short: copy.taskToDo(roleName(ctx, node.role)), m: copy.taskLine(node.title, who) };
}

function systemResult(node: SystemNode, ctx: EngineContext): StepResult {
  if (ctx.systems.SYS[node.system]?.st === 'off') return { st: 'review', short: copy.pausedNotConnected, m: sysSentence(node, ctx) };
  const via = node.via ? copy.doneByWorker(ctx.dws.DW[node.via]?.n ?? node.via) : '';
  const ledger = node.gives ? copy.ledgerLine(node.gives, copy.DISP[dispOf(node)]) : '';
  return { st: 'ok', short: copy.doneIn(node.system), m: sysSentence(node, ctx) + via + ledger };
}

function notifyResult(node: NotifyNode, rec: Rec, ctx: EngineContext): StepResult {
  if (node.recipients.length === 0) return { st: 'ok', short: copy.noOneToTell, m: copy.pickWhoToTell };
  return { st: 'ok', short: copy.sent, m: copy.sentTo(node.channel || 'Email', node.recipients.map((role) => personLabel(role, rec, ctx))) };
}

const waitResult = (node: WaitNode, ctx: EngineContext): StepResult => ({ st: 'ok', short: copy.waits, m: waitText(node.w, true, ctx.catalog) });

const runWorkflowResult = (node: RunWorkflowNode, ctx: EngineContext): StepResult => ({
  st: 'ok',
  short: copy.started,
  m: copy.starts(ctx.workflows.find((w) => w.id === node.target)?.name ?? copy.pickWorkflow),
});

/** Engine §10.3. Trigger, If, Parallel and End have no result. The run screens use it too, so a run reads the way Test does (05 §6.2). */
export function stepResult(node: WfNode, rec: Rec, plan: ApprovalPlan | null, wf: Workflow, ctx: EngineContext, statusOf?: (item: StageItem) => string): StepResult | null {
  switch (node.kind) {
    case 'dw':
      if (isCheck(node.worker, ctx)) {
        const check = checkResult(node.worker, rec, ctx);
        return check.ok ? { st: 'ok', short: copy.passed, m: check.m } : { st: 'review', short: copy.flagged, m: check.m };
      }
      return { st: 'ok', short: copy.done, m: helperMessage(node.worker, ctx) };
    case 'appr':
      return plan ? approveResult(node, plan, ctx, statusOf) : null;
    case 'policy':
      return policyStepResult(node, plan);
    case 'plan':
      return planStepResult(rec);
    case 'collect':
      return collectResult(node, rec, wf, ctx);
    case 'task':
      return taskResult(node, rec, ctx);
    case 'system':
      return systemResult(node, ctx);
    case 'notify':
      return notifyResult(node, rec, ctx);
    case 'wait':
      return waitResult(node, ctx);
    case 'runwf':
      return runWorkflowResult(node, ctx);
    default:
      return null;
  }
}

const STRUCTURAL: WfNode['kind'][] = ['cond', 'parallel', 'end'];
const HOLDS_THE_LINE: WfNode['kind'][] = ['collect', 'task', 'system'];
const KEEPS_OWN_RESULT: WfNode['kind'][] = ['appr', 'policy', 'plan'];

/** Engine §10.5: every step on the line must be done before the line moves on (Test never holds on approvals, D3). */
function holdTheLine(nodes: Record<string, WfNode>, seen: string[], results: Record<string, StepResult>, rec: Rec, ctx: EngineContext): string[] {
  const preds: Record<string, string[]> = {};
  for (const id of seen) {
    for (const out of nodes[id].outs ?? []) {
      if (seen.includes(out.to)) (preds[out.to] ??= []).push(id);
    }
  }
  const heldStructural = new Set<string>();
  const blocks = (id: string): boolean => {
    if (heldStructural.has(id)) return true;
    const result = results[id];
    if (!result) return false;
    return result.st === 'wait' || (HOLDS_THE_LINE.includes(nodes[id].kind) && (result.st === 'review' || result.st === 'fail'));
  };
  const blockers = (id: string, trail: string[] = []): string[] => {
    const names: string[] = [];
    for (const pred of preds[id] ?? []) {
      if (!blocks(pred) || trail.includes(pred)) continue;
      const found = STRUCTURAL.includes(nodes[pred].kind) ? blockers(pred, [...trail, id]) : [title(nodes[pred])];
      for (const name of found) if (!names.includes(name)) names.push(name);
    }
    return names;
  };

  for (let changed = true, pass = 0; changed && pass <= seen.length; pass += 1) {
    changed = false;
    for (const id of seen) {
      const node = nodes[id];
      if (node.kind === 'trigger' || !(preds[id] ?? []).some(blocks)) continue;
      if (STRUCTURAL.includes(node.kind)) {
        if (!heldStructural.has(id)) {
          heldStructural.add(id);
          changed = true;
        }
        continue;
      }
      const current = results[id];
      if (!current || current.st === 'fail' || KEEPS_OWN_RESULT.includes(node.kind)) continue;
      const waitingOn = copy.waitingOn(blockers(id));
      const m = node.kind === 'collect' ? `${askText(node, rec, ctx)}. ${waitingOn}` : waitingOn;
      if (current.st !== 'wait' || current.m !== m) {
        results[id] = { st: 'wait', short: copy.waiting, m, ...(node.kind === 'collect' ? { sees: seesFor(node, 'wait') } : {}) };
        changed = true;
      }
    }
  }
  return Array.from(heldStructural);
}

/** Engine §10. */
export function simulateTest(wf: Workflow, sample: SampleRecord, ctx0: EngineContext, options: TestRunOptions = {}): TestRun {
  const ctx = options.asOf ? { ...ctx0, asOf: options.asOf } : ctx0;
  const nodes = wf.draft.nodes;

  let rec = { ...sample } as Rec;
  if (options.applyEdit && sample.edit) rec = { ...rec, ...sample.edit.set };
  if (sample.conflict && options.conflictChoice) rec.total_value = sample.conflict[options.conflictChoice].total;
  const rec0 = planRecord(wf, rec);

  const basis = applyBasis(wf, rec0);
  const walked = walkWorkflow(nodes, basis ? { ...rec0, total_value: basis.v } : rec0, ctx);
  const plan = needsPlan(wf, nodes, rec, walked.seen, ctx) ? planApprovals(wf, rec, ctx) : null;
  const walk = plan ? plan.walk : walked;

  const decided = sample.decided;
  const edited = !!(options.applyEdit && sample.edit);
  const before = plan && decided ? (edited ? planApprovals(wf, sample, ctx) : plan) : null;
  const changed = edited ? (sample.edit?.decreased ?? []) : [];
  const statusOf = before && decided ? (item: StageItem) => itemStatus(item, before, decided, changed, nodes) : undefined;

  const steps: Record<string, StepResult> = {};
  for (const id of walk.seen) {
    const node = nodes[id];
    const result = stepResult(node, rec0, plan, wf, ctx, statusOf);
    if (result) steps[id] = result;
  }
  const heldBack = holdTheLine(nodes, walk.seen, steps, rec0, ctx);

  const ruleOnly = (plan?.stages ?? []).filter((stage) => !stage.items.some((item) => item.nodeId !== null));
  return {
    workflowId: wf.id,
    sampleId: sample.id,
    rec: rec as RecordData,
    walk,
    steps,
    heldBack,
    plan,
    inactive: wf.status === 'inactive',
    workflow: wf,
    sample,
    options,
    ruleRounds: ruleOnly.map((stage) => ({ line: roundLine(stage, ctx, statusOf), tasks: taskLines([stage], ctx) })),
    removedByEdit: plan && before && edited && decided ? removedByEdit(before, plan, decided, ctx) : [],
  };
}
