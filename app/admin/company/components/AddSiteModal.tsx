'use client'

import { useEffect, useRef, useState } from 'react'
import { LevvSelect, levvUi } from '@/components/ui/levv-app'
import type { LegalEntityRecord } from '@/lib/api/legalEntities'
import { COUNTRY_OPTIONS } from '@/lib/constants/countries'
import { CompanyModal, FieldLabel, modalUi } from './companyUi'

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
  const firstFieldRef = useRef<HTMLInputElement>(null)

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
    <CompanyModal
      title={mode === 'edit' ? 'Edit worksite' : 'Add worksite'}
      description={
        mode === 'edit'
          ? 'Update an existing worksite for this tenant.'
          : 'Create a worksite (site) for this tenant.'
      }
      closeLabel="Close add worksite modal"
      closeDisabled={isSubmitting}
      onClose={onClose}
      initialFocus={firstFieldRef}
      className="max-h-[90vh] max-w-4xl overflow-y-auto"
      headerClassName="sticky top-0 z-10 bg-[var(--surface)]"
    >
      <div className={modalUi.body}>
        <div>
          <FieldLabel required>Code</FieldLabel>
          <input
            ref={firstFieldRef}
            value={form.code}
            onChange={(event) =>
              setForm((current) => ({ ...current, code: event.target.value }))
            }
            className={modalUi.input}
            placeholder="TOR-HQ"
          />
        </div>

        <div>
          <FieldLabel required>Name</FieldLabel>
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            className={modalUi.input}
            placeholder="Toronto HQ"
          />
        </div>

        <div>
          <FieldLabel>Status (Optional)</FieldLabel>
          <LevvSelect
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
          >
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </LevvSelect>
        </div>

        <div>
          <FieldLabel required>Time Zone</FieldLabel>
          <LevvSelect
            value={form.timezone}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                timezone: event.target.value,
              }))
            }
          >
            <option value="">Select timezone</option>
            {TIMEZONE_OPTIONS.map((timezoneOption) => (
              <option key={timezoneOption} value={timezoneOption}>
                {timezoneOption}
              </option>
            ))}
          </LevvSelect>
        </div>

        <div className="md:col-span-2">
          <FieldLabel required>Address Line 1</FieldLabel>
          <input
            value={form.addressLine1}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                addressLine1: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="100 King St W"
          />
        </div>

        <div className="md:col-span-2">
          <FieldLabel>Address Line 2 (Optional)</FieldLabel>
          <input
            value={form.addressLine2}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                addressLine2: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="Suite 200"
          />
        </div>

        <div>
          <FieldLabel required>City</FieldLabel>
          <input
            value={form.city}
            onChange={(event) =>
              setForm((current) => ({ ...current, city: event.target.value }))
            }
            className={modalUi.input}
            placeholder="Toronto"
          />
        </div>

        <div>
          <FieldLabel required>State / Province</FieldLabel>
          <input
            value={form.stateProvince}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                stateProvince: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="ON"
          />
        </div>

        <div>
          <FieldLabel required>Country</FieldLabel>
          <LevvSelect
            value={form.country}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                country: event.target.value,
              }))
            }
          >
            <option value="" disabled>
              Select country
            </option>
            {COUNTRY_OPTIONS.map((countryOption) => (
              <option key={countryOption.value} value={countryOption.value}>
                {countryOption.label}
              </option>
            ))}
          </LevvSelect>
        </div>

        <div>
          <FieldLabel required>Postal Code</FieldLabel>
          <input
            value={form.postalCode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                postalCode: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="M5X 1A9"
          />
        </div>

        <div>
          <FieldLabel>Currency (Optional)</FieldLabel>
          <input
            value={form.currency}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                currency: event.target.value.toUpperCase(),
              }))
            }
            className={`${modalUi.input} uppercase`}
            placeholder="CAD"
            maxLength={3}
          />
        </div>

        <div>
          <FieldLabel>Legal Entity (Optional)</FieldLabel>
          <LevvSelect
            value={form.legalEntity}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                legalEntity: event.target.value,
              }))
            }
          >
            <option value="">None</option>
            {legalEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name} ({entity.id})
              </option>
            ))}
          </LevvSelect>
        </div>

        <div>
          <FieldLabel>ERP Code (Optional)</FieldLabel>
          <input
            value={form.erpCode}
            onChange={(event) =>
              setForm((current) => ({ ...current, erpCode: event.target.value }))
            }
            className={modalUi.input}
            placeholder="SITE-100"
          />
        </div>

        <div>
          <FieldLabel>Latitude (Optional)</FieldLabel>
          <input
            value={form.latitude}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                latitude: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="43.6487000"
          />
        </div>

        <div>
          <FieldLabel>Longitude (Optional)</FieldLabel>
          <input
            value={form.longitude}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                longitude: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="-79.3817000"
          />
        </div>

        <div>
          <FieldLabel>Hours per day (Optional)</FieldLabel>
          <input
            value={form.hoursPerDay}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                hoursPerDay: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="8.00"
          />
        </div>

        <div>
          <FieldLabel>Hours per week (Optional)</FieldLabel>
          <input
            value={form.hoursPerWeek}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                hoursPerWeek: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="40.00"
          />
        </div>

        <div>
          <FieldLabel>Tax jurisdiction (Optional)</FieldLabel>
          <input
            value={form.taxJurisdiction}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                taxJurisdiction: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="ON"
          />
        </div>

        <div>
          <FieldLabel>Tax ID (Optional)</FieldLabel>
          <input
            value={form.taxId}
            onChange={(event) =>
              setForm((current) => ({ ...current, taxId: event.target.value }))
            }
            className={modalUi.input}
            placeholder="123456789"
          />
        </div>

        <div className="md:col-span-2">
          <FieldLabel>Tax VAT (Optional)</FieldLabel>
          <input
            value={form.taxVat}
            onChange={(event) =>
              setForm((current) => ({ ...current, taxVat: event.target.value }))
            }
            className={modalUi.input}
            placeholder="Optional VAT"
          />
        </div>

        {error && <p className={modalUi.error}>{error}</p>}
      </div>

      <div className={`${modalUi.footer} sticky bottom-0 bg-[var(--surface)]`}>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className={levvUi.secondaryButton}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onSubmit(form)}
          disabled={isCreateDisabled}
          className={levvUi.primaryButton}
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
    </CompanyModal>
  )
}
