'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, Loader2, MapPin, Plus, RefreshCw } from 'lucide-react'

import { LevvPage, LevvPageHeader, LevvPanel } from '@/components/ui/levv-app'
import { getRoles, type RoleRecord } from '@/lib/api/roles'
import { getSites, type SiteRecord } from '@/lib/api/sites'
import {
  ApiError,
  createSupplierCoverage,
  getSupplier,
  getSupplierCoverage,
  updateSupplierCoverage,
  type SupplierCoverage,
  type SupplierDetail,
} from '@/lib/api/suppliers'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { cn } from '@/lib/utils'

export default function SupplierCoverageAdminClient() {
  const params = useParams()
  const router = useRouter()
  const supplierId = String(params?.supplierId || '')
  const validId = /^\d+$/.test(supplierId)
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [records, setRecords] = useState<SupplierCoverage[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [sites, setSites] = useState<SiteRecord[]>([])
  const [roleId, setRoleId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    const [supplierResponse, coverageResponse, roleRows, siteRows] = await Promise.all([
      getSupplier(supplierId, signal),
      getSupplierCoverage(supplierId, signal),
      getRoles({ is_active: true }),
      getSites({ status: 'active' }),
    ])
    setSupplier(supplierResponse)
    setRecords(coverageResponse.results)
    setRoles(roleRows)
    setSites(siteRows)
  }, [supplierId])

  useEffect(() => {
    if (!isFeatureEnabled('supplier_coverage')) {
      router.replace('/admin/suppliers')
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
        if (requestStatus === 401) {
          router.replace(`/auth/login?next=${encodeURIComponent(`/admin/suppliers/${supplierId}/coverage`)}`)
        } else if (requestStatus === 403) {
          setForbidden(true)
        } else if (requestStatus === 404) {
          setNotFound(true)
        } else {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load supplier coverage.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [load, reloadKey, router, supplierId, validId])

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => `${a.role_name}\0${a.site_name}`.localeCompare(`${b.role_name}\0${b.site_name}`)),
    [records],
  )

  const submit = async () => {
    if (!roleId || !siteId) {
      setFormError('Choose both a role and a site.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const saved = await createSupplierCoverage(supplierId, {
        role_id: Number(roleId),
        site_id: siteId,
      })
      setRecords((current) => {
        const withoutSaved = current.filter((record) => record.id !== saved.id)
        return [...withoutSaved, saved]
      })
      setRoleId('')
      setSiteId('')
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to add coverage.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (record: SupplierCoverage) => {
    setSaving(true)
    setFormError('')
    try {
      const saved = await updateSupplierCoverage(supplierId, record.id, !record.is_active)
      setRecords((current) => current.map((item) => item.id === saved.id ? saved : item))
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 403) setForbidden(true)
      else setFormError(requestError instanceof Error ? requestError.message : 'Unable to update coverage.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <LevvPage width="wide" className="p-0 sm:p-0 lg:p-0">
      <div className="space-y-6">
        <LevvPageHeader
          eyebrow={
            <Link href="/admin/suppliers" className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#89d3bd]">
              <ArrowLeft className="h-4 w-4" /> Supplier settings
            </Link>
          }
          title={supplier ? `${supplier.name} coverage` : 'Supplier coverage'}
          description="Maintain the canonical role and site combinations this supplier may support."
        />

        {loading ? <State title="Loading coverage…" loading />
          : forbidden ? <State title="Coverage unavailable" message="Only customer administrators can maintain supplier coverage." />
          : notFound ? <State title="Supplier not found" message="This supplier does not exist in the active tenant, or the link is invalid." />
          : error ? <State title="Could not load coverage" message={error} onRetry={() => setReloadKey((value) => value + 1)} />
          : supplier ? (
            <>
              <LevvPanel className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-cyan-50 p-2 text-cyan-700"><Plus className="h-5 w-5" /></span>
                  <div>
                    <h2 className="font-bold text-slate-950">Add role and site</h2>
                    <p className="mt-1 text-sm text-slate-500">An inactive duplicate is reactivated; an active duplicate is rejected.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                  <SelectField label="Canonical role" value={roleId} onChange={setRoleId} disabled={saving}>
                    <option value="">Choose a role</option>
                    {roles.map((role) => <option key={role.id} value={role.id}>{role.name} · {role.location_label}</option>)}
                  </SelectField>
                  <SelectField label="Site" value={siteId} onChange={setSiteId} disabled={saving}>
                    <option value="">Choose a site</option>
                    {sites.map((site) => <option key={String(site.id)} value={String(site.id)}>{site.name} · {[site.city, site.country].filter(Boolean).join(', ')}</option>)}
                  </SelectField>
                  <button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add coverage
                  </button>
                </div>
                {formError ? <p className="mt-4 text-sm font-medium text-rose-700" role="alert">{formError}</p> : null}
              </LevvPanel>

              <CoverageTable records={sortedRecords} saving={saving} onToggle={toggle} />
            </>
          ) : <State title="No supplier data" message="No supplier information was returned." />}
      </div>
    </LevvPage>
  )
}

function SelectField({ label, value, onChange, disabled, children }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100">
        {children}
      </select>
    </label>
  )
}

function CoverageTable({ records, saving, onToggle }: { records: SupplierCoverage[]; saving: boolean; onToggle: (record: SupplierCoverage) => void }) {
  return (
    <LevvPanel className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <h2 className="font-bold text-slate-950">Configured coverage</h2>
        <p className="mt-1 text-sm text-slate-500">Deactivation preserves the mapping and all historical assignments.</p>
      </div>
      {records.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
          <MapPin className="h-9 w-9 text-slate-300" />
          <h3 className="mt-4 font-bold text-slate-950">No coverage configured</h3>
          <p className="mt-2 text-sm text-slate-500">Choose an active canonical role and site above.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {records.map((record) => (
            <div key={record.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <div className="font-semibold text-slate-950">{record.role_name}</div>
                <div className="mt-1 text-sm text-slate-600">{record.site_name} · {[record.site_city, record.site_country].filter(Boolean).join(', ')}</div>
                <div className="mt-2 text-xs text-slate-400">{record.role_code || 'Canonical role'} · {record.site_code || 'Canonical site'}</div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', record.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>{record.is_active ? 'Active' : 'Inactive'}</span>
                <button type="button" disabled={saving} onClick={() => onToggle(record)} className="min-w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {record.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </LevvPanel>
  )
}

function State({ title, message, loading, onRetry }: { title: string; message?: string; loading?: boolean; onRetry?: () => void }) {
  return (
    <LevvPanel className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
      {loading ? <Loader2 className="h-7 w-7 animate-spin text-cyan-700" /> : <AlertCircle className="h-8 w-8 text-slate-400" />}
      <h2 className="mt-4 font-bold text-slate-950">{title}</h2>
      {message ? <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p> : null}
      {onRetry ? <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Retry</button> : null}
    </LevvPanel>
  )
}
