'use client'

export type LegalEntityAddress = {
  line1?: string
  line2?: string
  city?: string
  state_province?: string
  postal_code?: string
  country?: string
}

export type LegalEntityRecord = {
  id: string
  name: string
  country?: string
  tax_id?: string
  currency?: string
  erp_code?: string
  billing_address?: LegalEntityAddress
  status?: string
  created_at?: string
  updated_at?: string
}

export type LegalEntityListParams = {
  search?: string
  q?: string
  status?: string
  country?: string
  currency?: string
}

export type LegalEntityCreatePayload = {
  id: string
  name: string
  country: string
  currency: string
  tax_id?: string
  erp_code?: string
  billing_address?: LegalEntityAddress
  status?: string
}

export class LegalEntitiesApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'LegalEntitiesApiError'
    this.status = status
    this.body = body
  }
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
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

function buildLegalEntitiesQuery(params: LegalEntityListParams = {}) {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  } else if (params.q?.trim()) {
    query.set('q', params.q.trim())
  }
  if (params.status?.trim()) {
    query.set('status', params.status.trim())
  }
  if (params.country?.trim()) {
    query.set('country', params.country.trim())
  }
  if (params.currency?.trim()) {
    query.set('currency', params.currency.trim())
  }

  const suffix = query.toString()
  return suffix
    ? `/api/legal-entities/?${suffix}`
    : '/api/legal-entities/'
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

function normalizeLegalEntity(
  row: Record<string, unknown>,
): LegalEntityRecord {
  const rawAddress =
    row.billing_address &&
    typeof row.billing_address === 'object'
      ? (row.billing_address as Record<string, unknown>)
      : {}

  return {
    id: readOptionalString(row.id) || '',
    name: readOptionalString(row.name) || '',
    country: readOptionalString(row.country),
    tax_id: readOptionalString(row.tax_id),
    currency: readOptionalString(row.currency),
    erp_code: readOptionalString(row.erp_code),
    billing_address: {
      line1: readOptionalString(rawAddress.line1),
      line2: readOptionalString(rawAddress.line2),
      city: readOptionalString(rawAddress.city),
      state_province: readOptionalString(rawAddress.state_province),
      postal_code: readOptionalString(rawAddress.postal_code),
      country: readOptionalString(rawAddress.country),
    },
    status: readOptionalString(row.status),
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

function sanitizeAddress(address: LegalEntityAddress | undefined) {
  if (!address) return undefined

  const normalized = sanitizePayload({
    line1: readOptionalString(address.line1),
    line2: readOptionalString(address.line2),
    city: readOptionalString(address.city),
    state_province: readOptionalString(address.state_province),
    postal_code: readOptionalString(address.postal_code),
    country: readOptionalString(address.country),
  })

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

export async function getLegalEntities(
  params: LegalEntityListParams = {},
): Promise<LegalEntityRecord[]> {
  const response = await fetch(buildLegalEntitiesQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new LegalEntitiesApiError(
      toErrorMessage(
        body,
        `Failed to load legal entities (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  return extractRows(body).map((row) => normalizeLegalEntity(row))
}

export async function createLegalEntity(
  payload: LegalEntityCreatePayload,
): Promise<LegalEntityRecord> {
  const bodyPayload = sanitizePayload({
    id: readOptionalString(payload.id) || '',
    name: readOptionalString(payload.name) || '',
    country: readOptionalString(payload.country)?.toUpperCase() || '',
    currency: readOptionalString(payload.currency)?.toUpperCase() || '',
    tax_id: readOptionalString(payload.tax_id),
    erp_code: readOptionalString(payload.erp_code),
    billing_address: sanitizeAddress(payload.billing_address),
    status: readOptionalString(payload.status)?.toLowerCase(),
  })

  const response = await fetch('/api/legal-entities/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(bodyPayload),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new LegalEntitiesApiError(
      toErrorMessage(
        body,
        `Failed to create legal entity (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeLegalEntity({})
  }

  return normalizeLegalEntity(body as Record<string, unknown>)
}
