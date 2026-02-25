"use client"

import { useState } from "react"
// import NovaProgress from "./components/NovaProgress"
import NovaFooter from "./components/NovaFooter"

export default function NovaPage() {
  const [input, setInput] = useState("")
  const [selectedExample, setSelectedExample] = useState("")

  const examples = [
    "We need help migrating legacy reports to Power BI",
    "Looking for 1–2 technicians for a 6 month project",
    "Need a vendor to redesign our customer portal",
  ]

  const handleExampleClick = (example: string) => {
    setInput(example)
    setSelectedExample(example)
  }

  const canContinue = input.trim().length > 0

  return (
    <div key="nova-page">
      <div className="flex flex-col min-h-full p-6">
        <div className="flex flex-1 flex-col lg:flex-row max-w-7xl mx-auto w-full gap-8">
          {/* Main Left Panel */}
          <div className="lg:w-2/3 w-full">
            <div className="mb-4">
              <div className="text-sm text-gray-500">AI-guided request creation</div>
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Nova</h1>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">              <label className="block text-1x1 font-medium text-black-900 mb-2">
                Tell us what you are trying to get done or provide a scope summary?
              </label>
              <p className="text-sm text-gray-600 mb-4">
                You don’t need to know whether this is a contractor, services, or sourcing request.
                Describe the outcome and Nova will guide you.
              </p>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the work, goal, or problem you’re trying to solve…"
                className="w-full min-h-[140px] rounded-xl border border-gray-300 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400"
              />

              {/* Examples */}
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 mb-2">Examples</div>
                <div className="flex flex-wrap gap-2">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => handleExampleClick(example)}
                      className={`text-left text-xs px-3 py-2 rounded-full border transition ${
                        selectedExample === example
                          ? "bg-cyan-600 border-cyan-600 text-white"
                          : "border-gray-200 bg-white hover:bg-cyan-50 hover:border-cyan-300"
                      }`}

                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel – Temporarily Disabled */}
          {/* <div className="lg:w-1/3 w-full">
            <NovaProgress stage="initial" />
          </div> */}
        </div>

        {/* Footer – Temporarily Disabled */}
        <NovaFooter
        canContinue={canContinue}
        input={input}
        nextPath="/requests/new/guided/clarify/not_sure"
/>

      </div>
    </div>
  )
}
