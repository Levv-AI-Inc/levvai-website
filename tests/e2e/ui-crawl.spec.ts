import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasOf, choose, freshApp, panelOf, selectButton, waitForCanvas } from './helpers';

/** 06 UI-NP-01, as written. */

const FORBIDDEN = 'select, input[type=radio], input[type=checkbox], [role=radio], [role=checkbox], [aria-pressed]';

async function inspect(panel: Locator): Promise<void> {
  const details = panel.locator('details:not([open]) > summary');
  while ((await details.count()) > 0) await details.first().click();
  await expect(panel.locator(FORBIDDEN)).toHaveCount(0);
}

async function closeDrawer(page: Page): Promise<void> {
  await panelOf(page).getByRole('button', { name: 'Close' }).click();
  await expect(panelOf(page)).toHaveCount(0);
}

test('UI-NP-01 crawl every step panel of every workflow', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await freshApp(page);

  const list = (await (await page.request.get('/api/flow-studio/workflows')).json()) as { id: string }[];
  expect(list).toHaveLength(15);
  let boxes = 0;
  for (const { id } of list) {
    await page.goto(`/flow-studio/${id}`);
    const canvas = await waitForCanvas(page);
    const buttons = canvas.getByRole('button').filter({ hasNot: page.getByText('+', { exact: true }) });
    const names = await buttons.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label') ?? ''));
    const steps = names.map((name, index) => ({ name, index })).filter(({ name }) => name !== 'Add a step here');
    for (const { index } of steps) {
      await buttons.nth(index).click();
      const panel = panelOf(page);
      await expect(panel).toHaveCount(1);
      await inspect(panel);
      await closeDrawer(page);
      boxes += 1;
    }
  }
  expect(boxes).toBe(159);

  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await canvasOf(page).getByRole('button', { name: 'Add a step here', exact: true }).first().click();
  await inspect(panelOf(page));
  await closeDrawer(page);

  await canvasOf(page).getByRole('button', { name: 'Rate over card?', exact: true }).click();
  await panelOf(page).getByRole('button', { name: '+ Add a path' }).click();
  await inspect(panelOf(page));
  await closeDrawer(page);

  await canvasOf(page).getByRole('button', { name: 'Business sign-off', exact: true }).click();
  await choose(panelOf(page), 'Who approves', 'An approval group');
  await inspect(panelOf(page));
  await choose(panelOf(page), 'Who approves', 'A named person');
  await expect(selectButton(panelOf(page), 'Person')).toBeVisible();
  await inspect(panelOf(page));

  await page.goto('/flow-studio/wf-wo-sub-wo-data');
  await waitForCanvas(page);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^Publish/ });
  await expect(dialog).toBeVisible();
  await inspect(dialog);
  await expect(dialog.getByRole('button', { name: /Which one should run\?/ })).toHaveAttribute('aria-haspopup', 'listbox');

  expect(errors).toEqual([]);
});
