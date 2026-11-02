import { backendConfig, createBackendClient, serviceIdentity, userIdentity } from '../server/backend-client';
import { serverClock } from '../server/clock';
import { isE2E } from '../server/e2e';
import { ApiError } from '../server/errors';
import { createDjangoDriver } from './django/driver';
import { memoryDriver } from './memory/store';
import { createRepos, type FlowStore } from './repos';

export type StoreKind = 'memory' | 'django';

/**
 * Decision 2. Django unless told otherwise, so production can never silently hold workflows in memory: memory needs
 * LEVV_E2E=1 or Vitest, and LEVV_E2E=1 refuses Django, so a stray flag cannot turn test sign-in on against real data.
 */
export function selectStoreKind(env: Record<string, string | undefined> = process.env): StoreKind {
  const asked = env.FLOW_STUDIO_STORE;
  if (asked && asked !== 'memory' && asked !== 'django') {
    throw new ApiError(500, 'STORE_NOT_CONFIGURED', `FLOW_STUDIO_STORE must be memory or django, not ${asked}.`);
  }
  const e2e = isE2E(env);
  const kind: StoreKind = asked === 'memory' || asked === 'django' ? asked : e2e ? 'memory' : 'django';
  if (kind === 'memory' && !e2e && !env.VITEST) {
    throw new ApiError(500, 'STORE_NOT_CONFIGURED', 'FLOW_STUDIO_STORE=memory is only for LEVV_E2E=1 and tests.');
  }
  if (kind === 'django' && e2e) {
    throw new ApiError(500, 'STORE_NOT_CONFIGURED', 'LEVV_E2E=1 only runs on the memory store.');
  }
  return kind;
}

/** The store acting as the caller: on Django, their cookie, CSRF token and origin go with every call. */
export async function userStore(request: Request): Promise<FlowStore> {
  if (selectStoreKind() === 'memory') return createRepos(await memoryDriver(), serverClock);
  return createRepos(createDjangoDriver(createBackendClient(backendConfig(), userIdentity(request))), serverClock);
}

/** The store acting as the service: writes that no user request can carry a CSRF token for (decision 2, mutating reads). */
export async function serviceStore(request: Request): Promise<FlowStore> {
  if (selectStoreKind() === 'memory') return createRepos(await memoryDriver(), serverClock);
  return createRepos(createDjangoDriver(createBackendClient(backendConfig(), serviceIdentity(request))), serverClock);
}
