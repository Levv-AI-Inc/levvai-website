import { describe, expect, it } from 'vitest';
import { composeTest, samplesFor } from '@flow-studio/engine/compose';
import { createEditor } from '@flow-studio/engine/edit';
import { lintWorkflow } from '@flow-studio/engine/lint';
import { simulateTest } from '@flow-studio/engine/simulate';
import { layoutWorkflow } from '@flow-studio-ui/canvas/layout';
import type { EngineContext, Workflow } from '@flow-studio/model';
import { fortySteps } from '../support/forty-steps';
import { makeContext } from '../support/context';

/** M8 item 3: CODEX_PROMPT M8, "simulateTest under 150 ms for the largest seeded workflow". Numbers print as PERF lines; BUILD_REPORT quotes them. */

const SIMULATE_LIMIT_MS = 150;
const ROUNDS = 25;

function timed(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

function summary(samples: number[]): { first: number; median: number; worst: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  return { first: samples[0], median: sorted[Math.floor(sorted.length / 2)], worst: sorted[sorted.length - 1] };
}

const report = (name: string, numbers: { first: number; median: number; worst: number }): void => {
  console.log(`PERF ${name}: first ${numbers.first.toFixed(2)} ms, median ${numbers.median.toFixed(2)} ms, worst ${numbers.worst.toFixed(2)} ms`);
};

function largest(ctx: EngineContext): Workflow {
  return [...ctx.workflows].sort((a, b) => Object.keys(b.draft.nodes).length - Object.keys(a.draft.nodes).length)[0];
}

function simulateAll(workflow: Workflow, ctx: EngineContext): number[] {
  const records = samplesFor(workflow, ctx).map((row) => ctx.samples.find((sample) => sample.id === row.id)).filter((sample) => sample !== undefined);
  const times: number[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    for (const sample of records) {
      times.push(timed(() => simulateTest(workflow, sample, ctx)));
    }
  }
  return times;
}

describe('performance', () => {
  it('the largest seeded workflow: simulateTest is under 150 ms for every record that fits it, first call included', () => {
    const ctx = makeContext();
    const workflow = largest(ctx);
    expect(workflow.id).toBe('wf-onboard');
    expect(Object.keys(workflow.draft.nodes).length).toBeGreaterThanOrEqual(20);
    // What is timed is the real thing: EN-001's whole result, nine step cards for this record.
    const onboarding = ctx.samples.find((sample) => sample.id === 'WO-2214-A');
    if (!onboarding) throw new Error('No WO-2214-A');
    expect(composeTest(simulateTest(workflow, onboarding, ctx), ctx).steps.length).toBe(9);
    const numbers = summary(simulateAll(workflow, ctx));
    report(`simulateTest ${workflow.id} (${Object.keys(workflow.draft.nodes).length} boxes)`, numbers);
    expect(numbers.worst).toBeLessThan(SIMULATE_LIMIT_MS);
  });

  it('every seeded workflow: simulateTest stays under 150 ms, whichever turns out slowest', () => {
    const ctx = makeContext();
    const all = ctx.workflows.map((workflow) => ({ id: workflow.id, ...summary(simulateAll(workflow, ctx).concat(0)) }));
    const slowest = [...all].sort((a, b) => b.worst - a.worst)[0];
    report(`simulateTest slowest seeded workflow, ${slowest.id}`, slowest);
    expect(slowest.worst).toBeLessThan(SIMULATE_LIMIT_MS);
  });

  describe('a 40-step workflow', () => {
    const forty = (ctx: EngineContext): Workflow => {
      const workflow = structuredClone(ctx.workflows.find((candidate) => candidate.id === 'wf-wo-sub') as Workflow);
      workflow.draft.nodes = fortySteps() as unknown as Workflow['draft']['nodes'];
      ctx.workflows = ctx.workflows.map((candidate) => (candidate.id === workflow.id ? workflow : candidate));
      return workflow;
    };

    it('has 40 steps, and every box is reachable and laid out', () => {
      const ctx = makeContext();
      const workflow = forty(ctx);
      expect(Object.keys(workflow.draft.nodes).filter((id) => id !== 'T' && id !== 'END')).toHaveLength(40);
      expect(layoutWorkflow(workflow.draft.nodes).nodes).toHaveLength(42);
      expect(lintWorkflow(workflow, ctx).issues.filter((issue) => /can’t be reached/.test(issue.m))).toEqual([]);
    });

    it('what one keystroke recomputes takes less than a frame budget of 50 ms: edit, layout and lint', () => {
      const ctx = makeContext();
      const workflow = forty(ctx);
      const editor = createEditor(ctx);
      const times: number[] = [];
      for (let round = 0; round < ROUNDS; round += 1) {
        times.push(
          timed(() => {
            const nodes = editor.setField(workflow.draft.nodes, 'S3b', 'label', `Sign-off ${round}`);
            layoutWorkflow(nodes);
            lintWorkflow({ ...workflow, draft: { ...workflow.draft, nodes } }, ctx);
          }),
        );
      }
      const numbers = summary(times);
      report('keystroke on 40 steps (edit, layout, lint)', numbers);
      expect(numbers.median).toBeLessThan(50);
    });

    it('simulate and compose: under 150 ms, as the seed', () => {
      const ctx = makeContext();
      const workflow = forty(ctx);
      const sample = ctx.samples.find((row) => row.id === 'WO-2214');
      if (!sample) throw new Error('No WO-2214');
      const times: number[] = [];
      for (let round = 0; round < ROUNDS; round += 1) times.push(timed(() => composeTest(simulateTest(workflow, sample, ctx), ctx)));
      const numbers = summary(times);
      report('simulateTest + composeTest on 40 steps', numbers);
      expect(numbers.worst).toBeLessThan(SIMULATE_LIMIT_MS);
    });
  });
});
