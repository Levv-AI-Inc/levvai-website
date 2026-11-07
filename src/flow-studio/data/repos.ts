import { editableFields } from './draft-fields';
import { randomUUID } from 'node:crypto';
import { createWorkflowIn } from '../engine/edit';
import { copy } from '../engine/copy';
import { createIdGen } from '../engine/ids';
import { approvePublish, isAuthorOf, publishedFacts } from '../engine/publish';
import { title } from '../engine/text';
import type { Catalog } from '../model/catalog';
import { normaliseCatalog, normalisePeople } from '../model/load';
import type {
  AccountLink,
  BusinessRecord,
  InboundEvent,
  LedgerLine,
  NewWorkflowInput,
  OutboxMessage,
  PublishRequest,
  ReferenceBundle,
  ReferenceKey,
  RunEvent,
  RunStatus,
  RunSummary,
  WorkItem,
  WorkflowRun,
  WorkflowSummary,
} from '../model/runtime';
import type { HistoryRecord, RecordData, SampleRecord } from '../model/records';
import type { SeedCatalog, SeedPeople, SeedWorkflow } from '../model/schemas';
import type { RecordKey } from '../model/catalog';
import type { PendingPublish, Workflow, WorkflowVersion } from '../model/workflow';
import { ApiError, notFound } from '../server/errors';
import { decodeRun, encodeRun } from './codec';
import type { ActingUserRow, Collection, MemberRow, Row, StoreDriver, StoreWrite, TxResult } from './driver';
import { workflowSummaries } from './summaries';

/** 01 §4.3. Every read and write of Flow Studio data goes through these. */
/** Who did something: the name the screen shows and, for a signed-in person, the account behind it (decision 5). */
export interface ActorRef { id?: string; name: string }
const refOf = (who: string | ActorRef): ActorRef => (typeof who === 'string' ? { name: who } : { id: who.id, name: who.name });

export interface WorkflowRepo {
  list(): Promise<WorkflowSummary[]>;
  /** Additive: EngineContext needs the full objects, in stored order. */
  all(): Promise<Workflow[]>;
  get(id: string): Promise<{ workflow: Workflow; draftRev: number; versions: WorkflowVersion[] } | null>;
  create(input: NewWorkflowInput, by: string): Promise<Workflow>;
  saveDraft(id: string, draft: Workflow, expectedRev: number, by: string): Promise<{ draftRev: number } | { conflict: true }>;
  setActive(id: string, active: boolean, by: string): Promise<Workflow>;
  publishVersion(id: string, req: PublishRequest, approvedBy: string | ActorRef, comment?: string): Promise<WorkflowVersion>;
}
export interface PublishRequestRepo {
  /** Writes the request, the workflow's `pending` and one inbox copy per approver together (05 §7). */
  create(input: NewPublishRequest, pending: PendingPublish, approvers: string[], announce?: (itemId: string) => { subject: string; body: string }): Promise<PublishRequest>;
  get(id: string): Promise<PublishRequest | null>;
  listPending(): Promise<PublishRequest[]>;
  /** Approved requests whose author has not been told yet, newest last (03 §13.5). */
  awaitingNotice(workflowId: string, author: string | ActorRef): Promise<PublishRequest[]>;
  markNotified(ids: string[]): Promise<void>;
  decide(id: string, decision: 'rejected' | 'withdrawn', by: string | ActorRef, comment?: string): Promise<PublishRequest>;
}
export type NewPublishRequest = Omit<PublishRequest, 'id' | 'status' | 'requestedAt'>;

export interface ReferenceRepo {
  getAll(): Promise<ReferenceBundle>;
  bundleFor(workflows: Workflow[]): Promise<ReferenceBundle>;
  replace(key: ReferenceKey, data: unknown, by: string): Promise<void>;
}
export interface RecordRepo {
  samples(): Promise<SampleRecord[]>;
  history(): Promise<HistoryRecord[]>;
  get(type: RecordKey, id: string): Promise<BusinessRecord | null>;
  upsert(rec: BusinessRecord): Promise<void>;
}
export type StoredRun = WorkflowRun & { rev: number };
export interface RunFilter { status?: RunStatus | RunStatus[]; workflowId?: string; recordId?: string }
export interface RunRepo {
  create(run: WorkflowRun): Promise<StoredRun>;
  get(id: string): Promise<StoredRun | null>;
  list(filter?: RunFilter): Promise<RunSummary[]>;
  /** The runs themselves, for the scheduler. */
  rows(filter?: RunFilter): Promise<StoredRun[]>;
  update(run: WorkflowRun, expectedRev: number): Promise<StoredRun | { conflict: true }>;
  appendEvent(runId: string, event: RunEvent): Promise<void>;
}
export interface WorkItemRepo {
  open(item: WorkItem): Promise<WorkItem>;
  get(id: string): Promise<WorkItem | null>;
  listFor(person: string): Promise<WorkItem[]>;
  forRun(runId: string): Promise<WorkItem[]>;
  close(id: string, decision: NonNullable<WorkItem['decision']>, comment?: string): Promise<void>;
  holdForRun(runId: string): Promise<void>;
  releaseForRun(runId: string): Promise<void>;
  cancelForRun(runId: string): Promise<void>;
}
export interface LedgerRepo {
  add(line: LedgerLine): Promise<void>;
  openFor(workerKey: string): Promise<LedgerLine[]>;
  close(id: string): Promise<void>;
}
export interface OutboxRepo { enqueue(message: OutboxMessage): Promise<void> }
export interface InboundRepo {
  add(event: InboundEvent): Promise<void>;
  findByRecord(recordId: string): Promise<InboundEvent[]>;
  list(filter: { outcome: string | string[] }): Promise<InboundEvent[]>;
  update(id: string, changes: Partial<InboundEvent>): Promise<void>;
}

/** Decision 5: the tenant's links between accounts and people or teams. Writing goes through reference.import, on the route. */
export interface LinkRepo {
  get(accountId: string): Promise<AccountLink | null>;
  list(): Promise<AccountLink[]>;
  set(link: AccountLink): Promise<AccountLink | { conflict: true }>;
}

export interface FlowStore {
  links: LinkRepo;
  workflows: WorkflowRepo;
  publishRequests: PublishRequestRepo;
  reference: ReferenceRepo;
  records: RecordRepo;
  runs: RunRepo;
  workItems: WorkItemRepo;
  ledger: LedgerRepo;
  outbox: OutboxRepo;
  inbound: InboundRepo;
  /** Several writes that must land together (decision 2): M7's advance() builds on this. */
  tx(writes: StoreWrite[]): Promise<TxResult>;
  actingUsers(): Promise<ActingUserRow[]>;
  members(): Promise<MemberRow[]>;
  /** One row of any collection, for a read no repository method names. The runtime uses it for claims and events. */
  rawGet(collection: Collection, id: string): Promise<Row | null>;
}

export interface StoreClock { now(): string; asOf(): string }

export { editableFields };

/** The workflow with what the author sent in place of the draft they may have kept editing, keeping the live status and pending. */
function asSent(current: Workflow, snapshot: Workflow): Workflow {
  const { set, unset } = editableFields(snapshot);
  const sent = { ...current, ...set, effective: current.effective } as Workflow & Record<string, unknown>;
  for (const key of unset) delete sent[key];
  return sent;
}

/** The row holds the workflow without `versions`: they are rows of their own, and a second copy could disagree. */
export function workflowDoc(workflow: Workflow): Omit<Workflow, 'versions'> {
  const doc = { ...workflow };
  delete doc.versions;
  return doc;
}

/** Same event, a record in common: all a pair needs before their scopes and history decide whether they overlap (03 §13.3). */
function couldOverlap(other: Workflow, sent: Workflow): boolean {
  const facts = publishedFacts(other);
  return (facts.event === sent.event && facts.records.some((record) => sent.records.includes(record))) || (other.event === sent.event && other.records.some((record) => sent.records.includes(record)));
}

export const versionRowId = (workflowId: string, version: number): string => `${workflowId}:v${version}`;

/** 01 §4.1: a version keeps what it needs to run later, whatever happens to the workflow. */
export function versionDoc(workflow: Workflow, version: WorkflowVersion) {
  const { records, event, onReject, source, owner, basis, days, priority } = workflow;
  return { workflowId: workflow.id, ...version, records, event, onReject, source, owner, basis, days, priority };
}

function versionFromRow(doc: unknown): WorkflowVersion {
  const version = { ...(doc as WorkflowVersion & { workflowId?: string }) };
  delete version.workflowId;
  return version;
}

function workflowFromRow(row: Row): Workflow {
  const workflow = row.doc as Workflow;
  const versions = (row.versions ?? []).map(versionFromRow);
  return versions.length > 0 ? { ...workflow, versions } : workflow;
}

function runFromRow(row: Row): StoredRun {
  const log = (row.events ?? []).map((event) => {
    const line = { ...(event as RunEvent & { id?: string; runId?: string }) };
    delete line.id;
    delete line.runId;
    return line as RunEvent;
  });
  return { ...decodeRun(row.doc), log, rev: row.rev as number };
}

const conflictError = (): ApiError => new ApiError(409, 'CONFLICT', copy.draftConflict);

const newId = (prefix: string): string => `${prefix}-${randomUUID()}`;

export function createRepos(driver: StoreDriver, clock: StoreClock): FlowStore {
  const allWorkflows = async (): Promise<Workflow[]> => (await driver.list('workflows')).map(workflowFromRow);

  const mustApply = async (writes: StoreWrite[]): Promise<TxResult & { ok: true }> => {
    const result = await driver.tx(writes);
    if (result.ok === false) throw conflictError();
    return result;
  };

  const referenceDoc = async <T>(key: ReferenceKey): Promise<T> => {
    const row = await driver.get('reference', key);
    if (!row) throw new ApiError(503, 'NOT_SEEDED', 'Flow Studio has no data for this tenant yet. Run npm run seed:flow-studio.');
    return row.doc as T;
  };

  const bundleFor = async (workflows: Workflow[]): Promise<ReferenceBundle> => {
    const [catalog, people, approvalRules, dws, presets, systems] = await Promise.all([
      referenceDoc<SeedCatalog>('catalog'),
      referenceDoc<SeedPeople>('people-and-authority'),
      referenceDoc<{ approvalRules: ReferenceBundle['rules'] }>('approval-rules'),
      referenceDoc<ReferenceBundle['dws']>('digital-workers'),
      referenceDoc<ReferenceBundle['presets']>('onboarding-presets'),
      referenceDoc<ReferenceBundle['systems']>('systems'),
    ]);
    return {
      catalog: normaliseCatalog(catalog),
      people: normalisePeople(people, workflows as unknown as SeedWorkflow[]),
      rules: approvalRules.approvalRules,
      dws,
      presets,
      systems,
    };
  };

  const closeCopies = (requestId: string, decision: 'approved' | 'rejected', now: string, by: string, comment?: string): StoreWrite => ({
    op: 'updateWhere',
    collection: 'items',
    where: { publishRequestId: requestId, status: 'open' },
    set: { status: 'done', decision, doneAt: now, ...(comment === undefined ? {} : { comment }) },
    by,
  });

  const workflows: WorkflowRepo = {
    async list() {
      const [rows, catalog] = await Promise.all([allWorkflows(), referenceDoc<Catalog>('catalog')]);
      return workflowSummaries(rows, catalog);
    },
    all: allWorkflows,
    async get(id) {
      const row = await driver.get('workflows', id);
      if (!row) return null;
      const workflow = workflowFromRow(row);
      return { workflow, draftRev: row.rev as number, versions: workflow.versions ?? [] };
    },
    async create(input, by) {
      for (let attempt = 0; ; attempt += 1) {
        const existing = await allWorkflows();
        let from: Workflow | null = null;
        if (input.fromWorkflowId) {
          from = existing.find((workflow) => workflow.id === input.fromWorkflowId) ?? null;
          if (!from) throw notFound('That workflow doesn’t exist.');
        }
        // Conflict 8 in the notes: the generator only knows the graph it edits, so the ids taken in this tenant are reserved here.
        const idGen = createIdGen(101);
        idGen.reserve(existing.map((workflow) => workflow.id));
        const workflow = createWorkflowIn(from, { idGen, asOf: clock.asOf() });
        const result = await driver.tx([{ op: 'insert', collection: 'workflows', id: workflow.id, doc: workflow, by }]);
        if (result.ok === true) return workflow;
        if (result.reason !== 'exists' || attempt >= 3) throw conflictError();
      }
    },
    async saveDraft(id, draft, expectedRev, by) {
      const result = await driver.tx([{ op: 'patch', collection: 'workflows', id, ...editableFields(draft), expectRev: expectedRev, bumpRev: true, by }]);
      if (result.ok === true) return { draftRev: result.results[0].rev as number };
      if (result.reason === 'missing') throw notFound('That workflow doesn’t exist.');
      return { conflict: true };
    },
    async setActive(id, active, by) {
      const row = await driver.get('workflows', id);
      if (!row) throw notFound('That workflow doesn’t exist.');
      const { status } = row.doc as Workflow;
      // No rev bump (03 §14.4): this is not a draft edit, and an open editor's next autosave must still go through.
      await mustApply([{ op: 'patch', collection: 'workflows', id, set: { status: active ? 'live' : 'inactive' }, expect: { status }, by }]);
      const updated = await driver.get('workflows', id);
      return workflowFromRow(updated as Row);
    },
    async publishVersion(id, req, approvedBy, comment) {
      const approver = refOf(approvedBy);
      const [all, history] = await Promise.all([allWorkflows(), driver.list('history')]);
      const current = all.find((workflow) => workflow.id === id);
      if (!current) throw notFound('That workflow doesn’t exist.');
      // 04 §10: edits made after sending go into the next draft, so what is published is what was sent.
      const now = clock.now();
      const sent = asSent(current, req.snapshot);
      const outcome = approvePublish(sent, { ...approver, permissions: ['flow.approve_changes'] }, { workflows: all, now, history: history.map((row) => row.doc as HistoryRecord) });
      if (outcome.ok === false) {
        if (outcome.overlap) throw new ApiError(409, 'OVERLAP_OPEN', outcome.message);
        throw outcome.message === copy.nothingWaiting ? new ApiError(409, 'NOT_PENDING', outcome.message) : new ApiError(403, 'FORBIDDEN', outcome.message);
      }

      const { workflow, others } = outcome;
      const versions = workflow.versions as WorkflowVersion[];
      const version = versions[versions.length - 1];
      const writes: StoreWrite[] = [
        {
          op: 'patch',
          collection: 'requests',
          id: req.id,
          set: { status: 'approved', decidedBy: approver.name, ...(approver.id === undefined || approver.id === approver.name ? {} : { decidedById: approver.id }), decidedAt: now, publishedVersion: workflow.version, ...(comment === undefined ? {} : { comment }) },
          expect: { status: 'pending' },
          by: approver.name,
        },
        {
          op: 'patch',
          collection: 'workflows',
          id,
          // Only a first publish changes the status, and only from draft: Active / Inactive stays whoever's it was at this moment (03 §14.4).
          set: { ...(current.status === 'draft' ? { status: workflow.status } : {}), version: workflow.version, effective: workflow.effective, priority: workflow.priority, published: workflow.published, pending: null },
          expect: { version: current.version, ...(current.status === 'draft' ? { status: 'draft' } : {}) },
          bumpRev: true,
          by: approver.name,
        },
        // Every workflow this one could overlap has to be as it was read, so two approvals at once can't both pass the overlap check.
        ...all
          .filter((other) => other.id !== id && (others.some((chosen) => chosen.id === other.id) || couldOverlap(other, sent)))
          .map((other): StoreWrite => {
            const chosen = others.find((candidate) => candidate.id === other.id);
            return { op: 'patch', collection: 'workflows', id: other.id, ...(chosen ? { set: { priority: chosen.priority }, by: approver.name } : {}), expect: { version: other.version, status: other.status } };
          }),
        { op: 'insert', collection: 'versions', id: versionRowId(id, version.version), doc: versionDoc(workflow, version), by: approver.name },
        closeCopies(req.id, 'approved', now, approver.name, comment),
      ];
      const result = await driver.tx(writes);
      if (result.ok === false) throw result.index === 0 ? new ApiError(409, 'NOT_PENDING', copy.nothingWaiting) : conflictError();
      return version;
    },
  };

  const publishRequests: PublishRequestRepo = {
    async create(input, pending, approvers, announce) {
      const now = pending.submittedAt;
      const request: PublishRequest = { id: newId('pr'), ...input, status: 'pending', requestedAt: now };
      const copies = approvers.flatMap((assignee): StoreWrite[] => {
        const item: WorkItem = { id: newId('wi'), kind: 'publish_request', runId: null, nodeId: null, publishRequestId: request.id, assignee, status: 'open', createdAt: now };
        const write: StoreWrite = { op: 'insert', collection: 'items', id: item.id, doc: item, by: input.requestedBy };
        if (!announce) return [write];
        const id = newId('om');
        const message: OutboxMessage = { id, runId: null, to: assignee, channel: 'Email', ...announce(item.id), createdAt: now };
        return [write, { op: 'insert', collection: 'outbox', id, doc: message, by: input.requestedBy }];
      });
      const result = await driver.tx([
        { op: 'patch', collection: 'workflows', id: input.workflowId, set: { pending }, expect: { pending: null }, by: input.requestedBy },
        { op: 'insert', collection: 'requests', id: request.id, doc: request, by: input.requestedBy },
        ...copies,
      ]);
      if (result.ok === false) throw result.index === 0 ? new ApiError(409, 'ALREADY_WAITING', copy.alreadyWaiting) : conflictError();
      return request;
    },
    async get(id) {
      const row = await driver.get('requests', id);
      return row ? (row.doc as PublishRequest) : null;
    },
    async listPending() {
      return (await driver.list('requests', { status: 'pending' })).map((row) => row.doc as PublishRequest);
    },
    async awaitingNotice(workflowId, author) {
      const who = refOf(author);
      const rows = await driver.list('requests', { workflowId, status: 'approved' });
      return rows
        .map((row) => row.doc as PublishRequest)
        .filter((request) => !request.authorNotifiedAt && isAuthorOf(who, { submittedBy: request.requestedBy, submittedById: request.requestedById }));
    },
    async markNotified(ids) {
      if (ids.length === 0) return;
      const now = clock.now();
      await mustApply(ids.map((id): StoreWrite => ({ op: 'patch', collection: 'requests', id, set: { authorNotifiedAt: now } })));
    },
    async decide(id, decision, by, comment) {
      const row = await driver.get('requests', id);
      if (!row) throw notFound('That request doesn’t exist.');
      const request = row.doc as PublishRequest;
      const now = clock.now();
      const who = refOf(by);
      const changes = { status: decision, decidedBy: who.name, ...(who.id === undefined || who.id === who.name ? {} : { decidedById: who.id }), decidedAt: now, ...(comment === undefined ? {} : { comment }) };
      const result = await driver.tx([
        { op: 'patch', collection: 'requests', id, set: changes, expect: { status: 'pending' }, by: who.name },
        { op: 'patch', collection: 'workflows', id: request.workflowId, set: { pending: null }, by: who.name },
        closeCopies(id, 'rejected', now, who.name, comment),
      ]);
      if (result.ok === false) throw result.index === 0 ? new ApiError(409, 'NOT_PENDING', copy.nothingWaiting) : conflictError();
      return { ...request, ...changes };
    },
  };

  const links: LinkRepo = {
    async get(accountId) {
      return ((await driver.get('links', accountId))?.doc as AccountLink | undefined) ?? null;
    },
    async list() {
      return (await driver.list('links')).map((row) => row.doc as AccountLink);
    },
    async set(link) {
      const result = await driver.tx([{ op: 'upsert', collection: 'links', id: link.accountId, doc: link, by: link.linkedBy }]);
      return result.ok === true ? link : { conflict: true };
    },
  };

  const reference: ReferenceRepo = {
    async getAll() {
      return bundleFor(await allWorkflows());
    },
    bundleFor,
    async replace(key, data, by) {
      await mustApply([{ op: 'upsert', collection: 'reference', id: key, doc: data, by }]);
    },
  };

  const records: RecordRepo = {
    async samples() {
      return (await driver.list('samples')).map((row) => row.doc as SampleRecord);
    },
    async history() {
      return (await driver.list('history')).map((row) => row.doc as HistoryRecord);
    },
    async get(type, id) {
      const row = await driver.get('records', id);
      const record = row?.doc as BusinessRecord | undefined;
      return record && record.type === type ? record : null;
    },
    async upsert(rec) {
      await mustApply([{ op: 'upsert', collection: 'records', id: rec.id, doc: rec }]);
    },
  };

  const runs: RunRepo = {
    async create(run) {
      await mustApply([
        { op: 'insert', collection: 'runs', id: run.id, doc: encodeRun(run) },
        ...run.log.map((event): StoreWrite => {
          const id = newId('re');
          return { op: 'insert', collection: 'events', id, doc: { id, runId: run.id, ...event } };
        }),
      ]);
      return { ...run, rev: 1 };
    },
    async get(id) {
      const row = await driver.get('runs', id);
      return row ? runFromRow(row) : null;
    },
    async list(filter = {}) {
      const where: Record<string, string | string[]> = {};
      if (filter.status) where.status = filter.status;
      if (filter.workflowId) where.workflowId = filter.workflowId;
      if (filter.recordId) where.recordId = filter.recordId;
      const [rows, all] = await Promise.all([driver.list('runs', where), allWorkflows()]);
      return rows.map((row): RunSummary => {
        const run = runFromRow(row);
        const workflow = all.find((candidate) => candidate.id === run.workflowId);
        const pinned = workflow?.versions?.find((version) => version.version === run.version);
        const nodes = pinned?.nodes ?? {};
        const waitingOn = Object.values(run.steps)
          .filter((step) => step.status === 'waiting' && nodes[step.nodeId])
          .flatMap((step) => (step.assignees ?? []).map((person) => `${title(nodes[step.nodeId])}: ${person}`));
        const last = run.log.length > 0 ? run.log[run.log.length - 1].at : run.startedAt;
        const snapshot = run.recordSnapshot as RecordData;
        return {
          id: run.id,
          workflowId: run.workflowId,
          workflowName: pinned?.name ?? workflow?.name ?? run.workflowId,
          version: run.version,
          recordId: run.recordRef.id,
          recordTitle: typeof snapshot.title === 'string' ? snapshot.title : run.recordRef.id,
          status: run.status,
          waitingOn,
          startedAt: run.startedAt,
          updatedAt: last,
        };
      });
    },
    async rows(filter = {}) {
      const where: Record<string, string | string[]> = {};
      if (filter.status) where.status = filter.status;
      if (filter.workflowId) where.workflowId = filter.workflowId;
      if (filter.recordId) where.recordId = filter.recordId;
      return (await driver.list('runs', where)).map(runFromRow);
    },
    async update(run, expectedRev) {
      const result = await driver.tx([{ op: 'patch', collection: 'runs', id: run.id, set: encodeRun(run), expectRev: expectedRev, bumpRev: true }]);
      if (result.ok === true) return { ...run, rev: result.results[0].rev as number };
      if (result.reason === 'missing') throw notFound('That run doesn’t exist.');
      return { conflict: true };
    },
    async appendEvent(runId, event) {
      const id = newId('re');
      await mustApply([{ op: 'insert', collection: 'events', id, doc: { id, runId, ...event } }]);
    },
  };

  const setRunItems = (runId: string, from: string[], status: string, extra: Record<string, unknown> = {}) =>
    mustApply([{ op: 'updateWhere', collection: 'items', where: { runId, status: from }, set: { status, ...extra } }]).then(() => undefined);

  const workItems: WorkItemRepo = {
    async open(item) {
      await mustApply([{ op: 'insert', collection: 'items', id: item.id, doc: item }]);
      return item;
    },
    async get(id) {
      const row = await driver.get('items', id);
      return row ? (row.doc as WorkItem) : null;
    },
    async listFor(person) {
      return (await driver.list('items', { assignee: person, status: ['open', 'held'] })).map((row) => row.doc as WorkItem);
    },
    async forRun(runId) {
      return (await driver.list('items', { runId })).map((row) => row.doc as WorkItem);
    },
    async close(id, decision, comment) {
      await mustApply([{ op: 'patch', collection: 'items', id, set: { status: 'done', decision, doneAt: clock.now(), ...(comment === undefined ? {} : { comment }) } }]);
    },
    holdForRun: (runId) => setRunItems(runId, ['open'], 'held'),
    releaseForRun: (runId) => setRunItems(runId, ['held'], 'open'),
    cancelForRun: (runId) => setRunItems(runId, ['open', 'held'], 'cancelled'),
  };

  const ledger: LedgerRepo = {
    async add(line) {
      await mustApply([{ op: 'insert', collection: 'ledger', id: line.id, doc: line }]);
    },
    async openFor(workerKey) {
      return (await driver.list('ledger', { workerKey, status: 'open' })).map((row) => row.doc as LedgerLine);
    },
    async close(id) {
      await mustApply([{ op: 'patch', collection: 'ledger', id, set: { status: 'closed', closedAt: clock.now() } }]);
    },
  };

  const outbox: OutboxRepo = {
    async enqueue(message) {
      await mustApply([{ op: 'insert', collection: 'outbox', id: message.id, doc: message }]);
    },
  };

  const inbound: InboundRepo = {
    async add(event) {
      await mustApply([{ op: 'insert', collection: 'inbound', id: event.id, doc: event }]);
    },
    async findByRecord(recordId) {
      return (await driver.list('inbound', { recordId })).map((row) => row.doc as InboundEvent);
    },
    async list(filter) {
      return (await driver.list('inbound', filter)).map((row) => row.doc as InboundEvent);
    },
    async update(id, changes) {
      await mustApply([{ op: 'patch', collection: 'inbound', id, set: changes }]);
    },
  };

  return {
    links,
    workflows,
    publishRequests,
    reference,
    records,
    runs,
    workItems,
    ledger,
    outbox,
    inbound,
    tx: (writes) => driver.tx(writes),
    actingUsers: () => driver.actingUsers(),
    members: () => driver.members(),
    rawGet: (collection, id) => driver.get(collection, id),
  };
}
