'use client'

import { useRef, type ChangeEvent } from 'react'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'

type BusinessUnitUploadRow = Record<string, unknown>

export default function AIRulesPanel({
  onBusinessUnitUpload,
  uploadingBusinessUnits = false,
  businessUnitUploadError = '',
}: {
  onBusinessUnitUpload?: (rows: BusinessUnitUploadRow[]) => Promise<void> | void
  uploadingBusinessUnits?: boolean
  businessUnitUploadError?: string
}) {
  const businessUnitInputRef = useRef<HTMLInputElement>(null)

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

  return (
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
  )
}
