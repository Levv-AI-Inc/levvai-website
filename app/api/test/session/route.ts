import { can } from '@flow-studio/server/permissions';
import { json } from '@flow-studio/server/route';
import { e2eActor } from '@flow-studio/server/session';
import { testOnly } from '@flow-studio/server/test-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Answers /api/session under LEVV_E2E=1 through a middleware rewrite, so the app shell and admin layout work without Django. */
export const GET = testOnly(async (request) => {
  const actor = e2eActor(request);
  if (!actor) return json({ authenticated: false }, 401);
  const [first_name, ...rest] = actor.name.split(' ');
  // The role decides what the admin layout lets in; real permissions always come from the actor set (decision 5).
  const role = can(actor, 'admin') || can(actor, 'flow.edit') ? 'admin' : 'viewer';
  const membership = { role, profile_type: 'tenant_user' };
  return json({
    authenticated: true,
    user: { id: actor.name, email: `${actor.name.toLowerCase().replace(/\s+/g, '.')}@levv.test`, first_name, last_name: rest.join(' ') },
    profile: { type: membership.profile_type, ...membership },
    membership,
  });
});
