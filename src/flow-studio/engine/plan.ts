import type { EngineContext } from '../model/context';
import { limitOf, oooUntilText, type DecisionClass, type RoleKey } from '../model/people';
import type { RecordData } from '../model/records';
import type {
  ApprovalPlan,
  Basis,
  CheckResult,
  NotNeeded,
  PlanFloor,
  Skipped,
  Stage,
  StageItem,
} from '../model/results';
import type { ApproveMode, ApproveNode, CollectNode, WfNode, Workflow } from '../model/workflow';
import { isAutoApproved } from './auto';
import { applyBasis, previousApprovers } from './changes';
import { checkEntry, isCheck } from './checks';
import { evalCondition, type Rec } from './conditions';
import { copy, curl } from './copy';
import { groupDisplay, isAway, personLabel, PICKS_THE_APPROVER, resolveRoleHolder, roleDef, roleName } from './resolve';
import { addRuleItems, blankItem, rulesMatching } from './rules';
import { conditionText, fmt, title } from './text';
import { walkWorkflow, walkOutcome } from './walk';

export { resolveRoleHolder } from './resolve';

const MOVE_UP_HOPS = 5;
const LIMIT_HOPS = 6;

/** The Approve fields planning reads, so a Collect & verify's one-off decision can be planned the same way (§10.3). */
type ApproveLike = Pick<ApproveNode, 'id' | 'roles' | 'mode'> & Partial<Pick<ApproveNode, 'authority' | 'backup' | 'escalation' | 'label'>>;

/** Engine §6.1: the record the plan reads. */
export const planRecord = (wf: Pick<Workflow, 'records' | 'event'>, rec: Rec): Rec & { record: string; event: string } => ({
  ...rec,
  record: wf.records[0],
  event: wf.event,
});

/**
 * Engine §6: plan whenever the workflow has an Approve or Auto-approve step, or any approval rule matches.
 * The escalation generated for a Collect & verify failure (`failOf`) only counts once the walk reaches it:
 * loading adds one to every such step, and 03 §19 E22 and EN-001 still expect no plan on those workflows.
 */
export function needsPlan(
  wf: Pick<Workflow, 'records' | 'event'>,
  nodes: Record<string, WfNode>,
  rec: Rec,
  walkedIds: string[],
  ctx: Pick<EngineContext, 'rules'>,
): boolean {
  const counts = (node: WfNode): boolean =>
    node.kind === 'policy' || (node.kind === 'appr' && (node.failOf === undefined || walkedIds.includes(node.id)));
  if (Object.values(nodes).some(counts)) return true;
  return rulesMatching(planRecord(wf, rec), ctx).length > 0;
}

/** Engine §6.5 `split`: each role its own item, except split funding (one cost center owner per entry). */
function splitItems(roles: RoleKey[], nodeId: string, why: string | null, rec0: Rec): StageItem[] {
  const centers = (rec0.cost_centers as string[] | undefined) ?? [];
  return roles.flatMap((role) => {
    if (role === 'cco' && centers.length >= 2) return centers.map((cc): StageItem => ({ ...blankItem([role], nodeId, why), cc }));
    return [blankItem([role], nodeId, why)];
  });
}

/** Engine §6.5 step 5: the rounds of one Approve step. */
function stagesForStep(node: ApproveLike, roles: RoleKey[], stepTitle: string, why: string | null, rec0: Rec): Stage[] {
  const mode: ApproveMode = node.mode ?? 'all';
  if (mode === 'any' && roles.length >= 2) {
    return [{ label: stepTitle, items: [blankItem(roles, node.id, why)], tasks: [] }];
  }
  if (mode === 'order') {
    return roles.map((role, i) => ({
      label: roles.length > 1 ? copy.inOrderLabel(stepTitle, i + 1, roles.length) : stepTitle,
      items: splitItems([role], node.id, why, rec0),
      tasks: [],
    }));
  }
  return [{ label: stepTitle, items: splitItems(roles, node.id, why, rec0), tasks: [] }];
}

function lowestClass(roles: RoleKey[], ctx: EngineContext): DecisionClass {
  return Math.min(...roles.map((role) => roleDef(ctx, role)?.c ?? 3)) as DecisionClass;
}

function resolveAnyItem(item: StageItem, rec0: Rec, ctx: EngineContext): void {
  const people = item.roles
    .map((role) => resolveRoleHolder(role, rec0, ctx, item.cc).person)
    .filter((person): person is string => person !== null && person !== rec0.requester && person !== rec0.worker_name);
  if (people.length === 0) {
    item.paused = true;
    item.pausedWhy = copy.noEligibleAny(item.roles.map((role) => roleName(ctx, role)));
    item.people = ['—'];
  } else {
    item.people = people;
  }
  item.cls = lowestClass(item.roles, ctx);
}

/** Engine §6.7 B5: nobody approves their own request. */
function moveOffRequester(item: StageItem, role: RoleKey, person: string, requester: unknown, cls: DecisionClass, ctx: EngineContext): string {
  const { BACKUP, MGR, TITLES } = ctx.people;
  if (person !== requester) return person;
  if (cls === 2) {
    const backup = BACKUP[role];
    if (backup && backup !== person) {
      item.notes.push({ t: 'warn', m: copy.selfSpecialistBackup(person, roleName(ctx, role), backup) });
      return backup;
    }
    item.paused = true;
    item.pausedWhy = copy.selfSpecialistPaused(person, roleName(ctx, role));
    return person;
  }
  let current = person;
  for (let hop = 0; hop < MOVE_UP_HOPS && current === requester && MGR[current]; hop += 1) {
    const up = MGR[current];
    item.notes.push({ t: 'warn', m: copy.selfMovesUp(current, up, TITLES[up]) });
    current = up;
  }
  return current;
}

/** AGENTS rule 4: the worker never approves or reviews. Handled as §6.7 B5 handles the requester, except that with nobody to move to it pauses. */
function moveOffWorker(item: StageItem, role: RoleKey, person: string, worker: unknown, cls: DecisionClass, ctx: EngineContext): string {
  const { BACKUP, MGR, TITLES } = ctx.people;
  if (person !== worker) return person;
  if (cls === 2) {
    const backup = BACKUP[role];
    if (backup && backup !== person) {
      item.notes.push({ t: 'warn', m: copy.workerSpecialistBackup(person, roleName(ctx, role), backup) });
      return backup;
    }
    item.paused = true;
    item.pausedWhy = copy.workerSpecialistPaused(person, roleName(ctx, role));
    return person;
  }
  let current = person;
  for (let hop = 0; hop < MOVE_UP_HOPS && current === worker && MGR[current]; hop += 1) {
    const up = MGR[current];
    item.notes.push({ t: 'warn', m: copy.workerMovesUp(current, up, TITLES[up]) });
    current = up;
  }
  if (current === worker) {
    item.paused = true;
    item.pausedWhy = copy.workerNobodyAbove(person);
  }
  return current;
}

/** Engine §6.7 B5 and AGENTS rule 4, until neither applies: moving off one can land on the other. */
function moveOffIneligible(item: StageItem, role: RoleKey, person: string, rec0: Rec, cls: DecisionClass, ctx: EngineContext): string {
  let current = person;
  for (let turn = 0; turn < MOVE_UP_HOPS && !item.paused && (current === rec0.requester || current === rec0.worker_name); turn += 1) {
    const before = current;
    current = moveOffRequester(item, role, current, rec0.requester, cls, ctx);
    if (!item.paused) current = moveOffWorker(item, role, current, rec0.worker_name, cls, ctx);
    if (current === before) break;
  }
  return current;
}

/** Engine §6.7 B6. */
function applySigningLimit(item: StageItem, person: string, total: number, ctx: EngineContext): string {
  const { MGR } = ctx.people;
  let current = person;
  for (let hop = 0; hop < LIMIT_HOPS && limitOf(ctx.people, current) < total && MGR[current]; hop += 1) {
    const up = MGR[current];
    item.notes.push({ t: 'info', m: copy.signingLimit(current, fmt(limitOf(ctx.people, current)), up) });
    current = up;
  }
  return current;
}

/** Engine §6.7 B7, including the named-person case (D8). */
function applyAbsence(item: StageItem, role: RoleKey, person: string, cls: DecisionClass, backupOfStep: string | undefined, ctx: EngineContext): string {
  if (!isAway(ctx, person)) return person;
  const { OOO, DELEG_OK, BACKUP } = ctx.people;
  const until = oooUntilText(OOO[person].until);

  if (role.startsWith('p:')) {
    if (backupOfStep) {
      item.notes.push({ t: 'warn', m: copy.namedAwayBackup(person, until, backupOfStep) });
      item.onBehalfOf = { person };
      return backupOfStep;
    }
    item.paused = true;
    item.pausedWhy = copy.namedAwayNoBackup(person);
    return person;
  }

  const delegate = OOO[person].to;
  if (cls !== 2 || (DELEG_OK[delegate] ?? []).includes(role)) {
    item.notes.push({ t: 'ok', m: copy.awayDelegated(person, until, delegate) });
    item.onBehalfOf = { role, person };
    return delegate;
  }
  const backup = BACKUP[role];
  if (backup && backup !== person) {
    item.notes.push({ t: 'warn', m: copy.awayBackup(person, until, delegate, roleName(ctx, role), backup) });
    item.onBehalfOf = { role, person };
    return backup;
  }
  item.paused = true;
  item.pausedWhy = copy.awayNoDelegate(person);
  return person;
}

/** Engine §6.7 B and §6.8. */
function resolveOneRoleItem(item: StageItem, node: ApproveLike | undefined, rec0: Rec, recAdj: Rec, wf: Pick<Workflow, 'owner'>, ctx: EngineContext): void {
  const role = item.roles[0];
  const cls = roleDef(ctx, role)?.c ?? 3;
  item.cls = cls;
  let person = resolveRoleHolder(role, rec0, ctx, item.cc).person;

  if (item.cc) item.notes.push({ t: 'ok', m: copy.chargedTo(item.cc) });
  if (role === 'hm' && rec0.hiring_manager && rec0.requester !== rec0.hiring_manager) {
    item.notes.push({ t: 'ok', m: copy.hiringManagerOnRecord(rec0.hiring_manager as string, rec0.requester as string) });
  }
  if (role.startsWith('g:')) {
    item.people = [person as string];
    return;
  }

  if (person === null) {
    item.paused = true;
    item.pausedWhy = copy.noEligibleReviewer(roleName(ctx, role), rec0.country);
  } else if (roleDef(ctx, role)?.actor) {
    // AGENTS rule 4: an Approve step on the Worker role has nobody to ask, whoever the worker is.
    item.paused = true;
    item.pausedWhy = copy.workerNeverApproves;
  } else {
    person = moveOffIneligible(item, role, person, rec0, cls, ctx);
    const total = recAdj.total_value as number | null | undefined;
    if (!item.paused && node?.authority && cls !== 2 && total != null) person = applySigningLimit(item, person, total, ctx);
    if (!item.paused) person = applyAbsence(item, role, person, cls, node?.backup, ctx);
    // AGENTS rule 4: limits, delegates and backups can land on the requester too, and §6.7 only checks before them.
    if (!item.paused) person = moveOffIneligible(item, role, person, rec0, cls, ctx);
  }

  if (item.paused) item.notes.push({ t: 'bad', m: copy.pausedNote(item.pausedWhy as string, wf.owner) });
  item.people = [item.paused ? '—' : (person as string)];
}

function canLeadTo(nodes: Record<string, WfNode>, from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    for (const out of nodes[queue.shift() as string]?.outs ?? []) {
      if (out.to === to) return true;
      if (!seen.has(out.to)) {
        seen.add(out.to);
        queue.push(out.to);
      }
    }
  }
  return false;
}

/**
 * Engine §6.10: one person, asked once for one kind of decision. Stages must already be in round order. The walk reaches
 * a step where branches meet by its shortest branch, so a step can be listed after one it leads to; that one can't cover
 * it, because it waits for it. So it isn't merged, and the person is asked at each (post-build review, item E).
 */
function mergeStages(stages: Stage[], ctx: EngineContext, nodes: Record<string, WfNode> = {}): Stage[] {
  const seen = new Map<string, { item: StageItem; stage: number }>();
  stages.forEach((stage, stageIndex) => {
    stage.items = stage.items.filter((item) => {
      if (item.any || item.paused) return true;
      const person = item.people[0];
      const role = item.roles[0];
      const key = `${person}|${item.cls}`;
      const earlier = seen.get(key);
      if (earlier && item.nodeId && earlier.item.nodeId && earlier.item.nodeId !== item.nodeId && canLeadTo(nodes, item.nodeId, earlier.item.nodeId)) return true;
      if (earlier) {
        const k = earlier.item;
        if (!k.roles.includes(role) && !(k.also ?? []).includes(role)) {
          k.also = [...(k.also ?? []), role];
          k.notes.push({ t: 'ok', m: copy.alsoCovers(person, roleName(ctx, role), earlier.stage < stageIndex) });
        }
        return false;
      }
      const other = Array.from(seen.entries()).find(([otherKey]) => otherKey.split('|')[0] === person);
      if (other) {
        item.notes.push({ t: 'info', m: copy.alsoGives(person, ctx.people.CLASS_N[other[1].item.cls], ctx.people.CLASS_N[item.cls]) });
      }
      seen.set(key, { item, stage: stageIndex });
      return true;
    });
  });
  return stages.filter((stage) => stage.items.length > 0 || stage.tasks.length > 0);
}

const onlyRuleItems = (stage: Stage): boolean => stage.items.every((item) => item.ruleId !== undefined);

interface PlanOptions {
  /** The graph being run. Defaults to the draft; the runtime passes the pinned version (§6.1). */
  nodes?: Record<string, WfNode>;
  /** A real run's exits so far (05 §3.2): the walk follows them, because a Failed exit isn't in the record. Test has none. */
  taken?: Record<string, string[]>;
  /** What a requester's resubmit couldn't remove. Test has none: it has no resubmit. */
  floor?: PlanFloor;
}

/** Is this seat on the plan: this role, and for a one-person item this person, including where §6.10 merged it? Being asked for something else doesn't count. */
export function seatAsked(stages: Stage[], seat: Pick<StageItem, 'roles' | 'any' | 'people'>): boolean {
  const named = !seat.any && !seat.roles[0].startsWith('g:');
  return stages.some((stage) =>
    stage.items.some((item) => !item.paused && seat.roles.every((role) => item.roles.includes(role) || (item.also ?? []).includes(role)) && (!named || seat.people.every((person) => item.people.includes(person)))),
  );
}

/** Puts back who a floor names and the plan doesn't ask, and explains why anyone is still on it. */
function applyFloor(stages: Stage[], floor: PlanFloor, checks: CheckResult[]): void {
  for (const kept of floor.items) {
    if (seatAsked(stages, kept)) continue;
    const item: StageItem = { ...blankItem(kept.roles, kept.nodeId, null), any: kept.any, cls: kept.cls, people: kept.people, checks, keptKey: kept.people.join(','), ...(kept.ruleId ? { ruleId: kept.ruleId } : {}), ...(kept.cc ? { cc: kept.cc } : {}) };
    const home = stages.find((stage) => stage.items.some((other) => (kept.nodeId ? other.nodeId === kept.nodeId : Boolean(kept.ruleId) && other.ruleId === kept.ruleId))) ?? stages.find((stage) => stage.label === kept.stage);
    if (home) home.items.push(item);
    else stages.push({ label: kept.stage, items: [item], tasks: [] });
  }
  for (const stage of stages) {
    for (const item of stage.items) {
      const person = item.people.find((one) => floor.named.includes(one));
      if (!person) continue;
      item.kept = true;
      item.notes.push({ t: 'info', m: copy.keptNote(person) });
    }
  }
}

/** Engine §6. */
export function planApprovals(wf: Workflow, rec: RecordData | Rec, ctx: EngineContext, options: PlanOptions = {}): ApprovalPlan {
  const nodes = options.nodes ?? wf.draft.nodes;
  const rec0 = planRecord(wf, rec as Rec);
  const basis: Basis | null = applyBasis(wf, rec0);
  const recAdj: Rec = basis ? { ...rec0, total_value: basis.v } : rec0;
  const { floor } = options;
  const walk = walkWorkflow(nodes, recAdj, ctx, options.taken);
  const prevRoles = floor ? new Set<RoleKey>(floor.original) : previousApprovers(nodes, rec0, ctx);

  const stages: Stage[] = [];
  const notNeeded: NotNeeded[] = [];
  const skipped: Skipped[] = [];
  const policies: string[] = [];
  const changedFields = (rec0.changed_fields as string[] | undefined) ?? [];

  // A step a resubmit couldn't remove is planned where the walk would have listed it, but no exit leads to it.
  const keptOffPath = (floor?.steps ?? []).filter((id) => nodes[id]?.kind === 'appr' && !walk.steps.some((step) => step.nodeId === id)).map((nodeId) => ({ nodeId, why: null }));
  for (const step of [...walk.steps, ...keptOffPath]) {
    const node = nodes[step.nodeId];
    if (node.kind === 'policy') {
      policies.push(node.id);
      continue;
    }
    if (node.kind !== 'appr') continue;
    if (node.when?.rows?.length && !evalCondition(node.when, recAdj) && !floor?.steps.includes(node.id)) {
      notNeeded.push({ nodeId: node.id, roles: node.roles, label: title(node), m: copy.onlyNeededWhen(conditionText(node.when, ctx.catalog)) });
      continue;
    }
    const owned = (node.material ?? []).some((key) => changedFields.includes(key));
    const roles = node.roles.filter((role) => {
      if (!prevRoles.has(role) || owned) return true;
      skipped.push({ nodeId: node.id, role, m: copy.approvedTheOriginal });
      return false;
    });
    if (roles.length > 0) stages.push(...stagesForStep(node, roles, title(node), step.why, rec0));
  }

  // §7.2: rules are skipped when the walk hit Needs information.
  const matching = walk.needInfo.length === 0 ? rulesMatching(rec0, ctx) : [];
  const rules = floor ? [...matching, ...ctx.rules.filter((rule) => floor.rules.includes(rule.id) && !matching.includes(rule))] : matching;
  const flags = addRuleItems(rules, stages, prevRoles, nodes, ctx);

  const { rejected, stopped } = walkOutcome(nodes, walk, ctx);
  const ended = rejected !== null || stopped !== null;
  // §6.11: rule approvers are not asked when the request ends before anyone is asked. Also taken out here, before merging, so no step reads "Covered" by an item that goes away.
  const kept = ended ? stages.filter((stage) => !onlyRuleItems(stage)) : stages;

  const checks: CheckResult[] = walk.steps
    .map((step) => nodes[step.nodeId])
    .filter((node) => node.kind === 'dw' && isCheck(node.worker, ctx))
    .map((node) => checkEntry((node as { worker: string }).worker, rec0, ctx));

  for (const stage of kept) {
    for (const item of stage.items) {
      const node = item.nodeId ? (nodes[item.nodeId] as ApproveNode) : undefined;
      if (item.any) resolveAnyItem(item, rec0, ctx);
      else resolveOneRoleItem(item, node, rec0, recAdj, wf, ctx);
      item.checks = checks;
    }
  }

  let merged = mergeStages(kept, ctx, nodes);
  if (ended) merged = merged.filter((stage) => !onlyRuleItems(stage));
  if (floor) applyFloor(merged, floor, checks);
  merged.forEach((stage, stageIndex) => {
    stage.items.forEach((item) => {
      item.stageIndex = stageIndex;
    });
    for (const task of stage.tasks) {
      task.person = resolveRoleHolder(task.role, rec0, ctx).person ?? '—';
    }
  });

  const needInfo = walk.needInfo.map((hit) => ({
    nodeId: hit.nodeId,
    fields: hit.missing.map((field) => curl(ctx.catalog.FIELD[field]?.l ?? field)),
    owner: needInfoOwner(hit.missing[0], rec0, ctx),
  }));

  const plan: ApprovalPlan = {
    walk,
    stages: merged,
    notNeeded,
    skipped,
    rules,
    flags,
    policies,
    needInfo,
    basis,
    rejected,
    stopped,
    auto: false,
    paused: merged.some((stage) => stage.items.some((item) => item.paused)),
  };
  plan.auto = isAutoApproved(plan, nodes);
  return plan;
}

/**
 * Who is asked for a blank value with no owner of its own (§2.4 step 5): the hiring manager, or the requester, unless the
 * field picks the requester's own approver, which they can't answer (finding 1). Then the person above them; null if nobody is.
 */
export function needInfoPerson(field: string, rec: Rec, ctx: Pick<EngineContext, 'people'>): string | null {
  const first = (rec.hiring_manager as string | undefined) ?? (rec.requester as string);
  if (first !== rec.requester || !PICKS_THE_APPROVER.includes(field)) return first;
  let up: string | undefined = ctx.people.MGR[first];
  for (let hop = 0; up && hop < MOVE_UP_HOPS && up === rec.worker_name; hop += 1) up = ctx.people.MGR[up];
  return up ?? null;
}

/** Engine §2.4 step 5. */
export function needInfoOwner(field: string, rec: Rec, ctx: EngineContext): string {
  const owner = ctx.catalog.FIELD[field]?.owner;
  if (owner) return personLabel(owner, rec, ctx);
  return needInfoPerson(field, rec, ctx) ?? copy.needInfoNobody;
}

/** Engine §10.3: the one-off decision when a Collect & verify with "Ask people to decide" fails (§6.5–§6.10, no rules). */
export function planFailedCheck(collect: CollectNode, rec0: Rec, wf: Pick<Workflow, 'owner'>, ctx: EngineContext, checks: CheckResult[] = []): Stage[] {
  const roles = collect.failRoles ?? [];
  const decision: ApproveLike = { id: collect.id, roles, mode: collect.failMode ?? 'all', label: title(collect) };
  const stages = stagesForStep(decision, roles, title(collect), null, rec0);
  for (const stage of stages) {
    for (const item of stage.items) {
      item.failedCheckOf = collect.id;
      item.checks = checks;
      if (item.any) resolveAnyItem(item, rec0, ctx);
      else resolveOneRoleItem(item, decision, rec0, rec0, wf, ctx);
    }
  }
  return mergeStages(stages, ctx);
}

/** Engine §11.5: one item of a round line. `status` is the §8.4 suffix when the record carries decisions. */
export function itemLabel(item: StageItem, ctx: Pick<EngineContext, 'people'>, status?: string): string {
  const roles = item.roles.map((role) => roleName(ctx, role)).join(' or ');
  const single = item.roles.length === 1 ? item.roles[0] : undefined;
  const people = item.people.map((person) => (single?.startsWith('g:') ? groupDisplay(ctx, single, person) : person)).join(', ');
  const base = roles === curl(people) ? roles : `${roles} (${people})`;
  return status ? `${base}: ${status}` : base;
}

/** Engine §6.13: the plain text every approver and decider receives. */
export function briefFor(item: StageItem, plan: ApprovalPlan, rec0: Rec, wf: Workflow, ctx: EngineContext, nodes: Record<string, WfNode> = wf.draft.nodes): string {
  const stage = plan.stages[item.stageIndex];
  const others = stage ? stage.items.filter((other) => other !== item) : [];
  const stepId = item.nodeId ?? stage?.items.find((other) => other.nodeId)?.nodeId ?? null;
  const step = stepId ? nodes[stepId] : undefined;
  const rule = item.ruleId ? ctx.rules.find((r) => r.id === item.ruleId) : undefined;
  const stepName = item.failedCheckOf ? title(nodes[item.failedCheckOf]) : step ? title(step) : rule?.name ?? '';

  const lines = [copy.briefHeader(stepName, rec0.title, rec0.id as string), whatsAsked(item, others, step, stepName, plan, ctx)];
  if (item.why && !item.ruleId) lines.push(copy.briefWhy(item.why));
  if (rule) lines.push(copy.briefRule(rule.name, conditionText(rule.when, ctx.catalog)));

  const prev = rec0.prev as Rec | undefined;
  if (prev) {
    const changes = changedFieldLines(prev, rec0, ctx);
    lines.push(changes.length > 0 ? copy.briefChanged(changes) : copy.briefChangedNothing);
    if (plan.basis) lines.push(copy.briefBasis(plan.basis.m));
  }
  if (item.checks.length > 0) {
    lines.push(copy.briefChecks(item.checks.map((check) => copy.briefCheck(ctx.dws.DW[check.d]?.n ?? check.d, check.ok, check.m))));
  }
  if (plan.flags.length > 0) {
    lines.push(copy.briefFlags(plan.flags.map((flag) => curl(ctx.catalog.FIELD[flag.field]?.l ?? flag.field))));
  }
  if (item.kept) lines.push(copy.briefKept);
  if (item.onBehalfOf) {
    const { role, person } = item.onBehalfOf;
    lines.push(role ? copy.briefOnBehalfRole(roleName(ctx, role), person) : copy.briefOnBehalfPerson(person));
  }
  return lines.join('\n');
}

function whatsAsked(item: StageItem, others: StageItem[], step: WfNode | undefined, stepName: string, plan: ApprovalPlan, ctx: EngineContext): string {
  if (item.failedCheckOf) return copy.briefFailedCheck(stepName);
  if (step?.kind === 'appr' && step.escalation) return copy.briefEscalation;
  if (item.any) return copy.briefAnyOne(item.roles.map((role) => roleName(ctx, role)));

  const role = item.roles[0];
  if (role.startsWith('g:')) {
    const group = ctx.people.GROUPS[role.slice(2)];
    return copy.briefGroup(group.n, group.mode);
  }
  let suffix = '';
  if (step?.kind === 'appr' && step.mode === 'order') {
    const rounds = plan.stages.filter((stage) => stage.items.some((other) => other.nodeId === step.id));
    const i = rounds.findIndex((stage) => stage.items.includes(item));
    if (rounds.length > 1) suffix = copy.briefStepOf(i + 1, rounds.length);
  } else if (others.length > 0) {
    suffix = copy.briefTogetherWith(others.flatMap((other) => other.people));
  }
  return copy.briefApproveAs(roleName(ctx, role), suffix);
}

function fieldValueText(value: unknown, type: string): string {
  if (value === null || value === undefined) return '';
  if (type === 'money') return fmt(value as number);
  if (type === 'pct') return `${value as number}%`;
  if (type === 'bool') return value ? copy.yes : copy.no;
  if (Array.isArray(value)) return value.map((v) => String(v).replace(/_/g, ' ')).join(', ');
  return String(value);
}

function changedFieldLines(prev: Rec, rec0: Rec, ctx: EngineContext): string[] {
  const lines: string[] = [];
  for (const field of ctx.catalog.FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(prev, field.id)) continue;
    if (JSON.stringify(prev[field.id]) === JSON.stringify(rec0[field.id])) continue;
    lines.push(copy.briefChange(curl(field.l), fieldValueText(prev[field.id], field.t), fieldValueText(rec0[field.id], field.t)));
  }
  return lines;
}
