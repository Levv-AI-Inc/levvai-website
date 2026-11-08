'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import {
  LevvNotice,
  LevvPage,
  LevvRecordHeader,
  LevvSearchField,
  LevvSegmented,
  LevvStat,
  LevvStatStrip,
  LevvStatusBadge,
  LevvTabs,
  levvUi,
} from '@/components/ui/levv-app'
import { getRoles, type RoleRecord } from '@/lib/api/roles'
import { getSuppliers, type SupplierRecord } from '@/lib/api/suppliers'
import {
  getSupplierTier,
  readSupplierNetwork,
  setSupplierTier,
  writeSupplierNetwork,
  type SupplierNetworkMap,
  type SupplierTier,
} from '@/lib/supplierNetwork'
import { toTitleCase } from '@/suppliers/utils'

type ViewMode = 'roles' | 'suppliers'

const TIER_OPTIONS: { value: SupplierTier; label: string }[] = [
  { value: 'tier1', label: 'Tier 1' },
  { value: 'tier2', label: 'Tier 2' },
  { value: 'excluded', label: 'Excluded' },
]

function supplierKey(supplier: SupplierRecord) {
  return String(supplier.id ?? supplier.supplier_id)
}

function supplierSummary(supplier: SupplierRecord) {
  return [supplier.supplier_type ? toTitleCase(supplier.supplier_type) : '', supplier.category].filter(Boolean).join(' · ') || 'Supplier'
}

function roleSummary(role: RoleRecord) {
  return role.description || role.location_label || role.code || 'Role'
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

/** The network as it stands: how many active roles recommend at least one active supplier (Tier 1 or Tier 2). */
function networkStatement(roles: RoleRecord[], suppliers: SupplierRecord[], covered: number) {
  if (roles.length === 0) return 'There are no active roles to recommend suppliers for.'
  if (suppliers.length === 0) return `There are no active suppliers to recommend for the ${plural(roles.length, 'active role')}.`
  if (covered === 0) return `None of the ${plural(roles.length, 'active role')} recommends any of the ${plural(suppliers.length, 'active supplier')} yet.`
  if (covered === roles.length) {
    return roles.length === 1
      ? `The one active role recommends at least one of the ${plural(suppliers.length, 'active supplier')}.`
      : `All ${roles.length} active roles recommend at least one of the ${plural(suppliers.length, 'active supplier')}.`
  }
  const rest = roles.length - covered
  return `${covered} of the ${plural(roles.length, 'active role')} ${covered === 1 ? 'recommends' : 'recommend'} at least one of the ${plural(suppliers.length, 'active supplier')}; ${rest} ${rest === 1 ? 'recommends' : 'recommend'} none.`
}

export default function SupplierNetworkPage() {
  const [view, setView] = useState<ViewMode>('roles')
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [network, setNetwork] = useState<SupplierNetworkMap>({})
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [roleRows, supplierRows] = await Promise.all([
          getRoles({ is_active: true }),
          getSuppliers({ status: 'active' }),
        ])
        if (cancelled) return
        setRoles(roleRows)
        setSuppliers(supplierRows)
        setNetwork(readSupplierNetwork())
        setSelectedId(roleRows[0] ? String(roleRows[0].id) : '')
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load the supplier network.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSearch('')
    if (view === 'roles') {
      setSelectedId(roles[0] ? String(roles[0].id) : '')
    } else {
      setSelectedId(suppliers[0] ? supplierKey(suppliers[0]) : '')
    }
  }, [view, roles, suppliers])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = view === 'roles' ? roles : suppliers
    if (!query) return rows
    return rows.filter((item) => {
      const text = view === 'roles'
        ? `${(item as RoleRecord).name} ${roleSummary(item as RoleRecord)}`
        : `${(item as SupplierRecord).name} ${supplierSummary(item as SupplierRecord)}`
      return text.toLowerCase().includes(query)
    })
  }, [roles, search, suppliers, view])

  const selectedRole = view === 'roles'
    ? roles.find((role) => String(role.id) === selectedId) || null
    : null
  const selectedSupplier = view === 'suppliers'
    ? suppliers.find((supplier) => supplierKey(supplier) === selectedId) || null
    : null

  const coverageRows = view === 'roles' ? suppliers : roles
  const counts = coverageRows.reduce(
    (total, item) => {
      const roleId = view === 'roles' ? selectedId : String((item as RoleRecord).id)
      const supplierId = view === 'roles' ? supplierKey(item as SupplierRecord) : selectedId
      total[getSupplierTier(network, roleId, supplierId)] += 1
      return total
    },
    { tier1: 0, tier2: 0, excluded: 0 },
  )

  // Active roles that recommend at least one active supplier, whatever the view shows.
  const coveredRoles = roles.filter((role) =>
    suppliers.some((supplier) => getSupplierTier(network, String(role.id), supplierKey(supplier)) !== 'excluded'),
  ).length

  const updateTier = (roleId: string, supplierId: string, tier: SupplierTier) => {
    const next = setSupplierTier(network, roleId, supplierId, tier)
    setNetwork(next)
    writeSupplierNetwork(next)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1400)
  }

  const statement = loading
    ? 'Loading roles and suppliers…'
    : error
      ? 'The supplier network could not be loaded, so role coverage cannot be shown.'
      : networkStatement(roles, suppliers, coveredRoles)
  const figure = (value: number) => (loading || error ? '—' : value)
  const itemNoun = view === 'roles' ? 'role' : 'supplier'

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Supplier Network"
          title="Supplier Network"
          statement={statement}
          figures={[
            { label: 'Active roles', value: figure(roles.length) },
            { label: 'Active suppliers', value: figure(suppliers.length) },
            { label: 'Roles covered', value: figure(coveredRoles) },
          ]}
          actions={
            <span aria-live="polite">
              {saved ? (
                <LevvStatusBadge tone="emerald">Changes saved</LevvStatusBadge>
              ) : (
                <span className="text-[13px] text-slate-500">Saved automatically</span>
              )}
            </span>
          }
        />

        <LevvTabs<ViewMode>
          label="Supplier network view"
          value={view}
          onChange={setView}
          options={[
            { value: 'roles', label: 'Roles' },
            { value: 'suppliers', label: 'Suppliers' },
          ]}
        />

        {error ? (
          <LevvNotice tone="rose" icon={AlertCircle}>
            {error}
          </LevvNotice>
        ) : null}

        {loading ? (
          <div aria-busy="true" aria-label="Loading supplier network" className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="divide-y divide-[var(--line)] border-t-2 border-slate-950">
              {[0, 1, 2].map((row) => (
                <div key={row} className="space-y-2 py-4">
                  <span className="block h-3 w-40 bg-slate-100" />
                  <span className="block h-3 w-56 bg-slate-100" />
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t-2 border-slate-950 pt-4">
              <span className="block h-4 w-48 bg-slate-100" />
              <span className="block h-3 w-72 bg-slate-100" />
            </div>
          </div>
        ) : !error ? (
          <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            <section aria-label={view === 'roles' ? 'Roles' : 'Suppliers'} className="min-w-0 space-y-3">
              <label className="grid gap-1.5">
                <span className={levvUi.label}>Search</span>
                <LevvSearchField
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${view}…`}
                  aria-label={`Search ${view}`}
                />
              </label>
              <ul className="max-h-[660px] divide-y divide-[var(--line)] overflow-y-auto border-t-2 border-slate-950">
                {filteredItems.map((item) => {
                  const id = view === 'roles' ? String((item as RoleRecord).id) : supplierKey(item as SupplierRecord)
                  const active = id === selectedId
                  const relatedCount = view === 'roles'
                    ? suppliers.filter((supplier) => getSupplierTier(network, id, supplierKey(supplier)) !== 'excluded').length
                    : roles.filter((role) => getSupplierTier(network, String(role.id), id) !== 'excluded').length
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(id)}
                        aria-pressed={active}
                        className={`flex w-full items-start justify-between gap-3 border-l-2 py-3 pl-3 pr-2 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] ${
                          active ? 'border-blue-600 bg-[var(--surface)]' : 'border-transparent hover:bg-[var(--surface)]'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className={`block truncate text-[14px] font-medium ${active ? 'text-blue-600' : 'text-slate-950'}`}>{item.name}</span>
                          <span className="mt-0.5 line-clamp-1 text-[13px] text-slate-500">{view === 'roles' ? roleSummary(item as RoleRecord) : supplierSummary(item as SupplierRecord)}</span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] tabular-nums text-slate-500">
                          <span className="font-semibold text-slate-950">{relatedCount}</span> {view === 'roles' ? 'suppliers' : 'roles'}
                        </span>
                      </button>
                    </li>
                  )
                })}
                {filteredItems.length === 0 ? <li className="py-8 text-center text-[13px] text-slate-500">No {view} found.</li> : null}
              </ul>
            </section>

            <section className="min-w-0 space-y-6">
              <div>
                <p className={levvUi.label}>{view === 'roles' ? 'Role' : 'Supplier'}</p>
                <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-950">{selectedRole?.name || selectedSupplier?.name || `Select a ${itemNoun}`}</h2>
                    <p className="mt-0.5 text-[13px] text-slate-500">{selectedRole ? roleSummary(selectedRole) : selectedSupplier ? supplierSummary(selectedSupplier) : 'Choose an item from the list to configure its coverage.'}</p>
                  </div>
                  {selectedId ? <LevvStatusBadge tone="emerald">Active</LevvStatusBadge> : null}
                </div>

                <LevvStatStrip className="mt-4 grid-cols-3">
                  <LevvStat label="Tier 1" value={counts.tier1} />
                  <LevvStat label="Tier 2" value={counts.tier2} />
                  <LevvStat label="Excluded" value={counts.excluded} />
                </LevvStatStrip>
              </div>

              <div>
                <h3 className="text-[15px] font-semibold text-slate-950">{view === 'roles' ? 'Supplier eligibility' : 'Role coverage'}</h3>
                <p className="mt-0.5 max-w-[72ch] text-[13px] leading-5 text-slate-500">
                  {view === 'roles' ? 'Tier 1 suppliers are recommended first for future job postings. Tier 2 suppliers follow as additional options.' : 'Changes here update the same role–supplier relationships.'}
                </p>

                <ul className="mt-3 divide-y divide-[var(--line)] border-t-2 border-slate-950">
                  {selectedId && coverageRows.map((item) => {
                    const roleId = view === 'roles' ? selectedId : String((item as RoleRecord).id)
                    const supplierId = view === 'roles' ? supplierKey(item as SupplierRecord) : selectedId
                    const tier = getSupplierTier(network, roleId, supplierId)
                    return (
                      <li key={`${roleId}-${supplierId}`} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-slate-950">{item.name}</div>
                          <div className="mt-0.5 truncate text-[13px] text-slate-500">{view === 'roles' ? supplierSummary(item as SupplierRecord) : roleSummary(item as RoleRecord)}</div>
                        </div>
                        <div className="w-fit shrink-0">
                          <LevvSegmented<SupplierTier>
                            label={`Tier for ${item.name}`}
                            value={tier}
                            onChange={(next) => updateTier(roleId, supplierId, next)}
                            options={TIER_OPTIONS}
                          />
                        </div>
                      </li>
                    )
                  })}
                  {selectedId && coverageRows.length === 0 ? (
                    <li className="py-8 text-center text-[13px] text-slate-500">No active {view === 'roles' ? 'suppliers' : 'roles'} are available.</li>
                  ) : null}
                </ul>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </LevvPage>
  )
}
