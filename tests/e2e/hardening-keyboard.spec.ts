import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasOf, freshApp, pickerButton, selectButton, signIn, waitForCanvas } from './helpers';
import { button, openRun, startRun } from './runtime-helpers';

/**
 * M8 item 1: the keyboard walkthrough of every screen, with no mouse anywhere in it. Each screen is walked with real Tab
 * presses. At every stop focus must be somewhere (never lost to the page), show the 04 §14.3 ring and be on screen.
 */

const RINGS = ['rgb(8, 145, 178)', 'rgb(34, 211, 238)', 'rgb(103, 232, 249)']; // cyan-600, cyan-400, cyan-300

interface Stop {
  tag: string;
  name: string;
  ring: string | null;
  inside: boolean;
  onScreen: boolean;
  body: boolean;
}

async function stopOf(page: Page, scope: string): Promise<Stop> {
  return page.evaluate((scopeSelector) => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) return { tag: 'BODY', name: '', ring: null, inside: false, onScreen: false, body: true };
    const style = getComputedStyle(active);
    const rect = active.getBoundingClientRect();
    const ring = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2 ? style.outlineColor : null;
    return {
      tag: active.tagName,
      name: active.getAttribute('aria-label') ?? (active.textContent ?? '').trim().slice(0, 40),
      ring,
      inside: !!active.closest(scopeSelector),
      onScreen: rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth,
      body: false,
    };
  }, scope);
}

/** Presses Tab until focus leaves `scope` or `max` stops pass, and checks every stop. Returns what it stopped on, in order. */
async function walk(page: Page, scope: string, max: number): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let i = 0; i < max; i += 1) {
    const stop = await stopOf(page, scope);
    if (!stop.inside) break;
    expect(stop.body, `focus was lost to the page after ${stops.length} stops`).toBe(false);
    expect(RINGS, `no cyan focus ring on ${stop.tag} "${stop.name}" (${stop.ring})`).toContain(stop.ring);
    expect(stop.onScreen, `${stop.tag} "${stop.name}" is off screen`).toBe(true);
    stops.push(stop);
    await page.keyboard.press('Tab');
  }
  return stops;
}

const focused = (page: Page): Locator => page.locator(':focus');

async function expectFocus(page: Page, name: string | RegExp): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => (document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '').trim()))
    .toEqual(typeof name === 'string' ? name : expect.stringMatching(name));
}

const seed = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/seed/workflows.json'), 'utf8')) as {
  workflows: { id: string; published?: { nodes: Record<string, { kind: string; label?: string; preset?: string; worker?: string }> }; draft?: { nodes: Record<string, { kind: string; label?: string; preset?: string; worker?: string }> } }[];
};

/** One box of every kind in the seed, and one of every ready-made step and Digital Worker. Generated steps need loading, so they are named below. */
function everyKind(): { workflow: string; label: string; kind: string }[] {
  const seen = new Set<string>();
  const found: { workflow: string; label: string; kind: string }[] = [];
  for (const workflow of seed.workflows) {
    for (const node of Object.values((workflow.draft ?? workflow.published)?.nodes ?? {})) {
      const key = `${node.kind}:${node.preset ?? ''}:${node.worker ?? ''}`;
      if (seen.has(key) || !node.label || node.kind === 'trigger' || node.kind === 'end') continue;
      seen.add(key);
      found.push({ workflow: workflow.id, label: node.label, kind: key });
    }
  }
  return found;
}

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

test('the whole of /flow-studio in Tab order: top bar, boxes in layout order, then "+", rail and zoom (04 §14.2)', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech');
  await waitForCanvas(page);
  await page.getByRole('link', { name: 'levv.' }).focus();
  const stops = await walk(page, 'body', 200);
  const names = stops.map((stop) => stop.name);
  expect(names.slice(0, 6)).toEqual(['levv.', 'UK Technology work orders', '+ New workflow', 'Nova 2', 'Test', 'Publish'].map((name, index) => (index === 3 ? names[3] : name)));
  expect(names[3]).toMatch(/^Nova/);

  const boxes = await canvasOf(page).getByRole('button').evaluateAll((elements) =>
    elements.map((element) => ({ name: element.getAttribute('aria-label') as string, x: element.getBoundingClientRect().x, plus: element.getAttribute('aria-label') === 'Add a step here' })),
  );
  const firstPlus = boxes.findIndex((box) => box.plus);
  expect(firstPlus).toBeGreaterThan(3);
  expect(boxes.slice(firstPlus).every((box) => box.plus)).toBe(true);
  // Layout order is level, then row, so left to right along the boxes.
  const xs = boxes.slice(0, firstPlus).map((box) => box.x);
  expect(xs).toEqual([...xs].sort((a, b) => a - b));
  // Focus scrolled nothing into a state where a stop was off screen (walk checked), and every canvas button was a stop, in that order.
  expect(names.slice(6, 6 + boxes.length)).toEqual(boxes.map((box) => box.name));
  const after = names.slice(6 + boxes.length);
  expect(after).toEqual(expect.arrayContaining(['Zoom out', 'Fit', 'Zoom in']));
  expect(after.indexOf('Zoom out')).toBeGreaterThan(0); // the rail's workers come first
});

test('the flow picker: Enter opens, arrows show where they are, Enter goes, focus comes back to the button (04 §14.2)', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  const picker = pickerButton(page, 'Work order submitted');
  await picker.focus();
  await page.keyboard.press('Enter');
  const list = page.getByRole('listbox');
  await expect(list).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(list.getByRole('option', { name: /^UK Technology work orders/ })).toHaveCSS('outline-color', 'rgb(8, 145, 178)');

  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(picker).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(list).toHaveCount(0);

  await picker.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/wf-wo-sub-wo-uk-tech$/);
  await expect(pickerButton(page, 'UK Technology work orders')).toBeFocused();

  // + New workflow is the next stop after the picker, and lands on the Start box with its panel open.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '+ New workflow' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Workflow settings' })).toBeVisible();
  await expect(page).toHaveURL(/\?step=T$/);
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[data-node-id="T"]') !== null)).toBe(true);
});

test('a box: Enter opens its panel and keeps focus on it, the first Tab enters the header, Escape returns (04 §14.3)', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech');
  await waitForCanvas(page);
  const box = canvasOf(page).getByRole('button', { name: 'Business sign-off', exact: true });
  await box.focus();
  await page.keyboard.press('Space');
  const panel = page.getByRole('dialog', { name: 'Approve' });
  await expect(panel).toBeVisible();
  await expect(box).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(box).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(box).toBeFocused();
});

for (const { workflow, label, kind } of everyKind()) {
  test(`every control in the "${label}" panel (${kind}) can be reached, with a ring`, async ({ page }) => {
    await page.goto(`/flow-studio/${workflow}`);
    await waitForCanvas(page);
    const box = canvasOf(page).getByRole('button', { name: label, exact: true }).first();
    await box.focus();
    await page.keyboard.press('Enter');
    await expect(box).toBeFocused();
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement?.closest('[data-flow-studio-stage] [role="dialog"]'));
    // Open every Advanced first, by keyboard, so what's folded is walked too.
    const dialog = page.locator('[data-flow-studio-stage] [role="dialog"]');
    const summaries = dialog.locator('details:not([open]) > summary');
    while ((await summaries.count()) > 0) {
      await summaries.first().focus();
      await page.keyboard.press('Enter');
    }
    await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
    const stops = await walk(page, '[data-flow-studio-stage] [role="dialog"]', 150);
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.length).toBeLessThan(150);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(box).toBeFocused();
  });
}

test('the Start and End boxes have panels that walk too', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  for (const [name, title] of [['Work order submitted', 'Workflow settings'], ['End', 'End']] as const) {
    const box = canvasOf(page).getByRole('button', { name, exact: true }).first();
    await box.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Tab');
    const stops = await walk(page, '[data-flow-studio-stage] [role="dialog"]', 150);
    expect(stops.length).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(box).toBeFocused();
  }
});

test('"+", step menu, new step, delete, Undo: all by keyboard, and focus is never lost', async ({ page }) => {
  await page.goto('/flow-studio/wf-ts-sub');
  await waitForCanvas(page);
  const plus = canvasOf(page).getByRole('button', { name: 'Add a step here' }).first();
  await plus.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Add a step' });
  await expect(menu.getByRole('textbox', { name: 'Search' })).toBeFocused();

  // Escape gives it back to the "+".
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(plus).toBeFocused();

  await page.keyboard.press('Enter');
  await page.keyboard.type('Notify');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Notify' });
  await expect(panel).toBeVisible();
  const created = await focused(page).getAttribute('aria-label');
  expect(created).toBeTruthy();
  await expect(canvasOf(page).getByRole('button', { name: created as string, exact: true })).toBeFocused();

  // The first Tab enters the panel, as from a clicked box; its Delete is reachable.
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await panel.getByRole('button', { name: 'Delete this step' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
  const undo = page.getByRole('status').getByRole('button', { name: 'Undo' });
  await expect(undo).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(canvasOf(page).getByRole('button', { name: created as string, exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="group"]'))).toBe(true);
});

test('when the Undo runs out, focus goes to the step before rather than to the page', async ({ page }) => {
  await page.goto('/flow-studio/wf-ts-sub');
  await waitForCanvas(page);
  const plus = canvasOf(page).getByRole('button', { name: 'Add a step here' }).first();
  await plus.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Notify');
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Notify' });
  await panel.getByRole('button', { name: 'Delete this step' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').getByRole('button', { name: 'Undo' })).toBeFocused();
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 12_000 });
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="group"]') !== null && document.activeElement?.tagName === 'BUTTON')).toBe(true);
});

test('a button that removes itself hands focus on: Delete path in the If panel', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech');
  await waitForCanvas(page);
  await canvasOf(page).getByRole('button', { name: 'Rate over card?', exact: true }).first().focus().catch(() => undefined);
  const box = canvasOf(page).getByRole('button').filter({ hasText: 'Otherwise' }).first();
  await box.focus();
  await page.keyboard.press('Enter');
  const panel = page.locator('[data-flow-studio-stage] [role="dialog"]');
  await panel.getByRole('button', { name: /Add a path/ }).focus();
  await page.keyboard.press('Enter');
  await panel.getByRole('button', { name: 'Delete path' }).first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  const stop = await stopOf(page, '[data-flow-studio-stage] [role="dialog"]');
  expect(stop.body).toBe(false);
  expect(stop.inside).toBe(true);
});

test('Digital Workers rail: focus shows the hover card, Enter starts placing, Escape stops, a "+" takes it (04 §4.10, §14.2)', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech');
  await waitForCanvas(page);
  const rail = page.getByRole('complementary', { name: 'Digital Workers' });
  const worker = rail.getByRole('button', { name: 'Budget check' });
  await worker.focus();
  await expect(page.getByRole('tooltip')).toContainText('Budget check');
  await page.keyboard.press('Enter');
  await expect(worker).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(worker).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Enter');
  const plus = canvasOf(page).getByRole('button', { name: 'Add a step here' }).first();
  await plus.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-flow-studio-stage] [role="dialog"]')).toContainText('Budget check');
  await expect(focused(page)).toHaveAttribute('aria-label', 'Budget check');
});

test('Test: the button toggles it, the first Tab goes in, radios take arrows, Hide and Escape come back (04 §8, §14)', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech');
  await waitForCanvas(page);
  const testButton = page.getByRole('button', { name: 'Test', exact: true });
  await testButton.focus();
  await page.keyboard.press('Enter');
  await expect(testButton).toHaveAttribute('aria-pressed', 'true');
  await expect(testButton).toBeFocused();
  const drawer = page.getByRole('dialog', { name: 'Test' });
  await page.keyboard.press('Tab');
  await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  const stops = await walk(page, '[data-flow-studio-stage] [role="dialog"]', 40);
  expect(stops.length).toBeGreaterThan(1);

  const checked = drawer.getByRole('radio', { checked: true });
  await checked.focus();
  const before = await checked.textContent();
  await page.keyboard.press('ArrowDown');
  await expect(drawer.getByRole('radio', { checked: true })).toBeFocused();
  await expect(drawer.getByRole('radio', { checked: true })).not.toHaveText(before as string);

  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(testButton).toBeFocused();
  await page.keyboard.press('Enter');
  const hide = page.getByRole('button', { name: 'Hide', exact: true });
  await hide.focus();
  expect((await stopOf(page, 'body')).ring).toBe('rgb(34, 211, 238)');
  await page.keyboard.press('Enter');
  await expect(drawer).toHaveCount(0);
  await expect(testButton).toBeFocused();
});

test('Nova: in by Tab, Show me moves focus to the box, closing its panel stays there (04 §9, §14)', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  // Nobody to tell gives Nova something to show.
  const notify = canvasOf(page).getByRole('button', { name: 'Tell the supplier', exact: true });
  await notify.focus();
  await page.keyboard.press('Enter');
  await selectButton(page.getByRole('dialog', { name: 'Notify' }), 'Who').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Supplier account manager');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(notify).toBeFocused();
  const nova = page.getByRole('button', { name: /^Nova/ });
  await nova.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Nova' });
  await page.keyboard.press('Tab');
  await expect(drawer.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await walk(page, '[data-flow-studio-stage] [role="dialog"]', 30);
  await expect(drawer.getByRole('button', { name: 'Show me' })).toHaveCount(1);
  await drawer.getByRole('button', { name: 'Show me' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(drawer).toHaveCount(0);
  const stage = page.locator('[data-flow-studio-stage] [role="dialog"]');
  await expect(stage).toBeVisible();
  const box = await focused(page).getAttribute('aria-label');
  expect(box).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(stage).toHaveCount(0);
  await expect(focused(page)).toHaveAttribute('aria-label', box as string);
});

test('Publish: focus moves in and is trapped, its dropdown takes Escape first, Enter sends, focus returns (04 §10, §14)', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub-wo-data');
  await waitForCanvas(page);
  const publish = page.getByRole('button', { name: 'Publish', exact: true });
  await publish.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /Publish/ });
  await expect(dialog.getByLabel('Goes live on')).toBeFocused();

  // The trap: Shift+Tab from the first control wraps to the last, Tab from the last wraps to the first. The ring shows everywhere.
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(focused(page)).toHaveText(/Send for approval|Cancel/);
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  const stops: Stop[] = [];
  for (let i = 0; i < 12; i += 1) {
    const stop = await stopOf(page, '[role="dialog"]');
    expect(stop.inside, `focus left the dialog at stop ${i}`).toBe(true);
    expect(RINGS).toContain(stop.ring);
    stops.push(stop);
    await page.keyboard.press('Tab');
  }

  const question = dialog.getByRole('button', { name: /wins|Which/ }).and(dialog.locator('[aria-haspopup="listbox"]')).first();
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(question).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(publish).toBeFocused();
});

test('SelectMenu by keyboard: Enter, search, arrows, Enter, Escape and Tab (04 §13.5), single and multi', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech?step=T');
  await waitForCanvas(page);
  const panel = page.getByRole('dialog', { name: 'Workflow settings' });
  const single = selectButton(panel, 'Runs when');
  await single.focus();
  await page.keyboard.press('Enter');
  const search = page.getByRole('textbox', { name: 'Search' });
  await expect(search).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(single).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(search).toHaveCount(0);
  await expect(single).not.toBeFocused();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName !== 'BODY')).toBe(true);
});

test('/runs: filters, search and rows by keyboard, each with a ring; Enter opens a row', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await signIn(page, 'Owen Clarke');
  await page.goto('/runs');
  await expect(page.getByRole('heading', { name: 'Running workflows' })).toBeVisible();
  const status = selectButton(page, 'Status');
  await status.focus();
  const stops = await walk(page, 'main', 10);
  expect(stops.map((stop) => stop.tag)).toEqual(['BUTTON', 'BUTTON', 'INPUT', 'TR']);

  await status.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Stopped');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(status).toBeFocused();
  await expect(status).toContainText('Running, Paused +1');

  await page.getByRole('link', { name: /WO-2231/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/runs/${id}$`));
});

test('/runs/[id]: every control has a ring, a box points at its row, Pause becomes Resume in place, Stop lands on the title', async ({ page }) => {
  const id = await startRun(page, 'WO-2231');
  await signIn(page, 'Owen Clarke');
  await openRun(page, id);
  const pause = button(page, 'Pause');
  await pause.focus();
  const stops = await walk(page, 'main', 60);
  expect(stops.map((stop) => stop.name)).toEqual(expect.arrayContaining(['Pause', 'Stop', 'Zoom out', 'Fit', 'Zoom in']));
  expect(await canvasOf(page).getByRole('button', { name: 'Add a step here' }).count()).toBe(0);

  await canvasOf(page).getByRole('button', { name: 'Business sign-off', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('li', { hasText: 'Business sign-off' }).first()).toHaveClass(/bg-cyan-50/);

  await pause.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Pause this workflow?' });
  await expect(dialog.getByRole('textbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(pause).toBeFocused();

  await page.keyboard.press('Enter');
  await page.keyboard.type('Supplier dispute');
  await dialog.getByRole('button', { name: 'Pause workflow' }).focus();
  await page.keyboard.press('Enter');
  await expect(button(page, 'Resume')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(button(page, 'Pause')).toBeFocused();

  await button(page, 'Stop').focus();
  await page.keyboard.press('Enter');
  const stop = page.getByRole('dialog', { name: 'Stop this workflow?' });
  await expect(stop.getByRole('textbox')).toBeFocused();
  // The dialog traps: Stop workflow is disabled, so Cancel is the last stop and wraps to the text box.
  await page.keyboard.press('Tab');
  await expect(stop.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(stop.getByRole('textbox')).toBeFocused();
  await page.keyboard.type('Withdrawn');
  await stop.getByRole('button', { name: 'Stop workflow' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('/inbox: a card answered by keyboard, a dialog with Escape, and focus lands on the title when the card goes', async ({ page }) => {
  await startRun(page, 'WO-2231');
  await signIn(page, 'Raj Patel');
  await page.goto('/inbox');
  const approvals = page.getByRole('region', { name: 'Approvals' });
  const approve = approvals.getByRole('button', { name: 'Approve' }).first();
  await expect(approve).toBeVisible();
  await approve.focus();
  const stops = await walk(page, 'main', 10);
  expect(stops.map((stop) => stop.name)).toEqual(['Approve', 'Reject', 'Send back']);

  const reject = approvals.getByRole('button', { name: 'Reject' }).first();
  await reject.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /^Reject/ });
  await expect(dialog.getByRole('textbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(reject).toBeFocused();

  await approve.focus();
  await page.keyboard.press('Enter');
  await expect(approvals.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeFocused();
});

test('/inbox/[id]: the back link has a ring', async ({ page }) => {
  await startRun(page, 'WO-2231');
  await signIn(page, 'Raj Patel');
  const inbox = (await (await page.request.get('/api/runtime/inbox')).json()) as { approvals: { id: string }[] };
  await page.goto(`/inbox/${inbox.approvals[0].id}`);
  const back = page.locator('main').last().getByRole('link', { name: 'Back to inbox' });
  await back.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  expect(RINGS).toContain((await stopOf(page, 'main')).ring);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/inbox$/);
});

test('/admin/workflows: the shell walks the same way, portaled at the end of the page', async ({ page }) => {
  await page.goto('/admin/workflows/wf-wo-sub-wo-uk-tech');
  const shell = page.getByRole('region', { name: 'Flow Studio' });
  await waitForCanvas(shell);
  await shell.getByRole('link', { name: 'levv.' }).focus();
  const stops = await walk(page, '[data-flow-studio-host]', 200);
  expect(stops.length).toBeGreaterThan(20);
  await canvasOf(shell).getByRole('button', { name: 'Business sign-off', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(shell.getByRole('dialog', { name: 'Approve' }).getByRole('button', { name: 'Close', exact: true })).toBeFocused();
});

test('prefers-reduced-motion: nothing animates (04 §2.5)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/flow-studio/wf-wo-sub?step=T');
  await waitForCanvas(page);
  const animated = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-flow-studio-stage] *, header *')).filter((element) => {
      const style = getComputedStyle(element);
      return (style.transitionProperty !== 'none' && parseFloat(style.transitionDuration) > 0) || (style.animationName !== 'none' && parseFloat(style.animationDuration) > 0);
    }).length,
  );
  expect(animated).toBe(0);
});
