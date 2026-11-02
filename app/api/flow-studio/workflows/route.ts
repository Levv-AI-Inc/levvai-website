import { z } from 'zod';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = signedIn({ permission: 'flow.edit' }, async ({ store }) => json(await store.workflows.list()));

const NewWorkflow = z.object({ fromWorkflowId: z.string().optional() });

export const POST = signedIn<Record<string, never>, z.infer<typeof NewWorkflow>>(
  { permission: 'flow.edit', body: NewWorkflow },
  async ({ store, actor, body }) => json(await store.workflows.create(body, actor.name), 201),
);
