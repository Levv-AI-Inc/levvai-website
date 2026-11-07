import { encodeRun } from '../data/codec';
import type { StoreWrite } from '../data/driver';
import type { RunSession } from './session';

/**
 * Everything one command changed, as one transaction. The run row comes first: it takes the row lock and the `rev` check,
 * so two commands on a run serialise there and the loser writes nothing. Runs before records, always, so two transactions
 * can't take the same locks in opposite orders.
 */
export function writesOf(s: RunSession, loadedKeys: string[] | null, expectedRev: number | null, newId: (prefix: string) => string): StoreWrite[] {
  const { run } = s;
  const doc = encodeRun(run);
  const writes: StoreWrite[] = [];
  if (expectedRev === null) {
    writes.push({ op: 'insert', collection: 'runs', id: run.id, doc });
  } else {
    const unset = (loadedKeys ?? []).filter((key) => !(key in doc));
    writes.push({ op: 'patch', collection: 'runs', id: run.id, set: doc, ...(unset.length > 0 ? { unset } : {}), expectRev: expectedRev, bumpRev: true });
  }
  for (const event of s.newEvents) {
    const id = newId('re');
    writes.push({ op: 'insert', collection: 'events', id, doc: { id, runId: run.id, ...event } });
  }
  for (const item of s.newItems) writes.push({ op: 'insert', collection: 'items', id: item.id, doc: item });
  const created = new Set(s.newItems.map((item) => item.id));
  for (const id of Array.from(s.touched)) {
    if (created.has(id)) continue;
    const item = s.items.find((candidate) => candidate.id === id);
    if (item) writes.push({ op: 'patch', collection: 'items', id, set: item as unknown as Record<string, unknown> });
  }
  for (const line of s.newLedger) writes.push({ op: 'insert', collection: 'ledger', id: line.id, doc: line });
  for (const id of Array.from(s.closedLedger)) {
    const line = s.ledger.find((candidate) => candidate.id === id);
    if (line) writes.push({ op: 'patch', collection: 'ledger', id, set: { status: line.status, closedAt: line.closedAt } });
  }
  for (const message of s.outbox) writes.push({ op: 'insert', collection: 'outbox', id: message.id, doc: message });
  for (const event of s.raised) writes.push({ op: 'insert', collection: 'inbound', id: event.id, doc: event });
  if (s.recordDirty) writes.push(recordWrite(s));
  return writes;
}

/** `data` is one key of the doc, so a blind write could lose someone else's fields. `dataRev` is its compare-and-swap. */
export function recordWrite(s: Pick<RunSession, 'record'>): StoreWrite {
  const { record } = s;
  const loaded = record.dataRev ?? 0;
  return { op: 'patch', collection: 'records', id: record.id, set: { data: record.data, updatedAt: record.updatedAt, dataRev: loaded + 1 }, expect: { dataRev: loaded } };
}
