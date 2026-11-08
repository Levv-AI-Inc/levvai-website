'use client'

import { useEffect, useRef, useState } from 'react'
import { LevvSelect, levvUi } from '@/components/ui/levv-app'
import type { BusinessUnitRecord } from '@/lib/api/businessUnits'
import { CompanyModal, FieldLabel, modalUi } from './companyUi'

export type AddCostCenterFormValues = {
  code: string
  name: string
  ownerEmail: string
  description: string
  businessUnit: string
  currency: string
  status: string
  budgetAmount: string
  budgetPeriod: string
  glAccountId: string
  erpCode: string
  legalEntityId: string
}

const EMPTY_FORM: AddCostCenterFormValues = {
  code: '',
  name: '',
  ownerEmail: '',
  description: '',
  businessUnit: '',
  currency: 'USD',
  status: 'active',
  budgetAmount: '',
  budgetPeriod: 'annual',
  glAccountId: '',
  erpCode: '',
  legalEntityId: '',
}

export default function AddCostCenterModal({
  isOpen,
  isSubmitting,
  error,
  businessUnits,
  mode = 'create',
  initialValues,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  isSubmitting: boolean
  error: string
  businessUnits: BusinessUnitRecord[]
  mode?: 'create' | 'edit'
  initialValues?: AddCostCenterFormValues | null
  onClose: () => void
  onSubmit: (values: AddCostCenterFormValues) => Promise<void>
}) {
  const [form, setForm] = useState<AddCostCenterFormValues>(EMPTY_FORM)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(initialValues ?? EMPTY_FORM)
  }, [initialValues, isOpen])

  if (!isOpen) return null

  const isSubmitDisabled =
    isSubmitting ||
    !form.code.trim() ||
    !form.name.trim() ||
    !form.ownerEmail.trim()

  return (
    <CompanyModal
      title={mode === 'edit' ? 'Edit cost center' : 'Add cost center'}
      description={
        mode === 'edit'
          ? 'Update an existing cost center for this tenant.'
          : 'Create a cost center for this tenant.'
      }
      closeLabel="Close cost center modal"
      closeDisabled={isSubmitting}
      onClose={onClose}
      initialFocus={firstFieldRef}
      className="max-w-3xl"
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
            placeholder="CC-1001"
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
            placeholder="Corporate Finance"
          />
        </div>

        <div>
          <FieldLabel required>Owner Email</FieldLabel>
          <input
            type="email"
            value={form.ownerEmail}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                ownerEmail: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="owner@company.com"
          />
        </div>

        <div>
          <FieldLabel>Business Unit (Optional)</FieldLabel>
          <LevvSelect
            value={form.businessUnit}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                businessUnit: event.target.value,
              }))
            }
          >
            <option value="">None</option>
            {form.businessUnit &&
              !businessUnits.some((unit) => unit.code === form.businessUnit) && (
                <option value={form.businessUnit}>{form.businessUnit}</option>
              )}
            {businessUnits
              .filter((unit) => unit.code)
              .map((unit) => (
                <option key={String(unit.id)} value={unit.code}>
                  {unit.name} ({unit.code})
                </option>
              ))}
          </LevvSelect>
        </div>

        <div>
          <FieldLabel>Currency (Optional)</FieldLabel>
          <input
            value={form.currency}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                currency: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="USD"
          />
        </div>

        <div>
          <FieldLabel>Status (Optional)</FieldLabel>
          <LevvSelect
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({ ...current, status: event.target.value }))
            }
          >
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </LevvSelect>
        </div>

        <div>
          <FieldLabel>Budget Amount (Optional)</FieldLabel>
          <input
            value={form.budgetAmount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                budgetAmount: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="100000.00"
          />
        </div>

        <div>
          <FieldLabel>Budget Period (Optional)</FieldLabel>
          <LevvSelect
            value={form.budgetPeriod}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                budgetPeriod: event.target.value,
              }))
            }
          >
            <option value="annual">Annual</option>
            <option value="quarterly">Quarterly</option>
            <option value="project">Project</option>
          </LevvSelect>
        </div>

        <div>
          <FieldLabel>GL Account ID (Optional)</FieldLabel>
          <input
            value={form.glAccountId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                glAccountId: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="GL-1000"
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
            placeholder="ERP-CC-1001"
          />
        </div>

        <div>
          <FieldLabel>Legal Entity ID (Optional)</FieldLabel>
          <input
            value={form.legalEntityId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                legalEntityId: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="LE-001"
          />
        </div>

        <div className="md:col-span-2">
          <FieldLabel>Description (Optional)</FieldLabel>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            className={modalUi.textarea}
            placeholder="Finance cost center"
            rows={3}
          />
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
          disabled={isSubmitDisabled}
          className={levvUi.primaryButton}
        >
          {isSubmitting
            ? mode === 'edit'
              ? 'Saving...'
              : 'Creating...'
            : mode === 'edit'
              ? 'Save changes'
              : 'Create cost center'}
        </button>
      </div>
    </CompanyModal>
  )
}
