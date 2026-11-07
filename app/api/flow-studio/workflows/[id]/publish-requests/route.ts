import { z } from 'zod';
import { copy } from '@flow-studio/engine/copy';
import { canApprove, findOverlaps, goLiveError, publishReview, sendForApproval, type Precedence } from '@flow-studio/engine/publish';
import { buildEngineContext } from '@flow-studio/server/context';
import { ApiError, notFound } from '@flow-studio/server/errors';
import { runtimeCopy } from '@flow-studio/runtime/copy';
import { dateText } from '@flow-studio/runtime/time';
import { json, signedIn } from '@flow-studio/server/route';
import { originOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SendRequest = z.object({
  goLive: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  precedence: z.array(z.object({ otherId: z.string(), winner: z.enum(['self', 'other']) })).optional(),
});

export const POST = signedIn<{ id: string }, z.infer<typeof SendRequest>>(
  { permission: 'flow.edit', body: SendRequest },
  async ({ store, actor, params, body, clock, request }) => {
    const ctx = await buildEngineContext(store, clock, actor);
    const workflow = ctx.workflows.find((candidate) => candidate.id === params.id);
    if (!workflow) throw notFound('That workflow doesn’t exist.');
    if (workflow.pending) throw new ApiError(409, 'ALREADY_WAITING', copy.alreadyWaiting);

    const dateError = goLiveError(body.goLive, ctx);
    if (dateError) throw new ApiError(422, 'GO_LIVE_IN_PAST', dateError);

    // A choice is applied to the other workflow on approval, so it has to be about a real overlap.
    const precedence = (body.precedence ?? []) as Precedence;
    const overlapIds = findOverlaps(workflow, ctx).map((overlap) => overlap.id);
    if (precedence.some((choice) => !overlapIds.includes(choice.otherId))) throw new ApiError(422, 'NOT_AN_OVERLAP', copy.noSuchOverlap);

    const review = publishReview(workflow, ctx, precedence);
    const sent = sendForApproval(workflow, ctx, { author: actor.name, authorId: actor.id, effective: body.goLive, precedence });
    if (sent.ok === false) throw new ApiError(422, 'MUST_FIX', sent.message, { mustFix: review.mustFix, openOverlaps: review.openOverlaps });

    const approvers = (await store.actingUsers()).filter((user) => canApprove(user, { submittedBy: actor.name, submittedById: actor.id === actor.name ? undefined : actor.id })).map((user) => user.name);
    const snapshot = { ...workflow };
    delete snapshot.versions;
    const created = await store.publishRequests.create(
      { workflowId: workflow.id, snapshot, goLive: body.goLive, precedence, review, requestedBy: actor.name, ...(actor.id === actor.name ? {} : { requestedById: actor.id }) },
      sent.workflow.pending as NonNullable<typeof sent.workflow.pending>,
      approvers,
      // 05 §5.3 "Flow change to approve", with a link to each approver's own copy.
      (itemId) => ({
        subject: runtimeCopy.mail.flowChangeSubject(workflow.name),
        body: runtimeCopy.mail.flowChangeBody(actor.name, workflow.name, dateText(`${body.goLive}T12:00:00Z`), `${originOf(request)}/inbox/${itemId}`),
      }),
    );
    return json(created, 201);
  },
);
