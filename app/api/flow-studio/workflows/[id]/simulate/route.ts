import { z } from 'zod';
import { runTest } from '@flow-studio/engine/compose';
import { buildEngineContext } from '@flow-studio/server/context';
import { notFound } from '@flow-studio/server/errors';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Simulate = z.object({
  recordId: z.string(),
  options: z
    .object({
      conflictChoice: z.enum(['a', 'b']).optional(),
      applyEdit: z.boolean().optional(),
      asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .optional(),
});

export const POST = signedIn<{ id: string }, z.infer<typeof Simulate>>(
  { permission: 'flow.edit', body: Simulate },
  async ({ store, actor, params, body, clock }) => {
    const ctx = await buildEngineContext(store, clock, actor);
    const workflow = ctx.workflows.find((candidate) => candidate.id === params.id);
    if (!workflow) throw notFound('That workflow doesn’t exist.');
    const record = ctx.samples.find((sample) => sample.id === body.recordId);
    if (!record) throw notFound('That record doesn’t exist.');
    return json(runTest({ workflow, record, ctx, options: body.options }));
  },
);
