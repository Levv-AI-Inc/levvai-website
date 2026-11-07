import type { RoleKey } from './people';
import type { FlagDo } from './workflow';

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
export const DEFAULT_TITLE: Record<StepKind, string> = {
  trigger: 'Trigger',
  cond: 'Condition',
  plan: 'Within plan',
  policy: 'Policy approve',
  appr: 'Approval',
  notify: 'Notify',
  task: 'Task',
  dw: 'Digital Worker',
  wait: 'Wait',
  parallel: 'Parallel',
  runwf: 'Run workflow',
  end: 'End',
  collect: 'Collect & verify',
  system: 'System',
};

export interface Catalog {
  RECORDS: RecordLabels;
  EVENTS: EventLabels;
  EVENTS_FOR: EventsFor;
  SOURCES: SourceLabels;
  FIELDS: FieldDef[];
  /** FIELDS indexed by id. Derived on load (§15 step 1); not in the seed file. */
  FIELD: Record<string, FieldDef>;
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
