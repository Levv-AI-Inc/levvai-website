'use client'

import { useRouter } from 'next/navigation'

type Step = {
  id: string
  label: string
  status: 'Pending' | 'In Progress' | 'Complete'
  owner: 'Worker' | 'Supplier' | 'Internal'
  blocker?: string
  etaDays?: number
  href?: string // ✅ NEW
}

type StepperProps = {
  steps: Step[]
}

export default function Stepper({ steps }: StepperProps) {
  const router = useRouter()

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div
          key={step.id}
          onClick={() => step.href && router.push(step.href)} // ✅ NEW
          className={`rounded-md border p-4 cursor-pointer ${
            step.blocker
              ? 'bg-red-50 border-red-200'
              : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium">
              {index + 1}
            </div>

            <div className="flex-1">
              <p className="font-medium text-gray-900">{step.label}</p>
              <p className="text-sm text-gray-500">Owner: {step.owner}</p>

              {step.blocker && (
                <p className="mt-2 text-sm text-red-700">
                  Blocker: {step.blocker}
                </p>
              )}

              {step.etaDays !== undefined && (
                <p className="mt-1 text-xs text-gray-500">
                  Estimated resolution: {step.etaDays} day(s)
                </p>
              )}
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                step.status === 'Complete'
                  ? 'bg-green-100 text-green-700'
                  : step.status === 'In Progress'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {step.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
