/**
 * The storage contract under the repositories. Two drivers implement it: memory/ (Vitest, and the app when LEVV_E2E=1)
 * and django/ (apps.flowstudio over HTTP). Everything about what the writes mean lives in repos.ts, so both stores
 * behave the same. Rows hold the entity exactly as written, including key order (03 §1.4, §12).
 */
export const COLLECTIONS = [
  'workflows', 'versions', 'requests', 'reference', 'samples', 'history', 'records',
  'runs', 'events', 'items', 'ledger', 'outbox', 'inbound', 'claims', 'links',
] as const;
export type Collection = (typeof COLLECTIONS)[number];

export interface Row {
  id: string;
  doc: unknown;
  rev?: number;             // workflows: draftRev; runs: rev
  updatedAt?: string;
  updatedBy?: string | null;
  versions?: unknown[];     // workflows only, oldest first
  events?: unknown[];       // runs only, in the order they were appended
}

export type Where = Record<string, string | string[]>;

export type StoreWrite =
  | { op: 'insert'; collection: Collection; id: string; doc: unknown; position?: number; by?: string }
  | { op: 'upsert'; collection: Collection; id: string; doc: unknown; position?: number; by?: string }
  | {
      op: 'patch';
      collection: Collection;
      id: string;
      set?: Record<string, unknown>;       // top-level keys of the doc to replace
      unset?: string[];                    // top-level keys of the doc to remove
      expect?: Record<string, unknown>;    // the write conflicts unless these doc values match (absent counts as null)
      expectRev?: number;                  // the write conflicts unless the row is at this rev
      bumpRev?: boolean;
      by?: string;
    }
  | { op: 'updateWhere'; collection: Collection; where: Where; set: Record<string, unknown>; by?: string };

export interface WriteResult { id?: string; rev?: number; count?: number }
export type ConflictReason = 'rev' | 'expect' | 'missing' | 'exists' | 'integrity';
export type TxResult =
  | { ok: true; results: WriteResult[] }
  | { ok: false; index: number; reason: ConflictReason; current?: unknown };

/**
 * Someone who can act on flow changes: enough for `othersCanApprove` and for addressing inbox copies. Only accounts linked
 * to a person count (decision 5). `id` is the account, `name` the person it is linked to.
 */
export interface ActingUserRow { id: string; name: string; permissions: string[] }

/** An active member of the tenant, by the id a link keys on. */
export interface MemberRow { id: string; email: string; role: string }

export interface StoreDriver {
  list(collection: Collection, where?: Where): Promise<Row[]>;
  get(collection: Collection, id: string): Promise<Row | null>;
  /** Applies every write, or none of them when any conflicts. */
  tx(writes: StoreWrite[]): Promise<TxResult>;
  actingUsers(): Promise<ActingUserRow[]>;
  members(): Promise<MemberRow[]>;
}
