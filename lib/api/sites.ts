'use client'

export type SiteRecord = {
  id: number | string
  code: string
  name: string
  status?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state_province?: string
  country?: string
  postal_code?: string
  latitude?: string
  longitude?: string
  timezone?: string
  hours_per_day?: string
  hours_per_week?: string
  currency?: string
  legal_entity?: string
  tax_config?: Record<string, unknown>
  erp_code?: string
  created_at?: string
  updated_at?: string
}

export type SiteListParams = {
  search?: string
  q?: string
  status?: string
  code?: string
  country?: string
  currency?: string
  legal_entity?: string
  legal_entity_id?: string
  timezone?: string
}

export type SiteCreatePayload = {
  code: string
  name: string
  address_line1: string
  city: string
  state_province: string
  country: string
  postal_code: string
  timezone: string
  status?: string
  address_line2?: string
  latitude?: string
  longitude?: string
  hours_per_day?: string
  hours_per_week?: string
  currency?: string
  legal_entity?: string
  tax_config?: Record<string, unknown>
  erp_code?: string
}

export type SiteUpdatePayload = Partial<SiteCreatePayload>

export class SitesApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'SitesApiError'
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

function buildSitesQuery(params: SiteListParams = {}) {
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
  if (params.country?.trim()) {
    query.set('country', params.country.trim())
  }
  if (params.currency?.trim()) {
    query.set('currency', params.currency.trim())
  }
  if (params.legal_entity?.trim()) {
    query.set('legal_entity', params.legal_entity.trim())
  }
  if (params.legal_entity_id?.trim()) {
    query.set('legal_entity_id', params.legal_entity_id.trim())
  }
  if (params.timezone?.trim()) {
    query.set('timezone', params.timezone.trim())
  }

  const suffix = query.toString()
  return suffix ? `/api/sites/?${suffix}` : '/api/sites/'
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

function normalizeSite(row: Record<string, unknown>): SiteRecord {
  return {
    id:
      readOptionalNumber(row.id) ??
      readOptionalString(row.id) ??
      '',
    code: readOptionalString(row.code) || '',
    name: readOptionalString(row.name) || '',
    status: readOptionalString(row.status),
    address_line1: readOptionalString(row.address_line1),
    address_line2: readOptionalString(row.address_line2),
    city: readOptionalString(row.city),
    state_province: readOptionalString(row.state_province),
    country: readOptionalString(row.country),
    postal_code: readOptionalString(row.postal_code),
    latitude: readOptionalString(row.latitude),
    longitude: readOptionalString(row.longitude),
    timezone: readOptionalString(row.timezone),
    hours_per_day: readOptionalString(row.hours_per_day),
    hours_per_week: readOptionalString(row.hours_per_week),
    currency: readOptionalString(row.currency),
    legal_entity: readOptionalString(row.legal_entity),
    tax_config:
      row.tax_config &&
      typeof row.tax_config === 'object'
        ? (row.tax_config as Record<string, unknown>)
        : undefined,
    erp_code: readOptionalString(row.erp_code),
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

function sanitizeTaxConfig(config: Record<string, unknown> | undefined) {
  if (!config || typeof config !== 'object') return undefined

  const sanitized = sanitizePayload(config)
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

export async function getSites(
  params: SiteListParams = {},
): Promise<SiteRecord[]> {
  const response = await fetch(buildSitesQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new SitesApiError(
      toErrorMessage(body, `Failed to load sites (${response.status})`),
      response.status,
      body,
    )
  }

  return extractRows(body).map((row) => normalizeSite(row))
}

export async function createSite(
  payload: SiteCreatePayload,
): Promise<SiteRecord> {
  const bodyPayload = sanitizePayload({
    code: readOptionalString(payload.code) || '',
    name: readOptionalString(payload.name) || '',
    status: readOptionalString(payload.status)?.toLowerCase(),
    address_line1: readOptionalString(payload.address_line1) || '',
    address_line2: readOptionalString(payload.address_line2),
    city: readOptionalString(payload.city) || '',
    state_province: readOptionalString(payload.state_province) || '',
    country: readOptionalString(payload.country)?.toUpperCase() || '',
    postal_code: readOptionalString(payload.postal_code) || '',
    latitude: readOptionalString(payload.latitude),
    longitude: readOptionalString(payload.longitude),
    timezone: readOptionalString(payload.timezone) || '',
    hours_per_day: readOptionalString(payload.hours_per_day),
    hours_per_week: readOptionalString(payload.hours_per_week),
    currency: readOptionalString(payload.currency)?.toUpperCase(),
    legal_entity: readOptionalString(payload.legal_entity),
    tax_config: sanitizeTaxConfig(payload.tax_config),
    erp_code: readOptionalString(payload.erp_code),
  })

  const response = await fetch('/api/sites/', {
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
    throw new SitesApiError(
      toErrorMessage(body, `Failed to create site (${response.status})`),
      response.status,
      body,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeSite({})
  }

  return normalizeSite(body as Record<string, unknown>)
}

export async function updateSite(
  id: number | string,
  payload: SiteUpdatePayload,
): Promise<SiteRecord> {
  const bodyPayload = sanitizePayload({
    code: readOptionalString(payload.code),
    name: readOptionalString(payload.name),
    status: readOptionalString(payload.status)?.toLowerCase(),
    address_line1: readOptionalString(payload.address_line1),
    address_line2: readOptionalString(payload.address_line2),
    city: readOptionalString(payload.city),
    state_province: readOptionalString(payload.state_province),
    country: readOptionalString(payload.country)?.toUpperCase(),
    postal_code: readOptionalString(payload.postal_code),
    latitude: readOptionalString(payload.latitude),
    longitude: readOptionalString(payload.longitude),
    timezone: readOptionalString(payload.timezone),
    hours_per_day: readOptionalString(payload.hours_per_day),
    hours_per_week: readOptionalString(payload.hours_per_week),
    currency: readOptionalString(payload.currency)?.toUpperCase(),
    legal_entity: readOptionalString(payload.legal_entity),
    tax_config: sanitizeTaxConfig(payload.tax_config),
    erp_code: readOptionalString(payload.erp_code),
  })

  const response = await fetch(`/api/sites/${encodeURIComponent(String(id))}/`, {
    method: 'PATCH',
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
    throw new SitesApiError(
      toErrorMessage(body, `Failed to update site (${response.status})`),
      response.status,
      body,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeSite({})
  }

  return normalizeSite(body as Record<string, unknown>)
}
