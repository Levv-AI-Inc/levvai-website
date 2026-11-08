'use client'

import { useEffect, useRef, useState } from 'react'
import { LevvSelect, levvUi } from '@/components/ui/levv-app'
import { CompanyModal, FieldLabel, modalUi } from './companyUi'

export type AddLocationFormValues = {
  name: string
  country: string
  region: string
  status: string
}

const EMPTY_FORM: AddLocationFormValues = {
  name: '',
  country: '',
  region: '',
  status: 'active',
}

export default function AddLocationModal({
  isOpen,
  isSubmitting,
  error,
  mode = 'create',
  initialValues,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  isSubmitting: boolean
  error: string
  mode?: 'create' | 'edit'
  initialValues?: AddLocationFormValues | null
  onClose: () => void
  onSubmit: (values: AddLocationFormValues) => Promise<void>
}) {
  const [form, setForm] = useState<AddLocationFormValues>(EMPTY_FORM)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(initialValues ?? EMPTY_FORM)
  }, [initialValues, isOpen])

  if (!isOpen) return null

  const isSubmitDisabled =
    isSubmitting ||
    !form.name.trim() ||
    !form.country.trim() ||
    !form.region.trim()

  return (
    <CompanyModal
      title={mode === 'edit' ? 'Edit location' : 'Add location'}
      description={
        mode === 'edit'
          ? 'Update an existing location for this tenant.'
          : 'Create a location for this tenant.'
      }
      closeLabel="Close location modal"
      closeDisabled={isSubmitting}
      onClose={onClose}
      initialFocus={firstFieldRef}
      className="max-w-xl"
    >
      <div className={modalUi.body}>
        <div>
          <FieldLabel required>Location</FieldLabel>
          <input
            ref={firstFieldRef}
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            className={modalUi.input}
            placeholder="New York"
          />
        </div>

        <div>
          <FieldLabel required>Country</FieldLabel>
          <input
            value={form.country}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                country: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="USA"
          />
        </div>

        <div>
          <FieldLabel required>Region</FieldLabel>
          <input
            value={form.region}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                region: event.target.value,
              }))
            }
            className={modalUi.input}
            placeholder="North America"
          />
        </div>

        <div>
          <FieldLabel>Status</FieldLabel>
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
            <option value="inactive">Inactive</option>
          </LevvSelect>
        </div>

        {error && (
          <p className={modalUi.error}>{error}</p>
        )}
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
              : 'Create location'}
        </button>
      </div>
    </CompanyModal>
  )
}
