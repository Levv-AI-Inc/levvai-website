'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import {
  ApprovalChainsApiError,
  deleteApprovalChain,
  getApprovalChains,
  type ApprovalChain,
} from '@/lib/api/approvalChains'

function formatTimestamp(value: string): string {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function strategyLabel(strategy: ApprovalChain['match_strategy']) {
  return strategy === 'any'
    ? 'Any condition'
    : 'All conditions'
}

function statusBadgeClass(isActive: boolean) {
  return isActive
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-200 text-slate-700'
}

export default function ApprovalChainsListPage() {
  const router = useRouter()
  const [chains, setChains] = useState<ApprovalChain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState('')
  const [matchStrategyFilter, setMatchStrategyFilter] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadChains = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const rows = await getApprovalChains({
        search: search || undefined,
        is_active: isActiveFilter || undefined,
        match_strategy:
          matchStrategyFilter === 'all' || matchStrategyFilter === 'any'
            ? matchStrategyFilter
            : undefined,
      })
      setChains(rows)
    } catch (requestError) {
      if (
        requestError instanceof ApprovalChainsApiError &&
        requestError.status === 401
      ) {
        router.replace('/auth/login?next=/admin/approval-chains')
        return
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load approval chains.',
      )
      setChains([])
    } finally {
      setLoading(false)
    }
  }, [isActiveFilter, matchStrategyFilter, router, search])

  useEffect(() => {
    void loadChains()
  }, [loadChains])

  const handleDelete = useCallback(
    async (chain: ApprovalChain) => {
      const confirmed = window.confirm(
        `Delete approval chain "${chain.name}"?`,
      )
      if (!confirmed) return

      setDeletingId(chain.id)
      setError('')

      try {
        await deleteApprovalChain(chain.id)
        setChains((current) =>
          current.filter((row) => row.id !== chain.id),
        )
      } catch (requestError) {
        if (
          requestError instanceof ApprovalChainsApiError &&
          requestError.status === 401
        ) {
          router.replace('/auth/login?next=/admin/approval-chains')
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to delete approval chain.',
        )
      } finally {
        setDeletingId(null)
      }
    },
    [router],
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Approval Chains
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Define conditional approval chains with ordered approver steps
            for spend and request routing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadChains()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          <Link
            href="/admin/approval-chains/new"
            className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            <Plus className="h-4 w-4" />
            New chain
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search approval chains"
            className="rounded-md border px-3 py-2 text-sm"
          />

          <select
            value={isActiveFilter}
            onChange={(event) => setIsActiveFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>

          <select
            value={matchStrategyFilter}
            onChange={(event) => setMatchStrategyFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All match strategies</option>
            <option value="all">All conditions</option>
            <option value="any">Any condition</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setIsActiveFilter('')
              setMatchStrategyFilter('')
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Priority</th>
              <th className="px-4 py-3 text-left font-medium">Strategy</th>
              <th className="px-4 py-3 text-left font-medium">Conditions</th>
              <th className="px-4 py-3 text-left font-medium">Approvers</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Loading approval chains...
                </td>
              </tr>
            )}

            {!loading && chains.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No approval chains found.
                </td>
              </tr>
            )}

            {!loading &&
              chains.map((chain) => (
                <tr key={chain.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-gray-900">
                      {chain.name}
                    </div>
                    <div className="mt-1 max-w-sm text-xs text-gray-500">
                      {chain.description || 'No description'}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-gray-900">
                    {chain.priority}
                  </td>
                  <td className="px-4 py-3 align-top text-gray-900">
                    {strategyLabel(chain.match_strategy)}
                  </td>
                  <td className="px-4 py-3 align-top text-gray-900">
                    {chain.conditions.length}
                  </td>
                  <td className="px-4 py-3 align-top text-gray-900">
                    {chain.steps.length}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(
                        chain.is_active,
                      )}`}
                    >
                      {chain.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-gray-900">
                    {formatTimestamp(chain.updated_at)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/approval-chains/${encodeURIComponent(
                          String(chain.id),
                        )}`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>

                      <button
                        type="button"
                        onClick={() => void handleDelete(chain)}
                        disabled={deletingId === chain.id}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === chain.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
