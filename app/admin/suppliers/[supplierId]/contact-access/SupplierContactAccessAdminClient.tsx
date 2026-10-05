'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, Loader2, MailPlus, RefreshCw, ShieldX, Users } from 'lucide-react'

import { LevvPage, LevvPageHeader, LevvPanel } from '@/components/ui/levv-app'
import {
  ApiError,
  getSupplier,
  getSupplierContactAccess,
  inviteSupplierContact,
  resendSupplierContactAccess,
  revokeSupplierContactAccess,
  type SupplierContactAccess,
  type SupplierDetail,
} from '@/lib/api/suppliers'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { cn } from '@/lib/utils'

export default function SupplierContactAccessAdminClient() {
  const params = useParams()
  const router = useRouter()
  const supplierId = String(params?.supplierId || '')
  const validId = /^\d+$/.test(supplierId)
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [records, setRecords] = useState<SupplierContactAccess[]>([])
  const [email, setEmail] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('7')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | 'new' | null>(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    const [supplierResponse, accessResponse] = await Promise.all([
      getSupplier(supplierId, signal),
      getSupplierContactAccess(supplierId, signal),
    ])
    if (!supplierResponse.allowed_actions.includes('manage_contact_access')) {
      throw new ApiError('Only customer administrators can manage supplier contact access.', 403, {})
    }
    setSupplier(supplierResponse)
    setRecords(accessResponse.results)
  }, [supplierId])

  useEffect(() => {
    if (!isFeatureEnabled('supplier_detail_v2')) {
      router.replace('/suppliers')
      return
    }
    if (!validId) {
      setLoading(false)
      setNotFound(true)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setForbidden(false)
    setNotFound(false)
    load(controller.signal)
      .catch((requestError: unknown) => {
        if ((requestError as { name?: string })?.name === 'AbortError') return
        const requestStatus = (requestError as { status?: number })?.status
        if (requestStatus === 401) router.replace(`/auth/login?next=${encodeURIComponent(`/admin/suppliers/${supplierId}/contact-access`)}`)
        else if (requestStatus === 403) setForbidden(true)
        else if (requestStatus === 404) setNotFound(true)
        else setError(requestError instanceof Error ? requestError.message : 'Unable to load supplier contact access.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [load, reloadKey, router, supplierId, validId])

  const replaceRecord = (saved: SupplierContactAccess) => {
    setRecords((current) => [...current.filter((record) => record.id !== saved.id), saved].sort((a, b) => a.email.localeCompare(b.email)))
  }

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const days = Number(expiresInDays)
    if (!email.trim() || !Number.isInteger(days) || days < 1 || days > 30) {
      setFormError('Enter an email and an expiry between 1 and 30 days.')
      return
    }
    setSavingId('new')
    setFormError('')
    try {
      const saved = await inviteSupplierContact(supplierId, { email: email.trim(), expires_in_days: days })
      replaceRecord(saved)
      setEmail('')
      setExpiresInDays('7')
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 403) setForbidden(true)
      else setFormError(requestError instanceof Error ? requestError.message : 'Unable to invite this contact.')
    } finally {
      setSavingId(null)
    }
  }

  const resend = async (record: SupplierContactAccess) => {
    setSavingId(record.id)
    setFormError('')
    try {
      replaceRecord(await resendSupplierContactAccess(supplierId, record.id))
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to resend this invitation.')
    } finally {
      setSavingId(null)
    }
  }

  const revoke = async (record: SupplierContactAccess) => {
    if (!window.confirm(`Revoke supplier access for ${record.email}?`)) return
    setSavingId(record.id)
    setFormError('')
    try {
      replaceRecord(await revokeSupplierContactAccess(supplierId, record.id))
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to revoke this access.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <LevvPage width="wide" className="p-0 sm:p-0 lg:p-0">
      <div className="space-y-6">
        <LevvPageHeader
          eyebrow={<Link href={`/suppliers/${supplierId}/overview`} className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#89d3bd]"><ArrowLeft className="h-4 w-4" /> Supplier overview</Link>}
          title={supplier ? `${supplier.name} contact access` : 'Supplier contact access'}
          description="Invite and revoke supplier portal access. Email alone never grants authorization."
        />

        {loading ? <State title="Loading contact access…" loading />
          : forbidden ? <State title="Contact access unavailable" message="Only customer administrators can manage supplier contact access." />
          : notFound ? <State title="Supplier not found" message="This supplier does not exist in the active tenant, or the link is invalid." />
          : error ? <State title="Could not load contact access" message={error} onRetry={() => setReloadKey((value) => value + 1)} />
          : supplier ? <>
            <LevvPanel className="p-5 sm:p-6">
              <div className="flex items-start gap-3"><span className="rounded-xl bg-cyan-50 p-2 text-cyan-700"><MailPlus className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-950">Invite supplier contact</h2><p className="mt-1 text-sm text-slate-500">The contact remains inactive until the single-use emailed link is accepted.</p></div></div>
              <form onSubmit={invite} className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
                <Field label="Email"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={savingId !== null} className={inputClass} /></Field>
                <Field label="Expires in days"><input type="number" min="1" max="30" required value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} disabled={savingId !== null} className={inputClass} /></Field>
                <button type="submit" disabled={savingId !== null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{savingId === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />} Send invite</button>
              </form>
              {formError ? <p className="mt-4 text-sm font-medium text-rose-700" role="alert">{formError}</p> : null}
            </LevvPanel>
            <AccessList records={records} savingId={savingId} onResend={resend} onRevoke={revoke} />
          </> : <State title="No supplier data" message="No supplier information was returned." />}
      </div>
    </LevvPage>
  )
}

const inputClass = 'mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100'
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-slate-800">{label}{children}</label> }

function AccessList({ records, savingId, onResend, onRevoke }: { records: SupplierContactAccess[]; savingId: number | 'new' | null; onResend: (record: SupplierContactAccess) => void; onRevoke: (record: SupplierContactAccess) => void }) {
  return <LevvPanel className="overflow-hidden p-0">
    <div className="border-b border-slate-200 px-5 py-5 sm:px-6"><h2 className="font-bold text-slate-950">Supplier contacts</h2><p className="mt-1 text-sm text-slate-500">Access is bound to the exact tenant, supplier, identity, and membership.</p></div>
    {records.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center"><Users className="h-9 w-9 text-slate-300" /><h3 className="mt-4 font-bold text-slate-950">No supplier contacts</h3><p className="mt-2 text-sm text-slate-500">Invite the first contact above.</p></div>
      : <div className="divide-y divide-slate-100">{records.map((record) => <div key={record.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><div className="break-all font-semibold text-slate-950">{record.email}</div><div className="mt-1 text-xs text-slate-500">{record.delivery_status === 'failed' ? record.delivery_error || 'Delivery failed; retry is available.' : record.sent_at ? `Sent ${formatDate(record.sent_at)}` : 'Delivery pending'}{record.expires_at ? ` · Expires ${formatDate(record.expires_at)}` : ''}</div></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={record.status} />{record.allowed_actions.includes('resend') ? <button type="button" disabled={savingId !== null} onClick={() => onResend(record)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{savingId === record.id ? 'Working…' : record.delivery_status === 'failed' ? 'Retry' : 'Resend'}</button> : null}{record.allowed_actions.includes('revoke') ? <button type="button" disabled={savingId !== null} onClick={() => onRevoke(record)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><ShieldX className="h-4 w-4" /> Revoke</button> : null}</div></div>)}</div>}
  </LevvPanel>
}

function StatusBadge({ status }: { status: SupplierContactAccess['status'] }) { const active = status === 'active'; return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', active ? 'bg-emerald-100 text-emerald-700' : status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600')}>{status.charAt(0).toUpperCase() + status.slice(1)}</span> }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString() }
function State({ title, message, loading, onRetry }: { title: string; message?: string; loading?: boolean; onRetry?: () => void }) { return <LevvPanel className="flex min-h-64 flex-col items-center justify-center p-8 text-center">{loading ? <Loader2 className="h-7 w-7 animate-spin text-cyan-700" /> : <AlertCircle className="h-8 w-8 text-slate-400" />}<h2 className="mt-4 font-bold text-slate-950">{title}</h2>{message ? <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p> : null}{onRetry ? <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Retry</button> : null}</LevvPanel> }
