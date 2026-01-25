"use client"

import { useState } from "react"
import NovaQuestion from "../../components/NovaQuestion"
import NovaFooter from "../../components/NovaFooter"

export default function NovaClarifyPage() {
  const [selection, setSelection] = useState("")
  const [additionalInfo, setAdditionalInfo] = useState("")

  const canContinue = selection.length > 0

  return (
    <div className="flex flex-col min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8 flex-1">
        {/* LEFT */}
        <div className="lg:w-2/3 w-full space-y-6">
          <NovaQuestion
            title="Type of support needed"
            question="Based on what you described, which best fits this work?"
            value={selection}
            onChange={setSelection}
            options={[
              {
                value: "ongoing_role",
                label: "Ongoing role",
                description:
                  "Someone performing ongoing work (e.g., contractor, technician, analyst).",
              },
              {
                value: "defined_outcome",
                label: "Defined outcome",
                description:
                  "A vendor delivering a project, milestone, or specific result.",
              },
              {
                value: "not_sure",
                label: "Not sure yet",
                description:
                  "Nova will guide this further as more details are provided.",
              },
            ]}
          />

          {/* Optional Additional Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Any additional information you’d like to share?{" "}
              <span className="text-gray-400">(optional)</span>
            </label>

            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Add any context, constraints, or clarifications…"
             className="w-full min-h-[100px] rounded-xl border border-gray-300 p-3 text-sm outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400"
            />
          </div>
        </div>

        {/* RIGHT: Decision Readiness */}
        <div className="lg:w-1/3 w-full bg-white border border-gray-200 rounded-xl p-6 h-fit">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            ✨ Decision Readiness
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            This updates as Nova gathers structured inputs.
          </p>

          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Work definition</span>
              <span className={selection ? "text-green-600" : "text-gray-400"}>
                {selection ? "Clear" : "Pending"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Policy alignment</span>
              <span className="text-gray-400">Pending</span>
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

      {/* Footer */}
      <NovaFooter
      canContinue={canContinue}
      input={selection}
      nextPath={`/requests/new/guided/next/${selection}`}
/>

    </div>
  )
}
