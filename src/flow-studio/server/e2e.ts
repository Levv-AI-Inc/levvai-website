import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MemoryTables } from '../data/memory/driver';
import type { TestActors } from '../model/runtime';

/** Everything that exists only for LEVV_E2E=1 and Vitest. Kept on globalThis because Next bundles each route on its own. */
export interface E2EState {
  tables?: MemoryTables;
  actors?: TestActors['actorSets']['default'];
  clock?: string;
}

const KEY = '__levvFlowStudioE2E';

export const e2eState = (): E2EState => {
  const holder = globalThis as unknown as Record<string, E2EState | undefined>;
  holder[KEY] ??= {};
  return holder[KEY] as E2EState;
};

export const isE2E = (env: Record<string, string | undefined> = process.env): boolean => env.LEVV_E2E === '1';

/** The signed session of 01 §5.3. Named `sessionid` so the middleware's presence check passes (decision 5). */
export const E2E_COOKIE = 'sessionid';

const secret = (): string => process.env.LEVV_E2E_SECRET || 'levv-e2e-only';
const signature = (payload: string): string => createHmac('sha256', secret()).update(payload).digest('hex');

export function signE2ESession(name: string): string {
  const payload = Buffer.from(name, 'utf8').toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function readE2ESession(value: string | undefined): string | null {
  if (!value) return null;
  const [payload, supplied] = value.split('.');
  if (!payload || !supplied) return null;
  const expected = Buffer.from(signature(payload));
  const given = Buffer.from(supplied);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return Buffer.from(payload, 'base64url').toString('utf8');
}
