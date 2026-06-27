'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  BusinessUnitsApiError,
  createBusinessUnit,
  getBusinessUnits,
  type BusinessUnitRecord,
} from '@/lib/api/businessUnits'
import {
  CostCentersApiError,
  getCostCenters,
  type CostCenterRecord,
} from '@/lib/api/costCenters'

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

type AddBusinessUnitFormState = {
  code: string
  name: string
  parent: string
  description: string
  legalEntityId: string
  glAccountId: string
  status: string
  company: string
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

const BUSINESS_UNIT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
]

const EMPTY_ADD_BUSINESS_UNIT_FORM: AddBusinessUnitFormState = {
  code: '',
  name: '',
  parent: '',
  description: '',
  legalEntityId: '',
  glAccountId: '',
  status: 'active',
  company: '',
}

function businessUnitValue(unit: BusinessUnitRecord): string {
  return unit.code || String(unit.id)
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
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitRecord[]>([])
  const [businessUnitsLoading, setBusinessUnitsLoading] = useState(false)
  const [businessUnitsError, setBusinessUnitsError] = useState('')
  const [costCenters, setCostCenters] = useState<CostCenterRecord[]>([])
  const [costCentersLoading, setCostCentersLoading] = useState(false)
  const [costCentersError, setCostCentersError] = useState('')

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
  const [isAddBusinessUnitModalOpen, setIsAddBusinessUnitModalOpen] =
    useState(false)
  const [addBusinessUnitError, setAddBusinessUnitError] = useState('')
  const [creatingBusinessUnit, setCreatingBusinessUnit] = useState(false)
  const [addBusinessUnitForm, setAddBusinessUnitForm] =
    useState<AddBusinessUnitFormState>(EMPTY_ADD_BUSINESS_UNIT_FORM)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadBusinessUnits = useCallback(async () => {
    setBusinessUnitsLoading(true)
    setBusinessUnitsError('')

    try {
      const rows = await getBusinessUnits()
      setBusinessUnits(rows)
    } catch (requestError) {
      if (
        requestError instanceof BusinessUnitsApiError &&
        requestError.status === 401
      ) {
        router.replace('/auth/login?next=/admin/users')
        return
      }

      if (
        requestError instanceof BusinessUnitsApiError &&
        requestError.status === 403
      ) {
        setBusinessUnits([])
        setBusinessUnitsError(
          'You do not have permission to view business units.',
        )
        return
      }

      setBusinessUnits([])
      setBusinessUnitsError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load business units.',
      )
    } finally {
      setBusinessUnitsLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadBusinessUnits()
  }, [loadBusinessUnits])

  const loadCostCenters = useCallback(async () => {
    setCostCentersLoading(true)
    setCostCentersError('')

    try {
      const rows = await getCostCenters()
      setCostCenters(rows)
    } catch (requestError) {
      if (
        requestError instanceof CostCentersApiError &&
        requestError.status === 401
      ) {
        router.replace('/auth/login?next=/admin/users')
        return
      }

      if (
        requestError instanceof CostCentersApiError &&
        requestError.status === 403
      ) {
        setCostCenters([])
        setCostCentersError(
          'You do not have permission to view cost centers.',
        )
        return
      }

      setCostCenters([])
      setCostCentersError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load cost centers.',
      )
    } finally {
      setCostCentersLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadCostCenters()
  }, [loadCostCenters])

  useEffect(() => {
    const controller = new AbortController()

    const loadUsers = async () => {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams()
        const businessUnitFilterValue = businessUnitFilter.trim()
        const costCenterFilterValue = costCenterFilter.trim()

        if (search) params.set('search', search)
        if (statusFilter) params.set('status', statusFilter)
        if (roleFilter) params.set('role', roleFilter)
        if (
          businessUnitFilterValue &&
          /^\d+$/.test(businessUnitFilterValue)
        ) {
          params.set('business_unit_id', businessUnitFilterValue)
        }
        if (costCenterFilterValue) {
          params.set('cost_center_id', costCenterFilterValue)
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

  const businessUnitOptions = useMemo(() => {
    const seen = new Set<string>()
    const options = businessUnits
      .map((unit) => {
        const value = businessUnitValue(unit)
        const label = unit.code
          ? `${unit.name} (${unit.code})`
          : unit.name
        return {
          value,
          label,
          unit,
        }
      })
      .filter((option) => {
        if (!option.value) return false
        if (seen.has(option.value)) return false
        seen.add(option.value)
        return true
      })

    options.sort((a, b) => a.label.localeCompare(b.label))
    return options
  }, [businessUnits])

  const costCenterOptions = useMemo(() => {
    const seen = new Set<string>()

    const selectedBusinessUnit = businessUnitOptions.find(
      (option) => option.value === addUserForm.businessUnit,
    )
    const selectedBusinessUnitCode =
      selectedBusinessUnit?.unit.code?.toLowerCase() || ''

    const options = costCenters
      .filter((costCenter) => {
        if (!selectedBusinessUnitCode) return true
        return (
          (costCenter.business_unit || '').toLowerCase() ===
          selectedBusinessUnitCode
        )
      })
      .map((costCenter) => {
        const value = costCenter.code || String(costCenter.id)
        const label = costCenter.code
          ? `${costCenter.name} (${costCenter.code})`
          : costCenter.name

        return {
          value,
          label,
          center: costCenter,
        }
      })
      .filter((option) => {
        if (!option.value) return false
        if (seen.has(option.value)) return false
        seen.add(option.value)
        return true
      })

    options.sort((a, b) => a.label.localeCompare(b.label))
    return options
  }, [addUserForm.businessUnit, businessUnitOptions, costCenters])

  const usersForTable = useMemo(() => {
    const selected = businessUnitFilter.trim().toLowerCase()
    if (!selected) return users

    const selectedOption = businessUnitOptions.find(
      (option) => option.value.toLowerCase() === selected,
    )
    const selectedCode = selectedOption?.unit.code.toLowerCase() || ''
    const selectedName = selectedOption?.unit.name.toLowerCase() || ''

    return users.filter((row) => {
      const rowBuId = row.businessUnitId.toLowerCase()
      const rowBuName = row.businessUnit.toLowerCase()

      if (rowBuId === selected) return true
      if (selectedCode && rowBuId === selectedCode) return true
      if (selectedName && rowBuName === selectedName) return true
      return false
    })
  }, [businessUnitFilter, businessUnitOptions, users])

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

  const openAddBusinessUnitModal = () => {
    setAddBusinessUnitError('')
    setAddBusinessUnitForm(EMPTY_ADD_BUSINESS_UNIT_FORM)
    setIsAddBusinessUnitModalOpen(true)
  }

  const closeAddBusinessUnitModal = () => {
    if (creatingBusinessUnit) return
    setIsAddBusinessUnitModalOpen(false)
    setAddBusinessUnitError('')
  }

  const submitAddBusinessUnit = async () => {
    const code = addBusinessUnitForm.code.trim()
    const name = addBusinessUnitForm.name.trim()
    const parent = addBusinessUnitForm.parent.trim()

    if (!code) {
      setAddBusinessUnitError('Business unit code is required.')
      return
    }

    if (!name) {
      setAddBusinessUnitError('Business unit name is required.')
      return
    }

    setCreatingBusinessUnit(true)
    setAddBusinessUnitError('')

    try {
      const companyValue = addBusinessUnitForm.company.trim()
      const companyNumber = companyValue ? Number(companyValue) : NaN
      const created = await createBusinessUnit({
        code,
        name,
        parent: parent || null,
        description:
          addBusinessUnitForm.description.trim() || undefined,
        legal_entity_id:
          addBusinessUnitForm.legalEntityId.trim() || undefined,
        gl_account_id:
          addBusinessUnitForm.glAccountId.trim() || undefined,
        status:
          addBusinessUnitForm.status.trim() || undefined,
        company: Number.isFinite(companyNumber)
          ? companyNumber
          : undefined,
      })

      setIsAddBusinessUnitModalOpen(false)
      await loadBusinessUnits()
      setAddUserForm((current) => ({
        ...current,
        businessUnit: businessUnitValue(created),
      }))
    } catch (requestError) {
      if (
        requestError instanceof BusinessUnitsApiError &&
        requestError.status === 401
      ) {
        router.replace('/auth/login?next=/admin/users')
        return
      }

      if (
        requestError instanceof BusinessUnitsApiError &&
        requestError.status === 403
      ) {
        setAddBusinessUnitError(
          'You do not have permission to add business units.',
        )
        return
      }

      setAddBusinessUnitError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to add business unit.',
      )
    } finally {
      setCreatingBusinessUnit(false)
    }
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

    const selectedBusinessUnit = businessUnitOptions.find(
      (option) => option.value === addUserForm.businessUnit,
    )
    const selectedCostCenter = costCenterOptions.find(
      (option) => option.value === addUserForm.costCenter,
    )

    const localUser: UserRow = {
      membershipId: `local-${Date.now()}`,
      userId: '',
      name,
      email,
      status: normalizeStatus(addUserForm.status),
      role: normalizeRole(addUserForm.role),
      businessUnitId:
        selectedBusinessUnit?.unit.code ||
        selectedBusinessUnit?.value ||
        '',
      businessUnit:
        selectedBusinessUnit?.unit.name ||
        addUserForm.businessUnit.trim(),
      costCenterId: selectedCostCenter
        ? String(selectedCostCenter.center.id)
        : '',
      costCenter:
        selectedCostCenter?.center.code ||
        addUserForm.costCenter.trim(),
      costCenterName: selectedCostCenter?.center.name || '',
      ssoEnabled: addUserForm.ssoEnabled,
      isActive: normalizeStatus(addUserForm.status) === 'active',
    }

    setUsers((current) => upsertUser(current, localUser))
    closeAddUserModal()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Users</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Manage users, roles, and access across the tenant.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="hidden items-center gap-2 rounded-2xl border border-cyan-100 bg-white p-2 pr-4 text-sm font-semibold text-slate-500 shadow-sm md:flex">
            <span className="rounded-xl bg-slate-950 p-2 text-cyan-400">
              <Sparkles className="h-4 w-4" />
            </span>
            Tenant access control
          </div>
          <button
            onClick={openAddUserModal}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-cyan-900/10 hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">Add User</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Add a user record with tenant role and access status.
                </p>
              </div>
              <button
                onClick={closeAddUserModal}
                className="rounded-xl p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close add user modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-bold text-slate-800">Name</label>
                <input
                  value={addUserForm.name}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-bold text-slate-800">Email</label>
                <input
                  type="email"
                  value={addUserForm.email}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="jane.doe@company.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Business Unit
                </label>
                <select
                  value={addUserForm.businessUnit}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      businessUnit: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  disabled={businessUnitsLoading}
                >
                  <option value="">Select business unit</option>
                  {businessUnitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {businessUnitsLoading && (
                  <p className="mt-1 text-xs text-gray-500">
                    Loading business units...
                  </p>
                )}
                {businessUnitsError && (
                  <p className="mt-1 text-xs text-rose-600">
                    {businessUnitsError}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Cost Center</label>
                <select
                  value={addUserForm.costCenter}
                  onChange={(event) =>
                    setAddUserForm((current) => ({
                      ...current,
                      costCenter: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  disabled={costCentersLoading}
                >
                  <option value="">Select cost center</option>
                  {costCenterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {costCentersLoading && (
                  <p className="mt-1 text-xs text-gray-500">
                    Loading cost centers...
                  </p>
                )}
                {costCentersError && (
                  <p className="mt-1 text-xs text-rose-600">
                    {costCentersError}
                  </p>
                )}
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

      {isAddBusinessUnitModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Add Business Unit
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Create a business unit for this tenant.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddBusinessUnitModal}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close add business unit modal"
                disabled={creatingBusinessUnit}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Code
                </label>
                <input
                  value={addBusinessUnitForm.code}
                  onChange={(event) =>
                    setAddBusinessUnitForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="FIN"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Name
                </label>
                <input
                  value={addBusinessUnitForm.name}
                  onChange={(event) =>
                    setAddBusinessUnitForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Finance"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Parent Business Unit
                </label>
                <select
                  value={addBusinessUnitForm.parent}
                  onChange={(event) =>
                    setAddBusinessUnitForm((current) => ({
                      ...current,
                      parent: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {businessUnits
                    .filter((unit) => unit.code)
                    .map((unit) => (
                      <option key={String(unit.id)} value={unit.code}>
                        {unit.name} ({unit.code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Status
                </label>
                <select
                  value={addBusinessUnitForm.status}
                  onChange={(event) =>
                    setAddBusinessUnitForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {BUSINESS_UNIT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Description
                </label>
                <textarea
                  value={addBusinessUnitForm.description}
                  onChange={(event) =>
                    setAddBusinessUnitForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Finance business unit"
                  rows={3}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Legal Entity ID
                </label>
                <input
                  value={addBusinessUnitForm.legalEntityId}
                  onChange={(event) =>
                    setAddBusinessUnitForm((current) => ({
                      ...current,
                      legalEntityId: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="LE-001"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  GL Account ID
                </label>
                <input
                  value={addBusinessUnitForm.glAccountId}
                  onChange={(event) =>
                    setAddBusinessUnitForm((current) => ({
                      ...current,
                      glAccountId: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="GL-1000"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Company ID
                </label>
                <input
                  value={addBusinessUnitForm.company}
                  onChange={(event) =>
                    setAddBusinessUnitForm((current) => ({
                      ...current,
                      company: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="2"
                />
              </div>

              {addBusinessUnitError && (
                <p className="md:col-span-2 text-sm text-rose-600">
                  {addBusinessUnitError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeAddBusinessUnitModal}
                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={creatingBusinessUnit}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAddBusinessUnit()}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  creatingBusinessUnit
                    ? 'cursor-not-allowed bg-gray-400'
                    : 'bg-black hover:bg-gray-900'
                }`}
                disabled={creatingBusinessUnit}
              >
                {creatingBusinessUnit
                  ? 'Creating...'
                  : 'Create Business Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="group relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-500" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search users"
              className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={businessUnitFilter}
            onChange={(event) => setBusinessUnitFilter(event.target.value)}
            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            disabled={businessUnitsLoading}
          >
            <option value="">All business units</option>
            {businessUnitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            value={costCenterFilter}
            onChange={(event) => setCostCenterFilter(event.target.value)}
            placeholder="Cost center ID"
            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={clearFilters}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-cyan-200 hover:bg-cyan-50"
          >
            Clear filters
          </button>
        </div>

        {businessUnitsLoading && (
          <p className="mt-3 text-xs text-gray-500">
            Loading business units...
          </p>
        )}

        {businessUnitsError && (
          <p className="mt-3 text-xs text-rose-600">
            {businessUnitsError}
          </p>
        )}
      </div>

      {forbidden && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          You do not have permission to view tenant users. Admin access is required.
        </div>
      )}

      {!forbidden && error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Name</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Email</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Role</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Business Unit</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Cost Center</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">SSO Enabled</th>
              <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-8 py-16 text-center text-sm font-medium text-slate-500">
                  Loading users...
                </td>
              </tr>
            )}

            {!loading && !forbidden && usersForTable.length === 0 && (
              <tr>
                <td colSpan={8} className="px-8 py-16 text-center text-sm font-medium text-slate-500">
                  No users found.
                </td>
              </tr>
            )}

            {!loading &&
              !forbidden &&
              usersForTable.map((user) => (
                <tr
                  key={`${user.membershipId || user.userId || user.email}-${user.name}`}
                  className="group transition-all hover:bg-cyan-50/40"
                >
                  <td className="px-8 py-6 font-bold text-slate-900">{user.name}</td>
                  <td className="px-8 py-6 text-slate-700">{user.email || '—'}</td>
                  <td className="px-8 py-6">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(user.status)}`}
                    >
                      {toTitleCase(user.status)}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {toTitleCase(user.role)}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-slate-700">
                    {user.businessUnit || user.businessUnitId || '—'}
                  </td>
                  <td className="px-8 py-6 text-slate-700">{toCostCenterDisplay(user)}</td>
                  <td className="px-8 py-6">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                        user.ssoEnabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {user.ssoEnabled ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button
                      disabled
                      className="cursor-not-allowed rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-400"
                    >
                      Details pending
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
      </div>
      </div>
    </div>
  )
}
