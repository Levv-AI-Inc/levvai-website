import { z } from 'zod';
import { json, signedIn } from '@flow-studio/server/route';
import { runAnswer, runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Resume = z.object({}).passthrough();

export const POST = signedIn<{ id: string }, z.infer<typeof Resume>>({ body: Resume }, async ({ store, actor, params, request }) =>
  json(runAnswer(await runtimeOf(store, request).resume(actor, params.id))),
);
