import { DEFAULT_TITLE, type Catalog, type EventKey, type FieldDef, type ScopeDimKey } from '../model/catalog';
import type { Group, Row } from '../model/condition';
import type { EngineContext } from '../model/context';
import type { Systems } from '../model/helpers';
import type { RoleKey } from '../model/people';
import type {
  ApproveMode,
  ApproveNode,
  CollectNode,
  CondNode,
  CondPath,
  Disposition,
  DwNode,
  Out,
  PathThen,
  Scope,
  SysAction,
  SystemConfig,
  SystemNode,
  TaskNode,
  WaitConfig,
  WfNode,
  Workflow,
} from '../model/workflow';
import { isGroupRow } from './conditions';
import { copy, curl } from './copy';
import { roleName } from './resolve';

export { curl } from './copy';

/** Engine §1.1. */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${sign}$${Number((abs / 1e6).toFixed(2))}M`;
  if (abs >= 1000) return `${sign}$${Number((abs / 1e3).toFixed(1))}K`;
  return `${sign}$${abs}`;
}

/** Engine §1.2. */
export function title(node: Pick<WfNode, 'kind' | 'label'>): string {
  return node.label || DEFAULT_TITLE[node.kind];
}

function rowValueText(row: Row, field: FieldDef): string {
  const v = row.v;
  switch (field.t) {
    case 'money':
      return fmt(v as number | null | undefined);
    case 'pct':
      return v == null ? '' : `${v as number}%`;
    case 'list':
      return String(v ?? '').replace(/_/g, ' ');
    default:
      if (Array.isArray(v)) return v.length > 0 ? v.join(' or ') : copy.pickAValue;
      return String(v ?? '');
  }
}

/** Engine §1.3. */
export function rowText(row: Row | Group, catalog: Pick<Catalog, 'FIELD' | 'OPL'>): string {
  if (isGroupRow(row)) return `(${conditionText(row, catalog)})`;
  const field = catalog.FIELD[row.f];
  if (!field) return copy.unknownField;
  const label = curl(field.l);
  if (field.t === 'bool') return `${label} ${catalog.OPL[row.op]}`;
  return `${label} ${catalog.OPL[row.op]} ${rowValueText(row, field)}`;
}

/** Engine §1.3. */
export function conditionText(cond: { join?: 'all' | 'any'; rows?: (Row | Group)[] }, catalog: Pick<Catalog, 'FIELD' | 'OPL'>): string {
  const rows = cond.rows ?? [];
  if (rows.length === 0) return copy.always;
  return rows.map((row) => rowText(row, catalog)).join(cond.join === 'any' ? ' or ' : ' and ');
}

/** 06 UI-I11: a path's rule in words. */
export const rowsText = (rows: (Row | Group)[], join: 'all' | 'any', catalog: Pick<Catalog, 'FIELD' | 'OPL'>): string => conditionText({ join, rows }, catalog);

/** Engine §1.4. */
export function scopeText(scope: Scope): string {
  const parts = Object.values(scope)
    .filter((values): values is string[] => !!values && values.length > 0)
    .map((values) => values.join(' / '));
  return parts.length > 0 ? parts.join(' · ') : copy.everywhere;
}

/** Engine §1.4: dropdown option labels only. */
export function scopeLabel(key: ScopeDimKey, value: string, ctx: Pick<EngineContext, 'people'>): string {
  const { LE_SHORT, CC } = ctx.people.ORGX;
  if (key === 'legal_entity') return LE_SHORT[value] ?? value;
  if (key === 'cost_center') return `${value} ${CC[value] ?? ''}`.trim();
  return value;
}

/** Engine §1.5. */
export function roleList(keys: RoleKey[], ctx: Pick<EngineContext, 'people'>): string {
  const names = keys.map((key) => roleName(ctx, key));
  return names.length <= 2 ? names.join(' + ') : copy.moreRoles(names[0], names.length - 1);
}

/** Engine §1.6. */
export function evName(wf: Pick<Workflow, 'event' | 'days'>, catalog: Pick<Catalog, 'EVENTS'>, event: EventKey = wf.event): string {
  if (event === 'end_30') return copy.endDateInDays(wf.days ?? 30);
  if (event === 'doc_expiring') return copy.documentExpiringInDays(wf.days ?? 30);
  return catalog.EVENTS[event];
}

/** Engine §1.6. */
export function fromText(wf: Pick<Workflow, 'source'>, catalog: Pick<Catalog, 'SOURCES'>): string {
  return wf.source && wf.source !== 'levv' ? ` in ${catalog.SOURCES[wf.source]}` : '';
}

/** Engine §1.6: the Start box title. */
export function startTitle(wf: Pick<Workflow, 'records' | 'event' | 'days' | 'source'>, catalog: Catalog): string {
  return `${catalog.RECORDS[wf.records[0]]} ${evName(wf, catalog).toLowerCase()}${fromText(wf, catalog)}`;
}

/** Engine §1.8. */
export function waitText(w: WaitConfig, long: boolean, catalog: Pick<Catalog, 'WAIT_DATES' | 'WAIT_UNITS'>): string {
  if (w.mode === 'for') return copy.waitsFor(w.amount, catalog.WAIT_UNITS[w.unit ?? 'days']);
  if (w.mode === 'at') return w.at ? copy.waitUntilAt(w.at) : copy.pickDateTime;
  const date = catalog.WAIT_DATES[w.field ?? 'start_date'];
  const offset = w.amount ? copy.waitOffset(w.amount, catalog.WAIT_UNITS[w.unit ?? 'days'], w.dir ?? 'before') : '';
  const zone = long ? (w.tz === 'worker' ? copy.inWorkerZone : copy.companyTime) : '';
  return `${long ? copy.waitsUntil : copy.until}${offset}${offset ? date.toLowerCase() : date}${w.time ? `, ${w.time}` : ''}${zone}`;
}

/** Engine §1.8 `ensureWait`, load only: builds `w` from the legacy `until` text. */
export function ensureWait(until: string | undefined): WaitConfig {
  const text = (until ?? '').toLowerCase();
  if (text.includes('start date')) {
    const offset = /(minus|plus) (\d+) day/.exec(text);
    return {
      mode: 'date',
      field: 'start_date',
      amount: offset ? Number(offset[2]) : 0,
      unit: 'days',
      dir: offset?.[1] === 'plus' ? 'after' : 'before',
      time: '09:00',
      tz: 'worker',
    };
  }
  if (text.includes('end date') || text.includes('last day')) {
    return { mode: 'date', field: 'end_date', amount: 0, unit: 'days', dir: 'before', time: '17:00', tz: 'worker' };
  }
  return { mode: 'for', amount: 2, unit: 'days' };
}

/** Engine §1.9. */
export function dispOf(node: { kind: WfNode['kind']; disp?: Disposition; gives?: string }): Disposition {
  if (node.disp) return node.disp;
  if (node.kind === 'system') return 'remove';
  const gives = node.gives ?? '';
  if (/laptop|badge|phone|equipment/i.test(gives)) return 'return';
  if (/nda|obligation|confidential/i.test(gives)) return 'retain';
  return 'remove';
}

/** The node fields `ensureSys` reads, including the legacy `actions`. */
export interface EnsureSysInput {
  label: string;
  system: string;
  sys?: Partial<SystemConfig>;
  actions?: string[];
}

function sysAction(input: EnsureSysInput, actions: string[]): SysAction {
  if (actions.includes('reconcile') && !actions.includes('push')) return 'check';
  if (actions.includes('push')) return /remove|close|deactiv|end /i.test(input.label) ? 'close' : 'create';
  if (actions.includes('pull')) return 'read';
  return 'create';
}

/** Engine §1.10 `ensureSys`: used when `sys` is missing or `sys.system !== node.system`. */
export function ensureSys(input: EnsureSysInput, systems: Systems): SystemConfig {
  const actions = input.actions ?? ['push'];
  const def = systems.SYS[input.system] ?? systems.SYS.Workday;
  const previous = input.sys?.object;
  const object = previous !== undefined && def.obj.includes(previous) ? previous : def.obj[0];
  const map = systems.SYS_MAP[object] ?? systems.SYS_MAP._;
  return {
    system: input.system,
    action: sysAction(input, actions),
    object,
    match: (systems.SYS_KEY[input.system] ?? ['Work email'])[0],
    map: map.map(([from, to]): [string, string] => [from, to]),
    read: actions.includes('pull') ? [def.back[0]] : [],
    wait: 'confirm',
    waitH: 24,
    state: 'Completed',
    onFail: 'task',
    failRole: 'people_ops',
    retries: 3,
    check: actions.includes('reconcile'),
  };
}

/** Engine §1.10. */
export function sysShort(node: Pick<SystemNode, 'sys'>, systems: Pick<Systems, 'SYS_ACT'>): string {
  const { system, action, object } = node.sys;
  if (action === 'check') return copy.sysCheckShort(system);
  if (action === 'wait') return copy.sysWaitShort(object.toLowerCase(), system);
  return copy.sysActionShort(systems.SYS_ACT[action], object.toLowerCase(), system);
}

/** Engine §1.10. */
export function sysSentence(node: Pick<SystemNode, 'sys'>, ctx: Pick<EngineContext, 'systems' | 'people'>): string {
  const { system, action, match, map, read, wait, waitH, check, failRole } = node.sys;
  if (ctx.systems.SYS[system]?.st === 'off') {
    return copy.sysNotConnected(system, failRole ? roleName(ctx, failRole) : copy.theOwner);
  }
  const first = sysShort(node, ctx.systems) + (action === 'create' || action === 'update' ? copy.sysMatched(match, map.length) : '');
  const parts = [first];
  if (read.length > 0) parts.push(copy.sysReadsBack(read));
  if (wait === 'confirm' && action !== 'read') parts.push(copy.sysConfirm(waitH, system));
  if (check || action === 'check') parts.push(copy.sysThenChecks);
  return parts.join('; ');
}

/** Engine §1.11. */
export function dwContext(wf: Pick<Workflow, 'records'>): 'onboarding' | 'offboarding' | 'access' | 'workflows' {
  const record = wf.records[0];
  if (record === 'onboarding' || record === 'offboarding') return record;
  return record === 'access_request' ? 'access' : 'workflows';
}

/** Engine §1.11. */
export function dwsFor(wf: Pick<Workflow, 'records'>, ctx: Pick<EngineContext, 'dws'>) {
  return ctx.dws.DW_SET[dwContext(wf)].map((id) => ctx.dws.DW[id]);
}

/** Engine §1.12. */
export function chaseDefaults(node: { kind: WfNode['kind']; remind?: number; sla?: number }): { remind: number; sla: number } {
  const approve = node.kind === 'appr';
  return { remind: node.remind ?? (approve ? 24 : 48), sla: node.sla ?? (approve ? 48 : 96) };
}

/** Engine §1.12. */
export function chaseTo(node: { kind: WfNode['kind']; from?: CollectNode['from'] }): string {
  if (node.kind === 'collect' && (node.from === undefined || node.from === 'worker' || node.from === 'supplier_am')) {
    return copy.theHiringManager;
  }
  return copy.theirManager;
}

/** 06 EN-122: what the Chaser box shows for a step that waits on a person. */
export function chaserFor(node: ApproveNode | TaskNode | CollectNode) {
  const { remind, sla } = chaseDefaults(node);
  const escalateTo = chaseTo(node);
  return { remindAfterHours: remind, escalateAfterHours: sla, escalateTo, label: copy.chaserEscalateLabel(escalateTo) };
}

/** Engine §5.4: who approves, derived when it is not stored. */
export function whoMode(node: Pick<ApproveNode, 'who' | 'roles'>): 'roles' | 'group' | 'person' {
  if (node.who) return node.who;
  if (node.roles.some((role) => role.startsWith('g:'))) return 'group';
  return node.roles.some((role) => role.startsWith('p:')) ? 'person' : 'roles';
}

/** Engine §16.3: what a path does. */
export function pathMode(nodes: Record<string, WfNode>, condId: string, outKey: string): PathThen {
  const cond = nodes[condId] as CondNode;
  const out = cond.outs.find((o) => o.key === outKey) as Out & Partial<CondPath>;
  const isElse = outKey === 'else';
  const stored = isElse ? cond.elseDo : out.do;
  const generated = isElse ? cond.elseNode : out.node;
  if (stored && stored !== 'continue' && generated && out.to === generated) return stored;
  const target = nodes[out.to];
  if (target?.kind === 'end' && target.outcome === 'rejected') return 'reject';
  if (out.to === cond.mergeAt) return 'continue';
  return 'custom';
}

function reachableFrom(nodes: Record<string, WfNode>, start: string | undefined): Set<string> {
  const seen = new Set<string>();
  const stack = start ? [start] : [];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id) || !nodes[id]) continue;
    seen.add(id);
    for (const out of nodes[id].outs ?? []) stack.push(out.to);
  }
  return seen;
}

/** Reverse postorder: every step comes after the steps that lead to it (04 §7.2 "in topological order"). */
function inPathOrder(nodes: Record<string, WfNode>, start: string): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (id: string): void => {
    if (seen.has(id) || !nodes[id]) return;
    seen.add(id);
    const outs = nodes[id].outs ?? [];
    for (let i = outs.length - 1; i >= 0; i -= 1) visit(outs[i].to);
    order.push(id);
  };
  visit(start);
  return order.reverse();
}

/** Engine §16.3: titles of the steps only this path has, in path order. */
export function laneSteps(nodes: Record<string, WfNode>, condId: string, outKey: string): string[] {
  const cond = nodes[condId] as CondNode;
  const out = cond.outs.find((o) => o.key === outKey) as Out;
  const afterMerge = reachableFrom(nodes, cond.mergeAt);
  return inPathOrder(nodes, out.to)
    .filter((id) => !afterMerge.has(id) && nodes[id].kind !== 'end')
    .map((id) => title(nodes[id]));
}

const pathWho = (cond: CondNode, out: Out & Partial<CondPath>): string | undefined => (out.key === 'else' ? cond.elseWho : out.who);

/** Engine §16.4: the If card row text ("carries on", "approval · {who}", …). */
export function pathCardRow(nodes: Record<string, WfNode>, condId: string, outKey: string, ctx: Pick<EngineContext, 'people'>): string {
  const cond = nodes[condId] as CondNode;
  const out = cond.outs.find((o) => o.key === outKey) as Out & Partial<CondPath>;
  const who = pathWho(cond, out);
  const whoName = who ? roleName(ctx, who) : '';
  switch (pathMode(nodes, condId, outKey)) {
    case 'continue':
      return copy.cardCarriesOn;
    case 'approve':
      return copy.cardApproval(whoName);
    case 'escalate':
      return copy.cardEscalate(whoName);
    case 'reject':
      return copy.cardRejected;
    case 'stop':
      return copy.cardStop;
    default: {
      const lane = laneSteps(nodes, condId, outKey);
      return lane.length > 0 ? copy.cardLane(lane[0], lane.length - 1) : copy.cardOwnSteps;
    }
  }
}

/** Engine §18.1: one-line If text (screen-reader label, picker search). */
function ifLine(nodes: Record<string, WfNode>, cond: CondNode, ctx: Pick<EngineContext, 'people'>): string {
  const bits: string[] = [];
  for (const out of cond.outs as (Out & Partial<CondPath>)[]) {
    const mode = pathMode(nodes, cond.id, out.key);
    const who = pathWho(cond, out);
    const whoName = who ? roleName(ctx, who) : '';
    const tail =
      mode === 'approve' ? copy.lineApproval(whoName)
      : mode === 'escalate' ? copy.lineEscalated(whoName)
      : mode === 'reject' ? copy.cardRejected
      : mode === 'stop' ? copy.cardStop
      : '';
    if (out.key === 'else' && !tail) continue;
    bits.push(`${out.label ?? ''}${tail ? `: ${tail}` : ''}`);
  }
  return bits.join(' · ');
}

function approveSubtitle(node: ApproveNode, ctx: Pick<EngineContext, 'people' | 'catalog'>): string {
  if (node.roles.length === 0) return copy.chooseWhoApproves;
  const who = whoMode(node);
  let text: string;
  if (who === 'person') {
    text = roleList(node.roles, ctx) + (node.backup ? copy.backupSuffix(node.backup) : copy.noBackupSuffix);
  } else if (who === 'group') {
    text = roleName(ctx, node.roles[0]);
  } else {
    text = (node.roles.length >= 2 ? copy.subtitleMode[node.mode ?? 'all'] : '') + roleList(node.roles, ctx);
  }
  return node.when?.rows?.length ? text + copy.onlyIfSuffix(conditionText(node.when, ctx.catalog)) : text;
}

/** Engine §18.1. */
export function subtitle(wf: Pick<Workflow, 'scope' | 'draft'>, node: WfNode, ctx: EngineContext): string {
  const nodes = wf.draft.nodes;
  switch (node.kind) {
    case 'trigger':
      return scopeText(wf.scope);
    case 'cond':
      return ifLine(nodes, node, ctx);
    case 'appr':
      return approveSubtitle(node, ctx);
    case 'policy':
      return copy.receiptKept;
    case 'plan': {
      const out = nodes[node.outs.find((o) => o.key === 'out')?.to ?? ''];
      return out?.kind === 'appr' && out.roles.length > 0 ? copy.outsidePlanSubtitle(roleList(out.roles, ctx)) : node.plan;
    }
    case 'dw':
      return dwSubtitle(node, ctx);
    case 'collect':
      return collectSubtitle(node, ctx);
    case 'task':
      return node.role ? roleName(ctx, node.role) : copy.unassigned;
    case 'system':
      return sysShort(node, ctx.systems) + (node.gives ? copy.givesSuffix(node.gives) : '');
    case 'notify':
      return roleList(node.recipients, ctx);
    case 'wait':
      return waitText(node.w, false, ctx.catalog);
    case 'parallel':
      return node.outs.map((out) => out.label).join(' · ');
    case 'runwf':
      return ctx.workflows.find((w) => w.id === node.target)?.name ?? copy.pickWorkflow;
    case 'end':
      return node.outcome.charAt(0).toUpperCase() + node.outcome.slice(1);
    default:
      return '';
  }
}

function dwSubtitle(node: DwNode, ctx: Pick<EngineContext, 'dws' | 'people'>): string {
  if (!ctx.dws.CHECK_DW.includes(node.worker)) return ctx.dws.DW[node.worker]?.n ?? '';
  const flag = node.flagDo ?? 'note';
  if (flag === 'escalate') return copy.flagSubtitle.escalate(node.flagWho ? roleName(ctx, node.flagWho) : '');
  return copy.flagSubtitle[flag];
}

function collectSubtitle(node: CollectNode, ctx: Pick<EngineContext, 'people' | 'presets'>): string {
  const checker = ctx.presets.CHECKERS[node.checker] ?? node.checker;
  const reviewer = roleName(ctx, node.reviewer);
  const short = node.verify === 'person' ? reviewer : node.verify === 'auto_person' ? copy.thenReviewer(checker, reviewer) : checker;
  return [copy.provides(roleName(ctx, node.from ?? 'worker')), short].join(' · ');
}

/** Engine §18.2. */
export function mergeTitle(nodes: Record<string, WfNode>, cond: Pick<CondNode, 'mergeAt'>): string {
  const merge = cond.mergeAt ? nodes[cond.mergeAt] : undefined;
  return merge && cond.mergeAt !== 'END' ? title(merge) : copy.endTitle;
}

/** Engine §18.2. */
export function ifTopLine(nodes: Record<string, WfNode>, cond: CondNode): string {
  const otherwise = cond.outs.find((out) => out.key === 'else');
  return copy.ifTopLine(otherwise?.label ?? copy.otherwise, mergeTitle(nodes, cond));
}

/** Engine §18.3. */
export function approveSentence(node: ApproveNode, ctx: Pick<EngineContext, 'people'>): string | null {
  const who = whoMode(node);
  if (who === 'group') {
    const group = ctx.people.GROUPS[(node.roles[0] ?? '').slice(2)];
    return group ? copy.approveGroupSentence(group.n, group.members, group.mode) : null;
  }
  if (who === 'person') return node.roles.length > 0 ? copy.approvePersonSentence : null;
  if (node.roles.length === 0) return copy.approvePickRoles;
  const mode: ApproveMode = node.mode ?? 'all';
  return copy.approveRolesSentence(node.roles.map((key) => roleName(ctx, key)), node.roles.length >= 2 ? copy.approveHowMany[mode] : '');
}
