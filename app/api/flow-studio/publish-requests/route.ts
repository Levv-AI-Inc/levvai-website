import { z } from 'zod';
import { copy } from '@flow-studio/engine/copy';
import { invalid } from '@flow-studio/server/errors';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Status = z.enum(['pending']).nullable();

export const GET = signedIn({ permission: 'flow.approve_changes', permissionMessage: copy.noApprovePermission }, async ({ store, request }) => {
  const status = Status.safeParse(new URL(request.url).searchParams.get('status'));
  if (!status.success) throw invalid('Only status=pending can be listed.');
  return json(await store.publishRequests.listPending());
});
