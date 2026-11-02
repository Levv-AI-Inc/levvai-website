/** The browser's way to the Flow Studio routes. Decision 2: the tenant host always travels in a header. */

export class ApiFailure extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'ApiFailure';
  }
}

async function send<T>(path: string, init: RequestInit & { headers: Record<string, string> }): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { accept: 'application/json', 'x-levv-tenant-host': window.location.host, ...init.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiFailure(response.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? 'Something went wrong.');
  }
  return (await response.json()) as T;
}

export const apiGet = <T>(path: string, signal?: AbortSignal): Promise<T> => send<T>(path, { method: 'GET', signal, headers: {} });

/** The same CSRF header `lib/api/*` sends. Decision 2: taken from the cookie by the browser, never synthesised on the server. */
function csrfToken(): string {
  const match = /(?:^|;\s*)csrftoken=([^;]*)/.exec(document.cookie);
  return match ? decodeURIComponent(match[1]) : '';
}

/** Browsers refuse a keepalive request over 64 KiB. A larger one is sent normally, and the journal covers it (draft-journal.ts). */
const KEEPALIVE_LIMIT = 60_000;

/** `keepalive` lets a write outlive the page: the last autosave on a reload or a tab close. */
export const apiWrite = <T>(method: 'POST' | 'PUT', path: string, body: unknown, options: { keepalive?: boolean } = {}): Promise<T> => {
  const text = JSON.stringify(body);
  return send<T>(path, {
    method,
    keepalive: options.keepalive === true && new TextEncoder().encode(text).length < KEEPALIVE_LIMIT,
    body: text,
    headers: { 'content-type': 'application/json', 'x-csrftoken': csrfToken() },
  });
};
