import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = signedIn<{ id: string }>({}, async ({ store, actor, params, request }) => json(await runtimeOf(store, request).itemDetail(actor, params.id)));
