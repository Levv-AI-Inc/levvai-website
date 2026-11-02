import type { Catalog, EventKey, RecordKey, SourceKey } from './catalog';
import type { DigitalWorkers, Presets, PrereqKey, Systems } from './helpers';
import type { PeopleAuthority, RoleKey } from './people';
import type { RecordData } from './records';
import type { ApprovalPlan, PlanFloor, PublishReview } from './results';
import type { ApprovalRule } from './rules';
import type { Disposition, Workflow, WorkflowStatus } from './workflow';

export type RunStatus = 'running' | 'paused' | 'stopped' | 'completed' | 'rejected';
/* running   = steps are progressing (including waiting for people or systems)
   paused    = paused by an admin (manual Pause) or by a System step with onFail 'pause'; timers (chaser, waits) are frozen
   stopped   = stopped by an admin (manual Stop) or reached an End with outcome 'stopped'
   completed = reached an End with outcome 'completed' or 'approved'
   rejected  = reached an End with outcome 'rejected', or a rejection became final */

export interface WorkflowRun {
  id: string;
  workflowId: string;
  version: number;            // pinned WorkflowVersion.version; never changes during the run
  recordRef: { type: RecordKey; id: string };
  event: EventKey;
  status: RunStatus;
  startedAt: string;          // ISO date-time
  endedAt?: string;
  pausedBy?: string; pausedAt?: string; pauseReason?: 'manual' | 'system_failure' | 'stuck';
  stoppedBy?: string; stoppedAt?: string; stopReason?: string;
  recordSnapshot: RecordData; // values the run started with (for "what changed" in briefs and change detection)
  plan: ApprovalPlan;         // approval plan computed at start; recomputed on record edits (engine §8.4)
  steps: Record<string, StepRun>; // keyed by node id of the pinned version
  log: RunEvent[];            // append-only audit trail
  /** Additive (05 §3.4.6): verification results so far, read by the plan's walk the way Test reads `outcomes` (03 §10.2). */
  runOutcomes?: Record<string, 'fail' | 'unsure'>;
  /** Additive: the stuck net told the owner about this episode (when). Cleared once someone is asked or a Wait gets a date. */
  stuckTold?: string;
  /** Additive: what a requester's resubmit couldn't remove (`PlanFloor`). Every re-plan of this run keeps it. */
  floor?: PlanFloor;
  /** Additive: the next value of StepRun.seq, which gives the step list its run order (05 §6.2). */
  nextSeq?: number;
}

export type StepRunStatus = 'pending' | 'active' | 'waiting' | 'done' | 'skipped' | 'failed' | 'cancelled';
/* pending = not reached; active = started and working (system call, verification); waiting = waiting on a person or a date;
   done = finished (approved, verified, sent, task done); skipped = not on the taken path / Not needed / Not asked again / Covered;
   failed = failed and needs a decision or a fix; cancelled = the run ended before it finished. */

export interface StepRun {
  nodeId: string;
  status: StepRunStatus;
  outcome?: string;           // kind-specific: 'pass'|'flag' (checks), 'approved'|'rejected'|'sent_back' (Approve),
                              // 'verified'|'unsure'|'fail' (Collect), 'in'|'out' (Fits plan?), out key taken (If)
  assignees?: string[];       // resolved people currently asked
  remindAt?: string;          // ISO date-time of the next Chaser reminder (remind hours after it started waiting)
  escalateAt?: string;        // ISO date-time it escalates (sla hours after it started waiting)
  escalatedTo?: string;       // who it escalated to
  waitUntil?: string;         // Wait steps: resolved date-time (moves when the record date changes)
  systemRef?: string;         // System steps: id returned by the system
  startedAt?: string; completedAt?: string;
  decisions?: { by: string; byId?: string; decision: 'approved' | 'rejected' | 'sent_back'; comment?: string; at: string }[];
  /* Additive: what advance() needs to carry on from where it was (05 §3.2, §3.4). */
  seq?: number;               // the order steps started in
  taken?: string[];           // out keys taken when it finished; the run's own taken path (03 §4)
  round?: number;             // Approve: index into the step's stages (mode 'order' asks one at a time)
  approvals?: Record<string, { by: string[]; at: string }>; // Approve: plan item key → who has approved it
  tasksDone?: string[];       // Approve: rule tasks of this step already done
  reminded?: boolean;         // the Chaser reminder has gone (05 §3.3)
  logged?: string[];          // log lines that must appear once only (a paused item is re-checked every re-plan)
  received?: string[];        // Collect & verify: items handed over and not yet verified
  retry?: { count: number; firstFailedAt: string; nextAt: string; error: string }; // System: 05 §3.4.7 step 2
  confirmBy?: string;         // System: Give up after
  call?: { action: string; object: string; match: { key: string; value: unknown } }; // System: what was sent
  values?: Record<string, unknown>; // System: brought back (05 §6.2)
  simulated?: string;         // this result came from a mock adapter, in plain words (00 §4.2)
  resubmit?: { kind: 'rejected' | 'sent_back' | 'path'; by: string; itemId: string; comment: string; decidedBy: string };
  deferred?: { decision: 'rejected' | 'sent_back' | 'stop'; by: string; comment: string }; // decided while paused, applied on Resume (RT-10)
  held?: boolean;             // Approve: reached, and re-planning found nobody and no reason not to ask. It waits; it is never approved (AGENTS rule 4)
}

/** `by` is what the history shows. `byId` is the account that acted (decision 5): the audit line's stable identity, absent for Levv itself. */
export interface RunEvent { at: string; by: string /* person or 'Levv' */; byId?: string; type: string; nodeId?: string; m: string }

/** Persistence and API types (01 §4–§5). Field names match the Prisma models in 01 §4.1. */
export type Permission = 'flow.edit' | 'flow.approve_changes' | 'runs.view' | 'runs.control' | 'reference.import' | 'admin';
export type ReferenceKey = 'people-and-authority' | 'approval-rules' | 'catalog' | 'digital-workers' | 'onboarding-presets' | 'systems';
export interface ReferenceBundle { catalog: Catalog; people: PeopleAuthority; rules: ApprovalRule[]; dws: DigitalWorkers; presets: Presets; systems: Systems }

export interface WorkflowSummary {            // GET /api/flow-studio/workflows (picker order)
  id: string; name: string; recordType: RecordKey; event: EventKey; status: WorkflowStatus; version: number;
  scopeSummary: string;                       // scopeText(scope), "Inactive · " prefix when inactive
  isVariationOf?: string;                     // id of the catch-all on the same record + event
}
export interface NewWorkflowInput { fromWorkflowId?: string }   // POST /api/flow-studio/workflows

export interface PublishRequest {
  id: string; workflowId: string;
  snapshot: Workflow;                         // the draft being published
  goLive: string;                             // YYYY-MM-DD, today or later
  precedence?: { otherId: string; winner: 'self' | 'other' }[];  // applied only on approval
  review: PublishReview;                      // at request time
  requestedBy: string; requestedAt: string;
  requestedById?: string;                     // the account that sent it: who "the author" is (decision 5). `requestedBy` is what the screen shows
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  decidedBy?: string; decidedById?: string; decidedAt?: string; comment?: string;
  authorNotifiedAt?: string;                  // set once the author has seen "Published as …" (engine §13.5)
  publishedVersion?: number;                  // the version this request became, set on approval; publishedNotice reads it
}

/** A real record the runtime acts on (05 §2). Test fixture: seed/runtime-records.json. */
export interface BusinessRecord {
  id: string; type: RecordKey; source: SourceKey; updatedAt: string;
  dataRev?: number;                           // additive: compare-and-swap for concurrent writers of `data` (the row has no rev column)
  data: RecordData & {
    start_date?: string; end_date?: string; last_day?: string;  // ISO dates used by Wait steps
    personal_email?: string;                  // the ledger worker key (05 §3.6)
    work_email?: string;
    worker_tz?: string;                       // IANA time zone for "the worker’s time zone"
    states: PrereqKey[];                      // built-in prerequisites this record has reached (engine §15 item 2); [] = none
    // plus system values brought back, in snake_case (05 §2), e.g. workday_worker_id
  };
}
export interface RunSummary {                 // GET /api/runtime/runs
  id: string; workflowId: string; workflowName: string; version: number;
  recordId: string; recordTitle: string; status: RunStatus;
  waitingOn: string[];                        // "{step}: {person}"
  startedAt: string; updatedAt: string;
}
/**
 * Decision 5: who an account is in this tenant. `accountId` is the Django user id, which no user can change. A person or
 * team in reference data links to an account here, and only someone with reference.import can set it. No row, or a null
 * `person`, means no person identity: an empty inbox, and nobody's approver.
 */
export interface AccountLink {
  accountId: string; email: string;
  person: string | null;                      // a PEOPLE name
  teams: string[];                            // owner names this account belongs to (01 §6.2)
  linkedBy: string; linkedAt: string;         // the account that set it, and when
}
export interface RunClaim { runId: string; startedAt: string }  // additive: 05 §3.1 step 4 made atomic; one row per workflow, version, record and event
export type WorkItemKind = 'approve' | 'escalation' | 'task' | 'collect' | 'collect_review' | 'decide_failed_check'
  | 'needs_information' | 'resubmit' | 'publish_request';
export interface WorkItem {                   // 05 §7
  id: string; kind: WorkItemKind;
  runId: string | null; nodeId: string | null; publishRequestId: string | null;   // publish_request: run/node null
  assignee: string; onBehalfOf?: string;      // the role or person covered (delegate/backup)
  status: 'open' | 'done' | 'cancelled' | 'held';   // held = run paused
  remindAt?: string; escalateAt?: string; dueAt?: string;
  createdAt: string; doneAt?: string;
  decision?: 'approved' | 'rejected' | 'sent_back' | 'verified' | 'not_verified' | 'done' | 'provided' | 'resubmitted';
  comment?: string;
  brief?: string;                             // approver brief (engine §6.13), for approve / escalation / decide_failed_check
  /* Additive: what the inbox shows without loading the run (05 §7), and what a decision needs to find its round. */
  stepName?: string; recordId?: string; recordTitle?: string; requester?: string;
  what?: string;                              // "What they do", the items asked for, the 03 §2.4 message, "Fix and resubmit …"
  key?: string;                               // Approve: the plan item it answers (runtime/keys)
  chaserOf?: string;                          // an escalation made by the Chaser: the item it can answer for (05 §3.4.10)
  items?: string[];                           // collect: what is asked for
  field?: { id: string; label: string; type: string; options?: string[] }; // needs_information: the value editor
}
export interface LedgerLine {                 // 05 §3.6
  id: string; workerKey: string /* personal_email */; runId: string; nodeId: string;
  gives: string; disp: Disposition; reverse?: string; reverseWhen?: 'before' | 'after'; reverseBy?: RoleKey;
  systemRef?: string; status: 'open' | 'closed'; createdAt: string; closedAt?: string;
}
export interface OutboxMessage { id: string; runId: string | null; to: string; channel: 'Email' | 'Teams' | 'Slack' | 'In-app'; subject: string; body: string; createdAt: string; sentAt?: string }
export interface InboundEvent {               // 05 §3.1
  id: string; source: SourceKey; recordType: RecordKey; recordId: string; event: EventKey; payload: unknown;
  receivedAt: string; processedAt?: string; runIds: string[];
  outcome?: 'queued' | 'started' | 'no_workflow' | 'waiting_prerequisite' | 'duplicate'; // queued (additive) = received, not decided yet; a tick retries it
  workflowId?: string; alertedAt?: string;    // additive: waiting_prerequisite's workflow, and when the 7-day alert went (05 §3.1 step 5)
  receivedBy?: string; receivedById?: string; // additive: the admin who posted it from their session; absent for the service token
}
/** seed/test-actors.json (06 §1.2). */
export interface TestActors {
  permissions: Permission[];
  actorSets: Record<'default' | 'author-only-approver', { users: { name: string; permissions: Permission[]; note?: string }[]; ownerTeams: Record<string, string[]> }>;
}
