import { expect, test, type Locator, type Page } from '@playwright/test';
import { boxOf, canvasOf, freshApp, openStep, panelOf, pickerButton, signIn, waitForCanvas } from './helpers';
import { button, chip, confirmDialog, openRun, startRun } from './runtime-helpers';

/** M8: what the earlier milestones left. Colours on the run screens, the column's zoom and widths, the Record panel, and every load state. */

const shellOf = (page: Page): Locator => page.getByRole('region', { name: 'Flow Studio' });
const SLATE_950 = 'rgb(2, 6, 23)';
const CYAN_600 = 'rgb(8, 145, 178)';
const CYAN_50 = 'rgb(236, 254, 255)';
const CYAN_700 = 'rgb(14, 116, 144)';

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

test.describe('/runs and /inbox are cyan and slate-950 (AGENTS, 04 §1.2, 05 §6), and the rest of the app is not touched', () => {
  const bg = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor);

  test('the list, the run page and the inbox read their real colours', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await signIn(page, 'Owen Clarke');
    await page.goto('/runs');
    const running = page.getByRole('link', { name: /WO-2231/ }).getByText('Running', { exact: true });
    await expect(running).toHaveCSS('background-color', CYAN_50);
    await expect(running).toHaveCSS('color', CYAN_700);

    await openRun(page, id);
    await expect(chip(page, 'Running')).toHaveCSS('background-color', CYAN_50);
    const canvas = canvasOf(page);
    await expect(canvas).toBeVisible();
    expect(await canvas.evaluate((element) => getComputedStyle(element.parentElement as Element).backgroundColor)).toBe(SLATE_950);
    await expect(canvas.getByRole('button', { name: 'Business sign-off', exact: true })).toHaveCSS('background-color', 'rgb(15, 23, 42)');

    await signIn(page, 'Raj Patel');
    await page.goto('/inbox');
    await expect(page.getByRole('region', { name: 'Approvals' }).getByRole('button', { name: 'Approve' }).first()).toHaveCSS('background-color', CYAN_600);
  });

  test('negative control: the same chip goes blue if the rules can reach it again, so the assertion above can fail', async ({ page }) => {
    await startRun(page, 'WO-2231');
    await signIn(page, 'Owen Clarke');
    await page.goto('/runs');
    const running = page.getByRole('link', { name: /WO-2231/ }).getByText('Running', { exact: true });
    await expect(running).toHaveCSS('color', CYAN_700);
    // `.levv-spec` restores Tailwind's own palette; without it the brand's Levv blue takes the cyan classes.
    await running.evaluate((element) => element.closest('.levv-spec')?.classList.remove('levv-spec'));
    await expect(running).toHaveCSS('background-color', 'rgb(238, 244, 255)');
    await expect(running).toHaveCSS('color', 'rgb(30, 70, 196)');
  });

  test('every other page keeps the theme: a probe in the main of an existing page is still repainted', async ({ page }) => {
    await page.goto('/admin/users');
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
    await expect(main).toHaveClass(/\bflex-1\b/);
    const probe = async (classes: string) =>
      main.evaluate((element, name) => {
        const div = document.createElement('div');
        div.className = name;
        element.appendChild(div);
        const color = getComputedStyle(div).backgroundColor;
        div.remove();
        return color;
      }, classes);
    expect(await probe('bg-slate-950')).toBe('rgb(10, 17, 40)');
    expect(await probe('bg-cyan-600')).toBe('rgb(38, 88, 228)');
    expect(await bg(main)).toBe('rgb(243, 245, 249)');
  });

  test('the page fills the same space without the class: same box as an existing page', async ({ page }) => {
    await page.goto('/admin/users');
    const existing = await boxOf(page.locator('main').first());
    await page.goto('/inbox');
    const inbox = await boxOf(page.locator('main').first());
    expect([inbox.x, inbox.y, inbox.width]).toEqual([existing.x, existing.y, existing.width]);
    expect(await bg(page.locator('main').first())).toBe('rgb(243, 245, 249)');
  });
});

test.describe('The Record panel and a cancelled step (05 §6.2)', () => {
  const recordRow = (page: Page, label: string): Locator => page.getByRole('region', { name: 'Record' }).locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('+ dd');

  test('labels are the catalog’s and values are formatted: no field ids, no raw numbers', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await signIn(page, 'Owen Clarke');
    await openRun(page, id);
    await expect(recordRow(page, 'Total value')).toHaveText('$95K');
    await expect(recordRow(page, 'Bill rate per hour')).toHaveText('$58');
    await expect(recordRow(page, 'Rate over card %').or(recordRow(page, 'Rate above card')).or(page.getByRole('region', { name: 'Record' }).getByText('3%', { exact: true }))).toHaveCount(1);
    await expect(recordRow(page, 'Client data access')).toHaveText('No');
    await expect(recordRow(page, 'Start date')).toHaveText('16 Nov 2026');
    await expect(recordRow(page, 'Personal email')).toHaveText('wo-2231.worker@example.com');
    await expect(recordRow(page, 'Worker’s time zone')).toHaveText('America/Toronto');
    const panel = await page.getByRole('region', { name: 'Record' }).innerText();
    expect(panel).not.toMatch(/95000|worker_tz|Worker tz|personal_email|\btrue\b|\bfalse\b|2026-11-16|WO-2231\b/);
  });

  test('a stopped approval reads Cancelled, without Test’s "If rejected" wording; an answered one keeps its answer', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await signIn(page, 'Owen Clarke');
    await openRun(page, id);
    const row = page.getByRole('region', { name: 'Steps' }).getByRole('listitem').filter({ hasText: 'Business sign-off' });
    await expect(row).toContainText('If rejected');
    await button(page, 'Stop').click();
    await confirmDialog(page, 'Stop this workflow?', 'Reason', 'Withdrawn', 'Stop workflow');
    await expect(chip(page, 'Stopped')).toBeVisible();
    await expect(row).toContainText('Cancelled');
    await expect(row).not.toContainText('If rejected');
    await expect(row).not.toContainText('Reminder');
  });
});

test.describe('/admin/workflows at 0.5 zoom (M8 item 4): opening zoom for the column, Fit as 04 §4.9', () => {
  const zoomOf = (scope: Page | Locator) =>
    canvasOf(scope).getByRole('button').first().evaluate((element) => {
      const layer = element.closest('[style*="scale"]') as HTMLElement;
      return Number(/scale\(([\d.]+)\)/.exec(layer.style.transform)?.[1]);
    });

  test('embedded it opens at 0.7 or more, so a box title is at least 9 px; the full page keeps 0.5', async ({ page }) => {
    await page.goto('/admin/workflows/wf-onboard');
    const shell = shellOf(page);
    await waitForCanvas(shell);
    const zoom = await zoomOf(shell);
    expect(zoom).toBeCloseTo(0.7);
    expect(13 * zoom).toBeGreaterThanOrEqual(9);

    await page.goto('/flow-studio/wf-onboard');
    await waitForCanvas(page);
    expect(await zoomOf(page)).toBeCloseTo(0.5);
  });

  test('a workflow that fits larger than that still opens larger: the fit rule is otherwise 04’s', async ({ page }) => {
    await page.goto('/admin/workflows/wf-doc');
    const shell = shellOf(page);
    await waitForCanvas(shell);
    expect(await zoomOf(shell)).toBeGreaterThan(0.7);
  });

  test('Fit and the zoom buttons follow 04 §4.9 on the embedded route too', async ({ page }) => {
    await page.goto('/admin/workflows/wf-onboard');
    const shell = shellOf(page);
    await waitForCanvas(shell);
    await shell.getByRole('button', { name: 'Fit', exact: true }).click();
    const fitted = await zoomOf(shell);
    expect(fitted).toBeLessThan(0.7);
    expect(fitted).toBeGreaterThanOrEqual(0.35);
    const scroller = canvasOf(shell);
    const size = await scroller.evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight, scrollLeft: element.scrollLeft, scrollTop: element.scrollTop }));
    expect([size.scrollLeft, size.scrollTop]).toEqual([0, 0]);
    await shell.getByRole('button', { name: 'Zoom in', exact: true }).click();
    expect(await zoomOf(shell)).toBeCloseTo(fitted + 0.1);
  });

  test('a box pressed under the drawer moves just clear of it, with the panel open', async ({ page }) => {
    await page.goto('/admin/workflows/wf-wo-sub-wo-uk-tech');
    const shell = shellOf(page);
    await waitForCanvas(shell);
    const boxes = canvasOf(shell).getByRole('button').filter({ hasNot: page.locator('[aria-label="Add a step here"]') });
    const stage = await boxOf(shell.locator('[data-flow-studio-stage]'));
    // A box past where the drawer's left edge will be.
    let target: Locator | null = null;
    for (const candidate of await boxes.all()) {
      if ((await candidate.getAttribute('aria-label')) === 'Add a step here') continue;
      const box = await boxOf(candidate);
      if (box.x > stage.x + stage.width - 78 - 400 && box.x + box.width < stage.x + stage.width - 78) {
        target = candidate;
        break;
      }
    }
    expect(target).not.toBeNull();
    await (target as Locator).click();
    const drawer = panelOf(shell);
    await expect(drawer).toBeVisible();
    const clear = await boxOf(drawer);
    await expect.poll(async () => (await boxOf(target as Locator)).x + (await boxOf(target as Locator)).width).toBeLessThanOrEqual(clear.x);
    expect((await boxOf(target as Locator)).x).toBeGreaterThanOrEqual(stage.x);
  });

  test('the run page opens the same way and has the zoom controls', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await signIn(page, 'Owen Clarke');
    await openRun(page, id);
    expect(await zoomOf(page)).toBeGreaterThanOrEqual(0.7);
    const before = await zoomOf(page);
    await button(page, 'Zoom out').click();
    expect(await zoomOf(page)).toBeCloseTo(before - 0.1);
  });
});

test.describe('The embedded shell responds to the width it has (M8 item 5)', () => {
  async function openAt(page: Page, width: number, height = 800): Promise<Locator> {
    await page.setViewportSize({ width, height });
    await page.goto('/admin/workflows/wf-wo-sub-wo-uk-tech');
    const shell = shellOf(page);
    await waitForCanvas(shell);
    return shell;
  }

  const rail = (shell: Locator): Locator => shell.getByRole('complementary', { name: 'Digital Workers' });

  /** Nothing in the shell runs past its right edge. */
  async function expectNoOverflow(shell: Locator): Promise<void> {
    const over = await shell.evaluate((root) => {
      const limit = root.getBoundingClientRect().right + 1;
      return Array.from(root.querySelectorAll<HTMLElement>('button, a')).filter((element) => !element.closest('[role="group"]') && !element.closest('[role="dialog"]') && element.getBoundingClientRect().right > limit).map((element) => element.textContent);
    });
    expect(over).toEqual([]);
  }

  const topBarRows = async (shell: Locator): Promise<number> => {
    const tops = await Promise.all(['levv.', 'UK Technology work orders', 'Publish'].map(async (name) => {
      const target = name === 'levv.' ? shell.getByRole('link', { name }) : name === 'Publish' ? shell.getByRole('button', { name, exact: true }) : pickerButton(shell, name);
      const box = await boxOf(target);
      return Math.round(box.y + box.height / 2);
    }));
    return new Set(tops.map((top) => Math.round(top / 10))).size;
  };

  test('at 1440 and 1320 it is the full layout, on one line, with the rail', async ({ page }) => {
    for (const width of [1440, 1320]) {
      const shell = await openAt(page, width);
      await expect(rail(shell)).toBeVisible();
      expect(await topBarRows(shell)).toBe(1);
      await expectNoOverflow(shell);
    }
  });

  test('at 1100 it is not the phone layout: two rows at most, the drawer beside the canvas with its box in view', async ({ page }) => {
    const shell = await openAt(page, 1100);
    expect((await boxOf(page.locator('[data-flow-studio-host]'))).width).toBeLessThan(720);
    expect(await topBarRows(shell)).toBeLessThanOrEqual(2);
    await expectNoOverflow(shell);
    await expect(rail(shell)).toHaveCount(0);

    const stage = await boxOf(shell.locator('[data-flow-studio-stage]'));
    const scroller = await boxOf(canvasOf(shell));
    expect(scroller.width).toBeCloseTo(stage.width, -1);

    await openStep(shell, 'Business sign-off');
    const panel = panelOf(shell);
    await expect(panel).toBeVisible();
    const drawer = await boxOf(panel);
    expect(drawer.width).toBe(390);
    expect(stage.x + stage.width - (drawer.x + drawer.width)).toBeCloseTo(11, -1);
    const box = canvasOf(shell).getByRole('button', { name: 'Business sign-off', exact: true });
    await expect.poll(async () => (await boxOf(box)).x + (await boxOf(box)).width).toBeLessThanOrEqual(drawer.x);
    await expect.poll(async () => (await boxOf(box)).x).toBeGreaterThanOrEqual(stage.x - 1);
    await expect(panel.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // The picker opens inside the shell, and the top-bar drawers fit.
    await pickerButton(shell, 'UK Technology work orders').click();
    const list = shell.getByRole('listbox');
    await expect(list).toBeVisible();
    const listBox = await boxOf(list);
    const host = await boxOf(page.locator('[data-flow-studio-host]'));
    expect(listBox.x + listBox.width).toBeLessThanOrEqual(host.x + host.width);
    await page.keyboard.press('Escape');
    await shell.getByRole('button', { name: 'Test', exact: true }).click();
    await expect(shell.getByRole('dialog', { name: 'Test' })).toBeVisible();
    await expect(shell.getByRole('button', { name: 'Hide', exact: true })).toHaveCount(1);
  });

  test('at 1200 the same layout has room to spare, and the stage is taller than it was with three rows', async ({ page }) => {
    const shell = await openAt(page, 1250);
    expect(await topBarRows(shell)).toBeLessThanOrEqual(2);
    await expectNoOverflow(shell);
    const stage = await boxOf(shell.locator('[data-flow-studio-stage]'));
    const host = await boxOf(page.locator('[data-flow-studio-host]'));
    expect(host.height - stage.height).toBeLessThanOrEqual(110);
  });

  test('a long status and a long name wrap rather than push anything off', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto('/admin/workflows/wf-wo-sub-wo-uk-tech?step=T');
    const shell = shellOf(page);
    await waitForCanvas(shell);
    await panelOf(shell).getByLabel('Name', { exact: true }).fill('A very long name for a workflow, to see what the picker does with it');
    await expect(shell.getByText(/unpublished changes/).first()).toBeVisible();
    await expectNoOverflow(shell);
    await expect(shell.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
  });

  test('where a drawer really cannot sit beside anything, it is still 04 §2.5’s sheet', async ({ page }) => {
    // The narrowest desktop shell: below 1024 the app sidebar becomes a drawer and the column widens.
    const shell = await openAt(page, 1030);
    expect((await boxOf(page.locator('[data-flow-studio-host]'))).width).toBeLessThan(500);
    await openStep(shell, 'Business sign-off');
    const drawer = await boxOf(panelOf(shell));
    const stage = await boxOf(shell.locator('[data-flow-studio-stage]'));
    expect(drawer.width).toBeCloseTo(stage.width - 20, -1);
  });

  test('the full page does not change: below 720 it is the phone layout, as 04 §2.5 says', async ({ page }) => {
    await page.setViewportSize({ width: 660, height: 800 });
    await page.goto('/flow-studio/wf-wo-sub-wo-uk-tech');
    await waitForCanvas(page);
    await expect(rail(page.locator('body'))).toHaveCount(0);
    await openStep(page, 'Business sign-off');
    const drawer = await boxOf(panelOf(page));
    expect(drawer.width).toBeGreaterThan(390);
  });
});

test.describe('Loading and failing: never blank, never a status or a code (M8 item 2)', () => {
  const failing = async (page: Page, glob: string, status: number, body?: unknown): Promise<void> => {
    await page.route(glob, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body ?? {}) }));
  };
  const held = async (page: Page, glob: string): Promise<() => void> => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(glob, async (route) => {
      await gate;
      await route.continue();
    });
    return release;
  };
  const RAW = /\b(500|503|INTERNAL|NOT_SEEDED|UNAUTHENTICATED|Internal Server Error|undefined|null)\b/;

  test('Flow Studio: skeleton while loading with the buttons off, then a plain sentence on failure (04 §2.1)', async ({ page }) => {
    const release = await held(page, '**/api/flow-studio/engine-context');
    await page.goto('/flow-studio/wf-wo-sub');
    await expect(page.locator('[data-flow-studio-stage] .animate-pulse')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    release();
    await waitForCanvas(page);

    await page.unroute('**/api/flow-studio/engine-context');
    await failing(page, '**/api/flow-studio/engine-context', 500, { error: { code: 'INTERNAL', message: 'Something went wrong.' } });
    await page.goto('/flow-studio/wf-wo-sub');
    await expect(page.locator('[data-flow-studio-stage]').getByRole('alert')).toHaveText('Flow Studio couldn’t load. Reload the page to try again.');
    expect(await page.locator('[data-flow-studio-stage]').innerText()).not.toMatch(RAW);
  });

  test('Flow Studio on a tenant with nothing seeded says so, and who to ask', async ({ page }) => {
    await failing(page, '**/api/flow-studio/engine-context', 503, { error: { code: 'NOT_SEEDED', message: 'Flow Studio has no data for this tenant yet. Run npm run seed:flow-studio.' } });
    await page.goto('/admin/workflows/wf-wo-sub');
    await expect(shellOf(page).getByRole('alert')).toHaveText('Flow Studio isn’t set up for this organisation yet. Contact Levv support to load its workflows.');
  });

  test('a failed read of one workflow is not "not found"', async ({ page }) => {
    await failing(page, '**/api/flow-studio/workflows/wf-wo-sub', 500);
    await page.goto('/flow-studio/wf-wo-sub');
    await expect(page.locator('[data-flow-studio-stage]').getByRole('alert')).toHaveText('Flow Studio couldn’t load. Reload the page to try again.');
  });

  for (const [path, route, title] of [
    ['/runs', '**/api/runtime/runs', 'Running workflows'],
    ['/inbox', '**/api/runtime/inbox', 'Inbox'],
  ] as const) {
    test(`${path}: says it is loading, then a plain sentence on failure, then sign-in when the session has gone`, async ({ page }) => {
      await signIn(page, 'Owen Clarke');
      const release = await held(page, route);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'Loading…' })).toBeVisible();
      release();
      await expect(page.getByText('Loading…')).toHaveCount(0);

      await page.unroute(route);
      await failing(page, route, 500, { error: { code: 'INTERNAL', message: 'Something went wrong.' } });
      await page.goto(path);
      await expect(page.getByText('This page couldn’t load. Reload the page to try again.')).toBeVisible();
      expect(await page.locator('main').last().innerText()).not.toMatch(RAW);

      await page.unroute(route);
      await failing(page, route, 401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
      // A real session is still there, so the login page then sends it on: the request is what shows it was asked for.
      const toLogin = page.waitForRequest((request) => /\/auth\/login\?next=/.test(request.url()));
      await page.goto(path);
      await toLogin;
    });
  }

  test('/runs/[id] and /inbox/[id]: loading says so; a run that does not exist says so in words', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await signIn(page, 'Owen Clarke');
    const release = await held(page, `**/api/runtime/runs/${id}`);
    await page.goto(`/runs/${id}`);
    await expect(page.getByRole('status').filter({ hasText: 'Loading…' })).toBeVisible();
    release();
    await expect(page.getByRole('region', { name: 'History' })).toBeVisible();

    await page.goto('/runs/no-such-run');
    await expect(page.getByText('This doesn’t exist.').or(page.getByText(/doesn’t exist/))).toBeVisible();

    await page.goto('/inbox/no-such-item');
    await expect(page.getByText(/no longer|doesn’t exist|gone/i)).toBeVisible();
  });

  test('a write that fails for want of a connection says so, on a dialog and on a card, with no "someone else" and no status', async ({ page }) => {
    const id = await startRun(page, 'WO-2231');
    await signIn(page, 'Owen Clarke');
    await openRun(page, id);
    await page.route(`**/api/runtime/runs/${id}/pause`, (route) => route.abort());
    await button(page, 'Pause').click();
    const dialog = page.getByRole('dialog', { name: 'Pause this workflow?' });
    await button(dialog, 'Pause workflow').click();
    await expect(dialog.getByRole('alert')).toHaveText('Couldn’t save that change. Check your connection and try again.');
    await page.keyboard.press('Escape');

    await signIn(page, 'Raj Patel');
    await page.goto('/inbox');
    await page.route('**/api/runtime/work-items/*/decide', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    const card = page.getByRole('region', { name: 'Approvals' }).getByRole('article').first();
    await button(card, 'Approve').click();
    await expect(card.getByRole('alert')).toHaveText('Couldn’t save that change. Check your connection and try again.');
  });

  test('a seeded tenant with no workflows at all does not sit on the skeleton', async ({ page }) => {
    await page.route('**/api/flow-studio/engine-context', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json()), workflows: [] } });
    });
    await page.goto('/flow-studio');
    await expect(page.locator('[data-flow-studio-stage]').getByRole('alert')).toHaveText('Flow Studio isn’t set up for this organisation yet. Contact Levv support to load its workflows.');
  });
});

test('copy pass: no straight quote or apostrophe on any panel, Test, Nova or Publish, in any workflow', async ({ page }) => {
  test.setTimeout(300_000);
  const STRAIGHT = /['"]/;
  const list = (await (await page.request.get('/api/flow-studio/workflows')).json()) as { id: string }[];
  const found: string[] = [];
  const read = async (where: string, scope: Locator): Promise<void> => {
    const text = await scope.evaluate((element) => {
      const lines: string[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) lines.push(walker.currentNode.textContent ?? '');
      for (const field of Array.from(element.querySelectorAll('[placeholder]'))) lines.push(field.getAttribute('placeholder') ?? '');
      return lines;
    });
    for (const line of text) if (STRAIGHT.test(line)) found.push(`${where}: ${line}`);
  };
  for (const { id } of list) {
    await page.goto(`/flow-studio/${id}`);
    const canvas = await waitForCanvas(page);
    await read(`${id} canvas`, canvas);
    const boxes = canvas.getByRole('button');
    const names = await boxes.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label') ?? ''));
    for (let index = 0; index < names.length; index += 1) {
      if (names[index] === 'Add a step here') continue;
      await boxes.nth(index).click();
      const panel = panelOf(page);
      const folded = panel.locator('details:not([open]) > summary');
      while ((await folded.count()) > 0) await folded.first().click();
      await read(`${id} / ${names[index]}`, panel);
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: 'Test', exact: true }).click();
    await read(`${id} Test`, page.getByRole('dialog', { name: 'Test' }));
    await page.getByRole('button', { name: /^Nova/ }).click();
    await read(`${id} Nova`, page.getByRole('dialog', { name: 'Nova' }));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await read(`${id} Publish`, page.getByRole('dialog', { name: /^Publish/ }));
    await page.keyboard.press('Escape');
  }
  expect(found).toEqual([]);
});
