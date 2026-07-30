'use client'

export type LifecycleType = 'onboarding' | 'offboarding'
export type LifecycleRunStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'complete'
  | 'cancelled'
export type LifecycleStatusLabel =
  | 'Pending'
  | 'In Progress'
  | 'Blocked'
  | 'Ready'
  | 'Cancelled'
export type LifecycleBlockStatus =
  | 'gated'
  | 'in_progress'
  | 'blocked'
  | 'complete'
  | 'skipped'
export type LifecycleActivityStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'complete'
  | 'waived'
export type LifecycleOwner =
  | 'worker'
  | 'supplier'
  | 'hiring_manager'
  | 'it'
  | 'system'

export type LifecycleSummary = {
  runId: number
  workerId: number
  workerEngagementId: number
  engagementId: number | null
  engagementNumber: string
  workOrderId: number
  workOrderNumber: string
  lifecycleType: LifecycleType
  name: string
  email: string
  role: string
  supplier: string
  startDate: string | null
  endDate: string | null
  readiness: number
  status: LifecycleStatusLabel
  runStatus: LifecycleRunStatus
  pendingWith: string
  currentBlockerTask: string
  currentBlockerBlock: string
  manager: string
  department: string
  costCenter: string
  workerStatus: string
  registrationStatus: string
  registeredAt: string | null
  businessDaysUntilStart: number | null
  activeGateBlocker: boolean
  workflowId: number | null
  workflowName: string
  workflowVersion: number
  startedAt: string
  completedAt: string | null
  updatedAt: string
}

export type LifecycleActivity = {
  id: number
  sequence: number
  name: string
  owner: LifecycleOwner
  status: LifecycleActivityStatus
  config: Record<string, unknown>
  evidence: Record<string, unknown>
  notes: string
  canUpdate: boolean
  startedAt: string | null
  completedAt: string | null
  completedBy: number | null
  updatedAt: string
}

export type LifecycleBlock = {
  id: number
  sourceBlockId: number | null
  clientKey: string
  sequence: number
  blockType: 'requirement' | 'system'
  name: string
  gateType: 'hard' | 'soft'
  integrationType: string
  status: LifecycleBlockStatus
  config: Record<string, unknown>
  layout: Record<string, unknown>
  activities: LifecycleActivity[]
  startedAt: string | null
  completedAt: string | null
}

export type LifecycleGovernanceEvent = {
  activityId: number
  name: string
  status: string
  owner: string
  completedAt: string | null
  evidence: Record<string, unknown>
}

export type LifecycleDetail = LifecycleSummary & {
  tenantId: number | null
  permissions: {
    canManageWorker: boolean
    canStartOffboarding: boolean
    canSendInvite: boolean
  }
  workflow: {
    id: number | null
    name: string
    version: number
    derived: boolean
  }
  graph: {
    dependencies: Array<{
      fromBlockKey: string
      toBlockKey: string
    }>
  }
  blocks: LifecycleBlock[]
  governanceLog: LifecycleGovernanceEvent[]
  orchestrationPulse: string
  workOrder: {
    id: number
    number: string
    status: string
    location: string
  }
}

export type LifecycleListResponse = {
  results: LifecycleSummary[]
  summary: {
    activeGateBlockers: number
    total: number
  }
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

export type LifecycleListParams = {
  lifecycle_type?: LifecycleType
  status?: string
  search?: string
  page?: number
  page_size?: number
}

export type LifecycleActivityUpdate = {
  status: LifecycleActivityStatus
  evidence?: Record<string, unknown>
  notes?: string
}

export class WorkerLifecycleApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'WorkerLifecycleApiError'
    this.status = status
    this.body = body
  }
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || ''
  return ''
}

function getCsrfHeaders() {
  const token = getCookie('csrftoken')
  return token ? { 'X-CSRFToken': token } : {}
}

async function parseJsonSafe(response: Response) {
  return response.json().catch(() => ({}))
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readNullableString(value: unknown) {
  return typeof value === 'string' && value ? value : null
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function readNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = readNumber(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

function readBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function apiErrorMessage(body: unknown, fallback: string): string {
  const record = readRecord(body)
  const detail = record.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  const errors = record.errors
  if (Array.isArray(errors)) {
    const messages = errors
      .map((entry) => readRecord(entry).message)
      .filter((entry): entry is string => typeof entry === 'string')
    if (messages.length) return messages.join('\n')
  }
  return fallback
}

function throwApiError(response: Response, body: unknown, fallback: string): never {
  throw new WorkerLifecycleApiError(
    apiErrorMessage(body, fallback),
    response.status,
    body,
  )
}

function normalizeSummary(row: Record<string, unknown>): LifecycleSummary {
  return {
    runId: readNumber(row.run_id),
    workerId: readNumber(row.worker_id),
    workerEngagementId: readNumber(row.worker_engagement_id),
    engagementId: readNullableNumber(row.engagement_id),
    engagementNumber: readString(row.engagement_number),
    workOrderId: readNumber(row.work_order_id),
    workOrderNumber: readString(row.work_order_number),
    lifecycleType:
      (readString(row.lifecycle_type, 'onboarding') as LifecycleType),
    name: readString(row.name),
    email: readString(row.email),
    role: readString(row.role),
    supplier: readString(row.supplier),
    startDate: readNullableString(row.start_date),
    endDate: readNullableString(row.end_date),
    readiness: readNumber(row.readiness),
    status: readString(row.status, 'Pending') as LifecycleStatusLabel,
    runStatus: readString(row.run_status, 'pending') as LifecycleRunStatus,
    pendingWith: readString(row.pending_with),
    currentBlockerTask: readString(row.current_blocker_task),
    currentBlockerBlock: readString(row.current_blocker_block),
    manager: readString(row.manager),
    department: readString(row.department),
    costCenter: readString(row.cost_center),
    workerStatus: readString(row.worker_status),
    registrationStatus: readString(row.registration_status),
    registeredAt: readNullableString(row.registered_at),
    businessDaysUntilStart: readNullableNumber(row.business_days_until_start),
    activeGateBlocker: readBoolean(row.active_gate_blocker),
    workflowId: readNullableNumber(row.workflow_id),
    workflowName: readString(row.workflow_name),
    workflowVersion: readNumber(row.workflow_version, 1),
    startedAt: readString(row.started_at),
    completedAt: readNullableString(row.completed_at),
    updatedAt: readString(row.updated_at),
  }
}

function normalizeActivity(value: unknown): LifecycleActivity {
  const row = readRecord(value)
  return {
    id: readNumber(row.id),
    sequence: readNumber(row.sequence),
    name: readString(row.name),
    owner: readString(row.owner, 'worker') as LifecycleOwner,
    status: readString(row.status, 'pending') as LifecycleActivityStatus,
    config: readRecord(row.config),
    evidence: readRecord(row.evidence),
    notes: readString(row.notes),
    canUpdate: readBoolean(row.can_update),
    startedAt: readNullableString(row.started_at),
    completedAt: readNullableString(row.completed_at),
    completedBy: readNullableNumber(row.completed_by),
    updatedAt: readString(row.updated_at),
  }
}

function normalizeBlock(value: unknown): LifecycleBlock {
  const row = readRecord(value)
  return {
    id: readNumber(row.id),
    sourceBlockId: readNullableNumber(row.source_block_id),
    clientKey: readString(row.client_key),
    sequence: readNumber(row.sequence),
    blockType: readString(row.block_type, 'requirement') as
      | 'requirement'
      | 'system',
    name: readString(row.name),
    gateType: readString(row.gate_type, 'hard') as 'hard' | 'soft',
    integrationType: readString(row.integration_type),
    status: readString(row.status, 'gated') as LifecycleBlockStatus,
    config: readRecord(row.config),
    layout: readRecord(row.layout),
    activities: Array.isArray(row.activities)
      ? row.activities.map(normalizeActivity)
      : [],
    startedAt: readNullableString(row.started_at),
    completedAt: readNullableString(row.completed_at),
  }
}

function normalizeDetail(value: unknown): LifecycleDetail {
  const row = readRecord(value)
  const workflow = readRecord(row.workflow)
  const graph = readRecord(row.graph)
  const workOrder = readRecord(row.work_order)
  const dependencies = Array.isArray(graph.dependencies)
    ? graph.dependencies.map((entry) => {
        const dependency = readRecord(entry)
        return {
          fromBlockKey: readString(dependency.from_block_key),
          toBlockKey: readString(dependency.to_block_key),
        }
      })
    : []

  return {
    ...normalizeSummary(row),
    tenantId: readNullableNumber(row.tenant_id),
    permissions: {
      canManageWorker: readBoolean(
        readRecord(row.permissions).can_manage_worker,
      ),
      canStartOffboarding: readBoolean(
        readRecord(row.permissions).can_start_offboarding,
      ),
      canSendInvite: readBoolean(
        readRecord(row.permissions).can_send_invite,
      ),
    },
    workflow: {
      id: readNullableNumber(workflow.id),
      name: readString(workflow.name),
      version: readNumber(workflow.version, 1),
      derived: readBoolean(workflow.derived),
    },
    graph: { dependencies },
    blocks: Array.isArray(row.blocks) ? row.blocks.map(normalizeBlock) : [],
    governanceLog: Array.isArray(row.governance_log)
      ? row.governance_log.map((entry) => {
          const event = readRecord(entry)
          return {
            activityId: readNumber(event.activity_id),
            name: readString(event.name),
            status: readString(event.status),
            owner: readString(event.owner),
            completedAt: readNullableString(event.completed_at),
            evidence: readRecord(event.evidence),
          }
        })
      : [],
    orchestrationPulse: readString(row.orchestration_pulse),
    workOrder: {
      id: readNumber(workOrder.id),
      number: readString(workOrder.number),
      status: readString(workOrder.status),
      location: readString(workOrder.location),
    },
  }
}

function toSearchParams(params: LifecycleListParams) {
  const query = new URLSearchParams()
  if (params.lifecycle_type) {
    query.set('lifecycle_type', params.lifecycle_type)
  }
  if (params.status && params.status !== 'All') {
    query.set('status', params.status)
  }
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  return query
}

export async function getWorkerLifecycles(
  params: LifecycleListParams = {},
): Promise<LifecycleListResponse> {
  const query = toSearchParams(params)
  const response = await fetch(
    query.size
      ? `/api/workers/lifecycle?${query.toString()}`
      : '/api/workers/lifecycle',
    {
      credentials: 'include',
      cache: 'no-store',
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, 'Unable to load worker lifecycles.')
  }
  const row = readRecord(body)
  const summary = readRecord(row.summary)
  const pagination = readRecord(row.pagination)
  return {
    results: Array.isArray(row.results)
      ? row.results.map((entry) => normalizeSummary(readRecord(entry)))
      : [],
    summary: {
      activeGateBlockers: readNumber(summary.active_gate_blockers),
      total: readNumber(summary.total),
    },
    pagination: {
      page: readNumber(pagination.page, 1),
      pageSize: readNumber(pagination.page_size, 50),
      totalCount: readNumber(pagination.total_count),
      totalPages: readNumber(pagination.total_pages),
      hasNext: readBoolean(pagination.has_next),
      hasPrevious: readBoolean(pagination.has_previous),
    },
  }
}

export async function getWorkerLifecycle(
  workerId: number,
  lifecycleType: LifecycleType,
  assignment?: {
    workOrderId?: number | null
    engagementId?: number | null
  },
): Promise<LifecycleDetail> {
  const query = new URLSearchParams()
  if (assignment?.workOrderId) {
    query.set('work_order', String(assignment.workOrderId))
  } else if (assignment?.engagementId) {
    query.set('engagement', String(assignment.engagementId))
  }
  const suffix = query.size ? `?${query.toString()}` : ''
  const response = await fetch(
    `/api/workers/${workerId}/lifecycle/${lifecycleType}${suffix}`,
    {
      credentials: 'include',
      cache: 'no-store',
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, `Unable to load ${lifecycleType}.`)
  }
  return normalizeDetail(body)
}

export async function updateLifecycleActivity(
  workerId: number,
  lifecycleType: LifecycleType,
  activityId: number,
  payload: LifecycleActivityUpdate,
): Promise<LifecycleDetail> {
  const response = await fetch(
    `/api/workers/${workerId}/lifecycle/${lifecycleType}/activities/${activityId}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(payload),
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, 'Unable to update lifecycle activity.')
  }
  return normalizeDetail(body)
}

export async function startWorkerOffboarding(
  workerId: number,
  assignment?: {
    workOrderId?: number | null
    engagementId?: number | null
  },
): Promise<LifecycleDetail> {
  const response = await fetch(`/api/workers/${workerId}/offboarding/start`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(
      assignment?.workOrderId
        ? { work_order_id: assignment.workOrderId }
        : assignment?.engagementId
          ? { engagement_id: assignment.engagementId }
          : {},
    ),
  })
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, 'Unable to start offboarding.')
  }
  return normalizeDetail(body)
}

export async function sendWorkerInvite(
  workerId: number,
  assignment?: {
    workOrderId?: number | null
    engagementId?: number | null
  },
) {
  const response = await fetch(`/api/workers/${workerId}/invite`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(
      assignment?.workOrderId
        ? { work_order_id: assignment.workOrderId }
        : assignment?.engagementId
          ? { engagement_id: assignment.engagementId }
          : {},
    ),
  })
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, 'Unable to send worker invite.')
  }
  return readRecord(body)
}
