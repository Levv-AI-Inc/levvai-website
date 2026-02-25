"use client"

import { useParams } from "next/navigation"
import { useState } from "react"
import NovaQuestion from "../../components/NovaQuestion"
import NovaFooter from "../../components/NovaFooter"

export default function NovaNextPage() {
  const { intent } = useParams<{ intent: string }>()


  const [answer, setAnswer] = useState("")

  const canContinue = answer.length > 0
  console.log("DEBUG — answer:", answer)
  console.log("DEBUG — canContinue:", canContinue)

  const nextPath =
  intent === "ongoing_role"
    ? `/requests/new/guided/location/${intent}`
    : intent === "defined_outcome"
    ? `/requests/new/guided/delivery/${intent}`
    : `/requests/new/guided/duration/${intent}`


  let questionBlock = null

  // ===== CW PATH =====
  if (intent === "ongoing_role") {
    questionBlock = (
     <NovaQuestion
      title="Type of work arrangement"
      question="Where will the work be performed?"
      value={answer}
      onChange={(val) => {
        setAnswer(val)
        localStorage.setItem("workLocation", val)
      }}
      options={[
        {
          value: "onsite",
          label: "Onsite",
          description: "Work is performed at a specific physical location.",
        },
        {
          value: "hybrid",
          label: "Hybrid",
          description: "A mix of onsite and remote work.",
        },
        {
          value: "remote",
          label: "Remote",
          description: "Work is performed remotely.",
        },
      ]}
    />

    )
  }

  // ===== SOW PATH =====
  if (intent === "defined_outcome") {
    questionBlock = (
      <NovaQuestion
        title="Let’s get a bit more specific"
        question="How will this work be delivered?"
        value={answer}
        onChange={setAnswer}
        options={[
          {
            value: "remote_delivery",
            label: "Remote delivery",
            description: "The outcome can be delivered remotely.",
          },
          {
            value: "onsite_delivery",
            label: "Onsite delivery",
            description: "Delivery requires presence at a physical location.",
          },
          {
            value: "mixed_delivery",
            label: "Mixed",
            description: "Some onsite presence is required.",
          },
        ]}
      />
    )
  }

  // ===== NOT SURE PATH =====
  if (intent === "not_sure") {
    questionBlock = (
      <NovaQuestion
        title="One more quick clarification"
        question="What best describes the expected duration of this work?"
        value={answer}
        onChange={setAnswer}
        options={[
          {
            value: "short_term",
            label: "Short-term",
            description: "A few weeks or less.",
          },
          {
            value: "medium_term",
            label: "Medium-term",
            description: "A few months.",
          },
          {
            value: "long_term",
            label: "Long-term / ongoing",
            description: "Open-ended or ongoing work.",
          },
        ]}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-full p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-8 flex-1">
        {/* LEFT */}
        <div className="lg:w-2/3 w-full">{questionBlock}</div>

        {/* RIGHT: Decision Readiness */}
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
              <span className={answer ? "text-gray-400" : "text-gray-400"}>
                {answer ? "Analyzing" : "Pending"}
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
        input={answer}
        nextPath={nextPath}
/>

    </div>
  )
}
