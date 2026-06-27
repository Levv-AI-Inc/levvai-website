"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import NovaFooter from "../../components/NovaFooter"
import { Sparkles, Globe2, Target, ShieldAlert, ArrowLeft, BarChart3 } from "lucide-react"

export default function LocationPage() {
  const { intent } = useParams<{ intent: string }>()
  const router = useRouter()
  const [country, setCountry] = useState("")

  // ENHANCEMENT: Dynamic Legal Logic Mapping
  const getJurisdictionLogic = (code: string) => {
    const rules: Record<string, string> = {
      US: "Activating FLSA 'Economic Reality' checks and state-specific Nexus rules.",
      UK: "Activating IR35 Off-Payroll working status determinations.",
      CA: "Evaluating Federal vs. Provincial employment standards and 'Common Law' tests.",
      AU: "Monitoring 'Sham Contracting' provisions under the Fair Work Act."
    };
    return rules[code] || "Analyzing local labor laws...";
  };

  const canContinue = country.length > 0

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
              <span>Step 4: Geographic Compliance</span>
            </div>
            {/* Added tracking-tight for the professional Inter look */}
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Work location</h1>
            <p className="text-gray-600 font-medium leading-relaxed max-w-2xl">
              Specifying the primary work location allows Nova to determine local labor laws,
              tax requirements, and worksite-specific policies.
            </p>
          </header>

          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm transition-all hover:shadow-md">
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                   <Globe2 className="w-3 h-3" /> Jurisdiction Selection
                </label>

                <div className="relative">
                  <select
                    value={country}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCountry(value);
                      localStorage.setItem("workCountry", value);
                    }}
                    className="w-full appearance-none rounded-md border border-gray-200 bg-gray-50/30 px-5 py-4 text-base font-bold text-gray-900 focus:ring-4 focus:ring-cyan-50 focus:border-cyan-500 focus:bg-white transition-all outline-none cursor-pointer"
                  >
                    <option value="" disabled>Select the country of performance...</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="UK">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* ENHANCEMENT: AI Compliance Insight Box */}
              {country && (
                <div className="mt-6 p-5 bg-slate-900 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2 duration-500">
                   <div className="flex gap-4">
                     <div className="p-2 bg-cyan-500/10 rounded-lg shrink-0 h-fit">
                       <ShieldAlert className="w-5 h-5 text-cyan-400" />
                     </div>
                     <div className="space-y-1">
                       <p className="text-white text-sm font-bold tracking-tight uppercase">Nova Compliance Engine: {country}</p>
                       <p className="text-cyan-100/60 text-xs leading-relaxed font-medium">
                         {getJurisdictionLogic(country)}
                       </p>
                     </div>
                   </div>
                </div>
              )}
            </div>
          </div>
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
                <ReadinessItem
                  label="Policy Alignment"
                  status={country ? "High" : "Analyzing"}
                  isComplete={!!country}
                  isActive={!country}
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
        input={country}
        nextPath={`/requests/new/guided/state/${intent}`}
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