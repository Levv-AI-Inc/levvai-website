'use client'

type Blocker = {
  label: string
  reason: string
  etaDays?: number
}

type BlockerBannerProps = {
  blockers: Blocker[]
}

export default function BlockerBanner({ blockers }: BlockerBannerProps) {
  if (blockers.length === 0) return null

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">
        Onboarding is blocked
      </p>

      <ul className="mt-2 space-y-1 text-sm text-red-700">
        {blockers.map((b, idx) => (
          <li key={idx}>
            <strong>{b.label}:</strong> {b.reason}
            {b.etaDays !== undefined && (
              <span className="ml-1 text-xs text-red-600">
                (ETA {b.etaDays} day{b.etaDays > 1 ? 's' : ''})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
