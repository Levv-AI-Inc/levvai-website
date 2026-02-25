"use client"

import { useParams } from "next/navigation"
import { useState } from "react"
import NovaQuestion from "../../components/NovaQuestion"
import NovaFooter from "../../components/NovaFooter"

export default function LocationPage() {
  const { intent } = useParams<{ intent: string }>()
  const [country, setCountry] = useState("")
  const canContinue = country.trim().length > 0

  return (
    <div className="flex flex-col min-h-full p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8 flex-1">
        <div className="lg:w-2/3 w-full space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm text-gray-500 mb-1">Nova</div>
            <h1 className="text-2xl font-semibold text-gray-900">Work location</h1>
            <p className="text-sm text-gray-600 mt-2">
              This helps determine worksite, time tracking, and compliance requirements.
            </p>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                What country will the work be performed in?
              </label>
              <select
                value={country}
                onChange={(e) => {
                const value = e.target.value
                setCountry(value)
                localStorage.setItem("workCountry", value)
              }}

                className="w-full rounded-xl border border-gray-300 p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400"              >
                <option value="">Select a country</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="UK">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>

            </div>
          </div>
        </div>

        <div className="lg:w-1/3 w-full bg-white border border-gray-200 rounded-xl p-6 h-fit">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">✨ Decision Readiness</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Work definition</span>
              <span className="text-green-600">Clear</span>
            </li>
            <li className="flex justify-between">
              <span>Policy alignment</span>
              <span className={country ? "text-cyan-600" : "text-gray-400"}>                {country ? "Analyzing" : "Analyzing"}
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
        input={country}
        nextPath={`/requests/new/guided/state/${intent}`}
      />
    </div>
  )
}
