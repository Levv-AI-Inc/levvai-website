import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectedOf, normDeep } from '../support/acceptance-doc';
import { card as testCard, expectTestPanel, novaButton, openTest, publishButton, publishDialog, readNova, readTestPanel } from './test-panel';
import {
  boxText,
  canvasOf,
  choose,
  expectSaved,
  freshApp,
  lintIssues,
  norm,
  novaCount,
  openDetails,
  openStep,
  openWorkflow,
  optionTexts,
  panelOf,
  plusAfter,
  readBoxes,
  savedWorkflow,
  searchPick,
  selectButton,
  toastOf,
  waitForCanvas,
} from './helpers';

/**
 * 06 B.1 UI-N5 and UI-N6, B.4 UI-W10 to UI-W15, B.5 UI-D1 and UI-D3 to UI-D5, B.9's editing items.
 * "Test equals EN-xxx" is asserted twice: through the simulate route on what was autosaved, and on the screen.
 */

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

const WO = 'Work order submitted';

async function openFirst(page: Page): Promise<void> {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
}

async function expectTest(page: Page, workflowId: string, recordId: string, en: string): Promise<void> {
  const expected = normDeep(expectedOf(en));
  await expect
    .poll(
      async () => {
        const response = await page.request.post(`/api/flow-studio/workflows/${workflowId}/simulate`, { data: { recordId } });
        return normDeep(await response.json());
      },
      { timeout: 8000 },
    )
    .toStrictEqual(expected);
}

const spin = (scope: Locator, name: string): Locator => scope.getByRole('spinbutton', { name, exact: true });

test('UI-N5 the Chaser is built into the step', async ({ page }) => {
  await openFirst(page);
  await openStep(page, 'Business sign-off');
  const panel = panelOf(page);
  await expect(panel.getByText('Chaser', { exact: true })).toBeVisible();
  await expect(panel.getByText('built in', { exact: true })).toBeVisible();
  await expect(spin(panel, 'Remind after (hours)')).toHaveValue('24');
  await expect(spin(panel, 'Then escalate to their manager after (hours)')).toHaveValue('48');
  await expect(panel.getByText('Runs by itself while this step waits. Reminders stop the moment someone acts.')).toBeVisible();
  await expect(panel.getByText('Escalation has to come after the reminder.')).toHaveCount(0);

  await spin(panel, 'Remind after (hours)').fill('12');
  await expect(page.getByRole('banner').getByText('Live v1 · unpublished changes')).toBeVisible();
  await expectTest(page, 'wf-wo-sub', 'WO-2231', 'EN-050');
  const result = (await (await page.request.post('/api/flow-studio/workflows/wf-wo-sub/simulate', { data: { recordId: 'WO-2231' } })).json()) as { steps: { title: string; message: string }[] };
  expect(norm(result.steps.find((step) => step.title === 'Business sign-off')?.message ?? '')).toBe('Together. If rejected: back to the requester to fix. Chaser reminds after 12h and escalates to their manager after 48h');

  await openTest(page, 'Operations analyst');
  expect((await testCard(page, 'Business sign-off')).message).toBe('Together. If rejected: back to the requester to fix. Chaser reminds after 12h and escalates to their manager after 48h');
  await expectTestPanel(page, 'EN-050');
});

test('UI-N6 Chaser is on every step that waits on a person, not in the rail', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Assignment ending');
  await openStep(page, 'Extend or end?');
  let panel = panelOf(page);
  await expect(panel.getByRole('heading', { name: 'Task', exact: true })).toBeVisible();
  await expect(spin(panel, 'Remind after (hours)')).toHaveValue('48');
  await expect(spin(panel, 'Then escalate to their manager after (hours)')).toHaveValue('96');
  const rail = page.getByRole('complementary', { name: 'Digital Workers' });
  const railNames = () => rail.getByRole('button').evaluateAll((buttons) => buttons.map((button) => button.textContent ?? ''));
  expect(await railNames()).toEqual(['Tenure & classification', 'Rate check', 'Budget check', 'Duplicate & ghost worker', 'Job posting writer', 'Invoice match']);

  await openWorkflow(page, 'Assignment ending', 'Contractor onboarding');
  await openStep(page, 'Background check');
  panel = panelOf(page);
  await expect(panel.getByRole('heading', { name: 'Collect & verify', exact: true })).toBeVisible();
  await expect(spin(panel, 'Remind after (hours)')).toHaveValue('48');
  await expect(spin(panel, 'Then escalate to the hiring manager after (hours)')).toHaveValue('96');
  expect(await railNames()).toEqual(['Document collector', 'Access provisioner', 'Start-date guardian']);

  const ids = ((await (await page.request.get('/api/flow-studio/workflows')).json()) as { id: string }[]).map((row) => row.id);
  expect(ids).toHaveLength(15);
  for (const id of ids) {
    await page.goto(`/flow-studio/${id}`);
    await waitForCanvas(page);
    await expect(rail.getByRole('button').first()).toBeVisible();
    expect((await railNames()).join(' ')).not.toContain('Chaser');
  }

  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first().click();
  for (const absent of ['Chaser', 'Update record']) await expect(panelOf(page).getByText(absent)).toHaveCount(0);
});

test('UI-W10 the sponsor can provide instead', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Site access request');
  await openStep(page, 'Identity & site details');
  await choose(panelOf(page), 'Who provides it', 'Sponsor');
  const box = await boxText(page, 'Identity & site details');
  expect(box).toBe('Done | Failed | Identity & site details | Sponsor provides · Persona, then Information Security');
  await expect(spin(panelOf(page), 'Then escalate to their manager after (hours)')).toBeVisible();
  await expectTest(page, 'wf-access', 'AR-301', 'EN-056');

  await openTest(page, 'Visiting engineer, 2 weeks on site');
  expect((await testCard(page, 'Identity & site details')).message).toBe('Asked of Sponsor (Grace Kim, or their delegate Raj Patel): Photo ID, Date of birth, Signed site safety rules. Verified by Persona');
  await expectTestPanel(page, 'EN-056');
});

test('UI-W11 the worker never approves', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Assignment ending');
  await openStep(page, 'Extend or end?');
  await selectButton(panelOf(page), 'Who').click();
  const task = await optionTexts(page);
  await page.keyboard.press('Escape');
  expect(task).toEqual([
    'Worker', 'Sponsor', 'Hiring manager', "Hiring manager's manager", 'Cost center owner', 'Department head', 'SOW owner', 'HR business partner', 'Information Security', 'Privacy', 'Legal', 'Compliance', 'Tax', 'Procurement', 'Finance business partner', 'Supplier account manager', 'VP Finance', 'CFO', 'People Ops', 'IT service desk', 'Accounts payable', 'Finance controllers', 'Security review board', 'Executive committee',
  ]);

  await openWorkflow(page, 'Assignment ending', WO);
  await openStep(page, 'Business sign-off');
  await selectButton(panelOf(page), 'Roles').click();
  const approvers = (await optionTexts(page)).map((text) => text.replace(/^✓/, ''));
  await page.keyboard.press('Escape');
  const seventeen = ['Sponsor', 'Hiring manager', "Hiring manager's manager", 'Cost center owner', 'Department head', 'SOW owner', 'HR business partner', 'Information Security', 'Privacy', 'Legal', 'Compliance', 'Tax', 'Procurement', 'Finance business partner', 'Supplier account manager', 'VP Finance', 'CFO'];
  expect(approvers).toEqual(seventeen);

  await openStep(page, 'Duplicate & ghost worker');
  await selectButton(panelOf(page), 'Escalate to').click();
  expect(await optionTexts(page)).not.toContain('Worker');
  await page.keyboard.press('Escape');

  await openWorkflow(page, WO, 'Contractor onboarding');
  await openStep(page, 'Background check');
  await selectButton(panelOf(page), 'Who decides').click();
  const deciders = (await optionTexts(page)).map((text) => text.replace(/^✓/, ''));
  await page.keyboard.press('Escape');
  expect(deciders).toEqual([...seventeen, 'People Ops', 'IT service desk', 'Accounts payable']);
  expect(deciders).not.toContain('Worker');

  // The other "If it fails" list: Escalate takes one person from the same people.
  await openStep(page, 'Identity & eligibility');
  await selectButton(panelOf(page), 'Escalate to').click();
  const escalate = await optionTexts(page);
  await page.keyboard.press('Escape');
  expect(escalate).not.toContain('Worker');
  for (const role of ['People Ops', 'IT service desk', 'Accounts payable']) expect(escalate).toContain(role);
});

test('UI-W12 system failure path', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Contractor offboarding');
  await openStep(page, 'Remove access');
  const panel = panelOf(page);
  await selectButton(panel, 'If it fails').click();
  expect(await optionTexts(page)).toEqual(['Then give someone a task to fix it', 'Then take a Failed path (add your own steps)', 'Then pause the workflow and alert the owner']);
  await page.keyboard.press('Escape');
  await expect(panel.getByText('Levv retries 3 times over an hour first.')).toBeVisible();

  await choose(panel, 'If it fails', 'Then take a Failed path (add your own steps)');
  expect(await boxText(page, 'Remove access')).toBe('Done | Failed | Remove access | Close or deactivate user in Okta');
  expect(await boxText(page, 'Fix the Okta error')).toContain('Fix the Okta error');

  await choose(panel, 'If it fails', 'Then give someone a task to fix it');
  expect(await boxText(page, 'Remove access')).toBe('Remove access | Close or deactivate user in Okta');
  expect(await boxText(page, 'Fix the Okta error')).toBe('');
});

test('UI-W13 deleting a check keeps the line', async ({ page }) => {
  await openFirst(page);
  const before = await readBoxes(page);
  await openStep(page, 'Budget check');
  await panelOf(page).getByRole('button', { name: 'Delete this step' }).click();
  const toast = toastOf(page);
  await expect(toast).toContainText('Step deleted. Lines reconnected');
  await expect(toast.getByRole('button', { name: 'Undo' })).toBeVisible();
  await expect(panelOf(page)).toHaveCount(0);
  const after = await readBoxes(page);
  expect(after.map((box) => box.text).sort()).toEqual(before.map((box) => box.text).filter((text) => !text.includes('Budget check')).sort());
  expect(after).toHaveLength(11);
  const lines = await canvasOf(page).locator('svg path').evaluateAll((paths) => paths.map((path) => [path.getAttribute('data-from'), path.getAttribute('data-to')]));
  const seed = (await (await page.request.get('/api/flow-studio/workflows/wf-wo-sub')).json()) as { workflow: { draft: { nodes: Record<string, { label: string; id: string }> } } };
  const dupId = Object.values(seed.workflow.draft.nodes).find((node) => node.label === 'Duplicate & ghost worker')?.id;
  expect(lines.find(([from]) => from === 'T')?.[1]).toBe(dupId);
  await expect(page.getByRole('banner').getByText('Live v1 · unpublished changes')).toBeVisible();
  await expectTest(page, 'wf-wo-sub', 'WO-2231', 'EN-058');

  await openTest(page, 'Operations analyst');
  await expectTestPanel(page, 'EN-058');
});

test('UI-W14 Wait follows the record’s date', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Contractor onboarding');
  await openStep(page, 'Wait for start date');
  const panel = panelOf(page);
  await expect(panel.getByRole('heading', { name: 'Wait', exact: true })).toBeVisible();
  await expect(panel.getByText('Wait for start date', { exact: true })).toBeVisible();
  await expect(selectButton(panel, 'Wait')).toHaveText('Until a date on the record');
  await expect(spin(panel, 'Offset')).toHaveValue('0');
  await expect(selectButton(panel, 'Unit')).toHaveText('days');
  await expect(selectButton(panel, 'Before or after')).toHaveText('Before');
  await expect(selectButton(panel, 'Date')).toHaveText('Start date');
  await expect(panel.getByLabel('At', { exact: true })).toHaveValue('09:00');
  await expect(selectButton(panel, 'Time zone')).toHaveText('The worker’s');
  expect(norm((await panel.getByText(/^Waits until/).textContent()) ?? '')).toBe("Waits until Start date, 09:00 in the worker's time zone. If the date on the record changes, the wait moves with it.");
  await expect(panel.getByRole('button', { name: 'Delete this step' })).toBeVisible();
  expect(await boxText(page, 'Wait for start date')).toBe('Wait for start date | Until Start date, 09:00');
});

test('UI-W15 a failed check asks people to decide', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Contractor onboarding');
  await openStep(page, 'Background check');
  const panel = panelOf(page);
  expect(norm((await panel.getByText(/^Adverse results/).textContent()) ?? '')).toBe('Adverse results go to the people set under "If it fails". The worker can\'t start until they decide.');
  await expect(selectButton(panel, 'If it fails')).toHaveText('Ask people to decide');
  await expect(selectButton(panel, 'Who decides')).toHaveText('HR business partner, Legal');
  await expect(panel.getByText('They approve to carry on, or reject to stop.')).toBeVisible();
  expect(await boxText(page, 'Background check')).not.toContain('Failed');
});

test('UI-D1 Applies to is a searchable dropdown', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Job posting created');
  await openStep(page, 'Job posting created');
  const panel = panelOf(page);
  const canvas = canvasOf(page);
  const position = () => canvas.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop, zoom: (element.querySelector('[style*="scale("]') as HTMLElement).style.transform }));
  const before = await position();

  const country = selectButton(panel, 'Work country');
  await country.click();
  expect(await optionTexts(page)).toEqual(['UK', 'Canada', 'US', 'Germany']);
  await expect(page.getByRole('listbox').getByRole('option', { selected: true })).toHaveCount(0);
  await expect(page.getByText('None selected: applies to all')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Search' }).last().fill('can');
  expect(await optionTexts(page)).toEqual(['Canada']);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox').getByRole('option', { name: 'Canada' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('1 selected')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(country).toHaveText('Canada');

  expect(norm((await panel.getByText(/^Applies to: /).textContent()) ?? '')).toBe('Applies to: Canada. Several picks in one field means any of them; fields combine with AND. Levv reads these from the record.');
  expect(await boxText(page, 'Job posting created')).toBe('Job posting created | Canada');
  expect(await position()).toEqual(before);

  // Cleanup, as 06 writes it, and it reads back.
  await country.click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.keyboard.press('Escape');
  await expect(country).toHaveText('Any work country');
  expect(norm((await panel.getByText(/^Applies to: /).textContent()) ?? '')).toContain('Applies to: Everywhere.');
});

test('UI-D3 who hears about a final rejection', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Job posting created');
  await openStep(page, 'Job posting created');
  const panel = panelOf(page);
  await expect(selectButton(panel, 'When a request is finally rejected, tell')).toHaveText('Hiring manager');
  expect(norm((await panel.getByText(/^Each Approve step decides/).textContent()) ?? '')).toBe("Each Approve step decides whether a rejection goes back to the requester first. This is who hears when it's final.");

  const order = ['Active', 'Name', 'Runs when', 'Starts from', 'When a request is finally rejected, tell', 'Applies to (leave empty for everything)', 'Business unit', 'Cost center', 'Legal entity', 'Work country', 'More: site, worker type, job family', 'Applies to: ', 'Advanced'];
  const text = (await panel.textContent()) ?? '';
  let at = -1;
  for (const label of order) {
    const next = text.indexOf(label, at + 1);
    expect(next, label).toBeGreaterThan(at);
    at = next;
  }
  await expect(selectButton(panel, 'Runs when')).toHaveText('Job posting created');
  await expect(selectButton(panel, 'Starts from')).toHaveText('Levv');
  await expect(panel.getByText('When the work order is approved')).toHaveCount(0);
});

test('UI-D4 Owner is a dropdown', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Job posting created');
  await openStep(page, 'Job posting created');
  const panel = panelOf(page);
  await openDetails(panel);
  await expect(panel.getByLabel('Effective date')).toHaveValue('2026-09-01');
  const owner = selectButton(panel, 'Owner');
  await expect(owner).toHaveText('Procurement operations');
  await owner.click();
  const list = page.getByRole('listbox');
  expect(await list.locator('[role="presentation"]').allTextContents()).toEqual(['Teams', 'A person']);
  const options = await optionTexts(page);
  expect(options.slice(0, 10)).toEqual(['Accounts payable', 'Compliance', 'Finance operations', 'HR operations', 'IT operations', 'Information Security', 'Legal operations', 'Procurement operations', 'Security operations', 'Tax']);
  expect(options).toHaveLength(41);

  await page.getByRole('textbox', { name: 'Search' }).last().fill('hr');
  expect(await list.locator('[role="presentation"]').allTextContents()).toEqual(['Teams', 'A person']);
  expect(await optionTexts(page)).toEqual(['HR operations', 'Fatima Zahra · Privacy lead']);
  await page.keyboard.press('Enter');
  await expect(list).toHaveCount(0);
  await expect(owner).toHaveText('HR operations');
  await expectSaved(page, 'wf-jp', (workflow) => workflow.owner, 'HR operations');
});

test('UI-D5 who approves is never pills', async ({ page }) => {
  await openFirst(page);
  await openStep(page, 'Business sign-off');
  const panel = panelOf(page);
  const who = selectButton(panel, 'Who approves');
  await who.click();
  expect(await optionTexts(page)).toEqual(['Roles', 'An approval group', 'A named person']);
  await page.keyboard.press('Escape');

  await selectButton(panel, 'Roles').click();
  await expect(page.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
  await expect(page.getByText('2 selected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
  const roles = (await optionTexts(page)).map((text) => text.replace(/^✓/, ''));
  expect(roles).toHaveLength(17);
  expect(roles).not.toContain('Worker');
  await page.keyboard.press('Escape');

  await choose(panel, 'Who approves', 'An approval group');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  const group = selectButton(panel, 'Approval group');
  await expect(group).toHaveText('Choose a group');
  await expect(panel.getByText(/Any one of them can approve|Everyone in the group approves/)).toHaveCount(0);
  expect(await boxText(page, 'Business sign-off')).toBe('! | Business sign-off | Choose who approves');
  const signOff = async () => {
    const result = (await (await page.request.post('/api/flow-studio/workflows/wf-wo-sub/simulate', { data: { recordId: 'WO-2231' } })).json()) as { steps: { title: string; status: string }[] };
    return result.steps.find((step) => step.title === 'Business sign-off')?.status;
  };
  await expect.poll(signOff, { timeout: 8000 }).toBe('Choose who approves');
  await openTest(page, 'Operations analyst');
  expect((await testCard(page, 'Business sign-off')).status).toBe('Choose who approves');
  await openStep(page, 'Business sign-off');

  await group.click();
  expect(await optionTexts(page)).toEqual(['Finance controllers', 'Security review board', 'Executive committee']);
  await page.getByRole('option', { name: 'Finance controllers' }).click();
  await expect(panel.getByText('Chloe Martin, Lena Fischer, David Okafor. Any one of them can approve.')).toBeVisible();
  expect(norm((await panel.getByText(/Any one of them can approve/).textContent()) ?? '')).toBe('Finance controllers: Chloe Martin, Lena Fischer, David Okafor. Any one of them can approve.');
  expect(await boxText(page, 'Business sign-off')).toBe('Business sign-off | Finance controllers');
  await expect(panel.locator('select, input[type=radio], input[type=checkbox], [aria-pressed], [role=radio], [role=checkbox]')).toHaveCount(0);

  // 02 §17: back to Roles restores the last list.
  await choose(panel, 'Who approves', 'Roles');
  await expect(selectButton(panel, 'Roles')).toHaveText('Hiring manager, Cost center owner');
});

test('UI-ESC-01 one escalation timer on an If path', async ({ page }) => {
  await openFirst(page);
  await openStep(page, 'Rate over card?');
  const otherwise = panelOf(page).getByRole('group', { name: 'Otherwise', exact: true });
  await choose(otherwise, 'Then', 'Escalate: someone must decide');
  await spin(otherwise, 'Escalate after (hours)').fill('72');
  await openStep(page, 'Otherwise: escalation');
  let panel = panelOf(page);
  await expect(spin(panel, 'Remind after (hours)')).toHaveValue('24');
  const chaser = spin(panel, 'Then escalate to their manager after (hours)');
  await expect(chaser).toHaveValue('72');
  await chaser.fill('36');
  await openStep(page, 'Rate over card?');
  panel = panelOf(page);
  await expect(spin(panel.getByRole('group', { name: 'Otherwise', exact: true }), 'Escalate after (hours)')).toHaveValue('36');
  await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_C1_else?.sla, 36);
  const card = async () => {
    const result = (await (await page.request.post('/api/flow-studio/workflows/wf-wo-sub/simulate', { data: { recordId: 'WO-2231' } })).json()) as { steps: { title: string; status: string; message: string }[] };
    return result.steps.find((step) => step.title === 'Otherwise: escalation');
  };
  // Disputed, see the notes. 06 expects the Chaser line here, but the default Escalate to is Cost center owner, who already
  // approves Business sign-off on this path, and 03 §6.10 and §10.4 item 6 (which outrank 06) make that step "Covered".
  expect(await card()).toMatchObject({ status: 'Covered', message: 'The same person already approves this kind of decision on this path' });
  // 06's point, one timer that Test reads, holds as soon as the escalation has somebody of its own.
  await choose(panel.getByRole('group', { name: 'Otherwise', exact: true }), 'Escalate to', 'Procurement');
  await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_C1_else?.roles, ['proc']);
  await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_C1_else?.sla, 36);
  expect((await card())?.message).toMatch(/Chaser reminds after 24h and escalates to their manager after 36h$/);

  // The same, on the screen: the card ends as 06 says once the escalation has somebody of its own.
  await openTest(page, 'Operations analyst');
  expect((await testCard(page, 'Otherwise: escalation')).message).toMatch(/Chaser reminds after 24h and escalates to their manager after 36h$/);
});

test('UI-ESC-01 on the screen with the default Escalate to: Covered, as 03 §6.10 says (disputed, see the notes)', async ({ page }) => {
  await openFirst(page);
  await openStep(page, 'Rate over card?');
  const otherwise = panelOf(page).getByRole('group', { name: 'Otherwise', exact: true });
  await choose(otherwise, 'Then', 'Escalate: someone must decide');
  await openTest(page, 'Operations analyst');
  expect(await testCard(page, 'Otherwise: escalation')).toMatchObject({ status: 'Covered', message: 'The same person already approves this kind of decision on this path' });
});

test('UI-ESC-02 one escalation timer on a check', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'UK Technology work orders');
  await openStep(page, 'Duplicate & ghost worker');
  await spin(panelOf(page), 'Escalate after (hours)').fill('24');
  await openStep(page, 'Duplicate found: escalation');
  await expect(spin(panelOf(page), 'Then escalate to their manager after (hours)')).toHaveValue('24');
  await spin(panelOf(page), 'Remind after (hours)').fill('12');
  await openStep(page, 'Duplicate & ghost worker');
  await expect(spin(panelOf(page), 'Escalate after (hours)')).toHaveValue('24');
  await expectTest(page, 'wf-wo-sub-wo-uk-tech', 'WO-2240', 'EN-065');

  await openTest(page, 'Data engineer, trading data');
  expect((await testCard(page, 'Duplicate found: escalation')).message).toMatch(/Chaser reminds after 12h and escalates to their manager after 24h$/);
  await expectTestPanel(page, 'EN-065');
});

test('UI-ESC-03 escalation has to come after the reminder', async ({ page }) => {
  await openFirst(page);
  await openStep(page, 'Business sign-off');
  const panel = panelOf(page);
  const remind = spin(panel, 'Remind after (hours)');
  const escalate = spin(panel, 'Then escalate to their manager after (hours)');
  const error = panel.getByText('Escalation has to come after the reminder.');
  const ROSE = 'rgb(244, 63, 94)';

  await escalate.fill('24');
  await expect(error).toBeVisible();
  await expect(escalate).toHaveCSS('border-top-color', ROSE);
  await expect(remind).toHaveCSS('border-top-color', ROSE);
  await expect(escalate).toHaveValue('24');
  await expect(remind).toHaveValue('24');
  await expect.poll(() => novaCount(page)).toBe('1');
  await expect
    .poll(async () => (await lintIssues(page, 'wf-wo-sub')).map((issue) => [issue.sev, norm(issue.m)]), { timeout: 8000 })
    .toEqual([['bad', '"Business sign-off": escalation has to come after the reminder.']]);
  const review = async () => (await (await page.request.get('/api/flow-studio/workflows/wf-wo-sub/publish-review')).json()) as { canSend: boolean; mustFix: { m: string }[] };
  expect((await review()).canSend).toBe(false);

  await novaButton(page).click();
  expect(await readNova(page)).toEqual([{ label: 'Fix before publishing', message: '"Business sign-off": escalation has to come after the reminder.', buttons: ['Show me'] }]);

  await publishButton(page).click();
  const dialog = publishDialog(page);
  expect(norm((await dialog.locator('div').filter({ hasText: /^×/ }).last().textContent()) ?? '')).toBe('× "Business sign-off": escalation has to come after the reminder.');
  await expect(dialog.getByRole('button', { name: 'Send for approval' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('dialog').getByRole('button', { name: 'Show me' }).click();
  const again = panelOf(page);
  const escalateAgain = spin(again, 'Then escalate to their manager after (hours)');
  await escalateAgain.fill('12');
  await expect(again.getByText('Escalation has to come after the reminder.')).toBeVisible();
  await escalateAgain.fill('72');
  await expect(again.getByText('Escalation has to come after the reminder.')).toHaveCount(0);
  await expect.poll(() => novaCount(page)).toBe('0');
  await expect.poll(async () => (await review()).canSend, { timeout: 8000 }).toBe(true);

  await publishButton(page).click();
  await expect(publishDialog(page).locator('div').filter({ hasText: /^✓ Ready to send for approval\.$/ }).last()).toBeVisible();
});

test('UI-ESC-03 the same rule on Task, Collect & verify and “Escalate after (hours)”', async ({ page }) => {
  await page.goto('/flow-studio/wf-onboard');
  await waitForCanvas(page);
  await openStep(page, 'Identity & eligibility');
  let panel = panelOf(page);
  const message = 'Escalation has to come after the reminder.';
  await spin(panel, 'Remind after (hours)').fill('100');
  await expect(panel.getByText(message)).toHaveCount(1);
  await spin(panel, 'Remind after (hours)').fill('48');
  await expect(panel.getByText(message)).toHaveCount(0);
  await spin(panel, 'Escalate after (hours)').fill('24');
  await expect(panel.getByText(message)).toHaveCount(1);
  await expect(spin(panel, 'Escalate after (hours)')).toHaveValue('24');

  await page.goto('/flow-studio/wf-ending');
  await waitForCanvas(page);
  await openStep(page, 'Extend or end?');
  panel = panelOf(page);
  await spin(panel, 'Then escalate to their manager after (hours)').fill('48');
  await expect(panel.getByText(message)).toHaveCount(1);
});

test('UI-ESC-04 Collect & verify → If it fails → Escalate creates a step', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'Contractor onboarding');
  expect(await boxText(page, 'Identity & eligibility')).toContain('Done | Failed | Identity & eligibility');
  expect(await boxText(page, 'Identity & eligibility failed: escalation')).toBe('Identity & eligibility failed: escalation | People Ops');

  await openStep(page, 'Identity & eligibility');
  const panel = panelOf(page);
  await choose(panel, 'If it fails', 'Ask people to decide');
  expect(await boxText(page, 'Identity & eligibility')).not.toContain('Failed |');
  expect(await boxText(page, 'Identity & eligibility failed: escalation')).toBe('');
  await expect(selectButton(panel, 'Who decides')).toHaveText('Choose who decides');
  await expect(panel.getByText('They approve to carry on, or reject to stop.')).toBeVisible();

  await choose(panel, 'If it fails', 'Escalate: someone must decide');
  await expect(selectButton(panel, 'Escalate to')).toHaveText('People Ops');
  await spin(panel, 'Escalate after (hours)').fill('60');
  await expect(spin(panel, 'Escalate after (hours)')).toHaveValue('60');
  expect(await boxText(page, 'Identity & eligibility failed: escalation')).toBe('Identity & eligibility failed: escalation | People Ops');

  await openStep(page, 'Identity & eligibility failed: escalation');
  const generated = panelOf(page);
  await expect(generated.getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
  await expect(spin(generated, 'Remind after (hours)')).toHaveValue('24');
  await expect(spin(generated, 'Then escalate to their manager after (hours)')).toHaveValue('60');
});

test('UI-STOP-01 “Stop the workflow and tell someone” ends stopped', async ({ page }) => {
  await openFirst(page);
  await openStep(page, 'Rate over card?');
  const panel = panelOf(page);
  const otherwise = panel.getByRole('group', { name: 'Otherwise', exact: true });
  await choose(otherwise, 'Then', 'Stop the workflow and tell someone');
  await expect(selectButton(otherwise, 'Who to tell')).toHaveText('Hiring manager');
  expect(await boxText(page, 'Rate over card?')).toContain('Otherwise | stop');
  expect(await boxText(page, 'Otherwise: tell them it stopped')).toBe('Otherwise: tell them it stopped | Hiring manager');
  expect(await boxText(page, 'Stopped')).toBe('Stopped | Stopped');
  await expectTest(page, 'wf-wo-sub', 'WO-2231', 'EN-069');

  await openTest(page, 'Operations analyst');
  expect((await readTestPanel(page)).summary).toBe('1 approval round on this path. Stopped at "Rate over card?". Levv tells Hiring manager.');
  expect(await testCard(page, 'Otherwise: tell them it stopped')).toMatchObject({ status: 'Sent', message: 'Email to Hiring manager (Grace Kim)' });
  await expectTestPanel(page, 'EN-069');
  await openStep(page, 'Rate over card?');

  await choose(panel.getByRole('group', { name: 'Over 10%', exact: true }), 'Then', 'Stop the workflow and tell someone');
  await expect(toastOf(page)).toHaveText('At least one path has to carry on');
  await expect(selectButton(panel.getByRole('group', { name: 'Over 10%', exact: true }), 'Then')).not.toHaveText('Stop the workflow and tell someone');
});

test('UI-RULE-01 rule tasks and rule-only rounds are visible in Test', async ({ page }) => {
  await openFirst(page);
  await openTest(page, 'Senior cloud engineer');
  expect((await testCard(page, 'Business sign-off')).tasks).toEqual(['Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved']);
  await expectTestPanel(page, 'EN-015');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: WO, exact: true }).and(page.locator('[aria-haspopup="listbox"]')).click();
  await page.getByRole('option', { name: '+ New workflow' }).click();
  await expect(page.getByRole('banner').getByText('Draft', { exact: true })).toBeVisible();
  await (await plusAfter(page, 'T', 'next')).click();
  await panelOf(page).getByRole('button', { name: /^Notify Send an FYI/ }).click();
  const panel = panelOf(page);
  await panel.getByLabel('Name', { exact: true }).fill('Tell the supplier');
  await selectButton(panel, 'Who').click();
  await page.getByRole('listbox').getByRole('option', { name: 'Supplier account manager', exact: true }).click();
  await page.getByRole('listbox').getByRole('option', { name: 'Cost center owner', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(selectButton(panel, 'Who')).toHaveText('Supplier account manager');
  // EN-071's graph names the step RW; a step made on screen gets its id from the generator. 06 §1.5 compares what is on the screen, and ids are not.
  const withoutIds = (value: unknown): unknown => {
    const result = structuredClone(value) as { steps: { id?: string }[] };
    for (const step of result.steps) delete step.id;
    return result;
  };
  await expect
    .poll(async () => withoutIds(normDeep(await (await page.request.post('/api/flow-studio/workflows/nf101/simulate', { data: { recordId: 'WO-2214' } })).json())), { timeout: 8000 })
    .toStrictEqual(withoutIds(normDeep(expectedOf('EN-071'))));

  await openTest(page, 'Senior cloud engineer');
  const view = await readTestPanel(page);
  expect(view.summary).not.toBeNull();
  expect(view.ruleRounds).toEqual(["1 Information Security (Ravi Kumar), Privacy (Fatima Zahra) · Kenji Watanabe is out until Oct 30. Their delegate Mia Chen isn't eligible for Information Security decisions, so Ravi Kumar (backup) approves"]);
  expect(view.ruleTasks).toEqual(['Task: Record IR35 status · Tax (Mei Lin). Must be done before the request is approved']);
  // Above the step list (06 UI-RULE-01), under the title 03 §7.3 gives it.
  const above = await page.getByRole('dialog').evaluate((root) => {
    const rules = root.querySelector('section[aria-label="From approval rules"]') as Element;
    const steps = root.querySelector('ul[aria-label="Steps"]') as Element;
    return !!(rules.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING) && rules.querySelector('h3')?.textContent;
  });
  expect(above).toBe('From approval rules');
  await expectTestPanel(page, 'EN-071');
});

test('UI-BASIS-01 amount to compare for changes', async ({ page }) => {
  await openFirst(page);
  await openWorkflow(page, WO, 'SOW change order submitted');
  await openStep(page, 'SOW change order submitted');
  let panel = panelOf(page);
  const amount = selectButton(panel, 'Amount to compare for changes');
  await expect(amount).toHaveText('The running total of all changes');
  await amount.click();
  expect(await optionTexts(page)).toEqual(['The new total', 'The change amount', 'The running total of all changes']);
  await page.keyboard.press('Escape');
  await expect(panel.getByText('Value conditions in this flow use this amount. Running total stops many small changes adding up past a limit unseen.')).toBeVisible();

  await openWorkflow(page, 'SOW change order submitted', 'Job posting created');
  await openStep(page, 'Job posting created');
  panel = panelOf(page);
  await expect(selectButton(panel, 'Amount to compare for changes')).toHaveCount(0);
});

test.describe('04 §5: the step menu', () => {
  test('search filters, says when nothing matches, and the keyboard inserts', async ({ page }) => {
    await page.goto('/flow-studio/wf-ts-sub');
    await waitForCanvas(page);
    const plus = canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first();
    await plus.click();
    const menu = panelOf(page);
    const search = menu.getByRole('textbox', { name: 'Search' });
    await search.fill('zzz');
    await expect(menu.getByText('No steps match “zzz”.')).toBeVisible();
    await expect(menu.getByRole('heading', { level: 3 })).toHaveCount(0);

    await search.fill('budget');
    expect(await menu.getByRole('heading', { level: 3 }).allTextContents()).toEqual(['Approvals', 'Digital Workers']);

    await search.fill('task');
    await page.keyboard.press('Enter');
    await expect(panelOf(page).getByRole('heading', { name: 'Task', exact: true })).toBeVisible();
    await expect(panelOf(page).getByLabel('Name', { exact: true })).toHaveValue('New task');
  });

  test('Escape closes it and focus returns to the +', async ({ page }) => {
    await page.goto('/flow-studio/wf-ts-sub');
    await waitForCanvas(page);
    const plus = canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first();
    await plus.click();
    await expect(panelOf(page).getByRole('heading', { name: 'Add a step' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panelOf(page)).toHaveCount(0);
    await expect(plus).toBeFocused();
  });

  const onboardingMenu = [
    ['Identity & right to work', 'Checks ID and the right to work, by work country'],
    ['Background check', 'Criminal, credit and sanctions checks; adverse results go to the people set under "If it fails"'],
    ['Contract & policies', 'Sends the agreement and policies for e-signature'],
    ['Required training', 'Assigns mandatory courses and tracks completion'],
    ['Add to HR system', 'Creates the contingent worker in Workday'],
    ['Accounts & access', 'Creates logins and only the access the role needs'],
    ['Laptop & badge', 'Orders equipment and a building badge for day one'],
    ['Payroll & banking', 'Bank and tax details for payrolled workers'],
  ];
  const offboardingMenu = [
    ['Remove access', 'Removes every account and access given at onboarding, from the ledger'],
    ['Return equipment', 'Arranges returns for everything issued and chases until it is back'],
    ['Final timesheet & expenses', 'Gets the last time and expenses in before the work order closes'],
    ['Knowledge handover', 'A handover task for the hiring manager'],
    ['Exit confirmations', 'Reminds the worker of ongoing obligations and confirms company data is returned'],
    ['Close in HR system', 'Ends the contingent worker record in Workday'],
    ['Close the work order', 'Closes the work order in Fieldglass once the final invoice is in'],
    ['Ledger clear check', 'Confirms nothing given at onboarding is still open. Anything left is flagged as ghost access'],
  ];
  for (const [id, heading, rows] of [['wf-onboard', 'Onboarding steps', onboardingMenu], ['wf-offboard', 'Offboarding steps', offboardingMenu]] as const) {
    test(`${heading} come first in ${id}`, async ({ page }) => {
      await page.goto(`/flow-studio/${id}`);
      await waitForCanvas(page);
      await canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first().click();
      const menu = panelOf(page);
      await expect(menu.getByRole('heading', { level: 3 }).first()).toHaveText(heading);
      const read = await menu.locator('button[data-menu-index]').evaluateAll((buttons) => buttons.map((button) => Array.from(button.querySelectorAll(':scope > span:last-child > span')).map((part) => part.textContent ?? '')));
      expect(read.slice(0, 8).map((parts) => parts.map(norm))).toEqual(rows);
    });
  }
});

test.describe('04 §5, §7: every kind, inserted from the menu, with its defaults', () => {
  async function insert(page: Page, option: RegExp): Promise<Locator> {
    await page.goto('/flow-studio/wf-ts-sub');
    await waitForCanvas(page);
    await canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first().click();
    await panelOf(page).getByRole('button', { name: option }).click();
    const panel = panelOf(page);
    await expect(panel.getByRole('button', { name: 'Delete this step' })).toBeVisible();
    return panel;
  }

  test('Auto-approve (04 §7.4)', async ({ page }) => {
    const panel = await insert(page, /^Auto-approve/);
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('Auto-approve');
    await expect(panel.getByText('Approves instantly when no one was asked earlier on this path, and keeps a receipt for audit.')).toBeVisible();
    await expect(panel.getByLabel('Receipt')).toHaveValue('Approved automatically');
    await expect(selectButton(panel, 'Let someone know')).toHaveText('No one');
  });

  test('Fits plan? with its Outside plan step (04 §7.5)', async ({ page }) => {
    const panel = await insert(page, /^Fits plan\?/);
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('Fits plan?');
    await expect(selectButton(panel, 'Plan')).toHaveText('Cost center plan, this quarter');
    const outside = selectButton(panel, 'If outside the plan, send it to');
    await expect(outside).toHaveText('Cost center owner');
    await outside.click();
    expect(await optionTexts(page)).toEqual(['Cost center owner', 'Department head', "Hiring manager's manager", 'Finance business partner', 'VP Finance']);
    await page.getByRole('option', { name: 'VP Finance' }).click();
    expect(await boxText(page, 'Outside plan')).toBe('Outside plan | VP Finance');
    expect(norm((await panel.getByText(/^They approve or reject/).textContent()) ?? '')).toBe('They approve or reject before the request continues. A rejection follows that step\'s "If rejected" setting.');
  });

  test('Collect & verify, generic (04 §7.8)', async ({ page }) => {
    const panel = await insert(page, /^Collect & verify/);
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('New requirement');
    await expect(selectButton(panel, 'Who provides it')).toHaveText('Worker');
    await expect(spin(panel, 'Remind after (hours)')).toHaveValue('48');
    await expect(spin(panel, 'Then escalate to the hiring manager after (hours)')).toHaveValue('96');
    await expect(selectButton(panel, 'What’s required')).toHaveText('Choose or type to add');
    await expect(selectButton(panel, 'How it’s verified')).toHaveText('A person reviews');
    await expect(selectButton(panel, 'Checked by')).toHaveCount(0);
    await expect(selectButton(panel, 'Reviewer')).toHaveText('People Ops');

    await choose(panel, 'How it’s verified', 'Automatically');
    await expect(selectButton(panel, 'Reviewer')).toHaveCount(0);
    await selectButton(panel, 'Checked by').click();
    expect(await optionTexts(page)).toEqual(['Persona', 'Checkr', 'E-signature', 'Workday', 'ServiceNow', 'Document collector (Digital Worker)', 'Access provisioner (Digital Worker)', 'Onfido', 'Yoti']);
    await page.keyboard.press('Escape');

    await expect(selectButton(panel, 'If it fails')).toHaveText('Escalate: someone must decide');
    await expect(spin(panel, 'Escalate after (hours)')).toHaveValue('48');
    expect(await boxText(page, 'New requirement failed: escalation')).toBe('New requirement failed: escalation | People Ops');
  });

  test('Gives the worker something (04 §6.4)', async ({ page }) => {
    const panel = await insert(page, /^Task/);
    await expect(panel.getByText('What it gives')).toHaveCount(0);
    const toggle = panel.getByRole('switch', { name: 'Gives the worker something' });
    await toggle.click();
    await panel.getByLabel('What it gives').fill('VPN access');
    await expect(selectButton(panel, 'At exit')).toHaveText('Remove access');
    await expect(selectButton(panel, 'When')).toHaveText('On the last day');
    await expect(selectButton(panel, 'Done by')).toHaveText('Hiring manager');
    await panel.getByLabel('Exit step').fill('Remove VPN access');
    const id = 'wf-ts-sub';
    await expectSaved(page, id, (workflow) => Object.values(workflow.draft.nodes as Record<string, { gives?: string; reverse?: string }>).find((node) => node.gives === 'VPN access')?.reverse, 'Remove VPN access');

    await toggle.click();
    await expect(panel.getByLabel('What it gives')).toHaveCount(0);
    await expectSaved(page, id, (workflow) => Object.values(workflow.draft.nodes as Record<string, { gives?: string }>).some((node) => node.gives === 'VPN access'), false);
  });

  test('Task (04 §7.10)', async ({ page }) => {
    const panel = await insert(page, /^Task/);
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('New task');
    await expect(selectButton(panel, 'Who')).toHaveText('Procurement');
    await expect(panel.getByLabel('What they do')).toHaveValue('Enter the PO number');
    await expect(spin(panel, 'Remind after (hours)')).toHaveValue('48');
    await expect(spin(panel, 'Then escalate to their manager after (hours)')).toHaveValue('96');
    await expect(panel.getByRole('switch', { name: 'Gives the worker something' })).toHaveAttribute('aria-checked', 'false');
  });

  test('System: defaults, each action and each connection state (04 §7.11)', async ({ page }) => {
    const panel = await insert(page, /^System/);
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('System step');
    await expect(selectButton(panel, 'System')).toHaveText('Workday');
    await expect(panel.getByText('Connected · last checked 2 min ago')).toBeVisible();
    await expect(selectButton(panel, 'Action')).toHaveText('Create');
    await expect(selectButton(panel, 'What')).toHaveText('Contingent worker');
    await expect(panel.getByText('Fields sent to Workday')).toBeVisible();
    expect(norm((await panel.getByText(/^Nova matched/).textContent()) ?? '')).toBe("Nova matched these automatically from Workday's contingent worker fields. Check them once.");

    const rows = await panel.getByRole('textbox', { name: 'Workday field' }).evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect(rows).toEqual(['Legal name', 'Work email', 'Contract start date', 'Contract end date', 'Manager', 'Cost center', 'Supplier']);
    const levv = selectButton(panel, 'Levv field');
    await expect(levv.first()).toHaveText('Worker name');
    await panel.getByRole('button', { name: '+ Add a field' }).click();
    await expect(levv.last()).toHaveText('Job title');
    await expect(panel.getByRole('textbox', { name: 'Workday field' }).last()).toHaveValue('');
    await panel.getByRole('button', { name: 'Remove', exact: true }).last().click();

    await selectButton(panel, 'Find the existing record by').click();
    expect(await optionTexts(page)).toEqual(['Work email', 'Workday worker ID', 'Levv worker ID']);
    await page.keyboard.press('Escape');

    await selectButton(panel, 'Bring back to Levv').click();
    expect(await optionTexts(page)).toEqual(['Workday worker ID', 'Hire status']);
    await page.keyboard.press('Escape');
    await expect(selectButton(panel, 'After sending')).toHaveText('Wait until Workday confirms it’s done');
    await expect(spin(panel, 'Give up after (hours)')).toHaveValue('24');
    await expect(selectButton(panel, 'Who fixes it')).toHaveText('People Ops');
    await expect(selectButton(panel, 'Done by').first()).toHaveText('Levv connection');

    await choose(panel, 'Action', 'Wait for');
    await expect(selectButton(panel, 'Wait until it’s')).toHaveText('Completed');
    await expect(panel.getByText('Levv listens for Workday to report it. If nothing comes in 24 hours, the failure setting below applies.')).toBeVisible();
    await expect(selectButton(panel, 'Bring back to Levv')).toHaveCount(0);
    await expect(panel.getByText('Fields sent to Workday')).toHaveCount(0);

    await choose(panel, 'Action', 'Check it matches the ledger');
    await expect(selectButton(panel, 'What')).toHaveCount(0);
    expect(norm((await panel.getByText(/^Compares what/).textContent()) ?? '')).toBe("Compares what Workday has for this worker with Levv's ledger. Anything Workday has that the ledger doesn't is flagged as ghost access.");

    await choose(panel, 'Action', 'Read');
    await expect(selectButton(panel, 'After sending')).toHaveCount(0);
    await expect(selectButton(panel, 'Bring back to Levv')).toBeVisible();

    await choose(panel, 'Action', 'Close or deactivate');
    await choose(panel, 'System', 'Coupa');
    expect(norm((await panel.getByText(/isn.t connected yet/).textContent()) ?? '')).toBe("Coupa isn't connected yet. Until then this step pauses and gives the work to a person.");
    await expect(selectButton(panel, 'Action')).toHaveText('Close or deactivate');
    await expect(selectButton(panel, 'What')).toHaveText('Requisition');

    await choose(panel, 'Action', 'Create');
    await choose(panel, 'System', 'Badge system');
    await selectButton(panel, 'Find the existing record by').click();
    expect(await optionTexts(page)).toEqual(['Personal email', 'Badge number', 'Work email', 'Levv worker ID']);
    await page.keyboard.press('Escape');
    await expect(panel.getByRole('switch', { name: 'Gives the worker something' })).toBeVisible();
    await panel.getByRole('switch', { name: 'Gives the worker something' }).click();
    await expect(panel.getByText('Done automatically in Badge system, then read back to confirm')).toBeVisible();
  });

  test('Notify (04 §7.12)', async ({ page }) => {
    const panel = await insert(page, /^Notify/);
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('Notify');
    await expect(selectButton(panel, 'Who')).toHaveText('Cost center owner');
    await expect(selectButton(panel, 'How')).toHaveText('Email');
    await selectButton(panel, 'How').click();
    expect(await optionTexts(page)).toEqual(['Email', 'Teams', 'Slack', 'In-app']);
    await page.keyboard.press('Escape');
    await selectButton(panel, 'Who').click();
    expect((await optionTexts(page))[0]).toBe('Worker');
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');
    await expect(selectButton(panel, 'Who')).toHaveText('Choose who to tell');
    await expect.poll(async () => (await lintIssues(page, 'wf-ts-sub')).map((issue) => norm(issue.m)), { timeout: 8000 }).toContain('"Notify" doesn\'t tell anyone yet.');
  });

  test('Wait: every mode and its sentence (04 §7.13)', async ({ page }) => {
    const panel = await insert(page, /^Wait/);
    const say = () => panel.getByText(/^(Waits|Pick a date)/);
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('Wait');
    await expect(selectButton(panel, 'Wait')).toHaveText('Until a date on the record');
    await expect(spin(panel, 'Offset')).toHaveValue('5');
    await expect(selectButton(panel, 'Unit')).toHaveText('working days');
    expect(norm((await say().textContent()) ?? '')).toBe("Waits until 5 working days before start date, 09:00 in the worker's time zone. If the date on the record changes, the wait moves with it.");
    await selectButton(panel, 'Unit').click();
    expect(await optionTexts(page)).toEqual(['days', 'working days', 'weeks']);
    await page.keyboard.press('Escape');

    await choose(panel, 'Time zone', 'Company (head office)');
    expect(norm((await say().textContent()) ?? '')).toBe('Waits until 5 working days before start date, 09:00 company time. If the date on the record changes, the wait moves with it.');

    await choose(panel, 'Wait', 'For a set time');
    await selectButton(panel, 'Unit').click();
    expect(await optionTexts(page)).toEqual(['hours', 'days', 'working days', 'weeks']);
    await page.getByRole('option', { name: 'hours' }).click();
    await spin(panel, 'How long').fill('3');
    expect(norm((await say().textContent()) ?? '')).toBe('Waits 3 hours.');

    // 04 §7.13 item 4: into date mode, hours become days.
    await choose(panel, 'Wait', 'Until a date on the record');
    await expect(selectButton(panel, 'Unit')).toHaveText('days');

    await choose(panel, 'Wait', 'Until a specific date and time');
    expect(norm((await say().textContent()) ?? '')).toBe('Pick a date and time.');
    await panel.getByLabel('Date and time').fill('2026-11-02T14:30');
    expect(norm((await say().textContent()) ?? '')).toBe('Waits until 2026-11-02 at 14:30.');
    await expectSaved(page, 'wf-ts-sub', (workflow) => Object.values(workflow.draft.nodes as Record<string, { w?: { at?: string } }>).find((node) => node.w)?.w?.at, '2026-11-02T14:30');
  });

  test('Parallel, branches and "+ Add a step after all branches finish" (04 §7.14)', async ({ page }) => {
    const panel = await insert(page, /^Parallel/);
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('Run together');
    const names = panel.getByRole('textbox', { name: 'Branch name' });
    await expect(names).toHaveCount(2);
    await expect(names.first()).toHaveValue('Branch 1');
    await expect(panel.getByRole('button', { name: 'Remove branch' })).toHaveCount(0);
    await panel.getByRole('button', { name: '+ Add a branch' }).click();
    await expect(names).toHaveCount(3);
    await expect(names.last()).toHaveValue('Branch 3');
    await expect(panel.getByRole('button', { name: 'Remove branch' })).toHaveCount(3);
    await names.first().fill('Identity');
    expect(await boxText(page, 'Run together')).toContain('Identity');
    await panel.getByRole('button', { name: 'Remove branch' }).last().click();
    await expect(names).toHaveCount(2);

    await panel.getByRole('button', { name: '+ Add a step after all branches finish' }).click();
    await panelOf(page).getByRole('button', { name: /^Notify/ }).click();
    await expect(toastOf(page)).toHaveText('Added after all branches finish');
    await expect(panelOf(page).getByRole('heading', { name: 'Notify', exact: true })).toBeVisible();
  });

  test('Run workflow lists every other workflow, grouped (04 §7.15)', async ({ page }) => {
    const panel = await insert(page, /^Run workflow/);
    const target = selectButton(panel, 'Workflow');
    await expect(target).toHaveText('Assignment ending');
    await target.click();
    const options = await optionTexts(page);
    expect(options).toHaveLength(14);
    expect(options).not.toContain('Timesheet submitted');
    await expect(page.getByRole('listbox').locator('[role="presentation"]').first()).toHaveText('Job posting · Created');
    await page.keyboard.press('Escape');
  });

  test('End has an Outcome and no Delete (04 §7.16)', async ({ page }) => {
    await page.goto('/flow-studio/wf-ts-sub');
    await waitForCanvas(page);
    await openStep(page, 'End');
    const panel = panelOf(page);
    await expect(panel.getByRole('heading', { name: 'End', exact: true })).toBeVisible();
    await expect(panel.getByLabel('Name', { exact: true })).toHaveAttribute('placeholder', 'End');
    await selectButton(panel, 'Outcome').click();
    expect(await optionTexts(page)).toEqual(['Approved', 'Completed', 'Rejected', 'Cancelled', 'Stopped']);
    await page.getByRole('option', { name: 'Rejected' }).click();
    await expect(canvasOf(page).getByRole('button', { name: 'End', exact: true }).locator('svg')).toHaveCSS('color', 'rgb(251, 113, 133)');
    await expect(panel.getByRole('button', { name: 'Delete this step' })).toHaveCount(0);
  });

  test('Digital Worker check: flag options, generated steps and the rename (04 §7.6)', async ({ page }) => {
    const panel = await insert(page, /^Budget check/);
    await expect(panel.getByRole('heading', { name: 'Digital Worker', exact: true })).toBeVisible();
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('Budget check');
    await expect(panel.getByText('Checks how much budget is left on the cost center, plan or contract after this request. It never approves or rejects.')).toBeVisible();
    const flag = selectButton(panel, 'If it flags something');
    await expect(flag).toHaveText('Carry on: the flag is recorded');
    await flag.click();
    expect(await optionTexts(page)).toEqual(['Carry on: the flag is recorded', 'Escalate: someone must decide', 'Reject it and send it back to the requester', 'Stop the workflow and tell someone']);
    await page.keyboard.press('Escape');
    expect(norm((await panel.getByText(/^If it passes/).textContent()) ?? '')).toBe("If it passes, it carries on. Either way, the result goes into every approver's brief.");

    await choose(panel, 'If it flags something', 'Escalate: someone must decide');
    await expect(selectButton(panel, 'Escalate to')).toHaveText('Procurement');
    await expect(spin(panel, 'Escalate after (hours)')).toHaveValue('48');
    expect(await boxText(page, 'Budget flagged: escalation')).toBe('Budget flagged: escalation | Procurement');
    expect(await boxText(page, 'Budget check')).toContain('If flagged: escalate to Procurement');

    await choose(panel, 'Digital Worker', 'Rate check');
    await expect(panel.getByLabel('Name', { exact: true })).toHaveValue('Rate check');
    expect(await boxText(page, 'Rate flagged: escalation')).toBe('Rate flagged: escalation | Procurement');

    await choose(panel, 'If it flags something', 'Stop the workflow and tell someone');
    expect(await boxText(page, 'Tell them it stopped')).toContain('Tell them it stopped');
    await choose(panel, 'If it flags something', 'Reject it and send it back to the requester');
    expect(await boxText(page, 'Rejected')).toBe('Rejected | Rejected');
    await choose(panel, 'If it flags something', 'Carry on: the flag is recorded');
    expect(await boxText(page, 'Rejected')).toBe('');
  });

  test('Digital Worker helper, with the needs-setup line (04 §7.7)', async ({ page }) => {
    const panel = await insert(page, /^Invoice match/);
    await selectButton(panel, 'Digital Worker').click();
    expect(await optionTexts(page)).toEqual(['Job posting writer', 'Invoice match']);
    await page.keyboard.press('Escape');
    expect(norm((await panel.getByText(/^Matches each invoice line/).textContent()) ?? '')).toBe("Matches each invoice line to approved time, expenses and milestones, and holds anything that doesn't match. It never approves or rejects.");
    await expect(panel.getByText(/^Needs a connection first\. Until then this step gives the work to /)).toBeVisible();
    await expect(selectButton(panel, 'If it isn’t sure, hand to')).toBeVisible();
    await choose(panel, 'Digital Worker', 'Job posting writer');
    await expect(panel.getByText(/^Needs a connection first/)).toHaveCount(0);
  });
});

test.describe('04 §7.1: Workflow settings', () => {
  test('explainers, prerequisites and the days field follow Runs when', async ({ page }) => {
    await page.goto('/flow-studio/wf-wo-sub');
    await waitForCanvas(page);
    await openStep(page, 'Work order submitted');
    const panel = panelOf(page);
    await expect(panel.getByText('When the work order is approved, here or in SAP Fieldglass, Contractor onboarding starts by itself.')).toBeVisible();

    await choose(panel, 'Runs when', 'Work order approved');
    await expect(panel.getByText(/What starts this: an Approve step in “/)).toBeVisible();
    expect(norm((await panel.getByText(/^Built in:/).textContent()) ?? '')).toBe('Built in: Levv only starts this once the work order is approved. Anything that arrives earlier waits, and the owner is told if it waits more than 7 days.');
    await expect(panel.getByText('Request approval')).toHaveCount(0);

    await choose(panel, 'Starts from', 'SAP Fieldglass (Levv picks up from here)');
    await expect(panel.getByText('What starts this: the work order is approved in SAP Fieldglass, not in Levv.')).toBeVisible();
    await expect(panel.getByText('This flow starts when SAP Fieldglass tells Levv the work order is approved. Use a System step to send results back.')).toBeVisible();
    expect(await boxText(page, 'Work order approved in SAP Fieldglass')).toContain('Work order approved in SAP Fieldglass');

    await choose(panel, 'Runs when', 'Assignment end date in N days');
    await expect(spin(panel, 'How many days before')).toHaveValue('30');
    await spin(panel, 'How many days before').fill('45');
    await expect(selectButton(panel, 'Runs when')).toHaveText('Assignment end date in 45 days');

    await choose(panel, 'Runs when', 'Offboarding starts');
    await expect(spin(panel, 'Days before the end date')).toHaveValue('14');
    await expect(selectButton(panel, 'Starts from')).toHaveCount(0);
    await expect(panel.getByText('· the end date is 14 days away and it isn’t being extended')).toBeVisible();
    await expect(panel.getByText('If it ends early, access is removed straight away instead of on the last day.')).toBeVisible();
    await expect(panel.getByText(/^Built in: Levv only starts this once the assignment has started/)).toBeVisible();

    await choose(panel, 'Runs when', 'Onboarding starts');
    await expect(panel.getByText(/^Starts by itself/)).toBeVisible();
    expect(norm((await panel.getByText(/^Work orders are approved/).textContent()) ?? '')).toMatch(/^Work orders are approved in Levv by "/);
    await expect(panel.getByText(/^Built in:/)).toHaveCount(0);
  });

  test('the name updates the picker live; Runs when moves the picker group', async ({ page }) => {
    await page.goto('/flow-studio/wf-jp');
    await waitForCanvas(page);
    await openStep(page, 'Job posting created');
    const panel = panelOf(page);
    await panel.getByLabel('Name', { exact: true }).fill('Renamed posting');
    const picker = page.getByRole('banner').locator('[aria-haspopup="listbox"]');
    await expect(picker).toHaveText('Renamed posting');
    await picker.click();
    await expect(page.getByRole('option', { name: /^Renamed posting/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expectSaved(page, 'wf-jp', (workflow) => workflow.name, 'Renamed posting');
  });

  test('the Active switch works now, with its text, toast and warning (04 §11)', async ({ page }) => {
    await page.goto('/flow-studio/wf-jp');
    await waitForCanvas(page);
    await openStep(page, 'Job posting created');
    const panel = panelOf(page);
    const active = panel.getByRole('switch', { name: 'Active' });
    await expect(active).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByText('New events start this workflow.')).toBeVisible();
    await active.click();
    await expect(active).toHaveAttribute('aria-checked', 'false');
    await expect(toastOf(page)).toHaveText('“Job posting created” is inactive. It can’t be deleted, only turned back on');
    await expect(panel.getByText('Nothing new uses this workflow. Anything already running finishes on it. Turn it back on any time.')).toBeVisible();
    await expect(page.getByRole('banner').getByText('Inactive · v1')).toBeVisible();
    await active.click();
    await expect(toastOf(page)).toHaveText('“Job posting created” is active again');
    await expectSaved(page, 'wf-jp', (workflow) => workflow.status, 'live');
  });
});

test.describe('04 §7.9: preset boxes', () => {
  const steps: [string, string, string, string[]][] = [
    ['wf-onboard', 'Identity & eligibility', 'Right-to-work rules by work country', ['Passport, or a Home Office share code', 'Form I-9, checked with E-Verify', 'Check again when a visa or permit expires']],
    ['wf-onboard', 'Background check', 'Background check', ['Use the Financial services package for regulated roles']],
    ['wf-offboard', 'Knowledge handover', 'Knowledge handover', ['A handover task for the hiring manager.']],
    ['wf-offboard', 'Final timesheet & expenses', 'Final time and expenses', ['Must be in before the work order closes.']],
    ['wf-offboard', 'Exit confirmations', 'Ongoing obligations', ['Confidentiality continues after the last day; the worker acknowledges it.']],
    ['wf-offboard', 'Close in HR system', 'Close in HR system', ['Ends the contingent worker record in Workday.']],
    ['wf-offboard', 'Close the work order', 'Close the work order', ['Closes the work order in Fieldglass once the final invoice is in.']],
    ['wf-offboard', 'Ledger clear check', 'Ledger clear check', ['Looks across every connected system']],
    ['wf-offboard', 'Remove access', 'What gets removed (from the ledger)', ['Workday account: ', 'System access: ']],
    ['wf-offboard', 'Return equipment', 'What comes back', ['Laptop and badge', 'Then the supplier is told and it’s noted against the final invoice.']],
  ];
  for (const [id, step, title, lines] of steps) {
    test(`${step}: “${title}”`, async ({ page }) => {
      await page.goto(`/flow-studio/${id}`);
      await waitForCanvas(page);
      await openStep(page, step);
      const panel = panelOf(page);
      await expect(panel.getByText(title, { exact: true }).last()).toBeVisible();
      for (const line of lines) await expect(panel.getByText(line).first()).toBeVisible();
    });
  }

  test('Laptop & badge: Equipment changes What it gives', async ({ page }) => {
    await page.goto('/flow-studio/wf-onboard');
    await waitForCanvas(page);
    await openStep(page, 'Laptop and badge');
    const panel = panelOf(page);
    await expect(panel.getByRole('switch', { name: 'Gives the worker something' })).toHaveAttribute('aria-checked', 'true');
    await selectButton(panel, 'Equipment').click();
    await page.getByRole('listbox').getByRole('option', { name: 'Phone' }).click();
    await page.keyboard.press('Escape');
    await expect(panel.getByLabel('What it gives')).toHaveValue('Laptop and Building badge and Phone');
    await expect(selectButton(panel, 'Ship to')).toHaveText('Worker’s home');
  });

  test('Contract & policies: documents and What’s required edit one list', async ({ page }) => {
    await page.goto('/flow-studio/wf-onboard');
    await waitForCanvas(page);
    await openStep(page, 'Legal & compliance');
    const panel = panelOf(page);
    const documents = selectButton(panel, 'Documents to sign');
    await documents.click();
    await page.getByRole('listbox').getByRole('option', { name: 'IP assignment' }).click();
    await page.keyboard.press('Escape');
    await selectButton(panel, 'What’s required').click();
    await expect(page.getByRole('listbox').getByRole('option', { name: 'IP assignment' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
  });

  test('a new Required training step reads its defaults', async ({ page }) => {
    await page.goto('/flow-studio/wf-onboard');
    await waitForCanvas(page);
    await canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first().click();
    await panelOf(page).getByRole('button', { name: /^Required training/ }).click();
    const panel = panelOf(page);
    await expect(selectButton(panel, 'Courses')).toHaveText('Information security, Data protection +1');
    await expect(selectButton(panel, 'Due')).toHaveText('Before the start date');
    await expect(selectButton(panel, 'Checked by')).toHaveText('Workday');
  });
});

test.describe('04 §6.6: Delete this step and Undo', () => {
  test('Undo puts back the exact graph and saves it', async ({ page }) => {
    await openFirst(page);
    const seed = JSON.stringify((await (await page.request.get('/api/flow-studio/workflows/wf-wo-sub')).json() as { workflow: { draft: unknown } }).workflow.draft);
    await openStep(page, 'Rate over card?');
    await panelOf(page).getByRole('button', { name: 'Delete this step' }).click();
    const toast = toastOf(page);
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(toast).toHaveCount(0);
    expect(await boxText(page, 'Rate over card?')).toContain('Rate over card?');
    await expect(page.getByRole('banner').getByText('Live v1', { exact: true })).toBeVisible();
    await expect.poll(async () => JSON.stringify((await (await page.request.get('/api/flow-studio/workflows/wf-wo-sub')).json() as { workflow: { draft: unknown } }).workflow.draft), { timeout: 8000 }).toBe(seed);
  });

  test('the next edit takes the Undo link away', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Budget check');
    await panelOf(page).getByRole('button', { name: 'Delete this step' }).click();
    await expect(toastOf(page).getByRole('button', { name: 'Undo' })).toBeVisible();
    await openStep(page, 'Business sign-off');
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Sign-off');
    await expect(toastOf(page).getByRole('button', { name: 'Undo' })).toHaveCount(0);
  });

  test('the link lasts 10 s', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Budget check');
    await panelOf(page).getByRole('button', { name: 'Delete this step' }).click();
    const undo = toastOf(page).getByRole('button', { name: 'Undo' });
    await expect(undo).toBeVisible();
    await page.waitForTimeout(5000);
    await expect(undo).toBeVisible();
    await expect(undo).toHaveCount(0, { timeout: 7000 });
  });

  test('deleting a generated step leaves its owner reading as what the line now does', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Duplicate found: escalation');
    await panelOf(page).getByRole('button', { name: 'Delete this step' }).click();
    expect(await boxText(page, 'Duplicate & ghost worker')).toContain('If flagged: approvers see it');
    await openStep(page, 'Duplicate & ghost worker');
    await expect(selectButton(panelOf(page), 'If it flags something')).toHaveText('Carry on: the flag is recorded');
  });
});

test.describe('04 §5, §4.10: the rail places and drags', () => {
  test('click to place inserts on a “+” and opens the panel', async ({ page }) => {
    await page.goto('/flow-studio/wf-ts-sub');
    await waitForCanvas(page);
    const rail = page.getByRole('complementary', { name: 'Digital Workers' });
    await rail.getByRole('button', { name: 'Rate check' }).click();
    await expect(page.getByText('Click a + to place Rate check', { exact: true })).toBeVisible();
    await canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first().click();
    await expect(panelOf(page).getByRole('heading', { name: 'Digital Worker', exact: true })).toBeVisible();
    await expect(panelOf(page).getByLabel('Name', { exact: true })).toHaveValue('Rate check');
    await expect(page.getByText(/Click a \+ to place/)).toHaveCount(0);
    await expect(rail.getByRole('button', { name: 'Rate check' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('placing on a Collect & verify makes it the checker; a person review switches', async ({ page }) => {
    await page.goto('/flow-studio/wf-onboard');
    await waitForCanvas(page);
    await page.getByRole('complementary', { name: 'Digital Workers' }).getByRole('button', { name: 'Document collector' }).click();
    await openStep(page, 'Identity & eligibility');
    await expect(toastOf(page)).toHaveText('Document collector now verifies “Identity & eligibility”');
    await expectSaved(page, 'wf-onboard', (workflow) => workflow.draft.nodes.ID.checker, 'dw:docs');
  });

  test('placing on a System makes it the doer', async ({ page }) => {
    await page.goto('/flow-studio/wf-onboard');
    await waitForCanvas(page);
    await page.getByRole('complementary', { name: 'Digital Workers' }).getByRole('button', { name: 'Access provisioner' }).click();
    await openStep(page, 'Workday provisioning');
    await expect(toastOf(page)).toHaveText('Access provisioner now does “Workday provisioning”');
    await expectSaved(page, 'wf-onboard', (workflow) => workflow.draft.nodes.WD.via, 'access');
  });

  test('a check placed on an Approve step is refused', async ({ page }) => {
    await openFirst(page);
    await page.getByRole('complementary', { name: 'Digital Workers' }).getByRole('button', { name: 'Rate check' }).click();
    await openStep(page, 'Business sign-off');
    await expect(toastOf(page)).toHaveText('Checks go on the line before an approver: drop it on a +');
    await expect(panelOf(page)).toHaveCount(0);
  });

  test('dragging onto a “+” inserts; the placing style shows while dragging', async ({ page }) => {
    await page.goto('/flow-studio/wf-ts-sub');
    await waitForCanvas(page);
    const worker = page.getByRole('complementary', { name: 'Digital Workers' }).getByRole('button', { name: 'Budget check' });
    const plus = canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first();
    await worker.dragTo(plus);
    await expect(panelOf(page).getByLabel('Name', { exact: true })).toHaveValue('Budget check');
    await expect(page.getByText(/Click a \+ to place/)).toHaveCount(0);
    await expectSaved(page, 'wf-ts-sub', (workflow) => Object.values(workflow.draft.nodes as Record<string, { worker?: string }>).some((node) => node.worker === 'budget'), true);
  });

  test('dragging onto an eligible step attaches, and a check onto Approve is refused', async ({ page }) => {
    await page.goto('/flow-studio/wf-onboard');
    await waitForCanvas(page);
    const rail = page.getByRole('complementary', { name: 'Digital Workers' });
    await rail.getByRole('button', { name: 'Document collector' }).dragTo(canvasOf(page).getByRole('button', { name: 'Identity & eligibility', exact: true }));
    await expect(toastOf(page)).toHaveText('Document collector now verifies “Identity & eligibility”');

    await page.goto('/flow-studio/wf-wo-sub');
    await waitForCanvas(page);
    await page.getByRole('complementary', { name: 'Digital Workers' }).getByRole('button', { name: 'Rate check' }).dragTo(canvasOf(page).getByRole('button', { name: 'Business sign-off', exact: true }));
    await expect(toastOf(page)).toHaveText('Checks go on the line before an approver: drop it on a +');
  });
});

test.describe('01 §3.2: autosave', () => {
  const PUT = (url: string): boolean => url.includes('/draft');

  test('debounced: several edits, one save, and it survives a reload', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Business sign-off');
    let saves = 0;
    page.on('request', (request) => {
      if (PUT(request.url()) && request.method() === 'PUT') saves += 1;
    });
    const name = panelOf(page).getByLabel('Name', { exact: true });
    await name.click();
    await page.keyboard.press('End');
    await page.keyboard.type('!!!', { delay: 30 });
    await expect(name).toHaveValue('Business sign-off!!!');
    await expect(canvasOf(page).getByRole('button', { name: 'Business sign-off!!!', exact: true })).toBeVisible();
    await expect(panelOf(page).getByText('Business sign-off!!!', { exact: true })).toBeVisible();
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.label, 'Business sign-off!!!');
    expect(saves).toBe(1);
    await page.reload();
    await waitForCanvas(page);
    await expect(canvasOf(page).getByRole('button', { name: 'Business sign-off!!!', exact: true })).toBeVisible();
    await expect(page.getByRole('banner').getByText('Live v1 · unpublished changes')).toBeVisible();
  });

  test('reloading straight after an edit does not lose it', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Business sign-off');
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Quick edit');
    await page.reload();
    await waitForCanvas(page);
    await expect(canvasOf(page).getByRole('button', { name: 'Quick edit', exact: true })).toBeVisible();
  });

  /** The first save reaches the server, and its answer is held back, so the page still has a save running. */
  const holdFirstSave = async (page: Page): Promise<{ landed: Promise<void>; release: () => void }> => {
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
    return { landed, release };
  };

  test('reloading while a save is running keeps the edit made after it', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Business sign-off');
    const { landed, release } = await holdFirstSave(page);
    const name = panelOf(page).getByLabel('Name', { exact: true });
    await name.fill('First edit');
    await landed;
    await name.fill('Last edit');
    await page.reload();
    release();
    await waitForCanvas(page);
    await expect(canvasOf(page).getByRole('button', { name: 'Last edit', exact: true })).toBeVisible();
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.label, 'Last edit');
  });

  test('leaving for another page while a save is running keeps the edit made after it', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Business sign-off');
    const { landed, release } = await holdFirstSave(page);
    const name = panelOf(page).getByLabel('Name', { exact: true });
    await name.fill('First edit');
    await landed;
    await name.fill('Last edit');
    await page.getByRole('link', { name: 'levv.' }).click();
    await page.waitForURL('**/home');
    release();
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.label, 'Last edit');
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('unsaved')))).toEqual([]);
  });

  /** A request that cannot leave the browser at all: offline, or too big for a keepalive. */
  const cutOffSaves = async (page: Page): Promise<void> => {
    await page.evaluate(() => {
      const real = window.fetch;
      window.fetch = (input, init) => (String(input).endsWith('/draft') ? Promise.reject(new TypeError('Failed to fetch')) : real(input, init));
    });
  };

  test('a save that never gets out at unload is sent by the next load', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Business sign-off');
    await cutOffSaves(page);
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Never got out');
    const before = (await savedWorkflow(page, 'wf-wo-sub')).workflow.draft.nodes.RA_A1.label;
    await page.reload();
    expect(before).toBe('Business sign-off');
    await waitForCanvas(page);
    await expect(canvasOf(page).getByRole('button', { name: 'Never got out', exact: true })).toBeVisible();
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.label, 'Never got out');
  });

  test('when someone else saved first, the next load says the last edit was not saved', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Business sign-off');
    await cutOffSaves(page);
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Mine, never got out');
    const saved = await savedWorkflow(page, 'wf-wo-sub');
    saved.workflow.draft.nodes.RA_A1.label = 'Someone else';
    expect((await page.request.put('/api/flow-studio/workflows/wf-wo-sub/draft', { data: { draft: saved.workflow, draftRev: saved.draftRev } })).status()).toBe(200);
    await page.reload();
    await waitForCanvas(page);
    await expect(toastOf(page)).toHaveText('Your last change to this workflow wasn’t saved, because someone else changed it first. Check it and make your change again.');
    // Long enough to read: past the 2.8 s of an ordinary toast.
    await page.waitForTimeout(3200);
    await expect(toastOf(page)).toBeVisible();
    await expect(canvasOf(page).getByRole('button', { name: 'Someone else', exact: true })).toBeVisible();
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.label, 'Someone else');
    await page.reload();
    await waitForCanvas(page);
    await expect(toastOf(page)).toHaveCount(0);
  });

  test('moving to another workflow saves what was waiting', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Business sign-off');
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Moved on');
    await openWorkflow(page, WO, 'Job posting created');
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.label, 'Moved on');
  });

  test('a stale draftRev shows the conflict toast and overwrites nothing', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Business sign-off');
    const saved = (await (await page.request.get('/api/flow-studio/workflows/wf-wo-sub')).json()) as { workflow: { draft: { nodes: Record<string, { label: string }> } }; draftRev: number };
    saved.workflow.draft.nodes.RA_A1.label = 'Someone else';
    expect((await page.request.put('/api/flow-studio/workflows/wf-wo-sub/draft', { data: { draft: saved.workflow, draftRev: saved.draftRev } })).status()).toBe(200);

    await panelOf(page).getByLabel('Name', { exact: true }).fill('Mine');
    await expect(toastOf(page)).toHaveText('This workflow changed since you opened it. Reload to see the latest.');
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.label, 'Someone else');

    await panelOf(page).getByLabel('Name', { exact: true }).fill('Mine again');
    await expect(toastOf(page)).toHaveText('This workflow changed since you opened it. Reload to see the latest.');
    await page.reload();
    await waitForCanvas(page);
    await expect(canvasOf(page).getByRole('button', { name: 'Someone else', exact: true })).toBeVisible();
  });

  test('a failed save says so, and the next edit saves everything', async ({ page }) => {
    await openFirst(page);
    await openStep(page, 'Business sign-off');
    await page.route('**/api/flow-studio/workflows/*/draft', (route) => route.abort());
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Offline');
    await expect(toastOf(page)).toHaveText('Couldn’t save that change. Check your connection and try again.');
    await page.unroute('**/api/flow-studio/workflows/*/draft');
    await panelOf(page).getByLabel('Name', { exact: true }).fill('Back online');
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.label, 'Back online');
  });
});

test.describe('04 §7.3: Only needed when', () => {
  test('✦ Set reads the words, the rows can be edited, and Always ask clears them', async ({ page }) => {
    await page.goto('/flow-studio/wf-wo-sub');
    await waitForCanvas(page);
    await openStep(page, 'Business sign-off');
    const panel = panelOf(page);
    await openDetails(panel);
    const input = panel.getByRole('textbox', { name: 'Only needed when' });
    await expect(input).toHaveAttribute('placeholder', 'e.g. the bill rate goes up more than 5%, or the work country is UK');

    await panel.getByRole('button', { name: '✦ Set' }).click();
    await expect(toastOf(page)).toHaveText('Say when this approver is needed');

    await input.fill('flibbertigibbet');
    await input.press('Enter');
    expect(norm((await panel.getByText(/^I couldn.t match/).textContent()) ?? '')).toBe('I couldn\'t match that to a field. Try naming the field and value, e.g. "work country is Canada" or "total value over $250K".');

    await input.fill('rate is more than 15% over the rate card');
    await panel.getByRole('button', { name: '✦ Set' }).click();
    await expect(panel.getByText('Read as: asked only if Rate vs rate card (%) > 15%. Check it below, then Test.')).toBeVisible();
    await expect(selectButton(panel, 'Field')).toHaveText('Rate vs rate card (%)');
    await expect(selectButton(panel, 'Comparison')).toHaveText('>');
    await expect(panel.getByRole('spinbutton', { name: 'Value' })).toHaveValue('15');
    await expect(selectButton(panel, 'Asked only if')).toHaveText('all of these');
    expect(await boxText(page, 'Business sign-off')).toContain('only if Rate vs rate card (%) > 15%');

    await panel.getByRole('button', { name: 'Always ask this approver' }).click();
    await expect(selectButton(panel, 'Field')).toHaveCount(0);
    await expect(input).toHaveValue('');
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.when ?? null, null);
  });

  test('✦ Set shows what the model read: the route answers with a model result (stubbed; no key is available here)', async ({ page }) => {
    // tests/api/nova-model.test.ts stubs callGPT itself and covers the route. This covers the screen on a `source: "gpt"` answer.
    await page.route('**/api/flow-studio/nova/condition', (route) => route.fulfill({ json: { join: 'all', rows: [{ f: 'total_value', op: '>', v: 5000000 }], source: 'gpt' } }));
    await page.goto('/flow-studio/wf-wo-sub');
    await waitForCanvas(page);
    await openStep(page, 'Rate review');
    const panel = panelOf(page);
    await openDetails(panel);
    await panel.getByRole('textbox', { name: 'Only needed when' }).fill('when the total is high');
    await panel.getByRole('button', { name: '✦ Set' }).click();
    await expect(panel.getByText('Read as: asked only if Total value > $5M. Check it below, then Test.')).toBeVisible();
    await expect(selectButton(panel, 'Field')).toHaveText('Total value');
    expect(await boxText(page, 'Rate review')).toBe('Rate review | Procurement · only if Total value > $5M');
    await openTest(page, 'Senior cloud engineer');
    expect(await testCard(page, 'Rate review')).toMatchObject({ status: 'Not needed', message: 'Only needed when Total value > $5M' });
  });

  test('the other Advanced settings save', async ({ page }) => {
    await page.goto('/flow-studio/wf-wo-sub');
    await waitForCanvas(page);
    await openStep(page, 'Business sign-off');
    const panel = panelOf(page);
    await openDetails(panel);
    await choose(panel, 'If rejected', 'End the flow');
    await panel.getByRole('switch', { name: 'Check signing authority' }).click();
    await panel.getByRole('switch', { name: 'Ask again when a value goes down' }).click();
    await selectButton(panel, 'Ask again only if these change').click();
    expect((await optionTexts(page)).map((text) => text.replace(/^✓/, ''))).toEqual(['Total value', 'End date', 'Bill rate', 'Cost center', 'Scope', 'Data access', 'Supplier and terms']);
    await page.keyboard.press('Escape');
    await expectSaved(
      page,
      'wf-wo-sub',
      (workflow) => {
        const { reject, authority, reaskOnDecrease } = workflow.draft.nodes.RA_A1;
        return { reject, authority, reaskOnDecrease };
      },
      { reject: 'end', authority: true, reaskOnDecrease: false },
    );
  });

  test('a named person: placeholder, backup, and a backup that matches clears', async ({ page }) => {
    await page.goto('/flow-studio/wf-wo-sub');
    await waitForCanvas(page);
    await openStep(page, 'Business sign-off');
    const panel = panelOf(page);
    await choose(panel, 'Who approves', 'A named person');
    await expect(selectButton(panel, 'Person')).toHaveText('Choose a person');
    await expect(selectButton(panel, 'Backup when they’re away')).toHaveText('No backup');
    await selectButton(panel, 'Person').click();
    await page.getByRole('option', { name: 'Chloe Martin', exact: true }).click();
    expect(await boxText(page, 'Business sign-off')).toBe('! | Business sign-off | Chloe Martin · no backup');
    await selectButton(panel, 'Backup when they’re away').click();
    await expect(page.getByRole('option', { name: 'Chloe Martin', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Lena Fischer · Finance Director', exact: true }).click();
    expect(await boxText(page, 'Business sign-off')).toBe('Business sign-off | Chloe Martin · backup Lena Fischer');
    await selectButton(panel, 'Person').click();
    await page.getByRole('option', { name: 'Lena Fischer · Finance Director', exact: true }).click();
    await expect(selectButton(panel, 'Backup when they’re away')).toHaveText('No backup');
  });
});

test('every panel edit the server is sent passes its validation, on every kind (no save-failed toast)', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/draft') && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/flow-studio/wf-ts-sub');
  await waitForCanvas(page);
  for (const option of [/^If/, /^Approve/, /^Auto-approve/, /^Fits plan/, /^Collect & verify/, /^Task/, /^System/, /^Notify/, /^Wait/, /^Parallel/, /^Run workflow/, /^Rate check/, /^Job posting writer/]) {
    if ((await panelOf(page).count()) > 0) await panelOf(page).getByRole('button', { name: 'Close' }).click();
    await canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first().click();
    await panelOf(page).getByRole('button', { name: option }).click();
    await expect(panelOf(page).getByRole('button', { name: 'Delete this step' })).toBeVisible();
  }
  const count = (await savedWorkflow(page)).nodes;
  expect(count).toBeGreaterThan(14);
  expect(failures).toEqual([]);

  async function savedWorkflow(target: Page): Promise<{ nodes: number }> {
    let nodes = 0;
    await expect
      .poll(
        async () => {
          const body = (await (await target.request.get('/api/flow-studio/workflows/wf-ts-sub')).json()) as { workflow: { draft: { nodes: Record<string, unknown> } } };
          nodes = Object.keys(body.workflow.draft.nodes).length;
          return nodes;
        },
        { timeout: 8000 },
      )
      .toBeGreaterThan(14);
    return { nodes };
  }
});
