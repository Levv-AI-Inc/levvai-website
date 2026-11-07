import { isTenantHost, normalizeHost } from '@/lib/tenant';
import { ApiError } from './errors';

const isUsableHost = (value: string): boolean => {
  const host = normalizeHost(value);
  return isTenantHost(host) || host === 'localhost' || host === '127.0.0.1';
};

const hostOfUrl = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
};

/**
 * Decision 2, first match wins. The load balancer may not show Next the tenant host, so the client helper also sends
 * x-levv-tenant-host. Spoofing it is harmless: Django checks the session is bound to that tenant, and a service call
 * already holds a secret. The result keeps the port, because Django compares Origin with it.
 */
export function resolveTenantHost(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-host')?.split(',')[0].trim();
  const host = headers.get('host')?.trim();
  for (const candidate of [forwarded, host]) {
    if (candidate && isUsableHost(candidate)) return candidate;
  }
  const named = headers.get('x-levv-tenant-host')?.trim();
  if (named) return named;
  const fromBrowser = hostOfUrl(headers.get('origin')) ?? hostOfUrl(headers.get('referer'));
  if (fromBrowser) return fromBrowser;
  throw new ApiError(400, 'TENANT_HOST_UNKNOWN', 'This request doesn’t say which tenant it is for.');
}
