'use client'

import {
  isInternalAccessUser,
  normalizeAccessRole,
} from '@/lib/accessControlRoles'

export type AdminUserListParams = {
  search?: string
  status?: string
  role?: string
  business_unit_id?: string | number
  cost_center_id?: string | number
}

export type AdminUserRecord = {
  membershipId: string
  userId: string
  name: string
  email: string
  status: string
  role: string
  businessUnitId: string
  businessUnit: string
  costCenterId: string
  costCenter: string
  costCenterName: string
  ssoEnabled: boolean
  isActive: boolean
}

export type AdminUserWritePayload = {
  name: string
  email: string
  role: string
  status: string
  business_unit_id: string | number | null
  cost_center_id: string | number | null
  sso_enabled: boolean
  is_active: boolean
}

type BackendUser = {
  membership_id?: number | string | null
  user_id?: number | string | null
  name?: string | null
  email?: string | null
  status?: string | null
  role?: string | null
  business_unit_id?: string | number | null
  business_unit?: string | null
  cost_center_id?: string | number | null
  cost_center?: string | null
  cost_center_name?: string | null
  sso_enabled?: boolean | null
  is_active?: boolean | null
  user_type?: string | null
  account_type?: string | null
}

type BackendUsersResponse = {
  results?: BackendUser[]
}

export class UsersApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'UsersApiError'
    this.status = status
    this.body = body
  }
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  return parts.length === 2 ? parts.pop()?.split(';').shift() || '' : ''
}

function csrfHeaders() {
  const token = getCookie('csrftoken')
  return token ? { 'X-CSRFToken': token } : {}
}

function readOptionalString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function toIdString(value: unknown): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim()
  return ''
}

function normalizeStatus(value: unknown): string {
  const status = readOptionalString(value).toLowerCase() || 'invited'
  // Keep the current directory UI compatible with the legacy disabled label.
  // Deactivated remains distinct so a later profile-only edit cannot silently
  // turn a deactivated membership into a suspension.
  return status === 'suspended' ? 'disabled' : status
}

function normalizeBackendUser(row: BackendUser): AdminUserRecord {
  const userId = toIdString(row.user_id)
  const email = readOptionalString(row.email)
  const name =
    readOptionalString(row.name) ||
    email ||
    (userId ? `User ${userId}` : 'Unknown user')

  return {
    membershipId: toIdString(row.membership_id),
    userId,
    name,
    email,
    status: normalizeStatus(row.status),
    role: normalizeAccessRole(row.role),
    businessUnitId: toIdString(row.business_unit_id),
    businessUnit: readOptionalString(row.business_unit),
    costCenterId: toIdString(row.cost_center_id),
    costCenter: readOptionalString(row.cost_center),
    costCenterName: readOptionalString(row.cost_center_name),
    ssoEnabled: row.sso_enabled === true,
    isActive: row.is_active !== false,
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}))
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    return String((body as { detail?: unknown }).detail)
  }
  return fallback
}

function buildUsersUrl(params: AdminUserListParams): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim()) {
      query.set(key, String(value).trim())
    }
  }
  const suffix = query.toString()
  return suffix ? `/api/admin/users?${suffix}` : '/api/admin/users'
}

export async function getAdminUsers(
  params: AdminUserListParams = {},
  signal?: AbortSignal,
): Promise<AdminUserRecord[]> {
  const response = await fetch(buildUsersUrl(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  })
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new UsersApiError(
      errorMessage(body, `Failed to load users: ${response.status}`),
      response.status,
      body,
    )
  }

  const payload = body as BackendUsersResponse
  const results = Array.isArray(payload.results) ? payload.results : []
  return results
    .filter((row) =>
      isInternalAccessUser(row.role, row.user_type || row.account_type),
    )
    .map(normalizeBackendUser)
}

export async function createAdminUser(
  payload: AdminUserWritePayload,
): Promise<AdminUserRecord | null> {
  return writeAdminUser('/api/admin/users', 'POST', payload, 'add')
}

export async function updateAdminUser(
  membershipId: string,
  payload: AdminUserWritePayload,
): Promise<AdminUserRecord | null> {
  return writeAdminUser(
    `/api/admin/users/${encodeURIComponent(membershipId)}`,
    'PATCH',
    payload,
    'update',
  )
}

async function writeAdminUser(
  url: string,
  method: 'POST' | 'PATCH',
  payload: AdminUserWritePayload,
  verb: 'add' | 'update',
): Promise<AdminUserRecord | null> {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...csrfHeaders(),
    },
    body: JSON.stringify(payload),
  })
  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throw new UsersApiError(
      errorMessage(body, `Unable to ${verb} user (${response.status}).`),
      response.status,
      body,
    )
  }

  const row = body as BackendUser
  return row.membership_id || row.user_id ? normalizeBackendUser(row) : null
}
