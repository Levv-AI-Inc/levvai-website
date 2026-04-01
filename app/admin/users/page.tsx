'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
}

type BackendUsersResponse = {
  results?: BackendUser[]
}

type UserRow = {
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

type AddUserFormState = {
  name: string
  email: string
  businessUnit: string
  costCenter: string
  ssoEnabled: boolean
  role: string
  status: string
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'business', label: 'Business' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'finance', label: 'Finance' },
  { value: 'viewer', label: 'Viewer' },
]

const STATUS_OPTIONS = [
  { value: 'invited', label: 'Invited' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
]

function readOptionalString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function toIdString(value: unknown): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim()
  return ''
}

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeStatus(value: unknown): string {
  const raw = readOptionalString(value)
  if (!raw) return 'invited'
  return raw.toLowerCase()
}

function normalizeRole(value: unknown): string {
  const raw = readOptionalString(value)
  if (!raw) return 'viewer'
  return raw.toLowerCase()
}

function mapBackendUser(row: BackendUser): UserRow {
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
    role: normalizeRole(row.role),
    businessUnitId: toIdString(row.business_unit_id),
    businessUnit: readOptionalString(row.business_unit),
    costCenterId: toIdString(row.cost_center_id),
    costCenter: readOptionalString(row.cost_center),
    costCenterName: readOptionalString(row.cost_center_name),
    ssoEnabled: row.sso_enabled === true,
    isActive: row.is_active !== false,
  }
}

function toCostCenterDisplay(row: UserRow): string {
  if (row.costCenter && row.costCenterName) {
    return `${row.costCenter} (${row.costCenterName})`
  }
  return row.costCenter || row.costCenterName || '—'
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700'
    case 'invited':
      return 'bg-blue-100 text-blue-700'
    case 'disabled':
      return 'bg-slate-200 text-slate-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function upsertUser(existing: UserRow[], incoming: UserRow): UserRow[] {
  const incomingEmail = incoming.email.toLowerCase()
  const index = existing.findIndex((row) => {
    if (incomingEmail && row.email) {
      return row.email.toLowerCase() === incomingEmail
    }
    return row.name.toLowerCase() === incoming.name.toLowerCase()
  })

  if (index === -1) {
    return [incoming, ...existing]
  }

  const updated = [...existing]
  updated[index] = incoming
  return updated
}

export default function AdminUsersPage() {
  const router = useRouter()

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [businessUnitFilter, setBusinessUnitFilter] = useState('')
  const [costCenterFilter, setCostCenterFilter] = useState('')

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [addUserError, setAddUserError] = useState('')
  const [addUserForm, setAddUserForm] = useState<AddUserFormState>({
    name: '',
    email: '',
    businessUnit: '',
    costCenter: '',
    ssoEnabled: false,
    role: 'viewer',
    status: 'invited',
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const controller = new AbortController()

    const loadUsers = async () => {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (statusFilter) params.set('status', statusFilter)
        if (roleFilter) params.set('role', roleFilter)
        if (businessUnitFilter.trim()) {
          params.set('business_unit_id', businessUnitFilter.trim())
        }
        if (costCenterFilter.trim()) {
          params.set('cost_center_id', costCenterFilter.trim())
        }

        const url = params.toString()
          ? `/api/admin/users?${params.toString()}`
          : '/api/admin/users'

        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        })

        if (response.status === 401) {
          router.replace('/auth/login?next=/admin/users')
          return
        }

        if (response.status === 403) {
          setForbidden(true)
          setUsers([])
          return
        }

        if (response.status === 400) {
          setForbidden(false)
          setUsers([])
          setError('Tenant context is required to view users.')
          return
        }

        if (!response.ok) {
          throw new Error(`Failed to load users: ${response.status}`)
        }

        const payload = (await response.json().catch(() => ({}))) as BackendUsersResponse
        const results = Array.isArray(payload.results) ? payload.results : []
        const mapped = results.map(mapBackendUser)

        setUsers(mapped)
        setForbidden(false)
      } catch (requestError) {
        if ((requestError as { name?: string })?.name === 'AbortError') return
        setUsers([])
        setForbidden(false)
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load users.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadUsers()
    return () => controller.abort()
  }, [router, search, statusFilter, roleFilter, businessUnitFilter, costCenterFilter])

  const usersForDetails = useMemo(
    () =>
      users.map((row) => ({
        name: row.name,
        email: row.email || undefined,
        role: toTitleCase(row.role),
        status: toTitleCase(row.status),
        businessUnit: row.businessUnit || row.businessUnitId || undefined,
        costCenter: row.costCenter || row.costCenterName || undefined,
        ssoEnabled: row.ssoEnabled,
        source: 'API',
      })),
    [users],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('users', JSON.stringify(usersForDetails))
  }, [usersForDetails])

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setStatusFilter('')
    setRoleFilter('')
    setBusinessUnitFilter('')
    setCostCenterFilter('')
  }

  const openAddUserModal = () => {
    setAddUserError('')
    setAddUserForm({
      name: '',
      email: '',
      businessUnit: '',
      costCenter: '',
      ssoEnabled: false,
      role: 'viewer',
      status: 'invited',
    })
    setIsAddUserModalOpen(true)
  }

  const closeAddUserModal = () => {
    setIsAddUserModalOpen(false)
    setAddUserError('')
  }

  const submitAddUser = () => {
    const name = addUserForm.name.trim()
    const email = addUserForm.email.trim()

    if (!name) {
      setAddUserError('Name is required.')
      return
    }

    if (!email) {
      setAddUserError('Email is required.')
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email)) {
      setAddUserError('Enter a valid email address.')
      return
    }

    const localUser: UserRow = {
      membershipId: `local-${Date.now()}`,
      userId: '',
      name,
      email,
      status: normalizeStatus(addUserForm.status),
      role: normalizeRole(addUserForm.role),
      businessUnitId: '',
      businessUnit: addUserForm.businessUnit.trim(),
      costCenterId: '',
      costCenter: addUserForm.costCenter.trim(),
      costCenterName: '',
      ssoEnabled: addUserForm.ssoEnabled,
      isActive: normalizeStatus(addUserForm.status) === 'active',
    }

    setUsers((current) => upsertUser(current, localUser))
    closeAddUserModal()
  }

  const openUserDetails = (user: UserRow) => {
    router.push(`/admin/users/${encodeURIComponent(user.name)}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage users, roles, and access across the tenant.
          </p>
        </div>

        <button
          onClick={openAddUserModal}
          className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add User</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Add a user record with tenant role and access status.
                </p>
              </div>
              <button
                onClick={closeAddUserModal}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close add user modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-800">Name</label>
                <input
                  value={addUserForm.name}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-800">Email</label>
                <input
                  type="email"
                  value={addUserForm.email}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="jane.doe@company.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Business Unit
                </label>
                <input
                  value={addUserForm.businessUnit}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      businessUnit: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Finance"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Cost Center</label>
                <input
                  value={addUserForm.costCenter}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      costCenter: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="CC-1001"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Role</label>
                <select
                  value={addUserForm.role}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Status</label>
                <select
                  value={addUserForm.status}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm font-medium text-gray-800">SSO Enabled</span>
                <button
                  onClick={() =>
                    setAddUserForm((current) => ({
                      ...current,
                      ssoEnabled: !current.ssoEnabled,
                    }))
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                    addUserForm.ssoEnabled ? 'bg-black' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      addUserForm.ssoEnabled ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {addUserError && (
                <p className="md:col-span-2 text-sm text-red-600">{addUserError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                onClick={closeAddUserModal}
                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitAddUser}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search users"
            className="rounded-md border px-3 py-2 text-sm"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            value={businessUnitFilter}
            onChange={(event) => setBusinessUnitFilter(event.target.value)}
            placeholder="Business unit ID"
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            value={costCenterFilter}
            onChange={(event) => setCostCenterFilter(event.target.value)}
            placeholder="Cost center ID"
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={clearFilters}
            className="rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>
      </div>

      {forbidden && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          You do not have permission to view tenant users. Admin access is required.
        </div>
      )}

      {!forbidden && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Business Unit</th>
              <th className="px-4 py-3 font-medium">Cost Center</th>
              <th className="px-4 py-3 font-medium">SSO Enabled</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  Loading users...
                </td>
              </tr>
            )}

            {!loading && !forbidden && users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  No users found.
                </td>
              </tr>
            )}

            {!loading &&
              !forbidden &&
              users.map((user) => (
                <tr
                  key={`${user.membershipId || user.userId || user.email}-${user.name}`}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="px-4 py-3 text-gray-700">{user.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(user.status)}`}
                    >
                      {toTitleCase(user.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {toTitleCase(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {user.businessUnit || user.businessUnitId || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{toCostCenterDisplay(user)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.ssoEnabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {user.ssoEnabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openUserDetails(user)}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
