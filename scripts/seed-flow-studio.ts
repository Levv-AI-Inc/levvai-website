import { createDjangoDriver } from '../src/flow-studio/data/django/driver';
import { readRawSeed } from '../src/flow-studio/data/seed-files';
import { refusalForBackend, refusalForDatabase } from '../src/flow-studio/data/seed-guard';
import { applySeed } from '../src/flow-studio/data/seed-writes';
import { buildSeed } from '../src/flow-studio/model/load';
import { createBackendClient } from '../src/flow-studio/server/backend-client';

/*
 * npm run seed:flow-studio (01 §4.2). Loads docs/flow-studio/seed into one tenant through the store API, so it needs
 * the backend running. Env: FLOW_STUDIO_BACKEND_URL (or LOCAL_BACKEND_URL), FLOW_STUDIO_STORE_TOKEN, and
 * FLOW_STUDIO_SEED_TENANT_HOST (default localhost). Refuses a backend or database that is not on this machine unless
 * FLOW_STUDIO_SEED_ALLOW_REMOTE=1.
 */
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const { env } = process;
  const baseUrl = (env.FLOW_STUDIO_BACKEND_URL || env.LOCAL_BACKEND_URL || '').replace(/\/+$/, '');
  if (!baseUrl) fail('Set FLOW_STUDIO_BACKEND_URL to the backend to seed.');
  const backendRefusal = refusalForBackend(baseUrl, env);
  if (backendRefusal) fail(backendRefusal);
  const storeToken = env.FLOW_STUDIO_STORE_TOKEN;
  if (!storeToken) fail('Set FLOW_STUDIO_STORE_TOKEN to the token the backend was started with.');

  const tenantHost = env.FLOW_STUDIO_SEED_TENANT_HOST || 'localhost';
  const client = createBackendClient({ baseUrl, storeToken }, { tenantHost, proto: 'http' });

  const response = await client.store('GET', 'seed-target/');
  if (response.status !== 200) fail(`The backend answered ${response.status} for tenant host ${tenantHost}.`);
  const target = (await response.json()) as { schema: string; databaseIsLocal: boolean };
  const databaseRefusal = refusalForDatabase(target, env);
  if (databaseRefusal) fail(databaseRefusal);

  const raw = readRawSeed();
  const summary = await applySeed(createDjangoDriver(client), raw, buildSeed(raw));
  console.log(
    `Seeded tenant schema "${target.schema}": ${summary.workflows} workflows, ${summary.versions} versions, ` +
      `${summary.reference} reference files, ${summary.samples} samples, ${summary.history} history records.`,
  );
  if (summary.skipped.length > 0) console.log(`Left alone (published since seeding or waiting for approval): ${summary.skipped.join(', ')}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
