import { expect, test, type Page } from '@playwright/test';
import { boxOf, canvasOf, freshApp, norm, openStep, pickerButton, readBoxes, waitForCanvas } from './helpers';

/** 06 B.1, UI-N1 to UI-N4. UI-N5 and UI-N6 are in ui-panels.spec.ts. */

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

async function expectNoSettings(page: Page): Promise<void> {
  await expect(page.locator('text=Settings')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Settings/ })).toHaveCount(0);
  await expect(page.locator('text=Approval rules')).toHaveCount(0);
}

test('UI-N1 lands on a workflow; no Settings', async ({ page, context }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);

  const banner = page.getByRole('banner');
  const logo = banner.getByRole('link', { name: 'levv.' });
  const chip = banner.getByText('Flows', { exact: true });
  const picker = pickerButton(banner, 'Work order submitted');
  const status = banner.getByText('Live v1', { exact: true });
  const nova = banner.getByRole('button', { name: 'Nova' });
  const testButton = banner.getByRole('button', { name: 'Test' });
  const publish = banner.getByRole('button', { name: 'Publish' });

  await expect(chip).not.toHaveAttribute('title');
  await expect(picker).toHaveAttribute('aria-haspopup', 'listbox');
  await expect(picker.locator('svg')).toBeVisible();
  await expect(nova).toContainText('0');
  await expect(nova.locator('svg')).toBeVisible();
  await expect(testButton.locator('svg')).toBeVisible();

  const order = [logo, chip, picker, status, nova, testButton, publish];
  let previous = -1;
  for (const item of order) {
    const { x } = await boxOf(item);
    expect(x).toBeGreaterThan(previous);
    previous = x;
  }

  await expectNoSettings(page);

  // The canvas shows Work order submitted (UI-N3 has the whole list).
  await expect(canvasOf(page).getByRole('button', { name: 'Business sign-off', exact: true })).toBeVisible();

  // With a remembered workflow, /flow-studio opens that one.
  await page.goto('/flow-studio');
  await expect(page).toHaveURL(/\/flow-studio\/wf-wo-sub$/);

  // With empty localStorage: the first live workflow in picker order.
  const { cookies } = await context.storageState();
  const fresh = await context.browser()!.newContext({ baseURL: test.info().project.use.baseURL, storageState: { cookies, origins: [] }, viewport: { width: 1440, height: 900 } });
  const second = await fresh.newPage();
  await second.goto('/flow-studio');
  await expect(second).toHaveURL(/\/flow-studio\/wf-jp$/);
  await expect(pickerButton(second, 'Job posting created')).toBeVisible();
  await expectNoSettings(second);
  await fresh.close();
});

test('UI-N2 the picker lists workflows and their variations', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  const button = pickerButton(page, 'Work order submitted');
  await button.click();

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();

  const read = await listbox.evaluate((list) => {
    const leaf = (element: Element): string[] => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const out: string[] = [];
      while (walker.nextNode()) if (walker.currentNode.textContent?.trim()) out.push(walker.currentNode.textContent.trim());
      return out;
    };
    const items: { type: 'heading' | 'row'; lines: string[]; left: number; current: string | null }[] = [];
    list.querySelectorAll('[role="option"], [role="presentation"]').forEach((element) => {
      if (element.getAttribute('role') === 'option') {
        const text = Array.from(element.querySelectorAll('span')).find((span) => span.textContent?.trim());
        items.push({ type: 'row', lines: leaf(element), left: (text ?? element).getBoundingClientRect().left, current: element.getAttribute('aria-current') });
      } else if (!element.querySelector('[role="option"]')) {
        items.push({ type: 'heading', lines: leaf(element), left: 0, current: null });
      }
    });
    return items;
  });

  const expected: [string | null, string, string][] = [
    ['Job posting · Created', 'Job posting created', 'Everywhere'],
    ['Work order · Submitted', 'Work order submitted', 'Everywhere'],
    [null, 'UK Technology work orders', 'UK · Technology'],
    [null, 'Data and AI hires', 'Data'],
    ['Work order · Changed', 'Work order changed', 'Everywhere'],
    ['SOW · Created', 'SOW created', 'Everywhere'],
    ['SOW · Change order submitted', 'SOW change order submitted', 'Everywhere'],
    ['Onboarding · Starts', 'Contractor onboarding', 'Everywhere'],
    ['Assignment · Changed', 'Assignment changed', 'Everywhere'],
    ['Assignment · End date in 30 days', 'Assignment ending', 'Everywhere'],
    ['Offboarding · Starts', 'Contractor offboarding', 'Everywhere'],
    ['Access request · Submitted', 'Site access request', 'Everywhere'],
    ['Timesheet · Submitted', 'Timesheet submitted', 'Everywhere'],
    ['Invoice · Received', 'Invoice received', 'Everywhere'],
    ['Worker · Document expiring in 30 days', 'Document renewal', 'Everywhere'],
  ];
  const flat: string[] = [];
  for (const [heading, name, second] of expected) {
    if (heading) flat.push(`H ${heading}`);
    flat.push(`R ${name} | ${second}`);
  }
  // Exactly one footer entry after the last workflow, and nothing else.
  flat.push('R + New workflow');
  expect(read.map((item) => `${item.type === 'heading' ? 'H' : 'R'} ${item.lines.join(' | ')}`)).toEqual(flat);
  expect(read.filter((item) => item.type === 'heading')).toHaveLength(13);

  // Drawn in capitals by CSS, sentence case in textContent.
  await expect(listbox.getByText('Job posting · Created', { exact: true })).toHaveCSS('text-transform', 'uppercase');

  const row = (name: string) => read.find((item) => item.lines[0] === name);
  expect(row('UK Technology work orders')!.left).toBeGreaterThan(row('Work order submitted')!.left);
  expect(row('Data and AI hires')!.left).toBeGreaterThan(row('Work order submitted')!.left);
  expect(read.filter((item) => item.current === 'true').map((item) => item.lines[0])).toEqual(['Work order submitted']);
  await expect(listbox.locator('text=Approval rules')).toHaveCount(0);
  await expect(listbox.locator('text=Settings')).toHaveCount(0);
  await expect(listbox.getByRole('button', { name: /delete/i })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(listbox).toHaveCount(0);
  await expect(button).toBeFocused();

  await button.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await button.click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('UI-N2 keyboard: Up, Down, Enter and click outside (04 §3)', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  const button = pickerButton(page, 'Work order submitted');
  await button.click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/flow-studio\/wf-wo-sub-wo-uk-tech$/);
  await expect(pickerButton(page, 'UK Technology work orders')).toBeVisible();

  await pickerButton(page, 'UK Technology work orders').click();
  await page.mouse.click(700, 700);
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('UI-N3 approvals are on the canvas', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await expect(canvasOf(page).getByRole('button', { name: 'End', exact: true })).toBeVisible();

  const boxes = await readBoxes(page);
  expect(boxes.map((box) => box.text).sort()).toEqual(
    [
      'Work order submitted | Everywhere',
      'Tell the supplier | Supplier account manager',
      'End | Completed',
      'Business sign-off | Together: Hiring manager + Cost center owner',
      'Rate over card? | Over 10% | → Rate review | Otherwise | carries on',
      'Rate review | Procurement',
      'Value band | Over $1M | → Executive sign-off | Over $250K | → Finance sign-off | Otherwise | carries on',
      'Finance sign-off | Finance business partner',
      'Executive sign-off | In order: VP Finance + CFO',
      'Flagged | Passed | Budget check | If flagged: approvers see it',
      'Flagged | Passed | Duplicate & ghost worker | If flagged: escalate to Procurement',
      'Duplicate found: escalation | Procurement',
    ].sort(),
  );

  const at = (name: string) => boxes.find((box) => box.name === name)!;
  const mainLine = ['Budget check', 'Duplicate & ghost worker', 'Business sign-off', 'Rate over card?', 'Rate review', 'Value band', 'Finance sign-off', 'Tell the supplier', 'End'];
  for (let i = 1; i < mainLine.length; i += 1) expect(at(mainLine[i]).x).toBeGreaterThan(at(mainLine[i - 1]).x);
  expect(at('Executive sign-off').x).toBe(at('Finance sign-off').x);

  // The Flagged line of Duplicate & ghost worker goes to the escalation box, which continues to Business sign-off.
  const edges = await canvasOf(page).locator('svg path[data-from]').evaluateAll((paths) => paths.map((path) => `${path.getAttribute('data-from')}>${path.getAttribute('data-to')}`));
  expect(edges).toContain('RA_CD>RA_CDe');
  expect(edges).toContain('RA_CDe>RA_A1');
  expect(at('Duplicate found: escalation').y).toBeLessThan(at('Duplicate & ghost worker').y);

  await expect(page.getByRole('button', { name: /Request approval/ })).toHaveCount(0);
  await expect(page.locator('text=Request approval')).toHaveCount(0);
  await openStep(page, 'Business sign-off');
  await expect(page).toHaveURL(/\/flow-studio\/wf-wo-sub\?step=RA_A1$/);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('UI-N4 an Approve step explains itself', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await openStep(page, 'Business sign-off');
  const panel = page.getByRole('dialog');
  await expect(panel.getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
  await expect(panel.getByText('Business sign-off', { exact: true })).toBeVisible();

  const name = panel.getByLabel('Name');
  await expect(name).toHaveValue('Business sign-off');
  const who = panel.getByRole('button', { name: 'Who approves' });
  await expect(who).toHaveText('Roles');
  await expect(who).toHaveAttribute('aria-haspopup', 'listbox');
  const sentence = panel.getByText(/approve, together\./);
  expect(norm((await sentence.textContent()) ?? '')).toBe('Hiring manager, Cost center owner approve, together. Levv finds the right person for each request.');
  const roles = panel.getByRole('button', { name: 'Roles', exact: true });
  await expect(roles).toHaveText('Hiring manager, Cost center owner');
  const howMany = panel.getByRole('button', { name: 'How many' });
  await expect(howMany).toHaveText('Everyone, together');
  const note = panel.getByText('Approvers get a brief', { exact: false });
  expect(norm((await note.textContent()) ?? '')).toBe("Approvers get a brief: what's asked, what changed, and the result of any checks earlier on the line.");
  const chaser = panel.getByText('Chaser', { exact: true });
  const advanced = panel.locator('details');
  await expect(advanced.locator('summary')).toHaveText('Advanced');
  await expect(advanced).not.toHaveAttribute('open');
  const remove = panel.getByRole('button', { name: 'Delete this step' });

  const order = [name, who, sentence, roles, howMany, note, chaser, advanced.locator('summary'), remove];
  let previous = -1;
  for (const item of order) {
    const { y } = await boxOf(item);
    expect(y).toBeGreaterThan(previous);
    previous = y;
  }
});

test('04 §4.7, §14: Escape closes the panel and focus returns to the box; ?step opens it', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await openStep(page, 'Business sign-off');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(canvasOf(page).getByRole('button', { name: 'Business sign-off', exact: true })).toBeFocused();
  await expect(page).toHaveURL(/\/flow-studio\/wf-wo-sub$/);

  await page.goto('/flow-studio/wf-wo-sub?step=T');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Workflow settings' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('04 §2.1: unknown workflow shows the message and a way out', async ({ page }) => {
  await page.goto('/flow-studio/no-such-workflow');
  await expect(page.getByText('This workflow doesn’t exist or you don’t have access to it.')).toBeVisible();
  await page.getByRole('button', { name: 'Open Work order submitted' }).click();
  await expect(page).toHaveURL(/\/flow-studio\/wf-wo-sub$/);
  await waitForCanvas(page);
});

test('No Settings button, Settings page or “Approval rules ›” on any of the 15 workflows, in the DOM', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  for (const id of ['wf-jp', 'wf-wo-sub', 'wf-wo-sub-wo-uk-tech', 'wf-wo-sub-wo-data', 'wf-wo-chg', 'wf-sow-sub', 'wf-sow-co', 'wf-onboard', 'wf-asn-chg', 'wf-ending', 'wf-offboard', 'wf-access', 'wf-ts-sub', 'wf-invoice', 'wf-doc']) {
    await page.goto(`/flow-studio/${id}`);
    await waitForCanvas(page);
    await expectNoSettings(page);
    await page.getByRole('banner').locator('[aria-haspopup="listbox"]').click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await expectNoSettings(page);
    await expect(page.locator('text=Approval rules ›')).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
  const html = await page.content();
  expect(html).not.toContain('Approval rules ›');
});
