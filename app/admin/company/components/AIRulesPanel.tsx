'use client'

import { useRef, type ChangeEvent } from 'react'
import { Loader2, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { LevvUploadZone, levvUi } from '@/components/ui/levv-app'

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
    <>
      <input
        ref={businessUnitInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleBusinessUnitUpload}
      />
      <LevvUploadZone
        title="Mass Upload Business Units"
        description="Upload an .xlsx or .xls file with columns like code, name, parent, description, status, company, legalEntityId, and glAccountId."
        error={businessUnitUploadError || undefined}
        action={
          <button
            type="button"
            onClick={() => businessUnitInputRef.current?.click()}
            disabled={uploadingBusinessUnits}
            className={levvUi.secondaryButton}
          >
            {uploadingBusinessUnits ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Upload />
            )}
            {uploadingBusinessUnits ? 'Uploading...' : 'Select Business Unit File'}
          </button>
        }
      />
    </>
  )
}
