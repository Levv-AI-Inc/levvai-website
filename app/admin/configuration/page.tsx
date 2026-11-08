'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Plus,
  Trash2,
  X,
  Download,
  Settings2,
  CheckCircle2,
} from 'lucide-react'
import {
  LevvEmptyState,
  LevvPage,
  LevvRecordHeader,
  LevvSelect,
  LevvStatusBadge,
  levvUi,
} from '@/components/ui/levv-app'
import { useLevvDialog } from '@/components/ui/levv-dialog'

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

/** A field's type and flags: framed capitals, no fill. */
const Badge = ({ children }: { children: ReactNode }) => (
  <LevvStatusBadge dot={false}>{children}</LevvStatusBadge>
)

/** A group caption in the drawer, on a hairline. */
const SectionRule = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="flex items-center gap-3">
    <span className={`${levvUi.legend} text-slate-700`}>{children}</span>
    <span aria-hidden className="h-px flex-1 bg-[var(--line)]" />
    {action}
  </div>
)

const moduleLabel = (m: ModuleType) => m.toLowerCase().replace('_', ' ')

/** The module as the column shows it (capitalised words), for use in a sentence. */
const moduleName = (m: ModuleType) => moduleLabel(m).replace(/\b\w/g, (letter) => letter.toUpperCase())

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

  const closeDrawer = () => setDrawerOpen(false)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const drawerRef = useLevvDialog<HTMLDivElement>(drawerOpen, closeDrawer, labelInputRef)

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Configuration"
          title="Fields"
          statement="Define extended properties for each module and how they behave across the system."
          actions={
            <>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(fields, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob); const a = document.createElement('a')
                  a.href = url; a.download = 'schema-export.json'; a.click()
                }}
                className={levvUi.secondaryButton}
              >
                <Download /> Export
              </button>
              <button onClick={() => openDrawer()} className={levvUi.primaryButton}>
                <Plus /> Add Field
              </button>
            </>
          }
        />

        <div className="flex flex-col gap-5 xl:flex-row xl:gap-8">
          {/* MODULES: a ruled column, like the admin settings column */}
          <aside className="shrink-0 border-b border-[var(--line)] pb-2 xl:w-48 xl:self-start xl:border-b-0 xl:border-r xl:pb-0 xl:pr-3">
            <div className="hidden px-2.5 pb-3 pt-1 xl:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Field Engine</p>
              <p className="mt-1 text-xs text-slate-500">Modules</p>
            </div>
            <nav aria-label="Modules" className="flex gap-px overflow-x-auto xl:block xl:space-y-px xl:overflow-visible">
              {MODULES.map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveTab(m)}
                  aria-current={activeTab === m ? 'true' : undefined}
                  className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-2.5 text-left text-[13.5px] capitalize transition-colors duration-150 xl:w-full ${
                    activeTab === m
                      ? 'bg-[var(--surface)] font-semibold text-blue-600 ring-1 ring-inset ring-[var(--line)]'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  {moduleLabel(m)}
                </button>
              ))}
            </nav>
          </aside>

          {/* FIELD LIST */}
          <section aria-label={`${moduleName(activeTab)} fields`} className="min-w-0 flex-1">
            {activeFields.length === 0 ? (
              <div className="border-b border-[var(--line)] xl:border-t">
                <LevvEmptyState icon={Settings2} title="No fields configured yet">
                  Extended properties for this module will appear here.
                </LevvEmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--line)] border-b border-t-2 border-b-[var(--line)] border-t-slate-950">
                {activeFields.map((field) => (
                  <li key={field.id} className="flex items-start justify-between gap-4 py-3.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-slate-950">{field.label}</h3>
                        <Badge>{field.type}</Badge>
                        {field.required && <Badge>Required</Badge>}
                        {field.visibilityRules.length > 0 && <Badge>Conditional</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] tabular-nums text-slate-500">
                        <span>ID: {field.uniqueId}</span>
                        <span>API: {field.name}</span>
                        <span>v{field.version}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => openDrawer(field)} aria-label={`Edit ${field.label}`} className={levvUi.secondaryButton}>
                        Edit
                      </button>
                      <button
                        onClick={() => setFields(prev => prev.filter(f => f.id !== field.id))}
                        aria-label={`Delete ${field.label}`}
                        className={levvUi.dangerIconButton}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
          <div className="absolute inset-0 bg-slate-950/30" onClick={() => setDrawerOpen(false)} />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="field-drawer-title"
            tabIndex={-1}
            className="relative flex w-full max-w-2xl flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[-18px_0_40px_-24px_rgb(10_19_48/0.35)] outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
              <div>
                <h2 id="field-drawer-title" className="text-lg font-semibold text-slate-950">{editing ? 'Edit Configuration' : 'Create New Field'}</h2>
                <p className="mt-1 text-[13px] text-slate-500">Define how this property behaves across the system.</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close" className={`${levvUi.iconButton} -mr-2`}>
                <X />
              </button>
            </header>

            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
              {/* SECTION: IDENTITY */}
              <section className="space-y-4">
                <SectionRule>Identification</SectionRule>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block"><span className={levvUi.label}>Display Label</span></label>
                    <input
                      ref={labelInputRef}
                      placeholder="e.g. Cost Center ID"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value, name: generateApiName(e.target.value) })}
                      className={levvUi.input}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block"><span className={levvUi.label}>Static Unique ID</span></label>
                    <input
                      placeholder="CF_101"
                      value={form.uniqueId}
                      onChange={(e) => setForm({ ...form, uniqueId: e.target.value })}
                      className={levvUi.input}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block"><span className={levvUi.label}>System API Key (Read Only)</span></label>
                  <div className="flex h-9 select-none items-center border border-[var(--line)] bg-[var(--surface-sunken)] px-3 text-[14px] text-slate-500">
                    {form.name || 'api_key_will_generate'}
                  </div>
                </div>
              </section>

              {/* SECTION: DATA TYPE */}
              <section className="space-y-4">
                <SectionRule>Data & Validation</SectionRule>
                <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block"><span className={levvUi.label}>Property Type</span></label>
                    <LevvSelect
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as FieldType })}
                    >
                      {['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'CHECKBOX', 'SELECT', 'MULTISELECT', 'ATTACHMENT', 'FORMULA'].map(t => <option key={t}>{t}</option>)}
                    </LevvSelect>
                  </div>
                  <label className="flex h-9 cursor-pointer items-center gap-2.5 border border-[var(--line-strong)] px-3 transition-colors duration-150 hover:bg-slate-100">
                    <input type="checkbox" checked={form.required} onChange={(e) => setForm({...form, required: e.target.checked})} className="h-4 w-4 accent-blue-600" />
                    <span className="text-[14px] font-medium text-slate-800">Required Field</span>
                  </label>
                </div>
              </section>

              {/* SECTION: VISIBILITY RULES (MULTI-ADD) */}
              <section className="space-y-4">
                <SectionRule
                  action={
                    <button
                      type="button"
                      onClick={addVisibilityRule}
                      className={`${levvUi.ghostButton} h-8`}
                    >
                      <Plus /> Add Logic Rule
                    </button>
                  }
                >
                  Visibility Rules ({form.visibilityRules.length})
                </SectionRule>

                <div className="space-y-3">
                  {form.visibilityRules.length === 0 && (
                    <div className="border border-dashed border-[var(--line-strong)] py-6 text-center text-[13px] text-slate-500">
                      No visibility constraints added. Field will be globally visible.
                    </div>
                  )}
                  {form.visibilityRules.map((rule, idx) => (
                    <div key={rule.id} className="relative border border-[var(--line)] p-4 pr-12">
                      <button
                        onClick={() => removeVisibilityRule(rule.id)}
                        aria-label={`Remove visibility rule ${idx + 1}`}
                        className={`${levvUi.dangerIconButton} absolute right-2 top-2`}
                      >
                        <Trash2 />
                      </button>
                      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="block"><span className={levvUi.label}>Scope</span></label>
                          <LevvSelect
                            value={rule.scopeType}
                            onChange={(e) => updateVisibilityRule(rule.id, { scopeType: e.target.value as any })}
                          >
                            {['LEGAL_ENTITY', 'COST_CENTER', 'BUSINESS_UNIT', 'LOCATION', 'WORKSITE'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </LevvSelect>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block"><span className={levvUi.label}>Matching Value</span></label>
                          <input
                            placeholder="e.g. 100-Corporate"
                            className={levvUi.input}
                            value={rule.scopeValue}
                            onChange={(e) => updateVisibilityRule(rule.id, { scopeValue: e.target.value })}
                          />
                        </div>
                      </div>
                      <LevvSelect
                        value={rule.mandatory ? 'MANDATORY' : 'OPTIONAL'}
                        onChange={(e) => updateVisibilityRule(rule.id, { mandatory: e.target.value === 'MANDATORY' })}
                      >
                        <option value="MANDATORY">Required when visible</option>
                        <option value="OPTIONAL">Optional when visible</option>
                      </LevvSelect>
                    </div>
                  ))}
                </div>
              </section>

              {/* SECTION: DEPENDENCY */}
              <section className="space-y-4">
                <SectionRule>Field Dependency</SectionRule>
                <div className="space-y-3 border border-[var(--line)] p-4">
                  <p className="text-[13px] text-slate-600">Trigger this field based on another field&apos;s value:</p>
                  <LevvSelect
                    value={form.dependency?.dependsOnFieldId || ''}
                    onChange={(e) => setForm({ ...form, dependency: { ...form.dependency, dependsOnFieldId: e.target.value }})}
                  >
                    <option value="">No parent dependency</option>
                    {activeFields.filter(f => f.id !== editing?.id).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </LevvSelect>

                  {form.dependency?.dependsOnFieldId && (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <LevvSelect
                        className="sm:w-48"
                        onChange={(e) => setForm({ ...form, dependency: { ...form.dependency, operator: e.target.value as any }})}
                      >
                        <option value="EQUALS">Is equal to</option>
                        <option value="NOT_EQUALS">Is not equal to</option>
                      </LevvSelect>
                      <input
                        placeholder="Target value..."
                        className={`${levvUi.input} min-w-0 flex-1`}
                        onChange={(e) => setForm({ ...form, dependency: { ...form.dependency, value: e.target.value }})}
                      />
                    </div>
                  )}
                </div>
              </section>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-6 py-4">
              <button onClick={saveField} className={levvUi.primaryButton}>
                <CheckCircle2 />
                {editing ? 'Update Field' : 'Commit Changes'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </LevvPage>
  )
}
