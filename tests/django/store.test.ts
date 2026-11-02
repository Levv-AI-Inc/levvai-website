import { createDjangoDriver } from '@flow-studio/data/django/driver';
import { refusalForBackend } from '@flow-studio/data/seed-guard';
import { createBackendClient } from '@flow-studio/server/backend-client';
import { storeContract } from '../support/store-contract';

/** The same contract the memory store passes in tests/api, on a throwaway tenant of the local Postgres. */
const baseUrl = process.env.FLOW_STUDIO_BACKEND_URL ?? '';
const storeToken = process.env.FLOW_STUDIO_STORE_TOKEN ?? '';
const tenantHost = process.env.FLOW_STUDIO_CONTRACT_TENANT_HOST ?? '';

if (!baseUrl || !storeToken || !tenantHost) throw new Error('Run this through scripts/flow-studio-django-proof.sh');
const refusal = refusalForBackend(baseUrl, {});
if (refusal) throw new Error(refusal);

storeContract('django', () => createDjangoDriver(createBackendClient({ baseUrl, storeToken }, { tenantHost, proto: 'http' })));
