import { publishReview } from '@flow-studio/engine/publish';
import { buildEngineContext } from '@flow-studio/server/context';
import { notFound } from '@flow-studio/server/errors';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = signedIn<{ id: string }>({ permission: 'flow.edit' }, async ({ store, actor, params, clock }) => {
  const ctx = await buildEngineContext(store, clock, actor);
  const workflow = ctx.workflows.find((candidate) => candidate.id === params.id);
  if (!workflow) throw notFound('That workflow doesn’t exist.');
  return json(publishReview(workflow, ctx));
});
