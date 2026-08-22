"use client"

import { useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import NovaQuestion from "../../components/NovaQuestion"
import NovaFooter from "../../components/NovaFooter"
import { Sparkles, Target, ShieldAlert, ArrowLeft, MessageSquare } from "lucide-react"

export default function NovaClarifyPage() {
  const { intent } = useParams<{ intent: string }>()
  const router = useRouter()
  const [selection, setSelection] = useState(intent || "")
  const [additionalInfo, setAdditionalInfo] = useState("")

  // ENHANCEMENT: AI Behavioral Scanner
  // Detects "Control Keywords" that trigger co-employment or misclassification risk.
  const riskAnalysis = useMemo(() => {
    const riskTerms = ["supervise", "manage", "laptop", "equipment", "training", "reports to"];
    const found = riskTerms.filter(term => additionalInfo.toLowerCase().includes(term));
    return found.length > 0 ? found : null;
  }, [additionalInfo]);

  const canContinue = selection.length > 0

  return (
    <div className="flex flex-col min-h-screen p-6 bg-gray-50/50 font-sans">
      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-12 flex-1 pt-8">
        
        {/* LEFT: Main Content */}
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
              <span>Step 2: Strategy Clarification</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Refining your request</h1>
          </header>

          <NovaQuestion
            title="Type of support needed"
            question="Based on your summary, Nova suggests categorizing this work. Which fits best?"
            value={selection}
            onChange={setSelection}
            options={[
              { 
                value: "ongoing_role", 
                label: "Ongoing Role", 
                description: "Someone performing ongoing work (e.g., contractor, technician, analyst)." 
              },
              { 
                value: "defined_outcome", 
                label: "Defined Outcome", 
                description: "A vendor delivering a project, milestone, or specific result." 
              },
              { 
                value: "not_sure", 
                label: "Not sure yet", 
                description: "Nova will guide this further as more details are provided." 
              },
            ]}
          />

          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
              <MessageSquare className="w-3 h-3" /> Additional Context
            </label>
            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="e.g., This vendor will provide their own tools and manage their own project timeline..."
              className="w-full min-h-[120px] rounded-md border border-gray-200 bg-gray-50/30 p-5 text-sm font-medium outline-none focus:border-cyan-500 transition-all resize-none"
            />
          </div>
        </div>

        {/* RIGHT: Enhanced Decision Readiness Dashboard */}
        <div className="lg:w-1/3 w-full">
          <div className="sticky top-12 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6 text-xs font-black uppercase tracking-widest">
                <Target className="w-4 h-4 text-cyan-600" /> Decision Readiness
              </div>

              <div className="space-y-6">
                <ReadinessItem 
                  label="Work Definition" 
                  status={selection ? "Clear" : "Pending"} 
                  isComplete={!!selection} 
                />
                <ReadinessItem 
                  label="Policy Alignment" 
                  status={riskAnalysis ? "Review" : selection ? "High" : "Pending"} 
                  isComplete={!!selection && !riskAnalysis} 
                  isWarning={!!riskAnalysis}
                />
              </div>

              {/* AI Insight Box: Explains the Risk to the user */}
              {riskAnalysis && (
                <div className="mt-10 pt-6 border-t border-gray-100 animate-in fade-in zoom-in">
                  <div className="flex items-start gap-3 p-4 bg-slate-900 rounded-lg shadow-xl">
                    <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold text-white leading-tight">
                      Nova Alert: Language detected ({riskAnalysis.join(', ')}) implies Behavioral Control. This triggers a re-evaluation of SOW vs. CW status.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <NovaFooter
        canContinue={canContinue}
        input={selection}
        nextPath={`/requests/new/guided/next/${selection}`}
      />
    </div>
  )
}

function ReadinessItem({ label, status, isComplete, isWarning }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${isComplete || isWarning ? 'text-gray-900' : 'text-gray-400'}`}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-black uppercase tracking-tighter ${isWarning ? 'text-amber-500' : isComplete ? 'text-emerald-600' : 'text-gray-300'}`}>
          {status}
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${isWarning ? 'bg-amber-400 animate-pulse' : isComplete ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-200'}`} />
      </div>
    </div>
  )
}