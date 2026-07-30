'use client'

export class WorkOrderApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'WorkOrderApiError'
    this.status = status
    this.body = body
  }
}

export type WorkOrderStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'closed'

export type WorkOrderApprovalStatus =
  | 'not_started'
  | 'processing'
  | 'approved'
  | 'rejected'

export type WorkOrderSupplierAcceptanceStatus =
  | 'not_started'
  | 'pending'
  | 'accepted'
  | 'changes_requested'

export type WorkOrderApprovalRuntime = {
  currentApproverId?: number | null
  currentApproverName?: string | null
  currentStepSequence?: number | null
  approvalsRemaining?: number
  matchedChainId?: number | null
  matchedChainName?: string | null
  matchStrategy?: string | null
  computedAt?: string | null
}

export type WorkOrderPricingComponent = {
  componentId?: number
  code?: string
  label?: string
  valueType?: string
  calculationRole?: string
  numericValue?: string
}

export type WorkOrderPricing = {
  rateCardId?: number
  rateCardName?: string
  rateStructureId?: number
  rateStructureName?: string
  rateCardLineId?: number
  supplierId?: number
  supplierName?: string
  locationLabel?: string
  currency?: string
  unit?: string
  billRate?: string | null
  baseAmount?: string | null
  totalPercentMarkup?: string | null
  totalFixedMarkup?: string | null
  components: WorkOrderPricingComponent[]
  breakdown: unknown[]
}

export type WorkOrderWritePayload = {
  intake?: number
  selected_candidate?: number
  supplier?: number
  worker_full_name?: string
  worker_email?: string
  worker_phone?: string
  role_definition?: number
  start_date?: string
  end_date?: string
  bill_rate?: string | number
  pay_rate?: string | number
  currency?: string
  hours_per_week?: string | number
  overtime_enabled?: boolean
  overtime_multiplier?: string | number
  estimated_cost?: string | number
  budget_amount?: string | number
  cost_center?: number
  legal_entity?: string | number
  site?: number
  work_location_label?: string
  notes?: string
  resume_url?: string
  risk_flags?: string[]
}

export type WorkOrderListParams = {
  page?: number
  page_size?: number
  status?: WorkOrderStatus | string
  approval_status?: WorkOrderApprovalStatus | string
  intake?: number
  supplier?: number
  mine?: boolean | string
}

export type WorkOrderListPagination = {
  page: number
  page_size: number
  total_count: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}

export type WorkOrderListResponse = {
  results: WorkOrderRecord[]
  pagination: WorkOrderListPagination
}

export type WorkOrderRecord = {
  id: number
  workOrderNumber?: string | null
  status?: WorkOrderStatus
  approvalStatus?: WorkOrderApprovalStatus
  supplierAcceptanceStatus?: WorkOrderSupplierAcceptanceStatus
  supplierResponseNotes?: string
  supplierAcceptedAt?: string | null
  engagementId?: number | null
  engagementNumber?: string | null
  engagementStatus?: string | null
  intake?: number | null
  intakeTitle?: string
  selectedCandidate?: number | null
  supplier?: number | null
  supplierName?: string
  roleDefinition?: number | null
  roleName?: string
  workerFullName?: string
  workerEmail?: string
  workerPhone?: string
  startDate?: string
  endDate?: string
  billRate?: string | null
  payRate?: string | null
  baseRate?: string | null
  markupPercent?: string | null
  currency?: string
  hoursPerWeek?: number | null
  overtimeEnabled?: boolean
  overtimeMultiplier?: string | null
  estimatedCost?: string | null
  budgetAmount?: string | null
  costCenter?: number | null
  costCenterName?: string
  legalEntity?: number | string | null
  legalEntityName?: string
  site?: number | null
  siteName?: string
  workLocationLabel?: string
  notes?: string
  resumeUrl?: string
  pricing?: WorkOrderPricing | null
  riskFlags: string[]
  approvalChain?: number | null
  approvalChainSnapshot?: Record<string, unknown> | null
  approvalRuntime?: WorkOrderApprovalRuntime | null
  permissions: {
    canApprove: boolean
    canReject: boolean
    canRespondToWorkOrder: boolean
  }
  workerId?: number | null
  workerIsNew?: boolean
  workerAssignmentId?: number | null
  onboardingRunId?: number | null
  matchedWorkflowId?: number | null
  registrationRequired?: boolean
  currentApproverName?: string | null
  approvalsRemaining?: number
  submittedAt?: string | null
  createdAt?: string
  updatedAt?: string
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

function readOptionalNumberOrString(
  value: unknown,
): number | string | undefined {
  const numeric = readOptionalNumber(value)
  if (numeric !== undefined) return numeric
  return readOptionalString(value)
}

function readMessages(value: JsonLike | undefined): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') return [value]
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => readMessages(item))
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

    const lines: string[] = []
    for (const [key, val] of Object.entries(typedValue)) {
      const messages = readMessages(val)
      if (!messages.length) continue
      if (key === 'detail' || key === 'non_field_errors' || key === 'errors') {
        lines.push(...messages)
      } else {
        const label = key.replace(/_/g, ' ')
        lines.push(...messages.map((message) => `${label}: ${message}`))
      }
    }
    return lines
  }
  return []
}

function formatApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const messages = readMessages(body as JsonLike)
  const unique = Array.from(new Set(messages.filter(Boolean)))
  return unique.length ? unique.join('\n') : fallback
}

function throwApiError(
  response: Response,
  body: unknown,
  fallback: string,
): never {
  throw new WorkOrderApiError(
    formatApiError(body, fallback),
    response.status,
    body,
  )
}

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== undefined,
  )
  return Object.fromEntries(entries) as T
}

function extractListRows(payload: unknown): Record<string, unknown>[] {
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

function serializeNumberish(value: string | number | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  return undefined
}

function normalizeApprovalRuntime(
  value: unknown,
): WorkOrderApprovalRuntime | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const row = value as Record<string, unknown>
  return sanitizePayload({
    currentApproverId: readOptionalNumber(row.current_approver_id) ?? null,
    currentApproverName:
      readOptionalString(row.current_approver_name) ?? null,
    currentStepSequence:
      readOptionalNumber(row.current_step_sequence) ?? null,
    approvalsRemaining: readOptionalNumber(row.approvals_remaining),
    matchedChainId: readOptionalNumber(row.matched_chain_id) ?? null,
    matchedChainName: readOptionalString(row.matched_chain_name) ?? null,
    matchStrategy: readOptionalString(row.match_strategy) ?? null,
    computedAt: readOptionalString(row.computed_at) ?? null,
  })
}

function normalizePricingComponent(
  value: unknown,
): WorkOrderPricingComponent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const row = value as Record<string, unknown>
  return sanitizePayload({
    componentId:
      readOptionalNumber(row.component_id) ??
      readOptionalNumber(row.id),
    code: readOptionalString(row.code),
    label: readOptionalString(row.label),
    valueType: readOptionalString(row.value_type),
    calculationRole: readOptionalString(row.calculation_role),
    numericValue: readOptionalString(row.numeric_value),
  })
}

function normalizePricing(value: unknown): WorkOrderPricing | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const row = value as Record<string, unknown>
  return {
    rateCardId: readOptionalNumber(row.rate_card_id),
    rateCardName: readOptionalString(row.rate_card_name),
    rateStructureId: readOptionalNumber(row.rate_structure_id),
    rateStructureName: readOptionalString(row.rate_structure_name),
    rateCardLineId: readOptionalNumber(row.rate_card_line_id),
    supplierId: readOptionalNumber(row.supplier_id),
    supplierName: readOptionalString(row.supplier_name),
    locationLabel: readOptionalString(row.location_label),
    currency: readOptionalString(row.currency),
    unit: readOptionalString(row.unit),
    billRate: readOptionalString(row.bill_rate) ?? null,
    baseAmount: readOptionalString(row.base_amount) ?? null,
    totalPercentMarkup:
      readOptionalString(row.total_percent_markup) ?? null,
    totalFixedMarkup:
      readOptionalString(row.total_fixed_markup) ?? null,
    components: Array.isArray(row.components)
      ? row.components
          .map((entry) => normalizePricingComponent(entry))
          .filter(
            (entry): entry is WorkOrderPricingComponent => Boolean(entry),
          )
      : [],
    breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
  }
}

function normalizeWorkOrderRecord(
  row: Record<string, unknown>,
): WorkOrderRecord {
  const approvalRuntime = normalizeApprovalRuntime(row.approval_runtime)
  const pricing = normalizePricing(row.pricing)
  const permissions =
    row.permissions &&
    typeof row.permissions === 'object' &&
    !Array.isArray(row.permissions)
      ? (row.permissions as Record<string, unknown>)
      : {}

  return {
    id: readOptionalNumber(row.id) || 0,
    workOrderNumber: readOptionalString(row.work_order_number) ?? null,
    status:
      (readOptionalString(row.status) as WorkOrderStatus | undefined) ||
      undefined,
    approvalStatus:
      (readOptionalString(
        row.approval_status,
      ) as WorkOrderApprovalStatus | undefined) || undefined,
    supplierAcceptanceStatus:
      (readOptionalString(
        row.supplier_acceptance_status,
      ) as WorkOrderSupplierAcceptanceStatus | undefined) || undefined,
    supplierResponseNotes:
      readOptionalString(row.supplier_response_notes) || '',
    supplierAcceptedAt:
      readOptionalString(row.supplier_accepted_at) ?? null,
    engagementId:
      readOptionalNumber(row.engagement_id) ??
      readOptionalNumber(row.engagement) ??
      null,
    engagementNumber:
      readOptionalString(row.engagement_number) ?? null,
    engagementStatus:
      readOptionalString(row.engagement_status) ?? null,
    intake:
      readOptionalNumber(row.intake) ??
      readOptionalNumber(row.intake_id) ??
      null,
    intakeTitle:
      readOptionalString(row.intake_title) ||
      readOptionalString(row.title) ||
      '',
    selectedCandidate:
      readOptionalNumber(row.selected_candidate) ??
      readOptionalNumber(row.selected_candidate_id) ??
      null,
    supplier:
      readOptionalNumber(row.supplier) ??
      readOptionalNumber(row.supplier_id) ??
      null,
    supplierName:
      readOptionalString(row.supplier_name) ||
      readOptionalString(row.supplier_label) ||
      '',
    roleDefinition:
      readOptionalNumber(row.role_definition) ??
      readOptionalNumber(row.role_definition_id) ??
      null,
    roleName:
      readOptionalString(row.role_name) ||
      readOptionalString(row.role_definition_name) ||
      '',
    workerFullName: readOptionalString(row.worker_full_name) || '',
    workerEmail: readOptionalString(row.worker_email),
    workerPhone: readOptionalString(row.worker_phone),
    startDate: readOptionalString(row.start_date),
    endDate: readOptionalString(row.end_date),
    billRate: readOptionalString(row.bill_rate) ?? null,
    payRate: readOptionalString(row.pay_rate) ?? null,
    baseRate: readOptionalString(row.base_rate) ?? null,
    markupPercent: readOptionalString(row.markup_percent) ?? null,
    currency: readOptionalString(row.currency),
    hoursPerWeek: readOptionalNumber(row.hours_per_week) ?? null,
    overtimeEnabled: readOptionalBoolean(row.overtime_enabled),
    overtimeMultiplier: readOptionalString(row.overtime_multiplier) ?? null,
    estimatedCost: readOptionalString(row.estimated_cost) ?? null,
    budgetAmount: readOptionalString(row.budget_amount) ?? null,
    costCenter:
      readOptionalNumber(row.cost_center) ??
      readOptionalNumber(row.cost_center_id) ??
      null,
    costCenterName:
      readOptionalString(row.cost_center_name) ||
      readOptionalString(row.cost_center_label) ||
      '',
    legalEntity:
      readOptionalNumberOrString(row.legal_entity) ??
      readOptionalNumberOrString(row.legal_entity_id) ??
      null,
    legalEntityName:
      readOptionalString(row.legal_entity_name) ||
      readOptionalString(row.legal_entity_label) ||
      '',
    site:
      readOptionalNumber(row.site) ??
      readOptionalNumber(row.site_id) ??
      null,
    siteName:
      readOptionalString(row.site_name) ||
      readOptionalString(row.site_label) ||
      '',
    workLocationLabel:
      readOptionalString(row.work_location_label) ||
      readOptionalString(row.location_label) ||
      '',
    notes: readOptionalString(row.notes),
    resumeUrl: readOptionalString(row.resume_url),
    pricing,
    riskFlags: Array.isArray(row.risk_flags)
      ? row.risk_flags.filter(
          (entry): entry is string =>
            typeof entry === 'string' && entry.trim().length > 0,
        )
      : [],
    approvalChain:
      readOptionalNumber(row.approval_chain) ??
      readOptionalNumber(row.approval_chain_id) ??
      null,
    approvalChainSnapshot:
      row.approval_chain_snapshot &&
      typeof row.approval_chain_snapshot === 'object'
        ? (row.approval_chain_snapshot as Record<string, unknown>)
        : null,
    approvalRuntime,
    permissions: {
      canApprove: readOptionalBoolean(permissions.can_approve) || false,
      canReject: readOptionalBoolean(permissions.can_reject) || false,
      canRespondToWorkOrder:
        readOptionalBoolean(permissions.can_respond_to_work_order) || false,
    },
    workerId: readOptionalNumber(row.worker_id) ?? null,
    workerIsNew: readOptionalBoolean(row.worker_is_new),
    workerAssignmentId:
      readOptionalNumber(row.worker_assignment_id) ??
      readOptionalNumber(row.worker_engagement_id) ??
      null,
    onboardingRunId: readOptionalNumber(row.onboarding_run_id) ?? null,
    matchedWorkflowId:
      readOptionalNumber(row.matched_workflow_id) ?? null,
    registrationRequired:
      readOptionalBoolean(row.registration_required),
    currentApproverName:
      readOptionalString(row.current_approver_name) ||
      approvalRuntime?.currentApproverName ||
      null,
    approvalsRemaining:
      readOptionalNumber(row.approvals_remaining) ??
      approvalRuntime?.approvalsRemaining,
    submittedAt: readOptionalString(row.submitted_at) ?? null,
    createdAt: readOptionalString(row.created_at),
    updatedAt: readOptionalString(row.updated_at),
  }
}

function normalizeWorkOrderResponse(body: unknown): WorkOrderRecord {
  if (!body || typeof body !== 'object') {
    return normalizeWorkOrderRecord({})
  }

  const payload = body as Record<string, unknown>
  const nestedWorkOrder =
    payload.work_order && typeof payload.work_order === 'object'
      ? (payload.work_order as Record<string, unknown>)
      : null

  if (nestedWorkOrder) {
    return normalizeWorkOrderRecord({
      ...payload,
      ...nestedWorkOrder,
      approval_runtime:
        nestedWorkOrder.approval_runtime ?? payload.approval_runtime,
      approval_chain_snapshot:
        nestedWorkOrder.approval_chain_snapshot ??
        payload.approval_chain_snapshot,
    })
  }

  return normalizeWorkOrderRecord(payload)
}

function normalizeWorkOrderListPagination(
  payload: unknown,
  rowCount: number,
): WorkOrderListPagination {
  const pagination =
    payload && typeof payload === 'object'
      ? (payload as { pagination?: unknown }).pagination
      : undefined
  const rowPagination =
    pagination && typeof pagination === 'object'
      ? (pagination as Record<string, unknown>)
      : {}

  const page = readOptionalNumber(rowPagination.page) || 1
  const pageSize =
    readOptionalNumber(rowPagination.page_size) || rowCount || 25
  const totalCount =
    readOptionalNumber(rowPagination.total_count) || rowCount
  const totalPages =
    readOptionalNumber(rowPagination.total_pages) ||
    Math.max(1, Math.ceil(totalCount / Math.max(pageSize, 1)))

  return {
    page,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: totalPages,
    has_next:
      readOptionalBoolean(rowPagination.has_next) === true ||
      page < totalPages,
    has_previous:
      readOptionalBoolean(rowPagination.has_previous) === true ||
      page > 1,
  }
}

function buildWorkOrderListQuery(params: WorkOrderListParams = {}) {
  const query = new URLSearchParams()

  if (typeof params.page === 'number' && Number.isFinite(params.page)) {
    query.set('page', String(params.page))
  }

  if (
    typeof params.page_size === 'number' &&
    Number.isFinite(params.page_size)
  ) {
    query.set('page_size', String(params.page_size))
  }

  if (params.status?.trim()) {
    query.set('status', params.status.trim())
  }

  if (params.approval_status?.trim()) {
    query.set('approval_status', params.approval_status.trim())
  }

  if (typeof params.intake === 'number' && Number.isFinite(params.intake)) {
    query.set('intake', String(params.intake))
  }

  if (
    typeof params.supplier === 'number' &&
    Number.isFinite(params.supplier)
  ) {
    query.set('supplier', String(params.supplier))
  }

  if (params.mine !== undefined && params.mine !== '') {
    if (typeof params.mine === 'boolean') {
      query.set('mine', params.mine ? 'true' : 'false')
    } else if (params.mine.trim()) {
      query.set('mine', params.mine.trim())
    }
  }

  const suffix = query.toString()
  return suffix ? `/api/work-orders?${suffix}` : '/api/work-orders'
}

function serializeWorkOrderPayload(payload: Partial<WorkOrderWritePayload>) {
  return sanitizePayload({
    intake: payload.intake,
    selected_candidate: payload.selected_candidate,
    supplier: payload.supplier,
    worker_full_name: readOptionalString(payload.worker_full_name),
    worker_email: readOptionalString(payload.worker_email),
    worker_phone: readOptionalString(payload.worker_phone),
    role_definition: payload.role_definition,
    start_date: readOptionalString(payload.start_date),
    end_date: readOptionalString(payload.end_date),
    bill_rate: serializeNumberish(payload.bill_rate),
    pay_rate: serializeNumberish(payload.pay_rate),
    currency: readOptionalString(payload.currency)?.toUpperCase(),
    hours_per_week: serializeNumberish(payload.hours_per_week),
    overtime_enabled: payload.overtime_enabled,
    overtime_multiplier: serializeNumberish(payload.overtime_multiplier),
    estimated_cost: serializeNumberish(payload.estimated_cost),
    budget_amount: serializeNumberish(payload.budget_amount),
    cost_center: payload.cost_center,
    legal_entity:
      typeof payload.legal_entity === 'string'
        ? payload.legal_entity.trim() || undefined
        : payload.legal_entity,
    site: payload.site,
    work_location_label: readOptionalString(payload.work_location_label),
    notes: readOptionalString(payload.notes),
    resume_url: readOptionalString(payload.resume_url),
    risk_flags: Array.isArray(payload.risk_flags)
      ? payload.risk_flags
      : undefined,
  })
}

async function postDecision(
  workOrderId: number | string,
  action: 'approve' | 'reject',
  decisionReason?: string,
) {
  const body = sanitizePayload({
    decision_reason: decisionReason?.trim(),
  })

  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(
      String(workOrderId),
    )}/${action}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(Object.keys(body).length > 0
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...getCsrfHeaders(),
      },
      ...(Object.keys(body).length > 0
        ? { body: JSON.stringify(body) }
        : {}),
    },
  )

  const payload = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      payload,
      `Failed to ${action} work order (${response.status})`,
    )
  }

  return normalizeWorkOrderResponse(payload)
}

export async function getWorkOrders(
  params: WorkOrderListParams = {},
): Promise<WorkOrderListResponse> {
  const response = await fetch(buildWorkOrderListQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load work orders (${response.status})`,
    )
  }

  const results = extractListRows(body).map((row) =>
    normalizeWorkOrderRecord(row),
  )

  return {
    results,
    pagination: normalizeWorkOrderListPagination(body, results.length),
  }
}

export async function createWorkOrder(
  payload: WorkOrderWritePayload,
): Promise<WorkOrderRecord> {
  const response = await fetch('/api/work-orders', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(serializeWorkOrderPayload(payload)),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to create work order (${response.status})`,
    )
  }

  return normalizeWorkOrderResponse(body)
}

export async function getWorkOrderById(
  workOrderId: number | string,
): Promise<WorkOrderRecord> {
  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(String(workOrderId))}`,
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load work order (${response.status})`,
    )
  }

  return normalizeWorkOrderResponse(body)
}

export async function patchWorkOrder(
  workOrderId: number | string,
  payload: Partial<WorkOrderWritePayload>,
): Promise<WorkOrderRecord> {
  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(String(workOrderId))}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(serializeWorkOrderPayload(payload)),
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to update work order (${response.status})`,
    )
  }

  return normalizeWorkOrderResponse(body)
}

export async function submitWorkOrder(
  workOrderId: number | string,
): Promise<WorkOrderRecord> {
  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(
      String(workOrderId),
    )}/submit`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getCsrfHeaders(),
      },
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to submit work order (${response.status})`,
    )
  }

  return normalizeWorkOrderResponse(body)
}

export async function approveWorkOrder(
  workOrderId: number | string,
  decisionReason?: string,
) {
  return postDecision(workOrderId, 'approve', decisionReason)
}

export async function rejectWorkOrder(
  workOrderId: number | string,
  decisionReason?: string,
) {
  return postDecision(workOrderId, 'reject', decisionReason)
}

async function postSupplierDecision(
  workOrderId: number | string,
  action: 'accept' | 'request-change',
  supplierResponseNotes?: string,
) {
  const response = await fetch(
    `/api/work-orders/${encodeURIComponent(
      String(workOrderId),
    )}/${action}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify({
        supplier_response_notes: supplierResponseNotes?.trim() || '',
      }),
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      action === 'accept'
        ? `Failed to accept work order (${response.status})`
        : `Failed to request work order changes (${response.status})`,
    )
  }
  return normalizeWorkOrderResponse(body)
}

export async function acceptWorkOrder(
  workOrderId: number | string,
  supplierResponseNotes?: string,
) {
  return postSupplierDecision(
    workOrderId,
    'accept',
    supplierResponseNotes,
  )
}

export async function requestWorkOrderChange(
  workOrderId: number | string,
  supplierResponseNotes: string,
) {
  return postSupplierDecision(
    workOrderId,
    'request-change',
    supplierResponseNotes,
  )
}
