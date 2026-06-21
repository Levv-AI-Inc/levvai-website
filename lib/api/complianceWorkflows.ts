'use client'

export type WorkflowType = 'onboarding' | 'offboarding'
export type WorkflowStatus = 'draft' | 'published' | 'archived'
export type GateType = 'hard' | 'soft'
export type BlockType = 'requirement' | 'system'
export type ScopeFieldKey =
  | 'location'
  | 'cost_center'
  | 'business_unit'
  | 'role'
  | 'supplier'
export type RequirementOwner =
  | 'worker'
  | 'supplier'
  | 'hiring_manager'
  | 'it'
  | 'system'
export type IntegrationType = 'api_call'

export type Option = {
  value: string
  label: string
}

export type WorkflowHealth = {
  status: 'complete' | 'incomplete'
  checks: {
    policy_name_set: boolean
    at_least_one_step: boolean
    no_block_issues: boolean
    no_circular_dependencies: boolean
  }
  counts: {
    steps: number
    requirements: number
    hard_gates: number
    soft_gates: number
    system_blocks: number
  }
}

export type PolicyScopeField = {
  id?: number
  sequence: number
  field_key: ScopeFieldKey
  operator: 'equals'
  location?: number | null
  cost_center?: number | null
  business_unit?: number | null
  role_definition?: number | null
  supplier?: number | null
  label?: string
  display?: string
}

export type PolicyScope = {
  id?: number
  worker_type: 'contingent' | 'employee' | 'contractor' | ''
  fields: PolicyScopeField[]
}

export type WorkflowBlockRequirement = {
  id?: number
  sequence: number
  requirement?: number | null
  requirement_name?: string
  name: string
  owner: RequirementOwner
  config?: Record<string, unknown>
}

export type WorkflowBlock = {
  id?: number
  sequence: number
  block_type: BlockType
  name: string
  gate_type: GateType
  integration_type?: IntegrationType | ''
  config?: Record<string, unknown>
  requirements?: WorkflowBlockRequirement[]
  created_at?: string
  updated_at?: string
}

export type Workflow = {
  id: number
  tenant_id: number | null
  name: string
  workflow_type: WorkflowType
  status: WorkflowStatus
  is_active: boolean
  version: number
  policy_scope?: PolicyScope
  blocks: WorkflowBlock[]
  health: WorkflowHealth
  created_by: number | null
  created_at: string
  updated_at: string
}

export type WorkflowLookups = {
  workflow_types: Option[]
  workflow_statuses: Option[]
  worker_types: Option[]
  scope_fields: Option[]
  scope_operators: Option[]
  block_types: Option[]
  gate_types: Option[]
  integration_types: Option[]
  requirement_owners: Option[]
}

export type WorkflowListParams = {
  workflow_type?: WorkflowType
  status?: WorkflowStatus
  is_active?: boolean
  search?: string
  q?: string
}

export type CreateWorkflowPayload = {
  name: string
  workflow_type: WorkflowType
  status?: WorkflowStatus
  is_active?: boolean
  policy_scope?: PolicyScope
  blocks?: WorkflowBlock[]
}

export type UpdateWorkflowPayload = Partial<CreateWorkflowPayload>

export class ComplianceWorkflowsApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ComplianceWorkflowsApiError'
    this.status = status
    this.body = body
  }
}

const WORKFLOWS_BASE_PATH = '/api/compliance/workflows/'

const EMPTY_HEALTH: WorkflowHealth = {
  status: 'incomplete',
  checks: {
    policy_name_set: false,
    at_least_one_step: false,
    no_block_issues: true,
    no_circular_dependencies: true,
  },
  counts: {
    steps: 0,
    requirements: 0,
    hard_gates: 0,
    soft_gates: 0,
    system_blocks: 0,
  },
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return undefined
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || ''
  return ''
}

function getCsrfHeaders() {
  const csrfToken = getCookie('csrftoken')
  if (!csrfToken) return {}
  return {
    'X-CSRFToken': csrfToken,
  }
}

async function parseJsonSafe(response: Response) {
  return response.json().catch(() => ({}))
}

function toErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) return detail

    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        return `${key.replace(/_/g, ' ')}: ${value}`
      }
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0]
        if (typeof first === 'string' && first.trim()) {
          return `${key.replace(/_/g, ' ')}: ${first}`
        }
      }
    }
  }

  return fallback
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object',
    )
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { results?: unknown[] }).results)
  ) {
    return (payload as { results: unknown[] }).results.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object',
    )
  }

  return []
}

function normalizeWorkflowType(value: unknown): WorkflowType {
  return readOptionalString(value)?.toLowerCase() === 'offboarding'
    ? 'offboarding'
    : 'onboarding'
}

function normalizeWorkflowStatus(value: unknown): WorkflowStatus {
  const status = readOptionalString(value)?.toLowerCase()
  if (status === 'published' || status === 'archived') return status
  return 'draft'
}

function normalizeGateType(value: unknown): GateType {
  return readOptionalString(value)?.toLowerCase() === 'soft' ? 'soft' : 'hard'
}

function normalizeBlockType(value: unknown): BlockType {
  return readOptionalString(value)?.toLowerCase() === 'system'
    ? 'system'
    : 'requirement'
}

function normalizeScopeFieldKey(value: unknown): ScopeFieldKey {
  const key = readOptionalString(value)?.toLowerCase()
  if (
    key === 'location' ||
    key === 'cost_center' ||
    key === 'business_unit' ||
    key === 'role' ||
    key === 'supplier'
  ) {
    return key
  }

  return 'location'
}

function normalizeRequirementOwner(value: unknown): RequirementOwner {
  const owner = readOptionalString(value)?.toLowerCase().replace(/\s+/g, '_')
  if (
    owner === 'worker' ||
    owner === 'supplier' ||
    owner === 'hiring_manager' ||
    owner === 'it' ||
    owner === 'system'
  ) {
    return owner
  }

  return 'worker'
}

function normalizeIntegrationType(value: unknown): IntegrationType | '' {
  return readOptionalString(value)?.toLowerCase() === 'api_call'
    ? 'api_call'
    : ''
}

function normalizeWorkerType(
  value: unknown,
): PolicyScope['worker_type'] {
  const workerType = readOptionalString(value)?.toLowerCase()
  if (
    workerType === 'contingent' ||
    workerType === 'employee' ||
    workerType === 'contractor'
  ) {
    return workerType
  }

  return ''
}

function normalizeOption(row: unknown): Option | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const value = readOptionalString(record.value)
  const label = readOptionalString(record.label) || value
  if (!value || !label) return null
  return { value, label }
}

function normalizeLookupOptions(value: unknown): Option[] {
  if (!Array.isArray(value)) return []
  return value.map(normalizeOption).filter((option): option is Option => !!option)
}

function normalizeLookups(payload: unknown): WorkflowLookups {
  const record =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {}

  return {
    workflow_types: normalizeLookupOptions(record.workflow_types),
    workflow_statuses: normalizeLookupOptions(record.workflow_statuses),
    worker_types: normalizeLookupOptions(record.worker_types),
    scope_fields: normalizeLookupOptions(record.scope_fields),
    scope_operators: normalizeLookupOptions(record.scope_operators),
    block_types: normalizeLookupOptions(record.block_types),
    gate_types: normalizeLookupOptions(record.gate_types),
    integration_types: normalizeLookupOptions(record.integration_types),
    requirement_owners: normalizeLookupOptions(record.requirement_owners),
  }
}

function normalizeHealth(payload: unknown): WorkflowHealth {
  if (!payload || typeof payload !== 'object') return EMPTY_HEALTH

  const record = payload as Record<string, unknown>
  const checks =
    record.checks && typeof record.checks === 'object'
      ? (record.checks as Record<string, unknown>)
      : {}
  const counts =
    record.counts && typeof record.counts === 'object'
      ? (record.counts as Record<string, unknown>)
      : {}

  return {
    status:
      readOptionalString(record.status)?.toLowerCase() === 'complete'
        ? 'complete'
        : 'incomplete',
    checks: {
      policy_name_set:
        readOptionalBoolean(checks.policy_name_set) ??
        EMPTY_HEALTH.checks.policy_name_set,
      at_least_one_step:
        readOptionalBoolean(checks.at_least_one_step) ??
        EMPTY_HEALTH.checks.at_least_one_step,
      no_block_issues:
        readOptionalBoolean(checks.no_block_issues) ??
        EMPTY_HEALTH.checks.no_block_issues,
      no_circular_dependencies:
        readOptionalBoolean(checks.no_circular_dependencies) ??
        EMPTY_HEALTH.checks.no_circular_dependencies,
    },
    counts: {
      steps: readOptionalNumber(counts.steps) ?? EMPTY_HEALTH.counts.steps,
      requirements:
        readOptionalNumber(counts.requirements) ??
        EMPTY_HEALTH.counts.requirements,
      hard_gates:
        readOptionalNumber(counts.hard_gates) ??
        EMPTY_HEALTH.counts.hard_gates,
      soft_gates:
        readOptionalNumber(counts.soft_gates) ??
        EMPTY_HEALTH.counts.soft_gates,
      system_blocks:
        readOptionalNumber(counts.system_blocks) ??
        EMPTY_HEALTH.counts.system_blocks,
    },
  }
}

function normalizePolicyScopeField(
  row: Record<string, unknown>,
): PolicyScopeField {
  return {
    id: readOptionalNumber(row.id),
    sequence: readOptionalNumber(row.sequence) ?? 0,
    field_key: normalizeScopeFieldKey(row.field_key),
    operator: 'equals',
    location: readOptionalNumber(row.location) ?? null,
    cost_center: readOptionalNumber(row.cost_center) ?? null,
    business_unit: readOptionalNumber(row.business_unit) ?? null,
    role_definition: readOptionalNumber(row.role_definition) ?? null,
    supplier: readOptionalNumber(row.supplier) ?? null,
    label: readOptionalString(row.label),
    display: readOptionalString(row.display),
  }
}

function normalizePolicyScope(payload: unknown): PolicyScope | undefined {
  if (!payload || typeof payload !== 'object') return undefined

  const record = payload as Record<string, unknown>
  const rawFields = Array.isArray(record.fields) ? record.fields : []

  return {
    id: readOptionalNumber(record.id),
    worker_type: normalizeWorkerType(record.worker_type),
    fields: rawFields
      .filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === 'object',
      )
      .map(normalizePolicyScopeField)
      .sort((a, b) => a.sequence - b.sequence),
  }
}

function normalizeWorkflowBlockRequirement(
  row: Record<string, unknown>,
): WorkflowBlockRequirement {
  return {
    id: readOptionalNumber(row.id),
    sequence: readOptionalNumber(row.sequence) ?? 0,
    requirement: readOptionalNumber(row.requirement) ?? null,
    requirement_name: readOptionalString(row.requirement_name),
    name:
      readOptionalString(row.name) ||
      readOptionalString(row.requirement_name) ||
      '',
    owner: normalizeRequirementOwner(row.owner),
    config:
      row.config && typeof row.config === 'object'
        ? (row.config as Record<string, unknown>)
        : undefined,
  }
}

function normalizeWorkflowBlock(row: Record<string, unknown>): WorkflowBlock {
  const rawRequirements = Array.isArray(row.requirements)
    ? row.requirements
    : []

  return {
    id: readOptionalNumber(row.id),
    sequence: readOptionalNumber(row.sequence) ?? 0,
    block_type: normalizeBlockType(row.block_type),
    name: readOptionalString(row.name) || '',
    gate_type: normalizeGateType(row.gate_type),
    integration_type: normalizeIntegrationType(row.integration_type),
    config:
      row.config && typeof row.config === 'object'
        ? (row.config as Record<string, unknown>)
        : undefined,
    requirements: rawRequirements
      .filter(
        (requirement): requirement is Record<string, unknown> =>
          Boolean(requirement) && typeof requirement === 'object',
      )
      .map(normalizeWorkflowBlockRequirement)
      .sort((a, b) => a.sequence - b.sequence),
    created_at: readOptionalString(row.created_at),
    updated_at: readOptionalString(row.updated_at),
  }
}

function normalizeWorkflow(row: Record<string, unknown>): Workflow {
  const rawBlocks = Array.isArray(row.blocks) ? row.blocks : []

  return {
    id: readOptionalNumber(row.id) ?? 0,
    tenant_id: readOptionalNumber(row.tenant_id) ?? null,
    name: readOptionalString(row.name) || '',
    workflow_type: normalizeWorkflowType(row.workflow_type),
    status: normalizeWorkflowStatus(row.status),
    is_active: readOptionalBoolean(row.is_active) ?? false,
    version: readOptionalNumber(row.version) ?? 1,
    policy_scope: normalizePolicyScope(row.policy_scope),
    blocks: rawBlocks
      .filter(
        (block): block is Record<string, unknown> =>
          Boolean(block) && typeof block === 'object',
      )
      .map(normalizeWorkflowBlock)
      .sort((a, b) => a.sequence - b.sequence),
    health: normalizeHealth(row.health),
    created_by: readOptionalNumber(row.created_by) ?? null,
    created_at: readOptionalString(row.created_at) || '',
    updated_at: readOptionalString(row.updated_at) || '',
  }
}

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T
}

function buildWorkflowQuery(params: WorkflowListParams = {}) {
  const query = new URLSearchParams()

  if (params.workflow_type) query.set('workflow_type', params.workflow_type)
  if (params.status) query.set('status', params.status)
  if (typeof params.is_active === 'boolean') {
    query.set('is_active', String(params.is_active))
  }
  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  } else if (params.q?.trim()) {
    query.set('q', params.q.trim())
  }

  const suffix = query.toString()
  return suffix ? `${WORKFLOWS_BASE_PATH}?${suffix}` : WORKFLOWS_BASE_PATH
}

export async function getComplianceWorkflows(
  params: WorkflowListParams = {},
): Promise<Workflow[]> {
  const response = await fetch(buildWorkflowQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new ComplianceWorkflowsApiError(
      toErrorMessage(
        body,
        `Failed to load workflows (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  return extractRows(body).map(normalizeWorkflow)
}

export async function getComplianceWorkflow(
  id: number | string,
): Promise<Workflow> {
  const response = await fetch(
    `${WORKFLOWS_BASE_PATH}${encodeURIComponent(String(id))}/`,
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new ComplianceWorkflowsApiError(
      toErrorMessage(
        body,
        `Failed to load workflow (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  return normalizeWorkflow(
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {},
  )
}

export async function createComplianceWorkflow(
  payload: CreateWorkflowPayload,
): Promise<Workflow> {
  const response = await fetch(WORKFLOWS_BASE_PATH, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(sanitizePayload(payload)),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new ComplianceWorkflowsApiError(
      toErrorMessage(
        body,
        `Failed to create workflow (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  return normalizeWorkflow(
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {},
  )
}

export async function updateComplianceWorkflow(
  id: number | string,
  payload: UpdateWorkflowPayload,
): Promise<Workflow> {
  const response = await fetch(
    `${WORKFLOWS_BASE_PATH}${encodeURIComponent(String(id))}/`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(sanitizePayload(payload)),
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new ComplianceWorkflowsApiError(
      toErrorMessage(
        body,
        `Failed to update workflow (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  return normalizeWorkflow(
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {},
  )
}

export async function deleteComplianceWorkflow(
  id: number | string,
): Promise<void> {
  const response = await fetch(
    `${WORKFLOWS_BASE_PATH}${encodeURIComponent(String(id))}/`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...getCsrfHeaders(),
      },
    },
  )

  if (response.status === 204) return

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new ComplianceWorkflowsApiError(
      toErrorMessage(
        body,
        `Failed to delete workflow (${response.status})`,
      ),
      response.status,
      body,
    )
  }
}

export async function getComplianceWorkflowLookups(): Promise<WorkflowLookups> {
  const response = await fetch(`${WORKFLOWS_BASE_PATH}lookups/`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new ComplianceWorkflowsApiError(
      toErrorMessage(
        body,
        `Failed to load workflow lookups (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  return normalizeLookups(body)
}
