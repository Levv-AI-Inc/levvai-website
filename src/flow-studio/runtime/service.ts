import { createHash, randomUUID } from 'node:crypto';
import { createIdGen } from '../engine/ids';
import { isAuthorOf } from '../engine/publish';
import { prereqFor, publishedFacts, selectWorkflow } from '../engine/selection';
import type { StoreWrite, TxResult } from '../data/driver';
import type { FlowStore, StoredRun } from '../data/repos';
import type { EngineContext } from '../model/context';
import type { EventKey, RecordKey, SourceKey } from '../model/catalog';
import type { RecordData } from '../model/records';
import type { Actor } from '../server/permissions';
import { requireRunControl, can, personOf } from '../server/permissions';
import { ApiError, forbidden, notFound } from '../server/errors';
import type { BusinessRecord, InboundEvent, LedgerLine, PublishRequest, RunClaim, RunStatus, WorkItem, WorkflowRun } from '../model/runtime';
import type { Workflow, WorkflowVersion } from '../model/workflow';
import { mockAdapters, type Adapters, type EventSource } from './adapters';
import { recordWrite, writesOf } from './commit';
import { pauseSession, resumeSession, stopSession } from './control';
import { runtimeCopy as rc } from './copy';
import { advance, completeTask, conflictOf, decideApproval, decideChaserCopy, decideReview, handOverItems, mightBeStuck, pauseIfStuck, proposalChosen, recordArrived, recordEdited, referenceMoved, replan, resubmitEdited, resubmitted, tickIsDue, tickRun, writeRuleFlags } from './machine';
import { adminMayEdit, changedFields, dataOfPayload, engineRecord, EVENT_KEEPS_WHILE_RUNNING, fieldLabel, mergedRecord, namedFields, requesterMayEdit, requesterMayProvide, snakeCase, valueFits } from './records';
import { RunSession, type RunEnv } from './session';
import { addDays, dateText, isDue, stamp } from './time';
import { bannerOf, historyLines, recordValues, runPath, stepViews } from './views';

/**
 * 05 §3: the runtime over a store. Every command is load, change, commit-with-rev; a lost compare-and-swap loads again and
 * re-decides from what is now stored, so concurrent commands serialise and a refused one writes nothing.
 */

const ATTEMPTS = 25;
const DEDUPE_MS = 24 * 3_600_000;
const PREREQ_ALERT_DAYS = 7;
const OPEN_STATUSES: RunStatus[] = ['running', 'paused'];

export interface RuntimeClock { now(): string; asOf(): string }
export interface RuntimeOptions {
  adapters?: (ctx: EngineContext) => Adapters;
  autocomplete: boolean;
  origin: string;
}

export interface NewEvent {
  source: string;
  recordType: string;
  recordId: string;
  event: string;
  data: Record<string, unknown>;
}

const newId = (prefix: string): string => `${prefix}-${randomUUID()}`;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const RETRYABLE: Extract<TxResult, { ok: false }>['reason'][] = ['rev', 'expect', 'exists', 'integrity'];

/** The workflow as it was at `version`: the graph, name and settings stored with that version (01 §4.1). */
export function pinnedWorkflow(workflow: Workflow, version: number): Workflow {
  const pinned = workflow.versions?.find((candidate) => candidate.version === version);
  // A version is never deleted, so this is a broken store. Falling back to the workflow would run the draft.
  if (!pinned) throw notFound('That version of the workflow doesn’t exist.');
  return {
    ...workflow,
    name: pinned.name,
    scope: pinned.scope,
    records: pinned.records ?? workflow.records,
    event: pinned.event ?? workflow.event,
    owner: pinned.owner ?? workflow.owner,
    onReject: pinned.onReject,
    source: pinned.source,
    basis: pinned.basis,
    days: pinned.days,
    draft: { nodes: pinned.nodes },
  };
}

/** 03 §15 item 1: the newest version whose `effective` has come. */
const effectiveVersion = (workflow: Workflow, asOf: string): WorkflowVersion | null =>
  (workflow.versions ?? []).filter((version) => version.effective <= asOf).sort((a, b) => b.version - a.version)[0] ?? null;

export class RuntimeService {
  constructor(readonly store: FlowStore, readonly clock: RuntimeClock, readonly options: RuntimeOptions) {}

  private async contextFor(): Promise<EngineContext> {
    const workflows = await this.store.workflows.all();
    const reference = await this.store.reference.bundleFor(workflows);
    const idGen = createIdGen(101);
    return {
      ...reference,
      workflows,
      samples: [],
      history: [],
      asOf: this.clock.asOf(),
      now: this.clock.now(),
      idGen,
      approverAvailability: { othersCanApprove: true },
    };
  }

  private envFor(ctx: EngineContext, wf: Workflow): RunEnv {
    return {
      ctx,
      now: stamp(this.clock.now()),
      wf,
      nodes: wf.draft.nodes,
      adapters: this.options.adapters?.(ctx) ?? mockAdapters(ctx),
      autocomplete: this.options.autocomplete,
      origin: this.options.origin,
      newId,
    };
  }

  private async recordOf(run: Pick<WorkflowRun, 'recordRef' | 'recordSnapshot' | 'startedAt'>): Promise<BusinessRecord> {
    const record = await this.anyRecord(run.recordRef.id);
    if (record) return record;
    // The record arrives with the event and is never deleted, so this only guards a run written by hand.
    return { id: run.recordRef.id, type: run.recordRef.type, source: 'levv', updatedAt: run.startedAt, data: run.recordSnapshot as unknown as BusinessRecord['data'] };
  }

  private async load(runId: string): Promise<{ session: RunSession; rev: number; keys: string[] }> {
    const row = await this.store.runs.get(runId);
    if (!row) throw notFound('That run doesn’t exist.');
    const { rev, ...run } = row as StoredRun;
    const [items, record, ctx] = await Promise.all([this.store.workItems.forRun(runId), this.recordOf(run), this.contextFor()]);
    const workflow = ctx.workflows.find((candidate) => candidate.id === run.workflowId);
    if (!workflow) throw notFound('That workflow doesn’t exist.');
    const key = (record.data as Record<string, unknown>).personal_email as string | undefined;
    const ledger: LedgerLine[] = await this.store.ledger.openFor(key ?? record.id);
    return { session: new RunSession(run, items, record, ledger, this.envFor(ctx, pinnedWorkflow(workflow, run.version))), rev, keys: Object.keys(run) };
  }

  /** The heart of it: 05 §3.2 step 5 "On conflict, reload and re-run". */
  private async withRun<T>(runId: string, command: (s: RunSession) => Promise<T> | T, actor?: Actor): Promise<T> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const { session, rev, keys } = await this.load(runId);
      if (actor) session.acting = { id: actor.id ?? actor.name, name: actor.name };
      const result = await command(session);
      if (!session.changed) return result;
      const outcome = await this.store.tx(writesOf(session, keys.filter((key) => key !== 'log'), rev, newId));
      if (outcome.ok === true) {
        await this.afterCommit(session);
        return result;
      }
      if (outcome.reason === 'missing') throw notFound('That run doesn’t exist.');
      if (!RETRYABLE.includes(outcome.reason)) throw new ApiError(409, 'CONFLICT', rc.conflict);
      await sleep(Math.random() * 15 * (attempt + 1));
    }
    throw new ApiError(409, 'CONFLICT', rc.conflict);
  }

  /** What had to wait for the commit: events a step raised, and whoever was waiting on this record (05 §3.1 step 5). */
  private async afterCommit(s: RunSession): Promise<void> {
    for (const event of s.raised) await this.processInbound(event.id);
    if (s.recordDirty) await this.recheckWaiting(s.record.id);
  }

  // ── Intake (05 §3.1) ───────────────────────────────────────────────────────────────────────────────────────────────

  /** `actor` is an admin posting from their session. No actor means the service token. */
  async intake(input: NewEvent, actor?: Actor): Promise<{ inboundEventId: string; runIds: string[]; outcome: string }> {
    const now = stamp(this.clock.now());
    const event: InboundEvent = {
      id: newId('ie'),
      source: input.source as SourceKey,
      recordType: input.recordType as RecordKey,
      recordId: input.recordId,
      event: input.event as EventKey,
      payload: input.data,
      receivedAt: now,
      runIds: [],
      outcome: 'queued',
      ...(actor ? { receivedBy: actor.name, ...(actor.id && actor.id !== actor.name ? { receivedById: actor.id } : {}) } : {}),
    };
    await this.storeEvent(event, actor);
    return this.processInbound(event.id);
  }

  /**
   * 05 §3.1 steps 1 and 2, in one transaction with what the change does to every open run: the event is never stored
   * without its data, and the data never lands without those runs seeing it. A failure leaves nothing, so the sender's
   * retry starts clean. Compare-and-swap, because two events for one record can arrive at once. False: this event's id is
   * already stored, which is how a poll that sees it twice adds it once.
   */
  private async storeEvent(event: InboundEvent, actor?: Actor): Promise<boolean> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const existing = await this.anyRecord(event.recordId);
      const now = stamp(this.clock.now());
      const { payload, ignored } = existing ? await this.whatAnEventMayChange(existing, event, actor) : { payload: event.payload as Record<string, unknown>, ignored: [] };
      const next = mergedRecord(existing, { id: event.recordId, type: event.recordType, source: event.source, payload }, now);
      const unchanged = existing !== null && JSON.stringify(existing.data) === JSON.stringify(next.data);
      const writes: StoreWrite[] = [{ op: 'insert', collection: 'inbound', id: event.id, doc: event }];
      const sessions = existing && (!unchanged || ignored.length > 0) ? await this.runsSeeing(existing.id, existing.data as Record<string, unknown>, next, writes, event, ignored, actor) : [];
      if (!existing) writes.push({ op: 'insert', collection: 'records', id: next.id, doc: next });
      else if (!unchanged) writes.push({ op: 'patch', collection: 'records', id: next.id, set: next as unknown as Record<string, unknown>, expect: { dataRev: existing.dataRev ?? 0 } });
      const outcome = await this.store.tx(writes);
      if (outcome.ok === true) {
        for (const session of sessions) await this.afterCommit(session);
        return true;
      }
      if (outcome.index === 0 && outcome.reason === 'exists') return false;
      await sleep(Math.random() * 15 * (attempt + 1));
    }
    throw new ApiError(409, 'CONFLICT', rc.conflict);
  }

  /**
   * An event can't do what the record route refuses. A new record comes as sent. On one that exists, an admin's session is
   * refused anything the deny list holds, and, like the token, can't change who raised it or who already approved while a
   * run is open. The token isn't a person who can be told, so those keys are dropped and the run's log says so; the
   * event keeps its payload as it arrived. Only a change counts: a resend of what's there is fine.
   */
  private async whatAnEventMayChange(existing: BusinessRecord, event: InboundEvent, actor?: Actor): Promise<{ payload: Record<string, unknown>; ignored: string[] }> {
    const incoming = dataOfPayload(event.payload as Record<string, unknown>);
    const stored = existing.data as Record<string, unknown>;
    const changing = Object.keys(incoming).filter((field) => JSON.stringify(stored[field] ?? null) !== JSON.stringify(incoming[field] ?? null));
    const open = changing.some((field) => EVENT_KEEPS_WHILE_RUNNING.includes(field)) && (await this.store.runs.list({ recordId: existing.id, status: OPEN_STATUSES })).length > 0;
    const heldWhileOpen = open ? changing.filter((field) => EVENT_KEEPS_WHILE_RUNNING.includes(field)) : [];
    if (actor) {
      const refused = Array.from(new Set([...changing.filter((field) => !adminMayEdit(field)), ...heldWhileOpen]));
      if (refused.length > 0) {
        const ctx = await this.contextFor();
        throw new ApiError(422, 'FIELD_NOT_EDITABLE', rc.fieldsNotEditable(refused.map((field) => fieldLabel(field, ctx))));
      }
      return { payload: incoming, ignored: [] };
    }
    const payload = { ...incoming };
    for (const field of heldWhileOpen) delete payload[field];
    return { payload, ignored: heldWhileOpen };
  }

  /** F9: nothing reacts to a change from another system, except that Waits follow dates and a change in who must approve is re-planned. */
  private async runsSeeing(recordId: string, before: Record<string, unknown>, next: BusinessRecord, writes: StoreWrite[], event: InboundEvent, ignored: string[], actor?: Actor): Promise<RunSession[]> {
    const changed = changedFields(before, next.data as Record<string, unknown>);
    if (changed.length === 0 && ignored.length === 0) return [];
    const summaries = await this.store.runs.list({ recordId, status: OPEN_STATUSES });
    const sessions: RunSession[] = [];
    for (const runId of summaries.map((summary) => summary.id).sort()) {
      const { session, rev, keys } = await this.load(runId);
      if (actor) session.acting = { id: actor.id ?? actor.name, name: actor.name };
      Object.assign(session.record, { data: { ...next.data } });
      if (ignored.length > 0) session.log('event_ignored', rc.eventIgnored(session.env.ctx.catalog.SOURCES[event.source] ?? event.source, ignored.map((field) => fieldLabel(field, session.env.ctx))));
      if (changed.length > 0 && recordArrived(session, changed, changed.map((field) => fieldLabel(field, session.env.ctx)), before)) await advance(session);
      if (!session.changed) continue;
      // The record's own write comes once, last, with what every run brought back merged in.
      Object.assign(next.data as Record<string, unknown>, session.record.data);
      session.recordDirty = false;
      writes.push(...writesOf(session, keys.filter((key) => key !== 'log'), rev, newId));
      sessions.push(session);
    }
    return sessions;
  }

  private anyRecord = async (id: string): Promise<BusinessRecord | null> => {
    const row = await this.store.rawGet('records', id);
    return row ? (row.doc as BusinessRecord) : null;
  };

  async processInbound(inboundId: string): Promise<{ inboundEventId: string; runIds: string[]; outcome: string }> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const event = (await this.store.rawGet('inbound', inboundId))?.doc as InboundEvent | undefined;
      if (!event) throw notFound('That event doesn’t exist.');
      const result = { inboundEventId: inboundId, runIds: event.runIds };
      if (event.outcome !== 'queued' && event.outcome !== 'waiting_prerequisite') return { ...result, outcome: event.outcome as string };
      const applied = await this.tryToStart(event);
      if (applied) return { inboundEventId: inboundId, runIds: applied.runIds, outcome: applied.outcome };
      await sleep(Math.random() * 15 * (attempt + 1));
    }
    throw new ApiError(409, 'CONFLICT', rc.conflict);
  }

  /** One attempt at steps 3–7. Null means someone else got in first, so look again. */
  private async tryToStart(event: InboundEvent): Promise<{ runIds: string[]; outcome: NonNullable<InboundEvent['outcome']> } | null> {
    const now = stamp(this.clock.now());
    const ctx = await this.contextFor();
    const record = await this.anyRecord(event.recordId);
    if (!record) return this.mark(event, 'no_workflow');
    const rec = { ...engineRecord(record, event.event), record: event.recordType };

    // Step 3. Selection reads the version that is in force, so it is what the run pins.
    const candidates = ctx.workflows.flatMap((workflow) => {
      const version = effectiveVersion(workflow, ctx.asOf);
      if (!version || workflow.status !== 'live') return [];
      const inForce = pinnedWorkflow(workflow, version.version);
      const source = inForce.source ?? 'levv';
      if (source !== event.source && source !== record.source) return [];
      return [{ ...inForce, versions: undefined, published: { nodes: version.nodes, scope: version.scope, name: version.name } }];
    });
    const selection = selectWorkflow(rec as unknown as Record<string, unknown>, candidates);
    if (!selection.workflow) return this.mark(event, 'no_workflow');
    const workflow = ctx.workflows.find((candidate) => candidate.id === selection.workflow?.id) as Workflow;
    const version = effectiveVersion(workflow, ctx.asOf) as WorkflowVersion;

    // Step 4, atomically: `claims` has one row per key, and inserting it is what lets exactly one start.
    const claimId = `${workflow.id}:${version.version}:${event.recordId}:${event.event}`;
    const claimRow = await this.store.rawGet('claims', claimId);
    const claim = claimRow?.doc as RunClaim | undefined;
    if (claim) {
      const held = await this.store.runs.get(claim.runId);
      const notEnded = held && OPEN_STATUSES.includes(held.status);
      if (notEnded && Date.parse(now) - Date.parse(claim.startedAt) < DEDUPE_MS) return this.mark(event, 'duplicate');
    }

    // Step 5.
    const prereq = prereqFor(event.recordType, event.event);
    const states = ((record.data as Record<string, unknown>).states as string[] | undefined) ?? [];
    const exempt = prereq === 'none' || (event.recordType === 'onboarding' && event.event === 'ob_start');
    if (!exempt && !states.includes(prereq)) return this.waitForPrerequisite(event, workflow);

    // Step 6: claimed first and advanced afterwards, so nothing reaches a system or a person for a run that lost the claim,
    // and the run id in an idempotency key is the one that stays. A run whose advance never happens is picked up by the tick.
    const pinned = pinnedWorkflow(workflow, version.version);
    const run: WorkflowRun = {
      id: newId('run'),
      workflowId: workflow.id,
      version: version.version,
      recordRef: { type: event.recordType, id: event.recordId },
      event: event.event,
      status: 'running',
      startedAt: now,
      recordSnapshot: rec as RecordData,
      plan: null as unknown as WorkflowRun['plan'],
      steps: Object.fromEntries(Object.keys(pinned.draft.nodes).map((id) => [id, { nodeId: id, status: 'pending' as const }])),
      log: [],
      nextSeq: 1,
    };
    const session = new RunSession(run, [], { ...record, data: { ...record.data } }, await this.store.ledger.openFor(((record.data as Record<string, unknown>).personal_email as string | undefined) ?? record.id), this.envFor(ctx, pinned));
    const sourceLabel = ctx.catalog.SOURCES[event.source] ?? event.source;
    const eventLabel = ctx.catalog.EVENTS[event.event] ?? event.event;
    session.log('started', rc.started(sourceLabel, eventLabel));
    // 03 §3.2 item 6's sentence is for a priority that decided it. The switch can leave a tie with none (03 §14.4).
    if (selection.tie) session.log('overlap', workflow.priority == null ? rc.overlapRanNoPriority(pinned.name) : rc.overlapRan(pinned.name));
    replan(session);
    writeRuleFlags(session);

    const claimWrite: StoreWrite = claim
      ? { op: 'patch', collection: 'claims', id: claimId, set: { runId: run.id, startedAt: now }, expect: { runId: claim.runId } }
      : { op: 'insert', collection: 'claims', id: claimId, doc: { runId: run.id, startedAt: now } };
    const runWrites = writesOf(session, null, null, newId);
    const inboundWrite: StoreWrite = { op: 'patch', collection: 'inbound', id: event.id, set: { outcome: 'started', runIds: [run.id], processedAt: now, workflowId: workflow.id }, expect: { outcome: event.outcome } };
    const outcome = await this.store.tx([claimWrite, inboundWrite, ...runWrites]);
    if (outcome.ok === false) return null;
    await this.afterCommit(session);
    // Step 7.
    await this.withRun(run.id, (s) => advance(s));
    return { runIds: [run.id], outcome: 'started' };
  }

  private async mark(event: InboundEvent, outcome: 'no_workflow' | 'duplicate'): Promise<{ runIds: string[]; outcome: 'no_workflow' | 'duplicate' } | null> {
    const result = await this.store.tx([{ op: 'patch', collection: 'inbound', id: event.id, set: { outcome, processedAt: stamp(this.clock.now()) }, expect: { outcome: event.outcome } }]);
    return result.ok === true ? { runIds: [], outcome } : null;
  }

  private async waitForPrerequisite(event: InboundEvent, workflow: Workflow): Promise<{ runIds: string[]; outcome: 'waiting_prerequisite' } | null> {
    if (event.outcome === 'waiting_prerequisite') return { runIds: [], outcome: 'waiting_prerequisite' };
    const result = await this.store.tx([{ op: 'patch', collection: 'inbound', id: event.id, set: { outcome: 'waiting_prerequisite', workflowId: workflow.id }, expect: { outcome: event.outcome } }]);
    return result.ok === true ? { runIds: [], outcome: 'waiting_prerequisite' } : null;
  }

  /** 05 §3.1 step 5: "a queue that is re-checked whenever the record changes". */
  private async recheckWaiting(recordId: string): Promise<void> {
    const events = await this.store.inbound.findByRecord(recordId);
    for (const event of events) {
      if (event.outcome === 'waiting_prerequisite') await this.processInbound(event.id);
    }
  }

  // ── Commands ───────────────────────────────────────────────────────────────────────────────────────────────────────

  private async requireControl(actor: Actor, runId: string): Promise<void> {
    const run = await this.store.runs.get(runId);
    if (!run) throw notFound('That run doesn’t exist.');
    const found = await this.store.workflows.get(run.workflowId);
    if (!found) throw notFound('That workflow doesn’t exist.');
    requireRunControl(actor, pinnedWorkflow(found.workflow, run.version));
  }

  async pause(actor: Actor, runId: string, reason?: string): Promise<StoredRun> {
    await this.requireControl(actor, runId);
    await this.withRun(runId, (s) => pauseSession(s, actor.name, reason), actor);
    return (await this.store.runs.get(runId)) as StoredRun;
  }

  async resume(actor: Actor, runId: string): Promise<StoredRun> {
    await this.requireControl(actor, runId);
    await this.withRun(runId, (s) => resumeSession(s, actor.name), actor);
    return (await this.store.runs.get(runId)) as StoredRun;
  }

  async stop(actor: Actor, runId: string, reason: string | undefined): Promise<StoredRun> {
    await this.requireControl(actor, runId);
    await this.withRun(runId, (s) => stopSession(s, actor.name, reason), actor);
    return (await this.store.runs.get(runId)) as StoredRun;
  }

  /** Every refusal is decided inside the attempt, on what is stored now: that is what makes a late or second answer lose. */
  private itemIn(s: RunSession, itemId: string, actor: Actor, kinds: WorkItem['kind'][]): WorkItem {
    const item = s.items.find((candidate) => candidate.id === itemId);
    if (!item) throw notFound('That item doesn’t exist.');
    if (item.assignee !== personOf(actor)) throw forbidden();
    if (s.run.status === 'stopped') throw new ApiError(409, 'RUN_STOPPED', rc.runStopped);
    // 05 §3.4.3 gives a cancelled item the same code. Its run may be going on without this person, so the words say that.
    if (item.status === 'cancelled') throw new ApiError(409, 'RUN_STOPPED', rc.inbox.withdrawn);
    if (item.status === 'done' || s.run.status === 'completed' || s.run.status === 'rejected') throw new ApiError(409, 'ALREADY_DONE', rc.alreadyDone);
    if (!kinds.includes(item.kind)) throw new ApiError(422, 'WRONG_KIND', rc.wrongKind);
    return item;
  }

  private async runIdOfItem(itemId: string): Promise<string> {
    const item = await this.store.workItems.get(itemId);
    if (!item) throw notFound('That item doesn’t exist.');
    if (!item.runId) throw new ApiError(422, 'WRONG_KIND', rc.wrongKind);
    return item.runId;
  }

  async decide(actor: Actor, itemId: string, decision: 'approved' | 'rejected' | 'sent_back' | 'verified' | 'not_verified', comment?: string): Promise<WorkItem> {
    const runId = await this.runIdOfItem(itemId);
    const text = comment?.trim() || undefined;
    await this.withRun(runId, async (s) => {
      const item = this.itemIn(s, itemId, actor, ['approve', 'escalation', 'decide_failed_check', 'collect_review']);
      // AGENTS rule 4. The plan never asks the worker; this holds even if a later change makes them the worker.
      if (personOf(actor) === (s.record.data as Record<string, unknown>).worker_name) throw new ApiError(403, 'WORKER_CANNOT_DECIDE', rc.workerCannotDecide);
      if (decision === 'verified' || decision === 'not_verified') {
        if (item.kind !== 'collect_review') throw new ApiError(422, 'WRONG_KIND', rc.wrongKind);
        if (decision === 'not_verified' && !text) throw new ApiError(422, 'COMMENT_REQUIRED', rc.addCommentNotVerified);
        decideReview(s, item, actor.name, decision, text);
      } else {
        if (item.kind === 'collect_review') throw new ApiError(422, 'WRONG_KIND', rc.wrongKind);
        if (decision === 'rejected' && item.kind !== 'approve' && !text) throw new ApiError(422, 'COMMENT_REQUIRED', rc.addCommentToReject);
        if (decision === 'sent_back' && !text) throw new ApiError(422, 'COMMENT_REQUIRED', rc.addCommentToSendBack);
        // AGENTS rule 4. The plan never asks the requester; this holds even if a later edit makes them the requester.
        if (personOf(actor) === (s.record.data as Record<string, unknown>).requester) throw new ApiError(403, 'OWN_REQUEST', rc.ownRequest);
        const parent = item.chaserOf ? s.items.find((other) => other.id === item.chaserOf) : item;
        if (parent && parent.kind !== 'approve' && parent.kind !== 'escalation' && parent.kind !== 'decide_failed_check') decideChaserCopy(s, item, actor.name, decision, text);
        else decideApproval(s, item, actor.name, decision, text);
      }
      await advance(s);
    }, actor);
    return (await this.store.workItems.get(itemId)) as WorkItem;
  }

  async done(actor: Actor, itemId: string): Promise<WorkItem> {
    const runId = await this.runIdOfItem(itemId);
    await this.withRun(runId, async (s) => {
      completeTask(s, this.itemIn(s, itemId, actor, ['task']), actor.name);
      await advance(s);
    }, actor);
    return (await this.store.workItems.get(itemId)) as WorkItem;
  }

  async submitItems(actor: Actor, itemId: string, items: string[]): Promise<WorkItem> {
    const runId = await this.runIdOfItem(itemId);
    await this.withRun(runId, async (s) => {
      const item = this.itemIn(s, itemId, actor, ['collect']);
      if ((item.items ?? []).some((wanted) => !items.includes(wanted))) throw new ApiError(422, 'ITEMS_MISSING', rc.notInItems);
      handOverItems(s, item, actor.name, items);
      await advance(s);
    }, actor);
    return (await this.store.workItems.get(itemId)) as WorkItem;
  }

  async provideField(actor: Actor, itemId: string, field: string, value: unknown): Promise<WorkItem> {
    const runId = await this.runIdOfItem(itemId);
    await this.withRun(runId, async (s) => {
      const item = this.itemIn(s, itemId, actor, ['needs_information']);
      if (item.field?.id !== field) throw new ApiError(422, 'WRONG_FIELD', rc.wrongKind);
      const label = fieldLabel(field, s.env.ctx);
      if (personOf(actor) === (s.record.data as Record<string, unknown>).requester && !requesterMayProvide(field)) throw new ApiError(422, 'FIELD_NOT_EDITABLE', rc.fieldsNotEditable([label]));
      if (!valueFits(field, value, s.env.ctx)) throw new ApiError(422, 'INVALID_VALUE', rc.valueDoesNotFit(label));
      this.editInSession(s, { [field]: value });
      s.closeItem(item, 'done', { decision: 'provided' });
      await advance(s);
    }, actor);
    return (await this.store.workItems.get(itemId)) as WorkItem;
  }

  async resubmit(actor: Actor, itemId: string, data?: Record<string, unknown>): Promise<WorkItem> {
    const runId = await this.runIdOfItem(itemId);
    await this.withRun(runId, async (s) => {
      const item = this.itemIn(s, itemId, actor, ['resubmit']);
      const changes = dataOfPayload(data ?? {});
      const refused = namedFields(data ?? {}).filter((field) => !requesterMayEdit(field, s.env.ctx));
      if (refused.length > 0) throw new ApiError(422, 'FIELD_NOT_EDITABLE', rc.fieldsNotEditable(refused.map((field) => fieldLabel(field, s.env.ctx))));
      // A blank isn't a fix: it would stop an If on nothing the requester had to say.
      const blanked = Object.keys(changes).find((field) => changes[field] === null);
      if (blanked) throw new ApiError(422, 'INVALID_VALUE', rc.valueDoesNotFit(fieldLabel(blanked, s.env.ctx)));
      this.checkValues(s.env.ctx, changes);
      resubmitEdited(s, item.nodeId as string, changes, (field) => fieldLabel(field, s.env.ctx));
      resubmitted(s, item, actor.name);
      await advance(s);
    }, actor);
    return (await this.store.workItems.get(itemId)) as WorkItem;
  }

  private checkValues(ctx: EngineContext, changes: Record<string, unknown>): void {
    const wrong = Object.keys(changes).find((field) => changes[field] !== null && !valueFits(field, changes[field], ctx));
    if (wrong) throw new ApiError(422, 'INVALID_VALUE', rc.valueDoesNotFit(fieldLabel(wrong, ctx)));
  }

  private editInSession(s: RunSession, data: Record<string, unknown>): void {
    const before = { ...(s.record.data as Record<string, unknown>) };
    s.setRecord(data);
    const changed = changedFields(before, s.record.data as Record<string, unknown>);
    if (changed.length > 0) recordEdited(s, changed, changed.map((field) => fieldLabel(field, s.env.ctx)), before);
  }

  /** POST /records/:type/:id: an admin, on the record route. What the runtime keeps can't be set this way (finding 1). */
  async editRecordAs(actor: Actor, type: RecordKey, id: string, data: Record<string, unknown>): Promise<BusinessRecord> {
    const changes = dataOfPayload(data);
    const refused = Object.keys(changes).filter((field) => !adminMayEdit(field));
    const ctx = await this.contextFor();
    // AGENTS rule 4: while a run is open, who raised it isn't anyone's to rewrite, here any more than by event.
    const stored = ((await this.store.records.get(type, id))?.data ?? {}) as Record<string, unknown>;
    const keptWhileRunning = Object.keys(changes).filter((field) => EVENT_KEEPS_WHILE_RUNNING.includes(field) && JSON.stringify(stored[field] ?? null) !== JSON.stringify(changes[field] ?? null));
    if (keptWhileRunning.length > 0 && (await this.store.runs.list({ recordId: id, status: OPEN_STATUSES })).length > 0) refused.push(...keptWhileRunning);
    if (refused.length > 0) throw new ApiError(422, 'FIELD_NOT_EDITABLE', rc.fieldsNotEditable(Array.from(new Set(refused)).map((field) => fieldLabel(field, ctx))));
    this.checkValues(ctx, changes);
    return this.editRecord(type, id, changes, actor);
  }

  /** 05 §2. Every open run moves in one transaction with the record, or none does. */
  async editRecord(type: RecordKey, id: string, data: Record<string, unknown>, actor?: Actor): Promise<BusinessRecord> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const record = await this.store.records.get(type, id);
      if (!record) throw notFound('That record doesn’t exist.');
      const before = record.data as Record<string, unknown>;
      const incoming = dataOfPayload(data);
      const after = { ...before, ...incoming };
      const changed = changedFields(before, after);
      if (changed.length === 0) return record;
      const updated: BusinessRecord = { ...record, data: after as BusinessRecord['data'], updatedAt: stamp(this.clock.now()) };

      const summaries = await this.store.runs.list({ recordId: id, status: OPEN_STATUSES });
      const ids = summaries.map((summary) => summary.id).sort();
      const sessions: RunSession[] = [];
      const writes: StoreWrite[] = [];
      for (const runId of ids) {
        const { session, rev, keys } = await this.load(runId);
        if (actor) session.acting = { id: actor.id ?? actor.name, name: actor.name };
        Object.assign(session.record, { data: { ...after } });
        recordEdited(session, changed, changed.map((field) => fieldLabel(field, session.env.ctx)), before);
        await advance(session);
        // The record's own write comes once, last, with what every run brought back merged in.
        Object.assign(updated.data as Record<string, unknown>, session.record.data);
        session.recordDirty = false;
        writes.push(...writesOf(session, keys.filter((key) => key !== 'log'), rev, newId));
        sessions.push(session);
      }
      writes.push(recordWrite({ record: updated }));
      const outcome = await this.store.tx(writes);
      if (outcome.ok === true) {
        for (const session of sessions) await this.afterCommit(session);
        await this.recheckWaiting(id);
        return { ...updated, dataRev: (updated.dataRev ?? 0) + 1 };
      }
      await sleep(Math.random() * 15 * (attempt + 1));
    }
    throw new ApiError(409, 'CONFLICT', rc.conflict);
  }

  /** 05 §3.4.3: "The step resumes when reference data changes and re-planning finds someone." */
  async referenceChanged(): Promise<void> {
    const summaries = await this.store.runs.list({ status: OPEN_STATUSES });
    for (const summary of summaries) await this.withRun(summary.id, (s) => referenceMoved(s));
  }

  /** 03 §8.3 and D13: a person picks a proposal; its value and what is derived from it go on the record, then the run re-plans. */
  async chooseProposal(actor: Actor, runId: string, choice: 'a' | 'b'): Promise<StoredRun> {
    await this.requireControl(actor, runId);
    await this.withRun(runId, async (s) => {
      const conflict = conflictOf(s);
      if (!conflict) throw new ApiError(409, 'NO_CONFLICT', rc.noConflictToChoose);
      const chosen = conflict[choice];
      const other = conflict[choice === 'a' ? 'b' : 'a'];
      const data = s.record.data as Record<string, unknown>;
      const fieldId = s.env.ctx.catalog.FIELDS.find((field) => field.l.toLowerCase() === conflict.field.toLowerCase())?.id ?? snakeCase(conflict.field);
      // A proposal is about a business value. A stored `conflict` names its own field, so it can't name its way past the deny list. Stop is the way out of one that does.
      if (!adminMayEdit(fieldId) || EVENT_KEEPS_WHILE_RUNNING.includes(fieldId) || !requesterMayProvide(fieldId)) throw new ApiError(422, 'FIELD_NOT_EDITABLE', rc.fieldsNotEditable([fieldLabel(fieldId, s.env.ctx)]));
      const parsed = Number(chosen.v.replace(/[^0-9.-]/g, ''));
      const before = { ...data };
      const changes: Record<string, unknown> = { total_value: chosen.total, conflict: null };
      if (!Number.isNaN(parsed) && chosen.v.trim() !== '') changes[fieldId] = parsed;
      // D13: derived values follow the chosen value (`rate_change_pct` is the one the seed compares).
      const prev = data.prev as Record<string, unknown> | undefined;
      if (fieldId === 'bill_rate' && typeof prev?.bill_rate === 'number' && typeof changes.bill_rate === 'number') {
        changes.rate_change_pct = Math.round(((changes.bill_rate - prev.bill_rate) / prev.bill_rate) * 1000) / 10;
      }
      s.setRecord(changes);
      const recordTitle = (data.title as string | undefined) ?? s.record.id;
      proposalChosen(s, rc.screen.usingProposal(chosen.v, chosen.by, other.by), Object.keys(changes), before);
      s.send({ to: other.by, subject: rc.mail.proposalLostSubject(conflict.field, recordTitle), body: rc.mail.proposalLostBody(chosen.v, chosen.by) });
      await advance(s);
    }, actor);
    return (await this.store.runs.get(runId)) as StoredRun;
  }

  // ── Scheduler (05 §3.3) ────────────────────────────────────────────────────────────────────────────────────────────

  async tick(): Promise<{ processed: number }> {
    const now = stamp(this.clock.now());
    let processed = 0;
    const rows = await this.store.runs.rows({ status: 'running' });
    if (rows.length > 0) {
      const workflows = await this.store.workflows.all();
      for (const run of rows) {
        const workflow = workflows.find((candidate) => candidate.id === run.workflowId);
        if (!workflow?.versions?.some((version) => version.version === run.version)) continue;
        const { nodes } = pinnedWorkflow(workflow, run.version).draft;
        const due = tickIsDue(run.steps, nodes, now, run.floor?.steps);
        if (!due && !mightBeStuck(run.steps, nodes, run.floor?.steps)) continue;
        const moved = await this.withRun(run.id, async (s) => {
          if (s.run.status !== 'running') return false;
          if (due) await tickRun(s);
          pauseIfStuck(s);
          return s.changed;
        });
        if (moved) processed += 1;
      }
    }
    processed += await this.tickInbound(now);
    return { processed };
  }

  /** 05 §5.2 EventSource: what a source has queued becomes events. The id comes from the event, so a poll that sees it twice adds it once. */
  async pollSource(source: EventSource, since: string): Promise<number> {
    let added = 0;
    for (const polled of await source.poll(since)) {
      const fingerprint = createHash('sha256').update(JSON.stringify(polled)).digest('hex').slice(0, 32);
      const event: InboundEvent = {
        id: `ie-${fingerprint}`,
        source: 'fieldglass',
        recordType: polled.recordType as RecordKey,
        recordId: polled.recordId,
        event: polled.event as EventKey,
        payload: polled.data,
        receivedAt: stamp(this.clock.now()),
        runIds: [],
        outcome: 'queued',
      };
      if (!(await this.storeEvent(event))) continue;
      await this.processInbound(event.id);
      added += 1;
    }
    return added;
  }

  private async tickInbound(now: string): Promise<number> {
    let processed = 0;
    const waiting = await this.store.inbound.list({ outcome: ['queued', 'waiting_prerequisite'] });
    if (waiting.length === 0) return 0;
    for (const event of waiting) {
      if (event.outcome === 'queued') {
        await this.processInbound(event.id);
        processed += 1;
        continue;
      }
      const result = await this.processInbound(event.id);
      if (result.outcome !== 'waiting_prerequisite') {
        processed += 1;
        continue;
      }
      if (event.alertedAt || !isDue(addDays(event.receivedAt, PREREQ_ALERT_DAYS), now)) continue;
      if (await this.alertOwner(event, now)) processed += 1;
    }
    return processed;
  }

  /** 05 §3.1 step 5 "(Notify, In-app + Email.)". The inbound row's `expect` makes the alert go once, however many ticks race. */
  private async alertOwner(event: InboundEvent, now: string): Promise<boolean> {
    const ctx = await this.contextFor();
    const found = ctx.workflows.find((candidate) => candidate.id === event.workflowId);
    const version = found ? effectiveVersion(found, ctx.asOf) : null;
    const workflow = found && version ? pinnedWorkflow(found, version.version) : null;
    const record = await this.anyRecord(event.recordId);
    if (!workflow || !record) return false;
    const prereq = prereqFor(event.recordType, event.event);
    const recordTitle = ((record.data as Record<string, unknown>).title as string | undefined) ?? record.id;
    const body = rc.mail.prereqBody(workflow.name, recordTitle, record.id, ctx.presets.PRE_SHORT[prereq]);
    const subject = rc.mail.prereqSubject(workflow.name);
    const channels = ['In-app', 'Email'] as const;
    const messages: StoreWrite[] = channels.map((channel) => {
      const id = newId('om');
      return { op: 'insert', collection: 'outbox', id, doc: { id, runId: null, to: workflow.owner, channel, subject, body, createdAt: now } };
    });
    const result = await this.store.tx([{ op: 'patch', collection: 'inbound', id: event.id, set: { alertedAt: now }, expect: { alertedAt: null } }, ...messages]);
    return result.ok === true;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────────────────────────────────────────────

  async runsPage(filter: { status?: RunStatus[]; workflowId?: string[]; recordId?: string }) {
    const [runs, workflows] = await Promise.all([
      this.store.runs.list({ ...(filter.status ? { status: filter.status } : {}), ...(filter.recordId ? { recordId: filter.recordId } : {}) }),
      this.store.workflows.all(),
    ]);
    return {
      now: stamp(this.clock.now()),
      runs: filter.workflowId && filter.workflowId.length > 0 ? runs.filter((run) => filter.workflowId?.includes(run.workflowId)) : runs,
      workflows: workflows.filter((workflow) => (workflow.versions ?? []).length > 0).map((workflow) => ({ id: workflow.id, name: publishedFacts(workflow).name })),
    };
  }

  async runDetail(actor: Actor, runId: string) {
    const { session: s } = await this.load(runId);
    const { run } = s;
    const open = OPEN_STATUSES.includes(run.status);
    let canControl = can(actor, 'runs.control');
    if (!canControl) {
      try {
        requireRunControl(actor, s.env.wf);
        canControl = true;
      } catch {
        canControl = false;
      }
    }
    const { catalog, people, dws, presets, systems, rules } = s.env.ctx;
    return {
      now: s.env.now,
      run: { id: run.id, status: run.status, version: run.version, startedAt: run.startedAt, recordId: run.recordRef.id, recordType: run.recordRef.type, event: run.event },
      recordTitle: ((s.record.data as Record<string, unknown>).title as string | undefined) ?? run.recordRef.id,
      workflow: { ...s.env.wf, versions: undefined },
      steps: stepViews(s),
      statuses: Object.fromEntries(Object.entries(run.steps).map(([id, step]) => [id, { status: step.status, label: stepViews(s).find((view) => view.id === id)?.label }])),
      path: runPath(s),
      history: historyLines(run),
      log: run.log,
      banner: bannerOf(s),
      simulated: Object.values(run.steps).some((step) => step.simulated) && s.env.adapters.isMock,
      conflict: conflictOf(s),
      canControl: canControl && open,
      record: recordValues(s),
      context: { catalog, people, dws, presets, systems, rules },
    };
  }

  /** 05 §7: three sections, newest first. Decision 5: work goes to a person, and an account with no link to one has none. */
  async inbox(actor: Actor) {
    const person = personOf(actor);
    if (person === null) return { approvals: [], tasks: [], flowChanges: [] };
    const items = (await this.store.workItems.listFor(person)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const approvals = items.filter((item) => ['approve', 'escalation', 'decide_failed_check'].includes(item.kind));
    const tasks = items.filter((item) => ['task', 'collect', 'collect_review', 'needs_information', 'resubmit'].includes(item.kind));
    const flow = items.filter((item) => item.kind === 'publish_request');
    return { approvals, tasks, flowChanges: await this.flowCards(actor, flow) };
  }

  private async flowCard(actor: Actor, item: WorkItem) {
    const request = (await this.store.publishRequests.get(item.publishRequestId as string)) as PublishRequest | null;
    if (!request) return null;
    const found = await this.store.workflows.get(request.workflowId);
    const name = request.snapshot?.name ?? found?.workflow.name ?? request.workflowId;
    return {
      item,
      requestId: request.id,
      title: rc.inbox.flowCard(name, dateText(`${request.goLive}T12:00:00Z`)),
      sentBy: rc.inbox.sentBy(request.requestedBy),
      impact: rc.inbox.impact(request.review.impact),
      overlaps: (request.precedence ?? []).map((choice) => {
        const other = request.review.overlaps.find((overlap) => overlap.id === choice.otherId)?.name ?? choice.otherId;
        return choice.winner === 'self' ? rc.inbox.overlapChoice(name, other) : rc.inbox.overlapChoice(other, name);
      }),
      own: isAuthorOf(actor, { submittedBy: request.requestedBy, submittedById: request.requestedById }),
      status: request.status,
    };
  }

  private async flowCards(actor: Actor, items: WorkItem[]) {
    // 05 §7: the author never sees their own request here, and only people who can approve see this section.
    if (!can(actor, 'flow.approve_changes')) return [];
    const cards = await Promise.all(items.map((item) => this.flowCard(actor, item)));
    return cards.filter((card): card is NonNullable<typeof card> => card !== null && !card.own);
  }

  /** GET /work-items/:id. The author of a flow change can open it by link, to be told they can't approve it (05 §7). */
  async itemDetail(actor: Actor, itemId: string) {
    const item = await this.store.workItems.get(itemId);
    if (!item) throw notFound('That item doesn’t exist.');
    if (item.kind === 'publish_request') {
      const card = await this.flowCard(actor, item);
      if (!card) throw notFound('That item doesn’t exist.');
      if (card.own) return { item: null, kind: item.kind, own: true, runStatus: null };
      if (item.assignee !== personOf(actor)) throw forbidden();
      return { item, kind: item.kind, flowChange: can(actor, 'flow.approve_changes') ? card : null, own: false, runStatus: null };
    }
    if (item.assignee !== personOf(actor)) throw forbidden();
    const run = item.runId ? await this.store.runs.get(item.runId) : null;
    return { item, kind: item.kind, own: false, runStatus: run?.status ?? null };
  }

  async countRunning(workflowId: string): Promise<number> {
    return (await this.store.runs.list({ workflowId, status: OPEN_STATUSES })).length;
  }
}
