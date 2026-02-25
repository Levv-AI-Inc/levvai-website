'use client'

import type { ComponentProps } from 'react'
import OnboardingHeader from '@/components/onboarding/OnboardingHeader'
import ReadinessScore from '@/components/onboarding/ReadinessScore'
import Stepper from '@/components/onboarding/Stepper'
import BlockerBanner from '@/components/onboarding/BlockerBanner'

type Step = ComponentProps<typeof Stepper>['steps'][number]

const steps: Step[] = [
  {
    id: 'worker-info',
    label: 'Worker Information',
    status: 'Complete',
    owner: 'Supplier',
    href: '/workers/123/onboarding/worker-info',
  },
  {
    id: 'compliance',
    label: 'Compliance & Classification',
    status: 'In Progress',
    owner: 'Internal',
    href: '/workers/123/onboarding/compliance',
  },
  {
    id: 'screening',
    label: 'Background Screening',
    status: 'Pending',
    owner: 'Worker',
    blocker: 'Consent form not submitted',
    etaDays: 1,
    href: '/workers/123/onboarding/screening',
  },
  {
    id: 'training',
    label: 'Training & Acknowledgements',
    status: 'Pending',
    owner: 'Worker',
    href: '/workers/123/onboarding/training',
  },
  {
    id: 'access',
    label: 'System & Site Access',
    status: 'Pending',
    owner: 'Internal',
    href: '/workers/123/onboarding/access',
  },
]

const blockers = steps
  .filter((s) => s.blocker)
  .map((s) => ({
    label: s.label,
    reason: s.blocker!,
    etaDays: s.etaDays,
  }))

  const totalSteps = steps.length
const completedSteps = steps.filter((s) => s.status === 'Complete').length
const hasBlockers = blockers.length > 0

let readinessScore = Math.round((completedSteps / totalSteps) * 100)
let readinessStatus: 'On Track' | 'At Risk' | 'Blocked' = 'On Track'

if (hasBlockers) {
  readinessScore = Math.min(readinessScore, 50)
  readinessStatus = 'Blocked'
} else if (readinessScore < 80) {
  readinessStatus = 'At Risk'
}


export default function OnboardingPathPage() {
  return (
    <div className="space-y-6">
      <OnboardingHeader />
        <ReadinessScore
        score={readinessScore}
        status={readinessStatus}
        />


     <BlockerBanner blockers={blockers} />

        <div className="rounded-md border bg-white p-6">

        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Onboarding Path
        </h3>

        <Stepper steps={steps} />
      </div>
    </div>
  )
}
