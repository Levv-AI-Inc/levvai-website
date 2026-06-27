'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSOW } from '../context'

const PRICING_MODELS = [
  'Fixed fee',
  'Time & materials',
  'Recurring',
  'Milestone-based',
]

const PAYMENT_TRIGGERS = ['On completion', 'On milestones']

const BILLING_FREQUENCY = ['Monthly', 'Quarterly', 'Annually']

type Milestone = {
  id: string
  name: string
  amount: number
  due: string
}

type TMRole = {
  id: string
  role: string
  rate: number
  startDate: string
  endDate: string
}

/* ---------------- T&M Helpers (Supplementary Only) ---------------- */

function estimateTMRoleCost(
  rate: number,
  startDate?: string,
  endDate?: string
) {
  if (!rate || !startDate || !endDate) return null

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

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

/* ---------------- Page ---------------- */
function annualizeRecurring(amount: number, frequency: string) {
  if (!amount || !frequency) return null

  if (frequency === 'Monthly') return amount * 12
  if (frequency === 'Quarterly') return amount * 4
  if (frequency === 'Annually') return amount

  return null
}

export default function CommercialsPage() {
  const router = useRouter()
  const { sow, setSOW } = useSOW()

  const [pricingModel, setPricingModel] = useState(
    sow.commercials?.pricingModel || ''
  )

  const [paymentTrigger, setPaymentTrigger] = useState(
    sow.commercials?.paymentTrigger || ''
  )

  const [milestones, setMilestones] = useState<Milestone[]>(
    sow.commercials?.milestones || []
  )

  const [recurringAmount, setRecurringAmount] = useState(
    sow.commercials?.recurringAmount || ''
  )

  const [billingFrequency, setBillingFrequency] = useState(
    sow.commercials?.billingFrequency || ''
  )

  // Supplementary only (not saved to SOW)
  const [recurringStart, setRecurringStart] = useState('')
  const [recurringEnd, setRecurringEnd] = useState('')

  const [tmRoles, setTmRoles] = useState<TMRole[]>(
    sow.commercials?.tmRoles || []
  )

  const annualizedRecurring = annualizeRecurring(
  Number(recurringAmount),
  billingFrequency
)

  /* ---------- Existing Helpers (unchanged) ---------- */

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      { id: crypto.randomUUID(), name: '', amount: 0, due: '' },
    ])
  }

  const updateMilestone = (id: string, updates: Partial<Milestone>) => {
    setMilestones(milestones.map(m => (m.id === id ? { ...m, ...updates } : m)))
  }

  const removeMilestone = (id: string) => {
    setMilestones(milestones.filter(m => m.id !== id))
  }

  const addTMRole = () => {
    setTmRoles([
      ...tmRoles,
      {
        id: crypto.randomUUID(),
        role: '',
        rate: 0,
        startDate: '',
        endDate: '',
      },
    ])
  }

  const updateTMRole = (id: string, updates: Partial<TMRole>) => {
    setTmRoles(tmRoles.map(r => (r.id === id ? { ...r, ...updates } : r)))
  }

  const removeTMRole = (id: string) => {
    setTmRoles(tmRoles.filter(r => r.id !== id))
  }

  const handleContinue = () => {
    setSOW({
      commercials: {
        pricingModel,
        paymentTrigger,
        milestones,
        recurringAmount,
        billingFrequency,
        tmRoles,
      },
    })

    router.push('/requests/sow/create/ai-automation')
  }

  return (
    <div className="max-w-7xl mx-auto p-10 grid grid-cols-[1fr_260px] gap-10">
      {/* LEFT */}
      <div className="space-y-10">
        <div>
          <h1 className="text-2xl font-semibold">Commercials</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define how and when the supplier will be paid.
          </p>
        </div>

        {/* Pricing model */}
        <div>
          <label className="block font-semibold mb-1">Pricing model</label>
          <select
            value={pricingModel}
            onChange={e => setPricingModel(e.target.value)}
            className="text-sm w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="">Select pricing model</option>
            {PRICING_MODELS.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* FIXED / MILESTONE */}
        {(pricingModel === 'Fixed fee' || pricingModel === 'Milestone-based') && (
          <div className="space-y-4">
            <label className="block font-semibold mb-1">Payment trigger</label>
            <select
              value={paymentTrigger}
              onChange={e => setPaymentTrigger(e.target.value)}
              className="text-sm w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <option value="">Select trigger</option>
              {PAYMENT_TRIGGERS.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {paymentTrigger === 'On milestones' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="font-semibold">Milestones</div>
                  <button
                    onClick={addMilestone}
                    className="text-sm border border-slate-300 px-4 py-1.5 rounded-full hover:bg-slate-50 transition"
                  >
                    + Add milestone
                  </button>
                </div>

                {milestones.map(m => (
                  <div key={m.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Milestone name"
                        value={m.name}
                        onChange={e =>
                          updateMilestone(m.id, { name: e.target.value })
                        }
                        className="text-sm w-full border rounded-md p-2"
                      />
                      <button onClick={() => removeMilestone(m.id)}>✕</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={m.amount}
                        onChange={e =>
                          updateMilestone(m.id, {
                            amount: Number(e.target.value),
                          })
                        }
                        className="text-sm border rounded-md p-2"
                      />
                      <input
                        type="date"
                        value={m.due}
                        onChange={e =>
                          updateMilestone(m.id, { due: e.target.value })
                        }
                        className="text-sm border rounded-md p-2"
                      />
                    </div>
                  </div>
                ))}

                {milestones.length > 0 && (
                  <MilestoneGantt milestones={milestones} />
                )}
              </div>
            )}
          </div>
        )}

        {/* TIME & MATERIALS */}
        {pricingModel === 'Time & materials' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">Roles & rates</div>
              <button
                onClick={addTMRole}
                className="text-sm border border-slate-300 px-4 py-1.5 rounded-full hover:bg-slate-50 transition"
              >
                + Add role
              </button>
            </div>

            {tmRoles.map(r => {
              const est = estimateTMRoleCost(
                r.rate,
                r.startDate,
                r.endDate
              )

              return (
                <div key={r.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Role (e.g. Solution Architect)"
                      value={r.role}
                      onChange={e =>
                        updateTMRole(r.id, { role: e.target.value })
                      }
                      className="text-sm w-full border rounded-md p-2"
                    />
                    <button onClick={() => removeTMRole(r.id)}>✕</button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="number"
                      placeholder="Rate / hour"
                      value={r.rate}
                      onChange={e =>
                        updateTMRole(r.id, {
                          rate: Number(e.target.value),
                        })
                      }
                      className="text-sm border rounded-md p-2"
                    />
                    <input
                      type="date"
                      value={r.startDate}
                      onChange={e =>
                        updateTMRole(r.id, {
                          startDate: e.target.value,
                        })
                      }
                      className="text-sm border rounded-md p-2"
                    />
                    <input
                      type="date"
                      value={r.endDate}
                      onChange={e =>
                        updateTMRole(r.id, {
                          endDate: e.target.value,
                        })
                      }
                      className="text-sm border rounded-md p-2"
                    />
                  </div>

                  {est !== null && (
                    <div className="text-xs text-gray-500">
                      Estimated cost (date range):{' '}
                      <span className="font-medium text-gray-700">
                        ~${est.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}

            {tmRoles.length > 0 && <TMRoleSummary roles={tmRoles} />}
          </div>
        )}

        {/* RECURRING */}
        {pricingModel === 'Recurring' && (
          <div className="space-y-4">
            <label className="block font-semibold mb-1">
              Billing frequency
            </label>
            <select
              value={billingFrequency}
              onChange={e => setBillingFrequency(e.target.value)}
              className="text-sm w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <option value="">Select frequency</option>
              {BILLING_FREQUENCY.map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <label className="block font-semibold mb-1">
              Recurring amount
            </label>
            <input
              type="number"
              value={recurringAmount}
              onChange={e => setRecurringAmount(e.target.value)}
              className="text-sm w-60 border rounded-md p-3"
            />

            {/* Effective period (supplementary only) */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">
                Effective period (optional)
              </div>
              <div className="flex gap-4">
                <input
                  type="date"
                  value={recurringStart}
                  onChange={e => setRecurringStart(e.target.value)}
                  className="text-sm border rounded-md p-2"
                />
                <input
                  type="date"
                  value={recurringEnd}
                  onChange={e => setRecurringEnd(e.target.value)}
                  className="text-sm border rounded-md p-2"
                />
              </div>
            </div>

            {/* Annualized value (read-only) */}
            {annualizedRecurring !== null && (
              <div className="text-sm text-slate-500">
                Annualized value:{' '}
                <span className="font-semibold text-gray-900">
                  ~${annualizedRecurring.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Recurring billing summary (supplementary only) */}
        {(billingFrequency || recurringAmount) && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="text-sm font-semibold mb-2">
              Recurring billing summary
            </div>

            <div className="text-sm text-gray-700 space-y-1">
              <div>
                {billingFrequency || '—'} · $
                {recurringAmount || '—'} per period
              </div>

              {annualizedRecurring !== null && (
                <div>
                  ~${annualizedRecurring.toLocaleString()} annualized
                </div>
              )}

              {(recurringStart || recurringEnd) && (
                <div className="text-gray-500">
                  Effective {recurringStart || '—'} →{' '}
                  {recurringEnd || 'Ongoing'}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition"
          >
            Continue
          </button>
        </div>
      </div>

      {/* RIGHT STATUS */}
      <div className="sticky top-10 h-fit border border-slate-200 rounded-xl p-5 bg-white">
        <div className="font-medium mb-3">SOW progress</div>
        <StatusItem label="Description" status="complete" />
        <StatusItem label="Financials" status="complete" />
        <StatusItem label="Commercials" status="active" />
        <StatusItem label="Review" status="pending" />
      </div>
    </div>
  )
}

/* ---------------- Supplementary Components ---------------- */

function StatusItem({
  label,
  status,
}: {
  label: string
  status: 'complete' | 'active' | 'pending'
}) {
  const color =
    status === 'complete'
      ? 'bg-green-500'
      : status === 'active'
      ? 'bg-amber-400'
      : 'bg-gray-300'

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  )
}

function MilestoneGantt({
  milestones,
}: {
  milestones: Milestone[]
}) {
  const parsed = milestones
    .filter(m => m.due)
    .map(m => {
      const d = new Date(m.due + 'T00:00:00')
      return Number.isNaN(d.getTime()) ? null : { ...m, ts: d.getTime() }
    })
    .filter(Boolean) as (Milestone & { ts: number })[]

  if (parsed.length === 0) return null

  const min = Math.min(...parsed.map(m => m.ts))
  const max = Math.max(...parsed.map(m => m.ts))
  const range = max - min || 1

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const pct = (ts: number) => ((ts - min) / range) * 100

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="text-sm font-semibold mb-3">
        Milestone schedule
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-4 px-3 text-xs text-gray-500 uppercase">
          <div className="w-56">Milestone</div>
          <div className="w-20 text-right">Amount</div>
          <div className="flex-1 text-center">Timing</div>
        </div>

        {parsed.map((m, idx) => (
          <div
            key={m.id}
            className="flex items-center gap-4 border rounded-md bg-white p-3"
          >
            <div className="w-56">
              <div className="text-sm font-medium">
                {m.name || `Milestone ${idx + 1}`}
              </div>
              <div className="text-xs text-gray-500">
                Due {formatDate(m.ts)}
              </div>
            </div>

            <div className="w-20 text-sm text-right">
              ${m.amount ?? 0}
            </div>

            <div className="flex-1">
              <div className="relative h-2 bg-gray-200 rounded">
                <div
                  className="absolute h-2 w-2 bg-black rounded-full"
                  style={{ left: `${pct(m.ts)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TMRoleSummary({
  roles,
}: {
  roles: TMRole[]
}) {
  const rows = roles
    .map(r => {
      const est = estimateTMRoleCost(r.rate, r.startDate, r.endDate)
      return est ? { ...r, est } : null
    })
    .filter(Boolean) as (TMRole & { est: number })[]

  if (rows.length === 0) return null

  const total = rows.reduce((sum, r) => sum + r.est, 0)

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="text-sm font-semibold mb-3">
        T&amp;M cost preview
      </div>

      <div className="space-y-2">
        <div className="flex gap-4 px-2 text-xs uppercase text-gray-500">
          <div className="w-56">Role</div>
          <div className="w-24">Rate</div>
          <div className="flex-1">Date range</div>
          <div className="w-28 text-right">Est. cost</div>
        </div>

        {rows.map(r => (
          <div
            key={r.id}
            className="flex gap-4 items-center border rounded bg-white px-2 py-2 text-sm"
          >
            <div className="w-56 font-medium">
              {r.role || 'Unnamed role'}
            </div>
            <div className="w-24">${r.rate}/hr</div>
            <div className="flex-1 text-slate-500">
              {r.startDate} → {r.endDate}
            </div>
            <div className="w-28 text-right">
              ~${r.est.toLocaleString()}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-2 text-sm font-semibold">
          Estimated total exposure:&nbsp;
          ~${total.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
