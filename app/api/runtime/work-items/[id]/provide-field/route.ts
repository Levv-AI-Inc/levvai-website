import { z } from 'zod';
import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Provide = z.object({ field: z.string().min(1), value: z.unknown() }).refine((body) => body.value !== undefined, 'A value is required.');

export const POST = signedIn<{ id: string }, z.infer<typeof Provide>>({ body: Provide }, async ({ store, actor, params, body, request }) =>
  json(await runtimeOf(store, request).provideField(actor, params.id, body.field, body.value)),
);
