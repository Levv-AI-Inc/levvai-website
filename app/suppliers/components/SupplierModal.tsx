'use client'

import { FormEvent } from 'react'
import { Loader2, X } from 'lucide-react'

import type { SupplierRecord } from '@/lib/api/suppliers'
import type { SupplierFormState } from '../types'

const TYPE_OPTIONS = ['staffing', 'services', 'both']
const RISK_OPTIONS = ['low', 'medium', 'high']
const COMPLIANCE_OPTIONS = ['compliant', 'review_required', 'non_compliant']

type SupplierModalProps = {
  open: boolean
  editingSupplier: SupplierRecord | null
  supplierForm: SupplierFormState
  supplierFormError: string
  savingSupplier: boolean
  onClose: () => void
  onFieldChange: (key: keyof SupplierFormState, value: string) => void
  onSubmit: () => void | Promise<void>
}

function toTitleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
  min,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  min?: string
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        required={required}
        min={min}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
  required?: boolean
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
        required={required}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {toTitleCase(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function SupplierModal({
  open,
  editingSupplier,
  supplierForm,
  supplierFormError,
  savingSupplier,
  onClose,
  onFieldChange,
  onSubmit,
}: SupplierModalProps) {
  if (!open) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingSupplier ? 'Edit supplier' : 'Create supplier'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <p className="text-xs text-slate-500">
            <span className="font-semibold text-rose-500">*</span> Required fields
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Supplier name"
              value={supplierForm.name || ''}
              onChange={(value) => onFieldChange('name', value)}
              required
            />
            <Field
              label="Supplier email"
              value={supplierForm.email || ''}
              onChange={(value) => onFieldChange('email', value)}
              type="email"
              required
            />
            <Field
              label="Category"
              value={supplierForm.category || ''}
              onChange={(value) => onFieldChange('category', value)}
              required
            />
            <Field
              label="Contact name"
              value={supplierForm.contact_name || ''}
              onChange={(value) => onFieldChange('contact_name', value)}
            />
            <Field
              label="Contact email"
              value={supplierForm.contact_email || ''}
              onChange={(value) => onFieldChange('contact_email', value)}
              type="email"
              required
            />
            <Field
              label="Contact phone"
              value={supplierForm.contact_phone || ''}
              onChange={(value) => onFieldChange('contact_phone', value)}
            />
            <Field
              label="Tax ID"
              value={supplierForm.tax_id || ''}
              onChange={(value) => onFieldChange('tax_id', value)}
            />
            <Field
              label="Diversity status"
              value={supplierForm.diversity_status || ''}
              onChange={(value) => onFieldChange('diversity_status', value)}
            />
            <Field
              label="Owner"
              value={supplierForm.owner_name || ''}
              onChange={(value) => onFieldChange('owner_name', value)}
            />
            <SelectField
              label="Supplier type"
              value={supplierForm.supplier_type || 'staffing'}
              onChange={(value) => onFieldChange('supplier_type', value)}
              options={TYPE_OPTIONS}
              required
            />
            <SelectField
              label="Risk level"
              value={supplierForm.risk_level || 'low'}
              onChange={(value) => onFieldChange('risk_level', value)}
              options={RISK_OPTIONS}
              required
            />
            <SelectField
              label="Compliance status"
              value={supplierForm.compliance_status || 'compliant'}
              onChange={(value) => onFieldChange('compliance_status', value)}
              options={COMPLIANCE_OPTIONS}
              required
            />
            <Field
              label="Active workers"
              value={supplierForm.active_workers}
              onChange={(value) => onFieldChange('active_workers', value)}
              type="number"
              required
            />
            <Field
              label="Active SOWs"
              value={supplierForm.active_sows}
              onChange={(value) => onFieldChange('active_sows', value)}
              type="number"
              required
            />
          </div>

          {!editingSupplier && (
            <p className="text-xs text-slate-500">
              Status is set automatically to <span className="font-semibold">Invited</span> when a supplier is created and changes to <span className="font-semibold">Active</span> after invite acceptance.
            </p>
          )}

          {supplierFormError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {supplierFormError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSupplier}
              className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingSupplier && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingSupplier
                ? 'Save changes'
                : 'Create and invite supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
