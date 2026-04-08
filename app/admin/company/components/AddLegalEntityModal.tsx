'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { COUNTRY_OPTIONS } from '@/lib/constants/countries'

export type AddLegalEntityFormValues = {
  id: string
  name: string
  country: string
  currency: string
  taxId: string
  erpCode: string
  status: string
  billingLine1: string
  billingLine2: string
  billingCity: string
  billingStateProvince: string
  billingPostalCode: string
  billingCountry: string
}

const EMPTY_FORM: AddLegalEntityFormValues = {
  id: '',
  name: '',
  country: '',
  currency: '',
  taxId: '',
  erpCode: '',
  status: 'active',
  billingLine1: '',
  billingLine2: '',
  billingCity: '',
  billingStateProvince: '',
  billingPostalCode: '',
  billingCountry: '',
}

export default function AddLegalEntityModal({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  isSubmitting: boolean
  error: string
  onClose: () => void
  onSubmit: (values: AddLegalEntityFormValues) => Promise<void>
}) {
  const [form, setForm] = useState<AddLegalEntityFormValues>(EMPTY_FORM)

  useEffect(() => {
    if (!isOpen) return
    setForm(EMPTY_FORM)
  }, [isOpen])

  if (!isOpen) return null

  const isCreateDisabled =
    isSubmitting ||
    !form.id.trim() ||
    !form.name.trim() ||
    !form.country.trim() ||
    !form.currency.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Add legal entity</h3>
            <p className="mt-1 text-sm text-gray-600">
              Create a legal entity for this tenant.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close add legal entity modal"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Legal Entity ID <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.id}
              onChange={(event) =>
                setForm((current) => ({ ...current, id: event.target.value }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="LE-001"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Name <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Acme Canada Ltd"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Country <span className="text-rose-600">*</span>
            </label>
            <select
              value={form.country}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  country: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select country
              </option>
              {COUNTRY_OPTIONS.map((countryOption) => (
                <option key={countryOption.value} value={countryOption.value}>
                  {countryOption.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Currency <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.currency}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  currency: event.target.value.toUpperCase(),
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm uppercase"
              placeholder="CAD"
              maxLength={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Tax ID (Optional)
            </label>
            <input
              value={form.taxId}
              onChange={(event) =>
                setForm((current) => ({ ...current, taxId: event.target.value }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="123456789"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              ERP Code (Optional)
            </label>
            <input
              value={form.erpCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, erpCode: event.target.value }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="ERP-LE-001"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Status (Optional)
            </label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <p className="text-sm font-medium text-gray-800">
              Billing address (Optional)
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-800">Address Line 1</label>
            <input
              value={form.billingLine1}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  billingLine1: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="100 King St W"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-800">Address Line 2</label>
            <input
              value={form.billingLine2}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  billingLine2: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Suite 200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">City</label>
            <input
              value={form.billingCity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  billingCity: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Toronto"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">State / Province</label>
            <input
              value={form.billingStateProvince}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  billingStateProvince: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="ON"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">Postal Code</label>
            <input
              value={form.billingPostalCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  billingPostalCode: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="M5X 1A9"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">Billing Country</label>
            <select
              value={form.billingCountry}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  billingCountry: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {COUNTRY_OPTIONS.map((countryOption) => (
                <option key={countryOption.value} value={countryOption.value}>
                  {countryOption.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="md:col-span-2 text-sm text-rose-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit(form)}
            disabled={isCreateDisabled}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              isCreateDisabled
                ? 'cursor-not-allowed bg-gray-400'
                : 'bg-black hover:bg-gray-900'
            }`}
          >
            {isSubmitting ? 'Creating...' : 'Create legal entity'}
          </button>
        </div>
      </div>
    </div>
  )
}
