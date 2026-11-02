import type { EventKey, MaterialKey, RecordKey, ScopeDimKey, SourceKey, StepKind, WaitDateKey, WaitUnit } from './catalog';
import type { Condition, Group, Row } from './condition';
import type { PresetKey } from './helpers';
import type { RoleKey } from './people';

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
  /* Additive. What a run or a real event reads, frozen when the second person approved. Drafts change the workflow's own fields, never these. */
  records?: RecordKey[];
  event?: EventKey;
  source?: SourceKey;
  owner?: string;
  basis?: 'total' | 'change' | 'running';
  days?: number;
  onReject?: Workflow['onReject'];
  priority?: number | null;
  submittedById?: string;  // the accounts behind submittedBy and approvedBy (decision 5)
  approvedById?: string;
}

/** Waiting-for-approval state after "Send for approval". */
export interface PendingPublish {
  submittedBy: string;     // the author, as the screen shows them
  submittedById?: string;  // the account that sent it: this, not the name above, is who can't approve it (decision 5)
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

/** The first box (⚡). Always id 'T', one out 'next'. Its panel holds the workflow settings (Workflow fields). */
export interface TriggerNode extends NodeBase {
  kind: 'trigger';
  label: '';
  outs: [Out];      // [{key:'next', to: firstStepId}]
}

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

/** Approves instantly when no one is asked anywhere on the path, and keeps a receipt for audit. */
export interface PolicyNode extends NodeBase {
  kind: 'policy';
  label: string;              // e.g. "Approve within plan". New: "Auto-approve".
  receipt: string;            // "Receipt", e.g. "Approved automatically: fits the approved plan". New: "Approved automatically".
  fyi?: RoleKey | '';         // "Let someone know" (role key, or '' = "No one"). New: ''.
  outs: [Out];                // 'next'
}

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

export interface NotifyNode extends NodeBase {
  kind: 'notify';
  label: string;              // e.g. "Tell the supplier". New: "Notify".
  recipients: RoleKey[];      // "Who" (any role incl. worker, sponsor, groups). [] = lint warning. New: ['cco'].
  channel: 'Email' | 'Teams' | 'Slack' | 'In-app'; // "How". Default 'Email'.
  outs: [Out];
}

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
