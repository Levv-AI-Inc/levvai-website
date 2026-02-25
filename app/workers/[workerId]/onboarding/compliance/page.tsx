'use client'

import OnboardingHeader from '@/components/onboarding/OnboardingHeader'
import ReadinessScore from '@/components/onboarding/ReadinessScore'
import ComplianceSummary from '@/components/onboarding/ComplianceSummary'

export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <OnboardingHeader />
      <ReadinessScore score={40} status="In Progress" />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ComplianceSummary />
        </div>
      </div>
    </div>
  )
}
