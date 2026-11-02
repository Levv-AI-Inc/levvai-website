import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Additive: the count behind 04 §11's confirmation before switching off a workflow with requests in progress. */
export const GET = signedIn<{ id: string }>({ permission: 'flow.edit' }, async ({ store, params, request }) =>
  json({ count: await runtimeOf(store, request).countRunning(params.id) }),
);
