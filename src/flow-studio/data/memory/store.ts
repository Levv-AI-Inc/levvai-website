import { parseSeedFile } from '../../model/schemas';
import { buildSeed } from '../../model/load';
import type { TestActors } from '../../model/runtime';
import { e2eState, type E2EState } from '../../server/e2e';
import { fixedNow, canonicalIso } from '../../server/clock';
import { DEFAULT_SEED_DIR, readRawSeed, readSeedFile } from '../seed-files';
import { applySeed } from '../seed-writes';
import type { StoreDriver } from '../driver';
import { createMemoryDriver, emptyTables, type MemoryTables } from './driver';

export type ActorSetName = keyof TestActors['actorSets'];

type LoadedState = E2EState & { tables: MemoryTables };

const nowOf = (state: E2EState): string => state.clock ?? fixedNow() ?? canonicalIso(new Date());

function driverFor(state: LoadedState): StoreDriver {
  return createMemoryDriver(state, {
    now: () => nowOf(state),
    actingUsers: () => (state.actors?.users ?? []).map(({ name, permissions }) => ({ name, permissions })),
  });
}

/** 01 §5.3: a freshly seeded store, one actor set, runtime data cleared and the clock back at LEVV_FIXED_NOW. */
export async function resetMemoryStore(actors: ActorSetName = 'default', dir: string = DEFAULT_SEED_DIR): Promise<void> {
  const state = e2eState();
  state.clock = fixedNow() ?? canonicalIso(new Date());
  state.tables = emptyTables();
  state.actors = parseSeedFile('test-actors', readSeedFile(dir, 'test-actors')).actorSets[actors];
  const raw = readRawSeed(dir);
  await applySeed(driverFor(state as LoadedState), raw, buildSeed(raw));
}

/** The running app's memory store, seeded on first use so a dev server works without calling reset first. */
export async function memoryDriver(): Promise<StoreDriver> {
  const state = e2eState();
  if (!state.tables) await resetMemoryStore();
  return driverFor(state as LoadedState);
}
