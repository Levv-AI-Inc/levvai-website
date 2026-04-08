'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { LegalEntityRecord } from '@/lib/api/legalEntities'
import { COUNTRY_OPTIONS } from '@/lib/constants/countries'

const TIMEZONE_OPTIONS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
] as const

export type AddSiteFormValues = {
  code: string
  name: string
  status: string
  addressLine1: string
  addressLine2: string
  city: string
  stateProvince: string
  country: string
  postalCode: string
  timezone: string
  latitude: string
  longitude: string
  hoursPerDay: string
  hoursPerWeek: string
  currency: string
  legalEntity: string
  erpCode: string
  taxJurisdiction: string
  taxId: string
  taxVat: string
}

const EMPTY_FORM: AddSiteFormValues = {
  code: '',
  name: '',
  status: 'active',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateProvince: '',
  country: '',
  postalCode: '',
  timezone: '',
  latitude: '',
  longitude: '',
  hoursPerDay: '',
  hoursPerWeek: '',
  currency: '',
  legalEntity: '',
  erpCode: '',
  taxJurisdiction: '',
  taxId: '',
  taxVat: '',
}

export default function AddSiteModal({
  isOpen,
  isSubmitting,
  error,
  legalEntities,
  mode = 'create',
  initialValues,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  isSubmitting: boolean
  error: string
  legalEntities: LegalEntityRecord[]
  mode?: 'create' | 'edit'
  initialValues?: AddSiteFormValues | null
  onClose: () => void
  onSubmit: (values: AddSiteFormValues) => Promise<void>
}) {
  const [form, setForm] = useState<AddSiteFormValues>(EMPTY_FORM)

  useEffect(() => {
    if (!isOpen) return
    setForm(initialValues ?? EMPTY_FORM)
  }, [isOpen])

  if (!isOpen) return null

  const isCreateDisabled =
    isSubmitting ||
    !form.code.trim() ||
    !form.name.trim() ||
    !form.addressLine1.trim() ||
    !form.city.trim() ||
    !form.stateProvince.trim() ||
    !form.country.trim() ||
    !form.postalCode.trim() ||
    !form.timezone.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {mode === 'edit' ? 'Edit worksite' : 'Add worksite'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {mode === 'edit'
                ? 'Update an existing worksite for this tenant.'
                : 'Create a worksite (site) for this tenant.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close add worksite modal"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Code <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({ ...current, code: event.target.value }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="TOR-HQ"
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
              placeholder="Toronto HQ"
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

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Time Zone <span className="text-rose-600">*</span>
            </label>
            <select
              value={form.timezone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  timezone: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select timezone</option>
              {TIMEZONE_OPTIONS.map((timezoneOption) => (
                <option key={timezoneOption} value={timezoneOption}>
                  {timezoneOption}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Address Line 1 <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.addressLine1}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  addressLine1: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="100 King St W"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Address Line 2 (Optional)
            </label>
            <input
              value={form.addressLine2}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  addressLine2: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Suite 200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              City <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.city}
              onChange={(event) =>
                setForm((current) => ({ ...current, city: event.target.value }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Toronto"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              State / Province <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.stateProvince}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  stateProvince: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="ON"
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
              Postal Code <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.postalCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  postalCode: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="M5X 1A9"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Currency (Optional)
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
              Legal Entity (Optional)
            </label>
            <select
              value={form.legalEntity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  legalEntity: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {legalEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.id})
                </option>
              ))}
            </select>
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
              placeholder="SITE-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Latitude (Optional)
            </label>
            <input
              value={form.latitude}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  latitude: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="43.6487000"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Longitude (Optional)
            </label>
            <input
              value={form.longitude}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  longitude: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="-79.3817000"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Hours per day (Optional)
            </label>
            <input
              value={form.hoursPerDay}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hoursPerDay: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="8.00"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Hours per week (Optional)
            </label>
            <input
              value={form.hoursPerWeek}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  hoursPerWeek: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="40.00"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Tax jurisdiction (Optional)
            </label>
            <input
              value={form.taxJurisdiction}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  taxJurisdiction: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="ON"
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

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Tax VAT (Optional)
            </label>
            <input
              value={form.taxVat}
              onChange={(event) =>
                setForm((current) => ({ ...current, taxVat: event.target.value }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Optional VAT"
            />
          </div>

          {error && <p className="md:col-span-2 text-sm text-rose-600">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-6 py-4">
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
            {isSubmitting
              ? mode === 'edit'
                ? 'Saving...'
                : 'Creating...'
              : mode === 'edit'
                ? 'Save changes'
                : 'Create worksite'}
          </button>
        </div>
      </div>
    </div>
  )
}
