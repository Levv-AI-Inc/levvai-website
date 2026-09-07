'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { ChangeEvent, DragEvent, useRef, useState } from 'react'
import {
  CheckCircle2,
  FileText,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { useSOW } from '../context'
import { novaImproveDescription } from '@/lib/intelligence'

const SUPPLIERS = [
  'Acme Consulting',
  'BluePeak Solutions',
  'NorthStar Advisory',
  'Quantum Services',
]

export default function DefineSOWPage() {
  const params = useSearchParams()
  const router = useRouter()
  const { sow, setSOW } = useSOW()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const workType = params.get('workType')
  const workTypeLabel = workType
    ? workType.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    : 'Not selected'

  const [name, setName] = useState(sow.name || '')
  const [supplier, setSupplier] = useState(sow.vendor || '')
  const [startDate, setStartDate] = useState(sow.startDate || '')
  const [endDate, setEndDate] = useState(sow.endDate || '')
  const [rawInput, setRawInput] = useState(sow.rawScope || '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
  }

  const handleFileDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files?.[0] || null
    if (file) {
      setSelectedFile(file)
    }
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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
      vendor: supplier,
      startDate,
      endDate,
      rawScope: rawInput,
      attachments: selectedFile
        ? [
            {
              name: selectedFile.name,
              size: selectedFile.size,
              type: selectedFile.type,
            },
          ]
        : sow.attachments,
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
            {workTypeLabel}
          </span>
        </div>

        {/* SOW Attachment */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-slate-500" />
                Statement of Work
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  Optional
                </span>
              </div>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                Upload a draft or signed SOW so Nova can pre-populate scope,
                milestones, and commercial terms.
              </p>
            </div>
          </div>

          <label
            htmlFor="sow-upload"
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={event => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDrop={handleFileDrop}
            className={`group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-7 text-center transition ${
              isDragging
                ? 'border-cyan-500 bg-cyan-50'
                : 'border-slate-300 bg-slate-50 hover:border-cyan-500 hover:bg-cyan-50'
            }`}
          >
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition group-hover:border-cyan-200 group-hover:text-cyan-700">
              <UploadCloud className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-slate-800">
              Drop a document here or browse files
            </span>
            <span className="mt-1 text-xs text-slate-500">
              PDF, DOC, or DOCX up to your browser limit
            </span>
            <input
              ref={fileInputRef}
              id="sow-upload"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          {selectedFile ? (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">
                    {selectedFile.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB selected
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedFile}
                aria-label="Remove selected SOW document"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
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
              Supplier
            </label>
            <select
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              className="text-sm w-full rounded-lg border border-slate-300 px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <option value="">Select supplier</option>
              {SUPPLIERS.map(v => (
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
            <div className="flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-slate-700">
                Describe the engagement
              </label>
              <button
                type="button"
                onClick={handleCreateWithNova}
                disabled={!rawInput.trim() || loading}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:border-slate-300 disabled:hover:bg-white"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {loading ? 'Optimizing...' : 'Optimize with Nova'}
              </button>
            </div>
            <textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              rows={5}
              className="text-sm w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="Add scope, outcomes, milestones, and any known constraints..."
            />
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
