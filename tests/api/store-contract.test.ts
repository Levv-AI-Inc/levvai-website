import { createMemoryDriver, emptyTables } from '@flow-studio/data/memory/driver';
import { storeContract } from '../support/store-contract';

storeContract('memory', () =>
  createMemoryDriver({ tables: emptyTables() }, { now: () => '2026-10-20T09:00:00Z', actingUsers: () => [] }),
);
