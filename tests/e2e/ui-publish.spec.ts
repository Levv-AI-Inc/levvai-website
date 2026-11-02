import { expect, test, type Locator, type Page } from '@playwright/test';
import { tableOf } from '../support/acceptance-doc';
import {
  boxText,
  canvasOf,
  choose,
  expectSaved,
  freshApp,
  norm,
  novaCount,
  openStep,
  openWorkflow,
  optionTexts,
  panelOf,
  pickerButton,
  plusAfter,
  resetApp,
  selectButton,
  signIn,
  toastOf,
  waitForCanvas,
} from './helpers';
import { expectTestPanel, novaButton, novaPanelOf, openTest, publishButton, publishDialog, readNova, readTestPanel, testButton, testPanelOf } from './test-panel';

/** 06 B.6, UI-P1 to UI-P6, UI-PERM-01, and the UI halves of Part C. */

const WO = 'Work order submitted';
const READY = '✓ Ready to send for approval.';
const SENT = 'Sent for approval. Anyone with the “Approve flow changes” permission can approve it. You can’t approve your own change.';

const banner = (page: Page): Locator => page.getByRole('banner');
const textOf = async (locator: Locator): Promise<string> => norm((await locator.textContent()) ?? '');
const sendButton = (dialog: Locator): Locator => dialog.getByRole('button', { name: 'Send for approval' });
const goLive = (dialog: Locator): Locator => dialog.getByLabel('Goes live on');
const impactOf = (dialog: Locator): Locator => dialog.locator('p').first();
const readyLine = (dialog: Locator): Locator => dialog.locator('div').filter({ hasText: /^✓ Ready to send for approval\.$/ }).last();
const overlapField = (dialog: Locator): Locator => dialog.getByRole('button', { name: /Which one should run\?/ });

async function open(page: Page, id = 'wf-wo-sub'): Promise<void> {
  await page.goto(`/flow-studio/${id}`);
  await waitForCanvas(page);
}

async function openPublish(page: Page): Promise<Locator> {
  await publishButton(page).click();
  const dialog = publishDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function newWorkflow(page: Page): Promise<void> {
  await pickerButton(page, WO).click();
  await page.getByRole('option', { name: '+ New workflow' }).click();
  await expect(pickerButton(page, 'New workflow')).toBeVisible();
}

async function addApprove(page: Page): Promise<void> {
  await (await plusAfter(page, 'T', 'next')).click();
  await panelOf(page).getByRole('button', { name: /^Approve Roles sign off/ }).click();
  await expect(panelOf(page).getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
}

/** LP-10: "signIn("Samira Khan"), then approve … with POST /api/flow-studio/publish-requests/:id/approve". */
async function approveAs(page: Page, name: string, workflowId: string): Promise<{ status: number }> {
  await signIn(page, name);
  const pending = (await (await page.request.get('/api/flow-studio/publish-requests?status=pending')).json()) as { id: string; workflowId: string }[];
  const request = pending.find((entry) => entry.workflowId === workflowId);
  if (!request) throw new Error(`Nothing waiting for ${workflowId}`);
  const response = await page.request.post(`/api/flow-studio/publish-requests/${request.id}/approve`, { data: {} });
  return { status: response.status() };
}

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

test.describe('B.6 Active / inactive', () => {
  test('UI-P1 switch a workflow off', async ({ page }) => {
    await open(page);
    await openWorkflow(page, WO, 'Job posting created');
    await expect(pickerButton(page, 'Job posting created')).toBeVisible();
    await openStep(page, 'Job posting created');
    const panel = panelOf(page);
    const active = panel.getByRole('switch', { name: 'Active' });
    await expect(active).toBeChecked();
    await expect(panel.getByText('Active', { exact: true })).toBeVisible();
    await expect(panel.getByText('New events start this workflow.')).toBeVisible();

    await active.click();
    await expect(panel.getByText('Inactive', { exact: true })).toBeVisible();
    await expect(panel.getByText('Nothing new uses this workflow. Anything already running finishes on it. Turn it back on any time.')).toBeVisible();
    await expect(panel.getByText('No other active workflow covers every job posting, so new job postings that only this one covers won’t start or be approved until one is active. Nothing is approved automatically.')).toBeVisible();
    await expect(toastOf(page)).toHaveText('“Job posting created” is inactive. It can’t be deleted, only turned back on');
    await expect(banner(page).getByText('Inactive · v1', { exact: true })).toBeVisible();
    await pickerButton(page, 'Job posting created').click();
    expect(norm((await page.getByRole('option', { name: /^Job posting created/ }).textContent()) ?? '')).toBe('Job posting createdInactive · Everywhere');
    await page.keyboard.press('Escape');

    // Back on: the toast, and the status.
    await panel.getByRole('switch').click();
    await expect(toastOf(page)).toHaveText('“Job posting created” is active again');
    await expect(banner(page).getByText('Live v1', { exact: true })).toBeVisible();

    await openWorkflow(page, 'Job posting created', 'UK Technology work orders');
    await expect(pickerButton(page, 'UK Technology work orders')).toBeVisible();
    await openStep(page, WO);
    await panelOf(page).getByRole('switch', { name: 'Active' }).click();
    await expect(panelOf(page).getByText('Nothing new uses this workflow. Anything already running finishes on it. Turn it back on any time.')).toBeVisible();
    await expect(panelOf(page).getByText(/^No other active workflow covers/)).toHaveCount(0);

    await openWorkflow(page, 'UK Technology work orders', 'Site access request');
    await expect(pickerButton(page, 'Site access request')).toBeVisible();
    await openStep(page, 'Access request submitted in Zip');
    await panelOf(page).getByRole('switch', { name: 'Active' }).click();
    await expect(panelOf(page).getByText('No other active workflow covers every access request, so new access requests that only this one covers won’t start or be approved until one is active. Nothing is approved automatically.')).toBeVisible();
    await panelOf(page).getByRole('switch').click();
    await expect(toastOf(page)).toHaveText('“Site access request” is active again');
  });

  test('UI-P2 Test on an inactive workflow says so', async ({ page }) => {
    await open(page, 'wf-jp');
    await openStep(page, 'Job posting created');
    await panelOf(page).getByRole('switch', { name: 'Active' }).click();
    await expect(banner(page).getByText('Inactive · v1', { exact: true })).toBeVisible();

    await openTest(page, 'Junior data analyst, 6 months (job posting)');
    const view = await readTestPanel(page);
    expect(view.inactive).toBe("This workflow is inactive. Real requests don't use it. Below is what it would do if you turned it back on.");
    // The note comes first, above the summary (04 §16.24).
    const firstIsNote = await testPanelOf(page).evaluate((root) => {
      const body = root.children[1];
      return (body.children[0].textContent ?? '').startsWith('This workflow is inactive');
    });
    expect(firstIsNote).toBe(true);
    await expectTestPanel(page, 'EN-059');

    await openStep(page, 'Job posting created');
    await panelOf(page).getByRole('switch').click();
    await expect(banner(page).getByText('Live v1', { exact: true })).toBeVisible();
    await testButton(page).click();
    await expect(testPanelOf(page).getByText(/^This workflow is inactive/)).toHaveCount(0);
    expect((await readTestPanel(page)).inactive).toBeNull();
  });

  test('UI-P3 nothing can be deleted', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    const summaries = (await (await page.request.get('/api/flow-studio/workflows')).json()) as { id: string; name: string; status: string }[];
    expect(summaries).toHaveLength(15);
    const forbidden = /delete|remove|archive|discard/i;
    const namesIn = async (locator: Locator): Promise<string[]> =>
      locator.evaluateAll((elements) => elements.map((element) => `${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`));
    for (const summary of summaries) {
      await page.goto(`/flow-studio/${summary.id}`);
      await waitForCanvas(page);
      const top = await namesIn(banner(page).locator('button, a, [role=menuitem]'));
      await pickerButton(page, summary.name).click();
      const picker = await namesIn(page.getByRole('listbox').locator('button, a, [role=option], [role=menuitem]'));
      await page.keyboard.press('Escape');
      await canvasOf(page).getByRole('button').first().waitFor();
      const start = canvasOf(page).locator('[data-node-id="T"] button');
      await start.click();
      const panel = panelOf(page);
      const closed = panel.locator('details:not([open]) > summary');
      while ((await closed.count()) > 0) await closed.first().click();
      const settings = await namesIn(panel.locator('button, a, [role=menuitem]'));
      for (const text of [...top, ...picker, ...settings]) expect(text, `${summary.id}: ${text}`).not.toMatch(forbidden);
      if (summary.status === 'draft') {
        await expect(panel.getByText('Publish it to make it active.')).toBeVisible();
        await expect(panel.getByRole('switch')).toHaveCount(0);
      } else {
        await expect(panel.getByRole('switch', { name: 'Active' })).toBeVisible();
      }
    }
    await open(page);
    await openStep(page, 'Business sign-off');
    await expect(panelOf(page).getByRole('button', { name: 'Delete this step' })).toBeVisible();
    await openStep(page, 'Rate over card?');
    await panelOf(page).getByRole('button', { name: '+ Add a path' }).click();
    await expect(panelOf(page).getByRole('button', { name: 'Delete path' }).first()).toBeVisible();
  });
});

test.describe('B.6 publishing', () => {
  test('UI-P4 publish is blocked when nobody approves (LP-01)', async ({ page }) => {
    await open(page);
    await newWorkflow(page);
    await addApprove(page);
    await expect.poll(() => novaCount(page)).toBe('2');

    let dialog = await openPublish(page);
    await expect(dialog.getByRole('heading', { name: 'Publish “New workflow”' })).toBeVisible();
    expect(await textOf(impactOf(dialog))).toBe('Applies to new runs. 140 records in the last 90 days would have started this workflow. Anything already running keeps its current version.');
    expect(await textOf(dialog.locator('div').filter({ hasText: /^×/ }).last())).toBe('× "Approval" doesn\'t say who approves yet.');
    await expect(dialog.getByText('This overlaps “Work order submitted” on 140 records. Which one should run?')).toBeVisible();
    await expect(overlapField(dialog)).toHaveText('Choose…');
    await overlapField(dialog).click();
    expect(await optionTexts(page)).toEqual(['New workflow', 'Work order submitted']);
    await page.keyboard.press('Escape');
    await expect(goLive(dialog)).toHaveValue('2026-12-01');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(sendButton(dialog)).toBeDisabled();
    // The order 06 lists: impact, must-fix, overlap, date, buttons.
    const order = await dialog.evaluate((root) => {
      const text = root.textContent ?? '';
      return ['Applies to new runs', 'doesn’t say who approves', 'This overlaps', 'Goes live on', 'Cancel', 'Send for approval'].map((part) => text.indexOf(part));
    });
    expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]))).toBe(true);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(publishDialog(page)).toHaveCount(0);
    await selectButton(panelOf(page), 'Roles').click();
    await page.getByRole('listbox').getByRole('option', { name: 'Cost center owner', exact: true }).click();
    await page.keyboard.press('Escape');

    dialog = await openPublish(page);
    await expect(sendButton(dialog)).toBeDisabled();
    await choose(dialog, 'This overlaps “Work order submitted” on 140 records. Which one should run?', 'New workflow');
    await expect(readyLine(dialog)).toHaveCount(1);
    expect(await textOf(readyLine(dialog))).toBe(READY);
    await expect(sendButton(dialog)).toBeEnabled();
  });

  test('UI-P5 overlaps are caught at publish', async ({ page }) => {
    await open(page);
    await openWorkflow(page, WO, 'Data and AI hires');
    await expect(pickerButton(page, 'Data and AI hires')).toBeVisible();
    await expect(banner(page).getByText('Draft', { exact: true })).toBeVisible();
    const dialog = await openPublish(page);
    expect(await textOf(impactOf(dialog))).toBe('Applies to new runs. 26 records in the last 90 days would have started this workflow. Anything already running keeps its current version.');
    await expect(dialog.getByText('This overlaps “UK Technology work orders” on 2 records. Which one should run?')).toBeVisible();
    await expect(overlapField(dialog)).toHaveText('Choose…');
    await expect(sendButton(dialog)).toBeDisabled();
    await overlapField(dialog).click();
    expect(await optionTexts(page)).toEqual(['Data and AI hires', 'UK Technology work orders']);
    await page.getByRole('option', { name: 'Data and AI hires' }).click();
    expect(await textOf(readyLine(dialog))).toBe(READY);
    await expect(sendButton(dialog)).toBeEnabled();
    // Nothing changes on either workflow until a second person approves.
    const priorityOf = async (id: string) => ((await (await page.request.get(`/api/flow-studio/workflows/${id}`)).json()) as { workflow: { priority: number | null } }).workflow.priority;
    expect(await priorityOf('wf-wo-sub-wo-data')).toBeNull();
    expect(await priorityOf('wf-wo-sub-wo-uk-tech')).toBeNull();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(publishDialog(page)).toHaveCount(0);
  });

  test('UI-P6 impact before going live', async ({ page }) => {
    await open(page);
    await openWorkflow(page, WO, 'Site access request');
    await expect(pickerButton(page, 'Site access request')).toBeVisible();
    const dialog = await openPublish(page);
    expect(await textOf(impactOf(dialog))).toBe('Applies to new runs. 0 records in the last 90 days would have started this workflow. Anything already running keeps its current version.');
    // Only the count is bold, so the "0" of "90" is not.
    await expect(impactOf(dialog).locator('strong')).toHaveText('0');
    await expect(impactOf(dialog).locator('strong')).toHaveCount(1);
    expect(await textOf(readyLine(dialog))).toBe(READY);
    await expect(goLive(dialog)).toHaveValue('2026-10-20');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(sendButton(dialog)).toBeEnabled();

    await goLive(dialog).fill('2026-10-19');
    await expect(dialog.getByText('Pick today or a later date.')).toBeVisible();
    await expect(sendButton(dialog)).toBeDisabled();
    await goLive(dialog).fill('2026-10-20');
    await expect(dialog.getByText('Pick today or a later date.')).toHaveCount(0);

    await sendButton(dialog).click();
    await expect(dialog.getByText(SENT)).toBeVisible();
    await expect(dialog.getByRole('button')).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
    await expect(banner(page).getByText('Waiting for approval', { exact: true })).toBeVisible();
    await expect(page.getByText('Sent to Samira Khan')).toHaveCount(0);
    await expect(page.getByText('Approve as Samira (demo)')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(publishDialog(page)).toHaveCount(0);
  });

  test('UI-PERM-01 nobody else can approve flow changes', async ({ page }) => {
    await resetApp(page, 'author-only-approver');
    await signIn(page, 'Flow Admin');
    await open(page);
    await openWorkflow(page, WO, 'Site access request');
    await expect(pickerButton(page, 'Site access request')).toBeVisible();
    const dialog = await openPublish(page);
    await expect(dialog.getByText('Nobody else can approve flow changes yet. Ask an admin to give someone the “Approve flow changes” permission.')).toBeVisible();
    await expect(sendButton(dialog)).toBeDisabled();
    await expect(dialog.getByText(/Ready to send/)).toHaveCount(0);
  });
});

test.describe('Part C, the UI halves', () => {
  test('LP-02 a named Approve step emptied on a live workflow', async ({ page }) => {
    await open(page);
    await openStep(page, 'Rate review');
    await selectButton(panelOf(page), 'Roles').click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');
    await expect(banner(page).getByText('Live v1 · unpublished changes')).toBeVisible();
    await expect.poll(() => novaCount(page)).toBe('1');
    const dialog = await openPublish(page);
    expect(await textOf(dialog.locator('div').filter({ hasText: /^×/ }).last())).toBe('× "Rate review" doesn\'t say who approves yet.');
    await expect(sendButton(dialog)).toBeDisabled();
  });

  test('LP-03 an escalation step with nobody', async ({ page }) => {
    await open(page);
    await openStep(page, 'Duplicate found: escalation');
    await selectButton(panelOf(page), 'Roles').click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');
    const dialog = await openPublish(page);
    expect(await textOf(dialog.locator('div').filter({ hasText: /^×/ }).last())).toBe('× "Duplicate found: escalation" doesn\'t say who approves yet.');
    await expect(sendButton(dialog)).toBeDisabled();
  });

  test('LP-04 Ask people to decide with nobody chosen', async ({ page }) => {
    await open(page, 'wf-onboard');
    await openStep(page, 'Background check');
    await selectButton(panelOf(page), 'Who decides').click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');
    await novaButton(page).click();
    expect(await readNova(page)).toEqual([{ label: 'Fix before publishing', message: '"Background check" doesn\'t say who decides when it fails.', buttons: ['Show me'] }]);
    const dialog = await openPublish(page);
    expect(await textOf(dialog.locator('div').filter({ hasText: /^×/ }).last())).toBe('× "Background check" doesn\'t say who decides when it fails.');
    await expect(sendButton(dialog)).toBeDisabled();
  });

  test('LP-05 an empty path warns but does not block', async ({ page }) => {
    await open(page);
    await openStep(page, 'Rate over card?');
    await panelOf(page).getByRole('group', { name: 'Over 10%', exact: true }).getByRole('button', { name: 'Remove rule' }).click();
    await novaButton(page).click();
    expect(await readNova(page)).toEqual([{ label: 'Check', message: 'Path "Over 10%" in "Rate over card?" has no conditions, so it matches everything.', buttons: ['Show me'] }]);
    let dialog = await openPublish(page);
    expect(await textOf(readyLine(dialog))).toBe(READY);
    await expect(sendButton(dialog)).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await open(page, 'wf-wo-sub-wo-uk-tech');
    await openStep(page, 'Value band');
    await panelOf(page).getByRole('group', { name: 'Over $1M', exact: true }).getByRole('button', { name: 'Remove rule' }).click();
    await novaButton(page).click();
    expect((await readNova(page))[0]).toEqual({ label: 'Check', message: 'Path "Over $1M" in "Value band" has no conditions, so it matches everything and the paths below it never run.', buttons: ['Show me'] });
    dialog = await openPublish(page);
    expect(await textOf(readyLine(dialog))).toBe(READY);
  });

  test('LP-06 named person without a backup, then a backup', async ({ page }) => {
    await open(page);
    await openStep(page, 'Rate review');
    await choose(panelOf(page), 'Who approves', 'A named person');
    await choose(panelOf(page), 'Person', 'Chloe Martin');
    let dialog = await openPublish(page);
    expect(await textOf(readyLine(dialog))).toBe(READY);
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await selectButton(panelOf(page), 'Backup when they’re away').click();
    await page.getByRole('listbox').getByRole('option', { name: /^Lena Fischer/ }).click();
    await expect.poll(() => novaCount(page)).toBe('0');
    expect(await boxText(page, 'Rate review')).toBe('Rate review | Chloe Martin · backup Lena Fischer');
    await novaButton(page).click();
    await expect(novaPanelOf(page).getByText('Looks good', { exact: true })).toBeVisible();
    await expect(novaPanelOf(page).getByText('Nothing to fix.')).toBeVisible();
    dialog = await openPublish(page);
    expect(await textOf(readyLine(dialog))).toBe(READY);
  });

  test('LP-07 an If that sends every path to the same place', async ({ page }) => {
    await open(page);
    await openStep(page, 'Rate over card?');
    await choose(panelOf(page).getByRole('group', { name: 'Over 10%', exact: true }), 'Then', 'Carry on to “Value band”');
    await novaButton(page).click();
    // On screen this is 06's list as written: the Then removes Rate review, so the L13 item of the raw setup (see the M2 notes) does not arise.
    expect(await readNova(page)).toEqual([{ label: 'Check', message: '"Rate over card?" sends every path to the same place, so it does nothing yet.', buttons: ['Show me'] }]);
    const dialog = await openPublish(page);
    expect(await textOf(readyLine(dialog))).toBe(READY);
    await expect(sendButton(dialog)).toBeEnabled();
  });

  test('LP-08 Collect & verify that asks for nothing', async ({ page }) => {
    await open(page, 'wf-onboard');
    await openStep(page, 'Laptop and badge');
    await selectButton(panelOf(page), 'What’s required').click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');
    await novaButton(page).click();
    expect(await readNova(page)).toEqual([{ label: 'Check', message: '"Laptop and badge" doesn\'t ask for anything yet.', buttons: ['Show me'] }]);
    const dialog = await openPublish(page);
    expect(await textOf(readyLine(dialog))).toBe(READY);
  });

  test('LP-09 seed workflows: Nova and impact counts, on every workflow', async ({ page }) => {
    test.setTimeout(120_000);
    const rows = tableOf('LP-09');
    expect(rows).toHaveLength(15);
    const summaries = (await (await page.request.get('/api/flow-studio/workflows')).json()) as { id: string; name: string }[];
    const clean = (text: string): string => norm(text.replace(/^[“"]/, '').replace(/[”"]$/, ''));
    for (const [name, records, header] of rows) {
      const id = summaries.find((summary) => summary.name === name)?.id as string;
      await open(page, id);
      await expect.poll(() => novaCount(page), { message: name }).toBe(name === 'Data and AI hires' ? '1' : '0');
      await novaButton(page).click();
      await expect(novaPanelOf(page).getByText(clean(header).replace(/"/g, ''), { exact: true })).toBeVisible();
      if (name === 'Data and AI hires') {
        expect(await readNova(page)).toEqual([{ label: 'Fix before publishing', message: 'Overlaps with "UK Technology work orders" on 2 past records (Data and UK · Technology). Set which one wins before publishing.', buttons: ['Choose which wins'] }]);
      } else {
        await expect(novaPanelOf(page).getByText('Looks good', { exact: true })).toBeVisible();
        await expect(novaPanelOf(page).getByText('Nothing to fix.')).toBeVisible();
      }
      const dialog = await openPublish(page);
      expect(await textOf(impactOf(dialog)), name).toBe(`Applies to new runs. ${records} records in the last 90 days would have started this workflow. Anything already running keeps its current version.`);
      if (name === 'Data and AI hires') {
        await expect(dialog.getByText('This overlaps “UK Technology work orders” on 2 records. Which one should run?')).toBeVisible();
        await expect(sendButton(dialog)).toBeDisabled();
      } else {
        expect(await textOf(readyLine(dialog)), name).toBe(READY);
      }
    }
  });

  test('LP-10 overlap on publish: the whole flow, ending in Live v1', async ({ page }) => {
    await open(page, 'wf-wo-sub-wo-data');
    const dialog = await openPublish(page);
    await choose(dialog, 'This overlaps “UK Technology work orders” on 2 records. Which one should run?', 'Data and AI hires');
    await sendButton(dialog).click();
    await expect(dialog.getByText(SENT)).toBeVisible();
    await expect(dialog.getByRole('button')).toHaveCount(1);
    await expect(banner(page).getByText('Waiting for approval', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('button', { name: /^approve( |$)/i })).toHaveCount(0);

    expect((await approveAs(page, 'Samira Khan', 'wf-wo-sub-wo-data')).status).toBe(200);
    await signIn(page, 'Flow Admin');
    await page.reload();
    await waitForCanvas(page);
    await expect(banner(page).getByText('Live v1', { exact: true })).toBeVisible();
    await expect(toastOf(page)).toHaveText('Published as v1, live on 20 Oct 2026');
    const priority = async (id: string) => ((await (await page.request.get(`/api/flow-studio/workflows/${id}`)).json()) as { workflow: { priority: number | null } }).workflow.priority;
    expect(await priority('wf-wo-sub-wo-data')).toBe(1);
    expect(await priority('wf-wo-sub-wo-uk-tech')).toBe(2);
  });

  test('LP-11 Site access request: Live v2, the toast shown once', async ({ page }) => {
    await open(page, 'wf-access');
    const dialog = await openPublish(page);
    await sendButton(dialog).click();
    await expect(dialog.getByText(SENT)).toBeVisible();
    // Opened again while it waits, it says where the change stands rather than offering a second send.
    await dialog.getByRole('button', { name: 'Close' }).click();
    const again = await openPublish(page);
    await expect(again.getByText(SENT)).toBeVisible();
    await expect(sendButton(again)).toHaveCount(0);
    await again.getByRole('button', { name: 'Close' }).click();

    expect((await approveAs(page, 'Samira Khan', 'wf-access')).status).toBe(200);
    await signIn(page, 'Flow Admin');
    await page.reload();
    await waitForCanvas(page);
    await expect(banner(page).getByText('Live v2', { exact: true })).toBeVisible();
    await expect(toastOf(page)).toHaveText('Published as v2, live on 20 Oct 2026');
    await page.reload();
    await waitForCanvas(page);
    await expect(banner(page).getByText('Live v2', { exact: true })).toBeVisible();
    await expect(toastOf(page)).toHaveCount(0);
  });

  test('LP-12 identical “Everywhere” scopes overlap', async ({ page }) => {
    await open(page);
    await newWorkflow(page);
    await addApprove(page);
    await selectButton(panelOf(page), 'Roles').click();
    await page.getByRole('listbox').getByRole('option', { name: 'Cost center owner', exact: true }).click();
    await page.keyboard.press('Escape');
    const dialog = await openPublish(page);
    expect(await textOf(impactOf(dialog))).toBe('Applies to new runs. 140 records in the last 90 days would have started this workflow. Anything already running keeps its current version.');
    await expect(dialog.getByText('This overlaps “Work order submitted” on 140 records. Which one should run?')).toBeVisible();
    await expect(overlapField(dialog)).toHaveText('Choose…');
    await expect(sendButton(dialog)).toBeDisabled();
    await overlapField(dialog).click();
    expect(await optionTexts(page)).toEqual(['New workflow', 'Work order submitted']);
    await page.getByRole('option', { name: 'Work order submitted' }).click();
    expect(await textOf(readyLine(dialog))).toBe(READY);
    await expect(sendButton(dialog)).toBeEnabled();
  });

  test('LP-13 the approver is anyone with “Approve flow changes” except the author', async ({ page }) => {
    await open(page, 'wf-access');
    const dialog = await openPublish(page);
    await sendButton(dialog).click();
    await expect(dialog.getByText(SENT)).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    // Signed in as the author, the pending change shows no approve action, and the route refuses.
    await expect(page.getByRole('button', { name: /^approve( |$)/i })).toHaveCount(0);
    expect((await approveAs(page, 'Flow Admin', 'wf-access')).status).toBe(403);

    // Signed in as Grace Kim there is no way to approve: no Flow Studio, and the route refuses.
    await signIn(page, 'Grace Kim');
    await page.goto('/flow-studio/wf-access');
    await page.waitForURL('**/home');
    const pending = await (await page.request.get('/api/flow-studio/publish-requests?status=pending')).status();
    expect(pending).toBe(403);
  });

  test('LP-14 one hour after the reminder is valid (the rest is UI-ESC-03)', async ({ page }) => {
    await open(page, 'wf-wo-sub');
    await openStep(page, 'Business sign-off');
    await panelOf(page).getByRole('spinbutton', { name: 'Then escalate to their manager after (hours)' }).fill('25');
    await expect.poll(() => novaCount(page)).toBe('0');
  });

  test('LP-16 “1 record” in the impact sentence', async ({ page }) => {
    await open(page);
    await newWorkflow(page);
    const panel = panelOf(page);
    await expect(panel.getByRole('heading', { name: 'Workflow settings' })).toBeVisible();
    await panel.locator('details', { hasText: 'More: site, worker type, job family' }).locator('summary').click();
    for (const [field, value] of [['Work country', 'US'], ['Business unit', 'Technology'], ['Job family', 'Cloud']]) {
      await selectButton(panel, field).click();
      await page.getByRole('listbox').getByRole('option', { name: value, exact: true }).click();
      await page.keyboard.press('Escape');
    }
    const dialog = await openPublish(page);
    expect(await textOf(impactOf(dialog))).toBe('Applies to new runs. 1 record in the last 90 days would have started this workflow. Anything already running keeps its current version.');
  });

  test('04 §10: the draft is saved before it is sent, and edits after sending go into the next draft', async ({ page }) => {
    await open(page, 'wf-access');
    await openStep(page, 'Security approves access');
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Security approves, sent');
    const dialog = await openPublish(page);
    await sendButton(dialog).click();
    await expect(dialog.getByText(SENT)).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    // The canvas stays editable, and the status stays.
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Edited after sending');
    await expect(banner(page).getByText('Waiting for approval', { exact: true })).toBeVisible();
    await expectSaved(page, 'wf-access', (workflow) => workflow.draft.nodes.SA ? true : Object.values(workflow.draft.nodes as Record<string, { label: string }>).some((node) => node.label === 'Edited after sending'), true);

    expect((await approveAs(page, 'Samira Khan', 'wf-access')).status).toBe(200);
    const after = (await (await page.request.get('/api/flow-studio/workflows/wf-access')).json()) as { workflow: { published: { nodes: Record<string, { label: string }> }; draft: { nodes: Record<string, { label: string }> } } };
    const labels = (nodes: Record<string, { label: string }>) => Object.values(nodes).map((node) => node.label);
    expect(labels(after.workflow.published.nodes)).toContain('Security approves, sent');
    expect(labels(after.workflow.draft.nodes)).toContain('Edited after sending');
    await signIn(page, 'Flow Admin');
    await page.reload();
    await waitForCanvas(page);
    await expect(banner(page).getByText('Live v2 · unpublished changes')).toBeVisible();
  });
});

test.describe('04 §10, §14: the dialog', () => {
  test('first focus on the date, focus trapped, Escape closes it, focus returns to Publish', async ({ page }) => {
    await open(page, 'wf-access');
    const dialog = await openPublish(page);
    await expect(goLive(dialog)).toBeFocused();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      expect(inside).toBe(true);
    }
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Shift+Tab');
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      expect(inside).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(publishDialog(page)).toHaveCount(0);
    await expect(publishButton(page)).toBeFocused();
  });

  test('Escape order: dropdown, then dialog, then drawer (04 §14.2)', async ({ page }) => {
    await open(page, 'wf-wo-sub-wo-data');
    await novaButton(page).click();
    await novaPanelOf(page).getByRole('button', { name: 'Choose which wins' }).click();
    const dialog = publishDialog(page);
    await expect(dialog).toBeVisible();
    await overlapField(dialog).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(novaPanelOf(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(novaPanelOf(page)).toHaveCount(0);
  });

  test('a click on the scrim closes it, unless a dropdown was open', async ({ page }) => {
    await open(page, 'wf-wo-sub-wo-data');
    const dialog = await openPublish(page);
    await overlapField(dialog).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.mouse.click(20, 20);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.mouse.click(20, 20);
    await expect(dialog).toHaveCount(0);
  });

  test('a save that cannot reach the server stops the send and says so', async ({ page }) => {
    await open(page, 'wf-access');
    await openStep(page, 'Security approves access');
    await page.route('**/api/flow-studio/workflows/*/draft', (route) => route.abort());
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Unsaved');
    const dialog = await openPublish(page);
    await sendButton(dialog).click();
    await expect(dialog.getByRole('alert')).toHaveText('Couldn’t save that change. Check your connection and try again.');
    await expect(banner(page).getByText('Waiting for approval', { exact: true })).toHaveCount(0);
    await page.unroute('**/api/flow-studio/workflows/*/draft');
    await sendButton(dialog).click();
    await expect(dialog.getByText(SENT)).toBeVisible();
  });
});

test.describe('04 §9: Nova', () => {
  test('dark surface, count badge colours, and it follows edits while open', async ({ page }) => {
    await open(page);
    const badge = novaButton(page).locator('span');
    // 03 §12.1 "grey when 0" outranks 04 §1.3 and §9's emerald: see the notes.
    await expect(badge).toHaveCSS('background-color', 'rgb(100, 116, 139)');
    await novaButton(page).click();
    await expect(novaButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(novaPanelOf(page)).toHaveCSS('background-color', 'rgb(2, 6, 23)');
    await expect(novaPanelOf(page).getByText('Looks good', { exact: true })).toBeVisible();
    await novaButton(page).click();
    await expect(novaPanelOf(page)).toHaveCount(0);
    await expect(novaButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(novaButton(page)).toBeFocused();

    await openStep(page, 'Rate review');
    await selectButton(panelOf(page), 'Roles').click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => novaCount(page)).toBe('1');
    await expect(badge).toHaveCSS('background-color', 'rgb(217, 119, 6)');
  });

  test('✦ Add a reverse step and ✦ Record it in the ledger', async ({ page }) => {
    await open(page, 'wf-onboard');
    await openStep(page, 'Workday provisioning');
    await panelOf(page).getByLabel('Exit step').fill('');
    await novaButton(page).click();
    expect(await readNova(page)).toEqual([
      { label: 'Fix before publishing', message: '"Workday provisioning" gives Workday account but has no reverse step, so offboarding would leave it behind.', buttons: ['✦ Add a reverse step', 'Show me'] },
    ]);
    await novaPanelOf(page).getByRole('button', { name: '✦ Add a reverse step' }).click();
    await expect(toastOf(page)).toHaveText('Added reverse step “Remove Workday account”');
    await expect(novaPanelOf(page).getByText('Looks good', { exact: true })).toBeVisible();
    await expectSaved(page, 'wf-onboard', (workflow) => workflow.draft.nodes.WD.reverse, 'Remove Workday account');

    await openStep(page, 'Workday provisioning');
    await panelOf(page).getByRole('switch', { name: 'Gives the worker something' }).click();
    await novaButton(page).click();
    expect(await readNova(page)).toEqual([
      { label: 'Suggestion', message: '"Workday provisioning" creates something in Workday that isn\'t in the ledger, so offboarding won\'t know to remove it.', buttons: ['✦ Record it in the ledger', 'Show me'] },
    ]);
    // Suggestions are not counted.
    expect(await novaCount(page)).toBe('0');
    await novaPanelOf(page).getByRole('button', { name: '✦ Record it in the ledger' }).click();
    await expect(toastOf(page)).toHaveText('Recorded in the ledger, with a reverse step');
    await expectSaved(page, 'wf-onboard', (workflow) => [workflow.draft.nodes.WD.gives, workflow.draft.nodes.WD.reverse], ['Workday account', 'Close Workday account']);
  });
});
