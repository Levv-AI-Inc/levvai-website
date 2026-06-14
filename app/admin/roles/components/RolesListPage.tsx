'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, RefreshCcw } from 'lucide-react'
import {
  RolesApiError,
  getRoles,
  updateRole,
  type RoleRecord,
} from '@/lib/api/roles'

const UNIT_OPTIONS = [
  { value: '', label: 'All units' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
]

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

function statusBadgeClass(isActive: boolean) {
  return isActive
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-200 text-slate-700'
}

function unitLabel(unit: RoleRecord['default_unit']) {
  return unit === 'day' ? 'Day' : 'Hour'
}

export default function RolesListPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const rows = await getRoles({
        search: search || undefined,
        is_active: statusFilter || undefined,
        country: countryFilter || undefined,
        region: regionFilter || undefined,
        default_unit:
          unitFilter === 'hour' || unitFilter === 'day'
            ? unitFilter
            : undefined,
      })
      setRoles(rows)
    } catch (requestError) {
      if (
        requestError instanceof RolesApiError &&
        requestError.status === 401
      ) {
        router.replace('/auth/login?next=/admin/roles')
        return
      }

      setRoles([])
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load roles.',
      )
    } finally {
      setLoading(false)
    }
  }, [countryFilter, regionFilter, router, search, statusFilter, unitFilter])

  useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  const handleToggleStatus = useCallback(
    async (role: RoleRecord) => {
      setStatusBusyId(role.id)
      setError('')

      try {
        const updated = await updateRole(role.id, {
          is_active: !role.is_active,
        })
        setRoles((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        )
      } catch (requestError) {
        if (
          requestError instanceof RolesApiError &&
          requestError.status === 401
        ) {
          router.replace('/auth/login?next=/admin/roles')
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to update role status.',
        )
      } finally {
        setStatusBusyId(null)
      }
    },
    [router],
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Roles</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Manage the base role definitions that drive market-specific
            defaults for country, location, currency, and unit.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadRoles()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          <Link
            href="/admin/roles/new"
            className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            <Plus className="h-4 w-4" />
            New role
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search roles"
            className="rounded-md border px-3 py-2 text-sm"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>

          <input
            value={countryFilter}
            onChange={(event) =>
              setCountryFilter(event.target.value.toUpperCase())
            }
            placeholder="Country"
            className="rounded-md border px-3 py-2 text-sm"
          />

          <input
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
            placeholder="Region"
            className="rounded-md border px-3 py-2 text-sm"
          />

          <select
            value={unitFilter}
            onChange={(event) => setUnitFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
              setCountryFilter('')
              setRegionFilter('')
              setUnitFilter('')
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
              <th className="px-4 py-3 text-left font-medium">Location</th>
              <th className="px-4 py-3 text-left font-medium">Currency</th>
              <th className="px-4 py-3 text-left font-medium">Unit</th>
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
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Loading roles...
                </td>
              </tr>
            )}

            {!loading && roles.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No roles found.
                </td>
              </tr>
            )}

            {!loading &&
              roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-gray-900">
                      {role.name}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {role.code || 'Code pending'}
                    </div>
                    <div className="mt-1 max-w-sm text-xs text-gray-500">
                      {role.description || 'No description'}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-gray-900">
                    {role.location_label || '—'}
                  </td>
                  <td className="px-4 py-3 align-top text-gray-900">
                    {role.default_currency || '—'}
                  </td>
                  <td className="px-4 py-3 align-top text-gray-900">
                    {unitLabel(role.default_unit)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(
                        role.is_active,
                      )}`}
                    >
                      {role.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-gray-900">
                    {formatTimestamp(role.updated_at)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/roles/${encodeURIComponent(
                          String(role.id),
                        )}`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>

                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(role)}
                        disabled={statusBusyId === role.id}
                        className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {statusBusyId === role.id
                          ? 'Updating...'
                          : role.is_active
                            ? 'Deactivate'
                            : 'Activate'}
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
