import { z } from 'zod';
import { draftHash, editableFields } from '@flow-studio/data/draft-fields';
import { copy } from '@flow-studio/engine/copy';
import { WorkflowSchema } from '@flow-studio/model/schemas';
import type { Workflow } from '@flow-studio/model/workflow';
import { ApiError, notFound } from '@flow-studio/server/errors';
import { json, signedIn } from '@flow-studio/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// `draft` is only checked, not parsed, here: Zod rebuilds objects in schema order, and stored key order matters (03 §1.4, §12).
const isObject = (value: unknown): boolean => typeof value === 'object' && value !== null && !Array.isArray(value);
const SaveDraft = z.object({
  draft: z.custom<Workflow>(isObject, 'Must be a workflow'),
  draftRev: z.number().int().positive(),
  /** The fingerprint of a save this one replaces, sent when a page is leaving and cannot wait for that save's answer. */
  supersedes: z.string().optional(),
});

export const PUT = signedIn<{ id: string }, z.infer<typeof SaveDraft>>(
  { permission: 'flow.edit', body: SaveDraft },
  async ({ store, actor, params, body }) => {
    const found = await store.workflows.get(params.id);
    if (!found) throw notFound('That workflow doesn’t exist.');

    // Only what a draft may change is taken from the client; status, version and the rest stay the server's.
    const { set, unset } = editableFields(body.draft);
    const next = { ...found.workflow, ...set } as Workflow & Record<string, unknown>;
    for (const key of unset) delete next[key];
    const checked = WorkflowSchema.safeParse(next);
    if (!checked.success) {
      const issue = checked.error.issues[0];
      throw new ApiError(422, 'INVALID_DRAFT', `${issue.path.join('.') || 'draft'}: ${issue.message}`);
    }

    // Still a compare-and-swap: this rev is expected only if what is stored is exactly what this page already sent. Anyone else's save changes it.
    const replacesOwnSave = found.draftRev !== body.draftRev && body.supersedes !== undefined && draftHash(found.workflow) === body.supersedes;
    const saved = await store.workflows.saveDraft(params.id, next, replacesOwnSave ? found.draftRev : body.draftRev, actor.name);
    if ('conflict' in saved) throw new ApiError(409, 'CONFLICT', copy.draftConflict);
    return json(saved);
  },
);
