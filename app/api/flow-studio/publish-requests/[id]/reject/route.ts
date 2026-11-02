import { z } from 'zod';
import { requestToDecide } from '@flow-studio/server/publish-decision';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Reject = z.object({ comment: z.string().trim().min(1) });

export const POST = signedIn<{ id: string }, z.infer<typeof Reject>>({ body: Reject }, async ({ store, actor, params, body }) => {
  await requestToDecide(store, actor, params.id);
  return json(await store.publishRequests.decide(params.id, 'rejected', actor, body.comment));
});
