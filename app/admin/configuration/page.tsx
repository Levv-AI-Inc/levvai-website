'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Download,
  Database,
  Eye,
  Settings2,
  FileCode,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
} from 'lucide-react'

/* ======================================================
   TYPES & CONSTANTS
====================================================== */

const MODULES = [
  'INTAKE', 'JOB_POSTING', 'SOW', 'WORKER', 
  'SUPPLIER', 'WORK_ORDER', 'TIMESHEET', 'INVOICE'
] as const

type ModuleType = (typeof MODULES)[number]
type FieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'CHECKBOX' | 'SELECT' | 'MULTISELECT' | 'ATTACHMENT' | 'FORMULA'

interface Option { id: string; label: string; value: string }

interface VisibilityCondition {
  id: string
  scopeType: 'LEGAL_ENTITY' | 'COST_CENTER' | 'BUSINESS_UNIT' | 'LOCATION' | 'WORKSITE'
  scopeValue: string
  mandatory: boolean
}

interface DependencyConfig { dependsOnFieldId?: string; operator?: 'EQUALS' | 'NOT_EQUALS'; value?: string }

interface CustomField {
  id: string
  uniqueId: string
  module: ModuleType
  label: string
  name: string
  type: FieldType
  required: boolean
  helpText?: string
  options?: Option[]
  visibilityRules: VisibilityCondition[] // Changed from single object to array
  dependency?: DependencyConfig
  version: number
}

const generateApiName = (label: string) =>
  label.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^\w]/g, '')

/* ======================================================
   COMPONENTS
====================================================== */

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'blue' | 'purple' | 'red' }) => {
  const styles = {
    default: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-600 border border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border border-purple-100',
    red: 'bg-red-50 text-red-600 border border-red-100',
  }
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles[variant]}`}>{children}</span>
}

export default function ConfigurationPage() {
  const [fields, setFields] = useState<CustomField[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<CustomField | null>(null)
  const [activeTab, setActiveTab] = useState<ModuleType>('INTAKE')

  const [form, setForm] = useState<CustomField>({
    id: '', uniqueId: '', module: 'INTAKE', label: '', name: '', type: 'TEXT', required: false,
    visibilityRules: [], dependency: {}, version: 1,
  })

  const activeFields = useMemo(() => fields.filter((f) => f.module === activeTab), [fields, activeTab])

  const openDrawer = (field?: CustomField) => {
    if (field) {
      setEditing(field); setForm(field)
    } else {
      setEditing(null)
      setForm({
        id: '', uniqueId: '', module: activeTab, label: '', name: '', type: 'TEXT',
        required: false, visibilityRules: [], dependency: {}, version: 1,
      })
    }
    setDrawerOpen(true)
  }

  const addVisibilityRule = () => {
    const newRule: VisibilityCondition = {
      id: crypto.randomUUID(),
      scopeType: 'LEGAL_ENTITY',
      scopeValue: '',
      mandatory: true
    }
    setForm({ ...form, visibilityRules: [...form.visibilityRules, newRule] })
  }

  const updateVisibilityRule = (id: string, updates: Partial<VisibilityCondition>) => {
    setForm({
      ...form,
      visibilityRules: form.visibilityRules.map(r => r.id === id ? { ...r, ...updates } : r)
    })
  }

  const removeVisibilityRule = (id: string) => {
    setForm({ ...form, visibilityRules: form.visibilityRules.filter(r => r.id !== id) })
  }

  const saveField = () => {
    if (!form.label || !form.uniqueId) return
    if (editing) {
      setFields(prev => prev.map(f => f.id === editing.id ? { ...form, version: f.version + 1 } : f))
    } else {
      setFields(prev => [...prev, { ...form, id: crypto.randomUUID(), version: 1 }])
    }
    setDrawerOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-900">
      {/* SIDEBAR */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-black p-2 rounded-xl">
            <Database className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">Field Engine</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-2 mt-4">Modules</p>
          {MODULES.map((m) => (
            <button
              key={m}
              onClick={() => setActiveTab(m)}
              className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                activeTab === m ? 'bg-slate-100 text-black shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <span className="capitalize">{m.toLowerCase().replace('_', ' ')}</span>
              {activeTab === m && <ChevronRight className="h-4 w-4" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-5xl mx-auto p-10">
        <header className="flex items-end justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider">Customization</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 text-sm capitalize font-medium">{activeTab.toLowerCase().replace('_', ' ')}</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Fields</h1>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => {
                const blob = new Blob([JSON.stringify(fields, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob); const a = document.createElement('a')
                a.href = url; a.download = 'schema-export.json'; a.click()
              }}
              className="px-6 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              onClick={() => openDrawer()}
              className="px-6 py-2.5 bg-black text-white rounded-full text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
            >
              <Plus className="h-4 w-4" /> Add Field
            </button>
          </div>
        </header>

        {/* FIELD LIST */}
        <div className="grid gap-3">
          {activeFields.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] py-24 flex flex-col items-center justify-center text-slate-400">
              <div className="bg-slate-50 p-5 rounded-full mb-4">
                <Settings2 className="h-10 w-10 text-slate-300" />
              </div>
              <p className="font-bold text-slate-600">No fields configured yet</p>
              <p className="text-sm">Extended properties for this module will appear here.</p>
            </div>
          ) : (
            activeFields.map((field) => (
              <div
                key={field.id}
                className="group bg-white border border-slate-200 rounded-3xl p-6 flex justify-between items-center hover:border-black hover:shadow-xl hover:shadow-slate-100 transition-all cursor-default"
              >
                <div className="flex items-center gap-5">
                  <div className="bg-slate-50 p-4 rounded-2xl text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                    <FileCode className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="font-bold text-slate-900 text-xl tracking-tight">{field.label}</h3>
                      <Badge variant="blue">{field.type}</Badge>
                      {field.required && <Badge variant="red">Required</Badge>}
                      {field.visibilityRules.length > 0 && <Badge variant="purple">Conditional</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono uppercase tracking-wider">
                      <span>ID: {field.uniqueId}</span>
                      <span>API: {field.name}</span>
                      <span>v{field.version}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  <button onClick={() => openDrawer(field)} className="p-3 text-slate-400 hover:text-black hover:bg-slate-100 rounded-xl transition-all">
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setFields(prev => prev.filter(f => f.id !== field.id))}
                    className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[40px]">
            <header className="px-10 py-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{editing ? 'Edit Configuration' : 'Create New Field'}</h2>
                <p className="text-sm text-slate-400 mt-1 font-medium">Define how this property behaves across the system.</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-3 hover:bg-slate-100 rounded-full transition-all">
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-10 pb-10 space-y-12">
              {/* SECTION: IDENTITY */}
              <section className="space-y-5">
                <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-2">Identification</span>
                    <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Display Label</label>
                    <input
                      placeholder="e.g. Cost Center ID"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value, name: generateApiName(e.target.value) })}
                      className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm focus:border-black outline-none transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Static Unique ID</label>
                    <input
                      placeholder="CF_101"
                      value={form.uniqueId}
                      onChange={(e) => setForm({ ...form, uniqueId: e.target.value })}
                      className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm focus:border-black outline-none transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 ml-1">System API Key (Read Only)</label>
                  <div className="bg-slate-50 rounded-2xl px-5 py-3 text-sm font-mono text-slate-400 border-2 border-transparent select-none italic">
                    {form.name || 'api_key_will_generate'}
                  </div>
                </div>
              </section>

              {/* SECTION: DATA TYPE */}
              <section className="space-y-5">
                <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-2">Data & Validation</span>
                    <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="grid grid-cols-2 gap-6 items-end">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 ml-1">Property Type</label>
                        <select
                            value={form.type}
                            onChange={(e) => setForm({ ...form, type: e.target.value as FieldType })}
                            className="w-full border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm focus:border-black outline-none bg-white font-medium"
                        >
                            {['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'CHECKBOX', 'SELECT', 'MULTISELECT', 'ATTACHMENT', 'FORMULA'].map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <label className="flex items-center gap-4 px-5 py-3.5 border-2 border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all group">
                        <input type="checkbox" checked={form.required} onChange={(e) => setForm({...form, required: e.target.checked})} className="w-5 h-5 accent-black rounded" />
                        <span className="text-sm font-bold text-slate-600 group-hover:text-black">Required Field</span>
                    </label>
                </div>
              </section>

              {/* SECTION: VISIBILITY RULES (MULTI-ADD) */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Visibility Rules ({form.visibilityRules.length})</span>
                    <button 
                        type="button" 
                        onClick={addVisibilityRule}
                        className="text-xs font-bold flex items-center gap-1.5 text-blue-600 hover:underline"
                    >
                        <Plus className="h-3 w-3" /> Add Logic Rule
                    </button>
                </div>
                
                <div className="space-y-3">
                    {form.visibilityRules.length === 0 && (
                        <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 text-xs font-bold">
                            No visibility constraints added. Field will be globally visible.
                        </div>
                    )}
                    {form.visibilityRules.map((rule, idx) => (
                        <div key={rule.id} className="p-5 bg-slate-50 rounded-[24px] border border-slate-200 relative animate-in zoom-in-95">
                            <button 
                                onClick={() => removeVisibilityRule(rule.id)}
                                className="absolute -top-2 -right-2 bg-white border border-slate-200 p-1 rounded-full text-slate-400 hover:text-red-500 shadow-sm"
                            >
                                <X className="h-3 w-3" />
                            </button>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Scope</label>
                                    <select 
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                                        value={rule.scopeType}
                                        onChange={(e) => updateVisibilityRule(rule.id, { scopeType: e.target.value as any })}
                                    >
                                        {['LEGAL_ENTITY', 'COST_CENTER', 'BUSINESS_UNIT', 'LOCATION', 'WORKSITE'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Matching Value</label>
                                    <input 
                                        placeholder="e.g. 100-Corporate" 
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium"
                                        value={rule.scopeValue}
                                        onChange={(e) => updateVisibilityRule(rule.id, { scopeValue: e.target.value })}
                                    />
                                </div>
                            </div>
                            <select 
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                                value={rule.mandatory ? 'MANDATORY' : 'OPTIONAL'}
                                onChange={(e) => updateVisibilityRule(rule.id, { mandatory: e.target.value === 'MANDATORY' })}
                            >
                                <option value="MANDATORY">Required when visible</option>
                                <option value="OPTIONAL">Optional when visible</option>
                            </select>
                        </div>
                    ))}
                </div>
              </section>

              {/* SECTION: DEPENDENCY */}
              <section className="space-y-5">
                <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-2">Field Dependency</span>
                    <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="bg-slate-900 rounded-[32px] p-6 text-white space-y-4 shadow-xl">
                    <p className="text-xs font-medium text-slate-400">Trigger this field based on another field's value:</p>
                    <select
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-500 transition-all"
                        value={form.dependency?.dependsOnFieldId || ''}
                        onChange={(e) => setForm({ ...form, dependency: { ...form.dependency, dependsOnFieldId: e.target.value }})}
                    >
                        <option value="">No parent dependency</option>
                        {activeFields.filter(f => f.id !== editing?.id).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>

                    {form.dependency?.dependsOnFieldId && (
                        <div className="flex gap-3 animate-in fade-in slide-in-from-top-2">
                            <select 
                                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm"
                                onChange={(e) => setForm({ ...form, dependency: { ...form.dependency, operator: e.target.value as any }})}
                            >
                                <option value="EQUALS">Is equal to</option>
                                <option value="NOT_EQUALS">Is not equal to</option>
                            </select>
                            <input 
                                placeholder="Target value..." 
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm outline-none"
                                onChange={(e) => setForm({ ...form, dependency: { ...form.dependency, value: e.target.value }})}
                            />
                        </div>
                    )}
                </div>
              </section>
            </div>

            <footer className="p-10 border-t border-slate-100 flex items-center gap-4 bg-white rounded-bl-[40px]">
              <button
                onClick={saveField}
                className="flex-1 py-4 bg-black text-white rounded-full font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-slate-200"
              >
                <CheckCircle2 className="h-6 w-6" />
                {editing ? 'Update Field' : 'Commit Changes'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}