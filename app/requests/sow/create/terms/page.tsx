'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSOW } from '../context'

export default function SOWTermsPage() {
  const router = useRouter()
  const { sow, setSOW } = useSOW()

  const terms = sow.contractTerms || {}

  const [file, setFile] = useState<File | null>(null)

  const showRecurringFields = terms.pricingModel === 'recurring'
  const showValueWarning = !terms.totalValue

  const handleContinue = () => {
    setSOW({
      contractTerms: {
        ...terms,
        sowStatus: file ? 'uploaded' : 'not_provided',
      },
    })

    router.push('/requests/sow/create/review')
  }

  return (
    <div className="max-w-4xl mx-auto p-10 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">
          SOW document & commercial terms
        </h1>
        <p className="text-gray-600 mt-1">
          Confirm key contract details. Requirements vary by client configuration.
        </p>
      </div>

      {/* Structured Scope */}
      <div className="border rounded-lg p-6 bg-gray-50 space-y-4">
        <div className="text-sm font-medium text-gray-500">
          Structured scope (from Nova)
        </div>

        <div>
          <div className="text-sm text-gray-500">Summary</div>
          <div>{sow.structuredScope?.summary || '—'}</div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Deliverables</div>
          <ul className="list-disc ml-6">
            {sow.structuredScope?.deliverables?.map((d, i) => (
              <li key={i}>{d}</li>
            )) || <li>—</li>}
          </ul>
        </div>

        <div>
          <div className="text-sm text-gray-500">Timeline</div>
          <div>{sow.structuredScope?.timeline || '—'}</div>
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-6">
        <h2 className="font-medium text-lg">Contract & pricing metadata</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Contract Type */}
          <select
            className="border rounded-md p-2"
            value={terms.contractType || ''}
            onChange={e =>
              setSOW({
                contractTerms: { contractType: e.target.value as any },
              })
            }
          >
            <option value="">Contract type</option>
            <option value="SOW">Statement of Work</option>
            <option value="MSA">MSA</option>
            <option value="Amendment">Amendment</option>
          </select>

          {/* Pricing Model */}
          <select
            className="border rounded-md p-2"
            value={terms.pricingModel || ''}
            onChange={e =>
              setSOW({
                contractTerms: { pricingModel: e.target.value as any },
              })
            }
          >
            <option value="">Pricing model</option>
            <option value="fixed">Fixed fee</option>
            <option value="tm">Time & Materials</option>
            <option value="recurring">Recurring / Scheduled</option>
          </select>

          {/* Currency */}
          <select
            className="border rounded-md p-2"
            value={terms.currency || 'USD'}
            onChange={e =>
              setSOW({
                contractTerms: { currency: e.target.value },
              })
            }
          >
            <option value="USD">USD (ERP-sourced)</option>
          </select>

          {/* Total Value */}
          <input
            type="number"
            placeholder="Total contract value (recommended)"
            className="border rounded-md p-2"
            value={terms.totalValue || ''}
            onChange={e =>
              setSOW({
                contractTerms: { totalValue: Number(e.target.value) },
              })
            }
          />
        </div>

        {showValueWarning && (
          <div className="text-sm text-amber-600">
            ⚠️ Total contract value is typically required for approvals and budget checks.
          </div>
        )}

        {/* Recurring-only */}
        {showRecurringFields && (
          <div className="grid grid-cols-2 gap-4">
            <select
              className="border rounded-md p-2"
              value={terms.billingFrequency || ''}
              onChange={e =>
                setSOW({
                  contractTerms: {
                    billingFrequency: e.target.value as any,
                  },
                })
              }
            >
              <option value="">Billing frequency</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>

            <input
              type="number"
              placeholder="Estimated recurring amount"
              className="border rounded-md p-2"
              value={terms.recurringAmount || ''}
              onChange={e =>
                setSOW({
                  contractTerms: {
                    recurringAmount: Number(e.target.value),
                  },
                })
              }
            />
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="space-y-2">
        <label className="font-medium block">
          Statement of Work (optional)
        </label>

        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
      </div>

      {/* Continue */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-900"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
