'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSOW } from '../context'
import { novaImproveDescription } from '@/lib/intelligence'

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
    <div className="max-w-7xl mx-auto px-10 py-8 grid grid-cols-[1fr_280px] gap-12">
      {/* LEFT: MAIN CONTENT */}
      <div className="space-y-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Define the work
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Provide high-level details about the engagement.
          </p>
        </div>

        <div className="text-sm text-slate-500">
          SOW type:{' '}
          <span className="font-medium text-slate-700">
            {workType}
          </span>
        </div>

        {/* SOW Attachment */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-2">
          <div className="text-sm font-medium text-slate-900">
            Statement of Work (optional)
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Uploading a draft or signed SOW allows Nova to
            help pre-populate fields.
          </p>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            className="text-sm text-slate-600"
          />
        </div>

        {/* Fields */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Data Platform Advisory Engagement"
              className="text-sm w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Vendor
            </label>
            <select
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              className="text-sm w-full rounded-lg border border-slate-300 px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <option value="">Select vendor</option>
              {VENDORS.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start date*
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-sm w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                End date*
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-sm w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Describe the engagement
            </label>
            <textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              rows={5}
              className="text-sm w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="Add points and click 'Create with Nova' to create..."
            />

            <button
              onClick={handleCreateWithNova}
              disabled={!rawInput.trim() || loading}
              className="inline-flex items-center gap-2 text-sm text-slate-700 border border-slate-300 px-4 py-2 rounded-full hover:bg-slate-50 disabled:text-slate-400 transition"
            >
              ✨ {loading ? 'Enhancing…' : 'Create with Nova'}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            className="px-6 py-2.5 rounded-full text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Continue
          </button>
        </div>
      </div>

      {/* RIGHT: STATUS BOX */}
      <div className="sticky top-10 h-fit rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="text-sm font-medium text-slate-900">
          SOW progress
        </div>

        <StatusItem label="Description" status="active" />
        <StatusItem label="Financials" status="pending" />
        <StatusItem label="Commercials" status="pending" />
        <StatusItem label="Review" status="pending" />
      </div>
    </div>
  )
}

function StatusItem({
  label,
  status,
}: {
  label: string
  status: 'complete' | 'active' | 'pending'
}) {
  const color =
    status === 'complete'
      ? 'bg-emerald-500'
      : status === 'active'
      ? 'bg-amber-400'
      : 'bg-slate-300'

  return (
    <div className="flex items-center gap-3 text-sm text-slate-700">
      <span
        className={`w-2.5 h-2.5 rounded-full ${color}`}
      />
      <span>{label}</span>
    </div>
  )
}
