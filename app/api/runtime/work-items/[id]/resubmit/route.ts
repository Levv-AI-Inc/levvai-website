import { z } from 'zod';
import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Resubmit = z.object({ data: z.record(z.string(), z.unknown()).optional(), comment: z.string().optional() });

export const POST = signedIn<{ id: string }, z.infer<typeof Resubmit>>({ body: Resubmit }, async ({ store, actor, params, body, request }) =>
  json(await runtimeOf(store, request).resubmit(actor, params.id, body.data)),
);
