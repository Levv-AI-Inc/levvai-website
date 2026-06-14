'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          My Job Postings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review your request details, approval routing, and current
          approval progress.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-slate-600">
          {pagination.total_count > 0 ? (
            <>
              Showing{' '}
              <span className="font-medium text-slate-900">
                {startRow}-{endRow}
              </span>{' '}
              of{' '}
              <span className="font-medium text-slate-900">
                {pagination.total_count}
              </span>{' '}
              requests
            </>
          ) : (
            'No requests found'
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Rows</span>
            <select
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {resumeError ? (
          <div className="mx-6 mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {resumeError}
          </div>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-3 px-6 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading requests...
          </div>
        ) : error ? (
          <div className="m-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : requests.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="text-base font-medium text-slate-900">
              No job posting requests yet
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Submitted and draft staffing requests will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Request</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Approval</th>
                  <th className="px-6 py-4 font-medium">Rate / Budget</th>
                  <th className="px-6 py-4 font-medium">Updated</th>
                  <th className="px-6 py-4 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => {
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
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-5 align-top">
                        <div className="font-medium text-slate-900">
                          {request.title || roleLabel}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {requestLabel} •{' '}
                          {toTitleCase(request.engagementType)}
                        </div>
                      </td>
                      <td className="px-6 py-5 align-top text-slate-700">
                        {roleLabel}
                      </td>
                      <td className="px-6 py-5 align-top">
                        <StatusBadge value={request.status} />
                      </td>
                      <td className="px-6 py-5 align-top">
                        <StatusBadge value={request.approvalStatus} />
                      </td>
                      <td className="px-6 py-5 align-top text-slate-700">
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
                      <td className="px-6 py-5 align-top text-slate-700">
                        {formatDate(
                          request.updatedAt ||
                            request.submittedAt ||
                            request.createdAt,
                        )}
                      </td>
                      <td className="px-6 py-5 align-top text-right">
                        {isDraft ? (
                          <button
                            type="button"
                            onClick={() => void handleResumeDraft(request)}
                            disabled={isResuming}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
          <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
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
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!pagination.has_next}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
