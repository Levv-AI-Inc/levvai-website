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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Supplier ID</th>
              <th className="px-4 py-3 font-medium">Supplier Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Active Workers</th>
              <th className="px-4 py-3 font-medium">Active SOWs</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Compliance</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading suppliers...
                  </div>
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  No suppliers found.
                </td>
              </tr>
            ) : (
              suppliers.map((supplier) => (
                <tr key={String(toSupplierKey(supplier))} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{supplier.supplier_id}</td>
                  <td className="px-4 py-3 text-slate-800">{supplier.name}</td>
                  <td className="px-4 py-3 text-slate-700">{toTitleCase(supplier.supplier_type)}</td>
                  <td className="px-4 py-3 text-slate-700">{supplier.category || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{supplier.active_workers}</td>
                  <td className="px-4 py-3 text-slate-700">{supplier.active_sows}</td>
                  <td className="px-4 py-3 text-slate-700">{supplier.owner_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-1 text-xs font-medium', statusBadgeClass(supplier.status))}>
                      {toTitleCase(supplier.status || 'Unknown')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-1 text-xs font-medium', riskBadgeClass(supplier.risk_level))}>
                      {toTitleCase(supplier.risk_level || 'Unknown')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-xs font-medium',
                        complianceBadgeClass(supplier.compliance_status),
                      )}
                    >
                      {toTitleCase(supplier.compliance_status || 'Unknown')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
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
