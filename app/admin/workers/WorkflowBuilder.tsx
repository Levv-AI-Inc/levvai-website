'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
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
  Info,
  Link2,
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
  type WorkflowDependency,
  type WorkflowHealth,
  type WorkflowLookups,
  type WorkflowType as ApiWorkflowType,
} from '@/lib/api/complianceWorkflows'
import { getBusinessUnits, type BusinessUnitRecord } from '@/lib/api/businessUnits'
import { getCostCenters, type CostCenterRecord } from '@/lib/api/costCenters'
import { getLocations, type LocationRecord } from '@/lib/api/locations'
import { getRoles, type RoleRecord } from '@/lib/api/roles'
import { getSuppliers, type SupplierRecord } from '@/lib/api/suppliers'
import OnboardingFlowEditor from '../../../src/components/onboarding-flow/OnboardingFlowEditor'
import {
  END_NODE_ID,
  START_NODE_ID,
} from '../../../src/components/onboarding-flow/types'

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
  clientKey: string
  order: number
  graphLevel: number
  encodedGraphPosition?: number
}

type PipelineDependency = {
  id: string
  from: string
  to: string
}

type PersistedGraphConfig = {
  incoming?: string[]
  outgoing?: string[]
}

type BuilderScopeField = {
  id: string
  fieldKey: ScopeFieldKey
  label: string
  display: string
  valueId: number
  values: string[]
  valueIds: Record<string, number>
}

type ScopeState = {
  name: string
  workerType: WorkerType
  workerTypes: WorkerType[]
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

const GRAPH_CONFIG_KEY = 'workflow_graph'
const GRAPH_POSITION_OFFSET = 100000
const GRAPH_POSITION_ORDER_BUCKET = 100
const GRAPH_POSITION_OUTGOING_BUCKET = 1000

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

function readRecordId(value: number | string | undefined | null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  return undefined
}

function formatCostCenterDisplay(costCenter: CostCenterRecord) {
  return [costCenter.code, costCenter.name].filter(Boolean).join(' · ')
}

function formatBusinessUnitDisplay(businessUnit: BusinessUnitRecord) {
  return [businessUnit.code, businessUnit.name].filter(Boolean).join(' · ')
}

function formatRoleDisplay(role: RoleRecord) {
  return [role.name, role.location_label].filter(Boolean).join(' · ')
}

function formatSupplierDisplay(supplier: SupplierRecord) {
  return supplier.name || supplier.supplier_code || supplier.supplier_id
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
  const label = field.label || fieldKeyLabel(field.field_key)
  const display = field.display || (valueId ? `${label} #${valueId}` : '')
  const values = splitConditionDisplay(display)
  if (!display && !valueId) return null

  return {
    id: String(field.id ?? randomId('scope-field')),
    fieldKey: field.field_key,
    label,
    display,
    valueId: valueId ?? 0,
    values,
    valueIds:
      valueId && values.length === 1
        ? { [values[0]]: valueId }
        : {},
  }
}

function mergeScopeFields(fields: BuilderScopeField[]) {
  const merged: BuilderScopeField[] = []

  fields.forEach((field) => {
    const existing = merged.find(
      (candidate) => candidate.fieldKey === field.fieldKey,
    )
    if (!existing) {
      merged.push(field)
      return
    }

    const nextValues = [...existing.values]
    field.values.forEach((value) => {
      if (!nextValues.includes(value)) nextValues.push(value)
    })
    const nextValueIds = { ...existing.valueIds, ...field.valueIds }

    existing.values = nextValues
    existing.valueIds = nextValueIds
    existing.display = nextValues.join(' or ')
    if (!existing.valueId && field.valueId) existing.valueId = field.valueId
  })

  return merged
}

function serializeScopeFieldValue(
  field: BuilderScopeField,
  sequence: number,
  display: string,
): PolicyScopeField {
  const rawValueId =
    field.valueIds[display] ?? (field.values.length === 1 ? field.valueId : 0)
  const valueId = rawValueId > 0 ? rawValueId : undefined
  const base = {
    sequence,
    field_key: field.fieldKey,
    operator: 'equals' as const,
    label: field.label,
    display,
  }

  switch (field.fieldKey) {
    case 'location':
      return valueId ? { ...base, location: valueId } : base
    case 'cost_center':
      return valueId ? { ...base, cost_center: valueId } : base
    case 'business_unit':
      return valueId ? { ...base, business_unit: valueId } : base
    case 'role':
      return valueId ? { ...base, role_definition: valueId } : base
    case 'supplier':
      return valueId ? { ...base, supplier: valueId } : base
  }
}

function serializeScopeFields(fields: BuilderScopeField[]): PolicyScopeField[] {
  const payloadFields: PolicyScopeField[] = []

  fields.forEach((field) => {
    const values = field.values.length
      ? field.values
      : splitConditionDisplay(field.display)

    values.forEach((value) => {
      const valueId =
        field.valueIds[value] ?? (values.length === 1 ? field.valueId : 0)
      if (!valueId) return

      payloadFields.push(
        serializeScopeFieldValue(field, payloadFields.length + 1, value),
      )
    })
  })

  return payloadFields
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

function workflowBlockClientKey(block: WorkflowBlock) {
  return block.client_key || (block.id ? `block-${block.id}` : randomId('block-key'))
}

function isLegacyAutoBlock(block: WorkflowBlock) {
  const normalizedName = block.name
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, ' and ')
  return (
    normalizedName === 'account and equipment' ||
    normalizedName.startsWith('account and equipment ')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function readPersistedGraphConfig(
  config: Record<string, unknown> | undefined,
): PersistedGraphConfig {
  const graph = config?.[GRAPH_CONFIG_KEY]
  if (!isRecord(graph)) return {}

  return {
    incoming: readStringList(graph.incoming),
    outgoing: readStringList(graph.outgoing),
  }
}

function hasPersistedGraphConfig(graphConfig: PersistedGraphConfig) {
  return Boolean(graphConfig.incoming?.length || graphConfig.outgoing?.length)
}

function persistedGraphConfigFromBlock(block: WorkflowBlock) {
  const configGraph = readPersistedGraphConfig(block.config)
  if (hasPersistedGraphConfig(configGraph)) return configGraph
  return block.layout?.workflow_graph ?? {}
}

function endpointKeyForPipelineId(
  pipelineId: string,
  blocks: PipelineBlock[],
) {
  if (pipelineId === START_NODE_ID || pipelineId === END_NODE_ID) {
    return pipelineId
  }
  return blocks.find((block) => block.pipelineId === pipelineId)?.clientKey
}

function graphConfigForBlock(
  block: PipelineBlock,
  dependencies: PipelineDependency[],
  blocks: PipelineBlock[],
): PersistedGraphConfig {
  const incoming = dependencies
    .filter((dependency) => dependency.to === block.pipelineId)
    .map((dependency) => endpointKeyForPipelineId(dependency.from, blocks))
    .filter((key): key is string => Boolean(key))
  const outgoing = dependencies
    .filter((dependency) => dependency.from === block.pipelineId)
    .map((dependency) => endpointKeyForPipelineId(dependency.to, blocks))
    .filter((key): key is string => Boolean(key))

  return {
    incoming: Array.from(new Set(incoming)),
    outgoing: Array.from(new Set(outgoing)),
  }
}

function withPersistedGraphConfig(
  config: Record<string, unknown> | undefined,
  graphConfig: PersistedGraphConfig,
) {
  return {
    ...(config ?? {}),
    [GRAPH_CONFIG_KEY]: graphConfig,
  }
}

function configWithWorkflowGraphFromBlock(block: WorkflowBlock) {
  const graphConfig = persistedGraphConfigFromBlock(block)
  if (!hasPersistedGraphConfig(graphConfig)) return block.config
  return withPersistedGraphConfig(block.config, graphConfig)
}

function decodeGraphPosition(position: number | undefined) {
  if (!position || position < GRAPH_POSITION_OFFSET) {
    return {
      order: position && position > 0 ? position : undefined,
      hasStartIncoming: false,
      outgoingMask: 0,
    }
  }

  const raw = Math.max(0, Math.floor(position - GRAPH_POSITION_OFFSET))
  const order = raw % GRAPH_POSITION_ORDER_BUCKET
  const flags = Math.floor(raw / GRAPH_POSITION_ORDER_BUCKET)
  const outgoingMask = Math.floor(raw / GRAPH_POSITION_OUTGOING_BUCKET)

  return {
    order: order > 0 ? order : undefined,
    hasStartIncoming: flags % 10 === 1,
    outgoingMask,
  }
}

function addMaskBit(mask: number, bit: number) {
  if (bit < 0 || bit > 30) return mask
  const value = 2 ** bit
  return Math.floor(mask / value) % 2 === 1 ? mask : mask + value
}

function hasMaskBit(mask: number, bit: number) {
  if (bit < 0 || bit > 30) return false
  const value = 2 ** bit
  return Math.floor(mask / value) % 2 === 1
}

function encodeGraphPosition(
  block: PipelineBlock,
  dependencies: PipelineDependency[],
  blocks: PipelineBlock[],
) {
  const order = Math.max(
    1,
    Math.min(
      block.order || blocks.findIndex((candidate) => candidate.pipelineId === block.pipelineId) + 1,
      GRAPH_POSITION_ORDER_BUCKET - 1,
    ),
  )
  const hasStartIncoming = dependencies.some(
    (dependency) =>
      dependency.from === START_NODE_ID && dependency.to === block.pipelineId,
  )
  const outgoingMask = dependencies
    .filter((dependency) => dependency.from === block.pipelineId)
    .reduce((mask, dependency) => {
      if (dependency.to === END_NODE_ID) return addMaskBit(mask, 0)
      const targetIndex = blocks.findIndex(
        (candidate) => candidate.pipelineId === dependency.to,
      )
      if (targetIndex < 0) return mask
      return addMaskBit(mask, targetIndex + 1)
    }, 0)

  return (
    GRAPH_POSITION_OFFSET +
    order +
    (hasStartIncoming ? GRAPH_POSITION_ORDER_BUCKET : 0) +
    outgoingMask * GRAPH_POSITION_OUTGOING_BUCKET
  )
}

function mapWorkflowBlock(block: WorkflowBlock, index: number): PipelineBlock {
  const id = String(block.id ?? randomId('block'))
  const clientKey = workflowBlockClientKey(block)
  const graphPosition = decodeGraphPosition(block.layout?.position)

  return {
    id: `saved-${id}`,
    pipelineId: `pipeline-${clientKey}`,
    clientKey,
    order: graphPosition.order ?? index + 1,
    graphLevel: Math.max(0, block.layout?.level ?? index),
    encodedGraphPosition: block.layout?.position,
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
    config: configWithWorkflowGraphFromBlock(block),
  }
}

function serializePipelineBlock(
  block: PipelineBlock,
  index: number,
  dependencies: PipelineDependency[],
  blocks: PipelineBlock[],
): WorkflowBlock {
  const persistedConfig = withPersistedGraphConfig(
    block.config,
    graphConfigForBlock(block, dependencies, blocks),
  )

  if (block.type === 'system') {
    return {
      client_key: block.clientKey,
      sequence: index + 1,
      block_type: 'system',
      name: block.name.trim(),
      gate_type: block.gate,
      integration_type: block.integrationType || 'api_call',
      config: {
        endpoint_key: endpointKeyFromName(block.name),
        ...persistedConfig,
      },
      layout: {
        level: block.graphLevel,
        position: encodeGraphPosition(block, dependencies, blocks),
        [GRAPH_CONFIG_KEY]: graphConfigForBlock(block, dependencies, blocks),
      },
      requirements: [],
    }
  }

  return {
    client_key: block.clientKey,
    sequence: index + 1,
    block_type: 'requirement',
    name: block.name.trim(),
    gate_type: block.gate,
    config: persistedConfig,
    layout: {
      level: block.graphLevel,
      position: encodeGraphPosition(block, dependencies, blocks),
      [GRAPH_CONFIG_KEY]: graphConfigForBlock(block, dependencies, blocks),
    },
    requirements: block.requirements.map((requirement, requirementIndex) => ({
      sequence: requirementIndex + 1,
      name: requirement.name.trim(),
      owner: requirement.owner,
    })),
  }
}

function resolveDependencyEndpoint(
  blockKey: string | undefined,
  blockId: number | null | undefined,
  byClientKey: Map<string, string>,
  byServerId: Map<number, string>,
) {
  if (blockKey === START_NODE_ID || blockKey === END_NODE_ID) return blockKey
  return (
    (blockKey ? byClientKey.get(blockKey) : undefined) ??
    (blockId ? byServerId.get(blockId) : undefined)
  )
}

function mapWorkflowDependencies(
  dependencies: WorkflowDependency[],
  blocks: PipelineBlock[],
): PipelineDependency[] {
  const byClientKey = new Map(blocks.map((block) => [block.clientKey, block.pipelineId]))
  const byServerId = new Map(
    blocks
      .map((block) => {
        const id = block.id.startsWith('saved-')
          ? Number(block.id.replace('saved-', ''))
          : NaN
        return Number.isFinite(id) ? ([id, block.pipelineId] as const) : null
      })
      .filter((entry): entry is readonly [number, string] => Boolean(entry)),
  )

  return dependencies
    .map((dependency) => {
      const from = resolveDependencyEndpoint(
        dependency.from_block_key,
        dependency.from_block,
        byClientKey,
        byServerId,
      )
      const to = resolveDependencyEndpoint(
        dependency.to_block_key,
        dependency.to_block,
        byClientKey,
        byServerId,
      )
      if (!from || !to || from === to) return null
      return {
        id: String(dependency.id ?? `${from}->${to}`),
        from,
        to,
      }
    })
    .filter((dependency): dependency is PipelineDependency => Boolean(dependency))
}

function mapPersistedGraphConfigDependencies(
  blocks: PipelineBlock[],
): PipelineDependency[] {
  const byClientKey = new Map(
    blocks.map((block) => [block.clientKey, block.pipelineId]),
  )

  function resolveKey(key: string) {
    if (key === START_NODE_ID || key === END_NODE_ID) return key
    return byClientKey.get(key)
  }

  const dependencies: PipelineDependency[] = []
  const seen = new Set<string>()

  blocks.forEach((block) => {
    const graphConfig = readPersistedGraphConfig(block.config)

    graphConfig.incoming?.forEach((fromKey) => {
      const from = resolveKey(fromKey)
      if (!from || from === block.pipelineId) return
      const key = `${from}->${block.pipelineId}`
      if (seen.has(key)) return
      seen.add(key)
      dependencies.push({
        id: `persisted-${key}`,
        from,
        to: block.pipelineId,
      })
    })

    graphConfig.outgoing?.forEach((toKey) => {
      const to = resolveKey(toKey)
      if (!to || to === block.pipelineId) return
      const key = `${block.pipelineId}->${to}`
      if (seen.has(key)) return
      seen.add(key)
      dependencies.push({
        id: `persisted-${key}`,
        from: block.pipelineId,
        to,
      })
    })
  })

  return dependencies
}

function mapEncodedGraphPositionDependencies(
  blocks: PipelineBlock[],
): PipelineDependency[] {
  const dependencies: PipelineDependency[] = []
  const seen = new Set<string>()

  function addDependency(from: string, to: string) {
    if (from === to) return
    const key = `${from}->${to}`
    if (seen.has(key)) return
    seen.add(key)
    dependencies.push({
      id: `encoded-${key}`,
      from,
      to,
    })
  }

  blocks.forEach((block) => {
    const graphPosition = decodeGraphPosition(block.encodedGraphPosition)
    if (graphPosition.hasStartIncoming) {
      addDependency(START_NODE_ID, block.pipelineId)
    }
    if (hasMaskBit(graphPosition.outgoingMask, 0)) {
      addDependency(block.pipelineId, END_NODE_ID)
    }
    blocks.forEach((target, targetIndex) => {
      if (hasMaskBit(graphPosition.outgoingMask, targetIndex + 1)) {
        addDependency(block.pipelineId, target.pipelineId)
      }
    })
  })

  return dependencies
}

function mergePipelineDependencies(
  ...dependencyGroups: PipelineDependency[][]
) {
  const merged: PipelineDependency[] = []
  const seen = new Set<string>()

  dependencyGroups.flat().forEach((dependency) => {
    if (dependency.from === dependency.to) return
    const key = `${dependency.from}->${dependency.to}`
    if (seen.has(key)) return
    seen.add(key)
    merged.push(dependency)
  })

  return merged
}

function serializePipelineDependencies(
  dependencies: PipelineDependency[],
  blocks: PipelineBlock[],
): WorkflowDependency[] {
  const keyByPipelineId = new Map(
    [
      [START_NODE_ID, START_NODE_ID],
      [END_NODE_ID, END_NODE_ID],
      ...blocks.map((block) => [block.pipelineId, block.clientKey] as const),
    ],
  )
  const serialized: WorkflowDependency[] = []
  const seen = new Set<string>()

  dependencies.forEach((dependency) => {
    const fromKey = keyByPipelineId.get(dependency.from)
    const toKey = keyByPipelineId.get(dependency.to)
    if (!fromKey || !toKey) return
    if (fromKey === toKey) return
    const key = `${fromKey}->${toKey}`
    if (seen.has(key)) return
    seen.add(key)
    serialized.push({
      from_block_key: fromKey,
      to_block_key: toKey,
    })
  })

  return serialized
}

function wouldCreateDependencyCycle(
  dependencies: PipelineDependency[],
  from: string,
  to: string,
) {
  if (from === to) return true

  const adjacency = new Map<string, string[]>()
  for (const dependency of [...dependencies, { id: 'next', from, to }]) {
    adjacency.set(dependency.from, [
      ...(adjacency.get(dependency.from) ?? []),
      dependency.to,
    ])
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(id: string): boolean {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    for (const child of adjacency.get(id) ?? []) {
      if (visit(child)) return true
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }

  return Array.from(adjacency.keys()).some(visit)
}

function hasDependencyCycle(dependencies: PipelineDependency[]) {
  return wouldCreateDependencyCycle(dependencies, '__cycle_probe__', '__cycle_probe_end__')
}

function visitGraph(
  start: string,
  adjacency: Map<string, string[]>,
) {
  const visited = new Set<string>()
  const stack = [start]

  while (stack.length) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    visited.add(current)
    stack.push(...(adjacency.get(current) ?? []))
  }

  return visited
}

function validatePipelineGraph(
  blocks: PipelineBlock[],
  dependencies: PipelineDependency[],
) {
  if (blocks.length === 0) {
    return {
      isValid: false,
      hasCycle: false,
      message: 'Add at least one block',
    }
  }

  const nodeIds = new Set([
    START_NODE_ID,
    END_NODE_ID,
    ...blocks.map((block) => block.pipelineId),
  ])
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  const undirected = new Map<string, string[]>()
  const seenEdges = new Set<string>()

  nodeIds.forEach((id) => {
    outgoing.set(id, [])
    incoming.set(id, [])
    undirected.set(id, [])
  })

  for (const dependency of dependencies) {
    if (!nodeIds.has(dependency.from) || !nodeIds.has(dependency.to)) {
      return {
        isValid: false,
        hasCycle: false,
        message: 'Remove stale graph relationships',
      }
    }
    if (dependency.from === dependency.to) {
      return {
        isValid: false,
        hasCycle: true,
        message: 'A block cannot depend on itself',
      }
    }
    if (dependency.to === START_NODE_ID || dependency.from === END_NODE_ID) {
      return {
        isValid: false,
        hasCycle: false,
        message: 'Start can only begin the flow, and Active can only finish it',
      }
    }

    const edgeKey = `${dependency.from}->${dependency.to}`
    if (seenEdges.has(edgeKey)) {
      return {
        isValid: false,
        hasCycle: false,
        message: 'Remove duplicate graph relationships',
      }
    }
    seenEdges.add(edgeKey)

    outgoing.get(dependency.from)?.push(dependency.to)
    incoming.get(dependency.to)?.push(dependency.from)
    undirected.get(dependency.from)?.push(dependency.to)
    undirected.get(dependency.to)?.push(dependency.from)
  }

  if (!outgoing.get(START_NODE_ID)?.length) {
    return {
      isValid: false,
      hasCycle: false,
      message: 'Connect Start to the first block',
    }
  }

  if (!incoming.get(END_NODE_ID)?.length) {
    return {
      isValid: false,
      hasCycle: false,
      message: 'Connect the final block to Active',
    }
  }

  const hasCycle = hasDependencyCycle(dependencies)
  if (hasCycle) {
    return {
      isValid: false,
      hasCycle,
      message: 'Resolve the circular dependency',
    }
  }

  const reachableFromStart = visitGraph(START_NODE_ID, outgoing)
  const connectedToActive = visitGraph(END_NODE_ID, incoming)
  const connectedComponent = visitGraph(START_NODE_ID, undirected)

  for (const id of Array.from(nodeIds)) {
    if (!reachableFromStart.has(id)) {
      return {
        isValid: false,
        hasCycle: false,
        message: 'Every block must be reachable from Start',
      }
    }
    if (!connectedToActive.has(id)) {
      return {
        isValid: false,
        hasCycle: false,
        message: 'Every block must lead to Active',
      }
    }
    if (!connectedComponent.has(id)) {
      return {
        isValid: false,
        hasCycle: false,
        message: 'The workflow must be one connected graph',
      }
    }
  }

  return {
    isValid: true,
    hasCycle: false,
    message: 'Ready to save',
  }
}

function buildLocalHealth(
  policyName: string,
  pipelineBlocks: PipelineBlock[],
  graphIsValid: boolean,
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
    no_circular_dependencies: graphIsValid,
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
    server.checks.at_least_one_step === local.checks.at_least_one_step &&
    server.checks.no_block_issues === local.checks.no_block_issues &&
    server.checks.no_circular_dependencies ===
      local.checks.no_circular_dependencies
  )
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
  const [mode, setMode] = useState<BuilderMode>(apiWorkflowType)
  const [view, setView] = useState<BuilderView>('build')
  const [scope, setScope] = useState<ScopeState>({
    name: '',
    workerType: 'contingent',
    workerTypes: ['contingent'],
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
  const [pipelineDependencies, setPipelineDependencies] = useState<
    PipelineDependency[]
  >([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [linkFromBlockId, setLinkFromBlockId] = useState<string | null>(null)
  const [dependencyWarning, setDependencyWarning] = useState('')
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [showAddFieldModal, setShowAddFieldModal] = useState(false)
  const [showAddConditionMenu, setShowAddConditionMenu] = useState(false)
  const [fieldDraftKey, setFieldDraftKey] =
    useState<ScopeFieldKey>('location')
  const [fieldDraftValue, setFieldDraftValue] = useState('')
  const [fieldDraftDisplay, setFieldDraftDisplay] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [locationRows, setLocationRows] = useState<LocationRecord[]>([])
  const [costCenterRows, setCostCenterRows] = useState<CostCenterRecord[]>([])
  const [businessUnitRows, setBusinessUnitRows] = useState<BusinessUnitRecord[]>([])
  const [roleRows, setRoleRows] = useState<RoleRecord[]>([])
  const [supplierRows, setSupplierRows] = useState<SupplierRecord[]>([])
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
  const graphValidation = useMemo(
    () => validatePipelineGraph(pipelineBlocks, pipelineDependencies),
    [pipelineBlocks, pipelineDependencies],
  )
  const localHealth = useMemo(
    () => {
      return buildLocalHealth(
        scope.name,
        pipelineBlocks,
        graphValidation.isValid,
      )
    },
    [graphValidation.isValid, scope.name, pipelineBlocks],
  )
  const health =
    serverHealth && healthMatchesLocal(serverHealth, localHealth)
      ? serverHealth
      : localHealth
  const isWorkflowReady = health.status === 'complete'
  const canSaveDraft =
    scope.name.trim().length > 0 &&
    Boolean(scope.workerType) &&
    graphValidation.isValid &&
    !isSaving
  const availableScopeFieldOptions = scopeFieldOptions.filter(
    (option) =>
      !scopeFields.some((field) => field.fieldKey === option.value),
  )
  const canAddScopeField = Boolean(parseReferenceId(fieldDraftValue))
  const scopeSummary = [
    ...scope.workerTypes.map(workerTypeLabel),
    ...scopeFields.map((field) => field.display).filter(Boolean),
  ]
    .filter(Boolean)
    .join(' · ')
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
    let cancelled = false

    async function loadScopeMasterData() {
      const [
        costCentersResult,
        businessUnitsResult,
        rolesResult,
        suppliersResult,
      ] = await Promise.allSettled([
        getCostCenters({ status: 'active' }),
        getBusinessUnits({ status: 'active' }),
        getRoles({ is_active: true }),
        getSuppliers({ status: 'active' }),
      ])

      if (cancelled) return

      if (costCentersResult.status === 'fulfilled') {
        setCostCenterRows(costCentersResult.value)
      }
      if (businessUnitsResult.status === 'fulfilled') {
        setBusinessUnitRows(businessUnitsResult.value)
      }
      if (rolesResult.status === 'fulfilled') {
        setRoleRows(rolesResult.value)
      }
      if (suppliersResult.status === 'fulfilled') {
        setSupplierRows(suppliersResult.value)
      }
    }

    void loadScopeMasterData()

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

        const workerType = workflow.policy_scope?.worker_type || 'contingent'
        setScope({
          name: workflow.name,
          workerType,
          workerTypes: workerType ? [workerType] : [],
          isActive: workflow.is_active,
        })
        setWorkflowStatus(workflow.status)
        const mappedScopeFields =
          (workflow.policy_scope?.fields ?? [])
            .map(mapScopeField)
            .filter((field): field is BuilderScopeField => !!field)
        setScopeFields(mergeScopeFields(mappedScopeFields))
        const blocks = workflow.blocks
          .filter((block) => !isLegacyAutoBlock(block))
          .map(mapWorkflowBlock)
        const apiDependencies = mapWorkflowDependencies(
          workflow.dependencies,
          blocks,
        )
        const persistedDependencies =
          mapPersistedGraphConfigDependencies(blocks)
        const encodedDependencies =
          mapEncodedGraphPositionDependencies(blocks)
        setPipelineBlocks(blocks)
        setPipelineDependencies(
          mergePipelineDependencies(
            apiDependencies,
            persistedDependencies,
            encodedDependencies,
          ),
        )
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

  function addScopeCondition(fieldKey: ScopeFieldKey) {
    const label = fieldKeyLabel(fieldKey)
    setScopeFields((current) => {
      if (current.some((field) => field.fieldKey === fieldKey)) return current
      return [
        ...current,
        {
          id: randomId('scope-field'),
          fieldKey,
          label,
          display: '',
          valueId: 0,
          values: [],
          valueIds: {},
        },
      ]
    })
    setServerHealth(null)
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
        values: [fieldDraftDisplay || `${label} #${valueId}`],
        valueIds: {
          [fieldDraftDisplay || `${label} #${valueId}`]: valueId,
        },
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

  function computeGraphDropLevel(clientX: number) {
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return pipelineBlocks.length
    const levelWidth = 284
    return Math.max(0, Math.floor((clientX - bounds.left - 48) / levelWidth))
  }

  function addLibraryBlockToPipeline(block: LibraryBlock, graphLevel?: number) {
    if (
      usedLibraryBlockIds.has(block.id) ||
      usedLibraryBlockIds.has(block.name.trim().toLowerCase())
    ) {
      return
    }

    const pipelineId = randomId('workflow-block')
    const clientKey = randomId('block-key')

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
          clientKey,
          order: current.length + 1,
          graphLevel: Math.max(
            0,
            graphLevel ?? Math.max(0, ...current.map((item) => item.graphLevel)) + 1,
          ),
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
    setDependencyWarning('')
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
    event.dataTransfer.setData('application/levv-workflow-block', blockId)
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

    addLibraryBlockToPipeline(block, computeGraphDropLevel(event.clientX))
    setDragBlockId(null)
  }

  function removePipelineBlock(pipelineId: string) {
    setPipelineBlocks((current) =>
      current
        .filter((block) => block.pipelineId !== pipelineId)
        .map((block, index) => ({ ...block, order: index + 1 })),
    )
    setPipelineDependencies((current) =>
      current.filter(
        (dependency) =>
          dependency.from !== pipelineId && dependency.to !== pipelineId,
      ),
    )
    setSelectedBlockId((current) =>
      current === pipelineId ? null : current,
    )
    setLinkFromBlockId((current) => (current === pipelineId ? null : current))
    setServerHealth(null)
  }

  function moveGraphBlock(
    pipelineId: string,
    graphLevel: number,
    position: number,
  ) {
    setPipelineBlocks((current) => {
      const next = current.map((block) =>
        block.pipelineId === pipelineId
          ? { ...block, graphLevel: Math.max(0, graphLevel) }
          : block,
      )
      const moving = next.find((block) => block.pipelineId === pipelineId)
      if (!moving) return current

      const withoutMoving = next.filter((block) => block.pipelineId !== pipelineId)
      const before = withoutMoving.filter((block) => {
        if (block.graphLevel < moving.graphLevel) return true
        if (block.graphLevel > moving.graphLevel) return false
        const sameLevel = withoutMoving
          .filter((candidate) => candidate.graphLevel === moving.graphLevel)
          .sort((left, right) => left.order - right.order)
        return sameLevel.findIndex((candidate) => candidate.pipelineId === block.pipelineId) < position
      })
      const after = withoutMoving.filter(
        (block) => !before.some((candidate) => candidate.pipelineId === block.pipelineId),
      )
      return [...before, moving, ...after].map((block, index) => ({
        ...block,
        order: index + 1,
      }))
    })
    setServerHealth(null)
  }

  function addPipelineDependency(from: string, to: string) {
    setPipelineDependencies((current) => {
      if (from === to) {
        setDependencyWarning('A block cannot depend on itself.')
        return current
      }
      if (to === START_NODE_ID || from === END_NODE_ID) {
        setDependencyWarning('Start can only begin the flow, and End can only finish it.')
        return current
      }
      if (
        current.some(
          (dependency) => dependency.from === from && dependency.to === to,
        )
      ) {
        setDependencyWarning('')
        return current
      }
      if (wouldCreateDependencyCycle(current, from, to)) {
        setDependencyWarning('That arrow would create a cycle.')
        return current
      }
      setDependencyWarning('')
      setServerHealth(null)
      return [...current, { id: randomId('dependency'), from, to }]
    })
  }

  function removePipelineDependency(dependencyId: string) {
    setPipelineDependencies((current) =>
      current.filter((dependency) => dependency.id !== dependencyId),
    )
    setDependencyWarning('')
    setServerHealth(null)
  }

  function handleGraphBlockClick(pipelineId: string) {
    if (!editable) return
    if (linkFromBlockId) {
      addPipelineDependency(linkFromBlockId, pipelineId)
      setLinkFromBlockId(null)
      return
    }
    setSelectedBlockId((current) =>
      current === pipelineId ? null : pipelineId,
    )
  }

  function buildWorkflowPayload(): CreateWorkflowPayload {
    return {
      name: scope.name.trim(),
      workflow_type: apiWorkflowType,
      status: 'draft',
      is_active: scope.isActive,
      policy_scope: {
        worker_type: scope.workerType,
        fields: serializeScopeFields(scopeFields),
      },
      blocks: pipelineBlocks.map((block, index) =>
        serializePipelineBlock(
          block,
          index,
          pipelineDependencies,
          pipelineBlocks,
        ),
      ),
      dependencies: serializePipelineDependencies(
        pipelineDependencies,
        pipelineBlocks,
      ),
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
    : saveError
      ? saveError
      : !graphValidation.isValid
        ? graphValidation.message
        : isWorkflowReady
          ? 'Ready to save'
          : 'Workflow checks update after save'

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
              blocks={pipelineBlocks}
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
                            addScopeCondition(option.value)
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
                  <ScopeConditionRow
                    label="Worker type"
                    options={workerTypeOptions.map((option) => option.label)}
                    values={scope.workerTypes.map(workerTypeLabel)}
                    onChange={(labels) => {
                      const workerTypes = labels
                        .map(
                          (label) =>
                            workerTypeOptions.find(
                              (option) => option.label === label,
                            )?.value,
                        )
                        .filter(isWorkerType)
                      setScope({
                        ...scope,
                        workerType: workerTypes[0] ?? '',
                        workerTypes,
                      })
                      setServerHealth(null)
                    }}
                  />
                  {scopeFields.map((field) => (
                    <ScopeConditionInput
                      key={field.id}
                      field={field}
                      locationRows={locationRows}
                      costCenterRows={costCenterRows}
                      businessUnitRows={businessUnitRows}
                      roleRows={roleRows}
                      supplierRows={supplierRows}
                      onChange={(display, valueId, valueIds) =>
                        setScopeFields((current) =>
                          current.map((candidate) =>
                            candidate.id === field.id
                              ? {
                                  ...candidate,
                                  display,
                                  valueId: valueId ?? candidate.valueId,
                                  values: splitConditionDisplay(display),
                                  valueIds,
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
              dragBlockId && editable
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
                    ? 'Onboarding Flow'
                    : 'Offboarding - derived'}
                </h2>
                <p className="text-xs text-slate-400">
                  {mode === 'onboarding'
                    ? 'Drag blocks into levels · Connect dependencies with arrows'
                    : 'Every requirement is unwound in reverse order · Read-only preview'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {editable && linkFromBlockId && (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-700"
                    onClick={() => setLinkFromBlockId(null)}
                  >
                    Cancel arrow
                  </button>
                )}
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

              {dragBlockId && editable && (
                <div className="mb-4 rounded-xl border border-dashed border-cyan-300 bg-cyan-50 px-4 py-3 text-xs font-semibold text-cyan-700">
                  Drop to add this block to the workflow pipeline.
                </div>
              )}

              {dependencyWarning && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {dependencyWarning}
                </div>
              )}

              {mode === 'onboarding' ? (
                <OnboardingFlowEditor
                  blocks={pipelineBlocks}
                  dependencies={pipelineDependencies}
                  libraryBlocks={libraryBlocks}
                  usedLibraryBlockIds={usedLibraryBlockIds}
                  editable={editable}
                  selectedBlockId={selectedBlockId}
                  onAddBlock={addLibraryBlockToPipeline}
                  onSelectBlock={setSelectedBlockId}
                  onMoveBlock={moveGraphBlock}
                  onAddDependency={addPipelineDependency}
                  onRemoveDependency={removePipelineDependency}
                  onRemoveBlock={removePipelineBlock}
                />
              ) : (
                <WorkflowGraphEditor
                  blocks={pipelineBlocks}
                  dependencies={pipelineDependencies}
                  mode={mode}
                  editable={editable}
                  selectedBlockId={selectedBlockId}
                  linkFromBlockId={linkFromBlockId}
                  onBlockClick={handleGraphBlockClick}
                  onMoveBlock={moveGraphBlock}
                  onStartLink={(pipelineId) => {
                    setLinkFromBlockId(pipelineId)
                    setDependencyWarning('')
                  }}
                  onRemoveDependency={removePipelineDependency}
                  onRemoveBlock={removePipelineBlock}
                />
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
                    onAdd={() => addLibraryBlockToPipeline(block)}
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
      .graph-canvas{position:relative;min-width:100%;overflow:visible;border-radius:14px;background:linear-gradient(#f8fafc,#f8fafc) padding-box,repeating-linear-gradient(90deg,transparent 0,transparent 243px,rgba(148,163,184,.16) 244px,transparent 245px) border-box;}
      .graph-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;}
      .graph-edge{fill:none;stroke:#94a3b8;stroke-width:1.7;opacity:.9;}
      .graph-edge.derived{stroke-dasharray:5 5;opacity:.55;}
      .graph-edge.explicit{stroke:#64748b;stroke-width:2;}
      .graph-edge-remove{width:22px;height:22px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#64748b;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(15,23,42,.12);cursor:pointer;pointer-events:auto;}
      .graph-edge-remove:hover{border-color:#ef4444;background:#fef2f2;color:#dc2626;}
      .graph-node-wrap{position:absolute;z-index:2;transition:opacity .12s,transform .12s;}
      .graph-node-wrap.dragging{opacity:.42;transform:scale(.98);}
      .graph-node{height:116px;border-radius:12px;border:1px solid #e5e7eb;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.06);display:flex;flex-direction:column;gap:8px;padding:12px;cursor:grab;transition:box-shadow .14s,border-color .14s,transform .14s;}
      .graph-node:hover{border-color:rgba(0,122,138,.32);box-shadow:0 8px 22px rgba(15,23,42,.1);transform:translateY(-1px);}
      .graph-node.selected{border-color:#007a8a;box-shadow:0 0 0 3px rgba(0,122,138,.14),0 8px 22px rgba(15,23,42,.1);}
      .graph-node.linking{border-color:#0891b2;box-shadow:0 0 0 3px rgba(8,145,178,.18),0 8px 22px rgba(15,23,42,.1);}
      .graph-node.hard{border-left:4px solid #dc2626;}
      .graph-node.soft{border-left:4px solid #b45309;}
      .graph-node.system{background:#0f172a;border-color:#1e293b;border-left:4px solid #0e7490;color:#e2e8f0;}
      .graph-node.exit{border-left-color:#0a0a0a;}
      .graph-node-head{display:flex;align-items:center;gap:8px;min-width:0;}
      .graph-node-num{width:22px;height:22px;border-radius:5px;flex-shrink:0;border:1.5px solid currentColor;background:#fff;color:#0a0a0a;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;}
      .graph-node.system .graph-node-num{background:#1e293b;border-color:#334155;color:#e2e8f0;}
      .graph-node-title{display:flex;align-items:center;gap:6px;min-width:0;flex:1;font-size:13px;font-weight:700;color:inherit;}
      .graph-node-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;}
      .graph-icon-btn{width:22px;height:22px;border:none;border-radius:6px;background:transparent;color:#94a3b8;display:flex;align-items:center;justify-content:center;cursor:pointer;}
      .graph-icon-btn:hover,.graph-icon-btn.on{background:rgba(8,145,178,.12);color:#0891b2;}
      .graph-node.system .graph-icon-btn:hover,.graph-node.system .graph-icon-btn.on{background:#1e293b;color:#67e8f9;}
      .graph-node-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-height:24px;}
      .graph-chip{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:2px 7px;border-radius:999px;border:1px solid #e5e7eb;background:#f8fafc;font-size:9.5px;font-weight:700;color:#475569;white-space:nowrap;}
      .graph-chip.hard{border-color:#fecaca;background:#fef2f2;color:#dc2626;}
      .graph-chip.soft{border-color:#fde68a;background:#fffbeb;color:#b45309;}
      .graph-chip.dark{border-color:#334155;background:#111827;color:#cbd5e1;}
      .graph-node-owner{margin-top:auto;display:flex;align-items:center;gap:6px;min-width:0;font-size:10.5px;font-weight:700;color:#64748b;}
      .graph-node.system .graph-node-owner{color:#94a3b8;}
      .connector-ui{display:flex;flex-direction:column;align-items:center;margin:0 auto;width:40px;}
      .conn-line-ui{width:2px;height:14px;}
      .conn-line-ui.hard{background:#fca5a5;}
      .conn-line-ui.soft{background:#fcd34d;}
      .conn-line-ui.exit{background:#d1d5db;}
      .conn-arrow-ui{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;}
      .conn-arrow-ui.hard{border-top:6px solid #f87171;}
      .conn-arrow-ui.soft{border-top:6px solid #f59e0b;}
      .conn-arrow-ui.exit{border-top:6px solid #9ca3af;}
      .pv-wrap{position:relative;min-width:max-content;overflow:visible;padding-bottom:2px;}
      .pv-svg{display:block;overflow:visible;}
      .pv-edge{fill:none;stroke:var(--pv-edge,#97a6c5);stroke-width:1.7;opacity:.98;}
      .pv-edge.soft{stroke-dasharray:5 5;stroke:var(--pv-edge-soft,#b3c2da);}
      .pv-term{font-size:10px;font-weight:500;fill:#94a3b8;letter-spacing:.01em;}
      .pv-node{width:206px;height:60px;box-sizing:border-box;padding:9px 12px;border-radius:12px;border:1px solid #e5e7eb;background:#fff;display:flex;flex-direction:column;justify-content:center;gap:3px;box-shadow:0 1px 2px rgba(15,23,42,.06);}
      .pv-node.hard{border-left:4px solid #dc2626;}
      .pv-node.soft{border-left:4px solid #b45309;}
      .pv-node.sys{background:#0f172a;border-color:#1e293b;border-left:4px solid #0e7490;color:#e2e8f0;box-shadow:0 1px 2px rgba(15,23,42,.2);}
      .pv-node-name{display:flex;align-items:center;gap:6px;min-width:0;font-size:13px;font-weight:600;color:inherit;}
      .pv-node-sub{display:flex;align-items:center;gap:6px;min-width:0;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#94a3b8;}
      .pv-node.sys .pv-node-sub{color:#94a3b8;}
      .pv-node-chiprow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
      .pv-node-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:2px 8px;border-radius:999px;border:1px solid #e5e7eb;background:#f3f4f6;font-size:9.5px;font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .pv-node.sys .pv-node-chip{border-color:#334155;background:#111827;color:#cbd5e1;}
      .pv-node-chip .bx-ava{width:14px;height:14px;font-size:6px;}
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
  const ordered = isOffboarding ? [...blocks].reverse() : blocks
  const ids = ordered.map((block) => block.pipelineId)
  const byId = new Map(ordered.map((block) => [block.pipelineId, block]))

  const layers: string[][] = []
  let currentLayer: string[] = []
  for (const block of ordered) {
    currentLayer.push(block.pipelineId)
    if (block.gate === 'hard') {
      layers.push(currentLayer)
      currentLayer = []
    }
  }
  if (currentLayer.length) layers.push(currentLayer)

  if (layers.length === 0 && ids.length) layers.push(ids)

  const barrierOf = (layer: string[]) => {
    for (let index = layer.length - 1; index >= 0; index -= 1) {
      if (byId.get(layer[index])?.gate === 'hard') return layer[index]
    }
    return layer[layer.length - 1]
  }

  type ProcessLink = { from: string; to: string; soft?: boolean }
  const links: ProcessLink[] = []

  layers.forEach((layer, index) => {
    const next = layers[index + 1]
    if (!next) return

    const barrier = barrierOf(layer)
    const nextBarrier = barrierOf(next)

    next.forEach((target) => {
      links.push({ from: barrier, to: target })
    })

    layer.forEach((source) => {
      if (source !== barrier) {
        links.push({ from: source, to: nextBarrier, soft: true })
      }
    })
  })

  const hasIn = new Set(links.map((link) => link.to))
  const hasOut = new Set(links.map((link) => link.from))
  const sources = ids.filter((id) => !hasIn.has(id))
  const sinks = ids.filter((id) => !hasOut.has(id))

  const NW = 206
  const NH = 60
  const HG = 78
  const VG = 22
  const MX = 84
  const MY = 40

  const maxRows = Math.max(1, ...layers.map((layer) => layer.length))
  const pos = new Map<string, { x: number; y: number }>()
  layers.forEach((layer, layerIndex) => {
    const colTop = MY + ((maxRows - layer.length) * (NH + VG)) / 2
    layer.forEach((id, rowIndex) => {
      pos.set(id, {
        x: MX + layerIndex * (NW + HG),
        y: colTop + rowIndex * (NH + VG),
      })
    })
  })

  const contentRight = MX + layers.length * (NW + HG)
  const W = contentRight + MX
  const H = MY + maxRows * (NH + VG) + MY
  const midY = H / 2
  const startX = 30
  const endX = contentRight + 6
  const ep = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

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
          <div className="pv-wrap">
            <svg className="pv-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
              <defs>
                <marker id="pv-arrow" markerWidth="9" markerHeight="9" refX="6.5" refY="4" orient="auto">
                  <path d="M0,0 L7,4 L0,8" fill="none" stroke="#97a6c5" strokeWidth="1.4" />
                </marker>
              </defs>

              {sources.map((id) => {
                const point = pos.get(id)!
                return (
                  <path
                    key={`start-${id}`}
                    d={ep(startX + 9, midY, point.x, point.y + NH / 2)}
                    className="pv-edge"
                    markerEnd="url(#pv-arrow)"
                  />
                )
              })}

              {links.map((link, index) => {
                const from = pos.get(link.from)!
                const to = pos.get(link.to)!
                return (
                  <path
                    key={`link-${index}`}
                    d={ep(from.x + NW, from.y + NH / 2, to.x, to.y + NH / 2)}
                    className={`pv-edge ${link.soft ? 'soft' : ''}`}
                    markerEnd="url(#pv-arrow)"
                  />
                )
              })}

              {sinks.map((id) => {
                const point = pos.get(id)!
                return (
                  <path
                    key={`end-${id}`}
                    d={ep(point.x + NW, point.y + NH / 2, endX, midY)}
                    className="pv-edge"
                    markerEnd="url(#pv-arrow)"
                  />
                )
              })}

              <circle cx={startX} cy={midY} r="9" fill={isOffboarding ? '#0a0a0a' : '#007a8a'} />
              <text x={startX} y={midY + 24} textAnchor="middle" className="pv-term">
                {isOffboarding ? 'Exit' : 'Start'}
              </text>

              <circle
                cx={endX}
                cy={midY}
                r="9"
                fill="none"
                stroke={isOffboarding ? '#0a0a0a' : '#007a8a'}
                strokeWidth="2"
              />
              <circle cx={endX} cy={midY} r="3.5" fill={isOffboarding ? '#0a0a0a' : '#007a8a'} />
              <text x={endX} y={midY + 24} textAnchor="middle" className="pv-term">
                {isOffboarding ? 'Offboarded' : 'Active'}
              </text>

              {ids.map((id) => {
                const block = byId.get(id)!
                const point = pos.get(id)!
                return (
                  <foreignObject key={id} x={point.x} y={point.y} width={NW} height={NH}>
                    <div
                      className={`pv-node ${
                        block.type === 'system'
                          ? 'sys'
                          : block.gate === 'hard'
                            ? 'hard'
                            : 'soft'
                      } ${isOffboarding ? 'exit' : ''}`}
                    >
                      <div className="pv-node-name">
                        {block.type === 'system' ? (
                          isOffboarding ? (
                            <RotateCcw className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                          ) : (
                            <Cog className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                          )
                        ) : null}
                        <span className="min-w-0 truncate">{block.name}</span>
                      </div>
                      <div className="pv-node-sub">
                        {block.type === 'system' ? (
                          <>
                            <span>
                              {isOffboarding
                                ? block.systemUnwind?.action ?? 'reverse'
                                : integrationMeta(block.systemIntegration)?.label ?? 'System'}
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
                            <span>
                              {block.gate === 'hard'
                                ? 'hard gate'
                                : 'soft gate · parallel'}
                            </span>
                          </>
                        )}
                      </div>
                      {!block.accountableOwner && block.type !== 'system' ? null : (
                        <div className="pv-node-chiprow">
                          <span className="pv-node-chip">
                            <PeopleStack
                              names={
                                block.accountableOwner
                                  ? resolvePeople(block.accountableOwner).map((person) => person.name)
                                  : []
                              }
                              max={2}
                            />
                            <span>
                              {block.accountableOwner
                                ? roleLabel(block.accountableOwner)
                                : 'System'}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </foreignObject>
                )
              })}
            </svg>
          </div>
        </div>
      )}
    </section>
  )
}

function buildGraphLayout(
  blocks: PipelineBlock[],
  dependencies: PipelineDependency[],
  mode: BuilderMode,
) {
  const isOffboarding = mode === 'offboarding'
  const ordered = isOffboarding ? [...blocks].reverse() : blocks
  const ids = ordered.map((block) => block.pipelineId)
  const idSet = new Set(ids)
  const byId = new Map(ordered.map((block) => [block.pipelineId, block]))
  let links = dependencies.filter(
    (dependency) => idSet.has(dependency.from) && idSet.has(dependency.to),
  )

  if (isOffboarding) {
    links = links.map((dependency) => ({
      ...dependency,
      from: dependency.to,
      to: dependency.from,
    }))
  }

  const level = new Map<string, number>()
  ordered.forEach((block, index) => {
    level.set(block.pipelineId, Math.max(0, block.graphLevel ?? index))
  })

  if (links.length) {
    const adjacency = new Map<string, string[]>()
    const indegree = new Map<string, number>()
    ids.forEach((id) => {
      adjacency.set(id, [])
      indegree.set(id, 0)
    })
    links.forEach((link) => {
      adjacency.get(link.from)?.push(link.to)
      indegree.set(link.to, (indegree.get(link.to) ?? 0) + 1)
    })

    const queue = ids.filter((id) => indegree.get(id) === 0)
    while (queue.length) {
      const id = queue.shift()!
      for (const child of adjacency.get(id) ?? []) {
        level.set(child, Math.max(level.get(child) ?? 0, (level.get(id) ?? 0) + 1))
        indegree.set(child, (indegree.get(child) ?? 0) - 1)
        if (indegree.get(child) === 0) queue.push(child)
      }
    }
  } else {
    let nextLevel = 0
    ordered.forEach((block) => {
      level.set(block.pipelineId, Math.max(level.get(block.pipelineId) ?? 0, nextLevel))
      if (block.gate === 'hard') nextLevel += 1
    })
  }

  const maxLevel = ids.length
    ? Math.max(...ids.map((id) => level.get(id) ?? 0))
    : 0
  const columns: string[][] = Array.from({ length: maxLevel + 1 }, () => [])
  ids.forEach((id) => {
    columns[level.get(id) ?? 0]?.push(id)
  })
  columns.forEach((column) =>
    column.sort(
      (left, right) => (byId.get(left)?.order ?? 0) - (byId.get(right)?.order ?? 0),
    ),
  )

  if (!links.length) {
    const barrierOf = (column: string[]) => {
      for (let index = column.length - 1; index >= 0; index -= 1) {
        if (byId.get(column[index])?.gate === 'hard') return column[index]
      }
      return column[column.length - 1]
    }

    links = []
    columns.forEach((column, index) => {
      const nextColumn = columns[index + 1]
      if (!nextColumn?.length || !column.length) return
      const barrier = barrierOf(column)
      const nextBarrier = barrierOf(nextColumn)
      nextColumn.forEach((target) => {
        links.push({ id: `derived-${barrier}-${target}`, from: barrier, to: target })
      })
      column.forEach((source) => {
        if (source !== barrier) {
          links.push({
            id: `derived-soft-${source}-${nextBarrier}`,
            from: source,
            to: nextBarrier,
          })
        }
      })
    })
  }

  return { ordered, byId, columns, links }
}

function WorkflowGraphEditor({
  blocks,
  dependencies,
  mode,
  editable,
  selectedBlockId,
  linkFromBlockId,
  onBlockClick,
  onMoveBlock,
  onStartLink,
  onRemoveDependency,
  onRemoveBlock,
}: {
  blocks: PipelineBlock[]
  dependencies: PipelineDependency[]
  mode: BuilderMode
  editable: boolean
  selectedBlockId: string | null
  linkFromBlockId: string | null
  onBlockClick: (pipelineId: string) => void
  onMoveBlock: (pipelineId: string, graphLevel: number, position: number) => void
  onStartLink: (pipelineId: string) => void
  onRemoveDependency: (dependencyId: string) => void
  onRemoveBlock: (pipelineId: string) => void
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const { ordered, byId, columns, links } = useMemo(
    () => buildGraphLayout(blocks, dependencies, mode),
    [blocks, dependencies, mode],
  )

  const isOffboarding = mode === 'offboarding'
  const nodeWidth = 244
  const nodeHeight = 116
  const horizontalGap = 76
  const verticalGap = 28
  const marginX = 72
  const marginY = 34
  const maxRows = Math.max(1, ...columns.map((column) => column.length))
  const width = Math.max(
    680,
    marginX * 2 + columns.length * nodeWidth + Math.max(0, columns.length - 1) * horizontalGap,
  )
  const height = Math.max(260, marginY * 2 + maxRows * nodeHeight + (maxRows - 1) * verticalGap)
  const positions = new Map<string, { x: number; y: number }>()

  columns.forEach((column, columnIndex) => {
    const columnTop =
      marginY + ((maxRows - column.length) * (nodeHeight + verticalGap)) / 2
    column.forEach((id, rowIndex) => {
      positions.set(id, {
        x: marginX + columnIndex * (nodeWidth + horizontalGap),
        y: columnTop + rowIndex * (nodeHeight + verticalGap),
      })
    })
  })

  const hasIn = new Set(links.map((link) => link.to))
  const hasOut = new Set(links.map((link) => link.from))
  const sources = ordered.map((block) => block.pipelineId).filter((id) => !hasIn.has(id))
  const sinks = ordered.map((block) => block.pipelineId).filter((id) => !hasOut.has(id))
  const startX = 28
  const endX = width - 28
  const midY = height / 2
  const edgePath = (x1: number, y1: number, x2: number, y2: number) => {
    const midpoint = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${midpoint} ${y1}, ${midpoint} ${y2}, ${x2} ${y2}`
  }

  function computeDrop(clientX: number, clientY: number) {
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return { level: 0, position: 0 }
    const level = Math.max(
      0,
      Math.round((clientX - bounds.left - marginX) / (nodeWidth + horizontalGap)),
    )
    const position = Math.max(
      0,
      Math.round((clientY - bounds.top - marginY) / (nodeHeight + verticalGap)),
    )
    return { level, position }
  }

  function handleNodeMouseDown(
    event: MouseEvent<HTMLDivElement>,
    pipelineId: string,
  ) {
    if (!editable || event.button !== 0) return
    if (
      (event.target as HTMLElement).closest(
        'button, a, input, select, textarea, [data-no-drag]',
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
        setDraggingId(pipelineId)
        document.body.classList.add('workflow-reordering')
      }
    }

    const handleMouseUp = (upEvent: globalThis.MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.classList.remove('workflow-reordering')
      setDraggingId(null)

      if (moved) {
        const drop = computeDrop(upEvent.clientX, upEvent.clientY)
        onMoveBlock(pipelineId, drop.level, drop.position)
        return
      }

      onBlockClick(pipelineId)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  if (blocks.length === 0) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100 text-slate-400">
          <ArrowDown className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">No steps yet</h3>
          <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400">
            Drag a block from the right panel into the canvas.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div
        ref={canvasRef}
        className="graph-canvas"
        style={{ width, height }}
      >
        <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <marker
              id="graph-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="6.5"
              refY="4"
              orient="auto"
            >
              <path
                d="M0,0 L7,4 L0,8"
                fill="none"
                stroke="#64748b"
                strokeWidth="1.4"
              />
            </marker>
          </defs>

          {sources.map((id) => {
            const point = positions.get(id)
            if (!point) return null
            return (
              <path
                key={`source-${id}`}
                d={edgePath(startX + 9, midY, point.x, point.y + nodeHeight / 2)}
                className="graph-edge"
                markerEnd="url(#graph-arrow)"
              />
            )
          })}

          {links.map((link) => {
            const from = positions.get(link.from)
            const to = positions.get(link.to)
            if (!from || !to) return null
            const explicit = dependencies.some(
              (dependency) =>
                dependency.from === link.from &&
                dependency.to === link.to,
            )
            return (
              <g key={link.id}>
                <path
                  d={edgePath(
                    from.x + nodeWidth,
                    from.y + nodeHeight / 2,
                    to.x,
                    to.y + nodeHeight / 2,
                  )}
                  className={explicit ? 'graph-edge explicit' : 'graph-edge derived'}
                  markerEnd="url(#graph-arrow)"
                />
                {editable && explicit && (
                  <foreignObject
                    x={(from.x + to.x + nodeWidth) / 2 - 11}
                    y={(from.y + to.y) / 2 + nodeHeight / 2 - 11}
                    width={22}
                    height={22}
                  >
                    <button
                      type="button"
                      className="graph-edge-remove"
                      aria-label="Remove dependency"
                      onClick={() => onRemoveDependency(link.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </foreignObject>
                )}
              </g>
            )
          })}

          {sinks.map((id) => {
            const point = positions.get(id)
            if (!point) return null
            return (
              <path
                key={`sink-${id}`}
                d={edgePath(point.x + nodeWidth, point.y + nodeHeight / 2, endX, midY)}
                className="graph-edge"
                markerEnd="url(#graph-arrow)"
              />
            )
          })}

          <circle cx={startX} cy={midY} r="9" fill={isOffboarding ? '#0a0a0a' : '#007a8a'} />
          <text x={startX} y={midY + 24} textAnchor="middle" className="pv-term">
            {isOffboarding ? 'Exit' : 'Start'}
          </text>
          <circle
            cx={endX}
            cy={midY}
            r="9"
            fill="none"
            stroke={isOffboarding ? '#0a0a0a' : '#007a8a'}
            strokeWidth="2"
          />
          <circle cx={endX} cy={midY} r="3.5" fill={isOffboarding ? '#0a0a0a' : '#007a8a'} />
          <text x={endX} y={midY + 24} textAnchor="middle" className="pv-term">
            {isOffboarding ? 'Offboarded' : 'Active'}
          </text>
        </svg>

        {ordered.map((block, index) => {
          const point = positions.get(block.pipelineId)
          if (!point) return null
          const selected = selectedBlockId === block.pipelineId
          const linking = linkFromBlockId === block.pipelineId
          return (
            <div
              key={block.pipelineId}
              data-pipeline-id={block.pipelineId}
              className={`graph-node-wrap ${
                draggingId === block.pipelineId ? 'dragging' : ''
              }`}
              style={{ left: point.x, top: point.y, width: nodeWidth }}
              onMouseDown={(event) => handleNodeMouseDown(event, block.pipelineId)}
            >
              <GraphNodeCard
                block={block}
                mode={mode}
                displayOrder={index + 1}
                selected={selected}
                linking={linking}
                editable={editable}
                onStartLink={() => onStartLink(block.pipelineId)}
                onRemove={() => onRemoveBlock(block.pipelineId)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GraphNodeCard({
  block,
  mode,
  displayOrder,
  selected,
  linking,
  editable,
  onStartLink,
  onRemove,
}: {
  block: PipelineBlock
  mode: BuilderMode
  displayOrder: number
  selected: boolean
  linking: boolean
  editable: boolean
  onStartLink: () => void
  onRemove: () => void
}) {
  const isSystem = block.type === 'system'
  const isOffboarding = mode === 'offboarding'
  const accountableLabel = block.accountableOwner
    ? roleLabel(block.accountableOwner)
    : blockSignoffLabel(block)
  const accountablePeople = block.accountableOwner
    ? resolvePeople(block.accountableOwner).map((person) => person.name)
    : []
  const completion = block.completionRule
    ? completionLabel(block.completionRule, block.completionN, block.requirements.length)
    : null
  const systemMeta = integrationMeta(block.systemIntegration)

  return (
    <div
      className={`graph-node ${isSystem ? 'system' : block.gate} ${
        selected ? 'selected' : ''
      } ${linking ? 'linking' : ''} ${isOffboarding ? 'exit' : ''}`}
    >
      <div className="graph-node-head">
        <span className="graph-node-num">{displayOrder}</span>
        <span className="graph-node-title">
          {isSystem && (
            isOffboarding ? (
              <RotateCcw className="h-3.5 w-3.5 text-cyan-300" />
            ) : (
              <Cog className="h-3.5 w-3.5 text-cyan-300" />
            )
          )}
          <span className="truncate">{block.name}</span>
        </span>
        {editable && (
          <span className="graph-node-actions" data-no-drag>
            <button
              type="button"
              className={linking ? 'graph-icon-btn on' : 'graph-icon-btn'}
              onClick={(event) => {
                event.stopPropagation()
                onStartLink()
              }}
              title="Create dependency arrow"
            >
              <Link2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="graph-icon-btn"
              onClick={(event) => {
                event.stopPropagation()
                onRemove()
              }}
              title="Remove block"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>
      <div className="graph-node-meta">
        {isSystem ? (
          <>
            <span className="graph-chip dark">
              <Plug className="h-3 w-3" />
              {systemMeta?.label ?? 'System'}
            </span>
            <span className="graph-chip dark">
              {isOffboarding
                ? block.systemUnwind?.action ?? 'reverse'
                : block.push && block.pull
                  ? 'push + pull'
                  : block.push
                    ? 'push'
                    : 'pull'}
            </span>
          </>
        ) : (
          <>
            <span className={`graph-chip ${block.gate}`}>
              {block.gate === 'hard' ? 'Hard gate' : 'Soft gate'}
            </span>
            {completion && !isOffboarding && (
              <span className="graph-chip">{completion}</span>
            )}
            <span className="graph-chip">
              {block.requirements.length} {isOffboarding ? 'unwind' : 'req'}
              {block.requirements.length === 1 ? '' : 's'}
            </span>
          </>
        )}
      </div>
      <div className="graph-node-owner">
        {block.accountableOwner ? (
          <>
            <PeopleStack names={accountablePeople} max={2} />
            <span>{accountableLabel}</span>
          </>
        ) : (
          <span>{isSystem ? 'System owned' : 'Team owned'}</span>
        )}
      </div>
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

function ScopeConditionRow({
  label,
  options,
  values,
  onChange,
  onRemove,
}: {
  label: string
  options: string[]
  values: string[]
  onChange: (values: string[]) => void
  onRemove?: () => void
}) {
  return (
    <div className="cond-row">
      <span className="cond-dim">{label}</span>
      <span className="cond-is">is</span>
      <SearchableMultiSelect
        options={options}
        values={values}
        onChange={onChange}
      />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="cond-rm"
          aria-label={`Remove ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : (
        <span className="cond-rm-spacer" />
      )}
    </div>
  )
}

function ScopeConditionInput({
  field,
  locationRows,
  costCenterRows,
  businessUnitRows,
  roleRows,
  supplierRows,
  onChange,
  onRemove,
}: {
  field: BuilderScopeField
  locationRows: LocationRecord[]
  costCenterRows: CostCenterRecord[]
  businessUnitRows: BusinessUnitRecord[]
  roleRows: RoleRecord[]
  supplierRows: SupplierRecord[]
  onChange: (
    display: string,
    valueId: number | undefined,
    valueIds: Record<string, number>,
  ) => void
  onRemove: () => void
}) {
  const optionRecords = conditionOptionsForScopeField(field, {
    locationRows,
    costCenterRows,
    businessUnitRows,
    roleRows,
    supplierRows,
  })
  const values = field.values.length ? field.values : splitConditionDisplay(field.display)

  return (
    <ScopeConditionRow
      label={field.label}
      options={optionRecords.map((option) => option.label)}
      values={values}
      onChange={(nextValues) => {
        const display = nextValues.join(' or ')
        const selectedRecords = nextValues
          .map((value) =>
            optionRecords.find((option) => option.label === value),
          )
          .filter(
            (option): option is ConditionOptionRecord & { valueId: number } =>
              Boolean(option?.valueId),
          )
        const valueIds = Object.fromEntries(
          selectedRecords.map((option) => [option.label, option.valueId]),
        )
        onChange(
          display,
          nextValues.length === 1 ? selectedRecords[0]?.valueId : undefined,
          valueIds,
        )
      }}
      onRemove={onRemove}
    />
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
  {
    locationRows,
    costCenterRows,
    businessUnitRows,
    roleRows,
    supplierRows,
  }: {
    locationRows: LocationRecord[]
    costCenterRows: CostCenterRecord[]
    businessUnitRows: BusinessUnitRecord[]
    roleRows: RoleRecord[]
    supplierRows: SupplierRecord[]
  },
): ConditionOptionRecord[] {
  const currentValues = splitConditionDisplay(field.display).map((label) => {
    const valueId = field.valueIds[label] ?? field.valueId
    return {
      label,
      valueId: valueId > 0 ? valueId : undefined,
    }
  })
  const fallbackValues = FALLBACK_CONDITION_VALUES[field.fieldKey].map(
    (label) => ({ label }),
  )
  const masterValues = (() => {
    switch (field.fieldKey) {
      case 'location':
        return locationRows.map((location) => ({
          label: formatLocationDisplay(location),
          valueId: location.id,
        }))
      case 'cost_center':
        return costCenterRows
          .map((costCenter) => ({
            label: formatCostCenterDisplay(costCenter),
            valueId: readRecordId(costCenter.id),
          }))
          .filter((option) => option.label)
      case 'business_unit':
        return businessUnitRows
          .map((businessUnit) => ({
            label: formatBusinessUnitDisplay(businessUnit),
            valueId: readRecordId(businessUnit.id),
          }))
          .filter((option) => option.label)
      case 'role':
        return roleRows
          .map((role) => ({
            label: formatRoleDisplay(role),
            valueId: role.id,
          }))
          .filter((option) => option.label)
      case 'supplier':
        return supplierRows
          .map((supplier) => ({
            label: formatSupplierDisplay(supplier),
            valueId: readRecordId(supplier.id ?? supplier.supplier_id),
          }))
          .filter((option) => option.label)
    }
  })()

  const seen = new Set<string>()
  return [...currentValues, ...masterValues, ...fallbackValues].filter(
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
  onAdd,
  onEdit,
  onRemove,
}: {
  block: LibraryBlock
  isUsed: boolean
  canDrag: boolean
  integrationOptions: Option[]
  onDragStart: (event: DragEvent<HTMLDivElement>, blockId: string) => void
  onDragEnd: () => void
  onAdd: () => void
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
      draggable={canDrag && !isUsed}
      onDragStart={(event) => onDragStart(event, block.id)}
      onDragEnd={onDragEnd}
      onMouseDown={(event) => {
        if (event.detail > 1) event.preventDefault()
      }}
      onClick={() => {
        if (canDrag && !isUsed) onAdd()
      }}
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
