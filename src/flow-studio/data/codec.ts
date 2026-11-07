import type { WorkflowRun } from '../model/runtime';

/*
 * The one place run data crosses into JSON. A plan holds `walk.path` as a Set, which JSON.stringify turns into {}, and
 * limits can be Infinity, which it turns into null. Tags keep both, and leave key order alone.
 */
const SET_TAG = '$set';
const INFINITY_TAG = '$infinity';

function encodeValue(value: unknown): unknown {
  if (value instanceof Set) return { [SET_TAG]: Array.from(value, encodeValue) };
  if (value === Infinity) return { [INFINITY_TAG]: 1 };
  if (value === -Infinity) return { [INFINITY_TAG]: -1 };
  if (Array.isArray(value)) return value.map(encodeValue);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, encodeValue(inner)]));
  }
  return value;
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 1 && entries[0][0] === SET_TAG) return new Set((entries[0][1] as unknown[]).map(decodeValue));
    if (entries.length === 1 && entries[0][0] === INFINITY_TAG) return (entries[0][1] as number) > 0 ? Infinity : -Infinity;
    return Object.fromEntries(entries.map(([key, inner]) => [key, decodeValue(inner)]));
  }
  return value;
}

export type StoredRunDoc = Omit<WorkflowRun, 'log'>;

/** `log` is left out: its lines are RunEvent rows, appended one at a time. */
export function encodeRun(run: WorkflowRun | StoredRunDoc): Record<string, unknown> {
  const rest = { ...run } as Partial<WorkflowRun> & { rev?: number };
  delete rest.log;
  delete rest.rev;
  return encodeValue(rest) as Record<string, unknown>;
}

export const decodeRun = (doc: unknown): StoredRunDoc => decodeValue(doc) as StoredRunDoc;
