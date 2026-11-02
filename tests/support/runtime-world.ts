import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StoreDriver } from '../../src/flow-studio/data/driver';
import type { MemoryTables } from '../../src/flow-studio/data/memory/driver';
import { createMemoryDriver, emptyTables } from '../../src/flow-studio/data/memory/driver';
import { createRepos, type FlowStore } from '../../src/flow-studio/data/repos';
import { applySeed } from '../../src/flow-studio/data/seed-writes';
import { readRawSeed } from '../../src/flow-studio/data/seed-files';
import { buildSeed } from '../../src/flow-studio/model/load';
import type { Permission, TestActors, WorkItem, WorkflowRun } from '../../src/flow-studio/model/runtime';
import type { Workflow } from '../../src/flow-studio/model/workflow';
import type { Adapters } from '../../src/flow-studio/runtime/adapters';
import { mockAdapters } from '../../src/flow-studio/runtime/adapters';
import { RuntimeService } from '../../src/flow-studio/runtime/service';
import { ApiError } from '../../src/flow-studio/server/errors';
import type { Actor } from '../../src/flow-studio/server/permissions';
import type { EngineContext } from '../../src/flow-studio/model/context';

/** 06 §5.1. The runtime as Part D and 05 §9 drive it: the real service on the real store logic, with a clock the test moves. */

const FIXTURES = resolve(__dirname, '../fixtures/seed');
export const records = (JSON.parse(readFileSync(resolve(FIXTURES, 'runtime-records.json'), 'utf8')) as { records: (Record<string, unknown> & { id: string; record: string; event: string; source: string })[] }).records;
export const actorSets = (JSON.parse(readFileSync(resolve(FIXTURES, 'test-actors.json'), 'utf8')) as TestActors).actorSets;

export const START = '2026-10-20T09:00:00Z';
export const hoursAfter = (hours: number, from = START): string => new Date(Date.parse(from) + hours * 3_600_000).toISOString();

export const recordOf = (id: string): (typeof records)[number] => {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`No runtime record ${id}`);
  return record;
};

export type Result<T> = { ok: true } & T | { ok: false; code: string; message: string };

export function actor(name: string): Actor {
  const set = actorSets.default;
  const listed = set.users.find((user) => user.name === name);
  return { id: name, name, person: name, permissions: (listed?.permissions ?? []) as Permission[], ownerTeams: set.ownerTeams };
}

async function attempt<T>(action: () => Promise<T>, wrap: (value: T) => Record<string, unknown>): Promise<any> {
  try {
    return { ok: true, ...wrap(await action()) };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

export interface World {
  store: FlowStore;
  service: RuntimeService;
  clock: { set(now: string): void; now(): string; asOf(): string };
  /** 06 §1.2 `advanceClock`, which here also runs the tick, like POST /api/test/clock. */
  advanceTo(now: string): Promise<{ processed: number }>;
  tick(): Promise<{ processed: number }>;
  event(id: string, overrides?: Record<string, unknown>, data?: Record<string, unknown>): Promise<{ runIds: string[]; outcome: string }>;
  start(id: string, overrides?: Record<string, unknown>, data?: Record<string, unknown>): Promise<WorkflowRun & { rev: number }>;
  run(id: string): Promise<WorkflowRun & { rev: number }>;
  pause(run: { id: string }, by: { by: string; reason?: string }): Promise<any>;
  resume(run: { id: string }, by: { by: string }): Promise<any>;
  stop(run: { id: string }, by: { by: string; reason?: string }): Promise<any>;
  items(runId: string, filter?: Partial<WorkItem>): Promise<WorkItem[]>;
  itemFor(runId: string, assignee: string, kind?: WorkItem['kind']): Promise<WorkItem>;
  decide(itemId: string, by: string, decision: 'approved' | 'rejected' | 'sent_back' | 'verified' | 'not_verified', comment?: string): Promise<any>;
  done(itemId: string, by: string): Promise<any>;
  outbox(filter?: { runId?: string }): Promise<{ to: string; channel: string; subject: string; body: string; createdAt: string; runId: string | null }[]>;
  ledger(workerKey: string): Promise<{ gives: string; disp: string; status: string; systemRef?: string }[]>;
  publishEdited(workflowId: string, change: (nodes: Workflow['draft']['nodes'], ctx: EngineContext) => Workflow['draft']['nodes'] | void): Promise<number>;
  driver: StoreDriver;
  adaptersUsed: { calls: { system: string; match: { key: string; value: unknown }; action: string }[] };
}

export interface WorldOptions {
  autocomplete?: boolean;
  adapters?: (ctx: EngineContext) => Adapters;
  now?: string;
  /** Another store under the same repositories: tests/django runs the races on Postgres. The seed is left as it is. */
  driver?: StoreDriver;
}

export async function createWorld(options: WorldOptions = {}): Promise<World> {
  let now = options.now ?? START;
  const state: { tables: MemoryTables } = { tables: emptyTables() };
  const clock = {
    now: () => now,
    asOf: () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)),
    set: (next: string) => {
      now = next;
    },
  };
  const driver = options.driver ?? createMemoryDriver(state, { now: clock.now, actingUsers: () => actorSets.default.users.map(({ name, permissions }) => ({ name, permissions })) });
  const raw = readRawSeed();
  await applySeed(driver, raw, buildSeed(raw));
  const store = createRepos(driver, clock);
  const calls: World['adaptersUsed']['calls'] = [];
  const recording = (ctx: EngineContext): Adapters => {
    const inner = options.adapters?.(ctx) ?? mockAdapters(ctx);
    return {
      ...inner,
      system: (name, record) => {
        const adapter = inner.system(name, record);
        return { ...adapter, execute: (req) => { calls.push({ system: name, match: req.match, action: req.action }); return adapter.execute(req); } };
      },
    };
  };
  const service = new RuntimeService(store, clock, { autocomplete: options.autocomplete ?? true, origin: 'http://localhost:3310', adapters: recording });

  const event: World['event'] = (id, overrides = {}, data = {}) => {
    const record = recordOf(id);
    const recordId = (overrides.recordId as string | undefined) ?? id;
    return service.intake({ source: record.source, recordType: record.record, recordId, event: record.event, data: { ...record, id: recordId, ...data }, ...overrides });
  };

  const world: World = {
    store,
    service,
    clock,
    driver,
    adaptersUsed: { calls },
    tick: () => service.tick(),
    advanceTo: async (next) => {
      clock.set(next);
      return service.tick();
    },
    event,
    async start(id, overrides, data) {
      const { runIds, outcome } = await event(id, overrides, data);
      if (outcome !== 'started') throw new Error(`Event for ${id}: ${outcome}`);
      return world.run(runIds[0]);
    },
    run: async (id) => (await store.runs.get(id)) as WorkflowRun & { rev: number },
    pause: ({ id }, { by, reason }) => attempt(() => service.pause(actor(by), id, reason), (run) => ({ run })),
    resume: ({ id }, { by }) => attempt(() => service.resume(actor(by), id), (run) => ({ run })),
    stop: ({ id }, { by, reason }) => attempt(() => service.stop(actor(by), id, reason), (run) => ({ run })),
    items: async (runId, filter = {}) => (await store.workItems.forRun(runId)).filter((item) => Object.entries(filter).every(([key, value]) => (item as unknown as Record<string, unknown>)[key] === value)),
    async itemFor(runId, assignee, kind) {
      const found = (await store.workItems.forRun(runId)).find((item) => item.assignee === assignee && item.status === 'open' && (!kind || item.kind === kind));
      if (!found) throw new Error(`No open item for ${assignee}: ${JSON.stringify((await store.workItems.forRun(runId)).map((item) => [item.assignee, item.kind, item.status]))}`);
      return found;
    },
    decide: (itemId, by, decision, comment) => attempt(() => service.decide(actor(by), itemId, decision, comment), (item) => ({ item })),
    done: (itemId, by) => attempt(() => service.done(actor(by), itemId), (item) => ({ item })),
    outbox: async (filter = {}) => {
      const rows = await driver.list('outbox', filter.runId ? { runId: filter.runId } : {});
      return rows.map((row) => row.doc as any);
    },
    ledger: async (workerKey) => (await driver.list('ledger', { workerKey })).map((row) => row.doc as any),
    async publishEdited(workflowId, change) {
      const found = (await store.workflows.get(workflowId)) as NonNullable<Awaited<ReturnType<typeof store.workflows.get>>>;
      const ctx = { ...(await store.reference.getAll()), workflows: await store.workflows.all(), samples: [], history: [], asOf: clock.asOf(), now: clock.now(), idGen: (await import('../../src/flow-studio/engine/ids')).createIdGen(101), approverAvailability: { othersCanApprove: true } } as EngineContext;
      ctx.idGen.reserve(Object.keys(found.workflow.draft.nodes));
      const nodes = structuredClone(found.workflow.draft.nodes);
      const replaced = change(nodes, ctx);
      const draft = { ...found.workflow, draft: { nodes: replaced ?? nodes } };
      const saved = await store.workflows.saveDraft(workflowId, draft, found.draftRev, 'Flow Admin');
      if ('conflict' in saved) throw new Error('Draft conflict');
      const current = (await store.workflows.get(workflowId))?.workflow as Workflow;
      const snapshot = { ...current };
      delete snapshot.versions;
      const pending = { submittedBy: 'Flow Admin', submittedAt: clock.now(), effective: clock.asOf(), precedence: [] };
      const request = await store.publishRequests.create(
        { workflowId, snapshot, goLive: clock.asOf(), precedence: [], review: { impact: 0, mustFix: [], overlaps: [], openOverlaps: [], canSend: true, effective: clock.asOf() }, requestedBy: 'Flow Admin' },
        pending,
        ['Samira Khan'],
      );
      return (await store.workflows.publishVersion(workflowId, request, 'Samira Khan')).version;
    },
  };
  return world;
}

