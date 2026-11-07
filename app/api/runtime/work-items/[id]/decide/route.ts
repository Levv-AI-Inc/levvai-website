import { z } from 'zod';
import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Decide = z.object({ decision: z.enum(['approved', 'rejected', 'sent_back', 'verified', 'not_verified']), comment: z.string().optional() });

export const POST = signedIn<{ id: string }, z.infer<typeof Decide>>({ body: Decide }, async ({ store, actor, params, body, request }) =>
  json(await runtimeOf(store, request).decide(actor, params.id, body.decision, body.comment)),
);
