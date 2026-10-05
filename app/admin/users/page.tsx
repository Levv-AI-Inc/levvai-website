'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { Ban, Check, FileSpreadsheet, Pencil, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
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
  LevvPage,
  LevvPageHeader,
  LevvPanel,
  levvUi,
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

  return (
    <LevvPage width="wide" className="p-0 sm:p-0 lg:p-0">
      <div className="space-y-6">
      <LevvPageHeader
        title="Users"
        description="Manage users, roles, and access across the tenant."
        actions={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 pr-4 text-sm font-semibold text-slate-500 shadow-sm md:flex">
            <span className="rounded-lg bg-slate-950 p-2 text-blue-400">
              <Sparkles className="h-4 w-4" />
            </span>
            Tenant access control
          </div>
          <button
            onClick={openAddUserModal}
            className={levvUi.primaryButton}
          >
            <Plus className="h-4 w-4" />
            Invite User
          </button>
        </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <LevvPanel className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md bg-[#1f3d38] p-2 text-[#89d3bd]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                AI Assistant
              </h2>
              <p className="text-xs text-slate-500">
                Describe a user update and Nova will stage it in the table.
              </p>
            </div>
          </div>
          <textarea
            value={assistantPrompt}
            onChange={(event) => setAssistantPrompt(event.target.value)}
            className="w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 focus:border-[#89d3bd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#89d3bd]/30"
            rows={3}
            placeholder="Make Amy Schneider inactive and move her to Procurement"
          />
          {assistantError ? (
            <p className="mt-2 text-xs font-medium text-rose-600">
              {assistantError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleAssistantGenerate()}
            disabled={assistantLoading || !assistantPrompt.trim()}
            className="mt-3 rounded-md bg-[#1f3d38] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#244a43] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {assistantLoading ? 'Generating...' : 'Update via AI'}
          </button>
        </LevvPanel>

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center shadow-sm">
          <div className="mb-3 rounded-md bg-slate-50 p-3">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-950">
            Mass User Upload
          </h2>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Select Excel File
          </button>
          {uploadError ? (
            <p className="mt-2 text-xs font-medium text-rose-600">
              {uploadError}
            </p>
          ) : null}
        </div>
      </div>

      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">Invite user</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Configure the membership before sending a single-use invitation.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddUserModal}
                disabled={addingUser}
                className="rounded-xl p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close invite user modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pt-5">
              <ol className="grid grid-cols-3 gap-2" aria-label="Invitation steps">
                {(['Identity', 'Access', 'Review'] as const).map((label, index) => {
                  const step = (index + 1) as 1 | 2 | 3
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        onClick={() => goToInvitationStep(step)}
                        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold ${
                          addUserStep === step
                            ? 'border-blue-300 bg-blue-50 text-blue-800'
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px]">
                          {addUserStep > step ? <Check className="h-3 w-3" /> : step}
                        </span>
                        {label}
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>

            <div className="px-6 py-5">
              {addUserStep === 1 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-800">
                      Name <RequiredIndicator />
                    </label>
                    <input
                      value={addUserForm.name}
                      onChange={(event) => setAddUserForm((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      placeholder="Jane Doe"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-800">
                      Email <RequiredIndicator />
                    </label>
                    <input
                      type="email"
                      value={addUserForm.email}
                      onChange={(event) => setAddUserForm((current) => ({ ...current, email: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      placeholder="jane.doe@company.com"
                    />
                  </div>
                  <label className="md:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span>
                      <span className="block text-sm font-bold text-slate-800">Use SSO</span>
                      <span className="mt-1 block text-xs text-slate-500">The invitee will accept the membership and continue through the tenant SSO provider.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={addUserForm.ssoEnabled}
                      onChange={(event) => setAddUserForm((current) => ({ ...current, ssoEnabled: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                  </label>
                </div>
              ) : null}

              {addUserStep === 2 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-bold text-slate-800">Access role</label>
                    <select
                      value={addUserForm.role}
                      onChange={(event) => setAddUserForm((current) => ({ ...current, role: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <p className="mt-2 text-xs text-slate-500">{getAccessRole(addUserForm.role).description}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-800">Business-unit default</label>
                    <select
                      value={addUserForm.businessUnit}
                      onChange={(event) => setAddUserForm((current) => ({ ...current, businessUnit: event.target.value, costCenter: '' }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      disabled={businessUnitsLoading}
                    >
                      <option value="">No business-unit default</option>
                      {businessUnitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-800">Cost-center default</label>
                    <select
                      value={addUserForm.costCenter}
                      onChange={(event) => setAddUserForm((current) => ({ ...current, costCenter: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      disabled={costCentersLoading}
                    >
                      <option value="">No cost-center default</option>
                      {costCenterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <p className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
                    Organization defaults prefill work; they do not grant record access. The selected role is the reviewed tenant access preset.
                  </p>
                  {(businessUnitsError || costCentersError) ? (
                    <p className="md:col-span-2 text-sm text-rose-600">{businessUnitsError || costCentersError}</p>
                  ) : null}
                </div>
              ) : null}

              {addUserStep === 3 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Identity</p><p className="mt-1 font-bold text-slate-900">{addUserForm.name.trim()}</p><p className="text-slate-600">{addUserForm.email.trim()}</p></div>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Authentication</p><p className="mt-1 font-bold text-slate-900">{addUserForm.ssoEnabled ? 'Single sign-on' : 'Password'}</p><p className="text-slate-600">Single-use, expiring invitation</p></div>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Access</p><p className="mt-1 font-bold text-slate-900">{getAccessRole(addUserForm.role).label}</p><p className="text-slate-600">Membership remains inactive until acceptance.</p></div>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Working defaults</p><p className="mt-1 text-slate-700">{businessUnitOptions.find((option) => option.value === addUserForm.businessUnit)?.label || 'No business unit'}</p><p className="text-slate-600">{costCenterOptions.find((option) => option.value === addUserForm.costCenter)?.label || 'No cost center'}</p></div>
                  </div>
                  <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    Sending creates exactly this invited membership. Resending will invalidate its previous link; acceptance cannot replace the reviewed role or defaults.
                  </p>
                </div>
              ) : null}

              {addUserError ? <p className="mt-4 text-sm font-medium text-rose-600">{addUserError}</p> : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={closeAddUserModal}
                disabled={addingUser}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                {addUserStep > 1 ? <button type="button" onClick={() => goToInvitationStep((addUserStep - 1) as 1 | 2)} disabled={addingUser} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Back</button> : null}
                {addUserStep < 3 ? (
                  <button type="button" onClick={() => goToInvitationStep((addUserStep + 1) as 2 | 3)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Continue</button>
                ) : (
                  <button type="button" onClick={() => void submitAddUser()} disabled={addingUser} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400">
                    {addingUser ? 'Sending invitation...' : 'Send invitation'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-black text-slate-900">Edit user access</h2>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Update the user record and assign a preconfigured access role.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditUserModal}
                disabled={savingUser}
                className="rounded-xl p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close edit user modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 px-6 py-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">Access role</label>
                <select
                  value={editUserForm.role}
                  onChange={(event) =>
                    setEditUserForm((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">Status</label>
                <select
                  value={editUserForm.status}
                  onChange={(event) =>
                    setEditUserForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">Business unit</label>
                <select
                  value={editUserForm.businessUnit}
                  onChange={(event) =>
                    setEditUserForm((current) => ({
                      ...current,
                      businessUnit: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">No business unit</option>
                  {businessUnitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-800">Cost center</label>
                <select
                  value={editUserForm.costCenter}
                  onChange={(event) =>
                    setEditUserForm((current) => ({
                      ...current,
                      costCenter: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">No cost center</option>
                  {allCostCenterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div>
                    <p className="font-bold text-slate-900">
                      {getAccessRole(editUserForm.role).label} permissions
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {getAccessRole(editUserForm.role).description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getAccessRole(editUserForm.role).permissions.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <label className="md:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <span className="text-sm font-bold text-slate-800">SSO enabled</span>
                <input
                  type="checkbox"
                  checked={editUserForm.ssoEnabled}
                  onChange={(event) =>
                    setEditUserForm((current) => ({
                      ...current,
                      ssoEnabled: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
              </label>

              {editUserError ? (
                <p className="md:col-span-2 text-sm font-medium text-rose-600">
                  {editUserError}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={closeEditUserModal}
                disabled={savingUser}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitEditUser()}
                disabled={savingUser}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {savingUser ? 'Saving...' : 'Save changes'}
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
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="FIN"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
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

      <LevvPanel className="p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="group relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-500" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search users"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm focus:border-[#89d3bd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#89d3bd]/30"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-[#89d3bd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#89d3bd]/30"
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
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-[#89d3bd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#89d3bd]/30"
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
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-[#89d3bd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#89d3bd]/30"
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
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-[#89d3bd] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#89d3bd]/30"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={clearFilters}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#89d3bd] hover:bg-[#e7f3ee]"
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
      </LevvPanel>

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

      {!forbidden && invitationNotice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800" role="status">
          {invitationNotice}
        </div>
      ) : null}

      {!forbidden && invitationActionError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800" role="alert">
          {invitationActionError}
        </div>
      ) : null}

      <LevvPanel className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Name</th>
              <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Email</th>
              <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Status</th>
              <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Role</th>
              <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Business Unit</th>
              <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Cost Center</th>
              <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">SSO</th>
              <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center text-sm font-medium text-slate-500">
                  Loading users...
                </td>
              </tr>
            )}

            {!loading && !forbidden && usersForTable.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center text-sm font-medium text-slate-500">
                  No users found.
                </td>
              </tr>
            )}

            {!loading &&
              !forbidden &&
              usersForTable.map((user) => (
                <tr
                  key={`${user.membershipId || user.userId || user.email}-${user.name}`}
                  className="group transition-colors hover:bg-[#e7f3ee]/50"
                >
                  <td className="px-5 py-4 font-semibold text-slate-950">
                    {isFeatureEnabled('user_detail_v2') && user.membershipId ? (
                      <Link
                        href={`/admin/users/${encodeURIComponent(user.membershipId)}?return_to=${encodeURIComponent(currentListHref)}`}
                        className="rounded-sm hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-[#89d3bd]"
                      >
                        {user.name}
                      </Link>
                    ) : (
                      user.name
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-700">{user.email || '—'}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(user.status)}`}
                    >
                      {toTitleCase(user.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {getAccessRole(user.role).label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {user.businessUnit || user.businessUnitId || '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-700">{toCostCenterDisplay(user)}</td>
                  <td className="px-5 py-4">
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
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {user.status === 'invited' && user.invitationId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleInvitationAction(user, 'resend')}
                            disabled={invitationActionId === user.invitationId}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
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
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
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
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
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
      </LevvPanel>
      </div>
    </LevvPage>
  )
}
