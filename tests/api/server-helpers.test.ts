import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDjangoDriver } from '@flow-studio/data/django/driver';
import { createMemoryDriver, emptyTables } from '@flow-studio/data/memory/driver';
import { readRawSeed } from '@flow-studio/data/seed-files';
import { refusalForBackend, refusalForDatabase } from '@flow-studio/data/seed-guard';
import { applySeed, seedSkips } from '@flow-studio/data/seed-writes';
import { selectStoreKind } from '@flow-studio/data/select-store';
import { buildSeed } from '@flow-studio/model/load';
import { backendConfig, createBackendClient, forwardedCookie, serviceIdentity, userIdentity } from '@flow-studio/server/backend-client';
import { canonicalIso, companyDate } from '@flow-studio/server/clock';
import { ApiError } from '@flow-studio/server/errors';
import { resolveTenantHost } from '@flow-studio/server/tenant-host';
import { FIXTURE_DIR, makeContext } from '../support/context';

afterEach(() => vi.unstubAllGlobals());

describe('selectStoreKind (decision 2)', () => {
  const memoryRefused = /only for LEVV_E2E=1 and tests/;

  it('defaults to Django', () => {
    expect(selectStoreKind({})).toBe('django');
    expect(selectStoreKind({ FLOW_STUDIO_STORE: 'django' })).toBe('django');
  });

  it('refuses memory outside LEVV_E2E=1 and Vitest, so production cannot hold workflows in memory', () => {
    expect(() => selectStoreKind({ FLOW_STUDIO_STORE: 'memory' })).toThrow(memoryRefused);
    expect(() => selectStoreKind({ FLOW_STUDIO_STORE: 'memory', NODE_ENV: 'production' })).toThrow(memoryRefused);
    expect(selectStoreKind({ FLOW_STUDIO_STORE: 'memory', LEVV_E2E: '1' })).toBe('memory');
    expect(selectStoreKind({ FLOW_STUDIO_STORE: 'memory', VITEST: 'true' })).toBe('memory');
  });

  it('LEVV_E2E=1 means memory, and refuses Django so a stray flag cannot open test sign-in on real data', () => {
    expect(selectStoreKind({ LEVV_E2E: '1' })).toBe('memory');
    expect(() => selectStoreKind({ LEVV_E2E: '1', FLOW_STUDIO_STORE: 'django' })).toThrow(/only runs on the memory store/);
  });

  it('refuses a value it does not know', () => {
    expect(() => selectStoreKind({ FLOW_STUDIO_STORE: 'prisma' })).toThrow(/must be memory or django/);
  });
});

describe('resolveTenantHost (decision 2)', () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  it('takes x-forwarded-host, then host, when it is a tenant host or local, keeping the port', () => {
    expect(resolveTenantHost(headers({ 'x-forwarded-host': 'acme.levvai.com', host: 'other.levvai.com' }))).toBe('acme.levvai.com');
    expect(resolveTenantHost(headers({ 'x-forwarded-host': 'acme.levvai.com, proxy.internal' }))).toBe('acme.levvai.com');
    expect(resolveTenantHost(headers({ host: 'localhost:3310' }))).toBe('localhost:3310');
    expect(resolveTenantHost(headers({ host: '127.0.0.1:3000' }))).toBe('127.0.0.1:3000');
  });

  it('then x-levv-tenant-host, then Origin, then Referer, when Next is shown another host', () => {
    const run = { host: 'levvai-website-abc.run.app' };
    expect(resolveTenantHost(headers({ ...run, 'x-levv-tenant-host': 'acme.levvai.com', origin: 'https://b.levvai.com' }))).toBe('acme.levvai.com');
    expect(resolveTenantHost(headers({ ...run, origin: 'https://b.levvai.com', referer: 'https://c.levvai.com/x' }))).toBe('b.levvai.com');
    expect(resolveTenantHost(headers({ ...run, referer: 'https://c.levvai.com/flow-studio/x' }))).toBe('c.levvai.com');
  });

  it('answers 400 when nothing says', () => {
    const attempt = () => resolveTenantHost(headers({ host: 'levvai-website-abc.run.app' }));
    expect(attempt).toThrow(ApiError);
    expect(attempt).toThrow(/which tenant/);
    expect(() => resolveTenantHost(headers({ host: 'levvai.com', origin: 'not a url' }))).toThrow(ApiError);
  });
});

describe('the request from Next to Django (decision 2)', () => {
  const browser = () =>
    new Request('http://localhost:3310/api/flow-studio/workflows', {
      method: 'POST',
      headers: {
        host: 'localhost:3310',
        cookie: 'sessionid=abc; csrftoken=def; theme=dark; other=1',
        'x-csrftoken': 'from-the-browser',
        origin: 'http://localhost:3310',
        referer: 'http://localhost:3310/flow-studio/wf-1',
      },
    });

  function capture() {
    const calls: { url: string; init: RequestInit & { headers: Record<string, string> } }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ rows: [], results: [] }), { status: 200 });
    });
    return calls;
  }

  it('forwards only the session and CSRF cookies', () => {
    expect(forwardedCookie('sessionid=abc; csrftoken=def; theme=dark')).toBe('sessionid=abc; csrftoken=def');
    expect(forwardedCookie('theme=dark')).toBeUndefined();
    expect(forwardedCookie(null)).toBeUndefined();
  });

  it('a user call carries their session, the CSRF header as received, the origin, the tenant host and the token', async () => {
    const calls = capture();
    await createBackendClient({ baseUrl: 'http://django:8000', storeToken: 'secret' }, userIdentity(browser())).store('POST', 'tx/', { writes: [] });
    expect(calls[0].url).toBe('http://django:8000/flowstudio-store/tx/');
    expect(calls[0].init.cache).toBe('no-store');
    expect(calls[0].init.headers).toMatchObject({
      cookie: 'sessionid=abc; csrftoken=def',
      'x-csrftoken': 'from-the-browser',
      origin: 'http://localhost:3310',
      referer: 'http://localhost:3310/flow-studio/wf-1',
      'x-forwarded-host': 'localhost:3310',
      'x-forwarded-proto': 'http',
      'x-levv-store-token': 'secret',
    });
  });

  it('never makes up a CSRF header from the cookie', async () => {
    const calls = capture();
    const request = new Request('http://localhost:3310/x', { headers: { host: 'localhost:3310', cookie: 'sessionid=abc; csrftoken=def' } });
    await createBackendClient({ baseUrl: 'http://django:8000', storeToken: 'secret' }, userIdentity(request)).store('GET', 'c/workflows/');
    expect(calls[0].init.headers['x-csrftoken']).toBeUndefined();
  });

  it('a service call carries no cookie and no user headers', async () => {
    const calls = capture();
    await createBackendClient({ baseUrl: 'http://django:8000', storeToken: 'secret' }, serviceIdentity(browser())).store('POST', 'tx/', { writes: [] });
    const { headers } = calls[0].init;
    expect(headers.cookie).toBeUndefined();
    expect(headers['x-csrftoken']).toBeUndefined();
    expect(headers.origin).toBeUndefined();
    expect(headers['x-levv-store-token']).toBe('secret');
    expect(headers['x-forwarded-host']).toBe('localhost:3310');
  });

  it('the session check does not send the store token to /api/session', async () => {
    const calls = capture();
    await createBackendClient({ baseUrl: 'http://django:8000', storeToken: 'secret' }, userIdentity(browser())).session();
    expect(calls[0].url).toBe('http://django:8000/api/session');
    expect(calls[0].init.headers['x-levv-store-token']).toBeUndefined();
  });

  it('needs a backend URL and a token', () => {
    expect(() => backendConfig({})).toThrow(/FLOW_STUDIO_BACKEND_URL/);
    expect(() => backendConfig({ FLOW_STUDIO_BACKEND_URL: 'http://x' })).toThrow(/FLOW_STUDIO_STORE_TOKEN/);
    expect(backendConfig({ LOCAL_BACKEND_URL: 'http://x/', FLOW_STUDIO_STORE_TOKEN: 't' })).toEqual({ baseUrl: 'http://x', storeToken: 't' });
  });

  it('a store that can’t be reached is a 503, a refusal a 403, a conflict a result', async () => {
    const driver = (response: () => Promise<Response>) => {
      vi.stubGlobal('fetch', response);
      return createDjangoDriver(createBackendClient({ baseUrl: 'http://django', storeToken: 't' }, { tenantHost: 'localhost', proto: 'http' }));
    };
    await expect(driver(() => Promise.reject(new Error('down'))).list('workflows')).rejects.toMatchObject({ status: 503, code: 'STORE_UNAVAILABLE' });
    await expect(driver(async () => new Response('{"detail":"CSRF"}', { status: 403 })).tx([])).rejects.toMatchObject({ status: 403 });
    await expect(driver(async () => new Response('Not Found', { status: 404 })).list('workflows')).rejects.toMatchObject({ code: 'TENANT_NOT_FOUND' });
    await expect(driver(async () => new Response('<h1>Not Found</h1>', { status: 404 })).get('workflows', 'x')).rejects.toMatchObject({ code: 'TENANT_NOT_FOUND' });
    expect(await driver(async () => new Response('{"detail":"Not found."}', { status: 404 })).get('workflows', 'x')).toBeNull();
    const conflict = driver(async () => new Response('{"conflict":true,"index":0,"reason":"rev","current":2}', { status: 409 }));
    expect(await conflict.tx([])).toEqual({ ok: false, index: 0, reason: 'rev', current: 2 });
  });

  it('counts an admin as someone who can act only when linked to a person, and reads no names (decision 5)', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/actors/')) return new Response(JSON.stringify({ actors: [{ id: '7', email: 'a@b.c', role: 'admin' }, { id: '8', email: 'x@y.z', role: 'admin' }] }), { status: 200 });
      return new Response(JSON.stringify({ rows: [{ id: '7', doc: { accountId: '7', person: 'Samira Khan', teams: [] } }, { id: '9', doc: { accountId: '9', person: 'Raj Patel', teams: [] } }] }), { status: 200 });
    });
    const driver = createDjangoDriver(createBackendClient({ baseUrl: 'http://django', storeToken: 't' }, { tenantHost: 'localhost', proto: 'http' }));
    expect(await driver.actingUsers()).toEqual([{ id: '7', name: 'Samira Khan', permissions: ['admin'] }]);
  });
});

describe('seed safety (decision 3)', () => {
  it('refuses any backend that is not this machine unless the flag is set', () => {
    expect(refusalForBackend('http://localhost:8000', {})).toBeNull();
    expect(refusalForBackend('http://127.0.0.1:8000/', {})).toBeNull();
    expect(refusalForBackend('https://levvai-backend-245852154678.us-east1.run.app', {})).toMatch(/Refusing to seed/);
    expect(refusalForBackend('http://localhost.evil.example', {})).toMatch(/Refusing to seed/);
    expect(refusalForBackend('not a url', {})).toMatch(/Not a URL/);
    expect(refusalForBackend('https://example.com', { FLOW_STUDIO_SEED_ALLOW_REMOTE: '0' })).toMatch(/Refusing to seed/);
    expect(refusalForBackend('https://example.com', { FLOW_STUDIO_SEED_ALLOW_REMOTE: '1' })).toBeNull();
  });

  it('refuses a local backend whose database is not local', () => {
    expect(refusalForDatabase({ databaseIsLocal: true }, {})).toBeNull();
    expect(refusalForDatabase({ databaseIsLocal: false }, {})).toMatch(/not on this machine/);
    expect(refusalForDatabase({ databaseIsLocal: false }, { FLOW_STUDIO_SEED_ALLOW_REMOTE: '1' })).toBeNull();
  });
});

describe('seeding (01 §4.2)', () => {
  const load = () => {
    const raw = readRawSeed(FIXTURE_DIR);
    return { raw, seed: buildSeed(raw) };
  };
  const newDriver = () => createMemoryDriver({ tables: emptyTables() }, { now: () => '2026-10-20T09:00:00Z', actingUsers: () => [] });

  it('writes the counts of 00 §8, with the seeded versions approved by "Seed"', async () => {
    const { raw, seed } = load();
    const driver = newDriver();
    expect(await applySeed(driver, raw, seed)).toEqual({ reference: 6, workflows: 15, versions: 14, samples: 29, history: 440, skipped: [] });
    const row = await driver.get('workflows', 'wf-wo-sub-wo-uk-tech');
    expect(row?.versions?.[0]).toMatchObject({ version: 3, approvedBy: 'Seed', workflowId: 'wf-wo-sub-wo-uk-tech' });
    expect(await driver.get('workflows', 'wf-wo-sub-wo-data')).toMatchObject({ versions: [] });
  });

  it('stores workflows in file order and exactly as normalised, reference files exactly as seeded', async () => {
    const { raw, seed } = load();
    const driver = newDriver();
    await applySeed(driver, raw, seed);
    const rows = await driver.list('workflows');
    expect(rows.map((row) => row.id)).toEqual(makeContext().workflows.map((workflow) => workflow.id));
    for (const workflow of seed.workflows) {
      const row = rows.find((candidate) => candidate.id === workflow.id);
      const { versions: _versions, ...rest } = workflow;
      expect(JSON.stringify(row?.doc)).toBe(JSON.stringify(rest));
    }
    expect(JSON.stringify((await driver.get('reference', 'people-and-authority'))?.doc)).toBe(JSON.stringify(raw['people-and-authority']));
    expect((await driver.list('history')).map((row) => row.id)).toEqual(seed.history.map((record) => record.id));
  });

  it('is idempotent: running it again changes no rev and no row', async () => {
    const { raw, seed } = load();
    const driver = newDriver();
    await applySeed(driver, raw, seed);
    const before = JSON.stringify(await driver.list('workflows'));
    await applySeed(driver, raw, seed);
    expect(JSON.stringify(await driver.list('workflows'))).toBe(before);
  });

  it('puts an edited draft back, but leaves alone what was published since or is waiting', async () => {
    const { raw, seed } = load();
    const driver = newDriver();
    await applySeed(driver, raw, seed);
    await driver.tx([
      { op: 'patch', collection: 'workflows', id: 'wf-jp', set: { name: 'Edited' }, bumpRev: true },
      { op: 'patch', collection: 'workflows', id: 'wf-doc', set: { version: 2, name: 'Published since' } },
      { op: 'patch', collection: 'workflows', id: 'wf-ts-sub', set: { pending: { submittedBy: 'A' }, name: 'Waiting' } },
    ]);
    const summary = await applySeed(driver, raw, seed);
    expect(summary.skipped.sort()).toEqual(['wf-doc', 'wf-ts-sub']);
    expect((await driver.get('workflows', 'wf-jp'))?.doc).toMatchObject({ name: 'Job posting created' });
    expect((await driver.get('workflows', 'wf-jp'))?.rev).toBe(3);
    expect((await driver.get('workflows', 'wf-doc'))?.doc).toMatchObject({ name: 'Published since' });
    expect(seedSkips(seed, [])).toEqual([]);
  });

  it('never touches runs', async () => {
    const { raw, seed } = load();
    const driver = newDriver();
    await applySeed(driver, raw, seed);
    const run = { id: 'r1', workflowId: 'wf-jp', version: 1, recordRef: { type: 'job_posting', id: 'J-1' }, event: 'created', status: 'running', startedAt: '2026-10-20T09:00:00Z' };
    await driver.tx([{ op: 'insert', collection: 'runs', id: 'r1', doc: run }]);
    await applySeed(driver, raw, seed);
    expect((await driver.get('runs', 'r1'))?.doc).toEqual(run);
  });
});

describe('clock values (01 §8)', () => {
  it('writes date-times one way', () => {
    expect(canonicalIso(new Date('2026-10-20T09:00:00.000Z'))).toBe('2026-10-20T09:00:00Z');
    expect(canonicalIso(new Date('2026-10-20T09:00:00.120Z'))).toBe('2026-10-20T09:00:00.120Z');
  });

  it('asOf is the date in the company time zone', () => {
    expect(companyDate('2026-10-20T09:00:00Z')).toBe('2026-10-20');
    expect(companyDate('2026-07-01T23:30:00Z')).toBe('2026-07-02');
    expect(companyDate('2026-12-31T23:30:00Z')).toBe('2026-12-31');
  });
});
