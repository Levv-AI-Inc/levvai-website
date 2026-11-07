import { expect, request as apiRequest, test, type Page } from '@playwright/test';
import { canvasOf, nextSave, openStep, panelOf, plusAfter, toastOf, waitForCanvas } from '../e2e/helpers';
import { expectTestPanel, openTest, publishButton, publishDialog, readNova, novaButton } from '../e2e/test-panel';

/**
 * The real thing: FLOW_STUDIO_STORE=django, a real Django session on the local Docker Postgres, in /admin/workflows.
 * Nothing here is stubbed: no LEVV_E2E, no memory store, and the admin layout's /api/session goes to Django.
 */
// The proof before this one switches wf-jp off and edits wf-wo-sub, so this reads one nothing else touches.
const ID = 'wf-ts-sub';
const STEP = 'Overtime approval';
const shellOf = (page: Page) => page.getByRole('region', { name: 'Flow Studio' });

const cookie = async (page: Page, name: string): Promise<string> => (await page.context().cookies()).find((entry) => entry.name === name)?.value ?? '';

async function logIn(page: Page): Promise<void> {
  const response = await page.request.post('/auth/password/login-user', {
    data: { email: process.env.ADMIN_EMAIL, password: process.env.PROOF_PASSWORD },
  });
  expect(response.status()).toBe(200);
  expect(await cookie(page, 'sessionid')).not.toBe('');
}

async function openEmbedded(page: Page): Promise<ReturnType<Page['getByRole']>> {
  await page.goto(`/admin/workflows/${ID}`);
  const shell = shellOf(page);
  await waitForCanvas(shell);
  return shell;
}

test.describe.configure({ mode: 'serial' });

test('an edit in /admin/workflows reaches Postgres and survives a reload', async ({ page }) => {
  await logIn(page);
  const shell = await openEmbedded(page);
  await expect(page.locator('aside').filter({ hasText: 'Admin settings' })).toBeVisible();
  await openStep(shell, STEP);
  const saved = nextSave(page);
  await panelOf(shell).getByLabel('Name', { exact: true }).fill('Overtime approval, Django');
  await expect(shell.getByText('Live v1 · unpublished changes')).toBeVisible();
  await saved;

  await page.reload();
  const again = shellOf(page);
  await waitForCanvas(again);
  await expect(canvasOf(again).getByRole('button', { name: 'Overtime approval, Django', exact: true })).toBeVisible();
  await expect(again.getByText('Live v1 · unpublished changes')).toBeVisible();
});

test('inserting a step from the menu persists and moves draftRev once', async ({ page }) => {
  await logIn(page);
  const shell = await openEmbedded(page);
  const before = ((await (await page.request.get(`/api/flow-studio/workflows/${ID}`)).json()) as { draftRev: number }).draftRev;
  await (await plusAfter(shell, 'T', 'next')).click();
  const saved = nextSave(page);
  await panelOf(shell).getByRole('button', { name: /^Notify Send an FYI/ }).click();
  await expect(panelOf(shell).getByRole('heading', { name: 'Notify', exact: true })).toBeVisible();
  await saved;
  await page.reload();
  const again = shellOf(page);
  await waitForCanvas(again);
  await expect(canvasOf(again).getByRole('button', { name: 'Notify', exact: true })).toBeVisible();
  const after = (await (await page.request.get(`/api/flow-studio/workflows/${ID}`)).json()) as { draftRev: number };
  expect(after.draftRev).toBe(before + 1);
});

test('a stale draftRev shows the conflict toast and writes nothing', async ({ page, baseURL }) => {
  await logIn(page);
  const shell = await openEmbedded(page);
  await openStep(shell, 'Overtime approval, Django');

  // Someone else saves while this page is open.
  const current = (await (await page.request.get(`/api/flow-studio/workflows/${ID}`)).json()) as { workflow: { name: string }; draftRev: number };
  current.workflow.name = 'Changed by someone else';
  const other = await page.request.put(`/api/flow-studio/workflows/${ID}/draft`, {
    data: { draft: current.workflow, draftRev: current.draftRev },
    headers: { 'x-csrftoken': await cookie(page, 'csrftoken'), origin: baseURL as string },
  });
  expect(other.status()).toBe(200);

  const conflict = page.waitForResponse((response) => response.url().includes('/draft') && response.status() === 409);
  await panelOf(shell).getByLabel('Name', { exact: true }).fill('Mine, stale');
  await conflict;
  await expect(toastOf(shell)).toHaveText('This workflow changed since you opened it. Reload to see the latest.');

  await page.reload();
  const again = shellOf(page);
  await waitForCanvas(again);
  await expect(canvasOf(again).getByRole('button', { name: 'Mine, stale', exact: true })).toHaveCount(0);
  await expect(canvasOf(again).getByRole('button', { name: 'Overtime approval, Django', exact: true })).toBeVisible();
  await expect(again.getByRole('button', { name: 'Changed by someone else', exact: true }).and(again.locator('[aria-haspopup="listbox"]'))).toBeVisible();
});

test('Test and Nova run on what Postgres holds', async ({ page }) => {
  await logIn(page);
  // Site access request is untouched by the proof so far, so 06's results hold for it word for word.
  await page.goto('/admin/workflows/wf-access?panel=test&record=AR-301');
  const shell = shellOf(page);
  await waitForCanvas(shell);
  await expectTestPanel(shell, 'EN-010');
  await openTest(shell, 'Returning vendor technician');
  await expectTestPanel(shell, 'EN-011');
  await novaButton(shell).click();
  expect(await readNova(shell)).toEqual([]);
  await expect(shell.getByText('Looks good', { exact: true })).toBeVisible();

  // The proof before this one approved “Data and AI hires” over “UK Technology work orders”, and Test can see that.
  await page.goto('/admin/workflows/wf-wo-sub-wo-uk-tech?panel=test&record=WO-2240');
  const again = shellOf(page);
  await waitForCanvas(again);
  await expect(again.getByText('For real requests, “Data and AI hires” runs for this record.')).toBeVisible();
});

test('a reload during a running save keeps the last edit, on the real store', async ({ page }) => {
  await logIn(page);
  const shell = await openEmbedded(page);
  await openStep(shell, 'Overtime approval, Django');
  let release = (): void => undefined;
  let landedNow = (): void => undefined;
  const landed = new Promise<void>((resolve) => {
    landedNow = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route('**/api/flow-studio/workflows/*/draft', async (route) => {
    if (!first) return route.fallback();
    first = false;
    const response = await route.fetch();
    landedNow();
    await gate;
    return route.fulfill({ response }).catch(() => undefined);
  });
  const name = panelOf(shell).getByLabel('Name', { exact: true });
  await name.fill('Django, first edit');
  await landed;
  await name.fill('Django, last edit');
  await page.reload();
  release();
  const again = shellOf(page);
  await waitForCanvas(again);
  await expect(canvasOf(again).getByRole('button', { name: 'Django, last edit', exact: true })).toBeVisible();
  const saved = (await (await page.request.get(`/api/flow-studio/workflows/${ID}`)).json()) as { workflow: { draft: { nodes: Record<string, { label: string }> } } };
  expect(Object.values(saved.workflow.draft.nodes).map((node) => node.label)).toContain('Django, last edit');
});

test('send for approval as one admin, approve as the second through the API, see Live and the notice in /admin/workflows', async ({ page, baseURL }) => {
  const WORKFLOW = 'wf-access';
  await logIn(page);
  await page.goto(`/admin/workflows/${WORKFLOW}`);
  const shell = shellOf(page);
  await waitForCanvas(shell);
  await expect(shell.getByText('Live v1', { exact: true })).toBeVisible();

  await publishButton(shell).click();
  const dialog = publishDialog(page);
  await expect(dialog.getByLabel('Goes live on')).toHaveValue('2026-10-20');
  await dialog.getByRole('button', { name: 'Send for approval' }).click();
  await expect(dialog.getByText('Sent for approval. Anyone with the “Approve flow changes” permission can approve it. You can’t approve your own change.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(shell.getByText('Waiting for approval', { exact: true })).toBeVisible();

  // The author cannot approve their own change.
  const own = (await (await page.request.get('/api/flow-studio/publish-requests?status=pending')).json()) as { id: string; workflowId: string }[];
  const request = own.find((entry) => entry.workflowId === WORKFLOW);
  expect(request).toBeTruthy();
  const refused = await page.request.post(`/api/flow-studio/publish-requests/${request?.id}/approve`, {
    data: {},
    headers: { 'x-csrftoken': await cookie(page, 'csrftoken'), origin: baseURL as string },
  });
  expect(refused.status()).toBe(403);

  // The second local admin, a separate session, approves through the API: the inbox UI arrives in M7.
  const second = await apiRequest.newContext({ baseURL });
  const login = await second.post('/auth/password/login-user', { data: { email: process.env.SECOND_EMAIL, password: process.env.PROOF_PASSWORD } });
  expect(login.status()).toBe(200);
  const csrf = (await second.storageState()).cookies.find((entry) => entry.name === 'csrftoken')?.value ?? '';
  const approved = await second.post(`/api/flow-studio/publish-requests/${request?.id}/approve`, { data: {}, headers: { 'x-csrftoken': csrf, origin: baseURL as string } });
  expect(approved.status()).toBe(200);
  await second.dispose();

  await page.reload();
  const again = shellOf(page);
  await waitForCanvas(again);
  await expect(again.getByText('Live v2', { exact: true })).toBeVisible();
  await expect(toastOf(again)).toHaveText('Published as v2, live on 20 Oct 2026');
  await page.reload();
  const third = shellOf(page);
  await waitForCanvas(third);
  await expect(third.getByText('Live v2', { exact: true })).toBeVisible();
  await expect(toastOf(third)).toHaveCount(0);
});
