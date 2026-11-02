import type { Rec } from '../engine/conditions';
import { PICKS_THE_APPROVER } from '../engine/resolve';
import type { EngineContext } from '../model/context';
import type { RecordData } from '../model/records';
import type { BusinessRecord } from '../model/runtime';
import type { EventKey, RecordKey, SourceKey } from '../model/catalog';

/** 05 §2 and the notes' M1 flag: a record as it arrives (flat, like runtime-records.json) and as it is stored. */

const NOT_DATA = ['id', 'record', 'event', 'source'];
/** Reaches an object's prototype, not its data: `{...payload}` keeps it as a plain key, `Object.assign` later wouldn't. */
const NEVER_DATA = '__proto__';
/** Own property only: `FIELD.constructor` and `FIELD.toString` exist on every object, and aren't fields. */
const has = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);

/**
 * What the runtime and the source system keep, and nobody edits through a route: the plan reads `prev`, `original_total`
 * and `changed_fields` to say who already approved, `states` is what a prerequisite checks, and the rest is a run's own state.
 */
const RUNTIME_KEPT = ['prev', 'original_total', 'changed_fields', 'states', 'conflict', 'outcomes', 'outcomesL', 'decided', 'edit'];
/** What checks and routing read as fact (03 §5): worked out elsewhere, so a requester can't clear their own flag. */
const CHECK_INPUTS = ['rate_vs_card_pct', 'rate_vs_market_pct', 'budget_left_after', 'months_engaged_after', 'duplicate_found', 'invoice_matches', 'hours_over_schedule', 'rate_change_pct'];

/**
 * Finding 1. A requester fixing a request may change business fields: the catalog's, and the dates the record's Waits
 * follow. Everything else is refused, not ignored. Value fields stay editable though they can move the path, because the
 * amount is usually what was wrong. It can add people that way but never remove them: `raiseFloor` in machine.ts.
 */
export function requesterMayEdit(field: string, ctx: Pick<EngineContext, 'catalog' | 'rules'>): boolean {
  const known = has(ctx.catalog.FIELD, field) || (has(ctx.catalog.WAIT_DATES, field) && field !== 'wo_approved_at');
  if (!known || RUNTIME_KEPT.includes(field) || PICKS_THE_APPROVER.includes(field) || CHECK_INPUTS.includes(field)) return false;
  // A risk question says who must approve (03 §2.4), and a rule's flag is the rule's to set (03 §7.2).
  return !(has(ctx.catalog.FIELD, field) && ctx.catalog.FIELD[field].risk) && !ctx.rules.some((rule) => rule.act.flag && rule.act.flagField === field);
}

/** Someone asked for a blank value is filling in, not overwriting, so only what would pick their own approver is kept from a requester. */
export const requesterMayProvide = (field: string): boolean => !PICKS_THE_APPROVER.includes(field);

/** The record route: an admin edits any field and any value brought back, but not what the runtime keeps. */
export const adminMayEdit = (field: string): boolean => !RUNTIME_KEPT.includes(field) && field !== 'constructor' && field !== 'prototype';

/** What a payload names that isn't a field to allow or refuse: bookkeeping is taken off quietly, anything else is judged. */
export const namedFields = (payload: Record<string, unknown>): string[] => Object.keys(payload).filter((key) => !NOT_DATA.includes(key));

/**
 * What an event can't change on a record while a run is on it, from the token or an admin: who raised it, and what the plan
 * reads to say who already approved. A run would otherwise re-plan on a say-so nobody reviews. 05 §3.1 still merges everything
 * else, including `states`, which is how a prerequisite gets met, and a new record comes as it was sent.
 */
export const EVENT_KEEPS_WHILE_RUNNING = ['requester', 'prev', 'original_total', 'changed_fields'];

/** Is this a value of the field's type (02 §2)? A field the catalog doesn't know has no type to check. */
export function valueFits(field: string, value: unknown, ctx: Pick<EngineContext, 'catalog'>): boolean {
  if (!has(ctx.catalog.FIELD, field)) return !has(ctx.catalog.WAIT_DATES, field) || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
  const def = ctx.catalog.FIELD[field];
  switch (def.t) {
    case 'money':
      return typeof value === 'number' && Number.isFinite(value) && (value >= 0 || field === 'budget_left_after');
    case 'num':
    case 'pct':
      return typeof value === 'number' && Number.isFinite(value);
    case 'bool':
      return typeof value === 'boolean';
    case 'enum':
      return typeof value === 'string' && (!def.o || def.o.includes(value));
    case 'list':
      return Array.isArray(value) && value.every((one) => typeof one === 'string' && (!def.o || def.o.includes(one)));
    default:
      return typeof value === 'string';
  }
}

/** Takes what identifies the record off the flat payload, so `data` holds field values only (02 §14). */
export function dataOfPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const data = { ...payload };
  for (const key of [...NOT_DATA, NEVER_DATA]) delete data[key];
  return data;
}

export function mergedRecord(existing: BusinessRecord | null, input: { id: string; type: RecordKey; source: SourceKey; payload: Record<string, unknown> }, now: string): BusinessRecord {
  const incoming = dataOfPayload(input.payload);
  return {
    id: input.id,
    type: input.type,
    source: existing?.source ?? input.source,
    updatedAt: now,
    dataRev: (existing?.dataRev ?? 0) + 1,
    data: { states: [], ...(existing?.data ?? {}), ...incoming } as BusinessRecord['data'],
  };
}

/** The record the engine reads (02 §11): field values, with id, record type and event alongside them. */
export function engineRecord(record: BusinessRecord, event: EventKey): RecordData {
  return { ...record.data, id: record.id, record: record.type, event } as unknown as RecordData;
}

/** 05 §2: "the 'Bring back to Levv' field names converted to snake case". */
export const snakeCase = (label: string): string => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const FIELD_ALIASES: Record<string, string> = {
  'Work order ID': 'id',
  'Job title': 'title',
  'Levv worker ID': 'id',
  'Supplier': 'supplier_tier',
};

/** The value a System step sends for a Levv field name in its map (02 §5.10). */
export function levvValue(label: string, rec: Rec): unknown {
  return rec[FIELD_ALIASES[label] ?? snakeCase(label)] ?? null;
}

/**
 * 05 §3.4.7 item 4: a later System step for the same system uses the brought-back id when it has one. Only a field
 * the system can both bring back and match on counts: "Hire status" is brought back too and can't find a record.
 */
export function matchKeyFor(system: string, configured: string, rec: Rec, ctx: Pick<EngineContext, 'systems'>): { key: string; value: unknown } {
  const keys = ctx.systems.SYS_KEY[system] ?? [];
  for (const field of ctx.systems.SYS[system]?.back ?? []) {
    const value = rec[snakeCase(field)];
    if (keys.includes(field) && value != null && value !== '') return { key: field, value };
  }
  return { key: configured, value: levvValue(configured, rec) };
}

/** The label a changed field reads with in "Record changed: …" (05 §2). */
export function fieldLabel(field: string, ctx: Pick<EngineContext, 'catalog'>): string {
  if (has(ctx.catalog.FIELD, field)) return ctx.catalog.FIELD[field].l;
  return has(ctx.catalog.WAIT_DATES, field) ? ctx.catalog.WAIT_DATES[field as keyof typeof ctx.catalog.WAIT_DATES] : field.replace(/_/g, ' ');
}

/** Fields that differ between two versions of `data`, in the order the new one has them. */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = [...Object.keys(after), ...Object.keys(before).filter((key) => !(key in after))];
  return keys.filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));
}
