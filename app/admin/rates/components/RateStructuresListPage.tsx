'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  Copy,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import {
  DEFAULT_RATE_LOOKUPS,
  RatesApiError,
  cloneRateStructure,
  deleteRateStructure,
  getRateLookups,
  getRateStructures,
  type RateLookupOption,
  type RateStructure,
} from '@/lib/api/rates'
import { formatTimestamp, statusBadgeClass } from './shared'

function isUnauthorizedError(error: unknown) {
  return error instanceof RatesApiError && error.status === 401
}

export default function RateStructuresListPage() {
  const router = useRouter()
  const [structures, setStructures] = useState<RateStructure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [defaultFilter, setDefaultFilter] = useState('')
  const [statusOptions, setStatusOptions] = useState<RateLookupOption[]>(
    DEFAULT_RATE_LOOKUPS.rate_structure_statuses,
  )
  const [actionBusyKey, setActionBusyKey] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false

    const loadLookups = async () => {
      try {
        const lookups = await getRateLookups()
        if (cancelled) return
        setStatusOptions(lookups.rate_structure_statuses)
      } catch (requestError) {
        if (cancelled) return
        if (isUnauthorizedError(requestError)) {
          router.replace('/auth/login?next=/admin/rates/structures')
          return
        }
      }
    }

    void loadLookups()

    return () => {
      cancelled = true
    }
  }, [router])

  const loadStructures = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const rows = await getRateStructures({
        search: search || undefined,
        status: statusFilter || undefined,
        is_default: defaultFilter || undefined,
      })
      setStructures(rows)
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace('/auth/login?next=/admin/rates/structures')
        return
      }

      setStructures([])
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load rate structures.',
      )
    } finally {
      setLoading(false)
    }
  }, [defaultFilter, router, search, statusFilter])

  useEffect(() => {
    void loadStructures()
  }, [loadStructures])

  const handleClone = useCallback(
    async (structure: RateStructure) => {
      setActionBusyKey(`clone:${structure.id}`)
      setError('')

      try {
        const cloned = await cloneRateStructure(structure.id)
        router.push(
          `/admin/rates/structures/${encodeURIComponent(String(cloned.id))}`,
        )
      } catch (requestError) {
        if (isUnauthorizedError(requestError)) {
          router.replace('/auth/login?next=/admin/rates/structures')
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to clone rate structure.',
        )
      } finally {
        setActionBusyKey('')
      }
    },
    [router],
  )

  const handleDelete = useCallback(
    async (structure: RateStructure) => {
      const confirmed = window.confirm(
        `Delete rate structure "${structure.name}"?`,
      )
      if (!confirmed) return

      setActionBusyKey(`delete:${structure.id}`)
      setError('')

      try {
        await deleteRateStructure(structure.id)
        setStructures((current) =>
          current.filter((row) => row.id !== structure.id),
        )
      } catch (requestError) {
        if (isUnauthorizedError(requestError)) {
          router.replace('/auth/login?next=/admin/rates/structures')
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to delete rate structure.',
        )
      } finally {
        setActionBusyKey('')
      }
    },
    [router],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Rate Structures
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Define the component formulas that power bill rate
            calculations across cards and downstream rule actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadStructures()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          <Link
            href="/admin/rates/structures/new"
            className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            <Plus className="h-4 w-4" />
            New structure
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search rate structures"
            className="rounded-md border px-3 py-2 text-sm"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={defaultFilter}
            onChange={(event) => setDefaultFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All defaults</option>
            <option value="true">Default only</option>
            <option value="false">Non-default only</option>
          </select>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setStatusFilter('')
              setDefaultFilter('')
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
              <th className="px-4 py-3 text-left font-medium">Components</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Default</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  Loading rate structures...
                </td>
              </tr>
            )}

            {!loading && structures.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  No rate structures found.
                </td>
              </tr>
            )}

            {!loading &&
              structures.map((structure) => {
                const cloneBusy =
                  actionBusyKey === `clone:${structure.id}`
                const deleteBusy =
                  actionBusyKey === `delete:${structure.id}`

                return (
                  <tr key={structure.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {structure.name}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {structure.description || 'No description'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {structure.component_count ?? structure.components.length}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(structure.status)}`}
                      >
                        {structure.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {structure.is_default ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatTimestamp(structure.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/rates/structures/${encodeURIComponent(String(structure.id))}`}
                          className="rounded-md p-2 hover:bg-gray-100"
                          aria-label={`Edit ${structure.name}`}
                        >
                          <Pencil className="h-4 w-4 text-gray-600" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => void handleClone(structure)}
                          disabled={cloneBusy || Boolean(actionBusyKey)}
                          className="rounded-md p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Clone ${structure.name}`}
                        >
                          <Copy className="h-4 w-4 text-gray-600" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDelete(structure)}
                          disabled={deleteBusy || Boolean(actionBusyKey)}
                          className="rounded-md p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Delete ${structure.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
