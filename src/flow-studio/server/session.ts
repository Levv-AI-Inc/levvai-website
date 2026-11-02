import { createDjangoDriver } from '../data/django/driver';
import type { AccountLink, Permission } from '../model/runtime';
import { backendConfig, createBackendClient, userIdentity } from './backend-client';
import { E2E_COOKIE, e2eState, isE2E, readE2ESession } from './e2e';
import { ApiError } from './errors';
import type { Actor } from './permissions';

export interface DjangoSession {
  authenticated?: boolean;
  user?: { id?: number | string; email?: string };
  membership?: { role?: string } | null;
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}

/** LEVV_E2E=1: the signed cookie of /api/test/sign-in, with permissions from the loaded actor set. A test actor is its own account and its own person. */
export function e2eActor(request: Request): Actor | null {
  const name = readE2ESession(cookieValue(request, E2E_COOKIE));
  if (!name) return null;
  const set = e2eState().actors;
  const listed = set?.users.find((user) => user.name === name);
  return { id: name, name, person: name, permissions: (listed?.permissions ?? []) as Permission[], ownerTeams: set?.ownerTeams ?? {} };
}

/**
 * Decision 5, as replaced by the post-build review. Authority comes from the Django user id and the tenant's link, and
 * first_name and last_name are never read: anyone can set theirs with PATCH /auth/user/. A linked account is its person
 * everywhere; an unlinked one shows as its email, which that route can't change, and holds no person identity.
 */
export function actorFromSession(session: DjangoSession, link: AccountLink | null): Actor | null {
  if (!session.authenticated || !session.user || session.user.id === undefined) return null;
  const id = String(session.user.id);
  const email = session.user.email ?? '';
  const person = session.membership ? link?.person ?? null : null;
  const teams = session.membership ? link?.teams ?? [] : [];
  return {
    id,
    name: person ?? (email || `Account ${id}`),
    person,
    email,
    // Decision 5: tenant role `admin` means every permission, anyone else has none.
    permissions: session.membership?.role === 'admin' ? ['admin'] : [],
    ownerTeams: Object.fromEntries(teams.map((team) => [team, [id]])),
  };
}

/** Fetched per request, uncached: unlinking someone or ending their membership takes effect on their next request. */
async function djangoActor(request: Request): Promise<Actor | null> {
  if (!cookieValue(request, 'sessionid')) return null;
  const client = createBackendClient(backendConfig(), userIdentity(request));
  const response = await client.session();
  if (response.status === 401 || response.status === 403) return null;
  if (response.status !== 200) throw new ApiError(503, 'STORE_UNAVAILABLE', `The session check answered ${response.status}.`);
  const session = (await response.json()) as DjangoSession;
  if (!session.authenticated || !session.user || session.user.id === undefined) return null;
  // Only a member of this tenant can hold a link in it: anyone else's session the store refuses, so it isn't asked.
  const row = session.membership ? await createDjangoDriver(client).get('links', String(session.user.id)) : null;
  return actorFromSession(session, (row?.doc as AccountLink | undefined) ?? null);
}

export const currentActor = (request: Request): Promise<Actor | null> =>
  isE2E() ? Promise.resolve(e2eActor(request)) : djangoActor(request);
