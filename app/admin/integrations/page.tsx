'use client'

import { useState, useMemo } from 'react'
import { X, Search, Settings2, ShieldCheck, Activity, ChevronRight, Globe } from 'lucide-react'
import {
  LevvEmptyState,
  LevvPage,
  LevvRecordHeader,
  LevvSearchField,
  LevvStatusBadge,
  LevvTabs,
  levvUi,
  type LevvTone,
} from '@/components/ui/levv-app'
import { useLevvDialog } from '@/components/ui/levv-dialog'

type Integration = {
  name: string
  category: string
  description: string
  status: 'connected' | 'disconnected' | 'error'
}

const integrations: Integration[] = [
  { name: 'Asana', category: 'Work Management', description: 'Project and task tracking tied to work requests.', status: 'disconnected' },
  { name: 'Jira', category: 'Work Management', description: 'Delivery tracking, tickets, and execution dependencies.', status: 'disconnected' },
  { name: 'ServiceNow', category: 'Work Management', description: 'Enterprise service workflows and controls.', status: 'disconnected' },
  { name: 'SAP Ariba', category: 'Procurement', description: 'Sourcing, supplier management, and spend control.', status: 'disconnected' },
  { name: 'Coupa', category: 'Procurement', description: 'Spend management and supplier collaboration.', status: 'disconnected' },
  { name: 'NetSuite', category: 'ERP / Finance', description: 'Financials, invoicing, and project accounting.', status: 'disconnected' },
  { name: 'Oracle', category: 'ERP / Finance', description: 'Enterprise finance and procurement backbone.', status: 'disconnected' },
  { name: 'SAP S/4HANA', category: 'ERP / Finance', description: 'Core ERP for finance, procurement, and operations.', status: 'disconnected' },
  { name: 'Slack', category: 'Communications', description: 'Real-time notifications and approval nudges.', status: 'disconnected' },
  { name: 'Microsoft Teams', category: 'Communications', description: 'Enterprise messaging and collaboration.', status: 'disconnected' },
]

const categories = ['All', 'Work Management', 'Procurement', 'ERP / Finance', 'Communications']

const STATUS: Record<Integration['status'], { label: string; tone: LevvTone }> = {
  connected: { label: 'Connected', tone: 'emerald' },
  disconnected: { label: 'Disconnected', tone: 'slate' },
  error: { label: 'Error', tone: 'rose' },
}

/** The catalogue as it stands: how many integrations it lists and how many of them are connected. */
function catalogueStatement() {
  const connected = integrations.filter((item) => item.status === 'connected').length
  const failing = integrations.filter((item) => item.status === 'error').length
  const lead = `${integrations.length} integrations in the catalogue`
  if (connected === 0 && failing === 0) return `${lead}; none is connected.`
  return `${lead}; ${connected} connected${failing > 0 ? `, ${failing} with an error` : ''}.`
}

export default function IntegrationsPage() {
  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('All')

  // Filter Logic
  const filteredIntegrations = useMemo(() => {
    return integrations.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTab = activeTab === 'All' || item.category === activeTab
      return matchesSearch && matchesTab
    })
  }, [searchQuery, activeTab])

  const connected = integrations.filter((item) => item.status === 'connected').length

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Integrations"
          title="Integrations"
          statement={catalogueStatement()}
          figures={[
            { label: 'Available', value: integrations.length },
            { label: 'Connected', value: connected },
          ]}
          actions={<span className="text-[13px] text-slate-500">System Status: Operational</span>}
        />

        <LevvTabs
          label="Integration categories"
          value={activeTab}
          onChange={setActiveTab}
          options={categories.map((cat) => ({ value: cat, label: cat }))}
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="grid w-full gap-1.5 sm:w-72">
            <span className={levvUi.label}>Search</span>
            <LevvSearchField
              placeholder="Search integrations..."
              aria-label="Search integrations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <span className={`${levvUi.legend} ml-auto text-slate-500`}>
            Showing <span className="font-semibold tabular-nums normal-case tracking-normal text-slate-950">{filteredIntegrations.length} of {integrations.length}</span>
          </span>
        </div>

        {/* Grid: a ruled catalogue on the paper */}
        {filteredIntegrations.length > 0 ? (
          <div className="overflow-hidden border-t-2 border-slate-950">
            <ul className="-mr-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {filteredIntegrations.map((integration) => (
                <IntegrationCard
                  key={integration.name}
                  integration={integration}
                  onOpenSettings={() => setActiveIntegration(integration)}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="border-t-2 border-slate-950">
            <LevvEmptyState icon={Search} title="No integrations found">
              Try adjusting your search or filters.
            </LevvEmptyState>
          </div>
        )}
      </div>

      {/* Settings Drawer */}
      {activeIntegration && (
        <SettingsDrawer
          integration={activeIntegration}
          onClose={() => setActiveIntegration(null)}
        />
      )}
    </LevvPage>
  )
}

/* -----------------------------------
    Components
----------------------------------- */

function Monogram({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center bg-slate-950 text-[15px] font-semibold text-white">
      {name[0]}
    </span>
  )
}

function IntegrationCard({ integration, onOpenSettings }: { integration: Integration, onOpenSettings: () => void }) {
  const status = STATUS[integration.status]

  return (
    <li className="group flex flex-col border-b border-r border-[var(--line)] p-5">
      <div className="flex items-start justify-between gap-3">
        <Monogram name={integration.name} />
        <LevvStatusBadge tone={status.tone}>{status.label}</LevvStatusBadge>
      </div>

      <div className="mt-4 flex-1">
        <h3 className="text-[15px] font-semibold text-slate-950">
          {integration.name}
        </h3>
        <p className={`${levvUi.legend} mt-0.5 text-slate-500`}>{integration.category}</p>
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
          {integration.description}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
        <button
          onClick={onOpenSettings}
          className={`${levvUi.ghostButton} -ml-3.5`}
        >
          <Settings2 />
          Configure
        </button>
        <ChevronRight aria-hidden className="h-4 w-4 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5" />
      </div>
    </li>
  )
}

function SettingsDrawer({ integration, onClose }: { integration: Integration, onClose: () => void }) {
  const dialogRef = useLevvDialog<HTMLDivElement>(true, onClose)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/30" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="integration-settings-title"
        tabIndex={-1}
        className="relative flex outline-none h-full w-full max-w-lg flex-col bg-white shadow-[0_20px_44px_-12px_rgb(10_17_40/0.18),0_4px_10px_-4px_rgb(10_17_40/0.06)]"
      >

        <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
          <div className="flex items-center gap-3">
            <Monogram name={integration.name} />
            <div>
              <h2 id="integration-settings-title" className="text-lg font-semibold text-slate-950">{integration.name}</h2>
              <p className="text-[13px] text-slate-500">Configure connection & data flow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`${levvUi.iconButton} shrink-0`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <section>
            <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-950">
              <Activity className="h-4 w-4 text-slate-400" />
              <h3>Connection Status</h3>
            </div>
            <div className="flex items-center justify-between border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
              <span className="text-[13px] text-slate-600">Primary API Endpoint</span>
              <span className="text-[13px] text-slate-500">v2.api.auth</span>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-950">
              <Globe className="h-4 w-4 text-slate-400" />
              <h3>Authentication</h3>
            </div>
            <Field label="Instance URL" placeholder="https://company.service.com" />
            <Field label="API Key" type="password" placeholder="••••••••••••••••" />
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-950">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <h3>Scopes & Permissions</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {['Read Tasks', 'Update Workflow', 'Post Notifications'].map(perm => (
                <Checkbox key={perm} label={perm} />
              ))}
            </div>
          </section>
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--line)] px-6 py-4">
          <button onClick={onClose} className={`${levvUi.secondaryButton} flex-1`}>
            Discard
          </button>
          <button className={`${levvUi.primaryButton} flex-1`}>
            Save Integration
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, placeholder, type = 'text' }: { label: string, placeholder: string, type?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className={levvUi.label}>{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className={levvUi.input}
      />
    </label>
  )
}

function Checkbox({ label }: { label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 transition-colors duration-150 hover:border-[var(--line-strong)]">
      <span className="text-[13px] font-medium text-slate-800">{label}</span>
      <input type="checkbox" className="h-4 w-4 accent-blue-600" />
    </label>
  )
}
