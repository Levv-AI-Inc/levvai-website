"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import NovaFooter from "./components/NovaFooter"
import { Sparkles, Lightbulb, MessageSquare, BrainCircuit, ArrowLeft } from "lucide-react"

export default function NovaPage() {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [selectedExample, setSelectedExample] = useState("")
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false)
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  const examples = [
    "We need help migrating legacy reports to Power BI",
    "Looking for 1–2 technicians for a 6 month project",
    "Need a vendor to redesign our customer portal",
  ]

  const detectedIntent = useMemo(() => {
    const text = input.toLowerCase();
    if (text.includes("technician") || text.includes("contractor")) return "ongoing_role";
    if (text.includes("vendor") || text.includes("project") || text.includes("redesign")) return "defined_outcome";
    return "not_sure";
  }, [input]);

  const handleExampleClick = (example: string) => {
    setInput(example)
    setSelectedExample(example)
  }

  // MATCHES YOUR UPLOADED LOADING IMAGE
  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white text-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="w-12 h-12 text-slate-400 animate-pulse" />
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black italic tracking-tighter uppercase">Loading Nova</h2>
            <p className="text-[10px] font-bold tracking-[0.3em] text-slate-400 uppercase">
              Setting up workspace...
            </p>
          </div>
          <div className="w-48 bg-slate-100 h-0.5 mt-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-slate-900 w-1/3 animate-[loadingMove_1.5s_infinite_ease-in-out]" />
          </div>
        </div>
        <style jsx>{`
          @keyframes loadingMove {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 antialiased animate-in fade-in duration-700" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="max-w-5xl mx-auto w-full pt-12 space-y-8">
        
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-cyan-600 transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="w-3 h-3" /> Back
        </button>

        <header className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-600 mb-2">
            <Sparkles className="w-3.5 h-3.5 fill-cyan-600" />
            <span>Nova Intelligence Engine</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">How can I help you today?</h1>
          <p className="text-gray-600 text-lg font-medium leading-relaxed max-w-2xl">
            Describe the outcome you're looking for. Nova will handle the categorization and guide you through the process.
          </p>
        </header>

        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
               <MessageSquare className="w-3 h-3" /> Scope Summary
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe the work, goal, or problem you’re trying to solve…"
              className="w-full min-h-[180px] rounded-md border border-gray-200 bg-gray-50/30 p-5 text-base font-medium outline-none focus:ring-4 focus:ring-cyan-50 focus:border-cyan-500 focus:bg-white transition-all resize-none"
            />
          </div>

          {input.length > 20 && (
            <div className="flex items-center gap-3 p-4 bg-slate-900 rounded-lg animate-in fade-in slide-in-from-bottom-2">
              <BrainCircuit className="w-5 h-5 text-cyan-400 animate-pulse" />
              <p className="text-xs font-bold text-white tracking-tight uppercase">
                Nova Insight: Analyzing requirements for <span className="text-cyan-400 underline decoration-2">{detectedIntent.replace('_', ' ')}</span> workflow.
              </p>
            </div>
          )}

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
               <Lightbulb className="w-3 h-3 text-amber-400" /> Need inspiration?
            </div>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  className={`text-left text-xs font-bold px-5 py-2.5 rounded-full border transition-all ${
                    selectedExample === example
                      ? "bg-cyan-600 border-cyan-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-cyan-300"
                  }`}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <NovaFooter
        canContinue={input.trim().length > 0}
        input={input}
        nextPath={`/requests/new/guided/clarify/${detectedIntent}`}
      />
    </div>
  )
}