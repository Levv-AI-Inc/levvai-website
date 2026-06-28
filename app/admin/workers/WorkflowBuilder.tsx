'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Fragment,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Cog,
  GripVertical,
  Info,
  Plug,
  Plus,
  Shield,
  Search,
  RotateCcw,
  Workflow as WorkflowIcon,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  HUMAN_APPROVERS,
  resolvePeople,
  roleLabel,
  type ApproverGroup,
} from './requirements/requirementsStore'
import {
  createComplianceWorkflow,
  getComplianceWorkflow,
  getComplianceWorkflowLookups,
  updateComplianceWorkflow,
  type BlockType,
  type CreateWorkflowPayload,
  type GateType,
  type IntegrationType,
  type Option,
  type PolicyScope,
  type PolicyScopeField,
  type RequirementOwner,
  type ScopeFieldKey,
  type Workflow,
  type WorkflowBlock,
  type WorkflowBlockRequirement,
  type WorkflowHealth,
  type WorkflowLookups,
  type WorkflowType as ApiWorkflowType,
} from '@/lib/api/complianceWorkflows'
import { getLocations, type LocationRecord } from '@/lib/api/locations'

type WorkflowTypeLabel = 'Onboarding' | 'Offboarding'
type WorkerType = PolicyScope['worker_type']
type BuilderMode = 'onboarding' | 'offboarding'
type BuilderView = 'build' | 'process'
type CompletionRule = 'ALL' | 'ANY' | 'N_OF'
type SystemIntegrationKey = 'WORKDAY' | 'SERVICENOW' | 'SAP_FG' | 'ORACLE'

type SystemUnwind = {
  action: string
  mode: 'automated' | 'manual'
  reconcile?: boolean
}

type Requirement = {
  id: string
  name: string
  owner: RequirementOwner
}

type LibraryBlock = {
  id: string
  name: string
  type: BlockType
  gate: GateType
  requirements: Requirement[]
  integrationType?: IntegrationType | ''
  config?: Record<string, unknown>
  accountableOwner?: ApproverGroup
  completionRule?: CompletionRule
  completionN?: number
  push?: boolean
  pull?: boolean
  reads?: string[]
  writes?: string[]
  reconcile?: boolean
  systemIntegration?: SystemIntegrationKey
  systemUnwind?: SystemUnwind
}

type PipelineBlock = LibraryBlock & {
  pipelineId: string
  order: number
}

type BuilderScopeField = {
  id: string
  fieldKey: ScopeFieldKey
  label: string
  display: string
  valueId: number
}

type ScopeState = {
  name: string
  workerType: WorkerType
  isActive: boolean
}

const REQUIREMENTS: Requirement[] = [
  { id: 'gov-id', name: 'Government ID Photo Check', owner: 'worker' },
  { id: 'bg-check', name: 'Background Screening', owner: 'worker' },
  { id: 'nda-sign', name: 'Non-Disclosure Agreement', owner: 'worker' },
]

const DEFAULT_LIBRARY_BLOCKS: LibraryBlock[] = [
  {
    id: 'identity-eligibility',
    name: 'Identity & Eligibility',
    type: 'requirement',
    gate: 'hard',
    accountableOwner: 'HR',
    completionRule: 'ALL',
    requirements: [
      { id: 'photo-id', name: 'Photo ID', owner: 'worker' },
      { id: 'rtw', name: 'Right to Work (I-9 / Visa)', owner: 'worker' },
    ],
  },
  {
    id: 'legal-compliance',
    name: 'Legal & Compliance',
    type: 'requirement',
    gate: 'hard',
    accountableOwner: 'LEGAL',
    completionRule: 'ALL',
    requirements: [
      { id: 'nda', name: 'Non-Disclosure Agreement', owner: 'worker' },
      { id: 'bg-check', name: 'Background Screening', owner: 'worker' },
    ],
  },
  {
    id: 'vendor-insurance',
    name: 'Vendor Insurance',
    type: 'requirement',
    gate: 'soft',
    accountableOwner: 'PROCUREMENT',
    completionRule: 'ALL',
    requirements: [
      { id: 'coi', name: 'Certificate of Insurance (COI)', owner: 'supplier' },
    ],
  },
  {
    id: 'workday-provisioning',
    name: 'Workday Provisioning',
    type: 'system',
    gate: 'hard',
    requirements: [],
    integrationType: 'api_call',
    systemIntegration: 'WORKDAY',
    push: true,
    pull: true,
    reads: defaultReads(),
    writes: defaultWrites(),
    reconcile: true,
    systemUnwind: {
      action: 'Deactivate worker record',
      mode: 'automated',
      reconcile: true,
    },
    config: {
      endpoint_key: 'workday_provisioning',
    },
  },
]

const FALLBACK_WORKER_TYPE_OPTIONS: Option[] = [
  { value: 'contingent', label: 'Contingent' },
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
]

const FALLBACK_SCOPE_FIELD_OPTIONS: Option[] = [
  { value: 'location', label: 'Location' },
  { value: 'cost_center', label: 'Cost Center' },
  { value: 'business_unit', label: 'Business Unit' },
  { value: 'role', label: 'Role' },
  { value: 'supplier', label: 'Supplier' },
]

const FALLBACK_OWNER_OPTIONS: Option[] = [
  { value: 'worker', label: 'Worker' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'it', label: 'IT' },
  { value: 'system', label: 'System' },
]

const FALLBACK_INTEGRATION_OPTIONS: Option[] = [
  { value: 'api_call', label: 'API Call' },
]

function workflowTypeToApi(workflowType: WorkflowTypeLabel): ApiWorkflowType {
  return workflowType === 'Onboarding' ? 'onboarding' : 'offboarding'
}

function workflowListHref(workflowType: WorkflowTypeLabel) {
  return `/admin/workers/${workflowTypeToApi(workflowType)}`
}

function randomId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isScopeFieldKey(value: string): value is ScopeFieldKey {
  return (
    value === 'location' ||
    value === 'cost_center' ||
    value === 'business_unit' ||
    value === 'role' ||
    value === 'supplier'
  )
}

function isRequirementOwner(value: string): value is RequirementOwner {
  return (
    value === 'worker' ||
    value === 'supplier' ||
    value === 'hiring_manager' ||
    value === 'it' ||
    value === 'system'
  )
}

function isWorkerType(value: string): value is WorkerType {
  return value === 'contingent' || value === 'employee' || value === 'contractor'
}

function isIntegrationType(value: string): value is IntegrationType {
  return value === 'api_call'
}

function fieldKeyLabel(fieldKey: ScopeFieldKey) {
  return (
    FALLBACK_SCOPE_FIELD_OPTIONS.find((option) => option.value === fieldKey)
      ?.label ?? fieldKey
  )
}

function ownerLabel(owner: RequirementOwner) {
  return (
    FALLBACK_OWNER_OPTIONS.find((option) => option.value === owner)?.label ??
    owner
  )
}

function workerTypeLabel(workerType: WorkerType) {
  return (
    FALLBACK_WORKER_TYPE_OPTIONS.find((option) => option.value === workerType)
      ?.label ?? workerType
  )
}

function ownerClass(owner: RequirementOwner) {
  switch (owner) {
    case 'worker':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'supplier':
      return 'border-green-200 bg-green-50 text-green-700'
    case 'hiring_manager':
      return 'border-purple-200 bg-purple-50 text-purple-700'
    case 'it':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'system':
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

const AVATAR_COLORS = [
  '#0e7490',
  '#7c3aed',
  '#be185d',
  '#b45309',
  '#15803d',
  '#1d4ed8',
  '#9333ea',
  '#0891b2',
]

function labelInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function avatarColor(label: string) {
  let hash = 0
  for (const character of label) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function uniqueRequirementOwners(requirements: Requirement[]) {
  return Array.from(
    new Set(requirements.map((requirement) => ownerLabel(requirement.owner))),
  )
}

function AvatarStack({ labels, max = 2 }: { labels: string[]; max?: number }) {
  const shown = labels.slice(0, max)

  return (
    <span className="bx-ava-stack">
      {shown.map((label) => (
        <span
          key={label}
          className="bx-ava"
          title={label}
          style={{ background: avatarColor(label) }}
        >
          {labelInitials(label)}
        </span>
      ))}
      {labels.length > max && (
        <span className="bx-ava bx-ava-more">+{labels.length - max}</span>
      )}
    </span>
  )
}

const LEVV_FIELDS = [
  'Legal name',
  'Work email',
  'Start date',
  'End date',
  'Worker type',
  'Job title',
  'Manager',
  'Cost center',
  'Work location',
  'SOW ID',
  'Supplier',
]

const RETURN_FIELDS = ['Account ID', 'Status', 'External ID', 'Created date']

const INTEGRATIONS: {
  key: SystemIntegrationKey
  label: string
  blurb: string
  push: boolean
  pull: boolean
  reverseAction?: string
}[] = [
  {
    key: 'WORKDAY',
    label: 'Workday',
    blurb: 'HR record & system access',
    push: true,
    pull: true,
    reverseAction: 'Deactivate worker record',
  },
  {
    key: 'SERVICENOW',
    label: 'ServiceNow',
    blurb: 'Laptop / asset request',
    push: true,
    pull: true,
    reverseAction: 'Open asset return ticket',
  },
  {
    key: 'SAP_FG',
    label: 'SAP Fieldglass',
    blurb: 'Contingent worker record',
    push: true,
    pull: true,
    reverseAction: 'Close worker assignment',
  },
  {
    key: 'ORACLE',
    label: 'Oracle',
    blurb: 'HCM / ERP record',
    push: true,
    pull: true,
    reverseAction: 'Deactivate HCM record',
  },
]

function integrationMeta(key?: SystemIntegrationKey) {
  return INTEGRATIONS.find((integration) => integration.key === key)
}

function defaultReads() {
  return ['Legal name', 'Work email', 'Start date', 'Manager']
}

function defaultWrites() {
  return ['Account ID', 'Status']
}

function systemReversalFor(
  meta: ReturnType<typeof integrationMeta>,
  push: boolean,
): SystemUnwind | undefined {
  if (!push || !meta?.reverseAction) return undefined
  return {
    action: meta.reverseAction,
    mode: 'automated',
    reconcile: true,
  }
}

function completionLabel(
  rule: CompletionRule,
  n: number | undefined,
  requiredTotal: number,
) {
  if (rule === 'ANY') return 'ANY one'
  if (rule === 'N_OF') return `${n ?? 1} of ${requiredTotal}`
  return null
}

function suggestedAccountable(requirements: Requirement[]): ApproverGroup {
  const counts: Partial<Record<ApproverGroup, number>> = {}
  for (const requirement of requirements) {
    switch (requirement.owner) {
      case 'it':
        counts.IT = (counts.IT ?? 0) + 1
        break
      case 'supplier':
        counts.PROCUREMENT = (counts.PROCUREMENT ?? 0) + 1
        break
      case 'hiring_manager':
        counts.HR = (counts.HR ?? 0) + 1
        break
      case 'worker':
        counts.HR = (counts.HR ?? 0) + 1
        break
      case 'system':
        counts.IT = (counts.IT ?? 0) + 1
        break
    }
  }

  const top = (Object.entries(counts) as [ApproverGroup, number][])
    .sort((a, b) => b[1] - a[1])[0]
  return top?.[0] ?? 'HR'
}

function roleInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function roleAvatarColor(name: string) {
  let hash = 0
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function PeopleStack({ names, max = 2 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max)
  return (
    <span className="bx-ava-stack">
      {shown.map((name) => (
        <span
          key={name}
          className="bx-ava"
          title={name}
          style={{ background: roleAvatarColor(name) }}
        >
          {roleInitials(name)}
        </span>
      ))}
      {names.length > max && (
        <span className="bx-ava bx-ava-more">+{names.length - max}</span>
      )}
    </span>
  )
}

function AccountableField({
  value,
  onChange,
}: {
  value: ApproverGroup
  onChange: (group: ApproverGroup) => void
}) {
  const [open, setOpen] = useState(false)
  const people = resolvePeople(value)

  return (
    <div className="acctf">
      <button
        type="button"
        className="acctf-trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <PeopleStack names={people.map((person) => person.name)} max={3} />
        <span className="acctf-role">{roleLabel(value)}</span>
        <span className="acctf-names">
          {people.map((person) => person.name).join(', ')}
        </span>
        <ChevronLeft
          className={
            open
              ? 'ml-auto h-3 w-3 shrink-0 rotate-90 text-slate-400'
              : 'ml-auto h-3 w-3 shrink-0 -rotate-90 text-slate-400'
          }
        />
      </button>
      {open && (
        <div className="acctf-panel">
          <div className="acctf-cap">Who is accountable?</div>
          {HUMAN_APPROVERS.map((group) => {
            const groupPeople = resolvePeople(group)
            return (
              <button
                key={group}
                type="button"
                className={`acctf-opt ${group === value ? 'on' : ''}`}
                onClick={() => {
                  onChange(group)
                  setOpen(false)
                }}
              >
                <PeopleStack
                  names={groupPeople.map((person) => person.name)}
                  max={3}
                />
                <span className="acctf-opt-main">
                  <span className="acctf-opt-role">{roleLabel(group)}</span>
                  <span className="acctf-opt-people">
                    {groupPeople.map((person) => person.name).join(', ')}
                  </span>
                </span>
                {group === value && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-cyan-600" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function gateClass(gate: GateType) {
  return gate === 'hard'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'
}

function gateLabel(gate: GateType) {
  return gate === 'hard' ? 'Hard Gate' : 'Soft Gate'
}

function optionLabel(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}

function getValidOptions<T extends string>(
  options: Option[] | undefined,
  fallback: Option[],
  isValid: (value: string) => value is T,
) {
  const source = options?.length ? options : fallback
  return source.filter((option): option is Option & { value: T } =>
    isValid(option.value),
  )
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function parseReferenceId(value: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function formatLocationDisplay(location: LocationRecord) {
  return [location.name, location.country, location.region]
    .filter(Boolean)
    .join(' · ')
}

function endpointKeyFromName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'api_call'
  )
}

function readScopeFieldValue(field: PolicyScopeField) {
  switch (field.field_key) {
    case 'location':
      return field.location ?? null
    case 'cost_center':
      return field.cost_center ?? null
    case 'business_unit':
      return field.business_unit ?? null
    case 'role':
      return field.role_definition ?? null
    case 'supplier':
      return field.supplier ?? null
  }
}

function mapScopeField(field: PolicyScopeField): BuilderScopeField | null {
  const valueId = readScopeFieldValue(field)
  if (!valueId) return null

  const label = field.label || fieldKeyLabel(field.field_key)
  return {
    id: String(field.id ?? randomId('scope-field')),
    fieldKey: field.field_key,
    label,
    display: field.display || `${label} #${valueId}`,
    valueId,
  }
}

function serializeScopeField(
  field: BuilderScopeField,
  sequence: number,
): PolicyScopeField {
  const base = {
    sequence,
    field_key: field.fieldKey,
    operator: 'equals' as const,
    label: field.label,
    display: field.display,
  }

  switch (field.fieldKey) {
    case 'location':
      return { ...base, location: field.valueId }
    case 'cost_center':
      return { ...base, cost_center: field.valueId }
    case 'business_unit':
      return { ...base, business_unit: field.valueId }
    case 'role':
      return { ...base, role_definition: field.valueId }
    case 'supplier':
      return { ...base, supplier: field.valueId }
  }
}

function mapRequirement(
  requirement: WorkflowBlockRequirement,
): Requirement {
  return {
    id: String(requirement.id ?? randomId('requirement')),
    name: requirement.name || requirement.requirement_name || 'Requirement',
    owner: requirement.owner,
  }
}

function mapWorkflowBlock(block: WorkflowBlock, index: number): PipelineBlock {
  const id = String(block.id ?? randomId('block'))

  return {
    id: `saved-${id}`,
    pipelineId: `saved-pipeline-${id}`,
    order: index + 1,
    name: block.name || 'Untitled Block',
    type: block.block_type,
    gate: block.gate_type,
    requirements:
      block.block_type === 'requirement'
        ? (block.requirements ?? []).map(mapRequirement)
        : [],
    integrationType:
      block.block_type === 'system'
        ? block.integration_type || 'api_call'
        : undefined,
    config: block.config,
  }
}

function serializePipelineBlock(
  block: PipelineBlock,
  index: number,
): WorkflowBlock {
  if (block.type === 'system') {
    return {
      sequence: index + 1,
      block_type: 'system',
      name: block.name.trim(),
      gate_type: block.gate,
      integration_type: block.integrationType || 'api_call',
      config: block.config ?? {
        endpoint_key: endpointKeyFromName(block.name),
      },
      requirements: [],
    }
  }

  return {
    sequence: index + 1,
    block_type: 'requirement',
    name: block.name.trim(),
    gate_type: block.gate,
    requirements: block.requirements.map((requirement, requirementIndex) => ({
      sequence: requirementIndex + 1,
      name: requirement.name.trim(),
      owner: requirement.owner,
    })),
  }
}

function buildLocalHealth(
  policyName: string,
  pipelineBlocks: PipelineBlock[],
): WorkflowHealth {
  const requirementCount = pipelineBlocks.reduce(
    (total, block) => total + block.requirements.length,
    0,
  )
  const hardGateCount = pipelineBlocks.filter(
    (block) => block.gate === 'hard',
  ).length
  const softGateCount = pipelineBlocks.filter(
    (block) => block.gate === 'soft',
  ).length
  const systemBlockCount = pipelineBlocks.filter(
    (block) => block.type === 'system',
  ).length
  const noBlockIssues = pipelineBlocks.every((block) => {
    if (!block.name.trim()) return false
    if (block.type === 'requirement') return block.requirements.length > 0
    return Boolean(block.integrationType)
  })

  const checks = {
    policy_name_set: policyName.trim().length > 0,
    at_least_one_step: pipelineBlocks.length > 0,
    no_block_issues: pipelineBlocks.length === 0 ? false : noBlockIssues,
    no_circular_dependencies: true,
  }

  return {
    status: Object.values(checks).every(Boolean) ? 'complete' : 'incomplete',
    checks,
    counts: {
      steps: pipelineBlocks.length,
      requirements: requirementCount,
      hard_gates: hardGateCount,
      soft_gates: softGateCount,
      system_blocks: systemBlockCount,
    },
  }
}

function healthMatchesLocal(server: WorkflowHealth, local: WorkflowHealth) {
  return (
    server.counts.steps === local.counts.steps &&
    server.counts.requirements === local.counts.requirements &&
    server.counts.hard_gates === local.counts.hard_gates &&
    server.counts.soft_gates === local.counts.soft_gates &&
    server.counts.system_blocks === local.counts.system_blocks &&
    server.checks.policy_name_set === local.checks.policy_name_set &&
    server.checks.at_least_one_step === local.checks.at_least_one_step
  )
}

function orderedBlocksForMode(
  blocks: PipelineBlock[],
  mode: BuilderMode,
): PipelineBlock[] {
  return mode === 'onboarding' ? blocks : [...blocks].reverse()
}

function offboardingSummary(blocks: PipelineBlock[]) {
  const requirementUnwinds = blocks.reduce(
    (total, block) => total + block.requirements.length,
    0,
  )
  const systemReversals = blocks.filter((block) => block.type === 'system').length

  return {
    total: requirementUnwinds + systemReversals,
    automated: systemReversals,
    manual: requirementUnwinds,
  }
}

export default function WorkflowBuilder({
  workflowType,
  workflowId,
}: {
  workflowType: WorkflowTypeLabel
  workflowId?: string
}) {
  const router = useRouter()
  const apiWorkflowType = workflowTypeToApi(workflowType)
  const listHref = workflowListHref(workflowType)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const pipelineListRef = useRef<HTMLDivElement | null>(null)
  const [mode, setMode] = useState<BuilderMode>(apiWorkflowType)
  const [view, setView] = useState<BuilderView>('build')
  const [scope, setScope] = useState<ScopeState>({
    name: '',
    workerType: 'contingent',
    isActive: true,
  })
  const [workflowStatus, setWorkflowStatus] =
    useState<Workflow['status']>('draft')
  const [scopeFields, setScopeFields] = useState<BuilderScopeField[]>([])
  const [lookups, setLookups] = useState<WorkflowLookups | null>(null)
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [libraryBlocks, setLibraryBlocks] = useState<LibraryBlock[]>(
    DEFAULT_LIBRARY_BLOCKS,
  )
  const [pipelineBlocks, setPipelineBlocks] = useState<PipelineBlock[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [activeDragBlock, setActiveDragBlock] = useState<LibraryBlock | null>(
    null,
  )
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [reorderBlockId, setReorderBlockId] = useState<string | null>(null)
  const [reorderDropIndex, setReorderDropIndex] = useState<number | null>(null)
  const [showAddFieldModal, setShowAddFieldModal] = useState(false)
  const [showAddConditionMenu, setShowAddConditionMenu] = useState(false)
  const [fieldDraftKey, setFieldDraftKey] =
    useState<ScopeFieldKey>('location')
  const [fieldDraftValue, setFieldDraftValue] = useState('')
  const [fieldDraftDisplay, setFieldDraftDisplay] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [locationRows, setLocationRows] = useState<LocationRecord[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [showBlockModal, setShowBlockModal] = useState<BlockType | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalGate, setModalGate] = useState<GateType>('hard')
  const [modalCompletionRule, setModalCompletionRule] =
    useState<CompletionRule>('ALL')
  const [modalCompletionN, setModalCompletionN] = useState(1)
  const [modalAccountableOwner, setModalAccountableOwner] =
    useState<ApproverGroup>('HR')
  const [modalAccountableTouched, setModalAccountableTouched] = useState(false)
  const [modalRequirements, setModalRequirements] = useState<Requirement[]>([])
  const [modalIntegration, setModalIntegration] =
    useState<SystemIntegrationKey>('WORKDAY')
  const [modalPush, setModalPush] = useState(true)
  const [modalPull, setModalPull] = useState(true)
  const [modalReads, setModalReads] = useState<string[]>(defaultReads())
  const [modalWrites, setModalWrites] = useState<string[]>(defaultWrites())
  const [modalReconcile, setModalReconcile] = useState(true)
  const [modalApiConfig, setModalApiConfig] = useState({
    endpoint: '',
    authType: 'OAuth',
    environment: 'Production',
  })
  const [serverHealth, setServerHealth] = useState<WorkflowHealth | null>(null)
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const workerTypeOptions = useMemo(
    () =>
      getValidOptions(
        lookups?.worker_types,
        FALLBACK_WORKER_TYPE_OPTIONS,
        isWorkerType,
      ),
    [lookups],
  )
  const scopeFieldOptions = useMemo(
    () =>
      getValidOptions(
        lookups?.scope_fields,
        FALLBACK_SCOPE_FIELD_OPTIONS,
        isScopeFieldKey,
      ),
    [lookups],
  )
  const ownerOptions = useMemo(
    () =>
      getValidOptions(
        lookups?.requirement_owners,
        FALLBACK_OWNER_OPTIONS,
        isRequirementOwner,
      ),
    [lookups],
  )
  const integrationOptions = useMemo(
    () =>
      getValidOptions(
        lookups?.integration_types,
        FALLBACK_INTEGRATION_OPTIONS,
        isIntegrationType,
      ),
    [lookups],
  )

  const usedLibraryBlockIds = useMemo(
    () =>
      new Set(
        pipelineBlocks.flatMap((block) => [
          block.id,
          block.name.trim().toLowerCase(),
        ]),
      ),
    [pipelineBlocks],
  )
  const localHealth = useMemo(
    () => buildLocalHealth(scope.name, pipelineBlocks),
    [scope.name, pipelineBlocks],
  )
  const health =
    serverHealth && healthMatchesLocal(serverHealth, localHealth)
      ? serverHealth
      : localHealth
  const isWorkflowReady = health.status === 'complete'
  const canSaveDraft =
    scope.name.trim().length > 0 && Boolean(scope.workerType) && !isSaving
  const availableScopeFieldOptions = scopeFieldOptions.filter(
    (option) =>
      !scopeFields.some((field) => field.fieldKey === option.value),
  )
  const canAddScopeField = Boolean(parseReferenceId(fieldDraftValue))
  const scopeSummary = [
    scope.workerType ? workerTypeLabel(scope.workerType) : '',
    ...scopeFields.map((field) => field.display).filter(Boolean),
  ]
    .filter(Boolean)
    .join(' · ')
  const orderedBlocks = useMemo(
    () => orderedBlocksForMode(pipelineBlocks, mode),
    [mode, pipelineBlocks],
  )
  const offboardingStats = useMemo(
    () => offboardingSummary(pipelineBlocks),
    [pipelineBlocks],
  )
  const editable = mode === 'onboarding' && view === 'build'

  useEffect(() => {
    setMode(apiWorkflowType)
  }, [apiWorkflowType])

  useEffect(() => {
    let cancelled = false

    async function loadLookups() {
      try {
        const nextLookups = await getComplianceWorkflowLookups()
        if (!cancelled) {
          setLookups(nextLookups)
          setLookupError('')
        }
      } catch (error) {
        if (!cancelled) {
          setLookupError(
            toErrorMessage(error, 'Using default workflow options.'),
          )
        }
      }
    }

    void loadLookups()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!workflowId) return

    let cancelled = false

    async function loadWorkflow() {
      setIsLoadingWorkflow(true)
      setLoadError('')

      try {
        const workflow = await getComplianceWorkflow(workflowId)
        if (cancelled) return

        setScope({
          name: workflow.name,
          workerType: workflow.policy_scope?.worker_type || 'contingent',
          isActive: workflow.is_active,
        })
        setWorkflowStatus(workflow.status)
        setScopeFields(
          (workflow.policy_scope?.fields ?? [])
            .map(mapScopeField)
            .filter((field): field is BuilderScopeField => !!field),
        )
        const blocks = workflow.blocks.map(mapWorkflowBlock)
        setPipelineBlocks(blocks)
        setSelectedBlockId(blocks[0]?.pipelineId ?? null)
        setServerHealth(workflow.health)
      } catch (error) {
        if (!cancelled) {
          setLoadError(toErrorMessage(error, 'Failed to load workflow.'))
        }
      } finally {
        if (!cancelled) setIsLoadingWorkflow(false)
      }
    }

    void loadWorkflow()

    return () => {
      cancelled = true
    }
  }, [workflowId])

  useEffect(() => {
    const shouldLoadLocations =
      (showAddFieldModal && fieldDraftKey === 'location') ||
      scopeFields.some((field) => field.fieldKey === 'location')
    if (!shouldLoadLocations) return

    let cancelled = false

    async function loadLocations() {
      setIsLoadingLocations(true)
      setLocationError('')

      try {
        const rows = await getLocations({
          status: 'active',
          search: locationSearch,
        })
        if (!cancelled) setLocationRows(rows)
      } catch (error) {
        if (!cancelled) {
          setLocationRows([])
          setLocationError(toErrorMessage(error, 'Failed to load locations.'))
        }
      } finally {
        if (!cancelled) setIsLoadingLocations(false)
      }
    }

    void loadLocations()

    return () => {
      cancelled = true
    }
  }, [fieldDraftKey, locationSearch, showAddFieldModal, scopeFields])

  useEffect(() => {
    if (!activeDragBlock) return

    function handleMouseMove(event: globalThis.MouseEvent) {
      setDragPosition({ x: event.clientX, y: event.clientY })
    }

    function handleMouseUp(event: globalThis.MouseEvent) {
      const bounds = canvasRef.current?.getBoundingClientRect()
      if (
        bounds &&
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom
      ) {
        addLibraryBlockToPipeline(activeDragBlock)
      }

      setActiveDragBlock(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [activeDragBlock])

  function openAddFieldModal() {
    const nextKey = availableScopeFieldOptions[0]?.value
    if (!nextKey) return

    setFieldDraftKey(nextKey)
    setFieldDraftValue('')
    setFieldDraftDisplay('')
    setLocationSearch('')
    setLocationRows([])
    setLocationError('')
    setShowAddFieldModal(true)
    setShowAddConditionMenu(false)
  }

  function openAddFieldModalFor(fieldKey: ScopeFieldKey) {
    setFieldDraftKey(fieldKey)
    setFieldDraftValue('')
    setFieldDraftDisplay('')
    setLocationSearch('')
    setLocationRows([])
    setLocationError('')
    setShowAddFieldModal(true)
    setShowAddConditionMenu(false)
  }

  function handleFieldKeyChange(value: string) {
    if (!isScopeFieldKey(value)) return

    setFieldDraftKey(value)
    setFieldDraftValue('')
    setFieldDraftDisplay('')
    setLocationSearch('')
    setLocationRows([])
    setLocationError('')
  }

  function addScopeField() {
    const valueId = parseReferenceId(fieldDraftValue)
    if (!valueId) return

    const label = fieldKeyLabel(fieldDraftKey)
    setScopeFields((current) => [
      ...current,
      {
        id: randomId('scope-field'),
        fieldKey: fieldDraftKey,
        label,
        display: fieldDraftDisplay || `${label} #${valueId}`,
        valueId,
      },
    ])
    setShowAddFieldModal(false)
  }

  function openBlockModal(type: BlockType, block?: LibraryBlock) {
    setShowBlockModal(type)
    setEditingBlockId(block?.id ?? null)
    setModalName(block?.name ?? '')
    setModalGate(block?.gate ?? 'hard')
    setModalRequirements(block?.requirements ?? [])
    setModalCompletionRule(block?.completionRule ?? 'ALL')
    setModalCompletionN(block?.completionN ?? 1)
    setModalAccountableOwner(block?.accountableOwner ?? 'HR')
    setModalAccountableTouched(Boolean(block?.accountableOwner))
    setModalIntegration(block?.systemIntegration ?? 'WORKDAY')
    setModalPush(block?.push ?? true)
    setModalPull(block?.pull ?? true)
    setModalReads(block?.reads ?? defaultReads())
    setModalWrites(block?.writes ?? defaultWrites())
    setModalReconcile(block?.reconcile ?? true)
    setModalApiConfig(
      block?.config && typeof block.config === 'object'
        ? {
            endpoint:
              typeof block.config.endpoint === 'string'
                ? block.config.endpoint
                : '',
            authType:
              typeof block.config.authType === 'string'
                ? block.config.authType
                : 'OAuth',
            environment:
              typeof block.config.environment === 'string'
                ? block.config.environment
                : 'Production',
          }
        : {
            endpoint: '',
            authType: 'OAuth',
            environment: 'Production',
          },
    )
  }

  function closeBlockModal() {
    setShowBlockModal(null)
    setEditingBlockId(null)
    setModalName('')
    setModalGate('hard')
    setModalCompletionRule('ALL')
    setModalCompletionN(1)
    setModalAccountableOwner('HR')
    setModalAccountableTouched(false)
    setModalRequirements([])
    setModalIntegration('WORKDAY')
    setModalPush(true)
    setModalPull(true)
    setModalReads(defaultReads())
    setModalWrites(defaultWrites())
    setModalReconcile(true)
    setModalApiConfig({
      endpoint: '',
      authType: 'OAuth',
      environment: 'Production',
    })
  }

  function addLibraryBlockToPipeline(block: LibraryBlock) {
    if (
      usedLibraryBlockIds.has(block.id) ||
      usedLibraryBlockIds.has(block.name.trim().toLowerCase())
    ) {
      return
    }

    const pipelineId = randomId('workflow-block')

    setPipelineBlocks((current) => {
      if (current.some((candidate) => candidate.id === block.id)) {
        return current
      }
      if (
        current.some(
          (candidate) =>
            candidate.name.trim().toLowerCase() ===
            block.name.trim().toLowerCase(),
        )
      ) {
        return current
      }

      return [
        ...current,
        {
          ...block,
          pipelineId,
          order: current.length + 1,
          accountableOwner: block.accountableOwner,
          completionRule: block.completionRule,
          completionN: block.completionN,
          push: block.push,
          pull: block.pull,
          reads: block.reads,
          writes: block.writes,
          reconcile: block.reconcile,
          systemIntegration: block.systemIntegration,
          systemUnwind: block.systemUnwind,
          requirements: block.requirements.map((requirement) => ({
            ...requirement,
          })),
        },
      ]
    })

    setSelectedBlockId(pipelineId)
    setServerHealth(null)
  }

  function addModalRequirement(requirement: Requirement) {
    setModalRequirements((current) => {
      if (current.some((candidate) => candidate.id === requirement.id)) {
        return current
      }

      const next = [...current, requirement]
      if (!modalAccountableTouched) {
        setModalAccountableOwner(suggestedAccountable(next))
      }
      return next
    })
  }

  function removeModalRequirement(requirementId: string) {
    setModalRequirements((current) => {
      const next = current.filter((candidate) => candidate.id !== requirementId)
      if (next.length > 0 && !modalAccountableTouched) {
        setModalAccountableOwner(suggestedAccountable(next))
      }
      return next
    })
  }

  function pickIntegration(key: SystemIntegrationKey) {
    setModalIntegration(key)
    const meta = integrationMeta(key)
    setModalPush(meta?.push ?? true)
    setModalPull(meta?.pull ?? true)
    setModalReads(defaultReads())
    setModalWrites(defaultWrites())
    setModalReconcile(Boolean(meta?.reverseAction))
  }

  function toggleRead(field: string) {
    setModalReads((current) =>
      current.includes(field)
        ? current.filter((candidate) => candidate !== field)
        : [...current, field],
    )
  }

  function toggleWrite(field: string) {
    setModalWrites((current) =>
      current.includes(field)
        ? current.filter((candidate) => candidate !== field)
        : [...current, field],
    )
  }

  function createOrUpdateBlock() {
    if (!showBlockModal || !modalName.trim()) return
    if (showBlockModal === 'requirement' && modalRequirements.length === 0) {
      return
    }
    if (showBlockModal === 'system' && !modalIntegration) return

    const completionN =
      modalCompletionRule === 'N_OF'
        ? Math.max(1, Math.min(modalCompletionN, modalRequirements.length || 1))
        : undefined
    const selectedMeta = integrationMeta(modalIntegration)

    const nextBlock: LibraryBlock = {
      id: editingBlockId ?? randomId('library-block'),
      name: modalName.trim(),
      type: showBlockModal,
      gate: modalGate,
      accountableOwner: modalAccountableOwner,
      completionRule: modalCompletionRule,
      completionN,
      requirements:
        showBlockModal === 'requirement' ? modalRequirements : [],
      integrationType:
        showBlockModal === 'system' ? 'api_call' : undefined,
      systemIntegration:
        showBlockModal === 'system' ? modalIntegration : undefined,
      push: showBlockModal === 'system' ? modalPush : undefined,
      pull: showBlockModal === 'system' ? modalPull : undefined,
      reads: showBlockModal === 'system' && modalPush ? modalReads : undefined,
      writes: showBlockModal === 'system' && modalPull ? modalWrites : undefined,
      reconcile: showBlockModal === 'system' ? modalReconcile : undefined,
      systemUnwind:
        showBlockModal === 'system'
          ? systemReversalFor(selectedMeta, modalPush)
          : undefined,
      config:
        showBlockModal === 'system'
          ? {
              endpoint: modalApiConfig.endpoint.trim(),
              authType: modalApiConfig.authType,
              environment: modalApiConfig.environment,
            }
          : undefined,
    }

    setLibraryBlocks((current) => {
      if (!editingBlockId) return [...current, nextBlock]
      return current.map((block) =>
        block.id === editingBlockId ? nextBlock : block,
      )
    })

    closeBlockModal()
  }

  function handleLibraryDragStart(
    event: DragEvent<HTMLDivElement>,
    blockId: string,
  ) {
    event.dataTransfer.setData('text/plain', blockId)
    event.dataTransfer.effectAllowed = 'copy'
    setDragBlockId(blockId)
  }

  function handlePipelineDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!editable) {
      setDragBlockId(null)
      return
    }

    const blockId = event.dataTransfer.getData('text/plain') || dragBlockId
    const block = libraryBlocks.find((candidate) => candidate.id === blockId)

    if (!block || usedLibraryBlockIds.has(block.id)) {
      setDragBlockId(null)
      return
    }

    addLibraryBlockToPipeline(block)
    setDragBlockId(null)
  }

  function handleLibraryMouseDown(
    event: MouseEvent<HTMLDivElement>,
    block: LibraryBlock,
  ) {
    if (
      !editable ||
      usedLibraryBlockIds.has(block.id) ||
      usedLibraryBlockIds.has(block.name.trim().toLowerCase())
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setActiveDragBlock(block)
    setDragPosition({ x: event.clientX, y: event.clientY })
  }

  function removePipelineBlock(pipelineId: string) {
    setPipelineBlocks((current) =>
      current
        .filter((block) => block.pipelineId !== pipelineId)
        .map((block, index) => ({ ...block, order: index + 1 })),
    )
    setSelectedBlockId((current) =>
      current === pipelineId ? null : current,
    )
    setServerHealth(null)
  }

  function computePipelineDropIndex(clientY: number) {
    const rows = Array.from(
      pipelineListRef.current?.querySelectorAll('[data-pipeline-id]') ?? [],
    ) as HTMLElement[]

    for (let index = 0; index < rows.length; index += 1) {
      const bounds = rows[index].getBoundingClientRect()
      if (clientY < bounds.top + bounds.height / 2) return index
    }

    return rows.length
  }

  function movePipelineBlock(pipelineId: string, toIndex: number) {
    setPipelineBlocks((current) => {
      const fromIndex = current.findIndex(
        (block) => block.pipelineId === pipelineId,
      )
      if (fromIndex === -1) return current

      const next = [...current]
      const [movedBlock] = next.splice(fromIndex, 1)
      let insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
      insertIndex = Math.max(0, Math.min(insertIndex, next.length))
      next.splice(insertIndex, 0, movedBlock)

      return next.map((block, index) => ({ ...block, order: index + 1 }))
    })
    setServerHealth(null)
  }

  function handlePipelineBlockMouseDown(
    event: MouseEvent<HTMLDivElement>,
    pipelineId: string,
  ) {
    if (!editable || event.button !== 0) return
    if (
      (event.target as HTMLElement).closest(
        'button, a, input, select, textarea, [data-no-reorder]',
      )
    ) {
      return
    }

    event.preventDefault()
    const start = { x: event.clientX, y: event.clientY }
    let moved = false

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      if (
        !moved &&
        Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) > 5
      ) {
        moved = true
        setReorderBlockId(pipelineId)
        document.body.classList.add('workflow-reordering')
      }

      if (moved) {
        setReorderDropIndex(computePipelineDropIndex(moveEvent.clientY))
      }
    }

    const handleMouseUp = (upEvent: globalThis.MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.classList.remove('workflow-reordering')

      if (moved) {
        movePipelineBlock(pipelineId, computePipelineDropIndex(upEvent.clientY))
      } else {
        setSelectedBlockId((current) =>
          current === pipelineId ? null : pipelineId,
        )
      }

      setReorderBlockId(null)
      setReorderDropIndex(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function buildWorkflowPayload(): CreateWorkflowPayload {
    return {
      name: scope.name.trim(),
      workflow_type: apiWorkflowType,
      status: 'draft',
      is_active: scope.isActive,
      policy_scope: {
        worker_type: scope.workerType,
        fields: scopeFields.map((field, index) =>
          serializeScopeField(field, index + 1),
        ),
      },
      blocks: pipelineBlocks.map(serializePipelineBlock),
    }
  }

  async function handleSaveDraft() {
    if (!canSaveDraft) return

    setIsSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    try {
      const payload = buildWorkflowPayload()
      const savedWorkflow = workflowId
        ? await updateComplianceWorkflow(workflowId, payload)
        : await createComplianceWorkflow(payload)

      setWorkflowStatus(savedWorkflow.status)
      setServerHealth(savedWorkflow.health)
      setSaveSuccess(true)
      window.setTimeout(() => router.push(listHref), 600)
    } catch (error) {
      setSaveError(toErrorMessage(error, 'Failed to save workflow.'))
    } finally {
      setIsSaving(false)
    }
  }

  const saveHint = !scope.name.trim()
    ? 'Add a policy name to save'
    : pipelineBlocks.length === 0
      ? 'Add at least one block'
      : saveError || (isWorkflowReady ? 'Ready to save' : 'Workflow checks update after save')

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] overflow-hidden bg-[#f8f9fb] text-slate-950">
      <WorkflowBuilderStyles />
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-9">
        <div className="flex items-center gap-3">
          <Link
            href={listHref}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-cyan-50 hover:text-cyan-700"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {workflowType}
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            Onboarding &amp; Offboarding
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              {workflowStatus}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setView((current) => (current === 'process' ? 'build' : 'process'))
          }
          className={
            view === 'process'
              ? 'inline-flex h-8 items-center gap-2 rounded-md border border-cyan-600 bg-cyan-50 px-4 text-xs font-semibold text-cyan-700'
              : 'inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700'
          }
        >
          <WorkflowIcon className="h-3.5 w-3.5" />
          {view === 'process' ? 'Back to builder' : 'Process view'}
        </button>
      </header>

      <div className="grid min-h-[calc(100vh-7rem)] 2xl:grid-cols-[minmax(0,1fr)_310px]">
        <main className="space-y-5 p-7">
          {loadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loadError}
            </div>
          )}
          {lookupError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {lookupError}
            </div>
          )}
          {isLoadingWorkflow && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              Loading workflow...
            </div>
          )}

          {view === 'process' ? (
            <ProcessView
              blocks={orderedBlocks}
              mode={mode}
              onModeChange={setMode}
            />
          ) : (
            <>
          <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-slate-100 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <div>
                  {scope.name && (
                    <h1 className="text-xs font-semibold">{scope.name}</h1>
                  )}
                  <p className="text-xs text-slate-400">
                    Applies to {scopeSummary || 'selected workers'}
                  </p>
                </div>
              </div>

              <div className="addcond-wrap">
                <button
                  type="button"
                  onClick={() =>
                    setShowAddConditionMenu((current) => !current)
                  }
                  disabled={availableScopeFieldOptions.length === 0}
                  className="add-field-btn"
                >
                  <Plus className="h-3 w-3" />
                  Add condition
                </button>
                {showAddConditionMenu && (
                  <div className="addcond-menu">
                    {availableScopeFieldOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="field-opt"
                        onClick={() => {
                          if (isScopeFieldKey(option.value)) {
                            openAddFieldModalFor(option.value)
                          }
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                    {availableScopeFieldOptions.length === 0 && (
                      <div className="addcond-empty">
                        Every condition is in use
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-5 px-5 py-5 2xl:grid-cols-[230px_minmax(0,1fr)]">
              <ScopeInput
                label="Policy Name"
                className="min-w-0"
                value={scope.name}
                placeholder="e.g. US SOW Worker"
                onChange={(value) => {
                  setScope({ ...scope, name: value })
                  setServerHealth(null)
                }}
              />
              <div className="min-w-0">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Applies to workers where
                </span>
                <div className="space-y-2">
                  <ScopeConditionSelect
                    label="Worker type"
                    value={scope.workerType}
                    options={workerTypeOptions}
                    onChange={(value) => {
                      setScope({
                        ...scope,
                        workerType: isWorkerType(value) ? value : '',
                      })
                      setServerHealth(null)
                    }}
                  />
                  {scopeFields.map((field) => (
                    <ScopeConditionInput
                      key={field.id}
                      field={field}
                      locationRows={locationRows}
                      onChange={(display, valueId) =>
                        setScopeFields((current) =>
                          current.map((candidate) =>
                            candidate.id === field.id
                              ? {
                                  ...candidate,
                                  display,
                                  valueId: valueId ?? candidate.valueId,
                                }
                              : candidate,
                          ),
                        )
                      }
                      onRemove={() => {
                        setScopeFields((current) =>
                          current.filter(
                            (candidate) => candidate.id !== field.id,
                          ),
                        )
                        setServerHealth(null)
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            ref={canvasRef}
            onDrop={handlePipelineDrop}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragBlockId(null)}
            className={
              (dragBlockId || activeDragBlock) && editable
                ? 'overflow-hidden rounded-2xl border border-cyan-400 bg-white shadow-[0_0_0_3px_rgba(8,145,178,0.14)]'
                : mode === 'offboarding'
                  ? 'overflow-hidden rounded-2xl border border-slate-200 bg-stone-50 shadow-sm'
                  : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
            }
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">
                  {mode === 'onboarding'
                    ? 'Onboarding Pipeline'
                    : 'Offboarding - derived'}
                </h2>
                <p className="text-xs text-slate-400">
                  {mode === 'onboarding'
                    ? 'Drag blocks from the right · Click a block to inspect · Executes top to bottom'
                    : 'Every requirement is unwound in reverse order · Read-only preview'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {pipelineBlocks.length > 0 && (
                  <span className="font-mono text-xs font-semibold text-slate-400">
                    {pipelineBlocks.length} step
                    {pipelineBlocks.length === 1 ? '' : 's'}
                  </span>
                )}
                <ModeSegment mode={mode} onChange={setMode} />
              </div>
            </div>

            <div className="min-h-[275px] p-5">
              {mode === 'offboarding' && pipelineBlocks.length > 0 && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-100 px-4 py-3 text-xs text-slate-700">
                  <RotateCcw className="h-3.5 w-3.5 shrink-0 text-slate-900" />
                  <span>
                    Derived from the onboarding pipeline: {offboardingStats.total}{' '}
                    unwind tasks, {offboardingStats.automated} automated system
                    reversal
                    {offboardingStats.automated === 1 ? '' : 's'}, and{' '}
                    {offboardingStats.manual} team-owned follow-up
                    {offboardingStats.manual === 1 ? '' : 's'}.
                  </span>
                </div>
              )}

              {(dragBlockId || activeDragBlock) && editable && (
                <div className="mb-4 rounded-xl border border-dashed border-cyan-300 bg-cyan-50 px-4 py-3 text-xs font-semibold text-cyan-700">
                  Drop to add{' '}
                  {activeDragBlock ? (
                    <strong>{activeDragBlock.name}</strong>
                  ) : (
                    'this block'
                  )}{' '}
                  to the workflow pipeline.
                </div>
              )}

              {pipelineBlocks.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100 text-slate-400">
                    <ArrowDown className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">
                      No steps yet
                    </h3>
                    <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">
                      Drag a block from the right panel to start building the{' '}
                      {workflowType.toLowerCase()} pipeline.
                    </p>
                  </div>
                </div>
              ) : (
                <div ref={pipelineListRef} className="space-y-0">
                  {orderedBlocks.map((block, index) => (
                    <Fragment key={block.pipelineId}>
                      {editable &&
                        reorderBlockId &&
                        reorderDropIndex === index && (
                          <div className="drop-line-ui" />
                        )}
                      <PipelineBlockCard
                        block={block}
                        mode={mode}
                        displayOrder={index + 1}
                        selected={
                          editable && selectedBlockId === block.pipelineId
                        }
                        dragging={reorderBlockId === block.pipelineId}
                        showConnector={index < orderedBlocks.length - 1}
                        readonly={!editable}
                        onSelect={() => {
                          if (!editable) return
                          setSelectedBlockId((current) =>
                            current === block.pipelineId
                              ? null
                              : block.pipelineId,
                          )
                        }}
                        onMouseDown={(event) =>
                          handlePipelineBlockMouseDown(event, block.pipelineId)
                        }
                        onRemove={() => removePipelineBlock(block.pipelineId)}
                      />
                    </Fragment>
                  ))}
                  {editable &&
                    reorderBlockId &&
                    reorderDropIndex === orderedBlocks.length && (
                      <div className="drop-line-ui" />
                    )}
                </div>
              )}
            </div>
          </section>
            </>
          )}
        </main>

        <aside className="border-t border-slate-200 bg-white 2xl:border-l 2xl:border-t-0">
          <section className="border-b border-slate-200 p-4">
            <button
              type="button"
              disabled={!canSaveDraft}
              onClick={handleSaveDraft}
              className={
                saveSuccess
                  ? 'flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-green-600 text-sm font-semibold text-white'
                  : 'flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-400'
              }
            >
              {saveSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved
                </>
              ) : isSaving ? (
                'Saving...'
              ) : (
                'Save'
              )}
            </button>
            <p
              className={
                saveError
                  ? 'mt-2 flex items-center justify-center gap-1 text-center text-[10px] leading-4 text-red-600'
                  : isWorkflowReady
                    ? 'mt-2 flex items-center justify-center gap-1 text-center text-[10px] leading-4 text-green-700'
                    : 'mt-2 flex items-center justify-center gap-1 text-center text-[10px] leading-4 text-slate-400'
              }
            >
              <Info className="h-3 w-3 shrink-0" />
              {saveHint}
            </p>
          </section>

          <section className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <Plus className="h-3 w-3" />
              Block Library
            </h2>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openBlockModal('requirement')}
                className="flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-sm"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
                  <ClipboardList className="h-4 w-4" />
                </span>
                Requirement
                <br />
                Block
              </button>
              <button
                type="button"
                onClick={() => openBlockModal('system')}
                className="flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-50 hover:shadow-sm"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
                  <Cog className="h-4 w-4" />
                </span>
                System
                <br />
                Block
              </button>
            </div>

            <div className="space-y-2">
              {libraryBlocks.map((block) => {
                const isUsed =
                  usedLibraryBlockIds.has(block.id) ||
                  usedLibraryBlockIds.has(block.name.trim().toLowerCase())
                return (
                  <LibraryBlockCard
                    key={block.id}
                    block={block}
                    isUsed={isUsed}
                    canDrag={editable}
                    integrationOptions={integrationOptions}
                    onDragStart={handleLibraryDragStart}
                    onDragEnd={() => setDragBlockId(null)}
                    onMouseDown={handleLibraryMouseDown}
                    onEdit={() => openBlockModal(block.type, block)}
                    onRemove={() =>
                      setLibraryBlocks((current) =>
                        current.filter(
                          (candidate) => candidate.id !== block.id,
                        ),
                      )
                    }
                  />
                )
              })}
            </div>
          </section>
        </aside>
      </div>

      {activeDragBlock && (
        <div
          className="pointer-events-none fixed z-[60] w-56"
          style={{ left: dragPosition.x, top: dragPosition.y }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2 rotate-[1.5deg] rounded-xl border border-cyan-300 bg-white p-3 shadow-2xl shadow-cyan-900/10">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-xs font-semibold text-slate-950">
                {activeDragBlock.name}
              </span>
              <span
                className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${gateClass(
                  activeDragBlock.gate,
                )}`}
              >
                {activeDragBlock.gate === 'hard' ? 'Hard' : 'Soft'}
              </span>
            </div>
            <ul className="space-y-1">
              {activeDragBlock.requirements.slice(0, 3).map((requirement) => (
                <li
                  key={requirement.id}
                  className="flex items-center gap-1 text-[10px] text-slate-600"
                >
                  <span className="h-1 w-1 rounded-full bg-slate-400" />
                  {requirement.name}
                </li>
              ))}
              {activeDragBlock.type === 'system' && (
                <li className="flex items-center gap-1 text-[10px] text-slate-600">
                  <Cog className="h-3 w-3" />
                  {activeDragBlock.integrationType === 'api_call'
                    ? 'API Call'
                    : 'System integration'}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {showAddFieldModal && (
        <Modal
          title="Add Scope Field"
          maxWidthClassName="max-w-sm"
          onClose={() => setShowAddFieldModal(false)}
          footer={
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAddFieldModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addScopeField}
                disabled={!canAddScopeField}
                className="rounded-lg bg-slate-950 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-400"
              >
                Add Field
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Scope Field
              </label>
              <select
                value={fieldDraftKey}
                onChange={(event) => handleFieldKeyChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              >
                {availableScopeFieldOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {fieldDraftKey === 'location' ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Location
                  </label>
                  <input
                    value={locationSearch}
                    onChange={(event) => {
                      setLocationSearch(event.target.value)
                      setFieldDraftValue('')
                      setFieldDraftDisplay('')
                    }}
                    placeholder="Search active locations"
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {isLoadingLocations ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      Loading locations...
                    </div>
                  ) : locationError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {locationError}
                    </div>
                  ) : locationRows.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      No active locations found.
                    </div>
                  ) : (
                    locationRows.map((location) => {
                      const selected = fieldDraftValue === String(location.id)
                      return (
                        <button
                          key={location.id}
                          type="button"
                          onClick={() => {
                            setFieldDraftValue(String(location.id))
                            setFieldDraftDisplay(
                              formatLocationDisplay(location),
                            )
                          }}
                          className={
                            selected
                              ? 'w-full rounded-lg border border-cyan-500 bg-cyan-50 px-3 py-2 text-left text-xs text-cyan-800'
                              : 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:border-cyan-300 hover:bg-cyan-50'
                          }
                        >
                          <span className="font-semibold">
                            {location.name}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">
                            {[location.country, location.region]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {fieldKeyLabel(fieldDraftKey)} ID
                </label>
                <input
                  value={fieldDraftValue}
                  onChange={(event) => {
                    setFieldDraftValue(event.target.value)
                    setFieldDraftDisplay('')
                  }}
                  inputMode="numeric"
                  placeholder="Enter reference ID"
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
                <p className="mt-2 text-[10px] leading-4 text-slate-400">
                  The workflow API expects the selected scope field to submit
                  its related record ID.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showBlockModal && (
        <Modal
          title={
            editingBlockId
              ? 'Edit Block'
              : showBlockModal === 'requirement'
                ? 'New Requirement Block'
                : 'New System Block'
          }
          onClose={closeBlockModal}
          footer={
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={closeBlockModal}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createOrUpdateBlock}
                disabled={
                  !modalName.trim() ||
                  (showBlockModal === 'requirement' &&
                    modalRequirements.length === 0) ||
                  (showBlockModal === 'system' && !modalIntegration)
                }
                className="rounded-lg bg-slate-950 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-400"
              >
                {editingBlockId ? 'Save Changes' : 'Create Block'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="form-grp">
              <label className="form-lbl">Block Name</label>
              <input
                autoFocus
                value={modalName}
                onChange={(event) => setModalName(event.target.value)}
                placeholder={
                  showBlockModal === 'requirement'
                    ? 'e.g. Identity Verification'
                    : 'e.g. Workday Provisioning'
                }
                className="form-inp"
              />
            </div>

            <div className="form-grp">
              <label className="form-lbl">
                Gate Type <span className="lbl-hint">· does it hold up everything downstream?</span>
              </label>
              <div className="gate-grid">
                <GateOption
                  gate="hard"
                  active={modalGate === 'hard'}
                  onClick={() => setModalGate('hard')}
                />
                <GateOption
                  gate="soft"
                  active={modalGate === 'soft'}
                  onClick={() => setModalGate('soft')}
                />
              </div>
            </div>

            {showBlockModal === 'requirement' && (
              <>
                <div className="form-grp">
                  <label className="form-lbl">
                    Completion rule <span className="lbl-hint">· what makes this block satisfied</span>
                  </label>
                  <div className="comp-seg">
                    <button
                      type="button"
                      className={modalCompletionRule === 'ALL' ? 'on' : ''}
                      onClick={() => setModalCompletionRule('ALL')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={modalCompletionRule === 'ANY' ? 'on' : ''}
                      onClick={() => setModalCompletionRule('ANY')}
                    >
                      Any one
                    </button>
                    <button
                      type="button"
                      className={modalCompletionRule === 'N_OF' ? 'on' : ''}
                      onClick={() => setModalCompletionRule('N_OF')}
                    >
                      N of M
                    </button>
                  </div>
                  {modalCompletionRule === 'N_OF' && (
                    <div className="comp-n">
                      Needs
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, modalRequirements.length)}
                        value={modalCompletionN}
                        onChange={(event) =>
                          setModalCompletionN(
                            Math.max(
                              1,
                              Math.min(
                                Number(event.target.value) || 1,
                                Math.max(1, modalRequirements.length),
                              ),
                            ),
                          )
                        }
                      />
                      of {modalRequirements.length}
                    </div>
                  )}
                  <div className="comp-readout">
                    <Info className="h-3 w-3" />
                    {modalCompletionRule === 'ALL'
                      ? `Clears when all ${modalRequirements.length || 0} requirement${
                          modalRequirements.length === 1 ? ' is' : 's are'
                        } satisfied.`
                      : modalCompletionRule === 'ANY'
                        ? 'Clears when any one of them is satisfied.'
                        : `Clears when ${Math.min(
                            modalCompletionN,
                            modalRequirements.length || 1,
                          )} of ${modalRequirements.length || 0} are satisfied.`}
                  </div>
                </div>

                <div className="form-grp">
                  <label className="form-lbl">
                    Accountable <span className="lbl-hint">· who owns this gate — resolves to live people</span>
                  </label>
                  <AccountableField
                    value={modalAccountableOwner}
                    onChange={(group) => {
                      setModalAccountableOwner(group)
                      setModalAccountableTouched(true)
                    }}
                  />
                  {!modalAccountableTouched && modalRequirements.length > 0 && (
                    <span className="lbl-suggest">
                      Suggested from this block’s approvers — change if needed
                    </span>
                  )}
                </div>

                <div className="form-grp">
                  <label className="form-lbl">
                    Requirements <span className="lbl-hint">· owner, approver & unwind are inherited from the catalog</span>
                  </label>
                  <div className="msel-list">
                    {modalRequirements.length === 0 && (
                      <div className="msel-empty">
                        Add from the catalog below. Each one brings its owner, approver and unwind.
                      </div>
                    )}
                    {modalRequirements.map((requirement) => {
                      const resolvedOwners = resolvePeople(
                        requirement.owner === 'it'
                          ? 'IT'
                          : requirement.owner === 'supplier'
                            ? 'PROCUREMENT'
                            : 'HR',
                      )
                      return (
                        <div key={requirement.id} className="msel-row">
                          <div className="msel-main">
                            <div className="msel-name">
                              {requirement.name}
                              <span className="msel-scope">
                                {ownerLabel(requirement.owner)}
                              </span>
                            </div>
                            <div className="msel-meta">
                              <span
                                className="msel-owner"
                                style={{
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  borderColor: '#bfdbfe',
                                }}
                              >
                                {ownerLabel(requirement.owner)}
                              </span>
                              <span className="msel-dot">·</span>
                              <span className="msel-approver">
                                <PeopleStack
                                  names={resolvedOwners.map((person) => person.name)}
                                  max={2}
                                />
                                <span className="bx-role">Team sign-off</span>
                              </span>
                            </div>
                          </div>
                          <div className="msel-right">
                            <button
                              type="button"
                              className="chip-x"
                              onClick={() => removeModalRequirement(requirement.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mavail">
                    <div className="mavail-hd">Catalog</div>
                    {REQUIREMENTS.filter(
                      (requirement) =>
                        !modalRequirements.some(
                          (selected) => selected.id === requirement.id,
                        ),
                    ).map((requirement) => (
                      <button
                        key={requirement.id}
                        type="button"
                        onClick={() => addModalRequirement(requirement)}
                        className="mavail-row"
                      >
                        <span className="mavail-name">
                          <Plus className="h-3 w-3" />
                          {requirement.name}
                        </span>
                        <span className="mavail-meta">
                          <span className="msel-owner">
                            {ownerLabel(requirement.owner)}
                          </span>
                          <span className="mavail-ap">
                            {requirement.owner === 'it'
                              ? roleLabel('IT')
                              : requirement.owner === 'supplier'
                                ? roleLabel('PROCUREMENT')
                                : roleLabel('HR')}
                          </span>
                        </span>
                      </button>
                    ))}
                    {REQUIREMENTS.filter(
                      (requirement) =>
                        !modalRequirements.some(
                          (selected) => selected.id === requirement.id,
                        ),
                    ).length === 0 && (
                      <div className="msel-empty" style={{ margin: 0 }}>
                        Every catalog requirement is in this block.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {showBlockModal === 'system' && (
              <>
                <div className="form-grp">
                  <label className="form-lbl">
                    Accountable <span className="lbl-hint">· who owns the integration</span>
                  </label>
                  <AccountableField
                    value={modalAccountableOwner}
                    onChange={(group) => {
                      setModalAccountableOwner(group)
                      setModalAccountableTouched(true)
                    }}
                  />
                </div>

                <div className="form-grp">
                  <label className="form-lbl">
                    Connect a system <span className="lbl-hint">· pre-built — you finish the last 10%</span>
                  </label>
                  <div className="intg-grid">
                    {INTEGRATIONS.map((integration) => (
                      <button
                        key={integration.key}
                        type="button"
                        className={`intg-card ${
                          modalIntegration === integration.key ? 'on' : ''
                        }`}
                        onClick={() => pickIntegration(integration.key)}
                      >
                        <div className="intg-top">
                          <span className="intg-name">{integration.label}</span>
                        </div>
                        <span className="intg-blurb">{integration.blurb}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {integrationMeta(modalIntegration) && (
                  <>
                    <div className="form-grp">
                      <label className="form-lbl">
                        Direction <span className="lbl-hint">· what this block does with {integrationMeta(modalIntegration)?.label}</span>
                      </label>
                      <div className="dir-row">
                        <button
                          type="button"
                          className={`dir-toggle ${modalPush ? 'on' : ''}`}
                          onClick={() => setModalPush((current) => !current)}
                        >
                          <ArrowRight className="h-3.5 w-3.5" /> Push <span>send data out</span>
                        </button>
                        <button
                          type="button"
                          className={`dir-toggle ${modalPull ? 'on' : ''}`}
                          onClick={() => setModalPull((current) => !current)}
                        >
                          <ArrowDown
                            className="h-3.5 w-3.5 rotate-90"
                          />{' '}
                          Pull <span>get data back</span>
                        </button>
                      </div>
                    </div>

                    {(modalPush || modalPull) && (
                      <div className="form-grp">
                        <label className="form-lbl">
                          Data flow <span className="lbl-hint">· which fields cross the boundary</span>
                        </label>
                        <div className="dataflow">
                          {modalPush && (
                            <>
                              <div className="df-line">
                                <span className="df-end levv">LEVV</span>
                                <span className="df-arrow">
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                                <span className="df-end sys">
                                  {integrationMeta(modalIntegration)?.label}
                                </span>
                                <span className="df-cap">sends</span>
                              </div>
                              <div className="df-fields">
                                {LEVV_FIELDS.map((field) => (
                                  <button
                                    key={field}
                                    type="button"
                                    className={`df-chip ${
                                      modalReads.includes(field) ? 'on' : ''
                                    }`}
                                    onClick={() => toggleRead(field)}
                                  >
                                    {field}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          {modalPull && (
                            <>
                              <div className="df-line">
                                <span className="df-end sys">
                                  {integrationMeta(modalIntegration)?.label}
                                </span>
                                <span className="df-arrow">
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                                <span className="df-end levv">LEVV</span>
                                <span className="df-cap">writes back</span>
                              </div>
                              <div className="df-fields">
                                {RETURN_FIELDS.map((field) => (
                                  <button
                                    key={field}
                                    type="button"
                                    className={`df-chip ${
                                      modalWrites.includes(field) ? 'on' : ''
                                    }`}
                                    onClick={() => toggleWrite(field)}
                                  >
                                    {field}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          <div className="df-nova">
                            <Zap className="mt-0.5 h-3 w-3 shrink-0" />
                            Nova maps these to the connector’s fields and reads the response. It never decides whether to fire.
                          </div>
                        </div>
                      </div>
                    )}

                    {systemReversalFor(integrationMeta(modalIntegration), modalPush) && (
                      <div className="form-grp">
                        <label className="form-lbl">
                          On exit <span className="lbl-hint">· registered now, runs in offboarding</span>
                        </label>
                        <div className="sys-rev">
                          <div className="sys-rev-body">
                            <RotateCcw className="h-3 w-3" />
                            <strong>
                              {systemReversalFor(
                                integrationMeta(modalIntegration),
                                modalPush,
                              )?.action}
                            </strong>
                            <span className="sys-rev-auto">
                              <Zap className="h-2.5 w-2.5" />
                              automated
                            </span>
                          </div>
                          <label className="recon-row">
                            <input
                              type="checkbox"
                              checked={modalReconcile}
                              onChange={(event) =>
                                setModalReconcile(event.target.checked)
                              }
                            />
                            <span>
                              <strong>Reconcile</strong> — poll the connector to
                              confirm the action completed.
                            </span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="form-grp">
                      <label className="form-lbl">
                        Connection <span className="lbl-hint">· managed by the integration block</span>
                      </label>
                      <div className="api-box">
                        <div className="api-grid">
                          <div className="form-grp">
                            <label className="form-lbl">Endpoint</label>
                            <input
                              value={modalApiConfig.endpoint}
                              onChange={(event) =>
                                setModalApiConfig((current) => ({
                                  ...current,
                                  endpoint: event.target.value,
                                }))
                              }
                              className="form-inp"
                              placeholder="https://api.example.com/provision"
                            />
                          </div>
                          <div className="form-grp">
                            <label className="form-lbl">Auth</label>
                            <select
                              value={modalApiConfig.authType}
                              onChange={(event) =>
                                setModalApiConfig((current) => ({
                                  ...current,
                                  authType: event.target.value,
                                }))
                              }
                              className="form-sel"
                            >
                              <option>OAuth</option>
                              <option>API Key</option>
                              <option>Basic</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-grp">
                          <label className="form-lbl">Environment</label>
                          <select
                            value={modalApiConfig.environment}
                            onChange={(event) =>
                              setModalApiConfig((current) => ({
                                ...current,
                                environment: event.target.value,
                              }))
                            }
                            className="form-sel"
                          >
                            <option>Production</option>
                            <option>Staging</option>
                            <option>Sandbox</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function ModeSegment({
  mode,
  onChange,
}: {
  mode: BuilderMode
  onChange: (mode: BuilderMode) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">
      <button
        type="button"
        onClick={() => onChange('onboarding')}
        className={
          mode === 'onboarding'
            ? 'inline-flex h-8 items-center gap-1 border-r border-slate-200 bg-slate-100 px-3 text-[11px] font-semibold text-slate-950'
            : 'inline-flex h-8 items-center gap-1 border-r border-slate-200 px-3 text-[11px] font-semibold text-slate-400 hover:bg-cyan-50 hover:text-cyan-700'
        }
      >
        <ArrowRight className="h-3 w-3" />
        Onboarding
      </button>
      <button
        type="button"
        onClick={() => onChange('offboarding')}
        className={
          mode === 'offboarding'
            ? 'inline-flex h-8 items-center gap-1 bg-slate-950 px-3 text-[11px] font-semibold text-white'
            : 'inline-flex h-8 items-center gap-1 px-3 text-[11px] font-semibold text-slate-400 hover:bg-stone-100 hover:text-slate-950'
        }
      >
        <RotateCcw className="h-3 w-3" />
        Offboarding
      </button>
    </div>
  )
}

function WorkflowBuilderStyles() {
  return (
    <style>{`
      .addcond-wrap{position:relative;}
      .addcond-menu{position:absolute;top:38px;right:0;z-index:30;min-width:180px;display:flex;flex-direction:column;gap:2px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;padding:6px;box-shadow:0 12px 32px rgba(15,23,42,.14),0 4px 8px rgba(15,23,42,.06);}
      .addcond-empty{padding:8px 10px;font-size:11px;color:#9ca3af;}
      .field-opt{width:100%;border:0;background:transparent;border-radius:8px;padding:9px 10px;text-align:left;font-size:12px;font-weight:500;color:#374151;cursor:pointer;}
      .field-opt:hover{background:rgba(0,122,138,.07);color:#007a8a;}
      .add-field-btn{height:34px;padding:0 12px;border-radius:8px;border:1px dashed #d1d5db;background:transparent;font-size:11px;font-weight:500;color:#9ca3af;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:4px;font-family:inherit;white-space:nowrap;}
      .add-field-btn:hover{border-color:#007a8a;color:#007a8a;background:rgba(0,122,138,.07);}
      .add-field-btn:disabled{cursor:not-allowed;opacity:.5;}
      .cond-row{display:flex;align-items:center;gap:9px;}
      .cond-dim{font-size:12.5px;font-weight:600;color:#0a0a0a;min-width:96px;}
      .cond-is{font-size:11px;color:#9ca3af;font-style:italic;}
      .cond-rm-spacer{width:22px;flex-shrink:0;}
      .cond-rm{width:22px;height:22px;border:none;background:none;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#9ca3af;transition:all .15s;flex-shrink:0;}
      .cond-rm:hover{background:#fef2f2;color:#dc2626;}
      .ms{position:relative;flex:1;max-width:100%;}
      .ms-trigger{display:flex;align-items:center;gap:8px;width:100%;min-height:34px;padding:4px 10px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-family:inherit;transition:all .15s;}
      .ms-trigger:hover{border-color:rgba(0,122,138,.3);}
      .ms-any{font-size:12.5px;color:#9ca3af;flex:1;text-align:left;}
      .ms-vals{display:flex;flex-wrap:wrap;gap:4px;flex:1;min-width:0;}
      .ms-chip{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:rgba(0,122,138,.07);border:1px solid rgba(0,122,138,.3);color:#007a8a;}
      .ms-panel{position:absolute;top:38px;left:0;right:0;z-index:35;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.14),0 4px 8px rgba(15,23,42,.06);padding:5px;max-height:260px;overflow-y:auto;}
      .ms-search{display:flex;align-items:center;gap:6px;padding:6px 8px;margin-bottom:3px;border-bottom:1px solid #e5e7eb;position:sticky;top:-5px;background:#fff;}
      .ms-search input{border:none;outline:none;background:none;font-family:inherit;font-size:12.5px;color:#0a0a0a;width:100%;}
      .ms-search input::placeholder{color:#9ca3af;}
      .ms-none{font-size:11.5px;color:#9ca3af;padding:8px 10px;}
      .ms-opt{display:flex;align-items:center;justify-content:space-between;width:100%;padding:8px 10px;border-radius:8px;border:none;background:none;cursor:pointer;font-size:12.5px;color:#374151;font-family:inherit;transition:all .12s;text-align:left;}
      .ms-opt:hover{background:rgba(0,122,138,.07);}
      .ms-opt.on{color:#0a0a0a;font-weight:600;}
      .ms-opt svg{color:#007a8a;}
      .ms-div{height:1px;background:#e5e7eb;margin:4px 0;}
      .form-grp{display:flex;flex-direction:column;gap:5px;}
      .form-lbl{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#9ca3af;}
      .form-inp,.form-sel{height:36px;padding:0 11px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;font-size:13px;color:#0a0a0a;font-family:inherit;outline:none;transition:all .15s;width:100%;}
      .form-inp:focus,.form-sel:focus{border-color:#007a8a;box-shadow:0 0 0 3px rgba(0,122,138,.14);}
      .form-inp::placeholder{color:#9ca3af;}
      .lbl-hint{text-transform:none;letter-spacing:0;font-weight:400;color:#9ca3af;}
      .lbl-suggest{font-size:10px;color:#007a8a;margin-top:5px;display:block;}
      .gate-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .gate-opt{padding:10px 11px;border-radius:8px;border:1.5px solid #e5e7eb;cursor:pointer;background:#fff;text-align:left;font-family:inherit;transition:all .15s;}
      .gate-opt.h{border-color:#dc2626;background:#fef2f2;}
      .gate-opt.s{border-color:#b45309;background:#fffbeb;}
      .gate-opt-lbl{font-size:12px;font-weight:600;color:#0a0a0a;display:flex;align-items:center;gap:4px;}
      .gate-opt-desc{font-size:10px;color:#9ca3af;margin-top:2px;}
      .comp-pill{display:inline-flex;align-items:center;padding:2px 7px;border-radius:100px;font-size:9.5px;font-weight:700;background:rgba(0,122,138,.07);border:1px solid rgba(0,122,138,.3);color:#007a8a;letter-spacing:.02em;}
      .comp-seg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
      .comp-seg button{height:34px;border-radius:8px;border:1.5px solid #e5e7eb;background:#fff;font-size:11.5px;font-weight:600;color:#9ca3af;cursor:pointer;font-family:inherit;transition:all .15s;}
      .comp-seg button:hover{border-color:rgba(0,122,138,.3);color:#007a8a;}
      .comp-seg button.on{border-color:#007a8a;background:rgba(0,122,138,.07);color:#007a8a;}
      .comp-n{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:#374151;}
      .comp-n input{width:56px;height:32px;text-align:center;border-radius:8px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;color:#0a0a0a;outline:none;}
      .comp-n input:focus{border-color:#007a8a;box-shadow:0 0 0 3px rgba(0,122,138,.14);}
      .comp-readout{display:flex;align-items:center;gap:5px;margin-top:9px;font-size:11px;color:#374151;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:7px;padding:7px 10px;}
      .acctf{position:relative;}
      .acctf-trigger{display:flex;align-items:center;gap:8px;width:100%;height:42px;padding:0 12px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-family:inherit;transition:all .15s;}
      .acctf-trigger:hover{border-color:rgba(0,122,138,.3);}
      .acctf-role{font-size:12.5px;font-weight:600;color:#0a0a0a;flex-shrink:0;}
      .acctf-names{font-size:11px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .acctf-panel{position:absolute;top:46px;left:0;right:0;z-index:20;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.14),0 4px 8px rgba(15,23,42,.06);padding:6px;max-height:280px;overflow-y:auto;}
      .acctf-cap{font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;padding:6px 8px 8px;}
      .acctf-opt{display:flex;align-items:center;gap:9px;width:100%;padding:8px 9px;border-radius:8px;border:none;background:none;cursor:pointer;text-align:left;font-family:inherit;transition:all .12s;}
      .acctf-opt:hover{background:rgba(0,122,138,.07);}
      .acctf-opt.on{background:rgba(0,122,138,.07);}
      .acctf-opt-main{display:flex;flex-direction:column;flex:1;min-width:0;}
      .acctf-opt-role{font-size:12.5px;font-weight:600;color:#0a0a0a;}
      .acctf-opt-people{font-size:10.5px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .intg-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .intg-card{position:relative;display:flex;flex-direction:column;gap:3px;padding:11px 12px;border-radius:12px;border:1.5px solid #e5e7eb;background:#fff;cursor:pointer;text-align:left;font-family:inherit;transition:all .15s;}
      .intg-card:hover{border-color:rgba(0,122,138,.3);background:rgba(0,122,138,.07);}
      .intg-card.on{border-color:#007a8a;background:rgba(0,122,138,.07);box-shadow:0 0 0 3px rgba(0,122,138,.14);}
      .intg-top{display:flex;align-items:center;justify-content:space-between;}
      .intg-name{font-size:12.5px;font-weight:600;color:#0a0a0a;}
      .intg-blurb{font-size:10.5px;color:#9ca3af;}
      .dir-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .dir-toggle{display:flex;align-items:center;gap:6px;height:42px;padding:0 13px;border-radius:8px;border:1.5px solid #e5e7eb;background:#fff;font-size:12.5px;font-weight:600;color:#9ca3af;cursor:pointer;font-family:inherit;transition:all .15s;}
      .dir-toggle span{font-size:10.5px;font-weight:400;color:#9ca3af;margin-left:2px;}
      .dir-toggle:hover{border-color:rgba(0,122,138,.3);}
      .dir-toggle.on{border-color:#007a8a;background:rgba(0,122,138,.07);color:#007a8a;}
      .dir-toggle.on span{color:#007a8a;}
      .api-box{padding:12px;border-radius:12px;border:1px solid #e5e7eb;background:#f3f4f6;display:flex;flex-direction:column;gap:10px;}
      .api-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .dataflow{border:1px solid #e5e7eb;border-radius:12px;background:#f3f4f6;padding:12px;display:flex;flex-direction:column;gap:9px;}
      .df-line{display:flex;align-items:center;gap:7px;}
      .df-end{font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:100px;letter-spacing:.02em;}
      .df-end.levv{background:rgba(0,122,138,.07);border:1px solid rgba(0,122,138,.3);color:#007a8a;}
      .df-end.sys{background:#fff;border:1px solid #d1d5db;color:#374151;}
      .df-arrow{color:#9ca3af;display:flex;}
      .df-cap{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-left:2px;}
      .df-fields{display:flex;flex-wrap:wrap;gap:5px;}
      .df-chip{font-size:10.5px;font-weight:500;padding:3px 9px;border-radius:100px;border:1px solid #e5e7eb;background:#fff;color:#9ca3af;cursor:pointer;font-family:inherit;transition:all .12s;}
      .df-chip:hover{border-color:rgba(0,122,138,.3);color:#007a8a;}
      .df-chip.on{background:#007a8a;border-color:#007a8a;color:#fff;}
      .df-nova{display:flex;align-items:flex-start;gap:5px;font-size:10.5px;color:#007a8a;line-height:1.45;margin-top:1px;}
      .df-nova svg{flex-shrink:0;margin-top:1px;}
      .sys-rev{border:1px solid #e5e7eb;border-radius:12px;background:#fff;padding:11px 12px;display:flex;flex-direction:column;gap:9px;}
      .sys-rev-body{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#0a0a0a;}
      .sys-rev-body strong{font-weight:600;}
      .sys-rev-auto{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:100px;background:rgba(0,122,138,.07);border:1px solid rgba(0,122,138,.3);color:#007a8a;margin-left:auto;}
      .recon-row{display:flex;align-items:flex-start;gap:8px;font-size:11px;color:#374151;line-height:1.45;cursor:pointer;padding-top:9px;border-top:1px solid #e5e7eb;}
      .recon-row input{margin-top:2px;accent-color:#007a8a;width:14px;height:14px;flex-shrink:0;cursor:pointer;}
      .recon-row strong{color:#0a0a0a;font-weight:600;}
      .msel-list{display:flex;flex-direction:column;gap:6px;}
      .msel-empty{font-size:11.5px;color:#9ca3af;line-height:1.5;padding:10px 12px;border:1px dashed #d1d5db;border-radius:8px;background:#f3f4f6;}
      .msel-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid #e5e7eb;background:#fff;transition:all .15s;}
      .msel-row:hover{border-color:rgba(0,122,138,.3);}
      .msel-main{flex:1;min-width:0;}
      .msel-name{font-size:12.5px;font-weight:600;color:#0a0a0a;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:5px;}
      .msel-scope{font-size:9px;font-weight:600;padding:1px 6px;border-radius:100px;background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.2);color:#b45309;}
      .msel-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
      .msel-owner{font-size:10px;font-weight:600;padding:2px 8px;border-radius:100px;border:1px solid;}
      .msel-dot{color:#9ca3af;font-size:10px;}
      .msel-approver{display:inline-flex;align-items:center;gap:5px;}
      .msel-right{display:flex;align-items:center;gap:6px;flex-shrink:0;}
      .mavail{margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;display:flex;flex-direction:column;gap:4px;}
      .mavail-hd{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:3px;}
      .mavail-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 11px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-family:inherit;transition:all .15s;}
      .mavail-row:hover{border-color:rgba(0,122,138,.3);background:rgba(0,122,138,.07);}
      .mavail-name{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:#0a0a0a;}
      .mavail-name svg{color:#9ca3af;}
      .mavail-row:hover .mavail-name svg{color:#007a8a;}
      .mavail-meta{display:flex;align-items:center;gap:7px;flex-shrink:0;}
      .mavail-ap{font-size:10.5px;color:#9ca3af;font-weight:500;}
      .chip-x{width:13px;height:13px;border:none;background:none;cursor:pointer;color:#9ca3af;display:flex;align-items:center;justify-content:center;padding:0;border-radius:50%;transition:all .15s;}
      .chip-x:hover{background:#fef2f2;color:#dc2626;}
      .mode-seg-ui{display:inline-flex;border:1px solid #d1d5db;border-radius:8px;overflow:hidden;background:#fff;}
      .mode-btn-ui{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;border:none;background:#fff;color:#9ca3af;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .12s;}
      .mode-btn-ui+.mode-btn-ui{border-left:1px solid #e5e7eb;}
      .mode-btn-ui.on{color:#0a0a0a;background:#f3f4f6;}
      .mode-btn-ui.on.exit{background:#0a0a0a;color:#fff;}
      .connector-ui{display:flex;flex-direction:column;align-items:center;margin:0 auto;width:40px;}
      .conn-line-ui{width:2px;height:14px;}
      .conn-line-ui.hard{background:#fca5a5;}
      .conn-line-ui.soft{background:#fcd34d;}
      .conn-line-ui.exit{background:#d1d5db;}
      .conn-arrow-ui{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;}
      .conn-arrow-ui.hard{border-top:6px solid #f87171;}
      .conn-arrow-ui.soft{border-top:6px solid #f59e0b;}
      .conn-arrow-ui.exit{border-top:6px solid #9ca3af;}
      .m-block{border:1px solid #e5e7eb;border-radius:16px;background:#fff;cursor:pointer;transition:all .2s cubic-bezier(.4,0,.2,1);overflow:hidden;position:relative;}
      .m-block:hover{border-color:rgba(0,122,138,.3);box-shadow:0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.04);transform:translateY(-1px);}
      .m-block.sel{border-color:#007a8a;box-shadow:0 0 0 3px rgba(0,122,138,.14),0 4px 12px rgba(0,0,0,.08);transform:translateY(-1px);}
      .m-block.exit{cursor:default;}
      .m-block.exit:hover{transform:none;box-shadow:0 1px 3px rgba(0,0,0,.07);border-color:#d1d5db;}
      .grabbable{cursor:grab;}
      .grabbable:active{cursor:grabbing;}
      .m-block.dragging,.s-block.dragging{opacity:.4;}
      body.workflow-reordering{user-select:none;cursor:grabbing;}
      body.workflow-reordering *{cursor:grabbing!important;}
      .drop-line-ui{height:3px;background:#007a8a;border-radius:999px;margin:5px 2px;position:relative;animation:drop-line-in .12s ease;}
      .drop-line-ui::before{content:'';position:absolute;left:-2px;top:-3px;width:9px;height:9px;border-radius:50%;background:#007a8a;}
      @keyframes drop-line-in{from{transform:scaleX(.96);opacity:.35;}to{transform:scaleX(1);opacity:1;}}
      .accent-bar{position:absolute;left:0;top:0;bottom:0;width:4px;}
      .accent-bar.hard{background:#dc2626;}
      .accent-bar.soft{background:#b45309;}
      .accent-bar.exit{background:#0a0a0a;}
      .m-block-hd{padding:11px 14px 11px 18px;display:flex;align-items:center;gap:9px;}
      .blk-drag{color:#9ca3af;cursor:grab;flex-shrink:0;padding:2px;border-radius:4px;transition:color .15s;}
      .blk-drag:hover{color:#007a8a;}
      .blk-num{width:22px;height:22px;border-radius:5px;flex-shrink:0;border:1.5px solid #0a0a0a;background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#0a0a0a;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;transition:all .2s;}
      .m-block.sel .blk-num{background:#007a8a;border-color:#007a8a;color:#fff;}
      .m-block.exit .blk-num{background:#0a0a0a;border-color:#0a0a0a;color:#fff;}
      .blk-name{font-size:13px;font-weight:600;color:#0a0a0a;flex:1;display:flex;align-items:center;gap:6px;min-width:0;}
      .blk-badges{display:flex;align-items:center;gap:5px;flex-shrink:0;}
      .acct-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 3px;border-radius:999px;font-size:9.5px;font-weight:600;background:#f3f4f6;border:1px solid #e5e7eb;color:#374151;white-space:nowrap;}
      .bx-ava-stack{display:inline-flex;align-items:center;flex-shrink:0;}
      .bx-ava-stack .bx-ava:not(:first-child){margin-left:-7px;}
      .bx-ava{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;color:#fff;font-size:7px;font-weight:800;border:1.5px solid #fff;letter-spacing:0;line-height:1;flex-shrink:0;}
      .acct-pill .bx-ava{width:15px;height:15px;font-size:6px;}
      .bx-ava-more{background:#f3f4f6!important;color:#374151;border-color:#fff;}
      .bx-approver{display:inline-flex;align-items:center;gap:6px;}
      .gate-pill-ui{padding:2px 7px;border-radius:999px;font-size:10px;font-weight:600;flex-shrink:0;}
      .gate-pill-ui.hard{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;}
      .gate-pill-ui.soft{background:#fffbeb;border:1px solid #fde68a;color:#b45309;}
      .blk-rm{width:22px;height:22px;border:none;background:none;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#9ca3af;transition:all .15s;flex-shrink:0;}
      .blk-rm:hover{background:#fef2f2;color:#dc2626;}
      .blk-expand{max-height:0;overflow:hidden;transition:max-height .3s cubic-bezier(.4,0,.2,1);}
      .blk-expand.open{max-height:640px;}
      .blk-expand-in{padding:4px 14px 12px 18px;border-top:1px solid #e5e7eb;}
      .bx-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #e5e7eb;}
      .bx-row:last-child{border-bottom:none;}
      .bx-row-name{font-size:12px;color:#374151;flex:1;display:flex;align-items:center;gap:6px;min-width:0;}
      .bx-row-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
      .owner-pill-ui{border-radius:999px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;padding:2px 8px;font-size:10px;font-weight:700;}
      .s-block{border-radius:16px;overflow:hidden;cursor:pointer;transition:all .2s cubic-bezier(.4,0,.2,1);border:1px solid #1e293b;box-shadow:0 1px 3px rgba(0,0,0,.07);}
      .s-block:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(15,23,42,.22);border-color:#007a8a;}
      .s-block.sel{border-color:#007a8a;box-shadow:0 0 0 3px rgba(0,122,138,.14),0 4px 16px rgba(15,23,42,.22);transform:translateY(-1px);}
      .s-hd{background:#0f172a;padding:11px 14px;display:flex;align-items:center;gap:9px;}
      .s-num{width:22px;height:22px;border-radius:5px;flex-shrink:0;border:1.5px solid #334155;background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#e2e8f0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;transition:all .2s;}
      .s-block.sel .s-num{background:#007a8a;border-color:#007a8a;color:#fff;}
      .s-name{font-size:13px;font-weight:600;color:#e2e8f0;flex:1;display:flex;align-items:center;gap:7px;min-width:0;}
      .s-kind{font-size:8.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:rgba(0,122,138,.22);border:1px solid rgba(0,122,138,.4);color:#67e8f9;}
      .s-body{background:#131f35;padding:10px 14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
      .s-chip{font-size:10px;font-weight:500;padding:3px 8px;border-radius:5px;background:#1e293b;border:1px solid #334155;color:#94a3b8;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;display:flex;align-items:center;gap:4px;}
      .s-chip .bx-ava{width:14px;height:14px;font-size:6px;border-color:#1e293b;}
      .s-chip.ok{color:#34d399;border-color:rgba(52,211,153,.25);}
      .s-chip.warn{color:#fbbf24;border-color:rgba(251,191,36,.25);}
      .s-chip.exit{color:#67e8f9;border-color:rgba(0,122,138,.4);}
      .s-rm{width:22px;height:22px;border:none;background:none;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#475569;transition:all .15s;flex-shrink:0;margin-left:auto;}
      .s-rm:hover{background:rgba(248,113,113,.15);color:#f87171;}
      @media (max-width: 1024px){
        .cond-row{align-items:flex-start;}
        .cond-dim{min-width:86px;}
      }
    `}</style>
  )
}

function ProcessView({
  blocks,
  mode,
  onModeChange,
}: {
  blocks: PipelineBlock[]
  mode: BuilderMode
  onModeChange: (mode: BuilderMode) => void
}) {
  const isOffboarding = mode === 'offboarding'

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Process view</h2>
          <p className="text-xs text-slate-400">
            {isOffboarding
              ? 'Offboarding flow is derived from the authored blocks in reverse order'
              : 'Hard gates sequence the flow · soft gates can run in parallel'}
          </p>
        </div>
        <ModeSegment mode={mode} onChange={onModeChange} />
      </div>

      {blocks.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100 text-slate-400">
            <WorkflowIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              No process yet
            </h3>
            <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">
              Add workflow blocks in the builder to preview the process.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto px-4 py-5">
          <div className="flex min-w-max items-center gap-4">
            <ProcessEndpoint label={isOffboarding ? 'Exit' : 'Start'} />
            {blocks.map((block, index) => (
              <div key={block.pipelineId} className="flex items-center gap-4">
                <ProcessNode block={block} mode={mode} />
                {index < blocks.length - 1 && (
                  <div
                    className={
                      block.gate === 'hard'
                        ? 'h-px w-12 bg-red-300'
                        : 'h-px w-12 border-t border-dashed border-amber-400'
                    }
                  />
                )}
              </div>
            ))}
            <ProcessEndpoint label={isOffboarding ? 'Offboarded' : 'Active'} hollow />
          </div>
        </div>
      )}
    </section>
  )
}

function ProcessEndpoint({
  label,
  hollow = false,
}: {
  label: string
  hollow?: boolean
}) {
  return (
    <div className="flex min-w-20 flex-col items-center gap-2">
      <div
        className={
          hollow
            ? 'h-5 w-5 rounded-full border-2 border-cyan-700 bg-white shadow-[inset_0_0_0_4px_white] ring-4 ring-cyan-50'
            : 'h-5 w-5 rounded-full bg-cyan-700 ring-4 ring-cyan-50'
        }
      />
      <span className="font-mono text-[10px] font-medium text-slate-400">
        {label}
      </span>
    </div>
  )
}

function ProcessNode({
  block,
  mode,
}: {
  block: PipelineBlock
  mode: BuilderMode
}) {
  const isSystem = block.type === 'system'
  const isOffboarding = mode === 'offboarding'
  const systemMeta = integrationMeta(block.systemIntegration)
  const approverName = block.accountableOwner ? roleLabel(block.accountableOwner) : ''
  const approverPeople = block.accountableOwner
    ? resolvePeople(block.accountableOwner)
    : []

  return (
    <div
      className={
        isSystem
          ? 'w-56 rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-100 shadow-sm'
          : block.gate === 'hard'
            ? 'w-56 rounded-xl border border-slate-200 border-l-4 border-l-red-600 bg-white p-3 shadow-sm'
            : 'w-56 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-3 shadow-sm'
      }
    >
      <div
        className={
          isSystem
            ? 'flex items-start gap-2 truncate text-xs font-semibold text-slate-100'
            : 'flex items-start gap-2 truncate text-xs font-semibold text-slate-950'
        }
      >
        {isSystem ? (
          isOffboarding ? (
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
          ) : (
            <Cog className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
          )
        ) : null}
        <span className="min-w-0 truncate">{block.name}</span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-slate-400">
        {isSystem ? (
          <>
            <span>
              {isOffboarding
                ? block.systemUnwind?.action ?? 'reverse'
                : systemMeta?.label ?? 'System'}
            </span>
            <span>·</span>
            <span>
              {isOffboarding
                ? 'system reversal'
                : block.push && block.pull
                  ? 'push · pull'
                  : block.push
                    ? 'push'
                    : 'pull'}
            </span>
          </>
        ) : (
          <>
            <span>
              {block.requirements.length}{' '}
              {isOffboarding ? 'unwind' : 'req'}
              {block.requirements.length === 1 ? '' : 's'}
            </span>
            <span>·</span>
            <span>{block.gate === 'hard' ? 'hard gate' : 'soft gate'}</span>
          </>
        )}
      </div>

      {!isSystem && approverName && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
          <PeopleStack names={approverPeople.map((person) => person.name)} max={2} />
          <span>{approverName}</span>
        </div>
      )}

      {isSystem && !isOffboarding && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="s-chip ok">
            <Plug className="h-3 w-3" />
            {systemMeta?.label ?? 'API Call'}
          </span>
          {block.reconcile && (
            <span className="s-chip ok">reconcile</span>
          )}
        </div>
      )}
    </div>
  )
}

function ScopeInput({
  label,
  value,
  placeholder,
  className = '',
  onChange,
  onRemove,
}: {
  label: string
  value: string
  placeholder?: string
  className?: string
  onChange: (value: string) => void
  onRemove?: () => void
}) {
  return (
    <label className={`flex min-w-[160px] flex-col gap-1 ${className}`}>
      <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
      />
    </label>
  )
}

function ScopeSelect({
  label,
  value,
  options,
  onChange,
  onRemove,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  onRemove?: () => void
}) {
  return (
    <label className="flex min-w-[160px] flex-col gap-1">
      <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ScopeFieldInput({
  field,
  onChange,
  onRemove,
}: {
  field: BuilderScopeField
  onChange: (display: string) => void
  onRemove: () => void
}) {
  return (
    <ScopeInput
      label={field.label}
      value={field.display}
      onChange={onChange}
      onRemove={onRemove}
    />
  )
}

function ScopeConditionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}) {
  const selectedLabel = value ? optionLabel(options, value) : ''

  return (
    <div className="cond-row">
      <span className="cond-dim">{label}</span>
      <span className="cond-is">is</span>
      <SearchableMultiSelect
        options={options.map((option) => option.label)}
        values={selectedLabel ? [selectedLabel] : []}
        single
        onChange={(labels) => {
          const nextLabel = labels[labels.length - 1] ?? ''
          const nextOption = options.find((option) => option.label === nextLabel)
          onChange(nextOption?.value ?? '')
        }}
      />
      <span className="cond-rm-spacer" />
    </div>
  )
}

function ScopeConditionInput({
  field,
  locationRows,
  onChange,
  onRemove,
}: {
  field: BuilderScopeField
  locationRows: LocationRecord[]
  onChange: (display: string, valueId?: number) => void
  onRemove: () => void
}) {
  const optionRecords = conditionOptionsForScopeField(field, locationRows)
  const values = splitConditionDisplay(field.display)

  return (
    <div className="cond-row">
      <span className="cond-dim">{field.label}</span>
      <span className="cond-is">is</span>
      <SearchableMultiSelect
        options={optionRecords.map((option) => option.label)}
        values={values}
        onChange={(nextValues) => {
          const display = nextValues.length
            ? nextValues.join(' or ')
            : field.display
          const selectedRecord =
            nextValues.length === 1
              ? optionRecords.find((option) => option.label === nextValues[0])
              : undefined
          onChange(display, selectedRecord?.valueId)
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
        aria-label={`Remove ${field.label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

type ConditionOptionRecord = {
  label: string
  valueId?: number
}

const FALLBACK_CONDITION_VALUES: Record<ScopeFieldKey, string[]> = {
  location: [
    'New York',
    'Bangalore',
    'Toronto',
    'Ontario',
    'London',
    'Remote',
    'Hybrid',
  ],
  cost_center: ['CC-1000', 'CC-2000', 'CC-3000', 'CC-4000'],
  business_unit: ['Commercial', 'Enterprise', 'SMB', 'International'],
  role: [
    'Software Engineer - New York, New York, US',
    'Product Manager',
    'Finance Analyst',
    'IT Administrator',
  ],
  supplier: ['Randstad', 'Adecco', 'ManpowerGroup', 'Direct sourced'],
}

function splitConditionDisplay(display: string) {
  return display
    .split(/\s+or\s+/i)
    .map((value) => value.trim())
    .filter(Boolean)
}

function conditionOptionsForScopeField(
  field: BuilderScopeField,
  locationRows: LocationRecord[],
): ConditionOptionRecord[] {
  const currentValues = splitConditionDisplay(field.display).map((label) => ({
    label,
    valueId: field.valueId,
  }))
  const fallbackValues = FALLBACK_CONDITION_VALUES[field.fieldKey].map(
    (label) => ({ label }),
  )
  const locationValues =
    field.fieldKey === 'location'
      ? locationRows.map((location) => ({
          label: formatLocationDisplay(location),
          valueId: location.id,
        }))
      : []

  const seen = new Set<string>()
  return [...currentValues, ...locationValues, ...fallbackValues].filter(
    (option) => {
      const key = option.label.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    },
  )
}

function SearchableMultiSelect({
  options,
  values,
  single = false,
  onChange,
}: {
  options: string[]
  values: string[]
  single?: boolean
  onChange: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="ms">
      <button
        type="button"
        className="ms-trigger"
        onClick={() => {
          setOpen((current) => !current)
          setQuery('')
        }}
      >
        {values.length === 0 ? (
          <span className="ms-any">Any</span>
        ) : (
          <span className="ms-vals">
            {values.map((value) => (
              <span key={value} className="ms-chip">
                {value}
              </span>
            ))}
          </span>
        )}
        <ChevronLeft
          className={
            open
              ? 'h-3 w-3 shrink-0 rotate-90 text-slate-400'
              : 'h-3 w-3 shrink-0 -rotate-90 text-slate-400'
          }
        />
      </button>
      {open && (
        <div className="ms-panel">
          <div className="ms-search">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
            />
          </div>
          {!single && (
            <>
              <button
                type="button"
                className={`ms-opt ${values.length === 0 ? 'on' : ''}`}
                onClick={() => onChange([])}
              >
                <span>Any</span>
                {values.length === 0 && <Check className="h-3 w-3" />}
              </button>
              <div className="ms-div" />
            </>
          )}
          {filteredOptions.map((option) => {
            const selected = values.includes(option)
            return (
              <button
                key={option}
                type="button"
                className={`ms-opt ${selected ? 'on' : ''}`}
                onClick={() => {
                  if (single) {
                    onChange([option])
                    setOpen(false)
                    return
                  }

                  onChange(
                    selected
                      ? values.filter((value) => value !== option)
                      : [...values, option],
                  )
                }}
              >
                <span>{option}</span>
                {selected && <Check className="h-3 w-3" />}
              </button>
            )
          })}
          {filteredOptions.length === 0 && (
            <div className="ms-none">No matches</div>
          )}
        </div>
      )}
    </div>
  )
}

function blockSignoffLabel(block: Pick<LibraryBlock, 'name' | 'type'>) {
  const normalized = block.name.toLowerCase()
  if (normalized.includes('identity')) return 'People Ops sign-off'
  if (normalized.includes('legal')) return 'Legal sign-off'
  if (normalized.includes('vendor')) return 'Vendor & insurance sign-off'
  if (normalized.includes('workday')) return 'IT provisioning'
  return block.type === 'system' ? 'System' : 'Team sign-off'
}

function LibraryBlockCard({
  block,
  isUsed,
  canDrag,
  integrationOptions,
  onDragStart,
  onDragEnd,
  onMouseDown,
  onEdit,
  onRemove,
}: {
  block: LibraryBlock
  isUsed: boolean
  canDrag: boolean
  integrationOptions: Option[]
  onDragStart: (event: DragEvent<HTMLDivElement>, blockId: string) => void
  onDragEnd: () => void
  onMouseDown: (event: MouseEvent<HTMLDivElement>, block: LibraryBlock) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const isSystem = block.type === 'system'
  const accountableLabel = block.accountableOwner
    ? roleLabel(block.accountableOwner)
    : blockSignoffLabel(block)
  const accountablePeople = block.accountableOwner
    ? resolvePeople(block.accountableOwner).map((person) => person.name)
    : []
  const completion = block.completionRule
    ? completionLabel(block.completionRule, block.completionN, block.requirements.length)
    : null
  const integration = block.systemIntegration
    ? integrationMeta(block.systemIntegration)
    : undefined

  return (
    <div
      draggable={false}
      onDragStart={(event) => onDragStart(event, block.id)}
      onDragEnd={onDragEnd}
      onMouseDown={(event) => onMouseDown(event, block)}
      className={
        isUsed
          ? 'rounded-xl border border-slate-200 bg-slate-100 p-3 opacity-50'
          : !canDrag
            ? 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm'
            : isSystem
            ? 'cursor-grab rounded-xl border border-slate-200 border-l-4 border-l-slate-800 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 active:cursor-grabbing'
            : 'cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 active:cursor-grabbing'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-semibold">{block.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-bold text-slate-950">
              {block.gate === 'hard' ? 'Hard' : 'Soft'}
            </span>
            {completion && (
              <span className="comp-pill" style={{ fontSize: 9 }}>
                {completion}
              </span>
            )}
            {block.accountableOwner && (
              <span
                className="acct-pill"
                title={`${accountableLabel}: ${accountablePeople.join(', ')}`}
              >
                <PeopleStack names={accountablePeople} max={2} />
                {accountableLabel}
              </span>
            )}
            {isSystem && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                <Cog className="h-2 w-2" />
                System
              </span>
            )}
            {isUsed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                <Check className="h-2 w-2" />
                Added
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isUsed && (
            <button
              type="button"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label={`Remove ${block.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {isSystem ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="s-chip ok">
            <Plug className="h-3 w-3" />
            {integration?.label ??
              optionLabel(integrationOptions, block.integrationType || '')}
          </span>
          {block.push && (
            <span className="s-chip ok">{block.pull ? 'push · pull' : 'push'}</span>
          )}
          {block.reconcile && <span className="s-chip ok">reconcile</span>}
        </div>
      ) : (
        <ul className="mt-2 space-y-1">
          {block.requirements.map((requirement) => (
            <li
              key={requirement.id}
              className="flex items-center gap-1 text-[10px] text-slate-600"
            >
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              {requirement.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PipelineBlockCard({
  block,
  mode,
  displayOrder,
  selected,
  dragging,
  showConnector,
  readonly,
  onSelect,
  onMouseDown,
  onRemove,
}: {
  block: PipelineBlock
  mode: BuilderMode
  displayOrder: number
  selected: boolean
  dragging: boolean
  showConnector: boolean
  readonly: boolean
  onSelect: () => void
  onMouseDown: (event: MouseEvent<HTMLDivElement>) => void
  onRemove: () => void
}) {
  const isSystem = block.type === 'system'
  const isOffboarding = mode === 'offboarding'
  const gateTone = isOffboarding ? 'exit' : block.gate
  const signoffLabel = blockSignoffLabel(block)
  const accountableLabel = block.accountableOwner
    ? roleLabel(block.accountableOwner)
    : signoffLabel
  const accountablePeople = block.accountableOwner
    ? resolvePeople(block.accountableOwner).map((person) => person.name)
    : []
  const completion = block.completionRule
    ? completionLabel(block.completionRule, block.completionN, block.requirements.length)
    : null
  const systemMeta = integrationMeta(block.systemIntegration)

  return (
    <>
      <div
        data-pipeline-id={block.pipelineId}
        role="button"
        tabIndex={0}
        onClick={readonly ? onSelect : undefined}
        onMouseDown={onMouseDown}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect()
        }}
        className={
          isSystem
            ? `s-block ${selected ? 'sel' : ''} ${!readonly ? 'grabbable' : ''} ${
                dragging ? 'dragging' : ''
              }`
            : `m-block ${selected ? 'sel' : ''} ${
                isOffboarding ? 'exit' : ''
              } ${!readonly ? 'grabbable' : ''} ${dragging ? 'dragging' : ''}`
        }
      >
        {isSystem ? (
          <>
            <div className="s-hd">
              {!readonly && <GripVertical className="blk-drag h-4 w-4" />}
              <span className="s-num">
                {displayOrder}
              </span>
              <span className="s-name">
                {isOffboarding ? (
                  <RotateCcw className="h-4 w-4 text-cyan-300" />
                ) : (
                  <Cog className="h-4 w-4 text-cyan-300" />
                )}
                {block.name}
                <span className="s-kind">
                  {isOffboarding ? 'Reverse' : accountableLabel}
                </span>
              </span>
              {!readonly && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove()
                  }}
                  className="s-rm no-drag"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="s-body">
              {isOffboarding ? (
                <>
                  <span className="s-chip exit">
                    <RotateCcw className="h-2.5 w-2.5" />
                    Reverse external state
                  </span>
                  <span className="s-chip exit">
                    <Zap className="h-3 w-3" />
                    Nova automated
                  </span>
                </>
              ) : (
                <>
                  <span className="s-chip ok">
                    <Plug className="h-3 w-3" />
                    {systemMeta?.label ??
                      (block.integrationType === 'api_call'
                        ? 'API Call'
                        : 'Integration')}
                  </span>
                  <span className="s-chip ok">
                    <PeopleStack names={accountablePeople} max={2} />
                    {accountableLabel}
                  </span>
                  <span className="s-chip warn">
                    {gateLabel(block.gate)}
                  </span>
                  {block.push && (
                    <span className="s-chip ok">
                      {block.pull ? 'push · pull' : 'push'}
                    </span>
                  )}
                  {block.reconcile && <span className="s-chip ok">reconcile</span>}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div
              className={`accent-bar ${gateTone}`}
            />
            <div className="m-block-hd">
              {!readonly && <GripVertical className="blk-drag h-4 w-4" />}
              <span className="blk-num">
                {displayOrder}
              </span>
              <span className="blk-name">
                {block.name}
              </span>
              <span className="blk-badges">
                {completion && !isOffboarding && (
                  <span className="comp-pill">{completion}</span>
                )}
                {!isOffboarding && block.accountableOwner && (
                  <span
                    className="acct-pill"
                    title={`${accountableLabel}: ${accountablePeople.join(', ')}`}
                  >
                    <PeopleStack names={accountablePeople} max={2} />
                    {accountableLabel}
                  </span>
                )}
                {!isOffboarding && (
                  <span className={`gate-pill-ui ${block.gate}`}>
                    {gateLabel(block.gate)}
                  </span>
                )}
                <span className="font-mono text-[10px] text-slate-400">
                  {block.requirements.length}{' '}
                  {isOffboarding ? 'unwind' : 'req'}
                  {block.requirements.length === 1 ? '' : 's'}
                </span>
              </span>
              {!readonly && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove()
                  }}
                  className="blk-rm no-drag"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className={`blk-expand ${selected || isOffboarding ? 'open' : ''}`}>
              <div className="blk-expand-in">
                <div className="mb-1 grid grid-cols-[1fr_auto] text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  <span>{isOffboarding ? 'Unwind task' : 'Requirement'}</span>
                  <span>{isOffboarding ? 'Queue' : 'Owner'}</span>
                </div>
                <div>
                  {block.requirements.map((requirement) => (
                    <div
                      key={requirement.id}
                      className="bx-row"
                    >
                      <span className="bx-row-name">
                        {isOffboarding
                          ? `Reverse ${requirement.name}`
                          : requirement.name}
                      </span>
                      <span className="bx-row-right">
                        <span className="bx-approver">
                          <PeopleStack names={[ownerLabel(requirement.owner)]} max={1} />
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ownerClass(
                              requirement.owner,
                            )}`}
                          >
                            {ownerLabel(requirement.owner)}
                          </span>
                        </span>
                      </span>
                    </div>
                  ))}
                  {block.requirements.length === 0 && (
                    <div className="bx-row">
                      <span className="bx-row-name text-slate-400">
                        No requirements
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showConnector && (
        <div className="connector-ui">
          <div className={`conn-line-ui ${gateTone}`} />
          <div className={`conn-arrow-ui ${gateTone}`} />
          <div className={`conn-line-ui ${gateTone}`} />
        </div>
      )}
    </>
  )
}

function HealthRow({
  icon,
  label,
  value,
  tone,
  labelClassName = '',
}: {
  icon: ReactNode
  label: string
  value: number
  tone?: 'good' | 'bad'
  labelClassName?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`flex items-center gap-1.5 text-slate-400 ${labelClassName}`}
      >
        {icon}
        {label}
      </span>
      <span
        className={
          tone === 'good'
            ? 'font-mono text-xs font-bold text-green-700'
            : tone === 'bad'
              ? 'font-mono text-xs font-bold text-red-700'
              : 'font-mono text-xs font-bold text-slate-900'
        }
      >
        {value}
      </span>
    </div>
  )
}

function ChecklistItem({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div
      className={
        pass
          ? 'flex items-center gap-1.5 text-[11px] text-green-700'
          : 'flex items-center gap-1.5 text-[11px] text-slate-400'
      }
    >
      {pass ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </div>
  )
}

function GateOption({
  gate,
  active,
  onClick,
}: {
  gate: GateType
  active: boolean
  onClick: () => void
}) {
  const isHard = gate === 'hard'
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? isHard
            ? 'rounded-lg border border-red-500 bg-red-50 px-3 py-3 text-left'
            : 'rounded-lg border border-amber-500 bg-amber-50 px-3 py-3 text-left'
          : 'rounded-lg border border-slate-200 bg-white px-3 py-3 text-left hover:border-cyan-300'
      }
    >
      <div className="flex items-center gap-1 text-xs font-semibold text-slate-900">
        {isHard ? (
          <Shield className="h-3 w-3 text-red-600" />
        ) : (
          <Zap className="h-3 w-3 text-amber-600" />
        )}
        {gateLabel(gate)}
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        {isHard
          ? 'Blocks all progression until complete'
          : 'Allows progression with warnings'}
      </p>
    </button>
  )
}

function Modal({
  title,
  children,
  footer,
  maxWidthClassName = 'max-w-xl',
  onClose,
}: {
  title: string
  children: ReactNode
  footer: ReactNode
  maxWidthClassName?: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div
        className={`w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${maxWidthClassName}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">{children}</div>
        <div className="border-t border-slate-200 bg-slate-100 px-5 py-3">
          {footer}
        </div>
      </div>
    </div>
  )
}
