import { expect, test, type Page } from '@playwright/test';
import { fortySteps } from '../support/forty-steps';
import { canvasOf, panelOf, pickerButton, resetApp, signIn, waitForCanvas } from './helpers';
import { eventFor, SERVICE_TOKEN } from './runtime-helpers';

/**
 * M8 item 3, in a real browser on the production build. Latency is the browser's own Event Timing: from the input to the
 * next paint, entries of 16 ms and up. No fake clock here, because a frozen clock would distort it. Numbers print as PERF lines.
 *
 * Limits: 200 ms is Core Web Vitals' "good" for an interaction, and the prompt's "edits smoothly" has no number of its own.
 */

const INTERACTION_LIMIT_MS = 200;
const LIST_READY_LIMIT_MS = 3000;

async function watchInteractions(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: { name: string; duration: number }[] = [];
    (window as unknown as { __interactions: typeof seen }).__interactions = seen;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) seen.push({ name: entry.name, duration: entry.duration });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
}

/** Lets the observer's queue drain, then hands back and clears what it saw. */
async function interactions(page: Page, kinds: string[]): Promise<number[]> {
  await page.waitForTimeout(150);
  return page.evaluate((names) => {
    const store = (window as unknown as { __interactions: { name: string; duration: number }[] }).__interactions;
    const durations = store.filter((entry) => names.includes(entry.name)).map((entry) => entry.duration);
    store.length = 0;
    return durations;
  }, kinds);
}

const worst = (values: number[]): number => (values.length === 0 ? 0 : Math.max(...values));

function report(name: string, value: number, unit = 'ms'): void {
  console.log(`PERF ${name}: ${Math.round(value)} ${unit}`);
}

async function since(run: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await run();
  return Date.now() - start;
}

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await signIn(page, 'Flow Admin');
  await watchInteractions(page);
});

test('a 40-step workflow loads, and edits stay within 200 ms an interaction, in the panel and on the canvas', async ({ page }) => {
  test.setTimeout(120_000);
  const loaded = (await (await page.request.get('/api/flow-studio/workflows/wf-wo-sub')).json()) as { workflow: { draft: { nodes: unknown } }; draftRev: number };
  loaded.workflow.draft.nodes = fortySteps();
  expect((await page.request.put('/api/flow-studio/workflows/wf-wo-sub/draft', { data: { draft: loaded.workflow, draftRev: loaded.draftRev } })).status()).toBe(200);

  const opening = await since(async () => {
    await page.goto('/flow-studio/wf-wo-sub');
    await waitForCanvas(page);
  });
  report('40 steps: page to canvas', opening);
  const boxes = canvasOf(page).getByRole('button').filter({ hasNotText: '+' });
  await expect(boxes).toHaveCount(42);

  await canvasOf(page).getByRole('button', { name: 'Sign-off 4', exact: true }).click();
  const name = panelOf(page).getByLabel('Name', { exact: true });
  await name.click();
  await interactions(page, []);
  await page.keyboard.type(' edited by keyboard');
  const typing = await interactions(page, ['keydown', 'keypress', 'input', 'keyup']);
  report('40 steps: worst keystroke in a panel', worst(typing));
  report('40 steps: keystrokes over 16 ms', typing.length, `of ${' edited by keyboard'.length * 4} events`);
  expect(worst(typing)).toBeLessThan(INTERACTION_LIMIT_MS);
  await expect(canvasOf(page).getByRole('button', { name: 'Sign-off 4 edited by keyboard', exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await interactions(page, []);
  const plus = canvasOf(page).getByRole('button', { name: 'Add a step here' }).nth(20);
  await plus.click();
  await page.getByRole('textbox', { name: 'Search' }).fill('Notify');
  await page.keyboard.press('Enter');
  await expect(canvasOf(page).getByRole('button').filter({ hasNotText: '+' })).toHaveCount(43);
  const inserting = await interactions(page, ['click', 'pointerup', 'keydown', 'keyup', 'input']);
  report('40 steps: worst interaction inserting a step', worst(inserting));
  expect(worst(inserting)).toBeLessThan(INTERACTION_LIMIT_MS);

  await page.keyboard.press('Escape');
  await interactions(page, []);
  await page.getByRole('button', { name: 'Test', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Test' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('radio', { checked: true }).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const testing = await interactions(page, ['click', 'pointerup', 'keydown', 'keyup']);
  report('40 steps: worst interaction opening Test and changing record', worst(testing));
  expect(worst(testing)).toBeLessThan(INTERACTION_LIMIT_MS);
});

test('the picker at 500 workflows opens, moves and navigates', async ({ page }) => {
  test.setTimeout(300_000);
  const creating = await since(async () => {
    for (let i = 0; i < 500; i += 1) expect((await page.request.post('/api/flow-studio/workflows', { data: { fromWorkflowId: 'wf-wo-sub' } })).status()).toBe(201);
  });
  report('picker: creating 500 workflows through the route', creating);

  const opening = await since(async () => {
    await page.goto('/flow-studio/wf-wo-sub');
    await waitForCanvas(page);
  });
  report('picker: page to canvas with 515 workflows', opening);
  expect(opening).toBeLessThan(LIST_READY_LIMIT_MS);

  await interactions(page, []);
  await pickerButton(page, 'Work order submitted').click();
  const list = page.getByRole('listbox');
  await expect(list.getByRole('option')).toHaveCount(515);
  const open = await interactions(page, ['click', 'pointerup']);
  report('picker: worst interaction opening it', worst(open));
  expect(worst(open)).toBeLessThan(INTERACTION_LIMIT_MS);

  for (let i = 0; i < 30; i += 1) await page.keyboard.press('ArrowDown');
  const moving = await interactions(page, ['keydown', 'keyup']);
  report('picker: worst arrow key', worst(moving));
  expect(worst(moving)).toBeLessThan(INTERACTION_LIMIT_MS);

  const lastDraft = await list.getByRole('option').nth(514).textContent();
  await list.getByRole('option').nth(514).scrollIntoViewIfNeeded();
  await list.getByRole('option').nth(514).click();
  await expect(page).not.toHaveURL(/wf-wo-sub$/);
  await waitForCanvas(page);
  expect(lastDraft).toBeTruthy();

  // A keystroke in a panel, with lint reading all 515.
  await canvasOf(page).getByRole('button').first().click();
  const name = panelOf(page).getByRole('textbox').first();
  await name.click();
  await interactions(page, []);
  await page.keyboard.type('renamed');
  const typing = await interactions(page, ['keydown', 'keypress', 'input', 'keyup']);
  report('picker: worst keystroke in a panel with 515 workflows', worst(typing));
  expect(worst(typing)).toBeLessThan(INTERACTION_LIMIT_MS);
});

test('the inbox and the runs list at 500 items load, stay responsive, and an answer takes one off', async ({ page }) => {
  test.setTimeout(300_000);
  const posting = await since(async () => {
    for (let i = 0; i < 500; i += 1) {
      const event = eventFor('WO-2231');
      const recordId = `WO-P${i}`;
      const response = await page.request.post('/api/runtime/events', { headers: SERVICE_TOKEN, data: { ...event, recordId, data: { ...event.data, id: recordId } } });
      expect(response.status()).toBe(200);
    }
  });
  report('inbox: posting 500 events', posting);

  await signIn(page, 'Raj Patel');
  const answer = await since(async () => {
    const response = await page.request.get('/api/runtime/inbox');
    expect(response.status()).toBe(200);
    expect(((await response.json()) as { approvals: unknown[] }).approvals).toHaveLength(500);
  });
  report('inbox: route answer with 500 items', answer);

  const approvals = page.getByRole('region', { name: 'Approvals' });
  const loading = await since(async () => {
    await page.goto('/inbox');
    await expect(approvals.getByRole('article')).toHaveCount(500);
  });
  report('inbox: page to 500 cards', loading);
  expect(loading).toBeLessThan(LIST_READY_LIMIT_MS);

  const answering = await since(async () => {
    await approvals.getByRole('button', { name: 'Approve' }).first().click();
    await expect(approvals.getByRole('article')).toHaveCount(499);
  });
  report('inbox: Approve to the list showing 499', answering);
  expect(answering).toBeLessThan(LIST_READY_LIMIT_MS);
  const clicking = await interactions(page, ['click', 'pointerup']);
  report('inbox: worst interaction', worst(clicking));
  expect(worst(clicking)).toBeLessThan(INTERACTION_LIMIT_MS);

  await signIn(page, 'Owen Clarke');
  const runs = await since(async () => {
    await page.goto('/runs');
    // The one answered above has finished, and the default filter is Running and Paused.
    await expect(page.getByRole('link', { name: /WO-P/ })).toHaveCount(499);
  });
  report('runs: page to 499 rows', runs);
  expect(runs).toBeLessThan(LIST_READY_LIMIT_MS);
  await page.getByRole('searchbox', { name: 'Record' }).click();
  await interactions(page, []);
  await page.keyboard.type('WO-P10');
  await expect(page.getByRole('link', { name: /WO-P/ })).toHaveCount(11);
  const filtering = await interactions(page, ['keydown', 'keypress', 'input', 'keyup']);
  report('runs: worst keystroke filtering 500 rows', worst(filtering));
  expect(worst(filtering)).toBeLessThan(INTERACTION_LIMIT_MS);
});
