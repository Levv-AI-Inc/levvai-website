"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import NovaFooter from "../../components/NovaFooter"

const IC_RISK_STATES = ["CA", "NY"] // MVP examples

export default function WorksitePage() {
  const { intent } = useParams<{ intent: string }>()
  const router = useRouter()

  // Read previously stored values
  const workLocation =
    typeof window !== "undefined"
      ? localStorage.getItem("workLocation") // onsite | hybrid | remote
      : null

  const stateCode =
    typeof window !== "undefined"
      ? localStorage.getItem("workState")
      : null

  const showICWarning = stateCode
    ? IC_RISK_STATES.includes(stateCode)
    : false

  const [worksite, setWorksite] = useState("")

  // Auto-skip worksite if fully remote
  useEffect(() => {
    if (workLocation === "remote") {
      router.replace(`/requests/new/guided/summary/${intent}`)
    }
  }, [workLocation, intent, router])

  if (workLocation === "remote") return null

  const canContinue = worksite.length > 0

  return (
    <div className="flex flex-col min-h-full p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8 flex-1">
        {/* LEFT */}
        <div className="lg:w-2/3 w-full">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm text-gray-500 mb-1">Nova</div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Worksite
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              Required for onsite access, security, and compliance.
            </p>

            {showICWarning && (
              <div className="mt-4 mb-4 rounded-xl border border-blue-200 bg-blue-100 p-4 text-sm text-cyan-900">
                <strong>Compliance signal:</strong> This request is structured as an ongoing, onsite role at a company location. Under company workforce policy, engagements with 
                these characteristics are typically managed through the Contingent Worker (CW) 
                model. Onboarding requirements not configured.
              </div>
            )}

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Select a worksite
              </label>

              <select
                value={worksite}
                onChange={(e) => setWorksite(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400"
              >
                <option value="">Select</option>
                <option value="NYC_HQ">NYC – HQ</option>
                <option value="NYC_OMHW">NYC – One Manhattan West</option>
                <option value="NYC_Q">NYC – Queens</option>
              </select>
            </div>
          </div>
        </div>

        {/* RIGHT */}
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
              <span className={worksite ? "text-green-600" : "text-gray-400"}>
                {worksite ? "Meets" : "Meets"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Commercial coverage</span>
              <span className="text-gray-400">Pending</span>
            </li>
            <li className="flex justify-between">
              <span>Execution risk</span>
              <span className="text-amber-500">Needs Attention</span>
            </li>
          </ul>
        </div>
      </div>

      <NovaFooter
        canContinue={canContinue}
        input={worksite}
        nextPath={`/requests/new/guided/summary/${intent}`}
      />
    </div>
  )
}
