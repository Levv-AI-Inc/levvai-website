import type { RawSeedFiles, SeedData } from '../model/load';
import type { ReferenceKey } from '../model/runtime';
import type { Workflow, WorkflowVersion } from '../model/workflow';
import type { Row, StoreDriver, StoreWrite } from './driver';
import { versionDoc, versionRowId, workflowDoc } from './repos';

const REFERENCE_KEYS: ReferenceKey[] = ['people-and-authority', 'approval-rules', 'catalog', 'digital-workers', 'onboarding-presets', 'systems'];
const SEED_BY = 'Seed';

/** 01 §4.2: the seeded version counts as approved by "Seed". */
function seededVersion(workflow: Workflow, version: WorkflowVersion) {
  return versionDoc(workflow, {
    ...version,
    publishedAt: `${version.effective}T00:00:00Z`,
    submittedBy: SEED_BY,
    approvedBy: SEED_BY,
  });
}

function writesFor(raw: RawSeedFiles, seed: SeedData, skip: Set<string>): StoreWrite[] {
  const writes: StoreWrite[] = [];
  for (const key of REFERENCE_KEYS) writes.push({ op: 'upsert', collection: 'reference', id: key, doc: raw[key], by: SEED_BY });
  seed.workflows.forEach((workflow, index) => {
    if (skip.has(workflow.id)) return;
    writes.push({ op: 'upsert', collection: 'workflows', id: workflow.id, doc: workflowDoc(workflow), position: index + 1, by: SEED_BY });
    for (const version of workflow.versions ?? []) {
      writes.push({ op: 'upsert', collection: 'versions', id: versionRowId(workflow.id, version.version), doc: seededVersion(workflow, version), by: SEED_BY });
    }
  });
  seed.samples.forEach((sample, index) => writes.push({ op: 'upsert', collection: 'samples', id: sample.id, doc: sample, position: index + 1, by: SEED_BY }));
  seed.history.forEach((record, index) => writes.push({ op: 'upsert', collection: 'history', id: record.id, doc: record, position: index + 1, by: SEED_BY }));
  return writes;
}

export interface SeedSummary { reference: number; workflows: number; versions: number; samples: number; history: number; skipped: string[] }

/**
 * 01 §4.2: upsert by id, never touch runs. A workflow that has been published past its seed version, or is waiting for
 * approval, is left alone: overwriting it would orphan its version rows and its publish request.
 */
export function seedSkips(seed: SeedData, existing: Row[]): string[] {
  const stored = new Map(existing.map((row) => [row.id, row.doc as Workflow]));
  return seed.workflows
    .filter((workflow) => {
      const current = stored.get(workflow.id);
      return current ? current.version > workflow.version || Boolean(current.pending) : false;
    })
    .map((workflow) => workflow.id);
}

export async function applySeed(driver: StoreDriver, raw: RawSeedFiles, seed: SeedData): Promise<SeedSummary> {
  const skipped = seedSkips(seed, await driver.list('workflows'));
  const writes = writesFor(raw, seed, new Set(skipped));
  const result = await driver.tx(writes);
  if (result.ok === false) {
    const write = writes[result.index];
    throw new Error(`Seed write ${result.index} (${write.collection}) conflicted: ${result.reason}`);
  }
  const count = (collection: StoreWrite['collection']) => writes.filter((write) => write.collection === collection).length;
  return {
    reference: count('reference'),
    workflows: count('workflows'),
    versions: count('versions'),
    samples: count('samples'),
    history: count('history'),
    skipped,
  };
}
