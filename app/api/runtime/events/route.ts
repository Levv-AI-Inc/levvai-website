import { z } from 'zod';
import { serviceStore, userStore } from '@flow-studio/data/select-store';
import type { NewEvent } from '@flow-studio/runtime/service';
import { currentActor } from '@flow-studio/server/session';
import { can } from '@flow-studio/server/permissions';
import { guarded, json, readBody } from '@flow-studio/server/route';
import { runtimeOf, secretMatches, wrongSecret } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Event = z.object({
  source: z.string().min(1),
  recordType: z.string().min(1),
  recordId: z.string().min(1),
  event: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

export const POST = guarded(async (request) => {
  const service = secretMatches(request.headers.get('x-levv-service-token'), process.env.LEVV_SERVICE_TOKEN);
  const actor = service ? null : await currentActor(request);
  if (!service && (!actor || !can(actor, 'admin'))) throw wrongSecret();
  const body = await readBody(request, Event);
  const store = service ? await serviceStore(request) : await userStore(request);
  return json(await runtimeOf(store, request).intake(body as NewEvent, actor ?? undefined));
});
