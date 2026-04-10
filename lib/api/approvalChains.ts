'use client'

export type ApprovalChain = {
  id: number
  name: string
  description: string
  is_active: boolean
  priority: number
  match_strategy: 'all' | 'any'
  conditions: ApprovalChainCondition[]
  steps: ApprovalChainStep[]
  created_at: string
  updated_at: string
}

export type ApprovalChainCondition = {
  id?: number
  sequence: number
  field_key: string
  field_label?: string
  data_type?: string
  operator: string
  value: unknown
}

export type ApprovalChainStep = {
  id?: number
  sequence: number
  step_type: 'specific_user'
  approver: number
  approver_name?: string
  amount: string
  currency: string
}

export type ApprovalChainListParams = {
  search?: string
  is_active?: boolean | string
  match_strategy?: 'all' | 'any' | ''
}

export type ApprovalChainCatalogOperator = {
  key: string
  label: string
  value_required: boolean
}

export type ApprovalChainCatalogField = {
  key: string
  label: string
  data_type?: string
  resolver_path?: string
  description?: string
  dynamic?: boolean
  supported_operators: ApprovalChainCatalogOperator[]
}

export type ApprovalChainCatalog = {
  operators: ApprovalChainCatalogOperator[]
  fields: ApprovalChainCatalogField[]
}

export type ApprovalChainSimulationPayload = {
  payload: Record<string, unknown>
  include_inactive?: boolean
  include_non_matches?: boolean
}

export type ApprovalChainSimulationConditionResult = {
  sequence: number
  field_key: string
  field_label?: string
  operator: string
  expected_value: unknown
  actual_value: unknown
  matched: boolean
}

export type ApprovalChainSimulationResolvedStep = {
  sequence: number
  step_type: 'specific_user'
  approver_id: number
  approver_name?: string
  amount: string
  currency: string
}

export type ApprovalChainSimulationResult = {
  chain: ApprovalChain
  evaluation: {
    matched: boolean
    match_strategy: 'all' | 'any'
    condition_results: ApprovalChainSimulationConditionResult[]
    resolved_steps: ApprovalChainSimulationResolvedStep[]
  }
}

export type ApprovalChainSimulationResponse = {
  results: ApprovalChainSimulationResult[]
  meta?: {
    evaluated_count?: number
    match_count?: number
  }
}

export type ApprovalChainApprover = {
  user_id: number
  name: string
  email: string
  role?: string
  business_unit_id?: number
  business_unit?: string
  cost_center_id?: number
  cost_center?: string
  cost_center_name?: string
}

export type ApprovalChainApproverListParams = {
  search?: string
  role?: string
  business_unit_id?: number | string
  cost_center_id?: number | string
}

export type ApprovalChainCreatePayload = {
  name: string
  description?: string
  is_active: boolean
  priority: number
  match_strategy: 'all' | 'any'
  conditions: ApprovalChainCondition[]
  steps: ApprovalChainStep[]
}

export type ApprovalChainUpdatePayload = Partial<
  Omit<ApprovalChainCreatePayload, 'conditions' | 'steps'>
> & {
  conditions?: ApprovalChainCondition[]
  steps?: ApprovalChainStep[]
}

export class ApprovalChainsApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApprovalChainsApiError'
    this.status = status
    this.body = body
  }
}

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike }

type AdminUserRow = {
  user_id?: unknown
  name?: unknown
  email?: unknown
  role?: unknown
  business_unit_id?: unknown
  business_unit?: unknown
  cost_center_id?: unknown
  cost_center?: unknown
  cost_center_name?: unknown
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
    const lines: string[] = []
    for (const [key, entry] of Object.entries(value)) {
      const messages = readMessages(entry)
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
  throw new ApprovalChainsApiError(
    formatApiError(body, fallback),
    response.status,
    body,
  )
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

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== undefined,
  )
  return Object.fromEntries(entries) as T
}

function toBooleanString(value: boolean | string | undefined) {
  if (value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizeOperator(
  row: Record<string, unknown>,
): ApprovalChainCatalogOperator {
  return {
    key: readOptionalString(row.key) || '',
    label: readOptionalString(row.label) || readOptionalString(row.key) || '',
    value_required: row.value_required !== false,
  }
}

function normalizeField(
  row: Record<string, unknown>,
): ApprovalChainCatalogField {
  const supportedOperators = Array.isArray(row.supported_operators)
    ? row.supported_operators
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeOperator(entry))
    : []

  return {
    key: readOptionalString(row.key) || '',
    label: readOptionalString(row.label) || readOptionalString(row.key) || '',
    data_type: readOptionalString(row.data_type),
    resolver_path: readOptionalString(row.resolver_path),
    description: readOptionalString(row.description),
    dynamic: row.dynamic === true,
    supported_operators: supportedOperators,
  }
}

function normalizeCondition(
  row: Record<string, unknown>,
): ApprovalChainCondition {
  return {
    id: readOptionalNumber(row.id),
    sequence: readOptionalNumber(row.sequence) || 1,
    field_key: readOptionalString(row.field_key) || '',
    field_label: readOptionalString(row.field_label),
    data_type: readOptionalString(row.data_type),
    operator: readOptionalString(row.operator) || '',
    value: row.value === undefined ? null : row.value,
  }
}

function normalizeStep(
  row: Record<string, unknown>,
): ApprovalChainStep {
  return {
    id: readOptionalNumber(row.id),
    sequence: readOptionalNumber(row.sequence) || 1,
    step_type: 'specific_user',
    approver: readOptionalNumber(row.approver) || 0,
    approver_name: readOptionalString(row.approver_name),
    amount: readOptionalString(row.amount) || '',
    currency: readOptionalString(row.currency) || '',
  }
}

function normalizeChain(
  row: Record<string, unknown>,
): ApprovalChain {
  const conditions = Array.isArray(row.conditions)
    ? row.conditions
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeCondition(entry))
        .sort((left, right) => left.sequence - right.sequence)
    : []

  const steps = Array.isArray(row.steps)
    ? row.steps
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeStep(entry))
        .sort((left, right) => left.sequence - right.sequence)
    : []

  return {
    id: readOptionalNumber(row.id) || 0,
    name: readOptionalString(row.name) || '',
    description: readOptionalString(row.description) || '',
    is_active: row.is_active !== false,
    priority: readOptionalNumber(row.priority) || 0,
    match_strategy:
      readOptionalString(row.match_strategy) === 'any' ? 'any' : 'all',
    conditions,
    steps,
    created_at: readOptionalString(row.created_at) || '',
    updated_at: readOptionalString(row.updated_at) || '',
  }
}

function normalizeApprover(
  row: Record<string, unknown>,
): ApprovalChainApprover | null {
  const userId =
    readOptionalNumber(row.user_id) ??
    readOptionalNumber(row.approver_id) ??
    readOptionalNumber(row.id)

  if (userId === undefined) return null

  const email = readOptionalString(row.email) || ''
  return {
    user_id: userId,
    name:
      readOptionalString(row.name) ||
      email ||
      `User ${String(userId)}`,
    email,
    role: readOptionalString(row.role),
    business_unit_id: readOptionalNumber(row.business_unit_id),
    business_unit: readOptionalString(row.business_unit),
    cost_center_id: readOptionalNumber(row.cost_center_id),
    cost_center: readOptionalString(row.cost_center),
    cost_center_name: readOptionalString(row.cost_center_name),
  }
}

function normalizeAdminUserApprover(
  row: AdminUserRow,
): ApprovalChainApprover | null {
  return normalizeApprover(row as Record<string, unknown>)
}

function buildApprovalChainsQuery(
  params: ApprovalChainListParams = {},
) {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  }

  const isActive = toBooleanString(params.is_active)
  if (isActive) {
    query.set('is_active', isActive)
  }

  if (params.match_strategy?.trim()) {
    query.set('match_strategy', params.match_strategy.trim())
  }

  const suffix = query.toString()
  return suffix
    ? `/api/approval-chains/?${suffix}`
    : '/api/approval-chains/'
}

function buildApproversQuery(
  params: ApprovalChainApproverListParams = {},
) {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  }
  if (params.role?.trim()) {
    query.set('role', params.role.trim())
  }
  if (
    params.business_unit_id !== undefined &&
    params.business_unit_id !== null &&
    String(params.business_unit_id).trim()
  ) {
    query.set('business_unit_id', String(params.business_unit_id).trim())
  }
  if (
    params.cost_center_id !== undefined &&
    params.cost_center_id !== null &&
    String(params.cost_center_id).trim()
  ) {
    query.set('cost_center_id', String(params.cost_center_id).trim())
  }

  return query.toString()
}

function toConditionPayload(condition: ApprovalChainCondition) {
  return sanitizePayload({
    sequence: condition.sequence,
    field_key: condition.field_key,
    operator: condition.operator,
    value: condition.value === undefined ? null : condition.value,
  })
}

function toStepPayload(step: ApprovalChainStep) {
  return sanitizePayload({
    sequence: step.sequence,
    step_type: 'specific_user',
    approver: step.approver,
    amount: step.amount,
    currency: step.currency,
  })
}

function toCreatePayload(payload: ApprovalChainCreatePayload) {
  return sanitizePayload({
    name: payload.name,
    description: payload.description || '',
    is_active: payload.is_active,
    priority: payload.priority,
    match_strategy: payload.match_strategy,
    conditions: payload.conditions.map((condition) =>
      toConditionPayload(condition),
    ),
    steps: payload.steps.map((step) => toStepPayload(step)),
  })
}

function toUpdatePayload(payload: ApprovalChainUpdatePayload) {
  return sanitizePayload({
    name: payload.name,
    description: payload.description,
    is_active: payload.is_active,
    priority: payload.priority,
    match_strategy: payload.match_strategy,
    conditions: payload.conditions?.map((condition) =>
      toConditionPayload(condition),
    ),
    steps: payload.steps?.map((step) => toStepPayload(step)),
  })
}

export async function getApprovalChains(
  params: ApprovalChainListParams = {},
): Promise<ApprovalChain[]> {
  const response = await fetch(buildApprovalChainsQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load approval chains (${response.status})`,
    )
  }

  return extractRows(body).map((row) => normalizeChain(row))
}

export async function getApprovalChain(
  chainId: number | string,
): Promise<ApprovalChain> {
  const response = await fetch(
    `/api/approval-chains/${encodeURIComponent(String(chainId))}/`,
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
    throwApiError(
      response,
      body,
      `Failed to load approval chain (${response.status})`,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeChain({})
  }

  return normalizeChain(body as Record<string, unknown>)
}

export async function createApprovalChain(
  payload: ApprovalChainCreatePayload,
): Promise<ApprovalChain> {
  const response = await fetch('/api/approval-chains/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(toCreatePayload(payload)),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to create approval chain (${response.status})`,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeChain({})
  }

  return normalizeChain(body as Record<string, unknown>)
}

export async function updateApprovalChain(
  chainId: number | string,
  payload: ApprovalChainUpdatePayload,
): Promise<ApprovalChain> {
  const response = await fetch(
    `/api/approval-chains/${encodeURIComponent(String(chainId))}/`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(toUpdatePayload(payload)),
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to update approval chain (${response.status})`,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeChain({})
  }

  return normalizeChain(body as Record<string, unknown>)
}

export async function deleteApprovalChain(chainId: number | string) {
  const response = await fetch(
    `/api/approval-chains/${encodeURIComponent(String(chainId))}/`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        ...getCsrfHeaders(),
      },
    },
  )

  if (response.ok || response.status === 204) {
    return
  }

  const body = await parseJsonSafe(response)
  throwApiError(
    response,
    body,
    `Failed to delete approval chain (${response.status})`,
  )
}

export async function getApprovalChainCatalog(): Promise<ApprovalChainCatalog> {
  const response = await fetch('/api/approval-chains/catalog/', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load approval chain catalog (${response.status})`,
    )
  }

  const payload =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {}

  const operators = Array.isArray(payload.operators)
    ? payload.operators
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeOperator(entry))
    : []

  const fields = Array.isArray(payload.fields)
    ? payload.fields
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeField(entry))
    : []

  return {
    operators,
    fields,
  }
}

export async function simulateApprovalChains(
  payload: ApprovalChainSimulationPayload,
): Promise<ApprovalChainSimulationResponse> {
  const response = await fetch('/api/approval-chains/simulate/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(
      sanitizePayload({
        payload: payload.payload,
        include_inactive: payload.include_inactive,
        include_non_matches: payload.include_non_matches,
      }),
    ),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to simulate approval chains (${response.status})`,
    )
  }

  const payloadBody =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {}

  const results = Array.isArray(payloadBody.results)
    ? payloadBody.results
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => {
          const evaluation =
            entry.evaluation && typeof entry.evaluation === 'object'
              ? (entry.evaluation as Record<string, unknown>)
              : {}

          const conditionResults = Array.isArray(evaluation.condition_results)
            ? evaluation.condition_results
                .filter(
                  (result): result is Record<string, unknown> =>
                    Boolean(result) && typeof result === 'object',
                )
                .map((result) => ({
                  sequence: readOptionalNumber(result.sequence) || 0,
                  field_key: readOptionalString(result.field_key) || '',
                  field_label: readOptionalString(result.field_label),
                  operator: readOptionalString(result.operator) || '',
                  expected_value:
                    result.expected_value === undefined
                      ? null
                      : result.expected_value,
                  actual_value:
                    result.actual_value === undefined
                      ? null
                      : result.actual_value,
                  matched: result.matched === true,
                }))
            : []

          const resolvedSteps = Array.isArray(evaluation.resolved_steps)
            ? evaluation.resolved_steps
                .filter(
                  (result): result is Record<string, unknown> =>
                    Boolean(result) && typeof result === 'object',
                )
                .map((result) => ({
                  sequence: readOptionalNumber(result.sequence) || 0,
                  step_type: 'specific_user' as const,
                  approver_id:
                    readOptionalNumber(result.approver_id) || 0,
                  approver_name: readOptionalString(result.approver_name),
                  amount: readOptionalString(result.amount) || '',
                  currency: readOptionalString(result.currency) || '',
                }))
            : []

          const matchStrategy: ApprovalChain['match_strategy'] =
            readOptionalString(evaluation.match_strategy) === 'any'
              ? 'any'
              : 'all'

          return {
            chain: normalizeChain(
              entry.chain && typeof entry.chain === 'object'
                ? (entry.chain as Record<string, unknown>)
                : {},
            ),
            evaluation: {
              matched: evaluation.matched === true,
              match_strategy: matchStrategy,
              condition_results: conditionResults,
              resolved_steps: resolvedSteps,
            },
          }
        })
    : []

  const meta =
    payloadBody.meta && typeof payloadBody.meta === 'object'
      ? (payloadBody.meta as Record<string, unknown>)
      : {}

  return {
    results,
    meta: {
      evaluated_count: readOptionalNumber(meta.evaluated_count),
      match_count: readOptionalNumber(meta.match_count),
    },
  }
}

export async function getApprovalChainApprovers(
  params: ApprovalChainApproverListParams = {},
): Promise<ApprovalChainApprover[]> {
  const suffix = buildApproversQuery(params)
  const approvalChainsTarget = suffix
    ? `/api/approval-chains/approvers/?${suffix}`
    : '/api/approval-chains/approvers/'

  const response = await fetch(approvalChainsTarget, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (response.ok) {
    return extractRows(body)
      .map((row) => normalizeApprover(row))
      .filter((row): row is ApprovalChainApprover => Boolean(row))
  }

  if (response.status !== 404 && response.status !== 405) {
    throwApiError(
      response,
      body,
      `Failed to load approvers (${response.status})`,
    )
  }

  const fallbackTarget = suffix
    ? `/api/admin/users?${suffix}`
    : '/api/admin/users'

  const fallbackResponse = await fetch(fallbackTarget, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const fallbackBody = await parseJsonSafe(fallbackResponse)
  if (!fallbackResponse.ok) {
    throwApiError(
      fallbackResponse,
      fallbackBody,
      `Failed to load approvers (${fallbackResponse.status})`,
    )
  }

  return extractRows(fallbackBody)
    .map((row) => normalizeAdminUserApprover(row as AdminUserRow))
    .filter((row): row is ApprovalChainApprover => Boolean(row))
}
