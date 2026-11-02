import { z } from 'zod';
import type { RecordKey } from '@flow-studio/model/catalog';
import { json, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Edit = z.object({ data: z.record(z.string(), z.unknown()) });

export const POST = signedIn<{ type: string; id: string }, z.infer<typeof Edit>>({ permission: 'admin', body: Edit }, async ({ store, actor, params, body, request }) =>
  json(await runtimeOf(store, request).editRecordAs(actor, params.type as RecordKey, params.id, body.data)),
);
