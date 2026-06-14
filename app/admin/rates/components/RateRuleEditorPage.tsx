'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  DEFAULT_RATE_LOOKUPS,
  RatesApiError,
  createRateRule,
  deleteRateRule,
  getRateLookups,
  getRateRule,
  getRateStructures,
  previewRateRule,
  updateRateRule,
  type RateLookupOption,
  type RateRule,
  type RateRuleCondition,
  type RateRuleConditionFieldOption,
  type RateRuleCreatePayload,
  type RateStructure,
} from '@/lib/api/rates'
import {
  RolesApiError,
  getRoles,
  type RoleRecord,
} from '@/lib/api/roles'
import { createClientId, formatTimestamp, lookupLabel } from './shared'

type RateRuleEditorPageProps = {
  ruleId?: string
}

type ConditionDraft = {
  client_id: string
  id?: number
  sequence: string
  joiner: 'and' | 'or'
  field_key: string
  operator: string
  value: unknown
}

type FormState = {
  name: string
  description: string
  priority: string
  status: 'draft' | 'active' | 'archived'
  rate_structure: string
  role_definition: string
  effective_date: string
  end_date: string
  action_type: 'multiply_bill_rate' | 'add_percent' | 'add_amount'
  action_value: string
  stop_processing: boolean
  conditions: ConditionDraft[]
}

const NO_VALUE_OPERATORS = new Set([
  'is_blank',
  'is_not_blank',
  'is_true',
  'is_false',
])

const MULTI_VALUE_OPERATORS = new Set(['in', 'not_in'])
const RANGE_VALUE_OPERATORS = new Set(['between'])

const DEFAULT_PREVIEW_JSON = `{
  "hours": "10",
  "bill_rate": "100"
}`

function isUnauthorizedError(error: unknown) {
  return (
    (error instanceof RatesApiError || error instanceof RolesApiError) &&
    error.status === 401
  )
}

function valueToScalarString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value) && value.length > 0) {
    return valueToScalarString(value[0])
  }
  return ''
}

function valueToStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => valueToScalarString(entry))
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

function valueToRangeArray(value: unknown) {
  if (Array.isArray(value)) {
    return [
      valueToScalarString(value[0] ?? ''),
      valueToScalarString(value[1] ?? ''),
    ]
  }
  return ['', '']
}

function normalizeLoadedValue(operator: string, value: unknown): unknown {
  if (NO_VALUE_OPERATORS.has(operator)) return null
  if (MULTI_VALUE_OPERATORS.has(operator)) return valueToStringArray(value)
  if (RANGE_VALUE_OPERATORS.has(operator)) return valueToRangeArray(value)
  return valueToScalarString(value)
}

function buildDefaultForm(): FormState {
  return {
    name: '',
    description: '',
    priority: '1',
    status: 'draft',
    rate_structure: '',
    role_definition: '',
    effective_date: '',
    end_date: '',
    action_type: 'multiply_bill_rate',
    action_value: '',
    stop_processing: true,
    conditions: [],
  }
}

function mapConditionToDraft(
  condition: RateRuleCondition,
): ConditionDraft {
  return {
    client_id: createClientId(),
    id: condition.id,
    sequence: String(condition.sequence),
    joiner: condition.joiner,
    field_key: condition.field_key,
    operator: condition.operator,
    value: normalizeLoadedValue(condition.operator, condition.value),
  }
}

function mapRuleToForm(rule: RateRule): FormState {
  return {
    name: rule.name,
    description: rule.description || '',
    priority: String(rule.priority),
    status: rule.status,
    rate_structure:
      rule.rate_structure !== null ? String(rule.rate_structure) : '',
    role_definition:
      rule.role_definition !== null ? String(rule.role_definition) : '',
    effective_date: rule.effective_date,
    end_date: rule.end_date || '',
    action_type: rule.action_type,
    action_value: rule.action_value || '',
    stop_processing: rule.stop_processing,
    conditions: (rule.conditions || []).map((condition) =>
      mapConditionToDraft(condition),
    ),
  }
}

function buildNewCondition(sequence: number): ConditionDraft {
  return {
    client_id: createClientId(),
    sequence: String(sequence),
    joiner: 'and',
    field_key: '',
    operator: '',
    value: '',
  }
}

function valueToPayload(
  fieldDataType: string | undefined,
  operator: string,
  value: unknown,
) {
  if (NO_VALUE_OPERATORS.has(operator)) return null
  if (MULTI_VALUE_OPERATORS.has(operator)) {
    return valueToStringArray(value)
  }
  if (RANGE_VALUE_OPERATORS.has(operator)) {
    return valueToRangeArray(value)
  }
  if (fieldDataType === 'boolean') {
    return valueToScalarString(value) === 'true'
  }
  return valueToScalarString(value)
}

function toPayload(
  form: FormState,
  conditionFields: RateRuleConditionFieldOption[],
): RateRuleCreatePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    priority: Number(form.priority),
    status: form.status,
    rate_structure: form.rate_structure ? Number(form.rate_structure) : null,
    role_definition: form.role_definition ? Number(form.role_definition) : null,
    effective_date: form.effective_date,
    end_date: form.end_date || null,
    action_type: form.action_type,
    action_value: form.action_value.trim(),
    stop_processing: form.stop_processing,
    conditions: [...form.conditions]
      .sort(
        (left, right) =>
          Number(left.sequence) - Number(right.sequence),
      )
      .map((condition) => {
      const fieldDataType = conditionFields.find(
        (field) => field.value === condition.field_key,
      )?.data_type

      return {
        sequence: Number(condition.sequence),
        joiner: condition.joiner,
        field_key: condition.field_key,
        operator: condition.operator,
        value: valueToPayload(
          fieldDataType,
          condition.operator,
          condition.value,
        ),
      }
    }),
  }
}

export default function RateRuleEditorPage({
  ruleId,
}: RateRuleEditorPageProps) {
  const router = useRouter()
  const isEditing = Boolean(ruleId)

  const [form, setForm] = useState<FormState>(buildDefaultForm())
  const [currentRule, setCurrentRule] = useState<RateRule | null>(null)
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [structures, setStructures] = useState<RateStructure[]>([])
  const [statusOptions, setStatusOptions] = useState<RateLookupOption[]>(
    DEFAULT_RATE_LOOKUPS.rate_rule_statuses,
  )
  const [actionTypeOptions, setActionTypeOptions] = useState<
    RateLookupOption[]
  >(DEFAULT_RATE_LOOKUPS.action_types)
  const [conditionFields, setConditionFields] = useState<
    RateRuleConditionFieldOption[]
  >(DEFAULT_RATE_LOOKUPS.rule_condition_fields)
  const [conditionOperators, setConditionOperators] = useState<
    RateLookupOption[]
  >(DEFAULT_RATE_LOOKUPS.rule_condition_operators)
  const [conditionJoiners, setConditionJoiners] = useState<
    RateLookupOption[]
  >(DEFAULT_RATE_LOOKUPS.rule_condition_joiners)
  const [loading, setLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [previewInput, setPreviewInput] = useState(DEFAULT_PREVIEW_JSON)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [previewResponse, setPreviewResponse] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadSupportData = async () => {
      const [lookupsResult, rolesResult, structuresResult] =
        await Promise.allSettled([
          getRateLookups(),
          getRoles({ is_active: true }),
          getRateStructures(),
        ])

      if (cancelled) return

      const results = [lookupsResult, rolesResult, structuresResult]
      if (
        results.some(
          (result) =>
            result.status === 'rejected' &&
            isUnauthorizedError(result.reason),
        )
      ) {
        const loginNext = ruleId
          ? `/admin/rates/rules/${ruleId}`
          : '/admin/rates/rules/new'
        router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
        return
      }

      if (lookupsResult.status === 'fulfilled') {
        setStatusOptions(lookupsResult.value.rate_rule_statuses)
        setActionTypeOptions(lookupsResult.value.action_types)
        setConditionFields(lookupsResult.value.rule_condition_fields)
        setConditionOperators(lookupsResult.value.rule_condition_operators)
        setConditionJoiners(lookupsResult.value.rule_condition_joiners)
      }
      if (rolesResult.status === 'fulfilled') {
        setRoles(rolesResult.value)
      }
      if (structuresResult.status === 'fulfilled') {
        setStructures(structuresResult.value)
      }
    }

    void loadSupportData()

    return () => {
      cancelled = true
    }
  }, [router, ruleId])

  useEffect(() => {
    if (!ruleId) {
      setLoading(false)
      setCurrentRule(null)
      setForm(buildDefaultForm())
      return
    }

    let cancelled = false

    const loadRule = async () => {
      setLoading(true)
      setLoadError('')

      try {
        const rule = await getRateRule(ruleId)
        if (cancelled) return
        setCurrentRule(rule)
        setForm(mapRuleToForm(rule))
      } catch (requestError) {
        const loginNext = `/admin/rates/rules/${ruleId}`
        if (isUnauthorizedError(requestError)) {
          router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
          return
        }

        if (cancelled) return
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load rate rule.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRule()

    return () => {
      cancelled = true
    }
  }, [router, ruleId])

  const fieldTypeByKey = useMemo(
    () =>
      new Map(
        conditionFields.map((field) => [field.value, field.data_type]),
      ),
    [conditionFields],
  )

  const validateForm = useCallback(() => {
    if (!form.name.trim()) return 'Name is required.'

    const priority = Number(form.priority)
    if (!Number.isFinite(priority)) {
      return 'Priority must be a number.'
    }

    if (!form.effective_date) return 'Effective date is required.'
    if (!form.action_value.trim()) return 'Action value is required.'

    if (form.status === 'active' && form.conditions.length === 0) {
      return 'Active rate rules require at least one condition.'
    }

    const sequenceSet = new Set<string>()
    for (const condition of form.conditions) {
      const sequence = condition.sequence.trim()
      if (!sequence) return 'Each condition needs a sequence.'
      if (!Number.isFinite(Number(sequence)) || Number(sequence) < 1) {
        return 'Condition sequences must be positive numbers.'
      }
      if (sequenceSet.has(sequence)) {
        return 'Condition sequences must be unique per rule.'
      }
      sequenceSet.add(sequence)

      if (!condition.field_key) {
        return 'Each condition needs a field.'
      }
      if (!condition.operator) {
        return 'Each condition needs an operator.'
      }

      if (NO_VALUE_OPERATORS.has(condition.operator)) {
        continue
      }

      if (MULTI_VALUE_OPERATORS.has(condition.operator)) {
        if (valueToStringArray(condition.value).length === 0) {
          return `Condition ${sequence} needs one or more values.`
        }
        continue
      }

      if (RANGE_VALUE_OPERATORS.has(condition.operator)) {
        const [start, end] = valueToRangeArray(condition.value)
        if (!start || !end) {
          return `Condition ${sequence} needs both range values.`
        }
        continue
      }

      if (!valueToScalarString(condition.value).trim()) {
        return `Condition ${sequence} needs a value.`
      }
    }

    return ''
  }, [form])

  const saveRule = useCallback(async () => {
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
      const payload = toPayload(form, conditionFields)
      if (ruleId) {
        const updated = await updateRateRule(ruleId, payload)
        setCurrentRule(updated)
        setForm(mapRuleToForm(updated))
        setSuccessMessage('Rate rule updated.')
        return updated
      }

      const created = await createRateRule(payload)
      router.replace(`/admin/rates/rules/${encodeURIComponent(String(created.id))}`)
      return created
    } catch (requestError) {
      const loginNext = ruleId
        ? `/admin/rates/rules/${ruleId}`
        : '/admin/rates/rules/new'
      if (isUnauthorizedError(requestError)) {
        router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
        return null
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save rate rule.',
      )
      return null
    } finally {
      setSaveBusy(false)
    }
  }, [conditionFields, form, router, ruleId, validateForm])

  const handleDelete = useCallback(async () => {
    if (!currentRule) return

    const confirmed = window.confirm(`Delete rate rule "${currentRule.name}"?`)
    if (!confirmed) return

    setDeleteBusy(true)
    setSaveError('')
    setSuccessMessage('')

    try {
      await deleteRateRule(currentRule.id)
      router.replace('/admin/rates/rules')
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/admin/rates/rules/${currentRule.id}`)}`)
        return
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to delete rate rule.',
      )
    } finally {
      setDeleteBusy(false)
    }
  }, [currentRule, router])

  const handlePreview = useCallback(async () => {
    if (!currentRule) {
      setPreviewError('Save the rule before running preview.')
      setPreviewResponse('')
      return
    }

    let parsedPayload: Record<string, unknown>
    try {
      parsedPayload = JSON.parse(previewInput) as Record<string, unknown>
    } catch {
      setPreviewError('Preview JSON is invalid.')
      setPreviewResponse('')
      return
    }

    setPreviewBusy(true)
    setPreviewError('')

    try {
      const response = await previewRateRule(currentRule.id, parsedPayload)
      setPreviewResponse(JSON.stringify(response, null, 2))
    } catch (requestError) {
      if (isUnauthorizedError(requestError)) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/admin/rates/rules/${currentRule.id}`)}`)
        return
      }

      setPreviewError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to preview rate rule.',
      )
      setPreviewResponse('')
    } finally {
      setPreviewBusy(false)
    }
  }, [currentRule, previewInput, router])

  if (loading) {
    return (
      <div className="px-6 py-8 text-sm text-gray-500">
        Loading rate rule...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/admin/rates/rules"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to rate rules
          </Link>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Rate Rule' : 'New Rate Rule'}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Define a conditional action over bill rate resolution and
              scope it by role or rate structure if needed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentRule && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={saveBusy || deleteBusy}
              className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {deleteBusy ? 'Deleting...' : 'Delete'}
            </button>
          )}

          <button
            type="button"
            onClick={() => void saveRule()}
            disabled={saveBusy || deleteBusy}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {saveBusy
              ? 'Saving...'
              : isEditing
                ? 'Save changes'
                : 'Create rule'}
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
                  placeholder="OT"
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
                  placeholder="Optional context for finance or procurement."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value,
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

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Role
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
                  <option value="">All roles</option>
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
                  <option value="">All structures</option>
                  {structures.map((structure) => (
                    <option key={structure.id} value={structure.id}>
                      {structure.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Effective date
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
                  Action type
                </label>
                <select
                  value={form.action_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      action_type:
                        event.target.value as FormState['action_type'],
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {actionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Action value
                </label>
                <input
                  value={form.action_value}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      action_value: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="1.5"
                />
              </div>

              <label className="inline-flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.stop_processing}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stop_processing: event.target.checked,
                    }))
                  }
                />
                Stop processing after this rule matches
              </label>
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Conditions
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Active rules need at least one condition and unique sequence
                  values.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    conditions: [
                      ...current.conditions,
                      buildNewCondition(current.conditions.length + 1),
                    ],
                  }))
                }
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Add condition
              </button>
            </div>

            <div className="space-y-4 p-6">
              {form.conditions.length === 0 && (
                <div className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                  No conditions added yet.
                </div>
              )}

              {form.conditions.map((condition) => {
                const fieldType = fieldTypeByKey.get(condition.field_key)
                const scalarValue = valueToScalarString(condition.value)
                const multiValue = valueToStringArray(condition.value).join('\n')
                const [rangeStart, rangeEnd] = valueToRangeArray(condition.value)

                return (
                  <div
                    key={condition.client_id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-5">
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                          Sequence
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={condition.sequence}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              conditions: current.conditions.map((row) =>
                                row.client_id === condition.client_id
                                  ? {
                                      ...row,
                                      sequence: event.target.value,
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                          Joiner
                        </label>
                        <select
                          value={condition.joiner}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              conditions: current.conditions.map((row) =>
                                row.client_id === condition.client_id
                                  ? {
                                      ...row,
                                      joiner:
                                        event.target.value as ConditionDraft['joiner'],
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        >
                          {conditionJoiners.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                          Field
                        </label>
                        <select
                          value={condition.field_key}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              conditions: current.conditions.map((row) =>
                                row.client_id === condition.client_id
                                  ? {
                                      ...row,
                                      field_key: event.target.value,
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        >
                          <option value="">Select field</option>
                          {conditionFields.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                          Operator
                        </label>
                        <select
                          value={condition.operator}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              conditions: current.conditions.map((row) =>
                                row.client_id === condition.client_id
                                  ? {
                                      ...row,
                                      operator: event.target.value,
                                      value: normalizeLoadedValue(
                                        event.target.value,
                                        row.value,
                                      ),
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        >
                          <option value="">Select operator</option>
                          {conditionOperators.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              conditions: current.conditions.filter(
                                (row) => row.client_id !== condition.client_id,
                              ),
                            }))
                          }
                          className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                        Value
                      </label>

                      {NO_VALUE_OPERATORS.has(condition.operator) && (
                        <div className="mt-1 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500">
                          No value required for this operator.
                        </div>
                      )}

                      {MULTI_VALUE_OPERATORS.has(condition.operator) && (
                        <textarea
                          rows={3}
                          value={multiValue}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              conditions: current.conditions.map((row) =>
                                row.client_id === condition.client_id
                                  ? {
                                      ...row,
                                      value: valueToStringArray(
                                        event.target.value,
                                      ),
                                    }
                                  : row,
                              ),
                            }))
                          }
                          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                          placeholder="One value per line"
                        />
                      )}

                      {RANGE_VALUE_OPERATORS.has(condition.operator) && (
                        <div className="mt-1 grid gap-3 md:grid-cols-2">
                          <input
                            value={rangeStart}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                conditions: current.conditions.map((row) =>
                                  row.client_id === condition.client_id
                                    ? {
                                        ...row,
                                        value: [
                                          event.target.value,
                                          valueToRangeArray(row.value)[1],
                                        ],
                                      }
                                    : row,
                                ),
                              }))
                            }
                            className="rounded-md border px-3 py-2 text-sm"
                            placeholder="Start"
                          />
                          <input
                            value={rangeEnd}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                conditions: current.conditions.map((row) =>
                                  row.client_id === condition.client_id
                                    ? {
                                        ...row,
                                        value: [
                                          valueToRangeArray(row.value)[0],
                                          event.target.value,
                                        ],
                                      }
                                    : row,
                                ),
                              }))
                            }
                            className="rounded-md border px-3 py-2 text-sm"
                            placeholder="End"
                          />
                        </div>
                      )}

                      {!NO_VALUE_OPERATORS.has(condition.operator) &&
                        !MULTI_VALUE_OPERATORS.has(condition.operator) &&
                        !RANGE_VALUE_OPERATORS.has(condition.operator) &&
                        fieldType === 'boolean' && (
                          <select
                            value={scalarValue}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                conditions: current.conditions.map((row) =>
                                  row.client_id === condition.client_id
                                    ? {
                                        ...row,
                                        value: event.target.value,
                                      }
                                    : row,
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                          >
                            <option value="">Select value</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        )}

                      {!NO_VALUE_OPERATORS.has(condition.operator) &&
                        !MULTI_VALUE_OPERATORS.has(condition.operator) &&
                        !RANGE_VALUE_OPERATORS.has(condition.operator) &&
                        fieldType !== 'boolean' && (
                          <input
                            value={scalarValue}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                conditions: current.conditions.map((row) =>
                                  row.client_id === condition.client_id
                                    ? {
                                        ...row,
                                        value: event.target.value,
                                      }
                                    : row,
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                            placeholder="Value"
                          />
                        )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">
              Rule Preview
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Preview uses the saved rule definition. Save the form first if
              you want the latest edits applied.
            </p>

            <textarea
              rows={10}
              value={previewInput}
              onChange={(event) => setPreviewInput(event.target.value)}
              className="mt-4 w-full rounded-md border px-3 py-2 font-mono text-xs"
            />

            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={!currentRule || previewBusy}
              className="mt-4 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {previewBusy ? 'Running preview...' : 'Run rule simulation'}
            </button>

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

          {currentRule && (
            <div className="rounded-lg border bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-900">Metadata</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Created</dt>
                  <dd className="text-right text-gray-900">
                    {formatTimestamp(currentRule.created_at)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Updated</dt>
                  <dd className="text-right text-gray-900">
                    {formatTimestamp(currentRule.updated_at)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Action</dt>
                  <dd className="text-right text-gray-900">
                    {lookupLabel(actionTypeOptions, currentRule.action_type)}
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
