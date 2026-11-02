import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as approveRoute } from '../../app/api/flow-studio/publish-requests/[id]/approve/route';
import { GET as listLinks, POST as setLink } from '../../app/api/flow-studio/account-links/route';
import { POST as sendRoute } from '../../app/api/flow-studio/workflows/[id]/publish-requests/route';
import { POST as eventsRoute } from '../../app/api/runtime/events/route';
import { POST as recordsRoute } from '../../app/api/runtime/records/[type]/[id]/route';
import { POST as chooseRoute } from '../../app/api/runtime/runs/[id]/choose/route';
import { POST as decideRoute } from '../../app/api/runtime/work-items/[id]/decide/route';
import { POST as resubmitRoute } from '../../app/api/runtime/work-items/[id]/resubmit/route';
import { memoryDriver } from '../../src/flow-studio/data/memory/store';
import { serverClock } from '../../src/flow-studio/server/clock';
import { createMemoryDriver, emptyTables } from '../../src/flow-studio/data/memory/driver';
import { createRepos } from '../../src/flow-studio/data/repos';
import { canApprove, isAuthorOf, othersCanApprove } from '../../src/flow-studio/engine/publish';
import type { AccountLink } from '../../src/flow-studio/model/runtime';
import { requestToDecide } from '../../src/flow-studio/server/publish-decision';
import { ownsWorkflow, personOf, requireRunControl, type Actor } from '../../src/flow-studio/server/permissions';
import { actorFromSession, currentActor, type DjangoSession } from '../../src/flow-studio/server/session';
import { call, resetApp, setE2EEnv, signIn } from '../support/api';
import { createWorld, recordOf } from '../support/runtime-world';

/**
 * Finding 2 of the post-build review. Binding decision 5 mapped a session to a person by "first_name last_name", which
 * anyone can set with PATCH /auth/user/. Authority now comes from the Django user id and a tenant-scoped link.
 * tests/django-e2e/identity.spec.ts proves the same on real sessions on local Django.
 */

const link = (over: Partial<AccountLink> = {}): AccountLink => ({ accountId: '42', email: 'raj@example.com', person: 'Raj Patel', teams: [], linkedBy: '1', linkedAt: '2026-10-20T09:00:00Z', ...over });
const session = (over: DjangoSession & { user?: Record<string, unknown> } = {}): DjangoSession => ({ authenticated: true, user: { id: 42, email: 'raj@example.com' }, membership: { role: 'viewer' }, ...over });
const named = (first: string, last: string) => session({ user: { id: 42, email: 'raj@example.com', first_name: first, last_name: last } });

describe('Who a session is', () => {
  it('a linked account is its person, whatever name it has given itself', () => {
    expect(actorFromSession(named('Totally', 'Different'), link())).toMatchObject({ id: '42', name: 'Raj Patel', person: 'Raj Patel' });
  });

  it('an unlinked account named exactly like an approver holds no person identity', () => {
    const actor = actorFromSession(named('Raj', 'Patel'), null) as Actor;
    expect(actor.person).toBeNull();
    expect(personOf(actor)).toBeNull();
    expect(actor.name).toBe('raj@example.com');
    expect(JSON.stringify(actor)).not.toContain('Patel');
  });

  it('every actor from a real session states its person, so nothing can fall back to a name', () => {
    for (const row of [link(), link({ person: null }), null]) expect('person' in (actorFromSession(session(), row) as Actor)).toBe(true);
  });

  it('a link counts only for a member of this tenant: a worker session has no membership', () => {
    const actor = actorFromSession(session({ membership: null }), link({ teams: ['Procurement operations'] })) as Actor;
    expect(actor.person).toBeNull();
    expect(actor.ownerTeams).toEqual({});
  });

  it('no id means no actor', () => {
    expect(actorFromSession({ authenticated: true, user: { email: 'x@y.z' } }, null)).toBeNull();
    expect(actorFromSession({ authenticated: false }, null)).toBeNull();
  });

  describe('through the real session call', () => {
    const request = new Request('http://localhost/x', { headers: { cookie: 'sessionid=s; csrftoken=c', host: 'localhost' } });
    beforeEach(() => {
      vi.stubEnv('LEVV_E2E', '');
      vi.stubEnv('FLOW_STUDIO_BACKEND_URL', 'http://django');
      vi.stubEnv('FLOW_STUDIO_STORE_TOKEN', 't');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });
    const backend = (answer: { session: unknown; link?: AccountLink | null }, seen: string[] = []) =>
      vi.stubGlobal('fetch', async (url: string) => {
        seen.push(url);
        if (url.endsWith('/api/session')) return new Response(JSON.stringify(answer.session), { status: 200 });
        if (url.includes('/c/links/') && answer.link) return new Response(JSON.stringify({ id: answer.link.accountId, doc: answer.link }), { status: 200 });
        return new Response('{"detail":"Not found."}', { status: 404 });
      });

    it('reads the link by the account id, and ignores what the session says the name is', async () => {
      const seen: string[] = [];
      backend({ session: named('Grace', 'Kim'), link: link() }, seen);
      expect(await currentActor(request)).toMatchObject({ id: '42', person: 'Raj Patel', name: 'Raj Patel' });
      expect(seen.some((url) => url.includes('/c/links/42/'))).toBe(true);
    });

    it('no row: nobody', async () => {
      backend({ session: named('Raj', 'Patel') });
      expect(await currentActor(request)).toMatchObject({ id: '42', person: null, name: 'raj@example.com' });
    });

    it('no membership: the link is not even asked for', async () => {
      const seen: string[] = [];
      backend({ session: session({ membership: null }), link: link() }, seen);
      expect((await currentActor(request))?.person).toBeNull();
      expect(seen.filter((url) => url.includes('/links/'))).toEqual([]);
    });
  });
});

describe('Authority is checked by id', () => {
  it('the author is the account: a new name does not make them someone else', () => {
    expect(isAuthorOf({ id: '42', name: 'Someone Else' }, { submittedBy: 'Raj Patel', submittedById: '42' })).toBe(true);
    expect(canApprove({ id: '42', name: 'Someone Else', permissions: ['admin'] }, { submittedBy: 'Raj Patel', submittedById: '42' })).toBe(false);
  });

  it('and borrowing the author’s name does not make someone the author', () => {
    expect(isAuthorOf({ id: '43', name: 'Raj Patel' }, { submittedBy: 'Raj Patel', submittedById: '42' })).toBe(false);
  });

  it('othersCanApprove looks past the author by id too', () => {
    const users = [{ id: '42', name: 'Raj Patel', permissions: ['admin'] }];
    expect(othersCanApprove({ id: '42', name: 'Someone Else' }, users)).toBe(false);
    expect(othersCanApprove({ id: '43', name: 'Raj Patel' }, users)).toBe(true);
  });

  it('owning a workflow: by the linked person, or by a team the link names, never by the name alone', () => {
    const base = { permissions: [], ownerTeams: {} };
    expect(ownsWorkflow({ ...base, id: '42', name: 'x@y.z', person: null }, { owner: 'x@y.z' })).toBe(false);
    expect(ownsWorkflow({ ...base, id: '42', name: 'Sam Patel', person: 'Sam Patel' }, { owner: 'Sam Patel' })).toBe(true);
    expect(ownsWorkflow({ ...base, id: '42', name: 'x@y.z', person: null, ownerTeams: { 'HR operations': ['42'] } }, { owner: 'HR operations' })).toBe(true);
    expect(ownsWorkflow({ ...base, id: '42', name: 'HR operations', person: null, ownerTeams: { 'HR operations': ['43'] } }, { owner: 'HR operations' })).toBe(false);
    expect(() => requireRunControl({ ...base, id: '42', name: 'Procurement operations', person: null }, { owner: 'Procurement operations' })).toThrow();
  });

  it('an unlinked admin may send and may not approve', async () => {
    const store = createRepos(createMemoryDriver({ tables: emptyTables() }, { now: () => '2026-10-20T09:00:00Z', actingUsers: () => [] }), { now: () => '2026-10-20T09:00:00Z', asOf: () => '2026-10-20' });
    const asked = { publishRequests: { get: async () => ({ id: 'pr', requestedBy: 'x@y.z', requestedById: '1', status: 'pending', workflowId: 'w' }) } } as unknown as typeof store;
    const unlinked: Actor = { id: '2', name: 'z@y.z', person: null, permissions: ['admin'], ownerTeams: {} };
    await expect(requestToDecide(asked, unlinked, 'pr')).rejects.toMatchObject({ status: 403, message: 'Your account isn’t linked to a person in Flow Studio yet, so you can’t approve this. Ask an admin to link it.' });
    const author: Actor = { id: '1', name: 'Renamed', person: 'Sam Patel', permissions: ['admin'], ownerTeams: {} };
    await expect(requestToDecide(asked, author, 'pr')).rejects.toMatchObject({ status: 403, message: 'You can’t approve your own change.' });
    const other: Actor = { id: '2', name: 'Sam Patel', person: 'Sam Patel', permissions: ['admin'], ownerTeams: {} };
    await expect(requestToDecide(asked, other, 'pr')).resolves.toMatchObject({ id: 'pr' });
  });
});

describe('An unlinked account in the runtime', () => {
  const unlinked = (over: Partial<Actor> = {}): Actor => ({ id: '99', name: 'mallory@example.com', person: null, permissions: [], ownerTeams: {}, ...over });

  it('has an empty inbox, however it is named', async () => {
    const world = await createWorld();
    await world.start('WO-2231');
    expect(await world.service.inbox(unlinked({ name: 'Raj Patel' }))).toEqual({ approvals: [], tasks: [], flowChanges: [] });
  });

  it('can’t open or answer anyone’s item', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const item = await world.itemFor(run.id, 'Raj Patel');
    await expect(world.service.itemDetail(unlinked({ name: 'Raj Patel' }), item.id)).rejects.toMatchObject({ status: 403 });
    await expect(world.service.decide(unlinked({ name: 'Raj Patel' }), item.id, 'approved')).rejects.toMatchObject({ status: 403 });
  });

  it('a linked account answers as its person: the requester guard reads the person, and the audit carries the account', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const item = await world.itemFor(run.id, 'Raj Patel');
    const raj: Actor = { id: '42', name: 'Raj Patel', person: 'Raj Patel', permissions: [], ownerTeams: {} };
    await world.service.decide(raj, item.id, 'approved');
    const after = await world.run(run.id);
    expect(after.log.find((line) => line.m === 'Raj Patel approved.')).toMatchObject({ by: 'Raj Patel', byId: '42' });
    expect(after.steps.RA_A1.decisions?.[0]).toMatchObject({ by: 'Raj Patel', byId: '42' });
  });

  it('own-request guard: a requester renamed to the assignee is still the requester', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { requester: 'Sam Patel' });
    const item = await world.itemFor(run.id, 'Raj Patel');
    const samAsRaj: Actor = { id: '7', name: 'Sam Patel', person: 'Sam Patel', permissions: [], ownerTeams: {} };
    await expect(world.service.decide(samAsRaj, item.id, 'approved')).rejects.toMatchObject({ status: 403 });
  });

  it('pause and stop lines say who by id, on a real account', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const admin: Actor = { id: '3', name: 'admin@example.com', person: null, permissions: ['admin'], ownerTeams: {} };
    await world.service.pause(admin, run.id, 'Checking');
    expect((await world.run(run.id)).log.find((line) => line.type === 'paused')).toMatchObject({ by: 'admin@example.com', byId: '3' });
  });

  it('a record edit is on the record of who made it', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const admin: Actor = { id: '3', name: 'admin@example.com', person: null, permissions: ['admin'], ownerTeams: {} };
    await world.service.editRecordAs(admin, 'work_order', 'WO-2231', { site: 'Remote' });
    expect((await world.run(run.id)).log.find((line) => line.type === 'record_changed')).toMatchObject({ by: 'admin@example.com', byId: '3' });
  });
});

describe('POST /api/flow-studio/account-links', () => {
  beforeEach(async () => {
    setE2EEnv();
    await resetApp();
    for (const user of ['Samira Khan', 'Flow Admin', 'Raj Patel', 'Grace Kim']) await signIn(user);
  });

  it('needs reference.import to read or write', async () => {
    expect((await call(setLink, '/x', { user: 'Raj Patel', body: { accountId: 'Raj Patel', person: 'Raj Patel' } })).status).toBe(403);
    expect((await call(setLink, '/x', { user: 'Flow Admin', body: { accountId: 'Raj Patel', person: 'Raj Patel' } })).status).toBe(403);
    expect((await call(listLinks, '/x', { user: 'Grace Kim' })).status).toBe(403);
  });

  it('links a member to a person in reference data', async () => {
    const saved = await call(setLink, '/x', { user: 'Samira Khan', body: { accountId: 'Grace Kim', person: 'Grace Kim', teams: ['Procurement operations'] } });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ accountId: 'Grace Kim', person: 'Grace Kim', teams: ['Procurement operations'], linkedBy: 'Samira Khan' });
    const listed = await call(listLinks, '/x', { user: 'Samira Khan' });
    expect(listed.body.links).toHaveLength(1);
    expect(listed.body.members.map((member: { id: string }) => member.id)).toContain('Grace Kim');
  });

  it('refuses what isn’t real: an account that isn’t a member, a person who isn’t in the data, a team nothing is owned by', async () => {
    expect((await call(setLink, '/x', { user: 'Samira Khan', body: { accountId: 'Nobody', person: 'Grace Kim' } })).body.error.code).toBe('NOT_A_MEMBER');
    expect((await call(setLink, '/x', { user: 'Samira Khan', body: { accountId: 'Grace Kim', person: 'Nobody Real' } })).body.error.code).toBe('NOT_A_PERSON');
    expect((await call(setLink, '/x', { user: 'Samira Khan', body: { accountId: 'Grace Kim', person: 'Grace Kim', teams: ['Made up'] } })).body.error.code).toBe('NOT_A_TEAM');
  });

  it('one person, one account; unlinking frees them', async () => {
    expect((await call(setLink, '/x', { user: 'Samira Khan', body: { accountId: 'Grace Kim', person: 'Raj Patel' } })).status).toBe(200);
    const second = await call(setLink, '/x', { user: 'Samira Khan', body: { accountId: 'Owen Clarke', person: 'Raj Patel' } });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('PERSON_ALREADY_LINKED');
    expect((await call(setLink, '/x', { user: 'Samira Khan', body: { accountId: 'Grace Kim', person: null } })).status).toBe(200);
    expect((await call(setLink, '/x', { user: 'Samira Khan', body: { accountId: 'Owen Clarke', person: 'Raj Patel' } })).status).toBe(200);
  });

  it('E2E actors still work as before: the link table is not consulted for them', async () => {
    const sent = await call(sendRoute, '/x', { user: 'Flow Admin', params: { id: 'wf-jp' }, body: { goLive: '2026-10-20' } });
    expect(sent.status).toBe(201);
    expect((await call(approveRoute, '/x', { user: 'Flow Admin', params: { id: sent.body.id }, body: {} })).status).toBe(403);
    expect((await call(approveRoute, '/x', { user: 'Samira Khan', params: { id: sent.body.id }, body: {} })).status).toBe(200);
  });
});

describe('The routes refuse control fields', () => {
  const SERVICE = { 'x-levv-service-token': 'test-service-token' };
  const event = { source: 'levv', recordType: 'work_order', recordId: 'WO-2231', event: 'submitted', data: { ...recordOf('WO-2231') } };

  beforeEach(async () => {
    setE2EEnv();
    await resetApp();
    for (const user of ['Samira Khan', 'Raj Patel', 'Grace Kim']) await signIn(user);
  });

  it('POST /work-items/:id/resubmit, as the review found it: prev, requester and states', async () => {
    const started = await call(eventsRoute, '/x', { body: event, headers: SERVICE });
    const items = await createRepos(await memoryDriver(), serverClock).workItems.forRun(started.body.runIds[0]);
    const approve = items.find((item) => item.assignee === 'Raj Patel') as { id: string };
    expect((await call(decideRoute, '/x', { user: 'Raj Patel', params: { id: approve.id }, body: { decision: 'rejected', comment: 'No' } })).status).toBe(200);
    const after = await createRepos(await memoryDriver(), serverClock).workItems.forRun(started.body.runIds[0]);
    const resubmit = after.find((item) => item.kind === 'resubmit') as { id: string };
    for (const data of [{ prev: { total_value: 95000 } }, { requester: 'Sam Patel', hiring_manager: 'Grace Kim', business_unit: 'Marketing' }, { states: ['wo_approved'] }]) {
      const refused = await call(resubmitRoute, '/x', { user: 'Grace Kim', params: { id: resubmit.id }, body: { data } });
      expect(refused.status).toBe(422);
      expect(refused.body.error.code).toBe('FIELD_NOT_EDITABLE');
    }
    expect((await call(resubmitRoute, '/x', { user: 'Grace Kim', params: { id: resubmit.id }, body: { data: { total_value: 90000 } } })).status).toBe(200);
  });

  it('POST /runtime/events from an admin’s session: the same deny list, and who it was', async () => {
    await call(eventsRoute, '/x', { body: event, headers: SERVICE });
    const data = (changes: Record<string, unknown>) => ({ ...event, data: { ...event.data, ...changes } });
    for (const changes of [{ prev: { total_value: 1 } }, { states: ['wo_approved'] }, { requester: 'Sam Patel' }]) {
      const refused = await call(eventsRoute, '/x', { user: 'Samira Khan', body: data(changes) });
      expect(refused.status).toBe(422);
      expect(refused.body.error.code).toBe('FIELD_NOT_EDITABLE');
    }
    const accepted = await call(eventsRoute, '/x', { user: 'Samira Khan', body: data({ site: 'Remote' }) });
    expect(accepted.status).toBe(200);
    const stored = (await createRepos(await memoryDriver(), serverClock).inbound.findByRecord('WO-2231')).at(-1);
    expect(stored?.receivedBy).toBe('Samira Khan');
    // The token: it isn't refused, and what it can't change stays as it was.
    const byToken = await call(eventsRoute, '/x', { body: data({ requester: 'Sam Patel' }), headers: SERVICE });
    expect(byToken.status).toBe(200);
    const record = await createRepos(await memoryDriver(), serverClock).rawGet('records', 'WO-2231');
    expect((record?.doc as { data: { requester: string } }).data.requester).toBe('Grace Kim');
  });

  it('POST /runtime/records and /choose: who raised it can’t change on an open run, by either', async () => {
    const conflict = { field: 'Requester', a: { by: 'A', v: '1', total: 95000 }, b: { by: 'B', v: '2', total: 95000 } };
    const started = await call(eventsRoute, '/x', { body: { ...event, data: { ...event.data, conflict } }, headers: SERVICE });
    const edited = await call(recordsRoute, '/x', { user: 'Samira Khan', params: { type: 'work_order', id: 'WO-2231' }, body: { data: { requester: 'Sam Patel' } } });
    expect(edited.status).toBe(422);
    expect(edited.body.error.code).toBe('FIELD_NOT_EDITABLE');
    const chosen = await call(chooseRoute, '/x', { user: 'Samira Khan', params: { id: started.body.runIds[0] }, body: { choice: 'a' } });
    expect(chosen.status).toBe(422);
    expect(chosen.body.error.code).toBe('FIELD_NOT_EDITABLE');
    const record = await createRepos(await memoryDriver(), serverClock).rawGet('records', 'WO-2231');
    expect((record?.doc as { data: { requester: string } }).data.requester).toBe('Grace Kim');
  });

  it('POST /runtime/records/:type/:id', async () => {
    await call(eventsRoute, '/x', { body: event, headers: SERVICE });
    const params = { type: 'work_order', id: 'WO-2231' };
    expect((await call(recordsRoute, '/x', { user: 'Samira Khan', params, body: { data: { states: ['wo_approved'] } } })).status).toBe(422);
    expect((await call(recordsRoute, '/x', { user: 'Samira Khan', params, body: { data: { total_value: 'lots' } } })).body.error.code).toBe('INVALID_VALUE');
    expect((await call(recordsRoute, '/x', { user: 'Samira Khan', params, body: { data: { total_value: 96000 } } })).status).toBe(200);
  });
});
