import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = signedIn({}, async ({ store, actor, request }) => json(await runtimeOf(store, request).inbox(actor)));
