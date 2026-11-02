import { expect, test } from '@playwright/test';
import { signIn } from './helpers';
import { button, chip, confirmDialog, eventFor, freshRuntime, historyLine, inboxCard, itemIdOf, openRun, pauseWith, publishEdited, setClock, shot, startRun, stopWith } from './runtime-helpers';

/** 06 Part D, the browser half. Every string is 06's or 05's as written. */

const FORBIDDEN = 'Only the workflow owner or an admin can pause, resume or stop it.';

test.beforeEach(async ({ page }) => {
  await freshRuntime(page, 'Owen Clarke');
});

test('RT-01 Running → paused', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await openRun(page, id);
  await expect(chip(page, 'Running')).toBeVisible();
  await setClock(page, '2026-10-20T10:00:00Z');
  await button(page, 'Pause').click();
  const dialog = page.getByRole('dialog', { name: 'Pause this workflow?' });
  await expect(dialog.getByText('Nothing new starts and reminders stop until you resume it. People can still answer what they’ve already been asked.')).toBeVisible();
  await shot(page, 'run-pause-dialog');
  await confirmDialog(page, 'Pause this workflow?', 'Reason (optional)', 'Supplier dispute', 'Pause workflow');
  await expect(chip(page, 'Paused')).toBeVisible();
  await expect(button(page, 'Resume')).toBeVisible();
  await expect(button(page, 'Stop')).toBeVisible();
  await expect(button(page, 'Pause')).toHaveCount(0);
  await expect(historyLine(page, 'Paused by Owen Clarke on 20 Oct 2026, 10:00 UTC: Supplier dispute')).toBeVisible();
  await expect(page.getByText('Paused by Owen Clarke on 20 Oct 2026, 10:00 UTC: Supplier dispute. Nothing new starts and reminders are on hold.')).toBeVisible();
  await shot(page, 'run-paused');
});

test('RT-02 Paused → running', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await setClock(page, '2026-10-20T10:00:00Z');
  await openRun(page, id);
  await pauseWith(page, 'Supplier dispute');
  await setClock(page, '2026-10-20T12:00:00Z');
  await button(page, 'Resume').click();
  await expect(chip(page, 'Running')).toBeVisible();
  await expect(button(page, 'Pause')).toBeVisible();
  await expect(button(page, 'Stop')).toBeVisible();
  await expect(button(page, 'Resume')).toHaveCount(0);
  await expect(historyLine(page, 'Resumed by Owen Clarke on 20 Oct 2026, 12:00 UTC')).toBeVisible();
});

test('RT-03 Pause reason is optional', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await openRun(page, id);
  await button(page, 'Pause').click();
  await confirmDialog(page, 'Pause this workflow?', null, '', 'Pause workflow');
  await expect(historyLine(page, 'Paused by Owen Clarke on 20 Oct 2026, 09:00 UTC')).toBeVisible();
});

test('RT-04 Running → stopped needs a reason', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await openRun(page, id);
  await button(page, 'Stop').click();
  const dialog = page.getByRole('dialog', { name: 'Stop this workflow?' });
  await expect(dialog.getByText('Steps that haven’t started will never start. This can’t be undone.')).toBeVisible();
  const confirm = button(dialog, 'Stop workflow');
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Reason', exact: true }).fill('   ');
  await expect(confirm).toBeDisabled();
  await shot(page, 'run-stop-dialog');
  await dialog.getByRole('textbox', { name: 'Reason', exact: true }).fill('Request withdrawn by the hiring manager');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(chip(page, 'Stopped')).toBeVisible();
  for (const name of ['Pause', 'Resume', 'Stop']) await expect(button(page, name)).toHaveCount(0);
  await expect(historyLine(page, 'Stopped by Owen Clarke on 20 Oct 2026, 09:00 UTC: Request withdrawn by the hiring manager')).toBeVisible();
  await expect(page.getByText('Stopped by Owen Clarke on 20 Oct 2026, 09:00 UTC: Request withdrawn by the hiring manager. Steps that hadn’t started will never start.')).toBeVisible();
  // RT-04: Tell the supplier stays not started.
  await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Tell the supplier' }).getByText('Not started')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Business sign-off' }).getByText('Cancelled')).toBeVisible();
  await shot(page, 'run-stopped');
});

test('RT-05 Paused → stopped', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await openRun(page, id);
  await pauseWith(page, 'Supplier dispute');
  await signIn(page, 'Samira Khan');
  await page.reload();
  await stopWith(page, 'Duplicate request');
  await expect(chip(page, 'Stopped')).toBeVisible();
  await expect(historyLine(page, 'Paused by Owen Clarke on 20 Oct 2026, 09:00 UTC: Supplier dispute')).toBeVisible();
  await expect(historyLine(page, 'Stopped by Samira Khan on 20 Oct 2026, 09:00 UTC: Duplicate request')).toBeVisible();
});

test('RT-06 Stopped is final', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await openRun(page, id);
  await stopWith(page, 'Request withdrawn by the hiring manager');
  for (const [path, data] of [['resume', {}], ['pause', {}], ['stop', { reason: 'again' }]] as const) {
    const response = await page.request.post(`/api/runtime/runs/${id}/${path}`, { data });
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: { code: 'RUN_STOPPED', message: 'This workflow is stopped. It can’t be resumed.' } });
  }
  await page.reload();
  await expect(chip(page, 'Stopped')).toBeVisible();
  await expect(page.getByRole('region', { name: 'History' }).getByRole('listitem').filter({ hasText: /^Stopped by/ })).toHaveCount(1);
});

test('RT-07 Invalid transitions on a running or paused run', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  const resume = await page.request.post(`/api/runtime/runs/${id}/resume`, { data: {} });
  expect(await resume.json()).toEqual({ error: { code: 'NOT_PAUSED', message: 'This workflow isn’t paused.' } });
  expect((await page.request.post(`/api/runtime/runs/${id}/pause`, { data: {} })).status()).toBe(200);
  const again = await page.request.post(`/api/runtime/runs/${id}/pause`, { data: {} });
  expect(await again.json()).toEqual({ error: { code: 'ALREADY_PAUSED', message: 'This workflow is already paused.' } });
  await openRun(page, id);
  await expect(page.getByRole('region', { name: 'History' }).getByRole('listitem').filter({ hasText: /^Paused by/ })).toHaveCount(1);
});

test('RT-08 Steps after a Stop never start', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  const itemId = await itemIdOf(page, 'Raj Patel', 'approvals');
  await signIn(page, 'Owen Clarke');
  await openRun(page, id);
  await stopWith(page, 'Request withdrawn by the hiring manager');
  await signIn(page, 'Raj Patel');
  const refused = await page.request.post(`/api/runtime/work-items/${itemId}/decide`, { data: { decision: 'approved' } });
  expect(refused.status()).toBe(409);
  expect(((await refused.json()) as { error: { code: string } }).error.code).toBe('RUN_STOPPED');
  await page.goto(`/inbox/${itemId}`);
  await expect(page.getByText('This request was stopped. No action is needed.')).toBeVisible();
  for (const name of ['Approve', 'Reject', 'Send back']) await expect(button(page, name)).toHaveCount(0);
  await shot(page, 'inbox-item-stopped');
  await page.goto('/inbox');
  await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
  await setClock(page, '2026-10-27T09:00:00Z');
  await signIn(page, 'Owen Clarke');
  await openRun(page, id);
  await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Tell the supplier' }).getByText('Not started')).toBeVisible();
});

test('RT-09 Chaser reminders are suspended while paused', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await setClock(page, '2026-10-20T19:00:00Z');
  await openRun(page, id);
  await pauseWith(page, '');
  await setClock(page, '2026-10-22T01:00:00Z');
  await page.reload();
  const history = page.getByRole('region', { name: 'History' });
  await expect(history).not.toContainText('Reminder sent to');
  await button(page, 'Resume').click();
  const row = page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Business sign-off' });
  await expect(row.getByText('Reminder 22 Oct 2026, 15:00 UTC · Escalates 23 Oct 2026, 15:00 UTC')).toBeVisible();
  await setClock(page, '2026-10-22T15:00:00Z');
  await page.reload();
  await expect(history.getByRole('listitem').filter({ hasText: 'Reminder sent to Raj Patel.' })).toHaveCount(1);
  await setClock(page, '2026-10-23T15:00:00Z');
  await page.reload();
  await expect(history.getByRole('listitem').filter({ hasText: 'Reminder sent to Raj Patel.' })).toHaveCount(1);
  await expect(history.getByRole('listitem').filter({ hasText: 'No answer after 48h, so it went to Nadia Rahman (their manager).' })).toHaveCount(1);
});

test('RT-10 Nothing starts while paused', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await setClock(page, '2026-10-20T10:00:00Z');
  await openRun(page, id);
  await pauseWith(page, '');
  await setClock(page, '2026-10-20T11:00:00Z');
  await signIn(page, 'Raj Patel');
  await page.goto('/inbox');
  await button(inboxCard(page, 'Business sign-off · Operations analyst (WO-2231)'), 'Approve').click();
  await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
  await signIn(page, 'Owen Clarke');
  await openRun(page, id);
  const steps = page.getByRole('region', { name: 'Steps' });
  await expect(steps.getByRole('listitem').filter({ hasText: 'Business sign-off' }).getByText('Done', { exact: true })).toBeVisible();
  await expect(steps.getByRole('listitem').filter({ hasText: 'Tell the supplier' }).getByText('Not started')).toBeVisible();
  await setClock(page, '2026-10-20T14:00:00Z');
  await page.reload();
  await expect(steps.getByRole('listitem').filter({ hasText: 'Tell the supplier' }).getByText('Not started')).toBeVisible();
  await button(page, 'Resume').click();
  await expect(chip(page, 'Completed')).toBeVisible();
  await expect(steps.getByRole('listitem').filter({ hasText: 'Tell the supplier' }).getByText('Done', { exact: true })).toBeVisible();
});

test('RT-11 Only the workflow owner or an admin', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await signIn(page, 'Grace Kim');
  await openRun(page, id);
  await expect(chip(page, 'Running')).toBeVisible();
  for (const name of ['Pause', 'Resume', 'Stop']) await expect(button(page, name)).toHaveCount(0);
  for (const [path, data] of [['pause', {}], ['resume', {}], ['stop', { reason: 'No' }]] as const) {
    const response = await page.request.post(`/api/runtime/runs/${id}/${path}`, { data });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'FORBIDDEN', message: FORBIDDEN } });
  }
  // Raj Patel has no run permissions at all: the page says so, and the inbox stays his way in.
  await signIn(page, 'Raj Patel');
  expect((await page.request.post(`/api/runtime/runs/${id}/pause`, { data: {} })).status()).toBe(403);
  await page.goto(`/runs/${id}`);
  await expect(page.getByText('You don’t have access to running workflows.')).toBeVisible();
  await signIn(page, 'Samira Khan');
  await openRun(page, id);
  await pauseWith(page, 'As an admin');
  await expect(chip(page, 'Paused')).toBeVisible();
});

test('RT-12 Every action is recorded with who, when and why', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await setClock(page, '2026-10-20T10:00:00Z');
  await openRun(page, id);
  await pauseWith(page, 'Waiting for budget');
  await setClock(page, '2026-10-20T12:00:00Z');
  await signIn(page, 'Samira Khan');
  await page.reload();
  await button(page, 'Resume').click();
  await expect(chip(page, 'Running')).toBeVisible();
  await setClock(page, '2026-10-20T13:00:00Z');
  await signIn(page, 'Owen Clarke');
  await page.reload();
  await stopWith(page, 'Budget withdrawn');
  await page.reload();
  await expect(chip(page, 'Stopped')).toBeVisible();
  const lines = (await page.getByRole('region', { name: 'History' }).getByRole('listitem').allTextContents()).filter((line) => /^(Paused|Resumed|Stopped) by/.test(line));
  expect(lines).toEqual([
    'Paused by Owen Clarke on 20 Oct 2026, 10:00 UTC: Waiting for budget',
    'Resumed by Samira Khan on 20 Oct 2026, 12:00 UTC',
    'Stopped by Owen Clarke on 20 Oct 2026, 13:00 UTC: Budget withdrawn',
  ]);
});

test('RT-13 Every running workflow has the controls', async ({ page }) => {
  await signIn(page, 'Samira Khan');
  for (const recordId of ['WO-2214-A', 'OFF-902', 'AR-301', 'INV-8812', 'WO-2231']) {
    const id = await startRun(page, recordId);
    await openRun(page, id);
    await expect(chip(page, 'Running')).toBeVisible();
    await expect(button(page, 'Pause')).toBeVisible();
    await expect(button(page, 'Stop')).toBeVisible();
    await pauseWith(page, `Checking ${recordId}`);
    await expect(chip(page, 'Paused')).toBeVisible();
    await expect(button(page, 'Pause')).toHaveCount(0);
  }
  const completed = await startRun(page, 'TS-9934');
  await openRun(page, completed);
  await expect(chip(page, 'Completed')).toBeVisible();
  for (const name of ['Pause', 'Resume', 'Stop']) await expect(button(page, name)).toHaveCount(0);
});

test('RT-14 Turning a workflow Inactive does not pause or stop its runs', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await signIn(page, 'Flow Admin');
  await page.goto('/flow-studio/wf-wo-sub');
  await page.getByRole('group', { name: 'Workflow canvas' }).getByRole('button', { name: 'Work order submitted', exact: true }).click();
  await page.getByRole('switch', { name: 'Active' }).click();
  // 04 §11 "Recommended": it says so first, and only the second press switches it off.
  await expect(page.getByText('1 request is running on this workflow. It’ll finish on it. Switch it off?')).toBeVisible();
  await shot(page, 'switch-off-confirmation');
  await button(page, 'Cancel').click();
  await expect(page.getByRole('switch', { name: 'Active' })).toBeChecked();
  await page.getByRole('switch', { name: 'Active' }).click();
  await button(page, 'Switch off').click();
  await expect(page.getByRole('switch', { name: 'Active' })).not.toBeChecked();
  await signIn(page, 'Owen Clarke');
  await openRun(page, id);
  await expect(chip(page, 'Running')).toBeVisible();
  await pauseWith(page, 'Still works');
  await button(page, 'Resume').click();
  await expect(chip(page, 'Running')).toBeVisible();
  await stopWith(page, 'And this');
  await expect(chip(page, 'Stopped')).toBeVisible();
});

test('RT-15 Resuming a run paused by a failed system call', async ({ page }) => {
  await publishEdited(page, 'wf-offboard', (workflow) => {
    workflow.draft.nodes.RV.sys.onFail = 'pause';
  });
  const id = await startRun(page, 'OFF-902', { fail_system: 'Okta' });
  const equipment = await itemIdOf(page, 'Sam Patel', 'tasks');
  expect((await page.request.post(`/api/runtime/work-items/${equipment}/done`, { data: {} })).status()).toBe(200);
  await signIn(page, 'Tom Reed');
  await page.goto('/inbox');
  await button(inboxCard(page, /Final timesheet & expenses/), 'Verified').click();
  await expect(inboxCard(page, /Final timesheet & expenses/)).toHaveCount(0);
  for (const now of ['2026-10-23T16:00:00Z', '2026-10-23T16:05:00Z', '2026-10-23T16:20:00Z', '2026-10-23T17:00:00Z']) await setClock(page, now);
  await signIn(page, 'Samira Khan');
  await openRun(page, id);
  await expect(chip(page, 'Paused')).toBeVisible();
  await expect(page.getByText('Paused by Levv: Okta failed after 3 retries. Fix it, then resume.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Remove access' }).getByText('Failed', { exact: true })).toBeVisible();
  await shot(page, 'run-paused-by-system');
  const fixed = await page.request.post('/api/runtime/records/offboarding/OFF-902', { data: { data: { fail_system: null } } });
  expect(fixed.status()).toBe(200);
  await button(page, 'Resume').click();
  await expect(chip(page, 'Running')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Remove access' }).getByText('Done', { exact: true })).toBeVisible();
  const lines = await page.getByRole('region', { name: 'History' }).getByRole('listitem').allTextContents();
  const pausedAt = lines.findIndex((line) => line.startsWith('Paused by Levv on'));
  expect(pausedAt).toBeGreaterThan(-1);
  expect(lines[pausedAt + 1] ?? '').toMatch(/Record changed|Resumed by Samira Khan/);
  expect(lines.some((line) => line.startsWith('Resumed by Samira Khan on'))).toBe(true);
  await stopWith(page, 'Enough');
  await expect(chip(page, 'Stopped')).toBeVisible();
  expect(eventFor('OFF-902').recordType).toBe('offboarding');
});
