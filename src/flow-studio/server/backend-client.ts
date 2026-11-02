import { ApiError } from './errors';
import { resolveTenantHost } from './tenant-host';

/** How a store call identifies itself: a forwarded user, or the service itself (no cookie). */
export interface BackendIdentity {
  tenantHost: string;
  proto: string;
  cookie?: string;
  csrfToken?: string;
  origin?: string;
  referer?: string;
}

export interface BackendConfig { baseUrl: string; storeToken: string }

export interface BackendClient {
  store(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Response>;
  session(): Promise<Response>;
}

const FORWARDED_COOKIES = ['sessionid', 'csrftoken'];
const TIMEOUT_MS = 15000;

/** Only the session and CSRF cookies leave Next. */
export function forwardedCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const kept = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => FORWARDED_COOKIES.includes(part.split('=')[0]));
  return kept.length > 0 ? kept.join('; ') : undefined;
}

export function backendConfig(env: Record<string, string | undefined> = process.env): BackendConfig {
  const baseUrl = env.FLOW_STUDIO_BACKEND_URL || env.LOCAL_BACKEND_URL;
  const storeToken = env.FLOW_STUDIO_STORE_TOKEN;
  if (!baseUrl) throw new ApiError(503, 'STORE_NOT_CONFIGURED', 'FLOW_STUDIO_BACKEND_URL is not set.');
  if (!storeToken) throw new ApiError(503, 'STORE_NOT_CONFIGURED', 'FLOW_STUDIO_STORE_TOKEN is not set.');
  return { baseUrl: baseUrl.replace(/\/+$/, ''), storeToken };
}

const protoOf = (request: Request): string =>
  request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || new URL(request.url).protocol.replace(':', '');

/** Decision 2, the request shape from Next to Django. The CSRF header is forwarded as received, never made up. */
export function userIdentity(request: Request): BackendIdentity {
  const { headers } = request;
  return {
    tenantHost: resolveTenantHost(headers),
    proto: protoOf(request),
    cookie: forwardedCookie(headers.get('cookie')),
    csrfToken: headers.get('x-csrftoken') ?? undefined,
    origin: headers.get('origin') ?? undefined,
    referer: headers.get('referer') ?? undefined,
  };
}

/** No cookie: Django runs the call in the service context, on the strength of the store token. */
export const serviceIdentity = (request: Request): BackendIdentity => ({
  tenantHost: resolveTenantHost(request.headers),
  proto: protoOf(request),
});

function identityHeaders(identity: BackendIdentity): Record<string, string> {
  const headers: Record<string, string> = {
    'x-forwarded-host': identity.tenantHost,
    'x-forwarded-proto': identity.proto,
  };
  if (identity.cookie) headers.cookie = identity.cookie;
  if (identity.csrfToken) headers['x-csrftoken'] = identity.csrfToken;
  if (identity.origin) headers.origin = identity.origin;
  if (identity.referer) headers.referer = identity.referer;
  return headers;
}

export function createBackendClient(config: BackendConfig, identity: BackendIdentity): BackendClient {
  const call = async (url: string, init: RequestInit): Promise<Response> => {
    try {
      return await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new ApiError(503, 'STORE_UNAVAILABLE', 'The Flow Studio store can’t be reached.');
    }
  };
  return {
    store(method, path, body) {
      return call(`${config.baseUrl}/flowstudio-store/${path}`, {
        method,
        headers: {
          ...identityHeaders(identity),
          'x-levv-store-token': config.storeToken,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
    session() {
      return call(`${config.baseUrl}/api/session`, { method: 'GET', headers: identityHeaders(identity) });
    },
  };
}
