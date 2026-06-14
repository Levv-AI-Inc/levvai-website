'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Copy, Plus, Trash2 } from 'lucide-react'
import {
  DEFAULT_RATE_LOOKUPS,
  RatesApiError,
  cloneRateStructure,
  createRateStructure,
  deleteRateStructure,
  getRateLookups,
  getRateStructure,
  previewRateStructure,
  updateRateStructure,
  type RateLookupOption,
  type RateStructure,
  type RateStructureComponent,
  type RateStructureCreatePayload,
} from '@/lib/api/rates'
import {
  createClientId,
  formatTimestamp,
  getRateComponentKey,
} from './shared'

type RateStructureEditorPageProps = {
  structureId?: string
}

type ComponentDraft = {
  client_id: string
  id?: number
  code?: string
  sequence: string
  label: string
  value_type: 'currency' | 'percentage'
  calculation_role: 'base' | 'additive_percent' | 'additive_amount'
  is_required: boolean
  is_active: boolean
}

type FormState = {
  name: string
  description: string
  status: 'draft' | 'active' | 'archived'
  rounding_scale: string
  is_default: boolean
  components: ComponentDraft[]
}

const VALUE_TYPE_OPTIONS: Array<{
  value: RateStructureComponent['value_type']
  label: string
}> = [
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
]

const CALCULATION_ROLE_OPTIONS: Array<{
  value: RateStructureComponent['calculation_role']
  label: string
}> = [
  { value: 'base', label: 'Base' },
  { value: 'additive_percent', label: 'Additive %' },
  { value: 'additive_amount', label: 'Additive amount' },
]

function isUnauthorizedError(error: unknown) {
  return error instanceof RatesApiError && error.status === 401
}

function buildDefaultForm(): FormState {
  return {
    name: '',
    description: '',
    status: 'draft',
    rounding_scale: '2',
    is_default: false,
    components: [],
  }
}

function mapComponentToDraft(
  component: RateStructureComponent,
): ComponentDraft {
  return {
    client_id: createClientId(),
    id: component.id,
    code: component.code,
    sequence: String(component.sequence),
    label: component.label,
    value_type: component.value_type,
    calculation_role: component.calculation_role,
    is_required: component.is_required,
    is_active: component.is_active,
  }
}

function mapStructureToForm(structure: RateStructure): FormState {
  return {
    name: structure.name,
    description: structure.description || '',
    status: structure.status,
    rounding_scale: String(structure.rounding_scale ?? 2),
    is_default: structure.is_default,
    components: structure.components.map((component) =>
      mapComponentToDraft(component),
    ),
  }
}

function buildNewComponent(
  sequence: number,
): ComponentDraft {
  return {
    client_id: createClientId(),
    sequence: String(sequence),
    label: '',
    value_type: 'currency',
    calculation_role: sequence === 1 ? 'base' : 'additive_percent',
    is_required: true,
    is_active: true,
  }
}

function toComponentPayload(
  draft: ComponentDraft,
): RateStructureComponent {
  return {
    sequence: Number(draft.sequence),
    label: draft.label.trim(),
    value_type: draft.value_type,
    calculation_role: draft.calculation_role,
    is_required: draft.is_required,
    is_active: draft.is_active,
  }
}

function toPayload(form: FormState): RateStructureCreatePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    status: form.status,
    currency_mode: 'single_currency',
    rounding_scale: Number(form.rounding_scale),
    is_default: form.is_default,
    components: [...form.components]
      .sort(
        (left, right) =>
          Number(left.sequence) - Number(right.sequence),
      )
      .map((component) => toComponentPayload(component)),
  }
}

export default function RateStructureEditorPage({
  structureId,
}: RateStructureEditorPageProps) {
  const router = useRouter()
  const isEditing = Boolean(structureId)

  const [form, setForm] = useState<FormState>(buildDefaultForm())
  const [currentStructure, setCurrentStructure] =
    useState<RateStructure | null>(null)
  const [statusOptions, setStatusOptions] = useState<RateLookupOption[]>(
    DEFAULT_RATE_LOOKUPS.rate_structure_statuses,
  )
  const [loading, setLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [previewValues, setPreviewValues] = useState<Record<string, string>>(
    {},
  )
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [previewResponse, setPreviewResponse] = useState('')
  const [cloneBusy, setCloneBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadLookups = async () => {
      try {
        const lookups = await getRateLookups()
        if (cancelled) return
        setStatusOptions(lookups.rate_structure_statuses)
      } catch (requestError) {
        if (cancelled) return
        if (isUnauthorizedError(requestError)) {
          const loginNext = structureId
            ? `/admin/rates/structures/${structureId}`
            : '/admin/rates/structures/new'
          router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
        }
      }
    }

    void loadLookups()

    return () => {
      cancelled = true
    }
  }, [router, structureId])

  useEffect(() => {
    if (!structureId) {
      setLoading(false)
      setCurrentStructure(null)
      setForm(buildDefaultForm())
      return
    }

    let cancelled = false

    const loadStructure = async () => {
      setLoading(true)
      setLoadError('')

      try {
        const structure = await getRateStructure(structureId)
        if (cancelled) return
        setCurrentStructure(structure)
        setForm(mapStructureToForm(structure))
      } catch (requestError) {
        const loginNext = `/admin/rates/structures/${structureId}`
        if (isUnauthorizedError(requestError)) {
          router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
          return
        }

        if (cancelled) return
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load rate structure.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadStructure()

    return () => {
      cancelled = true
    }
  }, [router, structureId])

  useEffect(() => {
    if (!currentStructure) return

    setPreviewValues((current) => {
      const next = { ...current }
      for (const component of currentStructure.components) {
        const key = getRateComponentKey(component)
        if (next[key] === undefined) {
          next[key] = ''
        }
      }
      return next
    })
  }, [currentStructure])

  const activeBaseCount = useMemo(
    () =>
      form.components.filter(
        (component) => component.calculation_role === 'base',
      ).length,
    [form.components],
  )

  const validateForm = useCallback(() => {
    if (!form.name.trim()) return 'Name is required.'

    const roundingScale = Number(form.rounding_scale)
    if (!Number.isFinite(roundingScale) || roundingScale < 0) {
      return 'Rounding scale must be a non-negative number.'
    }

    if (form.components.length === 0) {
      return 'Add at least one component.'
    }

    const sequenceSet = new Set<string>()
    for (const component of form.components) {
      if (!component.label.trim()) {
        return 'Each component needs a label.'
      }

      const sequence = component.sequence.trim()
      if (!sequence) {
        return 'Each component needs a sequence.'
      }
      if (!Number.isFinite(Number(sequence)) || Number(sequence) < 1) {
        return 'Component sequences must be positive numbers.'
      }
      if (sequenceSet.has(sequence)) {
        return 'Component sequences must be unique.'
      }
      sequenceSet.add(sequence)
    }

    if (form.status === 'active' && activeBaseCount !== 1) {
      return 'Active structures require exactly one base component.'
    }

    return ''
  }, [activeBaseCount, form])

  const saveStructure = useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setSaveError(validationError)
      setSuccessMessage('')
      return null
    }

    setSaveBusy(true)
    setSaveError('')
    setSuccessMessage('')

    try {
      const payload = toPayload(form)
      if (structureId) {
        const updated = await updateRateStructure(structureId, payload)
        setCurrentStructure(updated)
        setForm(mapStructureToForm(updated))
        setSuccessMessage('Rate structure updated.')
        return updated
      }

      const created = await createRateStructure(payload)
      router.replace(
        `/admin/rates/structures/${encodeURIComponent(String(created.id))}`,
      )
      return created
    } catch (requestError) {
      const loginNext = structureId
        ? `/admin/rates/structures/${structureId}`
        : '/admin/rates/structures/new'
      if (isUnauthorizedError(requestError)) {
        router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
        return null
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save rate structure.',
      )
      return null
    } finally {
      setSaveBusy(false)
    }
  }, [form, router, structureId, validateForm])

  const handleClone = useCallback(async () => {
    if (!currentStructure) return

    setCloneBusy(true)
    setSaveError('')
    setSuccessMessage('')

    try {
      const cloned = await cloneRateStructure(currentStructure.id)
      router.push(
        `/admin/rates/structures/${encodeURIComponent(String(cloned.id))}`,
      )
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace(
          `/auth/login?next=${encodeURIComponent(`/admin/rates/structures/${currentStructure.id}`)}`,
        )
        return
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to clone rate structure.',
      )
    } finally {
      setCloneBusy(false)
    }
  }, [currentStructure, router])

  const handleDelete = useCallback(async () => {
    if (!currentStructure) return

    const confirmed = window.confirm(
      `Delete rate structure "${currentStructure.name}"?`,
    )
    if (!confirmed) return

    setDeleteBusy(true)
    setSaveError('')
    setSuccessMessage('')

    try {
      await deleteRateStructure(currentStructure.id)
      router.replace('/admin/rates/structures')
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace(
          `/auth/login?next=${encodeURIComponent(`/admin/rates/structures/${currentStructure.id}`)}`,
        )
        return
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to delete rate structure.',
      )
    } finally {
      setDeleteBusy(false)
    }
  }, [currentStructure, router])

  const handlePreview = useCallback(async () => {
    if (!currentStructure) return

    const componentValues = currentStructure.components
      .filter((component) => component.id !== undefined)
      .map((component) => {
        const key = getRateComponentKey(component)
        return {
          rate_structure_component: component.id as number,
          numeric_value: previewValues[key] || '0',
        }
      })

    if (componentValues.length === 0) {
      setPreviewError('Save the structure before using formula test.')
      setPreviewResponse('')
      return
    }

    setPreviewBusy(true)
    setPreviewError('')

    try {
      const response = await previewRateStructure(currentStructure.id, {
        component_values: componentValues,
      })
      setPreviewResponse(JSON.stringify(response, null, 2))
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace(
          `/auth/login?next=${encodeURIComponent(`/admin/rates/structures/${currentStructure.id}`)}`,
        )
        return
      }

      setPreviewError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to preview formula.',
      )
      setPreviewResponse('')
    } finally {
      setPreviewBusy(false)
    }
  }, [currentStructure, previewValues, router])

  if (loading) {
    return (
      <div className="px-6 py-8 text-sm text-gray-500">
        Loading rate structure...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/admin/rates/structures"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to rate structures
          </Link>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Rate Structure' : 'New Rate Structure'}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Build the components that determine how bill rates are
              derived from base pay and additive markups.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentStructure && (
            <>
              <button
                type="button"
                onClick={() => void handleClone()}
                disabled={cloneBusy || saveBusy || deleteBusy}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Copy className="h-4 w-4" />
                {cloneBusy ? 'Cloning...' : 'Clone'}
              </button>

              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleteBusy || saveBusy || cloneBusy}
                className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void saveStructure()}
            disabled={saveBusy || deleteBusy || cloneBusy}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {saveBusy
              ? 'Saving...'
              : isEditing
                ? 'Save changes'
                : 'Create structure'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      {saveError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {saveError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
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
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Standard Bill Rate"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Describe the intended calculation pattern."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as FormState['status'],
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Currency mode
                </label>
                <input
                  value="Single currency"
                  readOnly
                  className="mt-1 w-full rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Rounding scale
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.rounding_scale}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rounding_scale: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <label className="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_default: event.target.checked,
                    }))
                  }
                />
                Default structure
              </label>
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Components
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Active structures need exactly one base component.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    components: [
                      ...current.components,
                      buildNewComponent(current.components.length + 1),
                    ],
                  }))
                }
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Add component
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium w-[88px]">Seq</th>
                    <th className="px-4 py-3 text-left font-medium w-[160px]">Code</th>
                    <th className="px-4 py-3 text-left font-medium min-w-[220px]">Label</th>
                    <th className="px-4 py-3 text-left font-medium w-[180px]">Value type</th>
                    <th className="px-4 py-3 text-left font-medium w-[210px]">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Required</th>
                    <th className="px-4 py-3 text-left font-medium">Active</th>
                    <th className="px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {form.components.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        No components added yet.
                      </td>
                    </tr>
                  )}

                  {form.components.map((component, index) => (
                    <tr key={component.client_id}>
                      <td className="px-4 py-3 align-top min-w-[220px]">
                        <input
                          type="number"
                          min={1}
                          value={component.sequence}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              components: current.components.map((row) =>
                                row.client_id === component.client_id
                                  ? {
                                      ...row,
                                      sequence: event.target.value,
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="w-20 rounded-md border px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 align-top text-gray-500">
                        {component.code || 'Generated on save'}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          value={component.label}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              components: current.components.map((row) =>
                                row.client_id === component.client_id
                                  ? { ...row, label: event.target.value }
                                  : row,
                              ),
                            }))
                          }
                          className="w-full rounded-md border px-3 py-1.5 text-sm"
                          placeholder="Pay Rate"
                        />
                      </td>
                      <td className="px-4 py-3 align-top w-[180px]">
                        <select
                          value={component.value_type}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              components: current.components.map((row) =>
                                row.client_id === component.client_id
                                  ? {
                                      ...row,
                                      value_type:
                                        event.target.value as ComponentDraft['value_type'],
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="w-[160px] rounded-md border px-3 py-1.5 text-sm"
                        >
                          {VALUE_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top w-[210px]">
                        <select
                          value={component.calculation_role}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              components: current.components.map((row) =>
                                row.client_id === component.client_id
                                  ? {
                                      ...row,
                                      calculation_role:
                                        event.target.value as ComponentDraft['calculation_role'],
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="w-[190px] rounded-md border px-3 py-1.5 text-sm"
                        >
                          {CALCULATION_ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={component.is_required}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                components: current.components.map((row) =>
                                  row.client_id === component.client_id
                                    ? {
                                        ...row,
                                        is_required: event.target.checked,
                                      }
                                    : row,
                                ),
                              }))
                            }
                          />
                          Required
                        </label>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={component.is_active}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                components: current.components.map((row) =>
                                  row.client_id === component.client_id
                                    ? {
                                        ...row,
                                        is_active: event.target.checked,
                                      }
                                    : row,
                                ),
                              }))
                            }
                          />
                          Active
                        </label>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              components: current.components.filter(
                                (row) => row.client_id !== component.client_id,
                              ),
                            }))
                          }
                          className="rounded-md p-2 hover:bg-gray-100"
                          aria-label={`Remove component ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">
              Formula Test
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Preview uses the saved structure definition. Save your
              component changes first if you want them reflected here.
            </p>

            <div className="mt-4 space-y-3">
              {(currentStructure?.components || []).map((component) => {
                const key = getRateComponentKey(component)
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700">
                      {component.label}
                    </label>
                    <input
                      value={previewValues[key] || ''}
                      onChange={(event) =>
                        setPreviewValues((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder={
                        component.value_type === 'percentage' ? '20' : '70'
                      }
                    />
                  </div>
                )
              })}

              {!currentStructure && (
                <div className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                  Save the structure before running a formula test.
                </div>
              )}

              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={!currentStructure || previewBusy}
                className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {previewBusy ? 'Testing...' : 'Run formula test'}
              </button>
            </div>

            {previewError && (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {previewError}
              </div>
            )}

            {previewResponse && (
              <pre className="mt-4 overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
                {previewResponse}
              </pre>
            )}
          </div>

          {currentStructure && (
            <div className="rounded-lg border bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900">
                Metadata
              </h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-right text-gray-900">
                    {formatTimestamp(currentStructure.created_at)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Updated</dt>
                  <dd className="text-right text-gray-900">
                    {formatTimestamp(currentStructure.updated_at)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Component count</dt>
                  <dd className="text-right text-gray-900">
                    {currentStructure.component_count ??
                      currentStructure.components.length}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
