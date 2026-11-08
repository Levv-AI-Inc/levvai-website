'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import {
  LevvNotice,
  LevvPage,
  LevvPanel,
  LevvRecordHeader,
  levvUi,
} from '@/components/ui/levv-app'

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
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Tenant Docs"
          title="Tenant Docs"
          statement="Generate documentation directly from the current tenant state. Admins can export either configuration documentation or integration specifications without relying on SI handoff files at go-live."
        />

        <section>
          <h2 className={`${levvUi.legend} mb-3 text-slate-500`}>
            Document Type
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
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
                aria-pressed={documentType === item.id}
                className={clsx(
                  'levv-press border px-4 py-4 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ground)]',
                  documentType === item.id
                    ? 'border-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-600'
                    : 'border-[var(--line-strong)] bg-[var(--surface)] hover:border-slate-500'
                )}
              >
                <span className="flex items-center justify-between gap-3 text-[14px] font-semibold text-slate-950">
                  {item.title}
                  {documentType === item.id && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-slate-600">{item.sub}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className={`${levvUi.legend} text-slate-500`}>
              Include Sections
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[13px] tabular-nums text-slate-500">
                <span className="font-semibold text-slate-950">{selected.size}</span> of {options.length} selected
              </span>
              <button
                onClick={toggleAll}
                className={levvUi.ghostButton}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div className="grid border-t-2 border-slate-950 sm:grid-cols-2 sm:gap-x-6">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => toggleScope(option.id)}
                aria-pressed={selected.has(option.id)}
                className="flex items-start gap-3 border-b border-[var(--line)] px-2 py-3 text-left outline-none transition-colors duration-150 hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
              >
                <span
                  aria-hidden
                  className={clsx(
                    'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center border',
                    selected.has(option.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-500 bg-[var(--surface)]'
                  )}
                >
                  {selected.has(option.id) && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>

                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-slate-950">{option.label}</span>
                    {option.badge && (
                      <span className={`border border-slate-400 px-1.5 py-px ${levvUi.legend} text-slate-600`}>
                        {option.badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-slate-500">
                    {option.sub}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <LevvPanel className="px-5 py-4">
          <h2 className={`${levvUi.legend} mb-2 text-slate-500`}>
            Output
          </h2>
          <p className="text-[14px] text-slate-700">
            Exports as a Word-compatible <span className="font-semibold text-slate-950">RTF</span> document.
          </p>

          {error && <LevvNotice tone="rose" className="mt-4">{error}</LevvNotice>}

          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-slate-500">
              Snapshot generated from current tenant state as of{' '}
              <span className="font-medium tabular-nums text-slate-950">{timestamp}</span>
            </p>

            <button
              onClick={handleGenerate}
              disabled={selected.size === 0 || loading}
              className={levvUi.primaryButton}
            >
              {loading ? 'Generating…' : 'Generate Document'}
            </button>
          </div>
        </LevvPanel>
      </div>
    </LevvPage>
  )
}
