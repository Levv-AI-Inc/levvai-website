'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'

import type { SupplierRecord } from '@/lib/api/suppliers'
import { cn } from '@/lib/utils'

import SupplierRowActions from './SupplierRowActions'
import {
  complianceBadgeClass,
  riskBadgeClass,
  statusBadgeClass,
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
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[620px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Supplier ID</th>
              <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Supplier</th>
              <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Activity</th>
              <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Health</th>
              <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm font-medium text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading suppliers...
                  </div>
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm font-medium text-slate-500">
                  No suppliers found.
                </td>
              </tr>
            ) : (
              suppliers.map((supplier) => (
                <tr key={String(toSupplierKey(supplier))} className="group transition-all hover:bg-cyan-50/40">
                  <td className="whitespace-nowrap px-5 py-5 font-black text-cyan-600">
                    {detailEnabled ? (
                      <Link
                        href={`/suppliers/${encodeURIComponent(String(toSupplierKey(supplier)))}/overview`}
                        className="rounded-sm hover:text-cyan-800 hover:underline focus:outline-none focus:ring-2 focus:ring-[#89d3bd]"
                      >
                        {supplier.supplier_id}
                      </Link>
                    ) : supplier.supplier_id}
                  </td>
                  <td className="px-4 py-5 text-slate-900">
                    <div className="font-bold">
                      {detailEnabled ? (
                        <Link
                          href={`/suppliers/${encodeURIComponent(String(toSupplierKey(supplier)))}/overview`}
                          className="rounded-sm hover:text-cyan-700 hover:underline focus:outline-none focus:ring-2 focus:ring-[#89d3bd]"
                        >
                          {supplier.name}
                        </Link>
                      ) : supplier.name}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-400">
                      {[toTitleCase(supplier.supplier_type), supplier.category].filter(Boolean).join(' · ')}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-400">
                      {supplier.owner_name ? `Owner: ${supplier.owner_name}` : 'No owner'}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-5 text-slate-700">
                    <div className="font-semibold">{supplier.active_workers} workers</div>
                    <div className="mt-1 text-xs text-slate-400">{supplier.active_sows} active SOWs</div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex max-w-56 flex-wrap gap-1.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', statusBadgeClass(supplier.status))}>
                        {toTitleCase(supplier.status || 'Unknown')}
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', riskBadgeClass(supplier.risk_level))}>
                        {toTitleCase(supplier.risk_level || 'Unknown')} risk
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', complianceBadgeClass(supplier.compliance_status))}>
                        {toTitleCase(supplier.compliance_status || 'Unknown')}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-right">
                    <SupplierRowActions
                      canManage={canManageSuppliers}
                      canManageContactAccess={canManageContactAccess}
                      canManageCoverage={canManageCoverage}
                      onEdit={() => onEditSupplier(supplier)}
                      onInvite={() => onInviteSupplier(supplier)}
                      onCoverage={() => onManageCoverage(supplier)}
                      onDelete={() => onDeleteSupplier(supplier)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
