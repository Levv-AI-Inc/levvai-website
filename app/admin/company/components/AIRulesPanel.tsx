'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react'
import * as XLSX from 'xlsx'

type BusinessUnitUploadRow = Record<string, unknown>

type PolicyAnalysisSummary = {
  policyName?: string
  summary?: string
  counts?: {
    totalRules?: number
  }
  gaps?: Array<unknown>
  intakeImpacts?: Array<string>
  configChanges?: Array<string>
}

export default function AIRulesPanel({
  onBusinessUnitUpload,
  uploadingBusinessUnits = false,
  businessUnitUploadError = '',
}: {
  onBusinessUnitUpload?: (rows: BusinessUnitUploadRow[]) => Promise<void> | void
  uploadingBusinessUnits?: boolean
  businessUnitUploadError?: string
}) {
  const policyInputRef = useRef<HTMLInputElement>(null)
  const businessUnitInputRef = useRef<HTMLInputElement>(null)
  const [policyState, setPolicyState] = useState<
    'upload' | 'processing' | 'results' | 'error'
  >('upload')
  const [policyFileName, setPolicyFileName] = useState('')
  const [policyError, setPolicyError] = useState('')
  const [analysis, setAnalysis] = useState<PolicyAnalysisSummary | null>(null)

  const handlePolicyUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPolicyFileName(file.name)
    setPolicyError('')
    setPolicyState('processing')

    try {
      const payload = new FormData()
      payload.append('file', file)

      const response = await fetch('/api/nova/policy', {
        method: 'POST',
        body: payload,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error || 'Policy analysis failed.')
      }

      setAnalysis(data)
      setPolicyState('results')
    } catch (error) {
      setPolicyError(
        error instanceof Error
          ? error.message
          : 'Nova could not analyse the policy.',
      )
      setPolicyState('error')
    }
  }

  const handleBusinessUnitUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !onBusinessUnitUpload) return

    const reader = new FileReader()
    reader.onload = async (readerEvent) => {
      try {
        const workbook = XLSX.read(readerEvent.target?.result, {
          type: 'array',
        })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<BusinessUnitUploadRow>(sheet)
        await onBusinessUnitUpload(rows)
        if (businessUnitInputRef.current) businessUnitInputRef.current.value = ''
      } catch {
        await onBusinessUnitUpload([])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const policyBadge =
    policyState === 'results'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : policyState === 'processing'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : policyState === 'error'
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : 'bg-slate-100 text-slate-500 border-slate-200'

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
          <span className="rounded-xl bg-slate-950 p-2 text-cyan-400">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black text-slate-900">
              {policyState === 'upload'
                ? 'No policy uploaded'
                : policyState === 'processing'
                  ? `Analysing ${policyFileName || 'policy'}...`
                  : policyState === 'error'
                    ? 'Policy analysis failed'
                    : analysis?.policyName || policyFileName || 'Policy active'}
            </h2>
            <p className="text-xs font-medium text-slate-500">
              External workforce policy upload
            </p>
          </div>
          <span
            className={`ml-auto rounded-full border px-2.5 py-1 text-xs font-bold ${policyBadge}`}
          >
            {policyState === 'results'
              ? 'Active'
              : policyState === 'processing'
                ? 'Processing'
                : policyState === 'error'
                  ? 'Error'
                  : 'Not configured'}
          </span>
        </div>

        <div className="p-6">
          {policyState === 'processing' ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-medium text-amber-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Nova is reading policy clauses and configuration gaps.
            </div>
          ) : policyState === 'results' && analysis ? (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">
                    {analysis.summary || 'Policy uploaded and analysed.'}
                  </p>
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    {analysis.counts?.totalRules ?? 0} rules ·{' '}
                    {analysis.gaps?.length ?? 0} configuration gaps
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPolicyState('upload')
                  setAnalysis(null)
                  setPolicyFileName('')
                  if (policyInputRef.current) policyInputRef.current.value = ''
                }}
                className="text-xs font-bold text-slate-400 underline underline-offset-2 hover:text-slate-600"
              >
                Re-upload policy
              </button>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs font-medium text-slate-500">
                Upload your External Workforce Policy. Nova will extract
                enforceable rules, intake impacts, and configuration gaps.
              </p>
              <div
                onClick={() => policyInputRef.current?.click()}
                className="cursor-pointer rounded-2xl border border-dashed border-slate-300 p-6 text-center transition hover:border-cyan-300 hover:bg-cyan-50/40"
              >
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
                  <FileText className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-xs font-bold text-slate-900">
                  Drop your policy document here
                </p>
                <p className="mb-4 mt-1 text-xs font-medium text-slate-400">
                  Supports .pdf, .docx, .txt
                </p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    policyInputRef.current?.click()
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Select file
                </button>
              </div>
              {policyError ? (
                <p className="mt-3 text-xs font-medium text-rose-600">
                  {policyError}
                </p>
              ) : null}
            </div>
          )}

          <input
            ref={policyInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={handlePolicyUpload}
          />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center shadow-sm">
        <div className="mb-3 rounded-full bg-white p-3 shadow-sm">
          <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="text-sm font-black text-slate-900">
          Mass Upload Business Units
        </h2>
        <p className="mt-1 max-w-sm text-xs font-medium text-slate-500">
          Upload an .xlsx or .xls file with columns like code, name, parent,
          description, status, company, legalEntityId, and glAccountId.
        </p>
        <input
          ref={businessUnitInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleBusinessUnitUpload}
        />
        <button
          type="button"
          onClick={() => businessUnitInputRef.current?.click()}
          disabled={uploadingBusinessUnits}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploadingBusinessUnits ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploadingBusinessUnits ? 'Uploading...' : 'Select Business Unit File'}
        </button>
        {businessUnitUploadError ? (
          <p className="mt-2 text-xs font-medium text-rose-600">
            {businessUnitUploadError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
