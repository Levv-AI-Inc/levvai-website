import { z } from 'zod';
import { activeState, setActive } from '@flow-studio/engine/active';
import { copy } from '@flow-studio/engine/copy';
import { buildEngineContext } from '@flow-studio/server/context';
import { ApiError, notFound } from '@flow-studio/server/errors';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SetActive = z.object({ active: z.boolean() });

export const POST = signedIn<{ id: string }, z.infer<typeof SetActive>>(
  { permission: 'flow.edit', body: SetActive },
  async ({ store, actor, params, body, clock }) => {
    const found = await store.workflows.get(params.id);
    if (!found) throw notFound('That workflow doesn’t exist.');
    if (found.workflow.status === 'draft') throw new ApiError(422, 'DRAFT_HAS_NO_SWITCH', copy.activeDraftText);

    const { toast } = setActive(found.workflow, body.active);
    const workflow = await store.workflows.setActive(params.id, body.active, actor.name);
    const ctx = await buildEngineContext(store, clock, actor);
    return json({ workflow, toast, warning: activeState(workflow, ctx).warning });
  },
);
