"use client"

import { useParams, useRouter } from "next/navigation"
import { useMemo } from "react"
import { 
  Sparkles, 
  ArrowRight, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  ListChecks, 
  FileSearch,
  Globe2,
  ChevronLeft,
  LayoutDashboard
} from "lucide-react"

export default function RecommendationPage() {
  const { intent } = useParams<{ intent: string }>()
  const router = useRouter()

  // Pulling the data captured in the guided journey
  const workLocation = typeof window !== "undefined" ? localStorage.getItem("workLocation") : null
  const country = typeof window !== "undefined" ? localStorage.getItem("workCountry") : null
  const state = typeof window !== "undefined" ? localStorage.getItem("workState") : null

  /**
   * ENHANCEMENT: Final Intelligence Triangulation
   * This is the "Decision Engine" that justifies the fulfillment path.
   */
  const {
    recommendedPath,
    complianceRisk,
    rationale,
  } = useMemo(() => {
    let path: "CW" | "SOW" | "SOURCE" = "CW"
    let risk: "none" | "elevated" = "none"
    const reasons: string[] = []

    // 1. Initial Logic based on Intent
    if (intent === "defined_outcome") {
      path = "SOW"
      reasons.push("Scope is structured around specific deliverables")
    } else if (intent === "not_sure") {
      path = "SOURCE"
      reasons.push("Requirements require strategic sourcing review")
    } else {
      reasons.push("Role requires ongoing operational support")
    }

    // 2. Misclassification & Co-employment Logic
    if (workLocation === "onsite") reasons.push("Physical integration at corporate facility detected")
    if (country === "US") reasons.push("Applying FLSA / Common Law worker tests")

    // 3. The "Permutation" Trigger
    if (
      intent === "ongoing_role" &&
      workLocation === "onsite" &&
      (state === "NY" || state === "CA")
    ) {
      risk = "elevated"
      reasons.unshift("CRITICAL: Jurisdiction triggers strict ABC classification tests")
      reasons.push("Onsite presence in high-scrutiny region requires CW Agency model")
    }

    return { recommendedPath: path, complianceRisk: risk, rationale: reasons }
  }, [intent, workLocation, country, state])

  // RESTORED: Direct links to the actual product modules
  const handleInitiate = () => {
    if (recommendedPath === "SOW") {
      router.push("/requests/new/sow")
    } else if (recommendedPath === "SOURCE") {
      router.push("/requests/new/source")
    } else {
      // Direct link back to the CW Job Creation module
      router.push("/requests/new/job/create/define")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Header: Nova Brand Identity */}
        <header className="mb-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-100 rounded-full text-[10px] font-black uppercase tracking-widest text-cyan-700">
            <Sparkles className="w-3 h-3 fill-cyan-700" />
            Nova Analysis Complete
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Intelligence Recommendation</h1>
          <p className="text-gray-600 font-medium max-w-xl mx-auto leading-relaxed">
            Your inputs have been triangulated against corporate policy, labor laws, 
            and geographic risk factors.
          </p>
        </header>

        <div className="space-y-6">
          
          {/* PRIMARY RECOMMENDATION CARD: Restored UX with high-fidelity visuals */}
          <section className="bg-slate-900 rounded-2xl p-10 shadow-2xl shadow-slate-200 border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
               <ShieldCheck className="w-32 h-32 text-cyan-400" />
            </div>
            
            <div className="relative z-10 space-y-8">
              <div>
                <p className="text-cyan-400 text-xs font-black uppercase tracking-widest mb-2">Optimal Fulfillment Path</p>
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                   <LayoutDashboard className="w-6 h-6 text-cyan-400" />
                  {recommendedPath === "CW" && "Contingent Worker (CW) Request"}
                  {recommendedPath === "SOW" && "Statement of Work (SOW) Request"}
                  {recommendedPath === "SOURCE" && "Strategic Sourcing Event"}
                </h2>
              </div>

              <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
                Nova suggests this path to ensure your engagement is compliant with 
                local {state || country} tax and labor regulations while optimizing for budget.
              </p>

              <button
                onClick={handleInitiate}
                className="group flex items-center justify-center gap-3 px-10 py-4 rounded-full bg-cyan-500 text-slate-900 font-black text-sm uppercase tracking-widest hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
              >
                Initiate {recommendedPath} Module
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </section>

          {/* POLICY GUARDRAIL: Only shows when AI detects misclassification risk */}
          {complianceRisk === "elevated" && (
            <div className="rounded-xl border-2 border-amber-100 bg-amber-50 p-6 flex items-start gap-4 animate-in zoom-in-95 duration-500">
              <div className="p-2 bg-amber-500 rounded-lg text-white shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900 uppercase tracking-tight">Policy Guardrail Active</h3>
                <p className="text-sm text-amber-800 mt-1 leading-relaxed opacity-90">
                  Onsite characteristics in <strong>{state}</strong> create elevated co-employment risk. 
                  Nova has locked this requisition to the {recommendedPath} workflow to ensure 
                  pre-onboarding compliance checks are strictly followed.
                </p>
              </div>
            </div>
          )}

          {/* RATIONALE & SNAPSHOT GRID: Full transparency for the manager */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              <h3 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-6">
                <ListChecks className="w-4 h-4 text-cyan-600" /> Nova Logic
              </h3>
              <ul className="space-y-4">
                {rationale.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-sm font-bold text-slate-700 tracking-tight">{reason}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              <h3 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-6">
                <FileSearch className="w-4 h-4 text-cyan-600" /> Data Snapshot
              </h3>
              <div className="space-y-4 text-[11px] font-bold">
                <SnapshotItem label="Stated Intent" value={intent} />
                <SnapshotItem label="Work Arrangement" value={workLocation} />
                <SnapshotItem label="Jurisdiction" value={state ? `${state}, ${country}` : country} icon={<Globe2 className="w-3 h-3"/>} />
              </div>
            </section>
          </div>

          <footer className="pt-8 flex justify-center">
             <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest">
               <ChevronLeft className="w-3 h-3" /> Go Back
             </button>
          </footer>
        </div>
      </div>
    </div>
  )
}

function SnapshotItem({ label, value, icon }: any) {
  return (
    <div className="flex justify-between items-center border-b border-gray-50 pb-2">
      <span className="text-gray-400 uppercase">{label}</span>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-slate-800 tracking-tight capitalize">{value?.replace('_', ' ') || 'N/A'}</span>
      </div>
    </div>
  )
}