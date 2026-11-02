import { expect, type Locator, type Page } from '@playwright/test';
import { expectedOf } from '../support/acceptance-doc';
import { norm } from './helpers';

/**
 * 06 §1.5 "the Test panel equals EN-xxx": summary, notices, chips and, for every card in order, its title, badge, message,
 * "Worker sees" line and each round line "n people · notes". Read from the screen by role, name and tag, never by class or data-*.
 */
export interface PanelCard {
  title: string;
  status: string;
  message: string;
  workerSees: string | null;
  rounds: string[];
  tasks: string[];
}

export interface PanelView {
  inactive: string | null;
  summary: string | null;
  notices: string[];
  conflict: { badge: string; message: string; choices: string[] } | null;
  editButton: string | null;
  undoButton: string | null;
  chips: string[];
  ruleRounds: string[];
  ruleTasks: string[];
  removed: string[];
  cards: PanelCard[];
}

const pageOf = (scope: Page | Locator): Page => ('page' in scope && typeof scope.page === 'function' ? (scope as Locator).page() : (scope as Page));

export const testPanelOf = (scope: Page | Locator): Locator => scope.getByRole('dialog').filter({ has: pageOf(scope).getByRole('heading', { name: 'Test', exact: true }) });

export async function readTestPanel(scope: Page | Locator): Promise<PanelView> {
  const raw = (await testPanelOf(scope).evaluate((root) => {
    const read = (element: Element | null | undefined): string => {
      if (!element) return '';
      const copy = element.cloneNode(true) as Element;
      copy.querySelectorAll('button, [aria-hidden="true"]').forEach((node) => node.remove());
      return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
    };
    const all = (selector: string, within: Element = root): Element[] => Array.from(within.querySelectorAll(selector));
    const buttons = all('button').map((button) => (button.textContent ?? '').trim());
    const conflict = root.querySelector('[role="group"][aria-label="Conflict"]');
    const rules = root.querySelector('section[aria-label="From approval rules"]');
    const removed = root.querySelector('section[aria-label="Removed by the edit"]');
    const lines = (list: Element | null, selector: string): string[] => (list ? all(selector, list).map(read) : []);
    const inactive = all('div').filter((div) => (div.textContent ?? '').startsWith('This workflow is inactive')).pop();
    return {
      inactive: inactive ? read(inactive) : null,
      summary: root.querySelector('[role="group"][aria-label="Summary"]') ? read(root.querySelector('[role="group"][aria-label="Summary"]')) : null,
      notices: all('ul[aria-label="Notices"] > li').map(read),
      conflict: conflict
        ? {
            badge: read(conflict.querySelector('span')),
            message: read(conflict.querySelector('div')).replace(new RegExp(`^${read(conflict.querySelector('span'))} `), ''),
            choices: all('button', conflict).map((button) => (button.textContent ?? '').trim()),
          }
        : null,
      editButton: buttons.find((text) => text.startsWith('Try an edit') || text === 'Undo the edit') ?? null,
      undoButton: buttons.find((text) => text === 'Undo') ?? null,
      chips: all('ul[aria-label="Decisions"] > li').map(read),
      ruleRounds: lines(rules, 'ol > li'),
      ruleTasks: lines(rules, 'ul > li'),
      removed: lines(removed, 'ul > li'),
      cards: all('ul[aria-label="Steps"] > li').map((card) => {
        const parts = Array.from(card.children);
        const header = parts[0];
        const rest = parts.slice(1).filter((part) => part.tagName === 'DIV').map(read);
        const sees = rest.find((text) => text.startsWith('Worker sees: '));
        return {
          title: read(header.querySelector('h3')),
          status: read(header.querySelector('h3 + span')),
          message: rest.find((text) => !text.startsWith('Worker sees: ')) ?? '',
          workerSees: sees ?? null,
          rounds: lines(card, 'ol > li'),
          tasks: lines(card, 'ul > li'),
        };
      }),
    };
  })) as PanelView;
  return normalised(raw);
}

const normMaybe = (text: string | null): string | null => (text === null ? null : norm(text));

function normalised(view: PanelView): PanelView {
  return {
    inactive: normMaybe(view.inactive),
    summary: normMaybe(view.summary),
    notices: view.notices.map(norm),
    conflict: view.conflict ? { badge: norm(view.conflict.badge), message: norm(view.conflict.message), choices: view.conflict.choices.map(norm) } : null,
    editButton: normMaybe(view.editButton),
    undoButton: normMaybe(view.undoButton),
    chips: view.chips.map(norm),
    ruleRounds: view.ruleRounds.map(norm),
    ruleTasks: view.ruleTasks.map(norm),
    removed: view.removed.map(norm),
    cards: view.cards.map((card) => ({
      ...card,
      title: norm(card.title),
      status: norm(card.status),
      message: norm(card.message),
      workerSees: normMaybe(card.workerSees),
      rounds: card.rounds.map(norm),
      tasks: card.tasks.map(norm),
    })),
  };
}

interface ExpectedRound {
  n: number;
  people: string;
  notes: string[];
  tasks?: string[];
}

interface ExpectedResult {
  summary: string | null;
  inactiveNotice?: string;
  notices?: string[];
  conflict?: { badge: string; message: string; choices: string[] };
  editButton?: string;
  undoButton?: string;
  path: string;
  fromApprovalRules?: ExpectedRound[];
  removedByEdit?: string[];
  steps: { title: string; status: string; message: string; workerSees?: string; rounds?: ExpectedRound[]; tasks?: string[] }[];
}

/** 06 §1.5's "n · people · notes", with the round number where a fine line has its icon (04 §8.2 item 6). */
const roundLine = (round: ExpectedRound): string => `${round.n} ${[round.people, round.notes.join('; ')].filter(Boolean).join(' · ')}`;

/** The screen form of an expected result, straight from 06. Nothing here computes a value. */
export function expectedPanel(en: string): PanelView {
  const result = expectedOf(en) as ExpectedResult;
  return normalised({
    inactive: result.inactiveNotice ?? null,
    summary: result.summary,
    notices: result.notices ?? [],
    conflict: result.conflict ?? null,
    editButton: result.editButton ?? null,
    undoButton: result.undoButton ?? null,
    chips: result.path ? result.path.split(' | ') : [],
    ruleRounds: (result.fromApprovalRules ?? []).map(roundLine),
    ruleTasks: (result.fromApprovalRules ?? []).flatMap((round) => round.tasks ?? []),
    removed: result.removedByEdit ?? [],
    cards: result.steps.map((step) => ({
      title: step.title,
      status: step.status,
      message: step.message,
      workerSees: step.workerSees === undefined ? null : `Worker sees: ${step.workerSees}`,
      rounds: (step.rounds ?? []).map(roundLine),
      tasks: step.tasks ?? [],
    })),
  });
}

/** 06 §1.5: the whole panel, polled, because Test follows every edit. */
export async function expectTestPanel(scope: Page | Locator, en: string): Promise<void> {
  const expected = expectedPanel(en);
  await expect.poll(() => readTestPanel(scope), { message: `the Test panel equals ${en}` }).toEqual(expected);
}

export const testButton = (scope: Page | Locator): Locator => scope.getByRole('button', { name: 'Test', exact: true });

/** 06 §1.5 openTest(recordTitle). */
export async function openTest(scope: Page | Locator, recordTitle: string): Promise<void> {
  const button = testButton(scope);
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  await radioRow(scope, recordTitle).click();
  await expect(radioRow(scope, recordTitle)).toHaveAttribute('aria-checked', 'true');
}

/** A row by its first line. Titles can start the same way, so this matches the whole line. */
export const radioRow = (scope: Page | Locator, title: string): Locator =>
  testPanelOf(scope)
    .getByRole('radio')
    .filter({ has: pageOf(scope).locator('span:first-child').getByText(title, { exact: true }) });

export async function readRows(scope: Page | Locator): Promise<string[][]> {
  return (await testPanelOf(scope).getByRole('radio').evaluateAll((rows) =>
    rows.map((row) => Array.from(row.children).map((line) => line.textContent ?? '')),
  )).map((lines) => lines.map(norm));
}

export const card = async (scope: Page | Locator, title: string): Promise<PanelCard> => {
  const found = (await readTestPanel(scope)).cards.find((entry) => entry.title === norm(title));
  if (!found) throw new Error(`No Test card “${title}”`);
  return found;
};

/** 06 §1.5 "Nova" list: label and message of each card, read from the screen. */
export const novaPanelOf = (scope: Page | Locator): Locator => scope.getByRole('dialog').filter({ has: pageOf(scope).getByRole('heading', { name: 'Nova', exact: true }) });

export async function readNova(scope: Page | Locator): Promise<{ label: string; message: string; buttons: string[] }[]> {
  const rows = await novaPanelOf(scope).locator('ul > li').evaluateAll((items) =>
    items.map((item) => {
      const line = item.querySelector('p') as Element;
      return {
        label: line.children.length > 1 ? line.children[0].textContent ?? '' : '',
        message: line.children[line.children.length - 1].textContent ?? '',
        buttons: Array.from(item.querySelectorAll('button')).map((button) => button.textContent ?? ''),
      };
    }),
  );
  return rows.map((row) => ({ label: norm(row.label), message: norm(row.message), buttons: row.buttons.map(norm) }));
}

export const novaButton = (scope: Page | Locator): Locator => scope.getByRole('button', { name: /^Nova/ });

export const publishDialog = (page: Page): Locator => page.getByRole('dialog', { name: /^Publish/ });
export const publishButton = (scope: Page | Locator): Locator => scope.getByRole('button', { name: 'Publish', exact: true });
