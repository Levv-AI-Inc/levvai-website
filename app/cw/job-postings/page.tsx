'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Contingent Job Postings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review approved and in-flight job postings assigned to your
            supplier, then submit the selected candidate after final approval.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-14 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading job postings
          </div>
        ) : error ? (
          <div className="px-6 py-6 text-sm text-rose-700">{error}</div>
        ) : requests.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            No job postings matched the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Request</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Rate / Budget</th>
                  <th className="px-5 py-3 font-medium">Approval</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 align-top">
                      <div className="font-medium text-slate-900">
                        {request.title || request.roleDefinitionName || '-'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {request.requestId || `INT-${request.id}`} ·{' '}
                        {toTitleCase(request.engagementType)}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-slate-700">
                      {request.roleDefinitionName || '-'}
                    </td>
                    <td className="px-5 py-4 align-top text-slate-700">
                      {request.supplierName || '-'}
                    </td>
                    <td className="px-5 py-4 align-top text-slate-700">
                      {request.workLocationLabel ||
                        [request.city, request.stateProvince, request.country]
                          .filter(Boolean)
                          .join(', ') ||
                        '-'}
                    </td>
                    <td className="px-5 py-4 align-top text-slate-700">
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
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        <StatusBadge value={request.status} />
                        <StatusBadge value={request.approvalStatus} />
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-slate-700">
                      {formatDate(request.updatedAt || request.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      <Link
                        href={`/cw/job-postings/${encodeURIComponent(
                          String(request.id),
                        )}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
  )
}
