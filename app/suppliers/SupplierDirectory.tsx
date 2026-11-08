'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Loader2,
  Plus,
  ShieldAlert,
  X,
} from 'lucide-react'

import {
  ApiError,
  createSupplier,
  deleteSupplier,
  getSuppliers,
  inviteSupplierContact,
  type SupplierInviteResponse,
  type SupplierRecord,
  updateSupplier,
} from '@/lib/api/suppliers'
import {
  LevvNotice,
  LevvPage,
  LevvRecordHeader,
  LevvSearchField,
  LevvSelect,
  levvUi,
} from '@/components/ui/levv-app'
import { useLevvDialog } from '@/components/ui/levv-dialog'
import { isFeatureEnabled } from '@/lib/featureFlags'
import SupplierModal from './components/SupplierModal'
import SuppliersList from './components/SuppliersList'
import type { SupplierFormState } from './types'
import {
  createFormStateFromSupplier,
  normalizeRole,
  parseSessionRole,
  toNonNegativeInt,
  toPayload,
  toSupplierKey,
  toTitleCase,
  type SessionResponse,
} from './utils'

const VIEW_ROLES = new Set(['admin', 'manager', 'business', 'finance', 'viewer'])
const MANAGE_ROLES = new Set(['admin', 'manager'])

const STATUS_OPTIONS = ['active', 'inactive', 'invited']
const TYPE_OPTIONS = ['staffing', 'services', 'both']

const EMPTY_SUPPLIER_FORM: SupplierFormState = {
  supplier_code: '',
  name: '',
  email: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  tax_id: '',
  diversity_status: '',
  supplier_type: 'staffing',
  category: '',
  owner_name: '',
  status: 'invited',
  risk_level: 'low',
  compliance_status: 'compliant',
  active_workers: '0',
  active_sows: '0',
}

function readCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') return toNonNegativeInt(value)
  return 0
}

/**
 * The directory in one sentence. Totals are the tenant's, whatever the filters show; `shown` (the filtered count)
 * is added only when a filter is on and its rows have arrived.
 */
function supplierStatement(total: number, active: number, flagged: number, shown: number | null) {
  if (total === 0) return 'No suppliers yet.'
  const lead =
    total === 1
      ? `One supplier; it is ${active === 1 ? 'active' : 'not active'}.`
      : `${total} suppliers, ${active === total ? 'all' : active === 0 ? 'none' : active} active.`
  const flags =
    flagged === 0
      ? 'None carries a risk flag.'
      : `${flagged} ${flagged === 1 ? 'carries' : 'carry'} a risk flag (high risk, or not marked compliant).`
  const matches =
    shown === null ? '' : ` ${shown === 0 ? 'None' : shown} ${shown === 1 ? 'matches' : 'match'} these filters.`
  return `${lead} ${flags}${matches}`
}

export default function SupplierDirectory({
  trail = 'Management / Suppliers',
}: {
  /** Where the directory sits: the Management menu by default, Admin settings when the admin pages render it. */
  trail?: string
}) {
  const router = useRouter()

  const [sessionRole, setSessionRole] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [roleError, setRoleError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  // Every supplier, unfiltered: the header states the tenant's totals, whatever the filters show.
  const [allSuppliers, setAllSuppliers] = useState<SupplierRecord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [forbidden, setForbidden] = useState(false)

  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null)
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(EMPTY_SUPPLIER_FORM)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [supplierFormError, setSupplierFormError] = useState('')

  const [inviteSuccess, setInviteSuccess] = useState<SupplierInviteResponse | null>(null)
  const [inviteSuccessSource, setInviteSuccessSource] = useState<'create' | 'resend' | null>(null)

  const listRequestIdRef = useRef(0)

  const normalizedRole = normalizeRole(sessionRole)
  const canViewSuppliers = !normalizedRole || VIEW_ROLES.has(normalizedRole)
  const canManageSuppliers = MANAGE_ROLES.has(normalizedRole)
  const canManageContactAccess = normalizedRole === 'admin'
  const canManageCoverage =
    normalizedRole === 'admin' && isFeatureEnabled('supplier_coverage')

  const uniqueStatuses = useMemo(() => {
    const values = new Set(STATUS_OPTIONS)
    for (const supplier of suppliers) {
      if (supplier.status) {
        values.add(normalizeRole(supplier.status))
      }
    }

    return Array.from(values)
  }, [suppliers])

  const uniqueTypes = useMemo(() => {
    const values = new Set(TYPE_OPTIONS)
    for (const supplier of suppliers) {
      if (supplier.supplier_type) {
        values.add(normalizeRole(supplier.supplier_type))
      }
    }

    return Array.from(values)
  }, [suppliers])

  const supplierStats = useMemo(() => {
    return (allSuppliers ?? []).reduce(
      (totals, supplier) => {
        const risk = normalizeRole(supplier.risk_level)
        const compliance = normalizeRole(supplier.compliance_status)
        const status = normalizeRole(supplier.status)

        totals.activeWorkers += readCount(supplier.active_workers)
        totals.activeSows += readCount(supplier.active_sows)

        if (status === 'active') {
          totals.activeSuppliers += 1
        }

        if (risk === 'high' || (compliance && compliance !== 'compliant')) {
          totals.riskFlags += 1
        }

        return totals
      },
      {
        activeSuppliers: 0,
        activeWorkers: 0,
        activeSows: 0,
        riskFlags: 0,
      },
    )
  }, [allSuppliers])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const shouldLockBody = showSupplierModal || Boolean(inviteSuccess)
    if (!shouldLockBody) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [inviteSuccess, showSupplierModal])

  useEffect(() => {
    const controller = new AbortController()

    const loadSession = async () => {
      setRoleError('')
      setCheckingSession(true)
      try {
        const response = await fetch('/api/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 401) {
          router.replace('/auth/login?next=/suppliers')
          return
        }

        const payload = (await response.json().catch(() => ({}))) as SessionResponse
        const role = parseSessionRole(payload)

        setSessionRole(role)

        const normalized = normalizeRole(role)
        if (normalized && !VIEW_ROLES.has(normalized)) {
          setForbidden(true)
          return
        }

        setForbidden(false)
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return
        setRoleError('Unable to verify your access right now.')
      } finally {
        setCheckingSession(false)
      }
    }

    void loadSession()

    return () => controller.abort()
  }, [router])

  const loadSuppliers = async () => {
    const requestId = ++listRequestIdRef.current
    setLoading(true)
    setListError('')

    try {
      const filtered = Boolean(search || statusFilter || typeFilter)
      const [rows, everything] = await Promise.all([
        getSuppliers({
          search: search || undefined,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
        }),
        filtered ? getSuppliers() : null,
      ])

      if (requestId !== listRequestIdRef.current) return
      setSuppliers(rows)
      setAllSuppliers(everything ?? rows)
      setForbidden(false)
    } catch (error) {
      if (requestId !== listRequestIdRef.current) return

      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true)
        setSuppliers([])
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load suppliers.'
      setListError(message)
      setSuppliers([])
    } finally {
      if (requestId === listRequestIdRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    if (checkingSession || forbidden || !canViewSuppliers) return
    void loadSuppliers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingSession, forbidden, canViewSuppliers, search, statusFilter, typeFilter])

  const openCreateModal = () => {
    if (!canManageSuppliers) return
    setEditingSupplier(null)
    setSupplierForm(EMPTY_SUPPLIER_FORM)
    setSupplierFormError('')
    setShowSupplierModal(true)
  }

  const openEditModal = (supplier: SupplierRecord) => {
    if (!canManageSuppliers) return
    setEditingSupplier(supplier)
    setSupplierForm(createFormStateFromSupplier(supplier))
    setSupplierFormError('')
    setShowSupplierModal(true)
  }

  const openCoverageEditor = (supplier: SupplierRecord) => {
    if (!canManageCoverage) return
    router.push(
      `/admin/suppliers/${encodeURIComponent(String(toSupplierKey(supplier)))}/coverage`,
    )
  }

  const closeSupplierModal = () => {
    setShowSupplierModal(false)
    setEditingSupplier(null)
    setSupplierFormError('')
    setSavingSupplier(false)
  }

  const onSupplierFormChange = (key: keyof SupplierFormState, value: string) => {
    setSupplierForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const submitSupplierForm = async () => {
    const payload = toPayload(supplierForm)

    if (
      !payload.name ||
      !payload.category ||
      !payload.email ||
      !payload.contact_email ||
      !payload.supplier_type ||
      !payload.risk_level ||
      !payload.compliance_status
    ) {
      setSupplierFormError(
        'Please complete all required fields marked with *.',
      )
      return
    }

    setSavingSupplier(true)
    setSupplierFormError('')

    let createdSupplier: SupplierRecord | null = null

    try {
      if (editingSupplier) {
        const supplierId = toSupplierKey(editingSupplier)
        const { supplier_code, ...updatePayload } = payload
        await updateSupplier(supplierId, updatePayload)
      } else {
        const { supplier_code, status, ...createPayload } = payload
        createdSupplier = await createSupplier(createPayload)

        if (!canManageContactAccess) {
          closeSupplierModal()
          await loadSuppliers()
          return
        }

        const inviteEmail =
          payload.contact_email?.trim() || payload.email?.trim() || ''
        const createdSupplierKey = toSupplierKey(createdSupplier)

        if (!inviteEmail) {
          throw new Error('Invite email is missing.')
        }

        if (
          createdSupplierKey === undefined ||
          createdSupplierKey === null ||
          String(createdSupplierKey).trim() === ''
        ) {
          throw new Error('Supplier was created but no supplier ID was returned for invite.')
        }

        const inviteResponse = await inviteSupplierContact(createdSupplierKey, {
          email: inviteEmail,
          expires_in_days: 7,
        })

        closeSupplierModal()
        await loadSuppliers()
        setInviteSuccessSource('create')
        setInviteSuccess(inviteResponse)
        return
      }

      closeSupplierModal()
      await loadSuppliers()
    } catch (error) {
      if (createdSupplier) {
        const detail =
          error instanceof Error
            ? error.message
            : 'Unable to send supplier invite.'
        closeSupplierModal()
        await loadSuppliers()
        setListError(`Supplier created, but invite failed: ${detail}`)
        return
      }

      if (error instanceof ApiError && error.status === 403) {
        setSupplierFormError('You do not have permission to modify suppliers.')
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save supplier.'
      setSupplierFormError(message)
    } finally {
      setSavingSupplier(false)
    }
  }

  const openInviteModal = (supplier: SupplierRecord) => {
    if (!canManageContactAccess) return
    router.push(`/admin/suppliers/${encodeURIComponent(String(toSupplierKey(supplier)))}/contact-access`)
  }

  const deleteSupplierRecord = async (supplier: SupplierRecord) => {
    if (!canManageSuppliers) return

    const supplierName = supplier.name?.trim() || supplier.supplier_id || 'this supplier'
    const shouldDelete = window.confirm(
      `Delete ${supplierName}? This action cannot be undone.`,
    )
    if (!shouldDelete) return

    const supplierKey = toSupplierKey(supplier)

    try {
      await deleteSupplier(supplierKey)
      await loadSuppliers()
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setListError('You do not have permission to delete suppliers.')
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to delete supplier.'
      setListError(message)
    }
  }

  const closeInviteSuccess = () => {
    setInviteSuccess(null)
    setInviteSuccessSource(null)
  }

  const inviteDialogRef = useLevvDialog<HTMLDivElement>(Boolean(inviteSuccess), closeInviteSuccess)

  if (checkingSession) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking access...
        </div>
      </div>
    )
  }

  if (roleError) {
    return (
      <LevvNotice tone="rose" icon={AlertCircle}>
        {roleError}
      </LevvNotice>
    )
  }

  if (forbidden || !canViewSuppliers) {
    return (
      <LevvNotice tone="amber" icon={ShieldAlert}>
        You do not have access to view suppliers in this tenant.
      </LevvNotice>
    )
  }

  const filtersActive = Boolean(search || statusFilter || typeFilter)
  const totalsUnknown = allSuppliers === null || (Boolean(listError) && suppliers.length === 0)
  const statement =
    allSuppliers === null && !listError
      ? 'Loading suppliers…'
      : totalsUnknown
        ? 'Suppliers could not be loaded, so their health cannot be shown.'
        : supplierStatement(
            (allSuppliers ?? []).length,
            supplierStats.activeSuppliers,
            supplierStats.riskFlags,
            filtersActive && !loading ? suppliers.length : null,
          )
  const figure = (value: number) => (totalsUnknown ? '—' : value)

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail={trail}
          title="Suppliers"
          statement={statement}
          figures={[
            { label: 'Active suppliers', value: figure(supplierStats.activeSuppliers) },
            { label: 'Active workers', value: figure(supplierStats.activeWorkers) },
            { label: 'Active SOWs', value: figure(supplierStats.activeSows) },
            { label: 'Risk flags', value: figure(supplierStats.riskFlags) },
          ]}
          actions={
            <div className="group relative inline-flex">
              <button
                type="button"
                onClick={openCreateModal}
                disabled={!canManageSuppliers}
                aria-describedby={!canManageSuppliers ? 'add-supplier-tooltip' : undefined}
                className={levvUi.primaryButton}
              >
                <Plus />
                Add supplier
              </button>

              {!canManageSuppliers && (
                <div
                  id="add-supplier-tooltip"
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-64 bg-slate-950 px-3 py-2 text-xs font-medium text-white group-hover:block"
                >
                  Only admins and managers can create suppliers.
                  <span className="absolute -top-1 right-5 h-2 w-2 rotate-45 bg-slate-950" />
                </div>
              )}
            </div>
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="grid w-full gap-1.5 sm:w-72">
            <span className={levvUi.label}>Search</span>
            <LevvSearchField
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Supplier name, ID, or category..."
              aria-label="Search suppliers"
            />
          </label>

          <label className="grid w-full gap-1.5 sm:w-48">
            <span className={levvUi.label}>Status</span>
            <LevvSelect
              aria-label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {toTitleCase(status)}
                </option>
              ))}
            </LevvSelect>
          </label>

          <label className="grid w-full gap-1.5 sm:w-48">
            <span className={levvUi.label}>Type</span>
            <LevvSelect
              aria-label="Type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All types</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {toTitleCase(type)}
                </option>
              ))}
            </LevvSelect>
          </label>
        </div>

        {listError && (
          <LevvNotice
            tone="rose"
            icon={AlertCircle}
            action={
              <button
                type="button"
                onClick={() => void loadSuppliers()}
                className={levvUi.secondaryButton}
              >
                Retry
              </button>
            }
          >
            {listError}
          </LevvNotice>
        )}

        <SuppliersList
          loading={loading}
          suppliers={suppliers}
          canManageSuppliers={canManageSuppliers}
          canManageContactAccess={canManageContactAccess}
          canManageCoverage={canManageCoverage}
          detailEnabled={isFeatureEnabled('supplier_detail_v2')}
          onEditSupplier={openEditModal}
          onInviteSupplier={openInviteModal}
          onManageCoverage={openCoverageEditor}
          onDeleteSupplier={deleteSupplierRecord}
        />
      </div>

      <SupplierModal
        open={showSupplierModal}
        editingSupplier={editingSupplier}
        supplierForm={supplierForm}
        supplierFormError={supplierFormError}
        savingSupplier={savingSupplier}
        onClose={closeSupplierModal}
        onFieldChange={onSupplierFormChange}
        onSubmit={submitSupplierForm}
      />

      {inviteSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div
            ref={inviteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-invite-success-title"
            tabIndex={-1}
            className="w-full max-w-2xl outline-none border border-[var(--line)] bg-white shadow-[0_20px_44px_-12px_rgb(10_17_40/0.18),0_4px_10px_-4px_rgb(10_17_40/0.06)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <h2 id="supplier-invite-success-title" className="text-lg font-semibold text-slate-950">
                {inviteSuccessSource === 'resend' ? 'Invite resent' : 'Invite sent'}
              </h2>
              <button
                type="button"
                onClick={closeInviteSuccess}
                aria-label="Close"
                className={levvUi.iconButton}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-[14px] text-slate-700">
                The single-use registration link was sent to {inviteSuccess.email}. Links are never exposed in the Admin response.
              </p>

              <div className="grid gap-2 text-[13px] text-slate-600 md:grid-cols-2">
                <div>
                  <span className="font-medium text-slate-950">Access ID:</span> <span className="tabular-nums">{String(inviteSuccess.id)}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-950">Expires:</span>{' '}
                  <span className="tabular-nums">{inviteSuccess.expires_at || 'N/A'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeInviteSuccess}
                  className={levvUi.primaryButton}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </LevvPage>
  )
}
