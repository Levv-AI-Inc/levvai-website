"use client"

import { useParams, useRouter } from "next/navigation"
import { useMemo } from "react"

export default function RecommendationPage() {
  const { intent } = useParams<{ intent: string }>()
  const router = useRouter()

  // Read collected inputs (MVP: localStorage)
  const workLocation =
    typeof window !== "undefined"
      ? localStorage.getItem("workLocation")
      : null

  const country =
    typeof window !== "undefined"
      ? localStorage.getItem("workCountry")
      : null

  const state =
    typeof window !== "undefined"
      ? localStorage.getItem("workState")
      : null

  /**
   * ============================
   * Recommendation Logic (MVP)
   * ============================
   */

  const {
    recommendedPath,
    complianceRisk,
    rationale,
  } = useMemo(() => {
    let path: "CW" | "SOW" | "SOURCE" = "CW"
    let risk: "none" | "elevated" = "none"
    const reasons: string[] = []

    // Base interpretation
    if (intent === "defined_outcome") {
      path = "SOW"
      reasons.push("Work is structured around a defined outcome")
    }

    if (intent === "not_sure") {
      path = "SOURCE"
      reasons.push("Insufficient clarity to confidently classify work type")
    }

    // Ongoing role signals
    if (intent === "ongoing_role") {
      reasons.push("Work is structured as an ongoing role")
    }

    if (workLocation === "onsite") {
      reasons.push("Work requires onsite presence")
    }

    if (country === "US") {
      reasons.push("Work performed in the United States")
    }

    // 🔒 Compliance signal — DOES NOT override CW recommendation
    if (
      intent === "ongoing_role" &&
      workLocation === "onsite" &&
      country === "US" &&
      (state === "NY" || state === "CA")
    ) {
      risk = "elevated"
      reasons.unshift(
        "Ongoing onsite work in this jurisdiction creates elevated worker misclassification risk"
      )
      reasons.push(
        "Jurisdiction has heightened independent contractor enforcement"
      )
    }

    return {
      recommendedPath: path,
      complianceRisk: risk,
      rationale: reasons,
    }
  }, [intent, workLocation, country, state])

  /**
   * ============================
   * Navigation
   * ============================
   */
  const handleInitiate = () => {
    if (recommendedPath === "SOW") {
      router.push("/requests/sow/create")
    } else if (recommendedPath === "SOURCE") {
      router.push("/requests/new/source")
    } else {
      router.push("/requests/new/job")
    }
  }

  return (
    <div className="flex flex-col min-h-full p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto w-full">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-sm text-gray-500 mb-1">Nova</div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Recommendation
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Based on the information provided, here’s how Nova recommends proceeding.
          </p>

          {/* Recommended Path */}
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center justify-between">            <div>
              <p className="text-sm text-gray-600 mb-1">Recommended path</p>
              <p className="text-lg font-semibold text-gray-900">
                {recommendedPath === "CW" && "Create a Contingent Worker (CW) request"}
                {recommendedPath === "SOW" && "Create a Statement of Work (SOW) request"}
                {recommendedPath === "SOURCE" && "Initiate a sourcing request"}
              </p>
            </div>

            <button
              onClick={handleInitiate}
              className="ml-4 rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-900"
            >

              Initiate {recommendedPath}
            </button>
          </div>

          {/* Compliance Signal */}
          {complianceRisk === "elevated" && (
            <div className="mt-4 rounded-lg border border-blue-300 bg-blue-100 p-4 text-sm text-amber-900">
              <strong>Compliance signal:</strong> This request is structured as an ongoing, onsite role 
              at a company location. Under company workforce policy, engagements with these 
              characteristics are typically aligned to a Contingent Worker (CW) model. 
              Outcome-based, time-bound services are generally managed through a Statement of Work.
            </div>
          )}

          {/* Rationale */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Why Nova is recommending this
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
              {rationale.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>

          {/* Snapshot */}
          <div className="mt-6 border-t border-gray-200 pt-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Work type</span>
              <span className="font-medium">{intent}</span>
            </div>
            {workLocation && (
              <div className="flex justify-between">
                <span className="text-gray-600">Work location</span>
                <span className="font-medium">{workLocation}</span>
              </div>
            )}
            {country && (
              <div className="flex justify-between">
                <span className="text-gray-600">Country</span>
                <span className="font-medium">{country}</span>
              </div>
            )}
            {state && (
              <div className="flex justify-between">
                <span className="text-gray-600">State / Province</span>
                <span className="font-medium">{state}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
