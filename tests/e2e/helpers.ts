import { expect, type Locator, type Page } from '@playwright/test';

/** 06 §1.5. UI tests drive what a person can see and never import engine code. */

export const FIXED_NOW = new Date('2026-10-20T09:00:00Z');

/** 06 §1.3. */
export const norm = (text: string): string =>
  text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

export async function resetApp(page: Page, actors?: 'default' | 'author-only-approver'): Promise<void> {
  const response = await page.request.post('/api/test/reset', actors ? { data: { actors } } : {});
  expect(response.status()).toBe(204);
}

export async function signIn(page: Page, name: string): Promise<void> {
  const response = await page.request.post('/api/test/sign-in', { data: { user: name } });
  expect(response.status()).toBe(204);
}

/** 06 §1.2: every UI test starts here. */
export async function freshApp(page: Page, user = 'Flow Admin'): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
  await resetApp(page);
  await signIn(page, user);
}

export const canvasOf = (page: Page | Locator): Locator => page.getByRole('group', { name: 'Workflow canvas' });

export async function waitForCanvas(page: Page | Locator): Promise<Locator> {
  const canvas = canvasOf(page);
  await expect(canvas).toBeVisible();
  return canvas;
}

/** 06 §1.5. The Start box can have the same name as the workflow; only the picker opens a listbox. */
export const pickerButton = (scope: Page | Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true }).and(scope.locator('[aria-haspopup="listbox"]'));

export async function openWorkflow(scope: Page | Locator, currentName: string, name: string): Promise<void> {
  await pickerButton(scope, currentName).click();
  await scope.getByRole('option', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
}

export async function openStep(scope: Page | Locator, title: string): Promise<void> {
  await canvasOf(scope).getByRole('button', { name: title, exact: true }).click();
}


/** 06 UI-N3: each canvas box, read as a person sees it. A box is a canvas button other than "Add a step here". */
export async function readBoxes(page: Page | Locator): Promise<{ name: string; text: string; x: number; y: number }[]> {
  const buttons = await canvasOf(page).getByRole('button').all();
  const boxes: { name: string; text: string; x: number; y: number }[] = [];
  for (const button of buttons) {
    const name = await button.getAttribute('aria-label');
    if (name === 'Add a step here') continue;
    const read = await button.evaluate((element) => {
      const walker = document.createTreeWalker(element.parentElement as Element, NodeFilter.SHOW_TEXT);
      const lines: string[] = [];
      while (walker.nextNode()) {
        const text = (walker.currentNode.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (text) lines.push(text);
      }
      const rect = element.getBoundingClientRect();
      return { text: lines.join(' | '), x: rect.x, y: rect.y };
    });
    boxes.push({ name: name ?? '', ...read });
  }
  return boxes;
}

/** A dropdown's highlighted option: what the search box's aria-activedescendant points at (04 §13.5). */
export async function activeOption(page: Page): Promise<string | null> {
  return page.getByRole('textbox', { name: 'Search' }).evaluate((input) => {
    const id = input.getAttribute('aria-activedescendant');
    return id ? document.getElementById(id)?.textContent?.trim() ?? null : null;
  });
}

export const dropdown = (page: Page | Locator, label: string | RegExp): Locator => page.getByRole('button', { name: label });

/** 06 §1.5 choose(), without the click on the option. */
export async function optionTexts(page: Page): Promise<string[]> {
  return (await page.getByRole('listbox').getByRole('option').allTextContents()).map(norm);
}

export const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('The element has no box');
  return box;
};

/** 06 §1.5. A dropdown is a button that opens a listbox; other buttons can share its name. */
export const selectButton = (scope: Page | Locator, label: string): Locator =>
  scope.getByRole('button', { name: label, exact: true }).and(scope.locator('[aria-haspopup="listbox"]'));

const pageOf = (scope: Page | Locator): Page => ('page' in scope && typeof scope.page === 'function' ? (scope as Locator).page() : (scope as Page));

/** 06 §1.5 choose(fieldLabel, optionText). */
export async function choose(scope: Page | Locator, label: string, option: string): Promise<void> {
  await selectButton(scope, label).click();
  await pageOf(scope).getByRole('listbox').getByRole('option', { name: option, exact: true }).click();
}

/** 06 §1.5 searchPick(fieldLabel, query). The list stays open on a multi-select. */
export async function searchPick(scope: Page | Locator, label: string, query: string): Promise<void> {
  await selectButton(scope, label).click();
  const page = pageOf(scope);
  await page.getByRole('textbox', { name: 'Search' }).last().fill(query);
  await page.keyboard.press('Enter');
}

export const panelOf = (page: Page | Locator): Locator => page.getByRole('dialog');

/** 06 §1.5 openAdvanced(). */
export async function openDetails(panel: Locator, summary = 'Advanced'): Promise<void> {
  const section = panel.locator('details').filter({ has: panel.page().locator('summary', { hasText: summary }) });
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
}

export const toastOf = (page: Page | Locator): Locator => page.getByRole('status');

/** The count badge inside the Nova button. */
export const novaCount = async (page: Page | Locator): Promise<string> =>
  ((await page.getByRole('button', { name: /^Nova/ }).textContent()) ?? '').replace(/\D/g, '');

/** A box as a person reads it, joined with " | " as 06 writes it. */
export async function boxText(page: Page | Locator, name: string): Promise<string> {
  const box = (await readBoxes(page)).find((candidate) => norm(candidate.name) === norm(name));
  return norm(box?.text ?? '');
}

/** "Add a step here" on the line leaving this box, read from the drawing. */
export async function plusAfter(page: Page | Locator, from: string, key: string): Promise<Locator> {
  const canvas = canvasOf(page);
  const edges = await canvas.locator('svg path').evaluateAll((paths) => paths.map((path) => `${path.getAttribute('data-from')}:${path.getAttribute('data-key')}`));
  return canvas.getByRole('button', { name: 'Add a step here', exact: true }).nth(edges.indexOf(`${from}:${key}`));
}

/** What the server holds: the proof that an edit was autosaved. */
export async function savedWorkflow(page: Page, id: string): Promise<{ workflow: any; draftRev: number }> {
  const response = await page.request.get(`/api/flow-studio/workflows/${encodeURIComponent(id)}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as { workflow: any; draftRev: number };
}

/** The autosave is debounced, so anything read from the server is polled. */
export const expectSaved = async <T>(page: Page, id: string, read: (workflow: any) => T, expected: T): Promise<void> => {
  await expect.poll(async () => read((await savedWorkflow(page, id)).workflow), { timeout: 8000 }).toEqual(expected);
};

export async function lintIssues(page: Page, id: string): Promise<{ sev: string; m: string; node?: string }[]> {
  const response = await page.request.get(`/api/flow-studio/workflows/${encodeURIComponent(id)}/lint`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { issues: { sev: string; m: string; node?: string }[] }).issues;
}

/** An edit is only visible to the routes once saved, so this waits for the next PUT that succeeds. */
export const nextSave = (page: Page) =>
  page.waitForResponse((response) => response.url().includes('/draft') && response.request().method() === 'PUT' && response.status() === 200);
