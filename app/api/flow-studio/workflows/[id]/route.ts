import { notFound } from '@flow-studio/server/errors';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = signedIn<{ id: string }>({ permission: 'flow.edit' }, async ({ store, service, actor, params }) => {
  const found = await store.workflows.get(params.id);
  if (!found) throw notFound('That workflow doesn’t exist.');

  // 03 §13.5: the author hears about an approval the first time they load the workflow after it, and only then.
  const approved = await store.publishRequests.awaitingNotice(params.id, actor);
  const latest = approved[approved.length - 1];
  if (!latest) return json(found);
  await (await service()).publishRequests.markNotified(approved.map((request) => request.id));
  return json({ ...found, publishedNotice: { version: latest.publishedVersion, effective: latest.goLive } });
});
