'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { BusinessUnitRecord } from '@/lib/api/businessUnits'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Add business unit</h3>
            <p className="mt-1 text-sm text-gray-600">
              Create a business unit for this tenant.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close add business unit modal"
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
                setForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="FIN"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Name <span className="text-rose-600">*</span>
            </label>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Finance"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Parent Business Unit (Optional)
            </label>
            <select
              value={form.parent}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  parent: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {parentOptions
                .filter((unit) => unit.code)
                .map((unit) => (
                  <option key={String(unit.id)} value={unit.code}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
            </select>
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
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Description (Optional)
            </label>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Finance business unit"
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Legal Entity ID (Optional)
            </label>
            <input
              value={form.legalEntityId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  legalEntityId: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="LE-001"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              GL Account ID (Optional)
            </label>
            <input
              value={form.glAccountId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  glAccountId: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="GL-1000"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Company ID (Optional)
            </label>
            <input
              value={form.company}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  company: event.target.value,
                }))
              }
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="2"
            />
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
            {isSubmitting ? 'Creating...' : 'Create business unit'}
          </button>
        </div>
      </div>
    </div>
  )
}
