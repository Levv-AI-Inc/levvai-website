import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, request as apiRequest, test, type Browser, type Page } from '@playwright/test';

/**
 * Finding 2 of the post-build review, on the real thing: real Django sessions on the local Docker Postgres, and Django's own
 * `PATCH /auth/user/`, which lets anyone set their first and last name. Authority comes from the Django user id and a link
 * only someone with reference.import can set, never from those names.
 */

const records = (JSON.parse(readFileSync(resolve(__dirname, '../fixtures/seed/runtime-records.json'), 'utf8')) as { records: (Record<string, unknown> & { id: string; record: string; event: string; source: string })[] }).records;
const NEXT = process.env.NEXT_URL as string;
const BACKEND = process.env.FLOW_STUDIO_BACKEND_URL as string;
const STORE_TOKEN = process.env.FLOW_STUDIO_STORE_TOKEN as string;
const SERVICE_TOKEN = process.env.LEVV_SERVICE_TOKEN as string;
const MALLORY = process.env.MALLORY_EMAIL ?? 'mallory@local.levvai.test';
const IVY = process.env.IVY_EMAIL ?? 'ivy@local.levvai.test';

let counter = 0;
const started: string[] = [];
const recordId = (): string => `ID-${Date.now().toString(36)}-${(counter += 1)}`;

async function start(id: string): Promise<string> {
  const context = await apiRequest.newContext({ baseURL: NEXT });
  const record = records.find((candidate) => candidate.id === 'WO-2231') as (typeof records)[number];
  const response = await context.post('/api/runtime/events', { headers: { 'x-levv-service-token': SERVICE_TOKEN }, data: { source: record.source, recordType: record.record, recordId: id, event: record.event, data: { ...record, id } } });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { runIds: string[] };
  await context.dispose();
  started.push(body.runIds[0]);
  return body.runIds[0];
}

async function logIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: NEXT, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const response = await page.request.post('/auth/password/login-user', { data: { email, password: process.env.PROOF_PASSWORD } });
  expect(response.status()).toBe(200);
  return page;
}

const csrfOf = async (page: Page): Promise<string> => (await page.context().cookies()).find((cookie) => cookie.name === 'csrftoken')?.value ?? '';

const post = async (page: Page, path: string, data: unknown) => page.request.post(path, { data, headers: { 'x-csrftoken': await csrfOf(page), origin: NEXT } });

/** Django's own route, which anyone signed in can call. */
async function rename(page: Page, first: string, last: string): Promise<void> {
  const response = await page.request.patch('/auth/user/', { data: { first_name: first, last_name: last }, headers: { 'x-csrftoken': await csrfOf(page), origin: NEXT } });
  expect(response.status(), 'dj_rest_auth PATCH /auth/user/ lets a user set their own name').toBe(200);
  const session = (await (await page.request.get('/api/session')).json()) as { user: { first_name: string; last_name: string } };
  expect(`${session.user.first_name} ${session.user.last_name}`).toBe(`${first} ${last}`);
}

const userIdOf = async (page: Page): Promise<string> => String(((await (await page.request.get('/api/session')).json()) as { user: { id: number } }).user.id);

async function stored(collection: string, query = ''): Promise<{ id: string; doc: Record<string, any> }[]> {
  const context = await apiRequest.newContext();
  const response = await context.get(`${BACKEND}/flowstudio-store/c/${collection}/${query}`, { headers: { 'x-levv-store-token': STORE_TOKEN, 'x-forwarded-host': 'localhost' } });
  expect(response.status()).toBe(200);
  const { rows } = (await response.json()) as { rows: { id: string; doc: Record<string, any> }[] };
  await context.dispose();
  return rows;
}

const openItemOf = async (runId: string, person: string): Promise<string> => {
  const rows = await stored('items', `?runId=${encodeURIComponent(runId)}`);
  const row = rows.find((candidate) => candidate.doc.assignee === person && candidate.doc.status === 'open');
  expect(row, `an open item for ${person}`).toBeDefined();
  return (row as { id: string }).id;
};

// Whatever these left open is stopped, so the proofs after this one find the inboxes as they expect.
test.afterAll(async ({ browser }) => {
  const admin = await logIn(browser, process.env.ADMIN_EMAIL as string);
  for (const runId of started) await post(admin, `/api/runtime/runs/${runId}/stop`, { reason: 'End of the identity proof' });
});

test.describe('A display name carries no authority', () => {
  test('renaming to an approver takes none of their work', async ({ browser }) => {
    const runId = await start(recordId());
    const item = await openItemOf(runId, 'Raj Patel');
    const mallory = await logIn(browser, MALLORY);
    await rename(mallory, 'Raj', 'Patel');
    const inbox = (await (await mallory.request.get('/api/runtime/inbox')).json()) as { approvals: unknown[]; tasks: unknown[]; flowChanges: unknown[] };
    expect(inbox).toEqual({ approvals: [], tasks: [], flowChanges: [] });
    expect((await mallory.request.get(`/api/runtime/work-items/${item}`)).status()).toBe(403);
    expect((await post(mallory, `/api/runtime/work-items/${item}/decide`, { decision: 'approved' })).status()).toBe(403);
    const after = await stored('items', `?runId=${encodeURIComponent(runId)}`);
    expect(after.find((row) => row.id === item)?.doc.status).toBe('open');
  });

  test('renaming to a workflow’s owner gives no control of its runs', async ({ browser }) => {
    const runId = await start(recordId());
    const mallory = await logIn(browser, MALLORY);
    await rename(mallory, 'Procurement', 'operations');
    expect((await post(mallory, `/api/runtime/runs/${runId}/pause`, {})).status()).toBe(403);
    await rename(mallory, '', '');
  });

  test('renaming cannot get around “you can’t approve your own change”', async ({ browser }) => {
    const author = await logIn(browser, process.env.ADMIN_EMAIL as string);
    await rename(author, 'Someone', 'Before');
    const workflows = (await (await author.request.get('/api/flow-studio/workflows')).json()) as { id: string; status: string }[];
    const target = 'wf-jp';
    expect(workflows.some((workflow) => workflow.id === target)).toBe(true);
    const sent = await post(author, `/api/flow-studio/workflows/${target}/publish-requests`, { goLive: '2026-10-20' });
    expect(sent.status(), await sent.text()).toBe(201);
    const { id } = (await sent.json()) as { id: string };
    await rename(author, 'Someone', 'Else');
    const approve = await post(author, `/api/flow-studio/publish-requests/${id}/approve`, {});
    expect(approve.status()).toBe(403);
    expect(((await approve.json()) as { error: { message: string } }).error.message).toBe('You can’t approve your own change.');
    // The other admin clears it, so the rest of the proof finds nothing waiting.
    const other = await logIn(browser, process.env.SECOND_EMAIL as string);
    expect((await post(other, `/api/flow-studio/publish-requests/${id}/reject`, { comment: 'Clearing the proof' })).status()).toBe(200);
    await rename(author, 'Local', 'Admin');
  });
});

test.describe('A person is linked to an account', () => {
  test('only someone with reference.import can link, and only a real person to a real member', async ({ browser }) => {
    const ivy = await logIn(browser, IVY);
    const admin = await logIn(browser, process.env.ADMIN_EMAIL as string);
    const ivyId = await userIdOf(ivy);
    expect((await post(ivy, '/api/flow-studio/account-links', { accountId: ivyId, person: 'Omar Haddad' })).status()).toBe(403);
    expect((await ivy.request.get('/api/flow-studio/account-links')).status()).toBe(403);
    expect((await post(admin, '/api/flow-studio/account-links', { accountId: ivyId, person: 'Nobody Real' })).status()).toBe(422);
    expect((await post(admin, '/api/flow-studio/account-links', { accountId: '99999999', person: 'Omar Haddad' })).status()).toBe(422);
    expect((await post(admin, '/api/flow-studio/account-links', { accountId: ivyId, person: 'Raj Patel' })).status()).toBe(409);
    const listed = (await (await admin.request.get('/api/flow-studio/account-links')).json()) as { members: { id: string; email: string }[]; links: { accountId: string; person: string | null }[] };
    expect(listed.members.some((member) => member.id === ivyId && member.email === IVY)).toBe(true);
    expect(listed.links.some((link) => link.person === 'Raj Patel')).toBe(true);
  });

  test('a linked account keeps its person whatever it is called, and the audit line carries its id', async ({ browser }) => {
    const ivy = await logIn(browser, IVY);
    const admin = await logIn(browser, process.env.ADMIN_EMAIL as string);
    const ivyId = await userIdOf(ivy);
    const id = recordId();
    const runId = await start(id);
    // On this record the approver is Raj Patel, so the hiring manager is set to Omar Haddad for an item that is Ivy's to get.
    expect((await post(admin, `/api/runtime/records/work_order/${id}`, { data: { hiring_manager: 'Omar Haddad' } })).status()).toBe(200);
    const item = await openItemOf(runId, 'Omar Haddad');
    expect((await post(ivy, `/api/runtime/work-items/${item}/decide`, { decision: 'approved' })).status()).toBe(403);
    expect(((await (await ivy.request.get('/api/runtime/inbox')).json()) as { approvals: unknown[] }).approvals).toEqual([]);

    const linked = await post(admin, '/api/flow-studio/account-links', { accountId: ivyId, person: 'Omar Haddad' });
    expect(linked.status(), await linked.text()).toBe(200);
    await rename(ivy, 'Totally', 'Different');
    expect(((await (await ivy.request.get('/api/runtime/inbox')).json()) as { approvals: { id: string }[] }).approvals.map((card) => card.id)).toContain(item);
    expect((await post(ivy, `/api/runtime/work-items/${item}/decide`, { decision: 'approved' })).status()).toBe(200);
    const events = await stored('events', `?runId=${encodeURIComponent(runId)}`);
    const line = events.find((row) => row.doc.m === 'Omar Haddad approved.');
    expect(line?.doc).toMatchObject({ by: 'Omar Haddad', byId: ivyId });

    // Taking the link away takes the identity away, with the next request.
    const unlinked = await post(admin, '/api/flow-studio/account-links', { accountId: ivyId, person: null });
    expect(unlinked.status(), await unlinked.text()).toBe(200);
    await rename(ivy, 'Omar', 'Haddad');
    const session = (await (await ivy.request.get('/api/runtime/inbox')).json()) as { approvals: unknown[] };
    expect(session.approvals).toEqual([]);
    await rename(ivy, 'Ivy', 'Member');
  });

  test('membership is what makes a link count: a person linked in one tenant is nobody in another', async ({ browser }) => {
    const raj = await logIn(browser, process.env.RAJ_EMAIL as string);
    const context = await apiRequest.newContext();
    const fromOtherTenant = await context.get(`${BACKEND}/flowstudio-store/c/links/`, { headers: { 'x-levv-store-token': STORE_TOKEN, 'x-forwarded-host': 'fsproof.localhost' } });
    expect(fromOtherTenant.status()).toBe(200);
    expect(((await fromOtherTenant.json()) as { rows: { doc: { person: string | null } }[] }).rows.filter((row) => row.doc.person === 'Raj Patel')).toEqual([]);
    await context.dispose();
    expect(((await (await raj.request.get('/api/runtime/inbox')).json()) as { approvals: unknown[] }).approvals).toBeDefined();
  });
});
