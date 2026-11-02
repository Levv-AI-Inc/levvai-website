import type { WaitConfig } from '../model/workflow';

/** 01 §8: the times the runtime stores and shows. Pure: every function takes the time it works from (AGENTS rule 6). */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** 06 §5.1 stamps carry milliseconds ("2026-10-20T10:00:00.000Z"), whatever form the clock reads in. */
export const stamp = (iso: string): string => new Date(iso).toISOString();
export const addHours = (iso: string, hours: number): string => new Date(Date.parse(iso) + hours * HOUR).toISOString();
export const addMinutes = (iso: string, minutes: number): string => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
export const addDays = (iso: string, days: number): string => new Date(Date.parse(iso) + days * DAY).toISOString();
export const shift = (iso: string, ms: number): string => new Date(Date.parse(iso) + ms).toISOString();
export const isDue = (iso: string | undefined, now: string): boolean => iso !== undefined && Date.parse(iso) <= Date.parse(now);

const two = (n: number): string => String(n).padStart(2, '0');

/** "20 Oct 2026" in UTC (01 §8). */
export function dateText(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "20 Oct 2026, 10:00", with no suffix: 05 §6 writes " UTC" after it. */
export const dateTimeText = (iso: string): string => {
  const d = new Date(iso);
  return `${dateText(iso)}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
};

/** 05 §6.1 "Last change (relative time)". */
export function relativeText(iso: string, now: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(now) - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** The UTC instant at which a wall clock in `zone` reads this date and time. */
export function zonedToUtc(date: string, time: string, zone: string): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  const format = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  const reads = (at: number): number => {
    const parts = Object.fromEntries(format.formatToParts(new Date(at)).map((part) => [part.type, part.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  };
  // Twice, because the first guess can sit on the other side of a clock change.
  let guess = wanted - (reads(wanted) - wanted);
  guess = wanted - (reads(guess) - guess);
  return new Date(guess).toISOString();
}

const isWeekend = (ms: number): boolean => {
  const day = new Date(ms).getUTCDay();
  return day === 0 || day === 6;
};

function addWorkingDays(ms: number, days: number, direction: 1 | -1): number {
  let at = ms;
  for (let left = days; left > 0;) {
    at += direction * DAY;
    if (!isWeekend(at)) left -= 1;
  }
  return at;
}

function moved(ms: number, amount: number, unit: WaitConfig['unit'], direction: 1 | -1): number {
  switch (unit) {
    case 'hours':
      return ms + direction * amount * HOUR;
    case 'weeks':
      return ms + direction * amount * 7 * DAY;
    case 'business_days':
      return addWorkingDays(ms, amount, direction);
    default:
      return ms + direction * amount * DAY;
  }
}

export interface WaitZones { worker?: string; company: string }

/**
 * 03 §1.8, 05 §3.4.11: when a Wait ends. Null when it reads a date the record doesn't have yet.
 * `at` is stored with no zone (02 §5.12) and read as company time, as the notes decided in M5.
 */
export function resolveWaitUntil(w: WaitConfig, rec: Record<string, unknown>, now: string, zones: WaitZones): string | null {
  if (w.mode === 'for') return new Date(moved(Date.parse(now), w.amount ?? 0, w.unit, 1)).toISOString();
  if (w.mode === 'at') {
    if (!w.at) return null;
    const [date, time] = w.at.split('T');
    return zonedToUtc(date, time ?? '00:00', zones.company);
  }
  const value = rec[w.field ?? 'start_date'];
  if (typeof value !== 'string' || value === '') return null;
  const direction = (w.dir ?? 'before') === 'after' ? 1 : -1;
  const day = new Date(moved(Date.parse(`${value.slice(0, 10)}T12:00:00Z`), w.amount ?? 0, w.unit, direction)).toISOString().slice(0, 10);
  const zone = (w.tz ?? 'worker') === 'worker' ? zones.worker ?? zones.company : zones.company;
  return zonedToUtc(day, w.time ?? '09:00', zone);
}
