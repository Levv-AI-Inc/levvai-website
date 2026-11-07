import { createDjangoDriver } from '@flow-studio/data/django/driver';
import { refusalForBackend } from '@flow-studio/data/seed-guard';
import { createBackendClient } from '@flow-studio/server/backend-client';
import { runtimeRaces } from '../support/runtime-races';

/** The same races, on Postgres, on the proof tenant: separate connections and `UPDATE … WHERE rev` decide who wins. */
const baseUrl = process.env.FLOW_STUDIO_BACKEND_URL ?? '';
const storeToken = process.env.FLOW_STUDIO_STORE_TOKEN ?? '';
const tenantHost = process.env.FLOW_STUDIO_CONTRACT_TENANT_HOST ?? '';

if (!baseUrl || !storeToken || !tenantHost) throw new Error('Run this through scripts/flow-studio-django-proof.sh');
const refusal = refusalForBackend(baseUrl, {});
if (refusal) throw new Error(refusal);

runtimeRaces('Django and Postgres', async () => ({ driver: createDjangoDriver(createBackendClient({ baseUrl, storeToken }, { tenantHost, proto: 'http' })) }));
