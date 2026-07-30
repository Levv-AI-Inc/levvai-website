'use client'

export class CandidateApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'CandidateApiError'
    this.status = status
    this.body = body
  }
}

export type CandidateStatus =
  | 'submitted'
  | 'reviewed'
  | 'accepted'
  | 'rejected'

export type CandidateRecord = {
  id: number
  intakeId: number
  supplierId: number
  submittedBy: number | null
  fullName: string
  email: string
  phone: string
  notes: string
  resumeUrl: string
  availableStartDate: string
  proposedRate: string
  currency: string
  status: CandidateStatus
  createdAt: string
  updatedAt: string
  jobPostingId: string
  intakeTitle: string
  roleName: string
  supplierName: string
  hiringManagerId: number | null
  hiringManagerName: string
  location: string
  rateUnit: string
  skills: string[]
  daysInStage: number
  workOrderId: number | null
  workOrderNumber: string
  workOrderStatus: string
}

export type CandidateListPagination = {
  page: number
  page_size: number
  total_count: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}

export type CandidateListSummary = {
  totalCount: number
  stalledCount: number
  statusCounts: Partial<Record<CandidateStatus, number>>
}

export type CandidateListResponse = {
  results: CandidateRecord[]
  pagination: CandidateListPagination
  summary: CandidateListSummary
  permissions: {
    canDecide: boolean
  }
}

export type CandidateListParams = {
  page?: number
  page_size?: number
  status?: CandidateStatus
  search?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 'true'
}

function normalizeStatus(value: unknown): CandidateStatus {
  const status = readString(value).trim().toLowerCase()
  if (
    status === 'reviewed' ||
    status === 'accepted' ||
    status === 'rejected'
  ) {
    return status
  }
  return 'submitted'
}

function normalizeCandidate(value: unknown): CandidateRecord {
  const row = isRecord(value) ? value : {}
  const skills = Array.isArray(row.skills)
    ? row.skills.map(readString).filter(Boolean)
    : []

  return {
    id: readNumber(row.id) ?? 0,
    intakeId: readNumber(row.intake) ?? 0,
    supplierId: readNumber(row.supplier) ?? 0,
    submittedBy: readNumber(row.submitted_by),
    fullName: readString(row.full_name),
    email: readString(row.email),
    phone: readString(row.phone),
    notes: readString(row.notes),
    resumeUrl: readString(row.resume_url),
    availableStartDate: readString(row.available_start_date),
    proposedRate: readString(row.proposed_rate),
    currency: readString(row.currency),
    status: normalizeStatus(row.status),
    createdAt: readString(row.created_at),
    updatedAt: readString(row.updated_at),
    jobPostingId: readString(row.job_posting_id),
    intakeTitle: readString(row.intake_title),
    roleName: readString(row.role_name),
    supplierName: readString(row.supplier_name),
    hiringManagerId: readNumber(row.hiring_manager_id),
    hiringManagerName: readString(row.hiring_manager_name),
    location: readString(row.location),
    rateUnit: readString(row.rate_unit),
    skills,
    daysInStage: readNumber(row.days_in_stage) ?? 0,
    workOrderId: readNumber(row.work_order_id),
    workOrderNumber: readString(row.work_order_number),
    workOrderStatus: readString(row.work_order_status),
  }
}

function normalizePagination(
  body: Record<string, unknown>,
  resultCount: number,
): CandidateListPagination {
  const value = isRecord(body.pagination) ? body.pagination : {}
  return {
    page: readNumber(value.page) ?? 1,
    page_size: readNumber(value.page_size) ?? resultCount,
    total_count: readNumber(value.total_count) ?? resultCount,
    total_pages: readNumber(value.total_pages) ?? (resultCount ? 1 : 0),
    has_next: readBoolean(value.has_next),
    has_previous: readBoolean(value.has_previous),
  }
}

function normalizeSummary(
  body: Record<string, unknown>,
  totalCount: number,
): CandidateListSummary {
  const value = isRecord(body.summary) ? body.summary : {}
  const counts = isRecord(value.status_counts) ? value.status_counts : {}

  return {
    totalCount: readNumber(value.total_count) ?? totalCount,
    stalledCount: readNumber(value.stalled_count) ?? 0,
    statusCounts: {
      submitted: readNumber(counts.submitted) ?? 0,
      reviewed: readNumber(counts.reviewed) ?? 0,
      accepted: readNumber(counts.accepted) ?? 0,
      rejected: readNumber(counts.rejected) ?? 0,
    },
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    const detail = readString(body.detail)
    if (detail) return detail
  }
  return fallback
}

function getCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('csrftoken='))
  return match ? decodeURIComponent(match.slice('csrftoken='.length)) : ''
}

export async function getCandidates(
  params: CandidateListParams = {},
): Promise<CandidateListResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  if (params.status) query.set('status', params.status)
  if (params.search?.trim()) query.set('search', params.search.trim())

  const suffix = query.toString()
  const response = await fetch(
    suffix ? `/api/candidates?${suffix}` : '/api/candidates',
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new CandidateApiError(
      errorMessage(body, `Failed to load candidates (${response.status})`),
      response.status,
      body,
    )
  }

  const normalizedBody = isRecord(body) ? body : {}
  const rows = Array.isArray(normalizedBody.results)
    ? normalizedBody.results.map(normalizeCandidate)
    : []
  const pagination = normalizePagination(normalizedBody, rows.length)

  return {
    results: rows,
    pagination,
    summary: normalizeSummary(normalizedBody, pagination.total_count),
    permissions: {
      canDecide: readBoolean(
        isRecord(normalizedBody.permissions)
          ? normalizedBody.permissions.can_decide
          : false,
      ),
    },
  }
}

export async function getCandidate(
  candidateId: number | string,
): Promise<CandidateRecord> {
  const response = await fetch(
    `/api/candidates/${encodeURIComponent(String(candidateId))}`,
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new CandidateApiError(
      errorMessage(body, `Failed to load candidate (${response.status})`),
      response.status,
      body,
    )
  }
  return normalizeCandidate(body)
}

export async function updateCandidateStatus(
  candidateId: number | string,
  status: Exclude<CandidateStatus, 'submitted'>,
): Promise<CandidateRecord> {
  const csrfToken = getCsrfToken()
  const response = await fetch(
    `/api/candidates/${encodeURIComponent(String(candidateId))}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      },
      body: JSON.stringify({ status }),
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new CandidateApiError(
      errorMessage(body, `Failed to update candidate (${response.status})`),
      response.status,
      body,
    )
  }
  return normalizeCandidate(body)
}
