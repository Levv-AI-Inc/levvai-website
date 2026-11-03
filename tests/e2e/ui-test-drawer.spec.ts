import { expect, test, type Locator, type Page } from '@playwright/test';
import { boxOf, canvasOf, choose, freshApp, novaCount, openStep, openWorkflow, panelOf, pickerButton, selectButton, waitForCanvas } from './helpers';
import { expectedPanel, expectTestPanel, novaButton, novaPanelOf, openTest, radioRow, readTestPanel, testButton, testPanelOf } from './test-panel';

/** 04 §8 and §4.8: what 06 B.2 does not spell out about the drawer and the canvas while it is open. */

const CYAN_400 = 'rgb(34, 211, 238)';
const SLATE_600 = 'rgb(71, 85, 105)';

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

const edge = (page: Page, from: string, key: string): Locator => canvasOf(page).locator(`path[data-from="${from}"][data-key="${key}"]`);
const body = (page: Page, id: string): Locator => canvasOf(page).locator(`[data-node-id="${id}"] button`).first();
const wrapper = (page: Page, id: string): Locator => canvasOf(page).locator(`[data-node-id="${id}"]`);

test('04 §4.8: the path, its rings, the subtitles and the hint chip, with WO-2214 on UK Technology work orders', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech');
  await waitForCanvas(page);
  await expect(edge(page, 'T', 'next')).toHaveCSS('stroke', SLATE_600);
  await openTest(page, 'Senior cloud engineer');

  await expect(edge(page, 'T', 'next')).toHaveCSS('stroke', CYAN_400);
  await expect(edge(page, 'T', 'next')).toHaveCSS('stroke-width', '2.6px');
  // Business sign-off is on the path; a line it did not take is not.
  const rejectable = await canvasOf(page).locator('svg path').evaluateAll((paths) => paths.map((path) => [path.getAttribute('data-from'), path.getAttribute('data-key'), getComputedStyle(path).stroke, getComputedStyle(path).strokeWidth]));
  expect(rejectable.some(([, , stroke, width]) => stroke === SLATE_600 && width === '2px')).toBe(true);

  const view = await readTestPanel(page);
  // Every card's title has a box, showing its status short text instead of its subtitle.
  for (const entry of view.cards) {
    const box = canvasOf(page).getByRole('button', { name: entry.title, exact: true });
    await expect(box.locator('..')).toContainText(entry.status);
  }
  // 04 §4.8's rings. The Business sign-off seat is an approval waiting: amber. A passed check: emerald.
  await expect(body(page, 'RA_A1')).toHaveCSS('border-top-color', 'rgb(245, 158, 11)');
  await expect(body(page, 'RA_CB')).toHaveCSS('border-top-color', 'rgb(16, 185, 129)');
  await expect(body(page, 'T')).toHaveCSS('border-top-color', 'rgb(16, 185, 129)');
  // An If has no status of its own: as in the prototype, no ring, and it is not dimmed.
  await expect(wrapper(page, 'RA_C1')).toHaveCSS('opacity', '1');
  await expect(wrapper(page, 'END')).toHaveCSS('opacity', '1');
  // The Value band sends this record to Finance sign-off, so Executive sign-off is not on the path.
  await expect(wrapper(page, 'RA_A5')).toHaveCSS('opacity', '0.4');
  await expect(wrapper(page, 'RA_A1')).toHaveCSS('opacity', '1');

  await expect(page.getByText('Showing WO-2214')).toBeVisible();
  await page.getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(testPanelOf(page)).toHaveCount(0);
  await expect(page.getByText('Showing WO-2214')).toHaveCount(0);
  await expect(edge(page, 'T', 'next')).toHaveCSS('stroke', SLATE_600);
  await expect(wrapper(page, 'RA_A5')).toHaveCSS('opacity', '1');
});

test('04 §4.8: a failed step is rose, one blocked by it is dashed, and a branch ending on its own is dashed', async ({ page }) => {
  await page.goto('/flow-studio/wf-onboard');
  await waitForCanvas(page);
  await openTest(page, 'Analyst, checks need attention');
  await expect(body(page, 'BG')).toHaveCSS('border-top-color', 'rgb(244, 63, 94)');
  await expect(body(page, 'SA')).toHaveCSS('border-top-style', 'dashed');
  await expect(body(page, 'SA')).toHaveCSS('opacity', '0.75');
  // End is held back by that too; Start is not.
  await expect(body(page, 'END')).toHaveCSS('border-top-style', 'dashed');
  await expect(body(page, 'T')).toHaveCSS('border-top-color', 'rgb(16, 185, 129)');
  // VI and LB go straight to End from the Parallel; LG, WD and ID meet at a later step.
  await expect(edge(page, 'PA', 'b4')).toHaveAttribute('stroke-dasharray', '3 5');
  await expect(edge(page, 'PA', 'b5')).toHaveAttribute('stroke-dasharray', '3 5');
  await expect(edge(page, 'PA', 'b1')).not.toHaveAttribute('stroke-dasharray', '3 5');
  await expect(edge(page, 'VI', 'next')).toHaveAttribute('stroke-dasharray', '3 5');
  await expect(edge(page, 'LG', 'next')).not.toHaveAttribute('stroke-dasharray', '3 5');
});

test('04 §8.3: changing the record re-runs and clicking a step switches the drawer, and highlighting stops', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await openTest(page, 'Operations analyst');
  await expect(testButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expectTestPanel(page, 'EN-017');
  await openTest(page, 'Senior cloud engineer');
  await expectTestPanel(page, 'EN-015');
  await expect(page).toHaveURL(/panel=test&record=WO-2214/);

  await openStep(page, 'Business sign-off');
  await expect(testPanelOf(page)).toHaveCount(0);
  await expect(panelOf(page).getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
  await expect(testButton(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(edge(page, 'T', 'next')).toHaveCSS('stroke', SLATE_600);
  await expect(page).toHaveURL(/step=RA_A1/);
  await expect(page).not.toHaveURL(/panel=/);

  // Editing, then back: Test re-runs on the edit straight away.
  await panelOf(page).getByRole('spinbutton', { name: 'Remind after (hours)' }).fill('12');
  await testButton(page).click();
  await expect(radioRow(page, 'Senior cloud engineer')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await readTestPanel(page)).cards.find((card) => card.title === 'Business sign-off')?.message).toMatch(/Chaser reminds after 12h/);
});

test('04 §8: a workflow with no samples says so, and Test closes with its button and Escape, with focus back on it', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await page.getByRole('button', { name: '+ New workflow' }).click();
  await expect(pickerButton(page, 'New workflow')).toBeVisible();
  await choose(panelOf(page), 'Runs when', 'Expense submitted');
  await testButton(page).click();
  await expect(testPanelOf(page).getByText('No sample records for this trigger yet.')).toBeVisible();
  await expect(testPanelOf(page).getByRole('radio')).toHaveCount(0);
  await expect(page.getByText(/^Showing /)).toHaveCount(0);
  await testButton(page).click();
  await expect(testPanelOf(page)).toHaveCount(0);
  await expect(testButton(page)).toBeFocused();

  await testButton(page).click();
  await page.keyboard.press('Escape');
  await expect(testPanelOf(page)).toHaveCount(0);
  await expect(testButton(page)).toBeFocused();
});

test('04 §8.2: the badges keep sentence case in the DOM and draw their colours from 04 §8.4', async ({ page }) => {
  await page.goto('/flow-studio/wf-onboard');
  await waitForCanvas(page);
  await openTest(page, 'Analyst, checks need attention');
  const badge = (title: string): Locator => testPanelOf(page).getByRole('listitem').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).locator('h3 + span');
  await expect(badge('Background check')).toHaveText('Failed: decision needed');
  await expect(badge('Background check')).toHaveCSS('text-transform', 'uppercase');
  await expect(badge('Background check')).toHaveCSS('color', 'rgb(190, 18, 60)');
  await expect(badge('Identity & eligibility')).toHaveCSS('color', 'rgb(180, 83, 9)');
  await expect(badge('Legal & compliance')).toHaveCSS('color', 'rgb(4, 120, 87)');
});

test('04 §2.1: ?panel=test&record= and ?panel=nova open their drawers, and Test keeps the record', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech?panel=test&record=WO-2240');
  await waitForCanvas(page);
  await expect(radioRow(page, 'Data engineer, trading data')).toHaveAttribute('aria-checked', 'true');
  await expectTestPanel(page, 'EN-023');
  await expect(page.getByText('Showing WO-2240')).toBeVisible();

  await page.goto('/flow-studio/wf-wo-sub-wo-data?panel=nova');
  await waitForCanvas(page);
  await expect(novaPanelOf(page).getByText('Nova checked this flow against 26 real records from the last 90 days.')).toBeVisible();
  await expect(novaButton(page)).toHaveAttribute('aria-pressed', 'true');

  // A record that does not fit falls back to the first that does (03 §11 item 4).
  await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech?panel=test&record=NOPE');
  await waitForCanvas(page);
  await expect(radioRow(page, 'Senior cloud engineer')).toHaveAttribute('aria-checked', 'true');
  expect(expectedPanel('EN-022').summary).toBe((await readTestPanel(page)).summary);
});

test('04 §3.1: moving workflow keeps Test and Nova open, and closes a step panel', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await novaButton(page).click();
  await openWorkflow(page, 'Work order submitted', 'Data and AI hires');
  await expect(pickerButton(page, 'Data and AI hires')).toBeVisible();
  await expect(novaPanelOf(page).getByText('Nova checked this flow against 26 real records from the last 90 days.')).toBeVisible();
  await expect.poll(() => novaCount(page)).toBe('1');

  await openStep(page, 'End');
  await openWorkflow(page, 'Data and AI hires', 'Work order submitted');
  await expect(pickerButton(page, 'Work order submitted')).toBeVisible();
  await expect(panelOf(page)).toHaveCount(0);
});

test('04 §2.5, §9: Show me brings a box at the far end to about 200 from the left, clear of the drawer', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await openStep(page, 'Tell the supplier');
  await selectButton(panelOf(page), 'Who').click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await novaButton(page).click();
  await novaPanelOf(page).getByRole('button', { name: 'Show me' }).click();
  await expect(panelOf(page).getByRole('heading', { name: 'Notify', exact: true })).toBeVisible();

  const box = await boxOf(canvasOf(page).getByRole('button', { name: 'Tell the supplier', exact: true }));
  const scroller = await boxOf(canvasOf(page));
  const drawer = await boxOf(panelOf(page));
  expect(box.x - scroller.x).toBeCloseTo(200, -1);
  expect(box.x + box.width).toBeLessThan(drawer.x);
});
