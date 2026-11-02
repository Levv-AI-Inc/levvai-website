import type { EngineContext } from '../model/context';
import type { RoleDef, RoleKey } from '../model/people';
import { copy, curl } from './copy';
import type { Rec } from './conditions';

type PeopleCtx = Pick<EngineContext, 'people' | 'asOf'>;

/** §15 step 2: a named person's pseudo role exists on demand, so graphs built while editing never need a store write. */
export function roleDef(ctx: Pick<EngineContext, 'people'>, key: RoleKey): RoleDef | undefined {
  const known = ctx.people.ROLES[key];
  if (known) return known;
  return key.startsWith('p:') ? { n: key.slice(2), c: 3, person: true } : undefined;
}

/** Role name for display; seed labels are curled (03 §0). */
export const roleName = (ctx: Pick<EngineContext, 'people'>, key: RoleKey): string => curl(roleDef(ctx, key)?.n ?? key);

/** Engine §6.7 B7. */
export function isAway(ctx: PeopleCtx, person: string): boolean {
  const away = ctx.people.OOO[person];
  if (!away) return false;
  return ctx.asOf <= away.until && (!away.from || ctx.asOf >= away.from);
}

/** Engine §6.8 step 1: the members who are asked. */
export function groupMembers(ctx: PeopleCtx, key: string, rec: Rec): string[] {
  const group = ctx.people.GROUPS[key];
  const eligible = group.members.filter((member) => member !== rec.requester && member !== rec.worker_name && !isAway(ctx, member));
  return eligible.length > 0 ? eligible : group.members;
}

/** Engine §6.8 step 1. */
export function groupText(ctx: PeopleCtx, key: string, rec: Rec): string {
  const group = ctx.people.GROUPS[key];
  return copy.groupText(group.n, group.mode, groupMembers(ctx, key, rec));
}

/** Who raised it, who the worker is, and what picks who approves (§6.6). A requester choosing these chooses their approver. */
export const PICKS_THE_APPROVER = ['requester', 'hiring_manager', 'sponsor', 'sponsor_delegate', 'worker_name', 'business_unit', 'country', 'cost_center', 'cost_centers'];

/**
 * Engine §6.6: one resolver for approvers, reviewers, task owners, deciders and recipients (D10).
 * `null` means nobody eligible.
 */
export function resolveRoleHolder(role: RoleKey, rec: Rec, ctx: PeopleCtx, cc?: string): { person: string | null } {
  const { ORG, MGR, BY_COUNTRY, CENTRAL, ROLES } = ctx.people;
  if (role.startsWith('g:')) return { person: groupText(ctx, role.slice(2), rec) };
  if (role.startsWith('p:')) return { person: role.slice(2) };

  const hiringManager = rec.hiring_manager as string | undefined;
  if (role === 'hm' && hiringManager) return { person: hiringManager };
  if (role === 'hm_mgr' && hiringManager) return { person: MGR[hiringManager] ?? null };
  if (role === 'cco' && cc) return { person: ORG[cc]?.cco ?? null };

  const byCountry = BY_COUNTRY[role];
  if (byCountry && Object.prototype.hasOwnProperty.call(byCountry, rec.country as string)) {
    return { person: byCountry[rec.country as string] };
  }

  const org = ORG[rec.business_unit as string];
  if (role === 'worker') return { person: (rec.worker_name as string | undefined) ?? copy.theWorker };
  if (role === 'sponsor') return { person: (rec.sponsor as string | undefined) ?? hiringManager ?? org?.hm ?? copy.theSponsor };
  if (role === 'sow_owner') return { person: org?.hm ?? copy.sowOwnerPlaceholder };

  const holder = (org as Record<string, string> | undefined)?.[role];
  return { person: holder ?? CENTRAL[role] ?? ROLES[role]?.n ?? role };
}

/** Engine §6.8 and §11.5: the display drops the group name repeated in the text (D11). */
export function groupDisplay(ctx: Pick<EngineContext, 'people'>, role: RoleKey, text: string): string {
  const name = roleDef(ctx, role)?.n ?? '';
  return text.startsWith(`${name}: `) ? text.slice(name.length + 2) : text;
}

/** Engine §1.7. */
export function personLabel(role: RoleKey, rec: Rec, ctx: PeopleCtx): string {
  const name = roleName(ctx, role);
  const person = resolveRoleHolder(role, rec, ctx).person;
  if (person === null) return name;
  if (role.startsWith('g:')) return `${name} (${groupDisplay(ctx, role, person)})`;
  if (person.startsWith('the ') || curl(person) === name) return person;
  const delegate = role === 'sponsor' && rec.sponsor_delegate ? copy.delegateSuffix(rec.sponsor_delegate as string) : '';
  return `${name} (${person}${delegate})`;
}
