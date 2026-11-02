import { expect, test, type Page } from '@playwright/test';
import { activeOption, boxOf, dropdown, expectSaved, freshApp, norm, openDetails, openStep, optionTexts, panelOf, pickerButton, waitForCanvas } from './helpers';

/** 06 B.7, UI-DD-01 to UI-DD-10, on the real panels and the real Publish dialog. */
const given = {
  jobPostingStart: { workflow: 'wf-jp', step: 'Job posting created' },
  identity: { workflow: 'wf-onboard', step: 'Identity & eligibility' },
  businessSignOff: { workflow: 'wf-wo-sub', step: 'Business sign-off' },
};

async function open(page: Page, target: { workflow: string; step: string }, anchor: string | RegExp): Promise<void> {
  await page.goto(`/flow-studio/${target.workflow}`);
  await waitForCanvas(page);
  await openStep(page, target.step);
  if (target.workflow === 'wf-jp' && anchor === 'Site') await openDetails(panelOf(page), 'More: site, worker type, job family');
  await expect(dropdown(panelOf(page), anchor).first()).toBeVisible();
}

const list = (page: Page) => page.getByRole('listbox');
const search = (page: Page) => page.getByRole('textbox', { name: 'Search' });
const option = (page: Page, name: string) => list(page).getByRole('option', { name, exact: true });
const footer = (page: Page) => page.getByText(/selected/).last();

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

test('UI-DD-01 search filters the list', async ({ page }) => {
  await open(page, given.jobPostingStart, 'Work country');
  await dropdown(page, 'Work country').click();
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue('');
  await expect(search(page)).toHaveAttribute('placeholder', 'Search…');
  expect(await activeOption(page)).toBe((await optionTexts(page))[0]);

  await search(page).fill('can');
  expect(await optionTexts(page)).toEqual(['Canada']);

  await search(page).fill('');
  await search(page).fill('zzz');
  await expect(list(page)).toContainText('No matches');
  expect(await optionTexts(page)).toEqual([]);
  await page.keyboard.press('Escape');
});

test('UI-DD-02 multi select stays open, counts, and Clear', async ({ page }) => {
  await open(page, given.jobPostingStart, 'Work country');
  const field = dropdown(page, 'Work country');
  await field.click();
  await expect(footer(page)).toHaveText('None selected: applies to all');

  const steps: [string, string, string][] = [
    ['UK', '1 selected', 'UK'],
    ['Canada', '2 selected', 'UK, Canada'],
    ['US', '3 selected', 'UK, Canada +1'],
    ['Germany', '4 selected', 'UK, Canada +2'],
  ];
  for (const [name, count, reads] of steps) {
    await option(page, name).click();
    await expect(list(page)).toBeVisible();
    await expect(search(page)).toHaveValue('');
    await expect(option(page, name)).toHaveAttribute('aria-selected', 'true');
    await expect(footer(page)).toHaveText(count);
    await expect(field).toHaveText(reads);
  }

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(list(page).getByRole('option', { selected: true })).toHaveCount(0);
  await expect(footer(page)).toHaveText('None selected: applies to all');
  await expect(field).toHaveText('Any work country');
  await expect(panelOf(page).getByText(/^Applies to: Everywhere\./)).toBeVisible();
  await expect(list(page)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(list(page)).toHaveCount(0);
  await expect(field).toBeFocused();
});

test('UI-DD-02 the typed search survives a pick (04 §13.5)', async ({ page }) => {
  await open(page, given.jobPostingStart, 'Work country');
  await dropdown(page, 'Work country').click();
  await search(page).fill('an');
  await option(page, 'Canada').click();
  await expect(search(page)).toHaveValue('an');
  await expect(option(page, 'Canada')).toHaveAttribute('aria-selected', 'true');
});

test('UI-DD-03 single select closes on pick', async ({ page }) => {
  await open(page, given.identity, 'How it’s verified');
  const field = dropdown(page, 'How it’s verified');
  await field.click();
  expect(await optionTexts(page)).toEqual(['Automatically', 'Automatically, a person if unsure', 'A person reviews']);
  await expect(option(page, 'Automatically, a person if unsure')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0);
  await expect(page.getByText(/selected$/)).toHaveCount(0);

  await option(page, 'A person reviews').click();
  await expect(list(page)).toHaveCount(0);
  await expect(field).toHaveText('A person reviews');
  await expectSaved(page, 'wf-onboard', (workflow) => workflow.draft.nodes.ID.verify, 'person');
  await expect(dropdown(page, 'Reviewer')).toHaveText('People Ops');
});

test('UI-DD-04 keyboard: arrows, Enter, Escape, Tab', async ({ page }) => {
  await open(page, given.jobPostingStart, 'Work country');
  const field = dropdown(page, 'Work country');
  await field.click();

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  expect(await activeOption(page)).toBe('Canada');

  await page.keyboard.press('Enter');
  await expect(option(page, 'Canada')).toHaveAttribute('aria-selected', 'true');
  await expect(list(page)).toBeVisible();

  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowUp');
  expect(await activeOption(page)).toBe('UK');

  // Highlight never wraps at the other end either.
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('ArrowDown');
  expect(await activeOption(page)).toBe('Germany');

  await page.keyboard.press('Escape');
  await expect(list(page)).toHaveCount(0);
  await expect(field).toBeFocused();

  await field.click();
  await page.keyboard.press('Tab');
  await expect(list(page)).toHaveCount(0);

  const runsWhen = dropdown(page, 'Runs when');
  await runsWhen.click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(list(page)).toHaveCount(0);
  await expect(runsWhen).toHaveText('Job posting changed');
});

test('UI-DD-05 “+ Add “Visa letter”” adds an item', async ({ page }) => {
  await open(page, given.identity, 'What’s required');
  const field = dropdown(page, 'What’s required');
  await expect(field).toHaveText('Photo ID, Right to work');
  await field.click();

  const options = await optionTexts(page);
  expect(options.map((text) => text.replace(/^✓/, ''))).toEqual([
    'Photo ID',
    'Right to work',
    'Bank details',
    'Building badge',
    'Certificate of insurance',
    'Code of conduct',
    'Company data returned or deleted',
    'Confidentiality reminder acknowledged',
    'Contractor agreement',
    'Credit check',
    'Criminal record',
    'Date of birth',
    'Employment history',
    'Final expenses',
    'Final timesheet',
    'Laptop',
    'Non-disclosure agreement',
    'Professional licence',
    'Proof of address',
    'Regulatory registration',
    'Sanctions check',
    'Signed site safety rules',
    'Tax forms',
    'Updated certificate',
  ]);
  await expect(option(page, 'Photo ID')).toHaveAttribute('aria-selected', 'true');
  await expect(option(page, 'Right to work')).toHaveAttribute('aria-selected', 'true');
  await expect(footer(page)).toHaveText('2 selected');

  await search(page).fill('Visa letter');
  expect(await optionTexts(page)).toEqual(['+ Add "Visa letter"']);
  expect(norm((await activeOption(page)) ?? '')).toBe('+ Add "Visa letter"');

  await page.keyboard.press('Enter');
  await expect(search(page)).toHaveValue('');
  await expect(list(page)).toBeVisible();
  const afterAdd = await optionTexts(page);
  expect(afterAdd[2].replace(/^✓/, '')).toBe('Visa letter');
  await expect(option(page, 'Visa letter')).toHaveAttribute('aria-selected', 'true');
  await expect(footer(page)).toHaveText('3 selected');
  await expect(field).toHaveText('Photo ID, Right to work +1');
  await expectSaved(page, 'wf-onboard', (workflow) => workflow.draft.nodes.ID.items, ['Photo ID', 'Right to work', 'Visa letter']);

  await search(page).fill('photo');
  expect(await optionTexts(page)).toEqual(['✓Photo ID', '+ Add "photo"']);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expectSaved(page, 'wf-onboard', (workflow) => workflow.draft.nodes.ID.items, ['Right to work', 'Visa letter']);
  await expect(field).toHaveText('Right to work, Visa letter');
});

test('UI-DD-06 the list stays open after toggling a multi option', async ({ page }) => {
  await open(page, given.businessSignOff, 'Roles');
  const field = page.getByRole('button', { name: 'Roles', exact: true });
  await expect(field).toHaveText('Hiring manager, Cost center owner');
  await field.click();

  const scrollTop = () => list(page).evaluate((element) => element.scrollTop);
  // Playwright scrolls an option into view before clicking, so the position to keep is the one with it in view.
  await option(page, 'Procurement').scrollIntoViewIfNeeded();
  const before = await scrollTop();
  expect(before).toBeGreaterThan(0);
  await option(page, 'Procurement').click();
  await expect(list(page)).toBeVisible();
  expect(await scrollTop()).toBe(before);
  await expect(footer(page)).toHaveText('3 selected');
  await expect(page.getByText(/approve, together\./)).toHaveText('Hiring manager, Cost center owner, Procurement approve, together. Levv finds the right person for each request.');

  await option(page, 'Procurement').click();
  await expect(list(page)).toBeVisible();
  expect(await scrollTop()).toBe(before);
  await expect(footer(page)).toHaveText('2 selected');
  await expect(page.getByText(/approve, together\./)).toHaveText('Hiring manager, Cost center owner approve, together. Levv finds the right person for each request.');
  await page.keyboard.press('Escape');
});

test('UI-DD-07 click outside, resize and other fields close the list', async ({ page }) => {
  await open(page, given.jobPostingStart, 'Work country');
  const field = dropdown(page, 'Work country');

  await field.click();
  await expect(list(page)).toHaveCount(1);
  await page.mouse.click(100, 400);
  await expect(list(page)).toHaveCount(0);
  await expect(field).toHaveText('Any work country');

  await field.click();
  await expect(list(page)).toHaveCount(1);
  await page.setViewportSize({ width: 1300, height: 900 });
  await expect(list(page)).toHaveCount(0);

  await field.click();
  await expect(list(page)).toHaveCount(1);
  await dropdown(page, 'Business unit').click();
  await expect(list(page)).toHaveCount(1);
  expect(await optionTexts(page)).toEqual(['Technology', 'Operations', 'Finance', 'Marketing']);
  await expect(dropdown(page, 'Business unit')).toHaveAttribute('aria-expanded', 'true');
  await expect(field).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('UI-DD-08 single select with groups', async ({ page }) => {
  await open(page, given.jobPostingStart, 'Runs when');
  await dropdown(page, 'Runs when').click();

  const headings = await list(page).locator('[role="presentation"]').allTextContents();
  expect(headings).toEqual(['Job posting', 'Work order', 'SOW', 'Onboarding', 'Assignment', 'Offboarding', 'Access request', 'Timesheet', 'Expense', 'Invoice', 'Worker']);

  const options = await optionTexts(page);
  // 04 §7.1 item 4, in order; the day-based ones read "N" unless selected.
  expect(options).toEqual([
    'Job posting created', 'Job posting changed', 'Job posting approved', 'Job posting filled', 'Job posting withdrawn or cancelled',
    'Work order submitted', 'Work order changed', 'Work order approved', 'Work order rejected', 'Work order accepted by supplier', 'Work order worker confirmed', 'Work order withdrawn or cancelled',
    'SOW created', 'SOW change order submitted', 'SOW approved', 'SOW milestone delivered', 'SOW closed',
    'Onboarding starts', 'Onboarding cleared to start', 'Onboarding check failed', 'Onboarding completed',
    'Assignment started', 'Assignment changed', 'Assignment extended', 'Assignment end date in N days', 'Assignment closed',
    'Offboarding starts', 'Offboarding completed',
    'Access request submitted', 'Access request approved', 'Access request withdrawn or cancelled',
    'Timesheet submitted', 'Timesheet approved', 'Timesheet rejected',
    'Expense submitted', 'Expense approved', 'Expense rejected',
    'Invoice received', 'Invoice approved', 'Invoice paid',
    'Worker document expiring in N days', 'Worker document expired',
  ]);
  expect(options).toHaveLength(42);
  await expect(option(page, 'Job posting created')).toHaveAttribute('aria-selected', 'true');
  expect(await activeOption(page)).toBe('Job posting created');
  await expect(page.getByRole('button', { name: 'Clear' })).toHaveCount(0);

  await search(page).fill('expired');
  expect(await list(page).locator('[role="presentation"]').allTextContents()).toEqual(['Worker']);
  expect(await optionTexts(page)).toEqual(['Worker document expired']);
  await page.keyboard.press('Escape');
});

test('UI-DD-09 and UI-D2 the list follows its field when the panel scrolls (1440×600)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await open(page, given.jobPostingStart, 'Site');
  const field = dropdown(page, 'Site');
  await field.evaluate((element) => element.scrollIntoView({ block: 'center' }));

  await field.click();
  const popover = list(page).locator('..');
  expect(await optionTexts(page)).toEqual(['London', 'New York', 'Toronto', 'Frankfurt', 'Remote']);

  const checkAttached = async () => {
    const fieldBox = await boxOf(field);
    const box = await boxOf(popover);
    const below = 600 - (fieldBox.y + fieldBox.height) - 12;
    const above = fieldBox.y - 12;
    if (below >= Math.min(220, above)) expect(Math.abs(box.y - (fieldBox.y + fieldBox.height + 4))).toBeLessThanOrEqual(1);
    else expect(Math.abs(box.y + box.height - (fieldBox.y - 4))).toBeLessThanOrEqual(1);
    expect(box.width).toBeCloseTo(Math.max(fieldBox.width, 240), 0);
    expect(box.height).toBeLessThanOrEqual(320);
    return fieldBox;
  };
  const first = await checkAttached();

  const panelBox = await boxOf(field);
  await page.mouse.move(panelBox.x + 20, panelBox.y - 30);
  await page.mouse.wheel(0, 60);
  await expect.poll(async () => (await boxOf(field)).y).toBeLessThan(first.y);
  await expect(list(page)).toBeVisible();
  await checkAttached();

  await page.getByRole('dialog').locator('div.overflow-auto').first().evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(list(page)).toHaveCount(0);
  expect((await boxOf(field)).y).toBeGreaterThan(600);
});

test('UI-DD-09 opens above when there is more room there', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await open(page, given.jobPostingStart, 'Site');
  const field = dropdown(page, 'Site');
  await page.getByRole('dialog').locator('div.overflow-auto').first().evaluate((element, target) => {
    element.scrollTop += target;
  }, (await boxOf(field)).y - 480);
  await field.click();
  const fieldBox = await boxOf(field);
  const box = await boxOf(list(page).locator('..'));
  expect(600 - (fieldBox.y + fieldBox.height) - 12).toBeLessThan(Math.min(220, fieldBox.y - 12));
  expect(Math.abs(box.y + box.height - (fieldBox.y - 4))).toBeLessThanOrEqual(1);
});

test('04 §13.4: a list opening below with little room stays on the screen, footer and all', async ({ page }) => {
  await page.goto('/flow-studio/wf-onboard');
  await waitForCanvas(page);
  await openStep(page, 'Background check');
  const field = dropdown(panelOf(page), 'Who decides');
  await field.click();
  const box = await boxOf(list(page).locator('..'));
  expect(box.y + box.height).toBeLessThanOrEqual(900);
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(footer(page)).toHaveText('None selected');
  await expect(list(page)).toBeVisible();
});

test('UI-DD-10 dropdowns in the publish dialog', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await pickerButton(page, 'Work order submitted').click();
  await page.getByRole('option', { name: /^Data and AI hires/ }).click();
  await expect(pickerButton(page, 'Data and AI hires')).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^Publish/ });
  const field = dropdown(dialog, /Which one should run\?/);
  await expect(field).toHaveText('Choose…');
  await field.click();
  await expect(search(page)).toBeVisible();
  await expect(search(page)).toHaveAttribute('placeholder', 'Search…');
  expect(await optionTexts(page)).toEqual(['Data and AI hires', 'UK Technology work orders']);
  await expect(dialog.locator('select, input[type=radio], input[type=checkbox], [role=radio], [role=checkbox], [aria-pressed]')).toHaveCount(0);
  await option(page, 'UK Technology work orders').click();
  await expect(list(page)).toHaveCount(0);
  await expect(field).toHaveText('UK Technology work orders');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
});
