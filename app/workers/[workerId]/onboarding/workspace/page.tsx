'use client'

import type { ComponentProps } from 'react'
import OnboardingHeader from '@/components/onboarding/OnboardingHeader'
import ReadinessScore from '@/components/onboarding/ReadinessScore'
import BlockerBanner from '@/components/onboarding/BlockerBanner'
import Stepper from '@/components/onboarding/Stepper'
import ActionPanel from '@/components/onboarding/ActionPanel'

/**
 * 🔒 TEMP (MVP)
 * Change this to 'Worker' or 'Supplier' to see different views
 */
const viewerRole: 'Internal' | 'Worker' | 'Supplier' = 'Internal'

type Step = ComponentProps<typeof Stepper>['steps'][number]

const steps: Step[] = [
  {
    id: 'worker-info',
    label: 'Worker Information',
    status: 'Complete',
    owner: 'Supplier',
  },
  {
    id: 'compliance',
    label: 'Compliance & Classification',
    status: 'In Progress',
    owner: 'Internal',
  },
  {
    id: 'screening',
    label: 'Background Screening',
    status: 'Pending',
    owner: 'Worker',
    blocker: 'Consent form not submitted',
    etaDays: 1,
  },
  {
    id: 'training',
    label: 'Training & Acknowledgements',
    status: 'Pending',
    owner: 'Worker',
  },
  {
    id: 'access',
    label: 'System & Site Access',
    status: 'Pending',
    owner: 'Internal',
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

export default function WorkspacePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <OnboardingHeader />

      {/* Readiness */}
      <ReadinessScore score={readinessScore} status={readinessStatus} />

      {/* Global blockers */}
      <BlockerBanner blockers={blockers} />

      {/* ACTIONS — ROLE AWARE */}
      {viewerRole === 'Internal' && (
        <ActionPanel
          title="What needs attention"
          actions={[
            {
              label: 'Send consent reminder',
              description:
                'The worker has not submitted consent required for background screening.',
              intent: 'primary',
            },
            {
              label: 'Escalate to supplier',
              description:
                'Notify the supplier that screening is delaying start.',
              intent: 'secondary',
            },
          ]}
        />
      )}

      {viewerRole === 'Worker' && (
        <ActionPanel
          title="Action required"
          actions={[
            {
              label: 'Submit screening consent',
              description:
                'Consent is required to proceed with background screening.',
              intent: 'primary',
            },
          ]}
        />
      )}

      {viewerRole === 'Supplier' && (
        <ActionPanel
          title="Supplier action required"
          actions={[
            {
              label: 'Follow up with worker',
              description:
                'Worker has not completed screening consent.',
              intent: 'primary',
            },
          ]}
        />
      )}

      {/* Progress */}
      <div className="rounded-md border bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Onboarding progress
        </h3>
        <Stepper steps={steps} />
      </div>

      {/* Activity */}
      <div className="rounded-md border bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          Activity
        </h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>Worker selected – Mar 1</li>
          <li>Onboarding path generated – Mar 1</li>
          <li>Compliance review started – Mar 2</li>
        </ul>
      </div>
    </div>
  )
}
