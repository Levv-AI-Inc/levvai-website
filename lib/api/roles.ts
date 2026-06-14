'use client'

export type RoleRecord = {
  id: number
  code: string
  name: string
  description: string
  country: string
  region: string
  city: string
  location_label: string
  default_currency: string
  default_unit: 'hour' | 'day'
  is_active: boolean
  created_at: string
  updated_at: string
}

export type RoleListParams = {
  search?: string
  is_active?: boolean | string
  active?: boolean | string
  country?: string
  region?: string
  city?: string
  default_currency?: string
  default_unit?: 'hour' | 'day' | string
}

export type RoleCreatePayload = {
  name: string
  description?: string
  country: string
  region?: string
  city?: string
  default_currency: string
  default_unit: 'hour' | 'day'
  is_active: boolean
}

export type RoleUpdatePayload = Partial<RoleCreatePayload>

export class RolesApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'RolesApiError'
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

function formatApiError(body: unknown, fallback: string) {
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
  throw new RolesApiError(
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

function buildRolesQuery(params: RoleListParams = {}) {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  }

  const isActive = toBooleanString(params.is_active ?? params.active)
  if (isActive) {
    query.set('is_active', isActive)
  }

  if (params.country?.trim()) {
    query.set('country', params.country.trim().toUpperCase())
  }
  if (params.region?.trim()) {
    query.set('region', params.region.trim())
  }
  if (params.city?.trim()) {
    query.set('city', params.city.trim())
  }
  if (params.default_currency?.trim()) {
    query.set(
      'default_currency',
      params.default_currency.trim().toUpperCase(),
    )
  }
  if (params.default_unit?.trim()) {
    query.set('default_unit', params.default_unit.trim().toLowerCase())
  }

  const suffix = query.toString()
  return suffix ? `/api/roles/?${suffix}` : '/api/roles/'
}

function normalizeRole(row: Record<string, unknown>): RoleRecord {
  return {
    id: readOptionalNumber(row.id) || 0,
    code: readOptionalString(row.code) || '',
    name: readOptionalString(row.name) || '',
    description: readOptionalString(row.description) || '',
    country: readOptionalString(row.country) || '',
    region: readOptionalString(row.region) || '',
    city: readOptionalString(row.city) || '',
    location_label: readOptionalString(row.location_label) || '',
    default_currency: readOptionalString(row.default_currency) || '',
    default_unit:
      readOptionalString(row.default_unit) === 'day' ? 'day' : 'hour',
    is_active: row.is_active !== false,
    created_at: readOptionalString(row.created_at) || '',
    updated_at: readOptionalString(row.updated_at) || '',
  }
}

function toCreatePayload(payload: RoleCreatePayload) {
  return sanitizePayload({
    name: payload.name.trim(),
    description: payload.description?.trim() || '',
    country: payload.country.trim().toUpperCase(),
    region: payload.region?.trim() || '',
    city: payload.city?.trim() || '',
    default_currency: payload.default_currency.trim().toUpperCase(),
    default_unit: payload.default_unit,
    is_active: payload.is_active,
  })
}

function toUpdatePayload(payload: RoleUpdatePayload) {
  return sanitizePayload({
    name: payload.name?.trim(),
    description: payload.description?.trim(),
    country: payload.country?.trim().toUpperCase(),
    region: payload.region?.trim(),
    city: payload.city?.trim(),
    default_currency: payload.default_currency?.trim().toUpperCase(),
    default_unit: payload.default_unit,
    is_active: payload.is_active,
  })
}

export async function getRoles(
  params: RoleListParams = {},
): Promise<RoleRecord[]> {
  const response = await fetch(buildRolesQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, `Failed to load roles (${response.status})`)
  }

  return extractRows(body).map((row) => normalizeRole(row))
}

export async function getRole(roleId: number | string): Promise<RoleRecord> {
  const response = await fetch(`/api/roles/${encodeURIComponent(String(roleId))}/`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, `Failed to load role (${response.status})`)
  }

  if (!body || typeof body !== 'object') {
    return normalizeRole({})
  }

  return normalizeRole(body as Record<string, unknown>)
}

export async function createRole(
  payload: RoleCreatePayload,
): Promise<RoleRecord> {
  const response = await fetch('/api/roles/', {
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
    throwApiError(response, body, `Failed to create role (${response.status})`)
  }

  if (!body || typeof body !== 'object') {
    return normalizeRole({})
  }

  return normalizeRole(body as Record<string, unknown>)
}

export async function updateRole(
  roleId: number | string,
  payload: RoleUpdatePayload,
): Promise<RoleRecord> {
  const response = await fetch(`/api/roles/${encodeURIComponent(String(roleId))}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(toUpdatePayload(payload)),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, `Failed to update role (${response.status})`)
  }

  if (!body || typeof body !== 'object') {
    return normalizeRole({})
  }

  return normalizeRole(body as Record<string, unknown>)
}

export async function deleteRole(roleId: number | string) {
  const response = await fetch(`/api/roles/${encodeURIComponent(String(roleId))}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...getCsrfHeaders(),
    },
  })

  if (response.ok || response.status === 204) return

  const body = await parseJsonSafe(response)
  throwApiError(response, body, `Failed to delete role (${response.status})`)
}
