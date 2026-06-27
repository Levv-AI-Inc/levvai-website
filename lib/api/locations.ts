'use client'

export type LocationStatus = 'active' | 'inactive'

export type LocationRecord = {
  id: number
  name: string
  country: string
  region: string
  status: LocationStatus
  created_at: string
  updated_at: string
}

export type LocationListParams = {
  search?: string
  q?: string
  status?: LocationStatus
  country?: string
  region?: string
}

export type LocationCreatePayload = {
  name: string
  country: string
  region: string
  status?: LocationStatus
}

export type LocationUpdatePayload = Partial<{
  name: string
  country: string
  region: string
  status: LocationStatus
}>

export class LocationsApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'LocationsApiError'
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

function normalizeStatus(value: unknown): LocationStatus {
  return readOptionalString(value)?.toLowerCase() === 'inactive'
    ? 'inactive'
    : 'active'
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

function buildLocationsQuery(params: LocationListParams = {}) {
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
  if (params.region?.trim()) {
    query.set('region', params.region.trim())
  }

  const suffix = query.toString()
  return suffix ? `/api/locations/?${suffix}` : '/api/locations/'
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

function normalizeLocation(row: Record<string, unknown>): LocationRecord {
  return {
    id: readOptionalNumber(row.id) ?? 0,
    name: readOptionalString(row.name) || '',
    country: readOptionalString(row.country) || '',
    region: readOptionalString(row.region) || '',
    status: normalizeStatus(row.status),
    created_at: readOptionalString(row.created_at) || '',
    updated_at: readOptionalString(row.updated_at) || '',
  }
}

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== undefined,
  )
  return Object.fromEntries(entries) as T
}

function sanitizeStatus(value: unknown): LocationStatus | undefined {
  const status = readOptionalString(value)?.toLowerCase()
  if (status === 'active' || status === 'inactive') return status
  return undefined
}

export async function getLocations(
  params: LocationListParams = {},
): Promise<LocationRecord[]> {
  const response = await fetch(buildLocationsQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new LocationsApiError(
      toErrorMessage(body, `Failed to load locations (${response.status})`),
      response.status,
      body,
    )
  }

  return extractRows(body).map((row) => normalizeLocation(row))
}

export async function createLocation(
  payload: LocationCreatePayload,
): Promise<LocationRecord> {
  const bodyPayload = sanitizePayload({
    name: readOptionalString(payload.name) || '',
    country: readOptionalString(payload.country) || '',
    region: readOptionalString(payload.region) || '',
    status: sanitizeStatus(payload.status),
  })

  const response = await fetch('/api/locations/', {
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
    throw new LocationsApiError(
      toErrorMessage(body, `Failed to create location (${response.status})`),
      response.status,
      body,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeLocation({})
  }

  return normalizeLocation(body as Record<string, unknown>)
}

export async function updateLocation(
  id: number | string,
  payload: LocationUpdatePayload,
): Promise<LocationRecord> {
  const bodyPayload = sanitizePayload({
    name: readOptionalString(payload.name),
    country: readOptionalString(payload.country),
    region: readOptionalString(payload.region),
    status: sanitizeStatus(payload.status),
  })

  const response = await fetch(
    `/api/locations/${encodeURIComponent(String(id))}/`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(bodyPayload),
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new LocationsApiError(
      toErrorMessage(body, `Failed to update location (${response.status})`),
      response.status,
      body,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeLocation({})
  }

  return normalizeLocation(body as Record<string, unknown>)
}

export async function deleteLocation(id: number | string): Promise<void> {
  const response = await fetch(
    `/api/locations/${encodeURIComponent(String(id))}/`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...getCsrfHeaders(),
      },
    },
  )

  if (response.status === 204) return

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new LocationsApiError(
      toErrorMessage(body, `Failed to delete location (${response.status})`),
      response.status,
      body,
    )
  }
}
