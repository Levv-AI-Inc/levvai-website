import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { canvasOf, freshApp, resetApp, signIn } from './helpers';
import { button, chip, confirmDialog, CRON_SECRET, freshRuntime, historyLine, inboxCard, itemIdOf, openRun, postEvent, publishEdited, SERVICE_TOKEN, setClock, shot, startRun } from './runtime-helpers';

/** 05 §6, §7 and §9 on screen, how a person reaches them, and the safety rules through the routes a browser calls. */

test.beforeEach(async ({ page }) => {
  await freshRuntime(page, 'Owen Clarke');
});

test.describe('05 §9, the browser half', () => {
  test('R-01 the run page and the approver’s inbox', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await openRun(page, id);
    await expect(page.getByRole('heading', { name: 'Operations analyst (WO-2231)' })).toBeVisible();
    await expect(page.getByText('Work order submitted · v1 · started 20 Oct 2026, 09:00 UTC')).toBeVisible();
    const row = (name: string) => page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: name });
    await expect(row('Budget check').getByText('Done', { exact: true })).toBeVisible();
    await expect(row('Duplicate & ghost worker').getByText('Done', { exact: true })).toBeVisible();
    await expect(row('Business sign-off').getByText('Waiting on Raj Patel')).toBeVisible();
    await expect(row('Business sign-off').getByText('Reminder 21 Oct 2026, 09:00 UTC · Escalates 22 Oct 2026, 09:00 UTC')).toBeVisible();
    await signIn(page, 'Raj Patel');
    await page.goto('/inbox');
    await expect(page.getByRole('region', { name: 'Approvals' }).getByRole('article')).toHaveCount(1);
    await expect(inboxCard(page, 'Business sign-off · Operations analyst (WO-2231)')).toBeVisible();
  });

  test('R-02 the same event again within 24h', async ({ page }) => {
    await startRun(page, 'WO-2231');
    expect(await postEvent(page.request, 'WO-2231')).toMatchObject({ outcome: 'duplicate', runIds: [] });
    await page.goto('/runs');
    await expect(page.getByRole('link', { name: 'Operations analyst (WO-2231)' })).toHaveCount(1);
  });

  test('R-03 WO-2214 runs on UK Technology work orders', async ({ page }) => {
    const id = await startRun(page, 'WO-2214');
    await openRun(page, id);
    await expect(page.getByText(/^UK Technology work orders · v\d+ · started 20 Oct 2026, 09:00 UTC$/)).toBeVisible();
  });

  test('R-04 no matching workflow, no run', async ({ page }) => {
    expect(await postEvent(page.request, 'OB-2251')).toMatchObject({ outcome: 'no_workflow', runIds: [] });
    await page.goto('/runs');
    await expect(page.getByText('No workflows are running. They start when a record’s event happens, for example a work order being submitted.')).toBeVisible();
  });

  test('R-05 Raj Patel approves', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await signIn(page, 'Raj Patel');
    await page.goto('/inbox');
    await button(inboxCard(page, 'Business sign-off · Operations analyst (WO-2231)'), 'Approve').click();
    await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
    await signIn(page, 'Owen Clarke');
    await openRun(page, id);
    await expect(chip(page, 'Completed')).toBeVisible();
    await expect(historyLine(page, 'Raj Patel approved. 20 Oct 2026, 09:00 UTC')).toBeVisible();
    await expect(historyLine(page, 'Completed. 20 Oct 2026, 09:00 UTC')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Tell the supplier' }).getByText('Email to Supplier account manager')).toBeVisible();
  });

  test('R-06 Raj Patel rejects; Grace Kim has 5 days', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await signIn(page, 'Raj Patel');
    await page.goto('/inbox');
    await button(inboxCard(page, 'Business sign-off · Operations analyst (WO-2231)'), 'Reject').click();
    const dialog = page.getByRole('dialog', { name: 'Reject Operations analyst?' });
    await expect(dialog).toBeVisible();
    await shot(page, 'inbox-reject-dialog');
    await confirmDialog(page, 'Reject Operations analyst?', 'Comment', 'Over budget', 'Reject');
    await signIn(page, 'Grace Kim');
    await page.goto('/inbox');
    const card = inboxCard(page, /Operations analyst \(WO-2231\)/);
    await expect(card.getByText('Fix and resubmit Operations analyst', { exact: true })).toBeVisible();
    await expect(card.getByText('Due 25 Oct 2026')).toBeVisible();
    await expect(button(card, 'Resubmit')).toBeVisible();
    await setClock(page, '2026-10-25T09:00:00Z');
    await page.goto(`/runs/${id}`);
    await expect(chip(page, 'Rejected')).toBeVisible();
    await expect(historyLine(page, 'Rejected at “Business sign-off”. 25 Oct 2026, 09:00 UTC')).toBeVisible();
    for (const name of ['Pause', 'Resume', 'Stop']) await expect(button(page, name)).toHaveCount(0);
  });

  test('R-07 WO-2214-A: Workday brings back the worker id', async ({ page }) => {
    const id = await startRun(page, 'WO-2214-A');
    await openRun(page, id);
    await expect(historyLine(page, 'Workday sent back Workday worker ID: WD-WO-2214-A 20 Oct 2026, 09:00 UTC')).toBeVisible();
    const row = page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Workday provisioning' });
    await expect(row.getByText('Ref WORKDAY-WO-2214-A-WD')).toBeVisible();
    await expect(row.getByText('Workday worker ID: WD-WO-2214-A')).toBeVisible();
    await expect(row.getByText('Simulated: nothing was sent to Workday. This build has no live connection to it.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Record' }).getByText('WD-WO-2214-A')).toBeVisible();
    await shot(page, 'run-onboarding');
  });

  test('R-08 a brought-back id beats work email', async ({ page }) => {
    const id = await startRun(page, 'OFF-902', { workday_worker_id: 'WD-OFF-902' });
    const equipment = await itemIdOf(page, 'Sam Patel', 'tasks');
    expect((await page.request.post(`/api/runtime/work-items/${equipment}/done`, { data: {} })).status()).toBe(200);
    const review = await itemIdOf(page, 'Tom Reed', 'tasks', (item) => item.kind === 'collect_review');
    expect((await page.request.post(`/api/runtime/work-items/${review}/decide`, { data: { decision: 'verified' } })).status()).toBe(200);
    await setClock(page, '2026-10-23T16:00:00Z');
    await signIn(page, 'Samira Khan');
    await openRun(page, id);
    await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Close in HR system' }).getByText('Done', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Record' }).getByText('WD-OFF-902')).toBeVisible();
  });

  test('R-09 nobody eligible for Privacy in Germany: paused, never approved', async ({ page }) => {
    const id = await startRun(page, 'WO-2270');
    await signIn(page, 'Fatima Zahra');
    await page.goto('/inbox');
    await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
    await signIn(page, 'Samira Khan');
    await openRun(page, id);
    await expect(chip(page, 'Running')).toBeVisible();
    await expect(page.getByRole('region', { name: 'History' }).getByRole('listitem').filter({ hasText: 'Paused: no eligible Privacy reviewer for Germany' })).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Business sign-off' }).getByText(/^Waiting on /)).toBeVisible();
    // Adding a Privacy holder for Germany through the import endpoint: re-planning creates the item.
    const people = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/seed/people-and-authority.json'), 'utf8')) as { BY_COUNTRY: Record<string, unknown> };
    const data = { ...people, BY_COUNTRY: { ...people.BY_COUNTRY, priv: { Germany: 'Fatima Zahra' } } };
    expect((await page.request.post('/api/flow-studio/reference/import', { data: { key: 'people-and-authority', data } })).status()).toBe(204);
    await signIn(page, 'Fatima Zahra');
    await page.goto('/inbox');
    await expect(inboxCard(page, /Data platform engineer, Germany \(WO-2270\)/)).toBeVisible();
  });

  test('R-10 changing the start date moves the wait', async ({ page }) => {
    const id = await startRun(page, 'WO-2214-A');
    await signIn(page, 'Samira Khan');
    expect((await page.request.post('/api/runtime/records/onboarding/WO-2214-A', { data: { data: { start_date: '2026-11-16' } } })).status()).toBe(200);
    await openRun(page, id);
    await expect(page.getByRole('region', { name: 'History' }).getByRole('listitem').filter({ hasText: 'The Start date changed, so the wait now ends 16 Nov 2026, 09:00 UTC.' })).toHaveCount(1);
  });

  test('R-11 shortening the extension re-plans', async ({ page }) => {
    const id = await startRun(page, 'ASN-881');
    await signIn(page, 'Erin Walsh');
    await page.goto('/inbox');
    await button(inboxCard(page, /^Tenure review/), 'Approve').click();
    await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
    await signIn(page, 'Samira Khan');
    expect((await page.request.post('/api/runtime/records/assignment/ASN-881', { data: { data: { months_engaged_after: 17, total_value: 278000, end_date: '2027-03-31' } } })).status()).toBe(200);
    await openRun(page, id);
    await expect(page.getByRole('region', { name: 'History' }).getByRole('listitem').filter({ hasText: /^Record changed: .*\. Levv re-checked who needs to approve\./ })).toHaveCount(1);
    await signIn(page, 'Erin Walsh');
    await page.goto('/inbox');
    await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
    await signIn(page, 'Luis Romero');
    await page.goto('/inbox');
    await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
  });

  test('R-12 a check set to Stop ends the run', async ({ page }) => {
    await publishEdited(page, 'wf-wo-sub-wo-uk-tech', (workflow) => {
      const { nodes } = workflow.draft;
      delete nodes.RA_CDe;
      nodes.RA_CDf = { id: 'RA_CDf', kind: 'notify', label: 'Tell them it stopped', recipients: ['proc'], channel: 'Email', outs: [{ key: 'next', to: 'RA_CDf_end' }] };
      nodes.RA_CDf_end = { id: 'RA_CDf_end', kind: 'end', label: 'Stopped', outcome: 'stopped', outs: [] };
      Object.assign(nodes.RA_CD, { flagDo: 'stop', flagWho: 'proc', flagNode: 'RA_CDf', outs: [{ key: 'flag', to: 'RA_CDf', label: 'Flagged' }, { key: 'pass', to: 'RA_A1', label: 'Passed' }] });
    });
    const id = await startRun(page, 'WO-2240');
    await signIn(page, 'Samira Khan');
    await openRun(page, id);
    await expect(chip(page, 'Stopped')).toBeVisible();
    await expect(historyLine(page, 'Stopped at “Duplicate & ghost worker”. 20 Oct 2026, 09:00 UTC')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Tell them it stopped' }).getByText('Done', { exact: true })).toBeVisible();
    for (const name of ['Pause', 'Resume', 'Stop']) await expect(button(page, name)).toHaveCount(0);
  });
});

test.describe('Reaching the screens', () => {
  test('a non-admin assignee finds Inbox in the sidebar, and no Running workflows', async ({ page }) => {
    await startRun(page, 'WO-2231');
    await signIn(page, 'Raj Patel');
    await page.goto('/home');
    await page.getByRole('link', { name: 'Inbox', exact: true }).click();
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(inboxCard(page, 'Business sign-off · Operations analyst (WO-2231)')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Running workflows', exact: true })).toHaveCount(0);
  });

  test('an admin finds both in the sidebar', async ({ page }) => {
    await startRun(page, 'WO-2231');
    await signIn(page, 'Samira Khan');
    await page.goto('/home');
    await page.getByRole('link', { name: 'Running workflows', exact: true }).click();
    await expect(page).toHaveURL(/\/runs$/);
    await expect(page.getByRole('heading', { name: 'Running workflows' })).toBeVisible();
    await page.getByRole('link', { name: 'Operations analyst (WO-2231)' }).click();
    await expect(page).toHaveURL(/\/runs\/run-/);
    await expect(page.getByRole('heading', { name: 'Operations analyst (WO-2231)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inbox', exact: true })).toBeVisible();
  });

  test('Flow Studio does not link to runs (04 §0.1)', async ({ page }) => {
    await freshApp(page);
    await page.goto('/flow-studio/wf-wo-sub');
    await canvasOf(page).waitFor();
    await expect(page.locator('a[href^="/runs"], a[href^="/inbox"]')).toHaveCount(0);
  });

  test('without a session they go to sign-in', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    for (const path of ['/inbox', '/runs', '/inbox/x', '/runs/x']) {
      const response = await context.request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toContain(`/auth/login?next=${encodeURIComponent(path)}`);
    }
    await context.close();
  });
});

test.describe('05 §6.1 Running workflows', () => {
  test('the table, the filters and the empty state', async ({ page }) => {
    await page.goto('/runs');
    await expect(page.getByRole('heading', { name: 'Running workflows' })).toBeVisible();
    await expect(page.getByText('No workflows are running. They start when a record’s event happens, for example a work order being submitted.')).toBeVisible();
    await shot(page, 'runs-empty');

    const first = await startRun(page, 'WO-2231');
    await startRun(page, 'AR-301');
    await setClock(page, '2026-10-20T11:00:00Z');
    const completed = await startRun(page, 'TS-9934');
    await page.goto('/runs');
    for (const heading of ['Record', 'Workflow', 'Status', 'Waiting on', 'Started', 'Last change']) await expect(page.getByRole('columnheader', { name: heading })).toBeVisible();

    const row = page.getByRole('link', { name: 'Operations analyst (WO-2231)' });
    await expect(row.getByText('Work order submitted')).toBeVisible();
    await expect(row.getByText('v1')).toBeVisible();
    await expect(row.getByText('Running')).toBeVisible();
    await expect(row.getByText('Business sign-off: Raj Patel')).toBeVisible();
    await expect(row.getByText('20 Oct 2026')).toBeVisible();
    await expect(row.getByText('2h ago')).toBeVisible();
    // Default filter: Running and Paused.
    await expect(page.getByRole('link', { name: /TS-9934/ })).toHaveCount(0);
    await shot(page, 'runs-list');

    await page.getByRole('button', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'All statuses' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: /TS-9934/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /TS-9934/ }).getByText('Completed')).toBeVisible();
    await expect(page.getByRole('link', { name: /TS-9934/ }).getByText('—')).toBeVisible();

    await page.getByRole('button', { name: 'Workflow' }).click();
    await page.getByRole('option', { name: 'Site access request' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link')).toContainText([/Visiting engineer/]);
    await expect(page.getByRole('link', { name: 'Operations analyst (WO-2231)' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Workflow' }).click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');

    await page.getByRole('searchbox', { name: 'Record' }).fill('2231');
    await expect(page.getByRole('link', { name: 'Operations analyst (WO-2231)' })).toBeVisible();
    await expect(page.getByRole('link', { name: /TS-9934/ })).toHaveCount(0);

    await page.getByRole('link', { name: 'Operations analyst (WO-2231)' }).click();
    await expect(page).toHaveURL(new RegExp(`/runs/${first}$`));
    expect(completed).toBeTruthy();
  });

  test('/runs?record={id} opens filtered (05 §6.3)', async ({ page }) => {
    await startRun(page, 'WO-2231');
    await startRun(page, 'AR-301');
    await page.goto('/runs?record=AR-301');
    await expect(page.getByRole('link', { name: /AR-301/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /WO-2231/ })).toHaveCount(0);
  });

  test('not everyone may read it', async ({ page }) => {
    await signIn(page, 'Raj Patel');
    await page.goto('/runs');
    await expect(page.getByText('You don’t have access to running workflows.')).toBeVisible();
  });
});

test.describe('05 §6.2 Run detail', () => {
  test('the canvas is the pinned version, read-only, with run statuses', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await openRun(page, id);
    const canvas = canvasOf(page);
    const box = (name: string) => canvas.getByRole('button', { name, exact: true });
    await expect(box('Business sign-off')).toBeVisible();
    await expect(box('Tell the supplier')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add a step here' })).toHaveCount(0);
    await expect(canvas.getByText('Waiting on Raj Patel')).toBeVisible();
    await expect(canvas.getByText('Not started')).toBeVisible();
    await expect(canvas.getByText('Done').first()).toBeVisible();
    await expect(canvas.locator('path[data-from="RA_CB"][data-key="pass"]')).toHaveClass(/stroke-cyan-400/);
    await expect(canvas.locator('path[data-from="RA_CD"][data-key="flag"]')).not.toHaveClass(/stroke-cyan-400/);
    // A box only points at its row. No step panel: nothing here edits.
    await box('Business sign-off').click();
    await expect(page.getByRole('heading', { name: 'Approve', exact: true })).toHaveCount(0);
    await shot(page, 'run-detail');
  });

  test('a run keeps its version when a new one is published', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await publishEdited(page, 'wf-wo-sub', (workflow) => {
      workflow.draft.nodes.RW.label = 'Tell the supplier, version two';
    });
    await signIn(page, 'Owen Clarke');
    await openRun(page, id);
    await expect(page.getByText('Work order submitted · v1 · started')).toBeVisible();
    await expect(canvasOf(page).getByRole('button', { name: 'Tell the supplier', exact: true })).toBeVisible();
    await signIn(page, 'Raj Patel');
    await page.goto('/inbox');
    await button(inboxCard(page, 'Business sign-off · Operations analyst (WO-2231)'), 'Approve').click();
    await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
    await signIn(page, 'Owen Clarke');
    await openRun(page, id);
    await expect(chip(page, 'Completed')).toBeVisible();
    const next = await postEvent(page.request, 'WO-2231');
    expect(next.outcome).toBe('started');
    await openRun(page, next.runIds[0]);
    await expect(page.getByText('Work order submitted · v2 · started')).toBeVisible();
  });

  test('mock adapters are said out loud', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await openRun(page, id);
    await expect(page.getByText('Some results on this run are simulated. This build has no live connections, so System, verification and Digital Worker steps didn’t call a real service, and messages are queued rather than sent.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'History' })).toContainText('Simulated: Budget check worked this out from the record, not from a live service.');
  });

  test('a conflict waits for a choice (03 §8.3, D13)', async ({ page }) => {
    const conflict = { field: 'Bill rate', a: { by: 'Grace Kim', v: '$96/h', total: 150000 }, b: { by: 'Raj Patel', v: '$102/h', total: 159000 } };
    const id = await startRun(page, 'ASN-881', { conflict });
    await openRun(page, id);
    await expect(page.getByText('Two proposed changes to the bill rate: $96/h from Grace Kim and $102/h from Raj Patel. Nothing is overwritten; approvals wait until one version is chosen.')).toBeVisible();
    await signIn(page, 'Erin Walsh');
    await page.goto('/inbox');
    await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
    await signIn(page, 'Owen Clarke');
    await page.goto(`/runs/${id}`);
    await button(page, 'Use $102/h').click();
    await expect(page.getByRole('region', { name: 'History' })).toContainText('Using $102/h from Raj Patel. Grace Kim has been told, and approval links for the other version no longer work.');
    await expect(page.getByRole('region', { name: 'Record' }).getByText('$159K', { exact: true })).toBeVisible();
    await signIn(page, 'Erin Walsh');
    await page.goto('/inbox');
    await expect(inboxCard(page, /^Tenure review/)).toBeVisible();
  });
});

test.describe('05 §7 Inbox', () => {
  test('three sections, each with its empty state', async ({ page }) => {
    await signIn(page, 'Raj Patel');
    await page.goto('/inbox');
    for (const name of ['Approvals', 'Tasks', 'Flow changes to approve']) {
      const section = page.getByRole('region', { name });
      await expect(section.getByRole('heading', { name })).toBeVisible();
      await expect(section.getByText('Nothing waiting for you.')).toBeVisible();
    }
    await shot(page, 'inbox-empty');
  });

  test('the approval card carries the brief, and each dialog its exact copy', async ({ page }) => {
    await startRun(page, 'WO-2214');
    await signIn(page, 'Alan Brooks');
    await page.goto('/inbox');
    const card = inboxCard(page, /Business sign-off · Senior cloud engineer \(WO-2214\)/).first();
    await expect(card).toContainText('Business sign-off: Senior cloud engineer (WO-2214)');
    await expect(card).toContainText('What’s asked: approve as');
    await expect(card).toContainText('Checks: Budget check passed: $120K left in plan after this request; Duplicate & ghost worker passed: No duplicate worker or leftover access found.');
    for (const name of ['Approve', 'Reject', 'Send back']) await expect(button(card, name)).toBeVisible();
    await button(card, 'Send back').click();
    const back = page.getByRole('dialog', { name: 'Send it back to Priya Shah?' });
    await expect(back).toBeVisible();
    await expect(button(back, 'Send back')).toBeDisabled();
    await button(back, 'Cancel').click();
    await shot(page, 'inbox-with-approval');
  });

  test('a delegate sees who they stand in for', async ({ page }) => {
    await startRun(page, 'WO-2214');
    await signIn(page, 'Ravi Kumar');
    await page.goto('/inbox');
    const card = inboxCard(page, /Senior cloud engineer \(WO-2214\)/).first();
    await expect(card.getByText('On behalf of Information Security (Kenji Watanabe)').last()).toBeVisible();
    await expect(card).toContainText('Added by the company-wide rule “Client data access”');
  });

  test('nobody approves their own request: they never get the item, and a forged decide is refused', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await signIn(page, 'Grace Kim');
    await page.goto('/inbox');
    await expect(page.getByRole('region', { name: 'Approvals' }).getByText('Nothing waiting for you.')).toBeVisible();
    const itemId = await itemIdOf(page, 'Raj Patel', 'approvals');
    await signIn(page, 'Grace Kim');
    expect((await page.request.post(`/api/runtime/work-items/${itemId}/decide`, { data: { decision: 'approved' } })).status()).toBe(403);
    await signIn(page, 'Samira Khan');
    // Post-build review: an open run's requester can't be rewritten, so what withdraws Raj here is another business unit.
    expect((await page.request.post('/api/runtime/records/work_order/WO-2231', { data: { data: { requester: 'Raj Patel' } } })).status()).toBe(422);
    expect((await page.request.post('/api/runtime/records/work_order/WO-2231', { data: { data: { business_unit: 'Technology' } } })).status()).toBe(200);
    await signIn(page, 'Raj Patel');
    await page.goto(`/inbox/${itemId}`);
    await expect(page.getByText('This no longer needs you. No action is needed.')).toBeVisible();
    for (const name of ['Approve', 'Reject', 'Send back']) await expect(button(page, name)).toHaveCount(0);
    expect(id).toBeTruthy();
  });

  test('a late second answer is told, and changes nothing', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    const itemId = await itemIdOf(page, 'Raj Patel', 'approvals');
    await page.goto(`/inbox/${itemId}`);
    await expect(button(page, 'Approve')).toBeVisible();
    await shot(page, 'inbox-item');
    // Answered in another tab while this one still shows the buttons.
    expect((await page.request.post(`/api/runtime/work-items/${itemId}/decide`, { data: { decision: 'approved' } })).status()).toBe(200);
    await button(page, 'Approve').click();
    await expect(page.getByText('This has already been answered.', { exact: true })).toBeVisible();
    await signIn(page, 'Owen Clarke');
    await openRun(page, id);
    await expect(page.getByRole('region', { name: 'History' }).getByRole('listitem').filter({ hasText: /^Raj Patel approved\./ })).toHaveCount(1);
  });

  test('tasks: Mark done, Verified and Not verified, and Needs information', async ({ page }) => {
    const off = await startRun(page, 'OFF-902');
    await signIn(page, 'Sam Patel');
    await page.goto('/inbox');
    const task = inboxCard(page, /^Return equipment/);
    await expect(task.getByText('Collect laptop and badge')).toBeVisible();
    await expect(task.getByText('Due 24 Oct 2026')).toBeVisible();
    await button(task, 'Mark done').click();
    await expect(page.getByRole('region', { name: 'Tasks' }).getByText('Nothing waiting for you.')).toBeVisible();

    await signIn(page, 'Tom Reed');
    await page.goto('/inbox');
    const review = inboxCard(page, /^Final timesheet & expenses/);
    await expect(button(review, 'Verified')).toBeVisible();
    await shot(page, 'inbox-tasks');
    await button(review, 'Not verified').click();
    const dialog = page.getByRole('dialog', { name: 'Not verified?' });
    await expect(button(dialog, 'Not verified')).toBeDisabled();
    await button(dialog, 'Cancel').click();

    await signIn(page, 'Samira Khan');
    await startRun(page, 'WO-2231', { rate_vs_card_pct: null });
    const approve = await itemIdOf(page, 'Raj Patel', 'approvals');
    expect((await page.request.post(`/api/runtime/work-items/${approve}/decide`, { data: { decision: 'approved' } })).status()).toBe(200);
    await signIn(page, 'Owen Clarke');
    await page.goto('/inbox');
    const needs = inboxCard(page, /^Rate over card\?/);
    await expect(needs.getByText('Needs information: Rate vs rate card (%) is missing, so “Rate over card?” can’t decide. Procurement (Owen Clarke) has been asked to fill it in')).toBeVisible();
    await needs.getByRole('textbox', { name: 'Rate vs rate card (%)' }).fill('12');
    await button(needs, 'Save').click();
    await expect(needs).toHaveCount(0);
    await expect(inboxCard(page, /^Rate review/)).toBeVisible();
    expect(off).toBeTruthy();
  });

  test('without auto-completion is checked in real mode (test:django); here the worker’s items arrive at once', async ({ page }) => {
    const id = await startRun(page, 'OFF-902');
    await signIn(page, 'Samira Khan');
    await openRun(page, id);
    await expect(page.getByRole('region', { name: 'History' })).toContainText('Asked the worker for: Confidentiality reminder acknowledged, Company data returned or deleted');
    await expect(page.getByRole('region', { name: 'History' })).toContainText('The worker provided: Confidentiality reminder acknowledged, Company data returned or deleted');
  });
});

test.describe('Flow changes in the inbox', () => {
  const editSend = async (page: import('@playwright/test').Page): Promise<string> => {
    await signIn(page, 'Flow Admin');
    const loaded = (await (await page.request.get('/api/flow-studio/workflows/wf-ts-sub')).json()) as { workflow: Record<string, any>; draftRev: number };
    loaded.workflow.draft.nodes.NA.label = 'Tell the supplier now';
    expect((await page.request.put('/api/flow-studio/workflows/wf-ts-sub/draft', { data: { draft: loaded.workflow, draftRev: loaded.draftRev } })).status()).toBe(200);
    const sent = await page.request.post('/api/flow-studio/workflows/wf-ts-sub/publish-requests', { data: { goLive: '2026-10-21' } });
    expect(sent.status()).toBe(201);
    return ((await sent.json()) as { id: string }).id;
  };

  test('Approving from the inbox publishes the version, and the author sees it', async ({ page }) => {
    await editSend(page);
    await signIn(page, 'Samira Khan');
    await page.goto('/inbox');
    const card = inboxCard(page, 'Timesheet submitted · goes live on 21 Oct 2026');
    await expect(card.getByText('Sent by Flow Admin')).toBeVisible();
    await expect(card).toContainText('Applies to new runs.');
    await expect(card).toContainText('Anything already running keeps its current version.');
    await shot(page, 'inbox-flow-change');
    await button(card, 'Approve').click();
    await expect(page.getByRole('region', { name: 'Flow changes to approve' }).getByText('Nothing waiting for you.')).toBeVisible();
    await signIn(page, 'Flow Admin');
    const after = (await (await page.request.get('/api/flow-studio/workflows/wf-ts-sub')).json()) as { workflow: { version: number; pending: unknown }; publishedNotice?: { version: number } };
    expect(after.workflow.version).toBe(2);
    expect(after.workflow.pending).toBeNull();
    expect(after.publishedNotice?.version).toBe(2);
  });

  test('Reject needs a comment, and the first decision closes every copy', async ({ page }) => {
    await editSend(page);
    const owensCopy = await itemIdOf(page, 'Flow Admin', 'flowChanges').catch(() => null);
    expect(owensCopy).toBeNull(); // The author has no copy.
    await signIn(page, 'Samira Khan');
    await page.goto('/inbox');
    const card = inboxCard(page, 'Timesheet submitted · goes live on 21 Oct 2026');
    await button(card, 'Reject').click();
    const dialog = page.getByRole('dialog', { name: 'Reject Timesheet submitted?' });
    await expect(button(dialog, 'Reject')).toBeDisabled();
    await confirmDialog(page, 'Reject Timesheet submitted?', 'Comment', 'Not yet', 'Reject');
    await expect(page.getByRole('region', { name: 'Flow changes to approve' }).getByText('Nothing waiting for you.')).toBeVisible();
    await signIn(page, 'Flow Admin');
    const after = (await (await page.request.get('/api/flow-studio/workflows/wf-ts-sub')).json()) as { workflow: { version: number; pending: unknown } };
    expect(after.workflow.version).toBe(1);
    expect(after.workflow.pending).toBeNull();
  });

  test('LP-13 on /inbox: the author and someone with no permission have no way to approve', async ({ page }) => {
    await editSend(page);
    const samirasCopy = await itemIdOf(page, 'Samira Khan', 'flowChanges');
    for (const user of ['Flow Admin', 'Grace Kim']) {
      await signIn(page, user);
      await page.goto('/inbox');
      await expect(page.getByRole('region', { name: 'Flow changes to approve' }).getByText('Nothing waiting for you.')).toBeVisible();
      await expect(inboxCard(page, 'Timesheet submitted · goes live on 21 Oct 2026')).toHaveCount(0);
    }
    await signIn(page, 'Flow Admin');
    await page.goto(`/inbox/${samirasCopy}`);
    await expect(page.getByText('You can’t approve your own change.')).toBeVisible();
    for (const name of ['Approve', 'Reject']) await expect(button(page, name)).toHaveCount(0);
    await shot(page, 'inbox-own-change');
    await signIn(page, 'Grace Kim');
    await page.goto(`/inbox/${samirasCopy}`);
    await expect(page.getByText('This isn’t in your inbox.')).toBeVisible();
    for (const name of ['Approve', 'Reject']) await expect(button(page, name)).toHaveCount(0);
  });

  test('UI-PERM-01’s actor set on /inbox: nobody can approve, so nothing is there', async ({ page }) => {
    await resetApp(page, 'author-only-approver');
    await signIn(page, 'Flow Admin');
    // Publish blocks it (LP-13's must-fix), so no request and no copy exists for anyone.
    const loaded = (await (await page.request.get('/api/flow-studio/workflows/wf-ts-sub')).json()) as { workflow: Record<string, any>; draftRev: number };
    loaded.workflow.draft.nodes.NA.label = 'Tell the supplier now';
    expect((await page.request.put('/api/flow-studio/workflows/wf-ts-sub/draft', { data: { draft: loaded.workflow, draftRev: loaded.draftRev } })).status()).toBe(200);
    expect((await page.request.post('/api/flow-studio/workflows/wf-ts-sub/publish-requests', { data: { goLive: '2026-10-21' } })).status()).toBe(422);
    await page.goto('/inbox');
    await expect(page.getByRole('region', { name: 'Flow changes to approve' }).getByText('Nothing waiting for you.')).toBeVisible();
  });
});

test.describe('The secrets', () => {
  test('a wrong or missing cron secret or service token is refused; the right one works', async ({ page }) => {
    const none = await page.request.post('/api/runtime/tick', { data: {} });
    expect(none.status()).toBe(403);
    const wrong = await page.request.post('/api/runtime/tick', { headers: { 'x-levv-cron-secret': 'no' }, data: {} });
    expect(wrong.status()).toBe(403);
    const right = await page.request.post('/api/runtime/tick', { headers: CRON_SECRET, data: {} });
    expect(right.status()).toBe(200);
    await signIn(page, 'Raj Patel');
    expect((await page.request.post('/api/runtime/events', { headers: { 'x-levv-service-token': 'no' }, data: {} })).status()).toBe(403);
    expect((await page.request.post('/api/runtime/events', { headers: SERVICE_TOKEN, data: { nothing: true } })).status()).toBe(400);
  });
});
