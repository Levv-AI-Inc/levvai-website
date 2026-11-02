import { readFileSync } from 'node:fs';
import { serviceStore } from '@flow-studio/data/select-store';
import { mockFieldglass, type QueuedEvent } from '@flow-studio/runtime/adapters';
import { guarded, json } from '@flow-studio/server/route';
import { runtimeOf, secretMatches, wrongSecret } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EPOCH = '1970-01-01T00:00:00Z';

export const POST = guarded(async (request) => {
  if (!secretMatches(request.headers.get('x-levv-cron-secret'), process.env.LEVV_CRON_SECRET)) throw wrongSecret();
  const runtime = runtimeOf(await serviceStore(request), request);
  // 05 §5.2: the Fieldglass mock, if a file of queued events is configured. Nothing polls a real system in this build.
  const queued = process.env.LEVV_FIELDGLASS_EVENTS_FILE;
  if (queued) await runtime.pollSource(mockFieldglass(JSON.parse(readFileSync(queued, 'utf8')) as QueuedEvent[]), EPOCH);
  return json(await runtime.tick());
});
