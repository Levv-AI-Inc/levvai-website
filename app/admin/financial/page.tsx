'use client'

import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'

const TABS = [
  'Currency',
  'Expense Codes',
  'Tax Codes',
  'Timesheets',
] as const

type Tab = (typeof TABS)[number]
type RowStatus = 'Active' | 'Inactive'

type TableRow = {
  status: RowStatus
  [key: string]: any
}

type TableConfig = {
  title: string
  addLabel: string
  columns: { key: string; label: string }[]
  rows: TableRow[]
}

export default function FinancialPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Currency')
  const config = useMemo(() => getTableConfig(activeTab), [activeTab])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Financial</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          Manage financial master data used across billing, invoicing,
          compliance, and worker payments.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6 flex gap-6 text-sm font-medium">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 transition ${
              activeTab === tab
                ? 'border-b-2 border-black text-black'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <TableLayout config={config} />
    </div>
  )
}

/* -----------------------------------
   Table Layout
----------------------------------- */

function TableLayout({ config }: { config: TableConfig }) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {config.title}
        </h2>
        <button className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          + {config.addLabel}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {config.columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-medium"
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {config.rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {config.columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    {row[col.key]}
                  </td>
                ))}

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <button className="p-2 rounded-md hover:bg-gray-100">
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

function StatusPill({ status }: { status: RowStatus }) {
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

/* -----------------------------------
   Financial Table Configs
----------------------------------- */

function getTableConfig(activeTab: Tab): TableConfig {
  switch (activeTab) {
    case 'Currency':
      return {
        title: 'Currencies',
        addLabel: 'Add currency',
        columns: [
          { key: 'currency', label: 'Currency' },
          { key: 'code', label: 'ISO Code' },
          { key: 'symbol', label: 'Symbol' },
        ],
        rows: [
          { currency: 'US Dollar', code: 'USD', symbol: '$', status: 'Active' },
          { currency: 'Euro', code: 'EUR', symbol: '€', status: 'Active' },
          { currency: 'British Pound', code: 'GBP', symbol: '£', status: 'Inactive' },
        ],
      }

    case 'Expense Codes':
      return {
        title: 'Expense codes',
        addLabel: 'Add expense code',
        columns: [
          { key: 'expenseCode', label: 'Expense code' },
          { key: 'description', label: 'Description' },
        ],
        rows: [
          { expenseCode: 'TRAVEL', description: 'Travel expenses', status: 'Active' },
          { expenseCode: 'MEALS', description: 'Meals and entertainment', status: 'Active' },
          { expenseCode: 'EQUIP', description: 'Equipment purchases', status: 'Inactive' },
        ],
      }

    case 'Tax Codes':
      return {
        title: 'Tax codes',
        addLabel: 'Add tax code',
        columns: [
          { key: 'taxCode', label: 'Tax code' },
          { key: 'rate', label: 'Tax rate' },
          { key: 'jurisdiction', label: 'Jurisdiction' },
        ],
        rows: [
          { taxCode: 'NY-SALES', rate: '8.875%', jurisdiction: 'New York', status: 'Active' },
          { taxCode: 'CA-SALES', rate: '7.25%', jurisdiction: 'California', status: 'Active' },
          { taxCode: 'VAT-UK', rate: '20%', jurisdiction: 'United Kingdom', status: 'Inactive' },
        ],
      }

    case 'Timesheets':
      return {
        title: 'Timesheet rules',
        addLabel: 'Add timesheet rule',
        columns: [
          { key: 'rule', label: 'Rule name' },
          { key: 'frequency', label: 'Submission frequency' },
          { key: 'approval', label: 'Approval required' },
        ],
        rows: [
          { rule: 'Weekly Hourly', frequency: 'Weekly', approval: 'Yes', status: 'Active' },
          { rule: 'Monthly Fixed Fee', frequency: 'Monthly', approval: 'No', status: 'Active' },
          { rule: 'Biweekly Contract', frequency: 'Biweekly', approval: 'Yes', status: 'Inactive' },
        ],
      }

    default:
      return {
        title: 'Financial',
        addLabel: 'Add',
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ name: 'Example', status: 'Active' }],
      }
  }
}
