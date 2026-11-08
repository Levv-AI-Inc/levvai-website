'use client'

import { useEffect, useRef, useState } from 'react'
import { LevvSelect, levvUi } from '@/components/ui/levv-app'
import type { BusinessUnitRecord } from '@/lib/api/businessUnits'
import { CompanyModal, FieldLabel, modalUi } from './companyUi'

export type AddBusinessUnitFormValues = {
  code: string
  name: string
  parent: string
  description: string
  legalEntityId: string
  glAccountId: string
  status: string
  company: string
}

const EMPTY_FORM: AddBusinessUnitFormValues = {
  code: '',
  name: '',
  parent: '',
  description: '',
  legalEntityId: '',
  glAccountId: '',
  status: 'active',
  company: '',
}

export default function AddBusinessUnitModal({
  isOpen,
  isSubmitting,
  error,
  parentOptions,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  isSubmitting: boolean
  error: string
  parentOptions: BusinessUnitRecord[]
  onClose: () => void
  onSubmit: (values: AddBusinessUnitFormValues) => Promise<void>
}) {
  const [form, setForm] = useState<AddBusinessUnitFormValues>(EMPTY_FORM)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(EMPTY_FORM)
  }, [isOpen])

  if (!isOpen) return null

  const isCreateDisabled =
    isSubmitting ||
    !form.code.trim() ||
    !form.name.trim()

  return (
    <CompanyModal
      title="Add business unit"
      description="Create a business unit for this tenant."
      closeLabel="Close add business unit modal"
      closeDisabled={isSubmitting}
      onClose={onClose}
      initialFocus={firstFieldRef}
      className="max-w-2xl"
    >
      <div className={modalUi.body}>
        <div>
          <FieldLabel required>Code</FieldLabel>
          <input
            ref={firstFieldRef}
            value={form.code}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                code: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="FIN"
          />
        </div>

        <div>
          <FieldLabel required>Name</FieldLabel>
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="Finance"
          />
        </div>

        <div>
          <FieldLabel>Parent Business Unit (Optional)</FieldLabel>
          <LevvSelect
            value={form.parent}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                parent: event.target.value,
              }))
            }
          >
            <option value="">None</option>
            {parentOptions
              .filter((unit) => unit.code)
              .map((unit) => (
                <option key={String(unit.id)} value={unit.code}>
                  {unit.name} ({unit.code})
                </option>
              ))}
          </LevvSelect>
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
            placeholder="Finance business unit"
            rows={3}
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
          <FieldLabel>Company ID (Optional)</FieldLabel>
          <input
            value={form.company}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                company: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="2"
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
          disabled={isCreateDisabled}
          className={levvUi.primaryButton}
        >
          {isSubmitting ? 'Creating...' : 'Create business unit'}
        </button>
      </div>
    </CompanyModal>
  )
}
