'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { getEngagementStatusLabel } from '@/lib/api/engagements'
import {
  getWorkOrders,
  type WorkOrderListPagination,
  type WorkOrderRecord,
} from '@/lib/api/workOrders'

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

function statusClasses(status: string | undefined) {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'approved' || normalized === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'submitted') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (normalized === 'rejected' || normalized === 'closed') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function approvalStatusClasses(status: string | undefined) {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'processing') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (normalized === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function engagementStatusClasses(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'accepted') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'pending_supplier_acceptance') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (normalized === 'changes_requested') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (normalized === 'cancelled') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
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
  const [pagination, setPagination] =
    useState<WorkOrderListPagination>(DEFAULT_PAGINATION)

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
            : 'Unable to load work orders.',
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
  }, [page])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Work Orders
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review work orders created from approved job postings and selected
            candidates.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {pagination.total_count} total work orders
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading work orders
          </div>
        ) : error ? (
          <div className="px-6 py-16 text-center text-sm text-rose-600">
            {error}
          </div>
        ) : workOrders.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No work orders have been created yet.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Work Order</th>
                    <th className="px-5 py-3 font-medium">Worker</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Supplier</th>
                    <th className="px-5 py-3 font-medium">Commercials</th>
                    <th className="px-5 py-3 font-medium">Approval</th>
                    <th className="px-5 py-3 font-medium">Updated</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workOrders.map((workOrder) => (
                    <tr
                      key={workOrder.id}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="font-medium text-slate-900">
                          {workOrder.workOrderNumber ||
                            `WO-${String(workOrder.id)}`}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {workOrder.intakeTitle ||
                            (workOrder.intake
                              ? `Intake #${String(workOrder.intake)}`
                              : 'Work order')}
                        </div>
                        {workOrder.engagementId ? (
                          <div className="mt-2 text-xs font-medium text-slate-600">
                            {workOrder.engagementNumber ||
                              `ENG-${String(workOrder.engagementId)}`}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 align-top text-slate-700">
                        {workOrder.workerFullName || '-'}
                      </td>
                      <td className="px-5 py-4 align-top text-slate-700">
                        {workOrder.roleName || '-'}
                      </td>
                      <td className="px-5 py-4 align-top text-slate-700">
                        {workOrder.supplierName || '-'}
                      </td>
                      <td className="px-5 py-4 align-top text-slate-700">
                        <div>{formatMoney(workOrder.billRate, workOrder.currency)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Estimated: {formatMoney(workOrder.estimatedCost, workOrder.currency)}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                              workOrder.status,
                            )}`}
                          >
                            {workOrder.status || 'draft'}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${approvalStatusClasses(
                              workOrder.approvalStatus,
                            )}`}
                          >
                            {workOrder.approvalStatus || 'not_started'}
                          </span>
                          {workOrder.engagementId ? (
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${engagementStatusClasses(
                                workOrder.engagementStatus,
                              )}`}
                            >
                              {getEngagementStatusLabel(
                                (workOrder.engagementStatus ||
                                  'pending_supplier_acceptance') as Parameters<
                                  typeof getEngagementStatusLabel
                                >[0],
                              )}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {workOrder.currentApproverName
                            ? `Current approver: ${workOrder.currentApproverName}`
                            : `${workOrder.approvalsRemaining || 0} approvals remaining`}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top text-slate-700">
                        {formatDate(workOrder.updatedAt)}
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/cw/work-orders/${encodeURIComponent(
                              String(workOrder.id),
                            )}`}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            Open
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-slate-500">
                Page {pagination.page} of{' '}
                {Math.max(pagination.total_pages, 1)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={!pagination.has_previous}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!pagination.has_next}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
