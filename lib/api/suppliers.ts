'use client'

export type SupplierListParams = {
  search?: string
  status?: string
  type?: string
}

export type SupplierRecord = {
  id?: number | string
  supplier_id: string
  supplier_code?: string
  name: string
  email?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  tax_id?: string
  diversity_status?: string
  supplier_type: string
  category: string
  owner_name: string
  status: string
  risk_level: string
  compliance_status: string
  active_workers: number
  active_sows: number
}

export type SupplierUpsertPayload = {
  supplier_code?: string
  name: string
  email?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  tax_id?: string
  diversity_status?: string
  supplier_type: string
  category?: string
  owner_name?: string
  status?: string
  risk_level: string
  compliance_status: string
  active_workers?: number
  active_sows?: number
}

export type SupplierInvitePayload = {
  email: string
  expires_in_days: number
}

export type SupplierInviteResponse = {
  registration_link: string
  invite_id: string | number
  token: string
  expires_at: string
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
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
    for (const [key, val] of Object.entries(value)) {
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

function getCsrfHeaders() {
  const csrfToken = getCookie('csrftoken')
  if (!csrfToken) return {}

  return {
    'X-CSRFToken': csrfToken,
  }
}

function throwApiError(response: Response, body: unknown, fallback: string): never {
  throw new ApiError(
    formatApiError(body, fallback),
    response.status,
    body,
  )
}

function normalizeSupplier(row: Record<string, unknown>): SupplierRecord {
  return {
    id: row.id as string | number | undefined,
    supplier_id:
      readOptionalString(row.supplier_id) ||
      readOptionalString(row.supplier_code) ||
      '',
    supplier_code:
      readOptionalString(row.supplier_code) ||
      readOptionalString(row.supplier_id),
    name: readOptionalString(row.name) || '',
    email: readOptionalString(row.email),
    contact_name: readOptionalString(row.contact_name),
    contact_email: readOptionalString(row.contact_email),
    contact_phone: readOptionalString(row.contact_phone),
    tax_id: readOptionalString(row.tax_id),
    diversity_status: readOptionalString(row.diversity_status),
    supplier_type: readOptionalString(row.supplier_type) || '',
    category: readOptionalString(row.category) || '',
    owner_name: readOptionalString(row.owner_name) || '',
    status: readOptionalString(row.status) || '',
    risk_level: readOptionalString(row.risk_level) || '',
    compliance_status: readOptionalString(row.compliance_status) || '',
    active_workers: readOptionalNumber(row.active_workers) || 0,
    active_sows: readOptionalNumber(row.active_sows) || 0,
  }
}

function buildSupplierQuery(params: SupplierListParams) {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  }

  if (params.status?.trim()) {
    query.set('status', params.status.trim())
  }

  if (params.type?.trim()) {
    query.set('type', params.type.trim())
  }

  const suffix = query.toString()
  return suffix ? `/api/suppliers/?${suffix}` : '/api/suppliers/'
}

export async function getSuppliers(
  params: SupplierListParams = {},
): Promise<SupplierRecord[]> {
  const response = await fetch(buildSupplierQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load suppliers (${response.status})`,
    )
  }

  const rows = Array.isArray(body)
    ? body
    : Array.isArray((body as { results?: unknown[] }).results)
      ? (body as { results: unknown[] }).results
      : []

  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row) => normalizeSupplier(row))
}

export async function createSupplier(
  payload: Partial<SupplierUpsertPayload>,
): Promise<SupplierRecord> {
  const response = await fetch('/api/suppliers/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to create supplier (${response.status})`,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeSupplier({})
  }

  return normalizeSupplier(body as Record<string, unknown>)
}

export async function updateSupplier(
  supplierId: string | number,
  payload: Partial<SupplierUpsertPayload>,
): Promise<SupplierRecord> {
  const response = await fetch(`/api/suppliers/${encodeURIComponent(String(supplierId))}/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to update supplier (${response.status})`,
    )
  }

  if (!body || typeof body !== 'object') {
    return normalizeSupplier({})
  }

  return normalizeSupplier(body as Record<string, unknown>)
}

export async function inviteSupplierContact(
  supplierId: string | number,
  payload: SupplierInvitePayload,
): Promise<SupplierInviteResponse> {
  const response = await fetch(`/api/suppliers/${encodeURIComponent(String(supplierId))}/invite/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to invite supplier contact (${response.status})`,
    )
  }

  const responseBody = body as Record<string, unknown>

  return {
    registration_link: readOptionalString(responseBody.registration_link) || '',
    invite_id:
      (responseBody.invite_id as string | number | undefined) ||
      readOptionalString(responseBody.id) ||
      '',
    token: readOptionalString(responseBody.token) || '',
    expires_at: readOptionalString(responseBody.expires_at) || '',
  }
}

export async function deleteSupplier(
  supplierId: string | number,
): Promise<void> {
  const response = await fetch(`/api/suppliers/${encodeURIComponent(String(supplierId))}/`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...getCsrfHeaders(),
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to delete supplier (${response.status})`,
    )
  }
}
