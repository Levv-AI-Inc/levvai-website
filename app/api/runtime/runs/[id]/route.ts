import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = signedIn<{ id: string }>({ permission: 'runs.view' }, async ({ store, actor, params, request }) =>
  json(await runtimeOf(store, request).runDetail(actor, params.id)),
);
