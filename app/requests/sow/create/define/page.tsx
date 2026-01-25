'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSOW } from '../context'
import { novaImproveDescription } from '@/lib/intelligence'
import { FileUp, Sparkles, ChevronRight, CheckCircle2, Circle } from 'lucide-react'

const VENDORS = [
  'Acme Consulting',
  'BluePeak Solutions',
  'NorthStar Advisory',
  'Quantum Services',
]

export default function DefineSOWPage() {
  const params = useSearchParams()
  const router = useRouter()
  const { sow, setSOW } = useSOW()

  const workType = params.get('workType')

  const [name, setName] = useState(sow.name || '')
  const [vendor, setVendor] = useState(sow.vendor || '')
  const [startDate, setStartDate] = useState(sow.startDate || '')
  const [endDate, setEndDate] = useState(sow.endDate || '')
  const [rawInput, setRawInput] = useState(sow.rawScope || '')
  const [loading, setLoading] = useState(false)

  const handleCreateWithNova = async () => {
    if (!rawInput.trim()) return
    try {
      setLoading(true)
      const res = await novaImproveDescription({
        sowType: workType || '',
        rawDescription: rawInput,
      })
      if (res?.ok && res.improvedDescription) {
        setRawInput(res.improvedDescription)
      }
    } catch (e) {
      console.error('Nova improve failed', e)
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    setSOW({
      workType: workType || undefined,
      name,
      vendor,
      startDate,
      endDate,
      rawScope: rawInput,
    })
    router.push('/requests/sow/create/financials')
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
              <span className="text-gray-500 font-medium tracking-normal capitalize">{workType?.replace('_', ' ')}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Define the work</h1>
            <p className="text-gray-600">Provide high-level details about the engagement.</p>
          </header>

          {/* SOW Attachment - Rectangular with soft bg */}
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 transition-all hover:border-cyan-400">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyan-50 rounded-lg">
                <FileUp className="w-6 h-6 text-cyan-600" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="text-sm font-bold text-gray-900">Upload Statement of Work (optional)</div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Uploading a draft or signed SOW allows Nova to pre-populate these fields for you.
                </p>
                <div className="pt-2">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="text-xs text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form Fields - Rectangular inputs */}
          <div className="space-y-8 bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-widest">Engagement Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Data Platform Advisory Engagement"
                  className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-widest">Select Vendor</label>
                <select
                  value={vendor}
                  onChange={e => setVendor(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm font-medium bg-white focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
                >
                  <option value="">Choose a vendor...</option>
                  {VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-widest">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-widest">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-widest">Engagement Scope</label>
                  <button
                    onClick={handleCreateWithNova}
                    disabled={!rawInput.trim() || loading}
                    className="inline-flex items-center gap-2 text-xs font-bold text-cyan-700 bg-cyan-50 px-4 py-2 rounded-full hover:bg-cyan-100 disabled:opacity-50 transition-all shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {loading ? 'Nova is thinking...' : 'Optimize with Nova AI'}
                  </button>
                </div>
                <textarea
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-gray-300 px-5 py-4 text-sm font-medium leading-relaxed focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 outline-none transition-all"
                  placeholder="Paste your raw requirements or notes here..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-100">
              <button
                onClick={handleContinue}
                className="group flex items-center gap-2 px-12 py-3.5 rounded-full bg-black text-white text-sm font-bold hover:bg-gray-800 transition-all shadow-lg min-w-[200px]"
              >
                Continue
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: PROGRESS TRACKER */}
        <aside className="sticky top-12 h-fit space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">SOW Progress</h3>
            <nav className="space-y-6">
              <StatusItem label="Scope Definition" status="active" />
              <StatusItem label="Financials" status="pending" />
              <StatusItem label="Commercials" status="pending" />
              <StatusItem label="Final Review" status="pending" />
            </nav>
          </div>
          
          <div className="p-4 bg-cyan-900 rounded-xl text-white">
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-cyan-300 shrink-0" />
              <p className="text-[11px] leading-relaxed font-medium opacity-90">
                Nova can automatically extract milestones and budget items once your scope is defined.
              </p>
            </div>
          </div>
        </aside>
      </div>
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