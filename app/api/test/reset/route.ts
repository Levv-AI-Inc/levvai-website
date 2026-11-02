import { z } from 'zod';
import { resetMemoryStore } from '@flow-studio/data/memory/store';
import { noContent, readBody } from '@flow-studio/server/route';
import { testOnly } from '@flow-studio/server/test-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Reset = z.object({ actors: z.enum(['default', 'author-only-approver']).optional() });

export const POST = testOnly(async (request) => {
  const hasBody = (await request.clone().text()).trim().length > 0;
  const { actors } = hasBody ? await readBody(request, Reset) : { actors: undefined };
  await resetMemoryStore(actors);
  return noContent();
});
