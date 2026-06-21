'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {mode === 'edit' ? 'Edit location' : 'Add location'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {mode === 'edit'
                ? 'Update an existing location for this tenant.'
                : 'Create a location for this tenant.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close location modal"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Location <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="New York"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Country <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.country}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  country: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="USA"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Region <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.region}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  region: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="North America"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Status
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
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {error && (
            <p className="md:col-span-2 text-sm text-rose-600">{error}</p>
          )}
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
            disabled={isSubmitDisabled}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              isSubmitDisabled
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
                : 'Create location'}
          </button>
        </div>
      </div>
    </div>
  )
}
