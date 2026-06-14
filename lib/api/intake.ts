'use client'

import {
  createQualificationId,
  type Qualification,
} from '@/lib/qualifications'

export class IntakeApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'IntakeApiError'
    this.status = status
    this.body = body
  }
}

export type JobTemplateOption = {
  id: number | string
  role: string
  description: string
  country?: string
  region?: string
  region_in_country?: string
}

export type ReferenceOption = {
  id: number
  label: string
  raw: Record<string, unknown>
}

export type IntakeRecord = {
  id: number
  requestId?: string
  status?: string
  approvalStatus?: string
  engagementType?: string
  title?: string
  description?: string
  startDate?: string
  endDate?: string
  workerCount?: number
  costCenter?: number
  costCenterName?: string
  site?: number
  siteName?: string
  supplier?: number
  supplierName?: string
  roleDefinition?: number
  roleDefinitionName?: string
  legalEntity?: number | string
  legalEntityName?: string
  targetRate?: string
  billRate?: string | null
  payRate?: string | null
  baseRate?: string | null
  markupPercent?: string | null
  rateUnit?: string
  budgetAmount?: string
  currency?: string
  country?: string
  stateProvince?: string
  city?: string
  workLocationLabel?: string
  rateCard?: number
  rateCardPricing?: RateCardPricing | null
  overtimeEnabled?: boolean
  overtimeMultiplier?: string
  customFields?: Record<string, unknown>
  qualificationsEnabled?: boolean
  qualifications?: Qualification[]
  selectedCandidate?: SelectedCandidateRecord | null
  approvalChain?: number | null
  approvalChainSnapshot?: Record<string, unknown> | null
  approvalRuntime?: IntakeApprovalRuntime | null
  validationWarnings?: unknown[]
  createdAt?: string
  updatedAt?: string
  submittedAt?: string
  decisionAt?: string | null
  decidedBy?: number | null
  decisionReason?: string
}

export type IntakeApprovalRuntime = {
  currentApproverId?: number
  currentApproverName?: string
  currentStepSequence?: number
  approvalsRemaining?: number
  matchedChainId?: number
  matchedChainName?: string
  matchStrategy?: string
  computedAt?: string
}

export type SelectedCandidateRecord = {
  id?: number
  supplierSubmissionId?: number
  intakeId?: number
  supplierId?: number
  fullName?: string
  email?: string
  phone?: string
  notes?: string
  resumeUrl?: string
  availableStartDate?: string
  proposedRate?: string
  currency?: string
  createdAt?: string
  updatedAt?: string
  raw: Record<string, unknown>
}

export type SelectedCandidateCreatePayload = {
  fullName: string
  email: string
  phone?: string
  notes?: string
  resumeUrl?: string
  availableStartDate?: string
  proposedRate?: string
  currency?: string
}

export type RateCardPricingComponent = {
  componentId?: number
  code?: string
  label?: string
  valueType?: string
  calculationRole?: string
  numericValue?: string
}

export type RateCardPricing = {
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
  components: RateCardPricingComponent[]
  breakdown: unknown[]
}

export type IntakeListParams = {
  mine?: boolean | string
  status?: string
  page?: number
  page_size?: number
}

export type IntakeListPagination = {
  page: number
  page_size: number
  total_count: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}

export type IntakeListResponse = {
  results: IntakeRecord[]
  pagination: IntakeListPagination
}

export type IntakeDraftPayload = {
  engagementType: string
  costCenter?: number
  site?: number
  supplier?: number
  roleDefinition?: number
  legalEntity?: number | string
  title?: string
  description?: string
  startDate?: string
  endDate?: string
  workerCount?: number
  targetRate?: string
  rateUnit?: string
  budgetAmount?: string
  currency?: string
  country?: string
  stateProvince?: string
  city?: string
  rateCard?: number
  overtimeEnabled?: boolean
  overtimeMultiplier?: string
  customFields?: Record<string, unknown>
  qualificationsEnabled?: boolean
  qualifications?: Qualification[]
}

export type IntakePatchPayload = Partial<IntakeDraftPayload>

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
      if (key === 'detail' || key === 'non_field_errors') {
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
  throw new IntakeApiError(
    formatApiError(body, fallback),
    response.status,
    body,
  )
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

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== undefined,
  )
  return Object.fromEntries(entries) as T
}

function normalizeMoneyForPayload(value: string | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw) return undefined

  const normalized = raw.replace(/,/g, '')
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return raw

  return numeric.toFixed(2)
}

function normalizeRateUnit(value: unknown): string | undefined {
  const unit = readOptionalString(value)
  if (!unit) return undefined
  const normalized = unit.toLowerCase()
  return normalized.startsWith('day') ? 'daily' : 'hourly'
}

function serializeRateUnit(value: string | undefined) {
  if (!value?.trim()) return undefined
  return value.trim().toLowerCase().startsWith('day')
    ? 'daily'
    : 'hourly'
}

function normalizeQualification(
  row: Record<string, unknown>,
): Qualification {
  return {
    id:
      String(
        readOptionalNumberOrString(row.id) ||
          readOptionalNumberOrString(row.sequence) ||
          createQualificationId(),
      ),
    name: readOptionalString(row.name) || '',
    type:
      (readOptionalString(row.qualification_type) as Qualification['type']) ||
      'skill',
    group:
      (readOptionalString(row.group) as Qualification['group']) ||
      'must_have',
    description: readOptionalString(row.description) || '',
    mandatory: readOptionalBoolean(row.mandatory) !== false,
    knockout: readOptionalBoolean(row.knockout) === true,
    responseMode:
      (readOptionalString(row.response_mode) as Qualification['responseMode']) ||
      'years',
    minYears: readOptionalNumber(row.min_years) || 0,
    proficiency:
      (readOptionalString(row.proficiency) as Qualification['proficiency']) ||
      'Intermediate',
    weight: readOptionalNumber(row.weight) || 1,
    tags: Array.isArray(row.tags)
      ? row.tags.filter(
          (entry): entry is string =>
            typeof entry === 'string' && entry.trim().length > 0,
        )
      : [],
  }
}

function normalizeApprovalRuntime(
  value: unknown,
): IntakeApprovalRuntime | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const row = value as Record<string, unknown>

  return sanitizePayload({
    currentApproverId: readOptionalNumber(row.current_approver_id),
    currentApproverName: readOptionalString(row.current_approver_name),
    currentStepSequence: readOptionalNumber(row.current_step_sequence),
    approvalsRemaining: readOptionalNumber(row.approvals_remaining),
    matchedChainId: readOptionalNumber(row.matched_chain_id),
    matchedChainName: readOptionalString(row.matched_chain_name),
    matchStrategy: readOptionalString(row.match_strategy),
    computedAt: readOptionalString(row.computed_at),
  })
}

function normalizeSelectedCandidate(
  row: Record<string, unknown>,
): SelectedCandidateRecord {
  return {
    id: readOptionalNumber(row.id),
    supplierSubmissionId:
      readOptionalNumber(row.supplier_submission_id) ||
      readOptionalNumber(row.submission_id),
    intakeId: readOptionalNumber(row.intake) || readOptionalNumber(row.intake_id),
    supplierId:
      readOptionalNumber(row.supplier) || readOptionalNumber(row.supplier_id),
    fullName: readOptionalString(row.full_name),
    email: readOptionalString(row.email),
    phone: readOptionalString(row.phone),
    notes: readOptionalString(row.notes),
    resumeUrl: readOptionalString(row.resume_url),
    availableStartDate: readOptionalString(row.available_start_date),
    proposedRate: readOptionalString(row.proposed_rate),
    currency: readOptionalString(row.currency),
    createdAt: readOptionalString(row.created_at),
    updatedAt: readOptionalString(row.updated_at),
    raw: row,
  }
}

function normalizeRateCardPricingComponent(
  value: unknown,
): RateCardPricingComponent | null {
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

function normalizeRateCardPricing(value: unknown): RateCardPricing | null {
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
          .map((entry) => normalizeRateCardPricingComponent(entry))
          .filter(
            (entry): entry is RateCardPricingComponent => Boolean(entry),
          )
      : [],
    breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
  }
}

function serializeQualifications(value: Qualification[] | undefined) {
  if (!Array.isArray(value)) return undefined

  return value.map((qualification, index) =>
    sanitizePayload({
      sequence: index + 1,
      name: qualification.name.trim(),
      qualification_type: qualification.type,
      group: qualification.group,
      description: qualification.description.trim(),
      mandatory: qualification.mandatory,
      knockout: qualification.knockout,
      response_mode: qualification.responseMode,
      min_years: qualification.minYears,
      proficiency: qualification.proficiency,
      weight: qualification.weight,
      tags: qualification.tags,
    }),
  )
}

function normalizeTemplate(row: Record<string, unknown>): JobTemplateOption {
  return {
    id: (row.id as string | number | undefined) || '',
    role: readOptionalString(row.role) || '',
    description: readOptionalString(row.description) || '',
    country: readOptionalString(row.country),
    region:
      readOptionalString(row.region) ||
      readOptionalString(row.region_in_country),
    region_in_country: readOptionalString(row.region_in_country),
  }
}

function normalizeReferenceOption(
  row: Record<string, unknown>,
): ReferenceOption | null {
  const id = readOptionalNumber(row.id)
  if (id === undefined) return null

  const label =
    readOptionalString(row.name) ||
    readOptionalString(row.code) ||
    readOptionalString(row.display_name) ||
    readOptionalString(row.title) ||
    `ID ${id}`

  return {
    id,
    label,
    raw: row,
  }
}

function normalizeIntakeRecord(row: Record<string, unknown>): IntakeRecord {
  return {
    id: readOptionalNumber(row.id) || 0,
    requestId: readOptionalString(row.request_id),
    status: readOptionalString(row.status),
    approvalStatus: readOptionalString(row.approval_status),
    engagementType: readOptionalString(row.engagement_type),
    title: readOptionalString(row.title),
    description: readOptionalString(row.description),
    startDate: readOptionalString(row.start_date),
    endDate: readOptionalString(row.end_date),
    workerCount: readOptionalNumber(row.worker_count),
    costCenter: readOptionalNumber(row.cost_center),
    costCenterName:
      readOptionalString(row.cost_center_name) ||
      readOptionalString(row.cost_center_label),
    site: readOptionalNumber(row.site),
    siteName: readOptionalString(row.site_name),
    supplier: readOptionalNumber(row.supplier),
    supplierName: readOptionalString(row.supplier_name),
    roleDefinition: readOptionalNumber(row.role_definition),
    roleDefinitionName:
      readOptionalString(row.role_definition_name) ||
      readOptionalString(row.role_name),
    legalEntity: readOptionalNumberOrString(row.legal_entity),
    legalEntityName: readOptionalString(row.legal_entity_name),
    targetRate: readOptionalString(row.target_rate),
    billRate: readOptionalString(row.bill_rate) ?? null,
    payRate: readOptionalString(row.pay_rate) ?? null,
    baseRate: readOptionalString(row.base_rate) ?? null,
    markupPercent: readOptionalString(row.markup_percent) ?? null,
    rateUnit: normalizeRateUnit(row.rate_unit),
    budgetAmount: readOptionalString(row.budget_amount),
    currency: readOptionalString(row.currency),
    country: readOptionalString(row.country),
    stateProvince: readOptionalString(row.state_province),
    city: readOptionalString(row.city),
    workLocationLabel:
      readOptionalString(row.work_location_label) ||
      [readOptionalString(row.city), readOptionalString(row.state_province), readOptionalString(row.country)]
        .filter(Boolean)
        .join(', ') ||
      undefined,
    rateCard: readOptionalNumber(row.rate_card),
    rateCardPricing: normalizeRateCardPricing(row.rate_card_pricing),
    overtimeEnabled: readOptionalBoolean(row.overtime_enabled),
    overtimeMultiplier: readOptionalString(row.overtime_multiplier),
    customFields:
      (row.custom_fields as Record<string, unknown> | undefined) ||
      {},
    qualificationsEnabled:
      readOptionalBoolean(row.qualifications_enabled),
    qualifications: Array.isArray(row.qualifications)
      ? row.qualifications
          .filter(
            (entry): entry is Record<string, unknown> =>
              Boolean(entry) && typeof entry === 'object',
          )
          .map((entry) => normalizeQualification(entry))
      : [],
    selectedCandidate:
      row.selected_candidate &&
      typeof row.selected_candidate === 'object' &&
      !Array.isArray(row.selected_candidate)
        ? normalizeSelectedCandidate(
            row.selected_candidate as Record<string, unknown>,
          )
        : null,
    approvalChain: readOptionalNumber(row.approval_chain) || null,
    approvalChainSnapshot:
      row.approval_chain_snapshot &&
      typeof row.approval_chain_snapshot === 'object'
        ? (row.approval_chain_snapshot as Record<string, unknown>)
        : null,
    approvalRuntime: normalizeApprovalRuntime(row.approval_runtime),
    validationWarnings: Array.isArray(row.validation_warnings)
      ? row.validation_warnings
      : [],
    createdAt: readOptionalString(row.created_at),
    updatedAt: readOptionalString(row.updated_at),
    submittedAt: readOptionalString(row.submitted_at),
    decisionAt: readOptionalString(row.decision_at) || null,
    decidedBy: readOptionalNumber(row.decided_by) || null,
    decisionReason: readOptionalString(row.decision_reason),
  }
}

function normalizeIntakeResponse(body: unknown): IntakeRecord {
  if (!body || typeof body !== 'object') {
    return normalizeIntakeRecord({})
  }

  const payload = body as Record<string, unknown>
  const nestedIntake =
    payload.intake && typeof payload.intake === 'object'
      ? (payload.intake as Record<string, unknown>)
      : null

  if (nestedIntake) {
    return normalizeIntakeRecord({
      ...payload,
      ...nestedIntake,
      approval_runtime:
        nestedIntake.approval_runtime ?? payload.approval_runtime,
      approval_chain_snapshot:
        nestedIntake.approval_chain_snapshot ??
        payload.approval_chain_snapshot,
    })
  }

  return normalizeIntakeRecord(payload)
}

function buildIntakeListQuery(params: IntakeListParams = {}) {
  const query = new URLSearchParams()

  if (params.mine !== undefined && params.mine !== '') {
    if (typeof params.mine === 'boolean') {
      query.set('mine', params.mine ? 'true' : 'false')
    } else if (params.mine.trim()) {
      query.set('mine', params.mine.trim())
    }
  }

  if (params.status?.trim()) {
    query.set('status', params.status.trim())
  }

  if (typeof params.page === 'number' && Number.isFinite(params.page)) {
    query.set('page', String(params.page))
  }

  if (
    typeof params.page_size === 'number' &&
    Number.isFinite(params.page_size)
  ) {
    query.set('page_size', String(params.page_size))
  }

  const suffix = query.toString()
  return suffix ? `/api/intake?${suffix}` : '/api/intake'
}

function normalizeIntakeListPagination(
  payload: unknown,
  rowCount: number,
): IntakeListPagination {
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
  const hasNext =
    readOptionalBoolean(rowPagination.has_next) === true ||
    page < totalPages
  const hasPrevious =
    readOptionalBoolean(rowPagination.has_previous) === true ||
    page > 1

  return {
    page,
    page_size: pageSize,
    total_count: totalCount,
    total_pages: totalPages,
    has_next: hasNext,
    has_previous: hasPrevious,
  }
}

function serializeIntakePayload(
  payload: IntakeDraftPayload | IntakePatchPayload,
) {
  return sanitizePayload({
    engagement_type:
      'engagementType' in payload ? payload.engagementType : undefined,
    cost_center: payload.costCenter,
    site: payload.site,
    supplier: payload.supplier,
    role_definition: payload.roleDefinition,
    legal_entity: payload.legalEntity,
    title: payload.title?.trim(),
    description: payload.description?.trim(),
    start_date: payload.startDate?.trim(),
    end_date: payload.endDate?.trim(),
    worker_count: payload.workerCount,
    target_rate: payload.targetRate?.trim(),
    rate_unit: serializeRateUnit(payload.rateUnit),
    budget_amount: payload.budgetAmount?.trim(),
    currency: payload.currency?.trim().toUpperCase(),
    country: payload.country?.trim().toUpperCase(),
    state_province: payload.stateProvince?.trim(),
    city: payload.city?.trim(),
    rate_card: payload.rateCard,
    overtime_enabled: payload.overtimeEnabled,
    overtime_multiplier: payload.overtimeMultiplier?.trim(),
    custom_fields: payload.customFields,
    qualifications_enabled: payload.qualificationsEnabled,
    qualifications: payload.qualifications
      ? serializeQualifications(payload.qualifications)
      : undefined,
  })
}

function serializeSelectedCandidatePayload(
  payload: SelectedCandidateCreatePayload,
) {
  return sanitizePayload({
    full_name: payload.fullName.trim(),
    email: payload.email.trim(),
    phone: payload.phone?.trim(),
    notes: payload.notes?.trim(),
    resume_url: payload.resumeUrl?.trim(),
    available_start_date: payload.availableStartDate?.trim(),
    proposed_rate: normalizeMoneyForPayload(payload.proposedRate),
    currency: payload.currency?.trim().toUpperCase(),
  })
}

export async function getIntakeJobTemplates(params?: {
  search?: string
}): Promise<JobTemplateOption[]> {
  const query = new URLSearchParams()
  if (params?.search?.trim()) {
    query.set('search', params.search.trim())
  }

  const suffix = query.toString()
  const target = suffix
    ? `/api/job-templates?${suffix}`
    : '/api/job-templates'

  const response = await fetch(target, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load job templates (${response.status})`,
    )
  }

  return extractListRows(body).map((row) => normalizeTemplate(row))
}

export async function getCostCenters(): Promise<ReferenceOption[]> {
  const response = await fetch('/api/cost-centers/?status=active', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load cost centers (${response.status})`,
    )
  }

  return extractListRows(body)
    .map((row) => normalizeReferenceOption(row))
    .filter((row): row is ReferenceOption => Boolean(row))
}

export async function getSites(): Promise<ReferenceOption[]> {
  const response = await fetch('/api/sites/?status=active', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load sites (${response.status})`,
    )
  }

  return extractListRows(body)
    .map((row) => normalizeReferenceOption(row))
    .filter((row): row is ReferenceOption => Boolean(row))
}

export async function getRateCards(): Promise<Record<string, unknown>[]> {
  const response = await fetch('/api/rate-cards', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load rate cards (${response.status})`,
    )
  }

  return extractListRows(body)
}

export async function createIntakeDraft(
  payload: IntakeDraftPayload,
): Promise<IntakeRecord> {
  const response = await fetch('/api/intake/draft', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(serializeIntakePayload(payload)),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to create intake draft (${response.status})`,
    )
  }

  return normalizeIntakeResponse(body)
}

export async function patchIntake(
  intakeId: number | string,
  payload: IntakePatchPayload,
): Promise<IntakeRecord> {
  const response = await fetch(
    `/api/intake/${encodeURIComponent(String(intakeId))}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(serializeIntakePayload(payload)),
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to update intake (${response.status})`,
    )
  }

  return normalizeIntakeResponse(body)
}

export async function submitIntake(
  intakeId: number | string,
): Promise<IntakeRecord> {
  const response = await fetch(
    `/api/intake/${encodeURIComponent(String(intakeId))}/submit`,
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
      `Failed to submit intake (${response.status})`,
    )
  }

  return normalizeIntakeResponse(body)
}

export async function getIntakeById(
  intakeId: number | string,
): Promise<IntakeRecord> {
  const response = await fetch(
    `/api/intake/${encodeURIComponent(String(intakeId))}`,
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
      `Failed to load intake (${response.status})`,
    )
  }

  return normalizeIntakeResponse(body)
}

export async function getIntakes(
  params: IntakeListParams = {},
): Promise<IntakeListResponse> {
  const response = await fetch(buildIntakeListQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load intakes (${response.status})`,
    )
  }

  const results = extractListRows(body).map((row) => normalizeIntakeRecord(row))

  return {
    results,
    pagination: normalizeIntakeListPagination(body, results.length),
  }
}

export async function getIntakeApprovalPreview(
  intakeId: number | string,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `/api/intake/${encodeURIComponent(String(intakeId))}/approval-preview`,
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
      `Failed to load intake approval preview (${response.status})`,
    )
  }

  return body && typeof body === 'object'
    ? (body as Record<string, unknown>)
    : {}
}

export async function getSelectedCandidates(
  intakeId: number | string,
): Promise<SelectedCandidateRecord[]> {
  const response = await fetch(
    `/api/intake/${encodeURIComponent(
      String(intakeId),
    )}/selected-candidates`,
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
      `Failed to load selected candidates (${response.status})`,
    )
  }

  return extractListRows(body).map((row) => normalizeSelectedCandidate(row))
}

export async function createSelectedCandidate(
  intakeId: number | string,
  payload: SelectedCandidateCreatePayload,
): Promise<SelectedCandidateRecord> {
  const response = await fetch(
    `/api/intake/${encodeURIComponent(
      String(intakeId),
    )}/selected-candidates`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(serializeSelectedCandidatePayload(payload)),
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to submit selected candidate (${response.status})`,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeSelectedCandidate({})
  }

  return normalizeSelectedCandidate(body as Record<string, unknown>)
}
