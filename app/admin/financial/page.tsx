'use client'

import { useMemo, useState, useRef } from 'react'
import { Plus, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  LevvNovaPanel,
  LevvPage,
  LevvRecordHeader,
  LevvStatusBadge,
  LevvTabs,
  LevvUploadZone,
  levvUi,
} from '@/components/ui/levv-app'

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
  const [aiRequest, setAiRequest] = useState('')

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
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Financial"
          title="Financial"
          statement="Manage financial master data used across billing, invoicing, compliance, and worker payments."
          actions={
            <button className={levvUi.primaryButton}>
              <Plus /> {config.addLabel}
            </button>
          }
        />

        {/* Action Panels */}
        <div className="grid gap-4 xl:grid-cols-2">
          {/* AI Update Panel */}
          <LevvNovaPanel
            title={`Update ${activeTab} via AI`}
            placeholder="e.g., Change the NY-SALES tax rate to 9%"
            value={aiRequest}
            onChange={setAiRequest}
            submitLabel="Generate changes"
          />

          {/* Mass Upload Panel */}
          <BulkUploadPanel activeTab={activeTab} onUpload={handleDataUpload} />
        </div>

        <div className="space-y-5">
          <LevvTabs<Tab>
            label="Financial master data"
            value={activeTab}
            onChange={setActiveTab}
            options={TABS.map((tab) => ({ value: tab, label: tab }))}
          />

          <TableLayout config={config} />
        </div>
      </div>
    </LevvPage>
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
    <>
      <input type="file" ref={fileRef} onChange={handleFile} className="hidden" accept=".xlsx,.xls" />
      <LevvUploadZone
        title={`Bulk Upload ${activeTab}`}
        description={`Headers must match the ${activeTab} table columns.`}
        action={
          <button
            onClick={() => fileRef.current?.click()}
            className={levvUi.secondaryButton}
          >
            <Upload />
            Choose Excel File
          </button>
        }
      />
    </>
  )
}

/* -----------------------------------
   Table Layout & UI (Unchanged logic, minor tweaks)
----------------------------------- */

/** A tab's records on the paper: a table when the column is wide enough, stacked rows when it is not. */
function TableLayout({ config }: { config: TableConfig }) {
  const [lead, ...rest] = config.columns
  const edit = (row: TableRow) => (
    <button className={levvUi.secondaryButton} aria-label={`Edit ${row[lead.key] || config.title}`}>
      Edit
    </button>
  )

  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold text-slate-950">{config.title}</h2>

      <div className={`${levvUi.tableShell} levv-cq`}>
        <ul className="levv-cq-list divide-y divide-[var(--line)] border-t-2 border-slate-950">
          {config.rows.map((row, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3 py-3.5">
              <div className="min-w-0 space-y-1.5">
                <p className="text-[14px] font-medium text-slate-950">{row[lead.key] || '—'}</p>
                <dl className="grid gap-y-1">
                  {rest.map((col) => (
                    <div key={col.key} className="flex flex-wrap items-baseline gap-x-2">
                      <dt className={levvUi.label}>{col.label}</dt>
                      <dd className="text-[13px] tabular-nums text-slate-800">{row[col.key] || '—'}</dd>
                    </div>
                  ))}
                </dl>
                <StatusPill status={row.status} />
              </div>
              {edit(row)}
            </li>
          ))}
        </ul>

        <div className="levv-cq-table relative overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                {config.columns.map((col) => (
                  <th key={col.key} className={levvUi.th}>{col.label}</th>
                ))}
                <th className={`${levvUi.th} w-32`}>Status</th>
                <th className={`${levvUi.th} w-24`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {config.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-[var(--surface)] [&>td]:border-b [&>td]:border-[var(--line)]">
                  {config.columns.map((col, colIdx) => (
                    <td
                      key={col.key}
                      className={`${levvUi.td} tabular-nums ${colIdx === 0 ? 'font-medium text-slate-950' : ''}`}
                    >
                      {row[col.key] || '—'}
                    </td>
                  ))}
                  <td className={levvUi.td}><StatusPill status={row.status} /></td>
                  <td className={`${levvUi.td} py-2`}>{edit(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function StatusPill({ status }: { status: RowStatus }) {
  return <LevvStatusBadge tone={status === 'Active' ? 'emerald' : 'slate'}>{status}</LevvStatusBadge>
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