import type { EngineContext } from '../model/context';
import type { SampleRecord } from '../model/records';
import type { ApprovalPlan, RoundLine, TestRun, TestRunOptions, TestRunResult } from '../model/results';
import type { Workflow } from '../model/workflow';
import { copy, curl } from './copy';
import { planRecord } from './plan';
import { roleName } from './resolve';
import { selectWorkflow } from './selection';
import { simulateTest } from './simulate';
import { title } from './text';

type TestStep = TestRunResult['steps'][number];

/** Engine §11 item 4: the "Try a record" rows, in file order. */
export function samplesFor(wf: Pick<Workflow, 'records' | 'event'>, ctx: Pick<EngineContext, 'samples'>) {
  return ctx.samples
    .filter((sample) => sample.record === wf.records[0] && sample.event === wf.event)
    .map((sample) => ({ id: sample.id, title: sample.title.replace(' (approved)', ''), note: sample.note ?? '' }));
}

const asRound = (line: RoundLine, n: number) => ({ n, people: line.people, notes: line.notes });

/** Engine §11.1. */
function summaryText(run: TestRun, plan: ApprovalPlan, ctx: EngineContext): string {
  const { sample, options, workflow } = run;
  if (sample.conflict && !options.conflictChoice) return `${copy.conflictSummary}.`;
  const nodes = workflow.draft.nodes;

  const bits: string[] = [plan.stages.length > 0 ? copy.rounds(plan.stages.length) : copy.noOneApproves];
  if (plan.rules.length > 0 && !plan.rejected && !plan.stopped) bits.push(copy.rulesAdd(plan.rules.map((rule) => rule.name)));
  for (const hit of plan.needInfo) bits.push(copy.needsInformationBit(hit.fields, title(nodes[hit.nodeId]), hit.owner));
  if (plan.auto) bits.push(copy.approvedNoOneActed);
  if (plan.rejected) {
    bits.push(copy.rejectedAt(plan.rejected.by, (workflow.onReject?.recipients ?? []).map((role) => roleName(ctx, role))));
  }
  if (plan.stopped) bits.push(copy.stoppedAt(plan.stopped.by, plan.stopped.told));
  if (plan.paused) bits.push(copy.partPaused);
  return `${bits.join('. ')}.`;
}

function chosenLine(sample: SampleRecord, options: TestRunOptions): string | null {
  if (!sample.conflict || !options.conflictChoice) return null;
  const chosen = sample.conflict[options.conflictChoice];
  const other = sample.conflict[options.conflictChoice === 'a' ? 'b' : 'a'];
  return copy.conflictChosen(chosen.v, chosen.by, other.by);
}

/** Engine §11 item 3, in order. */
function noticesFor(run: TestRun, plan: ApprovalPlan, ctx: EngineContext): string[] {
  const { sample, options, workflow, rec } = run;
  const notices: string[] = [];
  if (plan.basis) notices.push(plan.basis.m);
  const chosen = chosenLine(sample, options);
  if (chosen) notices.push(chosen);
  if (plan.flags.length > 0 && !plan.rejected && !plan.stopped) {
    notices.push(copy.markedLine(plan.flags.map((flag) => curl(ctx.catalog.FIELD[flag.field]?.l ?? flag.field))));
  }
  const winner = selectWorkflow(planRecord(workflow, rec), ctx.workflows).workflow;
  if (winner && winner.id !== workflow.id) notices.push(copy.forRealRequests(winner.name));
  return notices;
}

/** Engine §11: the view the Test panel shows. Properties that do not apply are absent. */
export function composeTest(run: TestRun, ctx: EngineContext): TestRunResult {
  const { plan, workflow, sample, options, walk, steps } = run;
  const nodes = workflow.draft.nodes;

  const view: TestRunResult = {
    summary: plan ? summaryText(run, plan, ctx) : null,
    path: walk.decisions.map((decision) => copy.decisionChip(title(nodes[decision.nodeId]), decision.label)).join(' | '),
    steps: walk.seen
      .filter((id) => steps[id])
      .map((id) => {
        const result = steps[id];
        const step: TestStep = { id, title: title(nodes[id]), status: result.short, message: result.m };
        if (result.sees !== undefined) step.workerSees = result.sees;
        if (result.roundLines && result.roundLines.length > 0) step.rounds = result.roundLines.map((line, i) => asRound(line, i + 1));
        if (result.tasks && result.tasks.length > 0) step.tasks = result.tasks;
        return step;
      }),
  };

  if (run.inactive) view.inactiveNotice = copy.inactiveNotice;

  if (plan) {
    const notices = noticesFor(run, plan, ctx);
    if (notices.length > 0) view.notices = notices;
    if (sample.conflict) {
      if (options.conflictChoice) {
        view.undoButton = copy.undo;
      } else {
        const { field, a, b } = sample.conflict;
        view.conflict = {
          badge: copy.conflictBadge,
          message: copy.conflictMessage(field, a.v, a.by, b.v, b.by),
          choices: [copy.conflictUse(a.v), copy.conflictUse(b.v)],
        };
      }
    }
    if (sample.edit) view.editButton = options.applyEdit ? copy.undoEdit : copy.tryEdit(sample.edit.label);
    if (run.ruleRounds.length > 0) {
      view.fromApprovalRules = run.ruleRounds.map(({ line, tasks }, i) => ({
        ...asRound(line, i + 1),
        ...(tasks.length > 0 ? { tasks } : {}),
      }));
    }
    if (run.removedByEdit.length > 0) view.removedByEdit = run.removedByEdit;
  }
  return view;
}

export interface TestRunInput {
  workflow: Workflow;
  record: SampleRecord;
  ctx: EngineContext;
  options?: TestRunOptions;
}

/** 06 §1.4: the one function Part A calls. */
export const runTest = ({ workflow, record, ctx, options }: TestRunInput): TestRunResult =>
  composeTest(simulateTest(workflow, record, ctx, options), ctx);
