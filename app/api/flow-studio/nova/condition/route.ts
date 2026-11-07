import { z } from 'zod';
import { callGPT } from '@/lib/intelligence/gpt/callGPT';
import { copy } from '@flow-studio/engine/copy';
import { parseWhenWithSource } from '@flow-studio/engine/nova-parse';
import { ApiError, notFound } from '@flow-studio/server/errors';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Condition = z.object({ text: z.string(), workflowId: z.string(), nodeId: z.string() });

/** 01 §7: only the admin's sentence and the field catalog reach the model, never record data or people's names. */
export const POST = signedIn<Record<string, never>, z.infer<typeof Condition>>(
  { permission: 'flow.edit', body: Condition },
  async ({ store, body }) => {
    const found = await store.workflows.get(body.workflowId);
    if (!found || !found.workflow.draft.nodes[body.nodeId]) throw notFound('That step doesn’t exist.');
    if (!body.text.trim()) throw new ApiError(422, 'EMPTY_CONDITION', copy.sayWhen);

    const { catalog } = await store.reference.getAll();
    const { join, rows, source } = await parseWhenWithSource(body.text, catalog, { callGPT });
    if (rows.length === 0) throw new ApiError(422, 'NO_MATCH', copy.couldNotMatch);
    return json({ rows, join, source });
  },
);
