'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

type Integration = {
  name: string
  category: string
  description: string
}

const integrations: Integration[] = [
  { name: 'Asana', category: 'Work Management', description: 'Project and task tracking tied to work requests.' },
  { name: 'Jira', category: 'Work Management', description: 'Delivery tracking, tickets, and execution dependencies.' },
  { name: 'ServiceNow', category: 'Work Management', description: 'Enterprise service workflows and controls.' },

  { name: 'SAP Ariba', category: 'Procurement', description: 'Sourcing, supplier management, and spend control.' },
  { name: 'Coupa', category: 'Procurement', description: 'Spend management and supplier collaboration.' },

  { name: 'NetSuite', category: 'ERP / Finance', description: 'Financials, invoicing, and project accounting.' },
  { name: 'Oracle', category: 'ERP / Finance', description: 'Enterprise finance and procurement backbone.' },
  { name: 'SAP S/4HANA', category: 'ERP / Finance', description: 'Core ERP for finance, procurement, and operations.' },

  { name: 'Slack', category: 'Communications', description: 'Real-time notifications and approval nudges.' },
  { name: 'Microsoft Teams', category: 'Communications', description: 'Enterprise messaging and collaboration.' },
]

export default function IntegrationsPage() {
  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null)
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Integrations & workflows
        </h1>
        <p className="mt-1 text-sm text-gray-600 max-w-2xl">
          Configure how CWS connects to enterprise systems to orchestrate work,
          approvals, and compliance.
        </p>
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {integrations.map((integration) => {
          const isOn = enabled[integration.name]

          return (
            <div
              key={integration.name}
              className="rounded-xl border bg-white p-5 flex flex-col justify-between hover:shadow-sm transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  {/* Initial badge */}
                  <div className="h-10 w-10 rounded-lg bg-gray-900 text-white flex items-center justify-center font-semibold">
                    {integration.name[0]}
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() =>
                      setEnabled((prev) => ({
                        ...prev,
                        [integration.name]: !prev[integration.name],
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      isOn ? 'bg-black' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        isOn ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <h3 className="mt-4 font-medium text-gray-900">
                  {integration.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {integration.category}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  {integration.description}
                </p>
              </div>

              <button
                onClick={() => setActiveIntegration(integration)}
                className="mt-5 w-full rounded-md border border-gray-300 py-2 text-sm font-medium hover:bg-gray-50 transition"
              >
                Settings
              </button>
            </div>
          )
        })}
      </div>

      {/* Settings Drawer */}
      {activeIntegration && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-md bg-white h-full p-6 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {activeIntegration.name}
                </h2>
                <p className="text-sm text-gray-500">
                  Integration settings
                </p>
              </div>
              <button onClick={() => setActiveIntegration(null)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <IntegrationSettingsForm />

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setActiveIntegration(null)}
                className="px-4 py-2 text-sm border rounded-md"
              >
                Cancel
              </button>
              <button className="px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800">
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* -----------------------------------
   Settings Form
----------------------------------- */

function IntegrationSettingsForm() {
  return (
    <div className="space-y-6 text-sm">
      {/* Status */}
      <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-gray-50">
        <span className="text-gray-700">Connection status</span>
        <span className="text-gray-600 font-medium">● Not Connected</span>
      </div>

      {/* Credentials */}
      <div>
        <h3 className="font-medium text-gray-900 mb-2">
          Authentication
        </h3>
        <div className="space-y-3">
          <Field label="Instance URL" placeholder="https://company.system.com" />
          <Field label="Client ID" placeholder="Enter client ID" />
          <Field label="Client Secret" placeholder="••••••••••••" type="password" />
        </div>
      </div>

      {/* Upload */}
      <div>
        <label className="block font-medium text-gray-900 mb-1">
          Service account key (JSON)
        </label>
        <div className="border border-dashed rounded-md p-4 text-center text-gray-500 text-sm">
          Click to upload or drag and drop
        </div>
      </div>

      {/* Permissions */}
      <div>
        <h3 className="font-medium text-gray-900 mb-2">
          Permissions
        </h3>
        <div className="space-y-2">
          <Checkbox label="Read workflow status" />
          <Checkbox label="Read approval outcomes" />
          <Checkbox label="Trigger notifications" />
        </div>
      </div>

      {/* Safety */}
      <div className="rounded-md border bg-gray-50 p-3 text-xs text-gray-600">
        This integration operates in <strong>read-only</strong> mode by default
        to prevent unintended changes in source systems.
      </div>
    </div>
  )
}

/* -----------------------------------
   Small Reusable Inputs
----------------------------------- */

function Field({
  label,
  placeholder,
  type = 'text',
}: {
  label: string
  placeholder: string
  type?: string
}) {
  return (
    <div>
      <label className="block mb-1 text-gray-700">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
      />
    </div>
  )
}

function Checkbox({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-2 text-gray-700">
      <input type="checkbox" className="rounded border-gray-300" />
      {label}
    </label>
  )
}
