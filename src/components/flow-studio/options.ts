import { curl } from '@flow-studio/engine/copy';
import { roleName } from '@flow-studio/engine/resolve';
import { evName, scopeLabel } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { FieldDef, ScopeDimKey } from '@flow-studio/model/catalog';
import type { CollectNode, Workflow } from '@flow-studio/model/workflow';
import type { SelectOption } from './SelectMenu';

/** The option sets of 04 §6.7 and §7, built from the seed so names are never written twice. */

const roleOption = (ctx: Pick<EngineContext, 'people'>, key: string): SelectOption => ({ value: key, label: curl(roleName(ctx, key)) });
const plainRoles = (ctx: Pick<EngineContext, 'people'>): string[] => Object.keys(ctx.people.ROLES).filter((key) => !key.startsWith('g:') && !key.startsWith('p:'));

/** 04 §6.7 APPROVER_ROLES: no worker, and nobody in NOAPPR. */
export function approverRoleOptions(ctx: Pick<EngineContext, 'people'>): SelectOption[] {
  return plainRoles(ctx)
    .filter((key) => !ctx.people.NOAPPR.includes(key))
    .map((key) => roleOption(ctx, key));
}

/** A saved step can hold a role its list does not offer (a generated failed-check escalation, a named person). It still reads by name. */
export function withCurrent(options: SelectOption[], values: string[], ctx: Pick<EngineContext, 'people'>): SelectOption[] {
  const known = new Set(options.map((option) => option.value));
  const extra = values.filter((value) => value && !known.has(value)).map((value) => roleOption(ctx, value));
  return extra.length > 0 ? [...extra, ...options] : options;
}

const groupOptions = (ctx: Pick<EngineContext, 'people'>, group?: string): SelectOption[] =>
  Object.entries(ctx.people.GROUPS).map(([key, value]) => ({ value: `g:${key}`, label: value.n, group }));

/** 04 §6.7 ACTOR_ROLES: ASSIGNEE_ROLES without Worker, groups under their own header. */
export function actorRoleOptions(ctx: Pick<EngineContext, 'people'>): SelectOption[] {
  return [
    ...plainRoles(ctx)
      .filter((key) => key !== 'worker')
      .map((key) => ({ ...roleOption(ctx, key), group: 'Roles' })),
    ...groupOptions(ctx, 'Approval groups'),
  ];
}

/** 04 §6.7 ASSIGNEE_ROLES: Worker first, groups under their own header. */
export function assigneeRoleOptions(ctx: Pick<EngineContext, 'people'>): SelectOption[] {
  return [...plainRoles(ctx).map((key) => ({ ...roleOption(ctx, key), group: 'Roles' })), ...groupOptions(ctx, 'Approval groups')];
}

/** 04 §6.7 DECIDER_ROLES: every plain role but the worker, with the operational ones last, as the seed orders them. */
export function deciderRoleOptions(ctx: Pick<EngineContext, 'people'>): SelectOption[] {
  return plainRoles(ctx)
    .filter((key) => key !== 'worker')
    .map((key) => roleOption(ctx, key));
}

/** 04 §6.7 WHO_TARGETS. */
export function whoTargetOptions(ctx: Pick<EngineContext, 'people'>): SelectOption[] {
  return [
    ...approverRoleOptions(ctx).map((option) => ({ ...option, group: 'Roles' })),
    ...groupOptions(ctx, 'Approval groups'),
    ...peopleOptions(ctx).map((option) => ({ value: `p:${option.value}`, label: option.label, group: 'A named person' })),
  ];
}

/** 04 §6.7 FYI_ROLES. */
export function fyiRoleOptions(ctx: Pick<EngineContext, 'people'>, noOne: string): SelectOption[] {
  return [{ value: '', label: noOne }, ...actorRoleOptions(ctx)];
}

/** 04 §6.7 FINAL_REJECT_ROLES: Worker, Sponsor, then the rest, no groups. */
export const finalRejectOptions = (ctx: Pick<EngineContext, 'people'>): SelectOption[] => plainRoles(ctx).map((key) => roleOption(ctx, key));

/** 04 §6.7 PROVIDERS. */
export const providerOptions = (ctx: Pick<EngineContext, 'people'>): SelectOption[] =>
  ['worker', 'sponsor', 'supplier_am', 'hm', 'it'].map((key) => roleOption(ctx, key));

/** 04 §6.7 PLAN_OUTSIDE. */
export const planOutsideOptions = (ctx: Pick<EngineContext, 'people'>): SelectOption[] =>
  ['cco', 'dh', 'hm_mgr', 'fbp', 'vpf'].map((key) => roleOption(ctx, key));

const OWNER_TEAMS = ['Accounts payable', 'Compliance', 'Finance operations', 'HR operations', 'IT operations', 'Information Security', 'Legal operations', 'Procurement operations', 'Security operations', 'Tax'];

/** 04 §6.7 OWNERS: the teams plus any other team already used as an owner, sorted, then the people. */
export function ownerOptions(ctx: Pick<EngineContext, 'people' | 'workflows'>, teamsLabel: string, personLabel: string): SelectOption[] {
  const people = peopleOptions(ctx);
  const isPerson = (owner: string): boolean => people.some((option) => option.value === owner);
  const teams = Array.from(new Set([...OWNER_TEAMS, ...ctx.workflows.map((workflow) => workflow.owner).filter((owner) => owner && !isPerson(owner))])).sort();
  return [...teams.map((team) => ({ value: team, label: team, group: teamsLabel })), ...people.map((option) => ({ ...option, group: personLabel }))];
}

/** 04 §7.15: every other workflow, by name, grouped like the picker. */
export function otherWorkflowOptions(workflowId: string, summaries: { id: string; name: string; recordType: string; event: string }[], ctx: Pick<EngineContext, 'catalog' | 'workflows'>): SelectOption[] {
  return summaries
    .filter((summary) => summary.id !== workflowId)
    .map((summary) => {
      const workflow = ctx.workflows.find((candidate) => candidate.id === summary.id);
      const event = evName({ event: summary.event as Workflow['event'], days: workflow?.days }, ctx.catalog);
      return { value: summary.id, label: summary.name, group: `${ctx.catalog.RECORDS[summary.recordType as keyof typeof ctx.catalog.RECORDS]} · ${event}` };
    });
}

/** 04 §7.1 "Starts from": Levv, then each system. */
export function sourceOptions(ctx: Pick<EngineContext, 'catalog'>, label: (system: string) => string): SelectOption[] {
  return Object.entries(ctx.catalog.SOURCES).map(([value, name]) => ({ value, label: value === 'levv' ? name : label(name) }));
}

/** 04 §6.8: the value list of an enum or list field; Cost center and Legal entity read as in Applies to. */
export function conditionValueOptions(field: FieldDef, ctx: Pick<EngineContext, 'people' | 'catalog'>): SelectOption[] {
  const options = field.o ?? [];
  if (field.t === 'list') return options.map((value) => ({ value, label: value.replace(/_/g, ' ') }));
  if (field.id === 'cost_center' || field.id === 'legal_entity') return options.map((value) => ({ value, label: scopeLabel(field.id as ScopeDimKey, value, ctx) }));
  return options.map((value) => ({ value, label: curl(value) }));
}

/** 04 §6.8: every field, under its group. */
export const conditionFieldOptions = (ctx: Pick<EngineContext, 'catalog'>): SelectOption[] =>
  ctx.catalog.FIELDS.map((field) => ({ value: field.id, label: curl(field.l), group: field.g }));

export const approvalGroupOptions = (ctx: Pick<EngineContext, 'people'>): SelectOption[] => groupOptions(ctx);

/** 04 §6.7 PEOPLE: "{Name} · {Title}" when a title exists. */
export function peopleOptions(ctx: Pick<EngineContext, 'people'>): SelectOption[] {
  return ctx.people.PEOPLE.map((name) => {
    const title = ctx.people.TITLES[name];
    return { value: name, label: title ? `${name} · ${title}` : name };
  });
}

/** 04 §7.1 item 9: the option values are the field's own, labelled for reading. */
export function scopeOptions(key: ScopeDimKey, ctx: Pick<EngineContext, 'people' | 'catalog'>): SelectOption[] {
  return (ctx.catalog.FIELD[key]?.o ?? []).map((value) => ({ value, label: scopeLabel(key, value, ctx) }));
}

/** 04 §7.1 item 4: "{Record} {event in lower case}", grouped by record; "N" unless the option is the selected one. */
export function runsWhenOptions(workflow: Pick<Workflow, 'event' | 'days' | 'records'>, ctx: Pick<EngineContext, 'catalog'>): SelectOption[] {
  const { RECORDS, EVENTS_FOR, DAY_EVENTS } = ctx.catalog;
  const options: SelectOption[] = [];
  for (const [record, name] of Object.entries(RECORDS)) {
    for (const event of EVENTS_FOR[record as keyof typeof RECORDS] ?? []) {
      const label = evName({ event, days: workflow.days }, ctx.catalog);
      const selected = event === workflow.event && record === workflow.records[0];
      const generic = DAY_EVENTS.includes(event) && !selected ? label.replace(/\d+/, 'N') : label;
      options.push({ value: `${record}|${event}`, label: `${name} ${generic.toLowerCase().replace(/\bn\b/, 'N')}`, group: name });
    }
  }
  return options;
}

const collectNodes = (ctx: Pick<EngineContext, 'workflows'>): CollectNode[] =>
  ctx.workflows.flatMap((workflow) => Object.values(workflow.draft.nodes).filter((node): node is CollectNode => node.kind === 'collect'));

/** 04 §7.8 item 5: common items plus every item in use; selected first in their order, then the rest alphabetically. */
export function requiredItemOptions(selected: string[], ctx: Pick<EngineContext, 'catalog' | 'workflows'>): SelectOption[] {
  const known = new Set<string>([...ctx.catalog.REQ_COMMON, ...collectNodes(ctx).flatMap((node) => node.items ?? [])]);
  const rest = Array.from(known)
    .filter((item) => !selected.includes(item))
    .sort((a, b) => a.localeCompare(b));
  return [...selected, ...rest].map((item) => ({ value: item, label: curl(item) }));
}

export const materialOptions = (ctx: Pick<EngineContext, 'catalog'>): SelectOption[] =>
  Object.entries(ctx.catalog.MATERIAL).map(([value, label]) => ({ value, label: String(label) }));
