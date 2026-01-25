'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="max-w-3xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">
        Create Statement of Work
      </h1>

      <p className="text-sm text-slate-500 mb-8">
        What type of work is this engagement for?
      </p>

      <div className="space-y-3">
        {SOW_WORK_TYPES.map(option => (
          <button
            key={option.id}
            onClick={() => setSelected(option.id)}
            className={`w-full text-left rounded-xl border px-5 py-4 transition
              ${
                selected === option.id
                  ? 'border-cyan-400 bg-cyan-50'
                  : 'border-slate-300 hover:border-slate-400'
              }`}
          >
            <div className="text-sm font-medium text-slate-900">
              {option.title}
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              {option.description}
            </div>
          </button>
        ))}
      </div>

      {selected === 'other' && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Describe the engagement
          </label>
          <textarea
            value={otherText}
            onChange={e => setOtherText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            rows={3}
            placeholder="Brief description of the work"
          />
        </div>
      )}

      <div className="mt-10 flex justify-end">
        <button
          disabled={!canContinue}
          onClick={handleContinue}
          className={`px-6 py-2.5 rounded-full text-sm font-medium transition
            ${
              canContinue
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-slate-300 text-white cursor-not-allowed'
            }`}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
