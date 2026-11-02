import type { Catalog, Operator } from '../model/catalog';
import type { Group, Row } from '../model/condition';
import { copy } from './copy';
import { conditionText } from './text';

export type When = { join: 'all' | 'any'; rows: (Row | Group)[] };

const money = (amount: string, unit?: string): number => {
  const value = parseFloat(amount.replace(/,/g, ''));
  if (unit === 'k') return value * 1000;
  if (unit === 'm' || unit === 'million') return value * 1000000;
  return value;
};

/** Engine §17.1 step 3. */
const joinOf = (text: string): 'all' | 'any' => (/\bor\b|any of/i.test(text) ? 'any' : 'all');

const YES_NO_FIELDS: [string, RegExp][] = [
  ['data_access', /client data|customer data|data access/],
  ['role_regulated', /regulated/],
  ['worker_former_employee', /former (employee|public servant)/],
  ['duplicate_found', /duplicate/],
  ['urgent', /urgent/],
  ['terms_nonstandard', /non-?standard terms/],
  ['registration_required', /registration/],
  ['digital_worker_access', /digital worker/],
];

const CHANGE_FIELDS: [string, RegExp][] = [
  ['end_date', /end date|extension|extended/],
  ['bill_rate', /\brate\b/],
  ['cost_center', /cost cent/],
  ['scope', /scope/],
];

/** Engine §17.3: the deterministic parser (fallback and unit-test oracle). */
export function parseWhenRules(text: string, catalog: Pick<Catalog, 'FIELDS'>): Row[] {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'")} `;
  let t2 = t;
  const rows: Row[] = [];

  const up = /(goes up|go up|increase|rais|rise|rises|higher|more than|over|above|exceed|past|beyond|greater)/.test(t);
  const down = /(goes down|decrease|lower|less than|under|below)/.test(t);
  const op: Operator = down && !up ? '<' : '>';

  const percent = /(\d+(\.\d+)?)\s*%/.exec(t);
  const hasRate = /\brate\b/.test(t);
  const rateMoney = /\$\s*(\d[\d,.]*)\s*(k|m)?/.exec(t);
  const anyMoney = /\$\s*(\d[\d,.]*)\s*(k|m|million)?/.exec(t);
  if (hasRate && percent && /card/.test(t)) rows.push({ f: 'rate_vs_card_pct', op, v: Number(percent[1]) });
  else if (hasRate && percent && /market/.test(t)) rows.push({ f: 'rate_vs_market_pct', op, v: Number(percent[1]) });
  else if (hasRate && percent) rows.push({ f: 'rate_change_pct', op, v: Number(percent[1]) });
  else if (hasRate && rateMoney) rows.push({ f: 'bill_rate', op, v: money(rateMoney[1], rateMoney[2]) });
  else if (anyMoney) {
    rows.push({ f: /budget left|remaining budget/.test(t) ? 'budget_left_after' : 'total_value', op, v: money(anyMoney[1], anyMoney[2]) });
  }

  const months = /(\d+)\s*months?/.exec(t);
  if (months) rows.push({ f: 'months_engaged_after', op, v: Number(months[1]) });

  const weeks = /(\d+)\s*weeks?/.exec(t);
  if (weeks) rows.push({ f: 'months_engaged_after', op, v: Math.round((Number(weeks[1]) / 4.345) * 10) / 10 });

  const days = /(\d+)\s*days?\s*(?:until|before|to)\s*(?:the\s*)?start/.exec(t);
  if (days) rows.push({ f: 'days_to_start', op: '<', v: Number(days[1]) });

  if (/\b(changes|changed|is changed|moves)\b/.test(t)) {
    for (const [key, pattern] of CHANGE_FIELDS) {
      if (!pattern.test(t)) continue;
      if (rows.some((row) => row.f === key || (key === 'bill_rate' && row.f === 'rate_change_pct'))) continue;
      rows.push({ f: 'changed_fields', op: 'includes', v: key });
    }
  }

  const negated = /\b(no|not|without)\b/.test(t);
  for (const [field, pattern] of YES_NO_FIELDS) {
    if (!pattern.test(t)) continue;
    rows.push({ f: field, op: negated ? 'no' : 'yes' });
    t2 = t2.replace(pattern, ' ');
  }

  for (const field of catalog.FIELDS) {
    if (field.t !== 'enum') continue;
    const values = (field.o ?? []).filter((option) => {
      const s = option.toLowerCase();
      if (t2.includes(` ${s} `) || t2.includes(` ${s},`) || t2.includes(` ${s}.`)) return true;
      const first = s.split(' ')[0];
      return first.length > 3 && /^[a-z]{2,4}-\d/i.test(first) && t2.includes(first);
    });
    if (values.length === 0) continue;
    const first = values[0].toLowerCase().split(' ')[0];
    const negative = new RegExp(`(not|isn.t|other than)\\s+(in\\s+|the\\s+)?${first}`).test(t);
    rows.push({ f: field.id, op: negative ? 'not_in' : 'in', v: values });
  }
  return rows;
}

/** What the model helper is given (01 §7); the route handler adapts the real `callGPT`. */
export type CallGPT = (
  messages: { role: 'system' | 'user'; content: string }[],
  options: { temperature: number; signal?: AbortSignal },
) => Promise<string>;

export const MODEL_TIMEOUT_MS = 8000;

function systemPrompt(catalog: Pick<Catalog, 'FIELDS'>): string {
  const lines = catalog.FIELDS.map((f) => `${f.id}, ${f.l}, ${f.t}${f.o ? `, ${f.o.join(' / ')}` : ''}`);
  return copy.gptSystem(lines.join('; '));
}

/** Engine §17.2: validates one returned row. Any invalid row discards the whole answer. */
function validRow(row: unknown, catalog: Pick<Catalog, 'FIELD' | 'OPS'>): Row | null {
  if (!row || typeof row !== 'object') return null;
  const { f, op, v } = row as { f?: unknown; op?: unknown; v?: unknown };
  if (typeof f !== 'string' || typeof op !== 'string') return null;
  const field = catalog.FIELD[f];
  if (!field || !catalog.OPS[field.t].includes(op as Operator)) return null;
  const options = field.o ?? [];
  switch (field.t) {
    case 'money':
    case 'num':
    case 'pct':
      return typeof v === 'number' ? { f, op: op as Operator, v } : null;
    case 'enum':
      return Array.isArray(v) && v.length > 0 && v.every((value) => options.includes(value as string)) ? { f, op: op as Operator, v: v as string[] } : null;
    case 'list':
      return typeof v === 'string' && options.includes(v) ? { f, op: op as Operator, v } : null;
    case 'text':
      return typeof v === 'string' ? { f, op: op as Operator, v } : null;
    default:
      return { f, op: op as Operator };
  }
}

async function askModel(text: string, catalog: Pick<Catalog, 'FIELDS' | 'FIELD' | 'OPS'>, callGPT: CallGPT, timeoutMs: number): Promise<Row[] | null> {
  const controller = typeof AbortController === 'undefined' ? undefined : new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller?.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const call = callGPT(
      [
        { role: 'system', content: systemPrompt(catalog) },
        { role: 'user', content: text },
      ],
      { temperature: 0, signal: controller?.signal },
    );
    const answer = await Promise.race([call, timeout]);
    if (answer === null) return null;
    const parsed = JSON.parse(answer) as { rows?: unknown };
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    const rows = parsed.rows.map((row) => validRow(row, catalog));
    return rows.every((row): row is Row => row !== null) ? rows : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Engine §17.2: the model first, the deterministic parser as fallback. Without `callGPT` only the parser runs.
 * The join always follows §17.1 step 3, which is also what §17.2 ends up with when the model's join disagrees.
 */
export async function parseWhen(
  text: string,
  catalog: Pick<Catalog, 'FIELDS' | 'FIELD' | 'OPS'>,
  deps: { callGPT?: CallGPT; timeoutMs?: number } = {},
): Promise<When> {
  const { join, rows } = await parseWhenWithSource(text, catalog, deps);
  return { join, rows };
}

/** 01 §5.1: the API also says which of the two answered. */
export async function parseWhenWithSource(
  text: string,
  catalog: Pick<Catalog, 'FIELDS' | 'FIELD' | 'OPS'>,
  deps: { callGPT?: CallGPT; timeoutMs?: number } = {},
): Promise<When & { source: 'gpt' | 'parser' }> {
  const fromModel = deps.callGPT ? await askModel(text, catalog, deps.callGPT, deps.timeoutMs ?? MODEL_TIMEOUT_MS) : null;
  if (fromModel) return { join: joinOf(text), rows: fromModel, source: 'gpt' };
  return { join: joinOf(text), rows: parseWhenRules(text, catalog), source: 'parser' };
}

/** Engine §17.1 steps 3–4: the message under the box. */
export const whenMessage = (when: When, catalog: Pick<Catalog, 'FIELD' | 'OPL'>): string =>
  when.rows.length > 0 ? copy.readAs(conditionText(when, catalog)) : copy.couldNotMatch;
