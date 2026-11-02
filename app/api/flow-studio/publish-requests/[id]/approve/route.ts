import { z } from 'zod';
import { requestToDecide } from '@flow-studio/server/publish-decision';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Approve = z.object({ comment: z.string().optional() });

export const POST = signedIn<{ id: string }, z.infer<typeof Approve>>({ body: Approve }, async ({ store, actor, params, body }) => {
  const request = await requestToDecide(store, actor, params.id);
  return json(await store.workflows.publishVersion(request.workflowId, request, actor, body.comment));
});
