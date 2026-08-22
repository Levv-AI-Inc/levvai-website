'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCWRequest } from '../../context/CWRequestContext'
import { Search, X, Briefcase, MapPin, Calendar, ChevronRight } from 'lucide-react'

/* -----------------------------
    Mock JP Templates
-------------------------------- */
const JP_TEMPLATES = [
  {
    id: 'jp-da-ii',
    title: 'Data Analyst II',
    role: 'Data Analyst II',
    description: 'Support analytics initiatives by building dashboards, validating data quality, and partnering with business stakeholders.',
    country: 'United States',
    region: 'New York',
  },
  {
    id: 'jp-se-sr',
    title: 'Senior Software Engineer',
    role: 'Senior Software Engineer',
    description: 'Design and build scalable backend services. Collaborate with product and platform teams.',
    country: 'United States',
    region: 'California',
  },
]

export default function CWDefinePage() {
  const router = useRouter()
  const { request, update } = useCWRequest()
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

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Header Section */}
        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-600 mb-2">
            <span className="bg-cyan-100 px-2 py-1 rounded">Step 1 of 3</span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500">Job Definition</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Create Job Request</h1>
          <p className="text-gray-600 mt-2">Provide the core details for your contingent worker engagement.</p>
        </header>

        <div className="space-y-6">
          
          {/* Template Selection Card - Rectangular */}
          <section className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 bg-slate-50/50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <Briefcase className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Use a Template</h3>
                  <p className="text-xs text-gray-500">Start faster with pre-filled role requirements.</p>
                </div>
              </div>
              {/* Internal action button stays standard rounded-md to look like a tool */}
              <button
                onClick={() => setShowTemplatePanel(true)}
                className="text-sm font-medium bg-white border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
              >
                Browse Templates
              </button>
            </div>
            {request.role && (
              <div className="px-6 py-3 flex items-center gap-2 text-sm text-cyan-700 bg-cyan-50/50">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                Applied: <span className="font-bold">{request.role}</span>
              </div>
            )}
          </section>

          {/* Core Details Form - Rectangular Section */}
          <section className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-8">
            
            {/* Role Title - Rectangular Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                Job Title
                <span className="text-red-400">*</span>
              </label>
              <input
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500"
                value={request.role || ''}
                onChange={e => update({ role: e.target.value })}
                placeholder="e.g. Senior Data Analyst"
              />
            </div>

            {/* Description - Rectangular Textarea */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Description & Deliverables</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-500 min-h-[140px]"
                value={request.description || ''}
                onChange={e => update({ description: e.target.value })}
                placeholder="What will this person be responsible for?"
              />
            </div>

            <hr className="border-gray-100" />

            {/* Engagement Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Timeline
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Start Date</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
                      value={request.startDate || ''}
                      onChange={e => update({ startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">End Date</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
                      value={request.endDate || ''}
                      onChange={e => update({ endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Logistics
                </h4>
                <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Country</label>
                    <input
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
                      value={request.country || ''}
                      onChange={e => update({ country: e.target.value })}
                      placeholder="US"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Region</label>
                    <input
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
                      value={request.region || ''}
                      onChange={e => update({ region: e.target.value })}
                      placeholder="New York"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Positions</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-cyan-200 focus:outline-none"
                      value={request.positions || ''}
                      onChange={e => update({ positions: Number(e.target.value) })}
                      placeholder="1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Navigation - Pill Buttons */}
          <div className="flex justify-between items-center pt-8 border-t border-gray-200">
            <button 
              onClick={() => router.back()}
              className="px-10 py-3.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors border border-transparent rounded-full"
            >
              Back
            </button>
            <button
              onClick={() => router.push('/requests/new/job/create/financials')}
              className="group flex items-center justify-center gap-2 px-12 py-3.5 rounded-full bg-black text-white text-sm font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-cyan-200/50 min-w-[180px]"
            >
              Continue
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Template Slide-over Panel */}
        {showTemplatePanel && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div 
               className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" 
               onClick={() => setShowTemplatePanel(false)} 
            />
            <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Job Templates</h2>
                  <p className="text-sm text-gray-500">Select a predefined role</p>
                </div>
                <button 
                  onClick={() => setShowTemplatePanel(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  {/* Internal panel search stays rectangular rounded-md */}
                  <input
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                    placeholder="Search roles..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  {filteredTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-cyan-200 hover:bg-cyan-50/50 transition-all group"
                    >
                      <div className="font-bold text-gray-900 group-hover:text-cyan-700 transition-colors">{t.title}</div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-gray-400 uppercase tracking-tighter">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {t.region}</span>
                        <span>•</span>
                        <span>Standard Template</span>
                      </div>
                      <p className="mt-3 text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}