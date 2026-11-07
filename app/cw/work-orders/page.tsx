'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Loader2,
  RotateCw,
  X,
} from 'lucide-react'
import { getEngagementStatusLabel } from '@/lib/api/engagements'
import {
  getWorkOrders,
  type WorkOrderListPagination,
  type WorkOrderRecord,
} from '@/lib/api/workOrders'
import {
  LevvEmptyState,
  LevvLifecycle,
  LevvNovaPrompt,
  LevvPage,
  LevvPageHeader,
  LevvSearchField,
  LevvStat,
  LevvStatStrip,
  LevvStatusBadge,
  LevvToolbar,
  levvUi,
  type LevvLifecycleStage,
  type LevvTone,
} from '@/components/ui/levv-app'

const LOAD_ERROR_FALLBACK = 'Unable to load work orders.'
// Eight columns share the row, so cells run a little tighter than the default; the outer edges keep 16px.
const th = `${levvUi.th.replace('px-4', 'px-3')} first:pl-4 last:pr-4`
const cell = `${levvUi.td.replace('px-4', 'px-3')} border-t border-[var(--line)] first:pl-4 last:pr-4`

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatMoney(amount?: string | null, currency?: string) {
  if (!amount?.trim()) return '-'

  const numeric = Number(amount)
  if (Number.isFinite(numeric) && currency?.trim()) {
    try {
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: currency.trim().toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric)
    } catch {
      return `${currency.trim().toUpperCase()} ${amount}`
    }
  }

  return amount
}

/** Status values arrive as snake_case or Title Case; badges read in sentence case. */
function toSentenceCase(value: string) {
  const text = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function statusTone(status: string | undefined): LevvTone {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'approved' || normalized === 'active') return 'emerald'
  if (normalized === 'submitted') return 'blue'
  if (normalized === 'rejected') return 'rose'
  if (normalized === 'closed') return 'slate'
  return 'amber'
}

function approvalStatusTone(status: string | undefined): LevvTone {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'approved') return 'emerald'
  if (normalized === 'processing') return 'blue'
  if (normalized === 'rejected') return 'rose'
  return 'slate'
}

function engagementStatusTone(status: string | null | undefined): LevvTone {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'accepted') return 'emerald'
  if (normalized === 'pending_supplier_acceptance') return 'blue'
  if (normalized === 'changes_requested') return 'amber'
  if (normalized === 'cancelled') return 'rose'
  return 'slate'
}

/** Where the work order stands on the operating record: requisition to offboarding. */
function workOrderLifecycle(workOrder: WorkOrderRecord): {
  stage: LevvLifecycleStage
  closed: boolean
  tone: 'blue' | 'amber' | 'rose'
} {
  const status = workOrder.status?.trim().toLowerCase()
  const approval = workOrder.approvalStatus?.trim().toLowerCase()
  const engagement = workOrder.engagementStatus?.trim().toLowerCase()

  if (status === 'closed') return { stage: 'Offboarding', closed: true, tone: 'blue' }
  if (status === 'active') return { stage: 'In engagement', closed: false, tone: 'blue' }
  if (status === 'rejected' || approval === 'rejected') {
    return { stage: 'Approval', closed: false, tone: 'rose' }
  }
  if (status === 'approved' || approval === 'approved') {
    return {
      stage: 'Onboarding',
      closed: false,
      tone:
        engagement === 'cancelled'
          ? 'rose'
          : engagement === 'changes_requested'
            ? 'amber'
            : 'blue',
    }
  }
  if (status === 'submitted' || approval === 'processing') {
    return { stage: 'Approval', closed: false, tone: 'blue' }
  }
  return { stage: 'Requisition', closed: false, tone: 'blue' }
}

const DEFAULT_PAGINATION: WorkOrderListPagination = {
  page: 1,
  page_size: 25,
  total_count: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [pagination, setPagination] =
    useState<WorkOrderListPagination>(DEFAULT_PAGINATION)
  const [reloadKey, setReloadKey] = useState(0)

  const filteredWorkOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return workOrders

    return workOrders.filter((workOrder) =>
      [
        workOrder.workOrderNumber,
        workOrder.engagementNumber,
        workOrder.workerFullName,
        workOrder.roleName,
        workOrder.supplierName,
        workOrder.intakeTitle,
        workOrder.status,
        workOrder.approvalStatus,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        ),
    )
  }, [searchTerm, workOrders])

  const workOrderStats = useMemo(() => {
    return filteredWorkOrders.reduce(
      (totals, workOrder) => {
        const status = workOrder.status?.trim().toLowerCase()
        const approvalStatus = workOrder.approvalStatus?.trim().toLowerCase()

        if (status === 'active' || status === 'approved') totals.active += 1
        if (approvalStatus === 'processing' || approvalStatus === 'submitted') {
          totals.awaitingApproval += 1
        }
        if (workOrder.workerFullName) totals.assignedWorkers += 1

        return totals
      },
      {
        active: 0,
        awaitingApproval: 0,
        assignedWorkers: 0,
      },
    )
  }, [filteredWorkOrders])

  useEffect(() => {
    let cancelled = false

    const loadWorkOrders = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await getWorkOrders({
          page,
          page_size: DEFAULT_PAGINATION.page_size,
        })
        if (cancelled) return

        setWorkOrders(response.results)
        setPagination(response.pagination)
        if (response.pagination.page !== page) {
          setPage(response.pagination.page)
        }
      } catch (loadError) {
        if (cancelled) return
        setWorkOrders([])
        setPagination(DEFAULT_PAGINATION)
        setError(
          loadError instanceof Error
            ? loadError.message
            : LOAD_ERROR_FALLBACK,
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadWorkOrders()

    return () => {
      cancelled = true
    }
  }, [page, reloadKey])

  // While loading or after a failed load the figures are unknown, not zero.
  const statsReady = !loading && !error
  const figure = (value: number) => (statsReady ? value : '–')
  const showRows = statsReady && filteredWorkOrders.length > 0

  return (
    <LevvPage width="wide">
      <div className="space-y-6">
        <LevvPageHeader
          title="Work Orders"
          description="Review work orders created from approved job postings and selected candidates."
          actions={
            <LevvNovaPrompt
              className="w-full sm:w-96"
              placeholder="Ask Nova about work order risk..."
              value={aiInput}
              onChange={setAiInput}
            />
          }
        />

        <LevvStatStrip>
          <LevvStat
            label="Current view"
            value={figure(filteredWorkOrders.length)}
            detail={statsReady ? `${pagination.total_count} total` : undefined}
          />
          <LevvStat label="Active" value={figure(workOrderStats.active)} />
          <LevvStat
            label="Awaiting approval"
            value={figure(workOrderStats.awaitingApproval)}
          />
          <LevvStat
            label="Assigned workers"
            value={figure(workOrderStats.assignedWorkers)}
          />
        </LevvStatStrip>

        <section aria-label="Work orders" className="space-y-3">
          <LevvToolbar>
            <LevvSearchField
              className="w-full sm:w-80"
              placeholder="Worker, supplier, role, work order..."
              aria-label="Search work orders"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={levvUi.ghostButton}
              >
                <X />
                Reset
              </button>
            ) : null}
          </LevvToolbar>

          <div className={levvUi.tableShell}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left">
                <thead className={showRows ? undefined : 'max-sm:hidden'}>
                  <tr>
                    <th className={th}>Work order</th>
                    <th className={th}>Worker / role</th>
                    <th className={th}>Supplier</th>
                    <th className={th}>Commercials</th>
                    <th className={th}>Lifecycle</th>
                    <th className={th}>Approval</th>
                    <th className={th}>Updated</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>
                {showRows ? (
                  <tbody>
                    {filteredWorkOrders.map((workOrder) => {
                      const lifecycle = workOrderLifecycle(workOrder)

                      return (
                        <tr key={workOrder.id} className="group">
                          <td className={cell}>
                            <div className="font-medium tabular-nums text-slate-950">
                              {workOrder.workOrderNumber ||
                                `WO-${String(workOrder.id)}`}
                            </div>
                            <div className="mt-0.5 max-w-[160px] truncate text-xs text-slate-500">
                              {workOrder.intakeTitle ||
                                (workOrder.intake
                                  ? `Intake #${String(workOrder.intake)}`
                                  : 'Work order')}
                            </div>
                            {workOrder.engagementId ? (
                              <div className="mt-0.5 text-xs tabular-nums text-slate-500">
                                {workOrder.engagementNumber ||
                                  `ENG-${String(workOrder.engagementId)}`}
                              </div>
                            ) : null}
                          </td>
                          <td className={cell}>
                            <div className="max-w-[160px] truncate font-medium text-slate-900">
                              {workOrder.workerFullName || '-'}
                            </div>
                            <div className="mt-0.5 max-w-[160px] truncate text-xs text-slate-500">
                              {workOrder.roleName || '-'}
                            </div>
                          </td>
                          <td className={cell}>
                            <div className="max-w-[130px] truncate">
                              {workOrder.supplierName || '-'}
                            </div>
                          </td>
                          <td className={`${cell} tabular-nums`}>
                            <div className="whitespace-nowrap text-slate-900">
                              {formatMoney(workOrder.billRate, workOrder.currency)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              Estimated: {formatMoney(workOrder.estimatedCost, workOrder.currency)}
                            </div>
                          </td>
                          <td className={cell}>
                            <div className="min-w-[208px]">
                              <LevvLifecycle
                                stage={lifecycle.stage}
                                closed={lifecycle.closed}
                                tone={lifecycle.tone}
                              />
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <LevvStatusBadge tone={statusTone(workOrder.status)}>
                                  {toSentenceCase(workOrder.status || 'draft')}
                                </LevvStatusBadge>
                                {workOrder.engagementId ? (
                                  <LevvStatusBadge
                                    tone={engagementStatusTone(workOrder.engagementStatus)}
                                  >
                                    {toSentenceCase(
                                      getEngagementStatusLabel(
                                        (workOrder.engagementStatus ||
                                          'pending_supplier_acceptance') as Parameters<
                                          typeof getEngagementStatusLabel
                                        >[0],
                                      ),
                                    )}
                                  </LevvStatusBadge>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className={cell}>
                            <LevvStatusBadge
                              tone={approvalStatusTone(workOrder.approvalStatus)}
                            >
                              {toSentenceCase(workOrder.approvalStatus || 'not_started')}
                            </LevvStatusBadge>
                            <div className="mt-1.5 text-xs text-slate-500">
                              {workOrder.currentApproverName
                                ? `Current approver: ${workOrder.currentApproverName}`
                                : `${workOrder.approvalsRemaining || 0} approvals remaining`}
                            </div>
                          </td>
                          <td className={`${cell} whitespace-nowrap tabular-nums`}>
                            {formatDate(workOrder.updatedAt)}
                          </td>
                          <td className={`${cell} text-right`}>
                            <Link
                              href={`/cw/work-orders/${encodeURIComponent(
                                String(workOrder.id),
                              )}`}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-blue-700 outline-none transition-colors duration-150 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                            >
                              Open
                              <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
                            </Link>
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
                Loading work orders
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
            ) : filteredWorkOrders.length === 0 ? (
              <div className="border-[var(--line)] sm:border-t">
                <LevvEmptyState icon={ClipboardList} title="No work orders found">
                  No work orders matched the current search.
                </LevvEmptyState>
              </div>
            ) : (
              <div className="flex flex-col gap-3 border-t border-[var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] tabular-nums text-slate-500">
                  Page {pagination.page} of{' '}
                  {Math.max(pagination.total_pages, 1)}
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
            )}
          </div>
        </section>
      </div>
    </LevvPage>
  )
}
