'use client'

import { useEffect, useRef, useState } from 'react'
import { LevvSelect, levvUi } from '@/components/ui/levv-app'
import { COUNTRY_OPTIONS } from '@/lib/constants/countries'
import { CompanyModal, FieldLabel, modalUi } from './companyUi'

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
  const firstFieldRef = useRef<HTMLInputElement>(null)

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
    <CompanyModal
      title="Add legal entity"
      description="Create a legal entity for this tenant."
      closeLabel="Close add legal entity modal"
      closeDisabled={isSubmitting}
      onClose={onClose}
      initialFocus={firstFieldRef}
      className="max-w-3xl"
    >
      <div className={modalUi.body}>
        <div>
          <FieldLabel required>Legal Entity ID</FieldLabel>
          <input
            ref={firstFieldRef}
            value={form.id}
            onChange={(event) =>
              setForm((current) => ({ ...current, id: event.target.value }))
            }
            className={modalUi.input}
            placeholder="LE-001"
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
            placeholder="Acme Canada Ltd"
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
          <FieldLabel required>Currency</FieldLabel>
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

        <div>
          <FieldLabel>ERP Code (Optional)</FieldLabel>
          <input
            value={form.erpCode}
            onChange={(event) =>
              setForm((current) => ({ ...current, erpCode: event.target.value }))
            }
            className={modalUi.input}
            placeholder="ERP-LE-001"
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

        <div className="md:col-span-2">
          <p className={`${levvUi.legend} border-b border-[var(--line)] pb-2 pt-1 text-slate-950`}>
            Billing address (Optional)
          </p>
        </div>

        <div className="md:col-span-2">
          <FieldLabel>Address Line 1</FieldLabel>
          <input
            value={form.billingLine1}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                billingLine1: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="100 King St W"
          />
        </div>

        <div className="md:col-span-2">
          <FieldLabel>Address Line 2</FieldLabel>
          <input
            value={form.billingLine2}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                billingLine2: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="Suite 200"
          />
        </div>

        <div>
          <FieldLabel>City</FieldLabel>
          <input
            value={form.billingCity}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                billingCity: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="Toronto"
          />
        </div>

        <div>
          <FieldLabel>State / Province</FieldLabel>
          <input
            value={form.billingStateProvince}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                billingStateProvince: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="ON"
          />
        </div>

        <div>
          <FieldLabel>Postal Code</FieldLabel>
          <input
            value={form.billingPostalCode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                billingPostalCode: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="M5X 1A9"
          />
        </div>

        <div>
          <FieldLabel>Billing Country</FieldLabel>
          <LevvSelect
            value={form.billingCountry}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                billingCountry: event.target.value,
              }))
            }
          >
            <option value="">None</option>
            {COUNTRY_OPTIONS.map((countryOption) => (
              <option key={countryOption.value} value={countryOption.value}>
                {countryOption.label}
              </option>
            ))}
          </LevvSelect>
        </div>

        {error && <p className={modalUi.error}>{error}</p>}
      </div>

      <div className={modalUi.footer}>
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
          {isSubmitting ? 'Creating...' : 'Create legal entity'}
        </button>
      </div>
    </CompanyModal>
  )
}
