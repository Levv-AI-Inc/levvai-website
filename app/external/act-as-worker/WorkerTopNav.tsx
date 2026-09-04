'use client'

import { useState } from 'react'
import { Building2, CheckCircle2, ChevronDown, Clock } from 'lucide-react'
import { useWorkerClient } from './layout'

export function WorkerTopNav() {
  const { clients, activeClientId, activeClient, engagementStatuses, switchClient } = useWorkerClient()
  const [clientMenuOpen, setClientMenuOpen] = useState(false)

  return (
    <div className="bg-[#0f172a] border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-cyan-500 rounded flex items-center justify-center font-bold text-white text-[10px]">
              L
            </div>
            <span className="text-sm font-bold tracking-[0.2em] text-white">LEVV</span>
            <span className="text-[10px] font-medium text-[#d9ddd8] border border-[#52605c] rounded px-1.5 py-0.5 ml-1">
              Worker Profile
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setClientMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[#d9ddd8] hover:text-white hover:bg-white/10 border border-[#52605c]"
            >
              <Building2 className="w-3.5 h-3.5" />
              {activeClient.name}
              <ChevronDown className={`w-3 h-3 transition-transform ${clientMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {clientMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setClientMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 w-64 rounded-lg border border-[#52605c] bg-[#0f172a] shadow-xl z-50 overflow-hidden">
                  {clients.map((c) => {
                    const status = engagementStatuses[c.id]
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          switchClient(c.id)
                          setClientMenuOpen(false)
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5 ${
                          c.id === activeClientId ? 'bg-white/5' : ''
                        }`}
                      >
                        <span className="text-[#eef1ec] font-medium">{c.name}</span>
                        {status?.status === 'active' && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                        {status?.status === 'expired' && (
                          <span className="text-[10px] font-semibold text-red-400">Ended</span>
                        )}
                        {status?.status === 'not_started' && (
                          <span className="text-[10px] font-medium text-slate-500">Not started</span>
                        )}
                      </button>
                    )
                  })}
                  <div className="px-3 py-2 text-[10px] text-[#aeb8b2] border-t border-[#33413d]">
                    Only one engagement can be active at a time.
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 text-sm font-medium text-white">
            <Clock className="w-3.5 h-3.5" />
            Timesheet
          </div>
        </div>

        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
          JR
        </div>
      </div>
    </div>
  )
}
