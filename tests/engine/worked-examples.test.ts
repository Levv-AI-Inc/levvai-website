import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runTest } from '@flow-studio/engine/compose';
import type { EngineContext, SampleRecord, TestRunResult, Workflow } from '@flow-studio/model';
import { normDeep } from '../support/acceptance-doc';
import { makeContext } from '../support/context';

/**
 * 03-engine §19 is the "acceptance oracle" of the engine spec, and 03 outranks 06, so its tables are checked as well.
 * The values are read from the document. "Build" paragraphs state where a table quotes the prototype and production differs.
 */
const lines = readFileSync(join(__dirname, '..', '..', 'docs', 'flow-studio', '03-engine.md'), 'utf8').split('\n');

const cells = (line: string) => line.slice(1, -1).split('|').map((cell) => cell.trim());

interface Example {
  id: string;
  recordId: string;
  workflowName: string;
  summary: string;
  decisions: string;
  steps: { step: string; status: string; message: string; rounds: string }[];
}

function readExamples(): Example[] {
  const summaryRows = new Map<string, string[]>();
  for (const line of lines) {
    if (/^\| E\d+ \|/.test(line)) summaryRows.set(cells(line)[0], cells(line));
  }
  const examples: Example[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const heading = /^#### (E\d+) · (\S+) on “(.+)”$/.exec(lines[i]);
    if (!heading) continue;
    const row = summaryRows.get(heading[1]) as string[];
    const steps: Example['steps'] = [];
    let j = i + 1;
    while (!lines[j].startsWith('| Step |')) j += 1;
    for (j += 2; lines[j].startsWith('|'); j += 1) {
      const [step, status, message, rounds] = cells(lines[j]);
      steps.push({ step, status, message, rounds });
    }
    examples.push({ id: heading[1], recordId: heading[2], workflowName: heading[3], summary: row[3], decisions: row[4], steps });
  }
  return examples;
}

const examples = readExamples();

/** 03 §19's Build paragraphs: the production values for the tables that quote the prototype. */
const BUILD: Record<string, Partial<Pick<Example, 'decisions' | 'steps'>>> = {
  // E18 (§20 D1)
  E18: {
    decisions: 'Scope changed? → Yes; Value band → Otherwise',
    steps: [
      { step: 'Procurement review', status: 'NOT ASKED AGAIN', message: 'Procurement: approved the original; nothing they depend on changed', rounds: '' },
      {
        step: 'Legal review',
        status: 'APPROVAL',
        message: 'If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h',
        rounds: '1. Legal (Luis Romero) · Hannah Brooks is out until Oct 24. Delegated to Luis Romero',
      },
      { step: 'Tell the SOW owner it’s approved', status: 'SENT', message: 'Email to SOW owner (Grace Kim)', rounds: '' },
    ],
  },
  // E19 (§20 D1)
  E19: {
    decisions: 'Scope changed? → No; Value band → Over $250K',
    steps: [
      { step: 'Procurement review', status: 'NOT ASKED AGAIN', message: 'Procurement: approved the original; nothing they depend on changed', rounds: '' },
      {
        step: 'Finance review',
        status: 'APPROVAL',
        message: 'If rejected: back to the requester to fix. Chaser reminds after 24h and escalates to their manager after 48h',
        rounds: '1. Finance business partner (Chloe Martin)',
      },
      { step: 'Tell the SOW owner it’s approved', status: 'SENT', message: 'Email to SOW owner (Grace Kim)', rounds: '' },
    ],
  },
};

/** E24's Build paragraph changes two messages of the table: "Asked of the worker: Criminal record, Employment history. Failed. …" (D17), "Waiting on Background check" (D4). */
const BUILD_MESSAGES: Record<string, Record<string, string>> = {
  E24: {
    'Background check': 'Asked of the worker: Criminal record, Employment history. Failed. HR business partner and Legal must decide whether to carry on · Worker sees: In progress',
    'System access': 'Waiting on Background check',
  },
};

const sample = (ctx: EngineContext, id: string) => ctx.samples.find((s) => s.id === id) as SampleRecord;
const workflowNamed = (ctx: EngineContext, name: string) => ctx.workflows.find((w) => w.name === name) as Workflow;

function stepAsTable(step: TestRunResult['steps'][number]) {
  return {
    step: step.title,
    status: step.status.toUpperCase(),
    message: step.workerSees !== undefined ? `${step.message} · Worker sees: ${step.workerSees}` : step.message,
    rounds: (step.rounds ?? [])
      .map((round) => `${round.n}. ${round.people}${round.notes.length > 0 ? ` · ${round.notes.join('; ')}` : ''}`)
      .join(' '),
  };
}

describe('03 §19 worked examples (E1–E31)', () => {
  it('reads all 31 examples', () => {
    expect(examples.map((e) => e.id)).toEqual(Array.from({ length: 31 }, (_, i) => `E${i + 1}`));
  });

  it.each(examples.map((e) => [e.id, e] as const))('%s', (_id, example) => {
    const ctx = makeContext();
    const result = runTest({ workflow: workflowNamed(ctx, example.workflowName), record: sample(ctx, example.recordId), ctx });
    const build = BUILD[example.id] ?? {};

    expect(normDeep(result.summary)).toBe(normDeep(example.summary.startsWith('(none') ? null : example.summary));
    const decisions = build.decisions ?? example.decisions;
    expect(normDeep(result.path)).toBe(normDeep(decisions === '—' ? '' : decisions.split('; ').join(' | ')));
    const messages = BUILD_MESSAGES[example.id] ?? {};
    const expectedSteps = (build.steps ?? example.steps).map((step) => ({ ...step, message: messages[step.step] ?? step.message }));
    expect(normDeep(result.steps.map(stepAsTable))).toEqual(normDeep(expectedSteps));
  });
});
