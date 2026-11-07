import type { DecisionClass, RoleKey } from './people';
import type { ApprovalRule } from './rules';
import type { RecordData, SampleRecord } from './records';
import type { Scope, Workflow } from './workflow';

/** One decision made while walking the graph (shown as chips "Rate over card? → Over 10%"). */
export interface Decision { nodeId: string; label: string } // label = the out label taken, or "Needs information"

export interface WalkResult {
  seen: string[];             // node ids visited, in visit (breadth-first) order — the order Test lists steps
  path: Set<string>;          // node ids and taken edges "<from>:<outKey>" (canvas highlight)
  edges: { from: string; key: string; to: string }[];
  steps: { nodeId: string; why: string | null }[]; // visited non-structural steps (not trigger/cond/plan/parallel/end), with
                              // why = reason the path reached it ("Over 10%: Rate vs rate card (%) > 10%", "Inside plan",
                              // "Budget check: $120K left in plan after this request") — goes into the approver brief
  decisions: Decision[];
  needInfo: NeedInfoHit[];    // Ifs that stopped because a field is blank (prototype keeps only the last one)
}
export interface NeedInfoHit { nodeId: string; missing: string[] /* field ids */ }

export interface Note { t: 'ok' | 'warn' | 'info' | 'bad'; m: string } // m = exact sentence (engine §6.7, §6.10)

export interface CheckResult { d: string /* DW id */; ok: boolean; m: string }

/** One person (or one "any one of" set) to ask in a round. */
export interface StageItem {
  roles: RoleKey[];           // 1 role, or 2+ for an "any one" item
  any: boolean;               // true = any one of `people` is enough
  nodeId: string | null;      // the Approve step it came from; null for approval-rule items
  ruleId?: string;            // set for items added by an approval rule
  why: string | null;         // walk reason (brief)
  cc?: string;                // split funding: the business unit this cost-center item is charged to
  people: string[];           // resolved people; ['—'] when paused
  paused: boolean;            // true = nobody eligible; waits until someone eligible is assigned; never auto-approved
  pausedWhy?: string;         // e.g. "no eligible Privacy reviewer for Germany"
  notes: Note[];              // why this person (self-approval, limits, delegation, merges …)
  cls: DecisionClass;
  also?: RoleKey[];           // roles merged into this item ("also covers")
  checks: CheckResult[];      // results of every check step on the path (brief)
  stageIndex: number;         // index of the round it ended up in
  /** Engine §6.13 item 8: who this person stands in for (delegate, role backup, a named person's backup). `role` is absent for a named person. */
  onBehalfOf?: { role?: RoleKey; person: string };
  /** Engine §6.13: set on the one-off decision after a Collect & verify with "Ask people to decide" fails (§10.3): that step's id. */
  failedCheckOf?: string;
  /** A requester's resubmit couldn't remove this person (05 §3.4.3, the owner's decision): the brief and the note say so. */
  kept?: true;
  /** Set on an item that exists only because of that: it isn't the plan's own item for this role, so it needs its own answer. */
  keptKey?: string;
}

/** One person a resubmit couldn't remove, as they were asked before it. */
export type KeptItem = Pick<StageItem, 'roles' | 'any' | 'nodeId' | 'people' | 'cls' | 'ruleId' | 'cc'> & { stage: string };

/**
 * What a requester's resubmit couldn't take away, per step and role rather than by whether a person turns up somewhere. A
 * run keeps it to its end: a re-plan may ask more than this, never less. It holds people and rule tasks only. It follows no
 * old exit, so an If always takes what the record selects, and nothing on a branch it no longer selects runs.
 * `steps` are Approve steps still asked though no exit leads to them now, or their "only needed when" no longer holds;
 * `rules` stand whatever the record now says; `items` are a person no longer holding a seat they held, such as someone a
 * signing limit moved to; `original` is who approved the original, frozen as it was before the first resubmit, because
 * the values that "not asked again" compares with mustn't be moved by the resubmit; `named` is who to explain it to.
 */
export interface PlanFloor {
  steps: string[];
  rules: string[];
  items: KeptItem[];
  original: RoleKey[];
  named: string[];
}
export interface RuleTask { ruleId: string; title: string; role: RoleKey; person: string } // e.g. "Record IR35 status", tax, Mei Lin
export interface Stage {
  label: string;              // Approve step title, "(i of n)" for in-order steps, " + <rule name>" appended when a rule joins
  items: StageItem[];
  tasks: RuleTask[];
}
export interface NotNeeded { nodeId: string; roles: RoleKey[]; label: string; m: string } // m "only needed when <conditions text>"
export interface Skipped { nodeId: string; role: RoleKey; m: string } // m "approved the original; nothing they depend on changed"
export interface Basis { basis: 'change' | 'running'; v: number; m: string } // m = the Σ sentence (engine §6.2)

export interface ApprovalPlan {
  walk: WalkResult;           // the single walk the plan (and the Test canvas) used, on the basis-adjusted record
  stages: Stage[];            // approval rounds, in order. "N approval round(s) on this path" = stages.length
  notNeeded: NotNeeded[];
  skipped: Skipped[];
  rules: ApprovalRule[];      // approval rules that matched (even if they only add a task or a flag)
  flags: { field: string; ruleId: string }[]; // rule flags ("Marked: Registration required")
  policies: string[];         // Auto-approve node ids on the path
  needInfo: { nodeId: string; fields: string[] /* labels */; owner: string }[];
  basis: Basis | null;
  rejected: { nodeId: string; by: string } | null;  // path reaches an End with outcome 'rejected'; by = title of the step that sent it there
  stopped: { nodeId: string; by: string; told: string[] } | null; // production addition (engine §16.4); told = role names of the generated Notify
  auto: boolean;              // no rounds, ≥1 Auto-approve on the path, no Needs information → approved automatically
  paused: boolean;            // any item paused
}

/** Status of a step in Test. */
export type StepCode = 'ok' | 'review' | 'fail' | 'wait';
/* Colour/class: ok → green ("ok"), fail → red ("bad"), review and wait → amber ("warn"). */
export interface RoundLine { people: string; notes: string[] } // engine §11.5, before it is joined into one line
export interface StepResult {
  st: StepCode;
  short: string;              // status label (rendered in capitals), see table below
  m: string;                  // message after "·"
  sees?: string;              // Collect & verify only: "Worker sees: <sees>"
  rounds?: string[];          // Approve / failed-decision steps: one line per round "Role (Person), … · notes; notes"
  roundLines?: RoundLine[];   // the same rounds as data, so composeTest never has to parse the joined text
  tasks?: string[];           // rule-task lines under this step (engine §7.3)
}

export interface TestRun {
  workflowId: string;
  sampleId: string;
  rec: RecordData;            // the record as simulated (after edit / chosen proposal)
  walk: WalkResult;
  steps: Record<string, StepResult>;
  heldBack: string[];         // Start, If, Parallel and End boxes still waiting on an earlier step (the canvas draws them as waiting)
  plan: ApprovalPlan | null;  // null when engine §6 does not apply: no Approve or Auto-approve step and no approval rule matches
  inactive: boolean;          // workflow status 'inactive' → inactive note
  /** composeTest takes only the run and the context (engine §11), so the run carries what the panel still needs. */
  workflow: Workflow;
  sample: SampleRecord;
  options: TestRunOptions;
  /** Rule-only rounds, with status suffixes applied (engine §7.3, §8.4). */
  ruleRounds: { line: RoundLine; tasks: string[] }[];
  removedByEdit: string[];    // engine §8.4; empty unless an edit is applied
}

export interface TestRunOptions {
  conflictChoice?: 'a' | 'b';  // ASN-920: which proposed change was chosen ("Use $96/h" = 'a', "Use $102/h" = 'b')
  applyEdit?: boolean;         // ASN-881: apply record.edit.set ("Try an edit: …")
  asOf?: string;               // overrides ctx.asOf
}
export interface TestRunResult {
  summary: string | null;      // engine §11.1 summary; null when plan is null (no summary box)
  inactiveNotice?: string;     // only when workflow.status === 'inactive'
  notices?: string[];          // in order, without icons: Σ basis line, "Using … from …" line, "Marked: …" line, "For real requests, “{winner}” runs for this record."
  conflict?: { badge: 'Conflict'; message: string; choices: string[] };
  editButton?: string;         // "Try an edit: …" or, once applied, "Undo the edit"
  undoButton?: 'Undo';         // shown after a conflict choice
  path: string;                // every decision, in order, "Step → Outcome" joined with " | " ('' when none)
  fromApprovalRules?: Array<{ n: number; people: string; notes: string[]; tasks?: string[] }>;  // rule-only rounds (engine §7.3)
  removedByEdit?: string[];    // "Removed by the edit" lines (engine §8.4)
  steps: Array<{
    id: string; title: string;
    status: string;            // badge text, sentence case
    message: string;
    workerSees?: string;       // Collect & verify only
    rounds?: Array<{ n: number; people: string; notes: string[] }>;
    tasks?: string[];          // rule-task lines (engine §7.3)
  }>;
}
export type TestView = TestRunResult;

export type Severity = 'bad' | 'warn' | 'tip' | 'info';
/* Labels in Nova: bad "Fix before publishing" (blocks Send for approval); warn "Check"; tip "Suggestion"; info (no label).
   The Nova button count = number of bad + warn. */
export interface Issue {
  sev: Severity;
  m: string;                  // exact message (engine §12)
  node?: string;              // step it is about → "Show me" button
  fix?: string;               // one-click fix id: 'rev:<nodeId>' | 'gr:<nodeId>' → "✦ <fl>" button
  fl?: string;                // fix button label: "Add a reverse step" | "Record it in the ledger"
  overlap?: string;           // workflow id it overlaps → "Choose which wins" button (opens Publish)
}
export interface LintResult { issues: Issue[]; recs: number /* history records in scope */ }

export interface Overlap {
  id: string;                 // the other workflow
  name: string;
  scope: Scope;
  priority: number | null;
  count: number;              // history records matching both workflows (>0)
}
/** publishReview(wf, ctx, precedence?) — precedence = the overlap choices made in the open publish dialog (engine §13.3). */
export interface PublishReview {
  impact: number;             // "N records in the last 90 days would have started this workflow"
  mustFix: Issue[];           // bad issues
  overlaps: Overlap[];
  openOverlaps: Overlap[];    // overlaps where neither workflow has a priority and the `precedence` argument gives no choice → block sending
  canSend: boolean;           // mustFix.length === 0 && openOverlaps.length === 0
  effective: string;          // default for "Goes live on"
}
