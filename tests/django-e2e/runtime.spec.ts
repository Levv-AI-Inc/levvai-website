import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, request as apiRequest, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { button, chip, confirmDialog, historyLine, inboxCard, pauseWith, shot } from '../e2e/runtime-helpers';

/**
 * The runtime on the real thing: FLOW_STUDIO_STORE=django, real Django sessions on the local Docker Postgres, and no
 * LEVV_E2E. The service token and the cron secret are the real ones. Nothing here is stubbed except what 00 §4.2 says this
 * build stubs: the adapters, which is why it also checks that a person can see they are simulated.
 */

const records = (JSON.parse(readFileSync(resolve(__dirname, '../fixtures/seed/runtime-records.json'), 'utf8')) as { records: (Record<string, unknown> & { id: string; record: string; event: string; source: string })[] }).records;
const NEXT = process.env.NEXT_URL as string;
const BACKEND = process.env.FLOW_STUDIO_BACKEND_URL as string;
const STORE_TOKEN = process.env.FLOW_STUDIO_STORE_TOKEN as string;
const SERVICE_TOKEN = process.env.LEVV_SERVICE_TOKEN as string;
const CRON_SECRET = process.env.LEVV_CRON_SECRET as string;

const eventFor = (id: string, recordId = id) => {
  const record = records.find((candidate) => candidate.id === id) as (typeof records)[number];
  return { source: record.source, recordType: record.record, recordId, event: record.event, data: { ...record, id: recordId } };
};

async function plain(): Promise<APIRequestContext> {
  return apiRequest.newContext({ baseURL: NEXT });
}

async function post(id: string, recordId = id): Promise<{ inboundEventId: string; runIds: string[]; outcome: string }> {
  const context = await plain();
  const response = await context.post('/api/runtime/events', { headers: { 'x-levv-service-token': SERVICE_TOKEN }, data: eventFor(id, recordId) });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { inboundEventId: string; runIds: string[]; outcome: string };
  await context.dispose();
  return body;
}

async function logIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: NEXT, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const response = await page.request.post('/auth/password/login-user', { data: { email, password: process.env.PROOF_PASSWORD } });
  expect(response.status()).toBe(200);
  return page;
}

const csrfOf = async (page: Page): Promise<string> => (await page.context().cookies()).find((cookie) => cookie.name === 'csrftoken')?.value ?? '';

async function write(page: Page, path: string, method: 'post' | 'put', data: unknown) {
  return page.request[method](path, { data, headers: { 'x-csrftoken': await csrfOf(page), origin: NEXT } });
}

/** Straight at Django, past Next: what is really in Postgres. */
async function stored(collection: string, query = ''): Promise<{ id: string; doc: Record<string, any> }[]> {
  const context = await apiRequest.newContext();
  const response = await context.get(`${BACKEND}/flowstudio-store/c/${collection}/${query}`, { headers: { 'x-levv-store-token': STORE_TOKEN, 'x-forwarded-host': 'localhost' } });
  expect(response.status()).toBe(200);
  const { rows } = (await response.json()) as { rows: { id: string; doc: Record<string, any> }[] };
  await context.dispose();
  return rows;
}

const openRun = async (page: Page, id: string): Promise<void> => {
  await page.goto(`/runs/${id}`);
  await expect(page.getByRole('region', { name: 'History' })).toBeVisible();
};

test.describe.configure({ mode: 'serial' });

let approvedRun = '';
let reminderRun = '';

test('an event with the service token starts a run; the assignee approves through /inbox; Pause and Resume hold it up in between', async ({ browser }) => {
  const started = await post('WO-2231');
  expect(started.outcome).toBe('started');
  approvedRun = started.runIds[0];
  const [row] = await stored('runs', `?recordId=WO-2231`);
  expect(row.doc).toMatchObject({ workflowId: 'wf-wo-sub', status: 'running', recordRef: { type: 'work_order', id: 'WO-2231' } });

  // The same event again: the claim in Postgres turns it away.
  expect((await post('WO-2231')).outcome).toBe('duplicate');
  expect(await stored('runs', '?recordId=WO-2231')).toHaveLength(1);

  const admin = await logIn(browser, process.env.ADMIN_EMAIL as string);
  await admin.goto('/home');
  await admin.getByRole('link', { name: 'Running workflows', exact: true }).click();
  await expect(admin.getByRole('heading', { name: 'Running workflows' })).toBeVisible();
  await admin.getByRole('link', { name: 'Operations analyst (WO-2231)' }).click();
  await expect(admin.getByRole('heading', { name: 'Operations analyst (WO-2231)' })).toBeVisible();
  await expect(chip(admin, 'Running')).toBeVisible();
  await expect(admin.getByRole('group', { name: 'Workflow canvas' }).getByRole('button', { name: 'Business sign-off', exact: true })).toBeVisible();
  await expect(admin.getByText('Some results on this run are simulated.')).toBeVisible();
  await shot(admin, 'real-run-detail');

  await pauseWith(admin, 'Checking the supplier');
  await expect(chip(admin, 'Paused')).toBeVisible();
  await expect(historyLine(admin, 'Paused by admin@local.levvai.test on 20 Oct 2026, 09:00 UTC: Checking the supplier')).toBeVisible();

  // RT-10 in real mode: Raj Patel, no admin role, a real session. He finds Inbox in the sidebar, and no Running workflows.
  const raj = await logIn(browser, process.env.RAJ_EMAIL as string);
  await raj.goto('/home');
  await expect(raj.getByRole('link', { name: 'Running workflows', exact: true })).toHaveCount(0);
  await raj.getByRole('link', { name: 'Inbox', exact: true }).click();
  const card = inboxCard(raj, 'Business sign-off · Operations analyst (WO-2231)');
  await expect(card).toContainText('What’s asked: approve as');
  await shot(raj, 'real-inbox');
  await raj.goto(`/runs/${approvedRun}`);
  await expect(raj.getByText('You don’t have access to running workflows.')).toBeVisible();
  await raj.goto('/inbox');
  await button(inboxCard(raj, 'Business sign-off · Operations analyst (WO-2231)'), 'Approve').click();
  await expect(raj.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();

  await admin.reload();
  await expect(chip(admin, 'Paused')).toBeVisible();
  await expect(admin.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Business sign-off' }).getByText('Done', { exact: true })).toBeVisible();
  await expect(admin.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Tell the supplier' }).getByText('Not started')).toBeVisible();

  await button(admin, 'Resume').click();
  await expect(chip(admin, 'Completed')).toBeVisible();
  await expect(historyLine(admin, 'Resumed by admin@local.levvai.test on 20 Oct 2026, 09:00 UTC')).toBeVisible();
  for (const name of ['Pause', 'Resume', 'Stop']) await expect(button(admin, name)).toHaveCount(0);

  const events = await stored('events', `?runId=${approvedRun}`);
  expect(events.map((event) => event.doc.type)).toEqual(expect.arrayContaining(['started', 'paused', 'decision', 'resumed', 'completed']));
  const outbox = await stored('outbox', `?runId=${approvedRun}`);
  expect(outbox.map((message) => message.doc.subject)).toEqual(['Approval needed: Operations analyst', 'Work order submitted: Tell the supplier']);
  expect(outbox.every((message) => message.doc.sentAt === undefined)).toBe(true);
  await admin.context().close();
  await raj.context().close();
});

test('Stop with a reason is final, and LEVV_MOCK_AUTOCOMPLETE=1 is ignored in production', async ({ browser }) => {
  const started = await post('WO-2214-A');
  expect(started.outcome).toBe('started');
  const runId = started.runIds[0];

  // The proof starts next with the flag set. A production process must not hand over a worker's documents by itself.
  const items = (await stored('items', `?runId=${runId}`)).map((row) => row.doc);
  const collect = items.filter((item) => item.kind === 'collect' && item.status === 'open');
  expect(collect.length).toBeGreaterThan(0);
  expect(collect.some((item) => item.assignee === 'the worker')).toBe(true);

  const admin = await logIn(browser, process.env.ADMIN_EMAIL as string);
  await openRun(admin, runId);
  const workday = admin.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Workday provisioning' });
  await expect(workday.getByText('Simulated: nothing was sent to Workday. This build has no live connection to it.')).toBeVisible();
  await expect(workday.getByText('Workday worker ID: WD-WO-2214-A')).toBeVisible();
  await shot(admin, 'real-run-onboarding');

  await button(admin, 'Stop').click();
  const dialog = admin.getByRole('dialog', { name: 'Stop this workflow?' });
  await expect(button(dialog, 'Stop workflow')).toBeDisabled();
  await confirmDialog(admin, 'Stop this workflow?', 'Reason', 'Request withdrawn', 'Stop workflow');
  await expect(chip(admin, 'Stopped')).toBeVisible();
  await expect(historyLine(admin, 'Stopped by admin@local.levvai.test on 20 Oct 2026, 09:00 UTC: Request withdrawn')).toBeVisible();
  for (const name of ['Pause', 'Resume', 'Stop']) await expect(button(admin, name)).toHaveCount(0);

  for (const [path, data] of [['resume', {}], ['pause', {}], ['stop', { reason: 'again' }]] as const) {
    const refused = await write(admin, `/api/runtime/runs/${runId}/${path}`, 'post', data);
    expect(refused.status()).toBe(409);
    expect(((await refused.json()) as { error: { code: string } }).error.code).toBe('RUN_STOPPED');
  }
  const after = (await stored('items', `?runId=${runId}`)).map((row) => row.doc);
  expect(after.filter((item) => item.status === 'open')).toEqual([]);

  // A second run to reach by the tick, a day later.
  const waiting = await post('AR-301');
  reminderRun = waiting.runIds[0];
  expect(waiting.outcome).toBe('started');
  await admin.context().close();
});

test('the secrets: a wrong store token and a wrong cron secret are refused, in both directions', async () => {
  const context = await plain();
  for (const headers of [{}, { 'x-levv-cron-secret': 'wrong' }] as Record<string, string>[]) {
    expect((await context.post('/api/runtime/tick', { headers, data: {} })).status()).toBe(403);
  }
  for (const headers of [{}, { 'x-levv-service-token': 'wrong' }] as Record<string, string>[]) {
    expect((await context.post('/api/runtime/events', { headers, data: eventFor('WO-2231', 'NEVER') })).status()).toBe(403);
  }
  const ticked = await context.post('/api/runtime/tick', { headers: { 'x-levv-cron-secret': CRON_SECRET }, data: {} });
  expect(ticked.status()).toBe(200);
  expect(await ticked.json()).toEqual({ processed: 0 });
  expect(await stored('runs', '?recordId=NEVER')).toEqual([]);
  await context.dispose();

  const django = await apiRequest.newContext();
  const asDjango = (headers: Record<string, string>) => django.get(`${BACKEND}/flowstudio-store/c/runs/`, { headers: { 'x-forwarded-host': 'localhost', ...headers } });
  expect((await asDjango({})).status()).toBe(403);
  expect((await asDjango({ 'x-levv-store-token': 'wrong' })).status()).toBe(403);
  expect((await asDjango({ 'x-levv-store-token': STORE_TOKEN })).status()).toBe(200);
  await django.dispose();
});

test('a publish request is approved from the inbox by the second person, never the author', async ({ browser }) => {
  const author = await logIn(browser, process.env.ADMIN_EMAIL as string);
  const loaded = (await (await author.request.get('/api/flow-studio/workflows/wf-offboard')).json()) as { workflow: Record<string, any>; draftRev: number };
  loaded.workflow.draft.nodes.WC.label = 'Close the work order, reviewed';
  const saved = await write(author, '/api/flow-studio/workflows/wf-offboard/draft', 'put', { draft: loaded.workflow, draftRev: loaded.draftRev });
  expect(saved.status()).toBe(200);
  const sent = await write(author, '/api/flow-studio/workflows/wf-offboard/publish-requests', 'post', { goLive: '2026-10-20' });
  expect(sent.status()).toBe(201);
  const version = loaded.workflow.version as number;

  // 05 §5.3: the approver hears, and the author doesn't.
  const told = await stored('outbox', '?to=Samira%20Khan');
  expect(told.some((message) => message.doc.subject === 'Flow change to approve: Contractor offboarding')).toBe(true);
  expect(await stored('outbox', '?to=admin%40local.levvai.test')).toEqual([]);

  await author.goto('/inbox');
  await expect(author.getByRole('region', { name: 'Flow changes to approve' }).getByText('Nothing waiting for you.')).toBeVisible();
  const [copyRow] = (await stored('items', '?kind=publish_request&status=open')).filter((row) => row.doc.assignee === 'Samira Khan');
  await author.goto(`/inbox/${copyRow.id}`);
  await expect(author.getByText('You can’t approve your own change.')).toBeVisible();
  for (const name of ['Approve', 'Reject']) await expect(button(author, name)).toHaveCount(0);

  const second = await logIn(browser, process.env.SECOND_EMAIL as string);
  await second.goto('/home');
  await second.getByRole('link', { name: 'Inbox', exact: true }).click();
  const card = inboxCard(second, 'Contractor offboarding · goes live on 20 Oct 2026');
  await expect(card.getByText('Sent by admin@local.levvai.test')).toBeVisible();
  await shot(second, 'real-inbox-flow-change');
  await button(card, 'Approve').click();
  await expect(second.getByRole('region', { name: 'Flow changes to approve' }).getByText('Nothing waiting for you.')).toBeVisible();

  const [row] = (await stored('workflows', '')).filter((candidate) => candidate.id === 'wf-offboard');
  expect(row.doc).toMatchObject({ version: version + 1, pending: null });
  await author.context().close();
  await second.context().close();
});

test('@later a day on, the cron secret’s tick sends the reminder once', async ({ browser }) => {
  const rows = await stored('runs', '?recordId=AR-301');
  const runId = rows[0].id;
  const context = await plain();
  expect((await context.post('/api/runtime/tick', { headers: { 'x-levv-cron-secret': 'wrong' }, data: {} })).status()).toBe(403);
  const first = await context.post('/api/runtime/tick', { headers: { 'x-levv-cron-secret': CRON_SECRET }, data: {} });
  expect(first.status()).toBe(200);
  expect(((await first.json()) as { processed: number }).processed).toBeGreaterThanOrEqual(1);
  const second = await context.post('/api/runtime/tick', { headers: { 'x-levv-cron-secret': CRON_SECRET }, data: {} });
  expect(await second.json()).toEqual({ processed: 0 });
  await context.dispose();

  const reminders = (await stored('outbox', `?runId=${runId}`)).filter((message) => String(message.doc.subject).startsWith('Reminder:'));
  expect(reminders.map((message) => message.doc.to)).toEqual(['Ravi Kumar']);
  const admin = await logIn(browser, process.env.ADMIN_EMAIL as string);
  await openRun(admin, runId);
  await expect(historyLine(admin, 'Reminder sent to Ravi Kumar. 21 Oct 2026, 09:05 UTC')).toBeVisible();
  await expect(chip(admin, 'Running')).toBeVisible();
  await shot(admin, 'real-run-after-tick');
  await admin.context().close();
  expect(reminderRun === '' || reminderRun === runId).toBe(true);
  expect(approvedRun === '' || approvedRun !== runId).toBe(true);
});
