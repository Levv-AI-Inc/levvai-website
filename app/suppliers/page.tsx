'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Check,
  Copy,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Users,
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
import { cn } from '@/lib/utils'
import SupplierInviteModal from './components/SupplierInviteModal'
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

export default function SuppliersPage() {
  const router = useRouter()

  const [sessionRole, setSessionRole] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [roleError, setRoleError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [forbidden, setForbidden] = useState(false)

  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null)
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(EMPTY_SUPPLIER_FORM)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [supplierFormError, setSupplierFormError] = useState('')

  const [inviteSupplier, setInviteSupplier] = useState<SupplierRecord | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteDays, setInviteDays] = useState('7')
  const [inviteError, setInviteError] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  const [inviteSuccess, setInviteSuccess] = useState<SupplierInviteResponse | null>(null)
  const [inviteSuccessSource, setInviteSuccessSource] = useState<'create' | 'resend' | null>(null)
  const [copiedInviteLink, setCopiedInviteLink] = useState(false)

  const listRequestIdRef = useRef(0)

  const normalizedRole = normalizeRole(sessionRole)
  const canViewSuppliers = !normalizedRole || VIEW_ROLES.has(normalizedRole)
  const canManageSuppliers = MANAGE_ROLES.has(normalizedRole)

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
    return suppliers.reduce(
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
  }, [suppliers])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const shouldLockBody = showSupplierModal || Boolean(inviteSupplier) || Boolean(inviteSuccess)
    if (!shouldLockBody) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [inviteSuccess, inviteSupplier, showSupplierModal])

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
      const rows = await getSuppliers({
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      })

      if (requestId !== listRequestIdRef.current) return
      setSuppliers(rows)
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
    if (!canManageSuppliers) return

    setInviteSupplier(supplier)
    setInviteEmail(supplier.contact_email || supplier.email || '')
    setInviteDays('7')
    setInviteError('')
    setSendingInvite(false)
  }

  const closeInviteModal = () => {
    setInviteSupplier(null)
    setInviteEmail('')
    setInviteDays('7')
    setInviteError('')
    setSendingInvite(false)
  }

  const submitInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inviteSupplier) return

    const targetEmail = inviteEmail.trim()
    const days = Math.max(1, toNonNegativeInt(inviteDays))

    if (!targetEmail) {
      setInviteError('Invite email is required.')
      return
    }

    setInviteError('')
    setSendingInvite(true)

    try {
      const response = await inviteSupplierContact(toSupplierKey(inviteSupplier), {
        email: targetEmail,
        expires_in_days: days,
      })

      closeInviteModal()
      setInviteSuccessSource('resend')
      setInviteSuccess(response)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setInviteError('You do not have permission to invite supplier contacts.')
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to generate supplier invite.'
      setInviteError(message)
    } finally {
      setSendingInvite(false)
    }
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

  const copyInviteLink = async () => {
    if (!inviteSuccess?.registration_link) return

    try {
      await navigator.clipboard.writeText(inviteSuccess.registration_link)
      setCopiedInviteLink(true)
      window.setTimeout(() => setCopiedInviteLink(false), 1500)
    } catch {
      setCopiedInviteLink(false)
    }
  }

  const closeInviteSuccess = () => {
    setInviteSuccess(null)
    setInviteSuccessSource(null)
    setCopiedInviteLink(false)
  }

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
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {roleError}
      </div>
    )
  }

  if (forbidden || !canViewSuppliers) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        You do not have access to view suppliers in this tenant.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Manage vendor relationships, compliance health, and operational footprint.
          </p>
        </div>

        <div className="group relative inline-flex">
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canManageSuppliers}
            aria-describedby={!canManageSuppliers ? 'add-supplier-tooltip' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
              canManageSuppliers
                ? 'bg-slate-950 text-white shadow-lg shadow-cyan-900/10 hover:bg-slate-800'
                : 'cursor-not-allowed bg-slate-200 text-slate-500',
            )}
          >
            <Plus className="h-4 w-4" />
            Add supplier
          </button>

          {!canManageSuppliers && (
            <div
              id="add-supplier-tooltip"
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-xl group-hover:block"
            >
              Only admins and managers can create suppliers.
              <span className="absolute -top-1 right-5 h-2 w-2 rotate-45 bg-slate-900" />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Active suppliers
            </span>
            <Building2 className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {supplierStats.activeSuppliers}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Active workers
            </span>
            <Users className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {supplierStats.activeWorkers}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Active SOWs
            </span>
            <Building2 className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {supplierStats.activeSows}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Risk flags
            </span>
            <ShieldAlert
              className={cn(
                'h-5 w-5',
                supplierStats.riskFlags > 0 ? 'text-rose-500' : 'text-emerald-500',
              )}
            />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {supplierStats.riskFlags}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="group relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-500" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Supplier name, ID, or category..."
              className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">All statuses</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>
                {toTitleCase(status)}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">All types</option>
            {uniqueTypes.map((type) => (
              <option key={type} value={type}>
                {toTitleCase(type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {listError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
          <div>{listError}</div>
          <button
            type="button"
            onClick={() => void loadSuppliers()}
            className="mt-2 text-xs font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <SuppliersList
        loading={loading}
        suppliers={suppliers}
        canManageSuppliers={canManageSuppliers}
        onEditSupplier={openEditModal}
        onInviteSupplier={openInviteModal}
        onDeleteSupplier={deleteSupplierRecord}
      />

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

      <SupplierInviteModal
        open={Boolean(inviteSupplier)}
        supplierName={inviteSupplier?.name || ''}
        inviteEmail={inviteEmail}
        inviteDays={inviteDays}
        inviteError={inviteError}
        sendingInvite={sendingInvite}
        onInviteEmailChange={setInviteEmail}
        onInviteDaysChange={setInviteDays}
        onClose={closeInviteModal}
        onSubmit={submitInvite}
      />

      {inviteSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-emerald-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {inviteSuccessSource === 'resend' ? 'Invite resent' : 'Invite sent'}
              </h2>
              <button
                type="button"
                onClick={closeInviteSuccess}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-slate-700">
                {inviteSuccessSource === 'resend'
                  ? 'Share this updated registration link with the supplier contact.'
                  : 'Share this registration link with the supplier contact.'}
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="break-all text-xs text-slate-700">{inviteSuccess.registration_link}</p>
              </div>

              <div className="grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                <div>
                  <span className="font-medium text-slate-800">Invite ID:</span> {String(inviteSuccess.invite_id)}
                </div>
                <div>
                  <span className="font-medium text-slate-800">Expires:</span>{' '}
                  {inviteSuccess.expires_at || 'N/A'}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copiedInviteLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedInviteLink ? 'Copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={closeInviteSuccess}
                  className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
