import { expect, test, type Locator, type Page } from '@playwright/test';
import { boxOf, boxText, canvasOf, choose, expectSaved, freshApp, nextSave, norm, novaCount, openStep, optionTexts, panelOf, pickerButton, plusAfter, selectButton, signIn, toastOf, waitForCanvas } from './helpers';
import { expectTestPanel, novaButton, novaPanelOf, openTest, publishButton, publishDialog, readNova, testButton, testPanelOf } from './test-panel';

/** The user's actual request: a Workflows tab in Admin settings that opens the shared shell (decision 1). */

const SLATE_950 = 'rgb(2, 6, 23)';
const SLATE_900 = 'rgb(15, 23, 42)';
const CYAN_600 = 'rgb(8, 145, 178)';
const CYAN_400 = 'rgb(34, 211, 238)';
const RAIL = 'rgb(12, 18, 32)';

const shellOf = (page: Page): Locator => page.getByRole('region', { name: 'Flow Studio' });
const stageOf = (page: Page): Locator => page.locator('[data-flow-studio-stage]');
const adminNav = (page: Page): Locator => page.locator('aside').filter({ hasText: 'Admin settings' });

async function openEmbedded(page: Page, path = '/admin/workflows/wf-wo-sub'): Promise<Locator> {
  await page.goto(path);
  const shell = shellOf(page);
  await waitForCanvas(shell);
  return shell;
}

async function expectPinned(page: Page): Promise<void> {
  // A polled comparison: the shell follows the placeholder across animation frames.
  await expect
    .poll(async () => {
      const host = await boxOf(page.locator('[data-flow-studio-host]'));
      const placeholder = await boxOf(page.locator('[data-flow-studio-placeholder]'));
      return [host.x - placeholder.x, host.y - placeholder.y, host.width - placeholder.width, host.height - placeholder.height];
    })
    .toEqual([0, 0, 0, 0]);
}

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

test('the tab appears in the Admin settings nav after Approval Chains', async ({ page }) => {
  await openEmbedded(page);
  const labels = await adminNav(page).getByRole('link').allTextContents();
  expect(labels[labels.indexOf('Approval Chains') + 1]).toBe('Workflows');
  expect(labels).toEqual(['Users', 'Company', 'Roles', 'Approval Groups', 'Supplier Network', 'Approval Chains', 'Workflows', 'Financial', 'Rates', 'Suppliers', 'Workers', 'Compliance Policies', 'Tenant Docs', 'Integrations', 'Configuration']);
});

test('clicking the tab opens a workflow on the canvas, and the tab reads as active on both routes', async ({ page }) => {
  await page.goto('/admin/users');
  await page.waitForLoadState('domcontentloaded');
  const tab = adminNav(page).getByRole('link', { name: 'Workflows', exact: true });
  await tab.click();
  await expect(page).toHaveURL(/\/admin\/workflows\/wf-jp$/);
  const shell = shellOf(page);
  await waitForCanvas(shell);
  await expect(pickerButton(shell, 'Job posting created')).toBeVisible();
  await expect(canvasOf(shell).getByRole('button', { name: 'Send to suppliers', exact: true })).toBeVisible();

  // Polled: the highlight fades (`transition` on the link) when it moves from Users. Levv blue-50 fill, blue-700 text.
  const ACTIVE_FILL = 'rgb(238, 244, 255)';
  await expect(tab).toHaveCSS('background-color', ACTIVE_FILL);
  await expect(tab).toHaveCSS('color', 'rgb(30, 70, 196)');
  await expect(tab).toHaveAttribute('aria-current', 'page');
  const users = adminNav(page).getByRole('link', { name: 'Users', exact: true });
  await expect(users).not.toHaveCSS('background-color', ACTIVE_FILL);
  await expect(users).not.toHaveAttribute('aria-current', 'page');

  await page.goto('/admin/workflows');
  await expect(page).toHaveURL(/\/admin\/workflows\/wf-jp$/);
  await waitForCanvas(shellOf(page));
  await expect(adminNav(page).getByRole('link', { name: 'Workflows', exact: true })).toHaveCSS('background-color', ACTIVE_FILL);
});

test('the dark stage is really slate-950 and the accent really cyan: the globals.css overrides do not reach the shell', async ({ page }) => {
  const shell = await openEmbedded(page);
  const stage = stageOf(page);
  await expect(stage).toHaveCSS('background-color', SLATE_950);

  const publish = shell.getByRole('button', { name: 'Publish' });
  await expect(publish).toHaveCSS('background-color', CYAN_600);
  await expect(publish).toHaveCSS('border-top-color', CYAN_600);
  await expect(publish).toHaveCSS('color', 'rgb(255, 255, 255)');

  const canvas = canvasOf(shell);
  await expect(canvas.getByRole('button', { name: 'Business sign-off', exact: true })).toHaveCSS('background-color', SLATE_900);
  await expect(canvas.getByRole('button', { name: 'Business sign-off', exact: true }).locator('svg')).toHaveCSS('color', CYAN_400);
  await expect(shell.getByRole('complementary', { name: 'Digital Workers' })).toHaveCSS('background-color', RAIL);
  await expect(shell).toHaveCSS('background-color', 'rgb(241, 245, 249)');

  // Not inside any <main>: that is what the override selectors need.
  expect(await stage.evaluate((element) => element.closest('main'))).toBeNull();

  // The test can tell: the same class inside the admin <main> does get repainted.
  const probe = await page.locator('[data-flow-studio-placeholder]').evaluate((element) => {
    const div = document.createElement('div');
    div.className = 'bg-slate-950';
    element.appendChild(div);
    const color = getComputedStyle(div).backgroundColor;
    div.remove();
    return color;
  });
  expect(probe).not.toBe(SLATE_950);
});

test('the same colours on the full page', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await expect(stageOf(page)).toHaveCSS('background-color', SLATE_950);
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCSS('background-color', CYAN_600);
  await expect(page.locator('text=Admin settings')).toHaveCount(0);
});

test('at 1440×900 it fills the 904×772 column and overlaps neither the admin sidebar nor the app navigation', async ({ page }) => {
  await openEmbedded(page);
  const host = await boxOf(page.locator('[data-flow-studio-host]'));
  expect(host).toEqual({ x: 504, y: 96, width: 904, height: 772 });

  const aside = await boxOf(adminNav(page));
  const header = await boxOf(page.locator('header').first());
  const appNav = await boxOf(page.locator('aside').first());
  expect(host.x).toBeGreaterThanOrEqual(aside.x + aside.width);
  expect(host.x).toBeGreaterThanOrEqual(appNav.x + appNav.width);
  expect(host.y).toBeGreaterThanOrEqual(header.y + header.height);

  // The page itself does not scroll under the canvas.
  const scroll = await page.evaluate(() => [document.documentElement.scrollHeight, document.documentElement.clientHeight, document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll[0]).toBe(scroll[1]);
  expect(scroll[2]).toBe(scroll[3]);
});

test('the admin sidebar stays visible and usable', async ({ page }) => {
  await openEmbedded(page);
  const nav = adminNav(page);
  await expect(nav.getByText('Admin settings')).toBeVisible();

  // Every link is the topmost thing at its own centre.
  for (const link of await nav.getByRole('link').all()) {
    const box = await boxOf(link);
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('a')?.textContent ?? null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(hit).toBe(await link.textContent());
  }

  await nav.getByRole('link', { name: 'Roles', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/roles$/);
  // Leaving takes the portal with it, and the column gets its padding back.
  await expect(page.locator('[data-flow-studio-host]')).toHaveCount(0);

  await page.locator('aside').filter({ hasText: 'Admin settings' }).getByRole('link', { name: 'Workflows', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/workflows\/wf-/);
  await waitForCanvas(shellOf(page));
});

test('the app’s account menu opens over the shell', async ({ page }) => {
  await openEmbedded(page);
  await page.locator('header').first().getByRole('button', { name: /Flow Admin/ }).click();
  const signOut = page.getByRole('button', { name: /Sign out/i }).or(page.getByRole('menuitem', { name: /Sign out/i })).first();
  await expect(signOut).toBeVisible();
  const box = await boxOf(signOut);
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-flow-studio-host]') !== null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(hit).toBe(false);
});

test('it is usable in the column: top bar on one row, picker, panel, scrolling to the End box', async ({ page }) => {
  const shell = await openEmbedded(page, '/admin/workflows/wf-wo-sub-wo-uk-tech');
  const host = await boxOf(page.locator('[data-flow-studio-host]'));

  const bar = [
    shell.getByRole('link', { name: 'levv.' }),
    shell.getByText('Flows', { exact: true }),
    pickerButton(shell, 'UK Technology work orders'),
    shell.getByText('Live v3', { exact: true }),
    shell.getByRole('button', { name: 'Nova' }),
    shell.getByRole('button', { name: 'Test' }),
    shell.getByRole('button', { name: 'Publish' }),
  ];
  const stage = await boxOf(stageOf(page));
  let previousRight = host.x;
  for (const item of bar) {
    const box = await boxOf(item);
    expect(box.x).toBeGreaterThanOrEqual(previousRight);
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y);
    previousRight = box.x + box.width;
  }
  expect(previousRight).toBeLessThanOrEqual(host.x + host.width);

  // The picker fits in the window.
  await bar[2].click();
  const picker = await boxOf(shell.getByRole('listbox'));
  expect(picker.x + picker.width).toBeLessThanOrEqual(1440);
  expect(picker.y + picker.height).toBeLessThanOrEqual(900);
  await page.keyboard.press('Escape');

  // A drawer leaves the rail and part of the canvas free.
  const canvas = canvasOf(shell);
  await canvas.getByRole('button', { name: 'Budget check', exact: true }).click();
  const drawer = await boxOf(shell.getByRole('dialog'));
  expect(drawer.width).toBe(390);
  const rail = await boxOf(shell.getByRole('complementary', { name: 'Digital Workers' }));
  expect(drawer.x + drawer.width).toBeLessThanOrEqual(rail.x);
  expect(drawer.x).toBeGreaterThan(stage.x + 300);
  await shell.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

  // Everything can be reached by scrolling, also the last box.
  const end = canvas.getByRole('button', { name: 'End', exact: true });
  await end.scrollIntoViewIfNeeded();
  const endBox = await boxOf(end);
  expect(endBox.x + endBox.width).toBeLessThanOrEqual(rail.x);
  await end.click();
  await expect(shell.getByRole('dialog').getByRole('heading', { name: 'End', exact: true })).toBeVisible();
});

test('a long name and the longest status still fit on one row', async ({ page }) => {
  const found = await page.request.get('/api/flow-studio/workflows/wf-wo-sub');
  const { workflow, draftRev } = (await found.json()) as { workflow: Record<string, unknown>; draftRev: number };
  const saved = await page.request.put('/api/flow-studio/workflows/wf-wo-sub/draft', {
    data: { draftRev, draft: { ...workflow, name: 'A very long workflow name that keeps going well past what the bar can hold on one row' } },
  });
  expect(saved.status()).toBe(200);

  const shell = await openEmbedded(page);
  const status = shell.getByText('Live v1 · unpublished changes', { exact: true });
  await expect(status).toBeVisible();
  const publish = await boxOf(shell.getByRole('button', { name: 'Publish' }));
  const host = await boxOf(page.locator('[data-flow-studio-host]'));
  const stage = await boxOf(stageOf(page));
  expect(publish.x + publish.width).toBeLessThanOrEqual(host.x + host.width);
  expect(publish.y + publish.height).toBeLessThanOrEqual(stage.y);
  expect((await boxOf(status)).x).toBeLessThan(publish.x);
});

test('the picker stays under /admin/workflows embedded', async ({ page }) => {
  const shell = await openEmbedded(page);
  await pickerButton(shell, 'Work order submitted').click();
  await shell.getByRole('option', { name: /^Contractor onboarding/ }).click();
  await expect(page).toHaveURL(/\/admin\/workflows\/wf-onboard$/);
  await expect(pickerButton(shell, 'Contractor onboarding')).toBeVisible();
  await expect(canvasOf(shell).getByRole('button', { name: 'Background check', exact: true })).toBeVisible();
});

test('the picker stays under /flow-studio on the full page', async ({ page }) => {
  await page.goto('/flow-studio/wf-wo-sub');
  await waitForCanvas(page);
  await pickerButton(page, 'Work order submitted').click();
  await page.getByRole('option', { name: /^Contractor onboarding/ }).click();
  await expect(page).toHaveURL(/\/flow-studio\/wf-onboard$/);
  await expect(canvasOf(page).getByRole('button', { name: 'Background check', exact: true })).toBeVisible();
});

test('deep links work, including ?step and an unknown workflow', async ({ page }) => {
  const shell = await openEmbedded(page, '/admin/workflows/wf-onboard');
  await expect(pickerButton(shell, 'Contractor onboarding')).toBeVisible();

  await page.goto('/admin/workflows/wf-wo-sub?step=RA_A1');
  const panel = shellOf(page).getByRole('dialog');
  await expect(panel.getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
  await expect(panel.getByText('Business sign-off', { exact: true })).toBeVisible();

  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/admin\/workflows\/wf-wo-sub$/);

  await canvasOf(shellOf(page)).getByRole('button', { name: 'Rate review', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/workflows\/wf-wo-sub\?step=RA_A2$/);

  await page.goto('/admin/workflows/no-such-workflow');
  await expect(shellOf(page).getByText('This workflow doesn’t exist or you don’t have access to it.')).toBeVisible();
  await shellOf(page).getByRole('button', { name: 'Open Work order submitted' }).click();
  await expect(page).toHaveURL(/\/admin\/workflows\/wf-wo-sub$/);
});

test('a non-admin is redirected, on the embedded route and the full page', async ({ page }) => {
  await signIn(page, 'Grace Kim');
  await page.goto('/admin/workflows/wf-wo-sub');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('[data-flow-studio-host]')).toHaveCount(0);

  await page.goto('/admin/workflows');
  await expect(page).toHaveURL(/\/home$/);

  await page.goto('/flow-studio/wf-wo-sub');
  await expect(page).toHaveURL(/\/home$/);
});

test('signed out, both routes go to sign-in', async ({ page, context }) => {
  await context.clearCookies();
  for (const path of ['/admin/workflows/wf-wo-sub', '/flow-studio/wf-wo-sub']) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain(`/auth/login?next=${encodeURIComponent(path)}`);
  }
});

test('the shell itself has no Settings button and no “Approval rules ›”; the exception is the admin heading', async ({ page }) => {
  const shell = await openEmbedded(page);
  await expect(page.getByText('Admin settings')).toBeVisible();
  await expect(shell.locator('text=Settings')).toHaveCount(0);
  await expect(shell.getByRole('button', { name: /Settings/ })).toHaveCount(0);
  await expect(shell.locator('text=Approval rules')).toHaveCount(0);

  await pickerButton(shell, 'Work order submitted').click();
  await expect(shell.getByRole('listbox')).toBeVisible();
  await expect(shell.locator('text=Settings')).toHaveCount(0);
  await expect(shell.locator('text=Approval rules')).toHaveCount(0);
});

test('viewport changes: the shell stays pinned to the column', async ({ page }) => {
  await openEmbedded(page);
  for (const [width, height] of [[1280, 800], [1920, 1080], [1100, 700], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await expectPinned(page);
    const host = await boxOf(page.locator('[data-flow-studio-host]'));
    expect(host.x).toBe(504);
    expect(host.x + host.width).toBe(width - 32);
    expect(host.y).toBe(96);
    expect(host.y + host.height).toBe(height - 32);
    const aside = await boxOf(adminNav(page));
    expect(host.x).toBeGreaterThanOrEqual(aside.x + aside.width);
    await expect(stageOf(page)).toBeVisible();
  }
});

test('collapsing the app sidebar moves the shell with the column', async ({ page }) => {
  await openEmbedded(page);
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect.poll(async () => (await boxOf(page.locator('[data-flow-studio-host]'))).x).toBe(324);
  await expectPinned(page);
  const host = await boxOf(page.locator('[data-flow-studio-host]'));
  expect(host.width).toBe(1084);
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect.poll(async () => (await boxOf(page.locator('[data-flow-studio-host]'))).x).toBe(504);
  await expectPinned(page);
});

test('with no room for a drawer beside the canvas, the embedded shell uses the compact layout (04 §2.5); M8 keeps 500 to 720 narrow, not phone', async ({ page }) => {
  // Below 1024 the app sidebar is a drawer and the column is wide again; 1030 is the narrowest desktop shell (494px).
  await page.setViewportSize({ width: 1030, height: 800 });
  const shell = await openEmbedded(page);
  await expectPinned(page);
  expect((await boxOf(page.locator('[data-flow-studio-host]'))).width).toBeLessThan(500);
  await expect(shell.getByRole('complementary', { name: 'Digital Workers' })).toHaveCount(0);
  await expect(shell.getByRole('button', { name: 'Publish' })).toBeVisible();
});

test('the page search finds the tab', async ({ page }) => {
  await openEmbedded(page);
  await page.getByPlaceholder('Search pages and subpages...').fill('workflows');
  await expect(page.getByRole('link', { name: /Workflows/ }).or(page.getByRole('button', { name: /Workflows/ })).first()).toBeVisible();
});

test('no page errors on either route', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of ['/admin/workflows/wf-onboard', '/admin/workflows/wf-ending?step=RA_A1', '/flow-studio/wf-onboard', '/flow-studio/wf-access?step=CD']) {
    await page.goto(path);
    await waitForCanvas(path.startsWith('/admin') ? shellOf(page) : page);
  }
  expect(errors).toEqual([]);
});

test.describe('M5: editing, embedded in the admin column', () => {
  test('opening a panel: it stays in the column and clear of the rail', async ({ page }) => {
    const shell = await openEmbedded(page);
    await openStep(shell, 'Business sign-off');
    const panel = panelOf(shell);
    await expect(panel.getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
    const host = await boxOf(page.locator('[data-flow-studio-host]'));
    const box = await boxOf(panel);
    expect(box.x).toBeGreaterThanOrEqual(host.x);
    expect(box.x + box.width).toBeLessThanOrEqual(host.x + host.width - 78);
    expect(box.y + box.height).toBeLessThanOrEqual(host.y + host.height);
  });

  test('a box under the drawer can still be reached', async ({ page }) => {
    const shell = await openEmbedded(page);
    await openStep(shell, 'Business sign-off');
    await openStep(shell, 'Tell the supplier');
    await expect(panelOf(shell).getByRole('heading', { name: 'Notify', exact: true })).toBeVisible();
    await openStep(shell, 'End');
    await expect(panelOf(shell).getByRole('heading', { name: 'End', exact: true })).toBeVisible();
  });

  test('editing a field saves, shows live, and persists after a reload', async ({ page }) => {
    const shell = await openEmbedded(page);
    await openStep(shell, 'Business sign-off');
    const saved = nextSave(page);
    await panelOf(shell).getByLabel('Name', { exact: true }).fill('Embedded sign-off');
    await expect(canvasOf(shell).getByRole('button', { name: 'Embedded sign-off', exact: true })).toBeVisible();
    await expect(shell.getByText('Live v1 · unpublished changes')).toBeVisible();
    await saved;
    await page.reload();
    const again = shellOf(page);
    await waitForCanvas(again);
    await expect(canvasOf(again).getByRole('button', { name: 'Embedded sign-off', exact: true })).toBeVisible();
    await expect(again.getByText('Live v1 · unpublished changes')).toBeVisible();
  });

  test('a dropdown sits on its field inside the fixed host, and follows the panel scrolling', async ({ page }) => {
    const shell = await openEmbedded(page);
    await openStep(shell, 'Work order submitted');
    const panel = panelOf(shell);
    const field = selectButton(panel, 'Work country');
    await field.scrollIntoViewIfNeeded();
    await field.click();
    const popover = page.getByRole('listbox').locator('..');
    const attached = async () => {
      const button = await boxOf(field);
      const box = await boxOf(popover);
      const below = Math.abs(box.y - (button.y + button.height + 4)) <= 1;
      const above = Math.abs(box.y + box.height - (button.y - 4)) <= 1;
      expect(below || above).toBe(true);
      expect(box.x).toBeCloseTo(Math.max(8, button.x), 0);
      return button;
    };
    const first = await attached();
    await page.mouse.move(first.x + 20, first.y - 40);
    // The field sits at the end of this panel's scroll, so the room is upward.
    await page.mouse.wheel(0, -30);
    await expect.poll(async () => (await boxOf(field)).y).toBeGreaterThan(first.y + 10);
    await attached();
    await page.getByRole('option', { name: 'Canada' }).click();
    await page.keyboard.press('Escape');
    await expect(field).toHaveText('Canada');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    expect(await boxText(shell, 'Work order submitted')).toBe('Work order submitted | Canada');
  });

  test('inserting a step from the menu, with the Nova count, persists after a reload', async ({ page }) => {
    const shell = await openEmbedded(page);
    await (await plusAfter(shell, 'T', 'next')).click();
    const menu = panelOf(shell);
    await expect(menu.getByRole('heading', { name: 'Add a step' })).toBeVisible();
    await expect(menu.getByRole('textbox', { name: 'Search' })).toBeFocused();
    const saved = nextSave(page);
    await menu.getByRole('button', { name: /^Approve Roles sign off/ }).click();
    await expect(panelOf(shell).getByRole('heading', { name: 'Approve', exact: true })).toBeVisible();
    expect(await boxText(shell, 'Approval')).toBe('! | Approval | Choose who approves');
    await saved;
    await page.reload();
    const again = shellOf(page);
    await waitForCanvas(again);
    expect(await boxText(again, 'Approval')).toBe('! | Approval | Choose who approves');
  });

  test('toasts show in the column: Delete, Undo, and the guard', async ({ page }) => {
    const shell = await openEmbedded(page);
    await openStep(shell, 'Budget check');
    await panelOf(shell).getByRole('button', { name: 'Delete this step' }).click();
    const toast = toastOf(shell);
    await expect(toast).toContainText('Step deleted. Lines reconnected');
    const host = await boxOf(page.locator('[data-flow-studio-host]'));
    const box = await boxOf(toast);
    expect(box.x).toBeGreaterThanOrEqual(host.x);
    expect(box.x + box.width).toBeLessThanOrEqual(host.x + host.width);
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(canvasOf(shell).getByRole('button', { name: 'Budget check', exact: true })).toBeVisible();

    await openStep(shell, 'Rate over card?');
    await choose(panelOf(shell).getByRole('group', { name: 'Over 10%', exact: true }), 'Then', 'Reject it and send it back to the requester');
    await choose(panelOf(shell).getByRole('group', { name: 'Otherwise', exact: true }), 'Then', 'Reject it and send it back to the requester');
    await expect(toastOf(shell)).toHaveText('At least one path has to carry on');
  });

  test('+ New workflow stays under /admin/workflows; a stale draftRev shows the conflict toast', async ({ page }) => {
    const shell = await openEmbedded(page);
    await shell.getByRole('button', { name: '+ New workflow' }).click();
    await expect(page).toHaveURL(/\/admin\/workflows\/nf101\?step=T$/);
    await expect(toastOf(shell)).toHaveText('New draft. Set when it runs, then press + to add steps');
    await expect(panelOf(shell).getByRole('heading', { name: 'Workflow settings' })).toBeVisible();
    await expectPinned(page);

    const current = (await (await page.request.get('/api/flow-studio/workflows/nf101')).json()) as { workflow: { name: string }; draftRev: number };
    current.workflow.name = 'Someone else';
    expect((await page.request.put('/api/flow-studio/workflows/nf101/draft', { data: { draft: current.workflow, draftRev: current.draftRev } })).status()).toBe(200);
    await panelOf(shell).getByLabel('Name', { exact: true }).fill('Mine');
    await expect(toastOf(shell)).toHaveText('This workflow changed since you opened it. Reload to see the latest.');
    await expectSaved(page, 'nf101', (workflow) => workflow.name, 'Someone else');
  });

  test('the rail drags in the column', async ({ page }) => {
    const shell = await openEmbedded(page, '/admin/workflows/wf-ts-sub');
    const worker = shell.getByRole('complementary', { name: 'Digital Workers' }).getByRole('button', { name: 'Rate check' });
    await worker.dragTo(canvasOf(shell).getByRole('button', { name: 'Add a step here', exact: true }).first());
    await expect(panelOf(shell).getByLabel('Name', { exact: true })).toHaveValue('Rate check');
  });

  test('every dropdown reads its options in the column', async ({ page }) => {
    const shell = await openEmbedded(page);
    await openStep(shell, 'Business sign-off');
    await selectButton(panelOf(shell), 'Who approves').click();
    expect(await optionTexts(page)).toEqual(['Roles', 'An approval group', 'A named person']);
    await page.keyboard.press('Escape');
    await expect(panelOf(shell)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panelOf(shell)).toHaveCount(0);
  });
});

test.describe('M6: Test, Nova and Publish, embedded in the admin column', () => {
  const inColumn = async (page: Page, box: { x: number; y: number; width: number; height: number }): Promise<void> => {
    const host = await boxOf(page.locator('[data-flow-studio-host]'));
    expect(box.x).toBeGreaterThanOrEqual(host.x);
    expect(box.x + box.width).toBeLessThanOrEqual(host.x + host.width - 78);
    expect(box.y).toBeGreaterThanOrEqual(host.y);
    expect(box.y + box.height).toBeLessThanOrEqual(host.y + host.height);
  };

  test('the Test drawer: WO-2214 on UK Technology work orders, in the column, with the path on the canvas', async ({ page }) => {
    const shell = await openEmbedded(page, '/admin/workflows/wf-wo-sub-wo-uk-tech');
    await openTest(shell, 'Senior cloud engineer');
    await inColumn(page, await boxOf(testPanelOf(shell)));
    await expectTestPanel(shell, 'EN-022');
    await expect(page).toHaveURL(/\/admin\/workflows\/wf-wo-sub-wo-uk-tech\?panel=test&record=WO-2214$/);

    // Canvas path highlighting, measured on the real elements: the globals.css overrides do not reach it.
    const canvas = canvasOf(shell);
    await expect(canvas.locator('path[data-from="T"][data-key="next"]')).toHaveCSS('stroke', CYAN_400);
    await expect(canvas.locator('path[data-from="T"][data-key="next"]')).toHaveCSS('stroke-width', '2.6px');
    await expect(canvas.locator('[data-node-id="RA_A1"] button').first()).toHaveCSS('border-top-color', 'rgb(245, 158, 11)');
    await expect(canvas.locator('[data-node-id="RA_A5"]')).toHaveCSS('opacity', '0.4');
    await expect(canvas.locator('[data-node-id="RA_A1"]')).toContainText('Approval');
    await expect(shell.getByText('Showing WO-2214')).toBeVisible();

    // The chip sits in what the drawer leaves of the canvas.
    const chip = await boxOf(shell.getByText('Showing WO-2214').locator('..'));
    const drawer = await boxOf(testPanelOf(shell));
    expect(chip.x).toBeGreaterThanOrEqual(await boxOf(canvas).then((box) => box.x));
    expect(chip.x + chip.width).toBeLessThanOrEqual(drawer.x);

    await shell.getByRole('button', { name: 'Hide', exact: true }).click();
    await expect(testPanelOf(shell)).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/workflows\/wf-wo-sub-wo-uk-tech$/);
    await expect(testButton(shell)).toBeFocused();
    await expect(canvas.locator('path[data-from="T"][data-key="next"]')).not.toHaveCSS('stroke', CYAN_400);
  });

  test('the Nova drawer is dark, in the column, and its count follows edits', async ({ page }) => {
    const shell = await openEmbedded(page, '/admin/workflows/wf-wo-sub-wo-data?panel=nova');
    const nova = novaPanelOf(shell);
    await expect(nova.getByText('Nova checked this flow against 26 real records from the last 90 days.')).toBeVisible();
    await inColumn(page, await boxOf(nova));
    await expect(nova).toHaveCSS('background-color', SLATE_950);
    await expect(novaButton(shell).locator('span')).toHaveCSS('background-color', 'rgb(217, 119, 6)');
    expect(await readNova(shell)).toEqual([{ label: 'Fix before publishing', message: 'Overlaps with "UK Technology work orders" on 2 past records (Data and UK · Technology). Set which one wins before publishing.', buttons: ['Choose which wins'] }]);
    expect(await novaCount(shell)).toBe('1');
  });

  test('“Show me” scrolls a box from under the drawer into the part of the canvas that shows', async ({ page }) => {
    const shell = await openEmbedded(page);
    const canvas = canvasOf(shell);
    // At the far end of the line, and at a zoom where it starts out under the drawer.
    await openStep(shell, 'Tell the supplier');
    await selectButton(panelOf(shell), 'Who').click();
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.keyboard.press('Escape');
    await shell.getByRole('button', { name: 'Fit', exact: true }).click();
    for (let i = 0; i < 6; i += 1) await shell.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await novaButton(shell).click();
    await canvas.evaluate((element) => element.scrollTo(0, 0));
    const box = canvas.getByRole('button', { name: 'Tell the supplier', exact: true });
    const before = await boxOf(box);
    const drawer = await boxOf(novaPanelOf(shell));
    expect(before.x + before.width).toBeGreaterThan(drawer.x);

    expect(await readNova(shell)).toEqual([{ label: 'Check', message: '"Tell the supplier" doesn\'t tell anyone yet.', buttons: ['Show me'] }]);
    await novaPanelOf(shell).getByRole('button', { name: 'Show me' }).click();
    await expect(panelOf(shell).getByRole('heading', { name: 'Notify', exact: true })).toBeVisible();
    const after = await boxOf(box);
    const panel = await boxOf(panelOf(shell));
    const scroller = await boxOf(canvas);
    expect(after.x).toBeGreaterThanOrEqual(scroller.x);
    expect(after.x + after.width).toBeLessThanOrEqual(panel.x);
    expect(Math.abs(after.x - scroller.x - 200)).toBeLessThanOrEqual(2);
  });

  test('the Publish dialog covers the whole window from the fixed host: shell, app header and sidebars', async ({ page }) => {
    const shell = await openEmbedded(page, '/admin/workflows/wf-wo-sub-wo-data');
    await publishButton(shell).click();
    const dialog = publishDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Goes live on')).toBeFocused();

    // The scrim fills the viewport, and is what is hit over the app header, the app sidebar, the admin sidebar and the shell.
    const scrim = dialog.locator('..');
    const box = await boxOf(scrim);
    expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, 1440, 900]);
    for (const [x, y] of [[700, 30], [100, 400], [400, 400], [1400, 60], [600, 850]]) {
      const hit = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('[aria-modal="true"]') !== null || document.elementFromPoint(px, py)?.querySelector(':scope > [aria-modal="true"]') !== null, [x, y]);
      expect(hit, `at ${x},${y}`).toBe(true);
    }
    // Centred on the window, not on the column, and not clipped by the host.
    const modal = await boxOf(dialog);
    expect(Math.abs(modal.x + modal.width / 2 - 720)).toBeLessThanOrEqual(1);
    expect(Math.abs(modal.y + modal.height / 2 - 450)).toBeLessThanOrEqual(1);
    expect(modal.width).toBe(520);
    await expect(dialog.getByRole('button', { name: 'Send for approval' })).toHaveCSS('background-color', CYAN_600);

    // Its dropdown opens above it, on its field.
    const field = dialog.getByRole('button', { name: /Which one should run\?/ });
    await field.click();
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    const fieldBox = await boxOf(field);
    const listBox = await boxOf(list.locator('..'));
    expect(Math.abs(listBox.x - fieldBox.x)).toBeLessThanOrEqual(1);
    const onTop = await list.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + 20, rect.y + 20));
    });
    expect(onTop).toBe(true);
    await page.getByRole('option', { name: 'Data and AI hires' }).click();
    await expect(list).toHaveCount(0);
    await expect(dialog.getByText('Ready to send for approval.')).toBeVisible();

    // Focus stays inside, and goes back to Publish.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[aria-modal="true"]'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(publishButton(shell)).toBeFocused();
  });

  test('sending, waiting, and the published status and notice, on the route', async ({ page }) => {
    const shell = await openEmbedded(page, '/admin/workflows/wf-access');
    await publishButton(shell).click();
    const dialog = publishDialog(page);
    await dialog.getByRole('button', { name: 'Send for approval' }).click();
    await expect(dialog.getByText('Sent for approval. Anyone with the “Approve flow changes” permission can approve it. You can’t approve your own change.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(shell.getByText('Waiting for approval', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/workflows\/wf-access$/);

    await signIn(page, 'Samira Khan');
    const pending = (await (await page.request.get('/api/flow-studio/publish-requests?status=pending')).json()) as { id: string }[];
    expect((await page.request.post(`/api/flow-studio/publish-requests/${pending[0].id}/approve`, { data: {} })).status()).toBe(200);
    await signIn(page, 'Flow Admin');

    await page.reload();
    const again = shellOf(page);
    await waitForCanvas(again);
    await expect(again.getByText('Live v2', { exact: true })).toBeVisible();
    const toast = toastOf(again);
    await expect(toast).toHaveText('Published as v2, live on 20 Oct 2026');
    const toastBox = await boxOf(toast);
    const host = await boxOf(page.locator('[data-flow-studio-host]'));
    expect(toastBox.x).toBeGreaterThanOrEqual(host.x);
    expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(host.x + host.width);
    await page.reload();
    await waitForCanvas(shellOf(page));
    await expect(toastOf(shellOf(page))).toHaveCount(0);
  });

  test('Test and Nova stay open across the picker, under the route; Escape closes in order', async ({ page }) => {
    const shell = await openEmbedded(page, '/admin/workflows/wf-wo-sub-wo-uk-tech?panel=test&record=WO-2214');
    await expectTestPanel(shell, 'EN-022');
    await pickerButton(shell, 'UK Technology work orders').click();
    await page.getByRole('option', { name: /^Work order submitted/ }).click();
    await expect(pickerButton(shell, 'Work order submitted')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/workflows\/wf-wo-sub\?panel=test&record=WO-2214$/);
    await expectTestPanel(shell, 'EN-015');
    expect(norm((await testPanelOf(shell).locator('ul[aria-label="Notices"] li').last().textContent()) ?? '')).toBe('For real requests, "UK Technology work orders" runs for this record.');

    await publishButton(shell).click();
    await expect(publishDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(publishDialog(page)).toHaveCount(0);
    await expect(testPanelOf(shell)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(testPanelOf(shell)).toHaveCount(0);
  });

  test('the last edit survives a reload during a running save', async ({ page }) => {
    const shell = await openEmbedded(page);
    await openStep(shell, 'Business sign-off');
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
    const name = panelOf(shell).getByLabel('Name', { exact: true });
    await name.fill('First edit');
    await landed;
    await name.fill('Last edit');
    await page.reload();
    release();
    await waitForCanvas(shellOf(page));
    await expect(canvasOf(shellOf(page)).getByRole('button', { name: 'Last edit', exact: true })).toBeVisible();
    await expectSaved(page, 'wf-wo-sub', (workflow) => workflow.draft.nodes.RA_A1.label, 'Last edit');
  });
});
