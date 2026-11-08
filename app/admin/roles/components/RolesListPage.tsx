'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, RefreshCcw } from 'lucide-react'
import {
  LevvNotice,
  LevvPage,
  LevvRecordHeader,
  LevvSearchField,
  LevvSegmented,
  LevvStatusBadge,
  levvUi,
} from '@/components/ui/levv-app'
import {
  RolesApiError,
  getRoles,
  updateRole,
  type RoleRecord,
} from '@/lib/api/roles'

const UNIT_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
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

function unitLabel(unit: RoleRecord['default_unit']) {
  return unit === 'day' ? 'Day' : 'Hour'
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

function listWords(words: string[]) {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

function distinct(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

/** What the active roles cover, from every role unfiltered: their locations, countries and default currencies. */
function rolesStatement(roles: RoleRecord[]) {
  if (roles.length === 0) {
    return 'No roles yet. A role sets the market defaults for country, location, currency, and unit.'
  }
  const active = roles.filter((role) => role.is_active)
  const inactive = roles.length - active.length
  if (active.length === 0) {
    return `None of the ${plural(roles.length, 'role')} is active.`
  }
  const lead = inactive === 0 && roles.length > 1 ? `${plural(roles.length, 'role')}, all active,` : plural(active.length, 'active role')
  const locations = distinct(active.map((role) => role.location_label || [role.city, role.region, role.country].filter(Boolean).join(', ')))
  const countries = distinct(active.map((role) => role.country.toUpperCase()))
  const currencies = distinct(active.map((role) => role.default_currency.toUpperCase()))
  const where =
    locations.length > 0 && countries.length > 0
      ? ` ${active.length === 1 ? 'covers' : 'cover'} ${plural(locations.length, 'location')} in ${plural(countries.length, 'country', 'countries')}`
      : ''
  const money =
    currencies.length === 0
      ? ''
      : `${where ? ',' : ''} with defaults in ${currencies.length <= 3 ? listWords(currencies) : plural(currencies.length, 'currency', 'currencies')}`
  const tail = inactive > 0 ? ` ${plural(inactive, 'role')} ${inactive === 1 ? 'is' : 'are'} inactive.` : ''
  if (!where && !money) return `${lead.replace(/,$/, '')}.${tail}`
  return `${lead}${where}${money}.${tail}`
}

export default function RolesListPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleRecord[]>([])
  // Every role, unfiltered: the header states the roles as they stand, whatever the filters show.
  const [allRoles, setAllRoles] = useState<RoleRecord[]>([])
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
      const filterActive = Boolean(search || statusFilter || countryFilter || regionFilter || unitFilter)
      const [rows, everything] = await Promise.all([
        getRoles({
          search: search || undefined,
          is_active: statusFilter || undefined,
          country: countryFilter || undefined,
          region: regionFilter || undefined,
          default_unit:
            unitFilter === 'hour' || unitFilter === 'day'
              ? unitFilter
              : undefined,
        }),
        filterActive ? getRoles() : null,
      ])
      setRoles(rows)
      setAllRoles(everything ?? rows)
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
        const update = (current: RoleRecord[]) =>
          current.map((row) => (row.id === updated.id ? updated : row))
        setRoles(update)
        setAllRoles(update)
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

  // The filters the loaded rows reflect (the search box applies after its debounce).
  const filtered = Boolean(search || statusFilter || countryFilter || regionFilter || unitFilter)
  const loadFailed = !loading && Boolean(error) && roles.length === 0
  const statement = loading
    ? 'Loading roles…'
    : loadFailed
      ? 'Roles could not be loaded, so their market defaults cannot be shown.'
      : `${rolesStatement(allRoles)}${
          !filtered
            ? ''
            : roles.length === 0
              ? ' None match these filters.'
              : ` ${roles.length} ${roles.length === 1 ? 'matches' : 'match'} these filters.`
        }`
  const activeCount = allRoles.filter((role) => role.is_active).length
  const figure = (value: number) => (loading || loadFailed ? '—' : value)

  const href = (role: RoleRecord) => `/admin/roles/${encodeURIComponent(String(role.id))}`
  const status = (role: RoleRecord) =>
    role.is_active ? <LevvStatusBadge tone="emerald">Active</LevvStatusBadge> : <LevvStatusBadge>Inactive</LevvStatusBadge>
  const actions = (role: RoleRecord) => (
    <>
      <Link href={href(role)} className={levvUi.secondaryButton}>
        <Pencil />
        Edit
      </Link>

      <button
        type="button"
        onClick={() => void handleToggleStatus(role)}
        disabled={statusBusyId === role.id}
        className={levvUi.ghostButton}
      >
        {statusBusyId === role.id
          ? 'Updating...'
          : role.is_active
            ? 'Deactivate'
            : 'Activate'}
      </button>
    </>
  )

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Roles"
          title="Roles"
          statement={statement}
          figures={[
            { label: 'Active', value: figure(activeCount) },
            { label: 'Inactive', value: figure(allRoles.length - activeCount) },
          ]}
          actions={
            <Link href="/admin/roles/new" className={levvUi.primaryButton}>
              <Plus />
              New role
            </Link>
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="grid w-full gap-1.5 sm:w-64">
            <span className={levvUi.label}>Search</span>
            <LevvSearchField
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search roles"
              aria-label="Search roles"
            />
          </label>

          <div className="grid gap-1.5">
            <span className={levvUi.label} aria-hidden>Status</span>
            <LevvSegmented label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          </div>

          <label className="grid w-full gap-1.5 sm:w-32">
            <span className={levvUi.label}>Country</span>
            <input
              value={countryFilter}
              onChange={(event) =>
                setCountryFilter(event.target.value.toUpperCase())
              }
              placeholder="Country"
              className={levvUi.input}
            />
          </label>

          <label className="grid w-full gap-1.5 sm:w-40">
            <span className={levvUi.label}>Region</span>
            <input
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value)}
              placeholder="Region"
              className={levvUi.input}
            />
          </label>

          <div className="grid gap-1.5">
            <span className={levvUi.label} aria-hidden>Unit</span>
            <LevvSegmented label="Unit" value={unitFilter} onChange={setUnitFilter} options={UNIT_OPTIONS} />
          </div>

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
            className={levvUi.ghostButton}
          >
            Clear filters
          </button>

          <span className="ml-auto flex items-center gap-3">
            <span className={`${levvUi.legend} text-slate-500`}>
              Showing <span className="font-semibold tabular-nums normal-case tracking-normal text-slate-950">{loading ? '—' : roles.length}</span>
            </span>
            <button
              type="button"
              onClick={() => void loadRoles()}
              className={levvUi.secondaryButton}
            >
              <RefreshCcw />
              Refresh
            </button>
          </span>
        </div>

        {error && (
          <LevvNotice tone="rose">
            {error}
          </LevvNotice>
        )}

        <div className={`${levvUi.tableShell} levv-cq`}>
          {loading ? (
            <p role="status" className="border-t-2 border-slate-950 px-3 py-8 text-center text-[13px] text-slate-500">
              Loading roles...
            </p>
          ) : roles.length === 0 ? (
            <p className="border-t-2 border-slate-950 px-3 py-8 text-center text-[13px] text-slate-500">
              No roles found.
            </p>
          ) : (
            <>
              <ul className="levv-cq-list divide-y divide-[var(--line)] border-t-2 border-slate-950">
                {roles.map((role) => (
                  <li key={role.id} className="space-y-2.5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-slate-950">{role.name}</p>
                        <p className="mt-0.5 text-[12px] text-slate-500">{role.code || 'Code pending'}</p>
                      </div>
                      {status(role)}
                    </div>
                    <p className="text-[13px] text-slate-700">
                      {role.location_label || '—'}
                      <span className="text-slate-500"> · </span>
                      <span className="tabular-nums">{role.default_currency || '—'}</span>
                      <span className="text-slate-500"> · </span>
                      {unitLabel(role.default_unit)}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] tabular-nums text-slate-500">Updated {formatTimestamp(role.updated_at)}</span>
                      <span className="flex gap-1">{actions(role)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="levv-cq-table relative overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr>
                      <th className={levvUi.th}>Name</th>
                      <th className={levvUi.th}>Location</th>
                      <th className={levvUi.th}>Currency</th>
                      <th className={levvUi.th}>Unit</th>
                      <th className={levvUi.th}>Status</th>
                      <th className={levvUi.th}>Updated</th>
                      <th className={`${levvUi.th} text-right`}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {roles.map((role) => (
                      <tr key={role.id} className="align-top hover:bg-[var(--surface)] [&>td]:border-b [&>td]:border-[var(--line)]">
                        <td className={levvUi.td}>
                          <div className="font-medium text-slate-950">
                            {role.name}
                          </div>
                          <div className="mt-0.5 text-[12px] text-slate-500">
                            {role.code || 'Code pending'}
                          </div>
                          <div className="mt-0.5 line-clamp-2 max-w-[36ch] text-[13px] text-slate-500">
                            {role.description || 'No description'}
                          </div>
                        </td>
                        <td className={levvUi.td}>
                          {role.location_label || '—'}
                        </td>
                        <td className={`${levvUi.td} tabular-nums`}>
                          {role.default_currency || '—'}
                        </td>
                        <td className={levvUi.td}>
                          {unitLabel(role.default_unit)}
                        </td>
                        <td className={levvUi.td}>{status(role)}</td>
                        <td className={`${levvUi.td} text-[13px] tabular-nums text-slate-600`}>
                          {formatTimestamp(role.updated_at)}
                        </td>
                        <td className={levvUi.td}>
                          <div className="-my-1.5 flex items-center justify-end gap-1">
                            {actions(role)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </LevvPage>
  )
}
