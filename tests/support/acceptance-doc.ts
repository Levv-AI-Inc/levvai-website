import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Workflow, WfNode } from '@flow-studio/model';

/**
 * Reads the expected values straight out of docs/flow-studio/06-acceptance-tests.md, so a test can only change by
 * changing that file (06 intro). Nothing here computes an expected value.
 */
export interface JsonBlock {
  /** The last line of text above the block, e.g. "- Setup:" or "- Expected:". */
  above: string;
  value: unknown;
}

export interface DocEntry {
  id: string;
  title: string;
  lines: string[];
  blocks: JsonBlock[];
}

export interface Setup {
  remove?: string[];
  add?: Record<string, WfNode>;
  patch?: Record<string, Record<string, unknown>>;
  workflow?: Partial<Workflow>;
}

const DOC_PATH = join(__dirname, '..', '..', 'docs', 'flow-studio', '06-acceptance-tests.md');

const ENTRY_HEADING = /^#{4,5} (EN-\d{3}|LP-\d{2}) · (.*)$/;
const GRAPH_HEADING = /^#### (I\d+) graph · (.*)$/;

interface ParsedDoc {
  entries: Map<string, DocEntry>;
  graphs: Map<string, Record<string, WfNode>>;
  graphOf: Map<string, string>; // EN id → I graph id
  newWorkflowFields: Partial<Workflow>;
}

function parseDoc(): ParsedDoc {
  const lines = readFileSync(DOC_PATH, 'utf8').split('\n');
  const entries = new Map<string, DocEntry>();
  const graphs = new Map<string, Record<string, WfNode>>();
  const graphOf = new Map<string, string>();
  let newWorkflowFields: Partial<Workflow> = {};

  let entry: DocEntry | null = null;
  let graph: string | null = null;
  let above = '';

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const entryMatch = ENTRY_HEADING.exec(line);
    const graphMatch = GRAPH_HEADING.exec(line);
    if (entryMatch) {
      entry = { id: entryMatch[1], title: entryMatch[2], lines: [], blocks: [] };
      entries.set(entry.id, entry);
      if (line.startsWith('##### ') && graph) graphOf.set(entry.id, graph);
      else graph = null;
      continue;
    }
    if (graphMatch) {
      graph = graphMatch[1];
      entry = null;
      continue;
    }
    if (/^#{1,5} /.test(line)) {
      entry = null;
      graph = null;
      above = line;
      continue;
    }
    if (line.startsWith('```json')) {
      const body: string[] = [];
      for (i += 1; !lines[i].startsWith('```'); i += 1) body.push(lines[i]);
      const value: unknown = JSON.parse(body.join('\n'));
      if (entry) entry.blocks.push({ above, value });
      else if (graph) graphs.set(graph, value as Record<string, WfNode>);
      else if (above.includes('Workflow fields for every test in this section')) newWorkflowFields = value as Partial<Workflow>;
      continue;
    }
    if (line.trim() !== '') {
      above = line;
      if (entry) entry.lines.push(line);
    }
  }
  return { entries, graphs, graphOf, newWorkflowFields };
}

const doc = parseDoc();

export const docEntry = (id: string): DocEntry => {
  const entry = doc.entries.get(id);
  if (!entry) throw new Error(`${id} is not in 06-acceptance-tests.md`);
  return entry;
};

export const allEntryIds = (): string[] => Array.from(doc.entries.keys());

/** A.3: the whole graph as it stands after that script's step. A fresh copy each call. */
export const iGraph = (name: string): Record<string, WfNode> => {
  const graph = doc.graphs.get(name);
  if (!graph) throw new Error(`${name} graph is not in 06-acceptance-tests.md`);
  return structuredClone(graph);
};

export const graphNameOf = (id: string): string | undefined => doc.graphOf.get(id);

/** A.3: the "Workflow fields for every test in this section". */
export const newWorkflow = (nodes: Record<string, WfNode>): Workflow =>
  ({ ...structuredClone(doc.newWorkflowFields), draft: { nodes } }) as Workflow;

/** 06 §1.6, as written. */
export function applySetup(wf: Workflow, s: Setup): void {
  s.remove?.forEach((id) => delete wf.draft.nodes[id]);
  Object.entries(s.add ?? {}).forEach(([id, n]) => {
    wf.draft.nodes[id] = structuredClone(n);
  });
  Object.entries(s.patch ?? {}).forEach(([id, p]) =>
    Object.entries(p).forEach(([k, v]) => {
      const node = wf.draft.nodes[id] as unknown as Record<string, unknown>;
      if (v === null) delete node[k];
      else node[k] = structuredClone(v);
    }),
  );
  Object.assign(wf, s.workflow ?? {});
}

const blockAfter = (entry: DocEntry, label: RegExp): unknown => entry.blocks.find((block) => label.test(block.above))?.value;

/** The JSON under "- Setup:". */
export const setupOf = (id: string): Setup | undefined => blockAfter(docEntry(id), /^- Setup:/) as Setup | undefined;

/** The JSON under "- Expected…", or the only / last JSON of the entry (A.1 and A.3 have no label). */
export function expectedOf(id: string): unknown {
  const entry = docEntry(id);
  const labelled = entry.blocks.find((block) => /Expected/.test(block.above));
  if (labelled) return labelled.value;
  const last = entry.blocks[entry.blocks.length - 1];
  if (!last) throw new Error(`${id} has no expected JSON`);
  return last.value;
}

/** Workflow id and record id named in the test's bullet ("Workflow `x` … record `y`"). */
export function casesOf(id: string): { workflowId?: string; recordId?: string; options?: Record<string, unknown>; inlineGraph?: Record<string, WfNode> } {
  const text = docEntry(id).lines.join('\n');
  // A.2b: "Derived from EN-045" names the seed case when the bullet names no workflow.
  const derivedFrom = /[Dd]erived from (EN-\d{3})/.exec(text)?.[1];
  const inherited = derivedFrom && !/Workflow `/.test(text) ? casesOf(derivedFrom) : undefined;
  const workflowId = /Workflow `([^`]+)`/.exec(text)?.[1] ?? inherited?.workflowId;
  const recordId = /[Rr]ecord `([^`]+)`/.exec(text)?.[1] ?? inherited?.recordId;
  const options = /Options: `(\{.*?\})`/.exec(text)?.[1];
  const inlineGraph = /with this graph.*?: `(\{.*\})`\. Record/.exec(text)?.[1];
  return {
    workflowId,
    recordId,
    options: options ? (JSON.parse(options) as Record<string, unknown>) : undefined,
    inlineGraph: inlineGraph ? (JSON.parse(inlineGraph) as Record<string, WfNode>) : undefined,
  };
}

/** Rows of the markdown table that directly follows the given heading line text. Cells are trimmed; the header row and separator are dropped. */
export function tableOf(id: string): string[][] {
  return docEntry(id)
    .lines.filter((line) => line.startsWith('|'))
    .slice(2)
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()));
}

/** Deep version of 06 §1.3 `norm` for comparing whole results. */
export function normDeep<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"') as unknown as T;
  if (Array.isArray(value)) return value.map((item) => normDeep(item as unknown)) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normDeep(v as unknown)])) as T;
  }
  return value;
}
