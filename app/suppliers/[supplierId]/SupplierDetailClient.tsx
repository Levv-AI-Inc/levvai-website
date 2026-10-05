'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { LevvPage, LevvPageHeader, LevvPanel } from '@/components/ui/levv-app'
import {
  ApiError,
  getSupplier,
  getSupplierCoverage,
  getSupplierWorkers,
  type SupplierCoverage,
  type SupplierDetail,
  type SupplierSourceReference,
  type SupplierWorker,
  type SupplierWorkersResponse,
} from '@/lib/api/suppliers'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { cn } from '@/lib/utils'

import { complianceBadgeClass, riskBadgeClass, statusBadgeClass, toTitleCase } from '../utils'

type SupplierDetailTab = 'overview' | 'workers' | 'roles-sites'

const EMPTY_PAGINATION: SupplierWorkersResponse['pagination'] = {
  page: 1,
  page_size: 25,
  total_count: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
}

export default function SupplierDetailClient({ activeTab }: { activeTab: SupplierDetailTab }) {
  const params = useParams()
  const router = useRouter()
  const supplierId = String(params?.supplierId || '')
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [workers, setWorkers] = useState<SupplierWorker[]>([])
  const [coverage, setCoverage] = useState<SupplierCoverage[]>([])
  const [pagination, setPagination] = useState(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const validId = /^\d+$/.test(supplierId)
  const basePath = `/suppliers/${encodeURIComponent(supplierId)}`
  const retry = useCallback(() => setReloadKey((value) => value + 1), [])

  useEffect(() => {
    if (!isFeatureEnabled('supplier_detail_v2')) {
      router.replace('/suppliers')
      return
    }
    if (activeTab === 'roles-sites' && !isFeatureEnabled('supplier_coverage')) {
      router.replace(`${basePath}/overview`)
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

    Promise.all([
      getSupplier(supplierId, controller.signal),
      activeTab === 'workers'
        ? getSupplierWorkers(supplierId, { page, page_size: 25 }, controller.signal)
        : Promise.resolve(null),
      activeTab === 'roles-sites'
        ? getSupplierCoverage(supplierId, controller.signal)
        : Promise.resolve(null),
    ])
      .then(([supplierResponse, workersResponse, coverageResponse]) => {
        setSupplier(supplierResponse)
        if (workersResponse) {
          setWorkers(workersResponse.results)
          setPagination(workersResponse.pagination)
        }
        if (coverageResponse) setCoverage(coverageResponse.results)
      })
      .catch((requestError) => {
        if ((requestError as { name?: string })?.name === 'AbortError') return
        setSupplier(null)
        setWorkers([])
        setCoverage([])
        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace(
            `/auth/login?next=${encodeURIComponent(`${basePath}/${activeTab}`)}`,
          )
          return
        }
        if (requestError instanceof ApiError && requestError.status === 403) {
          setForbidden(true)
          return
        }
        if (requestError instanceof ApiError && requestError.status === 404) {
          setNotFound(true)
          return
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load this supplier.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [activeTab, basePath, page, reloadKey, router, supplierId, validId])

  return (
    <LevvPage width="wide" className="p-0 sm:p-0 lg:p-0">
      <div className="space-y-6">
        <LevvPageHeader
          eyebrow={
            <Link
              href="/suppliers"
              className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#89d3bd]"
            >
              <ArrowLeft className="h-4 w-4" />
              Suppliers
            </Link>
          }
          title={supplier?.name || 'Supplier detail'}
          description={
            supplier
              ? `${supplier.supplier_id} · ${supplier.category || toTitleCase(supplier.supplier_type) || 'Supplier relationship'}`
              : 'View supplier relationship details and linked worker assignments.'
          }
        />

        <nav
          aria-label="Supplier record sections"
          className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1"
        >
          <TabLink href={`${basePath}/overview`} active={activeTab === 'overview'}>
            Overview
          </TabLink>
          <TabLink href={`${basePath}/workers`} active={activeTab === 'workers'}>
            Workers
          </TabLink>
          {isFeatureEnabled('supplier_coverage') ? (
            <TabLink href={`${basePath}/roles-sites`} active={activeTab === 'roles-sites'}>
              Roles & sites
            </TabLink>
          ) : (
            <span
              aria-disabled="true"
              title="Supplier coverage is not enabled"
              className="cursor-not-allowed whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-slate-400"
            >
              Roles & sites
            </span>
          )}
        </nav>

        {loading ? (
          <LevvPanel className="flex min-h-64 items-center justify-center p-8">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600" role="status">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading supplier {activeTab}…
            </div>
          </LevvPanel>
        ) : forbidden ? (
          <StatePanel
            title="Supplier unavailable"
            message="You do not have permission to view supplier records in this tenant."
          />
        ) : notFound ? (
          <StatePanel
            title="Supplier not found"
            message="This supplier does not exist in the active tenant, or the link is invalid."
          />
        ) : error ? (
          <StatePanel title="Could not load supplier" message={error} onRetry={retry} />
        ) : supplier ? (
          activeTab === 'overview' ? (
            <SupplierOverview supplier={supplier} />
          ) : activeTab === 'workers' ? (
            <SupplierWorkers
              workers={workers}
              pagination={pagination}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => current + 1)}
            />
          ) : (
            <SupplierCoverageList records={coverage} />
          )
        ) : (
          <StatePanel title="No supplier data" message="No supplier information was returned." />
        )}
      </div>
    </LevvPage>
  )
}

function SupplierCoverageList({ records }: { records: SupplierCoverage[] }) {
  const activeCount = records.filter((record) => record.is_active).length
  return (
    <LevvPanel className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <SectionHeading
          icon={<MapPin className="h-5 w-5" />}
          title="Roles & sites"
          description={`${activeCount} active coverage mapping${activeCount === 1 ? '' : 's'}. Inactive mappings remain visible for relationship history.`}
        />
      </div>
      {records.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
          <MapPin className="h-9 w-9 text-slate-300" />
          <h2 className="mt-4 text-base font-bold text-slate-950">No coverage configured</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            An administrator can add canonical role and site coverage from Supplier Settings.
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 md:hidden">
            {records.map((record) => (
              <div key={record.id} className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-950">{record.role_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{record.role_code || 'Canonical role'}</div>
                  </div>
                  <CoverageStatus active={record.is_active} />
                </div>
                <div className="text-sm text-slate-700">{formatSite(record)}</div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Role market</th>
                  <th className="px-6 py-4">Site</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-5">
                      <div className="font-semibold text-slate-950">{record.role_name}</div>
                      <div className="mt-1 text-xs text-slate-500">{record.role_code || '—'}</div>
                    </td>
                    <td className="px-6 py-5 text-slate-700">{record.role_location_label || '—'}</td>
                    <td className="px-6 py-5 text-slate-700">{formatSite(record)}</td>
                    <td className="px-6 py-5"><CoverageStatus active={record.is_active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </LevvPanel>
  )
}

function CoverageStatus({ active }: { active: boolean }) {
  return (
    <span className={cn(
      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
      active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600',
    )}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function formatSite(record: SupplierCoverage) {
  const location = [record.site_city, record.site_country].filter(Boolean).join(', ')
  return [record.site_name, location].filter(Boolean).join(' · ') || record.site_code || 'Site not set'
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#89d3bd]',
        active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
      )}
    >
      {children}
    </Link>
  )
}

function SupplierOverview({ supplier }: { supplier: SupplierDetail }) {
  const address = useMemo(() => formatAddress(supplier.registered_address), [supplier.registered_address])

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="space-y-6">
        <LevvPanel className="p-6">
          <SectionHeading
            icon={<Building2 className="h-5 w-5" />}
            title="Relationship overview"
            description="Levv relationship information and operational health."
          />
          <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <DetailField label="Supplier ID" value={supplier.supplier_id} />
            <DetailField label="Supplier name" value={supplier.name} />
            <DetailField label="Supplier type" value={toTitleCase(supplier.supplier_type)} />
            <DetailField label="Service type" value={toTitleCase(supplier.service_type)} readOnly />
            <DetailField label="Category" value={supplier.category} />
            <DetailField label="Relationship owner" value={supplier.owner_name} />
            <DetailField label="Primary contact" value={supplier.contact_name} />
            <DetailField label="Contact email" value={supplier.contact_email || supplier.email} />
            <DetailField label="Contact phone" value={supplier.contact_phone} />
            <DetailField label="Diversity status" value={supplier.diversity_status} />
          </dl>
        </LevvPanel>

        <LevvPanel className="p-6">
          <SectionHeading
            icon={<BriefcaseBusiness className="h-5 w-5" />}
            title="Source system record"
            description="Synced fields are read-only in Levv. Changes must be made in the owning source system."
          />
          <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <DetailField label="Source system" value={supplier.source_system} readOnly />
            <DetailField label="Source identifier" value={supplier.source_identifier} readOnly />
            <DetailField label="Source status" value={toTitleCase(supplier.source_status)} readOnly />
            <DetailField label="Last synced" value={formatDateTime(supplier.source_last_synced_at)} readOnly />
            <DetailField label="HQ country" value={supplier.hq_country} readOnly />
            <DetailField label="Registered address" value={address} readOnly />
          </dl>
          <div className="mt-7 grid gap-6 sm:grid-cols-2">
            <ReferenceList label="Buying entities" values={supplier.buying_entities} />
            <ReferenceList label="Business units" values={supplier.business_units} />
          </div>
        </LevvPanel>
      </div>

      <div className="space-y-6">
        <LevvPanel className="p-6">
          <SectionHeading icon={<ShieldCheck className="h-5 w-5" />} title="Status" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge label={supplier.active_in_levv ? 'Active in Levv' : 'Inactive in Levv'} className={supplier.active_in_levv ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'} />
            <Badge label={toTitleCase(supplier.status || 'Unknown')} className={statusBadgeClass(supplier.status)} />
            <Badge label={`${toTitleCase(supplier.risk_level || 'Unknown')} risk`} className={riskBadgeClass(supplier.risk_level)} />
            <Badge label={toTitleCase(supplier.compliance_status || 'Unknown')} className={complianceBadgeClass(supplier.compliance_status)} />
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">
            Levv activation is independent of the upstream source status.
          </p>
        </LevvPanel>

        <LevvPanel className="p-6">
          <SectionHeading icon={<Users className="h-5 w-5" />} title="Operational footprint" />
          <dl className="mt-6 grid grid-cols-2 gap-4">
            <Metric label="Workers" value={supplier.active_workers} />
            <Metric label="Active SOWs" value={supplier.active_sows} />
          </dl>
        </LevvPanel>
        {supplier.allowed_actions.includes('manage_contact_access') ? (
          <LevvPanel className="p-6">
            <SectionHeading icon={<Users className="h-5 w-5" />} title="Supplier portal access" />
            <p className="mt-3 text-sm text-slate-500">Review invitations and revoke access without changing unrelated tenant memberships.</p>
            <Link href={`/admin/suppliers/${encodeURIComponent(String(supplier.id || supplier.supplier_id))}/contact-access`} className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#89d3bd]">Manage contact access</Link>
          </LevvPanel>
        ) : null}
      </div>
    </div>
  )
}

function SupplierWorkers({
  workers,
  pagination,
  onPrevious,
  onNext,
}: {
  workers: SupplierWorker[]
  pagination: SupplierWorkersResponse['pagination']
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <LevvPanel className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <SectionHeading
          icon={<Users className="h-5 w-5" />}
          title="Worker assignments"
          description={`${pagination.total_count} linked assignment${pagination.total_count === 1 ? '' : 's'} from work orders.`}
        />
      </div>

      {workers.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
          <Users className="h-9 w-9 text-slate-300" />
          <h2 className="mt-4 text-base font-bold text-slate-950">No linked workers</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Workers appear here when a work order is linked to this supplier.
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 md:hidden">
            {workers.map((worker) => <WorkerCard key={worker.assignment_id} worker={worker} />)}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Worker</th>
                  <th className="px-6 py-4">Assignment</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Dates</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((worker) => (
                  <tr key={worker.assignment_id} className="hover:bg-cyan-50/40">
                    <td className="px-6 py-5">
                      <div className="font-semibold text-slate-950">{worker.worker_full_name || 'Name not set'}</div>
                      <div className="mt-1 text-xs text-slate-500">{worker.worker_email || 'No email'}</div>
                    </td>
                    <td className="px-6 py-5 font-semibold text-cyan-700">{worker.assignment_number || `#${worker.assignment_id}`}</td>
                    <td className="px-6 py-5 text-slate-700">{worker.role_name || 'Not set'}</td>
                    <td className="px-6 py-5 text-slate-700">{worker.site_name || worker.work_location_label || 'Not set'}</td>
                    <td className="px-6 py-5 text-slate-700">{formatDateRange(worker.start_date, worker.end_date)}</td>
                    <td className="px-6 py-5"><Badge label={toTitleCase(worker.status || 'Unknown')} className={statusBadgeClass(worker.status)} /></td>
                    <td className="px-6 py-5 text-right"><AssignmentLink worker={worker} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(pagination.has_previous || pagination.has_next) && (
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
          <span className="text-slate-500">Page {pagination.page} of {Math.max(1, pagination.total_pages)}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onPrevious} disabled={!pagination.has_previous} className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button type="button" onClick={onNext} disabled={!pagination.has_next} className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </LevvPanel>
  )
}

function WorkerCard({ worker }: { worker: SupplierWorker }) {
  return (
    <article className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-950">{worker.worker_full_name || 'Name not set'}</h3>
          <p className="mt-1 break-all text-xs text-slate-500">{worker.worker_email || 'No email'}</p>
        </div>
        <Badge label={toTitleCase(worker.status || 'Unknown')} className={statusBadgeClass(worker.status)} />
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <DetailField label="Assignment" value={worker.assignment_number || `#${worker.assignment_id}`} />
        <DetailField label="Role" value={worker.role_name} />
        <DetailField label="Location" value={worker.site_name || worker.work_location_label} />
        <DetailField label="Dates" value={formatDateRange(worker.start_date, worker.end_date)} />
      </dl>
      <AssignmentLink worker={worker} />
    </article>
  )
}

function AssignmentLink({ worker }: { worker: SupplierWorker }) {
  return (
    <Link
      href={`/cw/work-orders/${encodeURIComponent(String(worker.assignment_id))}`}
      className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-cyan-700 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-[#89d3bd]"
    >
      Work order <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  )
}

function SectionHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-[#e7f3ee] p-3 text-[#1f3d38]">{icon}</span>
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
    </div>
  )
}

function DetailField({ label, value, readOnly = false }: { label: string; value?: string; readOnly?: boolean }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
        {readOnly ? <span className="normal-case tracking-normal text-slate-400">· Read-only</span> : null}
      </dt>
      <dd className={cn('mt-1.5 break-words text-sm font-semibold', value ? 'text-slate-950' : 'text-slate-400')}>
        {value || 'Not set'}
      </dd>
    </div>
  )
}

function ReferenceList({ label, values }: { label: string; values: SupplierSourceReference[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label} · Read-only</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length ? values.map((value) => (
          <span key={`${value.id}-${value.name}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {value.name}{value.id && value.id !== value.name ? ` · ${value.id}` : ''}
          </span>
        )) : <span className="text-sm font-semibold text-slate-400">Not set</span>}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</dt>
      <dd className="mt-2 text-2xl font-black text-slate-950">{value}</dd>
    </div>
  )
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', className)}>{label}</span>
}

function StatePanel({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <LevvPanel className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="h-8 w-8 text-rose-500" />
      <h2 className="mt-4 text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-lg text-sm text-slate-600">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#89d3bd]">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      ) : null}
    </LevvPanel>
  )
}

function formatAddress(address: Record<string, string>) {
  const orderedKeys = ['line1', 'address_line1', 'line2', 'address_line2', 'city', 'state', 'state_province', 'postal_code', 'country']
  const used = new Set<string>()
  const parts: string[] = []
  for (const key of orderedKeys) {
    const value = address[key]
    if (value && !used.has(value)) {
      parts.push(value)
      used.add(value)
    }
  }
  for (const value of Object.values(address)) {
    if (value && !used.has(value)) {
      parts.push(value)
      used.add(value)
    }
  }
  return parts.join(', ')
}

function formatDateTime(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatDate(value?: string) {
  if (!value) return ''
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

function formatDateRange(start?: string, end?: string) {
  const startLabel = formatDate(start)
  const endLabel = formatDate(end)
  if (!startLabel && !endLabel) return 'Not set'
  return `${startLabel || 'Unscheduled'} – ${endLabel || 'Ongoing'}`
}
