'use client'

export type CostCenterRecord = {
  id: number | string
  code: string
  name: string
  description?: string
  owner_email: string
  business_unit?: string
  currency?: string
  status?: string
  budget_amount?: string
  budget_period?: string
  gl_account_id?: string
  erp_code?: string
  legal_entity_id?: string
  created_at?: string
  updated_at?: string
}

export type CostCenterListParams = {
  search?: string
  q?: string
  status?: string
  code?: string
  business_unit?: string
  business_unit_id?: string
  currency?: string
  owner_email?: string
}

export type CostCenterCreatePayload = {
  code: string
  name: string
  owner_email: string
  description?: string
  business_unit?: string
  currency?: string
  status?: string
  budget_amount?: string
  budget_period?: string
  gl_account_id?: string
  erp_code?: string
  legal_entity_id?: string
}

export class CostCentersApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'CostCentersApiError'
    this.status = status
    this.body = body
  }
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

function buildCostCentersQuery(params: CostCenterListParams = {}) {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  } else if (params.q?.trim()) {
    query.set('q', params.q.trim())
  }

  if (params.status?.trim()) {
    query.set('status', params.status.trim())
  }
  if (params.code?.trim()) {
    query.set('code', params.code.trim())
  }
  if (params.business_unit?.trim()) {
    query.set('business_unit', params.business_unit.trim())
  }
  if (params.business_unit_id?.trim()) {
    query.set('business_unit_id', params.business_unit_id.trim())
  }
  if (params.currency?.trim()) {
    query.set('currency', params.currency.trim())
  }
  if (params.owner_email?.trim()) {
    query.set('owner_email', params.owner_email.trim())
  }

  const suffix = query.toString()
  return suffix ? `/api/cost-centers/?${suffix}` : '/api/cost-centers/'
}

function toErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }

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

function normalizeCostCenter(row: Record<string, unknown>): CostCenterRecord {
  const id =
    readOptionalNumber(row.id) ??
    readOptionalString(row.id) ??
    ''

  return {
    id,
    code: readOptionalString(row.code) || '',
    name: readOptionalString(row.name) || '',
    description: readOptionalString(row.description),
    owner_email: readOptionalString(row.owner_email) || '',
    business_unit: readOptionalString(row.business_unit),
    currency: readOptionalString(row.currency),
    status: readOptionalString(row.status),
    budget_amount: readOptionalString(row.budget_amount),
    budget_period: readOptionalString(row.budget_period),
    gl_account_id: readOptionalString(row.gl_account_id),
    erp_code: readOptionalString(row.erp_code),
    legal_entity_id: readOptionalString(row.legal_entity_id),
    created_at: readOptionalString(row.created_at),
    updated_at: readOptionalString(row.updated_at),
  }
}

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== undefined,
  )
  return Object.fromEntries(entries) as T
}

export async function getCostCenters(
  params: CostCenterListParams = {},
): Promise<CostCenterRecord[]> {
  const response = await fetch(buildCostCentersQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new CostCentersApiError(
      toErrorMessage(
        body,
        `Failed to load cost centers (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  return extractRows(body).map((row) => normalizeCostCenter(row))
}

export async function createCostCenter(
  payload: CostCenterCreatePayload,
): Promise<CostCenterRecord> {
  const response = await fetch('/api/cost-centers/', {
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
    throw new CostCentersApiError(
      toErrorMessage(
        body,
        `Failed to create cost center (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeCostCenter({})
  }

  return normalizeCostCenter(body as Record<string, unknown>)
}
