import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSeed, SEED_DATA_FILES, type RawSeedFiles, type SeedData } from '../model/load';

/** Where the seed package lives when the app runs from the repository root. */
export const DEFAULT_SEED_DIR = join(process.cwd(), 'docs', 'flow-studio', 'seed');

export function readSeedFile(dir: string, name: string): unknown {
  return JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
}

/** The nine seed data files as stored, not validated. */
export function readRawSeed(dir: string = DEFAULT_SEED_DIR): RawSeedFiles {
  const raw = {} as RawSeedFiles;
  for (const name of SEED_DATA_FILES) raw[name] = readSeedFile(dir, name);
  return raw;
}

/** Reads the nine seed data files, validates them and applies 02 §15. Server and test code only. */
export function loadSeed(dir: string = DEFAULT_SEED_DIR): SeedData {
  return buildSeed(readRawSeed(dir));
}
