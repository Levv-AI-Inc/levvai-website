'use client'

import { FormEvent } from 'react'
import { Loader2, X } from 'lucide-react'

import type { SupplierRecord } from '@/lib/api/suppliers'
import { LevvNotice, LevvSelect, levvUi } from '@/components/ui/levv-app'
import { useLevvDialog } from '@/components/ui/levv-dialog'
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
    <label className="grid gap-1.5">
      <span className={levvUi.label}>
        {label}
        {required && <span className="ml-1 text-rose-600">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${levvUi.input} ${type === 'number' ? 'tabular-nums' : ''}`}
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
    <label className="grid gap-1.5">
      <span className={levvUi.label}>
        {label}
        {required && <span className="ml-1 text-rose-600">*</span>}
      </span>
      <LevvSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {toTitleCase(option)}
          </option>
        ))}
      </LevvSelect>
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
  const dialogRef = useLevvDialog<HTMLDivElement>(open, onClose)

  if (!open) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-950/30 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-modal-title"
        tabIndex={-1}
        className="my-auto w-full max-w-3xl outline-none border border-[var(--line)] bg-white shadow-[0_20px_44px_-12px_rgb(10_17_40/0.18),0_4px_10px_-4px_rgb(10_17_40/0.06)]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
          <h2 id="supplier-modal-title" className="text-lg font-semibold text-slate-950">
            {editingSupplier ? 'Edit supplier' : 'Create supplier'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`${levvUi.iconButton} shrink-0`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-rose-600">*</span> Required fields
            </p>
            <div className="grid gap-4 md:grid-cols-2">
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
              <p className="text-[13px] text-slate-500">
                Status is set automatically to <span className="font-semibold">Invited</span> when a supplier is created and changes to <span className="font-semibold">Active</span> after invite acceptance.
              </p>
            )}

            {supplierFormError && (
              <LevvNotice tone="rose">
                {supplierFormError}
              </LevvNotice>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className={levvUi.secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSupplier}
              className={levvUi.primaryButton}
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
