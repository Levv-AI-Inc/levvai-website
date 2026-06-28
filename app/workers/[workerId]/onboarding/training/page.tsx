'use client'

import OnboardingHeader from '@/components/onboarding/OnboardingHeader'

const training = [
  { label: 'Security awareness', status: 'Pending' },
  { label: 'Code of conduct', status: 'Pending' },
  { label: 'Data handling acknowledgement', status: 'Pending' },
]

export default function TrainingPage() {
  return (
    <div className="space-y-6">
      <OnboardingHeader />
      <div className="rounded-md border bg-white p-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Training & acknowledgements
        </h3>
        <div className="space-y-3">
          {training.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-md border bg-gray-50 px-4 py-3"
            >
              <span className="text-sm font-medium text-gray-900">
                {item.label}
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
