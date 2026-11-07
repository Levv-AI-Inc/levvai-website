import { z } from 'zod';
import { json, signedIn } from '@flow-studio/server/route';
import { runAnswer, runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Pause = z.object({ reason: z.string().optional() });

export const POST = signedIn<{ id: string }, z.infer<typeof Pause>>({ body: Pause }, async ({ store, actor, params, body, request }) =>
  json(runAnswer(await runtimeOf(store, request).pause(actor, params.id, body.reason))),
);
