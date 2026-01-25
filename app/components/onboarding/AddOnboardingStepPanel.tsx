'use client'

import { useState } from 'react'

type StepOption = {
  id: string
  label: string
}

type Props = {
  open: boolean
  onClose: () => void
  existingSteps: StepOption[]
  onAddStep: (step: {
    id: string
    label: string
    owner: 'Worker' | 'Internal' | 'Supplier'
    mandatory: boolean
  }) => void
}

export default function AddOnboardingStepPanel({
  open,
  onClose,
  existingSteps,
  onAddStep,
}: Props) {
  const [selectedStepId, setSelectedStepId] = useState('')
  const [owner, setOwner] =
    useState<'Worker' | 'Internal' | 'Supplier'>('Worker')
  const [mandatory, setMandatory] = useState(true)

  if (!open) return null

  const additionalSteps: StepOption[] = [
    { id: 'drug-test', label: 'Drug Test' },
    { id: 'equipment', label: 'Equipment Provisioning' },
    { id: 'security-training', label: 'Security Training' },
  ]

  const allSteps = [
    ...existingSteps.map((s) => ({ ...s, disabled: true })),
    ...additionalSteps,
  ]

  const selectedStep = allSteps.find((s) => s.id === selectedStepId)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-black/30"
        onClick={onClose}
      />

      <div className="relative ml-auto h-full w-[420px] bg-white shadow-xl flex flex-col">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Add onboarding step
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Step */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Step
            </label>
            <select
              value={selectedStepId}
              onChange={(e) => setSelectedStepId(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select a step</option>
              {allSteps.map((step: any) => (
                <option
                  key={step.id}
                  value={step.id}
                  disabled={step.disabled}
                  className={step.disabled ? 'text-gray-400' : 'text-gray-900'}
                >
                  {step.label}
                </option>
              ))}
            </select>
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner
            </label>
            <select
              value={owner}
              onChange={(e) =>
                setOwner(e.target.value as 'Worker' | 'Internal' | 'Supplier')
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option>Worker</option>
              <option>Internal</option>
              <option>Supplier</option>
            </select>
          </div>

          {/* Mandatory */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <div>
              <label className="text-sm font-medium text-gray-700">
                Mandatory step
              </label>
              <p className="text-xs text-gray-500">
                Mandatory steps affect onboarding readiness
              </p>
            </div>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            className="rounded-md border px-4 py-2 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            disabled={!selectedStep}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:bg-gray-300"
            onClick={() => {
              if (!selectedStep) return
              onAddStep({
                id: selectedStep.id,
                label: selectedStep.label,
                owner,
                mandatory,
              })
              onClose()
              setSelectedStepId('')
            }}
          >
            Add step
          </button>
        </div>
      </div>
    </div>
  )
}
