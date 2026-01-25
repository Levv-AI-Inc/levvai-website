'use client'

import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'

const TABS = [
  'Business Units',
  'Cost Centers',
  'Locations',
  'Worksites',
  'Legal Entities',
  'Subsidiaries',
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

export default function CompanyPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Business Units')
  const config = useMemo(() => getTableConfig(activeTab), [activeTab])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* =========================
          Header
      ========================= */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Company</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          Manage organizational master data used across intake, approvals,
          compliance, and financial workflows.
        </p>
      </div>

      {/* =========================
          AI Rules / Insights Panel
      ========================= */}
      <AIRulesPanel />

      {/* =========================
          Tabs
      ========================= */}
      <div className="border-b flex flex-wrap gap-6 text-sm font-medium">
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

      {/* =========================
          Table Section
      ========================= */}
      <TableLayout config={config} />
    </div>
  )
}

/* -----------------------------------
   AI RULES PANEL (UI ONLY)
----------------------------------- */

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
          placeholder="Type to create or edit Company information"
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
                <th key={col.key} className="px-4 py-3 text-left font-medium">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-medium">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {config.rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {config.columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-900">
                    {row[col.key]}
                  </td>
                ))}

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <button
                    className="inline-flex items-center justify-center rounded-md p-2 hover:bg-gray-100 transition"
                    aria-label="Edit"
                  >
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
   Tab Configs
----------------------------------- */

function getTableConfig(activeTab: Tab): TableConfig {
  switch (activeTab) {
    case 'Business Units':
      return {
        title: 'Business units',
        addLabel: 'Add business unit',
        columns: [{ key: 'businessUnit', label: 'Business unit' }],
        rows: [
          { businessUnit: 'Technology', status: 'Active' },
          { businessUnit: 'Operations', status: 'Inactive' },
        ],
      }

    case 'Cost Centers':
      return {
        title: 'Cost centers',
        addLabel: 'Add cost center',
        columns: [
          { key: 'costCenter', label: 'Cost center' },
          { key: 'erpId', label: 'ERP ID' },
        ],
        rows: [
          { costCenter: 'IT-1001', erpId: 'CC-7781', status: 'Active' },
          { costCenter: 'OPS-2003', erpId: 'CC-8820', status: 'Inactive' },
        ],
      }

    case 'Locations':
      return {
        title: 'Locations',
        addLabel: 'Add location',
        columns: [
          { key: 'location', label: 'Location' },
          { key: 'country', label: 'Country' },
          { key: 'region', label: 'Region' },
        ],
        rows: [
          { location: 'New York', country: 'USA', region: 'North America', status: 'Active' },
          { location: 'London', country: 'UK', region: 'EMEA', status: 'Active' },
        ],
      }

    case 'Worksites':
      return {
        title: 'Worksites',
        addLabel: 'Add worksite',
        columns: [
          { key: 'worksite', label: 'Worksite' },
          { key: 'location', label: 'Location' },
          { key: 'workMode', label: 'Onsite / Remote' },
        ],
        rows: [
          { worksite: 'NYC – HQ', location: 'New York', workMode: 'Onsite', status: 'Active' },
          { worksite: 'Remote US', location: 'USA', workMode: 'Remote', status: 'Inactive' },
        ],
      }

    case 'Legal Entities':
      return {
        title: 'Legal entities',
        addLabel: 'Add legal entity',
        columns: [
          { key: 'legalEntity', label: 'Legal entity' },
          { key: 'registrationId', label: 'Registration ID' },
          { key: 'country', label: 'Country' },
        ],
        rows: [
          { legalEntity: 'CWS Inc.', registrationId: '98-1234567', country: 'USA', status: 'Active' },
          { legalEntity: 'CWS Canada Ltd.', registrationId: 'BC-445533', country: 'Canada', status: 'Inactive' },
        ],
      }

    case 'Subsidiaries':
      return {
        title: 'Subsidiaries',
        addLabel: 'Add subsidiary',
        columns: [
          { key: 'subsidiary', label: 'Subsidiary' },
          { key: 'displayName', label: 'Display name' },
          { key: 'erpId', label: 'ERP ID' },
          { key: 'paymentsOnboarding', label: 'Payments onboarding' },
        ],
        rows: [
          {
            subsidiary: 'Dummy Subsidiary 1',
            displayName: 'Subsidiary 1',
            erpId: '-',
            paymentsOnboarding: '-',
            status: 'Inactive',
          },
          {
            subsidiary: 'Dummy Subsidiary 2',
            displayName: 'Subsidiary 2',
            erpId: '-',
            paymentsOnboarding: '-',
            status: 'Inactive',
          },
          {
            subsidiary: 'Zip Child Subsidiary',
            displayName: 'Zip LLC',
            erpId: '-',
            paymentsOnboarding: '-',
            status: 'Inactive',
          },
          {
            subsidiary: 'Honeycomb Manufacturing Inc.',
            displayName: '-',
            erpId: '-',
            paymentsOnboarding: '-',
            status: 'Active',
          },
        ],
      }

    default:
      return {
        title: 'Company',
        addLabel: 'Add',
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ name: 'Example', status: 'Active' }],
      }
  }
}
