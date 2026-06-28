'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import {
  IntakeApiError,
  getIntakes,
  type IntakeRecord,
} from '@/lib/api/intake'

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

export default function ContingentJobPostingsPage() {
  const [requests, setRequests] = useState<IntakeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('approved')
  const [searchTerm, setSearchTerm] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('All')
  const [aiInput, setAiInput] = useState('')

  const supplierOptions = useMemo(() => {
    return [
      'All',
      ...Array.from(
        new Set(
          requests
            .map((request) => request.supplierName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    ]
  }, [requests])

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return requests.filter((request) => {
      const supplierName = request.supplierName?.trim() || ''
      const matchesSupplier =
        supplierFilter === 'All' || supplierName === supplierFilter

      if (!matchesSupplier) return false
      if (!normalizedSearch) return true

      return [
        request.title,
        request.requestId,
        request.roleDefinitionName,
        request.supplierName,
        request.workLocationLabel,
        request.city,
        request.stateProvince,
        request.country,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        )
    })
  }, [requests, searchTerm, supplierFilter])

  const requestStats = useMemo(() => {
    return filteredRequests.reduce(
      (totals, request) => {
        const status = request.status?.trim().toLowerCase()
        const positions = Number(request.workerCount || 0)

        if (status === 'approved') totals.approved += 1
        if (status === 'submitted' || status === 'processing') totals.inFlight += 1
        if (Number.isFinite(positions)) totals.positions += positions

        return totals
      },
      {
        approved: 0,
        inFlight: 0,
        positions: 0,
      },
    )
  }, [filteredRequests])

  useEffect(() => {
    let cancelled = false

    const loadRequests = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await getIntakes({
          status: statusFilter || undefined,
          page: 1,
          page_size: 50,
        })

        if (cancelled) return
        setRequests(response.results)
      } catch (loadError) {
        if (cancelled) return

        setError(
          loadError instanceof IntakeApiError
            ? loadError.message
            : 'Unable to load job postings.',
        )
        setRequests([])
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
  }, [statusFilter])

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Contingent Job Postings
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Review approved and in-flight job postings assigned to your
            supplier, then submit the selected candidate after final approval.
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
              placeholder="Ask Nova to analyze postings..."
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
              Total vacancies
            </span>
            <BarChart3 className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {requestStats.positions}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Current view
            </span>
            <Briefcase className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {filteredRequests.length}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Approved
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {requestStats.approved}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              In flight
            </span>
            <Users className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {requestStats.inFlight}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-6">
          <div className="min-w-[220px] flex-1">
            <label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Supplier performance
            </label>
            <div className="relative">
              <select
                value={supplierFilter}
                onChange={(event) => setSupplierFilter(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all focus:ring-2 focus:ring-cyan-400"
              >
                {supplierOptions.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="min-w-[220px] flex-1">
            <label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Requisition status
            </label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-4 pr-10 text-sm font-bold text-slate-700 outline-none transition-all focus:ring-2 focus:ring-cyan-400"
              >
                <option value="">All statuses</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchTerm('')
              setSupplierFilter('All')
              setStatusFilter('approved')
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 transition-colors hover:text-rose-500"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="group relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-500" />
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-medium shadow-sm transition-all focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-400/10"
          placeholder="Search by role, ID, supplier, or location..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-8 py-16 text-sm font-medium text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading job postings
          </div>
        ) : error ? (
          <div className="m-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <div className="text-base font-bold text-slate-900">
              No job postings found
            </div>
            <p className="mt-2 text-sm font-medium text-slate-500">
            No job postings matched the current filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Request</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Role</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Supplier</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Location</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Rate / Budget</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Approval</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Updated</th>
                  <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="group transition-all hover:bg-cyan-50/40">
                    <td className="px-8 py-6 align-top">
                      <div className="mb-1.5 w-fit rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-black uppercase leading-none text-cyan-600">
                        {request.requestId || `INT-${request.id}`}
                      </div>
                      <div className="font-bold leading-tight text-slate-900">
                        {request.title || request.roleDefinitionName || '-'}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-400">
                        {toTitleCase(request.engagementType)}
                      </div>
                    </td>
                    <td className="px-8 py-6 align-top font-semibold text-slate-700">
                      {request.roleDefinitionName || '-'}
                    </td>
                    <td className="px-8 py-6 align-top font-semibold text-slate-700">
                      {request.supplierName || '-'}
                    </td>
                    <td className="px-8 py-6 align-top text-slate-600">
                      {request.workLocationLabel ||
                        [request.city, request.stateProvince, request.country]
                          .filter(Boolean)
                          .join(', ') ||
                        '-'}
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
                    <td className="px-8 py-6 align-top">
                      <div className="flex flex-col gap-2">
                        <StatusBadge value={request.status} />
                        <StatusBadge value={request.approvalStatus} />
                      </div>
                    </td>
                    <td className="px-8 py-6 align-top text-slate-700">
                      {formatDate(request.updatedAt || request.createdAt)}
                    </td>
                    <td className="px-8 py-6 text-right align-top">
                      <Link
                        href={`/cw/job-postings/${encodeURIComponent(
                          String(request.id),
                        )}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-700 opacity-100 transition hover:border-cyan-200 hover:bg-cyan-100 lg:opacity-0 lg:group-hover:opacity-100"
                      >
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
