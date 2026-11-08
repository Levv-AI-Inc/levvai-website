'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'

import type { SupplierRecord } from '@/lib/api/suppliers'
import { LevvStatusBadge, levvUi, type LevvTone } from '@/components/ui/levv-app'

import SupplierRowActions from './SupplierRowActions'
import {
  normalizeRole,
  toSupplierKey,
  toTitleCase,
} from '../utils'

type SuppliersListProps = {
  loading: boolean
  suppliers: SupplierRecord[]
  canManageSuppliers: boolean
  canManageContactAccess: boolean
  canManageCoverage: boolean
  detailEnabled: boolean
  onEditSupplier: (supplier: SupplierRecord) => void
  onInviteSupplier: (supplier: SupplierRecord) => void
  onManageCoverage: (supplier: SupplierRecord) => void
  onDeleteSupplier: (supplier: SupplierRecord) => void
}

/* Status words keep their meaning as marks: good in green, waiting or under review in amber, failing in red. */
function statusTone(status: string): LevvTone {
  switch (normalizeRole(status)) {
    case 'active':
      return 'emerald'
    case 'invited':
      return 'amber'
    default:
      return 'slate'
  }
}

function riskTone(risk: string): LevvTone {
  switch (normalizeRole(risk)) {
    case 'low':
      return 'emerald'
    case 'medium':
      return 'amber'
    case 'high':
      return 'rose'
    default:
      return 'slate'
  }
}

function complianceTone(status: string): LevvTone {
  switch (normalizeRole(status)) {
    case 'compliant':
      return 'emerald'
    case 'review_required':
      return 'amber'
    case 'non_compliant':
      return 'rose'
    default:
      return 'slate'
  }
}

const LINK = 'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

export default function SuppliersList({
  loading,
  suppliers,
  canManageSuppliers,
  canManageContactAccess,
  canManageCoverage,
  detailEnabled,
  onEditSupplier,
  onInviteSupplier,
  onManageCoverage,
  onDeleteSupplier,
}: SuppliersListProps) {
  const href = (supplier: SupplierRecord) =>
    `/suppliers/${encodeURIComponent(String(toSupplierKey(supplier)))}/overview`

  const supplierId = (supplier: SupplierRecord) =>
    detailEnabled ? (
      <Link href={href(supplier)} className={`${LINK} font-semibold text-blue-600 hover:text-blue-700 hover:underline`}>
        {supplier.supplier_id}
      </Link>
    ) : (
      <span className="font-semibold text-slate-950">{supplier.supplier_id}</span>
    )

  const supplierName = (supplier: SupplierRecord) =>
    detailEnabled ? (
      <Link href={href(supplier)} className={`${LINK} hover:text-blue-700 hover:underline`}>
        {supplier.name}
      </Link>
    ) : supplier.name

  const meta = (supplier: SupplierRecord) =>
    [toTitleCase(supplier.supplier_type), supplier.category].filter(Boolean).join(' · ')

  const owner = (supplier: SupplierRecord) =>
    supplier.owner_name ? `Owner: ${supplier.owner_name}` : 'No owner'

  const health = (supplier: SupplierRecord) => (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      <LevvStatusBadge tone={statusTone(supplier.status)}>
        {toTitleCase(supplier.status || 'Unknown')}
      </LevvStatusBadge>
      <LevvStatusBadge tone={riskTone(supplier.risk_level)}>
        {toTitleCase(supplier.risk_level || 'Unknown')} risk
      </LevvStatusBadge>
      <LevvStatusBadge tone={complianceTone(supplier.compliance_status)}>
        {toTitleCase(supplier.compliance_status || 'Unknown')}
      </LevvStatusBadge>
    </span>
  )

  const actions = (supplier: SupplierRecord) => (
    <SupplierRowActions
      canManage={canManageSuppliers}
      canManageContactAccess={canManageContactAccess}
      canManageCoverage={canManageCoverage}
      onEdit={() => onEditSupplier(supplier)}
      onInvite={() => onInviteSupplier(supplier)}
      onCoverage={() => onManageCoverage(supplier)}
      onDelete={() => onDeleteSupplier(supplier)}
    />
  )

  if (loading || suppliers.length === 0) {
    return (
      <div className="border-t-2 border-slate-950">
        <div className="px-5 py-16 text-center text-[13px] text-slate-500" aria-busy={loading || undefined}>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading suppliers...
            </span>
          ) : (
            'No suppliers found.'
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`${levvUi.tableShell} levv-cq`}>
      {/* Narrow column: one stacked row per supplier. */}
      <ul className="levv-cq-list divide-y divide-[var(--line)] border-y border-[var(--line)] border-t-2 border-t-slate-950">
        {suppliers.map((supplier) => (
          <li key={String(toSupplierKey(supplier))} className="space-y-2 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-slate-950">{supplierName(supplier)}</div>
                <div className="mt-0.5 text-[13px] text-slate-500">
                  <span className="tabular-nums">{supplierId(supplier)}</span>
                  {meta(supplier) ? ` · ${meta(supplier)}` : null}
                </div>
                <div className="text-[13px] text-slate-500">{owner(supplier)}</div>
              </div>
              <div className="-mr-1.5 shrink-0">{actions(supplier)}</div>
            </div>
            <div className="text-[13px] tabular-nums text-slate-700">
              <span className="font-semibold text-slate-950">{supplier.active_workers} workers</span>
              <span className="text-slate-500"> · {supplier.active_sows} active SOWs</span>
            </div>
            {health(supplier)}
          </li>
        ))}
      </ul>

      {/* Wide column: the table. */}
      <div className="levv-cq-table relative overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr>
              <th className={`${levvUi.th} w-32`}>Supplier ID</th>
              <th className={levvUi.th}>Supplier</th>
              <th className={`${levvUi.th} w-36`}>Activity</th>
              <th className={levvUi.th}>Health</th>
              <th className={`${levvUi.th} w-20 text-right`}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {suppliers.map((supplier) => (
              <tr
                key={String(toSupplierKey(supplier))}
                className="hover:bg-[var(--surface)] [&>td]:border-b [&>td]:border-[var(--line)]"
              >
                <td className={`${levvUi.td} whitespace-nowrap tabular-nums`}>{supplierId(supplier)}</td>
                <td className={levvUi.td}>
                  <div className="font-medium text-slate-950">{supplierName(supplier)}</div>
                  <div className="mt-0.5 text-[13px] text-slate-500">{meta(supplier)}</div>
                  <div className="text-[13px] text-slate-500">{owner(supplier)}</div>
                </td>
                <td className={`${levvUi.td} whitespace-nowrap tabular-nums`}>
                  <div className="font-semibold text-slate-950">{supplier.active_workers} workers</div>
                  <div className="mt-0.5 text-[13px] text-slate-500">{supplier.active_sows} active SOWs</div>
                </td>
                <td className={levvUi.td}>
                  <div className="max-w-72">{health(supplier)}</div>
                </td>
                <td className={`${levvUi.td} text-right`}>{actions(supplier)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
