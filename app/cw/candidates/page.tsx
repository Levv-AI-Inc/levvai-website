'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  UserCheck,
  TimerReset,
  UserRound,
  X,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CandidateApiError,
  getCandidates,
  updateCandidateStatus,
  type CandidateListPagination,
  type CandidateListSummary,
  type CandidateRecord,
  type CandidateStatus,
} from '@/lib/api/candidates'

const PAGE_SIZE = 25

const DEFAULT_PAGINATION: CandidateListPagination = {
  page: 1,
  page_size: PAGE_SIZE,
  total_count: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
}

const DEFAULT_SUMMARY: CandidateListSummary = {
  totalCount: 0,
  stalledCount: 0,
  statusCounts: {},
}

const STATUS_OPTIONS: Array<{
  value: 'all' | CandidateStatus
  label: string
}> = [
  { value: 'all', label: 'All stages' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewed', label: 'Interview / review' },
  { value: 'accepted', label: 'Selected' },
  { value: 'rejected', label: 'Rejected' },
]

function formatDate(value?: string) {
  if (!value) return 'Not provided'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatRate(candidate: CandidateRecord) {
  if (!candidate.proposedRate) return 'Not provided'
  const numeric = Number(candidate.proposedRate)
  const currency = candidate.currency || 'USD'
  const amount = Number.isFinite(numeric)
    ? new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(numeric)
    : `${currency} ${candidate.proposedRate}`
  const unit = candidate.rateUnit === 'daily' ? 'day' : 'hr'
  return `${amount}/${unit}`
}

function initials(name: string) {
  const value = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  return value || 'NA'
}

function statusLabel(status: CandidateStatus) {
  if (status === 'accepted') return 'Selected'
  if (status === 'reviewed') return 'Interview / Review'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusClasses(status: CandidateStatus) {
  if (status === 'accepted') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (status === 'reviewed') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (status === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function progressClasses(status: CandidateStatus) {
  if (status === 'accepted') return 'w-full bg-emerald-500'
  if (status === 'reviewed') return 'w-2/3 bg-cyan-500'
  if (status === 'rejected') return 'w-full bg-rose-500'
  return 'w-1/3 bg-slate-400'
}

function workOrderLabel(status: string) {
  if (!status) return 'No work order'
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function CandidateDrawer({
  candidate,
  canDecide,
  actionBusy,
  actionError,
  onClose,
  onStatusChange,
}: {
  candidate: CandidateRecord
  canDecide: boolean
  actionBusy: boolean
  actionError: string
  onClose: () => void
  onStatusChange: (
    candidate: CandidateRecord,
    status: Exclude<CandidateStatus, 'submitted'>,
  ) => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      <button
        type="button"
        aria-label="Close candidate details"
        className="fixed inset-0 z-40 cursor-default bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-drawer-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-base font-bold text-cyan-400">
              {initials(candidate.fullName)}
            </div>
            <div className="min-w-0">
              <h2
                id="candidate-drawer-title"
                className="truncate text-xl font-bold text-slate-950"
              >
                {candidate.fullName}
              </h2>
              <p className="mt-1 truncate text-xs font-semibold uppercase text-cyan-700">
                {candidate.roleName || candidate.intakeTitle || 'Candidate'}
              </p>
            </div>
          </div>
          <button
            type="button"
            title="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {candidate.daysInStage > 7 ? (
            <div className="mb-6 flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
              <TimerReset className="mt-0.5 shrink-0 text-rose-600" size={18} />
              <div>
                <p className="text-sm font-semibold text-rose-900">
                  Pipeline attention required
                </p>
                <p className="mt-1 text-xs leading-5 text-rose-700">
                  This candidate has remained {statusLabel(candidate.status).toLowerCase()} for{' '}
                  {candidate.daysInStage} days.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <CircleDollarSign size={12} /> Proposed rate
              </p>
              <p className="mt-2 text-base font-bold text-slate-950">
                {formatRate(candidate)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <Clock3 size={12} /> Current stage
              </p>
              <span
                className={`mt-2 inline-flex rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${statusClasses(candidate.status)}`}
              >
                {statusLabel(candidate.status)}
              </span>
            </div>
          </div>

          <section className="mt-7">
            <h3 className="text-[11px] font-bold uppercase text-slate-500">
              Core skills
            </h3>
            {candidate.skills.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {candidate.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No qualifications were attached to the job posting.
              </p>
            )}
          </section>

          <section className="mt-7">
            <h3 className="text-[11px] font-bold uppercase text-slate-500">
              Submission notes
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {candidate.notes || 'No submission notes provided.'}
            </p>
          </section>

          <section className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-200 pt-6">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <BriefcaseBusiness size={12} /> Supplier
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {candidate.supplierName || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <UserRound size={12} /> Hiring manager
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {candidate.hiringManagerName || 'Not assigned'}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <MapPin size={12} /> Location
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {candidate.location || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <CalendarDays size={12} /> Available
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {formatDate(candidate.availableStartDate)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <FileText size={12} /> Work order
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {candidate.workOrderNumber ||
                  workOrderLabel(candidate.workOrderStatus)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                <Mail size={12} /> Email
              </p>
              <a
                href={`mailto:${candidate.email}`}
                className="mt-1.5 block truncate text-sm font-semibold text-cyan-700 hover:underline"
              >
                {candidate.email}
              </a>
            </div>
          </section>
        </div>

        <footer className="border-t border-slate-200 bg-white p-6">
          {actionError ? (
            <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {actionError}
            </div>
          ) : null}
          {!canDecide && !candidate.workOrderId ? (
            <div className="mb-3 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-3">
              <p className="text-xs font-semibold text-cyan-900">
                Awaiting buyer review
              </p>
              <p className="mt-1 text-xs leading-5 text-cyan-800">
                An admin, business user, or program manager must start the
                review and select the candidate. Suppliers cannot select their
                own submissions.
              </p>
            </div>
          ) : null}
          {canDecide && !candidate.workOrderId ? (
            <div className="mb-3 grid gap-2">
              {candidate.status === 'reviewed' ? (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onStatusChange(candidate, 'accepted')}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserCheck size={16} />
                  {actionBusy ? 'Updating...' : 'Select candidate'}
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                {candidate.status === 'submitted' ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => onStatusChange(candidate, 'reviewed')}
                    className="flex h-10 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Start review
                  </button>
                ) : null}
                {candidate.status === 'rejected' ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => onStatusChange(candidate, 'reviewed')}
                    className="col-span-2 flex h-10 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reopen review
                  </button>
                ) : null}
                {candidate.status !== 'accepted' &&
                candidate.status !== 'rejected' ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => onStatusChange(candidate, 'rejected')}
                    className="flex h-10 items-center justify-center gap-2 rounded-md border border-rose-200 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Ban size={14} /> Reject
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <Link
            href={`/cw/job-postings/${candidate.intakeId}`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {candidate.status === 'accepted'
              ? 'Continue to job posting'
              : 'View job posting'}{' '}
            <ArrowRight size={16} />
          </Link>
          <div
            className={`mt-3 grid gap-3 ${
              candidate.workOrderId && candidate.resumeUrl
                ? 'grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            {candidate.workOrderId ? (
              <Link
                href={`/cw/work-orders/${candidate.workOrderId}`}
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Work order <ChevronRight size={15} />
              </Link>
            ) : null}
            {candidate.resumeUrl ? (
              <a
                href={candidate.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Resume <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </footer>
      </aside>
    </>
  )
}

export default function CandidatesPage() {
  const router = useRouter()
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [pagination, setPagination] =
    useState<CandidateListPagination>(DEFAULT_PAGINATION)
  const [summary, setSummary] =
    useState<CandidateListSummary>(DEFAULT_SUMMARY)
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateRecord | null>(null)
  const [status, setStatus] = useState<'all' | CandidateStatus>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [canDecide, setCanDecide] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    setActionError('')
  }, [selectedCandidate?.id])

  useEffect(() => {
    let cancelled = false

    async function loadCandidates() {
      setLoading(true)
      setError('')
      try {
        const response = await getCandidates({
          page,
          page_size: PAGE_SIZE,
          status: status === 'all' ? undefined : status,
          search,
        })
        if (cancelled) return
        setCandidates(response.results)
        setPagination(response.pagination)
        setSummary(response.summary)
        setCanDecide(response.permissions.canDecide)
        if (response.pagination.page !== page) {
          setPage(response.pagination.page)
        }
      } catch (loadError) {
        if (cancelled) return
        if (
          loadError instanceof CandidateApiError &&
          (loadError.status === 401 ||
            (loadError.status === 403 &&
              /authentication credentials|session is not valid/i.test(
                loadError.message,
              )))
        ) {
          router.replace('/auth/login?next=/cw/candidates')
          return
        }
        setCandidates([])
        setPagination(DEFAULT_PAGINATION)
        setSummary(DEFAULT_SUMMARY)
        setCanDecide(false)
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load candidates.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCandidates()
    return () => {
      cancelled = true
    }
  }, [page, reloadKey, router, search, status])

  const pageDescription = useMemo(() => {
    const total = summary.totalCount
    return `${total} candidate${total === 1 ? '' : 's'} across approved job postings.`
  }, [summary.totalCount])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
  }

  function resetFilters() {
    setSearchDraft('')
    setSearch('')
    setStatus('all')
    setPage(1)
  }

  async function handleStatusChange(
    candidate: CandidateRecord,
    nextStatus: Exclude<CandidateStatus, 'submitted'>,
  ) {
    setActionBusy(true)
    setActionError('')
    try {
      const updated = await updateCandidateStatus(candidate.id, nextStatus)
      setCandidates((current) =>
        current.map((record) => (record.id === updated.id ? updated : record)),
      )
      setSelectedCandidate(updated)
      setReloadKey((value) => value + 1)
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update candidate.',
      )
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header>
          <h1 className="text-3xl font-bold text-slate-950">Candidates</h1>
          <p className="mt-1 text-sm text-slate-500">{pageDescription}</p>
        </header>

        <section
          aria-label="Candidate filters"
          className="mt-7 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]"
        >
          <div className="flex min-h-24 items-center rounded-lg border border-slate-200 bg-white px-5 shadow-sm">
            <TimerReset
              size={23}
              className={
                summary.stalledCount ? 'text-rose-500' : 'text-emerald-500'
              }
            />
            <div className="ml-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">
                Stalled over 7 days
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {summary.stalledCount}
              </p>
            </div>
          </div>

          <form
            onSubmit={submitSearch}
            className="grid items-end gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(180px,0.8fr)_minmax(260px,1.4fr)_auto]"
          >
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase text-slate-500">
                Pipeline stage
              </span>
              <span className="relative block">
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as 'all' | CandidateStatus)
                    setPage(1)
                  }}
                  className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-3 text-slate-400"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase text-slate-500">
                Search candidates
              </span>
              <span className="relative block">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-3 text-slate-400"
                />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Name, email, role, supplier, or work order"
                  className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </span>
            </label>

            <div className="flex h-10 items-center gap-2">
              <button
                type="submit"
                className="flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Search
              </button>
              <button
                type="button"
                title="Reset filters"
                onClick={resetFilters}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <X size={16} />
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="w-[29%] px-6 py-4 text-[10px] font-bold uppercase text-slate-500">
                    Candidate
                  </th>
                  <th className="w-[20%] px-6 py-4 text-[10px] font-bold uppercase text-slate-500">
                    Rate and availability
                  </th>
                  <th className="w-[20%] px-6 py-4 text-[10px] font-bold uppercase text-slate-500">
                    Pipeline
                  </th>
                  <th className="w-[25%] px-6 py-4 text-[10px] font-bold uppercase text-slate-500">
                    Requisition
                  </th>
                  <th className="w-[6%] px-4 py-4">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <tr key={index} aria-hidden="true">
                        <td colSpan={5} className="px-6 py-5">
                          <div className="h-10 animate-pulse rounded-md bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : candidates.map((candidate) => (
                      <tr
                        key={candidate.id}
                        className="group cursor-pointer transition hover:bg-cyan-50/40"
                        onClick={() => setSelectedCandidate(candidate)}
                      >
                        <td className="px-6 py-5">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-800">
                              {initials(candidate.fullName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-950">
                                {candidate.fullName}
                              </p>
                              <p className="mt-1 truncate text-[10px] font-semibold uppercase text-cyan-700">
                                {candidate.roleName ||
                                  candidate.intakeTitle ||
                                  'Role not provided'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-slate-900">
                            {formatRate(candidate)}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold uppercase text-slate-500">
                            Start {formatDate(candidate.availableStartDate)}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${statusClasses(candidate.status)}`}
                            >
                              {statusLabel(candidate.status)}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                candidate.daysInStage > 7
                                  ? 'text-rose-600'
                                  : 'text-slate-400'
                              }`}
                            >
                              {candidate.daysInStage}d
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${progressClasses(candidate.status)}`}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {candidate.jobPostingId || `Job #${candidate.intakeId}`}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {candidate.supplierName || 'Supplier not provided'}
                            {candidate.hiringManagerName
                              ? ` · ${candidate.hiringManagerName}`
                              : ''}
                          </p>
                        </td>
                        <td className="px-4 py-5 text-right">
                          <button
                            type="button"
                            title={`View ${candidate.fullName}`}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition group-hover:bg-white group-hover:text-cyan-700"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedCandidate(candidate)
                            }}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {!loading && error ? (
            <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Candidates could not be loaded
              </p>
              <p className="mt-1 max-w-md text-sm text-slate-500">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={15} /> Retry
              </button>
            </div>
          ) : null}

          {!loading && !error && candidates.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <UserRound size={20} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">
                No candidates found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Candidate submissions will appear here after suppliers respond to
                approved job postings.
              </p>
              {search || status !== 'all' ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 text-sm font-semibold text-cyan-700 hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && pagination.total_pages > 1 ? (
            <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              <p className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.total_pages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  title="Previous page"
                  disabled={!pagination.has_previous}
                  onClick={() => setPage((value) => Math.max(value - 1, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  title="Next page"
                  disabled={!pagination.has_next}
                  onClick={() => setPage((value) => value + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </footer>
          ) : null}
        </section>
      </div>

      {selectedCandidate ? (
        <CandidateDrawer
          candidate={selectedCandidate}
          canDecide={canDecide}
          actionBusy={actionBusy}
          actionError={actionError}
          onClose={() => setSelectedCandidate(null)}
          onStatusChange={(candidate, nextStatus) =>
            void handleStatusChange(candidate, nextStatus)
          }
        />
      ) : null}
    </main>
  )
}
