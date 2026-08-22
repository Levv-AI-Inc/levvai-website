'use client'

import { useCWRequest } from '../context/CWRequestContext'
import { resolveCWRate } from '@/lib/rates/resolveCWRate'

export default function FinancialFraming() {
  const { request, update } = useCWRequest()

  const rateResult =
    request.role && request.country
      ? resolveCWRate({
          role: request.role,
          country: request.country,
          region: request.region,
        })
      : null

  const enteredRate = request.enteredRate

  const payRate = rateResult?.rate?.payRate
    const min = payRate?.min
    const max = payRate?.max


  let comparison:
    | { status: 'allowed'; message: string }
    | { status: 'exception'; message: string }
    | { status: 'blocked'; message: string }
    | null = null

  if (typeof min === 'number' && typeof max === 'number' && typeof enteredRate === 'number') {


    if (enteredRate <= max) {
      comparison = {
        status: 'allowed',
        message: `Entered rate is within the approved range ($${min}–$${max}/hr).`,
      }
    } else if (enteredRate <= max * 1.2) {
      comparison = {
        status: 'exception',
        message: `Entered rate exceeds the approved range ($${min}–$${max}/hr) and may require approval.`,
      }
    } else {
      comparison = {
        status: 'blocked',
        message: `Entered rate materially exceeds the maximum approved rate ($${max}/hr).`,
      }
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="font-semibold text-gray-900">Financial framing</h3>

      {/* Rate input */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Hourly rate
        </label>

        <input
          type="number"
          placeholder="e.g. 95"
          className="mt-1 w-40 rounded-md border px-3 py-2 text-sm"
          value={request.enteredRate ?? ''}
          onChange={(e) =>
            update({ enteredRate: Number(e.target.value) })
          }
        />
      </div>

      {/* Approved rate info */}
      {rateResult?.rate && (
        <div className="mt-4 text-sm text-gray-600">
          Approved range: ${min} – ${max} / hr
        </div>
      )}

      {/* Nova outcome */}
      {comparison && (
        <div className="mt-4 rounded-md p-3 text-sm">
          {comparison.status === 'allowed' && (
            <div className="bg-green-50 text-green-800 rounded-md p-3">
              ✅ {comparison.message}
            </div>
          )}

          {comparison.status === 'exception' && (
            <div className="bg-yellow-50 text-yellow-800 rounded-md p-3">
              ⚠️ {comparison.message}
            </div>
          )}

          {comparison.status === 'blocked' && (
            <div className="bg-red-50 text-red-800 rounded-md p-3">
              ⛔ {comparison.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
