'use client'

import { useSearchParams } from 'next/navigation'

export default function ReadOnlySOWSummary() {
  const searchParams = useSearchParams()
  const sowParam = searchParams.get('sow')

  if (!sowParam) return null

  const sow = JSON.parse(decodeURIComponent(sowParam))

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-8 py-6 shadow-sm">
      {/* SOW record link */}
      <div className="text-sm text-gray-500 mb-3">
        Statement of Work ID:{' '}
        <a
          href="#"
          className="font-medium text-slate-700 hover:text-slate-900"
          onClick={e => e.preventDefault()}
        >
          SW1249
        </a>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        Statement of Work summary
      </h2>

      <div className="space-y-5 text-sm text-gray-700">
        <Row label="SOW type" value={sow.workType} />
        <Row label="Scope description" value={sow.rawScope} />
        <Row
          label="Commercial model"
          value={sow?.commercials?.pricingModel}
        />
        <Row
          label="Term"
          value={
            sow.startDate && sow.endDate
              ? `${sow.startDate} → ${sow.endDate}`
              : undefined
          }
        />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  if (!value) return null

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-sm text-gray-800 leading-relaxed">{value}</div>
    </div>
  )
}
