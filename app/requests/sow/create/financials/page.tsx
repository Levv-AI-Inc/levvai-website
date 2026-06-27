'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSOW } from '../context'
import {
  DollarSign,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Percent,
  Calculator
} from 'lucide-react'

const COST_CENTERS = [
  { id: 'CC-1001', name: 'Technology' },
  { id: 'CC-2034', name: 'Finance Transformation' },
  { id: 'CC-3109', name: 'Enterprise Data' },
  { id: 'CC-4210', name: 'Operations Excellence' },
]

type Allocation = {
  costCenterId: string
  costCenterName: string
  mode: 'percentage' | 'amount'
  value: number
}

export default function FinancialsPage() {
  const router = useRouter()
  const { sow, setSOW } = useSOW()

  const [totalValue, setTotalValue] = useState<number | ''>(sow.financials?.totalValue || '')
  const [allocations, setAllocations] = useState<Allocation[]>(sow.financials?.allocations || [])
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  const addCostCenter = (ccId: string) => {
    const cc = COST_CENTERS.find(c => c.id === ccId)
    if (!cc || allocations.some(a => a.costCenterId === ccId)) return

    setAllocations([
      ...allocations,
      {
        costCenterId: cc.id,
        costCenterName: `${cc.id} – ${cc.name}`,
        mode: 'percentage',
        value: 0,
      },
    ])
    setShowModal(false)
    setSearch('')
  }

  const removeAllocation = (ccId: string) => {
    setAllocations(allocations.filter(a => a.costCenterId !== ccId))
  }

  const updateAllocation = (ccId: string, updates: Partial<Allocation>) => {
    setAllocations(allocations.map(a => a.costCenterId === ccId ? { ...a, ...updates } : a))
  }

  const splitEvenly = () => {
    if (allocations.length === 0) return
    const even = Math.floor(100 / allocations.length)
    setAllocations(allocations.map(a => ({ ...a, mode: 'percentage', value: even })))
  }

  const totalPercentage = allocations.reduce((sum, a) => (a.mode === 'percentage' ? sum + a.value : sum), 0)
  const filteredCostCenters = COST_CENTERS.filter(cc => `${cc.id} ${cc.name}`.toLowerCase().includes(search.toLowerCase()))

  const handleContinue = () => {
    setSOW({ financials: { totalValue: totalValue || undefined, currency: 'USD', allocations } })
    router.push('/requests/sow/create/commercials')
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
      <div className="max-w-7xl mx-auto px-10 py-12 grid grid-cols-[1fr_300px] gap-12">

        {/* LEFT: MAIN CONTENT */}
        <div className="space-y-10">
          <header className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-600">
              <span className="bg-cyan-100 px-2 py-1 rounded">SOW Setup</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-500 font-medium tracking-normal capitalize">Financials</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Budget & Allocation</h1>
            <p className="text-gray-600 font-medium">Allocate this engagement across your business units.</p>
          </header>

          {/* Total Value Input - Rectangular */}
          <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-4">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest">
              Estimated Total Value
            </label>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input
                  type="number"
                  value={totalValue}
                  onChange={e => setTotalValue(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-md border border-gray-300 pl-8 pr-12 py-3 text-lg font-bold focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">USD</span>
              </div>
            </div>
            {!totalValue && (
              <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                Required for budget verification.
              </p>
            )}
          </section>

          {/* Allocation Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest">Cost Center Allocation</h3>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 text-xs font-bold text-cyan-700 bg-cyan-50 px-4 py-2 rounded-full hover:bg-cyan-100 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Cost Center
              </button>
            </div>

            <div className="space-y-4">
              {allocations.map(a => (
                <div key={a.costCenterId} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-in fade-in duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="text-sm font-bold text-gray-900">{a.costCenterName}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Primary Allocation</div>
                    </div>
                    <button onClick={() => removeAllocation(a.costCenterId)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-end gap-10">
                    <div className="flex bg-gray-50 p-1 border border-gray-200 rounded-md">
                      <button
                        onClick={() => updateAllocation(a.costCenterId, { mode: 'percentage', value: 0 })}
                        className={`px-4 py-1.5 rounded text-[10px] font-black uppercase transition-all ${a.mode === 'percentage' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}
                      >
                        Percent
                      </button>
                      <button
                        onClick={() => updateAllocation(a.costCenterId, { mode: 'amount', value: 0 })}
                        className={`px-4 py-1.5 rounded text-[10px] font-black uppercase transition-all ${a.mode === 'amount' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400'}`}
                      >
                        Amount
                      </button>
                    </div>

                    <div className="relative flex-1 max-w-[200px]">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                        {a.mode === 'percentage' ? <Percent className="w-3 h-3"/> : '$'}
                       </span>
                       <input
                        type="number"
                        value={a.value}
                        onChange={e => updateAllocation(a.costCenterId, { value: Number(e.target.value) })}
                        className="w-full border-b-2 border-gray-200 focus:border-cyan-500 pl-8 pr-2 py-1 text-sm font-bold outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {allocations.length > 1 && (
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className={`text-xs font-bold uppercase tracking-tight flex items-center gap-2 ${totalPercentage === 100 ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {totalPercentage === 100 ? <CheckCircle2 className="w-4 h-4"/> : <Calculator className="w-4 h-4"/>}
                  Total: {totalPercentage}%
                </div>
                <button onClick={splitEvenly} className="text-[10px] font-black uppercase text-cyan-700 hover:text-cyan-800">
                  Split Evenly
                </button>
              </div>
            )}
          </section>

          <footer className="flex justify-end pt-10 border-t border-gray-200 mt-10">
            <button
              onClick={handleContinue}
              className="group flex items-center justify-center gap-2 px-12 py-3.5 rounded-full bg-black text-white text-sm font-bold hover:bg-gray-800 transition-all shadow-lg min-w-[200px]"
            >
              Continue
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </footer>
        </div>

        {/* RIGHT: PROGRESS TRACKER */}
        <aside className="sticky top-12 h-fit space-y-4 font-sans">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">SOW Progress</h3>
            <nav className="space-y-6">
              <StatusItem label="Scope Definition" status="complete" />
              <StatusItem label="Financials" status="active" />
              <StatusItem label="Commercials" status="pending" />
              <StatusItem label="Final Review" status="pending" />
            </nav>
          </div>
        </aside>
      </div>

      {/* MODAL - Standard rounded-xl */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div className="text-sm font-bold text-gray-900 tracking-tight uppercase">Add Cost Center</div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search cost centers..."
                  className="w-full rounded-md border border-gray-200 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto rounded-md border border-gray-100 divide-y divide-gray-50">
                {filteredCostCenters.map(cc => (
                  <button key={cc.id} onClick={() => addCostCenter(cc.id)} className="w-full text-left px-4 py-3 text-sm hover:bg-cyan-50 transition-colors flex flex-col">
                    <span className="font-bold text-gray-800">{cc.id}</span>
                    <span className="text-[11px] text-gray-500 font-medium">{cc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusItem({ label, status }: { label: string; status: 'complete' | 'active' | 'pending' }) {
  return (
    <div className="flex items-center gap-3">
      {status === 'complete' ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      ) : status === 'active' ? (
        <div className="w-5 h-5 rounded-full border-2 border-cyan-500 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
        </div>
      ) : (
        <Circle className="w-5 h-5 text-gray-200" />
      )}
      <span className={`text-sm font-bold tracking-tight ${status === 'active' ? 'text-gray-900' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}

function SearchIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
}