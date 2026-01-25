"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import NovaFooter from "../../components/NovaFooter"
import { Sparkles, Landmark, Target, ShieldCheck, ArrowLeft, BarChart3 } from "lucide-react"

// Dynamic regional options based on previous selection
const REGIONAL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  US: [
    { value: "CA", label: "California" },
    { value: "NY", label: "New York" },
    { value: "TX", label: "Texas" },
    { value: "WA", label: "Washington" },
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

  const [country, setCountry] = useState<string | null>(null)
  const [state, setState] = useState("")

  useEffect(() => {
    const savedCountry = localStorage.getItem("workCountry")
    setCountry(savedCountry)
    
    // Auto-skip if the country doesn't require state-level classification (e.g., UK)
    if (savedCountry && !REQUIRES_STATE.includes(savedCountry)) {
      router.replace(`/requests/new/guided/worksite/${intent}`)
    }
  }, [intent, router])

  const canContinue = state.length > 0

  if (!country || !REQUIRES_STATE.includes(country)) return null

  return (
    // Updated font-family to Inter and added font smoothing
    <div className="flex flex-col min-h-screen p-6 bg-gray-50/50 antialiased" style={{ fontFamily: '"Inter", sans-serif' }}>
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
              <span>Step 5: Regional Policy Filter</span>
            </div>
            {/* Added tracking-tight for the professional Inter look */}
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Regional Jurisdiction</h1>
            <p className="text-gray-600 font-medium leading-relaxed max-w-2xl">
              Nova is applying {country === 'US' ? 'State-level' : 'Provincial'} labor laws and 
              tax nexus rules specific to your selection.
            </p>
          </header>

          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                   <Landmark className="w-3 h-3" /> {country === 'US' ? 'State' : 'Province'}
                </label>
                
                <div className="relative">
                  <select
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value)
                      localStorage.setItem("workState", e.target.value)
                    }}
                    className="w-full appearance-none rounded-md border border-gray-200 bg-gray-50/30 px-5 py-4 text-base font-bold text-gray-900 focus:border-cyan-500 transition-all outline-none cursor-pointer"
                  >
                    <option value="" disabled>Select region...</option>
                    {REGIONAL_OPTIONS[country]?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {state && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-100 animate-in fade-in slide-in-from-left-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-[11px] font-bold text-emerald-800 leading-tight tracking-tight uppercase">
                    Nova verified: {state} specific classification filters active.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Decision Readiness */}
        <div className="lg:w-1/3 w-full">
          <div className="sticky top-12 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-8 text-xs font-black uppercase tracking-widest">
                <Target className="w-4 h-4 text-cyan-600" /> Decision Readiness
              </div>

              <div className="space-y-6">
                <ReadinessItem label="Work Definition" status="Clear" isComplete={true} />
                <ReadinessItem 
                  label="Policy Alignment" 
                  status={state ? "Verified" : "Analyzing"} 
                  isComplete={!!state} 
                  isActive={!state}
                />
                <ReadinessItem label="Execution Risk" status="Pending" isComplete={false} />
              </div>
            </div>
            
            <div className="px-4 py-3 flex items-center justify-between opacity-50">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">AI Precision: High</span>
               <BarChart3 className="w-3 h-3 text-gray-400" />
            </div>
          </div>
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

function ReadinessItem({ label, status, isComplete, isActive = false }: any) {
  return (
    <div className="flex justify-between items-center group">
      <span className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${(isComplete || isActive) ? 'text-gray-900' : 'text-gray-400'}`}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-black uppercase tracking-tighter ${isComplete ? 'text-emerald-600' : isActive ? 'text-cyan-600 animate-pulse' : 'text-gray-300'}`}>
          {status}
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : isActive ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'bg-gray-200'}`} />
      </div>
    </div>
  )
}