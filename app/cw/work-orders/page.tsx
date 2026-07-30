'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
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

function supplierAcceptanceClasses(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'accepted') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'pending') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (normalized === 'changes_requested') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function supplierAcceptanceLabel(status?: string | null) {
  const normalized = status?.trim().toLowerCase()
  if (normalized === 'pending') return 'Supplier acceptance pending'
  if (normalized === 'accepted') return 'Supplier accepted'
  if (normalized === 'changes_requested') return 'Supplier requested changes'
  return 'Supplier response not started'
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
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Work Orders
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Review work orders created from approved job postings and selected
            candidates.
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
              placeholder="Ask Nova about work order risk..."
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
              Current view
            </span>
            <BarChart3 className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {filteredWorkOrders.length}
          </div>
          <div className="mt-1 text-xs font-medium text-slate-400">
            {pagination.total_count} total
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Active
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {workOrderStats.active}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Awaiting approval
            </span>
            <Clock3 className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {workOrderStats.awaitingApproval}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Assigned workers
            </span>
            <Users className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {workOrderStats.assignedWorkers}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end">
        <div className="group relative flex-1">
          <label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Search work orders
          </label>
          <Search className="absolute bottom-3 left-4 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-cyan-500" />
          <input
            className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-11 pr-4 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400"
            placeholder="Worker, supplier, role, work order..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setSearchTerm('')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition-colors hover:text-rose-500"
        >
          <X className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-8 py-16 text-sm font-medium text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading work orders
          </div>
        ) : error ? (
          <div className="m-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-center text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : filteredWorkOrders.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <div className="text-base font-bold text-slate-900">
              No work orders found
            </div>
            <p className="mt-2 text-sm font-medium text-slate-500">
              No work orders matched the current search.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Work Order</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Worker</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Role</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Supplier</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Commercials</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Approval</th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Updated</th>
                    <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWorkOrders.map((workOrder) => (
                    <tr
                      key={workOrder.id}
                      className="group transition-all hover:bg-cyan-50/40"
                    >
                      <td className="px-8 py-6 align-top">
                        <div className="mb-1.5 w-fit rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-black uppercase leading-none text-cyan-600">
                          {workOrder.workOrderNumber ||
                            `WO-${String(workOrder.id)}`}
                        </div>
                        <div className="text-xs font-medium text-slate-400">
                          {workOrder.intakeTitle ||
                            (workOrder.intake
                              ? `Intake #${String(workOrder.intake)}`
                              : 'Work order')}
                        </div>
                      </td>
                      <td className="px-8 py-6 align-top font-semibold text-slate-700">
                        {workOrder.workerFullName || '-'}
                      </td>
                      <td className="px-8 py-6 align-top text-slate-700">
                        {workOrder.roleName || '-'}
                      </td>
                      <td className="px-8 py-6 align-top font-semibold text-slate-700">
                        {workOrder.supplierName || '-'}
                      </td>
                      <td className="px-8 py-6 align-top text-slate-700">
                        <div>{formatMoney(workOrder.billRate, workOrder.currency)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Estimated: {formatMoney(workOrder.estimatedCost, workOrder.currency)}
                        </div>
                      </td>
                      <td className="px-8 py-6 align-top">
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
                          {workOrder.supplierAcceptanceStatus &&
                          workOrder.supplierAcceptanceStatus !==
                            'not_started' ? (
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${supplierAcceptanceClasses(
                                workOrder.supplierAcceptanceStatus,
                              )}`}
                            >
                              {supplierAcceptanceLabel(
                                workOrder.supplierAcceptanceStatus,
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
                      <td className="px-8 py-6 align-top text-slate-700">
                        {formatDate(workOrder.updatedAt)}
                      </td>
                      <td className="px-8 py-6 text-right align-top">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/cw/work-orders/${encodeURIComponent(
                              String(workOrder.id),
                            )}`}
                            className="inline-flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-700 opacity-100 transition hover:border-cyan-200 hover:bg-cyan-100 lg:opacity-0 lg:group-hover:opacity-100"
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

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-8 py-5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-slate-500">
                Page {pagination.page} of{' '}
                {Math.max(pagination.total_pages, 1)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={!pagination.has_previous}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!pagination.has_next}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  )
}
