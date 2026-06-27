'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type DragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AlertTriangle,
  ArrowDown,
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
  X,
  XCircle,
  Zap,
} from 'lucide-react'
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
    requirements: [
      { id: 'photo-id', name: 'Photo ID', owner: 'worker' },
      { id: 'rtw', name: 'Right to Work (I-9 / Visa)', owner: 'worker' },
    ],
  },
  {
    id: 'legal-compliance',
    name: 'Legal & Compliance',
    type: 'requirement',
    gate: 'soft',
    requirements: [
      { id: 'nda', name: 'Signed NDA', owner: 'worker' },
      { id: 'ip', name: 'IP Agreement', owner: 'worker' },
      { id: 'fingerprint', name: 'Fingerprinting', owner: 'supplier' },
    ],
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
  const [dragBlockId, setDragBlockId] = useState<string | null>(null)
  const [showAddFieldModal, setShowAddFieldModal] = useState(false)
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
  const [modalRequirements, setModalRequirements] = useState<Requirement[]>([])
  const [modalIntegrationType, setModalIntegrationType] = useState<
    IntegrationType | ''
  >('')
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
    () => new Set(pipelineBlocks.map((block) => block.id)),
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
    if (!showAddFieldModal || fieldDraftKey !== 'location') return

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
  }, [fieldDraftKey, locationSearch, showAddFieldModal])

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
    setModalIntegrationType(block?.integrationType ?? '')
  }

  function closeBlockModal() {
    setShowBlockModal(null)
    setEditingBlockId(null)
    setModalName('')
    setModalGate('hard')
    setModalRequirements([])
    setModalIntegrationType('')
  }

  function createOrUpdateBlock() {
    if (!showBlockModal || !modalName.trim()) return
    if (showBlockModal === 'requirement' && modalRequirements.length === 0) {
      return
    }
    if (showBlockModal === 'system' && !modalIntegrationType) return

    const nextBlock: LibraryBlock = {
      id: editingBlockId ?? randomId('library-block'),
      name: modalName.trim(),
      type: showBlockModal,
      gate: modalGate,
      requirements:
        showBlockModal === 'requirement' ? modalRequirements : [],
      integrationType:
        showBlockModal === 'system' ? modalIntegrationType : undefined,
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
    const blockId = event.dataTransfer.getData('text/plain') || dragBlockId
    const block = libraryBlocks.find((candidate) => candidate.id === blockId)

    if (!block || usedLibraryBlockIds.has(block.id)) {
      setDragBlockId(null)
      return
    }

    const pipelineId = randomId('workflow-block')
    const nextBlock: PipelineBlock = {
      ...block,
      pipelineId,
      order: pipelineBlocks.length + 1,
      requirements: block.requirements.map((requirement) => ({
        ...requirement,
      })),
    }

    setPipelineBlocks((current) => [...current, nextBlock])
    setSelectedBlockId(pipelineId)
    setServerHealth(null)
    setDragBlockId(null)
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

  return (
    <div className="-m-6 min-h-[calc(100vh-8rem)] overflow-hidden bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-7 backdrop-blur">
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
            Workflow Builder
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              {workflowStatus}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
        >
          Preview
        </button>
      </header>

      <div className="grid min-h-[calc(100vh-11.5rem)] lg:grid-cols-[minmax(0,1fr)_310px]">
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

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold">Policy Scope</h1>
                  <p className="text-xs text-slate-400">
                    Applies to: {scopeSummary || 'Select scope fields'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openAddFieldModal}
                disabled={availableScopeFieldOptions.length === 0}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 text-xs font-medium text-slate-400 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                Add Field
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-4 px-5 py-4">
              <ScopeInput
                label="Policy Name"
                className="min-w-[220px]"
                value={scope.name}
                placeholder="e.g. US SOW Worker"
                onChange={(value) => {
                  setScope({ ...scope, name: value })
                  setServerHealth(null)
                }}
              />
              <ScopeSelect
                label="Worker Type"
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
              <ScopeSelect
                label="Active"
                value={scope.isActive ? 'active' : 'inactive'}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                onChange={(value) =>
                  setScope({ ...scope, isActive: value === 'active' })
                }
              />
              {scopeFields.map((field) => (
                <ScopeFieldInput
                  key={field.id}
                  field={field}
                  onChange={(display) =>
                    setScopeFields((current) =>
                      current.map((candidate) =>
                        candidate.id === field.id
                          ? { ...candidate, display }
                          : candidate,
                      ),
                    )
                  }
                  onRemove={() => {
                    setScopeFields((current) =>
                      current.filter((candidate) => candidate.id !== field.id),
                    )
                    setServerHealth(null)
                  }}
                />
              ))}
            </div>
          </section>

          <section
            onDrop={handlePipelineDrop}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragBlockId(null)}
            className={
              dragBlockId
                ? 'overflow-hidden rounded-2xl border border-cyan-400 bg-white shadow-[0_0_0_3px_rgba(8,145,178,0.14)]'
                : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'
            }
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Workflow Pipeline</h2>
                <p className="text-xs text-slate-400">
                  Drag blocks from the right panel · Click a block to inspect ·
                  Executes top to bottom
                </p>
              </div>
              {pipelineBlocks.length > 0 && (
                <span className="font-mono text-xs font-semibold text-slate-400">
                  {pipelineBlocks.length} step
                  {pipelineBlocks.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <div className="min-h-[275px] p-5">
              {dragBlockId && (
                <div className="mb-4 rounded-xl border border-dashed border-cyan-300 bg-cyan-50 px-4 py-3 text-xs font-semibold text-cyan-700">
                  Drop to add this block to the workflow pipeline.
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
                <div className="space-y-0">
                  {pipelineBlocks.map((block, index) => (
                    <PipelineBlockCard
                      key={block.pipelineId}
                      block={block}
                      selected={selectedBlockId === block.pipelineId}
                      showConnector={index < pipelineBlocks.length - 1}
                      onSelect={() => setSelectedBlockId(block.pipelineId)}
                      onRemove={() => removePipelineBlock(block.pipelineId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="border-l border-slate-200 bg-white">
          <section className="border-b border-slate-200 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <CheckCircle2 className="h-3 w-3" />
              Workflow Health
            </h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3">
                <CheckCircle2
                  className={
                    isWorkflowReady
                      ? 'h-3.5 w-3.5 text-green-600'
                      : 'h-3.5 w-3.5 text-slate-400'
                  }
                />
                <span className="text-xs font-semibold">Readiness Check</span>
                <span
                  className={
                    isWorkflowReady
                      ? 'ml-auto rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700'
                      : 'ml-auto rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700'
                  }
                >
                  {isWorkflowReady ? 'Ready' : 'Incomplete'}
                </span>
              </div>
              <div className="space-y-2 px-4 py-3 text-xs">
                <HealthRow
                  icon={<Shield className="h-3 w-3" />}
                  label="Steps"
                  value={health.counts.steps}
                  tone={health.counts.steps === 0 ? 'bad' : 'good'}
                />
                <HealthRow
                  icon={<ClipboardList className="h-3 w-3" />}
                  label="Requirements"
                  value={health.counts.requirements}
                />
                <HealthRow
                  icon={<XCircle className="h-3 w-3" />}
                  label="Hard Gates"
                  value={health.counts.hard_gates}
                  labelClassName="text-red-600"
                />
                <HealthRow
                  icon={<AlertTriangle className="h-3 w-3" />}
                  label="Soft Gates"
                  value={health.counts.soft_gates}
                  labelClassName="text-amber-700"
                />
                <HealthRow
                  icon={<Cog className="h-3 w-3" />}
                  label="System Blocks"
                  value={health.counts.system_blocks}
                />

                <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
                  <ChecklistItem
                    label="Policy name set"
                    pass={health.checks.policy_name_set}
                  />
                  <ChecklistItem
                    label="At least one step"
                    pass={health.checks.at_least_one_step}
                  />
                  <ChecklistItem
                    label="No block issues"
                    pass={health.checks.no_block_issues}
                  />
                  <ChecklistItem
                    label="No circular dependencies"
                    pass={health.checks.no_circular_dependencies}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={!canSaveDraft}
              onClick={handleSaveDraft}
              className={
                saveSuccess
                  ? 'mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-green-600 text-sm font-semibold text-white'
                  : 'mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-400'
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
                'Save as Draft'
              )}
            </button>
            {saveError && (
              <p className="mt-2 text-center text-[11px] leading-4 text-red-600">
                {saveError}
              </p>
            )}
            {!isWorkflowReady && pipelineBlocks.length > 0 && (
              <p className="mt-2 flex items-start gap-1 text-center text-[10px] leading-4 text-slate-400">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Workflow readiness follows the health status returned by the
                workflow API after save.
              </p>
            )}
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
                className="flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs font-semibold text-slate-700 hover:border-cyan-400 hover:bg-cyan-50"
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
                className="flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs font-semibold text-slate-700 hover:border-cyan-400 hover:bg-cyan-50"
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
                const isUsed = usedLibraryBlockIds.has(block.id)
                return (
                  <div
                    key={block.id}
                    draggable={!isUsed}
                    onDragStart={(event) =>
                      handleLibraryDragStart(event, block.id)
                    }
                    onDragEnd={() => setDragBlockId(null)}
                    className={
                      isUsed
                        ? 'rounded-xl border border-slate-200 bg-slate-100 p-3 opacity-50'
                        : 'cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 active:cursor-grabbing'
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-semibold">
                          {block.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${gateClass(
                              block.gate,
                            )}`}
                          >
                            {block.gate === 'hard' ? 'Hard' : 'Soft'}
                          </span>
                          {block.type === 'system' && (
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
                            onClick={() => openBlockModal(block.type, block)}
                            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setLibraryBlocks((current) =>
                              current.filter(
                                (candidate) => candidate.id !== block.id,
                              ),
                            )
                          }
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${block.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {block.type === 'system' ? (
                      <p className="mt-2 text-[10px] text-slate-500">
                        {block.integrationType
                          ? optionLabel(
                              integrationOptions,
                              block.integrationType,
                            )
                          : 'System integration'}
                      </p>
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
                  (showBlockModal === 'system' && !modalIntegrationType)
                }
                className="rounded-lg bg-slate-950 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-400"
              >
                {editingBlockId ? 'Save Changes' : 'Create Block'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Block Name
              </label>
              <input
                autoFocus
                value={modalName}
                onChange={(event) => setModalName(event.target.value)}
                placeholder={
                  showBlockModal === 'requirement'
                    ? 'e.g. Identity Verification'
                    : 'e.g. Workday Provisioning'
                }
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Gate Type
              </label>
              <div className="grid grid-cols-2 gap-2">
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

            {showBlockModal === 'system' ? (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Integration Type
                </label>
                <select
                  value={modalIntegrationType}
                  onChange={(event) =>
                    setModalIntegrationType(
                      isIntegrationType(event.target.value)
                        ? event.target.value
                        : '',
                    )
                  }
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Select type</option>
                  {integrationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Requirements
                </label>
                <div className="min-h-[54px] rounded-lg border border-slate-200 bg-slate-100 p-2">
                  {modalRequirements.length === 0 ? (
                    <span className="text-xs text-slate-400">
                      Select from the list below
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {modalRequirements.map((requirement) => (
                        <span
                          key={requirement.id}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-xs font-medium text-slate-700"
                        >
                          {requirement.name}
                          <select
                            value={requirement.owner}
                            onChange={(event) =>
                              setModalRequirements((current) =>
                                current.map((candidate) =>
                                  candidate.id === requirement.id
                                    ? {
                                        ...candidate,
                                        owner: isRequirementOwner(
                                          event.target.value,
                                        )
                                          ? event.target.value
                                          : 'worker',
                                      }
                                    : candidate,
                                ),
                              )
                            }
                            className="bg-transparent text-[10px] text-slate-400 outline-none"
                          >
                            {ownerOptions.map((owner) => (
                              <option key={owner.value} value={owner.value}>
                                {owner.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setModalRequirements((current) =>
                                current.filter(
                                  (candidate) =>
                                    candidate.id !== requirement.id,
                                ),
                              )
                            }
                            className="rounded-full p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {REQUIREMENTS.filter(
                    (requirement) =>
                      !modalRequirements.some(
                        (selected) => selected.id === requirement.id,
                      ),
                  ).map((requirement) => (
                    <button
                      key={requirement.id}
                      type="button"
                      onClick={() =>
                        setModalRequirements((current) => [
                          ...current,
                          requirement,
                        ])
                      }
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:border-cyan-300 hover:bg-cyan-50"
                    >
                      <span>{requirement.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {ownerLabel(requirement.owner)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
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

function PipelineBlockCard({
  block,
  selected,
  showConnector,
  onSelect,
  onRemove,
}: {
  block: PipelineBlock
  selected: boolean
  showConnector: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const isSystem = block.type === 'system'

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect()
        }}
        className={
          isSystem
            ? selected
              ? 'overflow-hidden rounded-2xl border border-cyan-500 bg-slate-950 shadow-[0_0_0_3px_rgba(8,145,178,0.14)]'
              : 'overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm hover:border-cyan-500'
            : selected
              ? 'relative overflow-hidden rounded-2xl border border-cyan-500 bg-white shadow-[0_0_0_3px_rgba(8,145,178,0.14)]'
              : 'relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-cyan-300'
        }
      >
        {isSystem ? (
          <>
            <div className="flex items-center gap-3 bg-slate-950 px-4 py-3 text-slate-100">
              <GripVertical className="h-4 w-4 text-slate-500" />
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-800 font-mono text-xs font-bold">
                {block.order}
              </span>
              <span className="flex flex-1 items-center gap-2 text-sm font-semibold">
                <Cog className="h-4 w-4 text-cyan-300" />
                {block.name}
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200">
                  System
                </span>
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove()
                }}
                className="rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 bg-slate-900 px-4 py-3">
              <span className="inline-flex items-center gap-1 rounded-md border border-green-400/20 bg-slate-800 px-2 py-1 font-mono text-[10px] text-green-300">
                <Plug className="h-3 w-3" />
                {block.integrationType === 'api_call'
                  ? 'API Call'
                  : 'Integration'}
              </span>
              <span className="rounded-md border border-amber-400/20 bg-slate-800 px-2 py-1 font-mono text-[10px] text-amber-300">
                {gateLabel(block.gate)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div
              className={
                block.gate === 'hard'
                  ? 'absolute inset-y-0 left-0 w-1 bg-red-600'
                  : 'absolute inset-y-0 left-0 w-1 bg-amber-500'
              }
            />
            <div className="flex items-center gap-3 px-4 py-3 pl-5">
              <GripVertical className="h-4 w-4 text-slate-400" />
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-900 bg-white font-mono text-xs font-bold text-slate-900">
                {block.order}
              </span>
              <span className="flex-1 text-sm font-semibold text-slate-900">
                {block.name}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${gateClass(
                  block.gate,
                )}`}
              >
                {gateLabel(block.gate)}
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {block.requirements.length} req
                {block.requirements.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove()
                }}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {selected && (
              <div className="border-t border-slate-200 px-5 py-3">
                <div className="mb-2 grid grid-cols-[1fr_auto] text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  <span>Requirement</span>
                  <span>Owner</span>
                </div>
                <div className="space-y-2">
                  {block.requirements.map((requirement) => (
                    <div
                      key={requirement.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                    >
                      <span className="text-xs text-slate-700">
                        {requirement.name}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ownerClass(
                          requirement.owner,
                        )}`}
                      >
                        {ownerLabel(requirement.owner)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showConnector && (
        <div className="mx-auto flex w-10 flex-col items-center">
          <div
            className={
              block.gate === 'hard'
                ? 'h-4 w-px bg-red-300'
                : 'h-4 w-px bg-amber-300'
            }
          />
          <div
            className={
              block.gate === 'hard'
                ? 'h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-400'
                : 'h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-amber-400'
            }
          />
          <div
            className={
              block.gate === 'hard'
                ? 'h-4 w-px bg-red-300'
                : 'h-4 w-px bg-amber-300'
            }
          />
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
