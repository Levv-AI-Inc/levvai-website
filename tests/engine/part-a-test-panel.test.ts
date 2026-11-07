import { describe, expect, it } from 'vitest';
import { runTest } from '@flow-studio/engine/compose';
import type { EngineContext, SampleRecord, TestRunOptions, TestRunResult } from '@flow-studio/model';
import { applySetup, casesOf, docEntry, expectedOf, graphNameOf, iGraph, newWorkflow, normDeep, setupOf } from '../support/acceptance-doc';
import { makeContext, workflowById } from '../support/context';

const sample = (ctx: EngineContext, id: string): SampleRecord => {
  const record = ctx.samples.find((s) => s.id === id);
  if (!record) throw new Error(`No sample ${id}`);
  return record;
};

/** Runs a test's workflow × record with its setup, as 06 Part A describes. */
function runEntry(id: string, overrides: { recordId?: string; asOf?: string } = {}): TestRunResult {
  const ctx = makeContext();
  const { workflowId, recordId, options } = casesOf(id);
  if (!workflowId || !(overrides.recordId ?? recordId)) throw new Error(`${id}: no workflow or record in the bullet`);
  const workflow = workflowById(ctx, workflowId);
  const setup = setupOf(id);
  if (setup) applySetup(workflow, setup);
  return runTest({
    workflow,
    record: sample(ctx, (overrides.recordId ?? recordId) as string),
    ctx,
    options: options as TestRunOptions | undefined,
  });
}

/** 06 §1.3: strings compare after quote normalisation. 06 Part A: properties not listed must be absent. */
const expectResult = (actual: TestRunResult, expected: unknown) => expect(normDeep(actual)).toStrictEqual(normDeep(expected));

const pad = (n: number) => `EN-${String(n).padStart(3, '0')}`;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => pad(from + i));

describe('Part A.1 · Every sample record through its workflow', () => {
  it.each(range(1, 41))('%s', (id) => {
    expectResult(runEntry(id), expectedOf(id));
  });
});

describe('Part A.2 · Variations exercised by the scripts', () => {
  const withJson = range(42, 63).filter((id) => docEntry(id).blocks.length > 0);
  it.each(withJson)('%s', (id) => {
    expectResult(runEntry(id), expectedOf(id));
  });

  // "each result is identical to its seed result: WO-2214 = EN-015, WO-2275 = EN-020, WO-2280 = EN-021"
  const seedResult: [string, string][] = [['WO-2214', 'EN-015'], ['WO-2275', 'EN-020'], ['WO-2280', 'EN-021']];
  describe.each([
    ['EN-047', 'EN-044'],
    ['EN-048', 'EN-045'],
    ['EN-049', 'EN-046'],
  ])('%s · setup of %s', (id, setupFrom) => {
    it.each(seedResult)(`${id} %s equals %s`, (recordId, expectedId) => {
      const ctx = makeContext();
      const workflow = workflowById(ctx, 'wf-wo-sub');
      applySetup(workflow, setupOf(setupFrom) as NonNullable<ReturnType<typeof setupOf>>);
      expectResult(runTest({ workflow, record: sample(ctx, recordId), ctx }), expectedOf(expectedId));
    });
  });

  it('EN-054 “Result is identical to EN-017”', () => {
    expectResult(runEntry('EN-054'), expectedOf('EN-017'));
  });

  it('EN-060 “the result equals EN-008”', () => {
    expectResult(runEntry('EN-060'), expectedOf('EN-008'));
  });
});

describe('Part A.2b · Production behaviour decided after the prototype', () => {
  const asGraph = (id: string) => casesOf(id).inlineGraph;

  it.each(['EN-064', 'EN-065', 'EN-066', 'EN-067', 'EN-069', 'EN-070', 'EN-072'])('%s', (id) => {
    expectResult(runEntry(id), expectedOf(id));
  });

  it('EN-068 with asOf 2026-10-25', () => {
    expectResult(runEntry('EN-068'), expectedOf('EN-068'));
  });

  it('EN-068 the same run of SOW-77 on wf-sow-sub: Hannah Brooks approves Legal review herself', () => {
    const ctx = makeContext();
    const result = runTest({ workflow: workflowById(ctx, 'wf-sow-sub'), record: sample(ctx, 'SOW-77'), ctx, options: { asOf: '2026-10-25' } });
    const legal = result.steps.find((step) => step.title === 'Legal review');
    expect(legal?.rounds).toStrictEqual([{ n: 1, people: 'Legal (Hannah Brooks)', notes: [] }]);
  });

  it.each([
    ['EN-071', 'WO-2214'],
    ['EN-073', 'WO-2231'],
    ['EN-074', 'WO-2231'],
  ])('%s', (id, recordId) => {
    const ctx = makeContext();
    const graph = asGraph(id);
    expect(graph, `${id} graph in the bullet`).toBeDefined();
    const workflow = newWorkflow(graph as NonNullable<typeof graph>);
    expectResult(runTest({ workflow, record: sample(ctx, recordId), ctx }), expectedOf(id));
  });
});

describe('Part A.3 · Building approvals in a new workflow', () => {
  it.each(range(75, 97))('%s', (id) => {
    const ctx = makeContext();
    const graph = graphNameOf(id);
    const recordId = /× (WO-\d+)/.exec(docEntry(id).title)?.[1];
    expect(graph, `${id} belongs to an I graph`).toBeDefined();
    expect(recordId, `${id} names a record`).toBeDefined();
    const workflow = newWorkflow(iGraph(graph as string));
    expectResult(runTest({ workflow, record: sample(ctx, recordId as string), ctx }), expectedOf(id));
  });
});
