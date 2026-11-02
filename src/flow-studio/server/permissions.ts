import { copy } from '../engine/copy';
import type { Permission } from '../model/runtime';
import type { Workflow } from '../model/workflow';
import { forbidden } from './errors';

/** Decision 5. Who someone is comes from `id` and `person`, and neither is theirs to change. */
export interface Actor {
  id?: string;                             // the account: the Django user id. Authorship and audit lines are checked by this
  name: string;                            // what the screen and audit lines show: the linked person, or the account's email
  person?: string | null;                  // the reference-data person this account is linked to. Null: no inbox, nobody's approver
  email?: string;
  permissions: Permission[];
  ownerTeams: Record<string, string[]>;    // 01 §6.2: team name → account ids, from the tenant's links
}

/**
 * The person an actor acts as. A signed-in actor always has `person` set, null when unlinked: session.ts is the only place
 * that makes one from a real session. Absent means an in-process caller naming a test actor directly, as 06's tests do.
 */
export const personOf = (actor: Pick<Actor, 'name' | 'person'>): string | null => (actor.person === undefined ? actor.name : actor.person);

/** 01 §5: `admin` implies every permission. */
export const can = (actor: Actor, permission: Permission): boolean =>
  actor.permissions.includes(permission) || actor.permissions.includes('admin');

export function requirePermission(actor: Actor, permission: Permission, message?: string): void {
  if (!can(actor, permission)) throw forbidden(message);
}

export const ownsWorkflow = (actor: Actor, workflow: Pick<Workflow, 'owner'>): boolean =>
  workflow.owner === personOf(actor) || (actor.ownerTeams[workflow.owner] ?? []).includes(actor.id ?? actor.name);

/** 01 §5.2, 05 §4. */
export function requireRunControl(actor: Actor, workflow: Pick<Workflow, 'owner'>): void {
  if (!can(actor, 'runs.control') && !ownsWorkflow(actor, workflow)) throw forbidden(copy.runControlForbidden);
}
