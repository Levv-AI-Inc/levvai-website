import { fitsPlan } from '../engine/auto';
import { copy } from '../engine/copy';
import { isCheck, helperMessage } from '../engine/checks';
import { previousApprovers } from '../engine/changes';
import { briefFor, needInfoOwner, needInfoPerson, planApprovals, planFailedCheck, seatAsked } from '../engine/plan';
import { groupMembers, personLabel, resolveRoleHolder } from '../engine/resolve';
import { chaseDefaults, chaseTo, dispOf, title } from '../engine/text';
import { decideIf } from '../engine/walk';
import { conditionsOutcome } from './helpers';
import type { RecordData } from '../model/records';
import type { Stage, StageItem } from '../model/results';
import { publishedFacts } from '../engine/selection';
import type { ApprovalPlan, PlanFloor } from '../model/results';
import type { StepRun, WorkItem } from '../model/runtime';
import type { ApproveNode, CollectNode, CondNode, DwNode, NotifyNode, Out, PolicyNode, RunWorkflowNode, SystemNode, TaskNode, WaitNode, WfNode } from '../model/workflow';
import { runtimeCopy as rc } from './copy';
import { changedFields, levvValue, matchKeyFor, snakeCase } from './records';
import type { RunSession } from './session';
import { addDays, addHours, addMinutes, dateTimeText, isDue, resolveWaitUntil } from './time';
import { COMPANY_ZONE } from './zone';

/** 05 §3.2, §3.4: one executor per step kind, and the loop that starts what is ready. */

const RULE_PREFIX = 'rule:';
const RETRY_MINUTES = [5, 20, 60];
const RESUBMIT_DAYS = 5;
const LOOP_GUARD = 500;
const OFF_PATH = 'off_path';

const OPEN: StepRun['status'][] = ['active', 'waiting', 'failed'];
const FINISHED: StepRun['status'][] = ['done', 'skipped'];

export const isRuleStep = (id: string): boolean => id.startsWith(RULE_PREFIX);
const nodeOf = (s: RunSession, id: string): WfNode | undefined => s.env.nodes[id];

export const stepName = (s: RunSession, id: string): string => {
  if (isRuleStep(id)) return id.slice(RULE_PREFIX.length);
  const node = nodeOf(s, id);
  return node ? title(node) : id;
};

/**
 * The exits a re-plan holds to. `run`: everything the run has decided, for a plan of the run as it stands. `record`: only
 * what no record can change (a System step's Failed exit), for an edit, which is allowed to move a decided If (notes, M7).
 */
function takenSoFar(s: RunSession, mode: 'run' | 'record'): Record<string, string[]> {
  const taken: Record<string, string[]> = {};
  for (const [id, step] of Object.entries(s.run.steps)) {
    if (!FINISHED.includes(step.status) || !step.taken || step.outcome === OFF_PATH) continue;
    if (mode === 'run' || nodeOf(s, id)?.kind === 'system') taken[id] = step.taken;
  }
  return taken;
}

const planNow = (s: RunSession, mode: 'run' | 'record'): ApprovalPlan =>
  planApprovals(s.env.wf, s.rec0() as RecordData, s.env.ctx, { nodes: s.env.nodes, taken: takenSoFar(s, mode), floor: s.run.floor });

export function replan(s: RunSession, mode: 'run' | 'record' = 'record'): void {
  s.run.plan = planNow(s, mode);
  s.changed = true;
}

/** Starts a step's clock: seq is the run order the step list shows (05 §6.2). */
function markStarted(s: RunSession, id: string, status: StepRun['status']): StepRun {
  const step = s.step(id);
  if (step.status === 'pending') {
    step.startedAt = s.env.now;
    step.seq = s.run.nextSeq ?? 1;
    s.run.nextSeq = (step.seq ?? 0) + 1;
  }
  step.status = status;
  s.changed = true;
  return step;
}

function clearTimers(step: StepRun): void {
  delete step.remindAt;
  delete step.escalateAt;
  delete step.reminded;
  delete step.escalatedTo;
  delete step.assignees;
}

/** Done or skipped. `taken` is what the rest of the run follows. Anything still open on the step (a Chaser copy) is closed. */
function finish(s: RunSession, id: string, status: 'done' | 'skipped', outcome: string | undefined, taken: string[]): void {
  const step = s.step(id);
  if (step.status === 'pending') markStarted(s, id, status);
  step.status = status;
  step.completedAt = s.env.now;
  if (outcome !== undefined) step.outcome = outcome;
  step.taken = taken;
  clearTimers(step);
  delete step.resubmit;
  delete step.deferred;
  delete step.held;
  for (const item of s.openItems(id)) s.closeItem(item, 'cancelled');
  s.changed = true;
}

const firstOut = (node: WfNode | undefined): string[] => (node?.outs?.[0] ? [node.outs[0].key] : []);

/** An Approve step a resubmit couldn't remove, with no exit leading to it now (`PlanFloor`). What's after it was on the old branch, so answering it leads nowhere. */
const keptOffPath = (s: RunSession, id: string): boolean => Boolean(s.run.floor?.steps.includes(id)) && !s.run.plan.walk.seen.includes(id);

/** What goes out of Levv. These wait for a kept approver, wherever they are on the line, because that approver may yet say no. */
const SENDS_OUT: WfNode['kind'][] = ['system', 'notify', 'runwf'];

/** The nodes the run has reached: Start, whatever a finished step's taken exits lead to, and anything a resubmit kept. */
export function reachedSteps(s: RunSession): Set<string> {
  const reached = new Set<string>(['T']);
  const queue = ['T'];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const step = s.run.steps[id];
    if (!step || !FINISHED.includes(step.status)) continue;
    for (const key of step.taken ?? []) {
      const out = (nodeOf(s, id)?.outs ?? []).find((candidate) => candidate.key === key);
      if (out && !reached.has(out.to)) {
        reached.add(out.to);
        queue.push(out.to);
      }
    }
  }
  for (const id of s.run.floor?.steps ?? []) reached.add(id);
  return reached;
}

function reaches(nodes: Record<string, WfNode>, from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const out of nodes[id]?.outs ?? []) {
      if (out.to === to) return true;
      if (!seen.has(out.to)) {
        seen.add(out.to);
        queue.push(out.to);
      }
    }
  }
  return false;
}

const canReach = (s: RunSession, from: string, to: string): boolean => reaches(s.env.nodes, from, to);

/**
 * An approval on the way to this step is waiting for an answer again (item G), or one a resubmit kept hasn't been answered:
 * nothing goes out to a system until it has one.
 */
const heldByApproval = (steps: Record<string, StepRun>, nodes: Record<string, WfNode>, id: string, kept: string[] = []): boolean =>
  Object.entries(steps).some(([other, step]) => {
    if (other === id || nodes[other]?.kind !== 'appr') return false;
    if (step.status === 'waiting' && reaches(nodes, other, id)) return true;
    return kept.includes(other) && (step.status === 'waiting' || step.status === 'pending') && !reaches(nodes, id, other);
  });

/**
 * 05 §3.2 step 2. A step where branches meet waits for every branch that was visited, including one still undecided: so
 * it is held by anything reached and unfinished that could still lead to it. A branch that ends by itself holds nothing.
 */
function readySteps(s: RunSession, reached: Set<string>): string[] {
  const unfinished = Array.from(reached).filter((id) => !FINISHED.includes(s.step(id).status) && nodeOf(s, id)?.kind !== 'end');
  const keptOpen = unfinished.some((id) => keptOffPath(s, id));
  const sendsOut = (id: string): boolean => SENDS_OUT.includes(nodeOf(s, id)?.kind as WfNode['kind']);
  return unfinished.filter((id) => {
    if (s.step(id).status !== 'pending' || (keptOpen && sendsOut(id))) return false;
    // A kept step isn't held up by what it holds up.
    return !unfinished.some((other) => other !== id && canReach(s, other, id) && !(keptOffPath(s, id) && sendsOut(other)));
  });
}

// ── Items and messages ───────────────────────────────────────────────────────────────────────────────────────────────

export const itemKey = (item: Pick<StageItem, 'roles' | 'cc' | 'failedCheckOf' | 'keptKey'>): string => `${item.roles.join('+')}${item.cc ? `@${item.cc}` : ''}${item.keptKey ? `~${item.keptKey}` : ''}`;

/** AGENTS rule 4: neither the person who raised it nor the worker ever decides it. */
const neverDecides = (s: RunSession, person: unknown): boolean => {
  const { requester, worker_name: worker } = s.record.data as Record<string, unknown>;
  return person === requester || person === worker;
};

/** Who is asked. 03 §6.8 falls back to all members when filtering leaves nobody, which can include those two, so they come off here as well. */
function peopleOf(s: RunSession, item: StageItem): string[] {
  const role = item.roles[0];
  if (!item.any && role.startsWith('g:')) return groupMembers(s.env.ctx, role.slice(2), s.rec0()).filter((member) => !neverDecides(s, member));
  return item.people.filter((person) => person !== '—' && !neverDecides(s, person));
}

const onBehalfText = (s: RunSession, item: StageItem): string | undefined => {
  if (!item.onBehalfOf) return undefined;
  const { role, person } = item.onBehalfOf;
  return role ? `${personRole(s, role)} (${person})` : person;
};

const personRole = (s: RunSession, role: string): string => s.env.ctx.people.ROLES[role]?.n ?? role;

function chaserTimes(s: RunSession, id: string): { remind: number; sla: number } {
  const node = nodeOf(s, id);
  return node && (node.kind === 'appr' || node.kind === 'task' || node.kind === 'collect') ? chaseDefaults(node) : { remind: 24, sla: 48 };
}

/** 05 §3.4.10: when the step starts waiting on a person. */
function startChaser(s: RunSession, id: string): void {
  const step = s.step(id);
  if (step.remindAt) return;
  const { remind, sla } = chaserTimes(s, id);
  step.remindAt = addHours(s.env.now, remind);
  step.escalateAt = addHours(s.env.now, sla);
}

const refreshAssignees = (s: RunSession, id: string): void => {
  const people = Array.from(new Set(s.openItems(id).filter((item) => !item.chaserOf).map((item) => item.assignee)));
  const step = s.step(id);
  if (people.length > 0) step.assignees = people;
  else delete step.assignees;
};

function openForPerson(s: RunSession, id: string, kind: WorkItem['kind'], person: string, item: StageItem, node: WfNode | undefined): WorkItem {
  const rec0 = s.rec0();
  const brief = briefFor(item, s.run.plan, rec0, s.env.wf, s.env.ctx, s.env.nodes);
  const opened = s.addItem({
    kind,
    nodeId: id,
    assignee: person,
    key: itemKey(item),
    stepName: stepName(s, id),
    brief,
    ...(onBehalfText(s, item) ? { onBehalfOf: onBehalfText(s, item) } : {}),
    remindAt: s.step(id).remindAt,
    escalateAt: s.step(id).escalateAt,
    dueAt: s.step(id).escalateAt,
  });
  const title = opened.recordTitle as string;
  if (kind === 'approve') {
    s.send({ to: person, subject: rc.mail.approvalSubject(title), body: rc.mail.approvalBody(brief, s.link(opened.id)) });
  } else {
    const reason = item.why ?? (node ? stepName(s, id) : opened.stepName ?? '');
    s.send({ to: person, subject: rc.mail.decisionSubject(stepName(s, id)), body: rc.mail.decisionBody(reason, s.link(opened.id)) });
  }
  return opened;
}

/** Fix-and-resubmit, for a rejection, a send-back or a path that rejects (05 §3.4.3). */
function openResubmit(s: RunSession, id: string, kind: 'rejected' | 'sent_back' | 'path', comment: string, decidedBy: string): void {
  const requester = (s.record.data as Record<string, unknown>).requester as string | undefined;
  if (!requester) {
    finalReject(s, id, comment);
    return;
  }
  for (const item of s.openItems(id)) s.closeItem(item, 'cancelled');
  const step = s.step(id);
  clearTimers(step);
  step.status = 'waiting';
  delete step.completedAt;
  delete step.taken;
  const by = addDays(s.env.now, s.env.wf.onReject?.resubmitDays ?? RESUBMIT_DAYS);
  const what = rc.resubmitTitle((s.record.data as Record<string, unknown>).title as string ?? s.record.id);
  const item = s.addItem({ kind: 'resubmit', nodeId: id, assignee: requester, stepName: stepName(s, id), what, dueAt: by, ...(comment ? { comment } : {}) });
  step.resubmit = { kind, by, itemId: item.id, comment, decidedBy };
  step.assignees = [requester];
  s.send({ to: requester, subject: rc.mail.taskSubject(what), body: rc.mail.taskBody(item.recordTitle as string, s.record.id, s.link(item.id)) });
}

/** 05 §3.2 step 4: `onReject.recipients` on a final rejection (03 §15 item 5). */
export function finalReject(s: RunSession, id: string, comment: string): void {
  const { run } = s;
  const name = stepName(s, id);
  cancelOpen(s);
  run.status = 'rejected';
  run.endedAt = s.env.now;
  s.log('rejected', rc.rejectedAt(name), { nodeId: id });
  const title = ((s.record.data as Record<string, unknown>).title as string | undefined) ?? s.record.id;
  for (const role of s.env.wf.onReject?.recipients ?? []) {
    for (const to of peopleForRole(s, role)) s.send({ to, subject: rc.mail.rejectedSubject(title), body: rc.mail.rejectedBody(title, name, comment) });
  }
}

function peopleForRole(s: RunSession, role: string): string[] {
  const rec = s.rec0();
  if (role.startsWith('g:')) return groupMembers(s.env.ctx, role.slice(2), rec);
  const { person } = resolveRoleHolder(role, rec, s.env.ctx);
  return person ? [person] : [];
}

/** Steps that are open become cancelled and work items go with them. Steps that haven't started stay as they are (RT-04). */
export function cancelOpen(s: RunSession): void {
  for (const step of Object.values(s.run.steps)) {
    if (!OPEN.includes(step.status)) continue;
    step.status = 'cancelled';
    delete step.retry;
    delete step.resubmit;
    delete step.deferred;
    clearTimers(step);
  }
  for (const item of s.items) {
    if (item.status === 'open' || item.status === 'held') s.closeItem(item, 'cancelled');
  }
  s.changed = true;
}

// ── Approve ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function stagesOf(s: RunSession, id: string): Stage[] {
  if (isRuleStep(id)) return s.run.plan.stages.filter((stage) => stage.label === id.slice(RULE_PREFIX.length) && !stage.items.some((item) => item.nodeId));
  const planned = s.run.plan.stages.filter((stage) => stage.items.some((item) => item.nodeId === id));
  const node = nodeOf(s, id);
  if (planned.length > 0 || node?.kind !== 'appr' || !node.failOf) return planned;
  // A failed check's escalation must be answered (03 §15 item 6). An approval given before it failed can't cover it, however 03 §6.10 merges the plan.
  const asked = planFailedCheck({ ...node, kind: 'collect', failRoles: node.roles, failMode: 'all' } as unknown as CollectNode, s.rec0(), s.env.wf, s.env.ctx, s.run.plan.stages[0]?.items[0]?.checks ?? []);
  for (const stage of asked) for (const item of stage.items) delete item.failedCheckOf;
  return asked;
}

function keySatisfied(s: RunSession, id: string, item: StageItem): boolean {
  const entry = s.step(id).approvals?.[itemKey(item)];
  if (!entry || entry.by.length === 0) return false;
  const role = item.roles[0];
  if (!item.any && role.startsWith('g:') && s.env.ctx.people.GROUPS[role.slice(2)]?.mode === 'all') {
    const members = groupMembers(s.env.ctx, role.slice(2), s.rec0()).filter((member) => !neverDecides(s, member));
    return members.length > 0 && members.every((member) => entry.by.includes(member));
  }
  return true;
}

const taskKey = (ruleId: string): string => `task:${ruleId}`;

function roundSatisfied(s: RunSession, id: string, stage: Stage): boolean {
  const tasks = s.step(id).tasksDone ?? [];
  return stage.items.every((item) => keySatisfied(s, id, item)) && stage.tasks.every((task) => tasks.includes(taskKey(task.ruleId)));
}

/** Once per step until something resets it: a paused item is looked at again on every re-plan. */
function logOnce(s: RunSession, id: string, type: string, m: string): void {
  const step = s.step(id);
  if (step.logged?.includes(m)) return;
  step.logged = [...(step.logged ?? []), m];
  s.log(type, m, { nodeId: id });
}

/**
 * Whoever the plan no longer asks is told and let go (03 §8.4 "withdrawn, approver told"). A Chaser copy stands in for its
 * original, so it goes with it. This doesn't wait for the run to be running: anyone left open could still decide.
 */
function letGo(s: RunSession, id: string, stage: Stage | undefined, tasksStillAsked: string[]): void {
  for (const open of s.openItems(id)) {
    if (open.kind === 'resubmit') continue;
    if (open.key && open.key.startsWith('task:')) {
      if (tasksStillAsked.includes(open.key)) continue;
    } else {
      const parent = open.chaserOf ? s.items.find((item) => item.id === open.chaserOf) : open;
      const wanted = stage?.items.find((item) => itemKey(item) === parent?.key);
      if (wanted && !wanted.paused && peopleOf(s, wanted).includes(parent?.assignee as string)) continue;
    }
    s.closeItem(open, 'cancelled');
    s.send({ to: open.assignee, subject: rc.mail.withdrawnSubject(stepName(s, id), open.recordTitle as string), body: rc.mail.withdrawnBody(open.recordTitle as string) });
  }
  refreshAssignees(s, id);
}

/** Brings who is open on a step in line with the plan, whatever the run's status. Only asking new people waits for `running`. */
function withdrawOutdated(s: RunSession, id: string): void {
  const step = s.step(id);
  if (step.resubmit || step.deferred) return;
  const node = nodeOf(s, id);
  if (node?.kind === 'collect' && step.status === 'failed') {
    letGo(s, id, failedStages(s, node)[0], []);
    return;
  }
  if (!isRuleStep(id) && node?.kind !== 'appr') return;
  const stages = stagesOf(s, id);
  const current = stages.find((stage) => !roundSatisfied(s, id, stage));
  letGo(s, id, current, stages.flatMap((stage) => stage.tasks.map((task) => taskKey(task.ruleId))));
}

function askRound(s: RunSession, id: string, stage: Stage, node: ApproveNode | undefined): void {
  const kind: WorkItem['kind'] = node?.escalation ? 'escalation' : 'approve';
  letGo(s, id, stage, s.run.plan.stages.flatMap((one) => one.tasks.map((task) => taskKey(task.ruleId))));

  const asked: string[] = [];
  let firstRound = false;
  for (const item of stage.items) {
    if (keySatisfied(s, id, item)) continue;
    if (item.paused) {
      logOnce(s, id, 'paused_step', rc.pausedStep(item.pausedWhy ?? ''));
      continue;
    }
    const answered = s.step(id).approvals?.[itemKey(item)]?.by ?? [];
    if (peopleOf(s, item).length === 0) {
      // Nobody left to ask: it waits. It is never approved for want of someone (05 §3.4.3).
      logOnce(s, id, 'paused_step', rc.pausedStep(stepName(s, id)));
      continue;
    }
    for (const person of peopleOf(s, item)) {
      if (answered.includes(person)) continue;
      if (s.openItems(id).some((open) => open.key === itemKey(item) && open.assignee === person && !open.chaserOf)) continue;
      if (!s.step(id).remindAt) {
        startChaser(s, id);
        firstRound = true;
      }
      openForPerson(s, id, kind, person, item, node);
      asked.push(person);
    }
  }
  for (const task of stage.tasks) {
    if ((s.step(id).tasksDone ?? []).includes(taskKey(task.ruleId))) continue;
    if (s.openItems(id).some((open) => open.key === taskKey(task.ruleId))) continue;
    if (!s.step(id).remindAt) startChaser(s, id);
    const opened = s.addItem({ kind: 'task', nodeId: id, assignee: task.person, key: taskKey(task.ruleId), stepName: task.title, what: task.title, remindAt: s.step(id).remindAt, escalateAt: s.step(id).escalateAt, dueAt: s.step(id).escalateAt });
    s.send({ to: task.person, subject: rc.mail.taskSubject(task.title), body: rc.mail.taskBody(opened.recordTitle as string, s.record.id, s.link(opened.id)) });
  }
  if (firstRound) s.log('step_started', rc.stepStarted(stepName(s, id)), { nodeId: id });
  if (asked.length > 0) s.log('asked', rc.asked(asked, node?.escalation ? 'decide' : 'approve'), { nodeId: id });
  refreshAssignees(s, id);
}

function nextOf(s: RunSession, id: string): string[] {
  return keptOffPath(s, id) ? [] : firstOut(nodeOf(s, id));
}

/** The step that asks a role this step doesn't ask itself: the item 03 §6.10 merged it into. A rule's item is asked by the step whose round it joined. */
function askedElsewhere(s: RunSession, nodeId: string, role: string): string | null {
  for (const stage of s.run.plan.stages) {
    for (const item of stage.items) {
      if (item.nodeId === nodeId || !(item.roles.includes(role) || (item.also ?? []).includes(role))) continue;
      return item.nodeId ?? stage.items.find((other) => other.nodeId)?.nodeId ?? `${RULE_PREFIX}${stage.label}`;
    }
  }
  return null;
}

/** 05 §3.4.3 "Covered", only when the plan positively says so: every role this step would ask is asked by a step named here, or isn't asked again. */
function coveringSteps(s: RunSession, node: ApproveNode): string[] | null {
  const notAskedAgain = s.run.plan.skipped.filter((entry) => entry.nodeId === node.id).map((entry) => entry.role);
  const outstanding = node.roles.filter((role) => !notAskedAgain.includes(role));
  const covering = outstanding.map((role) => askedElsewhere(s, node.id, role));
  if (outstanding.length === 0 || covering.some((owner) => owner === null)) return null;
  // Truly ahead of it, or it can't answer first: a step this one leads to is waiting for this one (item E). That's no cover at all.
  if (covering.some((owner) => canReach(s, node.id, owner as string))) return null;
  return Array.from(new Set(covering as string[]));
}

/** Does the plan say why nobody is asked? Fail closed: anything else is not a reason, and the step can't finish on it. */
function planAccountsFor(s: RunSession, node: ApproveNode): boolean {
  if (s.run.plan.notNeeded.some((entry) => entry.nodeId === node.id)) return true;
  const notAskedAgain = s.run.plan.skipped.filter((entry) => entry.nodeId === node.id).map((entry) => entry.role);
  return node.roles.every((role) => notAskedAgain.includes(role)) || coveringSteps(s, node) !== null;
}


/**
 * Brings an Approve step in line with the plan and what people have answered. Safe to call at any time: it only asks
 * who isn't asked yet, and only `running` opens anything new. Paused runs still record that a round is complete (RT-10).
 */
function settleApprove(s: RunSession, id: string): void {
  const step = s.step(id);
  const node = nodeOf(s, id) as ApproveNode | undefined;
  if (step.resubmit || step.deferred || FINISHED.includes(step.status)) return;
  const running = s.run.status === 'running';

  if (conflictOf(s)) {
    if (running) markStarted(s, id, 'waiting');
    return;
  }
  if (node && node.roles.length === 0) {
    // 03 §10.4: never approve a step nobody was chosen for.
    if (running) {
      markStarted(s, id, 'waiting');
      logOnce(s, id, 'paused_step', rc.pausedStep(copy.pickWhoApproves));
    }
    return;
  }

  let stages = stagesOf(s, id);
  // A step the plan has nothing to say about: the plan is stale, so look again from where the run actually is and what the record says now.
  if (stages.length === 0 && node && running && !planAccountsFor(s, node)) {
    replan(s, 'run');
    stages = stagesOf(s, id);
  }
  if (stages.length === 0) {
    if (!running) return;
    if (!node) {
      withdrawOpen(s, id);
      finish(s, id, 'skipped', undefined, []);
      return;
    }
    settleUnasked(s, id, node);
    return;
  }
  delete step.held;

  // The earliest round not answered, not just the next one: an edit can put someone new in a round that had finished.
  const round = stages.findIndex((stage) => !roundSatisfied(s, id, stage));
  if (round < 0) {
    finish(s, id, 'done', 'approved', nextOf(s, id));
    return;
  }
  if (!running) return;
  if ((step.round ?? 0) !== round) clearTimers(step);
  step.round = round;
  markStarted(s, id, 'waiting');
  askRound(s, id, stages[round], node);
}

function withdrawOpen(s: RunSession, id: string): void {
  for (const item of s.openItems(id)) s.send({ to: item.assignee, subject: rc.mail.withdrawnSubject(stepName(s, id), item.recordTitle as string), body: rc.mail.withdrawnBody(item.recordTitle as string) });
}

/** An Approve step with no one of its own to ask: the plan has to say why, or it waits. AGENTS rule 4: it is never approved for want of someone. */
function settleUnasked(s: RunSession, id: string, node: ApproveNode): void {
  const { plan } = s.run;
  const notNeeded = plan.notNeeded.find((entry) => entry.nodeId === id);
  const skipped = plan.skipped.filter((entry) => entry.nodeId === id);
  const covering = coveringSteps(s, node);
  if (notNeeded) {
    withdrawOpen(s, id);
    s.log('skipped', notNeeded.m.charAt(0).toUpperCase() + notNeeded.m.slice(1), { nodeId: id });
    finish(s, id, 'skipped', undefined, nextOf(s, id));
  } else if (node.roles.every((role) => skipped.some((entry) => entry.role === role))) {
    withdrawOpen(s, id);
    // 03 §15 item 5 "Not asked again → done"; 05 §3.4.3 says skipped; 03 outranks it (see the notes).
    s.log('not_asked_again', skipped.map((entry) => `${personRole(s, entry.role)}: ${entry.m}`).join('; '), { nodeId: id });
    finish(s, id, 'done', 'not_asked_again', nextOf(s, id));
  } else if (covering) {
    if (covering.some((owner) => s.step(owner).status !== 'done')) {
      withdrawOutdated(s, id);
      markStarted(s, id, 'waiting');
      logOnce(s, id, 'covered', copy.coveredMessage);
      return;
    }
    withdrawOpen(s, id);
    s.log('covered', copy.coveredMessage, { nodeId: id });
    finish(s, id, 'done', 'approved', nextOf(s, id));
  } else {
    withdrawOutdated(s, id);
    markStarted(s, id, 'waiting');
    s.step(id).held = true;
    logOnce(s, id, 'paused_step', rc.pausedStep(stepName(s, id)));
  }
}

/** Tests only: settle one Approve step, to prove what it does with a plan that can't account for it. */
export const settleForTest = settleApprove;

/** 03 §8.3: while two proposals are open, approvals wait and nothing is overwritten. */
export const conflictOf = (s: RunSession): { field: string; a: { by: string; v: string; total: number }; b: { by: string; v: string; total: number } } | null =>
  ((s.record.data as Record<string, unknown>).conflict as ReturnType<typeof conflictOf>) ?? null;

// ── Executors ────────────────────────────────────────────────────────────────────────────────────────────────────────

function startCond(s: RunSession, id: string, node: CondNode): void {
  const { taken, missing } = decideIf(node, s.recAdj(), s.env.ctx);
  if (missing) {
    markStarted(s, id, 'waiting');
    if (s.openItems(id).length > 0) return;
    const ctx = s.env.ctx;
    const rec = s.rec0();
    const fieldId = missing[0];
    const def = ctx.catalog.FIELD[fieldId];
    const labels = missing.map((field) => ctx.catalog.FIELD[field]?.l ?? field);
    const ownerRole = def?.owner;
    const person = ownerRole ? resolveRoleHolder(ownerRole, rec, ctx).person : needInfoPerson(fieldId, rec, ctx);
    const what = copy.needsInformationBit(labels, title(node), needInfoOwner(fieldId, rec, ctx));
    if (!person && !ownerRole) {
      // The only person it could ask can't answer this, and nobody is above them (item H). It says so and waits.
      s.step(id).held = true;
      logOnce(s, id, 'paused_step', rc.pausedStep(what));
      return;
    }
    delete s.step(id).held;
    const item = s.addItem({
      kind: 'needs_information',
      nodeId: id,
      assignee: person ?? (rec.requester as string),
      stepName: title(node),
      what,
      field: { id: fieldId, label: def?.l ?? fieldId, type: def?.t ?? 'text', ...(def?.o ? { options: def.o } : {}) },
    });
    s.step(id).assignees = [item.assignee];
    s.log('asked', rc.asked([item.assignee], `fill in ${labels.join(', ')}`), { nodeId: id });
    s.send({ to: item.assignee, subject: rc.mail.taskSubject(what), body: rc.mail.taskBody(item.recordTitle as string, s.record.id, s.link(item.id)) });
    return;
  }
  finish(s, id, 'done', taken[0]?.key, taken.map((out) => out.key));
}

async function startDw(s: RunSession, id: string, node: DwNode): Promise<void> {
  const ctx = s.env.ctx;
  const name = ctx.dws.DW[node.worker]?.n ?? node.worker;
  if (!isCheck(node.worker, ctx)) {
    if (s.env.adapters.isMock) markSimulated(s, id, rc.simulated.check(name));
    s.log('worker', `${name}: ${helperMessage(node.worker, ctx)}`, { nodeId: id });
    finish(s, id, 'done', 'done', firstOut(node));
    return;
  }
  // 03 §6.2: checks read the record as it is, not the basis-adjusted amount.
  const result = await s.env.adapters.checks.run(node.worker, s.rec0() as RecordData, {});
  if (s.env.adapters.isMock) markSimulated(s, id, rc.simulated.check(name));
  s.log('check', `${name} ${result.ok ? 'passed' : 'flagged'}: ${result.m}`, { nodeId: id });
  const key = result.ok ? 'pass' : 'flag';
  finish(s, id, 'done', key, [key]);
}

function markSimulated(s: RunSession, id: string, text: string): void {
  s.step(id).simulated = text;
  s.log('simulated', text, { nodeId: id });
}

function startPolicy(s: RunSession, id: string, node: PolicyNode): void {
  // 03 §9: "approves only when nobody is asked anywhere on the path", as things stand when it is reached.
  replan(s, 'run');
  if (s.run.plan.auto) {
    const receipt = node.receipt || copy.approvedAutomatically;
    s.log('auto', receipt, { nodeId: id });
    s.step(id).outcome = 'approved';
    if (node.fyi) {
      for (const to of peopleForRole(s, node.fyi)) s.send({ to, subject: rc.mail.fyiSubject(s.env.wf.name, title(node)), body: receipt });
    }
    finish(s, id, 'done', 'approved', firstOut(node));
    return;
  }
  s.log('skipped', rc.autoNotUsed, { nodeId: id });
  finish(s, id, 'skipped', undefined, firstOut(node));
}

function startNotify(s: RunSession, id: string, node: NotifyNode): void {
  const rec = s.record.data as Record<string, unknown>;
  const recordTitle = (rec.title as string | undefined) ?? s.record.id;
  const body = rc.mail.notifyBody(title(node), recordTitle, s.record.id, s.runLink());
  for (const role of node.recipients) {
    for (const to of peopleForRole(s, role)) s.send({ to, channel: node.channel || 'Email', subject: rc.mail.notifySubject(s.env.wf.name, title(node)), body });
  }
  finish(s, id, 'done', undefined, firstOut(node));
}

function startTask(s: RunSession, id: string, node: TaskNode): void {
  markStarted(s, id, 'waiting');
  const rec = s.rec0();
  const person = resolveRoleHolder(node.role, rec, s.env.ctx).person;
  if (person === null) {
    logOnce(s, id, 'paused_step', rc.pausedStep(personLabel(node.role, rec, s.env.ctx)));
    return;
  }
  startChaser(s, id);
  s.log('step_started', rc.stepStarted(title(node)), { nodeId: id });
  const item = s.addItem({ kind: 'task', nodeId: id, assignee: person, stepName: title(node), what: node.title, remindAt: s.step(id).remindAt, escalateAt: s.step(id).escalateAt, dueAt: s.step(id).escalateAt });
  s.step(id).assignees = [person];
  s.log('asked', rc.asked([person], 'do it'), { nodeId: id });
  s.send({ to: person, subject: rc.mail.taskSubject(node.title), body: rc.mail.taskBody(item.recordTitle as string, s.record.id, s.link(item.id)) });
}

/** 05 §3.6. Both a step's `gives` and how it is taken back. */
function writeLedger(s: RunSession, id: string, node: CollectNode | SystemNode | TaskNode, systemRef?: string): void {
  if (!node.gives) return;
  const workerKey = ((s.record.data as Record<string, unknown>).personal_email as string | undefined) ?? s.record.id;
  s.newLedger.push({
    id: s.env.newId('ll'),
    workerKey,
    runId: s.run.id,
    nodeId: id,
    gives: node.gives,
    disp: dispOf(node),
    ...(node.reverse ? { reverse: node.reverse } : {}),
    ...('reverseWhen' in node && node.reverseWhen ? { reverseWhen: node.reverseWhen } : {}),
    ...(node.reverseBy ? { reverseBy: node.reverseBy } : {}),
    ...(systemRef ? { systemRef } : {}),
    status: 'open',
    createdAt: s.env.now,
  });
  s.changed = true;
}

/** 05 §3.6: offboarding closes lines. Remove access and Close in HR system take the access; Return equipment the things. */
function closeLedger(s: RunSession, disp: 'remove' | 'return'): void {
  for (const line of s.ledger) {
    if (line.status === 'open' && line.disp === disp) {
      line.status = 'closed';
      line.closedAt = s.env.now;
      s.closedLedger.add(line.id);
      s.changed = true;
    }
  }
}

function startCollect(s: RunSession, id: string, node: CollectNode): void {
  markStarted(s, id, 'active');
  const rec = s.rec0();
  const person = resolveRoleHolder(node.from ?? 'worker', rec, s.env.ctx).person ?? copy.theWorker;
  s.log('step_started', rc.stepStarted(title(node)), { nodeId: id });
  s.log('asked', rc.askedFor(person, node.items), { nodeId: id });
  if (s.env.autocomplete) {
    // 05 §5.2: fulfilled immediately, so no collect item stays open.
    s.log('provided', rc.provided(person, node.items), { nodeId: id });
    s.step(id).received = node.items;
    return;
  }
  s.step(id).status = 'waiting';
  startChaser(s, id);
  const item = s.addItem({ kind: 'collect', nodeId: id, assignee: person, stepName: title(node), what: node.items.join(', '), items: node.items, remindAt: s.step(id).remindAt, escalateAt: s.step(id).escalateAt, dueAt: s.step(id).escalateAt });
  s.step(id).assignees = [person];
  s.send({ to: person, subject: rc.mail.collectSubject(title(node)), body: rc.mail.collectBody(node.items, item.recordTitle as string, s.record.id, s.link(item.id)) });
}

function openReview(s: RunSession, id: string, node: CollectNode): void {
  const holder = resolveRoleHolder(node.reviewer, s.rec0(), s.env.ctx).person ?? node.reviewer;
  const worker = (s.record.data as Record<string, unknown>).worker_name;
  // AGENTS rule 4: the worker never reviews. Their manager does, and with no manager it waits.
  const person = holder === worker ? managerOf(s, holder) : holder;
  const step = s.step(id);
  step.status = 'waiting';
  if (!person) {
    clearTimers(step);
    logOnce(s, id, 'paused_step', rc.pausedStep(stepName(s, id)));
    return;
  }
  clearTimers(step);
  startChaser(s, id);
  const what = (step.received ?? node.items).join(', ');
  const item = s.addItem({ kind: 'collect_review', nodeId: id, assignee: person, stepName: title(node), what, items: step.received ?? node.items, remindAt: step.remindAt, escalateAt: step.escalateAt, dueAt: step.escalateAt });
  step.assignees = [person];
  delete step.received;
  s.log('asked', rc.asked([person], 'review it'), { nodeId: id });
  s.send({ to: person, subject: rc.mail.taskSubject(what), body: rc.mail.taskBody(item.recordTitle as string, s.record.id, s.link(item.id)) });
}

function passCollect(s: RunSession, id: string, node: CollectNode): void {
  writeLedger(s, id, node);
  delete s.step(id).received;
  finish(s, id, 'done', 'verified', ['next']);
}

/** 05 §3.4.6 item 3. */
function failCollect(s: RunSession, id: string, node: CollectNode): void {
  const step = s.step(id);
  delete step.received;
  clearTimers(step);
  s.run.runOutcomes = { ...s.run.runOutcomes, [id]: 'fail' };
  replan(s);
  if (node.failTo === 'role' && node.outs.some((out) => out.key === 'fail')) {
    finish(s, id, 'done', 'fail', ['fail']);
    return;
  }
  step.status = 'failed';
  step.outcome = 'fail';
  settleFailedDecision(s, id, node);
}

function failedStages(s: RunSession, node: CollectNode): Stage[] {
  const checks = s.run.plan.stages[0]?.items[0]?.checks ?? [];
  return planFailedCheck(node, s.rec0(), s.env.wf, s.env.ctx, checks);
}

/** The people who decide after a failed check, and the carry-on when they have (05 §3.4.6 item 3). */
function settleFailedDecision(s: RunSession, id: string, node: CollectNode): void {
  const stages = failedStages(s, node);
  const stage = stages[0];
  const step = s.step(id);
  letGo(s, id, stage, []);
  if (!stage || stage.items.length === 0) {
    logOnce(s, id, 'paused_step', rc.pausedStep(copy.pickWhoApproves));
    return;
  }
  if (stage.items.every((item) => keySatisfied(s, id, item))) {
    passCollect(s, id, node);
    return;
  }
  if (s.run.status !== 'running') return;
  startChaser(s, id);
  const asked: string[] = [];
  for (const item of stage.items) {
    if (keySatisfied(s, id, item)) continue;
    if (item.paused) {
      logOnce(s, id, 'paused_step', rc.pausedStep(item.pausedWhy ?? ''));
      continue;
    }
    for (const person of peopleOf(s, item)) {
      if (s.openItems(id).some((open) => open.key === itemKey(item) && open.assignee === person)) continue;
      openForPerson(s, id, 'decide_failed_check', person, item, node);
      asked.push(person);
    }
  }
  if (asked.length > 0) s.log('asked', rc.asked(asked, 'decide'), { nodeId: id });
  refreshAssignees(s, id);
  step.status = 'failed';
}

async function verifyCollect(s: RunSession, id: string, node: CollectNode): Promise<void> {
  const step = s.step(id);
  const label = s.env.ctx.presets.CHECKERS[node.checker] ?? node.checker;
  const result = await s.env.adapters.verifier(node.checker, s.rec0()).verify({ items: step.received ?? [], record: s.rec0() as RecordData, pkg: node.pkg, step: node });
  if (s.env.adapters.isMock && node.verify !== 'person') markSimulated(s, id, rc.simulated.verifier(label));
  if (result.result === 'fail') {
    failCollect(s, id, node);
    return;
  }
  if (node.verify === 'person' || (node.verify === 'auto_person' && result.result === 'unsure')) {
    if (result.result === 'unsure') s.run.runOutcomes = { ...s.run.runOutcomes, [id]: 'unsure' };
    openReview(s, id, node);
    return;
  }
  passCollect(s, id, node);
}

function systemRequest(s: RunSession, id: string, node: SystemNode) {
  const rec = s.rec0();
  const fields: Record<string, unknown> = {};
  for (const [levvField, systemField] of node.sys.map) fields[systemField] = levvValue(levvField, rec);
  return {
    action: node.sys.action,
    object: node.sys.object,
    fields,
    match: matchKeyFor(node.system, node.sys.match, rec, s.env.ctx),
    bringBack: node.sys.read,
    idempotencyKey: `${s.run.id}:${id}`,
  };
}

async function callSystem(s: RunSession, id: string, node: SystemNode): Promise<void> {
  const step = s.step(id);
  const request = systemRequest(s, id, node);
  step.call = { action: request.action, object: request.object, match: request.match };
  const result = await s.env.adapters.system(node.system, s.rec0()).execute(request);
  if (result.status === 'done') {
    systemDone(s, id, node, result.ref, result.values);
  } else if (result.status === 'pending') {
    step.status = 'waiting';
    step.systemRef = result.ref;
    step.confirmBy = addHours(s.env.now, node.sys.waitH);
    delete step.retry;
  } else {
    systemFailed(s, id, node, result.error, result.retryable);
  }
  s.changed = true;
}

function systemDone(s: RunSession, id: string, node: SystemNode, ref: string, values: Record<string, unknown>): void {
  const step = s.step(id);
  if (s.env.adapters.isMock) markSimulated(s, id, rc.simulated.system(node.system));
  step.systemRef = ref;
  step.values = values;
  delete step.retry;
  delete step.confirmBy;
  s.log('system', rc.systemDone(node.system, node.sys.action, node.sys.object, ref), { nodeId: id });
  const brought: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(values)) {
    brought[snakeCase(field)] = value;
    s.log('system', rc.sentBackValue(node.system, field, value), { nodeId: id });
  }
  if (Object.keys(brought).length > 0) {
    const before = { ...(s.record.data as Record<string, unknown>) };
    s.setRecord(brought);
    followPlan(s, Object.keys(brought), before);
  }
  writeLedger(s, id, node, ref);
  if (node.preset === 'revoke' || node.preset === 'hrclose') closeLedger(s, 'remove');
  if (node.preset === 'ledger') {
    const open = s.ledger.filter((line) => line.status === 'open' && line.disp !== 'retain').length;
    s.log('system', `${title(node)}: ${open} ledger ${open === 1 ? 'line' : 'lines'} still open.`, { nodeId: id });
  }
  finish(s, id, 'done', 'done', ['next']);
}

/** 05 §3.4.7 items 2 and 5. */
function systemFailed(s: RunSession, id: string, node: SystemNode, error: string, retryable: boolean): void {
  const step = s.step(id);
  if (retryable && (step.retry?.count ?? 0) < RETRY_MINUTES.length) {
    const firstFailedAt = step.retry?.firstFailedAt ?? s.env.now;
    const count = step.retry?.count ?? 0;
    step.retry = { count, firstFailedAt, nextAt: addMinutes(firstFailedAt, RETRY_MINUTES[count]), error };
    step.status = 'active';
    return;
  }
  delete step.retry;
  delete step.confirmBy;
  applyOnFail(s, id, node, error);
}

function applyOnFail(s: RunSession, id: string, node: SystemNode, error: string): void {
  const step = s.step(id);
  const { onFail } = node.sys;
  const failedExit = node.outs.some((out) => out.key === 'failed');
  if (onFail === 'path' && failedExit) {
    s.log('system', rc.systemPaused(node.system, error), { nodeId: id });
    finish(s, id, 'done', 'failed', ['failed']);
    return;
  }
  if (onFail === 'pause') {
    step.status = 'failed';
    step.outcome = error;
    const { run } = s;
    run.status = 'paused';
    run.pausedBy = 'Levv';
    run.pausedAt = s.env.now;
    run.pauseReason = 'system_failure';
    s.log('paused', rc.systemPaused(node.system, error), { nodeId: id });
    const recordTitle = ((s.record.data as Record<string, unknown>).title as string | undefined) ?? s.record.id;
    s.send({ to: s.env.wf.owner, subject: rc.mail.systemPausedSubject(s.env.wf.name, recordTitle), body: rc.mail.systemPausedBody(node.system, error, s.runLink()) });
    return;
  }
  // 'task', and a Failed path with nowhere to go: someone fixes it by hand.
  const person = resolveRoleHolder(node.sys.failRole, s.rec0(), s.env.ctx).person ?? node.sys.failRole;
  const what = rc.fixSystem(node.system, error);
  step.status = 'waiting';
  const item = s.addItem({ kind: 'task', nodeId: id, assignee: person, stepName: title(node), what });
  step.assignees = [person];
  s.log('asked', rc.asked([person], 'do it'), { nodeId: id });
  s.send({ to: person, subject: rc.mail.taskSubject(what), body: rc.mail.taskBody(item.recordTitle as string, s.record.id, s.link(item.id)) });
}

function startWait(s: RunSession, id: string, node: WaitNode): void {
  const step = markStarted(s, id, 'waiting');
  const until = resolveWaitUntil(node.w, s.rec0(), s.env.now, { worker: s.rec0().worker_tz as string | undefined, company: COMPANY_ZONE });
  if (until) step.waitUntil = until;
  else logOnce(s, id, 'wait', `“${title(node)}” can’t end until the record has this date.`);
}

function startRunWorkflow(s: RunSession, id: string, node: RunWorkflowNode): void {
  const target = s.env.ctx.workflows.find((workflow) => workflow.id === node.target);
  if (target) {
    const facts = publishedFacts(target);
    s.raised.push({
      id: s.env.newId('ie'),
      source: 'levv',
      recordType: facts.records[0],
      recordId: s.record.id,
      event: facts.event,
      payload: { ...s.record.data },
      receivedAt: s.env.now,
      runIds: [],
      outcome: 'queued',
    });
    s.log('runwf', rc.startedWorkflow(facts.name), { nodeId: id });
  }
  finish(s, id, 'done', undefined, firstOut(node));
}

async function startStep(s: RunSession, id: string): Promise<void> {
  const node = nodeOf(s, id);
  if (!node) return;
  switch (node.kind) {
    case 'trigger':
      finish(s, id, 'done', undefined, firstOut(node));
      return;
    case 'parallel':
      finish(s, id, 'done', undefined, node.outs.map((out) => out.key));
      return;
    case 'cond':
      startCond(s, id, node);
      return;
    case 'plan': {
      const key = fitsPlan(s.recAdj()) ? 'in' : 'out';
      finish(s, id, 'done', key, [key]);
      return;
    }
    case 'dw':
      await startDw(s, id, node);
      return;
    case 'appr':
      // What's on the record now decides who is asked: it may have moved since the plan was made (a value brought back, an event).
      replan(s, 'run');
      settleApprove(s, id);
      return;
    case 'policy':
      startPolicy(s, id, node);
      return;
    case 'collect':
      startCollect(s, id, node);
      return;
    case 'task':
      startTask(s, id, node);
      return;
    case 'system':
      markStarted(s, id, 'active');
      s.log('step_started', rc.stepStarted(title(node)), { nodeId: id });
      await callSystem(s, id, node);
      return;
    case 'notify':
      startNotify(s, id, node);
      return;
    case 'wait':
      startWait(s, id, node);
      return;
    case 'runwf':
      startRunWorkflow(s, id, node);
      return;
    default:
      return;
  }
}

/** Open steps may have work to do that a pause held back or a re-plan created. Idempotent. */
async function settleOpen(s: RunSession): Promise<void> {
  for (const [id, step] of Object.entries(s.run.steps)) {
    if (s.run.status !== 'running') return;
    if (step.deferred) {
      applyDeferred(s, id);
      continue;
    }
    if (!OPEN.includes(step.status)) continue;
    const node = nodeOf(s, id);
    if (isRuleStep(id) || node?.kind === 'appr') {
      settleApprove(s, id);
    } else if (node?.kind === 'cond' && step.status === 'waiting' && !step.resubmit) {
      const { missing } = decideIf(node, s.recAdj(), s.env.ctx);
      if (!missing) {
        for (const item of s.openItems(id)) s.closeItem(item, 'done', { decision: 'provided' });
        startCond(s, id, node);
      } else if (s.openItems(id).length === 0) {
        // Nobody could be asked before (item H); someone may be now.
        startCond(s, id, node);
      }
    } else if (node?.kind === 'collect') {
      if (step.status === 'failed') settleFailedDecision(s, id, node);
      else if (step.received && !heldByApproval(s.run.steps, s.env.nodes, id, s.run.floor?.steps)) await verifyCollect(s, id, node);
    }
  }
}

function applyDeferred(s: RunSession, id: string): void {
  const step = s.step(id);
  const deferred = step.deferred;
  if (!deferred) return;
  delete step.deferred;
  applyNegative(s, id, deferred.decision, deferred.comment, deferred.by);
}

/** 05 §3.4.3 rejection rules, applied now or on Resume. */
function applyNegative(s: RunSession, id: string, decision: 'rejected' | 'sent_back' | 'stop', comment: string, by: string): void {
  const node = nodeOf(s, id);
  if (decision === 'stop') {
    stopByDecision(s, by, comment);
    return;
  }
  if (decision === 'sent_back') {
    openResubmit(s, id, 'sent_back', comment, by);
    return;
  }
  // 03 §15 item 6: an escalation's reject stops it, whatever `reject` says. See the notes.
  if (node?.kind !== 'appr' && !isRuleStep(id)) {
    finalReject(s, id, comment);
    return;
  }
  if (node?.kind === 'appr' && node.escalation) {
    finalReject(s, id, comment);
    return;
  }
  const behaviour = node?.kind === 'appr' ? node.reject ?? 'requester' : 'requester';
  if (behaviour === 'end') {
    finalReject(s, id, comment);
  } else if (behaviour === 'previous' && previousPersonStep(s, id)) {
    goBackTo(s, previousPersonStep(s, id) as string, id);
  } else {
    openResubmit(s, id, 'rejected', comment, by);
  }
}

/** Failed-check decision, reject (05 §3.4.6 item 3: "reject = stop the run"). */
function stopByDecision(s: RunSession, by: string, reason: string): void {
  cancelOpen(s);
  const { run } = s;
  run.status = 'stopped';
  run.stoppedBy = by;
  run.stoppedAt = s.env.now;
  run.stopReason = reason;
  run.endedAt = s.env.now;
  s.log('stopped', reason, { by });
}

const predecessorsTaken = (s: RunSession, id: string): string[] =>
  Object.keys(s.env.nodes).filter((candidate) => {
    const step = s.run.steps[candidate];
    return step?.taken?.some((key) => ((nodeOf(s, candidate)?.outs ?? []) as Out[]).some((out) => out.key === key && out.to === id));
  });

function previousPersonStep(s: RunSession, id: string): string | null {
  const queue = predecessorsTaken(s, id);
  const seen = new Set<string>(queue);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const kind = nodeOf(s, current)?.kind;
    if ((kind === 'appr' || kind === 'task' || kind === 'collect') && s.step(current).status === 'done') return current;
    for (const pred of predecessorsTaken(s, current)) {
      if (!seen.has(pred)) {
        seen.add(pred);
        queue.push(pred);
      }
    }
  }
  return null;
}

function resetStep(s: RunSession, id: string): void {
  const step = s.step(id);
  const { decisions, seq, startedAt } = step;
  s.run.steps[id] = { nodeId: id, status: 'pending', ...(decisions ? { decisions } : {}), ...(seq ? { seq } : {}), ...(startedAt ? { startedAt } : {}) };
  if (s.run.runOutcomes?.[id]) {
    const rest = { ...s.run.runOutcomes };
    delete rest[id];
    s.run.runOutcomes = rest;
  }
  for (const item of s.openItems(id)) s.closeItem(item, 'cancelled');
  s.changed = true;
}

/** Sets `from`, `to` and every step between them that the run went through back to not started. */
function goBackTo(s: RunSession, from: string, to: string): void {
  const between: string[] = [];
  const walkBack = (id: string, trail: string[]): void => {
    if (id === from) {
      between.push(...trail);
      return;
    }
    for (const pred of predecessorsTaken(s, id)) walkBack(pred, [...trail, id]);
  };
  walkBack(to, []);
  resetStep(s, from);
  for (const id of between) resetStep(s, id);
  resetStep(s, to);
  replan(s);
}

/** 05 §3.4.3: "When it comes back, the check or If before it runs again." */
function goBackToDecision(s: RunSession, id: string): void {
  const node = nodeOf(s, id);
  if (node?.kind === 'appr' && node.failOf) {
    goBackTo(s, node.failOf, id);
    return;
  }
  const queue = predecessorsTaken(s, id);
  const seen = new Set<string>(queue);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const kind = nodeOf(s, current)?.kind;
    if (kind === 'cond' || kind === 'dw') {
      goBackTo(s, current, id);
      return;
    }
    for (const pred of predecessorsTaken(s, current)) {
      if (!seen.has(pred)) {
        seen.add(pred);
        queue.push(pred);
      }
    }
  }
  resetStep(s, id);
  replan(s);
}

// ── Actions on work items ────────────────────────────────────────────────────────────────────────────────────────────

/** What a Chaser copy answers for: the item it was made from. */
const originalOf = (s: RunSession, item: WorkItem): WorkItem => (item.chaserOf ? s.items.find((other) => other.id === item.chaserOf) ?? item : item);

function closeWithCopies(s: RunSession, item: WorkItem, fields: Partial<WorkItem>): void {
  const original = originalOf(s, item);
  for (const other of s.items) {
    if (other.status === 'open' && (other.id === original.id || other.chaserOf === original.id)) s.closeItem(other, 'done', fields);
  }
}

function recordDecision(s: RunSession, id: string, by: string, decision: 'approved' | 'rejected' | 'sent_back', comment?: string): void {
  const step = s.step(id);
  const byId = s.accountBehind(by);
  step.decisions = [...(step.decisions ?? []), { by, ...(byId ? { byId } : {}), decision, at: s.env.now, ...(comment ? { comment } : {}) }];
}

/** RT-10: recorded now, applied on Resume. As on a running run the first answer wins, so anyone else asked on this step is let go now. */
function deferNegative(s: RunSession, id: string, decision: 'rejected' | 'sent_back' | 'stop', by: string, comment: string): void {
  s.step(id).deferred = { decision, by, comment };
  for (const open of s.openItems(id)) s.closeItem(open, 'cancelled');
  refreshAssignees(s, id);
}

/** POST /work-items/:id/decide for approve, escalation and decide_failed_check. */
export function decideApproval(s: RunSession, item: WorkItem, by: string, decision: 'approved' | 'rejected' | 'sent_back', comment?: string): void {
  const original = originalOf(s, item);
  const id = item.nodeId as string;
  recordDecision(s, id, by, decision, comment);
  closeWithCopies(s, item, { decision, ...(comment ? { comment } : {}) });
  const line = decision === 'approved' ? rc.approved(by) : decision === 'rejected' ? rc.rejected(by, comment ?? '') : rc.sentBack(by, comment ?? '');
  s.log('decision', line, { by, nodeId: id });

  if (decision === 'approved') {
    const step = s.step(id);
    const key = original.key as string;
    const entry = step.approvals?.[key];
    step.approvals = { ...step.approvals, [key]: { by: Array.from(new Set([...(entry?.by ?? []), by, original.assignee])), at: s.env.now } };
    // An "any one" item and a group of "any": the first answer counts for everyone asked.
    const stages = original.kind === 'decide_failed_check' ? failedStages(s, nodeOf(s, id) as CollectNode) : stagesOf(s, id);
    const planned = stages.flatMap((stage) => stage.items).find((candidate) => itemKey(candidate) === key);
    if (planned && keySatisfied(s, id, planned)) {
      for (const open of s.openItems(id)) if (open.key === key) s.closeItem(open, 'cancelled');
    }
    refreshAssignees(s, id);
    if (original.kind === 'decide_failed_check') settleFailedDecision(s, id, nodeOf(s, id) as CollectNode);
    else settleApprove(s, id);
    return;
  }
  const negative = original.kind === 'decide_failed_check' && decision === 'rejected' ? 'stop' : decision;
  if (s.run.status === 'paused') {
    deferNegative(s, id, negative, by, comment ?? '');
    return;
  }
  applyNegative(s, id, negative, comment ?? '', by);
}

/** Carries on from a task or a hand-over, whoever answered. */
export function completeTask(s: RunSession, item: WorkItem, by: string): void {
  const id = item.nodeId as string;
  const original = originalOf(s, item);
  closeWithCopies(s, item, { decision: 'done' });
  s.log('decision', rc.markedDone(by), { by, nodeId: id });
  const node = nodeOf(s, id);
  if (original.key?.startsWith('task:')) {
    const step = s.step(id);
    step.tasksDone = [...(step.tasksDone ?? []), original.key];
    settleApprove(s, id);
    return;
  }
  if (node?.kind === 'system') {
    // "Fix {system}": someone did it by hand.
    finish(s, id, 'done', 'done', firstOut(node));
    return;
  }
  if (node?.kind === 'task') {
    writeLedger(s, id, node);
    if (node.preset === 'recover') closeLedger(s, 'return');
    finish(s, id, 'done', 'done', firstOut(node));
  }
}

export function handOverItems(s: RunSession, item: WorkItem, by: string, items: string[]): void {
  const id = item.nodeId as string;
  closeWithCopies(s, item, { decision: 'done' });
  s.log('provided', rc.provided(by, items), { by, nodeId: id });
  const step = s.step(id);
  clearTimers(step);
  step.received = items;
  step.status = 'active';
  s.changed = true;
}

export function decideReview(s: RunSession, item: WorkItem, by: string, decision: 'verified' | 'not_verified', comment?: string): void {
  const id = item.nodeId as string;
  closeWithCopies(s, item, { decision, ...(comment ? { comment } : {}) });
  s.log('decision', decision === 'verified' ? rc.verified(by) : rc.notVerified(by, comment ?? ''), { by, nodeId: id });
  const node = nodeOf(s, id) as CollectNode;
  if (decision === 'verified') passCollect(s, id, node);
  else failCollect(s, id, node);
}

/** A Chaser copy of a person step that isn't an approval: the manager carries it on or stops it (05 §3.4.10, §5.3). */
export function decideChaserCopy(s: RunSession, item: WorkItem, by: string, decision: 'approved' | 'rejected' | 'sent_back', comment?: string): void {
  const original = originalOf(s, item);
  const id = item.nodeId as string;
  if (decision === 'approved') {
    if (original.kind === 'task') completeTask(s, item, by);
    else if (original.kind === 'collect') handOverItems(s, item, by, original.items ?? []);
    else if (original.kind === 'collect_review') decideReview(s, item, by, 'verified');
    return;
  }
  recordDecision(s, id, by, decision, comment);
  closeWithCopies(s, item, { decision, ...(comment ? { comment } : {}) });
  s.log('decision', decision === 'rejected' ? rc.rejected(by, comment ?? '') : rc.sentBack(by, comment ?? ''), { by, nodeId: id });
  if (s.run.status === 'paused') {
    deferNegative(s, id, decision, by, comment ?? '');
    return;
  }
  applyNegative(s, id, decision, comment ?? '', by);
}

export function resubmitted(s: RunSession, item: WorkItem, by: string): void {
  const id = item.nodeId as string;
  const step = s.step(id);
  const kind = step.resubmit?.kind ?? 'rejected';
  closeWithCopies(s, item, { decision: 'resubmitted' });
  s.log('decision', rc.resubmitted(by), { by, nodeId: id });
  delete step.resubmit;
  delete step.assignees;
  s.changed = true;
  if (kind === 'rejected') {
    // 05 §3.4.3: "the step asks again".
    delete step.approvals;
    delete step.logged;
    delete step.tasksDone;
    step.round = 0;
    return;
  }
  if (kind === 'path') {
    goBackTo(s, id, id);
    return;
  }
  goBackToDecision(s, id);
}

// ── Plan changes ─────────────────────────────────────────────────────────────────────────────────────────────────────

function wentDown(field: string, before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  const [was, now] = [before[field], after[field]];
  if (typeof was === 'number' && typeof now === 'number') return now < was;
  if (typeof was === 'string' && typeof now === 'string') return now < was;
  return false;
}

/** 03 §8.4: an answer stands unless a field the step depends on changed, and not just downward on a step that lets that stand. */
function asksAgain(node: ApproveNode, changed: string[], before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  const changedMaterial = (node.material ?? []).filter((key) => changed.includes(key));
  return changedMaterial.length > 0 && !(changedMaterial.every((field) => wentDown(field, before, after)) && node.reaskOnDecrease === false);
}

/** A finished Approve step goes back to waiting; what it answered stays until settleApprove looks at it. */
function reopen(s: RunSession, id: string): void {
  const step = s.step(id);
  step.status = 'waiting';
  delete step.taken;
  delete step.completedAt;
  delete step.outcome;
  delete step.logged;
  s.changed = true;
}

/**
 * 03 §8.4 steps 2–3: who has to answer again, and who no longer has to. The path follows the new values. A step is on the
 * line if the new plan's walk reaches it, whatever is open before it: going back to an earlier step holds what follows,
 * it doesn't take it off the line.
 */
function applyPlanToSteps(s: RunSession, changed: string[], before: Record<string, unknown>): void {
  const { walk } = s.run.plan;
  const onLine = new Set([...walk.seen, ...(s.run.floor?.steps ?? [])]);
  for (const id of walk.seen) {
    // A kept step that answered with no exit, and is back on the path: its exit counts again.
    const backOnLine = s.run.steps[id];
    if (backOnLine?.status === 'done' && backOnLine.taken?.length === 0 && s.run.floor?.steps.includes(id)) backOnLine.taken = firstOut(nodeOf(s, id));
  }
  for (const id of walk.seen) {
    const node = nodeOf(s, id);
    const step = s.run.steps[id];
    if (!node || !step || !FINISHED.includes(step.status)) continue;
    if (node.kind !== 'cond' && node.kind !== 'plan' && !(node.kind === 'dw' && isCheck(node.worker, s.env.ctx))) continue;
    if (walk.needInfo.some((hit) => hit.nodeId === id)) {
      // The edit blanked what this If read, so it has no exit now. It asks again; a decided If with no exit would end the run here.
      resetStep(s, id);
      continue;
    }
    const keys = walk.edges.filter((edge) => edge.from === id).map((edge) => edge.key);
    if (JSON.stringify(keys) !== JSON.stringify(step.taken ?? [])) {
      step.taken = keys;
      step.outcome = keys[0];
    }
  }

  for (const [id, step] of Object.entries(s.run.steps)) {
    if (isRuleStep(id)) continue;
    if (onLine.has(id) && step.outcome === OFF_PATH) {
      // The edit brought it back onto the line.
      resetStep(s, id);
    } else if (!onLine.has(id) && OPEN.includes(step.status)) {
      // A step the new path no longer reaches: its open items are withdrawn and the step leaves the line.
      for (const item of s.openItems(id)) {
        s.closeItem(item, 'cancelled');
        s.send({ to: item.assignee, subject: rc.mail.withdrawnSubject(stepName(s, id), item.recordTitle as string), body: rc.mail.withdrawnBody(item.recordTitle as string) });
      }
      step.status = 'skipped';
      step.outcome = OFF_PATH;
      step.completedAt = s.env.now;
      // Withdrawn means all of it: a resubmit window left running would reject the run when it ran out.
      delete step.resubmit;
      delete step.deferred;
      delete step.held;
      clearTimers(step);
      s.changed = true;
    }
  }

  const after = s.record.data as Record<string, unknown>;
  for (const [id, step] of Object.entries(s.run.steps)) {
    const node = nodeOf(s, id);
    if (node?.kind !== 'appr' || !step.approvals || step.outcome === OFF_PATH) continue;
    if (!asksAgain(node, changed, before, after)) continue;
    // "Asked again" (03 §8.4): from the first round. A rule's approver doesn't depend on the step's material, so that answer stands.
    const ruleKeys = stagesOf(s, id).flatMap((stage) => stage.items).filter((item) => item.ruleId).map(itemKey);
    const kept = Object.entries(step.approvals).filter(([key]) => ruleKeys.includes(key));
    if (kept.length > 0) step.approvals = Object.fromEntries(kept);
    else delete step.approvals;
    step.round = 0;
    s.changed = true;
  }

  // A finished step the new plan needs answers from: "New" and "Asked again" (03 §8.4), for skipped and finished steps alike.
  for (const [id, step] of Object.entries(s.run.steps)) {
    const node = nodeOf(s, id);
    if ((!isRuleStep(id) && node?.kind !== 'appr') || !FINISHED.includes(step.status) || step.outcome === OFF_PATH || (node && !onLine.has(id))) continue;
    const stages = stagesOf(s, id);
    const unanswered = stages.some((stage) => !roundSatisfied(s, id, stage));
    const coverLost = stages.length === 0 && node?.kind === 'appr' && !s.run.plan.notNeeded.some((entry) => entry.nodeId === id) && (coveringSteps(s, node) ?? []).some((owner) => s.step(owner).status !== 'done');
    if (unanswered || coverLost) reopen(s, id);
  }

  // Everyone the new plan doesn't ask goes now, paused or not. Asking anyone new waits for the run to be running.
  for (const [id, step] of Object.entries(s.run.steps)) {
    if (OPEN.includes(step.status)) withdrawOutdated(s, id);
  }
}

/**
 * The owner's decision on resubmits: they can never shrink what's required. They can add people, tasks and steps, but
 * no Approve step, seat on one, or rule task required before stays off, and whoever sent it back always sees it again, even
 * if the new values no longer call for them. Compared per step and role: someone being asked for something else doesn't
 * count. `before` is the plan a moment ago; the record already holds the new values. Answers given stand on the usual
 * terms. It keeps people, not paths: an If takes only what the record selects, and a Task or System on the old branch
 * isn't run. Returns what the new values alone would have dropped, for the log.
 */
function raiseFloor(s: RunSession, id: string, before: ApprovalPlan, original: string[], changed: string[], data: Record<string, unknown>): string[] {
  const floor: PlanFloor = s.run.floor ? (JSON.parse(JSON.stringify(s.run.floor)) as PlanFloor) : { steps: [], rules: [], items: [], original, named: [] };
  s.run.floor = floor;
  const alone = planNow(s, 'record');

  for (let turn = 0; turn < 10; turn += 1) {
    const now = planNow(s, 'record');
    let grew = false;
    for (const rule of before.rules) {
      if ((!rule.act.approve && !rule.act.task) || now.rules.some((other) => other.id === rule.id)) continue;
      floor.rules.push(rule.id);
      grew = true;
    }
    for (const stage of before.stages) {
      for (const item of stage.items) {
        // A step asked before and not now, whether no exit leads to it or its "only needed when" stopped holding.
        if (!item.nodeId || floor.steps.includes(item.nodeId) || now.stages.some((other) => other.items.some((one) => one.nodeId === item.nodeId))) continue;
        if (seatAsked(now.stages, { ...item, roles: item.roles, any: true })) continue;
        floor.steps.push(item.nodeId);
        grew = true;
      }
    }
    if (!grew) break;
  }

  const after = s.record.data as Record<string, unknown>;
  const present = planNow(s, 'record');
  const dropped: string[] = [];
  for (const stage of before.stages) {
    for (const item of stage.items) {
      if (item.paused) continue;
      if (!seatAsked(alone.stages, item)) {
        const group = !item.any && item.roles[0].startsWith('g:');
        for (const person of item.people) if (!floor.named.includes(person)) floor.named.push(person);
        dropped.push(group ? roleNameOf(s, item.roles[0]) : `${item.roles.map((role) => roleNameOf(s, role)).join(' or ')} (${item.people.join(', ')})`);
      }
      if (seatAsked(present.stages, item)) continue;
      const { nodeId } = item;
      const node = nodeId ? nodeOf(s, nodeId) : undefined;
      const answered = nodeId && nodeId !== id ? s.step(nodeId).approvals?.[itemKey(item)]?.by ?? [] : [];
      const stands = item.people.some((person) => answered.includes(person)) && !(node?.kind === 'appr' && asksAgain(node, changed, data, after));
      if (stands) continue;
      floor.items.push({ roles: item.roles, any: item.any, nodeId, people: item.people, cls: item.cls, stage: stage.label, ...(item.ruleId ? { ruleId: item.ruleId } : {}), ...(item.cc ? { cc: item.cc } : {}) });
    }
  }
  const tasksAlone = alone.stages.flatMap((stage) => stage.tasks.map((task) => task.ruleId));
  for (const stage of before.stages) {
    for (const task of stage.tasks) if (!tasksAlone.includes(task.ruleId)) dropped.push(task.title);
  }

  // Whoever sent it back, however they came to answer: a manager on a Chaser copy was never on the plan. Asked on this step, not just somewhere.
  const sender = s.step(id).resubmit?.decidedBy;
  if (sender && sender !== 'Levv' && (isRuleStep(id) || nodeOf(s, id)?.kind === 'appr')) {
    s.run.plan = planNow(s, 'record');
    const onThisStep = stagesOf(s, id).flatMap((stage) => stage.items).some((item) => item.people.includes(sender));
    const stepNode = nodeOf(s, id);
    const merged = stepNode?.kind === 'appr' && s.run.plan.stages.some((stage) => stage.items.some((item) => item.people.includes(sender) && (item.also ?? []).some((role) => stepNode.roles.includes(role))));
    if (!onThisStep && !merged) {
      floor.items.push({ roles: [`p:${sender}`], any: false, nodeId: isRuleStep(id) ? null : id, people: [sender], cls: 3, stage: stepName(s, id) });
      if (!floor.named.includes(sender)) floor.named.push(sender);
      dropped.push(sender);
    }
  }
  return Array.from(new Set(dropped));
}

const roleNameOf = (s: RunSession, role: string): string => (role.startsWith('p:') ? role.slice(2) : personRole(s, role));

/** A requester's resubmit, with whatever they changed (05 §3.4.3): an edit, except that it can't take anyone off. */
export function resubmitEdited(s: RunSession, id: string, data: Record<string, unknown>, labelOf: (field: string) => string): void {
  const before = { ...(s.record.data as Record<string, unknown>) };
  const plan = planNow(s, 'record');
  const original = s.run.floor?.original ?? Array.from(previousApprovers(s.env.nodes, s.rec0(), s.env.ctx));
  s.setRecord(data);
  const changed = changedFields(before, s.record.data as Record<string, unknown>);
  const kept = raiseFloor(s, id, plan, original, changed, before);
  if (changed.length > 0) recordEdited(s, changed, changed.map(labelOf), before);
  else replan(s);
  if (kept.length > 0) s.log('kept', rc.keptAfterResubmit(kept), { nodeId: id });
}

/** 05 §3.4.11: "When the record's date field changes, recompute waitUntil". */
export function moveWaits(s: RunSession, changed: string[]): boolean {
  let moved = false;
  for (const [id, step] of Object.entries(s.run.steps)) {
    const node = nodeOf(s, id);
    if (node?.kind !== 'wait' || step.status !== 'waiting' || node.w.mode !== 'date' || !changed.includes(node.w.field ?? 'start_date')) continue;
    const until = resolveWaitUntil(node.w, s.rec0(), s.env.now, { worker: s.rec0().worker_tz as string | undefined, company: COMPANY_ZONE });
    if (!until || until === step.waitUntil) continue;
    step.waitUntil = until;
    moved = true;
    delete s.run.stuckTold;
    const label = s.env.ctx.catalog.WAIT_DATES[node.w.field ?? 'start_date'];
    s.log('wait_moved', rc.waitMoved(label, `${dateTimeText(until)} UTC`), { nodeId: id });
  }
  return moved;
}

/** 05 §2 step 2. The record is already saved; `before` is its `data` a moment ago. */
export function recordEdited(s: RunSession, changed: string[], labels: string[], before: Record<string, unknown>): void {
  replan(s);
  writeRuleFlags(s);
  applyPlanToSteps(s, changed, before);
  moveWaits(s, changed);
  s.log('record_changed', rc.recordChanged(labels), { by: s.acting?.name });
  wakeIfStuck(s);
}

/** Fills in what a proposal changes and re-plans (03 §8.3, D13). */
export function proposalChosen(s: RunSession, line: string, changed: string[], before: Record<string, unknown>): void {
  s.log('record_changed', line, { by: s.acting?.name });
  replan(s);
  applyPlanToSteps(s, changed, before);
}

/** 03 §7.2 item 3: a rule's flag is set on the record, and later steps can react to it. Returns whether that changed anything. */
export function writeRuleFlags(s: RunSession): boolean {
  const flags = s.run.plan.flags.filter((flag) => !(s.record.data as Record<string, unknown>)[flag.field]);
  if (flags.length === 0) return false;
  s.setRecord(Object.fromEntries(flags.map((flag) => [flag.field, true])));
  replan(s);
  return true;
}

/** What a plan says about people: not the wording, and not what the checks found. */
const planSignature = (plan: ApprovalPlan): string =>
  JSON.stringify({
    seen: plan.walk.seen,
    stages: plan.stages.map((stage) => [stage.label, stage.items.map((item) => [item.roles, item.also ?? [], item.people, item.paused, item.nodeId]), stage.tasks.map((task) => task.ruleId)]),
    notNeeded: plan.notNeeded.map((entry) => entry.nodeId),
    skipped: plan.skipped.map((entry) => [entry.nodeId, entry.role]),
    auto: plan.auto,
  });

/** A value that isn't an edit (brought back from a system) moving the plan: everything an edit would do, except say the record was edited. */
function followPlan(s: RunSession, changed: string[], before: Record<string, unknown>): boolean {
  const fresh = planNow(s, 'record');
  if (planSignature(fresh) === planSignature(s.run.plan)) return false;
  s.run.plan = fresh;
  s.changed = true;
  writeRuleFlags(s);
  applyPlanToSteps(s, changed, before);
  return true;
}

/**
 * Finding 3. F9: no automatic reaction to a change from another system, except that Waits follow dates. The exception to
 * that exception is approval: a merged value that changes who must approve is re-planned, like an edit, or it would bypass them.
 */
export function recordArrived(s: RunSession, changed: string[], labels: string[], before: Record<string, unknown>): boolean {
  const dated = moveWaits(s, changed);
  let moved = followPlan(s, changed, before);
  if (!moved && decidersMoved(s)) {
    // A failed check's deciders aren't on the plan (03 §10.3), so its signature doesn't show them.
    applyPlanToSteps(s, changed, before);
    moved = true;
  }
  if (moved) s.log('record_changed', rc.recordChanged(labels), { by: s.acting?.name });
  if (moved || dated) wakeIfStuck(s);
  return moved;
}

function decidersMoved(s: RunSession): boolean {
  return Object.entries(s.run.steps).some(([id, step]) => {
    const node = nodeOf(s, id);
    if (node?.kind !== 'collect' || step.status !== 'failed') return false;
    const stage = failedStages(s, node)[0];
    const wanted = (stage?.items ?? []).filter((item) => !keySatisfied(s, id, item) && !item.paused).flatMap((item) => peopleOf(s, item)).sort();
    const asked = s.openItems(id).filter((item) => !item.chaserOf).map((item) => item.assignee).sort();
    return JSON.stringify(wanted) !== JSON.stringify(asked);
  });
}

/** Is someone on this run waiting on a person who doesn't exist? Reference data is what can change that. */
const waitingOnNobody = (s: RunSession): boolean =>
  s.run.plan.paused ||
  s.run.pauseReason === 'stuck' ||
  Object.entries(s.run.steps).some(([id, step]) => {
    if (step.held) return true;
    if (!OPEN.includes(step.status) || (!isRuleStep(id) && nodeOf(s, id)?.kind !== 'appr')) return false;
    return stagesOf(s, id).some((stage) => stage.items.some((item) => !keySatisfied(s, id, item) && peopleOf(s, item).length === 0));
  });

/** 05 §3.4.3: "The step resumes when reference data changes and re-planning finds someone." Paused runs too: Resume doesn't re-plan. */
export async function referenceMoved(s: RunSession): Promise<void> {
  if (!waitingOnNobody(s)) return;
  followPlan(s, [], {});
  wakeIfStuck(s);
  await advance(s);
}

// ── The safety net ───────────────────────────────────────────────────────────────────────────────────────────────────

/** From the steps alone, so a tick reads no more than it has to: nobody is assigned anywhere and nothing will fire. A retry held behind an approval won't, until someone answers it. */
export const mightBeStuck = (steps: Record<string, StepRun>, nodes: Record<string, WfNode>, kept: string[] = []): boolean =>
  !Object.entries(steps).some(([id, step]) => (step.assignees?.length ?? 0) > 0 || step.waitUntil || (step.retry && !heldByApproval(steps, nodes, id, kept)) || step.confirmBy || step.resubmit);

/**
 * A running run nobody can move: no open item, nothing scheduled, and no choice waiting on its page. Whatever the cause,
 * and every known one has its own fix, it shouldn't sit silently as running. It never approves anything.
 */
function nothingToWaitFor(s: RunSession): boolean {
  if (s.run.status !== 'running' || conflictOf(s) || s.items.some((item) => item.status === 'open')) return false;
  return !Object.entries(s.run.steps).some(([id, step]) => (step.status === 'waiting' && step.waitUntil) || (step.retry && !heldByApproval(s.run.steps, s.env.nodes, id, s.run.floor?.steps)) || step.confirmBy || step.resubmit || step.deferred);
}

export function pauseIfStuck(s: RunSession): void {
  if (!nothingToWaitFor(s)) return;
  const { run } = s;
  run.status = 'paused';
  run.pausedBy = 'Levv';
  run.pausedAt = s.env.now;
  run.pauseReason = 'stuck';
  s.log('paused', rc.stuck);
  // Once per episode: Resume, an edit or an import that changes nothing pauses it again, and the owner already knows.
  if (run.stuckTold) return;
  run.stuckTold = s.env.now;
  const recordTitle = ((s.record.data as Record<string, unknown>).title as string | undefined) ?? s.record.id;
  for (const channel of ['In-app', 'Email'] as const) {
    s.send({ to: s.env.wf.owner, channel, subject: rc.mail.stuckSubject(s.env.wf.name, recordTitle), body: rc.mail.stuckBody(s.env.wf.name, recordTitle, s.runLink()) });
  }
}

/** Something changed that can move it. If it still can't, the next tick says so again. */
function wakeIfStuck(s: RunSession): void {
  const { run } = s;
  if (run.status !== 'paused' || run.pauseReason !== 'stuck') return;
  run.status = 'running';
  delete run.pausedBy;
  delete run.pausedAt;
  delete run.pauseReason;
  s.log('resumed', '');
}

// ── Advancing ────────────────────────────────────────────────────────────────────────────────────────────────────────

function ruleOnlyStages(s: RunSession): { leading: Stage[]; trailing: Stage[] } {
  const stages = s.run.plan.stages;
  const firstOnNode = stages.findIndex((stage) => stage.items.some((item) => item.nodeId));
  const ruleOnly = stages.filter((stage) => !stage.items.some((item) => item.nodeId));
  if (firstOnNode < 0) return { leading: ruleOnly, trailing: [] };
  return { leading: ruleOnly.filter((stage) => stages.indexOf(stage) < firstOnNode), trailing: ruleOnly.filter((stage) => stages.indexOf(stage) > firstOnNode) };
}

/** Rounds with no Approve step of their own (03 §7.2). Returns false while one is still open. */
function settleRuleRounds(s: RunSession, stages: Stage[]): boolean {
  for (const stage of stages) {
    const id = `${RULE_PREFIX}${stage.label}`;
    const step = s.step(id);
    if (step.status === 'skipped') reopen(s, id);
    if (step.status !== 'done') {
      settleApprove(s, id);
      if (s.step(id).status !== 'done') return false;
    }
  }
  return true;
}

function senderOf(s: RunSession, id: string): string | undefined {
  return predecessorsTaken(s, id)[0];
}

/** 05 §3.2 step 4. Returns true when the run has more to do on this pass. */
function endCheck(s: RunSession, reached: Set<string>): boolean {
  const steps = Object.values(s.run.steps);
  if (steps.some((step) => OPEN.includes(step.status) || step.deferred)) return false;
  // A kept approval has to be answered; running out of other things to do doesn't skip it.
  if ((s.run.floor?.steps ?? []).some((id) => !FINISHED.includes(s.step(id).status))) return false;
  // Every rule-only round: those before any step's round normally go first (03 §7.2), but a rule can match after the steps have gone, or with no steps at all.
  const { leading, trailing } = ruleOnlyStages(s);
  if (!settleRuleRounds(s, [...leading, ...trailing])) return false;

  const ends = Array.from(reached).filter((id) => nodeOf(s, id)?.kind === 'end');
  const outcomeOf = (id: string) => (nodeOf(s, id) as { outcome?: string }).outcome;
  const rejectedEnd = ends.find((id) => outcomeOf(id) === 'rejected');
  if (rejectedEnd) {
    const sender = senderOf(s, rejectedEnd);
    if (sender) {
      // "Reject it and send it back to the requester": 05 §3.4.2 applies the requester's window before it is final.
      const rec = s.rec0();
      const node = nodeOf(s, sender);
      const reason = node?.kind === 'dw' ? `${s.env.ctx.dws.DW[node.worker]?.n ?? node.worker}: ${conditionsOutcome(node, rec, s.env.ctx)}` : stepName(s, sender);
      openResubmit(s, sender, 'path', reason, 'Levv');
      return s.run.status === 'running';
    }
    finalReject(s, rejectedEnd, '');
    return false;
  }

  const stoppedEnd = ends.find((id) => outcomeOf(id) === 'stopped' || outcomeOf(id) === 'cancelled');
  if (stoppedEnd) {
    const from = senderOf(s, stoppedEnd);
    const decider = from && nodeOf(s, from)?.kind === 'notify' ? senderOf(s, from) ?? from : from ?? stoppedEnd;
    const line = rc.stoppedAt(stepName(s, decider));
    const { run } = s;
    run.status = 'stopped';
    run.stoppedBy = 'Levv';
    run.stoppedAt = s.env.now;
    run.stopReason = line;
    run.endedAt = s.env.now;
    s.step(stoppedEnd).status = 'done';
    s.log('stopped', line, { nodeId: decider });
    return false;
  }

  for (const id of ends) s.step(id).status = 'done';
  for (const step of Object.values(s.run.steps)) if (step.status === 'pending') step.status = 'skipped';
  s.run.status = 'completed';
  s.run.endedAt = s.env.now;
  s.log('completed', rc.completed);
  addEarnedState(s);
  return false;
}

/** 03 §15 item 2: what a completed run of a submitted, changed, created or change_order event earns the record. */
const EARNED: Partial<Record<string, string>> = { work_order: 'wo_approved', sow: 'sow_approved', job_posting: 'jp_approved', timesheet: 'ts_approved' };

function addEarnedState(s: RunSession): void {
  const { event, recordRef } = s.run;
  if (!['submitted', 'changed', 'created', 'change_order'].includes(event)) return;
  const state = EARNED[recordRef.type];
  const states = ((s.record.data as Record<string, unknown>).states as string[] | undefined) ?? [];
  if (!state || states.includes(state)) return;
  s.setRecord({ states: [...states, state] });
}

/** 05 §3.2: only `running` moves. It never starts a step twice, because only `pending` steps start. */
export async function advance(s: RunSession): Promise<void> {
  for (let guard = 0; guard < LOOP_GUARD; guard += 1) {
    if (s.run.status !== 'running') return;
    await settleOpen(s);
    if (s.run.status !== 'running') return;
    const { leading } = ruleOnlyStages(s);
    // A round before the steps' can arrive after they've started, so it's asked whether or not anything is ready to start (item F).
    if (leading.length > 0 && s.step('T').status === 'done') {
      settleRuleRounds(s, leading);
      if (s.run.status !== 'running') return;
    }
    const reached = reachedSteps(s);
    const ready = readySteps(s, reached);
    if (ready.length > 0) {
      const onlyStart = ready.filter((id) => nodeOf(s, id)?.kind === 'trigger');
      const clear = onlyStart.length > 0 || settleRuleRounds(s, leading);
      const starting = onlyStart.length > 0 ? onlyStart : clear ? ready : [];
      if (starting.length === 0) return;
      for (const id of starting) {
        if (s.run.status !== 'running') return;
        await startStep(s, id);
      }
      continue;
    }
    if (!endCheck(s, reached)) {
      // A rejecting path has just gone back to the requester, or nothing is left to do on this pass.
      return;
    }
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────────────────────────────────────────────

function managerOf(s: RunSession, person: string): string | null {
  const requester = (s.record.data as Record<string, unknown>).requester;
  const worker = (s.record.data as Record<string, unknown>).worker_name;
  let current: string | undefined = s.env.ctx.people.MGR[person];
  // 03 §15 item 13 and AGENTS rule 4: an escalation never lands on the worker or the person who raised the request.
  for (let hop = 0; current && hop < 8 && (current === requester || current === worker); hop += 1) current = s.env.ctx.people.MGR[current];
  return current ?? null;
}

function chaseTarget(s: RunSession, id: string, person: string): string | null {
  const node = nodeOf(s, id);
  if (node && chaseTo(node) === copy.theHiringManager) {
    const holder = resolveRoleHolder('hm', s.rec0(), s.env.ctx).person;
    if (holder && holder !== person && !neverDecides(s, holder)) return holder;
  }
  return managerOf(s, person);
}

function chaserDue(s: RunSession, id: string): boolean {
  const step = s.step(id);
  const { now } = s.env;
  if (step.status !== 'waiting' && step.status !== 'failed') return false;
  return (!step.reminded && isDue(step.remindAt, now)) || (!step.escalatedTo && isDue(step.escalateAt, now));
}

function runChaser(s: RunSession, id: string): void {
  const step = s.step(id);
  const { now } = s.env;
  const { remind, sla } = chaserTimes(s, id);
  const originals = s.openItems(id).filter((item) => !item.chaserOf && item.kind !== 'resubmit');
  if (!step.reminded && isDue(step.remindAt, now)) {
    step.reminded = true;
    s.changed = true;
    for (const item of originals) {
      const target = chaseTarget(s, id, item.assignee);
      s.send({ to: item.assignee, subject: rc.mail.reminderSubject(stepName(s, id), item.recordTitle as string), body: rc.mail.reminderBody(remind, target ?? '', sla) });
      s.log('reminder', rc.reminder(item.assignee), { nodeId: id });
    }
  }
  if (!step.escalatedTo && isDue(step.escalateAt, now)) {
    const node = nodeOf(s, id);
    const relation = node ? chaseTo(node) : copy.theirManager;
    const went: string[] = [];
    for (const item of originals) {
      const target = chaseTarget(s, id, item.assignee);
      if (!target) continue;
      const copyItem = s.addItem({
        kind: 'escalation',
        nodeId: id,
        assignee: target,
        stepName: rc.chaserEscalationTitle(stepName(s, id), item.assignee),
        chaserOf: item.id,
        ...(item.key ? { key: item.key } : {}),
        ...(item.brief ? { brief: item.brief } : {}),
        ...(item.what ? { what: item.what } : {}),
        ...(item.items ? { items: item.items } : {}),
      });
      s.send({ to: target, subject: rc.mail.chaserSubject(stepName(s, id), item.recordTitle as string), body: rc.mail.chaserBody(item.assignee, sla, s.link(copyItem.id)) });
      s.log('escalated', rc.escalated(sla, target, relation), { nodeId: id });
      went.push(target);
    }
    step.escalatedTo = went.join(', ') || '—';
    s.changed = true;
  }
}

/** 05 §3.3, for one run. Only called on `running` runs. Nothing is due → nothing changes, so a second tick writes nothing. */
export async function tickRun(s: RunSession): Promise<void> {
  const { now } = s.env;
  for (const [id, step] of Object.entries(s.run.steps)) {
    if (s.run.status !== 'running') break;
    const node = nodeOf(s, id);
    if (step.resubmit && isDue(step.resubmit.by, now)) {
      finalReject(s, id, step.resubmit.comment);
      break;
    }
    if (chaserDue(s, id)) runChaser(s, id);
    if (node?.kind === 'wait' && step.status === 'waiting' && isDue(step.waitUntil, now)) finish(s, id, 'done', undefined, firstOut(node));
    if (node?.kind === 'system') await tickSystem(s, id, node);
  }
  await advance(s);
}

async function tickSystem(s: RunSession, id: string, node: SystemNode): Promise<void> {
  const step = s.step(id);
  while (step.status === 'active' && step.retry && isDue(step.retry.nextAt, s.env.now) && !heldByApproval(s.run.steps, s.env.nodes, id, s.run.floor?.steps)) {
    step.retry.count += 1;
    s.log('system', rc.retry(step.retry.count, node.system, step.retry.error), { nodeId: id });
    await callSystem(s, id, node);
    if (s.run.status !== 'running') return;
  }
  if (step.status === 'waiting' && step.confirmBy) {
    const answer = await s.env.adapters.system(node.system, s.rec0()).confirm(step.systemRef as string);
    if (answer.status === 'done') systemDone(s, id, node, step.systemRef as string, answer.values);
    else if (answer.status === 'failed') systemFailed(s, id, node, answer.error, false);
    else if (isDue(step.confirmBy, s.env.now)) {
      delete step.confirmBy;
      applyOnFail(s, id, node, `${node.system} didn’t confirm within ${node.sys.waitH}h`);
    }
  }
}

/** Anything for the tick to do? Decided from the run alone, so a tick reads no more than it has to. */
export function tickIsDue(steps: Record<string, StepRun>, nodes: Record<string, WfNode>, now: string, kept: string[] = []): boolean {
  return Object.entries(steps).some(([id, step]) => {
    if (step.resubmit && isDue(step.resubmit.by, now)) return true;
    // A run committed and not yet advanced: the process that claimed it went away (finding 14).
    if (nodes[id]?.kind === 'trigger' && step.status === 'pending') return true;
    if ((step.status === 'waiting' || step.status === 'failed') && ((!step.reminded && isDue(step.remindAt, now)) || (!step.escalatedTo && isDue(step.escalateAt, now)))) return true;
    if (step.status === 'waiting' && isDue(step.waitUntil, now)) return true;
    if (step.status === 'active' && step.retry && isDue(step.retry.nextAt, now) && !heldByApproval(steps, nodes, id, kept)) return true;
    return nodes[id]?.kind === 'system' && step.status === 'waiting' && Boolean(step.confirmBy);
  });
}

