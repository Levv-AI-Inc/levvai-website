'use client'

import OnboardingHeader from '@/components/onboarding/OnboardingHeader'

const fields = [
  ['Worker name', 'Alex Morgan'],
  ['Supplier', 'Northstar Consulting'],
  ['Engagement', 'Implementation Analyst'],
  ['Start date', 'July 8, 2026'],
]

export default function WorkerInfoPage() {
  return (
    <div className="space-y-6">
      <OnboardingHeader />
      <div className="rounded-md border bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Worker information
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-md border bg-gray-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {label}
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
