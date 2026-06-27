'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Briefcase, Info } from 'lucide-react'

const SOW_WORK_TYPES = [
  {
    id: 'consulting',
    title: 'Advisory / Consulting',
    description: 'Expert advice, analysis, or recommendations',
  },
  {
    id: 'managed_services',
    title: 'Managed Services',
    description: 'Ongoing operational or managed delivery',
  },
  {
    id: 'implementation',
    title: 'Implementation / Project',
    description: 'Time-bound project with defined milestones',
  },
  {
    id: 'staff_aug',
    title: 'Staff Aug (SOW-based)',
    description: 'Named or unnamed resources under an SOW',
  },
  {
    id: 'other',
    title: 'Other',
    description: 'Describe a different type of engagement',
  },
]

export default function CreateSOWPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')

  const canContinue =
    selected &&
    (selected !== 'other' || (selected === 'other' && otherText.trim().length > 0))

  const handleContinue = () => {
    if (!selected) return

    const params = new URLSearchParams({
      workType: selected,
      ...(selected === 'other' ? { description: otherText } : {}),
    })

    router.push(`/requests/sow/create/define?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header Section */}
        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-600 mb-2">
            <span className="bg-cyan-100 px-2 py-1 rounded">SOW Setup</span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500 font-medium tracking-normal capitalize">Engagement Type</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Create Statement of Work</h1>
          <p className="text-gray-600 mt-2">What type of work is this engagement for?</p>
        </header>

        <div className="space-y-6">
          {/* Work Type Selection - Rectangular Cards */}
          <div className="grid grid-cols-1 gap-3">
            {SOW_WORK_TYPES.map(option => (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`w-full text-left rounded-xl border-2 px-6 py-5 transition-all
                  ${
                    selected === option.id
                      ? 'border-cyan-500 bg-white shadow-md shadow-cyan-50'
                      : 'border-white bg-white hover:border-gray-200 shadow-sm'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-gray-900 tracking-tight">
                      {option.title}
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                      {option.description}
                    </div>
                  </div>
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${selected === option.id ? 'border-cyan-500 bg-cyan-500' : 'border-gray-200'}`}>
                    {selected === option.id && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Conditional Input - Rectangular per principles */}
          {selected === 'other' && (
            <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">
                Describe the engagement
              </label>
              <textarea
                value={otherText}
                onChange={e => setOtherText(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 transition-all outline-none"
                rows={4}
                placeholder="Brief description of the work to be performed..."
              />
            </div>
          )}

          {/* Navigation - Rounded Pill Buttons */}
          <footer className="flex justify-between items-center pt-10 border-t border-gray-200 mt-10">
            <button
              onClick={() => router.back()}
              className="px-10 py-3.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors rounded-full"
            >
              Back
            </button>
            <button
              disabled={!canContinue}
              onClick={handleContinue}
              className={`group flex items-center justify-center gap-2 px-12 py-3.5 rounded-full text-sm font-bold transition-all min-w-[180px]
                ${
                  canContinue
                    ? 'bg-black text-white hover:bg-gray-800 shadow-lg shadow-cyan-200/50'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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