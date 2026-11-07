import { z } from 'zod';
import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Submit = z.object({ items: z.array(z.string()) });

export const POST = signedIn<{ id: string }, z.infer<typeof Submit>>({ body: Submit }, async ({ store, actor, params, body, request }) =>
  json(await runtimeOf(store, request).submitItems(actor, params.id, body.items)),
);
