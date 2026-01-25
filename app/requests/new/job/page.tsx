'use client'

import WorkDefinition from './steps/WorkDefinition'
import TimeAndScope from './steps/TimeAndScope'
import FinancialFraming from './steps/FinancialFraming'
import { useCWRequest } from './context/CWRequestContext'
import { resolveCWRate } from '@/lib/rates/resolveCWRate'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateCWRequestPage() {
  const { request } = useCWRequest()
  const [justification, setJustification] = useState('')
  const router = useRouter()

  const rateResult =
    request.role && request.country
      ? resolveCWRate({
          role: request.role,
          country: request.country,
          region: request.region,
        })
      : null

  const payRate = rateResult?.rate?.payRate
  const min = payRate?.min
  const max = payRate?.max
  const enteredRate = request.enteredRate

  let outcome: 'allowed' | 'exception' | 'blocked' | null = null

  if (
    typeof min === 'number' &&
    typeof max === 'number' &&
    typeof enteredRate === 'number'
  ) {
    if (enteredRate <= max) outcome = 'allowed'
    else if (enteredRate <= max * 1.2) outcome = 'exception'
    else outcome = 'blocked'
  }

  const submitDisabled =
    outcome === 'blocked' ||
    (outcome === 'exception' && justification.trim().length === 0)

  const handleSubmit = () => {
    if (submitDisabled) return

    // MVP demo behavior — no backend yet
    console.log('CW Request submitted:', {
      ...request,
      justification,
      outcome,
    })

    router.push('/requests/new/job/submitted')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 px-2">
      <WorkDefinition />
      <TimeAndScope />
      <FinancialFraming />

      {/* Exception justification */}
      {outcome === 'exception' && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
          <label className="block text-sm font-semibold text-yellow-900">
            Justification required
          </label>
          <textarea
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
            rows={3}
            placeholder="Explain why this rate is required..."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-6">
        <button
          onClick={handleSubmit}
          disabled={submitDisabled}
          className={`rounded-lg px-6 py-2.5 text-sm font-medium text-white transition
            ${
              submitDisabled
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-black hover:bg-gray-900'
            }
          `}
        >
          Submit request
        </button>
      </div>
    </div>
  )
}
