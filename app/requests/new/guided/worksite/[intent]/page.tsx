"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import NovaFooter from "../../components/NovaFooter"
// FIXED: Added BarChart3 to the imports below
import { 
  Sparkles, 
  Building2, 
  Target, 
  ShieldAlert, 
  ShieldCheck, 
  ArrowLeft,
  AlertCircle,
  BarChart3 
} from "lucide-react"

// States where onsite external workers trigger the highest legal scrutiny
const HIGH_RISK_REGIONS = ["CA", "NY"]

export default function WorksitePage() {
  const { intent } = useParams<{ intent: string }>()
  const router = useRouter()

  const [workLocation, setWorkLocation] = useState<string | null>(null)
  const [stateCode, setStateCode] = useState<string | null>(null)
  const [worksite, setWorksite] = useState("")

  useEffect(() => {
    const location = localStorage.getItem("workLocation")
    const state = localStorage.getItem("workState")
    setWorkLocation(location)
    setStateCode(state)

    if (location === "remote") {
      router.replace(`/requests/new/guided/summary/${intent}`)
    }
  }, [intent, router])

  const isCriticalRisk = stateCode ? HIGH_RISK_REGIONS.includes(stateCode) && worksite !== "" : false;
  const canContinue = worksite.length > 0

  if (workLocation === "remote") return null

  return (
    // font-family: Inter + antialiased for that crisp SaaS look
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
              <span>Step 6: Physical Access & Logistics</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Worksite selection</h1>
          </header>

          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            {isCriticalRisk && (
              <div className="mb-8 p-5 bg-slate-900 rounded-lg shadow-xl border-l-4 border-cyan-400 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex gap-4">
                  <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-white text-sm font-bold tracking-tight uppercase">Compliance Alert: Workforce Policy</p>
                    <p className="text-cyan-100/60 text-xs leading-relaxed font-medium">
                      Engagements in <span className="text-white font-bold">{stateCode}</span> with onsite characteristics are subject to strict worker classification rules. 
                      Nova identifies a <span className="text-cyan-400 font-bold">Co-Employment Risk</span>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                   <Building2 className="w-3 h-3" /> Facility Selector
                </label>
                
                <div className="relative">
                  <select
                    value={worksite}
                    onChange={(e) => setWorksite(e.target.value)}
                    className="w-full appearance-none rounded-md border border-gray-200 bg-gray-50/30 px-5 py-4 text-base font-bold text-gray-900 focus:border-cyan-500 transition-all outline-none cursor-pointer"
                  >
                    <option value="" disabled>Select a location in {stateCode}...</option>
                    <option value="NYC_HQ">CA – HQ</option>
                    <option value="NYC_MAN">NYC – One Manhattan West</option>
                    <option value="TOR_HQ">Toronto – Bay Street Office</option>
                  </select>
                </div>
              </div>
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
                <ReadinessItem label="Policy Alignment" status="Verified" isComplete={true} />
                <ReadinessItem 
                  label="Execution Risk" 
                  status={isCriticalRisk ? "Critical" : worksite ? "Low" : "Analyzing"} 
                  isComplete={!!worksite && !isCriticalRisk} 
                  isWarning={isCriticalRisk}
                />
              </div>

              {worksite && (
                <div className="mt-10 pt-6 border-t border-gray-100 animate-in fade-in zoom-in">
                   <div className={`flex items-start gap-3 p-4 rounded-lg border ${isCriticalRisk ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                      {isCriticalRisk ? <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" /> : <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5" />}
                      <p className={`text-[11px] font-bold leading-tight ${isCriticalRisk ? 'text-amber-800' : 'text-emerald-800'}`}>
                        {isCriticalRisk 
                          ? "Nova recommends converting this request to a CW Agency model to bypass local labor risk." 
                          : "Worksite logistics finalized. Security and badge access requirements are queued."}
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
        canContinue={canContinue}
        input={worksite}
        nextPath={`/requests/new/guided/summary/${intent}`}
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
        <span className={`text-[10px] font-black uppercase tracking-tighter ${isWarning ? 'text-amber-500 animate-pulse' : isComplete ? 'text-emerald-600' : 'text-gray-300'}`}>
          {status}
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${isWarning ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : isComplete ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-200'}`} />
      </div>
    </div>
  )
}