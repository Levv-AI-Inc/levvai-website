'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  RolesApiError,
  createRole,
  getRole,
  updateRole,
  type RoleCreatePayload,
  type RoleRecord,
} from '@/lib/api/roles'
import { COUNTRY_OPTIONS } from '@/lib/constants/countries'

type RoleEditorPageProps = {
  roleId?: string
}

type FormState = {
  name: string
  description: string
  country: string
  region: string
  city: string
  default_currency: string
  default_unit: 'hour' | 'day'
  is_active: boolean
}

const UNIT_OPTIONS: Array<{ value: 'hour' | 'day'; label: string }> = [
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
]

const CURRENCY_SUGGESTIONS = ['USD', 'CAD', 'EUR', 'GBP', 'INR', 'SGD']

function buildDefaultForm(): FormState {
  return {
    name: '',
    description: '',
    country: '',
    region: '',
    city: '',
    default_currency: '',
    default_unit: 'hour',
    is_active: true,
  }
}

function mapRoleToForm(role: RoleRecord): FormState {
  return {
    name: role.name,
    description: role.description || '',
    country: role.country || '',
    region: role.region || '',
    city: role.city || '',
    default_currency: role.default_currency || '',
    default_unit: role.default_unit,
    is_active: role.is_active,
  }
}

function formatTimestamp(value: string): string {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function toPayload(form: FormState): RoleCreatePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    country: form.country.trim().toUpperCase(),
    region: form.region.trim(),
    city: form.city.trim(),
    default_currency: form.default_currency.trim().toUpperCase(),
    default_unit: form.default_unit,
    is_active: form.is_active,
  }
}

export default function RoleEditorPage({
  roleId,
}: RoleEditorPageProps) {
  const router = useRouter()
  const isEditing = Boolean(roleId)

  const [form, setForm] = useState<FormState>(buildDefaultForm())
  const [currentRole, setCurrentRole] = useState<RoleRecord | null>(null)
  const [loading, setLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!roleId) {
      setLoading(false)
      setCurrentRole(null)
      setForm(buildDefaultForm())
      return
    }

    let cancelled = false

    const loadCurrentRole = async () => {
      setLoading(true)
      setLoadError('')

      try {
        const role = await getRole(roleId)
        if (cancelled) return
        setCurrentRole(role)
        setForm(mapRoleToForm(role))
      } catch (requestError) {
        const loginNext = `/admin/roles/${roleId}`
        if (
          requestError instanceof RolesApiError &&
          requestError.status === 401
        ) {
          router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
          return
        }

        if (cancelled) return
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load role.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCurrentRole()
    return () => {
      cancelled = true
    }
  }, [roleId, router])

  const validateForm = useCallback(() => {
    if (!form.name.trim()) return 'Name is required.'
    if (!form.country.trim()) return 'Country is required.'
    if (form.country.trim().length !== 2) {
      return 'Country must be a 2-letter ISO code.'
    }
    if (!form.default_currency.trim()) {
      return 'Default currency is required.'
    }
    if (form.default_currency.trim().length !== 3) {
      return 'Default currency must be a 3-letter ISO code.'
    }
    return ''
  }, [form])

  const handleSave = useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setSaveError(validationError)
      setSuccessMessage('')
      return
    }

    setSaveBusy(true)
    setSaveError('')
    setSuccessMessage('')

    try {
      const payload = toPayload(form)
      if (roleId) {
        const updated = await updateRole(roleId, payload)
        setCurrentRole(updated)
        setForm(mapRoleToForm(updated))
        setSuccessMessage('Role updated.')
      } else {
        const created = await createRole(payload)
        router.replace(`/admin/roles/${encodeURIComponent(String(created.id))}`)
        return
      }
    } catch (requestError) {
      const loginNext = roleId ? `/admin/roles/${roleId}` : '/admin/roles/new'
      if (
        requestError instanceof RolesApiError &&
        requestError.status === 401
      ) {
        router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
        return
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save role.',
      )
    } finally {
      setSaveBusy(false)
    }
  }, [form, roleId, router, validateForm])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-gray-500">
        Loading role...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/admin/roles"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to roles
          </Link>

          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEditing ? 'Edit Role' : 'New Role'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Define a master role with market defaults for location,
              currency, unit, and active status.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveBusy}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {saveBusy
            ? 'Saving...'
            : isEditing
              ? 'Save changes'
              : 'Create role'}
        </button>
      </div>

      {loadError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      {saveError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line">
          {saveError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Role settings
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-800">
                Name
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
                placeholder="Senior Developer"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-800">
                Description
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
                rows={4}
                placeholder="Senior software engineering role for the Toronto market."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                Country
              </label>
              <input
                list="role-country-options"
                value={form.country}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    country: event.target.value.toUpperCase(),
                  }))
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="CA"
                maxLength={2}
              />
              <datalist id="role-country-options">
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                Region
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
                placeholder="ON"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                City
              </label>
              <input
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Toronto"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                Default currency
              </label>
              <input
                list="role-currency-options"
                value={form.default_currency}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    default_currency: event.target.value.toUpperCase(),
                  }))
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="CAD"
                maxLength={3}
              />
              <datalist id="role-currency-options">
                {CURRENCY_SUGGESTIONS.map((currency) => (
                  <option key={currency} value={currency} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                Default unit
              </label>
              <select
                value={form.default_unit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    default_unit:
                      event.target.value === 'day' ? 'day' : 'hour',
                  }))
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-md border px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Active
                </div>
                <div className="text-xs text-gray-500">
                  Inactive roles stay visible but should not be used for new
                  rate configuration.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    is_active: !current.is_active,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  form.is_active ? 'bg-black' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    form.is_active ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Metadata</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <span>Code</span>
                <span className="text-right font-medium text-gray-900">
                  {currentRole?.code || 'Generated on save'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span>Location label</span>
                <span className="text-right font-medium text-gray-900">
                  {currentRole?.location_label || 'Generated on save'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span>Status</span>
                <span className="text-right font-medium text-gray-900">
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span>Created</span>
                <span className="text-right font-medium text-gray-900">
                  {formatTimestamp(currentRole?.created_at || '')}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span>Updated</span>
                <span className="text-right font-medium text-gray-900">
                  {formatTimestamp(currentRole?.updated_at || '')}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Notes
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li>
                Code is backend-generated on create and remains stable on
                later edits.
              </li>
              <li>
                Location label is derived from city, region, and country.
              </li>
              <li>
                Uniqueness is enforced on the name and exact market
                combination.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
