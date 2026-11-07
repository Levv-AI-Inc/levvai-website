import { json, signedIn } from '@flow-studio/server/route';
import { buildEngineContext } from '@flow-studio/server/context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Conflict 7 in IMPLEMENTATION_NOTES: the client's advisory engine needs everything but the id generator. Publish stays authoritative on the server. */
export const GET = signedIn({ permission: 'flow.edit' }, async ({ store, actor, clock }) => {
  const { idGen: _unused, ...context } = await buildEngineContext(store, clock, actor);
  return json(context);
});
