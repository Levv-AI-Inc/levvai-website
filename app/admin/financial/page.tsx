'use client'

import { useMemo, useState, useRef } from 'react'
import { Pencil, Upload, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

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

  // Manage data in state to allow for dynamic updates via upload
  const [financialData, setFinancialData] = useState<Record<Tab, TableRow[]>>({
    'Currency': [
      { currency: 'US Dollar', code: 'USD', symbol: '$', status: 'Active' },
      { currency: 'Euro', code: 'EUR', symbol: '€', status: 'Active' },
      { currency: 'British Pound', code: 'GBP', symbol: '£', status: 'Inactive' },
    ],
    'Expense Codes': [
      { expenseCode: 'TRAVEL', description: 'Travel expenses', status: 'Active' },
      { expenseCode: 'MEALS', description: 'Meals and entertainment', status: 'Active' },
    ],
    'Tax Codes': [
      { taxCode: 'NY-SALES', rate: '8.875%', jurisdiction: 'New York', status: 'Active' },
      { taxCode: 'VAT-UK', rate: '20%', jurisdiction: 'United Kingdom', status: 'Inactive' },
    ],
    'Timesheets': [
      { rule: 'Weekly Hourly', frequency: 'Weekly', approval: 'Yes', status: 'Active' },
      { rule: 'Monthly Fixed Fee', frequency: 'Monthly', approval: 'No', status: 'Active' },
    ],
  })

  const config = useMemo(() => {
    const baseConfig = getTableConfig(activeTab)
    return { ...baseConfig, rows: financialData[activeTab] }
  }, [activeTab, financialData])

  const handleDataUpload = (newData: TableRow[]) => {
    setFinancialData(prev => ({
      ...prev,
      [activeTab]: [...newData, ...prev[activeTab]]
    }))
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Financial</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          Manage financial master data used across billing, invoicing,
          compliance, and worker payments.
        </p>
      </div>

      {/* Action Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Update Panel */}
        <div className="rounded-lg border bg-white p-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Update {activeTab} via AI
          </label>
          <textarea
            className="w-full rounded-md border p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10"
            rows={3}
            placeholder={`e.g., Change the NY-SALES tax rate to 9%`}
          />
          <button className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900">
            ✨ Generate changes
          </button>
        </div>

        {/* Mass Upload Panel */}
        <BulkUploadPanel activeTab={activeTab} onUpload={handleDataUpload} />
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-6 text-sm font-medium">
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
   Bulk Upload Component
----------------------------------- */

function BulkUploadPanel({ activeTab, onUpload }: { activeTab: Tab, onUpload: (data: any[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)

      // Normalize incoming rows
      const rows = data.map((r: any) => ({
        ...r,
        status: r.status || 'Active'
      }))

      onUpload(rows)
      if (fileRef.current) fileRef.current.value = ''
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 flex flex-col items-center justify-center text-center">
      <div className="rounded-full bg-white p-2 shadow-sm mb-2">
        <FileSpreadsheet className="h-5 w-5 text-green-600" />
      </div>
      <h3 className="text-sm font-medium text-gray-900">Bulk Upload {activeTab}</h3>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        Headers must match the {activeTab} table columns.
      </p>
      <input type="file" ref={fileRef} onChange={handleFile} className="hidden" accept=".xlsx,.xls" />
      <button
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Upload className="h-4 w-4" />
        Choose Excel File
      </button>
    </div>
  )
}

/* -----------------------------------
   Table Layout & UI (Unchanged logic, minor tweaks)
----------------------------------- */

function TableLayout({ config }: { config: TableConfig }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
        <button className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          + {config.addLabel}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm text-gray-900">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {config.columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left font-medium">{col.label}</th>
              ))}
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {config.rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {config.columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">{row[col.key] || '—'}</td>
                ))}
                <td className="px-4 py-3"><StatusPill status={row.status} /></td>
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
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
      status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
    }`}>
      {status}
    </span>
  )
}

function getTableConfig(activeTab: Tab): Omit<TableConfig, 'rows'> {
  const configs: Record<Tab, Omit<TableConfig, 'rows'>> = {
    'Currency': {
      title: 'Currencies',
      addLabel: 'Add currency',
      columns: [
        { key: 'currency', label: 'Currency' },
        { key: 'code', label: 'ISO Code' },
        { key: 'symbol', label: 'Symbol' },
      ],
    },
    'Expense Codes': {
      title: 'Expense codes',
      addLabel: 'Add expense code',
      columns: [
        { key: 'expenseCode', label: 'Expense code' },
        { key: 'description', label: 'Description' },
      ],
    },
    'Tax Codes': {
      title: 'Tax codes',
      addLabel: 'Add tax code',
      columns: [
        { key: 'taxCode', label: 'Tax code' },
        { key: 'rate', label: 'Tax rate' },
        { key: 'jurisdiction', label: 'Jurisdiction' },
      ],
    },
    'Timesheets': {
      title: 'Timesheet rules',
      addLabel: 'Add timesheet rule',
      columns: [
        { key: 'rule', label: 'Rule name' },
        { key: 'frequency', label: 'Submission frequency' },
        { key: 'approval', label: 'Approval required' },
      ],
    },
  }
  return configs[activeTab]
}