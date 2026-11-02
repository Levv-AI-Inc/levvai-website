import { z } from 'zod';
import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Done = z.object({ note: z.string().optional() });

export const POST = signedIn<{ id: string }, z.infer<typeof Done>>({ body: Done }, async ({ store, actor, params, request }) =>
  json(await runtimeOf(store, request).done(actor, params.id)),
);
