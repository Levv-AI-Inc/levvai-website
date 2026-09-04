'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import {
  DEFAULT_RATE_LOOKUPS,
  RatesApiError,
  activateRateCard,
  createRateCard,
  deleteRateCard,
  getRateCard,
  getRateLookups,
  getRateStructure,
  getRateStructures,
  recalculateRateCard,
  updateRateCard,
  type RateCard,
  type RateCardCreatePayload,
  type RateCardLine,
  type RateCardLineValue,
  type RateLookupOption,
  type RateStructure,
  type RateStructureComponent,
} from '@/lib/api/rates'
import {
  RolesApiError,
  getRoles,
  type RoleRecord,
} from '@/lib/api/roles'
import {
  ApiError as SuppliersApiError,
  getSuppliers,
  type SupplierRecord,
} from '@/lib/api/suppliers'
import {
  createClientId,
  formatTimestamp,
  getRateComponentKey,
} from './shared'
import RequiredIndicator from '@/components/ui/RequiredIndicator'

type RateCardEditorPageProps = {
  cardId?: string
}

type LineDraft = {
  client_id: string
  id?: number
  sequence: string
  supplier: string
  supplier_name?: string
  location_label: string
  bill_rate: string
  componentValuesByCode: Record<string, string>
}

type FormState = {
  name: string
  role_definition: string
  currency: string
  unit: 'hour' | 'day'
  effective_date: string
  end_date: string
  rate_structure: string
  status: 'draft' | 'active' | 'archived'
  notes: string
  lines: LineDraft[]
}

function isUnauthorizedError(error: unknown) {
  return (
    (error instanceof RatesApiError ||
      error instanceof RolesApiError ||
      error instanceof SuppliersApiError) &&
    error.status === 401
  )
}

function buildDefaultForm(): FormState {
  return {
    name: '',
    role_definition: '',
    currency: '',
    unit: 'hour',
    effective_date: '',
    end_date: '',
    rate_structure: '',
    status: 'draft',
    notes: '',
    lines: [],
  }
}

function readSupplierId(supplier: SupplierRecord) {
  if (typeof supplier.id === 'number') return supplier.id
  if (typeof supplier.id === 'string') {
    const parsed = Number(supplier.id)
    if (Number.isFinite(parsed)) return parsed
  }
  const fallback = Number(supplier.supplier_id)
  return Number.isFinite(fallback) ? fallback : null
}

function mapComponentValueToKey(
  value: RateCardLineValue,
) {
  if (value.component_code?.trim()) return value.component_code.trim()
  return `component_${value.rate_structure_component}`
}

function formatNumericDisplayValue(value: string, scale = 2) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return parsed.toFixed(scale)
}

function mapLineToDraft(line: RateCardLine): LineDraft {
  return {
    client_id: createClientId(),
    id: line.id,
    sequence: String(line.sequence),
    supplier: String(line.supplier),
    supplier_name: line.supplier_name,
    location_label: line.location_label,
    bill_rate: line.bill_rate
      ? formatNumericDisplayValue(line.bill_rate)
      : '',
    componentValuesByCode: Object.fromEntries(
      line.component_values.map((value) => [
        mapComponentValueToKey(value),
        formatNumericDisplayValue(value.numeric_value),
      ]),
    ),
  }
}

function mapCardToForm(card: RateCard): FormState {
  return {
    name: card.name,
    role_definition: String(card.role_definition),
    currency: card.currency || '',
    unit: card.unit,
    effective_date: card.effective_date,
    end_date: card.end_date || '',
    rate_structure: String(card.rate_structure),
    status: card.status,
    notes: card.notes || '',
    lines: (card.lines || []).map((line) => mapLineToDraft(line)),
  }
}

function buildNewLine(sequence: number): LineDraft {
  return {
    client_id: createClientId(),
    sequence: String(sequence),
    supplier: '',
    location_label: '',
    bill_rate: '',
    componentValuesByCode: {},
  }
}

function findComponentValue(
  line: LineDraft,
  component: RateStructureComponent,
) {
  const directKey = getRateComponentKey(component)
  const legacyKey =
    component.id !== undefined ? `component_${component.id}` : directKey

  return (
    line.componentValuesByCode[directKey] ||
    line.componentValuesByCode[legacyKey] ||
    ''
  )
}

function toPayload(
  form: FormState,
  structureComponents: RateStructureComponent[],
): RateCardCreatePayload {
  return {
    name: form.name.trim(),
    role_definition: Number(form.role_definition),
    currency: form.currency.trim().toUpperCase(),
    unit: form.unit,
    effective_date: form.effective_date,
    end_date: form.end_date || null,
    rate_structure: Number(form.rate_structure),
    status: form.status,
    notes: form.notes.trim(),
    lines: [...form.lines]
      .sort(
        (left, right) =>
          Number(left.sequence) - Number(right.sequence),
      )
      .map((line) => ({
        sequence: Number(line.sequence),
        supplier: Number(line.supplier),
        location_label: line.location_label.trim(),
        component_values: structureComponents
          .filter((component) => component.id !== undefined)
          .map((component) => ({
            rate_structure_component: component.id as number,
            numeric_value: findComponentValue(line, component),
          }))
          .filter((value) => value.numeric_value.trim() !== ''),
      })),
  }
}

function getCurrencySymbol(currencyCode: string) {
  const normalized = currencyCode.trim().toUpperCase()
  if (!normalized) return '$'

  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalized,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0)
    return (
      parts.find((part) => part.type === 'currency')?.value || normalized
    )
  } catch {
    return normalized
  }
}

function getComponentLabelWithModifier(
  component: RateStructureComponent,
  currencyCode: string,
) {
  if (component.calculation_role === 'additive_percent') {
    return `${component.label} (+%)`
  }

  if (component.calculation_role === 'additive_amount') {
    return `${component.label} (+${getCurrencySymbol(currencyCode)})`
  }

  return component.label
}

export default function RateCardEditorPage({
  cardId,
}: RateCardEditorPageProps) {
  const router = useRouter()
  const isEditing = Boolean(cardId)

  const [form, setForm] = useState<FormState>(buildDefaultForm())
  const [currentCard, setCurrentCard] = useState<RateCard | null>(null)
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [structures, setStructures] = useState<RateStructure[]>([])
  const [selectedStructureDetail, setSelectedStructureDetail] =
    useState<RateStructure | null>(null)
  const [structureDetailLoading, setStructureDetailLoading] =
    useState(false)
  const [statusOptions, setStatusOptions] = useState<RateLookupOption[]>(
    DEFAULT_RATE_LOOKUPS.rate_card_statuses,
  )
  const [unitOptions, setUnitOptions] = useState<RateLookupOption[]>(
    DEFAULT_RATE_LOOKUPS.units,
  )
  const [loading, setLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [recalcBusy, setRecalcBusy] = useState(false)
  const [activateBusy, setActivateBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const selectedStructureComponents = useMemo(() => {
    const structureId = Number(form.rate_structure)
    if (!Number.isFinite(structureId)) return []

    if (
      currentCard &&
      currentCard.rate_structure === structureId &&
      currentCard.rate_structure_components?.length
    ) {
      return currentCard.rate_structure_components
    }

    if (
      selectedStructureDetail &&
      selectedStructureDetail.id === structureId &&
      selectedStructureDetail.components.length
    ) {
      return selectedStructureDetail.components
    }

    return (
      structures.find((structure) => structure.id === structureId)?.components ||
      []
    )
  }, [
    currentCard,
    form.rate_structure,
    selectedStructureDetail,
    structures,
  ])

  useEffect(() => {
    let cancelled = false

    const loadSupportData = async () => {
      const [lookupsResult, rolesResult, suppliersResult, structuresResult] =
        await Promise.allSettled([
          getRateLookups(),
          getRoles({ is_active: true }),
          getSuppliers({ status: 'active' }),
          getRateStructures(),
        ])

      if (cancelled) return

      const results = [
        lookupsResult,
        rolesResult,
        suppliersResult,
        structuresResult,
      ]
      if (
        results.some(
          (result) =>
            result.status === 'rejected' &&
            isUnauthorizedError(result.reason),
        )
      ) {
        const loginNext = cardId
          ? `/admin/rates/cards/${cardId}`
          : '/admin/rates/cards/new'
        router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
        return
      }

      if (lookupsResult.status === 'fulfilled') {
        setStatusOptions(lookupsResult.value.rate_card_statuses)
        setUnitOptions(lookupsResult.value.units)
      }
      if (rolesResult.status === 'fulfilled') {
        setRoles(rolesResult.value)
      }
      if (suppliersResult.status === 'fulfilled') {
        setSuppliers(suppliersResult.value)
      }
      if (structuresResult.status === 'fulfilled') {
        setStructures(structuresResult.value)
      }
    }

    void loadSupportData()

    return () => {
      cancelled = true
    }
  }, [cardId, router])

  useEffect(() => {
    if (!cardId) {
      setLoading(false)
      setCurrentCard(null)
      setForm(buildDefaultForm())
      return
    }

    let cancelled = false

    const loadCard = async () => {
      setLoading(true)
      setLoadError('')

      try {
        const card = await getRateCard(cardId)
        if (cancelled) return
        setCurrentCard(card)
        setForm(mapCardToForm(card))
      } catch (requestError) {
        const loginNext = `/admin/rates/cards/${cardId}`
        if (isUnauthorizedError(requestError)) {
          router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
          return
        }

        if (cancelled) return
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load rate card.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCard()

    return () => {
      cancelled = true
    }
  }, [cardId, router])

  useEffect(() => {
    const structureId = Number(form.rate_structure)
    if (!Number.isFinite(structureId)) {
      setSelectedStructureDetail(null)
      setStructureDetailLoading(false)
      return
    }

    if (
      currentCard &&
      currentCard.rate_structure === structureId &&
      currentCard.rate_structure_components?.length
    ) {
      setSelectedStructureDetail(null)
      setStructureDetailLoading(false)
      return
    }

    let cancelled = false

    const loadStructureDetail = async () => {
      setStructureDetailLoading(true)
      try {
        const structure = await getRateStructure(structureId)
        if (cancelled) return
        setSelectedStructureDetail(structure)
      } catch (requestError) {
        if (cancelled) return
        if (isUnauthorizedError(requestError)) {
          const loginNext = cardId
            ? `/admin/rates/cards/${cardId}`
            : '/admin/rates/cards/new'
          router.replace(
            `/auth/login?next=${encodeURIComponent(loginNext)}`,
          )
          return
        }
        setSelectedStructureDetail(null)
        setSaveError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load selected rate structure components.',
        )
      } finally {
        if (!cancelled) {
          setStructureDetailLoading(false)
        }
      }
    }

    void loadStructureDetail()

    return () => {
      cancelled = true
    }
  }, [cardId, currentCard, form.rate_structure, router])

  const validateForm = useCallback(() => {
    if (!form.name.trim()) return 'Name is required.'
    if (!form.role_definition) return 'Role is required.'
    if (!form.currency.trim()) return 'Currency is required.'
    if (form.currency.trim().length !== 3) {
      return 'Currency must be a 3-letter code.'
    }
    if (!form.effective_date) return 'Effective date is required.'
    if (!form.rate_structure) return 'Rate structure is required.'
    if (selectedStructureComponents.length === 0) {
      return 'Selected rate structure has no components available.'
    }

    if (form.status === 'active' && form.lines.length === 0) {
      return 'Active rate cards require at least one line.'
    }

    const sequenceSet = new Set<string>()
    const supplierLocationSet = new Set<string>()
    for (const line of form.lines) {
      const sequence = line.sequence.trim()
      if (!sequence) return 'Each line requires a sequence.'
      if (!Number.isFinite(Number(sequence)) || Number(sequence) < 1) {
        return 'Line sequences must be positive numbers.'
      }
      if (sequenceSet.has(sequence)) {
        return 'Line sequences must be unique per card.'
      }
      sequenceSet.add(sequence)

      if (!line.supplier) {
        return 'Each line requires a supplier.'
      }
      if (!line.location_label.trim()) {
        return 'Each line requires a location label.'
      }

      const supplierLocationKey = [
        line.supplier.trim(),
        line.location_label.trim().toLowerCase(),
      ].join('::')
      if (supplierLocationSet.has(supplierLocationKey)) {
        return 'Supplier and location combinations must be unique.'
      }
      supplierLocationSet.add(supplierLocationKey)

      for (const component of selectedStructureComponents) {
        if (!component.is_required) continue
        const value = findComponentValue(line, component).trim()
        if (!value) {
          return `Line ${sequence} is missing ${component.label}.`
        }
      }
    }

    return ''
  }, [form, selectedStructureComponents])

  const saveCard = useCallback(async () => {
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
      const payload = toPayload(form, selectedStructureComponents)
      if (cardId) {
        const updated = await updateRateCard(cardId, payload)
        setCurrentCard(updated)
        setForm(mapCardToForm(updated))
        setSuccessMessage('Rate card updated.')
        return updated
      }

      const created = await createRateCard(payload)
      router.replace(`/admin/rates/cards/${encodeURIComponent(String(created.id))}`)
      return created
    } catch (requestError) {
      const loginNext = cardId
        ? `/admin/rates/cards/${cardId}`
        : '/admin/rates/cards/new'
      if (isUnauthorizedError(requestError)) {
        router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
        return null
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save rate card.',
      )
      return null
    } finally {
      setSaveBusy(false)
    }
  }, [cardId, form, router, selectedStructureComponents, validateForm])

  const handleRecalculate = useCallback(async () => {
    if (!cardId) return

    const saved = await saveCard()
    if (!saved) return

    setRecalcBusy(true)
    setSaveError('')

    try {
      const recalculated = await recalculateRateCard(saved.id)
      setCurrentCard(recalculated)
      setForm(mapCardToForm(recalculated))
      setSuccessMessage('Rate card recalculated.')
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/admin/rates/cards/${cardId}`)}`)
        return
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to recalculate rate card.',
      )
    } finally {
      setRecalcBusy(false)
    }
  }, [cardId, router, saveCard])

  const handleActivate = useCallback(async () => {
    if (!cardId) return

    const saved = await saveCard()
    if (!saved) return

    setActivateBusy(true)
    setSaveError('')

    try {
      const activated = await activateRateCard(saved.id)
      setCurrentCard(activated)
      setForm(mapCardToForm(activated))
      setSuccessMessage('Rate card activated.')
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/admin/rates/cards/${cardId}`)}`)
        return
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to activate rate card.',
      )
    } finally {
      setActivateBusy(false)
    }
  }, [cardId, router, saveCard])

  const handleDelete = useCallback(async () => {
    if (!currentCard) return

    const confirmed = window.confirm(`Delete rate card "${currentCard.name}"?`)
    if (!confirmed) return

    setDeleteBusy(true)
    setSaveError('')
    setSuccessMessage('')

    try {
      await deleteRateCard(currentCard.id)
      router.replace('/admin/rates/cards')
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/admin/rates/cards/${currentCard.id}`)}`)
        return
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to delete rate card.',
      )
    } finally {
      setDeleteBusy(false)
    }
  }, [currentCard, router])

  if (loading) {
    return (
      <div className="px-6 py-8 text-sm text-gray-500">
        Loading rate card...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/admin/rates/cards"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to rate cards
          </Link>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Rate Card' : 'New Rate Card'}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Assign a role and structure, then enter supplier line values
              that roll up into a read-only bill rate.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentCard && (
            <>
              <button
                type="button"
                onClick={() => void handleRecalculate()}
                disabled={saveBusy || recalcBusy || activateBusy || deleteBusy}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className="h-4 w-4" />
                {recalcBusy ? 'Recalculating...' : 'Recalculate'}
              </button>

              {form.status !== 'active' && (
                <button
                  type="button"
                  onClick={() => void handleActivate()}
                  disabled={saveBusy || recalcBusy || activateBusy || deleteBusy}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {activateBusy ? 'Activating...' : 'Activate'}
                </button>
              )}

              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={saveBusy || recalcBusy || activateBusy || deleteBusy}
                className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void saveCard()}
            disabled={saveBusy || recalcBusy || activateBusy || deleteBusy}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {saveBusy
              ? 'Saving...'
              : isEditing
                ? 'Save changes'
                : 'Create card'}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Name
                  <RequiredIndicator />
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
                  placeholder="Senior Developer - Toronto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Role
                  <RequiredIndicator />
                </label>
                <select
                  value={form.role_definition}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role_definition: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Rate structure
                  <RequiredIndicator />
                </label>
                <select
                  value={form.rate_structure}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rate_structure: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">Select rate structure</option>
                  {structures.map((structure) => (
                    <option key={structure.id} value={structure.id}>
                      {structure.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Currency
                  <RequiredIndicator />
                </label>
                <input
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      currency: event.target.value.toUpperCase(),
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="CAD"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Unit
                </label>
                <select
                  value={form.unit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit: event.target.value as FormState['unit'],
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {unitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Effective date
                  <RequiredIndicator />
                </label>
                <input
                  type="date"
                  value={form.effective_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effective_date: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  End date
                </label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      end_date: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
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

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Optional notes for finance or procurement."
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Lines</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Bill rate is read-only and recalculated from the component
                  values after save.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    lines: [
                      ...current.lines,
                      buildNewLine(current.lines.length + 1),
                    ],
                  }))
                }
                disabled={
                  !form.rate_structure ||
                  structureDetailLoading ||
                  selectedStructureComponents.length === 0
                }
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      Seq
                      <RequiredIndicator />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Supplier
                      <RequiredIndicator />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Location
                      <RequiredIndicator />
                    </th>
                    {selectedStructureComponents.map((component) => (
                      <th
                        key={getRateComponentKey(component)}
                        className="px-4 py-3 text-left font-medium"
                      >
                        {getComponentLabelWithModifier(component, form.currency)}
                        {component.is_required && <RequiredIndicator />}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left font-medium">Bill rate</th>
                    <th className="px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {form.lines.length === 0 && (
                    <tr>
                      <td
                        colSpan={selectedStructureComponents.length + 5}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        {form.rate_structure
                          ? 'No lines added yet.'
                          : 'Select a rate structure before adding lines.'}
                      </td>
                    </tr>
                  )}

                  {form.lines.map((line) => (
                    <tr key={line.client_id}>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="number"
                          min={1}
                          value={line.sequence}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              lines: current.lines.map((row) =>
                                row.client_id === line.client_id
                                  ? {
                                      ...row,
                                      sequence: event.target.value,
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="w-20 rounded-md border px-2 py-1.5 text-sm"
                          required
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={line.supplier}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              lines: current.lines.map((row) =>
                                row.client_id === line.client_id
                                  ? {
                                      ...row,
                                      supplier: event.target.value,
                                      supplier_name:
                                        suppliers.find(
                                          (supplier) =>
                                            String(readSupplierId(supplier)) ===
                                            event.target.value,
                                        )?.name || row.supplier_name,
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="w-56 rounded-md border px-3 py-1.5 text-sm"
                          required
                        >
                          <option value="">Select supplier</option>
                          {suppliers
                            .map((supplier) => ({
                              supplier,
                              id: readSupplierId(supplier),
                            }))
                            .filter(
                              (entry): entry is {
                                supplier: SupplierRecord
                                id: number
                              } => entry.id !== null,
                            )
                            .map((entry) => (
                              <option
                                key={entry.id}
                                value={entry.id}
                              >
                                {entry.supplier.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          value={line.location_label}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              lines: current.lines.map((row) =>
                                row.client_id === line.client_id
                                  ? {
                                      ...row,
                                      location_label: event.target.value,
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="w-40 rounded-md border px-3 py-1.5 text-sm"
                          placeholder="Toronto"
                          required
                        />
                      </td>
                      {selectedStructureComponents.map((component) => {
                        const key = getRateComponentKey(component)
                        return (
                          <td
                            key={`${line.client_id}:${key}`}
                            className="px-4 py-3 align-top"
                          >
                            <input
                              value={findComponentValue(line, component)}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  lines: current.lines.map((row) =>
                                    row.client_id === line.client_id
                                      ? {
                                          ...row,
                                          componentValuesByCode: {
                                            ...row.componentValuesByCode,
                                            [key]: event.target.value,
                                          },
                                        }
                                      : row,
                                  ),
                                }))
                              }
                              className="w-28 rounded-md border px-3 py-1.5 text-sm"
                              placeholder={
                                component.value_type === 'percentage'
                                  ? '20'
                                  : '70'
                              }
                              required={component.is_required}
                            />
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 align-top text-gray-600">
                        {line.bill_rate
                          ? formatNumericDisplayValue(line.bill_rate)
                          : 'Recalculate'}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              lines: current.lines.filter(
                                (row) => row.client_id !== line.client_id,
                              ),
                            }))
                          }
                          className="rounded-md p-2 hover:bg-gray-100"
                          aria-label="Remove line"
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
              Structure Components
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              {!form.rate_structure && (
                <div className="rounded-md border border-dashed border-gray-300 px-4 py-5 text-gray-500">
                  Select a rate structure to see the dynamic columns for line
                  entry.
                </div>
              )}

              {form.rate_structure && structureDetailLoading && (
                <div className="rounded-md border border-dashed border-gray-300 px-4 py-5 text-gray-500">
                  Loading structure components...
                </div>
              )}

              {form.rate_structure &&
                !structureDetailLoading &&
                selectedStructureComponents.length === 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-5 text-amber-700">
                    No components are available for the selected structure.
                  </div>
                )}

              {selectedStructureComponents.map((component) => (
                <div
                  key={getRateComponentKey(component)}
                  className="rounded-md border border-gray-200 px-4 py-3"
                >
                  <div className="font-medium text-gray-900">
                    {getComponentLabelWithModifier(component, form.currency)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {component.value_type} · {component.calculation_role}
                    {component.is_required ? ' · required' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {currentCard && (
            <div className="rounded-lg border bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900">Metadata</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-right text-gray-900">
                    {formatTimestamp(currentCard.created_at)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Updated</dt>
                  <dd className="text-right text-gray-900">
                    {formatTimestamp(currentCard.updated_at)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Lines</dt>
                  <dd className="text-right text-gray-900">
                    {currentCard.lines?.length || 0}
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
