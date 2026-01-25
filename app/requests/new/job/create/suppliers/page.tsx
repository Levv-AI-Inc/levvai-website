'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useCWRequest } from '../../context/CWRequestContext'
import { Search, X, CheckCircle2, ChevronLeft, ChevronRight, Star, Users } from 'lucide-react'

/* -----------------------------
    Mock supplier universe
-------------------------------- */
const SUPPLIERS = [
  {
    id: 'SUP-001',
    name: 'Northstar Consulting',
    specialties: ['Data Analyst', 'BI'],
    regions: ['US'],
    tier: 'Preferred'
  },
  {
    id: 'SUP-002',
    name: 'Vertex IT Services',
    specialties: ['Software Engineer', 'Data Analyst'],
    regions: ['US', 'CA'],
    tier: 'Standard'
  },
  {
    id: 'SUP-003',
    name: 'Apex Workforce',
    specialties: ['Finance', 'Accounting'],
    regions: ['US'],
    tier: 'Standard'
  },
]

export default function CWSuppliersPage() {
  const router = useRouter()
  const { request, update } = useCWRequest()

  const [selected, setSelected] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const recommendedSuppliers = SUPPLIERS.filter(s =>
    request.role &&
    s.specialties.some(sp => request.role.toLowerCase().includes(sp.toLowerCase()))
  )

  const filteredSuppliers = SUPPLIERS.filter(
    s => s.name.toLowerCase().includes(search.toLowerCase()) && !selected.includes(s.id)
  )

  const toggleSupplier = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
    setSearch('')
  }

  const handleBack = () => {
    router.push('/requests/new/job/create/financials')
  }

  const handleContinue = () => {
    update({ suppliers: selected })
    router.push('/requests/new/job/create/review')
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
      <div className="max-w-5xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-600 mb-2">
            <span className="bg-cyan-100 px-2 py-1 rounded">Step 3 of 3</span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500">Suppliers</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Select Suppliers</h1>
          <p className="text-gray-600 mt-2">
            Nova has identified suppliers that best match your request.
          </p>
        </header>

        <div className="space-y-6">
          
          {/* Recommended Section - Rectangular Card */}
          <section className="border border-gray-200 rounded-xl p-6 bg-white space-y-4 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-gray-800">
              <Star className="w-4 h-4 text-cyan-600 fill-cyan-600" />
              Recommended by Nova
            </div>

            {recommendedSuppliers.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No strong matches found based on the role title.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recommendedSuppliers.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 border border-gray-100 rounded-md">
                    <span className="text-sm font-semibold text-gray-700">{s.name}</span>
                    <button 
                      onClick={() => toggleSupplier(s.id)}
                      className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
                        selected.includes(s.id) 
                        ? 'bg-cyan-600 border-cyan-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-600 hover:border-cyan-500'
                      }`}
                    >
                      {selected.includes(s.id) ? 'Selected' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Search/Selector Area - Rectangular */}
          <section ref={dropdownRef} className="border border-gray-200 rounded-xl p-6 bg-white space-y-4 relative shadow-sm">
            <label className="block font-bold text-sm text-gray-700 uppercase tracking-tight">
              Add Additional Suppliers
            </label>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onFocus={() => setOpen(true)}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-md pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500"
              />
            </div>

            {open && (
              <div className="absolute left-6 right-6 top-[100px] z-20 bg-white border border-gray-200 rounded-md shadow-xl max-h-60 overflow-y-auto">
                {filteredSuppliers.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSupplier(s.id)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-cyan-50 border-b border-gray-50 last:border-0"
                  >
                    <div className="font-bold text-gray-800">{s.name}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase">
                      Regions: {s.regions.join(', ')}
                    </div>
                  </button>
                ))}
                {filteredSuppliers.length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-400 italic">No matching suppliers</div>
                )}
              </div>
            )}

            {/* Selected Chips Area */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                {selected.map(id => {
                  const s = SUPPLIERS.find(sup => sup.id === id)
                  return (
                    <div key={id} className="flex items-center gap-2 bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-md">
                      <span>{s?.name}</span>
                      <button onClick={() => toggleSupplier(id)} className="hover:text-cyan-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Navigation - Rounded Pill Buttons */}
          <footer className="flex justify-between items-center pt-8 border-t border-gray-200">
            <button
              onClick={handleBack}
              className="px-10 py-3.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors rounded-full"
            >
              Back
            </button>
            <button
              disabled={selected.length === 0}
              onClick={handleContinue}
              className={`group flex items-center justify-center gap-2 px-12 py-3.5 rounded-full text-sm font-bold transition-all shadow-lg min-w-[180px]
                ${selected.length === 0 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                  : 'bg-black text-white hover:bg-gray-800 shadow-cyan-200/50'
                }`}
            >
              Continue
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}