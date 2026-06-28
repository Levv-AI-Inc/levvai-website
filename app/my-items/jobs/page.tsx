'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  ChevronDown,
  Loader2,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import {
  IntakeApiError,
  getIntakeById,
  getIntakes,
  type IntakeListPagination,
  type IntakeRecord,
} from '@/lib/api/intake'
import { useCWRequest } from '../../requests/new/job/context/CWRequestContext'
import {
  buildCWRequestFromIntake,
  getResumePathForDraft,
} from '@/lib/cwRequestDraft'

function toTitleCase(value: string | undefined) {
  if (!value) return '-'
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatMoney(amount?: string, currency?: string, unit?: string) {
  if (!amount?.trim()) return '-'

  const numeric = Number(amount)
  if (Number.isFinite(numeric) && currency?.trim()) {
    try {
      const formatted = new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: currency.trim().toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric)
      return unit ? `${formatted}/${unit}` : formatted
    } catch {
      return `${currency.trim().toUpperCase()} ${amount}`
    }
  }

  return unit ? `${amount}/${unit}` : amount
}

function statusClasses(status: string | undefined) {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'submitted' || normalized === 'processing') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (normalized === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  if (normalized === 'draft') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function StatusBadge({ value }: { value?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
        value,
      )}`}
    >
      {toTitleCase(value)}
    </span>
  )
}

export default function MyJobPostingsPage() {
  const router = useRouter()
  const { replace } = useCWRequest()
  const [requests, setRequests] = useState<IntakeRecord[]>([])
  const [pagination, setPagination] = useState<IntakeListPagination>({
    page: 1,
    page_size: 25,
    total_count: 0,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [resumingRequestId, setResumingRequestId] = useState<
    number | null
  >(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [aiInput, setAiInput] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadRequests = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await getIntakes({
          mine: true,
          status: statusFilter || undefined,
          page,
          page_size: pageSize,
        })
        if (cancelled) return
        setRequests(response.results)
        setPagination(response.pagination)
        if (response.pagination.page !== page) {
          setPage(response.pagination.page)
        }
      } catch (error) {
        if (cancelled) return

        if (error instanceof IntakeApiError && error.status === 401) {
          router.replace('/auth/login?next=/my-items/jobs')
          return
        }

        setError(
          error instanceof Error
            ? error.message
            : 'Unable to load your job postings.',
        )
        setRequests([])
        setPagination({
          page: 1,
          page_size: pageSize,
          total_count: 0,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        })
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRequests()

    return () => {
      cancelled = true
    }
  }, [page, pageSize, router, statusFilter])

  const handleResumeDraft = async (request: IntakeRecord) => {
    setResumeError('')
    setResumingRequestId(request.id)

    try {
      const intake = await getIntakeById(request.id)
      replace(buildCWRequestFromIntake(intake))
      router.push(getResumePathForDraft(intake))
    } catch (error) {
      if (error instanceof IntakeApiError && error.status === 401) {
        router.replace('/auth/login?next=/my-items/jobs')
        return
      }

      setResumeError(
        error instanceof Error
          ? error.message
          : 'Unable to resume this draft request.',
      )
    } finally {
      setResumingRequestId(null)
    }
  }

  const startRow =
    pagination.total_count === 0
      ? 0
      : (pagination.page - 1) * pagination.page_size + 1
  const endRow =
    pagination.total_count === 0
      ? 0
      : startRow + requests.length - 1

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return requests

    return requests.filter((request) =>
      [
        request.title,
        request.requestId,
        request.roleDefinitionName,
        request.description,
        request.status,
        request.approvalStatus,
        request.supplierName,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        ),
    )
  }, [requests, searchTerm])

  const pageStats = useMemo(() => {
    return filteredRequests.reduce(
      (totals, request) => {
        const status = request.status?.trim().toLowerCase()
        const approval = request.approvalStatus?.trim().toLowerCase()

        if (status === 'draft') totals.drafts += 1
        if (status === 'submitted' || approval === 'processing') {
          totals.inFlight += 1
        }
        if (status === 'approved') totals.approved += 1

        return totals
      },
      {
        drafts: 0,
        inFlight: 0,
        approved: 0,
      },
    )
  }, [filteredRequests])

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              My Job Postings
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Review your request details, approval routing, and current
              approval progress.
            </p>
          </div>

          <div className="group relative w-full md:w-96">
            <div className="absolute inset-0 rounded-3xl bg-cyan-400/10 blur-xl transition-all group-hover:bg-cyan-400/20" />
            <div className="relative flex items-center overflow-hidden rounded-2xl border border-cyan-100 bg-white p-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-cyan-400/30">
              <div className="ml-1 rounded-xl bg-slate-950 p-2.5 text-cyan-400 shadow-lg shadow-cyan-900/10">
                <Sparkles className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={aiInput}
                onChange={(event) => setAiInput(event.target.value)}
                placeholder="Ask Nova about your postings..."
                className="flex-1 border-none bg-transparent px-3 py-2 text-sm font-semibold placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                className="pr-3 text-xs font-bold uppercase text-cyan-600 transition-colors hover:text-cyan-700"
              >
                Ask
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="flex flex-col justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Total requests
              </span>
              <BarChart3 className="h-5 w-5 text-cyan-500" />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {pagination.total_count}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-400">
              {pagination.total_count > 0
                ? `Showing ${startRow}-${endRow} of ${pagination.total_count}`
                : 'No requests found'}
            </div>
          </div>

          {[
            ['Drafts', pageStats.drafts],
            ['In flight', pageStats.inFlight],
            ['Approved', pageStats.approved],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {label}
              </span>
              <div className="mt-2 text-3xl font-black text-slate-900">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
            <div className="group relative">
              <label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Search requests
              </label>
              <Search className="absolute bottom-3 left-4 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-cyan-500" />
              <input
                className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-11 pr-4 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400"
                placeholder="Title, role, ID, supplier..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <label className="block text-sm text-slate-600">
              <span className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Status
              </span>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value)
                    setPage(1)
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all focus:ring-2 focus:ring-cyan-400 md:w-44"
                >
                  <option value="">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label className="block text-sm text-slate-600">
              <span className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Rows
              </span>
              <div className="relative">
                <select
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(1)
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all focus:ring-2 focus:ring-cyan-400 md:w-32"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('')
                setPageSize(25)
                setPage(1)
              }}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition-colors hover:text-rose-500"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {resumeError ? (
          <div className="mx-6 mt-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
            {resumeError}
          </div>
        ) : null}
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-8 py-16 text-sm font-medium text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading requests...
          </div>
        ) : error ? (
          <div className="m-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <div className="text-base font-bold text-slate-900">
              No job posting requests yet
            </div>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Submitted and draft staffing requests will appear here or match
              your current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Request</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Role</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Approval</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Rate / Budget</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Updated</th>
                  <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((request) => {
                  const requestLabel =
                    request.requestId || `INT-${request.id}`
                  const roleLabel =
                    request.roleDefinitionName ||
                    request.title ||
                    request.description ||
                    '-'
                  const isDraft =
                    request.status?.trim().toLowerCase() === 'draft'
                  const isResuming =
                    resumingRequestId === request.id

                  return (
                    <tr
                      key={request.id}
                      className="group transition-all hover:bg-cyan-50/40"
                    >
                      <td className="px-8 py-6 align-top">
                        <div className="mb-1.5 w-fit rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-black uppercase leading-none text-cyan-600">
                          {requestLabel}
                        </div>
                        <div className="font-bold leading-tight text-slate-900">
                          {request.title || roleLabel}
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-400">
                          {toTitleCase(request.engagementType)}
                        </div>
                      </td>
                      <td className="px-8 py-6 align-top font-semibold text-slate-700">
                        {roleLabel}
                      </td>
                      <td className="px-8 py-6 align-top">
                        <StatusBadge value={request.status} />
                      </td>
                      <td className="px-8 py-6 align-top">
                        <StatusBadge value={request.approvalStatus} />
                      </td>
                      <td className="px-8 py-6 align-top text-slate-700">
                        <div>
                          {formatMoney(
                            request.billRate || request.targetRate,
                            request.currency,
                            request.rateCardPricing?.unit || request.rateUnit,
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Budget:{' '}
                          {formatMoney(
                            request.budgetAmount,
                            request.currency,
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 align-top text-slate-700">
                        {formatDate(
                          request.updatedAt ||
                            request.submittedAt ||
                            request.createdAt,
                        )}
                      </td>
                      <td className="px-8 py-6 align-top text-right">
                        {isDraft ? (
                          <button
                            type="button"
                            onClick={() => void handleResumeDraft(request)}
                            disabled={isResuming}
                            className="inline-flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-700 transition hover:border-cyan-200 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isResuming ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Resuming
                              </>
                            ) : (
                              <>
                                Resume
                                <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        ) : (
                          <Link
                            href={`/my-items/jobs/${encodeURIComponent(
                              String(request.id),
                            )}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-700 opacity-100 transition hover:border-cyan-200 hover:bg-cyan-100 lg:opacity-0 lg:group-hover:opacity-100"
                          >
                            Open
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && pagination.total_count > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-8 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              Page{' '}
              <span className="font-medium text-slate-900">
                {pagination.page}
              </span>{' '}
              of{' '}
              <span className="font-medium text-slate-900">
                {pagination.total_pages}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={!pagination.has_previous}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!pagination.has_next}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  )
}
