'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, Search, Users } from 'lucide-react'
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

type ViewMode = 'roles' | 'suppliers'

function supplierKey(supplier: SupplierRecord) {
  return String(supplier.id ?? supplier.supplier_id)
}

function supplierSummary(supplier: SupplierRecord) {
  return [supplier.supplier_type, supplier.category].filter(Boolean).join(' · ') || 'Supplier'
}

function roleSummary(role: RoleRecord) {
  return role.description || role.location_label || role.code || 'Role'
}

function TierButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
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

  const updateTier = (roleId: string, supplierId: string, tier: SupplierTier) => {
    const next = setSupplierTier(network, roleId, supplierId, tier)
    setNetwork(next)
    writeSupplierNetwork(next)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1400)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Users className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">Supplier Network</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Define which suppliers are recommended when a role is selected for a job posting.
          </p>
        </div>
        <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          <Check className="h-3.5 w-3.5" />
          {saved ? 'Changes saved' : 'Saved automatically'}
        </div>
      </header>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Supplier network view">
        {(['roles', 'suppliers'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={view === mode}
            onClick={() => setView(mode)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${view === mode ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {mode}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : !error ? (
        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${view}…`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div className="max-h-[660px] space-y-2 overflow-y-auto p-3">
              {filteredItems.map((item) => {
                const id = view === 'roles' ? String((item as RoleRecord).id) : supplierKey(item as SupplierRecord)
                const active = id === selectedId
                const relatedCount = view === 'roles'
                  ? suppliers.filter((supplier) => getSupplierTier(network, id, supplierKey(supplier)) !== 'excluded').length
                  : roles.filter((role) => getSupplierTier(network, String(role.id), id) !== 'excluded').length
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`truncate text-sm font-semibold ${active ? 'text-blue-800' : 'text-slate-900'}`}>{item.name}</div>
                        <div className="mt-1 line-clamp-1 text-xs text-slate-500">{view === 'roles' ? roleSummary(item as RoleRecord) : supplierSummary(item as SupplierRecord)}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-500">{relatedCount} {view === 'roles' ? 'suppliers' : 'roles'}</span>
                    </div>
                  </button>
                )
              })}
              {filteredItems.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">No {view} found.</p> : null}
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{view === 'roles' ? 'Role' : 'Supplier'}</p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{selectedRole?.name || selectedSupplier?.name || `Select a ${view === 'roles' ? 'role' : 'supplier'}`}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedRole ? roleSummary(selectedRole) : selectedSupplier ? supplierSummary(selectedSupplier) : 'Choose an item from the list to configure its coverage.'}</p>
                </div>
                {selectedId ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Active</span> : null}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  ['Tier 1', counts.tier1, 'bg-blue-50 text-blue-700'],
                  ['Tier 2', counts.tier2, 'bg-indigo-50 text-indigo-700'],
                  ['Excluded', counts.excluded, 'bg-slate-100 text-slate-600'],
                ].map(([label, count, classes]) => (
                  <div key={String(label)} className={`rounded-xl p-4 ${classes}`}>
                    <div className="text-xs font-medium">{label}</div>
                    <div className="mt-1 text-2xl font-semibold">{count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-950">{view === 'roles' ? 'Supplier eligibility' : 'Role coverage'}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {view === 'roles' ? 'Tier 1 suppliers are recommended first for future job postings. Tier 2 suppliers follow as additional options.' : 'Changes here update the same role–supplier relationships.'}
              </p>

              <div className="mt-4 space-y-2">
                {selectedId && coverageRows.map((item) => {
                  const roleId = view === 'roles' ? selectedId : String((item as RoleRecord).id)
                  const supplierId = view === 'roles' ? supplierKey(item as SupplierRecord) : selectedId
                  const tier = getSupplierTier(network, roleId, supplierId)
                  return (
                    <div key={`${roleId}-${supplierId}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">{view === 'roles' ? supplierSummary(item as SupplierRecord) : roleSummary(item as RoleRecord)}</div>
                      </div>
                      <div className="grid shrink-0 grid-cols-3 gap-2">
                        <TierButton active={tier === 'tier1'} onClick={() => updateTier(roleId, supplierId, 'tier1')}>Tier 1</TierButton>
                        <TierButton active={tier === 'tier2'} onClick={() => updateTier(roleId, supplierId, 'tier2')}>Tier 2</TierButton>
                        <TierButton active={tier === 'excluded'} onClick={() => updateTier(roleId, supplierId, 'excluded')}>Excluded</TierButton>
                      </div>
                    </div>
                  )
                })}
                {selectedId && coverageRows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No active {view === 'roles' ? 'suppliers' : 'roles'} are available.</div> : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
