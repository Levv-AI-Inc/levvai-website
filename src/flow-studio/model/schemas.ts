import { z } from 'zod';
import type {
  EventKey,
  FieldGroup,
  FieldType,
  MaterialKey,
  Operator,
  RecordKey,
  ScopeDimKey,
  SourceKey,
  StepKind,
  WaitDateKey,
  WaitUnit,
} from './catalog';
import type { Catalog } from './catalog';
import type { Group, Row } from './condition';
import type { PresetKey, PrereqKey, DigitalWorkers, Presets, Systems } from './helpers';
import type { PeopleAuthority } from './people';
import type { HistoryRecord, SampleRecord } from './records';
import type { Permission, TestActors } from './runtime';
import type { ApprovalRule } from './rules';
import type {
  ApproveNode,
  CondNode,
  Out,
  PublishedSnapshot,
  SysAction,
  SystemNode,
  WaitNode,
  WfNode,
  Workflow,
  WorkflowVersion,
} from './workflow';

/*
 * Zod schemas for every seed file (02 §1). They describe the files as stored: fields that 02 §15 fills on load are
 * optional here. Every object passes unknown keys through, because legacy fields are "load but ignore" (02 §16) and
 * records are open-ended (02 §11). Use parseSeedFile to validate: it returns the input, never Zod's output, because
 * Zod rebuilds objects in schema order and the engine depends on stored key order (03 §1.4, §12).
 */

const RECORD_KEYS = [
  'job_posting', 'work_order', 'sow', 'onboarding', 'assignment', 'offboarding',
  'access_request', 'timesheet', 'expense', 'invoice', 'worker',
] as const satisfies readonly RecordKey[];
const EVENT_KEYS = [
  'submitted', 'changed', 'change_order', 'approved', 'end_30', 'ended_early', 'milestone', 'received',
  'doc_expiring', 'check_failed', 'rejected', 'cancelled', 'accepted', 'confirmed', 'started', 'extended',
  'closed', 'paid', 'doc_expired', 'created', 'filled', 'ob_start', 'ob_cleared', 'ob_done',
  'off_start', 'off_done',
] as const satisfies readonly EventKey[];
const SOURCE_KEYS = ['levv', 'fieldglass', 'workday', 's4', 'zip', 'servicenow'] as const satisfies readonly SourceKey[];
const FIELD_TYPES = ['money', 'num', 'pct', 'enum', 'bool', 'list', 'text'] as const satisfies readonly FieldType[];
const FIELD_GROUPS = ['Record', 'Related records', 'Levv-calculated', 'Custom fields'] as const satisfies readonly FieldGroup[];
const OPERATORS = ['>=', '>', '<', '<=', 'in', 'not_in', 'yes', 'no', 'includes', 'is', 'contains'] as const satisfies readonly Operator[];
const SCOPE_DIM_KEYS = [
  'business_unit', 'cost_center', 'legal_entity', 'country', 'site', 'worker_type', 'job_family',
] as const satisfies readonly ScopeDimKey[];
const MATERIAL_KEYS = ['total_value', 'end_date', 'bill_rate', 'cost_center', 'scope', 'data_access', 'supplier'] as const satisfies readonly MaterialKey[];
const WAIT_DATE_KEYS = ['start_date', 'end_date', 'wo_approved_at', 'last_day'] as const satisfies readonly WaitDateKey[];
const WAIT_UNIT_KEYS = ['hours', 'days', 'business_days', 'weeks'] as const satisfies readonly WaitUnit[];
const STEP_KINDS = [
  'trigger', 'cond', 'appr', 'policy', 'plan', 'dw', 'collect', 'task', 'system', 'notify', 'wait', 'parallel', 'runwf', 'end',
] as const satisfies readonly StepKind[];
const SYS_ACTIONS = ['create', 'update', 'read', 'wait', 'close', 'check'] as const satisfies readonly SysAction[];
const PRESET_KEYS = [
  'idrtw', 'bgcheck', 'docs', 'training', 'hris', 'access', 'equip', 'pay',
  'revoke', 'recover', 'finalts', 'handover', 'exitconf', 'hrclose', 'wclose', 'ledger',
] as const satisfies readonly PresetKey[];
const PREREQ_KEYS = [
  'none', 'jp_approved', 'wo_approved', 'wo_accepted', 'cleared', 'ob_done', 'active', 'sow_approved', 'ts_approved',
] as const satisfies readonly PrereqKey[];
const PERMISSIONS = ['flow.edit', 'flow.approve_changes', 'runs.view', 'runs.control', 'reference.import', 'admin'] as const satisfies readonly Permission[];

const obj = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();

/** An object with exactly-known keys, all holding the same kind of value. Extra keys pass through. */
function keyed<K extends string, V extends z.ZodTypeAny>(keys: readonly K[], value: V) {
  const shape = {} as Record<K, V>;
  for (const key of keys) shape[key] = value;
  return obj(shape);
}

const str = z.string();
const num = z.number();
const bool = z.boolean();
const isoDate = str.regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');
const strList = z.array(str);
const strPair = z.tuple([str, str]);
const about = { _about: str.optional() };

const recordKey = z.enum(RECORD_KEYS);
const eventKey = z.enum(EVENT_KEYS);
const sourceKey = z.enum(SOURCE_KEYS);
const stepKind = z.enum(STEP_KINDS);
const disposition = z.enum(['remove', 'return', 'retain']);
const reverseWhen = z.enum(['before', 'after']);
const channel = z.enum(['Email', 'Teams', 'Slack', 'In-app']);
const provider = z.enum(['worker', 'sponsor', 'supplier_am', 'hm', 'it']);
const presetKey = z.enum(PRESET_KEYS);
const permission = z.enum(PERMISSIONS);
const join = z.enum(['all', 'any']);

// ─── Conditions (02 §3) ─────────────────────────────────────────────────────

export const RowSchema = obj({
  f: str,
  op: z.enum(OPERATORS),
  v: z.union([num, str, strList, z.null()]).optional(),
});

export const GroupSchema = z.lazy(() => obj({ join, rows: z.array(rowOrGroup) })) as unknown as z.ZodType<Group, z.ZodTypeDef, unknown>;

const rowOrGroup = z.lazy(() => z.union([GroupSchema, RowSchema])) as unknown as z.ZodType<Row | Group, z.ZodTypeDef, unknown>;

export const ConditionSchema = obj({ join, rows: z.array(rowOrGroup) });

// ─── Nodes (02 §5) ──────────────────────────────────────────────────────────

const OutSchema = obj({ key: str, to: str, label: str.optional() });
const oneOut = z.tuple([OutSchema]);
const pathThen = z.enum(['continue', 'approve', 'escalate', 'reject', 'stop', 'custom']);
const roleKey = str;

const base = { id: str, label: str, outs: z.array(OutSchema) };

const TriggerNodeSchema = obj({ ...base, kind: z.literal('trigger'), label: z.literal(''), outs: oneOut });

const CondPathSchema = obj({
  key: str.refine((k) => k !== 'else'),
  to: str,
  label: str,
  join,
  rows: z.array(rowOrGroup),
  do: pathThen.optional(),
  node: str.nullable().optional(),
  who: roleKey.optional(),
});
const CondElseSchema = obj({ key: z.literal('else'), to: str, label: str });

const CondNodeSchema = obj({
  ...base,
  kind: z.literal('cond'),
  outs: z
    .array(z.union([CondElseSchema, CondPathSchema]))
    .refine(
      (outs) => outs.length >= 2 && outs.every((o, i) => (o.key === 'else') === (i === outs.length - 1)),
      'An If needs at least one path, then Otherwise last',
    )
    .transform((outs) => outs as unknown as CondNode['outs']),
  elseDo: pathThen.optional(),
  elseNode: str.nullable().optional(),
  elseWho: roleKey.optional(),
  elseCont: str.optional(),
  onMissing: z.enum(['ask', 'cautious', 'otherwise']).optional(),
  mergeAt: str.optional(),
});

const ApproveNodeSchema = obj({
  ...base,
  kind: z.literal('appr'),
  roles: z.array(roleKey).refine((roles) => !roles.includes('worker'), 'The worker never approves'),
  who: z.enum(['roles', 'group', 'person']).optional(),
  backup: str.optional(),
  mode: z.enum(['all', 'any', 'order']).optional(),
  remind: num.optional(),
  sla: num.optional(),
  when: ConditionSchema.optional(),
  whenPrompt: str.optional(),
  reject: z.enum(['requester', 'previous', 'end']).optional(),
  authority: bool.optional(),
  material: z.array(z.enum(MATERIAL_KEYS)).optional(),
  reaskOnDecrease: bool.optional(),
  escalation: bool.optional(),
  failOf: str.optional(),
});

const PolicyNodeSchema = obj({
  ...base,
  kind: z.literal('policy'),
  receipt: str,
  fyi: roleKey.optional(),
  outs: oneOut,
});

const PlanNodeSchema = obj({
  ...base,
  kind: z.literal('plan'),
  plan: str,
  outs: z.tuple([
    obj({ key: z.literal('in'), to: str, label: z.literal('Inside plan') }),
    obj({ key: z.literal('out'), to: str, label: z.literal('Outside plan') }),
  ]),
});

const DwNodeSchema = obj({
  ...base,
  kind: z.literal('dw'),
  worker: str,
  flagDo: z.enum(['note', 'escalate', 'reject', 'stop']).optional(),
  flagWho: roleKey.optional(),
  flagNode: str.nullable().optional(),
  fallback: roleKey.optional(),
});

const CollectNodeSchema = obj({
  ...base,
  kind: z.literal('collect'),
  from: provider.optional(),
  items: strList,
  verify: z.enum(['auto', 'auto_person', 'person']),
  checker: str,
  reviewer: roleKey,
  failTo: z.enum(['role', 'approval']),
  failRole: roleKey,
  failNode: str.optional(),
  failRoles: z.array(roleKey).optional(),
  failMode: join.optional(),
  remind: num.optional(),
  sla: num.optional(),
  gives: str,
  disp: disposition.optional(),
  reverse: str,
  reverseWhen,
  reverseBy: roleKey,
  preset: presetKey.optional(),
  pkg: z.enum(['std', 'fs', 'enh']).optional(),
  fsAuto: bool.optional(),
  revisit: bool.optional(),
  signer: z.enum(['worker', 'supplier', 'both']).optional(),
  due: z.enum(['start', 'week']).optional(),
  kit: strList.optional(),
  ship: z.enum(['home', 'office']).optional(),
});

const TaskNodeSchema = obj({
  ...base,
  kind: z.literal('task'),
  role: roleKey,
  title: str,
  remind: num.optional(),
  sla: num.optional(),
  preset: presetKey.optional(),
  method: z.enum(['courier', 'dropoff']).optional(),
  chaseDays: num.optional(),
  gives: str.optional(),
  disp: disposition.optional(),
  reverse: str.optional(),
  reverseBy: roleKey.optional(),
  kit: strList.optional(),
});

const SystemConfigSchema = obj({
  system: str,
  action: z.enum(SYS_ACTIONS),
  object: str,
  match: str,
  map: z.array(strPair),
  read: strList,
  wait: z.enum(['confirm', 'none']),
  waitH: num,
  state: z.enum(['Created', 'Updated', 'Approved', 'Completed', 'Closed']),
  onFail: z.enum(['task', 'path', 'pause']),
  failRole: roleKey,
  retries: num,
  check: bool,
});

const SystemNodeSchema = obj({
  ...base,
  kind: z.literal('system'),
  system: str,
  sys: SystemConfigSchema.optional(),
  via: str,
  gives: str,
  disp: disposition.optional(),
  reverse: str,
  reverseWhen,
  reverseBy: roleKey,
  preset: presetKey.optional(),
  when: z.enum(['last', 'now']).optional(),
});

const NotifyNodeSchema = obj({
  ...base,
  kind: z.literal('notify'),
  recipients: z.array(roleKey),
  channel,
  outs: oneOut,
});

const WaitConfigSchema = obj({
  mode: z.enum(['for', 'date', 'at']),
  amount: num.optional(),
  unit: z.enum(WAIT_UNIT_KEYS).optional(),
  dir: z.enum(['before', 'after']).optional(),
  field: z.enum(WAIT_DATE_KEYS).optional(),
  time: str.optional(),
  tz: z.enum(['worker', 'company']).optional(),
  at: str.optional(),
});

const WaitNodeSchema = obj({
  ...base,
  kind: z.literal('wait'),
  w: WaitConfigSchema.optional(),
  until: str.optional(),
});

const ParallelNodeSchema = obj({
  ...base,
  kind: z.literal('parallel'),
  outs: z.array(obj({ key: str, to: str, label: str })),
});

const RunWorkflowNodeSchema = obj({ ...base, kind: z.literal('runwf'), target: str, outs: oneOut });

const EndNodeSchema = obj({
  ...base,
  kind: z.literal('end'),
  outcome: z.enum(['completed', 'approved', 'rejected', 'cancelled', 'stopped']),
  outs: z.tuple([]),
});

export const WfNodeSchema = z.discriminatedUnion('kind', [
  TriggerNodeSchema,
  CondNodeSchema,
  ApproveNodeSchema,
  PolicyNodeSchema,
  PlanNodeSchema,
  DwNodeSchema,
  CollectNodeSchema,
  TaskNodeSchema,
  SystemNodeSchema,
  NotifyNodeSchema,
  WaitNodeSchema,
  ParallelNodeSchema,
  RunWorkflowNodeSchema,
  EndNodeSchema,
]);

/** A node as stored in a seed file: the fields 02 §15 step 7 fills on load may be absent. */
export type SeedNode =
  | Exclude<WfNode, ApproveNode | SystemNode | WaitNode>
  | (Omit<ApproveNode, 'mode' | 'sla' | 'reject' | 'authority' | 'material' | 'reaskOnDecrease'> &
      Partial<Pick<ApproveNode, 'mode' | 'sla' | 'reject' | 'authority' | 'material' | 'reaskOnDecrease'>>)
  | (Omit<SystemNode, 'sys'> & Partial<Pick<SystemNode, 'sys'>>)
  | (Omit<WaitNode, 'w'> & Partial<Pick<WaitNode, 'w'>> & { until?: string });

// ─── Workflow (02 §4) ───────────────────────────────────────────────────────

/** z.record keeps the stored key order that the engine prints scope in (03 §1.4). */
const ScopeSchema = z.record(z.enum(SCOPE_DIM_KEYS), strList);

const GraphShape = z.record(str, WfNodeSchema).superRefine((nodes, ctx) => {
  if (nodes.T?.kind !== 'trigger') ctx.addIssue({ code: 'custom', message: 'A graph needs a trigger node T' });
  if (nodes.END?.kind !== 'end') ctx.addIssue({ code: 'custom', message: 'A graph needs an end node END' });
  for (const [id, node] of Object.entries(nodes)) {
    if (node.id !== id) ctx.addIssue({ code: 'custom', path: [id, 'id'], message: `Node stored under ${id} has id ${node.id}` });
    for (const out of node.outs as Out[]) {
      if (!nodes[out.to]) ctx.addIssue({ code: 'custom', path: [id, 'outs'], message: `Exit ${out.key} points at missing node ${out.to}` });
    }
  }
});

const OnRejectSchema = obj({ recipients: z.array(roleKey), resubmitDays: num.optional() });

const WorkflowVersionSchema = obj({
  version: num,
  nodes: GraphShape,
  scope: ScopeSchema,
  name: str,
  effective: isoDate,
  publishedAt: str.optional(),
  submittedBy: str.optional(),
  approvedBy: str.optional(),
});

export const WorkflowSchema = obj({
  id: str,
  name: str,
  records: z.array(recordKey).length(1),
  event: eventKey,
  scope: ScopeSchema,
  status: z.enum(['draft', 'live', 'inactive']),
  version: z.number().int().nonnegative(),
  effective: isoDate,
  owner: str,
  priority: num.nullable(),
  source: sourceKey.optional(),
  days: num.optional(),
  basis: z.enum(['total', 'change', 'running']).optional(),
  onReject: OnRejectSchema.optional(),
  draft: obj({ nodes: GraphShape }),
  published: obj({ nodes: GraphShape, scope: ScopeSchema, name: str }).nullable(),
  versions: z.array(WorkflowVersionSchema).optional(),
  pending: obj({
    submittedBy: str,
    submittedAt: str,
    effective: isoDate,
    precedence: z.array(obj({ otherId: str, winner: z.enum(['self', 'other']) })).optional(),
  })
    .nullable()
    .optional(),
  desc: str.optional(),
}).refine((w) => (w.status === 'draft') === (w.published === null), {
  message: 'A draft is exactly a workflow that was never published',
  path: ['published'],
});

/** A workflow as stored in a seed file. */
export type SeedWorkflow = Omit<Workflow, 'draft' | 'published' | 'versions'> & {
  draft: { nodes: Record<string, SeedNode> };
  published: (Omit<PublishedSnapshot, 'nodes'> & { nodes: Record<string, SeedNode> }) | null;
  versions?: (Omit<WorkflowVersion, 'nodes'> & { nodes: Record<string, SeedNode> })[];
};

// ─── Approval rules (02 §6) ─────────────────────────────────────────────────

export const ApprovalRuleSchema = obj({
  id: str,
  name: str,
  records: z.array(recordKey),
  event: eventKey,
  when: ConditionSchema,
  status: z.enum(['live', 'draft', 'inactive']),
  version: num,
  effective: isoDate,
  owner: str,
  act: obj({
    approve: bool,
    roles: z.array(roleKey),
    mode: join,
    position: z.enum(['first', 'with', 'last']),
    task: bool,
    taskRole: roleKey,
    taskTitle: str,
    flag: bool,
    flagField: str,
  }),
  published: z.unknown().optional(),
});

// ─── Catalog (02 §2) ────────────────────────────────────────────────────────

const FieldDefSchema = obj({
  id: str,
  l: str,
  g: z.enum(FIELD_GROUPS),
  t: z.enum(FIELD_TYPES),
  o: strList.optional(),
  risk: z.literal(true).optional(),
  owner: roleKey.optional(),
});

const scopeDimList = z.array(z.tuple([z.enum(SCOPE_DIM_KEYS), str]));

const CatalogFileSchema = obj({
  ...about,
  RECORDS: keyed(RECORD_KEYS, str),
  EVENTS: keyed(EVENT_KEYS, str),
  EVENTS_FOR: keyed(RECORD_KEYS, z.array(eventKey)),
  SOURCES: keyed(SOURCE_KEYS, str),
  FIELDS: z.array(FieldDefSchema),
  FGROUPS: z.array(z.enum(FIELD_GROUPS)),
  OPS: keyed(FIELD_TYPES, z.array(z.enum(OPERATORS))),
  OPL: keyed(OPERATORS, str),
  SCOPE_DIMS: scopeDimList,
  SCOPE_MORE: scopeDimList,
  K: keyed(STEP_KINDS, str),
  DESC: z.record(str, str),
  FLAG_OPTS: obj({ workflows: z.array(z.tuple([z.enum(['note', 'escalate', 'reject', 'stop']), str])) }),
  WAIT_DATES: keyed(WAIT_DATE_KEYS, str),
  WAIT_UNITS: keyed(WAIT_UNIT_KEYS, str),
  MATERIAL: keyed(MATERIAL_KEYS, str),
  DAY_EVENTS: z.array(eventKey),
  LEVV_F: strList,
  REQ_COMMON: strList,
  ADD: obj({ workflows: z.array(z.tuple([str, z.array(stepKind)])) }),
});

/** catalog.json as stored: everything in Catalog except the derived FIELD index. */
export type SeedCatalog = Omit<Catalog, 'FIELD'> & { FIELD?: Catalog['FIELD'] };

// ─── People and authority (02 §7) ───────────────────────────────────────────

const PeopleFileSchema = obj({
  ...about,
  ROLES: z.record(
    str,
    obj({
      n: str,
      c: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      actor: z.literal(true).optional(),
      grp: z.literal(true).optional(),
      person: z.literal(true).optional(),
    }),
  ),
  PEOPLE: strList,
  TITLES: z.record(str, str),
  ORG: z.record(str, obj({ hm: str, hm_mgr: str, cco: str, dh: str })),
  ORGX: obj({
    LE: z.record(str, str),
    LE_SHORT: z.record(str, str),
    CC: z.record(str, str),
    CC_OF: z.record(str, strList),
    SITE: z.record(str, str),
    WT: z.record(str, str),
  }),
  MGR: z.record(str, str),
  LIMIT: z.record(str, num.nullable()),
  CENTRAL: z.record(str, str),
  BACKUP: z.record(str, str),
  OOO: z.record(str, obj({ until: str, to: str, from: isoDate.optional() })),
  DELEG_OK: z.record(str, z.array(roleKey)),
  GROUPS: z.record(str, obj({ n: str, members: strList, mode: join })),
  BY_COUNTRY: z.record(str, z.record(str, str.nullable())),
  CANDIDATES: z.record(str, strList),
  ALIAS: z.array(z.tuple([roleKey, strList])),
  FLAT: z.array(strPair),
  CLASS_N: keyed(['1', '2', '3', '4'] as const, str),
  ACTOR_ONLY: z.array(roleKey),
  NOAPPR: z.array(roleKey),
  PROVIDERS: z.array(provider),
});

/** people-and-authority.json as stored: LIMIT null means unlimited until §15 step 3 runs. */
export type SeedPeople = Omit<PeopleAuthority, 'LIMIT'> & { LIMIT: Record<string, number | null> };

// ─── Digital Workers, presets, systems (02 §8–§10) ──────────────────────────

const DigitalWorkersFileSchema = obj({
  ...about,
  DW: z.record(str, obj({ id: str, n: str, s: z.enum(['ready', 'setup', 'off']), p: str })),
  DWD: z.record(str, str),
  DWX: z.record(str, obj({ d: str, u: str })),
  DW_SET: obj({ workflows: strList, onboarding: strList, offboarding: strList, access: strList }),
  CHECK_DW: strList,
});

const PresetsFileSchema = obj({
  ...about,
  PRESETS: keyed(
    PRESET_KEYS,
    obj({ ph: z.enum(['on', 'off']), n: str, d: str, kind: z.enum(['collect', 'system', 'task']), p: z.record(str, z.unknown()) }),
  ),
  PRE_STATES: keyed(PREREQ_KEYS, str),
  PRE_SHORT: keyed(PREREQ_KEYS, str),
  RTW: z.record(str, str),
  BGPKG: keyed(['std', 'fs', 'enh'] as const, str),
  CHECKERS: z.record(str, str),
});

const SystemsFileSchema = obj({
  ...about,
  SYS: z.record(str, obj({ st: z.enum(['ok', 'off']), seen: str, obj: strList, back: strList })),
  SYS_ACT: keyed(SYS_ACTIONS, str),
  SYS_KEY: z.record(str, strList),
  SYS_MAP: z.record(str, z.array(strPair)),
});

// ─── Records (02 §11) ───────────────────────────────────────────────────────

const proposal = obj({ by: str, v: str, total: num });
const outcomes = z.record(str, z.enum(['fail', 'unsure', 'done']));

const recordShape = {
  id: str,
  record: recordKey,
  event: eventKey,
  requester: str,
  hiring_manager: str.optional(),
  sponsor: str.optional(),
  sponsor_delegate: str.optional(),
  worker_name: str.optional(),
  cost_centers: strList.optional(),
  prev: z.record(str, z.unknown()).optional(),
  original_total: num.optional(),
  title: str.optional(),
  note: str.optional(),
  conflict: obj({ field: str, a: proposal, b: proposal }).optional(),
  edit: obj({ label: str, set: z.record(str, z.unknown()), decreased: strList }).optional(),
  decided: z.array(roleKey).optional(),
  outcomes: outcomes.optional(),
  outcomesL: outcomes.optional(),
};

export const HistoryRecordSchema = obj(recordShape);
export const SampleRecordSchema = obj({ ...recordShape, title: str });

const RuntimeRecordSchema = obj({
  ...recordShape,
  source: sourceKey,
  start_date: isoDate.optional(),
  end_date: isoDate.optional(),
  last_day: isoDate.optional(),
  personal_email: str.optional(),
  work_email: str.optional(),
  worker_tz: str.optional(),
  states: z.array(z.enum(PREREQ_KEYS)),
});

// ─── Files ──────────────────────────────────────────────────────────────────

const actorSet = obj({
  users: z.array(obj({ name: str, permissions: z.array(permission), note: str.optional() })),
  ownerTeams: z.record(str, strList),
});

/** Every seed file (02 §1, 06 §1.2), keyed by file name without ".json". */
export const SEED_FILE_SCHEMAS = {
  workflows: obj({ ...about, workflows: z.array(WorkflowSchema) }),
  'approval-rules': obj({ ...about, approvalRules: z.array(ApprovalRuleSchema) }),
  'people-and-authority': PeopleFileSchema,
  catalog: CatalogFileSchema,
  'digital-workers': DigitalWorkersFileSchema,
  'onboarding-presets': PresetsFileSchema,
  systems: SystemsFileSchema,
  'sample-records': obj({ ...about, samples: z.array(SampleRecordSchema) }),
  'history-records': obj({ ...about, history: z.array(HistoryRecordSchema) }),
  'runtime-records': obj({ ...about, records: z.array(RuntimeRecordSchema) }),
  'test-actors': obj({
    ...about,
    permissions: z.array(permission),
    actorSets: obj({ default: actorSet, 'author-only-approver': actorSet }),
  }),
} as const;

export type SeedFileName = keyof typeof SEED_FILE_SCHEMAS;

/** What each validated seed file holds. */
export interface SeedFileContents {
  workflows: { workflows: SeedWorkflow[] };
  'approval-rules': { approvalRules: ApprovalRule[] };
  'people-and-authority': SeedPeople;
  catalog: SeedCatalog;
  'digital-workers': DigitalWorkers;
  'onboarding-presets': Presets;
  systems: Systems;
  'sample-records': { samples: SampleRecord[] };
  'history-records': { history: HistoryRecord[] };
  'runtime-records': { records: (HistoryRecord & { source: SourceKey; states: PrereqKey[] })[] };
  'test-actors': TestActors;
}

export class SeedValidationError extends Error {
  constructor(
    readonly file: string,
    readonly issues: z.ZodIssue[],
  ) {
    const lines = issues.slice(0, 10).map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    super(`Seed file ${file} is not valid:\n${lines.join('\n')}`);
    this.name = 'SeedValidationError';
  }
}

/** Validates one file and returns a private deep copy of the data exactly as stored (see the note at the top). */
export function parseSeedFile<N extends SeedFileName>(file: N, raw: unknown): SeedFileContents[N] {
  const result = (SEED_FILE_SCHEMAS[file] as z.ZodTypeAny).safeParse(raw);
  if (!result.success) throw new SeedValidationError(file, result.error.issues);
  return structuredClone(raw) as SeedFileContents[N];
}
