import { z } from 'zod';
import { json, signedIn } from '@flow-studio/server/route';
import { runAnswer, runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Choose = z.object({ choice: z.enum(['a', 'b']) });

/** Additive (03 §8.3): 01 §5.2 has no route for "approvals wait until one version is chosen", so this is how one gets chosen. */
export const POST = signedIn<{ id: string }, z.infer<typeof Choose>>({ body: Choose }, async ({ store, actor, params, body, request }) =>
  json(runAnswer(await runtimeOf(store, request).chooseProposal(actor, params.id, body.choice))),
);
