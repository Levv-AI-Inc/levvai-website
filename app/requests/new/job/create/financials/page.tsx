'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'
import { useCWRequest } from '../../context/CWRequestContext'
import {
  ChevronRight,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Minus,
  BarChart3,
  BriefcaseBusiness,
} from 'lucide-react'

type BillRateMode = 'fixed' | 'range'

type RateCard = {
  id: string
  name: string
  stRate: number
  otFactor: number
  marketMin: number
  marketMax: number
  supplierCoverage: number
  totalSuppliers: number
  recommendedRate: number
  locationLabel: string
}

export default function CWFinancialsPage() {
  const router = useRouter()
  const { request } = useCWRequest()

  const rateCards: RateCard[] = [
    {
      id: 'dev_toronto',
      name: 'Data Analyst II',
      locationLabel: 'New York',
      stRate: 70,
      otFactor: 1.5,
      marketMin: 65,
      marketMax: 85,
      supplierCoverage: 4,
      totalSuppliers: 6,
      recommendedRate: 74,
    },
    {
      id: 'qa_toronto',
      name: 'QA Analyst',
      locationLabel: 'Toronto',
      stRate: 55,
      otFactor: 1.5,
      marketMin: 50,
      marketMax: 68,
      supplierCoverage: 5,
      totalSuppliers: 6,
      recommendedRate: 58,
    },
    {
      id: 'pm_ny',
      name: 'Project Manager',
      locationLabel: 'New York',
      stRate: 95,
      otFactor: 1.75,
      marketMin: 90,
      marketMax: 120,
      supplierCoverage: 3,
      totalSuppliers: 5,
      recommendedRate: 102,
    },
  ]

  const inferredRole =
    request.jobTitle ||
    request.role ||
    request.title ||
    selectedFallbackRoleFromRequest(request) ||
    'Senior Developer'

  const matchedCard =
    rateCards.find((c) => c.name.toLowerCase() === String(inferredRole).toLowerCase()) || rateCards[0]

  const [selectedRateCard, setSelectedRateCard] = useState<RateCard>(matchedCard)
  const [stMode, setStMode] = useState<BillRateMode>('fixed')
  const [stFixed, setStFixed] = useState<number>(matchedCard.stRate)
  const [stMin, setStMin] = useState<number | ''>('')
  const [stMax, setStMax] = useState<number | ''>('')
  const [otEnabled, setOtEnabled] = useState(false)
  const [otFactor, setOtFactor] = useState<number>(matchedCard.otFactor)

  useEffect(() => {
    const nextCard =
      rateCards.find((c) => c.name.toLowerCase() === String(inferredRole).toLowerCase()) || rateCards[0]

    setSelectedRateCard(nextCard)
    setStFixed(nextCard.stRate)
    setOtFactor(nextCard.otFactor)
    setStMin('')
    setStMax('')
    setStMode('fixed')
  }, [inferredRole])

  const positions = request.positions ?? 1
  const hoursPerDay = 8
  const durationDays = 30
  const otHoursPct = 0.2

  const baseHours = durationDays * hoursPerDay
  const otHours = otEnabled ? baseHours * otHoursPct : 0

  const stBillRateForCalc = typeof stFixed === 'number' ? stFixed : 0

  const supplierMarkupPct = 0.2
  const platformFeePct = 0.05
  const statutoryPct = 0.08

  const supplierMarkupPerHour = stBillRateForCalc * supplierMarkupPct
  const platformFeePerHour = stBillRateForCalc * platformFeePct
  const statutoryPerHour = stBillRateForCalc * statutoryPct

  const modeledBillRate =
    stBillRateForCalc + supplierMarkupPerHour + platformFeePerHour + statutoryPerHour

  const stLineTotal = baseHours * modeledBillRate * positions
  const otLineTotal = otEnabled ? otHours * (modeledBillRate * otFactor) * positions : 0
  const totalValue = stLineTotal + otLineTotal

  const rangeMid =
    typeof stMin === 'number' && typeof stMax === 'number' ? (stMin + stMax) / 2 : 0

  const marketAssessment = useMemo(() => {
    const valueToAssess = stMode === 'range' ? rangeMid : stBillRateForCalc
    const { marketMin, marketMax, recommendedRate, supplierCoverage, totalSuppliers } =
      selectedRateCard

    if (!valueToAssess || valueToAssess <= 0) {
      return {
        label: 'Incomplete',
        tone: 'neutral' as const,
        message: 'Enter a rate to see market alignment and supplier match.',
        suppliersLikely: 0,
      }
    }

    if (valueToAssess < marketMin) {
      const coveragePenalty = valueToAssess < marketMin - 10 ? 3 : 2
      const suppliersLikely = Math.max(0, supplierCoverage - coveragePenalty)
      return {
        label: 'Below market',
        tone: 'critical' as const,
        message: `This is below your configured market band (${marketMin}–${marketMax}/hr). Supplier response may be weak.`,
        suppliersLikely,
      }
    }

    if (valueToAssess > marketMax) {
      const suppliersLikely = Math.min(totalSuppliers, supplierCoverage + 1)
      return {
        label: 'Above market',
        tone: 'warning' as const,
        message: `This is above your configured market band (${marketMin}–${marketMax}/hr). Fill likelihood is good, but cost is elevated.`,
        suppliersLikely,
      }
    }

    let suppliersLikely = supplierCoverage
    if (valueToAssess >= recommendedRate) {
      suppliersLikely = Math.min(totalSuppliers, supplierCoverage + 1)
    }

    return {
      label: 'Within range',
      tone: 'good' as const,
      message: `This is aligned to the configured market band. Recommended target is around $${recommendedRate}/hr.`,
      suppliersLikely,
    }
  }, [stMode, rangeMid, stBillRateForCalc, selectedRateCard])

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,_#f8fafc,_#f8fafc,_#eef6ff)] pb-20 font-sans">
      <div className="max-w-[1500px] mx-auto px-8 py-12">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-700 mb-3">
            <span className="bg-cyan-100 text-cyan-800 px-2.5 py-1 rounded-full">Step 2 of 3</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Financials</span>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Rates & Spend</h1>
              <p className="text-slate-600 mt-2 max-w-3xl">
                Define the target rate, understand how it compares to market, and preview total
                engagement cost before routing to suppliers.
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7">
            <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-6 items-start">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">
                  Role
                </div>
                <h2 className="text-lg font-bold text-slate-900">Role and baseline pricing</h2>
                <p className="text-sm text-slate-600 mt-1">
                  
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                    <BriefcaseBusiness className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">
                      Selected role
                    </div>
                    <div className="text-lg font-bold text-slate-900 truncate">
                      {selectedRateCard.name} — {selectedRateCard.locationLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-7 py-6 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <DollarSign className="w-4 h-4 text-cyan-600" />
                Target Rate Builder
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Set the rate the hiring manager wants to target. The system will show market
                alignment and cost impact immediately.
              </p>
            </div>

            <div className="p-7 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 block mb-2">
                    Pricing structure
                  </label>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setStMode('fixed')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        stMode === 'fixed'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Fixed rate
                    </button>
                    <button
                      type="button"
                      onClick={() => setStMode('range')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        stMode === 'range'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Rate range
                    </button>
                  </div>
                </div>

                {stMode === 'fixed' ? (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 block mb-2">
                      Target standard rate
                    </label>
                    <div className="relative max-w-md">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        value={stFixed}
                        onChange={(e) => setStFixed(e.target.value ? Number(e.target.value) : 0)}
                        className="w-full border border-slate-300 rounded-xl pl-8 pr-4 py-3 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      This is the target hourly rate entered at intake.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 block mb-2">
                      Target range
                    </label>
                    <div className="grid grid-cols-[minmax(0,220px)_auto_minmax(0,220px)] gap-3 items-center max-w-[520px]">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          placeholder="Min"
                          value={stMin}
                          onChange={(e) => setStMin(e.target.value ? Number(e.target.value) : '')}
                          className="w-full border border-slate-300 rounded-xl pl-8 pr-4 py-3 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>

                      <Minus className="w-4 h-4 text-slate-300" />

                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          placeholder="Max"
                          value={stMax}
                          onChange={(e) => setStMax(e.target.value ? Number(e.target.value) : '')}
                          className="w-full border border-slate-300 rounded-xl pl-8 pr-4 py-3 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      Average rate used for modeling:{' '}
                      <span className="font-semibold text-slate-700">
                        {rangeMid > 0 ? `$${rangeMid.toFixed(2)}/hr` : '—'}
                      </span>
                    </p>
                  </div>
                )}

                <div className="rounded-2xl bg-cyan-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-cyan-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-slate-900">AI guidance</div>
                      <p className="text-sm text-slate-600 mt-1">
                        Recommended target for this role and market is around{' '}
                        <span className="font-bold text-slate-900">
                          ${selectedRateCard.recommendedRate}/hr
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <MarketInsightCard
                assessment={marketAssessment}
                selectedRateCard={selectedRateCard}
              />

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                  <div className="text-sm font-bold text-slate-900">Overtime structure</div>
                  <p className="text-sm text-slate-600 mt-1">
                    Decide whether overtime should be included in the estimate.
                  </p>
                </div>

                <div className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setOtEnabled(false)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        !otEnabled
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      No overtime
                    </button>
                    <button
                      type="button"
                      onClick={() => setOtEnabled(true)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        otEnabled
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Include overtime
                    </button>
                  </div>

                  {otEnabled && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Multiplier
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        value={otFactor}
                        onChange={(e) => setOtFactor(Number(e.target.value))}
                        className="w-24 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-slate-500">
                        OT modeled bill rate:{' '}
                        <span className="font-bold text-slate-900">
                          ${(modeledBillRate * otFactor).toFixed(2)}/hr
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-7 py-6 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <BarChart3 className="w-4 h-4 text-cyan-600" />
                Cost Breakdown
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Transparent view of the modeled hourly rate and total commitment.
              </p>
            </div>

            <div className="p-7 space-y-7">
              <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-7">
                <div className="rounded-2xl border border-slate-200 p-6">
                  <div className="text-sm font-bold text-slate-900 mb-4">Hourly cost breakdown</div>

                  <div className="space-y-3">
                    <BreakdownRow label="Target rate" value={stBillRateForCalc} strong />
                    <BreakdownRow
                      label={`Supplier markup (${Math.round(supplierMarkupPct * 100)}%)`}
                      value={supplierMarkupPerHour}
                    />
                    <BreakdownRow
                      label={`Platform / MSP fee (${Math.round(platformFeePct * 100)}%)`}
                      value={platformFeePerHour}
                    />
                    <BreakdownRow
                      label={`Statutory / additional costs (${Math.round(statutoryPct * 100)}%)`}
                      value={statutoryPerHour}
                    />
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Modeled bill rate</span>
                    <span className="text-2xl font-black text-slate-900">
                      ${modeledBillRate.toFixed(2)}/hr
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-6">
                  <div className="text-sm font-bold text-slate-900 mb-4">Commitment summary</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SummaryStat label="Duration" value={`${durationDays} days`} />
                    <SummaryStat label="Positions" value={`${positions}`} />
                    <SummaryStat label="Base hours" value={`${baseHours.toLocaleString()} hrs`} />
                    <SummaryStat label="OT hours" value={otEnabled ? `${Math.round(otHours)} hrs` : 'Excluded'} />
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Total commitment</span>
                    <span className="text-3xl font-black text-slate-900">
                      ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-slate-900 mb-4">Spend breakdown</div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SpendLine
                    label="Standard time commitment"
                    basis={`${baseHours} hrs × ${positions} pos × $${modeledBillRate.toFixed(2)}/hr`}
                    total={stLineTotal}
                  />
                  {otEnabled && (
                    <SpendLine
                      label="Overtime commitment"
                      basis={`${Math.round(otHours)} hrs × ${positions} pos × $${(modeledBillRate * otFactor).toFixed(2)}/hr`}
                      total={otLineTotal}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          <footer className="flex justify-between items-center pt-8 border-t border-slate-200">
            <button
              onClick={() => router.push('/requests/new/job/create/define')}
              className="px-8 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors rounded-full"
            >
              Back
            </button>

            <button
              onClick={() => router.push('/requests/new/job/create/suppliers')}
              className="group flex items-center justify-center gap-2 px-10 py-3.5 rounded-full bg-slate-950 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-lg min-w-[180px]"
            >
              Continue
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}

function selectedFallbackRoleFromRequest(request: any) {
  return (
    request.workerTypeLabel ||
    request.templateName ||
    request.category ||
    request.roleName ||
    ''
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 min-h-[110px] flex flex-col justify-between">
      <div className="text-[11px] leading-5 font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="text-2xl font-black text-slate-900 mt-3">{value}</div>
    </div>
  )
}

function MarketInsightCard({
  assessment,
  selectedRateCard,
}: {
  assessment: {
    label: string
    tone: 'good' | 'warning' | 'critical' | 'neutral'
    message: string
    suppliersLikely: number
  }
  selectedRateCard: RateCard
}) {
  const styles = {
    good: {
      wrap: 'border-emerald-200 bg-emerald-50/70',
      badge: 'bg-emerald-100 text-emerald-700',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    },
    warning: {
      wrap: 'border-amber-200 bg-amber-50/70',
      badge: 'bg-amber-100 text-amber-700',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    },
    critical: {
      wrap: 'border-rose-200 bg-rose-50/70',
      badge: 'bg-rose-100 text-rose-700',
      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
    },
    neutral: {
      wrap: 'border-slate-200 bg-slate-50/70',
      badge: 'bg-slate-100 text-slate-700',
      icon: <DollarSign className="w-5 h-5 text-slate-500" />,
    },
  }[assessment.tone]

  return (
    <div className={`rounded-2xl border p-7 ${styles.wrap}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 max-w-3xl">
          <div className="mt-0.5">{styles.icon}</div>
          <div>
            <div className="text-base font-bold text-slate-900">Market assessment</div>
            <p className="text-sm text-slate-700 mt-2 leading-7 max-w-2xl">{assessment.message}</p>
          </div>
        </div>

        <span className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${styles.badge}`}>
          {assessment.label}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="rounded-xl bg-white/80 border border-white/80 p-5 min-h-[96px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">
            Recommended target
          </div>
          <div className="text-2xl font-black text-slate-900">
            ${selectedRateCard.recommendedRate}/hr
          </div>
        </div>

        <div className="rounded-xl bg-white/80 border border-white/80 p-5 min-h-[96px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">
            Potential supplier match
          </div>
          <div className="text-2xl font-black text-slate-900">
            {assessment.suppliersLikely}/{selectedRateCard.totalSuppliers}
          </div>
        </div>
      </div>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${strong ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
        {label}
      </span>
      <span className={`text-sm ${strong ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
        ${value.toFixed(2)}
      </span>
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-lg font-black text-slate-900">{value}</div>
    </div>
  )
}

function SpendLine({
  label,
  basis,
  total,
}: {
  label: string
  basis: string
  total: number
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">{label}</div>
          <div className="text-sm text-slate-500 mt-2 leading-6">{basis}</div>
        </div>
        <div className="text-right text-lg font-black text-slate-900 whitespace-nowrap">
          ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  )
}