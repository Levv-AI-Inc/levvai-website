import { expect, test, type Page } from '@playwright/test';
import { expectedOf, normDeep } from '../support/acceptance-doc';
import {
  boxText,
  canvasOf,
  choose,
  expectSaved,
  FIXED_NOW,
  lintIssues,
  norm,
  novaCount,
  openStep,
  optionTexts,
  panelOf,
  pickerButton,
  plusAfter,
  readBoxes,
  resetApp,
  searchPick,
  selectButton,
  signIn,
  toastOf,
  waitForCanvas,
} from './helpers';
import { card as testCard, expectTestPanel, novaButton, openTest, readNova, readTestPanel, testPanelOf } from './test-panel';

/**
 * 06 B.3, UI-I1 to UI-I12: one page, one workflow, as 06 says. "Test … equals EN-xxx" is asserted twice: against the simulate
 * route on what was autosaved, and on the screen. Each opens Test, reads it, and returns to the If panel the next test needs.
 */
test.describe.configure({ mode: 'serial' });

const ID = 'nf101';
let page: Page;

const overlap = 'Overlaps with "Work order submitted" on 140 past records (Everywhere and Everywhere). Set which one wins before publishing.';

async function expectTest(recordId: string, en: string): Promise<void> {
  const expected = normDeep(expectedOf(en));
  await expect
    .poll(
      async () => {
        const response = await page.request.post(`/api/flow-studio/workflows/${ID}/simulate`, { data: { recordId } });
        return normDeep(await response.json());
      },
      { timeout: 8000 },
    )
    .toStrictEqual(expected);
}

const lintMessages = async (): Promise<string[]> => (await lintIssues(page, ID)).map((issue) => norm(issue.m)).sort();

async function thenOptionsOf(card: ReturnType<Page['getByRole']>): Promise<string[]> {
  await selectButton(card, 'Then').click();
  const options = await optionTexts(page);
  await page.keyboard.press('Escape');
  return options;
}

const panel = () => panelOf(page);
const card = (name: string) => panel().getByRole('group', { name, exact: true });

/** 06: "Test of “…” equals EN-xxx", on the screen. The If's panel comes back afterwards, as the next test expects. */
async function testOnScreen(record: string, en: string): Promise<void> {
  await openTest(page, record);
  await expectTestPanel(page, en);
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.clock.setFixedTime(FIXED_NOW);
  await resetApp(page);
  await signIn(page, 'Flow Admin');
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await pickerButton(page, 'Work order submitted').click();
  await page.getByRole('option', { name: '+ New workflow' }).click();
  await expect(pickerButton(page, 'New workflow')).toBeVisible();
});

test.afterAll(async () => {
  await page.close();
});

test('B.3 setup: + New workflow opens a draft with Workflow settings', async () => {
  await expect(page).toHaveURL(/\/flow-studio\/nf101\?step=T$/);
  await expect(page.getByRole('banner').getByText('Draft', { exact: true })).toBeVisible();
  await expect(toastOf(page)).toHaveText('New draft. Set when it runs, then press + to add steps');
  await expect(panel().getByRole('heading', { name: 'Workflow settings' })).toBeVisible();
  await expect(panel().getByText('Publish it to make it active.')).toBeVisible();
  await expect(panel().getByRole('switch')).toHaveCount(0);
  await expect(selectButton(panel(), 'Runs when')).toHaveText('Work order submitted');
  // Stored at creation, shown once the first Approve step exists (T2).
  await expect(panel().getByText('When a request is finally rejected, tell')).toHaveCount(0);
  expect(await boxText(page, 'Work order submitted')).toBe('Work order submitted | Everywhere');
  expect(await boxText(page, 'End')).toBe('End | Completed');
  expect(await novaCount(page)).toBe('1');
  expect(await lintMessages()).toEqual([overlap]);
});

test('UI-I1 add an Approve step', async () => {
  await (await plusAfter(page, 'T', 'next')).click();
  const menu = panel();
  await expect(menu.getByRole('heading', { name: 'Add a step' })).toBeVisible();
  await expect(menu.getByText('Workflows do the work')).toBeVisible();
  const search = menu.getByRole('textbox', { name: 'Search' });
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute('placeholder', 'Search steps and Digital Workers');

  const headings = menu.getByRole('heading', { level: 3 });
  expect(await headings.allTextContents()).toEqual(['Decide', 'Approvals', 'People', 'Systems', 'Timing', 'Digital Workers']);
  await expect(headings.first()).toHaveCSS('text-transform', 'uppercase');

  const rows = (await menu.locator('button[data-menu-index]').all()).map((row) => row.evaluate((element) => Array.from(element.querySelectorAll(':scope > span:last-child > span')).map((part) => part.textContent ?? '')));
  const read = (await Promise.all(rows)).map((parts) => parts.map(norm));
  expect(read).toEqual([
    ['If', 'Split the path using any field, including your own'],
    ['Approve', 'Roles sign off. Levv finds the right people'],
    ['Auto-approve', 'Approve instantly and keep an audit receipt'],
    ['Fits plan?', 'Check the request fits a budget Finance already approved'],
    ['Collect & verify', 'Ask for documents or checks and verify them, automatically or by a person'],
    ['Task', "A to-do for a person that isn't a yes/no decision"],
    ['System', 'Create, update or check something in another system'],
    ['Notify', 'Send an FYI, no action needed'],
    ['Wait', 'Pause for a set time, or until a date on the record (e.g. 5 working days before the start date)'],
    ['Parallel', 'Run branches at the same time'],
    ['Run workflow', 'Start another workflow'],
    ['Tenure & classification', 'Counts months engaged and tenure caps'],
    ['Rate check', 'Compares the rate with the rate card and market'],
    ['Budget check', 'Checks budget left after this request'],
    ['Duplicate & ghost worker', 'Finds the same person under another supplier'],
    ['Job posting writer', 'Turns a plain request into a job posting'],
    ['Invoice matchNeeds setup', 'Matches invoices to time and milestones'],
  ]);
  for (const absent of ['Update record', 'Chaser', 'Request approval']) await expect(menu.getByText(absent)).toHaveCount(0);

  await menu.getByRole('button', { name: /^Approve Roles sign off/ }).click();

  expect(await boxText(page, 'Approval')).toBe('! | Approval | Choose who approves');
  const opened = panel();
  await expect(opened.getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
  await expect(opened.getByText('Approval', { exact: true })).toBeVisible();
  const name = opened.getByLabel('Name', { exact: true });
  await expect(name).toHaveValue('Approval');
  await expect(name).toHaveAttribute('placeholder', 'Approve');
  await expect(selectButton(opened, 'Who approves')).toHaveText('Roles');
  await expect(opened.getByText('Pick roles. Levv finds the right person for each request.')).toBeVisible();
  await expect(selectButton(opened, 'Roles')).toHaveText('Choose roles');
  await expect(opened.getByText(/^Approvers get a brief/)).toBeVisible();
  await expect(opened.getByRole('spinbutton', { name: 'Remind after (hours)' })).toHaveValue('24');
  await expect(opened.getByRole('spinbutton', { name: 'Then escalate to their manager after (hours)' })).toHaveValue('48');
  await expect(opened.getByText('Advanced', { exact: true })).toBeVisible();
  await expect(opened.getByRole('button', { name: 'Delete this step' })).toBeVisible();
  await expect(selectButton(opened, 'How many')).toHaveCount(0);

  expect(await novaCount(page)).toBe('2');
  await expect.poll(lintMessages, { timeout: 8000 }).toEqual(['"Approval" doesn\'t say who approves yet.', overlap].sort());
  await expectTest('WO-2231', 'EN-075');
});

test('UI-I2 pick who approves and test', async () => {
  const roles = selectButton(panel(), 'Roles');
  await roles.click();
  await page.getByRole('textbox', { name: 'Search' }).last().fill('cost');
  expect(await optionTexts(page)).toEqual(['Cost center owner']);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox').getByRole('option', { name: 'Cost center owner' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(roles).toHaveText('Cost center owner');

  await expect(panel().getByText('Cost center owner approve. Levv finds the right person for each request.')).toBeVisible();
  expect(await boxText(page, 'Approval')).toBe('Approval | Cost center owner');
  expect(await novaCount(page)).toBe('1');
  await expectTest('WO-2231', 'EN-076');

  await openTest(page, 'Operations analyst');
  expect((await readTestPanel(page)).summary).toBe('1 approval round on this path.');
  expect(await testCard(page, 'Approval')).toMatchObject({ status: 'Approval', rounds: ['1 Cost center owner (Raj Patel)'] });
  await expectTestPanel(page, 'EN-076');
});

test('UI-I3 add an If in front of it', async () => {
  await testPanelOf(page).getByRole('button', { name: 'Close' }).click();
  await expect(testPanelOf(page)).toHaveCount(0);
  await (await plusAfter(page, 'T', 'next')).click();
  await panel().getByRole('button', { name: /^If Split the path/ }).click();

  await expect(panel().getByRole('heading', { name: 'If', exact: true })).toBeVisible();
  await expect(panel().getByText('Over $500K?', { exact: true })).toBeVisible();
  expect(norm((await panel().getByText(/^Levv checks the paths/).textContent()) ?? '')).toBe(
    'Levv checks the paths from the top and takes the first one that matches. If none match, it goes to "No". All paths meet again at "Approval".',
  );

  const yes = card('Yes');
  await expect(yes.getByText('Take this path when')).toBeVisible();
  await expect(selectButton(yes, 'Take this path when')).toHaveText('all');
  await expect(yes.getByText('of these are true:')).toBeVisible();
  await expect(selectButton(yes, 'Field')).toHaveText('Total value');
  await expect(selectButton(yes, 'Comparison')).toHaveText('≥');
  await expect(yes.getByRole('spinbutton', { name: 'Value' })).toHaveValue('500000');
  await expect(yes.getByRole('button', { name: '+ Add a condition' })).toBeVisible();
  await expect(yes.getByRole('button', { name: '+ Add an either/or condition' })).toBeVisible();
  expect(norm((await selectButton(yes, 'Then').textContent()) ?? '')).toBe('Carry on to "Approval"');

  const no = card('No');
  await expect(no.getByText('when none of the paths above match')).toBeVisible();
  expect(norm((await selectButton(no, 'Then').textContent()) ?? '')).toBe('Carry on to "Approval"');
  await expect(panel().getByRole('button', { name: '+ Add a path' })).toBeVisible();
  await expect(panel().getByRole('button', { name: '+ Add a step after the paths meet' })).toBeVisible();
  await expect(panel().getByText('Advanced', { exact: true })).toBeVisible();
  await expect(panel().getByRole('button', { name: 'Delete this step' })).toBeVisible();
  await expect(yes.getByRole('button', { name: 'Delete path' })).toHaveCount(0);

  const expected = ['Carry on to "Approval"', 'Ask someone to approve', 'Escalate: someone must decide', 'Reject it and send it back to the requester', 'Stop the workflow and tell someone'];
  expect(await thenOptionsOf(yes)).toEqual(expected);
  expect(await thenOptionsOf(no)).toEqual(expected);

  expect(await boxText(page, 'Over $500K?')).toBe('Over $500K? | ! | Yes | carries on | No | carries on');
  expect(await novaCount(page)).toBe('2');
  await expect.poll(lintMessages, { timeout: 8000 }).toEqual(['"Over $500K?" sends every path to the same place, so it does nothing yet.', overlap].sort());

  // LP-07's I3 case, on the screen: a Check, and the overlap beside it.
  await novaButton(page).click();
  const items = await readNova(page);
  expect(items).toHaveLength(2);
  expect(items).toContainEqual({ label: 'Check', message: '"Over $500K?" sends every path to the same place, so it does nothing yet.', buttons: ['Show me'] });
  expect(items).toContainEqual({ label: 'Fix before publishing', message: overlap, buttons: ['Choose which wins'] });
  await openStep(page, 'Over $500K?');
});

test('UI-I4 values are a searchable dropdown', async () => {
  const yes = card('Yes');
  await selectButton(yes, 'Field').click();
  expect(await optionTexts(page)).toEqual([
    'Total value', 'Bill rate per hour', 'Work country', 'Business unit', 'Job family', 'Engagement type', 'Client data access',
    "Vendor's digital worker has system access", 'Regulated role', 'Non-standard terms', 'Scope changed', 'Fields changed', 'Hours over schedule',
    'Registration required', 'Manager chose to extend', 'Urgent start', 'Cost center', 'Legal entity', 'Site', 'Worker type',
    'Worker is a former employee', 'Supplier tier', 'Rate vs rate card (%)', 'Rate vs market median (%)', 'Budget left after request',
    'Months engaged after change', 'Possible duplicate worker', 'Days until start date', 'Invoice matches time and work order', 'Bill rate change (%)',
    'Security clearance', 'Project code',
  ]);
  await page.getByRole('listbox').getByRole('option', { name: 'Engagement type', exact: true }).click();
  await expect(selectButton(yes, 'Comparison')).toHaveText('is');

  const value = selectButton(yes, 'Value');
  await expect(value).toHaveText('Choose values');
  await value.click();
  expect(await optionTexts(page)).toEqual(['Off-payroll', 'Payrolled', 'Fixed fee', 'Time and materials']);
  await page.getByRole('textbox', { name: 'Search' }).last().fill('off');
  expect(await optionTexts(page)).toEqual(['Off-payroll']);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox').getByRole('option', { name: 'Off-payroll' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(value).toHaveText('Off-payroll');

  const name = yes.getByRole('textbox', { name: 'Path name' });
  await expect(name).toHaveAttribute('placeholder', 'Name this path');
  await name.fill('');
  await panel().getByRole('group', { name: 'Name this path' }).getByRole('textbox', { name: 'Path name' }).fill('Off-payroll');

  expect(await boxText(page, 'Over $500K?')).toBe('Over $500K? | ! | Off-payroll | carries on | No | carries on');
  await expectSaved(page, ID, (workflow) => workflow.draft.nodes.n103.outs[0].rows, [{ f: 'engagement', op: 'in', v: ['Off-payroll'] }]);

  // UI-NP-01's rule on this panel.
  await expect(panel().locator('select, input[type=radio], input[type=checkbox], [aria-pressed], [role=radio], [role=checkbox]')).toHaveCount(0);
});

test('UI-I5 No can escalate', async () => {
  const no = card('No');
  await choose(no, 'Then', 'Escalate: someone must decide');
  await expect(selectButton(no, 'Escalate to')).toHaveText('Cost center owner');
  await expect(no.getByRole('spinbutton', { name: 'Escalate after (hours)' })).toHaveValue('48');
  await expect(no.getByText('They must act: approve (it carries on), reject with a comment, or send it back to the requester.')).toBeVisible();

  expect(await boxText(page, 'Over $500K?')).toBe('Over $500K? | Off-payroll | carries on | No | escalate · Cost center owner');
  expect(await boxText(page, 'No: escalation')).toBe('No: escalation | Cost center owner');

  await openStep(page, 'No: escalation');
  await expect(panel().getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
  await expect(panel().getByRole('spinbutton', { name: 'Then escalate to their manager after (hours)' })).toHaveValue('48');
  await expectTest('WO-2231', 'EN-082');
  await testOnScreen('Operations analyst', 'EN-082');
  await openStep(page, 'Over $500K?');
});

test('UI-I6 a new path doesn’t inherit another path’s steps', async () => {
  await panel().getByRole('button', { name: '+ Add a path' }).click();
  const second = card('Path 2');
  await expect(second.getByText('2', { exact: true })).toBeVisible();
  await expect(second.getByRole('textbox', { name: 'Path name' })).toHaveValue('Path 2');
  await expect(selectButton(second, 'Field')).toHaveText('Total value');
  await expect(selectButton(second, 'Comparison')).toHaveText('≥');
  await expect(second.getByRole('spinbutton', { name: 'Value' })).toHaveValue('100000');
  expect(norm((await selectButton(second, 'Then').textContent()) ?? '')).toBe('Carry on to "Approval"');
  await expect(panel().getByRole('button', { name: 'Delete path' })).toHaveCount(2);

  expect(norm((await panel().getByText(/^Levv checks the paths/).textContent()) ?? '')).toMatch(/If none match, it goes to "Otherwise"\. All paths meet again at "Approval"\.$/);
  await expect(card('Otherwise').getByText('Otherwise', { exact: true })).toBeVisible();

  expect(await boxText(page, 'Over $500K?')).toBe('Over $500K? | Off-payroll | carries on | Path 2 | carries on | Otherwise | escalate · Cost center owner');
  expect(await boxText(page, 'Otherwise: escalation')).toBe('Otherwise: escalation | Cost center owner');
  const lines = await canvasOf(page).locator('svg path').evaluateAll((paths) => paths.map((path) => [path.getAttribute('data-from'), path.getAttribute('data-to'), path.getAttribute('data-key')]));
  expect(lines.find(([from, , key]) => from === 'n103' && key !== 'p1' && key !== 'else')?.[1]).toBe('n102');
});

test('UI-I7 a path routes to its own approver', async () => {
  const second = card('Path 2');
  await choose(second, 'Then', 'Ask someone to approve');
  await choose(card('Path 2'), 'Who approves', 'Procurement');
  expect(await boxText(page, 'Over $500K?')).toBe('Over $500K? | Off-payroll | carries on | Path 2 | approval · Procurement | Otherwise | escalate · Cost center owner');
  expect(await boxText(page, 'Path 2: approval')).toBe('Path 2: approval | Procurement');
  expect(norm((await second.getByText(/^Then it carries on/).textContent()) ?? '')).toBe('Then it carries on to "Approval".');
  await expectTest('WO-2231', 'EN-086');
  await expectTest('WO-2214', 'EN-087');
  await testOnScreen('Operations analyst', 'EN-086');
  await testOnScreen('Senior cloud engineer', 'EN-087');
  await openStep(page, 'Over $500K?');
});

test('UI-I8 a path can reject', async () => {
  await choose(card('Off-payroll'), 'Then', 'Reject it and send it back to the requester');
  expect(await boxText(page, 'Rejected')).toBe('Rejected | Rejected');
  // 06 quotes #fb7185; that is rose-400 in 04 §1.4.
  const icon = canvasOf(page).getByRole('button', { name: 'Rejected', exact: true }).locator('svg');
  await expect(icon).toHaveCSS('color', 'rgb(251, 113, 133)');
  expect(await boxText(page, 'Over $500K?')).toBe('Over $500K? | Off-payroll | rejected | Path 2 | approval · Procurement | Otherwise | escalate · Cost center owner');
  await expectTest('WO-2214', 'EN-089');
  await testOnScreen('Senior cloud engineer', 'EN-089');
  expect((await readTestPanel(page)).summary).toBe('No one needs to approve on this path. Rejected at "Over $500K?". It goes back to the requester with the reason; Levv tells Hiring manager.');
  await openStep(page, 'Over $500K?');
});

test('UI-I9 at least one path must carry on', async () => {
  await choose(card('Path 2'), 'Then', 'Reject it and send it back to the requester');
  const rejected = (await readBoxes(page)).filter((box) => box.name === 'Rejected');
  expect(rejected.map((box) => norm(box.text))).toEqual(['Rejected | Rejected', 'Rejected | Rejected']);

  await choose(card('Otherwise'), 'Then', 'Reject it and send it back to the requester');
  await expect(toastOf(page)).toHaveText('At least one path has to carry on');
  await expect(selectButton(card('Otherwise'), 'Then')).toHaveText('Escalate: someone must decide');
  expect(await boxText(page, 'Otherwise: escalation')).toBe('Otherwise: escalation | Cost center owner');
});

test('UI-I10 paths can be deleted', async () => {
  await card('Path 2').getByRole('button', { name: 'Delete path' }).click();
  await expect(toastOf(page)).toHaveText('Path deleted');
  await expect(card('Path 2')).toHaveCount(0);
  await expect(card('Off-payroll')).toBeVisible();
  await expect(card('Otherwise')).toBeVisible();
  await expect(panel().getByRole('button', { name: 'Delete path' })).toHaveCount(0);
  expect((await readBoxes(page)).filter((box) => box.name === 'Rejected')).toHaveLength(1);
  expect(await boxText(page, 'Over $500K?')).toBe('Over $500K? | Off-payroll | rejected | Otherwise | escalate · Cost center owner');
});

test('UI-I11 either/or condition', async () => {
  const path = card('Off-payroll');
  await path.getByRole('button', { name: '+ Add an either/or condition' }).click();
  await expect(path.getByText('Either/or:', { exact: true })).toBeVisible();
  await expect(selectButton(path, 'Either/or:')).toHaveText('any one');
  await expect(path.getByText('of these', { exact: true })).toBeVisible();
  await expect(path.getByRole('button', { name: 'Remove group' })).toBeVisible();
  await expect(path.getByRole('button', { name: '+ Add another option' })).toBeVisible();
  const fields = selectButton(path, 'Field');
  await expect(fields).toHaveCount(3);
  await expect(fields.nth(1)).toHaveText('Total value');
  await expect(fields.nth(2)).toHaveText('Regulated role');
  await expect(selectButton(path, 'Comparison').nth(1)).toHaveText('≥');
  await expect(path.getByRole('spinbutton', { name: 'Value' })).toHaveValue('250000');
  await expect(selectButton(path, 'Comparison').nth(2)).toHaveText('is yes');
  await expectSaved(page, ID, (workflow) => workflow.draft.nodes.n103.outs[0].rows, [
    { f: 'engagement', op: 'in', v: ['Off-payroll'] },
    { join: 'any', rows: [{ f: 'total_value', op: '>=', v: 250000 }, { f: 'role_regulated', op: 'yes' }] },
  ]);
});

test('UI-I12 a path with no conditions is flagged', async () => {
  const path = card('Off-payroll');
  await path.getByRole('button', { name: 'Remove group' }).click();
  await path.getByRole('button', { name: 'Remove rule' }).click();
  await expect(path.getByRole('button', { name: 'Remove rule' })).toHaveCount(0);

  await expect.poll(lintMessages, { timeout: 8000 }).toEqual(['Path "Off-payroll" in "Over $500K?" has no conditions, so it matches everything.', overlap].sort());
  const issues = await lintIssues(page, ID);
  expect(issues.find((issue) => issue.m.startsWith('Path'))?.sev).toBe('warn');
  expect(issues.find((issue) => issue.m.startsWith('Overlaps'))?.sev).toBe('bad');
  expect(await novaCount(page)).toBe('2');
  expect(await boxText(page, 'Over $500K?')).toContain('Over $500K? | ! |');
  await expectTest('WO-2231', 'EN-096');

  await novaButton(page).click();
  await expect(page.getByRole('dialog').getByText('Nova checked this flow against 140 real records from the last 90 days.')).toBeVisible();
  const items = await readNova(page);
  expect(items).toHaveLength(2);
  expect(items).toContainEqual({ label: 'Check', message: 'Path "Off-payroll" in "Over $500K?" has no conditions, so it matches everything.', buttons: ['Show me'] });
  expect(items).toContainEqual({ label: 'Fix before publishing', message: overlap, buttons: ['Choose which wins'] });
  await testOnScreen('Operations analyst', 'EN-096');
});
