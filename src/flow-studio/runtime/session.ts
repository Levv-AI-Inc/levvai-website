import type { Rec } from '../engine/conditions';
import { planRecord } from '../engine/plan';
import { applyBasis } from '../engine/changes';
import type { EngineContext } from '../model/context';
import type { BusinessRecord, InboundEvent, LedgerLine, OutboxMessage, RunEvent, StepRun, WorkItem, WorkflowRun } from '../model/runtime';
import type { WfNode, Workflow } from '../model/workflow';
import type { Adapters } from './adapters';
import { engineRecord } from './records';

/** What a command needs besides the run itself. Rebuilt on every attempt, so a retry after a conflict starts from what is stored. */
export interface RunEnv {
  ctx: EngineContext;
  now: string;                 // stamped form (time.ts)
  wf: Workflow;                // the workflow with the pinned version's graph, name and settings in place of the draft
  nodes: Record<string, WfNode>;
  adapters: Adapters;
  autocomplete: boolean;
  origin: string;              // for links in messages
  newId: (prefix: string) => string;
}

/**
 * One run, mid-change. Commands mutate it and record what must be written; nothing reaches the store until the service
 * commits it all in one transaction with the run's `rev` (05 §3.2 step 5, decision 2). So a lost compare-and-swap leaves
 * no trace: not a stray outbox message, not a half-open work item.
 */
export class RunSession {
  readonly newEvents: RunEvent[] = [];
  readonly newItems: WorkItem[] = [];
  readonly touched = new Set<string>();
  readonly outbox: OutboxMessage[] = [];
  readonly newLedger: LedgerLine[] = [];
  readonly closedLedger = new Set<string>();
  readonly raised: InboundEvent[] = [];
  recordDirty = false;
  changed = false;
  /** Who this command is acting for: the audit line's stable identity (decision 5). Absent for Levv itself. */
  acting?: { id: string; name: string };

  constructor(
    readonly run: WorkflowRun,
    readonly items: WorkItem[],
    readonly record: BusinessRecord,
    readonly ledger: LedgerLine[],
    readonly env: RunEnv,
  ) {}

  /** The record as the plan reads it. Verification results so far go in as `outcomes`, the way Test's samples carry them (03 §10.2). */
  rec0(): Rec {
    const base = engineRecord(this.record, this.run.event) as unknown as Rec;
    const outcomes = { ...(base.outcomes as Record<string, string> | undefined), ...this.run.runOutcomes };
    return planRecord(this.env.wf, Object.keys(outcomes).length > 0 ? { ...base, outcomes } : base);
  }

  /** 03 §6.2: what Ifs and limits read. */
  recAdj(): Rec {
    const rec0 = this.rec0();
    const basis = applyBasis(this.env.wf, rec0);
    return basis ? { ...rec0, total_value: basis.v } : rec0;
  }

  step(id: string): StepRun {
    this.run.steps[id] ??= { nodeId: id, status: 'pending' };
    return this.run.steps[id];
  }

  log(type: string, m: string, options: { by?: string; nodeId?: string } = {}): void {
    const byId = options.by ? this.accountBehind(options.by) : undefined;
    const event: RunEvent = { at: this.env.now, by: options.by ?? 'Levv', ...(byId ? { byId } : {}), type, m, ...(options.nodeId ? { nodeId: options.nodeId } : {}) };
    this.run.log.push(event);
    this.newEvents.push(event);
    this.changed = true;
  }

  /** The account behind a name on an audit line. A test actor's account is its name, so there is nothing to add. */
  accountBehind(by: string): string | undefined {
    return this.acting && this.acting.name === by && this.acting.id !== by ? this.acting.id : undefined;
  }

  send(message: { to: string; channel?: OutboxMessage['channel']; subject: string; body: string }): void {
    const { to, channel = 'Email', subject, body } = message;
    this.outbox.push({ id: this.env.newId('om'), runId: this.run.id, to, channel, subject, body, createdAt: this.env.now });
    this.changed = true;
  }

  addItem(item: Omit<WorkItem, 'id' | 'runId' | 'publishRequestId' | 'status' | 'createdAt' | 'recordId' | 'recordTitle' | 'requester'>): WorkItem {
    const rec = this.record.data as Record<string, unknown>;
    const full: WorkItem = {
      id: this.env.newId('wi'),
      runId: this.run.id,
      publishRequestId: null,
      status: 'open',
      createdAt: this.env.now,
      recordId: this.record.id,
      recordTitle: (rec.title as string | undefined) ?? this.record.id,
      requester: rec.requester as string | undefined,
      ...item,
    };
    this.items.push(full);
    this.newItems.push(full);
    delete this.run.stuckTold;
    this.changed = true;
    return full;
  }

  /** Item changes go through here, so the commit knows which rows to write. */
  closeItem(item: WorkItem, status: 'done' | 'cancelled', fields: Partial<WorkItem> = {}): void {
    Object.assign(item, { status, ...(status === 'done' ? { doneAt: this.env.now } : {}), ...fields });
    this.touched.add(item.id);
    this.changed = true;
  }

  touchItem(item: WorkItem): void {
    this.touched.add(item.id);
    this.changed = true;
  }

  setRecord(fields: Record<string, unknown>): void {
    Object.assign(this.record.data as Record<string, unknown>, fields);
    this.record.updatedAt = this.env.now;
    this.recordDirty = true;
    this.changed = true;
  }

  openItems(stepId: string): WorkItem[] {
    return this.items.filter((item) => item.nodeId === stepId && item.status === 'open');
  }

  link(itemId: string): string {
    return `${this.env.origin}/inbox/${itemId}`;
  }

  runLink(): string {
    return `${this.env.origin}/runs/${this.run.id}`;
  }
}
