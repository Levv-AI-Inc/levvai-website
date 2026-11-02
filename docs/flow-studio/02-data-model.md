# Levv Flow Studio — 02 Data model

This section defines every type Flow Studio stores, reads or computes. Field names match the seed JSON files exactly, so the seeds load without renaming. Where a seed holds old (legacy) data, §16 says what to ignore and §15 says what to normalise on load.

Source of truth for behaviour: prototype v35 (`docs/flow-studio/reference/flow-studio-v35.html`). Source of truth for data: `docs/flow-studio/seed/*.json`.

The engine that uses these types is in `03-engine.md`.

---

## 0. Conventions

- All ids are strings. Node ids are unique inside one workflow only (`T` is always the Start node, `END` is always the default End node).
- Money is a plain number in US dollars (`480000` = $480K). Percentages are plain numbers (`14` = 14%). Months are plain numbers.
- Dates are ISO strings `YYYY-MM-DD`. Times are `HH:MM` 24-hour strings. Date-times are `YYYY-MM-DDTHH:MM`.
- All user-visible text is sentence case English. Curly quotes (“ ” ’) are used in user-visible text exactly as written in this spec.
- New ids (workflows `nf{n}`, steps `n{n}`, added path keys `p{n}`, added branch keys `b{n}`) come from the deterministic generator `EngineContext.idGen` (engine §16.0): one shared counter that starts at 101 in every fresh store or test context.
- "Role key" means a key of `ROLES` (`hm`, `cco`, `sec` …) or a pseudo role: `g:<groupKey>` (an approval group) or `p:<Person Name>` (a named person). See §7.
- `null` on a record field means "known to be blank" and triggers Needs information (see engine §2.4). A field that is absent (`undefined`) means "not applicable" and is treated as falsy. Keep this distinction; the acceptance results depend on it.
- Suggested code layout (not mandatory):

```
src/flow-studio/model/catalog.ts      §2
src/flow-studio/model/condition.ts    §3
src/flow-studio/model/workflow.ts     §4–§5
src/flow-studio/model/rules.ts        §6
src/flow-studio/model/people.ts       §7
src/flow-studio/model/helpers.ts      §8–§10
src/flow-studio/model/records.ts      §11
src/flow-studio/model/results.ts      §12–§13
src/flow-studio/model/runtime.ts      §14
src/flow-studio/model/load.ts         §15 (loadSeed + normalise)
```

### 0.1 Engine context (canonical; used by 01, 03, 05 and 06)

```ts
/** Everything the engine reads. Built from the seeds (§15) and passed to every engine function. Only data and strings: no functions except idGen's methods. */
export interface EngineContext {
  catalog: Catalog;                 // §2 (+ FIELD index, §15 step 1)
  people: PeopleAuthority;          // §7
  rules: ApprovalRule[];            // §6 (only status 'live' ones are applied)
  dws: DigitalWorkers;              // §8
  presets: Presets;                 // §9
  systems: Systems;                 // §10
  workflows: Workflow[];            // §4 (all statuses)
  samples: SampleRecord[];          // §11 ("Try a record")
  history: HistoryRecord[];         // §11 (last 90 days)
  asOf: string;                     // YYYY-MM-DD: "today" (absences, "Goes live on" default, new-workflow date). Tests: '2026-10-20'.
  now: string;                      // ISO date-time: timers, submittedAt, run times. Tests: '2026-10-20T09:00:00Z'.
  idGen: IdGen;                     // deterministic id generator (engine §16.0). Tests: createIdGen(101) per context.
  approverAvailability: { othersCanApprove: boolean };
                                    // server-computed for the current author: does any other user hold flow.approve_changes
                                    // (or admin)? (engine §13.1 item 7). Tests: true, false with actor set 'author-only-approver'.
}
```
The server builds `asOf` / `now` from its clock (01 §8) and `approverAvailability` from the user store; tests build the whole context from the fixtures (06 §1.2).

---

## 1. Seed file → type mapping

| Seed file | Top-level key(s) | Type | Notes |
| --- | --- | --- | --- |
| `workflows.json` | `workflows` | `Workflow[]` (§4) | 15 workflows. `draft.nodes` is the editable graph; `published` is the last published snapshot (`null` if never published). The picker groups workflows by "{RECORD} · {event name}" in record-lifecycle order (04-ui §3.1: record order Job posting, Work order, SOW, Onboarding, Assignment, Offboarding, Access request, Timesheet, Expense, Invoice, Worker; events in `EVENTS_FOR` order); inside a group the catch-all comes first, then its variations in file order. |
| `approval-rules.json` | `approvalRules` | `ApprovalRule[]` (§6) | 3 rules. Read-only in Flow Studio (managed outside). |
| `people-and-authority.json` | `ROLES`, `PEOPLE`, `TITLES`, `ORG`, `ORGX`, `MGR`, `LIMIT`, `CENTRAL`, `BACKUP`, `OOO`, `DELEG_OK`, `GROUPS`, `BY_COUNTRY`, `CANDIDATES`, `ALIAS`, `FLAT`, `CLASS_N`, `ACTOR_ONLY`, `NOAPPR`, `PROVIDERS` | `PeopleAuthority` (§7) | Read-only in Flow Studio. `LIMIT` value `null` = unlimited. |
| `catalog.json` | `RECORDS`, `EVENTS`, `EVENTS_FOR`, `SOURCES`, `FIELDS`, `FGROUPS`, `OPS`, `OPL`, `SCOPE_DIMS`, `SCOPE_MORE`, `APPROVES`, `K`, `DESC`, `FLAG_OPTS`, `ELSE_OPTS`, `WAIT_DATES`, `WAIT_UNITS`, `HOURS`, `MATERIAL`, `APPROVAL_EVENTS`, `DAY_EVENTS`, `HOLDABLE`, `LEVV_F`, `REQ_COMMON`, `ADD` | `Catalog` (§2) | Several keys are legacy (§16). |
| `digital-workers.json` | `DW`, `DWD`, `DWS`, `DWX`, `DW_SET`, `CHECK_DW` | `DigitalWorkers` (§8) | `DWS` duplicates `DW` as an array; use `DW`. |
| `onboarding-presets.json` | `PRESETS`, `PRE_SHORT`, `PRE_STATES`, `RTW`, `BGPKG`, `CHECKERS` | `Presets` (§9) | `PRE_SHORT` / `PRE_STATES` are the "Built in" start prerequisites (engine §15, item 2). |
| `systems.json` | `SYS`, `SYS_ACT`, `SYS_KEY`, `SYS_MAP` | `Systems` (§10) | `Coupa` has `st:"off"` (not connected). |
| `sample-records.json` | `samples` | `SampleRecord[]` (§11) | 29 "Try a record" records. Two (`OB-2251`, `ASN-915`) match no workflow (legacy; keep them, they simply never appear in Test). |
| `history-records.json` | `history` | `HistoryRecord[]` (§11) | 440 records, "the last 90 days". Used for impact counts, overlaps and the Nova record count. |

Every file also has `_about` (a string). Ignore it at runtime.

---

## 2. Catalog (`catalog.json`)

```ts
/** Record types. Keys are stable; labels are what the UI shows. Order = picker / "Runs when" order. */
export type RecordKey =
  | 'job_posting' | 'work_order' | 'sow' | 'onboarding' | 'assignment' | 'offboarding'
  | 'access_request' | 'timesheet' | 'expense' | 'invoice' | 'worker';

/** RECORDS: record key -> label. Seed: {"job_posting":"Job posting","work_order":"Work order","sow":"SOW",
 *  "onboarding":"Onboarding","assignment":"Assignment","offboarding":"Offboarding","access_request":"Access request",
 *  "timesheet":"Timesheet","expense":"Expense","invoice":"Invoice","worker":"Worker"} */
export type RecordLabels = Record<RecordKey, string>;

/** Event keys. Labels in EVENTS. Note some keys share a label ("Starts", "Completed") and are only unique per record. */
export type EventKey =
  | 'submitted' | 'changed' | 'change_order' | 'approved' | 'end_30' | 'ended_early' | 'milestone' | 'received'
  | 'doc_expiring' | 'check_failed' | 'rejected' | 'cancelled' | 'accepted' | 'confirmed' | 'started' | 'extended'
  | 'closed' | 'paid' | 'doc_expired' | 'created' | 'filled' | 'ob_start' | 'ob_cleared' | 'ob_done'
  | 'off_start' | 'off_done';

/** EVENTS: event key -> label, e.g. end_30 -> "End date approaching", ob_start -> "Starts".
 *  Day-based events (DAY_EVENTS) display with the workflow's `days`: see engine §1.6 evName(). */
export type EventLabels = Record<EventKey, string>;

/** EVENTS_FOR: which events each record type offers in "Runs when". Seed values:
 *  work_order: submitted, changed, approved, rejected, accepted, confirmed, cancelled
 *  assignment: started, changed, extended, end_30, closed
 *  sow: created, change_order, approved, milestone, closed
 *  timesheet / expense: submitted, approved, rejected
 *  invoice: received, approved, paid
 *  worker: doc_expiring, doc_expired
 *  onboarding: ob_start, ob_cleared, check_failed, ob_done
 *  job_posting: created, changed, approved, filled, cancelled
 *  offboarding: off_start, off_done
 *  access_request: submitted, approved, cancelled */
export type EventsFor = Record<RecordKey, EventKey[]>;

/** DAY_EVENTS: ["end_30","doc_expiring"]. These events fire N days before a date; N = Workflow.days (default 30). */
export type DayEvents = EventKey[];

/** "Starts from": where the event is picked up. Default 'levv'. */
export type SourceKey = 'levv' | 'fieldglass' | 'workday' | 's4' | 'zip' | 'servicenow';
/** SOURCES: {"levv":"Levv","fieldglass":"SAP Fieldglass","workday":"Workday","s4":"SAP S/4HANA","zip":"Zip","servicenow":"ServiceNow"} */
export type SourceLabels = Record<SourceKey, string>;

/** Field value types. */
export type FieldType = 'money' | 'num' | 'pct' | 'enum' | 'bool' | 'list' | 'text';

/** Field groups, in the order the field dropdown shows them. FGROUPS = ["Record","Related records","Levv-calculated","Custom fields"]. */
export type FieldGroup = 'Record' | 'Related records' | 'Levv-calculated' | 'Custom fields';

/** One entry of FIELDS: a field conditions and Applies-to can use. 32 entries in the seed. */
export interface FieldDef {
  id: string;          // stable key on the record, e.g. "total_value", "rate_vs_card_pct"
  l: string;           // label, e.g. "Total value", "Rate vs rate card (%)"
  g: FieldGroup;       // dropdown group
  t: FieldType;        // value type; decides operators (OPS) and the value editor
  o?: string[];        // options for t='enum' (allowed values) and t='list' (allowed list items)
  risk?: true;         // a yes/no "risk question": data_access, digital_worker_access, role_regulated.
                       // Used by If → Advanced → "Treat a blank risk question as yes (cautious)".
  owner?: RoleKey;     // who is asked to fill it in when it is blank (Needs information). Only rate_vs_card_pct has one: "proc".
}
/* Seed FIELDS (id · label · type · options):
 total_value · Total value · money
 bill_rate · Bill rate per hour · money
 country · Work country · enum [UK, Canada, US, Germany]
 business_unit · Business unit · enum [Technology, Operations, Finance, Marketing]
 job_family · Job family · enum [Cloud, Data, Analytics, Design, Operations]
 engagement · Engagement type · enum [Off-payroll, Payrolled, Fixed fee, Time and materials]
 data_access · Client data access · bool · risk
 digital_worker_access · Vendor's digital worker has system access · bool · risk
 role_regulated · Regulated role · bool · risk
 terms_nonstandard · Non-standard terms · bool
 scope_changed · Scope changed · bool
 changed_fields · Fields changed · list [end_date, bill_rate, cost_center, scope]
 hours_over_schedule · Hours over schedule · bool
 registration_required · Registration required · bool
 decision_extend · Manager chose to extend · bool
 urgent · Urgent start · bool
 worker_former_employee · Worker is a former employee · bool (Related records)
 supplier_tier · Supplier tier · enum [Preferred, Approved, New] (Related records)
 rate_vs_card_pct · Rate vs rate card (%) · pct (Levv-calculated, owner proc)
 rate_vs_market_pct · Rate vs market median (%) · pct (Levv-calculated)
 budget_left_after · Budget left after request · money (Levv-calculated)
 months_engaged_after · Months engaged after change · num (Levv-calculated)
 duplicate_found · Possible duplicate worker · bool (Levv-calculated)
 days_to_start · Days until start date · num (Levv-calculated)
 invoice_matches · Invoice matches time and work order · bool (Levv-calculated)
 security_clearance · Security clearance · enum [None, Basic, Enhanced] (Custom fields)
 project_code · Project code · text (Custom fields)
 cost_center · Cost center · enum [CC-100, CC-110, CC-200, CC-300, CC-400]
 legal_entity · Legal entity · enum [Levv Bank UK Ltd, Levv Bank US Inc, Levv Bank Canada Ltd, Levv Bank GmbH]
 site · Site · enum [London, New York, Toronto, Frankfurt, Remote]
 worker_type · Worker type · enum [Agency contractor, Independent contractor, SOW consultant, Payrolled contractor]
 rate_change_pct · Bill rate change (%) · pct (Levv-calculated)
*/

/** Comparison operators. */
export type Operator = '>=' | '>' | '<' | '<=' | 'in' | 'not_in' | 'yes' | 'no' | 'includes' | 'is' | 'contains';
/** OPS: operators allowed per field type; the FIRST one is the default when a field is picked.
 *  money/num/pct: [">=",">","<","<="]; enum: ["in","not_in"]; bool: ["yes","no"]; list: ["includes"]; text: ["is","contains"] */
export type OpsByType = Record<FieldType, Operator[]>;
/** OPL: operator labels. {">=":"≥",">":">","<":"<","<=":"≤","in":"is","not_in":"is not","yes":"is yes","no":"is no",
 *  "includes":"includes","is":"is","contains":"contains"} */
export type OperatorLabels = Record<Operator, string>;

/** Applies-to dimensions. SCOPE_DIMS are always shown; SCOPE_MORE sit under "More: site, worker type, job family". */
export type ScopeDimKey = 'business_unit' | 'cost_center' | 'legal_entity' | 'country' | 'site' | 'worker_type' | 'job_family';
/** SCOPE_DIMS = [["business_unit","Business unit"],["cost_center","Cost center"],["legal_entity","Legal entity"],["country","Work country"]]
 *  SCOPE_MORE = [["site","Site"],["worker_type","Worker type"],["job_family","Job family"]] */
export type ScopeDimList = [ScopeDimKey, string][];

/** "Ask again only if these change" keys. MATERIAL = {"total_value":"Total value","end_date":"End date","bill_rate":"Bill rate",
 *  "cost_center":"Cost center","scope":"Scope","data_access":"Data access","supplier":"Supplier and terms"} */
export type MaterialKey = 'total_value' | 'end_date' | 'bill_rate' | 'cost_center' | 'scope' | 'data_access' | 'supplier';

/** Wait step: dates on the record. WAIT_DATES = {"start_date":"Start date","end_date":"End date","wo_approved_at":"Work order approved","last_day":"Last day"} */
export type WaitDateKey = 'start_date' | 'end_date' | 'wo_approved_at' | 'last_day';
/** WAIT_UNITS = {"hours":"hours","days":"days","business_days":"working days","weeks":"weeks"} */
export type WaitUnit = 'hours' | 'days' | 'business_days' | 'weeks';

/** Step kinds used in v35 workflows. ('update','runappr','milestone','takeback','gate','integ' are legacy — §16.) */
export type StepKind =
  | 'trigger' | 'cond' | 'appr' | 'policy' | 'plan' | 'dw' | 'collect' | 'task'
  | 'system' | 'notify' | 'wait' | 'parallel' | 'runwf' | 'end';

/** K: step-menu / panel title per kind. Use: trigger "Start", cond "If", plan "Fits plan?", policy "Auto-approve",
 *  appr "Approve", notify "Notify", task "Task", dw "Digital Worker", wait "Wait", parallel "Parallel",
 *  runwf "Run workflow", collect "Collect & verify", system "System", end "End". */
export type KindLabels = Record<StepKind, string>;

/** DESC: one-line step-menu description per kind (use the seed values for the kinds above, e.g.
 *  appr "Roles sign off. Levv finds the right people"). */
export type KindDescriptions = Partial<Record<StepKind, string>>;

/** ADD.workflows: the step menu groups, in order. Seed:
 *  [["Decide",["cond"]],["Approvals",["appr","policy","plan"]],["People",["collect","task"]],
 *   ["Systems",["system","notify"]],["Timing",["wait","parallel","runwf"]]]
 *  Onboarding / offboarding workflows also show preset steps (§9) and every workflow shows its Digital Workers (§8). */
export type StepMenu = [string, StepKind[]][];

/** FLAG_OPTS.workflows: what a flagged check does. Use ONLY the "workflows" list:
 *  [["note","Carry on: the flag is recorded"],["escalate","Escalate: someone must decide"],
 *   ["reject","Reject it and send it back to the requester"],["stop","Stop the workflow and tell someone"]] */
export type FlagOptions = [FlagDo, string][];

/** LEVV_F: Levv fields a System step can send. ["Worker name","Work email","Personal email","Job title","Start date",
 *  "End date","Hiring manager","Cost center","Business unit","Legal entity","Site","Work country","Supplier","Bill rate",
 *  "Total value","Work order ID","Levv worker ID","Sponsor","Date of birth"] */
export type LevvField = string;

/** REQ_COMMON: common "What's required" items offered in Collect & verify (21 strings, see seed). The dropdown offers
 *  REQ_COMMON ∪ every item already used by any Collect & verify step ∪ this step's items; typing a new one offers
 *  "+ Add “<typed>”". */
export type RequiredItem = string;

/** Default title of a step that has no label (engine title()). Not in the seed; define this constant:
 *  trigger "Trigger", cond "Condition", plan "Within plan", policy "Policy approve", appr "Approval", notify "Notify",
 *  task "Task", dw "Digital Worker", wait "Wait", parallel "Parallel", runwf "Run workflow", end "End",
 *  collect "Collect & verify", system "System".
 *  (The prototype has no entry for collect/system; every created collect/system step has a label, so this is only a fallback.) */
export declare const DEFAULT_TITLE: Record<StepKind, string>;

export interface Catalog {
  RECORDS: RecordLabels;
  EVENTS: EventLabels;
  EVENTS_FOR: EventsFor;
  SOURCES: SourceLabels;
  FIELDS: FieldDef[];
  FGROUPS: FieldGroup[];
  OPS: OpsByType;
  OPL: OperatorLabels;
  SCOPE_DIMS: ScopeDimList;
  SCOPE_MORE: ScopeDimList;
  K: KindLabels;
  DESC: KindDescriptions;
  FLAG_OPTS: { workflows: FlagOptions; approvals?: unknown /* legacy, ignore */ };
  WAIT_DATES: Record<WaitDateKey, string>;
  WAIT_UNITS: Record<WaitUnit, string>;
  MATERIAL: Record<MaterialKey, string>;
  DAY_EVENTS: EventKey[];
  LEVV_F: LevvField[];
  REQ_COMMON: RequiredItem[];
  ADD: { workflows: StepMenu };
  // Legacy keys present in the seed, loaded but unused: APPROVES, ELSE_OPTS, HOURS, APPROVAL_EVENTS, HOLDABLE (see §16)
}
```

---

## 3. Conditions (paths, "Only needed when", rule conditions)

```ts
/** One comparison, e.g. {f:"rate_vs_card_pct", op:">", v:10}. */
export interface Row {
  f: string;            // FieldDef.id
  op: Operator;         // must be in OPS[field.t]
  /** Value, by field type:
   *  money/num/pct: number (null = not filled in yet; never matches)
   *  enum ('in'/'not_in'): string[] of options (empty = "(pick a value)"; 'in' never matches, 'not_in' matches any non-blank)
   *  list ('includes'): one option string, e.g. "bill_rate"
   *  text ('is'/'contains'): string
   *  bool ('yes'/'no'): absent (undefined) */
  v?: number | string | string[] | null;
}

/** An either/or group inside a condition list ("Either/or: any one of these").
 *  Created by "+ Add an either/or condition" as {join:"any", rows:[{f:"total_value",op:">=",v:250000},{f:"role_regulated",op:"yes"}]}.
 *  Groups can only contain Rows in the UI (one level); the engine evaluates any depth. */
export interface Group {
  join: 'all' | 'any';  // UI labels: "all" / "any one"
  rows: (Row | Group)[];
}

/** A condition list: used by If paths (on the Out itself), Approve "Only needed when" (ApproveNode.when) and approval rules (ApprovalRule.when). */
export interface Condition {
  join: 'all' | 'any';  // "Take this path when all / any of these are true"; default 'all'
  rows: (Row | Group)[];// empty list = always true (an If path with no rows matches everything; lint warns)
}

/** Type guard: an element of rows is a Group when it has `rows`. */
export const isGroup = (x: Row | Group): x is Group => Array.isArray((x as Group).rows);
```

---

## 4. Workflow

```ts
export type WorkflowStatus = 'draft' | 'live' | 'inactive';
/* draft    = never published (published === null). Can be tested and published; cannot be switched on/off.
   live     = published and Active. New events start it (if it is the selected workflow, engine §3).
   inactive = published but switched off. Nothing new starts it; runs already going finish on their pinned version.
   Workflows are never deleted. There is no 'deleted' status. */

/** Applies to. Key = ScopeDimKey, value = the allowed values. Missing key or empty array = any value.
 *  Several values in one key = any of them (OR); several keys = all must hold (AND).
 *  e.g. {"country":["UK"],"business_unit":["Technology"]} reads "UK · Technology". {} reads "Everywhere". */
export type Scope = Partial<Record<ScopeDimKey, string[]>>;

/** Who hears when a request is finally rejected. Shown on the first box as "When a request is finally rejected, tell". */
export interface OnReject {
  recipients: RoleKey[];  // role keys (no pseudo roles). NEW workflows start with ['hm'] (Hiring manager).
                          // Seeded workflows keep their stored value; a seeded workflow without onReject tells nobody.
  resubmitDays?: number;  // days the requester has to fix and resubmit after a "back to the requester" rejection
                          // before the rejection becomes final. Default 5. Not in seed; not editable in v35.
}

/** The graph. */
export interface WorkflowGraph {
  nodes: Record<string, WfNode>;   // keyed by node id; must contain 'T' (trigger). 'END' (end, outcome completed) always exists.
}

/** The last published snapshot. Seed: {nodes, scope, name}. */
export interface PublishedSnapshot extends WorkflowGraph {
  scope: Scope;
  name: string;
}

/** A stored published version (production; not in seed, built from `published` on load — §15). Runs pin one. */
export interface WorkflowVersion {
  version: number;         // 1, 2, 3 …
  nodes: Record<string, WfNode>;
  scope: Scope;
  name: string;
  effective: string;       // ISO date it goes live ("Goes live on")
  publishedAt?: string;    // ISO date-time the second person approved
  submittedBy?: string;    // author who pressed "Send for approval"
  approvedBy?: string;     // second person who approved (never the author)
}

/** Waiting-for-approval state after "Send for approval". */
export interface PendingPublish {
  submittedBy: string;     // the author
  submittedAt: string;     // ISO date-time
  effective: string;       // the "Goes live on" date chosen in the publish panel
  /** Overlap choices made in the publish panel. Applied to both workflows' `priority` ONLY when the second person
   *  approves (until then neither workflow's priority changes). */
  precedence?: { otherId: string; winner: 'self' | 'other' }[];
  // Who may approve: any user with the "Approve flow changes" permission who is not `submittedBy`.
}

export interface Workflow {
  id: string;              // e.g. "wf-wo-sub", "wf-wo-sub-wo-uk-tech". New ones: idGen 'nf{n}' (engine §16.0; first is "nf101").
  name: string;            // e.g. "UK Technology work orders". New: "New workflow".
  records: RecordKey[];    // the record type this workflow runs on. Always exactly one element in v35 (UI sets [rc]).
  event: EventKey;         // the event that starts it, e.g. "submitted"
  scope: Scope;            // Applies to (current, editable). {} = Everywhere.
  status: WorkflowStatus;  // see above
  version: number;         // number of the current published version (shown "Live v3"). 0 for never-published (§15);
                           // the first publish makes it 1 ("Live v1"), each later publish adds 1.
  effective: string;       // ISO date. Current/next go-live date. New workflows: the first day of the month after (asOf + 30 days) — "2026-12-01" under the test date 2026-10-20.
  owner: string;           // a team ("Procurement operations", "HR operations", "Security operations", "Accounts payable",
                           // "Finance operations", "IT operations", "Legal operations") or a person name from PEOPLE.
                           // New: "Procurement operations".
  priority: number | null; // only used when two workflows overlap (engine §3). Lower number wins. null = not set.
  source?: SourceKey;      // "Starts from". Absent = 'levv'. e.g. Site access request = 'zip'.
  days?: number;           // for DAY_EVENTS (end_30, doc_expiring): days before the date. Default 30.
                           // For offboarding/off_start: "Days before the end date", default 14 (seed wf-offboard: 14).
  basis?: 'total' | 'change' | 'running';
                           // "Amount to compare for changes" (events changed / change_order). Default 'total'.
                           // total = the new total; change = the change amount; running = the running total of all changes
                           // since the original. Value conditions and signing limits in this workflow use it (engine §6.2).
                           // Seed: wf-sow-co 'running'; wf-ending, wf-asn-chg 'total'.
  onReject?: OnReject;     // who hears about a final rejection. New workflows: {recipients:['hm'], resubmitDays:5}.
                           // Seeded workflows: kept as stored (absent = nobody is told).
  draft: WorkflowGraph;    // the current editable graph. Test, Nova and Publish read this.
  published: PublishedSnapshot | null; // last published snapshot, null if never published.
  versions?: WorkflowVersion[];        // production: every published version (built on load from `published`).
  pending?: PendingPublish | null;     // set while waiting for the second person. Status text "Waiting for approval".
  desc?: string;           // optional free-text description (not shown in v35 workflow settings)
  // Legacy, ignore: tab ("workflows"), kind ("main") — see §16.
}

/** "Unpublished changes": a live/inactive workflow is dirty when JSON of {nodes:draft.nodes, scope, name}
 *  differs from published. Drafts are always "dirty" (never published). */
```

---

## 5. Nodes (steps)

### 5.1 Base and outs

```ts
/** An exit of a step. Most steps have one out with key 'next'. */
export interface Out {
  key: string;      // 'next' | If paths 'p1','p2','p<n>' and 'else' | checks 'flag','pass' | Fits plan? 'in','out'
                    // | Collect & verify 'fail' (only when failTo='role', to its generated escalation)
                    // | Parallel 'b1','b2','b<n>' | System 'failed' (only when onFail='path')
  to: string;       // target node id. Must exist in nodes.
  label?: string;   // shown on the canvas: If path name ("Over 10%", "Yes", "No", "Otherwise"), check exits
                    // ("Flagged","Passed"), plan exits ("Inside plan","Outside plan"), branch names ("Identity"),
                    // System exits ("Done","Failed").
}

export interface NodeBase {
  id: string;       // unique in the workflow
  kind: StepKind;
  label: string;    // step name ("Name" field). '' = untitled (engine uses DEFAULT_TITLE). Trigger and End labels are ''.
  outs: Out[];      // exits; End has []
}

/** Every node type. */
export type WfNode =
  | TriggerNode | CondNode | ApproveNode | PolicyNode | PlanNode | DwNode | CollectNode
  | TaskNode | SystemNode | NotifyNode | WaitNode | ParallelNode | RunWorkflowNode | EndNode;
```

### 5.2 Start (`trigger`)

```ts
/** The first box (⚡). Always id 'T', one out 'next'. Its panel holds the workflow settings (Workflow fields). */
export interface TriggerNode extends NodeBase {
  kind: 'trigger';
  label: '';
  outs: [Out];      // [{key:'next', to: firstStepId}]
}
```

### 5.3 If (`cond`)

```ts
/** What a path does after its conditions match. Derived, see engine §16.3 pathMode(); stored hints below. */
export type PathThen = 'continue' | 'approve' | 'escalate' | 'reject' | 'stop' | 'custom';
/* UI labels (Then dropdown):
   continue → “Carry on to “<merge step title or End>”” ;  approve → "Ask someone to approve" ;
   escalate → "Escalate: someone must decide" ; reject → "Reject it and send it back to the requester" ;
   stop → "Stop the workflow and tell someone" ; custom → "Steps added on the canvas" (only shown when the path has its own steps). */

/** A non-Otherwise path of an If. */
export interface CondPath extends Out {
  key: string;                // 'p1', 'p2', 'p<n>' (a new If's first path is 'p1'; paths added later get idGen 'p{n}', engine §16.0)
  label: string;              // path name, e.g. "Over 10%". New paths: "Path <k>" where k = 1-based index among non-else paths.
  join: 'all' | 'any';        // "Take this path when all/any of these are true". Default 'all'.
  rows: (Row | Group)[];      // conditions. New path default: [{f:'total_value', op:'>=', v:100000}]
  do?: PathThen;              // what this path does (set when chosen in the panel; absent in most seed paths = derive)
  node?: string | null;       // id of the step generated for approve/escalate/reject/stop ("<condId>_<key>")
  who?: RoleKey;              // who approves / is escalated to / is told. Defaults: approve 'proc', escalate 'cco', stop 'hm'.
  // No hours field here: an escalation's only timer is the generated Approve node's Chaser `sla` (default 48).
  // The hours box in the path card edits nodes[node].sla directly.
}

/** The Otherwise path. Always the LAST out. Label "No" when the only other path is "Yes", otherwise "Otherwise". */
export interface CondElse extends Out {
  key: 'else';
  label: string;              // "No" | "Otherwise" (or a custom name)
}

export interface CondNode extends NodeBase {
  kind: 'cond';
  label: string;              // e.g. "Rate over card?". New If: "Over $500K?"
  outs: [...CondPath[], CondElse];   // ≥1 path + else, checked top to bottom, first match wins, else = none matched
  /** "Then" of the Otherwise path is stored on the If node (seed field names): */
  elseDo?: PathThen;          // seed has 'continue' on 1 node (wf-ending C1, draft and published); absent = derive
  elseNode?: string | null;   // id of the generated Otherwise step ("<condId>_else")
  elseWho?: RoleKey;          // who for approve/escalate/stop on Otherwise
  elseCont?: string;          // legacy helper (where Otherwise used to go). Ignore; recomputed.
  /** Advanced → "When information is missing". Default 'ask'.
   *  'ask'       → "Stop at Needs information and ask the owner"
   *  'cautious'  → "Treat a blank risk question as yes (cautious)" (only if EVERY blank field is a risk field; else as 'ask')
   *  'otherwise' → "Go to <else label>" (evaluate with the blanks; blanks never match, so it usually goes to Otherwise) */
  onMissing?: 'ask' | 'cautious' | 'otherwise';
  /** Production addition (not in seed): the node where all carrying-on paths meet again ("All paths meet again at …").
   *  Computed once on load and when the If is inserted (= the step the If was inserted in front of). See engine §16.2. */
  mergeAt?: string;
}
```

### 5.4 Approve (`appr`)

```ts
export type ApproveMode = 'all' | 'any' | 'order';
/* "How many" (only shown with 2+ roles): all = "Everyone, together"; any = "Any one"; order = "One after another".
   Test text prefix (2+ roles): all "Together. ", any "Any one. ", order "In order. ".
   Panel sentence: all "together", any "any one of them is enough", order "one after another". */

export type RejectBehaviour = 'requester' | 'previous' | 'end';
/* Advanced → "If rejected": requester = "Back to requester" (Test: "back to the requester to fix");
   previous = "Back one step" (Test: "back one step"); end = "End the flow" (Test: "the request is rejected"). Default 'requester'. */

export interface ApproveNode extends NodeBase {
  kind: 'appr';
  label: string;              // e.g. "Business sign-off". New: "Approval". (The step kind is called "Approve" in the menu and panel title.)
  /** Who approves. Role keys. For who='group' at most one 'g:<key>'; for who='person' at most one 'p:<Name>'.
   *  [] = nobody yet: canvas subtitle "Choose who approves", Test fail "Choose who approves", blocks publish.
   *  Switching to "An approval group" / "A named person" starts EMPTY (placeholders "Choose a group" / "Choose a person");
   *  nothing is auto-picked.
   *  Never 'worker'. Never a NOAPPR role (it, ap, people_ops) — EXCEPT generated failed-check escalations
   *  (failOf set), whose single role is the Collect & verify step's failRole and may be People Ops, IT or AP. */
  roles: RoleKey[];
  who?: 'roles' | 'group' | 'person';   // "Who approves" mode. Absent → derive: any 'g:' → group, any 'p:' → person, else roles.
  backup?: string;            // who='person' only: "Backup when they’re away" — a PEOPLE name, never the same person. '' / absent = "No backup".
  mode: ApproveMode;          // default 'all'. Forced to 'all' for group/person.
  /** Chaser (built in). */
  remind?: number;            // "Remind after (hours)". Default 24.
  sla: number;                // "Then escalate to their manager after (hours)". Default 48. Must be > remind
                              // (inline error "Escalation has to come after the reminder."; lint blocks publish).
                              // For escalation steps this is the ONLY timer; the If path / check / Collect & verify panels show it as "Escalate after (hours)".
  /** Advanced */
  when?: Condition;           // "Only needed when". Absent or rows [] = always asked.
  whenPrompt?: string;        // the plain words typed into "Only needed when" (kept for display). '' when cleared.
  reject: RejectBehaviour;    // default 'requester'
  authority: boolean;         // "Check signing authority" — "Moves up the manager chain if the limit is too low". Default false.
  material: MaterialKey[];    // "Ask again only if these change". Default [].
  reaskOnDecrease: boolean;   // "Ask again when a value goes down" — "Off: a shorter extension keeps this approval". Default true.
  /** Generated escalation steps: from an If path set to Escalate, a check's "Escalate", or a Collect & verify
   *  "If it fails: Escalate: someone must decide". Always kind 'appr' with escalation:true, remind 24, sla 48 by default. */
  escalation?: boolean;       // true = "someone must decide" escalation: Test shows ESCALATED. Default false.
  failOf?: string;            // set on the escalation generated for a Collect & verify failure: that collect node's id.
  // Legacy, ignore: prechecks (every approver gets the brief).
}
```

### 5.5 Auto-approve (`policy`)

```ts
/** Approves instantly when no one is asked anywhere on the path, and keeps a receipt for audit. */
export interface PolicyNode extends NodeBase {
  kind: 'policy';
  label: string;              // e.g. "Approve within plan". New: "Auto-approve".
  receipt: string;            // "Receipt", e.g. "Approved automatically: fits the approved plan". New: "Approved automatically".
  fyi?: RoleKey | '';         // "Let someone know" (role key, or '' = "No one"). New: ''.
  outs: [Out];                // 'next'
}
```

### 5.6 Fits plan? (`plan`)

```ts
export interface PlanNode extends NodeBase {
  kind: 'plan';
  label: string;              // e.g. "Within plan?". New: "Fits plan?"
  /** "Plan": one of "Cost center plan, this quarter" | "Role family plan, this quarter" | "Project budget". */
  plan: string;
  outs: [Out & { key: 'in'; label: 'Inside plan' }, Out & { key: 'out'; label: 'Outside plan' }];
  /* "If outside the plan, send it to": the 'out' exit leads to an Approve step whose single role is one of
     cco, dh, hm_mgr, fbp, vpf. A new Fits plan? creates that Approve step: label "Outside plan", roles ['cco']. */
  // Legacy, ignore: fit (["Amount","End date"] etc.)
}
```

### 5.7 Digital Worker (`dw`)

```ts
export type FlagDo = 'note' | 'escalate' | 'reject' | 'stop';
/* "If it flags something" (checks only):
   note     → "Carry on: the flag is recorded" (flag exit goes to the same place as Passed)
   escalate → "Escalate: someone must decide" (flag exit goes to a generated Approve step with escalation:true)
   reject   → "Reject it and send it back to the requester" (flag exit goes to a generated End, outcome 'rejected')
   stop     → "Stop the workflow and tell someone" (flag exit goes to a generated Notify, then End) */

export interface DwNode extends NodeBase {
  kind: 'dw';
  label: string;              // defaults to the Digital Worker name, e.g. "Budget check"
  worker: string;             // DW id: checks 'budget' | 'rate' | 'dup' | 'tenure'; helpers 'intake' | 'invoice' | 'docs'
                              // | 'access' | 'startguard' | 'sweeper' | 'recovery' | 'closer'
  /** Checks (worker in CHECK_DW) have outs [{key:'flag',label:'Flagged'},{key:'pass',label:'Passed'}] in that order.
   *  Helpers have one out 'next'. */
  flagDo?: FlagDo;            // checks only. Default 'note'.
  flagWho?: RoleKey;          // escalate: who decides (default 'proc'); stop: who is told (default 'hm').
  flagNode?: string | null;   // id of the generated step on the flag exit ("<dwId>f"; seed has older "RA_CDe", "CDf")
  // No hours field here: the hours box in the check panel edits nodes[flagNode].sla (default 48).
  fallback?: RoleKey;         // helpers only: "If it isn’t sure, hand to". Seed 'proc' / 'ap'.
  // Legacy, ignore: threshold (80/90), flagCont (recomputed = pass.to).
}
```

### 5.8 Collect & verify (`collect`)

```ts
export type VerifyMode = 'auto' | 'auto_person' | 'person';
/* "How it’s verified": auto = "Automatically"; auto_person = "Automatically, a person if unsure"; person = "A person reviews". */

export type Disposition = 'remove' | 'return' | 'retain';
/* "At exit" (ledger): remove = "Remove access"; return = "Return equipment"; retain = "Retain obligation". */

export interface CollectNode extends NodeBase {
  kind: 'collect';
  label: string;              // e.g. "Identity & eligibility". New: "New requirement".
  from?: Provider;            // "Who provides it": worker | sponsor | supplier_am | hm | it. Absent = 'worker'.
  items: string[];            // "What’s required", e.g. ["Photo ID","Right to work"]. [] = lint warning.
  verify: VerifyMode;         // New: 'person'.
  checker: string;            // "Checked by" (verify ≠ person): CHECKERS key — persona, checkr, esign, workday, servicenow,
                              // onfido, yoti, dw:docs, dw:access. Default 'persona'.
  reviewer: RoleKey;          // "Reviewer" (verify ≠ auto). Any role except worker. Default 'people_ops'.
  /** "If it fails" */
  failTo: 'role' | 'approval';// role = "Escalate: someone must decide"; approval = "Ask people to decide". Default 'role'.
  failRole: RoleKey;          // failTo='role': who decides. Any role except the worker (People Ops, IT, AP allowed). Default 'people_ops'.
  failNode?: string;          // failTo='role': id of the generated escalation Approve node ("<collectId>_fail", roles [failRole],
                              // escalation:true, failOf:<collectId>, sla 48). Reached through out {key:'fail', label:'Failed'};
                              // its own out 'next' always points where the collect's 'next' points. Its `sla` is the escalation timer.
  failRoles?: RoleKey[];      // failTo='approval': who decides. Any roles except the worker (operational roles allowed). [] = blocks publish.
  failMode?: 'all' | 'any';   // failTo='approval': together or any one. Default 'all'.
  /** Chaser */
  remind?: number;            // default 48
  sla?: number;               // default 96. Escalates to "the hiring manager" when from is worker or supplier_am, else "their manager".
  /** Ledger ("Gives the worker something") */
  gives: string;              // e.g. "Confidentiality obligations". '' = gives nothing.
  disp?: Disposition;         // "At exit". Absent → derive (engine §1.9 dispOf).
  reverse: string;            // "Exit step", e.g. "Send NDA exit reminder". '' with gives ≠ '' = blocks publish.
  reverseWhen: 'before' | 'after'; // "When": before = "Before the last day", after = "On the last day". Default 'after'.
  reverseBy: RoleKey;         // "Done by". Default 'hm'.
  /** Ready-made step (§9) settings, only meaningful with that preset: */
  preset?: PresetKey;         // idrtw | bgcheck | docs | training | pay | finalts | exitconf | equip (seed LB)
  pkg?: 'std' | 'fs' | 'enh'; // bgcheck: "Package" (BGPKG). Default 'std'.
  fsAuto?: boolean;           // bgcheck: "Use the Financial services package for regulated roles". Default true.
  revisit?: boolean;          // idrtw: "Check again when a visa or permit expires". Default true.
  signer?: 'worker' | 'supplier' | 'both'; // docs: "Signed by". Default 'worker'.
  due?: 'start' | 'week';     // training: "Due" — "Before the start date" / "Within 7 days of starting". Default 'start'.
  kit?: string[];             // equip: "Laptop","Building badge","Phone","Hardware token". Sets gives = kit.join(' and ').
  ship?: 'home' | 'office';   // equip: "Ship to". Default 'home'.
  // Legacy, ignore: strength ('hard'|'soft'), failFlow ('adverse').
}
export type Provider = 'worker' | 'sponsor' | 'supplier_am' | 'hm' | 'it';
```

### 5.9 Task (`task`)

```ts
export interface TaskNode extends NodeBase {
  kind: 'task';
  label: string;              // e.g. "Extend or end?". New: "New task".
  role: RoleKey;              // "Who". The only place the worker can be picked besides Collect "Who provides it". New: 'proc'.
  title: string;              // "What they do", e.g. "Decide whether to extend". New: "Enter the PO number".
  remind?: number;            // Chaser, default 48
  sla?: number;               // Chaser, default 96 (escalates to "their manager")
  preset?: PresetKey;         // handover | recover | equip
  method?: 'courier' | 'dropoff'; // recover: "How". Default 'courier'.
  chaseDays?: number;         // recover: "If it isn’t back after (days)". Default 5.
  gives?: string; disp?: Disposition; reverse?: string; reverseBy?: RoleKey; kit?: string[]; // equip preset as a task
  // Legacy, ignore: blocking, req.
}
```

### 5.10 System (`system`)

```ts
export type SysAction = 'create' | 'update' | 'read' | 'wait' | 'close' | 'check';
/* SYS_ACT labels: create "Create", update "Update", read "Read", wait "Wait for", close "Close or deactivate",
   check "Check it matches the ledger". */

export interface SystemConfig {
  system: string;             // must equal SystemNode.system (a SYS key)
  action: SysAction;          // "Action"
  object: string;             // "What": one of SYS[system].obj, e.g. "Contingent worker"
  match: string;              // "Find the existing record by": one of SYS_KEY[system] ∪ ["Work email","Levv worker ID"]
  map: [string, string][];    // "Fields sent": [LevvField, system field]. Default SYS_MAP[object] ?? SYS_MAP._ (copied)
  read: string[];             // "Bring back to Levv": subset of SYS[system].back. Saved on the record for later steps.
  wait: 'confirm' | 'none';   // "After sending" (create/update/close): "Wait until <system> confirms it’s done" / "Carry on straight away"
  waitH: number;              // "Give up after (hours)". Default 24.
  state: 'Created' | 'Updated' | 'Approved' | 'Completed' | 'Closed'; // action 'wait': "Wait until it’s". Default 'Completed'.
  onFail: 'task' | 'path' | 'pause';
  /* "If it fails" (after retries): task = "Then give someone a task to fix it"; path = "Then take a Failed path (add your own steps)"
     (adds out {key:'failed',label:'Failed'} to a generated Task; the normal out gets label 'Done');
     pause = "Then pause the workflow and alert the owner". Default 'task'. */
  failRole: RoleKey;          // onFail='task': "Who fixes it". Default 'people_ops'.
  retries: number;            // "Levv retries <n> times over an hour first." Always 3.
  check: boolean;             // also check the result matches the ledger ("then checks it matches the ledger")
}

export interface SystemNode extends NodeBase {
  kind: 'system';
  label: string;              // e.g. "Workday provisioning". New: "System step".
  system: string;             // SYS key: "SAP Fieldglass" | "Workday" | "SAP S/4HANA" | "ServiceNow" | "Okta"
                              // | "Microsoft Entra ID" | "Coupa" | "Badge system". New: "Workday".
  sys: SystemConfig;          // always present in seed. If missing, build with engine §1.10 ensureSys().
  via: string;                // "Done by": '' = "Levv connection", or a DW id ('access','sweeper' …) "(Digital Worker)".
  gives: string; disp?: Disposition; reverse: string; reverseWhen: 'before' | 'after'; reverseBy: RoleKey; // ledger, as Collect
  preset?: PresetKey;         // hris | access | revoke | hrclose | wclose | ledger
  when?: 'last' | 'now';      // revoke preset "When": last = "End of the last day, in the worker’s time zone"; now = "Straight away"
  // Legacy, ignore: actions (['push','pull','reconcile'] — superseded by sys), apps.
}
```

### 5.11 Notify (`notify`)

```ts
export interface NotifyNode extends NodeBase {
  kind: 'notify';
  label: string;              // e.g. "Tell the supplier". New: "Notify".
  recipients: RoleKey[];      // "Who" (any role incl. worker, sponsor, groups). [] = lint warning. New: ['cco'].
  channel: 'Email' | 'Teams' | 'Slack' | 'In-app'; // "How". Default 'Email'.
  outs: [Out];
}
```

### 5.12 Wait (`wait`)

```ts
export interface WaitConfig {
  mode: 'for' | 'date' | 'at'; // "For a set time" | "Until a date on the record" | "Until a specific date and time"
  amount?: number;             // for: how long (≥1); date: offset (≥0, 0 = on the date)
  unit?: WaitUnit;             // for: any unit; date: days | business_days | weeks (no hours)
  dir?: 'before' | 'after';    // date: "Before or after". Default 'before'.
  field?: WaitDateKey;         // date: "Date". Default 'start_date'.
  time?: string;               // date: "At" HH:MM. Default '09:00'.
  tz?: 'worker' | 'company';   // date: "Time zone": "The worker’s" | "Company (head office)". Default 'worker'.
  at?: string;                 // at: "Date and time" YYYY-MM-DDTHH:MM ('' = not set)
}
export interface WaitNode extends NodeBase {
  kind: 'wait';
  label: string;               // e.g. "Wait for start date". New: "Wait".
  w: WaitConfig;               // New: {mode:'date', field:'start_date', amount:5, unit:'business_days', dir:'before', time:'09:00', tz:'worker'}
  // Legacy, ignore: until ("Start date").
}
```

### 5.13 Parallel, Run workflow, End

```ts
export interface ParallelNode extends NodeBase {
  kind: 'parallel';
  label: string;               // e.g. "Before the last day". New: "Run together".
  outs: (Out & { key: string; label: string })[]; // branches 'b1','b2',… with names. ≥2. New: "Branch 1","Branch 2".
  /* The step where branches meet waits for all branches. A branch that goes straight to End on its own is tracked and
     chased but holds nothing up (e.g. onboarding "Vendor insurance" → END). */
}

export interface RunWorkflowNode extends NodeBase {
  kind: 'runwf';
  label: string;               // New: "Run workflow"
  target: string;              // workflow id to start (any other workflow). New: 'wf-ending'.
  outs: [Out];
}

export type EndOutcome = 'completed' | 'approved' | 'rejected' | 'cancelled' | 'stopped';
/* 'completed' default End. 'rejected' = generated by "Reject it and send it back to the requester" (label "Rejected",
   red ✕ icon). 'stopped' is a production addition for "Stop the workflow and tell someone" (engine §16.4).
   'approved','cancelled' and 'stopped' are selectable in the End panel ("Outcome", 04-ui §7.16). */
export interface EndNode extends NodeBase {
  kind: 'end';
  label: string;               // '' for END; "Rejected" for generated reject ends
  outcome: EndOutcome;
  outs: [];
}
```

### 5.14 Defaults when a step is added (step menu, presets, rail)

| Added | Node created (fields not listed use the defaults above) |
| --- | --- |
| If | `{kind:'cond', label:'Over $500K?', outs:[{key:'p1', to:<next>, label:'Yes', join:'all', rows:[{f:'total_value', op:'>=', v:500000}]}, {key:'else', to:<next>, label:'No'}], mergeAt:<next>}` |
| Approve | `{kind:'appr', label:'Approval', roles:[], who:'roles', mode:'all', authority:false, material:[], reaskOnDecrease:true, remind:24, sla:48, reject:'requester'}` — canvas "Approval" / "Choose who approves" |
| Auto-approve | `{kind:'policy', label:'Auto-approve', receipt:'Approved automatically', fyi:''}` |
| Fits plan? | `{kind:'plan', label:'Fits plan?', plan:'Cost center plan, this quarter', outs:[{key:'in', to:<next>, label:'Inside plan'}, {key:'out', to:<newApproveId>, label:'Outside plan'}]}` plus Approve `{id:<planId>+'x', label:'Outside plan', roles:['cco'], …}` → `<next>` |
| Collect & verify | `{kind:'collect', label:'New requirement', items:[], verify:'person', checker:'persona', reviewer:'people_ops', failTo:'role', failRole:'people_ops', gives:'', reverse:'', reverseWhen:'after', reverseBy:'hm'}` (from absent = worker) |
| Task | `{kind:'task', label:'New task', role:'proc', title:'Enter the PO number'}` |
| System | `{kind:'system', label:'System step', system:'Workday', via:'', gives:'', reverse:'', reverseWhen:'after', reverseBy:'it', sys: ensureSys(...)}` → action 'create', object 'Contingent worker', match 'Work email', map SYS_MAP['Contingent worker'], read [], wait 'confirm', waitH 24, state 'Completed', onFail 'task', failRole 'people_ops', retries 3, check false |
| Notify | `{kind:'notify', label:'Notify', recipients:['cco'], channel:'Email'}` |
| Wait | `{kind:'wait', label:'Wait', w:{mode:'date', field:'start_date', amount:5, unit:'business_days', dir:'before', time:'09:00', tz:'worker'}}` |
| Parallel | `{kind:'parallel', label:'Run together', outs:[{key:'b1', to:<next>, label:'Branch 1'}, {key:'b2', to:<next>, label:'Branch 2'}]}` |
| Run workflow | `{kind:'runwf', label:'Run workflow', target:'wf-ending'}` |
| Digital Worker (check) | `{kind:'dw', label:DW[id].n, worker:id, flagDo:'note', outs:[{key:'flag', to:<next>, label:'Flagged'}, {key:'pass', to:<next>, label:'Passed'}]}` |
| Digital Worker (helper) | `{kind:'dw', label:DW[id].n, worker:id, fallback:'proc', outs:[{key:'next', to:<next>}]}` |
| Preset | `PRESETS[key].kind` node with label `PRESETS[key].n`, the kind's defaults, then `PRESETS[key].p` copied over it, then `preset:key` (§9). For `bgcheck` the legacy `failTo:'approval', failFlow:'adverse'` becomes `failTo:'approval', failRoles:['hrbp','legal'], failMode:'all'`. |

| New workflow (picker "+ New workflow"; `createWorkflow`, engine §16.13) | `{id: idGen 'nf{n}', name:'New workflow', records:[record of the workflow it was created from, else 'work_order'], event: its event (else 'submitted'), scope:{}, status:'draft', version:0, effective: the first day of the month after (`ctx.asOf` + 30 days); with the test date 2026-10-20 that is 2026-12-01, owner:'Procurement operations', priority:null, source:'levv', onReject:{recipients:['hm'], resubmitDays:5}, draft:{nodes:{T → END}}, published:null}` |

New node ids: `ctx.idGen.next('node')` → `n{n}` (engine §16.0). Derived ids (`<condId>_<key>`, `<dwId>f`, `<collectId>_fail`, `<planId>x`, `<systemId>f`, `…_end`) are listed there too.

---

## 6. Approval rules (`approval-rules.json`) — read-only in Flow Studio

```ts
/** A company-wide rule. Applies to EVERY workflow whose record+event matches, when `when` is true. */
export interface ApprovalRule {
  id: string;                 // "ao-data" | "ao-ir35" | "ao-reg"
  name: string;               // "Client data access" | "UK off-payroll (IR35)" | "Regulated roles"
  records: RecordKey[];       // e.g. ["work_order","sow"]
  event: EventKey;            // e.g. "submitted". NOTE: seed rules use 'submitted'; SOWs now start on 'created' (see engine §7.1).
  when: Condition;            // e.g. {join:'any', rows:[{f:'data_access',op:'yes'},{f:'digital_worker_access',op:'yes'}]}
  status: 'live' | 'draft' | 'inactive'; // only 'live' rules apply
  version: number;            // display only
  effective: string;          // ISO date (display only in Flow Studio)
  owner: string;              // e.g. "Information Security"
  act: RuleAction;
  published?: unknown;        // snapshot kept by the admin area; Flow Studio ignores it
  // Legacy, ignore: tab ("approvals"), kind ("rule"), scope ({}).
}

export interface RuleAction {
  approve: boolean;           // add approvers
  roles: RoleKey[];           // approvers to add (when approve)
  mode: 'all' | 'any';        // all = each role separately; any = one "any one of" item
  position: 'first' | 'with' | 'last';
  /* where the approvers go: first = a new round before every other round; with = into the first approval round on the
     path that is not only escalations (all seed rules); last = a new round after every other round. */
  task: boolean;              // add a task
  taskRole: RoleKey;          // who does the task (seed 'tax')
  taskTitle: string;          // e.g. "Record IR35 status"
  flag: boolean;              // mark the request
  flagField: string;          // bool FieldDef.id to set to yes, e.g. "registration_required"
}
```

---

## 7. People and authority (`people-and-authority.json`) — read-only in Flow Studio

```ts
/** A role key. Plain keys come from ROLES; pseudo keys are 'g:<GROUPS key>' and 'p:<PEOPLE name>'. */
export type RoleKey = string;

export type DecisionClass = 1 | 2 | 3 | 4;
/* CLASS_N: 1 "business sign-off", 2 "specialist review", 3 "commercial review", 4 "executive sign-off".
   Class decides merging ("same kind of decision") and special rules: class 2 (specialist) never moves up a manager chain
   and never uses signing limits; a class-2 delegate must be eligible (DELEG_OK). */

export interface RoleDef {
  n: string;                  // label, e.g. "Hiring manager", "Information Security"
  c: DecisionClass;           // decision class
  actor?: true;               // worker only: can do tasks, provide items and be told; can never approve, review or be escalated to
  grp?: true;                 // a pseudo role for an approval group (key 'g:…'); n = group name, c = 3
  person?: true;              // a pseudo role for a named person (key 'p:…'); n = the person name, c = 3 (created on demand)
}
/* Seed ROLES (key · label · class):
 worker Worker 1 actor · sponsor Sponsor 1 · hm Hiring manager 1 · hm_mgr Hiring manager's manager 1 · cco Cost center owner 1
 dh Department head 1 · sow_owner SOW owner 1 · hrbp HR business partner 2 · sec Information Security 2 · priv Privacy 2
 legal Legal 2 · compliance Compliance 2 · tax Tax 2 · proc Procurement 3 · fbp Finance business partner 3
 supplier_am Supplier account manager 3 · vpf VP Finance 4 · cfo CFO 4 · people_ops People Ops 2 · it IT service desk 2
 ap Accounts payable 3 · g:fin_ctrl Finance controllers 3 grp · g:sec_board Security review board 3 grp · g:exco Executive committee 3 grp
 Pseudo person roles 'p:<Name>' are not in the seed: create {n:<Name>, c:3, person:true} when referenced. */
export type Roles = Record<RoleKey, RoleDef>;

/** Business-role holders per business unit (ORG). Keys hm, hm_mgr, cco, dh. */
export type Org = Record<string /* business unit */, { hm: string; hm_mgr: string; cco: string; dh: string }>;
/* Technology: hm Tom Reed, hm_mgr Priya Shah, cco Priya Shah, dh Alan Brooks
   Operations: hm Grace Kim, hm_mgr Raj Patel, cco Raj Patel, dh Nadia Rahman
   Finance:    hm Omar Haddad, hm_mgr Lena Fischer, cco Lena Fischer, dh Ivan Petrov
   Marketing:  hm Sofia Reyes, hm_mgr Ben Carter, cco Alicia Ng, dh Alicia Ng */

/** ORGX: organisation lookups. */
export interface OrgX {
  LE: Record<string, string>;        // country -> legal entity ("UK" -> "Levv Bank UK Ltd")
  LE_SHORT: Record<string, string>;  // legal entity -> short label for Applies to ("Levv Bank UK Ltd" -> "UK entity")
  CC: Record<string, string>;        // cost center -> name ("CC-100" -> "Platform engineering"); Applies-to label "CC-100 Platform engineering"
  CC_OF: Record<string, string[]>;   // business unit -> its cost centers
  SITE: Record<string, string>;      // country -> default site
  WT: Record<string, string>;        // engagement type -> default worker type
}

export interface OutOfOffice {
  until: string;              // seed "Oct 24" / "Oct 30" → normalise to ISO "2026-10-24" / "2026-10-30" (§15). Displayed as "Oct 24".
  to: string;                 // their delegate (a PEOPLE name)
  from?: string;              // production: ISO start date (absent = already away)
}

export interface ApprovalGroup {
  n: string;                  // "Finance controllers"
  members: string[];          // PEOPLE names
  mode: 'any' | 'all';        // any = any one member approves; all = every (eligible) member approves
}

export interface PeopleAuthority {
  ROLES: Roles;
  PEOPLE: string[];                           // everyone who can be named (31 names, sorted)
  TITLES: Record<string, string>;             // person -> job title, e.g. "Alan Brooks" -> "Head of Technology UK"
  ORG: Org;
  ORGX: OrgX;
  MGR: Record<string, string>;                // person -> their manager (the manager chain used for self-approval and signing limits)
  LIMIT: Record<string, number | null>;       // person -> signing limit in USD. null = unlimited. Missing person = 0 (no authority).
  CENTRAL: Record<RoleKey, string>;           // central role -> holder, e.g. proc -> "Owen Clarke", sec -> "Kenji Watanabe".
                                              // supplier_am -> "Supplier account manager" (a placeholder, not a person).
  BACKUP: Record<RoleKey, string>;            // role -> backup person: sec Ravi Kumar, legal Luis Romero, compliance Ama Boateng, tax Mei Lin
  OOO: Record<string, OutOfOffice>;           // who is away: Hannah Brooks (until Oct 24, to Luis Romero), Kenji Watanabe (until Oct 30, to Mia Chen)
  DELEG_OK: Record<string, RoleKey[]>;        // delegate -> class-2 roles they may cover: "Luis Romero": ["legal"], "Mia Chen": []
  GROUPS: Record<string, ApprovalGroup>;      // fin_ctrl (any), sec_board (any), exco (all)
  BY_COUNTRY: Record<RoleKey, Record<string, string | null>>;
                                              // role -> country -> holder. null = nobody eligible → the approval pauses.
                                              // Seed: {"priv":{"Germany":null}}
  CANDIDATES: Record<RoleKey, string[]>;      // eligible people the admin area can assign when paused (not used by Flow Studio)
  ALIAS: [RoleKey, string[]][];               // words people use for roles (plain-words parsers)
  FLAT: [string, RoleKey][];                  // ALIAS flattened, longest phrase first
  CLASS_N: Record<DecisionClass, string>;      // JSON object keys are strings ("1"…"4"): validate with string keys and convert with Number(k)
  ACTOR_ONLY: RoleKey[];                      // ["worker"]: never approves, reviews, decides or is escalated to
  NOAPPR: RoleKey[];                          // ["it","ap","people_ops","worker"]: never offered as approvers / deciders
                                              // (Approve "Who approves", If "Who approves"/"Escalate to", flag "Escalate to").
                                              // They CAN be reviewers, task owners and failed-check deciders
                                              // (Collect & verify failRole / failRoles: any role except the worker).
  PROVIDERS: Provider[];                      // ["worker","sponsor","supplier_am","hm","it"]: Collect "Who provides it"
}
```

---

## 8. Digital Workers (`digital-workers.json`)

```ts
export interface DigitalWorker {
  id: string;                 // 'budget','rate','dup','tenure' (checks); 'intake','invoice','docs','access','startguard','sweeper',
                              // 'recovery','closer' (helpers); 'brief','chaser','timesheet','offboard','milestone','distribution' (legacy)
  n: string;                  // name, e.g. "Duplicate & ghost worker", "Access provisioner"
  s: 'ready' | 'setup' | 'off'; // ready = usable; setup = "Needs setup"/"Needs a connection first"; off = not licensed (not draggable)
  p: string;                  // SVG path data for the 24x24 icon
}
export interface DigitalWorkers {
  DW: Record<string, DigitalWorker>;
  DWD: Record<string, string>;               // short description (step menu line), e.g. dup "Finds the same person under another supplier"
  DWX: Record<string, { d: string; u: string }>; // hover card: d = what it does, u = where to use it
  DW_SET: { workflows: string[]; onboarding: string[]; offboarding: string[]; access: string[] };
  /* which DWs the rail and step menu show per workflow context (engine §1.11 dwContext):
     workflows ["tenure","rate","budget","dup","intake","invoice"]; onboarding ["docs","access","startguard"];
     offboarding ["sweeper","recovery","closer"]; access ["dup","docs","access"]. Never the Chaser.
     The step menu hides s:'off'; the rail shows them greyed and not draggable. */
  CHECK_DW: string[];                        // ["budget","rate","dup","tenure"]: checks with Passed / Flagged exits
  // DWS: same objects as DW, as an array (ignore).
}
```

Every hover card ends with: "It never approves or rejects. If it isn’t sure, a person decides." and, for `s:'setup'`, "Needs a connection first".

---

## 9. Ready-made steps (`onboarding-presets.json`)

```ts
export type PresetKey =
  | 'idrtw' | 'bgcheck' | 'docs' | 'training' | 'hris' | 'access' | 'equip' | 'pay'           // ph 'on' (onboarding)
  | 'revoke' | 'recover' | 'finalts' | 'handover' | 'exitconf' | 'hrclose' | 'wclose' | 'ledger'; // ph 'off' (offboarding)

export interface Preset {
  ph: 'on' | 'off';           // shown in the step menu of onboarding ('on') or offboarding ('off') workflows only,
                              // under "Onboarding steps" / "Offboarding steps"
  n: string;                  // step name, e.g. "Identity & right to work"
  d: string;                  // step-menu description
  kind: 'collect' | 'system' | 'task';
  p: Record<string, unknown>; // settings copied onto the node (field names as in §5.8–§5.10)
}
export interface Presets {
  PRESETS: Record<PresetKey, Preset>;
  PRE_STATES: Record<PrereqKey, string>;     // long labels ("Nothing: it can start any time", "Work order is approved", …)
  PRE_SHORT: Record<PrereqKey, string>;      // short labels used in "Built in: Levv only starts this once the <short>."
  RTW: Record<string, string>;               // country -> right-to-work rule, shown in the idrtw box
  BGPKG: Record<'std' | 'fs' | 'enh', string>; // background packages
  CHECKERS: Record<string, string>;          // verifier key -> label: persona Persona, checkr Checkr, esign E-signature,
                                             // workday Workday, servicenow ServiceNow, dw:docs Document collector,
                                             // dw:access Access, onfido Onfido, yoti Yoti
}
export type PrereqKey = 'none' | 'jp_approved' | 'wo_approved' | 'wo_accepted' | 'cleared' | 'ob_done' | 'active' | 'sow_approved' | 'ts_approved';
```

---

## 10. Connected systems (`systems.json`)

```ts
export interface SystemDef {
  st: 'ok' | 'off';           // ok = connected ("Connected · last checked <seen>"); off = not connected (Coupa)
  seen: string;               // "4 min ago" (display)
  obj: string[];              // objects it can create/update ("What")
  back: string[];             // fields it can bring back ("Bring back to Levv")
}
export interface Systems {
  SYS: Record<string, SystemDef>;            // 8 systems: SAP Fieldglass, Workday, SAP S/4HANA, ServiceNow, Okta, Microsoft Entra ID, Coupa (off), Badge system
  SYS_ACT: Record<SysAction, string>;
  SYS_KEY: Record<string, string[]>;         // system -> matching keys (first one is the default)
  SYS_MAP: Record<string, [string, string][]>; // object -> default field map ("Nova matched these automatically"); '_' = fallback
}
```

---

## 11. Records (`sample-records.json`, `history-records.json`)

A record is a flat object: the FIELDS values plus the keys below. Samples and history have the same shape; samples add `title`, `note` and simulation-only keys.

```ts
export interface RecordData {
  id: string;                 // "WO-2214", "H-WO-17"
  record: RecordKey;          // record type
  event: EventKey;            // event that happened
  requester: string;          // who raised it (a PEOPLE name, or "Coordinator" = someone with no role)
  hiring_manager?: string;    // the hiring manager named on the record. Overrides ORG hm/hm_mgr resolution
                              // and produces "<hm> is the hiring manager on the record (raised by <requester>)".
  sponsor?: string;           // access requests: the employee who asked for the person
  sponsor_delegate?: string;  // shown as "Sponsor (Grace Kim, or their delegate Raj Patel)"
  worker_name?: string;       // the person it is about ("Worker (Jordan Ellis)"); absent → "the worker"
  cost_centers?: string[];    // split funding: BUSINESS UNIT keys of ORG (prototype), e.g. ["Finance","Marketing"].
                              // With 2+ entries every cost-center-owner approval is asked once per entry.
  prev?: Partial<RecordData>; // change events: the previous approved version's values (only the fields that differ are required)
  original_total?: number;    // SOW change orders: the original SOW value (running-total basis)
  /** Simulation-only (samples): */
  title?: string;             // shown under "Try a record" (strip " (approved)")
  note?: string;              // author's note (not shown)
  conflict?: { field: string; a: Proposal; b: Proposal }; // two pending proposals for one field (ASN-920)
  edit?: { label: string; set: Partial<RecordData>; decreased: string[] }; // "Try an edit: <label>" (ASN-881)
  decided?: RoleKey[];        // roles that had already approved before the edit (ASN-881: ["cco","hrbp"])
  outcomes?: Record<string, 'fail' | 'unsure' | 'done'>;  // simulated step outcomes keyed by node id
  outcomesL?: Record<string, 'fail' | 'unsure' | 'done'>; // the same keyed by step label (checked when the id has none)
  // FIELDS values (see §2), e.g. total_value, country, business_unit, rate_vs_card_pct (null = blank → Needs information), …
  [field: string]: unknown;
  // Legacy, ignore: other_assignments, reason.
}
export interface Proposal { by: string; v: string; total: number } // v = display value ("$96/h"); total = resulting total_value
export type SampleRecord = RecordData & { title: string };
export type HistoryRecord = RecordData;
```

Data quirks to keep (they drive the acceptance results): `WO-2280.rate_vs_card_pct` is `null`; `WO-2214-C` has no `rate_vs_card_pct` or `total_value` (absent, so its If goes to Otherwise without Needs information); access-request samples use sites "Toronto office" / "London office", which are not FIELD options.

---

## 12. Simulation (Test) result types

```ts
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
export interface StepResult {
  st: StepCode;
  short: string;              // status label (rendered in capitals), see table below
  m: string;                  // message after "·"
  sees?: string;              // Collect & verify only: "Worker sees: <sees>"
  rounds?: string[];          // Approve / failed-decision steps: one line per round "Role (Person), … · notes; notes"
}
```

Status labels (`short`) and when they occur — exact text, rendered upper-case by CSS:

| Step | `st` | `short` | Meaning |
| --- | --- | --- | --- |
| Digital Worker check | ok / review | `Passed` / `Flagged` | check result |
| Digital Worker helper | ok | `Done` | helper did its job |
| Approve | review | `Approval` | waiting for approvers |
| Approve (escalation) | review | `Escalated` | someone must decide |
| Approve | fail | `Paused` | nobody eligible |
| Approve | fail | `Choose who approves` | no approvers chosen yet (never auto-approved) |
| Approve | ok | `Not needed` | "Only needed when" is false |
| Approve | ok | `Not asked again` | approved the original; nothing they depend on changed |
| Approve | ok | `Covered` | the same person already approves this kind of decision on this path |
| Auto-approve | ok | `Approved automatically` / `Not used` | |
| Fits plan? | ok | `Inside the plan` / `Outside the plan` | |
| Collect & verify | ok | `Verified automatically` | |
| Collect & verify | review | `Review: <Role>` / `Unsure: <Role>` | a person reviews / the checker wasn’t sure |
| Collect & verify | fail | `Failed: decision needed` / `Failed: escalated` | |
| System | ok | `Done in <System>` | |
| Task | ok / review | `Done` / `To do: <Role>` | |
| Notify | ok | `Sent` / `No one to tell` | |
| Wait | ok | `Waits` | |
| Run workflow | ok | `Started` | production addition (prototype shows the kind name) |
| any step held up | wait | `Waiting` | an earlier step is not done |

```ts
export interface TestRun {
  workflowId: string;
  sampleId: string;
  rec: RecordData;            // the record as simulated (after edit / chosen proposal)
  walk: WalkResult;
  steps: Record<string, StepResult>;
  plan: ApprovalPlan | null;  // null when engine §6 does not apply: no Approve or Auto-approve step and no approval rule matches
  inactive: boolean;          // workflow status 'inactive' → inactive note
}
```

### 12.1 Test view: `TestRunResult` (normative output of `composeTest`)

`composeTest` (engine §11) turns a `TestRun` into the view the Test panel shows and the acceptance tests compare (06 §1.4 repeats this type). **`TestView` = `TestRunResult`.**

```ts
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
```

Mapping from `TestRun` / `StepResult`: `steps` = the walk's steps in walk order without trigger, cond, parallel and end, each `{id: nodeId, title: title(node), status: StepResult.short, message: StepResult.m, workerSees: StepResult.sees}`; each `StepResult.rounds` line `"{people} · {notes joined '; '}"` becomes `{n, people, notes}` (n = 1, 2, … within the step); `summary` and `notices` come from engine §11 items 2–3 (summary) and §11.1; `inactiveNotice` from `TestRun.inactive`; `conflict`, `editButton`, `undoButton` from engine §8.3–§8.4; `path` from `walk.decisions` as "{title of the deciding step} → {label}". Properties that do not apply are absent (not empty).

---

## 13. Nova (lint) and Publish types

```ts
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
```

---

## 14. Runtime types (production engine; 05-runtime §6 covers the run screens)

```ts
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
  pausedBy?: string; pausedAt?: string; pauseReason?: 'manual' | 'system_failure';
  stoppedBy?: string; stoppedAt?: string; stopReason?: string;
  recordSnapshot: RecordData; // values the run started with (for "what changed" in briefs and change detection)
  plan: ApprovalPlan;         // approval plan computed at start; recomputed on record edits (engine §8.4)
  steps: Record<string, StepRun>; // keyed by node id of the pinned version
  log: RunEvent[];            // append-only audit trail
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
  decisions?: { by: string; decision: 'approved' | 'rejected' | 'sent_back'; comment?: string; at: string }[];
}

export interface RunEvent { at: string; by: string /* person or 'Levv' */; type: string; nodeId?: string; m: string }

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
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  decidedBy?: string; decidedAt?: string; comment?: string;
  authorNotifiedAt?: string;                  // set once the author has seen "Published as …" (engine §13.5)
}

/** A real record the runtime acts on (05 §2). Test fixture: seed/runtime-records.json. */
export interface BusinessRecord {
  id: string; type: RecordKey; source: SourceKey; updatedAt: string;
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
  outcome?: 'started' | 'no_workflow' | 'waiting_prerequisite' | 'duplicate';
}
/** seed/test-actors.json (06 §1.2). */
export interface TestActors {
  permissions: Permission[];
  actorSets: Record<'default' | 'author-only-approver', { users: { name: string; permissions: Permission[]; note?: string }[]; ownerTeams: Record<string, string[]> }>;
}
```

---

## 15. Normalisation on load (`loadSeed`)

Apply in this order. None of these rename seed fields.

1. **Index catalogs.** Build `FIELD = Object.fromEntries(FIELDS.map(f => [f.id, f]))`.
2. **Pseudo roles.** For every `GROUPS` key `k`, ensure `ROLES['g:'+k] = {n: GROUPS[k].n, c: 3, grp: true}` (already in the seed). For every `p:<Name>` referenced anywhere (nodes, `flagWho`, `elseWho`, path `who`), create `ROLES['p:<Name>'] = {n: '<Name>', c: 3, person: true}`.
3. **Limits.** `LIMIT[p] === null` → `Infinity`. A person missing from `LIMIT` has limit `0`.
4. **Out of office.** Convert `OOO[p].until` "Mon D" to `YYYY-MM-DD` using year 2026 ("Oct 24" → "2026-10-24"). Keep the display string for messages ("is out until Oct 24").
5. **Workflow defaults.** `source ??= 'levv'`; `basis ??= 'total'`; `days ??= (off_start ? 14 : 30)` only where the event uses it; if `onReject` exists, `onReject.resubmitDays ??= 5` (do NOT add `onReject` to seeded workflows that lack it; only new workflows get `{recipients:['hm']}`); if `published === null` then `version = 0` (so the first publish is v1, "Live v1").
6. **Versions.** If `published` is not null: `versions = [{version, nodes: published.nodes, scope: published.scope, name: published.name, effective}]`.
7. **Node defaults** (fill only when absent):
   - `appr`: `who` derived from roles (§5.4); `remind ??= 24`; `sla ??= 48`; `mode ??= 'all'`; `material ??= []`; `reaskOnDecrease ??= true`; `reject ??= 'requester'`; `authority ??= false`.
   - `collect`: `from ??= 'worker'`; `remind ??= 48`; `sla ??= 96`; `failMode ??= 'all'` when `failTo === 'approval'`; `failRoles ??= ['hrbp']` when `failTo === 'approval'` (prototype migration default).
     When `failTo === 'role'` and there is no `failNode`: create the generated escalation (engine §16.12) — Approve `{id: <id>+'_fail', label: '<collect title> failed: escalation', roles:[failRole], escalation:true, failOf:<id>, remind:24, sla:48, reject:'requester'}` with out `next` → the collect's `next` target, and add out `{key:'fail', to:<that id>, label:'Failed'}` to the collect.
   - Generated escalation Approve nodes (`escalation: true`): `remind ??= 24`, `sla ??= 48`. Seeds have no `elseSla`/`flagSla`/path `sla`; if any appear, copy the value to the generated node's `sla` and drop it.
   - `task`: `remind ??= 48`; `sla ??= 96`.
   - `dw` check: `flagDo ??= 'note'`; recompute `flagCont` = the `pass` out's `to` (seed `wf-access.CD.flagCont = "AP"` is stale).
   - `system`: if `sys` is missing or `sys.system !== system`, build it with engine §1.10 `ensureSys()`.
   - `cond`: `onMissing ??= 'ask'`; compute `mergeAt` with engine §16.2 `computeMergeAt()` (all seed Ifs have every path carrying on, so the result is exact).
   - `wait`: if `w` missing, build it from `until` (engine §1.8 `ensureWait()`).
8. **Remove unreachable nodes**: none exist in the seed; do not run garbage collection on load (keep data as-is), but lint reports them (engine §12).
9. **Records.** Records are used as-is. Do not convert `null` to `undefined` or vice versa.

---

## 16. Legacy fields in the seed — load but ignore

| File | Field | Why |
| --- | --- | --- |
| workflows.json | `tab` (`"workflows"`), `kind` (`"main"`) | Only one kind of thing exists: a workflow. |
| workflows.json nodes | `appr.prechecks` | Every approver gets the brief; checks are steps on the line. |
| workflows.json nodes | `collect.strength`, `collect.failFlow` (`"adverse"`) | Replaced by "every step holds the line" and `failRoles`. |
| workflows.json nodes | `system.actions`, `system.apps` | Superseded by `sys` (actions) / not shown. |
| workflows.json nodes | `dw.threshold`, `dw.flagCont` | Not used / recomputed. |
| workflows.json nodes | `plan.fit` | Not shown. |
| workflows.json nodes | `task.blocking`, `task.req`, any `req` | Every step holds the line. |
| workflows.json nodes | `wait.until` | Superseded by `w`. |
| workflows.json nodes | `cond.elseCont` | Recomputed. |
| any node (if present) | `cond.elseSla`, path `sla`, `dw.flagSla` | Removed: the generated escalation node's `sla` is the only timer (§15 step 7). |
| approval-rules.json | `tab`, `kind`, `scope`, `published` | Rules are managed outside Flow Studio. |
| catalog.json | `APPROVES`, `ELSE_OPTS`, `HOURS`, `APPROVAL_EVENTS`, `HOLDABLE` (contains legacy `runappr`), `FLAG_OPTS.approvals`, `K`/`DESC` entries `update`, `runappr`, `milestone`, `takeback` | Removed screens and steps (Update record, Request approval, Milestone, Take back, approval flows). In Test only Collect & verify, Task and System hold later steps (engine §10.5). |
| digital-workers.json | `DWS`; DW ids `brief`, `chaser`, `timesheet`, `offboard`, `milestone`, `distribution` | Not in any rail (Chaser is built into steps; brief is automatic). |
| people-and-authority.json | `CANDIDATES` | Used by the admin area (assigning someone to a paused approval), not Flow Studio. |
| sample-records.json | `other_assignments`, `reason`, `note` | Legacy Take back / display only. |
| sample-records.json | samples `OB-2251`, `ASN-915` | Their record+event has no workflow. |

Legacy concepts that must not be built (they appear in prototype code, not in seeds): approval flows (`tab:'approvals'`, `kind:'main'`), "Request approval" (`runappr`), shared approvals / approval library, drill-in breadcrumbs, field approvals (`kind:'field'`), milestones, Take back, Update record, the Settings page and its "Needs fixing" list, the Ask Nova bar.

---

## 17. Transient fields (UI state — never persist)

`_rolesSave`, `_person`, `_g`, `_c_approved`, `_c_rejected` (prototype helpers on nodes); Test state (`selected sample`, `edited`, `chosen proposal`), the open dropdown, the selected node, zoom.
