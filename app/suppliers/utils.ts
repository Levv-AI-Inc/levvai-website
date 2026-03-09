import type {
  SupplierRecord,
  SupplierUpsertPayload,
} from '@/lib/api/suppliers'

import type { SupplierFormState } from './types'

export type SessionResponse = {
  authenticated?: boolean
  user?: {
    role?: string
  }
  membership?: {
    role?: string
  }
}

export function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function normalizeRole(value?: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

export function toTitleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function toSupplierKey(supplier: SupplierRecord) {
  return supplier.id ?? supplier.supplier_id
}

export function parseSessionRole(payload: SessionResponse): string {
  return (
    readOptionalString(payload.membership?.role) ||
    readOptionalString(payload.user?.role) ||
    ''
  )
}

export function toNonNegativeInt(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
}

export function createFormStateFromSupplier(
  supplier: SupplierRecord,
): SupplierFormState {
  return {
    supplier_code: supplier.supplier_code || supplier.supplier_id || '',
    name: supplier.name || '',
    email: supplier.email || '',
    contact_name: supplier.contact_name || '',
    contact_email: supplier.contact_email || '',
    contact_phone: supplier.contact_phone || '',
    tax_id: supplier.tax_id || '',
    diversity_status: supplier.diversity_status || '',
    supplier_type: supplier.supplier_type || 'staffing',
    category: supplier.category || '',
    owner_name: supplier.owner_name || '',
    status: supplier.status || 'active',
    risk_level: supplier.risk_level || 'low',
    compliance_status: supplier.compliance_status || 'compliant',
    active_workers: String(supplier.active_workers ?? 0),
    active_sows: String(supplier.active_sows ?? 0),
  }
}

export function toPayload(form: SupplierFormState): SupplierUpsertPayload {
  const status = form.status?.trim()

  return {
    supplier_code: form.supplier_code.trim(),
    name: form.name.trim(),
    email: form.email.trim(),
    contact_name: form.contact_name.trim(),
    contact_email: form.contact_email.trim(),
    contact_phone: form.contact_phone.trim(),
    tax_id: form.tax_id.trim(),
    diversity_status: form.diversity_status.trim(),
    supplier_type: form.supplier_type.trim(),
    category: form.category.trim(),
    owner_name: form.owner_name.trim(),
    status: status || undefined,
    risk_level: form.risk_level.trim(),
    compliance_status: form.compliance_status.trim(),
    active_workers: toNonNegativeInt(form.active_workers),
    active_sows: toNonNegativeInt(form.active_sows),
  }
}

export function statusBadgeClass(status: string) {
  switch (normalizeRole(status)) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700'
    case 'inactive':
      return 'bg-slate-200 text-slate-700'
    case 'invited':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export function riskBadgeClass(risk: string) {
  switch (normalizeRole(risk)) {
    case 'low':
      return 'bg-emerald-100 text-emerald-700'
    case 'medium':
      return 'bg-amber-100 text-amber-700'
    case 'high':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export function complianceBadgeClass(status: string) {
  switch (normalizeRole(status)) {
    case 'compliant':
      return 'bg-emerald-100 text-emerald-700'
    case 'review_required':
      return 'bg-amber-100 text-amber-700'
    case 'non_compliant':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}
