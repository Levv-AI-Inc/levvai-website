'use client'

import { Loader2 } from 'lucide-react'

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
  onEditSupplier: (supplier: SupplierRecord) => void
  onInviteSupplier: (supplier: SupplierRecord) => void
  onDeleteSupplier: (supplier: SupplierRecord) => void
}

export default function SuppliersList({
  loading,
  suppliers,
  canManageSuppliers,
  onEditSupplier,
  onInviteSupplier,
  onDeleteSupplier,
}: SuppliersListProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Supplier ID</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Supplier Name</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Type</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Category</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Workers</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">SOWs</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Owner</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Risk</th>
              <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Compliance</th>
              <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-8 py-16 text-center text-sm font-medium text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading suppliers...
                  </div>
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-8 py-16 text-center text-sm font-medium text-slate-500">
                  No suppliers found.
                </td>
              </tr>
            ) : (
              suppliers.map((supplier) => (
                <tr key={String(toSupplierKey(supplier))} className="group transition-all hover:bg-cyan-50/40">
                  <td className="px-8 py-6 font-black text-cyan-600">{supplier.supplier_id}</td>
                  <td className="px-8 py-6 font-bold text-slate-900">{supplier.name}</td>
                  <td className="px-8 py-6 text-slate-700">{toTitleCase(supplier.supplier_type)}</td>
                  <td className="px-8 py-6 text-slate-700">{supplier.category || '-'}</td>
                  <td className="px-8 py-6 text-slate-700">{supplier.active_workers}</td>
                  <td className="px-8 py-6 text-slate-700">{supplier.active_sows}</td>
                  <td className="px-8 py-6 text-slate-700">{supplier.owner_name || '-'}</td>
                  <td className="px-8 py-6">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', statusBadgeClass(supplier.status))}>
                      {toTitleCase(supplier.status || 'Unknown')}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', riskBadgeClass(supplier.risk_level))}>
                      {toTitleCase(supplier.risk_level || 'Unknown')}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-bold',
                        complianceBadgeClass(supplier.compliance_status),
                      )}
                    >
                      {toTitleCase(supplier.compliance_status || 'Unknown')}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <SupplierRowActions
                      canManage={canManageSuppliers}
                      onEdit={() => onEditSupplier(supplier)}
                      onInvite={() => onInviteSupplier(supplier)}
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
