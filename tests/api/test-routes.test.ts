import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listRoute } from '../../app/api/flow-studio/workflows/route';
import { PUT as draftRoute } from '../../app/api/flow-studio/workflows/[id]/draft/route';
import { GET as getRoute } from '../../app/api/flow-studio/workflows/[id]/route';
import { POST as clockRoute } from '../../app/api/test/clock/route';
import { POST as resetRoute } from '../../app/api/test/reset/route';
import { GET as sessionRoute } from '../../app/api/test/session/route';
import { POST as signInRoute } from '../../app/api/test/sign-in/route';
import { GET as reviewRoute } from '../../app/api/flow-studio/workflows/[id]/publish-review/route';
import { call, resetApp, routeFiles, signIn, setE2EEnv } from '../support/api';
import { signE2ESession } from '@flow-studio/server/e2e';

setE2EEnv();

beforeEach(() => resetApp());
afterEach(() => vi.unstubAllEnvs());

describe('test-only routes without LEVV_E2E=1', () => {
  const setups: [string, unknown, Record<string, unknown>][] = [
    ['reset', resetRoute, { method: 'POST' }],
    ['sign-in', signInRoute, { body: { user: 'Flow Admin' } }],
    ['clock', clockRoute, { body: { advanceMs: 1000 } }],
    ['session', sessionRoute, {}],
  ];

  it.each(setups)('%s answers 404 with nothing else', async (_name, route, options) => {
    for (const value of ['', '0', 'true']) {
      vi.stubEnv('LEVV_E2E', value);
      const result = await call(route, '/api/test/x', options);
      expect(result.status).toBe(404);
      expect(result.body).toBeNull();
    }
  });

  it('every route under app/api/test is one of those', () => {
    const files = routeFiles(join(__dirname, '..', '..', 'app', 'api', 'test')).map((file) => file.split('/api/test/')[1]);
    expect(files.sort()).toEqual(['clock/route.ts', 'reset/route.ts', 'session/route.ts', 'sign-in/route.ts']);
  });

  it('a sign-in does not set a cookie', async () => {
    vi.stubEnv('LEVV_E2E', '');
    const result = await call(signInRoute, '/api/test/sign-in', { body: { user: 'Flow Admin' } });
    expect(result.headers.get('set-cookie')).toBeNull();
  });
});

describe('POST /api/test/reset', () => {
  it('answers 204 and puts everything back', async () => {
    await signIn('Flow Admin');
    const { body: found } = await call(getRoute, '/x', { user: 'Flow Admin', params: { id: 'wf-jp' } });
    await call(draftRoute, '/x', { method: 'PUT', user: 'Flow Admin', params: { id: 'wf-jp' }, body: { draft: { ...found.workflow, name: 'Changed' }, draftRev: 1 } });
    await call(clockRoute, '/x', { body: { advanceMs: 3_600_000 } });

    const result = await call(resetRoute, '/api/test/reset', { method: 'POST' });
    expect(result.status).toBe(204);

    const after = await call(getRoute, '/x', { user: 'Flow Admin', params: { id: 'wf-jp' } });
    expect(after.body.workflow.name).toBe('Job posting created');
    expect(after.body.draftRev).toBe(1);
    expect((await call(clockRoute, '/x', { body: {} })).body.now).toBe('2026-10-20T09:00:00Z');
  });

  it('loads the actor set it is asked for', async () => {
    await call(resetRoute, '/x', { body: { actors: 'author-only-approver' } });
    await signIn('Flow Admin');
    const review = await call(reviewRoute, '/x', { user: 'Flow Admin', params: { id: 'wf-access' } });
    expect(review.body.canSend).toBe(false);
    expect((await call(resetRoute, '/x', { body: { actors: 'nope' } })).status).toBe(400);
  });
});

describe('POST /api/test/sign-in', () => {
  it('signs in an actor, or anyone in PEOPLE with no permissions', async () => {
    await signIn('Flow Admin');
    expect((await call(listRoute, '/x', { user: 'Flow Admin' })).status).toBe(200);
    await signIn('Mei Lin');
    expect((await call(listRoute, '/x', { user: 'Mei Lin' })).status).toBe(403);
  });

  it('answers 404 for an unknown name', async () => {
    expect((await call(signInRoute, '/x', { body: { user: 'Nobody Here' } })).status).toBe(404);
  });

  it('refuses a cookie that was not signed', async () => {
    const forged = `${Buffer.from('Flow Admin').toString('base64url')}.0000`;
    expect((await call(listRoute, '/x', { headers: { cookie: `sessionid=${forged}` } })).status).toBe(401);
    expect((await call(listRoute, '/x', { headers: { cookie: 'sessionid=nonsense' } })).status).toBe(401);
    expect((await call(listRoute, '/x', { headers: { cookie: `sessionid=${signE2ESession('Flow Admin')}` } })).status).toBe(200);
  });

  it('sets an http-only cookie named sessionid, as the middleware expects', async () => {
    const result = await call(signInRoute, '/x', { body: { user: 'Flow Admin' } });
    const cookie = result.headers.get('set-cookie') ?? '';
    expect(cookie.startsWith('sessionid=')).toBe(true);
    expect(cookie.toLowerCase()).toContain('httponly');
  });
});

describe('POST /api/test/clock', () => {
  it('sets the time, moves it forward and never back', async () => {
    const set = await call(clockRoute, '/x', { body: { now: '2026-10-20T10:00:00Z' } });
    expect(set.body).toEqual({ now: '2026-10-20T10:00:00Z', processed: 0 });
    const moved = await call(clockRoute, '/x', { body: { advanceMs: 7_200_000 } });
    expect(moved.body.now).toBe('2026-10-20T12:00:00Z');
    const back = await call(clockRoute, '/x', { body: { now: '2026-10-20T09:00:00Z' } });
    expect(back.status).toBe(422);
    expect((await call(clockRoute, '/x', { body: {} })).body.now).toBe('2026-10-20T12:00:00Z');
    expect((await call(clockRoute, '/x', { body: { now: 'nonsense' } })).status).toBe(400);
    expect((await call(clockRoute, '/x', { body: { advanceMs: -1 } })).status).toBe(400);
  });

  it('is the clock the engine sees: a later day makes yesterday a past date', async () => {
    await signIn('Flow Admin');
    await call(clockRoute, '/x', { body: { now: '2026-10-21T00:30:00Z' } });
    const review = await call(reviewRoute, '/x', { user: 'Flow Admin', params: { id: 'wf-access' } });
    expect(review.body.effective).toBe('2026-10-21');
  });
});

describe('GET /api/test/session', () => {
  it('answers like Django for someone signed in', async () => {
    await signIn('Samira Khan');
    const result = await call(sessionRoute, '/api/session', { user: 'Samira Khan' });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ authenticated: true, user: { first_name: 'Samira', last_name: 'Khan' }, membership: { role: 'admin' } });
  });

  it('gives role admin to flow.edit so the admin layout admits them, and viewer otherwise (decision 5)', async () => {
    await signIn('Flow Admin');
    expect((await call(sessionRoute, '/x', { user: 'Flow Admin' })).body.membership.role).toBe('admin');
    await signIn('Grace Kim');
    expect((await call(sessionRoute, '/x', { user: 'Grace Kim' })).body.membership.role).toBe('viewer');
  });

  it('answers 401 for nobody', async () => {
    expect(await call(sessionRoute, '/x', {})).toMatchObject({ status: 401, body: { authenticated: false } });
  });
});
