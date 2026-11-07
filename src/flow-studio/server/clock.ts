import { isE2E, e2eState } from './e2e';

/** 01 §8: the server clock. Engine functions receive these values; they never read the time themselves. */
export interface Clock {
  now(): string;   // ISO date-time, UTC, "…:00Z" when there are no milliseconds
  asOf(): string;  // YYYY-MM-DD in the company time zone
}

/** Open decision in 01 §8: no tenant setting exists, so this is the default the spec gives. */
export const COMPANY_TIME_ZONE = 'Europe/London';

export const canonicalIso = (date: Date): string => date.toISOString().replace('.000Z', 'Z');

export const companyDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: COMPANY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

/** LEVV_FIXED_NOW, or null. A value that does not parse is a deployment mistake, so it fails loudly. */
export function fixedNow(): string | null {
  const value = process.env.LEVV_FIXED_NOW;
  if (!value) return null;
  if (Number.isNaN(Date.parse(value))) throw new Error(`LEVV_FIXED_NOW is not a date-time: ${value}`);
  return value;
}

function currentNow(): string {
  if (isE2E()) {
    const state = e2eState();
    state.clock ??= fixedNow() ?? canonicalIso(new Date());
    return state.clock;
  }
  return fixedNow() ?? canonicalIso(new Date());
}

export const serverClock: Clock = {
  now: currentNow,
  asOf: () => companyDate(currentNow()),
};
