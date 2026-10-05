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

export type SupplierSourceReference = {
  id: string
  name: string
}

export type SupplierDetail = SupplierRecord & {
  source_system: string
  source_identifier: string
  source_status: string
  source_last_synced_at?: string
  registered_address: Record<string, string>
  hq_country: string
  buying_entities: SupplierSourceReference[]
  business_units: SupplierSourceReference[]
  service_type: string
  active_in_levv: boolean
  source_ownership: {
    owner: string
    read_only: boolean
    fields: string[]
  }
  allowed_actions: string[]
}

export type SupplierWorker = {
  assignment_id: number
  assignment_number: string
  worker_full_name: string
  worker_email: string
  worker_phone: string
  status: string
  role_id?: number
  role_name: string
  site_id?: number
  site_name: string
  work_location_label: string
  start_date?: string
  end_date?: string
  created_at?: string
  updated_at?: string
}

export type SupplierWorkersResponse = {
  supplier_id: number
  results: SupplierWorker[]
  pagination: {
    page: number
    page_size: number
    total_count: number
    total_pages: number
    has_next: boolean
    has_previous: boolean
  }
}

export type SupplierCoverage = {
  id: number
  supplier_id: number
  role_id: number
  role_code: string
  role_name: string
  role_location_label: string
  site_id: number
  site_code: string
  site_name: string
  site_city: string
  site_country: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type SupplierCoverageResponse = {
  supplier_id: number
  results: SupplierCoverage[]
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

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false
  }
  return fallback
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => readOptionalString(item))
    .filter((item): item is string => Boolean(item))
}

function normalizeSourceReferences(value: unknown): SupplierSourceReference[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string') {
      const label = item.trim()
      return label ? [{ id: label, name: label }] : []
    }
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const id =
      readOptionalString(row.id) ||
      readOptionalString(row.code) ||
      readOptionalString(row.name) ||
      ''
    const name = readOptionalString(row.name) || id
    return id || name ? [{ id, name }] : []
  })
}

function normalizeAddress(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, readOptionalString(item)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  )
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

function normalizeSupplierDetail(row: Record<string, unknown>): SupplierDetail {
  const ownership =
    row.source_ownership && typeof row.source_ownership === 'object'
      ? (row.source_ownership as Record<string, unknown>)
      : {}

  return {
    ...normalizeSupplier(row),
    source_system: readOptionalString(row.source_system) || '',
    source_identifier: readOptionalString(row.source_identifier) || '',
    source_status: readOptionalString(row.source_status) || '',
    source_last_synced_at: readOptionalString(row.source_last_synced_at),
    registered_address: normalizeAddress(row.registered_address),
    hq_country: readOptionalString(row.hq_country) || '',
    buying_entities: normalizeSourceReferences(row.buying_entities),
    business_units: normalizeSourceReferences(row.business_units),
    service_type: readOptionalString(row.service_type) || '',
    active_in_levv: readBoolean(row.active_in_levv, true),
    source_ownership: {
      owner: readOptionalString(ownership.owner) || 'unconfigured',
      read_only: readBoolean(ownership.read_only, true),
      fields: readStringArray(ownership.fields),
    },
    allowed_actions: readStringArray(row.allowed_actions),
  }
}

function normalizeSupplierWorker(row: Record<string, unknown>): SupplierWorker {
  return {
    assignment_id: readOptionalNumber(row.assignment_id) || 0,
    assignment_number: readOptionalString(row.assignment_number) || '',
    worker_full_name: readOptionalString(row.worker_full_name) || '',
    worker_email: readOptionalString(row.worker_email) || '',
    worker_phone: readOptionalString(row.worker_phone) || '',
    status: readOptionalString(row.status) || '',
    role_id: readOptionalNumber(row.role_id),
    role_name: readOptionalString(row.role_name) || '',
    site_id: readOptionalNumber(row.site_id),
    site_name: readOptionalString(row.site_name) || '',
    work_location_label: readOptionalString(row.work_location_label) || '',
    start_date: readOptionalString(row.start_date),
    end_date: readOptionalString(row.end_date),
    created_at: readOptionalString(row.created_at),
    updated_at: readOptionalString(row.updated_at),
  }
}

function normalizeSupplierCoverage(row: Record<string, unknown>): SupplierCoverage {
  return {
    id: readOptionalNumber(row.id) || 0,
    supplier_id: readOptionalNumber(row.supplier_id) || 0,
    role_id: readOptionalNumber(row.role_id) || 0,
    role_code: readOptionalString(row.role_code) || '',
    role_name: readOptionalString(row.role_name) || '',
    role_location_label: readOptionalString(row.role_location_label) || '',
    site_id: readOptionalNumber(row.site_id) || 0,
    site_code: readOptionalString(row.site_code) || '',
    site_name: readOptionalString(row.site_name) || '',
    site_city: readOptionalString(row.site_city) || '',
    site_country: readOptionalString(row.site_country) || '',
    is_active: readBoolean(row.is_active),
    created_at: readOptionalString(row.created_at),
    updated_at: readOptionalString(row.updated_at),
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

export async function getSupplier(
  supplierId: string | number,
  signal?: AbortSignal,
): Promise<SupplierDetail> {
  const response = await fetch(
    `/api/suppliers/${encodeURIComponent(String(supplierId))}/`,
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal,
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load supplier (${response.status})`,
    )
  }

  return normalizeSupplierDetail(
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {},
  )
}

export async function getSupplierWorkers(
  supplierId: string | number,
  params: { page?: number; page_size?: number } = {},
  signal?: AbortSignal,
): Promise<SupplierWorkersResponse> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  const suffix = query.toString()
  const path = `/api/suppliers/${encodeURIComponent(String(supplierId))}/workers/${suffix ? `?${suffix}` : ''}`
  const response = await fetch(path, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    signal,
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load supplier workers (${response.status})`,
    )
  }

  const payload =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  const pagination =
    payload.pagination && typeof payload.pagination === 'object'
      ? (payload.pagination as Record<string, unknown>)
      : {}
  const results = Array.isArray(payload.results)
    ? payload.results
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
        .map(normalizeSupplierWorker)
    : []

  return {
    supplier_id: readOptionalNumber(payload.supplier_id) || 0,
    results,
    pagination: {
      page: readOptionalNumber(pagination.page) || 1,
      page_size: readOptionalNumber(pagination.page_size) || 25,
      total_count: readOptionalNumber(pagination.total_count) || results.length,
      total_pages: readOptionalNumber(pagination.total_pages) || 0,
      has_next: readBoolean(pagination.has_next),
      has_previous: readBoolean(pagination.has_previous),
    },
  }
}

export async function getSupplierCoverage(
  supplierId: string | number,
  signal?: AbortSignal,
): Promise<SupplierCoverageResponse> {
  const response = await fetch(
    `/api/suppliers/${encodeURIComponent(String(supplierId))}/coverage/`,
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal,
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, `Failed to load supplier coverage (${response.status})`)
  }
  const payload = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {}
  const results = Array.isArray(payload.results)
    ? payload.results
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
        .map(normalizeSupplierCoverage)
    : []
  return {
    supplier_id: readOptionalNumber(payload.supplier_id) || 0,
    results,
  }
}

export async function createSupplierCoverage(
  supplierId: string | number,
  payload: { role_id: number; site_id: number | string },
): Promise<SupplierCoverage> {
  const response = await fetch(
    `/api/suppliers/${encodeURIComponent(String(supplierId))}/coverage/`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(payload),
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, `Failed to add supplier coverage (${response.status})`)
  }
  return normalizeSupplierCoverage(
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {},
  )
}

export async function updateSupplierCoverage(
  supplierId: string | number,
  coverageId: number,
  isActive: boolean,
): Promise<SupplierCoverage> {
  const response = await fetch(
    `/api/suppliers/${encodeURIComponent(String(supplierId))}/coverage/${coverageId}/`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify({ is_active: isActive }),
    },
  )
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, `Failed to update supplier coverage (${response.status})`)
  }
  return normalizeSupplierCoverage(
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {},
  )
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
