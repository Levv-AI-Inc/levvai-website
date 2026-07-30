'use client'

export type WorkerStatus =
  | 'invited'
  | 'onboarding'
  | 'active'
  | 'offboarding'
  | 'offboarded'

export type WorkerComplianceStatus =
  | 'compliant'
  | 'review_required'
  | 'non_compliant'

export type WorkerDirectoryPermissions = {
  canViewProfile: boolean
  canExtendContract: boolean
  canOffboard: boolean
}

export type WorkerAssignment = {
  workerEngagementId: number
  engagementId: number | null
  engagementNumber: string
  workOrderId: number
  workOrderNumber: string
  workerType: string
  workerTypeLabel: string
  status: string
  supplier: string
  role: string
  startDate: string
  endDate: string
  location: string
  onboardingRunId: number | null
  onboardingStatus: string
  offboardingRunId: number | null
  offboardingStatus: string
  isCurrent: boolean
}

export type WorkerDirectoryRecord = {
  workerId: number
  cwsId: string
  hrSystemId: string
  name: string
  email: string
  phone: string
  workerStatus: WorkerStatus
  workerType: string
  workerTypeLabel: string
  complianceStatus: WorkerComplianceStatus
  registeredAt: string
  workerEngagementId: number | null
  engagementId: number | null
  engagementNumber: string
  workOrderId: number | null
  workOrderNumber: string
  assignmentStatus: string
  supplier: string
  role: string
  owner: string
  department: string
  location: string
  startDate: string
  endDate: string
  onboardingRunId: number | null
  onboardingStatus: string
  offboardingRunId: number | null
  offboardingStatus: string
  permissions: WorkerDirectoryPermissions
  assignments: WorkerAssignment[]
}

export type WorkerDirectoryResponse = {
  results: WorkerDirectoryRecord[]
  summary: {
    totalWorkers: number
    complianceAlerts: number
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

export class WorkerDirectoryApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'WorkerDirectoryApiError'
    this.status = status
    this.body = body
  }
}

type RecordLike = Record<string, unknown>

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asRecord(value: unknown): RecordLike {
  return isRecord(value) ? value : {}
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function readOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = readNumber(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return fallback
}

function readWorkerStatus(value: unknown): WorkerStatus {
  const normalized = readString(value).toLowerCase()
  if (
    normalized === 'invited' ||
    normalized === 'onboarding' ||
    normalized === 'active' ||
    normalized === 'offboarding' ||
    normalized === 'offboarded'
  ) {
    return normalized
  }
  return 'invited'
}

function readComplianceStatus(value: unknown): WorkerComplianceStatus {
  const normalized = readString(value).toLowerCase()
  if (
    normalized === 'compliant' ||
    normalized === 'review_required' ||
    normalized === 'non_compliant'
  ) {
    return normalized
  }
  return 'review_required'
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
  return csrfToken ? { 'X-CSRFToken': csrfToken } : {}
}

async function parseJsonSafe(response: Response) {
  return response.json().catch(() => ({}))
}

function errorMessage(body: unknown, fallback: string) {
  const record = asRecord(body)
  const detail = record.detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (Array.isArray(detail)) {
    const messages = detail
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
    if (messages.length) return messages.join(' ')
  }
  return fallback
}

function normalizePermissions(value: unknown): WorkerDirectoryPermissions {
  const row = asRecord(value)
  return {
    canViewProfile: readBoolean(row.can_view_profile, true),
    canExtendContract: readBoolean(row.can_extend_contract),
    canOffboard: readBoolean(row.can_offboard),
  }
}

function normalizeAssignment(value: unknown): WorkerAssignment {
  const row = asRecord(value)
  return {
    workerEngagementId: readNumber(row.worker_engagement_id),
    engagementId: readOptionalNumber(row.engagement_id),
    engagementNumber: readString(row.engagement_number),
    workOrderId: readNumber(row.work_order_id),
    workOrderNumber: readString(row.work_order_number),
    workerType: readString(row.worker_type),
    workerTypeLabel: readString(row.worker_type_label),
    status: readString(row.status),
    supplier: readString(row.supplier),
    role: readString(row.role),
    startDate: readString(row.start_date),
    endDate: readString(row.end_date),
    location: readString(row.location),
    onboardingRunId: readOptionalNumber(row.onboarding_run_id),
    onboardingStatus: readString(row.onboarding_status),
    offboardingRunId: readOptionalNumber(row.offboarding_run_id),
    offboardingStatus: readString(row.offboarding_status),
    isCurrent: readBoolean(row.is_current),
  }
}

function normalizeWorker(value: unknown): WorkerDirectoryRecord {
  const row = asRecord(value)
  const assignments = Array.isArray(row.assignments)
    ? row.assignments.map(normalizeAssignment)
    : []
  return {
    workerId: readNumber(row.worker_id),
    cwsId: readString(row.cws_id),
    hrSystemId: readString(row.hr_system_id),
    name: readString(row.name, 'Unnamed worker'),
    email: readString(row.email),
    phone: readString(row.phone),
    workerStatus: readWorkerStatus(row.worker_status),
    workerType: readString(row.worker_type),
    workerTypeLabel: readString(row.worker_type_label),
    complianceStatus: readComplianceStatus(row.compliance_status),
    registeredAt: readString(row.registered_at),
    workerEngagementId: readOptionalNumber(row.worker_engagement_id),
    engagementId: readOptionalNumber(row.engagement_id),
    engagementNumber: readString(row.engagement_number),
    workOrderId: readOptionalNumber(row.work_order_id),
    workOrderNumber: readString(row.work_order_number),
    assignmentStatus: readString(row.assignment_status),
    supplier: readString(row.supplier),
    role: readString(row.role),
    owner: readString(row.owner),
    department: readString(row.department),
    location: readString(row.location),
    startDate: readString(row.start_date),
    endDate: readString(row.end_date),
    onboardingRunId: readOptionalNumber(row.onboarding_run_id),
    onboardingStatus: readString(row.onboarding_status),
    offboardingRunId: readOptionalNumber(row.offboarding_run_id),
    offboardingStatus: readString(row.offboarding_status),
    permissions: normalizePermissions(row.permissions),
    assignments,
  }
}

export async function getWorkerDirectory(params?: {
  page?: number
  pageSize?: number
  status?: WorkerStatus | ''
  search?: string
}): Promise<WorkerDirectoryResponse> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('page_size', String(params.pageSize))
  if (params?.status) query.set('status', params.status)
  if (params?.search?.trim()) query.set('search', params.search.trim())
  const suffix = query.size ? `?${query.toString()}` : ''
  const response = await fetch(`/api/workers${suffix}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new WorkerDirectoryApiError(
      errorMessage(body, 'Unable to load workers.'),
      response.status,
      body,
    )
  }
  const row = asRecord(body)
  const summary = asRecord(row.summary)
  const pagination = asRecord(row.pagination)
  return {
    results: Array.isArray(row.results)
      ? row.results.map(normalizeWorker)
      : [],
    summary: {
      totalWorkers: readNumber(summary.total_workers),
      complianceAlerts: readNumber(summary.compliance_alerts),
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

export async function getWorkerDirectoryDetail(
  workerId: number,
  assignment?: {
    workOrderId?: number | null
    engagementId?: number | null
  },
): Promise<WorkerDirectoryRecord> {
  const query = new URLSearchParams()
  if (assignment?.workOrderId) {
    query.set('work_order', String(assignment.workOrderId))
  } else if (assignment?.engagementId) {
    query.set('engagement', String(assignment.engagementId))
  }
  const suffix = query.size ? `?${query.toString()}` : ''
  const response = await fetch(`/api/workers/${workerId}${suffix}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new WorkerDirectoryApiError(
      errorMessage(body, 'Unable to load worker details.'),
      response.status,
      body,
    )
  }
  return normalizeWorker(body)
}

export async function extendWorkerContract(
  workerId: number,
  payload: {
    workOrderId: number
    endDate: string
    notes?: string
  },
): Promise<WorkerDirectoryRecord> {
  const response = await fetch(
    `/api/workers/${workerId}/contract/extend`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify({
        work_order_id: payload.workOrderId,
        end_date: payload.endDate,
        notes: payload.notes || '',
      }),
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new WorkerDirectoryApiError(
      errorMessage(body, 'Unable to extend the contract.'),
      response.status,
      body,
    )
  }
  return normalizeWorker(body)
}
