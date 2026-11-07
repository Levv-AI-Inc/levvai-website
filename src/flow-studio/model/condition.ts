import type { Operator } from './catalog';

/** One comparison, e.g. {f:"rate_vs_card_pct", op:">", v:10}. */
export interface Row {
  f: string;            // FieldDef.id
  op: Operator;         // must be in OPS[field.t]
  /** Value, by field type:
   *  money/num/pct: number (null = not filled in yet; never matches)
   *  enum ('in'/'not_in'): string[] of options (empty = "(pick a value)"; 'in' never matches, 'not_in' matches any non-blank)
   *  list ('includes'): one option string, e.g. "bill_rate"
   *  text ('is'/'contains'): string
   *  bool ('yes'/'no'): absent (undefined) */
  v?: number | string | string[] | null;
}

/** An either/or group inside a condition list ("Either/or: any one of these").
 *  Created by "+ Add an either/or condition" as {join:"any", rows:[{f:"total_value",op:">=",v:250000},{f:"role_regulated",op:"yes"}]}.
 *  Groups can only contain Rows in the UI (one level); the engine evaluates any depth. */
export interface Group {
  join: 'all' | 'any';  // UI labels: "all" / "any one"
  rows: (Row | Group)[];
}

/** A condition list: used by If paths (on the Out itself), Approve "Only needed when" (ApproveNode.when) and approval rules (ApprovalRule.when). */
export interface Condition {
  join: 'all' | 'any';  // "Take this path when all / any of these are true"; default 'all'
  rows: (Row | Group)[];// empty list = always true (an If path with no rows matches everything; lint warns)
}

/** Type guard: an element of rows is a Group when it has `rows`. */
export const isGroup = (x: Row | Group): x is Group => Array.isArray((x as Group).rows);
