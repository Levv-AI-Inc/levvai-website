"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"

export default function IntentLoadingPage({ params }: { params: { intent: string } }) {
  const router = useRouter()

  const config: Record<string, string> = {
    job_posting: "/requests/new/job/create/define",
    sow: "/requests/sow/create",
    sourcing: "/requests/new/sourcing",
    guided: "/requests/new/guided",
  }

  useEffect(() => {
    const targetPath = config[params.intent]
    
    // Quick 400ms transition - just enough to feel smooth, not slow.
    const timer = setTimeout(() => {
      if (targetPath) {
        router.replace(targetPath)
      } else {
        router.push("/404")
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [params.intent, router])

  return (
    <div 
      className="min-h-screen bg-white flex flex-col items-center justify-center antialiased"
      style={{ fontFamily: '"Inter", sans-serif' }}
    >
      <div className="max-w-xs w-full space-y-6 flex flex-col items-center">
        
        {/* Subtle Icon with Soft Glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-cyan-500/10 blur-xl rounded-full" />
          <Sparkles className="w-8 h-8 text-slate-900 relative animate-pulse" />
        </div>

        {/* Minimalist Typography */}
        <div className="text-center">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase italic">
            Loading Nova
          </h2>
          <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-[0.2em]">
            Setting up workspace...
          </p>
        </div>

        {/* Precision Progress Bar */}
        <div className="w-32 h-[2px] bg-slate-100 rounded-full overflow-hidden relative">
          <div className="absolute inset-0 bg-slate-900 w-1/2 animate-[shimmer_1.5s_infinite] origin-left" 
               style={{ 
                 animation: 'loading 0.8s ease-in-out infinite' 
               }} 
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}