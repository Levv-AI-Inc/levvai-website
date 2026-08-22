'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { Pencil, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Sparkles, FileText, ChevronDown, X, Trash2, Zap, Clock } from 'lucide-react'
import * as XLSX from 'xlsx'

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

type ExtractedRule = {
  id: string
  category: 'rate_classification' | 'tenure_duration' | 'supplier_eligibility' | 'approval_exception' | 'worker_type' | 'location_jurisdiction'
  title: string
  statement: string
  citation: string
  severity: 'low' | 'medium' | 'high'
  enforcementType: 'intake' | 'configuration' | 'both'
  triggerPoint: string
  enforcementStatus: 'active' | 'pending'
  suggestedField?: string
  suggestedValue?: string
  matchedEntity?: string
  matched?: boolean
}

type Gap = {
  id: string
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  recommendation: string
  relatedRuleIds: string[]
  suggestedTab: string
  suggestedRowKey: string
  suggestedRowValue: string
}

type PolicyAnalysis = {
  policyName: string
  summary: string
  activatedAt: string
  counts: {
    totalRules: number
    rateClassification: number
    tenureDuration: number
    supplierEligibility: number
    approvalException: number
  }
  rules: ExtractedRule[]
  gaps: Gap[]
  intakeImpacts: string[]
  configChanges: string[]
}

type NovaState = 'upload' | 'processing' | 'results' | 'error'

const STORAGE_KEY = 'levv_master_data_v2'

// ─── Category display config ──────────────────────────────────────────────────

const CATEGORY_META: Record<ExtractedRule['category'], { label: string; color: string }> = {
  rate_classification:  { label: 'Rate & classification',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  tenure_duration:      { label: 'Tenure & duration',       color: 'bg-purple-50 text-purple-700 border-purple-200' },
  supplier_eligibility: { label: 'Supplier eligibility',    color: 'bg-orange-50 text-orange-700 border-orange-200' },
  approval_exception:   { label: 'Approval & exception',    color: 'bg-red-50 text-red-700 border-red-200' },
  worker_type:          { label: 'Worker type',             color: 'bg-teal-50 text-teal-700 border-teal-200' },
  location_jurisdiction:{ label: 'Location & jurisdiction', color: 'bg-green-50 text-green-700 border-green-200' },
}

// ─── Column definitions ───────────────────────────────────────────────────────

const TAB_COLUMNS: Record<Tab, { key: string; label: string }[]> = {
  'Business Units': [
    { key: 'businessUnit', label: 'Business unit' },
    { key: 'country', label: 'Country' },
  ],
  'Cost Centers': [
    { key: 'costCenter', label: 'Cost center' },
    { key: 'erpId', label: 'ERP ID' },
  ],
  'Locations': [
    { key: 'location', label: 'Location' },
    { key: 'country', label: 'Country' },
    { key: 'region', label: 'Region' },
  ],
  'Worksites': [
    { key: 'worksite', label: 'Worksite' },
    { key: 'location', label: 'Location' },
    { key: 'workMode', label: 'Onsite / Remote' },
  ],
  'Legal Entities': [
    { key: 'legalEntity', label: 'Legal entity' },
    { key: 'country', label: 'Country' },
    { key: 'registrationId', label: 'Registration ID' },
  ],
  'Subsidiaries': [
    { key: 'subsidiary', label: 'Subsidiary' },
    { key: 'displayName', label: 'Display name' },
    { key: 'erpId', label: 'ERP ID' },
    { key: 'paymentsOnboarding', label: 'Payments onboarding' },
  ],
}

const EMPTY_MASTER_DATA: Record<Tab, TableRow[]> = {
  'Business Units': [],
  'Cost Centers': [],
  'Locations': [],
  'Worksites': [],
  'Legal Entities': [],
  'Subsidiaries': [],
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  gap, onConfirm, onCancel,
}: {
  gap: Gap
  onConfirm: (row: TableRow) => void
  onCancel: () => void
}) {
  const tab = gap.suggestedTab as Tab
  const columns = TAB_COLUMNS[tab] ?? []
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    columns.forEach(col => {
      init[col.key] = col.key === gap.suggestedRowKey ? gap.suggestedRowValue : ''
    })
    return init
  })
  const [status, setStatus] = useState<RowStatus>('Active')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <p className="text-sm font-semibold text-gray-900">Confirm addition</p>
          <button onClick={onCancel} className="p-1 rounded-md hover:bg-gray-100 transition">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-600">
            Adding a new record to <span className="font-semibold text-gray-900">{gap.suggestedTab}</span>. Review and fill in any missing fields.
          </p>
          <div className="space-y-3">
            {columns.map(col => (
              <div key={col.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {col.label}
                  {col.key === gap.suggestedRowKey && (
                    <span className="ml-1.5 text-[10px] text-green-600 font-normal">suggested by Nova</span>
                  )}
                </label>
                <input
                  type="text"
                  value={fields[col.key] ?? ''}
                  onChange={e => setFields(prev => ({ ...prev, [col.key]: e.target.value }))}
                  placeholder={`Enter ${col.label.toLowerCase()}`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Initial status</label>
            <div className="relative">
              <select
                value={status}
                onChange={e => setStatus(e.target.value as RowStatus)}
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 pr-8 focus:outline-none focus:ring-2 focus:ring-black/10 cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {status === 'Active' ? 'Immediately visible across intake and approval flows.' : 'Saved but excluded from active workflows until enabled.'}
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="text-[10px] text-amber-700"><span className="font-medium">Nova source: </span>{gap.description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-gray-50">
          <button onClick={onCancel} className="px-4 py-2 text-xs font-medium text-gray-600 rounded-full border border-gray-300 hover:bg-gray-100 transition">Cancel</button>
          <button onClick={() => onConfirm({ ...fields, status })} className="px-4 py-2 text-xs font-medium text-white bg-black rounded-full hover:bg-gray-800 transition">
            Add to {gap.suggestedTab}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function CompanyPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Business Units')

  const [masterData, setMasterData] = useState<Record<Tab, TableRow[]>>(() => {
    if (typeof window === 'undefined') return EMPTY_MASTER_DATA
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return { ...EMPTY_MASTER_DATA, ...JSON.parse(saved) }
    } catch {}
    return EMPTY_MASTER_DATA
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(masterData)) } catch {}
  }, [masterData])

  const config = useMemo(() => {
    const tabConfig = getTableConfig(activeTab)
    return { ...tabConfig, columns: TAB_COLUMNS[activeTab], rows: masterData[activeTab] }
  }, [activeTab, masterData])

  const handleBulkUpload = (newData: TableRow[]) =>
    setMasterData(prev => ({ ...prev, [activeTab]: [...newData, ...prev[activeTab]] }))

  const handleImplement = (tab: Tab, row: TableRow) => {
    setMasterData(prev => ({ ...prev, [tab]: [row, ...prev[tab]] }))
    setActiveTab(tab)
  }

  const handleStatusChange = (tab: Tab, rowIndex: number, newStatus: RowStatus) =>
    setMasterData(prev => ({
      ...prev,
      [tab]: prev[tab].map((row, i) => i === rowIndex ? { ...row, status: newStatus } : row),
    }))

  const handleClearAll = () => {
    if (!confirm('Clear all master data? This cannot be undone.')) return
    setMasterData(EMPTY_MASTER_DATA)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Company</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-3xl">
            Manage organizational master data used across intake, approvals, compliance, and financial workflows.
            Nova can read your workforce policy and turn it into enforceable intake guidance and configuration actions.
          </p>
        </div>
        <button onClick={handleClearAll} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition mt-1" title="Clear all master data">
          <Trash2 className="h-3.5 w-3.5" />
          Clear all data
        </button>
      </div>

      <AIRulesPanel activeTab={activeTab} onBulkUpload={handleBulkUpload} onImplement={handleImplement} masterData={masterData} />

      <div className="border-b flex flex-wrap gap-6 text-sm font-medium">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 transition ${activeTab === tab ? 'border-b-2 border-black text-black' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab}
            {masterData[tab].length > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{masterData[tab].length}</span>
            )}
          </button>
        ))}
      </div>

      <TableLayout config={config} activeTab={activeTab} onStatusChange={handleStatusChange} />
    </div>
  )
}

// ─── AIRulesPanel ─────────────────────────────────────────────────────────────

function AIRulesPanel({
  activeTab, onBulkUpload, onImplement, masterData,
}: {
  activeTab: Tab
  onBulkUpload: (data: any[]) => void
  onImplement: (tab: Tab, row: TableRow) => void
  masterData: Record<Tab, TableRow[]>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawData = XLSX.utils.sheet_to_json(ws)
      const normalized = rawData.map((row: any) => ({ ...row, status: row.status || 'Active' }))
      onBulkUpload(normalized)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <NovaPanel masterData={masterData} onImplement={onImplement} />
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-white p-2 shadow-sm mb-2">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
        </div>
        <h3 className="text-sm font-medium text-gray-900">Mass Upload {activeTab}</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4 max-w-[240px]">Upload .xlsx with headers matching the {activeTab} table columns.</p>
        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleFileChange} />
        <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Upload className="h-4 w-4" />
          Select File
        </button>
      </div>
    </div>
  )
}

// ─── NovaPanel ────────────────────────────────────────────────────────────────

function NovaPanel({
  masterData, onImplement,
}: {
  masterData: Record<Tab, TableRow[]>
  onImplement: (tab: Tab, row: TableRow) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<NovaState>('upload')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [analysis, setAnalysis] = useState<PolicyAnalysis | null>(null)

  const reset = () => {
    setState('upload'); setError(''); setFileName(''); setAnalysis(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handlePolicyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setError(''); setState('processing')
    try {
      const payload = new FormData()
      payload.append('file', file)
      payload.append('masterData', JSON.stringify(masterData))
      const res = await fetch('/api/nova/policy', { method: 'POST', body: payload })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Policy analysis failed.')
      setAnalysis(data); setState('results')
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.')
      setState('error')
    }
  }

  const dotColor = state === 'results' ? 'bg-green-500' : state === 'processing' ? 'bg-amber-400 animate-pulse' : state === 'error' ? 'bg-red-500' : 'bg-gray-300'
  const badgeClass = state === 'results' ? 'bg-green-50 text-green-700 border-green-200' : state === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-200' : state === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200'
  const headerLabel = state === 'upload' ? 'No policy uploaded' : state === 'processing' ? `Analysing ${fileName || 'policy'}...` : state === 'error' ? 'Policy analysis failed' : analysis?.policyName || fileName || 'Policy active'
  const badgeLabel = state === 'results' ? 'Active' : state === 'processing' ? 'Processing...' : state === 'error' ? 'Error' : 'Not configured'

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 border-b">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        <span className="text-sm font-medium text-gray-900 truncate">{headerLabel}</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${badgeClass}`}>{badgeLabel}</span>
      </div>
      <div className="p-4">
        {state === 'upload' && <NovaUpload inputRef={inputRef} onUpload={handlePolicyUpload} />}
        {state === 'processing' && <NovaProcessing fileName={fileName} />}
        {state === 'error' && <NovaError error={error} onReset={reset} />}
        {state === 'results' && analysis && <NovaResults analysis={analysis} onReset={reset} onImplement={onImplement} />}
      </div>
    </div>
  )
}

// ─── Upload ───────────────────────────────────────────────────────────────────

function NovaUpload({ inputRef, onUpload }: { inputRef: React.RefObject<HTMLInputElement | null>; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Upload your External Workforce Policy. Nova will extract enforceable rules, identify what should hit intake vs configuration, and flag where your current setup does not reflect policy.
      </p>
      <div onClick={() => inputRef.current?.click()} className="border border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition">
        <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mx-auto mb-3">
          <Upload className="h-4 w-4 text-gray-500" />
        </div>
        <p className="text-xs font-medium text-gray-900 mb-1">Drop your policy document here</p>
        <p className="text-xs text-gray-400 mb-4">Supports .pdf, .docx, .txt</p>
        <button onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition">
          <Upload className="h-3.5 w-3.5" />Select file
        </button>
      </div>
      <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={onUpload} />
    </div>
  )
}

// ─── Processing ───────────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  { label: 'Reading document structure', duration: 1800 },
  { label: 'Identifying policy clauses', duration: 2400 },
  { label: 'Extracting enforceable workforce rules', duration: 3200 },
  { label: 'Separating intake controls from config controls', duration: 2800 },
  { label: 'Cross-referencing current company setup', duration: 2600 },
  { label: 'Flagging policy-to-config gaps', duration: 3000 },
  { label: 'Building action plan', duration: 99999 },
]

function NovaProcessing({ fileName }: { fileName: string }) {
  const [currentStep, setCurrentStep] = useState(0)
  useEffect(() => {
    let step = 0
    let timeout: ReturnType<typeof setTimeout>
    const advance = () => {
      const next = step + 1
      if (next < PROCESSING_STEPS.length) {
        step = next; setCurrentStep(step)
        timeout = setTimeout(advance, PROCESSING_STEPS[step].duration)
      }
    }
    timeout = setTimeout(advance, PROCESSING_STEPS[0].duration)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div>
      <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg mb-4">
        <div className="w-7 h-7 bg-green-50 border border-green-100 rounded-md flex items-center justify-center flex-shrink-0">
          <FileText className="h-3.5 w-3.5 text-green-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-900">{fileName}</p>
          <p className="text-xs text-gray-400">Policy uploaded · Nova is reading…</p>
        </div>
      </div>
      <ul className="space-y-0.5">
        {PROCESSING_STEPS.map((step, i) => {
          const isDone = i < currentStep
          const isActive = i === currentStep
          return (
            <li key={step.label} className={`flex items-center gap-2.5 px-2 py-2 rounded-md transition-all duration-300 ${isActive ? 'bg-amber-50' : ''}`}>
              <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {isDone && <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="#16a34a" strokeWidth="2"><polyline points="2,5 4,7.5 8,3" /></svg></span>}
                {isActive && <span className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />}
                {i > currentStep && <span className="w-3 h-3 rounded-full border border-gray-300" />}
              </span>
              <span className={`text-xs transition-all duration-300 ${isDone ? 'text-gray-400 line-through decoration-gray-300' : isActive ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
                {step.label}
                {isActive && <span className="inline-flex ml-1"><span className="animate-[bounce_1s_infinite_0ms] inline-block">.</span><span className="animate-[bounce_1s_infinite_150ms] inline-block">.</span><span className="animate-[bounce_1s_infinite_300ms] inline-block">.</span></span>}
              </span>
              {isDone && <span className="ml-auto text-[10px] text-green-600 font-medium">done</span>}
            </li>
          )
        })}
      </ul>
      <p className="text-[10px] text-gray-400 mt-4 text-center animate-pulse">Nova is analysing your document — this usually takes 15–30 seconds</p>
    </div>
  )
}

// ─── Error ────────────────────────────────────────────────────────────────────

function NovaError({ error, onReset }: { error: string; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="text-sm font-medium text-red-800">Nova could not analyse the policy.</p>
        <p className="text-xs text-red-700 mt-1">{error}</p>
      </div>
      <button onClick={onReset} className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition">Try again</button>
    </div>
  )
}

// ─── Results ──────────────────────────────────────────────────────────────────

function NovaResults({
  analysis, onReset, onImplement,
}: {
  analysis: PolicyAnalysis
  onReset: () => void
  onImplement: (tab: Tab, row: TableRow) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set(['gaps']))
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const [implemented, setImplemented] = useState<Set<string>>(new Set())
  const [pendingGap, setPendingGap] = useState<Gap | null>(null)

  const highGaps = analysis.gaps.filter(g => g.severity === 'high').length
  const activeRules = analysis.rules.filter(r => r.enforcementStatus === 'active').length

  const handleConfirm = (row: TableRow) => {
    if (!pendingGap) return
    onImplement(pendingGap.suggestedTab as Tab, row)
    setImplemented(prev => new Set([...prev, pendingGap.id]))
    setPendingGap(null)
  }

  return (
    <>
      {pendingGap && <ConfirmDialog gap={pendingGap} onConfirm={handleConfirm} onCancel={() => setPendingGap(null)} />}

      <div className="space-y-2">
        {/* Policy header */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="w-7 h-7 bg-green-50 border border-green-100 rounded-md flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{analysis.policyName}</p>
            <p className="text-xs text-gray-400">{analysis.counts.totalRules} rules · {analysis.activatedAt}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Total', value: analysis.counts.totalRules },
            { label: 'Rate', value: analysis.counts.rateClassification },
            { label: 'Tenure', value: analysis.counts.tenureDuration },
            { label: 'Supplier', value: analysis.counts.supplierEligibility + analysis.counts.approvalException },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded border border-gray-100 px-2 py-1.5 text-center">
              <p className="text-sm font-semibold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Gaps */}
        <Accordion id="gaps" open={open} toggle={toggle} label="Configuration gaps" count={analysis.gaps.length}
          badges={highGaps > 0 ? [{ text: `${highGaps} high`, cls: 'bg-red-50 text-red-700 border-red-200' }] : []}
        >
          {analysis.gaps.length === 0 ? (
            <div className="flex gap-2 p-2.5 bg-green-50 border border-green-100 rounded-lg">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-green-800">No configuration gaps found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {analysis.gaps.map(g => {
                const canImplement = !!(g.suggestedTab && g.suggestedRowKey && TABS.includes(g.suggestedTab as Tab))
                const done = implemented.has(g.id)
                return (
                  <div key={g.id} className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-amber-900">{g.title}</p>
                        <p className="text-xs text-amber-800 mt-0.5">{g.description}</p>
                        <p className="text-xs text-amber-700 mt-0.5">→ {g.recommendation}</p>
                        {canImplement && <p className="text-[10px] text-amber-600 mt-0.5">Tab: <span className="font-medium">{g.suggestedTab}</span></p>}
                        {canImplement && (
                          <button
                            onClick={() => !done && setPendingGap(g)}
                            disabled={done}
                            className={`mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition ${done ? 'bg-green-50 text-green-700 border-green-200 cursor-default' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50 cursor-pointer'}`}
                          >
                            {done ? '✓ Added to table' : `+ Add "${g.suggestedRowValue}" to ${g.suggestedTab}`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Accordion>

        {/* Intake impacts */}
        <Accordion id="intake" open={open} toggle={toggle} label="Intake impacts" count={analysis.intakeImpacts.length}>
          <ul className="space-y-1.5">
            {analysis.intakeImpacts.map((item, i) => (
              <li key={i} className="text-xs text-gray-700 flex gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-gray-400 shrink-0" />{item}
              </li>
            ))}
          </ul>
        </Accordion>

        {/* Config changes */}
        <Accordion id="config" open={open} toggle={toggle} label="Config changes" count={analysis.configChanges.length}>
          <ul className="space-y-1.5">
            {analysis.configChanges.map((item, i) => (
              <li key={i} className="text-xs text-gray-700 flex gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-gray-400 shrink-0" />{item}
              </li>
            ))}
          </ul>
        </Accordion>

        {/* Rules — now with enforcement story */}
        <Accordion
          id="rules"
          open={open}
          toggle={toggle}
          label="Active enforcement rules"
          count={analysis.counts.totalRules}
          badges={[{ text: `${activeRules} live`, cls: 'bg-green-50 text-green-700 border-green-200' }]}
        >
          {/* Summary line */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-black rounded-lg mb-3">
            <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <p className="text-xs text-white">
              <span className="font-semibold">{activeRules} rules are now active.</span>{' '}
              Nova will enforce these automatically across intake and approval workflows.
            </p>
          </div>

          <div className="space-y-2">
            {analysis.rules.map(r => {
              const catMeta = CATEGORY_META[r.category]
              return (
                <div key={r.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  {/* Rule header row */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${catMeta.color}`}>
                      {catMeta.label}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ml-auto ${
                      r.enforcementType === 'intake'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : r.enforcementType === 'configuration'
                        ? 'bg-gray-100 text-gray-600 border-gray-200'
                        : 'bg-violet-50 text-violet-700 border-violet-200'
                    }`}>
                      {r.enforcementType}
                    </span>
                    {/* Active status dot */}
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[10px] text-green-600 font-medium">active</span>
                    </span>
                  </div>

                  {/* Rule body */}
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-semibold text-gray-900 mb-1">{r.title}</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{r.statement}</p>

                    {/* Trigger + citation row */}
                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      {r.triggerPoint && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {r.triggerPoint}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">{r.citation}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Accordion>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button onClick={onReset} className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600">Re-upload policy</button>
        </div>
      </div>
    </>
  )
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function Accordion({
  id, open, toggle, label, count, badges = [], children,
}: {
  id: string
  open: Set<string>
  toggle: (id: string) => void
  label: string
  count: number
  badges?: { text: string; cls: string }[]
  children: React.ReactNode
}) {
  const isOpen = open.has(id)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={() => toggle(id)} className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-900">{label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">{count}</span>
          {badges.map(b => <span key={b.text} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${b.cls}`}>{b.text}</span>)}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="p-3 border-t border-gray-100">{children}</div>}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

function TableLayout({
  config, activeTab, onStatusChange,
}: {
  config: TableConfig
  activeTab: Tab
  onStatusChange: (tab: Tab, rowIndex: number, newStatus: RowStatus) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
        <button className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">+ {config.addLabel}</button>
      </div>
      {config.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <p className="text-sm font-medium text-gray-400">No {config.title.toLowerCase()} yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Upload a policy above and Nova will suggest entries to add, or use the button to add manually.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {config.columns.map(col => <th key={col.key} className="px-4 py-3 text-left font-medium">{col.label}</th>)}
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {config.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {config.columns.map(col => <td key={col.key} className="px-4 py-3 text-gray-900">{row[col.key] || '—'}</td>)}
                  <td className="px-4 py-3">
                    <div className="relative inline-block">
                      <select
                        value={row.status}
                        onChange={e => onStatusChange(activeTab, idx, e.target.value as RowStatus)}
                        className={`appearance-none rounded-full pl-2.5 pr-6 py-1 text-xs font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/10 transition ${row.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-current opacity-60" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-2 hover:bg-gray-100 rounded-md transition">
                      <Pencil className="h-4 w-4 text-gray-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Table config ─────────────────────────────────────────────────────────────

function getTableConfig(activeTab: Tab): Omit<TableConfig, 'rows' | 'columns'> {
  const configs: Record<Tab, Omit<TableConfig, 'rows' | 'columns'>> = {
    'Business Units': { title: 'Business units', addLabel: 'Add business unit' },
    'Cost Centers': { title: 'Cost centers', addLabel: 'Add cost center' },
    'Locations': { title: 'Locations', addLabel: 'Add location' },
    'Worksites': { title: 'Worksites', addLabel: 'Add worksite' },
    'Legal Entities': { title: 'Legal entities', addLabel: 'Add legal entity' },
    'Subsidiaries': { title: 'Subsidiaries', addLabel: 'Add subsidiary' },
  }
  return configs[activeTab]
}