import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { FlowStore } from '../data/repos';
import { mockAutocomplete } from '../runtime/adapters';
import { RuntimeService } from '../runtime/service';
import { serverClock } from './clock';
import { ApiError } from './errors';
import { resolveTenantHost } from './tenant-host';

/** Constant-time, and closed when the service has no secret configured. */
export function secretMatches(supplied: string | null, expected: string | undefined): boolean {
  if (!expected || !supplied) return false;
  const [a, b] = [Buffer.from(supplied), Buffer.from(expected)];
  return a.length === b.length && timingSafeEqual(a, b);
}

export const wrongSecret = (): ApiError => new ApiError(403, 'FORBIDDEN', 'That secret isn’t right.');

/** Where links in messages point: the tenant this request is for. */
export function originOf(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || request.nextUrl.protocol.replace(':', '');
  return `${proto}://${resolveTenantHost(request.headers)}`;
}

export const runtimeOf = (store: FlowStore, request: NextRequest): RuntimeService =>
  new RuntimeService(store, serverClock, { autocomplete: mockAutocomplete(), origin: originOf(request) });

/** A run without its plan: the route answers fit in a response, and the page reads the detail route. */
export function runAnswer(run: { plan?: unknown; steps?: unknown; recordSnapshot?: unknown }): unknown {
  const rest = { ...run };
  delete rest.plan;
  delete rest.recordSnapshot;
  return rest;
}
