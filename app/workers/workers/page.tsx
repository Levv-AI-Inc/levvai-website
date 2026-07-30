'use client'

import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eye,
  Fingerprint,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserX,
  UsersRound,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  extendWorkerContract,
  getWorkerDirectory,
  getWorkerDirectoryDetail,
  type WorkerComplianceStatus,
  type WorkerDirectoryRecord,
  type WorkerStatus,
} from '@/lib/api/workers'
import { startWorkerOffboarding } from '@/lib/api/workerLifecycle'

type WorkerStatusFilter = '' | WorkerStatus

const STATUS_OPTIONS: Array<{
  value: WorkerStatusFilter
  label: string
}> = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'offboarding', label: 'Offboarding' },
  { value: 'offboarded', label: 'Offboarded' },
  { value: 'invited', label: 'Invited' },
]

const STATUS_STYLES: Record<WorkerStatus, string> = {
  invited: 'border-blue-100 bg-blue-50 text-blue-700',
  onboarding: 'border-amber-100 bg-amber-50 text-amber-700',
  active: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  offboarding: 'border-orange-100 bg-orange-50 text-orange-700',
  offboarded: 'border-slate-200 bg-slate-100 text-slate-600',
}

const COMPLIANCE_STYLES: Record<
  WorkerComplianceStatus,
  { label: string; badge: string; dot: string }
> = {
  compliant: {
    label: 'Compliant',
    badge: 'border-emerald-200 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  review_required: {
    label: 'Review Required',
    badge: 'border-amber-200 text-amber-700',
    dot: 'bg-amber-500',
  },
  non_compliant: {
    label: 'Non-Compliant',
    badge: 'border-rose-200 text-rose-700',
    dot: 'bg-rose-500',
  },
}

function workerInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
  return initials || 'W'
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatDate(value: string) {
  if (!value) return 'Not set'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function isoDateOffset(value: string, days: number) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + days)
  return [
    base.getFullYear(),
    String(base.getMonth() + 1).padStart(2, '0'),
    String(base.getDate()).padStart(2, '0'),
  ].join('-')
}

function laterIsoDate(first: string, second: string) {
  if (!first) return second
  if (!second) return first
  return first > second ? first : second
}

function LoadingRows() {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <tr key={index} className="border-t border-slate-100">
          <td colSpan={5} className="px-7 py-6">
            <div className="h-10 animate-pulse rounded-md bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  )
}

export default function WorkersIndexPage() {
  const router = useRouter()
  const directoryRequest = useRef(0)
  const detailRequest = useRef(0)
  const [workers, setWorkers] = useState<WorkerDirectoryRecord[]>([])
  const [summary, setSummary] = useState({
    totalWorkers: 0,
    complianceAlerts: 0,
  })
  const [resultCount, setResultCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] =
    useState<WorkerStatusFilter>('')
  const [aiInput, setAiInput] = useState('')
  const [alertsOnly, setAlertsOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [selectedRecord, setSelectedRecord] =
    useState<WorkerDirectoryRecord | null>(null)
  const [selectedWorkOrderId, setSelectedWorkOrderId] =
    useState<number | null>(null)
  const [workerDetail, setWorkerDetail] =
    useState<WorkerDirectoryRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [drawerFeedback, setDrawerFeedback] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)

  const [extendOpen, setExtendOpen] = useState(false)
  const [extensionEndDate, setExtensionEndDate] = useState('')
  const [extensionNotes, setExtensionNotes] = useState('')
  const [extending, setExtending] = useState(false)
  const [extensionError, setExtensionError] = useState('')
  const [offboardOpen, setOffboardOpen] = useState(false)
  const [offboarding, setOffboarding] = useState(false)

  useEffect(() => {
    const requestId = directoryRequest.current + 1
    directoryRequest.current = requestId
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setLoadError('')
      try {
        const response = await getWorkerDirectory({
          pageSize: 200,
          status: selectedStatus,
          search: searchTerm,
        })
        if (directoryRequest.current !== requestId) return
        setWorkers(response.results)
        setSummary(response.summary)
        setResultCount(response.pagination.totalCount)
      } catch (error) {
        if (directoryRequest.current !== requestId) return
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load the worker directory.',
        )
      } finally {
        if (directoryRequest.current === requestId) setLoading(false)
      }
    }, 220)
    return () => window.clearTimeout(timer)
  }, [reloadKey, searchTerm, selectedStatus])

  useEffect(() => {
    if (!selectedRecord) {
      setWorkerDetail(null)
      setDetailError('')
      return
    }
    const requestId = detailRequest.current + 1
    detailRequest.current = requestId
    setDetailLoading(true)
    setDetailError('')
    getWorkerDirectoryDetail(
      selectedRecord.workerId,
      { workOrderId: selectedWorkOrderId },
    )
      .then((detail) => {
        if (detailRequest.current !== requestId) return
        setWorkerDetail(detail)
      })
      .catch((error) => {
        if (detailRequest.current !== requestId) return
        setDetailError(
          error instanceof Error
            ? error.message
            : 'Unable to load worker details.',
        )
      })
      .finally(() => {
        if (detailRequest.current === requestId) setDetailLoading(false)
      })
  }, [reloadKey, selectedRecord, selectedWorkOrderId])

  useEffect(() => {
    if (!selectedRecord) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedRecord])

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (extendOpen) {
        setExtendOpen(false)
      } else if (offboardOpen) {
        setOffboardOpen(false)
      } else {
        closeDrawer()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  })

  const visibleWorkers = useMemo(
    () =>
      alertsOnly
        ? workers.filter(
            (worker) =>
              worker.complianceStatus !== 'compliant' &&
              worker.workerStatus !== 'offboarded',
          )
        : workers,
    [alertsOnly, workers],
  )

  const displayDetail = workerDetail ?? selectedRecord
  const minimumExtensionDate = laterIsoDate(
    isoDateOffset(displayDetail?.endDate || '', 1),
    isoDateOffset('', 1),
  )

  function openWorker(record: WorkerDirectoryRecord) {
    setSelectedRecord(record)
    setSelectedWorkOrderId(record.workOrderId)
    setWorkerDetail(null)
    setDrawerFeedback(null)
  }

  function closeDrawer() {
    detailRequest.current += 1
    setSelectedRecord(null)
    setSelectedWorkOrderId(null)
    setWorkerDetail(null)
    setDetailError('')
    setExtendOpen(false)
    setOffboardOpen(false)
    setDrawerFeedback(null)
  }

  function resetFilters() {
    setSearchTerm('')
    setSelectedStatus('')
    setAlertsOnly(false)
    setAiInput('')
  }

  function handleNovaAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = aiInput.trim()
    if (!question) return
    if (/\b(compliance|audit|risk|alert)\b/i.test(question)) {
      setSearchTerm('')
      setSelectedStatus('')
      setAlertsOnly(true)
      return
    }
    setAlertsOnly(false)
    setSearchTerm(question)
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    worker: WorkerDirectoryRecord,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openWorker(worker)
    }
  }

  function openExtension() {
    if (!displayDetail) return
    setExtensionEndDate(minimumExtensionDate)
    setExtensionNotes('')
    setExtensionError('')
    setExtendOpen(true)
  }

  async function handleExtendContract(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!displayDetail?.workOrderId) return
    if (!extensionEndDate) {
      setExtensionError('Choose a new contract end date.')
      return
    }
    if (extensionEndDate < minimumExtensionDate) {
      setExtensionError(
        `Choose ${formatDate(minimumExtensionDate)} or later.`,
      )
      return
    }
    setExtending(true)
    setExtensionError('')
    try {
      const updated = await extendWorkerContract(
        displayDetail.workerId,
        {
          workOrderId: displayDetail.workOrderId,
          endDate: extensionEndDate,
          notes: extensionNotes,
        },
      )
      setWorkerDetail(updated)
      setWorkers((records) =>
        records.map((record) =>
          record.workerId === updated.workerId
            ? {
                ...record,
                endDate: updated.endDate,
                assignmentStatus: updated.assignmentStatus,
              }
            : record,
        ),
      )
      setExtendOpen(false)
      setDrawerFeedback({
        tone: 'success',
        message: `Contract extended through ${formatDate(updated.endDate)}.`,
      })
    } catch (error) {
      setExtensionError(
        error instanceof Error
          ? error.message
          : 'Unable to extend the contract.',
      )
    } finally {
      setExtending(false)
    }
  }

  function profileDestination(record: WorkerDirectoryRecord) {
    if (!record.workOrderId) {
      return `/workers/${record.workerId}/engagements`
    }
    const lifecycle =
      record.offboardingRunId || record.workerStatus === 'offboarding'
        ? 'offboarding'
        : 'onboarding'
    return (
      `/workers/${record.workerId}/engagements/${lifecycle}/workspace` +
      `?work_order=${record.workOrderId}`
    )
  }

  async function handleOffboardWorker() {
    if (!displayDetail?.workOrderId) return
    if (displayDetail.offboardingRunId) {
      router.push(profileDestination(displayDetail))
      return
    }
    setOffboarding(true)
    setDrawerFeedback(null)
    try {
      await startWorkerOffboarding(
        displayDetail.workerId,
        { workOrderId: displayDetail.workOrderId },
      )
      router.push(
        `/workers/${displayDetail.workerId}/engagements/offboarding/workspace` +
          `?work_order=${displayDetail.workOrderId}`,
      )
    } catch (error) {
      setOffboardOpen(false)
      setDrawerFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to start offboarding.',
      })
    } finally {
      setOffboarding(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 p-4 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-normal text-slate-900 sm:text-3xl">
              Workers
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Master directory of contingent and SOW workforce records.
            </p>
          </div>

          <form
            onSubmit={handleNovaAsk}
            className="relative w-full md:w-96"
          >
            <div className="flex items-center overflow-hidden rounded-lg border border-cyan-200 bg-white p-1 shadow-sm focus-within:ring-2 focus-within:ring-cyan-500/20">
              <div className="ml-1 rounded-md bg-slate-950 p-2 text-cyan-400">
                <Sparkles size={18} aria-hidden="true" />
              </div>
              <input
                type="text"
                value={aiInput}
                onChange={(event) => setAiInput(event.target.value)}
                placeholder="Ask Nova to audit compliance..."
                aria-label="Ask Nova about workers"
                className="min-w-0 flex-1 border-none bg-transparent px-3 py-2 text-sm font-semibold outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!aiInput.trim()}
                className="px-3 text-xs font-black uppercase text-cyan-700 transition-colors hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ask
              </button>
            </div>
          </form>
        </header>

        <section className="mb-7 grid grid-cols-1 gap-5 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setAlertsOnly((current) => !current)}
            aria-pressed={alertsOnly}
            className={`flex min-h-24 flex-col justify-center rounded-lg border bg-white p-5 text-left shadow-sm transition-colors ${
              alertsOnly
                ? 'border-rose-300 ring-2 ring-rose-100'
                : 'border-slate-200 hover:border-rose-200'
            }`}
          >
            <span className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Compliance Alerts
            </span>
            <span className="flex items-center gap-2 text-3xl font-black text-slate-900">
              <ShieldCheck
                size={24}
                className={
                  summary.complianceAlerts > 0
                    ? 'text-rose-500'
                    : 'text-emerald-500'
                }
                aria-hidden="true"
              />
              {summary.complianceAlerts}
            </span>
          </button>

          <div className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end lg:col-span-3">
            <label className="min-w-0 flex-1">
              <span className="mb-2 block px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Worker Status
              </span>
              <span className="relative block">
                <select
                  value={selectedStatus}
                  onChange={(event) => {
                    setSelectedStatus(
                      event.target.value as WorkerStatusFilter,
                    )
                    setAlertsOnly(false)
                  }}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-10 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
              </span>
            </label>

            <label className="min-w-0 flex-[1.25]">
              <span className="mb-2 block px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Quick Search
              </span>
              <span className="relative block">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setAlertsOnly(false)
                  }}
                  placeholder="Worker name, CWS ID, or role..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10"
                />
              </span>
            </label>

            <button
              type="button"
              onClick={resetFilters}
              className="flex h-10 items-center justify-center gap-2 px-2 text-xs font-bold text-slate-500 transition-colors hover:text-rose-600"
            >
              <X size={14} aria-hidden="true" />
              Reset
            </button>
          </div>
        </section>

        {alertsOnly ? (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">
            <span>Showing workers with active compliance alerts</span>
            <button
              type="button"
              onClick={() => setAlertsOnly(false)}
              aria-label="Clear compliance alert filter"
              className="rounded-md p-1 hover:bg-rose-100"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/90">
                  <th className="px-7 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Worker Information
                  </th>
                  <th className="px-7 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    IDs &amp; Type
                  </th>
                  <th className="px-7 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Lifecycle
                  </th>
                  <th className="px-7 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Compliance Status
                  </th>
                  <th className="px-7 py-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && workers.length === 0 ? <LoadingRows /> : null}
                {!loading && loadError ? (
                  <tr className="border-t border-slate-100">
                    <td colSpan={5} className="px-6 py-14 text-center">
                      <AlertTriangle
                        size={24}
                        className="mx-auto mb-3 text-rose-500"
                      />
                      <p className="font-bold text-slate-900">
                        Worker directory unavailable
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {loadError}
                      </p>
                      <button
                        type="button"
                        onClick={() => setReloadKey((value) => value + 1)}
                        className="mx-auto mt-4 flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw size={14} />
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : null}
                {!loading && !loadError && visibleWorkers.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td colSpan={5} className="px-6 py-14 text-center">
                      <UsersRound
                        size={26}
                        className="mx-auto mb-3 text-slate-300"
                      />
                      <p className="font-bold text-slate-900">
                        No workers match these filters
                      </p>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-2 text-sm font-bold text-cyan-700 hover:text-cyan-900"
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : null}
                {visibleWorkers.map((worker) => {
                  const compliance =
                    COMPLIANCE_STYLES[worker.complianceStatus]
                  return (
                    <tr
                      key={worker.workerId}
                      tabIndex={0}
                      onClick={() => openWorker(worker)}
                      onKeyDown={(event) =>
                        handleRowKeyDown(event, worker)
                      }
                      className="group cursor-pointer border-t border-slate-100 transition-colors hover:bg-cyan-50/40 focus:bg-cyan-50/40 focus:outline-none"
                    >
                      <td className="px-7 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-black text-slate-600">
                            {workerInitials(worker.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-black text-slate-900">
                              {worker.name}
                            </div>
                            <div className="truncate text-[10px] font-black uppercase text-cyan-700">
                              {worker.role || 'Role not assigned'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <div className="text-[10px] font-black uppercase text-slate-400">
                          {worker.cwsId}
                        </div>
                        <div className="text-xs font-bold text-slate-800">
                          {worker.workerTypeLabel || 'Not assigned'}
                        </div>
                        <div className="text-[10px] font-medium text-slate-400">
                          {worker.supplier
                            ? `via ${worker.supplier}`
                            : 'Direct'}
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_STYLES[worker.workerStatus]}`}
                        >
                          {titleCase(worker.workerStatus)}
                        </span>
                        <div className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                          Ends: {formatDate(worker.endDate)}
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <span
                          className={`inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-[10px] font-black uppercase shadow-sm ${compliance.badge}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${compliance.dot}`}
                          />
                          {compliance.label}
                        </span>
                      </td>
                      <td className="px-7 py-5 text-right">
                        <span className="inline-flex items-center gap-2 rounded-md bg-cyan-50 px-3 py-1.5 text-[10px] font-black uppercase text-cyan-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                          <Eye size={12} />
                          View Preview
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!loadError ? (
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs font-medium text-slate-500">
              <span>
                {alertsOnly
                  ? `${visibleWorkers.length} alert records`
                  : `${resultCount} workers`}
              </span>
              <span>{summary.totalWorkers} total workforce records</span>
            </footer>
          ) : null}
        </section>
      </div>

      {selectedRecord && displayDetail ? (
        <>
          <button
            type="button"
            aria-label="Close worker preview"
            onClick={closeDrawer}
            className="fixed inset-0 z-40 cursor-default bg-slate-950/45 backdrop-blur-sm"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`${displayDetail.name} worker preview`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-7">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xl font-black text-cyan-400 shadow-lg shadow-cyan-900/10">
                  {workerInitials(displayDetail.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black tracking-normal text-slate-900">
                    {displayDetail.name}
                  </h2>
                  <p className="truncate text-xs font-black uppercase text-cyan-700">
                    {displayDetail.role || 'Role not assigned'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close worker preview"
                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={21} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 sm:p-7">
              {detailLoading ? (
                <div className="mb-5 flex items-center gap-2 text-xs font-bold text-slate-500">
                  <LoaderCircle size={15} className="animate-spin" />
                  Refreshing worker record
                </div>
              ) : null}
              {detailError ? (
                <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-bold text-rose-900">
                    {detailError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="mt-2 flex items-center gap-2 text-xs font-black text-rose-700"
                  >
                    <RefreshCw size={13} />
                    Retry
                  </button>
                </div>
              ) : null}
              {drawerFeedback ? (
                <div
                  aria-live="polite"
                  className={`mb-5 flex items-start gap-3 rounded-lg border p-4 ${
                    drawerFeedback.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {drawerFeedback.tone === 'success' ? (
                    <CheckCircle2 size={18} className="shrink-0" />
                  ) : (
                    <AlertTriangle size={18} className="shrink-0" />
                  )}
                  <p className="text-sm font-bold">
                    {drawerFeedback.message}
                  </p>
                </div>
              ) : null}

              {displayDetail.complianceStatus !== 'compliant' ? (
                <div
                  className={`mb-6 flex gap-3 rounded-lg border p-4 ${
                    displayDetail.complianceStatus === 'non_compliant'
                      ? 'border-rose-200 bg-rose-50 text-rose-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <AlertTriangle size={19} className="shrink-0" />
                  <div>
                    <p className="text-sm font-black">
                      {displayDetail.complianceStatus === 'non_compliant'
                        ? 'Compliance Action Required'
                        : 'Compliance Review Required'}
                    </p>
                    <p className="mt-0.5 text-xs font-medium">
                      Review the active lifecycle requirements before
                      granting or retaining worker access.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mb-7 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
                    <Fingerprint size={11} />
                    CWS ID
                  </p>
                  <p className="truncate text-base font-black text-slate-900">
                    {displayDetail.cwsId}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
                    <UsersRound size={11} />
                    HR ID
                  </p>
                  <p className="truncate text-base font-black text-slate-900">
                    {displayDetail.hrSystemId || 'Not assigned'}
                  </p>
                </div>
              </div>

              {workerDetail && workerDetail.assignments.length > 1 ? (
                <label className="mb-7 block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Assignment
                  </span>
                  <span className="relative block">
                    <select
                      value={displayDetail.workOrderId || ''}
                      onChange={(event) => {
                        setSelectedWorkOrderId(Number(event.target.value))
                        setDrawerFeedback(null)
                      }}
                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm font-bold text-slate-800 outline-none focus:border-cyan-400"
                    >
                      {workerDetail.assignments.map((assignment) => (
                        <option
                          key={assignment.workOrderId}
                          value={assignment.workOrderId}
                        >
                          {assignment.engagementNumber ||
                            assignment.workOrderNumber}{' '}
                          - {assignment.role || 'Unassigned role'}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </span>
                </label>
              ) : null}

              <section className="mb-7">
                <h3 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  <BriefcaseBusiness size={14} />
                  Assignment Brief
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-[10px] font-black uppercase text-slate-400">
                      Department
                    </dt>
                    <dd className="text-sm font-bold text-slate-900">
                      {displayDetail.department || 'Not assigned'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase text-slate-400">
                      Email
                    </dt>
                    <dd>
                      <a
                        href={`mailto:${displayDetail.email}`}
                        className="break-all text-sm font-bold text-cyan-700 hover:text-cyan-900"
                      >
                        {displayDetail.email}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase text-slate-400">
                      Location
                    </dt>
                    <dd className="text-sm font-bold text-slate-900">
                      {displayDetail.location || 'Not assigned'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="grid grid-cols-1 gap-7 border-t border-slate-100 pt-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <UserRound size={14} />
                    Management
                  </h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Supplier
                      </dt>
                      <dd className="text-sm font-bold text-slate-900">
                        {displayDetail.supplier || 'Direct'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Owner
                      </dt>
                      <dd className="text-sm font-bold text-slate-900">
                        {displayDetail.owner || 'Not assigned'}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <CalendarDays size={14} />
                    Contract Dates
                  </h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        Start Date
                      </dt>
                      <dd className="text-sm font-bold text-slate-900">
                        {formatDate(displayDetail.startDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-black uppercase text-slate-400">
                        End Date
                      </dt>
                      <dd className="text-sm font-bold text-rose-600">
                        {formatDate(displayDetail.endDate)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>

              <div className="mt-7 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={!displayDetail.permissions.canViewProfile}
                  onClick={() =>
                    router.push(profileDestination(displayDetail))
                  }
                  className="group flex w-full items-center justify-center gap-3 rounded-lg bg-slate-950 py-3.5 text-sm font-black text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  View Full Worker Profile
                  <ArrowRight
                    size={17}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={
                      !displayDetail.permissions.canExtendContract ||
                      detailLoading
                    }
                    onClick={openExtension}
                    title="Extend contract"
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CalendarDays size={14} />
                    Extend Contract
                  </button>
                  <button
                    type="button"
                    disabled={
                      !displayDetail.permissions.canOffboard ||
                      detailLoading
                    }
                    onClick={() => {
                      if (displayDetail.offboardingRunId) {
                        void handleOffboardWorker()
                      } else {
                        setOffboardOpen(true)
                      }
                    }}
                    title={
                      displayDetail.offboardingRunId
                        ? 'View offboarding'
                        : 'Offboard worker'
                    }
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-3 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <UserX size={14} />
                    {displayDetail.offboardingRunId
                      ? 'View Offboarding'
                      : 'Offboard Worker'}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}

      {extendOpen && displayDetail ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="extend-contract-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="extend-contract-title"
                  className="font-black text-slate-900"
                >
                  Extend Contract
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  Current end date: {formatDate(displayDetail.endDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExtendOpen(false)}
                aria-label="Close contract extension"
                className="rounded-md p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </header>
            <form onSubmit={handleExtendContract} className="p-5">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  New End Date
                </span>
                <input
                  type="date"
                  required
                  min={minimumExtensionDate}
                  value={extensionEndDate}
                  onChange={(event) =>
                    setExtensionEndDate(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10"
                />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Notes
                </span>
                <textarea
                  rows={3}
                  value={extensionNotes}
                  onChange={(event) =>
                    setExtensionNotes(event.target.value)
                  }
                  placeholder="Reason or approval reference"
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10"
                />
              </label>
              {extensionError ? (
                <p
                  role="alert"
                  className="mt-3 text-sm font-bold text-rose-600"
                >
                  {extensionError}
                </p>
              ) : null}
              <footer className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setExtendOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extending}
                  className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-black disabled:cursor-wait disabled:opacity-60"
                >
                  {extending ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <CalendarDays size={14} />
                  )}
                  Confirm Extension
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {offboardOpen && displayDetail ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="offboard-worker-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <UserX size={20} />
            </div>
            <h2
              id="offboard-worker-title"
              className="text-lg font-black text-slate-900"
            >
              Offboard {displayDetail.name}?
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              This starts the configured offboarding workflow for{' '}
              {displayDetail.engagementNumber ||
                displayDetail.workOrderNumber}
              . Access-removal activities will follow the workflow gates.
            </p>
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setOffboardOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={offboarding}
                onClick={() => void handleOffboardWorker()}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
              >
                {offboarding ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <UserX size={14} />
                )}
                Start Offboarding
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
