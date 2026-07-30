'use client'

export class EngagementApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'EngagementApiError'
    this.status = status
    this.body = body
  }
}

export type EngagementStatus =
  | 'pending_supplier_acceptance'
  | 'accepted'
  | 'changes_requested'
  | 'cancelled'

export type EngagementListItem = {
  id: number
  engagementNumber: string | null
  workOrder: number
  workOrderNumber: string
  workOrderStatus: string
  intake: number | null
  intakeTitle: string | null
  supplier: number | null
  supplierName: string | null
  roleDefinition: number | null
  roleName: string | null
  workerFullName: string
  status: EngagementStatus
  startDate: string | null
  endDate: string | null
  billRate: string | null
  currency: string
  workLocationLabel: string
  createdAt: string
  acceptedAt: string | null
  changeRequestedAt: string | null
}

export type EngagementDetail = EngagementListItem & {
  tenantId: number | null
  workOrderApprovalStatus: string
  workerEmail: string
  payRate: string | null
  hoursPerWeek: string | null
  overtimeEnabled: boolean
  overtimeMultiplier: string | null
  overtimeRulesLabel: string
  estimatedCost: string | null
  supervisorName: string
  onboardingTasks: string[]
  requiredDocuments: string[]
  invoiceCycle: string
  paymentTermsLabel: string
  supplierResponseNotes: string
  sourceSnapshot: Record<string, unknown>
  acceptedBy: number | null
  changeRequestedBy: number | null
  createdBy: number | null
  updatedAt: string
  workerId?: number | null
  workerIsNew?: boolean
  workerEngagementId?: number | null
  onboardingRunId?: number | null
  matchedWorkflowId?: number | null
  registrationRequired?: boolean
}

export type EngagementListPagination = {
  page: number
  page_size: number
  total_count: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}

export type EngagementListResponse = {
  results: EngagementListItem[]
  pagination: EngagementListPagination
}

export type EngagementListParams = {
  page?: number
  page_size?: number
  status?: EngagementStatus | string
  supplier?: number
  work_order?: number
}

export type EngagementAcceptPayload = {
  supplier_response_notes?: string
}

export type EngagementRequestChangePayload = {
  supplier_response_notes: string
}

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike }

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

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
  )
}

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T
}

function readMessages(value: JsonLike | undefined): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') return [value]
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => readMessages(entry))
  }
  if (typeof value === 'object') {
    const typedValue = value as Record<string, JsonLike>
    if (
      typeof typedValue.message === 'string' &&
      typedValue.message.trim()
    ) {
      const field =
        typeof typedValue.field === 'string'
          ? typedValue.field.replace(/_/g, ' ').trim()
          : ''
      return [field ? `${field}: ${typedValue.message}` : typedValue.message]
    }

    const messages: string[] = []
    for (const [key, entry] of Object.entries(typedValue)) {
      const nested = readMessages(entry)
      if (!nested.length) continue
      if (key === 'detail' || key === 'non_field_errors' || key === 'errors') {
        messages.push(...nested)
      } else {
        const label = key.replace(/_/g, ' ')
        messages.push(...nested.map((message) => `${label}: ${message}`))
      }
    }
    return messages
  }
  return []
}

function formatApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const messages = readMessages(body as JsonLike)
  const unique = Array.from(new Set(messages.filter(Boolean)))
  return unique.length ? unique.join('\n') : fallback
}

function throwApiError(response: Response, body: unknown, fallback: string): never {
  throw new EngagementApiError(
    formatApiError(body, fallback),
    response.status,
    body,
  )
}

function normalizePagination(value: unknown): EngagementListPagination {
  const row =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}

  return {
    page: readOptionalNumber(row.page) || 1,
    page_size: readOptionalNumber(row.page_size) || 25,
    total_count: readOptionalNumber(row.total_count) || 0,
    total_pages: readOptionalNumber(row.total_pages) || 0,
    has_next: readOptionalBoolean(row.has_next) || false,
    has_previous: readOptionalBoolean(row.has_previous) || false,
  }
}

function normalizeEngagementListItem(
  row: Record<string, unknown>,
): EngagementListItem {
  return {
    id: readOptionalNumber(row.id) || 0,
    engagementNumber: readOptionalString(row.engagement_number) ?? null,
    workOrder: readOptionalNumber(row.work_order) || 0,
    workOrderNumber: readOptionalString(row.work_order_number) || '',
    workOrderStatus: readOptionalString(row.work_order_status) || '',
    intake:
      readOptionalNumber(row.intake) ??
      readOptionalNumber(row.intake_id) ??
      null,
    intakeTitle: readOptionalString(row.intake_title) ?? null,
    supplier:
      readOptionalNumber(row.supplier) ??
      readOptionalNumber(row.supplier_id) ??
      null,
    supplierName: readOptionalString(row.supplier_name) ?? null,
    roleDefinition:
      readOptionalNumber(row.role_definition) ??
      readOptionalNumber(row.role_definition_id) ??
      null,
    roleName: readOptionalString(row.role_name) ?? null,
    workerFullName: readOptionalString(row.worker_full_name) || '',
    status:
      (readOptionalString(row.status) as EngagementStatus | undefined) ||
      'pending_supplier_acceptance',
    startDate: readOptionalString(row.start_date) ?? null,
    endDate: readOptionalString(row.end_date) ?? null,
    billRate: readOptionalString(row.bill_rate) ?? null,
    currency: readOptionalString(row.currency) || '',
    workLocationLabel: readOptionalString(row.work_location_label) || '',
    createdAt: readOptionalString(row.created_at) || '',
    acceptedAt: readOptionalString(row.accepted_at) ?? null,
    changeRequestedAt: readOptionalString(row.change_requested_at) ?? null,
  }
}

function normalizeEngagementDetail(
  row: Record<string, unknown>,
): EngagementDetail {
  const base = normalizeEngagementListItem(row)
  return {
    ...base,
    tenantId:
      readOptionalNumber(row.tenant_id) ??
      readOptionalNumber(row.tenant) ??
      null,
    workOrderApprovalStatus:
      readOptionalString(row.work_order_approval_status) || '',
    workerEmail: readOptionalString(row.worker_email) || '',
    payRate: readOptionalString(row.pay_rate) ?? null,
    hoursPerWeek: readOptionalString(row.hours_per_week) ?? null,
    overtimeEnabled: readOptionalBoolean(row.overtime_enabled) || false,
    overtimeMultiplier: readOptionalString(row.overtime_multiplier) ?? null,
    overtimeRulesLabel: readOptionalString(row.overtime_rules_label) || '',
    estimatedCost: readOptionalString(row.estimated_cost) ?? null,
    supervisorName: readOptionalString(row.supervisor_name) || '',
    onboardingTasks: readStringArray(row.onboarding_tasks),
    requiredDocuments: readStringArray(row.required_documents),
    invoiceCycle: readOptionalString(row.invoice_cycle) || '',
    paymentTermsLabel: readOptionalString(row.payment_terms_label) || '',
    supplierResponseNotes: readOptionalString(row.supplier_response_notes) || '',
    sourceSnapshot:
      row.source_snapshot &&
      typeof row.source_snapshot === 'object' &&
      !Array.isArray(row.source_snapshot)
        ? (row.source_snapshot as Record<string, unknown>)
        : {},
    acceptedBy:
      readOptionalNumber(row.accepted_by) ??
      readOptionalNumber(row.accepted_by_id) ??
      null,
    changeRequestedBy:
      readOptionalNumber(row.change_requested_by) ??
      readOptionalNumber(row.change_requested_by_id) ??
      null,
    createdBy:
      readOptionalNumber(row.created_by) ??
      readOptionalNumber(row.created_by_id) ??
      null,
    updatedAt: readOptionalString(row.updated_at) || '',
    workerId: readOptionalNumber(row.worker_id) ?? null,
    workerIsNew: readOptionalBoolean(row.worker_is_new),
    workerEngagementId:
      readOptionalNumber(row.worker_engagement_id) ?? null,
    onboardingRunId: readOptionalNumber(row.onboarding_run_id) ?? null,
    matchedWorkflowId: readOptionalNumber(row.matched_workflow_id) ?? null,
    registrationRequired: readOptionalBoolean(row.registration_required),
  }
}

function toSearchParams(params: EngagementListParams) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.page_size) searchParams.set('page_size', String(params.page_size))
  if (params.status) searchParams.set('status', String(params.status))
  if (params.supplier) searchParams.set('supplier', String(params.supplier))
  if (params.work_order) {
    searchParams.set('work_order', String(params.work_order))
  }
  return searchParams
}

export function getEngagementStatusLabel(status: EngagementStatus): string {
  switch (status) {
    case 'pending_supplier_acceptance':
      return 'Pending Acceptance'
    case 'accepted':
      return 'Accepted'
    case 'changes_requested':
      return 'Changes Requested'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

export function canSupplierRespond(engagement: EngagementDetail): boolean {
  return engagement.status === 'pending_supplier_acceptance'
}

export async function getEngagements(
  params: EngagementListParams = {},
): Promise<EngagementListResponse> {
  const query = toSearchParams(params)
  const response = await fetch(
    query.size ? `/api/engagements?${query.toString()}` : '/api/engagements',
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    },
  )
  const body = await parseJsonSafe(response)

  if (!response.ok) {
    throwApiError(response, body, 'Unable to load engagements.')
  }

  const results = Array.isArray((body as { results?: unknown[] }).results)
    ? (body as { results: unknown[] }).results
        .filter(
          (row): row is Record<string, unknown> =>
            Boolean(row) && typeof row === 'object' && !Array.isArray(row),
        )
        .map((row) => normalizeEngagementListItem(row))
    : []

  return {
    results,
    pagination: normalizePagination(
      body && typeof body === 'object'
        ? (body as { pagination?: unknown }).pagination
        : undefined,
    ),
  }
}

export async function getEngagementById(
  engagementId: number,
): Promise<EngagementDetail> {
  const response = await fetch(`/api/engagements/${engagementId}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })
  const body = await parseJsonSafe(response)

  if (!response.ok) {
    throwApiError(response, body, 'Unable to load engagement.')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new EngagementApiError(
      'Engagement response was malformed.',
      response.status,
      body,
    )
  }

  return normalizeEngagementDetail(body as Record<string, unknown>)
}

export async function acceptEngagement(
  engagementId: number,
  payload: EngagementAcceptPayload = {},
): Promise<EngagementDetail> {
  const response = await fetch(`/api/engagements/${engagementId}/accept`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(
      sanitizePayload({
        supplier_response_notes: readOptionalString(
          payload.supplier_response_notes,
        ),
      }),
    ),
  })
  const body = await parseJsonSafe(response)

  if (!response.ok) {
    throwApiError(response, body, 'Unable to accept engagement.')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new EngagementApiError(
      'Engagement response was malformed.',
      response.status,
      body,
    )
  }

  return normalizeEngagementDetail(body as Record<string, unknown>)
}

export async function requestEngagementChange(
  engagementId: number,
  payload: EngagementRequestChangePayload,
): Promise<EngagementDetail> {
  const response = await fetch(
    `/api/engagements/${engagementId}/request-change`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify({
        supplier_response_notes:
          readOptionalString(payload.supplier_response_notes) || '',
      }),
    },
  )
  const body = await parseJsonSafe(response)

  if (!response.ok) {
    throwApiError(response, body, 'Unable to request engagement changes.')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new EngagementApiError(
      'Engagement response was malformed.',
      response.status,
      body,
    )
  }

  return normalizeEngagementDetail(body as Record<string, unknown>)
}
