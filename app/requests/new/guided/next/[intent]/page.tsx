"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import NovaQuestion from "../../components/NovaQuestion"
import NovaFooter from "../../components/NovaFooter"
import { Sparkles, Target, ShieldCheck, ArrowLeft, BarChart3 } from "lucide-react"

export default function NovaNextPage() {
  const { intent } = useParams<{ intent: string }>()
  const router = useRouter()
  const [answer, setAnswer] = useState("")

  // ENHANCEMENT: AI Execution Risk Logic
  const isElevatedRisk = answer === "onsite";

  return (
    // Updated font-family to Inter and added font smoothing
    <div className="flex flex-col min-h-screen p-6 bg-gray-50/50 antialiased" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-12 flex-1 pt-8">

        {/* LEFT: MAIN CONTENT */}
        <div className="lg:w-2/3 w-full space-y-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-cyan-600 transition-colors uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>

          <header className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-600 mb-2">
              <Sparkles className="w-3.5 h-3.5 fill-cyan-600" />
              <span>Step 3: Intelligence Layer</span>
            </div>
            {/* Added tracking-tight to match the Inter header style */}
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Work Arrangement</h1>
          </header>

          <NovaQuestion
            title="Logistics & Integration"
            question="Where will the work be performed?"
            value={answer}
            onChange={(val) => {
              setAnswer(val);
              localStorage.setItem("workLocation", val);
            }}
            options={[
              {
                value: "onsite",
                label: "Onsite",
                description: "Worker is integrated into physical team space and corporate facilities."
              },
              {
                value: "hybrid",
                label: "Hybrid",
                description: "A blend of onsite presence and remote independence."
              },
              {
                value: "remote",
                label: "Remote",
                description: "Work is performed 100% independently via external networks."
              },
            ]}
          />
        </div>

        {/* RIGHT: Decision Readiness (Scorecard) */}
        <div className="lg:w-1/3 w-full">
          <div className="sticky top-12 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-8 text-xs font-black uppercase tracking-widest">
                <Target className="w-4 h-4 text-cyan-600" /> Decision Readiness
              </div>

              <div className="space-y-6">
                <ReadinessItem label="Work Definition" status="Clear" isComplete={true} />
                <ReadinessItem label="Policy Alignment" status="High" isComplete={true} />
                <ReadinessItem
                  label="Execution Risk"
                  status={isElevatedRisk ? "Elevated" : answer ? "Low" : "Analyzing"}
                  isComplete={!!answer && !isElevatedRisk}
                  isWarning={isElevatedRisk}
                />
              </div>

              {answer && (
                <div className="mt-10 pt-6 border-t border-gray-100 animate-in fade-in zoom-in duration-300">
                   <div className="flex items-start gap-3 p-4 bg-slate-900 rounded-lg shadow-xl">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-white leading-tight">
                        {isElevatedRisk
                          ? "Nova Alert: Onsite integration increases co-employment risk scores. Activating workspace audit protocols."
                          : "Nova Insight: Remote status validated. This arrangement lowers classification risk for external workers."}
                      </p>
                   </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 flex items-center justify-between opacity-50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">AI Precision: High</span>
                <BarChart3 className="w-3 h-3 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <NovaFooter
        canContinue={!!answer}
        input={answer}
        nextPath={`/requests/new/guided/location/${intent}`}
      />
    </div>
  )
}

function ReadinessItem({ label, status, isComplete, isWarning = false }: any) {
  return (
    <div className="flex justify-between items-center group">
      <span className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${isComplete || isWarning ? 'text-gray-900' : 'text-gray-400'}`}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-black uppercase tracking-tighter ${isWarning ? 'text-amber-500' : isComplete ? 'text-emerald-600' : 'text-gray-300'}`}>
          {status}
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${isWarning ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' : isComplete ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-200'}`} />
      </div>
    </div>
  )
}