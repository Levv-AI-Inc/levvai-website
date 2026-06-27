'use client'

import OnboardingHeader from '@/components/onboarding/OnboardingHeader'
import ReadinessScore from '@/components/onboarding/ReadinessScore'

export default function ReadyPage() {
  return (
    <div className="space-y-6">
      <OnboardingHeader />
      <ReadinessScore score={100} status="On Track" />
      <div className="rounded-md border bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">
          Ready for start
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          All required onboarding steps are complete and the worker is ready for
          day one.
        </p>
      </div>
    </div>
  )
}
