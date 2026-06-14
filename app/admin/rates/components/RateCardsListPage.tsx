'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import {
  DEFAULT_RATE_LOOKUPS,
  RatesApiError,
  activateRateCard,
  deleteRateCard,
  getRateCards,
  getRateLookups,
  getRateStructures,
  type RateCard,
  type RateLookupOption,
  type RateStructure,
} from '@/lib/api/rates'
import {
  RolesApiError,
  getRoles,
  type RoleRecord,
} from '@/lib/api/roles'
import { formatTimestamp, statusBadgeClass } from './shared'

function isUnauthorizedError(error: unknown) {
  return (
    (error instanceof RatesApiError || error instanceof RolesApiError) &&
    error.status === 401
  )
}

export default function RateCardsListPage() {
  const router = useRouter()
  const [cards, setCards] = useState<RateCard[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [structures, setStructures] = useState<RateStructure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [structureFilter, setStructureFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')
  const [statusOptions, setStatusOptions] = useState<RateLookupOption[]>(
    DEFAULT_RATE_LOOKUPS.rate_card_statuses,
  )
  const [unitOptions, setUnitOptions] = useState<RateLookupOption[]>(
    DEFAULT_RATE_LOOKUPS.units,
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
        router.replace('/auth/login?next=/admin/rates/cards')
        return
      }

      if (lookupsResult.status === 'fulfilled') {
        setStatusOptions(lookupsResult.value.rate_card_statuses)
        setUnitOptions(lookupsResult.value.units)
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

  const loadCards = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const rows = await getRateCards({
        search: search || undefined,
        status: statusFilter || undefined,
        role_definition: roleFilter || undefined,
        rate_structure: structureFilter || undefined,
        currency: currencyFilter || undefined,
        unit: unitFilter || undefined,
      })
      setCards(rows)
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace('/auth/login?next=/admin/rates/cards')
        return
      }

      setCards([])
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load rate cards.',
      )
    } finally {
      setLoading(false)
    }
  }, [
    currencyFilter,
    roleFilter,
    router,
    search,
    statusFilter,
    structureFilter,
    unitFilter,
  ])

  useEffect(() => {
    void loadCards()
  }, [loadCards])

  const handleActivate = useCallback(
    async (card: RateCard) => {
      setActionBusyKey(`activate:${card.id}`)
      setError('')

      try {
        const activated = await activateRateCard(card.id)
        setCards((current) =>
          current.map((row) => (row.id === activated.id ? activated : row)),
        )
      } catch (requestError) {
        if (isUnauthorizedError(requestError)) {
          router.replace('/auth/login?next=/admin/rates/cards')
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to activate rate card.',
        )
      } finally {
        setActionBusyKey('')
      }
    },
    [router],
  )

  const handleDelete = useCallback(
    async (card: RateCard) => {
      const confirmed = window.confirm(`Delete rate card "${card.name}"?`)
      if (!confirmed) return

      setActionBusyKey(`delete:${card.id}`)
      setError('')

      try {
        await deleteRateCard(card.id)
        setCards((current) =>
          current.filter((row) => row.id !== card.id),
        )
      } catch (requestError) {
        if (isUnauthorizedError(requestError)) {
          router.replace('/auth/login?next=/admin/rates/cards')
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to delete rate card.',
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
            Rate Cards
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Publish role-specific supplier pricing against a reusable
            rate structure, then recalculate or activate it as needed.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadCards()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          <Link
            href="/admin/rates/cards/new"
            className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            <Plus className="h-4 w-4" />
            New card
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search rate cards"
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

          <input
            value={currencyFilter}
            onChange={(event) =>
              setCurrencyFilter(event.target.value.toUpperCase())
            }
            placeholder="Currency"
            className="rounded-md border px-3 py-2 text-sm"
          />

          <select
            value={unitFilter}
            onChange={(event) => setUnitFilter(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All units</option>
            {unitOptions.map((option) => (
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
              setRoleFilter('')
              setStructureFilter('')
              setCurrencyFilter('')
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
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Structure</th>
              <th className="px-4 py-3 text-left font-medium">Currency / Unit</th>
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
                  Loading rate cards...
                </td>
              </tr>
            )}

            {!loading && cards.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  No rate cards found.
                </td>
              </tr>
            )}

            {!loading &&
              cards.map((card) => {
                const activateBusy =
                  actionBusyKey === `activate:${card.id}`
                const deleteBusy = actionBusyKey === `delete:${card.id}`
                return (
                  <tr key={card.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {card.name}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {card.effective_date}
                        {card.end_date ? ` to ${card.end_date}` : ' onward'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {card.role_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {card.rate_structure_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {card.currency} / {card.unit}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(card.status)}`}
                      >
                        {card.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatTimestamp(card.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/rates/cards/${encodeURIComponent(String(card.id))}`}
                          className="rounded-md p-2 hover:bg-gray-100"
                          aria-label={`Edit ${card.name}`}
                        >
                          <Pencil className="h-4 w-4 text-gray-600" />
                        </Link>

                        {card.status !== 'active' && (
                          <button
                            type="button"
                            onClick={() => void handleActivate(card)}
                            disabled={activateBusy || Boolean(actionBusyKey)}
                            className="rounded-md p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Activate ${card.name}`}
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleDelete(card)}
                          disabled={deleteBusy || Boolean(actionBusyKey)}
                          className="rounded-md p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Delete ${card.name}`}
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
