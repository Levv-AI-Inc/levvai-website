import type { Condition, Group, Row } from '../model/condition';
import type { Scope, CondNode, Out } from '../model/workflow';
import type { RecordData } from '../model/records';

/** A record, read by field id. */
export type Rec = Record<string, unknown>;

export const isGroupRow = (row: Row | Group): row is Group => Array.isArray((row as Group).rows);

const isEmptyNumber = (v: unknown): boolean => v === null || v === undefined || v === '';

/** Engine §2.1. An empty number never matches (D15). */
export function evalRow(row: Row | Group, rec: Rec): boolean {
  if (isGroupRow(row)) return evalCondition(row, rec);
  const v = rec[row.f];
  switch (row.op) {
    case 'is':
      return String(v ?? '').toLowerCase() === String(row.v ?? '').toLowerCase();
    case 'contains':
      return String(v ?? '').toLowerCase().includes(String(row.v ?? '').toLowerCase());
    case '>=':
      return v != null && !isEmptyNumber(row.v) && (v as number) >= (row.v as number);
    case '>':
      return v != null && !isEmptyNumber(row.v) && (v as number) > (row.v as number);
    case '<':
      return v != null && !isEmptyNumber(row.v) && (v as number) < (row.v as number);
    case '<=':
      return v != null && !isEmptyNumber(row.v) && (v as number) <= (row.v as number);
    case 'in':
      return ((row.v ?? []) as unknown[]).includes(v);
    case 'not_in':
      return v != null && !((row.v ?? []) as unknown[]).includes(v);
    case 'yes':
      return !!v;
    case 'no':
      return !v;
    case 'includes':
      return ((v ?? []) as unknown[]).includes(row.v);
    default:
      return false;
  }
}

/** Engine §2.2. */
export function evalCondition(cond: Pick<Condition, 'join' | 'rows'> | { join?: 'all' | 'any'; rows?: (Row | Group)[] }, rec: Rec): boolean {
  const rows = cond.rows ?? [];
  if (rows.length === 0) return true;
  return cond.join === 'any' ? rows.some((row) => evalRow(row, rec)) : rows.every((row) => evalRow(row, rec));
}

/** Engine §2.3. */
export function scopeMatch(scope: Scope, rec: Rec): boolean {
  return Object.entries(scope).every(([key, values]) => !values || values.length === 0 || values.includes(rec[key] as string));
}

function collectFields(rows: (Row | Group)[], into: string[]): void {
  for (const row of rows) {
    if (isGroupRow(row)) collectFields(row.rows, into);
    else if (!into.includes(row.f)) into.push(row.f);
  }
}

/** Engine §2.4 steps 1–2: blank fields (exactly null) used by any path of the If. Absent fields are not missing. */
export function missingFields(node: CondNode, rec: Rec | RecordData): string[] {
  const used: string[] = [];
  for (const out of node.outs as (Out & { rows?: (Row | Group)[] })[]) collectFields(out.rows ?? [], used);
  return used.filter((field) => (rec as Rec)[field] === null);
}
