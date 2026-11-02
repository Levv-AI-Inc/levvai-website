import type { RunStatus } from '@flow-studio/model/runtime';
import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = signedIn({ permission: 'runs.view' }, async ({ store, request }) => {
  const query = request.nextUrl.searchParams;
  const list = (key: string): string[] => query.getAll(key).flatMap((value) => value.split(',')).filter(Boolean);
  const status = list('status') as RunStatus[];
  return json(
    await runtimeOf(store, request).runsPage({
      ...(status.length > 0 ? { status } : {}),
      workflowId: list('workflowId'),
      ...(query.get('recordId') ? { recordId: query.get('recordId') as string } : {}),
    }),
  );
});
