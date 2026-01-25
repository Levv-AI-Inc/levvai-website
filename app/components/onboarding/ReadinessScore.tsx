'use client'

type ReadinessScoreProps = {
  score: number
  status: 'Not Started' | 'In Progress' | 'Complete'
  label?: string
}

export default function ReadinessScore({
  score,
  status,
  label = 'Onboarding Progress',
}: ReadinessScoreProps) {
  const statusStyles = {
    'Not Started': 'bg-gray-100 text-gray-600',
    'In Progress': 'bg-yellow-100 text-yellow-700',
    Complete: 'bg-green-100 text-green-700',
  }

  return (
    <div className="rounded-md border bg-white p-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">
          {score}%
        </p>
      </div>

      <span
        className={`rounded-full px-3 py-1 text-sm font-medium ${
          statusStyles[status]
        }`}
      >
        {status}
      </span>
    </div>
  )
}
