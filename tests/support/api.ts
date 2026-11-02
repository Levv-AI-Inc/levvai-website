import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { POST as resetRoute } from '../../app/api/test/reset/route';
import { POST as signInRoute } from '../../app/api/test/sign-in/route';
import { TEST_NOW } from './context';

/** 06 §1.2: what `npm run test:e2e` starts the app with. Route handlers read the environment per request. */
export function setE2EEnv(): void {
  process.env.LEVV_E2E = '1';
  process.env.LEVV_FIXED_NOW = TEST_NOW;
  process.env.FLOW_STUDIO_STORE = 'memory';
  process.env.LEVV_SERVICE_TOKEN = 'test-service-token';
  process.env.LEVV_CRON_SECRET = 'test-cron-secret';
  delete process.env.OPENAI_API_KEY;
}

export interface CallOptions {
  method?: string;
  body?: unknown;
  rawBody?: string;
  user?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

type RouteHandler = (request: NextRequest, context: { params: never }) => Promise<Response>;

const cookies = new Map<string, string>();

export function makeRequest(path: string, options: CallOptions = {}): NextRequest {
  const headers = new Headers({ host: 'localhost:3310', ...options.headers });
  const cookie = options.user ? cookies.get(options.user) : undefined;
  if (cookie) headers.set('cookie', cookie);
  const text = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  if (text !== undefined) headers.set('content-type', 'application/json');
  const method = options.method ?? (text === undefined ? 'GET' : 'POST');
  return new NextRequest(`http://localhost:3310${path}`, { method, headers, body: text });
}

export interface ApiResult<T = any> { status: number; body: T; headers: Headers }

/** Calls a route handler the way Next does and reads the response as JSON (null when it has no body). */
export async function call<T = any>(handler: unknown, path: string, options: CallOptions = {}): Promise<ApiResult<T>> {
  const response = await (handler as RouteHandler)(makeRequest(path, options), { params: (options.params ?? {}) as never });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T, headers: response.headers };
}

/** POST /api/test/reset, then forgets who was signed in. */
export async function resetApp(actors?: 'default' | 'author-only-approver'): Promise<void> {
  cookies.clear();
  const result = await call(resetRoute, '/api/test/reset', actors ? { body: { actors } } : { method: 'POST' });
  if (result.status !== 204) throw new Error(`Reset answered ${result.status}`);
}

/** POST /api/test/sign-in, keeping the cookie for `call(..., { user })`. */
export async function signIn(user: string): Promise<void> {
  const result = await call(signInRoute, '/api/test/sign-in', { body: { user } });
  if (result.status !== 204) throw new Error(`Sign-in as ${user} answered ${result.status}`);
  const setCookie = result.headers.get('set-cookie') ?? '';
  cookies.set(user, setCookie.split(';')[0]);
}

/** Every route.ts under a folder. */
export function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === 'route.ts' ? [full] : [];
  });
}
