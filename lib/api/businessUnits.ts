'use client'

export type BusinessUnitRecord = {
  id: number | string
  code: string
  name: string
  parent: number | string | null
  description?: string
  legal_entity_id?: string
  gl_account_id?: string
  status?: string
  company?: number | string | null
  created_at?: string
  updated_at?: string
}

export type BusinessUnitListParams = {
  search?: string
  q?: string
  status?: string
  code?: string
  company_id?: number | string
  parent?: number | string
  parent_id?: number | string
  roots_only?: boolean
}

export type BusinessUnitCreatePayload = {
  code: string
  name: string
  parent?: string | number | null
  description?: string
  legal_entity_id?: string
  gl_account_id?: string
  status?: string
  company?: number | string
}

export class BusinessUnitsApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'BusinessUnitsApiError'
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

function buildBusinessUnitsQuery(params: BusinessUnitListParams = {}) {
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

  if (params.company_id !== undefined && params.company_id !== null) {
    query.set('company_id', String(params.company_id))
  }

  if (params.parent !== undefined && params.parent !== null) {
    query.set('parent', String(params.parent))
  }

  if (params.parent_id !== undefined && params.parent_id !== null) {
    query.set('parent_id', String(params.parent_id))
  }

  if (params.roots_only === true) {
    query.set('roots_only', 'true')
  }

  const suffix = query.toString()
  return suffix ? `/api/business-units/?${suffix}` : '/api/business-units/'
}

function normalizeBusinessUnit(row: Record<string, unknown>): BusinessUnitRecord {
  const id =
    readOptionalNumber(row.id) ??
    readOptionalString(row.id) ??
    ''
  const code = readOptionalString(row.code) || ''
  const name = readOptionalString(row.name) || ''
  const parentRaw = row.parent
  const parent =
    readOptionalNumber(parentRaw) ??
    readOptionalString(parentRaw) ??
    null
  const companyRaw = row.company
  const company =
    readOptionalNumber(companyRaw) ??
    readOptionalString(companyRaw) ??
    null

  return {
    id,
    code,
    name,
    parent,
    description: readOptionalString(row.description),
    legal_entity_id: readOptionalString(row.legal_entity_id),
    gl_account_id: readOptionalString(row.gl_account_id),
    status: readOptionalString(row.status),
    company,
    created_at: readOptionalString(row.created_at),
    updated_at: readOptionalString(row.updated_at),
  }
}

function toErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }

    const entries = Object.entries(body as Record<string, unknown>)
    for (const [key, value] of entries) {
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

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== undefined,
  )
  return Object.fromEntries(entries) as T
}

export async function getBusinessUnits(
  params: BusinessUnitListParams = {},
): Promise<BusinessUnitRecord[]> {
  const response = await fetch(buildBusinessUnitsQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new BusinessUnitsApiError(
      toErrorMessage(
        body,
        `Failed to load business units (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  return extractRows(body).map((row) => normalizeBusinessUnit(row))
}

export async function getBusinessUnitById(
  id: number | string,
): Promise<BusinessUnitRecord> {
  const response = await fetch(
    `/api/business-units/${encodeURIComponent(String(id))}/`,
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
    throw new BusinessUnitsApiError(
      toErrorMessage(
        body,
        `Failed to load business unit (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeBusinessUnit({})
  }

  return normalizeBusinessUnit(body as Record<string, unknown>)
}

export async function createBusinessUnit(
  payload: BusinessUnitCreatePayload,
): Promise<BusinessUnitRecord> {
  const response = await fetch('/api/business-units/', {
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
    throw new BusinessUnitsApiError(
      toErrorMessage(
        body,
        `Failed to create business unit (${response.status})`,
      ),
      response.status,
      body,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeBusinessUnit({})
  }

  return normalizeBusinessUnit(body as Record<string, unknown>)
}
