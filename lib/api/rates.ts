'use client'

export type RateLookupOption = {
  value: string
  label: string
}

export type RateRuleConditionFieldOption = RateLookupOption & {
  data_type?: 'number' | 'text' | 'boolean' | string
}

export type RateStructureComponent = {
  id?: number
  sequence: number
  code?: string
  label: string
  value_type: 'currency' | 'percentage'
  calculation_role: 'base' | 'additive_percent' | 'additive_amount'
  is_required: boolean
  is_active: boolean
}

export type RateStructure = {
  id: number
  name: string
  description: string
  status: 'draft' | 'active' | 'archived'
  currency_mode: 'single_currency'
  rounding_scale: number
  is_default: boolean
  components: RateStructureComponent[]
  component_count?: number
  created_at: string
  updated_at: string
}

export type RateCardLineValue = {
  id?: number
  rate_structure_component: number
  component_code?: string
  component_label?: string
  value_type?: 'currency' | 'percentage'
  numeric_value: string
}

export type RateCardLine = {
  id?: number
  sequence: number
  supplier: number
  supplier_name?: string
  location_label: string
  bill_rate?: string
  component_values: RateCardLineValue[]
}

export type RateCard = {
  id: number
  name: string
  role_definition: number
  role_name?: string
  currency: string
  unit: 'hour' | 'day'
  effective_date: string
  end_date: string | null
  rate_structure: number
  rate_structure_name?: string
  rate_structure_components?: RateStructureComponent[]
  status: 'draft' | 'active' | 'archived'
  notes: string
  lines?: RateCardLine[]
  created_at: string
  updated_at: string
}

export type RateRuleCondition = {
  id?: number
  sequence: number
  joiner: 'and' | 'or'
  field_key: string
  field_label?: string
  data_type?: 'number' | 'text' | 'boolean'
  operator: string
  value: unknown
}

export type RateRule = {
  id: number
  name: string
  description: string
  priority: number
  status: 'draft' | 'active' | 'archived'
  rate_structure: number | null
  rate_structure_name?: string
  role_definition: number | null
  role_name?: string
  effective_date: string
  end_date: string | null
  action_type: 'multiply_bill_rate' | 'add_percent' | 'add_amount'
  action_value: string
  stop_processing: boolean
  conditions?: RateRuleCondition[]
  created_at: string
  updated_at: string
}

export type RateStructureListParams = {
  search?: string
  status?: string
  is_default?: boolean | string
}

export type RateCardListParams = {
  search?: string
  status?: string
  role_definition?: number | string
  role_definition_id?: number | string
  rate_structure?: number | string
  rate_structure_id?: number | string
  currency?: string
  unit?: 'hour' | 'day' | string
}

export type RateRuleListParams = {
  search?: string
  status?: string
  role_definition?: number | string
  role_definition_id?: number | string
  rate_structure?: number | string
  rate_structure_id?: number | string
}

export type RateStructureCreatePayload = {
  name: string
  description?: string
  status: 'draft' | 'active' | 'archived'
  currency_mode: 'single_currency'
  rounding_scale: number
  is_default: boolean
  components: RateStructureComponent[]
}

export type RateStructureUpdatePayload = Partial<
  Omit<RateStructureCreatePayload, 'components'>
> & {
  components?: RateStructureComponent[]
}

export type RateCardCreatePayload = {
  name: string
  role_definition: number
  currency: string
  unit: 'hour' | 'day'
  effective_date: string
  end_date?: string | null
  rate_structure: number
  status: 'draft' | 'active' | 'archived'
  notes?: string
  lines: RateCardLine[]
}

export type RateCardUpdatePayload = Partial<
  Omit<RateCardCreatePayload, 'lines'>
> & {
  lines?: RateCardLine[]
}

export type RateRuleCreatePayload = {
  name: string
  description?: string
  priority: number
  status: 'draft' | 'active' | 'archived'
  rate_structure: number | null
  role_definition: number | null
  effective_date: string
  end_date?: string | null
  action_type: 'multiply_bill_rate' | 'add_percent' | 'add_amount'
  action_value: string
  stop_processing: boolean
  conditions: RateRuleCondition[]
}

export type RateRuleUpdatePayload = Partial<
  Omit<RateRuleCreatePayload, 'conditions'>
> & {
  conditions?: RateRuleCondition[]
}

export type RateLookups = {
  rate_structure_statuses: RateLookupOption[]
  rate_card_statuses: RateLookupOption[]
  rate_rule_statuses: RateLookupOption[]
  units: RateLookupOption[]
  action_types: RateLookupOption[]
  rule_condition_fields: RateRuleConditionFieldOption[]
  rule_condition_operators: RateLookupOption[]
  rule_condition_joiners: RateLookupOption[]
}

export const DEFAULT_RATE_LOOKUPS: RateLookups = {
  rate_structure_statuses: [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ],
  rate_card_statuses: [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ],
  rate_rule_statuses: [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ],
  units: [
    { value: 'hour', label: 'Hour' },
    { value: 'day', label: 'Day' },
  ],
  action_types: [
    { value: 'multiply_bill_rate', label: 'Multiply bill rate' },
    { value: 'add_percent', label: 'Add percent' },
    { value: 'add_amount', label: 'Add amount' },
  ],
  rule_condition_fields: [
    { value: 'hours', label: 'Hours', data_type: 'number' },
    { value: 'bill_rate', label: 'Bill rate', data_type: 'number' },
    { value: 'location', label: 'Location', data_type: 'text' },
  ],
  rule_condition_operators: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'gt', label: 'Greater than' },
    { value: 'gte', label: 'Greater than or equal to' },
    { value: 'lt', label: 'Less than' },
    { value: 'lte', label: 'Less than or equal to' },
    { value: 'contains', label: 'Contains' },
    { value: 'in', label: 'In list' },
    { value: 'between', label: 'Between' },
    { value: 'is_true', label: 'Is true' },
    { value: 'is_false', label: 'Is false' },
    { value: 'is_blank', label: 'Is blank' },
    { value: 'is_not_blank', label: 'Is not blank' },
  ],
  rule_condition_joiners: [
    { value: 'and', label: 'And' },
    { value: 'or', label: 'Or' },
  ],
}

export class RatesApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'RatesApiError'
    this.status = status
    this.body = body
  }
}

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike }

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || ''
  return ''
}

function getCsrfHeaders() {
  const csrfToken = getCookie('csrftoken')
  if (!csrfToken) return {}

  return {
    'X-CSRFToken': csrfToken,
  }
}

async function parseJsonSafe(response: Response) {
  return response.json().catch(() => ({}))
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function readMessages(value: JsonLike | undefined): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') return [value]
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => readMessages(item))
  }
  if (typeof value === 'object') {
    const lines: string[] = []
    for (const [key, entry] of Object.entries(value)) {
      const messages = readMessages(entry)
      if (!messages.length) continue
      if (key === 'detail' || key === 'non_field_errors') {
        lines.push(...messages)
      } else {
        const label = key.replace(/_/g, ' ')
        lines.push(...messages.map((message) => `${label}: ${message}`))
      }
    }
    return lines
  }
  return []
}

function formatApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const messages = readMessages(body as JsonLike)
  const unique = Array.from(new Set(messages.filter(Boolean)))
  return unique.length ? unique.join('\n') : fallback
}

function throwApiError(
  response: Response,
  body: unknown,
  fallback: string,
): never {
  throw new RatesApiError(
    formatApiError(body, fallback),
    response.status,
    body,
  )
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object',
    )
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { results?: unknown[] }).results)
  ) {
    return (payload as { results: unknown[] }).results.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object',
    )
  }

  return []
}

function sanitizePayload<T extends Record<string, unknown>>(payload: T): T {
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== undefined,
  )
  return Object.fromEntries(entries) as T
}

function toBooleanString(value: boolean | string | undefined) {
  if (value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizeStructureStatus(value: unknown): RateStructure['status'] {
  const status = readOptionalString(value)
  return status === 'active' || status === 'archived' ? status : 'draft'
}

function normalizeCardStatus(value: unknown): RateCard['status'] {
  const status = readOptionalString(value)
  return status === 'active' || status === 'archived' ? status : 'draft'
}

function normalizeRuleStatus(value: unknown): RateRule['status'] {
  const status = readOptionalString(value)
  return status === 'active' || status === 'archived' ? status : 'draft'
}

function normalizeActionType(value: unknown): RateRule['action_type'] {
  const action = readOptionalString(value)
  if (
    action === 'multiply_bill_rate' ||
    action === 'add_percent' ||
    action === 'add_amount'
  ) {
    return action
  }
  return 'multiply_bill_rate'
}

function normalizeValueType(
  value: unknown,
): RateStructureComponent['value_type'] {
  return readOptionalString(value) === 'percentage'
    ? 'percentage'
    : 'currency'
}

function normalizeCalculationRole(
  value: unknown,
): RateStructureComponent['calculation_role'] {
  const role = readOptionalString(value)
  if (role === 'additive_percent' || role === 'additive_amount') {
    return role
  }
  return 'base'
}

function normalizeUnit(value: unknown): RateCard['unit'] {
  return readOptionalString(value) === 'day' ? 'day' : 'hour'
}

function normalizeLookupOption(value: unknown): RateLookupOption | null {
  if (typeof value === 'string') {
    return {
      value,
      label: value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase()),
    }
  }

  if (!value || typeof value !== 'object') return null

  const row = value as Record<string, unknown>
  const optionValue =
    readOptionalString(row.value) ||
    readOptionalString(row.key) ||
    readOptionalString(row.code)
  if (!optionValue) return null

  return {
    value: optionValue,
    label:
      readOptionalString(row.label) ||
      optionValue
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase()),
  }
}

function normalizeConditionFieldOption(
  value: unknown,
): RateRuleConditionFieldOption | null {
  if (typeof value === 'string') {
    return {
      value,
      label: value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase()),
    }
  }

  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const base = normalizeLookupOption(row)
  if (!base) return null

  return {
    ...base,
    data_type:
      readOptionalString(row.data_type) ||
      readOptionalString(row.value_type) ||
      undefined,
  }
}

function normalizeLookupOptions(
  value: unknown,
  fallback: RateLookupOption[],
): RateLookupOption[] {
  const rows = Array.isArray(value)
    ? value
        .map((entry) => normalizeLookupOption(entry))
        .filter((entry): entry is RateLookupOption => Boolean(entry))
    : []

  return rows.length ? rows : fallback
}

function normalizeConditionFieldOptions(
  value: unknown,
  fallback: RateRuleConditionFieldOption[],
): RateRuleConditionFieldOption[] {
  const rows = Array.isArray(value)
    ? value
        .map((entry) => normalizeConditionFieldOption(entry))
        .filter(
          (entry): entry is RateRuleConditionFieldOption => Boolean(entry),
        )
    : []

  return rows.length ? rows : fallback
}

function normalizeRateStructureComponent(
  row: Record<string, unknown>,
): RateStructureComponent {
  return {
    id: readOptionalNumber(row.id),
    sequence: readOptionalNumber(row.sequence) || 1,
    code: readOptionalString(row.code),
    label: readOptionalString(row.label) || '',
    value_type: normalizeValueType(row.value_type),
    calculation_role: normalizeCalculationRole(row.calculation_role),
    is_required: row.is_required !== false,
    is_active: row.is_active !== false,
  }
}

function normalizeRateStructure(
  row: Record<string, unknown>,
): RateStructure {
  const components = Array.isArray(row.components)
    ? row.components
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeRateStructureComponent(entry))
        .sort((left, right) => left.sequence - right.sequence)
    : []

  return {
    id: readOptionalNumber(row.id) || 0,
    name: readOptionalString(row.name) || '',
    description: readOptionalString(row.description) || '',
    status: normalizeStructureStatus(row.status),
    currency_mode: 'single_currency',
    rounding_scale: readOptionalNumber(row.rounding_scale) ?? 2,
    is_default: row.is_default === true,
    components,
    component_count:
      readOptionalNumber(row.component_count) ?? components.length,
    created_at: readOptionalString(row.created_at) || '',
    updated_at: readOptionalString(row.updated_at) || '',
  }
}

function normalizeRateCardLineValue(
  row: Record<string, unknown>,
): RateCardLineValue {
  return {
    id: readOptionalNumber(row.id),
    rate_structure_component:
      readOptionalNumber(row.rate_structure_component) || 0,
    component_code: readOptionalString(row.component_code),
    component_label: readOptionalString(row.component_label),
    value_type:
      readOptionalString(row.value_type) === 'percentage'
        ? 'percentage'
        : readOptionalString(row.value_type) === 'currency'
          ? 'currency'
          : undefined,
    numeric_value: readOptionalString(row.numeric_value) || '',
  }
}

function normalizeRateCardLine(
  row: Record<string, unknown>,
): RateCardLine {
  const componentValues = Array.isArray(row.component_values)
    ? row.component_values
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeRateCardLineValue(entry))
    : []

  return {
    id: readOptionalNumber(row.id),
    sequence: readOptionalNumber(row.sequence) || 1,
    supplier: readOptionalNumber(row.supplier) || 0,
    supplier_name:
      readOptionalString(row.supplier_name) ||
      readOptionalString(row.supplier_label),
    location_label: readOptionalString(row.location_label) || '',
    bill_rate:
      readOptionalString(row.bill_rate) ||
      readOptionalString(row.computed_bill_rate),
    component_values: componentValues,
  }
}

function normalizeRateCard(
  row: Record<string, unknown>,
): RateCard {
  const lines = Array.isArray(row.lines)
    ? row.lines
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeRateCardLine(entry))
        .sort((left, right) => left.sequence - right.sequence)
    : undefined

  const rateStructureComponents = Array.isArray(row.rate_structure_components)
    ? row.rate_structure_components
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeRateStructureComponent(entry))
        .sort((left, right) => left.sequence - right.sequence)
    : undefined

  return {
    id: readOptionalNumber(row.id) || 0,
    name: readOptionalString(row.name) || '',
    role_definition:
      readOptionalNumber(row.role_definition) ||
      readOptionalNumber(row.role_definition_id) ||
      0,
    role_name:
      readOptionalString(row.role_name) ||
      readOptionalString(row.role_definition_name),
    currency: readOptionalString(row.currency) || '',
    unit: normalizeUnit(row.unit),
    effective_date: readOptionalString(row.effective_date) || '',
    end_date: readOptionalString(row.end_date) || null,
    rate_structure:
      readOptionalNumber(row.rate_structure) ||
      readOptionalNumber(row.rate_structure_id) ||
      0,
    rate_structure_name:
      readOptionalString(row.rate_structure_name) ||
      readOptionalString(row.rate_structure_label),
    rate_structure_components: rateStructureComponents,
    status: normalizeCardStatus(row.status),
    notes: readOptionalString(row.notes) || '',
    lines,
    created_at: readOptionalString(row.created_at) || '',
    updated_at: readOptionalString(row.updated_at) || '',
  }
}

function normalizeRateRuleCondition(
  row: Record<string, unknown>,
): RateRuleCondition {
  return {
    id: readOptionalNumber(row.id),
    sequence: readOptionalNumber(row.sequence) || 1,
    joiner: readOptionalString(row.joiner) === 'or' ? 'or' : 'and',
    field_key: readOptionalString(row.field_key) || '',
    field_label: readOptionalString(row.field_label),
    data_type:
      readOptionalString(row.data_type) === 'number' ||
      readOptionalString(row.data_type) === 'boolean'
        ? (readOptionalString(row.data_type) as 'number' | 'boolean')
        : readOptionalString(row.data_type) === 'text'
          ? 'text'
          : undefined,
    operator: readOptionalString(row.operator) || '',
    value: row.value === undefined ? null : row.value,
  }
}

function normalizeRateRule(
  row: Record<string, unknown>,
): RateRule {
  const conditions = Array.isArray(row.conditions)
    ? row.conditions
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object',
        )
        .map((entry) => normalizeRateRuleCondition(entry))
        .sort((left, right) => left.sequence - right.sequence)
    : undefined

  return {
    id: readOptionalNumber(row.id) || 0,
    name: readOptionalString(row.name) || '',
    description: readOptionalString(row.description) || '',
    priority: readOptionalNumber(row.priority) || 0,
    status: normalizeRuleStatus(row.status),
    rate_structure:
      readOptionalNumber(row.rate_structure) ??
      readOptionalNumber(row.rate_structure_id) ??
      null,
    rate_structure_name:
      readOptionalString(row.rate_structure_name) ||
      readOptionalString(row.rate_structure_label),
    role_definition:
      readOptionalNumber(row.role_definition) ??
      readOptionalNumber(row.role_definition_id) ??
      null,
    role_name:
      readOptionalString(row.role_name) ||
      readOptionalString(row.role_definition_name),
    effective_date: readOptionalString(row.effective_date) || '',
    end_date: readOptionalString(row.end_date) || null,
    action_type: normalizeActionType(row.action_type),
    action_value: readOptionalString(row.action_value) || '',
    stop_processing: row.stop_processing === true,
    conditions,
    created_at: readOptionalString(row.created_at) || '',
    updated_at: readOptionalString(row.updated_at) || '',
  }
}

function toRateStructureComponentPayload(
  component: RateStructureComponent,
) {
  return sanitizePayload({
    sequence: component.sequence,
    label: component.label.trim(),
    value_type: component.value_type,
    calculation_role: component.calculation_role,
    is_required: component.is_required,
    is_active: component.is_active,
  })
}

function toRateStructureCreatePayload(
  payload: RateStructureCreatePayload,
) {
  return sanitizePayload({
    name: payload.name.trim(),
    description: payload.description?.trim() || '',
    status: payload.status,
    currency_mode: 'single_currency',
    rounding_scale: payload.rounding_scale,
    is_default: payload.is_default,
    components: payload.components.map((component) =>
      toRateStructureComponentPayload(component),
    ),
  })
}

function toRateStructureUpdatePayload(
  payload: RateStructureUpdatePayload,
) {
  return sanitizePayload({
    name: payload.name?.trim(),
    description: payload.description?.trim(),
    status: payload.status,
    currency_mode: payload.currency_mode,
    rounding_scale: payload.rounding_scale,
    is_default: payload.is_default,
    components: payload.components?.map((component) =>
      toRateStructureComponentPayload(component),
    ),
  })
}

function toRateCardLineValuePayload(value: RateCardLineValue) {
  return sanitizePayload({
    rate_structure_component: value.rate_structure_component,
    numeric_value: value.numeric_value,
  })
}

function toRateCardLinePayload(line: RateCardLine) {
  return sanitizePayload({
    sequence: line.sequence,
    supplier: line.supplier,
    location_label: line.location_label.trim(),
    component_values: line.component_values.map((value) =>
      toRateCardLineValuePayload(value),
    ),
  })
}

function toRateCardCreatePayload(payload: RateCardCreatePayload) {
  return sanitizePayload({
    name: payload.name.trim(),
    role_definition: payload.role_definition,
    currency: payload.currency.trim().toUpperCase(),
    unit: payload.unit,
    effective_date: payload.effective_date,
    end_date: payload.end_date || null,
    rate_structure: payload.rate_structure,
    status: payload.status,
    notes: payload.notes?.trim() || '',
    lines: payload.lines.map((line) => toRateCardLinePayload(line)),
  })
}

function toRateCardUpdatePayload(payload: RateCardUpdatePayload) {
  return sanitizePayload({
    name: payload.name?.trim(),
    role_definition: payload.role_definition,
    currency: payload.currency?.trim().toUpperCase(),
    unit: payload.unit,
    effective_date: payload.effective_date,
    end_date:
      payload.end_date === undefined
        ? undefined
        : payload.end_date || null,
    rate_structure: payload.rate_structure,
    status: payload.status,
    notes: payload.notes?.trim(),
    lines: payload.lines?.map((line) => toRateCardLinePayload(line)),
  })
}

function toRateRuleConditionPayload(
  condition: RateRuleCondition,
) {
  return sanitizePayload({
    sequence: condition.sequence,
    joiner: condition.joiner,
    field_key: condition.field_key,
    operator: condition.operator,
    value: condition.value === undefined ? null : condition.value,
  })
}

function toRateRuleCreatePayload(payload: RateRuleCreatePayload) {
  return sanitizePayload({
    name: payload.name.trim(),
    description: payload.description?.trim() || '',
    priority: payload.priority,
    status: payload.status,
    rate_structure: payload.rate_structure,
    role_definition: payload.role_definition,
    effective_date: payload.effective_date,
    end_date: payload.end_date || null,
    action_type: payload.action_type,
    action_value: payload.action_value.trim(),
    stop_processing: payload.stop_processing,
    conditions: payload.conditions.map((condition) =>
      toRateRuleConditionPayload(condition),
    ),
  })
}

function toRateRuleUpdatePayload(payload: RateRuleUpdatePayload) {
  return sanitizePayload({
    name: payload.name?.trim(),
    description: payload.description?.trim(),
    priority: payload.priority,
    status: payload.status,
    rate_structure: payload.rate_structure,
    role_definition: payload.role_definition,
    effective_date: payload.effective_date,
    end_date:
      payload.end_date === undefined
        ? undefined
        : payload.end_date || null,
    action_type: payload.action_type,
    action_value: payload.action_value?.trim(),
    stop_processing: payload.stop_processing,
    conditions: payload.conditions?.map((condition) =>
      toRateRuleConditionPayload(condition),
    ),
  })
}

function buildRateStructuresQuery(
  params: RateStructureListParams = {},
) {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  }
  if (params.status?.trim()) {
    query.set('status', params.status.trim())
  }

  const isDefault = toBooleanString(params.is_default)
  if (isDefault) {
    query.set('is_default', isDefault)
  }

  const suffix = query.toString()
  return suffix
    ? `/api/rate-structures/?${suffix}`
    : '/api/rate-structures/'
}

function buildRateCardsQuery(params: RateCardListParams = {}) {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  }
  if (params.status?.trim()) {
    query.set('status', params.status.trim())
  }

  const roleDefinition =
    params.role_definition ?? params.role_definition_id
  if (
    roleDefinition !== undefined &&
    roleDefinition !== null &&
    String(roleDefinition).trim()
  ) {
    query.set('role_definition', String(roleDefinition).trim())
  }

  const rateStructure =
    params.rate_structure ?? params.rate_structure_id
  if (
    rateStructure !== undefined &&
    rateStructure !== null &&
    String(rateStructure).trim()
  ) {
    query.set('rate_structure', String(rateStructure).trim())
  }

  if (params.currency?.trim()) {
    query.set('currency', params.currency.trim().toUpperCase())
  }
  if (params.unit?.trim()) {
    query.set('unit', params.unit.trim().toLowerCase())
  }

  const suffix = query.toString()
  return suffix ? `/api/rate-cards/?${suffix}` : '/api/rate-cards/'
}

function buildRateRulesQuery(params: RateRuleListParams = {}) {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  }
  if (params.status?.trim()) {
    query.set('status', params.status.trim())
  }

  const roleDefinition =
    params.role_definition ?? params.role_definition_id
  if (
    roleDefinition !== undefined &&
    roleDefinition !== null &&
    String(roleDefinition).trim()
  ) {
    query.set('role_definition', String(roleDefinition).trim())
  }

  const rateStructure =
    params.rate_structure ?? params.rate_structure_id
  if (
    rateStructure !== undefined &&
    rateStructure !== null &&
    String(rateStructure).trim()
  ) {
    query.set('rate_structure', String(rateStructure).trim())
  }

  const suffix = query.toString()
  return suffix ? `/api/rate-rules/?${suffix}` : '/api/rate-rules/'
}

async function getJson<T>(
  path: string,
  fallbackMessage: string,
  normalize: (payload: Record<string, unknown>) => T,
): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, fallbackMessage)
  }

  if (!body || typeof body !== 'object') {
    return normalize({})
  }

  return normalize(body as Record<string, unknown>)
}

async function postJson<T>(
  path: string,
  payload: Record<string, unknown>,
  fallbackMessage: string,
  normalize: (payload: Record<string, unknown>) => T,
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, fallbackMessage)
  }

  if (!body || typeof body !== 'object') {
    return normalize({})
  }

  return normalize(body as Record<string, unknown>)
}

async function patchJson<T>(
  path: string,
  payload: Record<string, unknown>,
  fallbackMessage: string,
  normalize: (payload: Record<string, unknown>) => T,
): Promise<T> {
  const response = await fetch(path, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(),
    },
    body: JSON.stringify(payload),
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(response, body, fallbackMessage)
  }

  if (!body || typeof body !== 'object') {
    return normalize({})
  }

  return normalize(body as Record<string, unknown>)
}

async function deleteRequest(path: string, fallbackMessage: string) {
  const response = await fetch(path, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...getCsrfHeaders(),
    },
  })

  if (response.ok || response.status === 204) {
    return
  }

  const body = await parseJsonSafe(response)
  throwApiError(response, body, fallbackMessage)
}

export async function getRateStructures(
  params: RateStructureListParams = {},
): Promise<RateStructure[]> {
  const response = await fetch(buildRateStructuresQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load rate structures (${response.status})`,
    )
  }

  return extractRows(body).map((row) => normalizeRateStructure(row))
}

export function getRateStructure(
  structureId: number | string,
): Promise<RateStructure> {
  return getJson(
    `/api/rate-structures/${encodeURIComponent(String(structureId))}/`,
    'Failed to load rate structure.',
    normalizeRateStructure,
  )
}

export function createRateStructure(
  payload: RateStructureCreatePayload,
): Promise<RateStructure> {
  return postJson(
    '/api/rate-structures/',
    toRateStructureCreatePayload(payload),
    'Failed to create rate structure.',
    normalizeRateStructure,
  )
}

export function updateRateStructure(
  structureId: number | string,
  payload: RateStructureUpdatePayload,
): Promise<RateStructure> {
  return patchJson(
    `/api/rate-structures/${encodeURIComponent(String(structureId))}/`,
    toRateStructureUpdatePayload(payload),
    'Failed to update rate structure.',
    normalizeRateStructure,
  )
}

export function deleteRateStructure(structureId: number | string) {
  return deleteRequest(
    `/api/rate-structures/${encodeURIComponent(String(structureId))}/`,
    'Failed to delete rate structure.',
  )
}

export function cloneRateStructure(
  structureId: number | string,
): Promise<RateStructure> {
  return postJson(
    `/api/rate-structures/${encodeURIComponent(String(structureId))}/clone/`,
    {},
    'Failed to clone rate structure.',
    normalizeRateStructure,
  )
}

export async function previewRateStructure(
  structureId: number | string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(
    `/api/rate-structures/${encodeURIComponent(String(structureId))}/preview/`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(payload),
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to preview rate structure (${response.status})`,
    )
  }

  return body
}

export async function getRateCards(
  params: RateCardListParams = {},
): Promise<RateCard[]> {
  const response = await fetch(buildRateCardsQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load rate cards (${response.status})`,
    )
  }

  return extractRows(body).map((row) => normalizeRateCard(row))
}

export function getRateCard(cardId: number | string): Promise<RateCard> {
  return getJson(
    `/api/rate-cards/${encodeURIComponent(String(cardId))}/`,
    'Failed to load rate card.',
    normalizeRateCard,
  )
}

export function createRateCard(
  payload: RateCardCreatePayload,
): Promise<RateCard> {
  return postJson(
    '/api/rate-cards/',
    toRateCardCreatePayload(payload),
    'Failed to create rate card.',
    normalizeRateCard,
  )
}

export function updateRateCard(
  cardId: number | string,
  payload: RateCardUpdatePayload,
): Promise<RateCard> {
  return patchJson(
    `/api/rate-cards/${encodeURIComponent(String(cardId))}/`,
    toRateCardUpdatePayload(payload),
    'Failed to update rate card.',
    normalizeRateCard,
  )
}

export function deleteRateCard(cardId: number | string) {
  return deleteRequest(
    `/api/rate-cards/${encodeURIComponent(String(cardId))}/`,
    'Failed to delete rate card.',
  )
}

export function recalculateRateCard(
  cardId: number | string,
): Promise<RateCard> {
  return postJson(
    `/api/rate-cards/${encodeURIComponent(String(cardId))}/recalculate/`,
    {},
    'Failed to recalculate rate card.',
    normalizeRateCard,
  )
}

export function activateRateCard(
  cardId: number | string,
): Promise<RateCard> {
  return postJson(
    `/api/rate-cards/${encodeURIComponent(String(cardId))}/activate/`,
    {},
    'Failed to activate rate card.',
    normalizeRateCard,
  )
}

export async function getRateRules(
  params: RateRuleListParams = {},
): Promise<RateRule[]> {
  const response = await fetch(buildRateRulesQuery(params), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load rate rules (${response.status})`,
    )
  }

  return extractRows(body).map((row) => normalizeRateRule(row))
}

export function getRateRule(ruleId: number | string): Promise<RateRule> {
  return getJson(
    `/api/rate-rules/${encodeURIComponent(String(ruleId))}/`,
    'Failed to load rate rule.',
    normalizeRateRule,
  )
}

export function createRateRule(
  payload: RateRuleCreatePayload,
): Promise<RateRule> {
  return postJson(
    '/api/rate-rules/',
    toRateRuleCreatePayload(payload),
    'Failed to create rate rule.',
    normalizeRateRule,
  )
}

export function updateRateRule(
  ruleId: number | string,
  payload: RateRuleUpdatePayload,
): Promise<RateRule> {
  return patchJson(
    `/api/rate-rules/${encodeURIComponent(String(ruleId))}/`,
    toRateRuleUpdatePayload(payload),
    'Failed to update rate rule.',
    normalizeRateRule,
  )
}

export function deleteRateRule(ruleId: number | string) {
  return deleteRequest(
    `/api/rate-rules/${encodeURIComponent(String(ruleId))}/`,
    'Failed to delete rate rule.',
  )
}

export async function previewRateRule(
  ruleId: number | string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(
    `/api/rate-rules/${encodeURIComponent(String(ruleId))}/preview/`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify(payload),
    },
  )

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to preview rate rule (${response.status})`,
    )
  }

  return body
}

export async function getRateLookups(): Promise<RateLookups> {
  const response = await fetch('/api/rates/lookups/', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  const body = await parseJsonSafe(response)
  if (!response.ok) {
    throwApiError(
      response,
      body,
      `Failed to load rate lookups (${response.status})`,
    )
  }

  const payload =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {}

  return {
    rate_structure_statuses: normalizeLookupOptions(
      payload.rate_structure_statuses ?? payload.structure_statuses,
      DEFAULT_RATE_LOOKUPS.rate_structure_statuses,
    ),
    rate_card_statuses: normalizeLookupOptions(
      payload.rate_card_statuses ?? payload.card_statuses,
      DEFAULT_RATE_LOOKUPS.rate_card_statuses,
    ),
    rate_rule_statuses: normalizeLookupOptions(
      payload.rate_rule_statuses ?? payload.rule_statuses,
      DEFAULT_RATE_LOOKUPS.rate_rule_statuses,
    ),
    units: normalizeLookupOptions(
      payload.units,
      DEFAULT_RATE_LOOKUPS.units,
    ),
    action_types: normalizeLookupOptions(
      payload.action_types ?? payload.rule_action_types,
      DEFAULT_RATE_LOOKUPS.action_types,
    ),
    rule_condition_fields: normalizeConditionFieldOptions(
      payload.rule_condition_fields ?? payload.condition_fields,
      DEFAULT_RATE_LOOKUPS.rule_condition_fields,
    ),
    rule_condition_operators: normalizeLookupOptions(
      payload.rule_condition_operators ?? payload.condition_operators,
      DEFAULT_RATE_LOOKUPS.rule_condition_operators,
    ),
    rule_condition_joiners: normalizeLookupOptions(
      payload.rule_condition_joiners ?? payload.condition_joiners,
      DEFAULT_RATE_LOOKUPS.rule_condition_joiners,
    ),
  }
}
