'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import {
  DEFAULT_RATE_LOOKUPS,
  RatesApiError,
  deleteRateRule,
  getRateLookups,
  getRateRules,
  getRateStructures,
  type RateLookupOption,
  type RateRule,
  type RateStructure,
} from '@/lib/api/rates'
import {
  RolesApiError,
  getRoles,
  type RoleRecord,
} from '@/lib/api/roles'
import { formatTimestamp, lookupLabel, statusBadgeClass } from './shared'

function isUnauthorizedError(error: unknown) {
  return (
    (error instanceof RatesApiError || error instanceof RolesApiError) &&
    error.status === 401
  )
}

export default function RateRulesListPage() {
  const router = useRouter()
  const [rules, setRules] = useState<RateRule[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [structures, setStructures] = useState<RateStructure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [structureFilter, setStructureFilter] = useState('')
  const [statusOptions, setStatusOptions] = useState<RateLookupOption[]>(
    DEFAULT_RATE_LOOKUPS.rate_rule_statuses,
  )
  const [actionTypeOptions, setActionTypeOptions] = useState<
    RateLookupOption[]
  >(DEFAULT_RATE_LOOKUPS.action_types)
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false

    const loadSupportData = async () => {
      const [lookupsResult, rolesResult, structuresResult] =
        await Promise.allSettled([
          getRateLookups(),
          getRoles({ is_active: true }),
          getRateStructures(),
        ])

      if (cancelled) return

      const results = [lookupsResult, rolesResult, structuresResult]
      if (
        results.some(
          (result) =>
            result.status === 'rejected' &&
            isUnauthorizedError(result.reason),
        )
      ) {
        router.replace('/auth/login?next=/admin/rates/rules')
        return
      }

      if (lookupsResult.status === 'fulfilled') {
        setStatusOptions(lookupsResult.value.rate_rule_statuses)
        setActionTypeOptions(lookupsResult.value.action_types)
      }
      if (rolesResult.status === 'fulfilled') {
        setRoles(rolesResult.value)
      }
      if (structuresResult.status === 'fulfilled') {
        setStructures(structuresResult.value)
      }
    }

    void loadSupportData()

    return () => {
      cancelled = true
    }
  }, [router])

  const loadRules = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const rows = await getRateRules({
        search: search || undefined,
        status: statusFilter || undefined,
        role_definition: roleFilter || undefined,
        rate_structure: structureFilter || undefined,
      })
      setRules(rows)
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace('/auth/login?next=/admin/rates/rules')
        return
      }

      setRules([])
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load rate rules.',
      )
    } finally {
      setLoading(false)
    }
  }, [roleFilter, router, search, statusFilter, structureFilter])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const handleDelete = useCallback(
    async (rule: RateRule) => {
      const confirmed = window.confirm(`Delete rate rule "${rule.name}"?`)
      if (!confirmed) return

      setDeleteBusyId(rule.id)
      setError('')

      try {
        await deleteRateRule(rule.id)
        setRules((current) =>
          current.filter((row) => row.id !== rule.id),
        )
      } catch (requestError) {
        if (isUnauthorizedError(requestError)) {
          router.replace('/auth/login?next=/admin/rates/rules')
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to delete rate rule.',
        )
      } finally {
        setDeleteBusyId(null)
      }
    },
    [router],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Rate Rules
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Layer conditional bill-rate adjustments over the published
            cards and stop processing when the desired match is reached.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadRules()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          <Link
            href="/admin/rates/rules/new"
            className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            <Plus className="h-4 w-4" />
            New rule
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search rate rules"
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
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>

          <select
            value={structureFilter}
            onChange={(event) => setStructureFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All structures</option>
            {structures.map((structure) => (
              <option key={structure.id} value={structure.id}>
                {structure.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setStatusFilter('')
              setRoleFilter('')
              setStructureFilter('')
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
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Scope</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  Loading rate rules...
                </td>
              </tr>
            )}

            {!loading && rules.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  No rate rules found.
                </td>
              </tr>
            )}

            {!loading &&
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {rule.name}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {rule.description || 'No description'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {rule.priority}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {lookupLabel(actionTypeOptions, rule.action_type)} ·{' '}
                    {rule.action_value}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{rule.role_name || 'All roles'}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {rule.rate_structure_name || 'All structures'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(rule.status)}`}
                    >
                      {rule.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatTimestamp(rule.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/rates/rules/${encodeURIComponent(String(rule.id))}`}
                        className="rounded-md p-2 hover:bg-gray-100"
                        aria-label={`Edit ${rule.name}`}
                      >
                        <Pencil className="h-4 w-4 text-gray-600" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => void handleDelete(rule)}
                        disabled={deleteBusyId === rule.id}
                        className="rounded-md p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Delete ${rule.name}`}
                      >
                        <Trash2 className="h-4 w-4 text-rose-600" />
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
