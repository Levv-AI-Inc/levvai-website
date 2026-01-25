"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import NovaFooter from "../../components/NovaFooter"

const STATE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  US: [
    { value: "CA", label: "California" },
    { value: "NY", label: "New York" },
    { value: "TX", label: "Texas" },
  ],
  CA: [
    { value: "ON", label: "Ontario" },
    { value: "BC", label: "British Columbia" },
    { value: "QC", label: "Quebec" },
  ],
}

const REQUIRES_STATE = ["US", "CA"]

export default function StatePage() {
  const { intent } = useParams<{ intent: string }>()
  const router = useRouter()

  // TEMP: country would normally come from store/context
  // TEMP: pull from localStorage (set on location screen)
const country = typeof window !== "undefined"
  ? localStorage.getItem("workCountry")
  : null

  const [state, setState] = useState("")
  const requiresState = country ? REQUIRES_STATE.includes(country) : false
  const canContinue = !requiresState || state.length > 0

  // Auto-skip if state not required
  useEffect(() => {
  if (country && !requiresState) {
    router.replace(`/requests/new/guided/worksite/${intent}`)
  }
}, [country, requiresState, intent, router])


  if (!requiresState) return null

  return (
    <div className="flex flex-col min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8 flex-1">
        <div className="lg:w-2/3 w-full">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm text-gray-500 mb-1">Nova</div>
            <h1 className="text-2xl font-semibold text-gray-900">
              State / Province
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              This is required for worker classification and labor law compliance.
            </p>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Select state or province
              </label>

              <select
                onChange={(e) => {
                const value = e.target.value
                setState(value)
                localStorage.setItem("workState", value)
              }}
              className="w-full rounded-xl border border-gray-300 p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400"
              >
                 <option value="">Select</option>
                {STATE_OPTIONS[country || ""]?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                    {opt.label}
                    </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="lg:w-1/3 w-full bg-white border border-gray-200 rounded-xl p-6 h-fit">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            ✨ Decision Readiness
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Work definition</span>
              <span className="text-green-600">Clear</span>
            </li>
            <li className="flex justify-between">
              <span>Policy alignment</span>
              <span className={state ? "text-green-600" : "text-gray-400"}>
                {state ? "Meets" : "Analyzing"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Commercial coverage</span>
              <span className="text-gray-400">Pending</span>
            </li>
            <li className="flex justify-between">
              <span>Execution risk</span>
              <span className="text-gray-400">Pending</span>
            </li>
          </ul>
        </div>
      </div>

      <NovaFooter
        canContinue={canContinue}
        input={state}
        nextPath={`/requests/new/guided/worksite/${intent}`}
      />
    </div>
  )
}
