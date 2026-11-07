'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ElementType,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseUser } from '@/lib/intelligence'
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
import {
  UsersApiError,
  createAdminUser,
  getAdminUsers,
  resendAdminUserInvitation,
  revokeAdminUserInvitation,
  updateAdminUser,
  type AdminUserRecord,
} from '@/lib/api/users'
import RequiredIndicator from '@/components/ui/RequiredIndicator'
import {
  ACCESS_ROLES,
  getAccessRole,
  isInternalAccessUser,
  normalizeAccessRole,
} from '@/lib/accessControlRoles'
import { isFeatureEnabled } from '@/lib/featureFlags'
import {
  LevvNotice,
  LevvPage,
  LevvPageHeader,
  LevvPanel,
  LevvSearchField,
  LevvSelect,
  LevvStatusBadge,
  LevvToolbar,
  levvUi,
  type LevvTone,
} from '@/components/ui/levv-app'

type UserRow = AdminUserRecord

type AddUserFormState = {
  name: string
  email: string
  businessUnit: string
  costCenter: string
  ssoEnabled: boolean
  role: string
  status: string
}

type EditUserFormState = AddUserFormState

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

const ROLE_OPTIONS = ACCESS_ROLES.map(({ value, label }) => ({ value, label }))

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
  return normalizeAccessRole(value)
}

function toCostCenterDisplay(row: UserRow): string {
  if (row.costCenter && row.costCenterName) {
    return `${row.costCenter} (${row.costCenterName})`
  }
  return row.costCenter || row.costCenterName || '—'
}

/** Invited reads blue (in progress); a failed delivery needs attention, a revoked one is closed. */
function statusTone(row: UserRow): LevvTone {
  switch (row.status) {
    case 'active':
      return 'emerald'
    case 'invited':
      if (row.invitationStatus === 'revoked') return 'slate'
      return row.invitationDeliveryStatus === 'failed' ? 'amber' : 'blue'
    default:
      return 'slate'
  }
}

/* =========================
   Local recipes
   Row actions are quiet until hovered; textareas and notes share the input and notice vocabulary.
========================= */
const ROW_ACTION =
  'levv-press inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0'

const rowAction = (tone: 'default' | 'danger' = 'default') =>
  `${ROW_ACTION} ${
    tone === 'danger'
      ? 'hover:bg-rose-50 hover:text-rose-700'
      : 'hover:bg-slate-100 hover:text-slate-950'
  }`

const TEXTAREA =
  'block w-full rounded-lg border border-[var(--line-strong)] bg-white px-3 py-2 text-[13px] leading-5 text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-400/60 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus)]'

const FIELD_LABEL = `${levvUi.label} mb-1.5 block`

const CHECKBOX = 'mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-blue-600'

const TD = `${levvUi.td} border-t border-[var(--line)]`

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

function readRowString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
    if (typeof value === 'boolean') return String(value)
  }
  return ''
}

function normalizeAssistantUser(raw: unknown, source: string): UserRow {
  const row =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const email = readRowString(row, ['email', 'Email', 'user_email'])
  const name =
    readRowString(row, ['name', 'Name', 'fullName', 'full_name']) ||
    email ||
    'Pending user'
  const status = normalizeStatus(
    readRowString(row, ['status', 'Status']) || 'invited',
  )
  const role = normalizeRole(readRowString(row, ['role', 'Role']) || 'viewer')
  const businessUnit = readRowString(row, [
    'businessUnit',
    'business_unit',
    'Business Unit',
    'business_unit_name',
  ])
  const costCenter = readRowString(row, [
    'costCenter',
    'cost_center',
    'Cost Center',
    'cost_center_code',
  ])
  const ssoValue = readRowString(row, ['ssoEnabled', 'sso_enabled', 'SSO'])

  return {
    membershipId: `local-${source}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`,
    userId: '',
    name,
    email,
    status,
    role,
    businessUnitId: businessUnit,
    businessUnit,
    costCenterId: costCenter,
    costCenter,
    costCenterName: '',
    ssoEnabled: ssoValue.toLowerCase() === 'true' || ssoValue === '1',
    isActive: status === 'active',
    invitationId: '',
    invitationStatus: '',
    invitationDeliveryStatus: '',
    invitationDeliveryError: '',
    invitationExpiresAt: '',
  }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

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

  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '')
  const [roleFilter, setRoleFilter] = useState(() => searchParams.get('role') || '')
  const [businessUnitFilter, setBusinessUnitFilter] = useState(
    () => searchParams.get('business_unit_id') || '',
  )
  const [costCenterFilter, setCostCenterFilter] = useState(
    () => searchParams.get('cost_center_id') || '',
  )
  const [assistantPrompt, setAssistantPrompt] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [addUserStep, setAddUserStep] = useState<1 | 2 | 3>(1)
  const [addUserError, setAddUserError] = useState('')
  const [addingUser, setAddingUser] = useState(false)
  const [invitationNotice, setInvitationNotice] = useState('')
  const [invitationActionError, setInvitationActionError] = useState('')
  const [invitationActionId, setInvitationActionId] = useState('')
  const [addUserForm, setAddUserForm] = useState<AddUserFormState>({
    name: '',
    email: '',
    businessUnit: '',
    costCenter: '',
    ssoEnabled: false,
    role: 'viewer',
    status: 'invited',
  })
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [editUserForm, setEditUserForm] = useState<EditUserFormState>({
    name: '',
    email: '',
    businessUnit: '',
    costCenter: '',
    ssoEnabled: false,
    role: 'viewer',
    status: 'invited',
  })
  const [editUserError, setEditUserError] = useState('')
  const [savingUser, setSavingUser] = useState(false)
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

  useEffect(() => {
    const query = new URLSearchParams(searchParams.toString())
    const values = {
      search,
      status: statusFilter,
      role: roleFilter,
      business_unit_id: businessUnitFilter,
      cost_center_id: costCenterFilter,
    }
    Object.entries(values).forEach(([key, value]) => {
      if (value.trim()) query.set(key, value.trim())
      else query.delete(key)
    })
    const next = query.toString()
    if (next !== searchParams.toString()) {
      router.replace(next ? `/admin/users?${next}` : '/admin/users', { scroll: false })
    }
  }, [
    businessUnitFilter,
    costCenterFilter,
    roleFilter,
    router,
    search,
    searchParams,
    statusFilter,
  ])

  const currentListHref = useMemo(() => {
    const query = new URLSearchParams(searchParams.toString())
    const values = {
      search,
      status: statusFilter,
      role: roleFilter,
      business_unit_id: businessUnitFilter,
      cost_center_id: costCenterFilter,
    }
    Object.entries(values).forEach(([key, value]) => {
      if (value.trim()) query.set(key, value.trim())
      else query.delete(key)
    })
    const suffix = query.toString()
    return suffix ? `/admin/users?${suffix}` : '/admin/users'
  }, [
    businessUnitFilter,
    costCenterFilter,
    roleFilter,
    search,
    searchParams,
    statusFilter,
  ])

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
        const businessUnitFilterValue = businessUnitFilter.trim()
        const costCenterFilterValue = costCenterFilter.trim()
        const rows = await getAdminUsers(
          {
            search,
            status: statusFilter,
            role: roleFilter,
            business_unit_id:
              businessUnitFilterValue && /^\d+$/.test(businessUnitFilterValue)
                ? businessUnitFilterValue
                : undefined,
            cost_center_id: costCenterFilterValue || undefined,
          },
          controller.signal,
        )

        setUsers(rows)
        setForbidden(false)
      } catch (requestError) {
        if ((requestError as { name?: string })?.name === 'AbortError') return
        if (requestError instanceof UsersApiError && requestError.status === 401) {
          router.replace('/auth/login?next=/admin/users')
          return
        }
        if (requestError instanceof UsersApiError && requestError.status === 403) {
          setForbidden(true)
          setUsers([])
          return
        }
        if (requestError instanceof UsersApiError && requestError.status === 400) {
          setForbidden(false)
          setUsers([])
          setError('Tenant context is required to view users.')
          return
        }
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

  const allCostCenterOptions = useMemo(
    () =>
      costCenters
        .map((center) => ({
          value: String(center.id),
          label: center.code
            ? `${center.name} (${center.code})`
            : center.name,
          center,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [costCenters],
  )

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
    setAddUserStep(1)
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
    if (addingUser) return
    setIsAddUserModalOpen(false)
    setAddUserError('')
  }

  const validateInvitationIdentity = () => {
    const name = addUserForm.name.trim()
    const email = addUserForm.email.trim()
    if (!name) return 'Name is required.'
    if (!email) return 'Email is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Enter a valid email address.'
    }
    return ''
  }

  const goToInvitationStep = (step: 1 | 2 | 3) => {
    if (step > 1) {
      const identityError = validateInvitationIdentity()
      if (identityError) {
        setAddUserError(identityError)
        setAddUserStep(1)
        return
      }
    }
    setAddUserError('')
    setAddUserStep(step)
  }

  const openEditUserModal = (user: UserRow) => {
    const businessUnit = businessUnitOptions.find(
      (option) =>
        String(option.unit.id) === user.businessUnitId ||
        option.unit.code === user.businessUnitId ||
        option.unit.name === user.businessUnit,
    )
    const costCenter = allCostCenterOptions.find(
      (option) =>
        String(option.center.id) === user.costCenterId ||
        option.center.code === user.costCenter,
    )
    setEditUserError('')
    setEditingUser(user)
    setEditUserForm({
      name: user.name,
      email: user.email,
      businessUnit: businessUnit?.value || '',
      costCenter: costCenter?.value || '',
      ssoEnabled: user.ssoEnabled,
      role: normalizeRole(user.role),
      status: normalizeStatus(user.status),
    })
  }

  const closeEditUserModal = () => {
    if (savingUser) return
    setEditingUser(null)
    setEditUserError('')
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

  const submitAddUser = async () => {
    const name = addUserForm.name.trim()
    const email = addUserForm.email.trim()

    const identityError = validateInvitationIdentity()
    if (identityError) {
      setAddUserError(identityError)
      setAddUserStep(1)
      return
    }

    const selectedBusinessUnit = businessUnitOptions.find(
      (option) => option.value === addUserForm.businessUnit,
    )
    const selectedCostCenter = costCenterOptions.find(
      (option) => option.value === addUserForm.costCenter,
    )

    const pendingUser: UserRow = {
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
      invitationId: '',
      invitationStatus: '',
      invitationDeliveryStatus: '',
      invitationDeliveryError: '',
      invitationExpiresAt: '',
    }

    setAddingUser(true)
    setAddUserError('')

    try {
      const created = await createAdminUser({
        name,
        email,
        role: pendingUser.role,
        status: 'invited',
        business_unit_id: selectedBusinessUnit?.unit.id || null,
        cost_center_id: selectedCostCenter?.center.id || null,
        sso_enabled: pendingUser.ssoEnabled,
        is_active: pendingUser.status === 'active',
      })

      setUsers((current) => upsertUser(current, created || pendingUser))
      setIsAddUserModalOpen(false)
      if (created?.invitationDeliveryStatus === 'failed') {
        setInvitationNotice(
          `Invitation created for ${email}, but delivery failed. Use Retry invite in the user row.`,
        )
      } else {
        setInvitationNotice(`Invitation sent to ${email}.`)
      }
    } catch (requestError) {
      if (requestError instanceof UsersApiError && requestError.status === 401) {
        router.replace('/auth/login?next=/admin/users')
        return
      }
      setAddUserError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to add user.',
      )
    } finally {
      setAddingUser(false)
    }
  }

  const updateInvitationState = (
    user: UserRow,
    invitation: {
      id: string
      status: string
      deliveryStatus: string
      deliveryError: string
      expiresAt: string
    },
  ) => {
    setUsers((current) =>
      current.map((row) =>
        row.membershipId === user.membershipId
          ? {
              ...row,
              invitationId: invitation.id || row.invitationId,
              invitationStatus: invitation.status,
              invitationDeliveryStatus: invitation.deliveryStatus,
              invitationDeliveryError: invitation.deliveryError,
              invitationExpiresAt: invitation.expiresAt,
            }
          : row,
      ),
    )
  }

  const handleInvitationAction = async (
    user: UserRow,
    action: 'resend' | 'revoke',
  ) => {
    if (!user.invitationId) return
    setInvitationActionId(user.invitationId)
    setInvitationActionError('')
    setInvitationNotice('')
    try {
      const invitation =
        action === 'resend'
          ? await resendAdminUserInvitation(user.invitationId)
          : await revokeAdminUserInvitation(user.invitationId)
      updateInvitationState(user, invitation)
      if (action === 'resend' && invitation.deliveryStatus === 'failed') {
        setInvitationActionError(
          invitation.deliveryError || 'The invitation was renewed but email delivery failed.',
        )
      } else {
        setInvitationNotice(
          action === 'resend'
            ? `A new invitation was sent to ${user.email}; the previous link is invalid.`
            : `Invitation for ${user.email} was revoked.`,
        )
      }
    } catch (requestError) {
      if (requestError instanceof UsersApiError && requestError.status === 401) {
        router.replace('/auth/login?next=/admin/users')
        return
      }
      setInvitationActionError(
        requestError instanceof Error
          ? requestError.message
          : `Unable to ${action} invitation.`,
      )
    } finally {
      setInvitationActionId('')
    }
  }

  const submitEditUser = async () => {
    if (!editingUser) return

    const name = editUserForm.name.trim()
    const email = editUserForm.email.trim()
    if (!name || !email) {
      setEditUserError('Name and email are required.')
      return
    }

    const selectedBusinessUnit = businessUnitOptions.find(
      (option) => option.value === editUserForm.businessUnit,
    )
    const selectedCostCenter = allCostCenterOptions.find(
      (option) => option.value === editUserForm.costCenter,
    )
    const updatedUser: UserRow = {
      ...editingUser,
      name,
      email,
      role: normalizeRole(editUserForm.role),
      status: normalizeStatus(editUserForm.status),
      businessUnitId:
        selectedBusinessUnit?.unit.code || editUserForm.businessUnit,
      businessUnit:
        selectedBusinessUnit?.unit.name || editingUser.businessUnit,
      costCenterId: selectedCostCenter
        ? String(selectedCostCenter.center.id)
        : editUserForm.costCenter,
      costCenter: selectedCostCenter?.center.code || editingUser.costCenter,
      costCenterName:
        selectedCostCenter?.center.name || editingUser.costCenterName,
      ssoEnabled: editUserForm.ssoEnabled,
      isActive: editUserForm.status === 'active',
    }

    if (editingUser.membershipId.startsWith('local-')) {
      setUsers((current) => upsertUser(current, updatedUser))
      closeEditUserModal()
      return
    }

    const recordId = editingUser.membershipId || editingUser.userId
    if (!recordId) {
      setEditUserError('This user does not have an editable membership ID.')
      return
    }

    setSavingUser(true)
    setEditUserError('')

    try {
      const saved = await updateAdminUser(recordId, {
        name,
        email,
        role: updatedUser.role,
        status: updatedUser.status,
        business_unit_id: selectedBusinessUnit?.unit.id || null,
        cost_center_id: selectedCostCenter?.center.id || null,
        sso_enabled: updatedUser.ssoEnabled,
        is_active: updatedUser.isActive,
      })

      setUsers((current) => upsertUser(current, saved || updatedUser))
      setEditingUser(null)
    } catch (requestError) {
      if (requestError instanceof UsersApiError && requestError.status === 401) {
        router.replace('/auth/login?next=/admin/users')
        return
      }
      setEditUserError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update user.',
      )
    } finally {
      setSavingUser(false)
    }
  }

  const handleAssistantGenerate = async () => {
    if (!assistantPrompt.trim()) return

    setAssistantLoading(true)
    setAssistantError('')

    try {
      const result = await parseUser(assistantPrompt)
      if (result?.error) {
        throw new Error(String(result.error))
      }

      if (
        !isInternalAccessUser(
          (result as { role?: unknown })?.role,
          (result as { user_type?: unknown })?.user_type,
        )
      ) {
        throw new Error(
          'Suppliers and workers are managed in their dedicated directories, not Users.',
        )
      }

      setUsers((current) =>
        upsertUser(current, normalizeAssistantUser(result, 'nova')),
      )
      setAssistantPrompt('')
    } catch (requestError) {
      setAssistantError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to parse the user update.',
      )
    } finally {
      setAssistantLoading(false)
    }
  }

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError('')

    const reader = new FileReader()
    reader.onload = async (readerEvent) => {
      try {
        const data = readerEvent.target?.result
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

        setUsers((current) =>
          rows
            .filter((row) =>
              isInternalAccessUser(
                row.role || row.Role,
                row.user_type || row.account_type || row.Type,
              ),
            )
            .reduce(
            (acc, row) => upsertUser(acc, normalizeAssistantUser(row, 'upload')),
            current,
          ),
        )

        if (fileInputRef.current) fileInputRef.current.value = ''
      } catch (parseError) {
        setUploadError(
          parseError instanceof Error
            ? parseError.message
            : 'Unable to read the uploaded user file.',
        )
      }
    }

    reader.onerror = () => {
      setUploadError('Unable to read the uploaded user file.')
    }

    reader.readAsArrayBuffer(file)
  }

  const selectedBusinessUnitLabel =
    businessUnitOptions.find((option) => option.value === addUserForm.businessUnit)?.label
  const selectedCostCenterLabel =
    costCenterOptions.find((option) => option.value === addUserForm.costCenter)?.label

  return (
    <LevvPage width="wide" className="p-0 sm:p-0 lg:p-0">
      <div className="space-y-6">
        <LevvPageHeader
          title="Users"
          description="Manage users, roles, and access across the tenant."
          actions={
            <>
              <span className="mr-2 hidden items-center gap-1.5 text-[13px] text-slate-500 md:inline-flex">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                Tenant access control
              </span>
              <button
                type="button"
                onClick={openAddUserModal}
                className={levvUi.primaryButton}
              >
                <Plus className="h-4 w-4" />
                Invite User
              </button>
            </>
          }
        />

        <LevvPanel className="grid divide-y divide-[var(--line)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:divide-x lg:divide-y-0">
          <div className="flex min-w-0 flex-col px-5 py-4">
            <h2 className="text-[15px] font-semibold text-slate-950">
              AI Assistant
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Describe a user update and Nova will stage it in the table.
            </p>
            <div className="relative mt-3 flex flex-1 flex-col">
              <span
                aria-hidden
                className="pointer-events-none absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--rail)] text-[var(--nova)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <textarea
                value={assistantPrompt}
                onChange={(event) => setAssistantPrompt(event.target.value)}
                className={`${TEXTAREA} flex-1 resize-none pl-11 sm:pr-32`}
                rows={2}
                placeholder="Make Amy Schneider inactive and move her to Procurement"
              />
              <button
                type="button"
                onClick={() => void handleAssistantGenerate()}
                disabled={assistantLoading || !assistantPrompt.trim()}
                className="levv-press mt-2 inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:absolute sm:bottom-1.5 sm:right-1.5 sm:mt-0"
              >
                {assistantLoading ? 'Generating...' : 'Update via AI'}
              </button>
            </div>
            {assistantError ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                {assistantError}
              </p>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col px-5 py-4">
            <h2 className="text-[15px] font-semibold text-slate-950">
              Mass User Upload
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Upload an .xlsx, .xls, or .csv file with columns like name, email,
              role, status, businessUnit, costCenter, and ssoEnabled.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div className="mt-auto pt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={levvUi.secondaryButton}
              >
                <Upload className="h-4 w-4" />
                Select Excel File
              </button>
            </div>
            {uploadError ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700">
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                {uploadError}
              </p>
            ) : null}
          </div>
        </LevvPanel>

        {!forbidden && invitationNotice ? (
          <LevvNotice tone="emerald" icon={CheckCircle2}>
            {invitationNotice}
          </LevvNotice>
        ) : null}

        {!forbidden && invitationActionError ? (
          <LevvNotice tone="rose" icon={AlertCircle}>
            {invitationActionError}
          </LevvNotice>
        ) : null}

        <div className="space-y-3">
          <LevvToolbar>
            <LevvSearchField
              type="text"
              className="w-full sm:w-auto sm:min-w-[10rem] sm:flex-1"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search users"
            />

            <LevvSelect
              className="w-full sm:w-32"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </LevvSelect>

            <LevvSelect
              className="w-full sm:w-36"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </LevvSelect>

            <LevvSelect
              className="w-full sm:w-44"
              value={businessUnitFilter}
              onChange={(event) => setBusinessUnitFilter(event.target.value)}
              disabled={businessUnitsLoading}
            >
              <option value="">All business units</option>
              {businessUnitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </LevvSelect>

            <input
              value={costCenterFilter}
              onChange={(event) => setCostCenterFilter(event.target.value)}
              placeholder="Cost center ID"
              className={`${levvUi.input} w-full sm:w-32`}
            />

            <button
              type="button"
              onClick={clearFilters}
              className={levvUi.ghostButton}
            >
              Clear filters
            </button>
          </LevvToolbar>

          {businessUnitsLoading && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 motion-reduce:animate-none" />
              Loading business units...
            </p>
          )}

          {businessUnitsError && (
            <p className="flex items-start gap-1.5 text-xs text-rose-700">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              {businessUnitsError}
            </p>
          )}

          <div className={levvUi.tableShell}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className={levvUi.th}>Name</th>
                    <th className={levvUi.th}>Email</th>
                    <th className={levvUi.th}>Status</th>
                    <th className={levvUi.th}>Role</th>
                    <th className={levvUi.th}>Business Unit</th>
                    <th className={levvUi.th}>Cost Center</th>
                    <th className={levvUi.th}>SSO</th>
                    <th className={`${levvUi.th} sticky right-0 bg-[var(--surface-sunken)] text-right shadow-[inset_1px_0_0_var(--line)]`}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {!loading &&
                    !forbidden &&
                    usersForTable.map((user) => (
                      <tr
                        key={`${user.membershipId || user.userId || user.email}-${user.name}`}
                        className="group"
                      >
                        <td className={TD}>
                          <span className="whitespace-nowrap font-medium text-slate-950">
                          {isFeatureEnabled('user_detail_v2') && user.membershipId ? (
                            <Link
                              href={`/admin/users/${encodeURIComponent(user.membershipId)}?return_to=${encodeURIComponent(currentListHref)}`}
                              className="rounded-sm outline-none transition-colors duration-150 hover:text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                            >
                              {user.name}
                            </Link>
                          ) : (
                            user.name
                          )}
                          </span>
                        </td>
                        <td className={TD}>
                          {user.email || '—'}
                        </td>
                        <td className={TD}>
                          <LevvStatusBadge tone={statusTone(user)}>
                            {toTitleCase(user.status)}
                          </LevvStatusBadge>
                        </td>
                        <td className={TD}>
                          {getAccessRole(user.role).label}
                        </td>
                        <td className={TD}>
                          {user.businessUnit || user.businessUnitId || '—'}
                        </td>
                        <td className={`${TD} tabular-nums`}>
                          {toCostCenterDisplay(user)}
                        </td>
                        <td className={TD}>
                          <span className={user.ssoEnabled ? 'text-slate-900' : 'text-slate-400'}>
                            {user.ssoEnabled ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className={`${TD} sticky right-0 bg-white text-right shadow-[inset_1px_0_0_var(--line)] transition-colors duration-150 group-hover:bg-[var(--surface-sunken)]`}>
                          <div className="-my-1.5 flex justify-end gap-1">
                            {user.status === 'invited' && user.invitationId ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleInvitationAction(user, 'resend')}
                                  disabled={invitationActionId === user.invitationId}
                                  className={rowAction()}
                                  title={user.invitationDeliveryError || 'Invalidate the old link and send a new invitation'}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  {user.invitationDeliveryStatus === 'failed' ? 'Retry invite' : 'Resend'}
                                </button>
                                {user.invitationStatus !== 'revoked' ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleInvitationAction(user, 'revoke')}
                                    disabled={invitationActionId === user.invitationId}
                                    className={rowAction('danger')}
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                    Revoke
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                            {user.status !== 'invited' || !user.invitationId ? (
                              <button
                                type="button"
                                onClick={() => openEditUserModal(user)}
                                className={rowAction()}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit access
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {loading ? (
              <TableState icon={Loader2} spin>
                Loading users...
              </TableState>
            ) : forbidden ? (
              <TableState icon={Lock}>
                You do not have permission to view tenant users. Admin access is required.
              </TableState>
            ) : error ? (
              <TableState icon={AlertCircle} tone="rose" alert>
                {error}
              </TableState>
            ) : usersForTable.length === 0 ? (
              <TableState icon={Users}>No users found.</TableState>
            ) : null}
          </div>
        </div>
      </div>

      {isAddUserModalOpen && (
        <UsersDialog
          titleId="invite-user-title"
          title="Invite user"
          description="Configure the membership before sending a single-use invitation."
          closeLabel="Close invite user modal"
          onClose={closeAddUserModal}
          closeDisabled={addingUser}
          nav={
            <ol
              className="flex items-center gap-2 border-b border-[var(--line)] px-6 py-3"
              aria-label="Invitation steps"
            >
              {(['Identity', 'Access', 'Review'] as const).map((label, index) => {
                const step = (index + 1) as 1 | 2 | 3
                const active = addUserStep === step
                const done = addUserStep > step
                return (
                  <li
                    key={label}
                    className={`flex min-w-0 items-center gap-2 ${index < 2 ? 'flex-1' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => goToInvitationStep(step)}
                      aria-current={active ? 'step' : undefined}
                      className={`levv-press flex shrink-0 items-center gap-2 rounded-md py-1 pl-1 pr-2 text-[13px] outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                        active
                          ? 'font-semibold text-slate-950'
                          : done
                            ? 'font-medium text-slate-700'
                            : 'text-slate-500'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-200 ${
                          done
                            ? 'bg-blue-600 text-white'
                            : active
                              ? 'bg-slate-900 text-white'
                              : 'border border-[var(--line-strong)] bg-white text-slate-500'
                        }`}
                      >
                        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : step}
                      </span>
                      {label}
                    </button>
                    {index < 2 ? (
                      <span
                        aria-hidden
                        className={`h-px min-w-3 flex-1 transition-colors duration-200 ${done ? 'bg-blue-600' : 'bg-[var(--line)]'}`}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ol>
          }
          footer={
            <>
              <button
                type="button"
                onClick={closeAddUserModal}
                disabled={addingUser}
                className={levvUi.ghostButton}
              >
                Cancel
              </button>
              {addUserStep > 1 ? (
                <button
                  type="button"
                  onClick={() => goToInvitationStep((addUserStep - 1) as 1 | 2)}
                  disabled={addingUser}
                  className={levvUi.secondaryButton}
                >
                  Back
                </button>
              ) : null}
              {addUserStep < 3 ? (
                <button
                  type="button"
                  onClick={() => goToInvitationStep((addUserStep + 1) as 2 | 3)}
                  className={levvUi.primaryButton}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void submitAddUser()}
                  disabled={addingUser}
                  className={levvUi.primaryButton}
                >
                  {addingUser ? 'Sending invitation...' : 'Send invitation'}
                </button>
              )}
            </>
          }
        >
          {addUserStep === 1 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={FIELD_LABEL}>
                  Name <RequiredIndicator />
                </label>
                <input
                  value={addUserForm.name}
                  onChange={(event) => setAddUserForm((current) => ({ ...current, name: event.target.value }))}
                  className={levvUi.input}
                  placeholder="Jane Doe"
                  autoFocus
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>
                  Email <RequiredIndicator />
                </label>
                <input
                  type="email"
                  value={addUserForm.email}
                  onChange={(event) => setAddUserForm((current) => ({ ...current, email: event.target.value }))}
                  className={levvUi.input}
                  placeholder="jane.doe@company.com"
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3 border-t border-[var(--line)] pt-4 md:col-span-2">
                <input
                  type="checkbox"
                  checked={addUserForm.ssoEnabled}
                  onChange={(event) => setAddUserForm((current) => ({ ...current, ssoEnabled: event.target.checked }))}
                  className={CHECKBOX}
                />
                <span>
                  <span className="block text-[13px] font-medium text-slate-900">Use SSO</span>
                  <span className="mt-0.5 block text-xs text-slate-500">The invitee will accept the membership and continue through the tenant SSO provider.</span>
                </span>
              </label>
            </div>
          ) : null}

          {addUserStep === 2 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={FIELD_LABEL}>Access role</label>
                <LevvSelect
                  value={addUserForm.role}
                  onChange={(event) => setAddUserForm((current) => ({ ...current, role: event.target.value }))}
                >
                  {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </LevvSelect>
                <p className="mt-1.5 text-xs text-slate-500">{getAccessRole(addUserForm.role).description}</p>
              </div>
              <div>
                <label className={FIELD_LABEL}>Business-unit default</label>
                <LevvSelect
                  value={addUserForm.businessUnit}
                  onChange={(event) => setAddUserForm((current) => ({ ...current, businessUnit: event.target.value, costCenter: '' }))}
                  disabled={businessUnitsLoading}
                >
                  <option value="">No business-unit default</option>
                  {businessUnitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </LevvSelect>
              </div>
              <div>
                <label className={FIELD_LABEL}>Cost-center default</label>
                <LevvSelect
                  value={addUserForm.costCenter}
                  onChange={(event) => setAddUserForm((current) => ({ ...current, costCenter: event.target.value }))}
                  disabled={costCentersLoading}
                >
                  <option value="">No cost-center default</option>
                  {costCenterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </LevvSelect>
              </div>
              <FormNote className="md:col-span-2">
                Organization defaults prefill work; they do not grant record access. The selected role is the reviewed tenant access preset.
              </FormNote>
              {(businessUnitsError || costCentersError) ? (
                <FormError className="md:col-span-2">{businessUnitsError || costCentersError}</FormError>
              ) : null}
            </div>
          ) : null}

          {addUserStep === 3 ? (
            <div className="space-y-4">
              <div className="-mt-2 divide-y divide-[var(--line)] border-b border-[var(--line)] text-[13px]">
                <ReviewRow label="Identity">
                  <p className="font-medium text-slate-900">{addUserForm.name.trim()}</p>
                  <p className="text-slate-500">{addUserForm.email.trim()}</p>
                </ReviewRow>
                <ReviewRow label="Authentication">
                  <p className="font-medium text-slate-900">{addUserForm.ssoEnabled ? 'Single sign-on' : 'Password'}</p>
                  <p className="text-slate-500">Single-use, expiring invitation</p>
                </ReviewRow>
                <ReviewRow label="Access">
                  <p className="font-medium text-slate-900">{getAccessRole(addUserForm.role).label}</p>
                  <p className="text-slate-500">Membership remains inactive until acceptance.</p>
                </ReviewRow>
                <ReviewRow label="Working defaults">
                  <p className="font-medium text-slate-900">{selectedBusinessUnitLabel || 'No business unit'}</p>
                  <p className="text-slate-500">{selectedCostCenterLabel || 'No cost center'}</p>
                </ReviewRow>
              </div>
              <FormNote>
                Sending creates exactly this invited membership. Resending will invalidate its previous link; acceptance cannot replace the reviewed role or defaults.
              </FormNote>
            </div>
          ) : null}

          {addUserError ? <FormError className="mt-4">{addUserError}</FormError> : null}
        </UsersDialog>
      )}

      {editingUser && (
        <UsersDialog
          titleId="edit-user-title"
          title="Edit user access"
          description="Update the user record and assign a preconfigured access role."
          closeLabel="Close edit user modal"
          onClose={closeEditUserModal}
          closeDisabled={savingUser}
          footer={
            <>
              <button
                type="button"
                onClick={closeEditUserModal}
                disabled={savingUser}
                className={levvUi.ghostButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitEditUser()}
                disabled={savingUser}
                className={levvUi.primaryButton}
              >
                {savingUser ? 'Saving...' : 'Save changes'}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={FIELD_LABEL}>
                Name <RequiredIndicator />
              </label>
              <input
                value={editUserForm.name}
                onChange={(event) =>
                  setEditUserForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className={levvUi.input}
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>
                Email <RequiredIndicator />
              </label>
              <input
                type="email"
                value={editUserForm.email}
                onChange={(event) =>
                  setEditUserForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className={levvUi.input}
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>Access role</label>
              <LevvSelect
                value={editUserForm.role}
                onChange={(event) =>
                  setEditUserForm((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </LevvSelect>
            </div>

            <div>
              <label className={FIELD_LABEL}>Status</label>
              <LevvSelect
                value={editUserForm.status}
                onChange={(event) =>
                  setEditUserForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </LevvSelect>
            </div>

            <div>
              <label className={FIELD_LABEL}>Business unit</label>
              <LevvSelect
                value={editUserForm.businessUnit}
                onChange={(event) =>
                  setEditUserForm((current) => ({
                    ...current,
                    businessUnit: event.target.value,
                  }))
                }
              >
                <option value="">No business unit</option>
                {businessUnitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </LevvSelect>
            </div>

            <div>
              <label className={FIELD_LABEL}>Cost center</label>
              <LevvSelect
                value={editUserForm.costCenter}
                onChange={(event) =>
                  setEditUserForm((current) => ({
                    ...current,
                    costCenter: event.target.value,
                  }))
                }
              >
                <option value="">No cost center</option>
                {allCostCenterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </LevvSelect>
            </div>

            <div className="rounded-lg bg-[var(--surface-sunken)] px-4 py-3.5 md:col-span-2">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">
                    {getAccessRole(editUserForm.role).label} permissions
                  </p>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    {getAccessRole(editUserForm.role).description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {getAccessRole(editUserForm.role).permissions.map((permission) => (
                      <span
                        key={permission}
                        className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-[var(--line)]"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 md:col-span-2">
              <input
                type="checkbox"
                checked={editUserForm.ssoEnabled}
                onChange={(event) =>
                  setEditUserForm((current) => ({
                    ...current,
                    ssoEnabled: event.target.checked,
                  }))
                }
                className={CHECKBOX}
              />
              <span className="text-[13px] font-medium text-slate-900">SSO enabled</span>
            </label>

            {editUserError ? (
              <FormError className="md:col-span-2">{editUserError}</FormError>
            ) : null}
          </div>
        </UsersDialog>
      )}

      {isAddBusinessUnitModalOpen && (
        <UsersDialog
          titleId="add-business-unit-title"
          title="Add Business Unit"
          description="Create a business unit for this tenant."
          closeLabel="Close add business unit modal"
          onClose={closeAddBusinessUnitModal}
          closeDisabled={creatingBusinessUnit}
          layer="z-[60]"
          footer={
            <>
              <button
                type="button"
                onClick={closeAddBusinessUnitModal}
                className={levvUi.ghostButton}
                disabled={creatingBusinessUnit}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAddBusinessUnit()}
                className={levvUi.primaryButton}
                disabled={creatingBusinessUnit}
              >
                {creatingBusinessUnit
                  ? 'Creating...'
                  : 'Create Business Unit'}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={FIELD_LABEL}>
                Code
                <RequiredIndicator />
              </label>
              <input
                value={addBusinessUnitForm.code}
                onChange={(event) =>
                  setAddBusinessUnitForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                className={levvUi.input}
                placeholder="FIN"
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>
                Name
                <RequiredIndicator />
              </label>
              <input
                value={addBusinessUnitForm.name}
                onChange={(event) =>
                  setAddBusinessUnitForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className={levvUi.input}
                placeholder="Finance"
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>
                Parent Business Unit
              </label>
              <LevvSelect
                value={addBusinessUnitForm.parent}
                onChange={(event) =>
                  setAddBusinessUnitForm((current) => ({
                    ...current,
                    parent: event.target.value,
                  }))
                }
              >
                <option value="">None</option>
                {businessUnits
                  .filter((unit) => unit.code)
                  .map((unit) => (
                    <option key={String(unit.id)} value={unit.code}>
                      {unit.name} ({unit.code})
                    </option>
                  ))}
              </LevvSelect>
            </div>

            <div>
              <label className={FIELD_LABEL}>
                Status
              </label>
              <LevvSelect
                value={addBusinessUnitForm.status}
                onChange={(event) =>
                  setAddBusinessUnitForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                {BUSINESS_UNIT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </LevvSelect>
            </div>

            <div className="md:col-span-2">
              <label className={FIELD_LABEL}>
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
                className={`${TEXTAREA} resize-y`}
                placeholder="Finance business unit"
                rows={3}
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>
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
                className={levvUi.input}
                placeholder="LE-001"
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>
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
                className={levvUi.input}
                placeholder="GL-1000"
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>
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
                className={levvUi.input}
                placeholder="2"
              />
            </div>

            {addBusinessUnitError && (
              <FormError className="md:col-span-2">
                {addBusinessUnitError}
              </FormError>
            )}
          </div>
        </UsersDialog>
      )}
    </LevvPage>
  )
}

/* =========================
   Local pieces
   A modal shell, the table's load / empty / error states, and the small notes inside forms.
========================= */
function UsersDialog({
  titleId,
  title,
  description,
  closeLabel,
  onClose,
  closeDisabled,
  layer = 'z-50',
  nav,
  footer,
  children,
}: {
  titleId: string
  title: ReactNode
  description: ReactNode
  closeLabel: string
  onClose: () => void
  closeDisabled: boolean
  layer?: string
  nav?: ReactNode
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={`fixed inset-0 ${layer} flex items-center justify-center bg-slate-950/30 p-4 animate-in fade-in duration-200 motion-reduce:animate-none`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-pop animate-in fade-in zoom-in-[0.97] duration-200 ease-out motion-reduce:animate-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-950">
              {title}
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={closeLabel}
            className={`${levvUi.ghostButton} -mr-2 -mt-1 w-9 shrink-0 px-0`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {nav}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  )
}

function TableState({
  icon: Icon,
  tone = 'slate',
  spin = false,
  alert = false,
  children,
}: {
  icon: ElementType
  tone?: 'slate' | 'rose'
  spin?: boolean
  alert?: boolean
  children: ReactNode
}) {
  return (
    <div
      role={alert ? 'alert' : undefined}
      className="flex flex-col items-center gap-2.5 border-t border-[var(--line)] px-6 py-14 text-center"
    >
      <Icon
        className={`h-5 w-5 ${tone === 'rose' ? 'text-rose-500' : 'text-slate-400'} ${
          spin ? 'animate-spin motion-reduce:animate-none' : ''
        }`}
      />
      <p className={`max-w-md text-[13px] font-medium ${tone === 'rose' ? 'text-rose-700' : 'text-slate-600'}`}>
        {children}
      </p>
    </div>
  )
}

function ReviewRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <p className="text-xs text-slate-500 sm:pt-0.5">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function FormNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-start gap-2 rounded-lg bg-[var(--surface-sunken)] px-3.5 py-3 text-xs leading-5 text-slate-600 ${className}`}>
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span>{children}</span>
    </p>
  )
}

function FormError({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-[13px] text-rose-700 ${className}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
