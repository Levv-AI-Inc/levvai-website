import type { Workflow } from '../model/workflow';

/** What a draft save may change. Everything else is the server's: status, version, published, pending, priority (04 §7.1). */
export const EDITABLE_FIELDS = ['name', 'records', 'event', 'scope', 'effective', 'owner', 'source', 'days', 'basis', 'onReject', 'draft', 'desc'] as const;

export function editableFields(draft: Workflow): { set: Record<string, unknown>; unset: string[] } {
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const field of EDITABLE_FIELDS) {
    if (draft[field] === undefined) unset.push(field);
    else set[field] = draft[field];
  }
  return { set, unset };
}

/**
 * A fingerprint of what a save writes, so a save can say "this replaces the save I already sent" without either side
 * storing anything (01 §3.2, and "M6: no silent loss of the last edit" in the notes). Stored key order survives a round trip (decision 2a).
 */
export function draftHash(workflow: Workflow): string {
  const text = JSON.stringify(EDITABLE_FIELDS.map((field) => workflow[field] ?? null));
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(36)}-${(h1 >>> 0).toString(36)}`;
}
