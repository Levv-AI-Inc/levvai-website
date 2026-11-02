import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { APPENDIX_A, TOTAL_BOXES, type ExpectedCanvas } from './appendix-a';
import { canvasOf, freshApp, norm, pickerButton, waitForCanvas } from './helpers';

/** Every seeded canvas against 04 Appendix A, on both routes. Expected values are the transcription in appendix-a.ts. */

interface RawNode { kind: string; failTo?: string; outs?: unknown[] }
interface RawWorkflow { id: string; draft: { nodes: Record<string, RawNode> } }

const seed = JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'seed', 'workflows.json'), 'utf8')) as { workflows: RawWorkflow[] };

/** The seed's boxes plus the generated escalation for each Collect & verify whose If it fails is Escalate (02 §15 step 7). */
function seedBoxCount(id: string): number {
  const workflow = seed.workflows.find((candidate) => candidate.id === id);
  if (!workflow) throw new Error(`No ${id} in the seed`);
  const nodes = Object.values(workflow.draft.nodes);
  return nodes.length + nodes.filter((node) => node.kind === 'collect' && node.failTo === 'role').length;
}

interface ReadBox {
  id: string;
  title: string;
  subtitle: string | null;
  exits: string[];
  rows: [string, string][];
  x: number;
  helpers: string[];
}

async function readCanvas(canvas: Locator) {
  return canvas.evaluate((root) => {
    const lines = (element: Element): string[] => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const out: string[] = [];
      while (walker.nextNode()) {
        const text = (walker.currentNode.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (text) out.push(text);
      }
      return out;
    };
    const boxes = Array.from(root.querySelectorAll('[data-node-id]')).map((element) => {
      const wrapper = element as HTMLElement;
      const button = wrapper.querySelector('button') as HTMLButtonElement;
      const title = button.getAttribute('aria-label') ?? '';
      const text = lines(wrapper).filter((line) => line !== '!');
      const isIf = wrapper.querySelector('button > span[id]') !== null;
      if (isIf) {
        const rowText = lines(wrapper.querySelector('button > span[id]') as Element);
        const rows: [string, string][] = [];
        for (let i = 0; i + 1 < rowText.length; i += 2) rows.push([rowText[i], rowText[i + 1]]);
        return { id: wrapper.dataset.nodeId as string, title, subtitle: null, exits: [], rows, x: wrapper.getBoundingClientRect().x, helpers: [] };
      }
      const titleAt = text.lastIndexOf(title);
      return {
        id: wrapper.dataset.nodeId as string,
        title,
        subtitle: text.slice(titleAt + 1).join(' ') || null,
        exits: text.slice(0, titleAt),
        rows: [],
        x: wrapper.getBoundingClientRect().x,
        helpers: Array.from(wrapper.querySelectorAll('button [title]')).map((helper) => helper.getAttribute('title') ?? ''),
      };
    });
    const edges = Array.from(root.querySelectorAll('svg path[data-from]')).map((path) => [path.getAttribute('data-from') ?? '', path.getAttribute('data-to') ?? '']);
    return { boxes, edges, plusCount: Array.from(root.querySelectorAll('button')).filter((button) => button.getAttribute('aria-label') === 'Add a step here').length };
  }) as unknown as Promise<{ boxes: ReadBox[]; edges: [string, string][]; plusCount: number }>;
}

function compare(expected: ExpectedCanvas, read: { boxes: ReadBox[]; edges: [string, string][]; plusCount: number }): void {
  const byTitle = (title: string): ReadBox => {
    const match = read.boxes.filter((box) => norm(box.title) === norm(title));
    expect(match, `box “${title}” on ${expected.id}`).toHaveLength(1);
    return match[0];
  };

  expect(read.boxes, `box count on ${expected.id}`).toHaveLength(seedBoxCount(expected.id));
  expect(read.plusCount, `one "+" per line on ${expected.id}`).toBe(read.edges.length);

  if (expected.start) {
    const start = read.boxes.find((box) => box.id === 'T');
    expect(norm(start?.title ?? ''), 'Start title').toBe(norm(expected.start[0]));
    expect(norm(start?.subtitle ?? ''), 'Start subtitle').toBe(norm(expected.start[1]));
  }

  for (const line of expected.boxes) {
    const at = line.indexOf(' / ');
    const title = at === -1 ? line : line.slice(0, at);
    const box = byTitle(title);
    if (at !== -1) expect(norm(box.subtitle ?? ''), `subtitle of “${title}”`).toBe(norm(line.slice(at + 3)));
  }

  for (const card of expected.ifs ?? []) {
    const box = byTitle(card.name);
    for (const [name, outcome] of card.rows ?? []) {
      const row = box.rows.find(([label]) => norm(label) === norm(name));
      expect(row, `row “${name}” on “${card.name}”`).toBeTruthy();
      // "→ {first step}" may carry " +{n}" (04 §4.4); the Appendix names the first step.
      if (outcome) expect(norm(row?.[1] ?? '').startsWith(norm(outcome)), `outcome of “${name}” on “${card.name}”: ${row?.[1]}`).toBe(true);
    }
    const rowNames = (card.rows ?? []).map(([name]) => norm(name));
    if (rowNames.includes(norm('Otherwise')) || rowNames.includes('No')) {
      expect(box.rows.map(([label]) => norm(label))).toEqual(rowNames);
    }
  }

  for (const [title, labels] of Object.entries(expected.exits ?? {})) {
    expect(byTitle(title).exits.map(norm), `exits of “${title}”`).toEqual(labels.map(norm));
  }

  const next = new Map<string, string[]>();
  for (const [from, to] of read.edges) next.set(from, [...(next.get(from) ?? []), to]);
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (id === to) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(next.get(id) ?? []));
    }
    return false;
  };

  for (const chain of expected.flow ?? []) {
    for (let i = 1; i < chain.length; i += 1) {
      const from = byTitle(chain[i - 1]);
      const to = byTitle(chain[i]);
      expect(reaches(from.id, to.id), `“${chain[i - 1]}” leads to “${chain[i]}”`).toBe(true);
      expect(to.x, `“${chain[i]}” is right of “${chain[i - 1]}”`).toBeGreaterThan(from.x);
    }
  }
  for (const [from, to] of expected.lines ?? []) {
    expect(next.get(byTitle(from).id) ?? [], `line “${from}” → “${to}”`).toContain(byTitle(to).id);
  }
  for (const [title, name] of Object.entries(expected.helpers ?? {})) {
    expect(byTitle(title).helpers, `helper badge on “${title}”`).toContain(name);
  }
}

async function checkAll(page: Page, base: string, scope: () => Locator | Page, statusIn: () => Locator): Promise<void> {
  let total = 0;
  for (const expected of APPENDIX_A) {
    await page.goto(`${base}/${expected.id}`);
    const canvas = await waitForCanvas(scope());
    await expect(pickerButton(scope(), expected.name), expected.id).toBeVisible();
    await expect(canvas.locator('[data-node-id]').first()).toBeVisible();
    const read = await readCanvas(canvasOf(scope()));
    compare(expected, read);
    if (expected.status) await expect(statusIn().getByText(expected.status, { exact: true }), `status of ${expected.id}`).toBeVisible();
    total += read.boxes.length;
  }
  expect(total).toBe(TOTAL_BOXES);
}

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

test('the transcription covers all 15 workflows of the seed', () => {
  expect(APPENDIX_A.map((canvas) => canvas.id).sort()).toEqual(seed.workflows.map((workflow) => workflow.id).sort());
  expect(APPENDIX_A).toHaveLength(15);
});

test('04 Appendix A: every seeded canvas on /flow-studio, 159 boxes', async ({ page }) => {
  await checkAll(page, '/flow-studio', () => page, () => page.getByRole('banner'));
});

test('04 Appendix A: every seeded canvas on /admin/workflows, 159 boxes', async ({ page }) => {
  const shell = () => page.getByRole('region', { name: 'Flow Studio' });
  await checkAll(page, '/admin/workflows', shell, shell);
});
