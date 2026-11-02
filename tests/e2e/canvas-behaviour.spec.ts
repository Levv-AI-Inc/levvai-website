import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { boxOf, canvasOf, freshApp, norm, waitForCanvas } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

const SCALE = /scale\(([\d.]+)\)/;
const zoomOf = async (page: import('@playwright/test').Page): Promise<number> => {
  const transform = await canvasOf(page).locator('[style*="scale("]').first().getAttribute('style');
  return Number(SCALE.exec(transform ?? '')?.[1]);
};

test('04 §4.9: zoom −, Fit and +, with the clamp; opening fits with a minimum of 0.5', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  // W = 2706 at 1440 wide, so the fit is below 0.5 and opening clamps there.
  await expect.poll(() => zoomOf(page)).toBe(0.5);

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => zoomOf(page)).toBe(0.6);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => zoomOf(page)).toBe(0.5);

  for (let i = 0; i < 15; i += 1) await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => zoomOf(page)).toBe(1.4);
  for (let i = 0; i < 15; i += 1) await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => zoomOf(page)).toBe(0.35);

  await page.getByRole('button', { name: 'Fit' }).click();
  const fitted = await zoomOf(page);
  const viewport = await canvasOf(page).evaluate((element) => ({ width: element.clientWidth, left: element.scrollLeft, top: element.scrollTop }));
  expect(fitted).toBeCloseTo((viewport.width - 30) / 2706, 5);
  expect(viewport.left).toBe(0);
  expect(viewport.top).toBe(0);
});

const RAILS: [string, string[]][] = [
  ['wf-wo-sub', ['Tenure & classification', 'Rate check', 'Budget check', 'Duplicate & ghost worker', 'Job posting writer', 'Invoice match']],
  ['wf-onboard', ['Document collector', 'Access provisioner', 'Start-date guardian']],
  ['wf-offboard', ['Access sweeper', 'Equipment recovery', 'Final pay closer']],
  ['wf-access', ['Duplicate & ghost worker', 'Document collector', 'Access provisioner']],
];

test('04 §4.10: the rail shows the context’s Digital Workers, in order, never the Chaser', async ({ page }) => {
  for (const [id, names] of RAILS) {
    await page.goto(`/flow-studio/${id}`);
    await waitForCanvas(page);
    const rail = page.getByRole('complementary', { name: 'Digital Workers' });
    await expect(rail).toBeVisible();
    await expect(rail.getByRole('button')).toHaveText(names);
    await expect(rail.locator('text=Chaser')).toHaveCount(0);
  }
});

test('04 §4.10: the hover card, and only while hovering', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toHaveCount(0);

  const rate = page.getByRole('complementary', { name: 'Digital Workers' }).getByRole('button', { name: 'Rate check' });
  await rate.hover();
  await expect(tooltip).toContainText('Rate check');
  await expect(tooltip).toContainText('Compares the bill rate with your rate card and the market.');
  await expect(tooltip).toContainText('Put it on the line before an approver. Two exits: Passed and Flagged.');
  await expect(tooltip).toContainText('It never approves or rejects. If it isn’t sure, a person decides.');
  await expect(tooltip).not.toContainText('Needs a connection first');
  const tip = await boxOf(tooltip);
  const item = await boxOf(rate);
  expect(tip.x + tip.width).toBeLessThanOrEqual(item.x);

  await page.getByRole('complementary', { name: 'Digital Workers' }).getByRole('button', { name: 'Invoice match' }).hover();
  await expect(tooltip).toContainText('Needs a connection first');

  await page.mouse.move(300, 700);
  await expect(tooltip).toHaveCount(0);
});

test('04 §4.10, §4.11: placing mode, its hint chip and Escape', async ({ page }) => {
  await page.goto('/flow-studio/wf-onboard');
  await waitForCanvas(page);
  const rail = page.getByRole('complementary', { name: 'Digital Workers' });
  const worker = rail.getByRole('button', { name: 'Document collector' });
  await worker.click();
  await expect(worker).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Click a + to place Document collector, or click a Collect & verify step to make it the checker')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(worker).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(/Click a \+ to place/)).toHaveCount(0);

  await rail.getByRole('button', { name: 'Start-date guardian' }).click();
  await expect(page.getByText('Click a + to place Start-date guardian', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText(/Click a \+ to place/)).toHaveCount(0);
});

test('04 §4.1 rule 6: a Failed exit goes above and Done keeps the main line; text stays Done, Failed', async ({ page }) => {
  await page.goto('/flow-studio/wf-doc');
  await waitForCanvas(page);
  const canvas = canvasOf(page);
  const step = await boxOf(canvas.getByRole('button', { name: 'Renewed document', exact: true }));
  const escalation = await boxOf(canvas.getByRole('button', { name: 'Renewed document failed: escalation', exact: true }));
  const end = await boxOf(canvas.getByRole('button', { name: 'End', exact: true }));
  expect(end.y).toBe(step.y);
  expect(escalation.y).toBeLessThan(step.y);
  await expect(canvas.locator('[data-node-id="RN"]').getByText('Failed', { exact: true })).toBeVisible();
  const done = await boxOf(canvas.locator('[data-node-id="RN"]').getByText('Done', { exact: true }));
  const failed = await boxOf(canvas.locator('[data-node-id="RN"]').getByText('Failed', { exact: true }));
  expect(failed.y).toBeLessThan(done.y);
});

/** Graphs the seed and the prototype agree on: no generated "failed: escalation" boxes, no rule-6 fix in play. */
const SAME_AS_PROTOTYPE = ['wf-wo-sub', 'wf-wo-sub-wo-uk-tech', 'wf-wo-sub-wo-data', 'wf-wo-chg', 'wf-asn-chg', 'wf-ending', 'wf-invoice', 'wf-jp', 'wf-sow-sub', 'wf-sow-co', 'wf-ts-sub'];

test('04 §4.1 and CODEX_PROMPT M4: node positions equal the reference prototype, 11 workflows', async ({ page, context }) => {
  const prototype = await context.newPage();
  await prototype.goto(pathToFileURL(join(__dirname, '..', '..', 'docs', 'flow-studio', 'reference', 'flow-studio-v35.html')).href);
  for (const id of SAME_AS_PROTOTYPE) {
    const theirs = await prototype.evaluate((workflowId) => {
      const open = (window as unknown as { openFlow: (flowId: string) => void }).openFlow;
      open(workflowId);
      return Array.from(document.querySelectorAll('#cinner [data-node]')).map((element) => {
        const style = (element as HTMLElement).style;
        return `${element.getAttribute('data-node')} ${parseFloat(style.left)},${parseFloat(style.top)}`;
      });
    }, id);
    await page.goto(`/flow-studio/${id}`);
    await waitForCanvas(page);
    const ours = await canvasOf(page).locator('[data-node-id]').evaluateAll((elements) =>
      elements.map((element) => {
        const style = (element as HTMLElement).style;
        return `${element.getAttribute('data-node-id')} ${parseFloat(style.left)},${parseFloat(style.top)}`;
      }),
    );
    expect(ours.sort(), id).toEqual(theirs.sort());
  }
  await prototype.close();
});

const ALL_WORKFLOWS = [...SAME_AS_PROTOTYPE, 'wf-onboard', 'wf-offboard', 'wf-access', 'wf-doc'];

test('box titles and subtitles equal the reference prototype on all 15 workflows', async ({ page, context }) => {
  const prototype = await context.newPage();
  await prototype.goto(pathToFileURL(join(__dirname, '..', '..', 'docs', 'flow-studio', 'reference', 'flow-studio-v35.html')).href);
  const differences: string[] = [];
  for (const id of ALL_WORKFLOWS) {
    const theirs = await prototype.evaluate((workflowId) => {
      (window as unknown as { openFlow: (flowId: string) => void }).openFlow(workflowId);
      return Array.from(document.querySelectorAll('#cinner [data-node]'))
        .filter((element) => element.querySelector('.nl'))
        .map((element) => ({
          id: element.getAttribute('data-node') as string,
          title: element.querySelector('.nl b')?.textContent ?? '',
          subtitle: element.querySelector('.nl span')?.textContent ?? '',
        }));
    }, id);
    await page.goto(`/flow-studio/${id}`);
    await waitForCanvas(page);
    for (const box of theirs) {
      const wrapper = canvasOf(page).locator(`[data-node-id="${box.id}"]`);
      const label = wrapper.locator('div.pointer-events-none span');
      const ours = (await label.allTextContents()).map(norm);
      const expected = [norm(box.title), norm(box.subtitle)];
      if (ours.join(' | ') !== expected.join(' | ')) differences.push(`${id}/${box.id}: ours ${ours.join(' | ')} / prototype ${expected.join(' | ')}`);
    }
  }
  await prototype.close();
  expect(differences).toEqual([]);
});
