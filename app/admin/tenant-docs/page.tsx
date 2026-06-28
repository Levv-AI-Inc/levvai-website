'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'

type DocumentType = 'configuration' | 'integration'

type Option = {
  id: string
  label: string
  sub: string
  badge?: string
}

const CONFIG_OPTIONS: Option[] = [
  {
    id: 'org',
    label: 'Company Structure',
    sub: 'Company profile, business units, legal entities, sites, and visibility model',
  },
  {
    id: 'roles',
    label: 'Users, Roles & Permissions',
    sub: 'Roles, permissions by module, and role assignment counts',

  },
  {
    id: 'workflow',
    label: 'Workflow & Approval Rules',
    sub: 'Approval chains, routing logic, thresholds, and escalation paths',
  },
  {
    id: 'workerTypes',
    label: 'Worker & Engagement Types',
    sub: 'Contingent, SOW, classifications, rate models, and tenure rules',
  },
  {
    id: 'financial',
    label: 'Financial Configuration',
    sub: 'Cost centres, GL mapping, invoicing cadence, and rate configuration',
  },
  {
    id: 'customFields',
    label: 'Custom Fields',
    sub: 'Configured fields by module, type, required logic, and dependencies',
  },
  {
    id: 'notifications',
    label: 'Notifications & Escalations',
    sub: 'Triggers, timing windows, recipients, and escalation logic',
  },
  {
    id: 'policy',
    label: 'Policy / Nova Rules',
    sub: 'Uploaded policies, extracted rules, and enforcement coverage',
  },
]

const INTEGRATION_OPTIONS: Option[] = [
  {
    id: 'sso',
    label: 'SSO',
    sub: 'Identity provider, login method, user matching strategy, and auth flow',
    badge: 'Security',
  },
  {
    id: 'users',
    label: 'User Master Data',
    sub: 'User source system, sync direction, key fields, and match/update logic',
  },
  {
    id: 'workers',
    label: 'Worker / Engagement Data',
    sub: 'Worker records, engagement lifecycle data, and activation flows',
  },
  {
    id: 'suppliers',
    label: 'Supplier Master Data',
    sub: 'Supplier sync, onboarding attributes, and status handling',
  },
  {
    id: 'cost-centres',
    label: 'Cost Centres / Financial Master Data',
    sub: 'Cost centres, GL data, financial attributes, and validation logic',
  },
  {
    id: 'rates',
    label: 'Rates & Rate Cards',
    sub: 'Rate payloads, markup structures, sync ownership, and validation',
  },
  {
    id: 'transactions',
    label: 'Transactional Integrations',
    sub: 'Work orders, SOWs, timesheets, invoices, and downstream payloads',
  },
  {
    id: 'audit',
    label: 'Audit / Monitoring',
    sub: 'Integration logging, failure handling, retries, and operational support',
  },
]

export default function TenantDocsPage() {
  const [documentType, setDocumentType] = useState<DocumentType>('configuration')
  const [selected, setSelected] = useState<Set<string>>(
    new Set(CONFIG_OPTIONS.map((s) => s.id))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(
    () => (documentType === 'configuration' ? CONFIG_OPTIONS : INTEGRATION_OPTIONS),
    [documentType]
  )

  const allSelected = options.every((opt) => selected.has(opt.id))

  const switchDocumentType = (next: DocumentType) => {
    setDocumentType(next)
    setSelected(
      new Set(
        (next === 'configuration' ? CONFIG_OPTIONS : INTEGRATION_OPTIONS).map((s) => s.id)
      )
    )
  }

  const toggleScope = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(options.map((s) => s.id)))
  }

  const handleGenerate = async () => {
    if (selected.size === 0) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tenant-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          sections: Array.from(selected),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Failed to generate document.')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `${
        documentType === 'configuration'
          ? 'Tenant_Configuration_Document'
          : 'Integration_Specification'
      }_${new Date().toISOString().slice(0, 10)}.rtf`
      document.body.appendChild(a)
      a.click()
      a.remove()

      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const timestamp = new Date().toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="max-w-4xl">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-gray-900">Tenant Docs</h1>
          <span className="text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
            Live
          </span>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed max-w-3xl">
          Generate documentation directly from the current tenant state. Admins can export
          either configuration documentation or integration specifications without relying on
          SI handoff files at go-live.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 mb-4">
        <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase mb-4">
          Document Type
        </div>

        <div className="grid grid-cols-2 gap-3">
          {([
            {
              id: 'configuration',
              title: 'Configuration Document',
              sub: 'Current enabled functionality, workflows, rules, fields, roles, policies, and platform setup',
            },
            {
              id: 'integration',
              title: 'Integration Specification',
              sub: 'Current integrations, endpoints, mappings, sync rules, master data, and monitoring controls',
            },
          ] as const).map((item) => (
            <button
              key={item.id}
              onClick={() => switchDocumentType(item.id)}
              className={clsx(
                'text-left rounded-xl border-[1.5px] px-4 py-4 transition-all',
                documentType === item.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-200 hover:bg-slate-50'
              )}
            >
              <div className="text-sm font-semibold text-gray-900">{item.title}</div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">{item.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            Include Sections
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              {selected.size} of {options.length} selected
            </span>
            <button
              onClick={toggleAll}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => toggleScope(option.id)}
              className={clsx(
                'text-left flex items-start gap-3 rounded-xl border-[1.5px] px-4 py-3 transition-all',
                selected.has(option.id)
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-200 hover:bg-slate-50'
              )}
            >
              <div
                className={clsx(
                  'mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                  selected.has(option.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                )}
              >
                {selected.has(option.id) && (
                  <span className="text-white text-[10px] font-bold">✓</span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-gray-900">{option.label}</span>
                  {option.badge && (
                    <span className="text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                      {option.badge}
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-gray-400 mt-0.5 leading-relaxed">
                  {option.sub}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 mb-5">
        <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase mb-2">
          Output
        </div>
        <div className="text-sm text-gray-600">
          Exports as a Word-compatible <span className="font-medium">RTF</span> document.
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Snapshot generated from current tenant state as of{' '}
          <span className="text-emerald-600 font-medium">{timestamp}</span>
        </p>

        <button
          onClick={handleGenerate}
          disabled={selected.size === 0 || loading}
          className={clsx(
            'rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all',
            selected.size === 0 || loading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gray-900 hover:bg-gray-700'
          )}
        >
          {loading ? 'Generating…' : 'Generate Document'}
        </button>
      </div>
    </div>
  )
}
