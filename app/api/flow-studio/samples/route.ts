import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = signedIn({ permission: 'flow.edit' }, async ({ store }) => json(await store.records.samples()));
