import { z } from 'zod';
import { serviceStore } from '@flow-studio/data/select-store';
import { canonicalIso, serverClock } from '@flow-studio/server/clock';
import { runtimeOf } from '@flow-studio/server/runtime-route';
import { e2eState } from '@flow-studio/server/e2e';
import { ApiError } from '@flow-studio/server/errors';
import { json, readBody } from '@flow-studio/server/route';
import { testOnly } from '@flow-studio/server/test-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SetClock = z.object({
  now: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Not a date-time').optional(),
  advanceMs: z.number().nonnegative().optional(),
});

export const POST = testOnly(async (request) => {
  const { now, advanceMs } = await readBody(request, SetClock);
  const current = serverClock.now();
  let next = current;
  if (now) {
    if (Date.parse(now) < Date.parse(current)) throw new ApiError(422, 'CLOCK_BACKWARDS', 'The clock only moves forward; reset moves it back.');
    next = now;
  } else if (advanceMs) {
    next = canonicalIso(new Date(Date.parse(current) + advanceMs));
  }
  e2eState().clock = next;
  // 01 §5.3: "then runs the scheduler tick once".
  const { processed } = await runtimeOf(await serviceStore(request), request).tick();
  return json({ now: next, processed });
});
