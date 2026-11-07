import { join } from 'node:path';
import { loadSeed, readSeedFile } from '@flow-studio/data/seed-files';
import { createIdGen } from '@flow-studio/engine/ids';
import type { EngineContext, Workflow } from '@flow-studio/model';
import type { SeedData } from '@flow-studio/model/load';
import { parseSeedFile, type SeedFileContents } from '@flow-studio/model/schemas';

/** The seed copies every test reads (06 §1.2). */
export const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'seed');

export const TEST_AS_OF = '2026-10-20';
export const TEST_NOW = '2026-10-20T09:00:00Z';

let seed: SeedData | undefined;

/** Load once: the first call reads the fixtures, every later call shares that one copy. Never hand it to a test. */
function loadedSeed(): SeedData {
  seed ??= loadSeed(FIXTURE_DIR);
  return seed;
}

/** 06 §1.2: a fresh EngineContext built from a deep clone of the seed, with the fixed test date and clock. */
export function makeContext(overrides: Partial<Pick<EngineContext, 'asOf' | 'now' | 'approverAvailability'>> = {}): EngineContext {
  return {
    ...structuredClone(loadedSeed()),
    asOf: TEST_AS_OF,
    now: TEST_NOW,
    idGen: createIdGen(101),
    approverAvailability: { othersCanApprove: true },
    ...overrides,
  };
}

export function workflowById(ctx: Pick<EngineContext, 'workflows'>, id: string): Workflow {
  const workflow = ctx.workflows.find((w) => w.id === id);
  if (!workflow) throw new Error(`No workflow ${id} in the seed`);
  return workflow;
}

/** The fixtures loadSeed does not read (06 §1.2). */
export const loadTestActors = (): SeedFileContents['test-actors'] =>
  parseSeedFile('test-actors', readSeedFile(FIXTURE_DIR, 'test-actors'));

export const loadRuntimeRecords = (): SeedFileContents['runtime-records'] =>
  parseSeedFile('runtime-records', readSeedFile(FIXTURE_DIR, 'runtime-records'));

/** 06 §1.3: the only tolerance when comparing strings. */
export const norm = (s: string): string => s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
