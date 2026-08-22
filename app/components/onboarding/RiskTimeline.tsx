'use client'

import { Check } from 'lucide-react'

type TimelineStep = {
  id: string
  label: string
  status: 'Complete' | 'In Progress' | 'Pending'
}

export default function RiskTimeline({
  steps,
}: {
  steps: TimelineStep[]
}) {
  return (
    <div className="rounded-md border bg-white px-6 py-4">
      {/* Title */}
      <div className="mb-3 text-sm font-medium text-gray-900">
        Onboarding timeline
      </div>

      <div className="relative">

        {/* ===== LINE + DOTS ===== */}
        <div className="relative h-4">
          {/* Base line */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200" />

          {/* Step dots */}
          {steps.map((step, index) => {
            const position =
              steps.length === 1
                ? 50
                : (index / (steps.length - 1)) * 100

            const isComplete = step.status === 'Complete'
            const isInProgress = step.status === 'In Progress'

            return (
              <div
                key={step.id}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${position}%` }}
              >
                <div
                  className={[
                    'flex h-4 w-4 items-center justify-center rounded-full',
                    isComplete
                      ? 'bg-green-600 text-white'
                      : isInProgress
                      ? 'bg-amber-500'
                      : 'bg-red-600',
                    isComplete ? 'opacity-80' : 'opacity-100',
                  ].join(' ')}
                >
                  {isComplete && <Check size={10} />}
                </div>
              </div>
            )
          })}
        </div>

        {/* ===== STEP LABELS ===== */}
        <div className="relative mt-2 h-6">
          {steps.map((step, index) => {
            const position =
              steps.length === 1
                ? 50
                : (index / (steps.length - 1)) * 100

            const isFirst = index === 0
            const isLast = index === steps.length - 1

            return (
              <div
                key={step.id}
                className={[
                  'absolute text-[10px] text-gray-600 whitespace-nowrap',
                  isFirst && 'left-0 text-left',
                  isLast && 'right-0 text-right',
                  !isFirst && !isLast && '-translate-x-1/2 text-center',
                ].join(' ')}
                style={
                  !isFirst && !isLast
                    ? { left: `${position}%` }
                    : undefined
                }
              >
                {step.label}
              </div>
            )
          })}
        </div>

        {/* ===== ANCHORS ===== */}
        <div className="mt-4 flex justify-between">
          <div className="flex flex-col items-start">
            <span className="text-[10px] uppercase text-gray-500">
              Today
            </span>
            <span className="text-sm font-medium text-gray-800">
              Now
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-gray-500">
              Start date
            </span>
            <span className="text-sm font-medium text-gray-800">
              Expected start
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
