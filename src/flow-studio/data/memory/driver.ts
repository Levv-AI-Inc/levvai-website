import type { ActingUserRow, Collection, ConflictReason, MemberRow, Row, StoreDriver, StoreWrite, TxResult, Where, WriteResult } from '../driver';
import { COLLECTIONS } from '../driver';

/*
 * Keeps each doc as JSON text, so everything written goes through the same JSON round trip it gets on the way to Django
 * (a Set becomes {}, Infinity becomes null) and those bugs show up in Vitest. The rules below mirror apps/flowstudio/models.py,
 * so a write Django would refuse is refused here too. tests/support/store-contract.ts runs against both.
 */
interface StoredRow { id: string; json: string; position: number; rev?: number; updatedBy: string | null; updatedAt: string }
export type MemoryTables = Record<Collection, Map<string, StoredRow>>;

interface Rules {
  ops: StoreWrite['op'][];
  filters?: string[];
  rev?: boolean;
  required?: string[];                  // doc keys Django keeps in a NOT NULL column ("records.0" = records[0])
  dates?: string[];                     // doc keys Django keeps in a DateTimeField
  refs?: Record<string, Collection>;    // doc keys Django keeps in a foreign key
  unique?: string;                      // a doc key Django keeps unique when it isn't null
}

const RULES: Record<Collection, Rules> = {
  workflows: {
    ops: ['insert', 'upsert', 'patch'],
    filters: ['status', 'recordType', 'event'],
    rev: true,
    required: ['name', 'records.0', 'event', 'status'],
  },
  versions: {
    ops: ['insert', 'upsert'],
    filters: ['workflowId'],
    required: ['workflowId', 'version', 'effective'],
    dates: ['publishedAt'],
    refs: { workflowId: 'workflows' },
  },
  requests: {
    ops: ['insert', 'patch'],
    filters: ['status', 'workflowId', 'requestedBy'],
    required: ['workflowId', 'goLive', 'requestedBy', 'requestedAt', 'status'],
    dates: ['requestedAt', 'decidedAt', 'authorNotifiedAt'],
    refs: { workflowId: 'workflows' },
  },
  reference: { ops: ['upsert'] },
  samples: { ops: ['upsert'] },
  history: { ops: ['upsert'] },
  records: { ops: ['insert', 'upsert', 'patch'], filters: ['type'], required: ['type'] },
  runs: {
    ops: ['insert', 'patch'],
    filters: ['status', 'workflowId', 'recordId', 'recordType'],
    rev: true,
    required: ['workflowId', 'version', 'recordRef.type', 'recordRef.id', 'event', 'status', 'startedAt'],
    dates: ['startedAt', 'endedAt', 'pausedAt', 'stoppedAt'],
    refs: { workflowId: 'workflows' },
  },
  events: {
    ops: ['insert'],
    filters: ['runId'],
    required: ['runId', 'at', 'by', 'type'],
    dates: ['at'],
    refs: { runId: 'runs' },
  },
  items: {
    ops: ['insert', 'patch', 'updateWhere'],
    filters: ['assignee', 'status', 'runId', 'publishRequestId', 'kind'],
    required: ['kind', 'assignee', 'status', 'createdAt'],
    dates: ['remindAt', 'escalateAt', 'dueAt', 'createdAt', 'doneAt'],
    refs: { runId: 'runs', publishRequestId: 'requests' },
  },
  ledger: {
    ops: ['insert', 'patch'],
    filters: ['workerKey', 'status', 'runId'],
    required: ['workerKey', 'runId', 'nodeId', 'gives', 'disp', 'createdAt'],
    dates: ['createdAt', 'closedAt'],
    refs: { runId: 'runs' },
  },
  outbox: {
    ops: ['insert', 'patch'],
    filters: ['runId', 'to'],
    required: ['to', 'channel', 'subject', 'createdAt'],
    dates: ['createdAt', 'sentAt'],
    refs: { runId: 'runs' },
  },
  inbound: {
    ops: ['insert', 'patch'],
    filters: ['recordId', 'source', 'outcome'],
    required: ['source', 'recordType', 'recordId', 'event', 'receivedAt'],
    dates: ['receivedAt', 'processedAt'],
  },
  claims: { ops: ['insert', 'patch'], required: ['runId'] },
  links: { ops: ['insert', 'upsert', 'patch'], filters: ['person'], unique: 'person' },
};

/** Filter name → doc key, where they differ. */
const FILTER_KEYS: Partial<Record<Collection, Record<string, string>>> = {
  workflows: { recordType: 'records.0' },
  runs: { recordId: 'recordRef.id', recordType: 'recordRef.type' },
};

export class MemoryStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryStoreError';
  }
}

class Conflict extends Error {
  constructor(readonly reason: ConflictReason, readonly current?: unknown) {
    super(reason);
  }
}

export function emptyTables(): MemoryTables {
  const tables = {} as MemoryTables;
  for (const collection of COLLECTIONS) tables[collection] = new Map();
  return tables;
}

const dig = (doc: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((value, step) => (value as Record<string, unknown> | undefined | null)?.[step], doc);

function checkDoc(collection: Collection, doc: unknown, tables: MemoryTables): asserts doc is Record<string, unknown> {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) throw new MemoryStoreError('doc must be an object');
  const rules = RULES[collection];
  for (const path of rules.required ?? []) {
    if (dig(doc, path) == null) throw new MemoryStoreError(`doc needs ${path}`);
  }
  for (const path of rules.dates ?? []) {
    const value = dig(doc, path);
    if (value != null && (typeof value !== 'string' || !value.includes('T') || Number.isNaN(Date.parse(value)))) {
      throw new MemoryStoreError(`${path} is not a date-time`);
    }
  }
  for (const [key, target] of Object.entries(rules.refs ?? {})) {
    const value = (doc as Record<string, unknown>)[key];
    if (value != null && !tables[target].has(String(value))) throw new Conflict('integrity');
  }
}

function matches(collection: Collection, doc: unknown, where: Where): boolean {
  return Object.entries(where).every(([key, wanted]) => {
    const value = dig(doc, FILTER_KEYS[collection]?.[key] ?? key);
    return (Array.isArray(wanted) ? wanted : [wanted]).includes(value as string);
  });
}

function checkFilters(collection: Collection, where: Where): void {
  for (const key of Object.keys(where)) {
    if (!RULES[collection].filters?.includes(key)) throw new MemoryStoreError(`${key} is not a filter of ${collection}`);
  }
}

function checkUnique(collection: Collection, table: Map<string, StoredRow>, id: string, doc: unknown): void {
  const key = RULES[collection].unique;
  if (!key) return;
  const value = (doc as Record<string, unknown>)[key];
  if (value == null) return;
  table.forEach((other) => {
    if (other.id !== id && (JSON.parse(other.json) as Record<string, unknown>)[key] === value) throw new Conflict('integrity');
  });
}

const nextPosition = (table: Map<string, StoredRow>): number => {
  let top = 0;
  table.forEach((row) => {
    top = Math.max(top, row.position);
  });
  return top + 1;
};

const resultOf = (collection: Collection, row: StoredRow): WriteResult =>
  RULES[collection].rev ? { id: row.id, rev: row.rev } : { id: row.id };

function applyOne(write: StoreWrite, tables: MemoryTables, now: string): WriteResult {
  const { collection } = write;
  if (!COLLECTIONS.includes(collection)) throw new MemoryStoreError(`Unknown collection ${collection}`);
  const rules = RULES[collection];
  if (!rules.ops.includes(write.op)) throw new MemoryStoreError(`${collection} does not allow ${write.op}`);
  const table = tables[collection];

  const insert = (id: string, doc: unknown, position: number | undefined, by: string | undefined): WriteResult => {
    if (table.has(id)) throw new Conflict('exists');
    const json = JSON.stringify(doc);
    checkDoc(collection, JSON.parse(json), tables);
    checkUnique(collection, table, id, JSON.parse(json));
    if (collection === 'versions') {
      const { workflowId, version } = JSON.parse(json) as { workflowId: string; version: number };
      table.forEach((other) => {
        const stored = JSON.parse(other.json) as { workflowId: string; version: number };
        if (stored.workflowId === workflowId && stored.version === version) throw new Conflict('integrity');
      });
    }
    const row: StoredRow = { id, json, position: position || nextPosition(table), updatedBy: by ?? null, updatedAt: now };
    if (rules.rev) row.rev = 1;
    table.set(id, row);
    return resultOf(collection, row);
  };

  const merge = (row: StoredRow, set: Record<string, unknown> | undefined, unset: string[] | undefined, by: string | undefined, bump: boolean): StoredRow => {
    const doc = { ...(JSON.parse(row.json) as Record<string, unknown>), ...JSON.parse(JSON.stringify(set ?? {})) } as Record<string, unknown>;
    for (const key of unset ?? []) delete doc[key];
    checkDoc(collection, doc, tables);
    checkUnique(collection, table, row.id, doc);
    return { ...row, json: JSON.stringify(doc), updatedBy: by ?? row.updatedBy, updatedAt: now, rev: bump ? (row.rev ?? 0) + 1 : row.rev };
  };

  switch (write.op) {
    case 'insert':
      return insert(write.id, write.doc, write.position, write.by);
    case 'upsert': {
      const row = table.get(write.id);
      if (!row) return insert(write.id, write.doc, write.position, write.by);
      const json = JSON.stringify(write.doc);
      if (json === row.json) return resultOf(collection, row);
      checkDoc(collection, JSON.parse(json), tables);
      checkUnique(collection, table, write.id, JSON.parse(json));
      const next: StoredRow = {
        ...row,
        json,
        position: write.position ?? row.position,
        updatedBy: write.by ?? null,
        updatedAt: now,
        rev: rules.rev ? (row.rev ?? 0) + 1 : undefined,
      };
      table.set(write.id, next);
      return resultOf(collection, next);
    }
    case 'patch': {
      const row = table.get(write.id);
      if (!row) throw new Conflict('missing');
      if (write.expectRev !== undefined) {
        if (!rules.rev) throw new MemoryStoreError('This collection has no rev');
        if (row.rev !== write.expectRev) throw new Conflict('rev', row.rev);
      }
      const doc = JSON.parse(row.json) as Record<string, unknown>;
      for (const [key, value] of Object.entries(write.expect ?? {})) {
        if (JSON.stringify(doc[key] ?? null) !== JSON.stringify(value ?? null)) throw new Conflict('expect', doc[key] ?? null);
      }
      if (write.bumpRev && !rules.rev) throw new MemoryStoreError('This collection has no rev');
      const next = merge(row, write.set, write.unset, write.by, Boolean(write.bumpRev));
      table.set(write.id, next);
      return resultOf(collection, next);
    }
    case 'updateWhere': {
      if (Object.keys(write.where).length === 0) throw new MemoryStoreError('updateWhere needs a filter');
      checkFilters(collection, write.where);
      let count = 0;
      Array.from(table.values()).forEach((row) => {
        if (!matches(collection, JSON.parse(row.json), write.where)) return;
        table.set(row.id, merge(row, write.set, undefined, write.by, false));
        count += 1;
      });
      return { count };
    }
  }
}

/** All or nothing, like the transaction on the Django side. */
export function applyWrites(state: { tables: MemoryTables }, writes: StoreWrite[], now: string): TxResult {
  if (writes.length === 0) throw new MemoryStoreError('writes must be a non-empty list');
  const draft = {} as MemoryTables;
  for (const collection of COLLECTIONS) draft[collection] = new Map(state.tables[collection]);
  const results: WriteResult[] = [];
  let index = 0;
  try {
    for (index = 0; index < writes.length; index += 1) results.push(applyOne(writes[index], draft, now));
  } catch (error) {
    if (error instanceof Conflict) return { ok: false, index, reason: error.reason, current: error.current };
    throw error;
  }
  state.tables = draft;
  return { ok: true, results };
}

function toRow(collection: Collection, row: StoredRow, tables: MemoryTables): Row {
  const out: Row = { id: row.id, doc: JSON.parse(row.json), updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  if (row.rev !== undefined) out.rev = row.rev;
  if (collection === 'workflows') {
    const versions = Array.from(tables.versions.values())
      .map((version) => JSON.parse(version.json) as { workflowId: string; version: number })
      .filter((version) => version.workflowId === row.id);
    out.versions = versions.sort((a, b) => a.version - b.version);
  }
  if (collection === 'runs') {
    out.events = Array.from(tables.events.values())
      .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1))
      .map((event) => JSON.parse(event.json) as { runId: string })
      .filter((event) => event.runId === row.id);
  }
  return out;
}

export function createMemoryDriver(
  state: { tables: MemoryTables },
  deps: { now: () => string; actingUsers: () => Omit<ActingUserRow, 'id'>[] },
): StoreDriver {
  /* Test actors are signed in by name, so each one is its own account and is linked to itself (decision 5, 06 §1.2). */
  const users = (): ActingUserRow[] => deps.actingUsers().map((user) => ({ id: user.name, ...user }));
  return {
    async list(collection, where = {}) {
      checkFilters(collection, where);
      return Array.from(state.tables[collection].values())
        .filter((row) => matches(collection, JSON.parse(row.json), where))
        .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1))
        .map((row) => toRow(collection, row, state.tables));
    },
    async get(collection, id) {
      const row = state.tables[collection].get(id);
      return row ? toRow(collection, row, state.tables) : null;
    },
    async tx(writes) {
      return applyWrites(state, writes, deps.now());
    },
    async actingUsers() {
      return users();
    },
    async members(): Promise<MemberRow[]> {
      return users().map((user) => ({ id: user.id, email: `${user.name.toLowerCase().replace(/\s+/g, '.')}@levv.test`, role: user.permissions.includes('admin') ? 'admin' : 'viewer' }));
    },
  };
}
