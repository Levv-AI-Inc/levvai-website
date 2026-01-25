'use client'

import OnboardingHeader from '@/components/onboarding/OnboardingHeader'
import ReadinessScore from '@/components/onboarding/ReadinessScore'
import StepRow from '@/components/onboarding/StepRow'

type Step = {
  id: string
  label: string
  lane: 'HCM Integration'
  sequence: number
  status: 'Pending'
  owner: 'Internal'
}

const OFFBOARDING_STEPS: Step[] = [
  {
    id: 'deactivate-hcm',
    label: 'Deactivate HCM',
    lane: 'HCM Integration',
    sequence: 1,
    status: 'Pending',
    owner: 'Internal',
  },
]

export default function EngagementOffboardingWorkspacePage() {
  const steps = OFFBOARDING_STEPS

  /* ---------------- READINESS ---------------- */
  const readinessScore = 0
  const readinessStatus = 'Not Started'

  /* ---------------- LANE RENDER ---------------- */
  const renderLane = (lane: Step['lane']) => {
    const laneSteps = steps.filter((s) => s.lane === lane)

    return (
      <div className="flex flex-col rounded-md border bg-white p-4 space-y-3 min-w-[420px]">
        <div className="flex justify-between text-sm font-semibold">
          <span>{lane}</span>
          <span className="text-xs text-gray-500">
            0 of {laneSteps.length}
          </span>
        </div>

        <div className="space-y-2">
          {laneSteps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              sequence={step.sequence}
              showIntegrationAction={false}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="rounded-md border bg-white p-6">
        <OnboardingHeader />
      </div>

      {/* READINESS */}
      <div className="rounded-md border bg-white p-6">
        <ReadinessScore
          score={readinessScore}
          status={readinessStatus}
          label="Offboarding Progress"
        />

      </div>

      {/* OFFBOARDING FLOW */}
      <div className="rounded-md border bg-gray-50 p-4">
        <div className="flex justify-between border-b pb-3">
          <div className="text-sm font-semibold">
            Offboarding flow
          </div>
        </div>

        <div className="overflow-x-auto max-h-[520px] p-4">
          <div className="flex gap-6 min-w-[800px]">
            {renderLane('HCM Integration')}
          </div>
        </div>
      </div>
    </div>
  )
}
