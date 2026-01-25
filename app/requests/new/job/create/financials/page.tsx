'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useCWRequest } from '../../context/CWRequestContext'

function calculateBusinessDays(start?: string, end?: string) {
  if (!start || !end) return null

  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return null

  let days = 0
  const cur = new Date(s)

  while (cur <= e) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) days++
    cur.setDate(cur.getDate() + 1)
  }

  return days
}


type BillRateMode = 'fixed' | 'range'

export default function CWFinancialsPage() {
  const router = useRouter()
  const { request } = useCWRequest()
  console.log('FINANCIALS render', request)


  /* -----------------------------
     Rate Grid State (MVP)
  -------------------------------- */
  const [stMode, setStMode] = useState<BillRateMode>('fixed')
  const [stFixed, setStFixed] = useState<number>(1)
  const [stMin, setStMin] = useState<number | ''>('')
  const [stMax, setStMax] = useState<number | ''>('')

  const [otEnabled, setOtEnabled] = useState(false)
  const [otFactor, setOtFactor] = useState<number>(1.5)

  const [showCalc, setShowCalc] = useState(false)

  /* -----------------------------
     Duration (based on start/end)
     - We’ll compute "durationDays" from dates.
     - If missing, return null and calc table shows placeholders.
  -------------------------------- */
    const durationDays = 30



  /* -----------------------------
     MVP math assumptions
  -------------------------------- */
  const hoursPerDay = 8
  const positions = request.positions ?? 1

  // MVP uses Fixed only for calculations (per your instruction)
  const stBillRateForCalc =
    typeof stFixed === 'number' ? stFixed : null

  // OT rate derived from ST fixed × factor
  const otBillRateForCalc =
    otEnabled && stBillRateForCalc !== null
      ? stBillRateForCalc * otFactor
      : null

  // If OT is enabled, assume OT hours = 20% of base hours (demo assumption)
  const otHoursPct = 0.2

  const baseHours =
    durationDays !== null ? durationDays * hoursPerDay : null

  const otHours =
    otEnabled && baseHours !== null
      ? baseHours * otHoursPct
      : null

  const stLineTotal =
    showCalc &&
    baseHours !== null &&
    stBillRateForCalc !== null
      ? baseHours * stBillRateForCalc * positions
      : null

  const otLineTotal =
    showCalc &&
    otEnabled &&
    otHours !== null &&
    otBillRateForCalc !== null
      ? otHours * otBillRateForCalc * positions
      : null

  const totalValue =
    stLineTotal !== null
      ? stLineTotal + (otLineTotal ?? 0)
      : null

  /* -----------------------------
     Calculate button enabled rules
  -------------------------------- */
 const canCalculate =
  stBillRateForCalc !== null &&
  stBillRateForCalc > 0



  /* -----------------------------
     Handlers
  -------------------------------- */
  const handleCalculate = () => {
    setShowCalc(true)
  }

  const handleContinue = () => {
    // Keep your flow unchanged
    router.push('/requests/new/job/create/suppliers')
  }

  return (
    <div className="max-w-7xl mx-auto p-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Rates</h1>
        <p className="text-sm text-gray-600 mt-1">
          Enter worker bill rates and calculate estimated spend.
        </p>
      </div>

      {/* Rates grid */}
      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="font-medium text-sm text-gray-800">
            Rates
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            disabled={!canCalculate}
            className={`text-sm px-3 py-1.5 rounded-full border
              ${
                canCalculate
                  ? 'bg-black text-white border-black hover:bg-gray-900'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
          >
            Calculate
          </button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-white text-gray-600">
            <tr className="border-b">
              <th className="text-left p-3 w-[34%]">Rate Name</th>
              <th className="text-left p-3 w-[18%]">
                Rate Category / UOM
              </th>
              <th className="text-left p-3 w-[18%]">Bill Rate</th>
              <th className="text-left p-3 w-[15%]">Minimum</th>
              <th className="text-left p-3 w-[15%]">Maximum</th>
            </tr>
          </thead>

          <tbody>
            {/* ST row */}
            <tr className="border-b">
              <td className="p-3">
                <div className="font-medium">USD_ST_HR</div>
                <div className="text-xs text-gray-500">
                  Standard time
                </div>
              </td>

              <td className="p-3">ST / Hour</td>

              {/* Bill Rate column: dropdown + value */}
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <select
                    value={stMode}
                    onChange={(e) =>
                      setStMode(e.target.value as BillRateMode)
                    }
                    className="border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 px-2 py-1 text-sm bg-white"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="range">Range</option>
                  </select>

                  {stMode === 'fixed' ? (
                    <input
                      type="number"
                      placeholder="e.g. 70"
                      value={stFixed}
                      onChange={(e) =>
                        setStFixed(
                          e.target.value
                            ? Number(e.target.value)
                            : ''
                        )
                      }
                      className="w-28 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    />
                  ) : (
                    <span className="text-xs text-gray-500">
                      Enter min/max →
                    </span>
                  )}
                </div>

                {stMode === 'fixed' && (
                  <div className="text-xs text-gray-500 mt-1">

                  </div>
                )}
              </td>

              {/* Min */}
              <td className="p-3">
                <input
                  type="number"
                  placeholder="50.00"
                  value={stMin}
                  onChange={(e) =>
                    setStMin(
                      e.target.value ? Number(e.target.value) : ''
                    )
                  }
                  className="w-28 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  disabled={stMode !== 'range'}
                />
              </td>

              {/* Max */}
              <td className="p-3">
                <input
                  type="number"
                  placeholder="70.00"
                  value={stMax}
                  onChange={(e) =>
                    setStMax(
                      e.target.value ? Number(e.target.value) : ''
                    )
                  }
                  className="w-28 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  disabled={stMode !== 'range'}
                />
              </td>
            </tr>

            {/* OT question row */}
            <tr className="border-b bg-gray-50">
              <td colSpan={5} className="p-3">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-medium text-gray-800">
                    Overtime applicable?
                  </span>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={!otEnabled}
                      onChange={() => setOtEnabled(false)}
                    />
                    No
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={otEnabled}
                      onChange={() => setOtEnabled(true)}
                    />
                    Yes
                  </label>

                  {otEnabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">
                        OT factor
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        value={otFactor}
                        onChange={(e) =>
                          setOtFactor(Number(e.target.value))
                        }
                        className="w-20 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200 px-2 py-1 text-sm bg-white"
                      />
                      <span className="text-xs text-gray-500">
                        (OT = ST × factor)
                      </span>
                    </div>
                  )}
                </div>
              </td>
            </tr>

            {/* OT derived row (only when enabled) */}
            {otEnabled && (
              <tr className="border-b">
                <td className="p-3">
                  <div className="font-medium">USD_OT_HR</div>
                  <div className="text-xs text-gray-500">
                    Overtime
                  </div>
                </td>

                <td className="p-3">
                  OT / Hour <span className="text-gray-400">(derived)</span>
                </td>

                <td className="p-3">
                  <div className="text-sm text-gray-800">
                    {stBillRateForCalc !== null
                      ? `$${(stBillRateForCalc * otFactor).toFixed(2)}`
                      : '—'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Calculated from ST fixed bill rate
                  </div>
                </td>

                <td className="p-3 text-gray-400">Calculated</td>
                <td className="p-3 text-gray-400">Calculated</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Helper footer */}
        <div className="px-4 py-3 text-xs text-gray-500">
          For spend calculation, <span className="font-medium">Fixed</span> ST bill rate is used.
        </div>
      </div>

      {/* Calculation table (revealed after Calculate) */}
      {showCalc && (
        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <div className="font-medium text-sm text-gray-800">
              Spend calculation
            </div>

            <div className="text-xs text-gray-500">
            Configured as 8 hrs/day, 5 days/week {otEnabled ? `+ ${Math.round(otHoursPct * 100)}% OT` : ''}
            </div>

          </div>

          <div className="p-6 space-y-4">
            {durationDays === null && (
            <div className="text-sm bg-yellow-50 text-yellow-800 p-3 rounded-md">
                Start Date and End Date must be defined in the previous step to calculate spend.
            </div>
            )}


            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryCard label="Duration (days)" value={durationDays ?? '—'} />
              <SummaryCard label="Hours / day" value={hoursPerDay} />
              <SummaryCard label="Positions" value={positions} />
              <SummaryCard
                label="ST Bill Rate (Fixed)"
                value={
                  stBillRateForCalc !== null
                    ? `$${stBillRateForCalc.toFixed(2)}`
                    : '—'
                }
              />
            </div>

            <div className="border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-3">Line</th>
                    <th className="text-left p-3">Basis</th>
                    <th className="text-left p-3">Rate</th>
                    <th className="text-left p-3">Total</th>
                  </tr>
                </thead>

                <tbody>
                  <tr className="border-t">
                    <td className="p-3 font-medium">Standard time</td>
                    <td className="p-3">
                      {baseHours !== null
                        ? `${baseHours} hrs × ${positions}`
                        : 'Dates required'}

                    </td>
                    <td className="p-3">
                      {stBillRateForCalc !== null ? `$${stBillRateForCalc.toFixed(2)}` : '—'}
                    </td>
                    <td className="p-3 font-medium">
                      {stLineTotal !== null ? `$${stLineTotal.toLocaleString()}` : '—'}
                    </td>
                  </tr>

                  {otEnabled && (
                    <>
                      <tr className="border-t bg-white">
                        <td className="p-3 font-medium">Overtime factor</td>
                        <td className="p-3">OT = ST × factor</td>
                        <td className="p-3">{otFactor}</td>
                        <td className="p-3 text-gray-400">—</td>
                      </tr>

                      <tr className="border-t">
                        <td className="p-3 font-medium">Overtime</td>
                        <td className="p-3">
                          {otHours !== null ? `${Math.round(otHours)} hrs` : '—'} × {positions}
                        </td>
                        <td className="p-3">
                          {otBillRateForCalc !== null ? `$${otBillRateForCalc.toFixed(2)}` : '—'}
                        </td>
                        <td className="p-3 font-medium">
                          {otLineTotal !== null ? `$${otLineTotal.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>

                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td className="p-3 font-semibold" colSpan={3}>
                      Total value
                    </td>
                    <td className="p-3 font-semibold">
                      {durationDays === null
                        ? 'Define dates first'
                        : totalValue !== null
                            ? `$${totalValue.toLocaleString()}`
                            : '—'}

                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="text-xs text-gray-500">
              OT hours are configured at {Math.round(otHoursPct * 100)}% of total standard hours.
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => router.push('/requests/new/job/create/define')}
          className="px-4 py-2 text-sm border rounded-full hover:border-cyan-300 hover:bg-cyan-50"
        >
          Back
        </button>

        <button
          onClick={handleContinue}
          className="px-6 py-2.5 rounded-full text-sm text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="border rounded-xl p-4 bg-white hover:border-cyan-300">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900 mt-1">
        {value}
      </div>
    </div>
  )
}
