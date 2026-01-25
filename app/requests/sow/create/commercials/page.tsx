'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSOW } from '../context'
import {
  Plus,
  X,
  ChevronRight,
  CheckCircle2,
  Circle,
  TrendingUp,
  Percent,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const PRICING_MODELS = [
  { value: 'Fixed fee',        label: 'Fixed Fee',             description: 'Single agreed price paid on completion' },
  { value: 'Milestone-based',  label: 'Milestone-Based',       description: 'Payments tied to defined deliverables' },
  { value: 'Time & materials', label: 'Time & Materials',      description: 'Billed by hours worked per role' },
  { value: 'Recurring',        label: 'Recurring',             description: 'Periodic payments at a set cadence' },
  { value: 'Hybrid',           label: 'Hybrid (Fixed + T&M)',  description: 'Fixed base fee plus variable T&M components' },
  { value: 'Cost-plus',        label: 'Cost-Plus',             description: 'Reimbursable cost base plus a negotiated markup' },
]

const BILLING_FREQUENCY = ['Monthly', 'Quarterly', 'Annually']

// ─── Types ───────────────────────────────────────────────────────────────────

type Milestone = { id: string; name: string; amount: number; due: string }
type TMRole    = { id: string; role: string; rate: number; startDate: string; endDate: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function estimateTMRoleCost(rate: number, startDate?: string, endDate?: string): number | null {
  if (!rate || !startDate || !endDate) return null
  const start = new Date(startDate + 'T00:00:00')
  const end   = new Date(endDate   + 'T00:00:00')
  if (end < start) return null
  let days = 0
  const cur = new Date(start)
  while (cur <= end) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) days++
    cur.setDate(cur.getDate() + 1)
  }
  return days * 8 * rate
}

function annualizeRecurring(amount: number, frequency: string): number | null {
  if (!amount || !frequency) return null
  if (frequency === 'Monthly')   return amount * 12
  if (frequency === 'Quarterly') return amount * 4
  if (frequency === 'Annually')  return amount
  return null
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CommercialsPage() {
  const router       = useRouter()
  const { sow, setSOW } = useSOW()
  const c            = sow.commercials ?? {}

  // Shared
  const [pricingModel,     setPricingModel]     = useState<string>(c.pricingModel     ?? '')
  const [previousModel,    setPreviousModel]    = useState<string>('')
  const [showStaleNotice,  setShowStaleNotice]  = useState(false)

  // Fixed fee
  const [fixedAmount,      setFixedAmount]      = useState<string>(c.fixedAmount      ?? '')

  // Milestone-based (and Fixed fee on-milestones — now unified)
  const [milestones,       setMilestones]       = useState<Milestone[]>(c.milestones  ?? [])

  // T&M
  const [tmRoles,          setTmRoles]          = useState<TMRole[]>(c.tmRoles        ?? [])

  // Recurring
  const [recurringAmount,  setRecurringAmount]  = useState<string>(c.recurringAmount  ?? '')
  const [billingFrequency, setBillingFrequency] = useState<string>(c.billingFrequency ?? '')
  const [recurringStart,   setRecurringStart]   = useState<string>(c.recurringStart   ?? '')
  const [recurringEnd,     setRecurringEnd]     = useState<string>(c.recurringEnd     ?? '')

  // Hybrid — fixed base + T&M (reuses tmRoles + fixedAmount)

  // Cost-plus
  const [costBase,         setCostBase]         = useState<string>(c.costBase         ?? '')
  const [markupPct,        setMarkupPct]        = useState<string>(c.markupPct        ?? '')

  // ── Derived contract value for sidebar ─────────────────────────────────────
  const contractValue: number | null = (() => {
    switch (pricingModel) {
      case 'Fixed fee':
        return fixedAmount ? Number(fixedAmount) : null
      case 'Milestone-based':
        return milestones.length > 0 ? milestones.reduce((s, m) => s + m.amount, 0) : null
      case 'Time & materials': {
        const totals = tmRoles.map(r => estimateTMRoleCost(r.rate, r.startDate, r.endDate)).filter((v): v is number => v !== null)
        return totals.length > 0 ? totals.reduce((s, v) => s + v, 0) : null
      }
      case 'Recurring':
        return annualizeRecurring(Number(recurringAmount), billingFrequency)
      case 'Hybrid': {
        const base   = fixedAmount ? Number(fixedAmount) : 0
        const totals = tmRoles.map(r => estimateTMRoleCost(r.rate, r.startDate, r.endDate)).filter((v): v is number => v !== null)
        const tm     = totals.reduce((s, v) => s + v, 0)
        return base + tm > 0 ? base + tm : null
      }
      case 'Cost-plus':
        if (!costBase || !markupPct) return costBase ? Number(costBase) : null
        return Number(costBase) * (1 + Number(markupPct) / 100)
      default:
        return null
    }
  })()

  // ── Model switching ─────────────────────────────────────────────────────────
  const hasDataForModel = (model: string): boolean => {
    switch (model) {
      case 'Fixed fee':        return !!fixedAmount
      case 'Milestone-based':  return milestones.length > 0
      case 'Time & materials': return tmRoles.length > 0
      case 'Recurring':        return !!recurringAmount || !!billingFrequency
      case 'Hybrid':           return !!fixedAmount || tmRoles.length > 0
      case 'Cost-plus':        return !!costBase || !!markupPct
      default:                 return false
    }
  }

  const clearAllData = () => {
    setFixedAmount('')
    setMilestones([])
    setTmRoles([])
    setRecurringAmount('')
    setBillingFrequency('')
    setRecurringStart('')
    setRecurringEnd('')
    setCostBase('')
    setMarkupPct('')
    setShowStaleNotice(false)
  }

  const handleModelSwitch = (newModel: string) => {
    if (newModel === pricingModel) return
    const hadData = hasDataForModel(pricingModel)
    setPreviousModel(pricingModel)
    setPricingModel(newModel)
    setShowStaleNotice(hadData && !!pricingModel)
  }

  // ── Milestone helpers ───────────────────────────────────────────────────────
  const addMilestone    = () => setMilestones([...milestones, { id: crypto.randomUUID(), name: '', amount: 0, due: '' }])
  const updateMilestone = (id: string, u: Partial<Milestone>) => setMilestones(milestones.map(m => m.id === id ? { ...m, ...u } : m))
  const removeMilestone = (id: string) => setMilestones(milestones.filter(m => m.id !== id))

  // ── T&M role helpers ────────────────────────────────────────────────────────
  const addTMRole    = () => setTmRoles([...tmRoles, { id: crypto.randomUUID(), role: '', rate: 0, startDate: '', endDate: '' }])
  const updateTMRole = (id: string, u: Partial<TMRole>) => setTmRoles(tmRoles.map(r => r.id === id ? { ...r, ...u } : r))
  const removeTMRole = (id: string) => setTmRoles(tmRoles.filter(r => r.id !== id))

  // ── Save & navigate ─────────────────────────────────────────────────────────
  const handleContinue = () => {
    setSOW({
      commercials: {
        pricingModel,
        fixedAmount,
        milestones,
        tmRoles,
        recurringAmount,
        billingFrequency,
        recurringStart,
        recurringEnd,
        costBase,
        markupPct,
      },
    })
    router.push('/requests/sow/create/ai-automation')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto px-10 py-12 grid grid-cols-[1fr_300px] gap-12">

        {/* ── LEFT: MAIN CONTENT ─────────────────────────────────────────────── */}
        <div className="space-y-10">
          <header className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-600">
              <span className="bg-cyan-100 px-2 py-1 rounded">SOW Setup</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-500 font-medium tracking-normal capitalize">Commercials</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Fees Structure</h1>
            <p className="text-gray-600 font-medium">Define how and when the supplier will be remunerated.</p>
          </header>

          {/* ── Pricing Model Selection ──────────────────────────────────────── */}
          <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-4">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-widest block">Pricing Structure</label>
            <div className="grid grid-cols-2 gap-3">
              {PRICING_MODELS.map(({ value, label, description }) => {
                const active = pricingModel === value
                return (
                  <button
                    key={value}
                    onClick={() => handleModelSwitch(value)}
                    className={`text-left rounded-xl border px-5 py-4 transition-all ${
                      active
                        ? 'border-cyan-500 bg-cyan-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`text-sm font-bold mb-0.5 ${active ? 'text-cyan-700' : 'text-gray-900'}`}>{label}</div>
                    <div className="text-[11px] text-gray-400 font-medium leading-snug">{description}</div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Stale Data Notice ────────────────────────────────────────────── */}
          {showStaleNotice && previousModel && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="mt-0.5 w-4 h-4 rounded-full bg-amber-400 shrink-0 flex items-center justify-center">
                <span className="text-white text-[9px] font-black">!</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-800">
                  Data from <span className="italic">{PRICING_MODELS.find(m => m.value === previousModel)?.label}</span> is still retained.
                </p>
                <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                  It won't be saved unless you switch back. Clear it if this model is your final choice.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={clearAllData}
                  className="text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-full transition-all"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowStaleNotice(false)}
                  className="text-amber-400 hover:text-amber-600 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── FIXED FEE ────────────────────────────────────────────────────── */}
          {pricingModel === 'Fixed fee' && (
            <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6 animate-in fade-in duration-300">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-widest block">Total Contract Value</label>
                <p className="text-[11px] text-gray-400 font-medium">The agreed fixed price payable in full upon engagement completion.</p>
                <div className="relative mt-3">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="number"
                    value={fixedAmount}
                    onChange={e => setFixedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-gray-300 pl-8 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>
              </div>
            </section>
          )}

          {/* ── MILESTONE-BASED ──────────────────────────────────────────────── */}
          {pricingModel === 'Milestone-based' && (
            <MilestonesSection
              milestones={milestones}
              onAdd={addMilestone}
              onUpdate={updateMilestone}
              onRemove={removeMilestone}
            />
          )}

          {/* ── TIME & MATERIALS ─────────────────────────────────────────────── */}
          {pricingModel === 'Time & materials' && (
            <TMSection
              roles={tmRoles}
              onAdd={addTMRole}
              onUpdate={updateTMRole}
              onRemove={removeTMRole}
            />
          )}

          {/* ── RECURRING ────────────────────────────────────────────────────── */}
          {pricingModel === 'Recurring' && (
            <RecurringSection
              billingFrequency={billingFrequency}
              setBillingFrequency={setBillingFrequency}
              recurringAmount={recurringAmount}
              setRecurringAmount={setRecurringAmount}
              recurringStart={recurringStart}
              setRecurringStart={setRecurringStart}
              recurringEnd={recurringEnd}
              setRecurringEnd={setRecurringEnd}
            />
          )}

          {/* ── HYBRID ───────────────────────────────────────────────────────── */}
          {pricingModel === 'Hybrid' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Fixed base */}
              <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-widest block mb-1">Fixed Base Fee</label>
                  <p className="text-[11px] text-gray-400 font-medium mb-3">The guaranteed fixed component of the engagement fee.</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      value={fixedAmount}
                      onChange={e => setFixedAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-md border border-gray-300 pl-8 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </section>
              {/* T&M component */}
              <TMSection
                roles={tmRoles}
                onAdd={addTMRole}
                onUpdate={updateTMRole}
                onRemove={removeTMRole}
                label="Variable T&M Component"
              />
            </div>
          )}

          {/* ── COST-PLUS ────────────────────────────────────────────────────── */}
          {pricingModel === 'Cost-plus' && (
            <CostPlusSection
              costBase={costBase}
              setCostBase={setCostBase}
              markupPct={markupPct}
              setMarkupPct={setMarkupPct}
            />
          )}

          {/* ── Footer ───────────────────────────────────────────────────────── */}
          <footer className="flex justify-end pt-10 border-t border-gray-200 mt-10">
            <button
              onClick={handleContinue}
              disabled={!pricingModel}
              className="group flex items-center justify-center gap-2 px-12 py-3.5 rounded-full bg-black text-white text-sm font-bold hover:bg-gray-800 transition-all shadow-lg min-w-[200px] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </footer>
        </div>

        {/* ── RIGHT: SIDEBAR ───────────────────────────────────────────────────── */}
        <aside className="sticky top-12 h-fit space-y-4">
          {/* Progress */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">SOW Progress</h3>
            <nav className="space-y-6">
              <StatusItem label="Scope Definition" status="complete" />
              <StatusItem label="Financials"       status="complete" />
              <StatusItem label="Commercials"      status="active" />
              <StatusItem label="Final Review"     status="pending" />
            </nav>
          </div>

          {/* Contract Value Summary */}
          {contractValue !== null && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4 animate-in fade-in duration-300">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Contract Value</h3>
              <div className="space-y-2">
                <div className="text-2xl font-black text-gray-900 tracking-tight">
                  ${fmt(contractValue)}
                </div>
                <div className="text-[11px] text-gray-400 font-medium">
                  {pricingModel === 'Recurring'
                    ? `Annualised · ${billingFrequency}`
                    : pricingModel === 'Cost-plus' && markupPct
                    ? `Cost base + ${markupPct}% markup`
                    : pricingModel === 'Time & materials' || pricingModel === 'Hybrid'
                    ? 'Estimated total exposure'
                    : 'Total engagement value'}
                </div>
              </div>
              {/* Milestone breakdown */}
              {pricingModel === 'Milestone-based' && milestones.length > 0 && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  {milestones.filter(m => m.name || m.amount > 0).map(m => (
                    <div key={m.id} className="flex justify-between text-[11px]">
                      <span className="text-gray-500 font-medium truncate max-w-[140px]">{m.name || 'Unnamed'}</span>
                      <span className="text-gray-900 font-bold">${fmt(m.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Hybrid breakdown */}
              {pricingModel === 'Hybrid' && (fixedAmount || tmRoles.some(r => estimateTMRoleCost(r.rate, r.startDate, r.endDate))) && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  {fixedAmount && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500 font-medium">Fixed base</span>
                      <span className="text-gray-900 font-bold">${fmt(Number(fixedAmount))}</span>
                    </div>
                  )}
                  {tmRoles.filter(r => estimateTMRoleCost(r.rate, r.startDate, r.endDate)).map(r => {
                    const est = estimateTMRoleCost(r.rate, r.startDate, r.endDate)!
                    return (
                      <div key={r.id} className="flex justify-between text-[11px]">
                        <span className="text-gray-500 font-medium truncate max-w-[140px]">{r.role || 'Unnamed role'}</span>
                        <span className="text-gray-900 font-bold">${fmt(est)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* Cost-plus breakdown */}
              {pricingModel === 'Cost-plus' && costBase && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500 font-medium">Cost base</span>
                    <span className="text-gray-900 font-bold">${fmt(Number(costBase))}</span>
                  </div>
                  {markupPct && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500 font-medium">Markup ({markupPct}%)</span>
                      <span className="text-gray-900 font-bold">${fmt(Number(costBase) * Number(markupPct) / 100)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

// ─── Milestone Section ────────────────────────────────────────────────────────

function MilestonesSection({
  milestones,
  onAdd,
  onUpdate,
  onRemove,
}: {
  milestones: Milestone[]
  onAdd: () => void
  onUpdate: (id: string, u: Partial<Milestone>) => void
  onRemove: (id: string) => void
}) {
  return (
    <section className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest">Deliverables & Milestones</h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 text-xs font-bold text-cyan-700 bg-cyan-50 px-4 py-2 rounded-full hover:bg-cyan-100 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add Milestone
        </button>
      </div>

      {milestones.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400 font-medium">No milestones added yet. Click Add Milestone to begin.</p>
        </div>
      )}

      <div className="space-y-4">
        {milestones.map((m, idx) => (
          <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative">
            <button
              onClick={() => onRemove(m.id)}
              className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Milestone Name</label>
                <input
                  type="text"
                  placeholder={`e.g. Phase ${idx + 1} Delivery`}
                  value={m.name}
                  onChange={e => onUpdate(m.id, { name: e.target.value })}
                  className="w-full border-b border-gray-200 focus:border-cyan-500 py-1 text-sm font-bold outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</label>
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                  <input
                    type="number"
                    value={m.amount || ''}
                    onChange={e => onUpdate(m.id, { amount: Number(e.target.value) })}
                    className="w-full border-b border-gray-200 focus:border-cyan-500 pl-4 py-1 text-sm font-bold outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Due Date</label>
                <input
                  type="date"
                  value={m.due}
                  onChange={e => onUpdate(m.id, { due: e.target.value })}
                  className="w-full border-b border-gray-200 focus:border-cyan-500 py-1 text-sm font-bold outline-none bg-transparent"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {milestones.length > 0 && <MilestoneTimeline milestones={milestones} />}
    </section>
  )
}

// ─── T&M Section ─────────────────────────────────────────────────────────────

function TMSection({
  roles,
  onAdd,
  onUpdate,
  onRemove,
  label = 'Resource Rates',
}: {
  roles: TMRole[]
  onAdd: () => void
  onUpdate: (id: string, u: Partial<TMRole>) => void
  onRemove: (id: string) => void
  label?: string
}) {
  const total = roles
    .map(r => estimateTMRoleCost(r.rate, r.startDate, r.endDate))
    .filter((v): v is number => v !== null)
    .reduce((s, v) => s + v, 0)

  return (
    <section className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest">{label}</h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 text-xs font-bold text-cyan-700 bg-cyan-50 px-4 py-2 rounded-full hover:bg-cyan-100 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add Role
        </button>
      </div>

      {roles.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm text-gray-400 font-medium">No roles added yet. Click Add Role to begin.</p>
        </div>
      )}

      <div className="space-y-4">
        {roles.map(r => {
          const est = estimateTMRoleCost(r.rate, r.startDate, r.endDate)
          return (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Role Title (e.g. Solution Architect)"
                    value={r.role}
                    onChange={e => onUpdate(r.id, { role: e.target.value })}
                    className="w-full text-lg font-bold text-gray-900 border-b-2 border-gray-100 focus:border-cyan-500 outline-none pb-1 transition-all"
                  />
                </div>
                <button onClick={() => onRemove(r.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-8">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hourly Rate</label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      value={r.rate || ''}
                      onChange={e => onUpdate(r.id, { rate: Number(e.target.value) })}
                      className="w-full border-b border-gray-200 focus:border-cyan-500 pl-4 py-1 text-sm font-bold outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Start</label>
                  <input
                    type="date"
                    value={r.startDate}
                    onChange={e => onUpdate(r.id, { startDate: e.target.value })}
                    className="w-full border-b border-gray-200 focus:border-cyan-500 py-1 text-sm font-bold outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">End</label>
                  <input
                    type="date"
                    value={r.endDate}
                    onChange={e => onUpdate(r.id, { endDate: e.target.value })}
                    className="w-full border-b border-gray-200 focus:border-cyan-500 py-1 text-sm font-bold outline-none"
                  />
                </div>
              </div>
              {est !== null && (
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 text-xs font-bold text-cyan-600">
                  <TrendingUp className="w-3 h-3" /> Estimated Exposure: ${fmt(est)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {roles.length > 0 && <TMRoleSummary roles={roles} />}
    </section>
  )
}

// ─── Recurring Section ────────────────────────────────────────────────────────

function RecurringSection({
  billingFrequency, setBillingFrequency,
  recurringAmount,  setRecurringAmount,
  recurringStart,   setRecurringStart,
  recurringEnd,     setRecurringEnd,
}: {
  billingFrequency: string; setBillingFrequency: (v: string) => void
  recurringAmount: string;  setRecurringAmount:  (v: string) => void
  recurringStart: string;   setRecurringStart:   (v: string) => void
  recurringEnd: string;     setRecurringEnd:     (v: string) => void
}) {
  const annualized = annualizeRecurring(Number(recurringAmount), billingFrequency)

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-widest">Billing Frequency</label>
          <select
            value={billingFrequency}
            onChange={e => setBillingFrequency(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm font-bold bg-white focus:ring-2 focus:ring-cyan-100 outline-none"
          >
            <option value="">Select frequency...</option>
            {BILLING_FREQUENCY.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-widest">Recurring Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
            <input
              type="number"
              value={recurringAmount}
              onChange={e => setRecurringAmount(e.target.value)}
              className="w-full rounded-md border border-gray-300 pl-8 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-cyan-100 outline-none"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
      <div className="space-y-4 pt-4 border-t border-gray-50">
        <label className="text-xs font-bold text-gray-700 uppercase tracking-widest block">Effective Period (Optional)</label>
        <div className="flex gap-4 items-center">
          <input
            type="date"
            value={recurringStart}
            onChange={e => setRecurringStart(e.target.value)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-cyan-100 outline-none"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={recurringEnd}
            onChange={e => setRecurringEnd(e.target.value)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-cyan-100 outline-none"
          />
        </div>
      </div>
      {annualized !== null && (
        <div className="p-4 bg-cyan-900 rounded-xl text-white flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-widest opacity-80">Annualised Forecast</span>
          <span className="text-xl font-black">${fmt(annualized)}</span>
        </div>
      )}
    </section>
  )
}

// ─── Cost-Plus Section ────────────────────────────────────────────────────────

function CostPlusSection({
  costBase, setCostBase,
  markupPct, setMarkupPct,
}: {
  costBase: string;   setCostBase:   (v: string) => void
  markupPct: string;  setMarkupPct:  (v: string) => void
}) {
  const base   = Number(costBase)
  const pct    = Number(markupPct)
  const markup = base && pct ? base * pct / 100 : null
  const total  = markup !== null ? base + markup : null

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-widest">Reimbursable Cost Base</label>
          <p className="text-[11px] text-gray-400 font-medium">Supplier's direct, verifiable cost for the engagement.</p>
          <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
            <input
              type="number"
              value={costBase}
              onChange={e => setCostBase(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-md border border-gray-300 pl-8 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-widest">Markup Percentage</label>
          <p className="text-[11px] text-gray-400 font-medium">Supplier's agreed margin on top of the cost base.</p>
          <div className="relative mt-2">
            <input
              type="number"
              value={markupPct}
              onChange={e => setMarkupPct(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-gray-300 pl-4 pr-10 py-3 text-sm font-bold focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Percent className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {total !== null && (
        <div className="pt-4 border-t border-gray-50 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Cost base</span>
            <span className="font-bold">${fmt(base)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Markup ({pct}%)</span>
            <span className="font-bold text-cyan-600">+ ${fmt(markup!)}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-700">Total Billable</span>
            <span className="text-xl font-black">${fmt(total)}</span>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusItem({ label, status }: { label: string; status: 'complete' | 'active' | 'pending' }) {
  return (
    <div className="flex items-center gap-3">
      {status === 'complete'
        ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        : status === 'active'
        ? <div className="w-5 h-5 rounded-full border-2 border-cyan-500 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-cyan-500" /></div>
        : <Circle className="w-5 h-5 text-gray-200" />}
      <span className={`text-sm font-bold tracking-tight ${status === 'active' ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
    </div>
  )
}

function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const sorted = milestones
    .filter(m => m.due)
    .map(m => {
      const d = new Date(m.due + 'T00:00:00')
      return isNaN(d.getTime()) ? null : { ...m, date: d }
    })
    .filter(Boolean) as (Milestone & { date: Date })[]

  sorted.sort((a, b) => a.date.getTime() - b.date.getTime())

  if (sorted.length === 0) return null

  const n          = sorted.length
  const total      = sorted.reduce((s, m) => s + m.amount, 0)
  const today      = new Date()
  const rangeStart = sorted[0].date.getTime()
  const rangeEnd   = sorted[n - 1].date.getTime()
  const rangeMs    = rangeEnd - rangeStart || 1

  // Today as % of full timeline, mapped to % within the flex container
  // First circle center is at 50/n% of container, last at (100 - 50/n)%
  const todayRaw     = ((today.getTime() - rangeStart) / rangeMs) * 100
  const todayLeftPct = 50 / n + (todayRaw / 100) * ((n - 1) / n) * 100
  const showToday    = n > 1 && todayRaw >= 0 && todayRaw <= 100

  // Pixel layout constants (Tailwind equivalents)
  const PILL_H   = 30   // amount pill height ≈ 30px
  const GAP      = 12   // mb-3
  const CIRC_R   = 22   // w-11 → 44px → radius 22
  const TRACK_Y  = PILL_H + GAP + CIRC_R  // = 64px — vertical center of circles

  const daysBetween = (a: Date, b: Date) =>
    Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000)

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: '#060d14', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div
        className="px-8 pt-7 pb-6 flex items-start justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div>
          <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2">
            Payment Schedule
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl font-black text-white tracking-tight">${fmt(total)}</span>
            <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
              across {n} milestone{n !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {showToday && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">
              Today marked
            </span>
          </div>
        )}
      </div>

      {/* ── TIMELINE ───────────────────────────────────────────────────────── */}
      <div className="px-8 pt-9 pb-7">
        <div className="relative flex">

          {/* Today vertical marker — globally positioned across full flex row */}
          {showToday && (
            <div
              className="absolute pointer-events-none z-20 flex flex-col items-center"
              style={{
                top:       `${TRACK_Y - 22}px`,
                left:      `${todayLeftPct}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <span
                className="text-[7px] font-black uppercase mb-1"
                style={{ color: 'rgba(251,191,36,0.8)', letterSpacing: '0.08em' }}
              >
                Now
              </span>
              <div
                style={{
                  width:      '1px',
                  height:     '44px',
                  background: 'linear-gradient(to bottom, rgba(251,191,36,0.7), rgba(251,191,36,0))',
                }}
              />
            </div>
          )}

          {/* Milestone columns */}
          {sorted.map((m, idx) => {
            const isHovered = hoveredId === m.id
            const pct       = total > 0 ? Math.round((m.amount / total) * 100) : 0
            const cumul     = sorted.slice(0, idx + 1).reduce((s, x) => s + x.amount, 0)
            const gapDays   = idx < n - 1 ? daysBetween(m.date, sorted[idx + 1].date) : null

            return (
              <div
                key={m.id}
                className="flex-1 flex flex-col items-center relative"
                onMouseEnter={() => setHoveredId(m.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Left track half */}
                {idx > 0 && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top:        `${TRACK_Y}px`,
                      left:       0,
                      right:      '50%',
                      height:     '1px',
                      background: 'rgba(255,255,255,0.08)',
                    }}
                  />
                )}

                {/* Right track half */}
                {idx < n - 1 && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top:        `${TRACK_Y}px`,
                      left:       '50%',
                      right:      0,
                      height:     '1px',
                      background: 'rgba(255,255,255,0.08)',
                    }}
                  />
                )}

                {/* Gap label — centered between this and next circle */}
                {gapDays !== null && (
                  <div
                    className="absolute z-10 pointer-events-none"
                    style={{
                      top:       `${TRACK_Y - 9}px`,
                      right:     0,
                      transform: 'translateX(50%)',
                    }}
                  >
                    <div
                      className="rounded-full px-1.5 py-0.5"
                      style={{ background: '#0a1520', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <span
                        className="text-[7px] font-black"
                        style={{ color: 'rgba(255,255,255,0.22)' }}
                      >
                        {gapDays}d
                      </span>
                    </div>
                  </div>
                )}

                {/* Amount pill */}
                <div
                  className="mb-3"
                  style={{
                    transition: 'transform 0.2s ease',
                    transform:  isHovered ? 'scale(1.1) translateY(-2px)' : 'scale(1)',
                  }}
                >
                  <div
                    className="rounded-full px-3 py-1"
                    style={{
                      background:  isHovered ? 'rgb(6,182,212)'            : 'rgba(255,255,255,0.04)',
                      border:      `1px solid ${isHovered ? 'rgb(34,211,238)' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow:   isHovered ? '0 0 18px rgba(6,182,212,0.45)' : 'none',
                      transition:  'all 0.2s ease',
                    }}
                  >
                    <span
                      className="text-[10px] font-black"
                      style={{ color: isHovered ? 'white' : 'rgb(34,211,238)', transition: 'color 0.2s' }}
                    >
                      ${fmt(m.amount)}
                    </span>
                  </div>
                </div>

                {/* Circle node */}
                <div
                  className="relative rounded-full border-2 flex items-center justify-center z-10"
                  style={{
                    width:       '44px',
                    height:      '44px',
                    background:  isHovered ? 'rgb(6,182,212)'   : '#111d2b',
                    borderColor: isHovered ? 'rgb(34,211,238)'  : 'rgba(255,255,255,0.14)',
                    transform:   isHovered ? 'scale(1.2)'       : 'scale(1)',
                    boxShadow:   isHovered ? '0 0 28px rgba(6,182,212,0.55)' : 'none',
                    transition:  'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                    cursor:      'default',
                  }}
                >
                  <span
                    className="text-xs font-black"
                    style={{ color: isHovered ? 'white' : 'rgba(255,255,255,0.38)', transition: 'color 0.2s' }}
                  >
                    {idx + 1}
                  </span>
                  {/* Ping ring on hover */}
                  {isHovered && (
                    <div
                      className="absolute rounded-full border border-cyan-400/30 animate-ping"
                      style={{ inset: '-7px' }}
                    />
                  )}
                </div>

                {/* Name + date + hover detail */}
                <div className="mt-4 text-center px-1 w-full space-y-1">
                  <div
                    className="text-[10px] font-bold leading-snug"
                    style={{
                      color:              isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.42)',
                      transition:         'color 0.2s',
                      overflow:           'hidden',
                      display:            '-webkit-box',
                      WebkitLineClamp:    2,
                      WebkitBoxOrient:    'vertical',
                    }}
                  >
                    {m.name || `Milestone ${idx + 1}`}
                  </div>
                  <div
                    className="text-[9px]"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                  >
                    {m.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </div>
                  {/* Cumulative on hover */}
                  <div
                    style={{
                      height:     '14px',
                      opacity:    isHovered ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <span className="text-[9px] font-black text-cyan-400">
                      {pct}% · Σ&nbsp;${fmt(cumul)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── DISBURSEMENT BAR ───────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="px-8 pb-7" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div
            className="text-[9px] font-black uppercase tracking-widest mt-5 mb-2"
            style={{ color: 'rgba(255,255,255,0.16)' }}
          >
            Disbursement Split
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden" style={{ gap: '2px' }}>
            {sorted.map(m => {
              const w = total > 0 ? (m.amount / total) * 100 : 0
              return (
                <div
                  key={m.id}
                  className="h-full"
                  style={{
                    width:      `${w}%`,
                    background: hoveredId === m.id ? 'rgb(34,211,238)' : 'rgba(255,255,255,0.14)',
                    transition: 'background 0.2s ease',
                    borderRadius: '9999px',
                  }}
                />
              )
            })}
          </div>
          <div className="flex mt-1.5">
            {sorted.map(m => {
              const w = total > 0 ? (m.amount / total) * 100 : 0
              return (
                <div key={m.id} style={{ width: `${w}%` }}>
                  <span
                    className="text-[8px] font-bold"
                    style={{ color: hoveredId === m.id ? 'rgba(34,211,238,0.7)' : 'rgba(255,255,255,0.18)' }}
                  >
                    {Math.round(w)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TMRoleSummary({ roles }: { roles: TMRole[] }) {
  const rows = roles
    .map(r => {
      const est = estimateTMRoleCost(r.rate, r.startDate, r.endDate)
      return est ? { ...r, est } : null
    })
    .filter(Boolean) as (TMRole & { est: number })[]

  if (rows.length === 0) return null
  const total = rows.reduce((s, r) => s + r.est, 0)

  return (
    <div className="bg-gray-900 rounded-xl p-6 text-white shadow-xl">
      <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4">Engagement Cost Forecast</div>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
            <span className="font-bold opacity-80">{r.role || 'Unnamed role'}</span>
            <span className="font-mono font-bold">${fmt(r.est)}</span>
          </div>
        ))}
        <div className="flex justify-between items-center pt-2 text-lg font-black">
          <span className="text-cyan-400 uppercase text-xs tracking-widest">Total Est. Exposure</span>
          <span>${fmt(total)}</span>
        </div>
      </div>
    </div>
  )
}