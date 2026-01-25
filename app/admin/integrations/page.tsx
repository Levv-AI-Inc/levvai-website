'use client'

import { useState, useMemo } from 'react'
import { X, Search, Settings2, ShieldCheck, Activity, ChevronRight, Globe } from 'lucide-react'

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

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Integrations</h1>
            <p className="mt-2 text-gray-600 max-w-xl">
              Connect your third-party tools to automate workflows and keep your enterprise data in sync.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white p-1 rounded-lg border shadow-sm">
             <div className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md flex items-center gap-1.5">
               <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
               System Status: Operational
             </div>
          </div>
        </div>

        {/* Toolbar: Search & Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-8">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === cat 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-black/5 outline-none transition"
            />
          </div>
        </div>

        {/* Grid */}
        {filteredIntegrations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIntegrations.map((integration) => (
              <IntegrationCard 
                key={integration.name} 
                integration={integration} 
                onOpenSettings={() => setActiveIntegration(integration)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
            <div className="mx-auto h-12 w-12 text-gray-300 mb-4"><Search size={48} /></div>
            <h3 className="text-lg font-medium text-gray-900">No integrations found</h3>
            <p className="text-gray-500">Try adjusting your search or filters.</p>
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
    </div>
  )
}

/* -----------------------------------
    Components
----------------------------------- */

function IntegrationCard({ integration, onOpenSettings }: { integration: Integration, onOpenSettings: () => void }) {
  const statusStyles = {
    connected: 'bg-green-50 text-green-700 border-green-100',
    disconnected: 'bg-gray-50 text-gray-600 border-gray-100',
    error: 'bg-red-50 text-red-700 border-red-100'
  }

  return (
    <div className="group relative bg-white rounded-2xl border p-6 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className="h-12 w-12 rounded-xl bg-gray-900 text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-gray-200">
          {integration.name[0]}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusStyles[integration.status]}`}>
          {integration.status}
        </span>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
          {integration.name}
        </h3>
        <p className="text-xs font-medium text-gray-400 mb-3">{integration.category}</p>
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {integration.description}
        </p>
      </div>

      <div className="mt-6 pt-6 border-t flex items-center justify-between">
        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-black transition"
        >
          <Settings2 size={16} />
          Configure
        </button>
        <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  )
}

function SettingsDrawer({ integration, onClose }: { integration: Integration, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        <div className="p-8 border-b flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-black text-white flex items-center justify-center font-bold">
              {integration.name[0]}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{integration.name}</h2>
              <p className="text-sm text-gray-500">Configure connection & data flow</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full border transition shadow-sm">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4 text-gray-900 font-bold">
              <Activity size={18} />
              <h3>Connection Status</h3>
            </div>
            <div className="p-4 rounded-xl border bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-600">Primary API Endpoint</span>
              <span className="text-sm font-mono text-gray-400">v2.api.auth</span>
            </div>
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2 mb-2 text-gray-900 font-bold">
              <Globe size={18} />
              <h3>Authentication</h3>
            </div>
            <Field label="Instance URL" placeholder="https://company.service.com" />
            <Field label="API Key" type="password" placeholder="••••••••••••••••" />
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-2 mb-2 text-gray-900 font-bold">
              <ShieldCheck size={18} />
              <h3>Scopes & Permissions</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {['Read Tasks', 'Update Workflow', 'Post Notifications'].map(perm => (
                <Checkbox key={perm} label={perm} />
              ))}
            </div>
          </section>
        </div>

        <div className="p-8 border-t bg-gray-50 flex items-center gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 text-sm font-bold border bg-white rounded-xl hover:bg-gray-50 transition">
            Discard
          </button>
          <button className="flex-1 px-4 py-3 text-sm font-bold bg-gray-900 text-white rounded-xl hover:bg-black transition shadow-lg shadow-gray-200">
            Save Integration
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, placeholder, type = 'text' }: { label: string, placeholder: string, type?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-4 focus:ring-black/5 focus:border-black outline-none transition"
      />
    </div>
  )
}

function Checkbox({ label }: { label: string }) {
  return (
    <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-300 transition cursor-pointer group">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black" />
    </label>
  )
}