'use client'

import { Pencil } from 'lucide-react'

type SupplierStatus = 'Active' | 'Inactive'

type Supplier = {
  name: string
  supplierId: string
  country: string
  status: SupplierStatus
}

const suppliers: Supplier[] = [
  {
    name: 'Honeycomb Manufacturing Inc.',
    supplierId: 'SUP-10021',
    country: 'United States',
    status: 'Active',
  },
  {
    name: 'Northstar Consulting Group',
    supplierId: 'SUP-10034',
    country: 'Canada',
    status: 'Inactive',
  },
  {
    name: 'Vertex IT Services',
    supplierId: 'SUP-10058',
    country: 'United Kingdom',
    status: 'Active',
  },
]

export default function SuppliersPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* =========================
          Header
      ========================= */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Suppliers
          </h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Manage supplier master data used across sourcing, contracts,
            onboarding, invoicing, and payments.
          </p>
        </div>

        <button className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          + Add new supplier
        </button>
      </div>

      {/* =========================
          AI Rules / Insights Panel
      ========================= */}
      <AIRulesPanel />

      {/* =========================
          Suppliers Table
      ========================= */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">
                Supplier name
              </th>
              <th className="px-4 py-3 text-left font-medium">
                Supplier ID
              </th>
              <th className="px-4 py-3 text-left font-medium">
                Country
              </th>
              <th className="px-4 py-3 text-left font-medium">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {suppliers.map((supplier, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-gray-900">
                  {supplier.name}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {supplier.supplierId}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {supplier.country}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusPill status={supplier.status} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <button className="p-2 rounded-md hover:bg-gray-100 transition">
                    <Pencil className="h-4 w-4 text-gray-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* =========================
   AI RULES PANEL (UI ONLY)
========================= */

function AIRulesPanel() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left */}
      <div className="md:col-span-2 rounded-lg border bg-white p-4">
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Type the desired changes or updates
        </label>
        <textarea
          className="w-full rounded-md border p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10"
          rows={3}
          placeholder="Type to create or edit Supplier information"
        />
        <button className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900">
          ✨ Generate rules
        </button>
      </div>

      {/* Right */}
      <div className="rounded-lg border bg-white p-4">
        <div className="font-medium text-gray-900 mb-1">
          ✨ AI Insights
        </div>
        <p className="text-sm text-gray-600">
          Generate rules to see insights.
        </p>
      </div>
    </div>
  )
}

/* =========================
   Status Pill
========================= */

function StatusPill({ status }: { status: SupplierStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        status === 'Active'
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-200 text-gray-700'
      }`}
    >
      {status}
    </span>
  )
}
