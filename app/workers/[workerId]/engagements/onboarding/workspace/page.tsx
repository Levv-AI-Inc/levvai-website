'use client'

import { useState } from 'react'
import OnboardingHeader from '@/components/onboarding/OnboardingHeader'
import ReadinessScore from '@/components/onboarding/ReadinessScore'
import StepRow from '@/components/onboarding/StepRow'
import AddOnboardingStepPanel from '@/components/onboarding/AddOnboardingStepPanel'

type Step = {
  id: string
  label: string
  lane: 'Identity' | 'Compliance' | 'Worker Setup' | 'HCM Integration'
  sequence: number
  status: 'Complete' | 'In Progress' | 'Pending'
  owner: 'Worker' | 'Internal' | 'Supplier'
  integrationStatus?: 'Failed' | 'Synced'
}

const INITIAL_STEPS: Step[] = [
  {
    id: 'id',
    label: 'ID Verification',
    lane: 'Identity',
    sequence: 1,
    status: 'Complete',
    owner: 'Worker',
  },

  {
    id: 'bg',
    label: 'Background Checks',
    lane: 'Compliance',
    sequence: 2,
    status: 'In Progress',
    owner: 'Internal',
  },

  {
    id: 'hcm1',
    label: 'Create worker record in HCM',
    lane: 'HCM Integration',
    sequence: 2,
    status: 'In Progress',
    owner: 'Internal',
    integrationStatus: 'Failed',
  },
  {
    id: 'hcm2',
    label: 'Sync HR / Payroll identifiers',
    lane: 'HCM Integration',
    sequence: 2,
    status: 'In Progress',
    owner: 'Internal',
    integrationStatus: 'Failed',
  },

  {
    id: 'loc',
    label: 'Location',
    lane: 'Worker Setup',
    sequence: 3,
    status: 'Pending',
    owner: 'Worker',
  },

  {
    id: 'bank',
    label: 'Bank Account',
    lane: 'Worker Setup',
    sequence: 4,
    status: 'Pending',
    owner: 'Worker',
  },
  {
    id: 'cert',
    label: 'Certifications',
    lane: 'Worker Setup',
    sequence: 4,
    status: 'Pending',
    owner: 'Worker',
  },
]

export default function EngagementOnboardingWorkspacePage() {
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS)
  const [panelOpen, setPanelOpen] = useState(false)

  /* ---------------- READINESS ---------------- */

  const completed = steps.filter((s) => s.status === 'Complete').length
  const readinessScore = Math.round((completed / steps.length) * 100)

  /* ---------------- LANE RENDER ---------------- */

  const renderLane = (lane: Step['lane']) => {
    const laneSteps = steps
      .filter((s) => s.lane === lane)
      .sort((a, b) => a.sequence - b.sequence)

    if (!laneSteps.length) return null

    const done = laneSteps.filter(
      (s) => s.status === 'Complete'
    ).length

    return (
      <div className="flex flex-col rounded-md border bg-white p-4 space-y-3 min-w-[420px]">
        <div className="flex justify-between text-sm font-semibold">
          <span>{lane}</span>
          <span className="text-xs text-gray-500">
            {done} of {laneSteps.length}
          </span>
        </div>

        <div className="space-y-2">
          {laneSteps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              sequence={step.sequence}
              showIntegrationAction={lane === 'HCM Integration'}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-5">
        {/* HEADER */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <OnboardingHeader />
        </div>

        {/* READINESS */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <ReadinessScore score={readinessScore} status="In Progress" />
        </div>

        {/* ONBOARDING FLOW */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex justify-between border-b pb-3">
            <div className="text-sm font-semibold">Onboarding flow</div>
            <button
               className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-900"
              onClick={() => setPanelOpen(true)}
            >
              Add Onboarding Step
            </button>
          </div>

          {/* SCROLLABLE FLOW AREA */}
          <div className="overflow-x-auto max-h-[520px] p-4">
            <div className="flex gap-6 min-w-[1400px]">
              {renderLane('Identity')}
              {renderLane('Compliance')}
              {renderLane('Worker Setup')}
            </div>

            <div className="flex gap-6 min-w-[1400px] mt-6">
              <div className="min-w-[420px]" />
              {renderLane('HCM Integration')}
              <div className="min-w-[420px]" />
            </div>
          </div>
        </div>
      </div>

      {/* ADD STEP PANEL */}
      <AddOnboardingStepPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        existingSteps={steps.map((s) => ({
          id: s.id,
          label: s.label,
        }))}
        onAddStep={(step) =>
          setSteps((prev) => [
            ...prev,
            {
              id: step.id,
              label: step.label,
              lane: 'Worker Setup',
              sequence: 99,
              status: 'Pending',
              owner: 'Worker',
            },
          ])
        }
      />
    </>
  )
}
