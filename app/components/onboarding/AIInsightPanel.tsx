'use client'

type Props = {
  title: string
  insight: string
  severity?: 'info' | 'warning' | 'risk'
}

export default function AIInsightPanel({
  title,
  insight,
  severity = 'info',
}: Props) {
  return (
    <div className="rounded-md border bg-white p-4">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="mt-2 text-sm text-gray-600">{insight}</p>

      {severity !== 'info' && (
        <span className="mt-3 inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
          {severity.toUpperCase()}
        </span>
      )}
    </div>
  )
}
