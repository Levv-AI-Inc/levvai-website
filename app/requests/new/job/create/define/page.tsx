'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCWRequest } from '../../context/CWRequestContext'

/* -----------------------------
   Mock JP Templates (static)
-------------------------------- */
const JP_TEMPLATES = [
  {
    id: 'jp-da-ii',
    title: 'Data Analyst II',
    role: 'Data Analyst II',
    description:
      'Support analytics initiatives by building dashboards, validating data quality, and partnering with business stakeholders.',
    country: 'US',
    region: 'New York',
  },
  {
    id: 'jp-se-sr',
    title: 'Senior Software Engineer',
    role: 'Senior Software Engineer',
    description:
      'Design and build scalable backend services. Collaborate with product and platform teams.',
    country: 'US',
    region: 'California',
  },
]

export default function CWDefinePage() {
  const router = useRouter()
  const { request, update } = useCWRequest()

  console.log('DEFINE render', request)

  const [showTemplatePanel, setShowTemplatePanel] = useState(false)
  const [search, setSearch] = useState('')

  const filteredTemplates = JP_TEMPLATES.filter(t =>
    `${t.title} ${t.role}`.toLowerCase().includes(search.toLowerCase())
  )

  const applyTemplate = (template: typeof JP_TEMPLATES[number]) => {
    update({
      role: template.role,
      description: template.description,
      country: template.country,
      region: template.region,
    })
    setShowTemplatePanel(false)
    setSearch('')
  }

  const handleContinue = () => {
    router.push('/requests/new/job/create/financials')
  }


  /* -----------------------------
     Persist duration into context
  -------------------------------- */

  return (
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Job setup</h1>
        <p className="text-sm text-gray-600 mt-1">
          Define the role and engagement details.
        </p>
      </div>

      {/* JP Template */}
      <div className="border rounded-xl p-6 space-y-3 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Job posting template</div>
          <button
            onClick={() => setShowTemplatePanel(true)}
            className="text-sm border border-gray-300 px-4 py-1.5 rounded-full hover:border-cyan-300 hover:bg-cyan-50">
            Choose template
          </button>
        </div>

        {request.role && (
          <div className="text-sm text-gray-600">
            Template applied: <strong>{request.role}</strong>
          </div>
        )}
      </div>

      {/* Core fields */}
      <div className="border rounded-xl p-6 bg-white space-y-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium">Role</label>
          <input
            className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
            value={request.role || ''}
            onChange={e => update({ role: e.target.value })}
            placeholder="e.g. Data Analyst II"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
            rows={4}
            value={request.description || ''}
            onChange={e => update({ description: e.target.value })}
            placeholder="Describe the work to be performed"
          />
        </div>

        {/* Dates + Business days */}
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium">Start date</label>
            <input
              type="date"
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.startDate || ''}
              onChange={e => update({ startDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">End date</label>
            <input
              type="date"
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.endDate || ''}
              onChange={e => update({ endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium">Positions</label>
            <input
              type="number"
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.positions || ''}
              onChange={e =>
                update({ positions: Number(e.target.value) })
              }
              placeholder="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Country</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.country || ''}
              onChange={e => update({ country: e.target.value })}
              placeholder="US"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              Region / Worksite
            </label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.region || ''}
              onChange={e => update({ region: e.target.value })}
              placeholder="New York"
            />
          </div>
        </div>
      </div>

      {/* Continue */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          className="px-6 py-2.5 rounded-full bg-black text-white text-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-400">
          Continue
        </button>
      </div>

      {/* Template slide-in */}
      {showTemplatePanel && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30"
            onClick={() => setShowTemplatePanel(false)}
          />

          <div className="w-[420px] bg-white p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <div className="font-medium">Select job template</div>
              <button
                onClick={() => setShowTemplatePanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <input
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              placeholder="Search templates or describe your need…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <div className="space-y-2">
              {filteredTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="w-full text-left border border-gray-200 rounded-xl p-3 hover:border-cyan-300 hover:bg-cyan-50">
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {t.country} · {t.region}
                  </div>
                </button>
              ))}

              {filteredTemplates.length === 0 && (
                <div className="text-sm text-gray-400">
                  No templates found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
