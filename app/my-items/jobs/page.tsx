'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  FileText,
  Loader2,
  RotateCw,
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
import {
  LevvEmptyState,
  LevvNotice,
  LevvNovaPrompt,
  LevvPage,
  LevvPageHeader,
  LevvSearchField,
  LevvSelect,
  LevvStat,
  LevvStatStrip,
  LevvStatusBadge,
  LevvToolbar,
  levvUi,
  type LevvTone,
} from '@/components/ui/levv-app'

const LOAD_ERROR_FALLBACK = 'Unable to load your job postings.'
const cell = `${levvUi.td} border-t border-[var(--line)]`

function toTitleCase(value: string | undefined) {
  if (!value) return '-'
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function toSentenceCase(value: string) {
  const text = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
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

function statusTone(status: string | undefined): LevvTone {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'approved') return 'emerald'
  if (normalized === 'submitted' || normalized === 'processing') return 'blue'
  if (normalized === 'rejected') return 'rose'
  if (normalized === 'draft') return 'amber'
  return 'slate'
}

function StatusBadge({ value }: { value?: string }) {
  if (!value?.trim()) return <span className="text-slate-400">-</span>
  return (
    <LevvStatusBadge tone={statusTone(value)}>
      {toSentenceCase(value)}
    </LevvStatusBadge>
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
  const [reloadKey, setReloadKey] = useState(0)

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
            : LOAD_ERROR_FALLBACK,
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
  }, [page, pageSize, router, statusFilter, reloadKey])

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

  // While loading or after a failed load the figures are unknown, not zero.
  const statsReady = !loading && !error
  const figure = (value: number) => (statsReady ? value : '–')
  const canReset =
    searchTerm !== '' || statusFilter !== '' || pageSize !== 25 || page !== 1
  const showRows = statsReady && filteredRequests.length > 0

  return (
    <LevvPage width="wide">
      <div className="space-y-6">
        <LevvPageHeader
          title="My Job Postings"
          description="Review your request details, approval routing, and current approval progress."
          actions={
            <LevvNovaPrompt
              className="w-full sm:w-96"
              placeholder="Ask Nova about your postings..."
              value={aiInput}
              onChange={setAiInput}
            />
          }
        />

        <LevvStatStrip>
          <LevvStat
            label="Total requests"
            value={figure(pagination.total_count)}
            detail={
              statsReady
                ? pagination.total_count > 0
                  ? `Showing ${startRow}-${endRow} of ${pagination.total_count}`
                  : 'No requests found'
                : undefined
            }
          />
          <LevvStat label="Drafts" value={figure(pageStats.drafts)} />
          <LevvStat label="In flight" value={figure(pageStats.inFlight)} />
          <LevvStat label="Approved" value={figure(pageStats.approved)} />
        </LevvStatStrip>

        <section aria-label="Job postings" className="space-y-3">
          <LevvToolbar>
            <LevvSearchField
              className="w-full sm:w-72"
              placeholder="Title, role, ID, supplier..."
              aria-label="Search requests"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <LevvSelect
              className="w-full sm:w-44"
              aria-label="Status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </LevvSelect>
            {canReset ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('')
                  setPageSize(25)
                  setPage(1)
                }}
                className={levvUi.ghostButton}
              >
                <X />
                Reset
              </button>
            ) : null}
            <label className="ml-auto flex items-center gap-2 text-[13px] text-slate-500">
              Rows
              <LevvSelect
                className="w-20"
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </LevvSelect>
            </label>
          </LevvToolbar>

          {resumeError ? (
            <LevvNotice tone="rose" icon={AlertCircle}>
              {resumeError}
            </LevvNotice>
          ) : null}

          <div className={levvUi.tableShell}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left">
                <thead className={showRows ? undefined : 'max-sm:hidden'}>
                  <tr>
                    <th className={levvUi.th}>Request</th>
                    <th className={levvUi.th}>Role</th>
                    <th className={levvUi.th}>Status</th>
                    <th className={levvUi.th}>Approval</th>
                    <th className={levvUi.th}>Rate / budget</th>
                    <th className={levvUi.th}>Updated</th>
                    <th className={`${levvUi.th} text-right`}>Actions</th>
                  </tr>
                </thead>
                {showRows ? (
                  <tbody>
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
                        <tr key={request.id} className="group">
                          <td className={cell}>
                            <div className="max-w-[320px] truncate font-medium text-slate-950">
                              {request.title || roleLabel}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                              <span className="tabular-nums">{requestLabel}</span>
                              {request.engagementType ? (
                                <>
                                  <span aria-hidden className="text-slate-300">·</span>
                                  <span className="truncate">
                                    {toTitleCase(request.engagementType)}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </td>
                          <td className={cell}>
                            <div className="max-w-[220px] truncate">{roleLabel}</div>
                          </td>
                          <td className={cell}>
                            <StatusBadge value={request.status} />
                          </td>
                          <td className={cell}>
                            <StatusBadge value={request.approvalStatus} />
                          </td>
                          <td className={`${cell} tabular-nums`}>
                            <div className="text-slate-900">
                              {formatMoney(
                                request.billRate || request.targetRate,
                                request.currency,
                                request.rateCardPricing?.unit || request.rateUnit,
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              Budget:{' '}
                              {formatMoney(
                                request.budgetAmount,
                                request.currency,
                              )}
                            </div>
                          </td>
                          <td className={`${cell} whitespace-nowrap tabular-nums`}>
                            {formatDate(
                              request.updatedAt ||
                                request.submittedAt ||
                                request.createdAt,
                            )}
                          </td>
                          <td className={`${cell} text-right`}>
                            {isDraft ? (
                              <button
                                type="button"
                                onClick={() => void handleResumeDraft(request)}
                                disabled={isResuming}
                                className={levvUi.secondaryButton}
                              >
                                {isResuming ? (
                                  <>
                                    <Loader2 className="animate-spin" />
                                    Resuming
                                  </>
                                ) : (
                                  <>
                                    Resume
                                    <ArrowRight />
                                  </>
                                )}
                              </button>
                            ) : (
                              <Link
                                href={`/my-items/jobs/${encodeURIComponent(
                                  String(request.id),
                                )}`}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-blue-700 outline-none transition-colors duration-150 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                              >
                                Open
                                <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                ) : null}
              </table>
            </div>

            {loading ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2.5 border-[var(--line)] px-6 py-14 text-[13px] text-slate-500 sm:border-t"
              >
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                Loading requests...
              </div>
            ) : error ? (
              <div
                role="alert"
                className="flex flex-col items-center border-[var(--line)] px-6 py-14 text-center sm:border-t"
              >
                <AlertCircle className="h-5 w-5 text-rose-600" />
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {LOAD_ERROR_FALLBACK.replace(/\.$/, '')}
                </p>
                {error !== LOAD_ERROR_FALLBACK ? (
                  <p className="mt-1 max-w-sm text-[13px] text-slate-500">{error}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className={`${levvUi.secondaryButton} mt-4`}
                >
                  <RotateCw />
                  Try again
                </button>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="border-[var(--line)] sm:border-t">
                <LevvEmptyState icon={FileText} title="No job posting requests yet">
                  Submitted and draft staffing requests will appear here or match
                  your current filters.
                </LevvEmptyState>
              </div>
            ) : null}

            {statsReady && pagination.total_count > 0 ? (
              <div className="flex flex-col gap-3 border-t border-[var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] text-slate-500">
                  Page{' '}
                  <span className="font-medium tabular-nums text-slate-900">
                    {pagination.page}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium tabular-nums text-slate-900">
                    {pagination.total_pages}
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={!pagination.has_previous}
                    className={levvUi.secondaryButton}
                  >
                    <ArrowLeft />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={!pagination.has_next}
                    className={levvUi.secondaryButton}
                  >
                    Next
                    <ArrowRight />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </LevvPage>
  )
}
