import { z } from 'zod';
import { parseSeedFile, SeedValidationError } from '@flow-studio/model/schemas';
import { ApiError } from '@flow-studio/server/errors';
import { noContent, signedIn } from '@flow-studio/server/route';
import { runtimeOf } from '@flow-studio/server/runtime-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Stored as received once valid: 02 §15 runs when it is read, and stored key order counts.
const ImportReference = z.object({
  key: z.enum(['people-and-authority', 'approval-rules', 'catalog', 'digital-workers', 'onboarding-presets', 'systems']),
  data: z.unknown(),
});

export const POST = signedIn<Record<string, never>, z.infer<typeof ImportReference>>(
  { permission: 'reference.import', body: ImportReference },
  async ({ store, actor, body, request }) => {
    try {
      parseSeedFile(body.key, body.data);
    } catch (error) {
      if (error instanceof SeedValidationError) throw new ApiError(422, 'INVALID_REFERENCE', error.message);
      throw error;
    }
    await store.reference.replace(body.key, body.data, actor.name);
    // 05 §3.4.3: a step paused because nobody was eligible resumes when reference data changes and re-planning finds someone.
    await runtimeOf(store, request).referenceChanged();
    return noContent();
  },
);
