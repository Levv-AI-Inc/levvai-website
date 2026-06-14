'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import ApproverAutocomplete from './ApproverAutocomplete'
import {
  ApprovalChainsApiError,
  createApprovalChain,
  getApprovalChain,
  getApprovalChainCatalog,
  simulateApprovalChains,
  updateApprovalChain,
  type ApprovalChain,
  type ApprovalChainCatalog,
  type ApprovalChainCatalogOperator,
  type ApprovalChainCondition,
  type ApprovalChainCreatePayload,
  type ApprovalChainSimulationResponse,
  type ApprovalChainStep,
} from '@/lib/api/approvalChains'
import {
  BusinessUnitsApiError,
  getBusinessUnits,
  type BusinessUnitRecord,
} from '@/lib/api/businessUnits'
import {
  CostCentersApiError,
  getCostCenters,
  type CostCenterRecord,
} from '@/lib/api/costCenters'
import {
  LegalEntitiesApiError,
  getLegalEntities,
  type LegalEntityRecord,
} from '@/lib/api/legalEntities'
import {
  getRoles,
  RolesApiError,
  type RoleRecord,
} from '@/lib/api/roles'
import {
  SitesApiError,
  getSites,
  type SiteRecord,
} from '@/lib/api/sites'
import {
  ApiError as SuppliersApiError,
  getSuppliers,
  type SupplierRecord,
} from '@/lib/api/suppliers'
import { COUNTRY_OPTIONS } from '@/lib/constants/countries'

type LookupOption = {
  value: string
  label: string
}

type LookupResourceKey =
  | 'businessUnits'
  | 'costCenters'
  | 'sites'
  | 'legalEntities'
  | 'suppliers'
  | 'roles'

type LookupDataState = {
  businessUnits: BusinessUnitRecord[]
  costCenters: CostCenterRecord[]
  sites: SiteRecord[]
  legalEntities: LegalEntityRecord[]
  suppliers: SupplierRecord[]
  roles: RoleRecord[]
}

type LookupLoadingState = Record<LookupResourceKey, boolean>
type LookupLoadedState = Record<LookupResourceKey, boolean>
type LookupErrorState = Record<LookupResourceKey, string>

type ConditionDraft = {
  client_id: string
  id?: number
  selected_field_key: string
  dynamic_field_key: string
  operator: string
  value: unknown
}

type StepDraft = {
  client_id: string
  id?: number
  approver: number | null
  approver_name: string
  amount: string
  currency: string
}

type FormState = {
  name: string
  description: string
  is_active: boolean
  priority: string
  match_strategy: 'all' | 'any'
  conditions: ConditionDraft[]
  steps: StepDraft[]
}

const NO_VALUE_OPERATORS = new Set([
  'is_blank',
  'is_not_blank',
  'is_true',
  'is_false',
])

const MULTI_VALUE_OPERATORS = new Set(['in', 'not_in'])
const RANGE_VALUE_OPERATORS = new Set(['between'])

const EMPTY_LOOKUP_DATA: LookupDataState = {
  businessUnits: [],
  costCenters: [],
  sites: [],
  legalEntities: [],
  suppliers: [],
  roles: [],
}

const EMPTY_LOOKUP_LOADING: LookupLoadingState = {
  businessUnits: false,
  costCenters: false,
  sites: false,
  legalEntities: false,
  suppliers: false,
  roles: false,
}

const EMPTY_LOOKUP_LOADED: LookupLoadedState = {
  businessUnits: false,
  costCenters: false,
  sites: false,
  legalEntities: false,
  suppliers: false,
  roles: false,
}

const EMPTY_LOOKUP_ERRORS: LookupErrorState = {
  businessUnits: '',
  costCenters: '',
  sites: '',
  legalEntities: '',
  suppliers: '',
  roles: '',
}

const DEFAULT_SIMULATION_INPUT = `{
  "commodity": "software",
  "budget_amount": "2500",
  "country": "CA"
}`

function createClientId() {
  return Math.random().toString(36).slice(2, 10)
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

function uniqueOptions(options: LookupOption[]) {
  const seen = new Set<string>()
  const rows = options.filter((option) => {
    if (!option.value) return false
    if (seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })

  rows.sort((left, right) => left.label.localeCompare(right.label))
  return rows
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

function valueToTextarea(value: unknown) {
  return valueToStringArray(value).join('\n')
}

function defaultValueForOperator(operator: string): unknown {
  if (NO_VALUE_OPERATORS.has(operator)) return null
  if (MULTI_VALUE_OPERATORS.has(operator)) return []
  if (RANGE_VALUE_OPERATORS.has(operator)) return ['', '']
  return ''
}

function normalizeLoadedValue(operator: string, value: unknown): unknown {
  if (NO_VALUE_OPERATORS.has(operator)) return null
  if (MULTI_VALUE_OPERATORS.has(operator)) return valueToStringArray(value)
  if (RANGE_VALUE_OPERATORS.has(operator)) return valueToRangeArray(value)
  return valueToScalarString(value)
}

function isNumericDataType(
  fieldKey: string,
  dataType: string | undefined,
) {
  if (dataType === 'number' || dataType === 'integer' || dataType === 'decimal') {
    return true
  }

  return ['budget_amount', 'target_rate', 'worker_count'].includes(fieldKey)
}

function isDateDataType(
  fieldKey: string,
  dataType: string | undefined,
) {
  if (dataType === 'date' || dataType === 'datetime') return true
  return fieldKey.endsWith('_date')
}

function getDynamicCatalogField(catalog: ApprovalChainCatalog) {
  return (
    catalog.fields.find((field) => field.dynamic === true) || null
  )
}

function getFieldForSelection(
  catalog: ApprovalChainCatalog,
  selectedFieldKey: string,
) {
  if (!selectedFieldKey) return null

  const exactMatch =
    catalog.fields.find((field) => field.key === selectedFieldKey) || null

  if (exactMatch) return exactMatch

  if (selectedFieldKey.startsWith('custom_fields.')) {
    return getDynamicCatalogField(catalog)
  }

  return null
}

function getOperatorsForSelection(
  catalog: ApprovalChainCatalog,
  selectedFieldKey: string,
) {
  const field = getFieldForSelection(catalog, selectedFieldKey)
  if (field?.supported_operators?.length) {
    return field.supported_operators
  }
  return catalog.operators
}

function getDefaultOperatorForSelection(
  catalog: ApprovalChainCatalog,
  selectedFieldKey: string,
) {
  return (
    getOperatorsForSelection(catalog, selectedFieldKey)[0]?.key || 'equals'
  )
}

function createConditionDraft(
  catalog: ApprovalChainCatalog,
  selectedFieldKey?: string,
) {
  const initialFieldKey =
    selectedFieldKey ||
    catalog.fields[0]?.key ||
    getDynamicCatalogField(catalog)?.key ||
    ''
  const operator = getDefaultOperatorForSelection(
    catalog,
    initialFieldKey,
  )

  return {
    client_id: createClientId(),
    selected_field_key: initialFieldKey,
    dynamic_field_key: '',
    operator,
    value: defaultValueForOperator(operator),
  }
}

function createStepDraft(): StepDraft {
  return {
    client_id: createClientId(),
    approver: null,
    approver_name: '',
    amount: '',
    currency: 'USD',
  }
}

function buildDefaultForm(catalog: ApprovalChainCatalog): FormState {
  return {
    name: '',
    description: '',
    is_active: true,
    priority: '10',
    match_strategy: 'all',
    conditions: [createConditionDraft(catalog)],
    steps: [createStepDraft()],
  }
}

function mapChainToForm(
  chain: ApprovalChain,
  catalog: ApprovalChainCatalog,
): FormState {
  const dynamicField = getDynamicCatalogField(catalog)

  return {
    name: chain.name,
    description: chain.description || '',
    is_active: chain.is_active,
    priority: String(chain.priority),
    match_strategy: chain.match_strategy,
    conditions:
      chain.conditions.length > 0
        ? chain.conditions.map((condition) => {
            let selectedFieldKey = condition.field_key
            let dynamicFieldKey = ''

            if (
              !getFieldForSelection(catalog, condition.field_key) &&
              dynamicField &&
              condition.field_key.startsWith('custom_fields.')
            ) {
              selectedFieldKey = dynamicField.key
              dynamicFieldKey = condition.field_key.slice(
                'custom_fields.'.length,
              )
            }

            const operators = getOperatorsForSelection(
              catalog,
              selectedFieldKey,
            )
            const operator =
              operators.find((entry) => entry.key === condition.operator)
                ?.key ||
              condition.operator ||
              operators[0]?.key ||
              'equals'

            return {
              client_id: createClientId(),
              id: condition.id,
              selected_field_key: selectedFieldKey,
              dynamic_field_key: dynamicFieldKey,
              operator,
              value: normalizeLoadedValue(operator, condition.value),
            }
          })
        : [createConditionDraft(catalog)],
    steps:
      chain.steps.length > 0
        ? chain.steps.map((step) => ({
            client_id: createClientId(),
            id: step.id,
            approver: step.approver || null,
            approver_name: step.approver_name || '',
            amount: step.amount || '',
            currency: step.currency || 'USD',
          }))
        : [createStepDraft()],
  }
}

function resolveConditionFieldKey(condition: ConditionDraft) {
  if (condition.selected_field_key === 'custom_fields.*') {
    const suffix = condition.dynamic_field_key.trim()
    return suffix ? `custom_fields.${suffix}` : 'custom_fields.'
  }

  return condition.selected_field_key
}

function operatorRequiresValue(
  operator: ApprovalChainCatalogOperator | null,
  operatorKey: string,
) {
  if (operator) return operator.value_required !== false
  return !NO_VALUE_OPERATORS.has(operatorKey)
}

function normalizeConditionValueForPayload(
  operatorKey: string,
  value: unknown,
) {
  if (NO_VALUE_OPERATORS.has(operatorKey)) return null

  if (MULTI_VALUE_OPERATORS.has(operatorKey)) {
    return valueToStringArray(value)
  }

  if (RANGE_VALUE_OPERATORS.has(operatorKey)) {
    return valueToRangeArray(value)
  }

  return valueToScalarString(value).trim()
}

function mapFormToPayload(
  form: FormState,
): ApprovalChainCreatePayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    is_active: form.is_active,
    priority: Number(form.priority),
    match_strategy: form.match_strategy,
    conditions: form.conditions.map(
      (condition, index): ApprovalChainCondition => ({
        sequence: index + 1,
        field_key: resolveConditionFieldKey(condition),
        operator: condition.operator,
        value: normalizeConditionValueForPayload(
          condition.operator,
          condition.value,
        ),
      }),
    ),
    steps: form.steps.map(
      (step, index): ApprovalChainStep => ({
        sequence: index + 1,
        step_type: 'specific_user',
        approver: step.approver || 0,
        amount: step.amount.trim(),
        currency: step.currency.trim().toUpperCase(),
      }),
    ),
  }
}

function getLookupResourceForField(
  fieldKey: string,
): LookupResourceKey | null {
  if (
    fieldKey === 'business_unit_id' ||
    fieldKey === 'business_unit_code' ||
    fieldKey === 'business_unit_name'
  ) {
    return 'businessUnits'
  }

  if (
    fieldKey === 'cost_center_id' ||
    fieldKey === 'cost_center_code' ||
    fieldKey === 'cost_center_name'
  ) {
    return 'costCenters'
  }

  if (
    fieldKey === 'site_id' ||
    fieldKey === 'site_code' ||
    fieldKey === 'site_name'
  ) {
    return 'sites'
  }

  if (fieldKey === 'legal_entity_id') {
    return 'legalEntities'
  }

  if (
    fieldKey === 'supplier_id' ||
    fieldKey === 'supplier_name' ||
    fieldKey === 'supplier_type' ||
    fieldKey === 'supplier_category' ||
    fieldKey === 'supplier_risk_level'
  ) {
    return 'suppliers'
  }

  if (fieldKey === 'job_title') {
    return 'roles'
  }

  return null
}

function getLookupOptionsForField(
  fieldKey: string,
  lookupData: LookupDataState,
) {
  if (fieldKey === 'country' || fieldKey.endsWith('_country')) {
    return COUNTRY_OPTIONS.map((country) => ({
      value: country.value,
      label: country.label,
    }))
  }

  switch (fieldKey) {
    case 'business_unit_id':
      return uniqueOptions(
        lookupData.businessUnits.map((unit) => ({
          value: String(unit.id),
          label: unit.code
            ? `${unit.name} (${unit.code})`
            : unit.name,
        })),
      )
    case 'business_unit_code':
      return uniqueOptions(
        lookupData.businessUnits.map((unit) => ({
          value: unit.code,
          label: unit.code,
        })),
      )
    case 'business_unit_name':
      return uniqueOptions(
        lookupData.businessUnits.map((unit) => ({
          value: unit.name,
          label: unit.name,
        })),
      )
    case 'cost_center_id':
      return uniqueOptions(
        lookupData.costCenters.map((center) => ({
          value: String(center.id),
          label: center.code
            ? `${center.name} (${center.code})`
            : center.name,
        })),
      )
    case 'cost_center_code':
      return uniqueOptions(
        lookupData.costCenters.map((center) => ({
          value: center.code,
          label: center.code,
        })),
      )
    case 'cost_center_name':
      return uniqueOptions(
        lookupData.costCenters.map((center) => ({
          value: center.name,
          label: center.name,
        })),
      )
    case 'site_id':
      return uniqueOptions(
        lookupData.sites.map((site) => ({
          value: String(site.id),
          label: site.code ? `${site.name} (${site.code})` : site.name,
        })),
      )
    case 'site_code':
      return uniqueOptions(
        lookupData.sites.map((site) => ({
          value: site.code,
          label: site.code,
        })),
      )
    case 'site_name':
      return uniqueOptions(
        lookupData.sites.map((site) => ({
          value: site.name,
          label: site.name,
        })),
      )
    case 'legal_entity_id':
      return uniqueOptions(
        lookupData.legalEntities.map((entity) => ({
          value: entity.id,
          label: `${entity.name} (${entity.id})`,
        })),
      )
    case 'supplier_id':
      return uniqueOptions(
        lookupData.suppliers.map((supplier) => ({
          value: String(supplier.id ?? supplier.supplier_id),
          label: supplier.name,
        })),
      )
    case 'supplier_name':
      return uniqueOptions(
        lookupData.suppliers.map((supplier) => ({
          value: supplier.name,
          label: supplier.name,
        })),
      )
    case 'supplier_type':
      return uniqueOptions(
        lookupData.suppliers.map((supplier) => ({
          value: supplier.supplier_type,
          label: supplier.supplier_type,
        })),
      )
    case 'supplier_category':
      return uniqueOptions(
        lookupData.suppliers.map((supplier) => ({
          value: supplier.category,
          label: supplier.category,
        })),
      )
    case 'supplier_risk_level':
      return uniqueOptions(
        lookupData.suppliers.map((supplier) => ({
          value: supplier.risk_level,
          label: supplier.risk_level,
        })),
      )
    case 'job_title':
      return uniqueOptions(
        lookupData.roles.map((role) => ({
          value: role.name,
          label: role.name,
        })),
      )
    default:
      return []
  }
}

type ApprovalChainEditorPageProps = {
  chainId?: string
}

export default function ApprovalChainEditorPage({
  chainId,
}: ApprovalChainEditorPageProps) {
  const router = useRouter()
  const isEditing = Boolean(chainId)

  const [catalog, setCatalog] = useState<ApprovalChainCatalog>({
    operators: [],
    fields: [],
  })
  const [form, setForm] = useState<FormState | null>(null)
  const [currentChain, setCurrentChain] = useState<ApprovalChain | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const [lookupData, setLookupData] =
    useState<LookupDataState>(EMPTY_LOOKUP_DATA)
  const [lookupLoading, setLookupLoading] =
    useState<LookupLoadingState>(EMPTY_LOOKUP_LOADING)
  const [lookupLoaded, setLookupLoaded] =
    useState<LookupLoadedState>(EMPTY_LOOKUP_LOADED)
  const [lookupErrors, setLookupErrors] =
    useState<LookupErrorState>(EMPTY_LOOKUP_ERRORS)

  const [simulationInput, setSimulationInput] = useState(
    DEFAULT_SIMULATION_INPUT,
  )
  const [includeInactive, setIncludeInactive] = useState(false)
  const [includeNonMatches, setIncludeNonMatches] = useState(false)
  const [simulationLoading, setSimulationLoading] = useState(false)
  const [simulationError, setSimulationError] = useState('')
  const [simulationResponse, setSimulationResponse] =
    useState<ApprovalChainSimulationResponse | null>(null)

  const sortedFields = useMemo(() => {
    const rows = [...catalog.fields]
    rows.sort((left, right) => left.label.localeCompare(right.label))
    return rows
  }, [catalog.fields])

  const loadLookup = useCallback(
    async (lookupKey: LookupResourceKey) => {
      if (lookupLoaded[lookupKey] || lookupLoading[lookupKey]) return

      setLookupLoading((current) => ({
        ...current,
        [lookupKey]: true,
      }))
      setLookupErrors((current) => ({
        ...current,
        [lookupKey]: '',
      }))

      try {
        switch (lookupKey) {
          case 'businessUnits': {
            const rows = await getBusinessUnits()
            setLookupData((current) => ({
              ...current,
              businessUnits: rows,
            }))
            break
          }
          case 'costCenters': {
            const rows = await getCostCenters()
            setLookupData((current) => ({
              ...current,
              costCenters: rows,
            }))
            break
          }
          case 'sites': {
            const rows = await getSites()
            setLookupData((current) => ({
              ...current,
              sites: rows,
            }))
            break
          }
          case 'legalEntities': {
            const rows = await getLegalEntities()
            setLookupData((current) => ({
              ...current,
              legalEntities: rows,
            }))
            break
          }
          case 'suppliers': {
            const rows = await getSuppliers()
            setLookupData((current) => ({
              ...current,
              suppliers: rows,
            }))
            break
          }
          case 'roles': {
            const rows = await getRoles()
            setLookupData((current) => ({
              ...current,
              roles: rows,
            }))
            break
          }
          default:
            break
        }

        setLookupLoaded((current) => ({
          ...current,
          [lookupKey]: true,
        }))
      } catch (requestError) {
        const loginNext = chainId
          ? `/admin/approval-chains/${chainId}`
          : '/admin/approval-chains/new'

        const isUnauthorized =
          (requestError instanceof BusinessUnitsApiError ||
            requestError instanceof CostCentersApiError ||
            requestError instanceof SitesApiError ||
            requestError instanceof LegalEntitiesApiError ||
            requestError instanceof SuppliersApiError ||
            requestError instanceof RolesApiError) &&
          requestError.status === 401

        if (isUnauthorized) {
          router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
          return
        }

        setLookupErrors((current) => ({
          ...current,
          [lookupKey]:
            requestError instanceof Error
              ? requestError.message
              : `Unable to load ${lookupKey}.`,
        }))
      } finally {
        setLookupLoading((current) => ({
          ...current,
          [lookupKey]: false,
        }))
      }
    },
    [chainId, lookupLoaded, lookupLoading, router],
  )

  useEffect(() => {
    let cancelled = false

    const loadPage = async () => {
      setLoading(true)
      setLoadError('')

      try {
        const catalogRows = await getApprovalChainCatalog()
        if (cancelled) return

        setCatalog(catalogRows)

        if (chainId) {
          const chain = await getApprovalChain(chainId)
          if (cancelled) return

          setCurrentChain(chain)
          setForm(mapChainToForm(chain, catalogRows))
        } else {
          setCurrentChain(null)
          setForm(buildDefaultForm(catalogRows))
        }
      } catch (requestError) {
        const loginNext = chainId
          ? `/admin/approval-chains/${chainId}`
          : '/admin/approval-chains/new'

        if (
          requestError instanceof ApprovalChainsApiError &&
          requestError.status === 401
        ) {
          router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
          return
        }

        if (cancelled) return
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load approval chain configuration.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPage()
    return () => {
      cancelled = true
    }
  }, [chainId, router])

  useEffect(() => {
    if (!form) return

    form.conditions.forEach((condition) => {
      const resourceKey = getLookupResourceForField(
        condition.selected_field_key,
      )
      if (resourceKey) {
        void loadLookup(resourceKey)
      }
    })
  }, [form, loadLookup])

  const getField = useCallback(
    (selectedFieldKey: string) =>
      getFieldForSelection(catalog, selectedFieldKey),
    [catalog],
  )

  const getOperators = useCallback(
    (selectedFieldKey: string) =>
      getOperatorsForSelection(catalog, selectedFieldKey),
    [catalog],
  )

  const updateCondition = useCallback(
    (
      clientId: string,
      updater: (condition: ConditionDraft) => ConditionDraft,
    ) => {
      setForm((current) => {
        if (!current) return current

        return {
          ...current,
          conditions: current.conditions.map((condition) =>
            condition.client_id === clientId
              ? updater(condition)
              : condition,
          ),
        }
      })
    },
    [],
  )

  const updateStep = useCallback(
    (clientId: string, updater: (step: StepDraft) => StepDraft) => {
      setForm((current) => {
        if (!current) return current

        return {
          ...current,
          steps: current.steps.map((step) =>
            step.client_id === clientId ? updater(step) : step,
          ),
        }
      })
    },
    [],
  )

  const validateForm = useCallback(() => {
    if (!form) return 'Approval chain form is not ready yet.'

    if (!form.name.trim()) {
      return 'Name is required.'
    }

    if (!form.priority.trim()) {
      return 'Priority is required.'
    }

    if (!Number.isFinite(Number(form.priority))) {
      return 'Priority must be a valid number.'
    }

    if (form.conditions.length === 0) {
      return 'Add at least one condition.'
    }

    for (let index = 0; index < form.conditions.length; index += 1) {
      const condition = form.conditions[index]
      const fieldKey = resolveConditionFieldKey(condition)
      const field = getField(condition.selected_field_key)
      const operator = getOperators(condition.selected_field_key).find(
        (entry) => entry.key === condition.operator,
      )

      if (!condition.selected_field_key) {
        return `Condition ${index + 1} needs a field.`
      }

      if (
        condition.selected_field_key === 'custom_fields.*' &&
        !condition.dynamic_field_key.trim()
      ) {
        return `Condition ${index + 1} needs a custom field key.`
      }

      if (!fieldKey.trim() || fieldKey.endsWith('.')) {
        return `Condition ${index + 1} has an invalid field key.`
      }

      if (!condition.operator) {
        return `Condition ${index + 1} needs an operator.`
      }

      if (!operatorRequiresValue(operator || null, condition.operator)) {
        continue
      }

      if (RANGE_VALUE_OPERATORS.has(condition.operator)) {
        const [start, end] = valueToRangeArray(condition.value)
        if (!start.trim() || !end.trim()) {
          return `Condition ${index + 1} needs both values for the range.`
        }
        continue
      }

      if (MULTI_VALUE_OPERATORS.has(condition.operator)) {
        if (valueToStringArray(condition.value).length === 0) {
          return `Condition ${index + 1} needs at least one value.`
        }
        continue
      }

      if (!valueToScalarString(condition.value).trim()) {
        return `Condition ${index + 1} needs a value.`
      }

      if (
        field &&
        isNumericDataType(field.key, field.data_type) &&
        !Number.isFinite(Number(valueToScalarString(condition.value)))
      ) {
        return `Condition ${index + 1} needs a numeric value.`
      }
    }

    if (form.steps.length === 0) {
      return 'Add at least one approver step.'
    }

    for (let index = 0; index < form.steps.length; index += 1) {
      const step = form.steps[index]
      if (step.approver === null) {
        return `Step ${index + 1} needs an approver.`
      }
      if (!step.amount.trim()) {
        return `Step ${index + 1} needs an amount.`
      }
      if (!step.currency.trim()) {
        return `Step ${index + 1} needs a currency.`
      }
    }

    return ''
  }, [form, getField, getOperators])

  const handleSave = useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setSaveError(validationError)
      setSuccessMessage('')
      return
    }

    if (!form) return

    setSaveBusy(true)
    setSaveError('')
    setSuccessMessage('')

    try {
      const payload = mapFormToPayload(form)
      if (chainId) {
        const updated = await updateApprovalChain(chainId, payload)
        setCurrentChain(updated)
        setForm(mapChainToForm(updated, catalog))
        setSuccessMessage('Approval chain updated.')
      } else {
        const created = await createApprovalChain(payload)
        router.replace(
          `/admin/approval-chains/${encodeURIComponent(String(created.id))}`,
        )
        return
      }
    } catch (requestError) {
      const loginNext = chainId
        ? `/admin/approval-chains/${chainId}`
        : '/admin/approval-chains/new'

      if (
        requestError instanceof ApprovalChainsApiError &&
        requestError.status === 401
      ) {
        router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
        return
      }

      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save approval chain.',
      )
    } finally {
      setSaveBusy(false)
    }
  }, [catalog, chainId, form, router, validateForm])

  const handleSimulate = useCallback(async () => {
    if (!chainId) {
      setSimulationError(
        'Save the chain first. The simulation endpoint evaluates persisted chains only.',
      )
      setSimulationResponse(null)
      return
    }

    setSimulationLoading(true)
    setSimulationError('')

    try {
      const parsed = JSON.parse(simulationInput) as Record<string, unknown>
      const response = await simulateApprovalChains({
        payload: parsed,
        include_inactive: includeInactive,
        include_non_matches: includeNonMatches,
      })
      setSimulationResponse(response)
    } catch (requestError) {
      const loginNext = chainId
        ? `/admin/approval-chains/${chainId}`
        : '/admin/approval-chains/new'

      if (
        requestError instanceof ApprovalChainsApiError &&
        requestError.status === 401
      ) {
        router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`)
        return
      }

      setSimulationResponse(null)
      setSimulationError(
        requestError instanceof SyntaxError
          ? 'Simulation payload must be valid JSON.'
          : requestError instanceof Error
            ? requestError.message
            : 'Unable to simulate approval chains.',
      )
    } finally {
      setSimulationLoading(false)
    }
  }, [
    chainId,
    includeInactive,
    includeNonMatches,
    router,
    simulationInput,
  ])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-gray-500">
        Loading approval chain...
      </div>
    )
  }

  if (!form) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError || 'Approval chain form is unavailable.'}
        </div>
      </div>
    )
  }

  const simulationResults =
    simulationResponse && Array.isArray(simulationResponse.results)
      ? simulationResponse.results
      : []

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/admin/approval-chains"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to approval chains
          </Link>

          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEditing ? 'Edit Approval Chain' : 'New Approval Chain'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Build one approval chain with a match strategy, ordered
              conditions, and ordered approver steps.
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
              : 'Create chain'}
        </button>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Chain settings
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Name
                </label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            name: event.target.value,
                          }
                        : current,
                    )
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Software Requisition Chain"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            description: event.target.value,
                          }
                        : current,
                    )
                  }
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Routes software requests"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">
                  Priority
                </label>
                <input
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            priority: event.target.value,
                          }
                        : current,
                    )
                  }
                  type="number"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="10"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Active
                  </div>
                  <div className="text-xs text-gray-500">
                    Only active chains participate in routing by default.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            is_active: !current.is_active,
                          }
                        : current,
                    )
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    form.is_active ? 'bg-black' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      form.is_active
                        ? 'translate-x-5'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Conditions
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Match all conditions or any single condition before the
                  approver steps apply.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          conditions: [
                            ...current.conditions,
                            createConditionDraft(catalog),
                          ],
                        }
                      : current,
                  )
                }
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Add condition
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="match-strategy"
                  checked={form.match_strategy === 'all'}
                  onChange={() =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            match_strategy: 'all',
                          }
                        : current,
                    )
                  }
                />
                Match all conditions
              </label>

              <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="match-strategy"
                  checked={form.match_strategy === 'any'}
                  onChange={() =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            match_strategy: 'any',
                          }
                        : current,
                    )
                  }
                />
                Match any condition
              </label>
            </div>

            <div className="mt-4 space-y-4">
              {form.conditions.map((condition, index) => {
                const field = getField(condition.selected_field_key)
                const operators = getOperators(condition.selected_field_key)
                const selectedOperator =
                  operators.find(
                    (entry) => entry.key === condition.operator,
                  ) || null
                const requiresValue = operatorRequiresValue(
                  selectedOperator,
                  condition.operator,
                )
                const actualFieldKey = resolveConditionFieldKey(condition)
                const lookupOptions = getLookupOptionsForField(
                  actualFieldKey,
                  lookupData,
                )
                const lookupResource = getLookupResourceForField(
                  condition.selected_field_key,
                )
                const lookupError = lookupResource
                  ? lookupErrors[lookupResource]
                  : ''
                const lookupBusy = lookupResource
                  ? lookupLoading[lookupResource]
                  : false
                const scalarValue = valueToScalarString(condition.value)
                const rangeValue = valueToRangeArray(condition.value)
                const textareaValue = valueToTextarea(condition.value)
                const dataType = field?.data_type
                const inputType = isDateDataType(
                  actualFieldKey,
                  dataType,
                )
                  ? 'date'
                  : isNumericDataType(actualFieldKey, dataType)
                    ? 'number'
                    : 'text'

                return (
                  <div
                    key={condition.client_id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900">
                        Condition {index + 1}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  conditions:
                                    current.conditions.length > 1
                                      ? current.conditions.filter(
                                          (row) =>
                                            row.client_id !==
                                            condition.client_id,
                                        )
                                      : current.conditions,
                                }
                              : current,
                          )
                        }
                        disabled={form.conditions.length === 1}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-800">
                          Field
                        </label>
                        <select
                          value={condition.selected_field_key}
                          onChange={(event) => {
                            const nextFieldKey = event.target.value
                            const nextOperator =
                              getDefaultOperatorForSelection(
                                catalog,
                                nextFieldKey,
                              )
                            updateCondition(
                              condition.client_id,
                              (current) => ({
                                ...current,
                                selected_field_key: nextFieldKey,
                                dynamic_field_key:
                                  nextFieldKey === 'custom_fields.*'
                                    ? current.dynamic_field_key
                                    : '',
                                operator: nextOperator,
                                value: defaultValueForOperator(nextOperator),
                              }),
                            )
                          }}
                          className="w-full rounded-md border px-3 py-2 text-sm"
                        >
                          {sortedFields.map((entry) => (
                            <option key={entry.key} value={entry.key}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                        {field?.description && (
                          <p className="mt-1 text-xs text-gray-500">
                            {field.description}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-800">
                          Operator
                        </label>
                        <select
                          value={condition.operator}
                          onChange={(event) => {
                            const nextOperator = event.target.value
                            updateCondition(
                              condition.client_id,
                              (current) => ({
                                ...current,
                                operator: nextOperator,
                                value: defaultValueForOperator(nextOperator),
                              }),
                            )
                          }}
                          className="w-full rounded-md border px-3 py-2 text-sm"
                        >
                          {operators.map((operator) => (
                            <option key={operator.key} value={operator.key}>
                              {operator.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-800">
                          Value
                        </label>

                        {!requiresValue && (
                          <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                            This operator does not require a value.
                          </div>
                        )}

                        {requiresValue &&
                          RANGE_VALUE_OPERATORS.has(condition.operator) && (
                            <div className="grid gap-2 md:grid-cols-2">
                              <input
                                value={rangeValue[0]}
                                onChange={(event) =>
                                  updateCondition(
                                    condition.client_id,
                                    (current) => ({
                                      ...current,
                                      value: [
                                        event.target.value,
                                        valueToRangeArray(
                                          current.value,
                                        )[1],
                                      ],
                                    }),
                                  )
                                }
                                type={inputType}
                                className="rounded-md border px-3 py-2 text-sm"
                                placeholder="Start"
                              />
                              <input
                                value={rangeValue[1]}
                                onChange={(event) =>
                                  updateCondition(
                                    condition.client_id,
                                    (current) => ({
                                      ...current,
                                      value: [
                                        valueToRangeArray(
                                          current.value,
                                        )[0],
                                        event.target.value,
                                      ],
                                    }),
                                  )
                                }
                                type={inputType}
                                className="rounded-md border px-3 py-2 text-sm"
                                placeholder="End"
                              />
                            </div>
                          )}

                        {requiresValue &&
                          MULTI_VALUE_OPERATORS.has(condition.operator) &&
                          lookupOptions.length > 0 && (
                            <select
                              multiple
                              value={valueToStringArray(condition.value)}
                              onChange={(event) =>
                                updateCondition(
                                  condition.client_id,
                                  (current) => ({
                                    ...current,
                                    value: Array.from(
                                      event.target.selectedOptions,
                                    ).map((option) => option.value),
                                  }),
                                )
                              }
                              className="h-32 w-full rounded-md border px-3 py-2 text-sm"
                            >
                              {lookupOptions.map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}

                        {requiresValue &&
                          MULTI_VALUE_OPERATORS.has(condition.operator) &&
                          lookupOptions.length === 0 && (
                            <textarea
                              value={textareaValue}
                              onChange={(event) =>
                                updateCondition(
                                  condition.client_id,
                                  (current) => ({
                                    ...current,
                                    value: event.target.value
                                      .split(/\r?\n|,/)
                                      .map((entry) => entry.trim())
                                      .filter(Boolean),
                                  }),
                                )
                              }
                              className="w-full rounded-md border px-3 py-2 text-sm"
                              rows={4}
                              placeholder="One value per line"
                            />
                          )}

                        {requiresValue &&
                          !MULTI_VALUE_OPERATORS.has(condition.operator) &&
                          !RANGE_VALUE_OPERATORS.has(condition.operator) &&
                          lookupOptions.length > 0 && (
                            <select
                              value={scalarValue}
                              onChange={(event) =>
                                updateCondition(
                                  condition.client_id,
                                  (current) => ({
                                    ...current,
                                    value: event.target.value,
                                  }),
                                )
                              }
                              className="w-full rounded-md border px-3 py-2 text-sm"
                            >
                              <option value="">Select value</option>
                              {lookupOptions.map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}

                        {requiresValue &&
                          !MULTI_VALUE_OPERATORS.has(condition.operator) &&
                          !RANGE_VALUE_OPERATORS.has(condition.operator) &&
                          lookupOptions.length === 0 && (
                            <input
                              value={scalarValue}
                              onChange={(event) =>
                                updateCondition(
                                  condition.client_id,
                                  (current) => ({
                                    ...current,
                                    value: event.target.value,
                                  }),
                                )
                              }
                              type={inputType}
                              className="w-full rounded-md border px-3 py-2 text-sm"
                              placeholder="Enter value"
                            />
                          )}

                        {condition.selected_field_key === 'custom_fields.*' && (
                          <div className="mt-2">
                            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                              Custom field key
                            </label>
                            <input
                              value={condition.dynamic_field_key}
                              onChange={(event) =>
                                updateCondition(
                                  condition.client_id,
                                  (current) => ({
                                    ...current,
                                    dynamic_field_key:
                                      event.target.value,
                                  }),
                                )
                              }
                              className="w-full rounded-md border px-3 py-2 text-sm"
                              placeholder="project_type"
                            />
                          </div>
                        )}

                        {lookupBusy && (
                          <p className="mt-1 text-xs text-gray-500">
                            Loading values...
                          </p>
                        )}

                        {lookupError && (
                          <p className="mt-1 text-xs text-rose-600">
                            {lookupError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Approver steps
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Each row maps to one specific-user approval step in order.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setForm((current) =>
                    current
                      ? {
                          ...current,
                          steps: [...current.steps, createStepDraft()],
                        }
                      : current,
                  )
                }
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" />
                Add approver
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {form.steps.map((step, index) => (
                <div
                  key={step.client_id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-gray-900">
                      Step {index + 1}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                steps:
                                  current.steps.length > 1
                                    ? current.steps.filter(
                                        (row) =>
                                          row.client_id !==
                                          step.client_id,
                                      )
                                    : current.steps,
                              }
                            : current,
                        )
                      }
                      disabled={form.steps.length === 1}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-800">
                        Approver
                      </label>
                      <ApproverAutocomplete
                        value={step.approver}
                        label={step.approver_name}
                        onSelect={(approver) =>
                          updateStep(step.client_id, (current) => ({
                            ...current,
                            approver: approver.user_id,
                            approver_name: approver.name,
                          }))
                        }
                        onClear={() =>
                          updateStep(step.client_id, (current) => ({
                            ...current,
                            approver: null,
                            approver_name: '',
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-800">
                        Step type
                      </label>
                      <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        Specific user
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-800">
                        Amount
                      </label>
                      <input
                        value={step.amount}
                        onChange={(event) =>
                          updateStep(step.client_id, (current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                        type="number"
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="1000.00"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-800">
                        Currency
                      </label>
                      <input
                        value={step.currency}
                        onChange={(event) =>
                          updateStep(step.client_id, (current) => ({
                            ...current,
                            currency: event.target.value.toUpperCase(),
                          }))
                        }
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="USD"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Test chain
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Run the simulator against persisted approval chains with
                  a sample payload.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleSimulate()}
                disabled={simulationLoading}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {simulationLoading ? 'Testing...' : 'Test chain'}
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <textarea
                value={simulationInput}
                onChange={(event) =>
                  setSimulationInput(event.target.value)
                }
                className="min-h-[180px] w-full rounded-md border px-3 py-2 font-mono text-xs"
              />

              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(event) =>
                      setIncludeInactive(event.target.checked)
                    }
                  />
                  Include inactive chains
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeNonMatches}
                    onChange={(event) =>
                      setIncludeNonMatches(event.target.checked)
                    }
                  />
                  Include non-matches
                </label>
              </div>

              {simulationError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {simulationError}
                </div>
              )}

              {simulationResponse?.meta && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    Evaluated chains:{' '}
                    <span className="font-medium text-gray-900">
                      {simulationResponse.meta.evaluated_count ?? '—'}
                    </span>
                  </div>
                  <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    Matches:{' '}
                    <span className="font-medium text-gray-900">
                      {simulationResponse.meta.match_count ?? '—'}
                    </span>
                  </div>
                </div>
              )}

              {simulationResults.length > 0 && (
                <div className="space-y-3">
                  {simulationResults.map((result: any) => {
                    const isCurrent =
                      currentChain &&
                      result.chain?.id === currentChain.id

                    return (
                      <div
                        key={`${result.chain?.id}-${result.evaluation?.matched}`}
                        className={`rounded-md border p-4 ${
                          isCurrent
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {result.chain?.name || 'Approval chain'}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              Strategy:{' '}
                              {result.evaluation?.match_strategy === 'any'
                                ? 'Any condition'
                                : 'All conditions'}
                              {isCurrent ? ' • Current chain' : ''}
                            </div>
                          </div>

                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                              result.evaluation?.matched
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {result.evaluation?.matched
                              ? 'Matched'
                              : 'Did not match'}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Condition results
                          </div>
                          {Array.isArray(
                            result.evaluation?.condition_results,
                          ) &&
                          result.evaluation.condition_results.length > 0 ? (
                            result.evaluation.condition_results.map(
                              (conditionResult: any) => (
                                <div
                                  key={`${result.chain?.id}-${conditionResult.sequence}`}
                                  className="rounded-md border bg-white px-3 py-2 text-sm"
                                >
                                  <div className="font-medium text-gray-900">
                                    {conditionResult.field_label ||
                                      conditionResult.field_key}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    Operator: {conditionResult.operator} •
                                    Expected:{' '}
                                    {JSON.stringify(
                                      conditionResult.expected_value,
                                    )}{' '}
                                    • Actual:{' '}
                                    {JSON.stringify(
                                      conditionResult.actual_value,
                                    )}
                                  </div>
                                </div>
                              ),
                            )
                          ) : (
                            <div className="text-sm text-gray-500">
                              No condition details returned.
                            </div>
                          )}
                        </div>

                        <div className="mt-3 space-y-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            Resolved steps
                          </div>
                          {Array.isArray(
                            result.evaluation?.resolved_steps,
                          ) &&
                          result.evaluation.resolved_steps.length > 0 ? (
                            result.evaluation.resolved_steps.map(
                              (stepResult: any) => (
                                <div
                                  key={`${result.chain?.id}-${stepResult.sequence}-step`}
                                  className="rounded-md border bg-white px-3 py-2 text-sm"
                                >
                                  {stepResult.approver_name ||
                                    `Approver ${stepResult.approver_id}`}{' '}
                                  • {stepResult.amount} {stepResult.currency}
                                </div>
                              ),
                            )
                          ) : (
                            <div className="text-sm text-gray-500">
                              No approver steps resolved.
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Summary
            </h2>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>Conditions</span>
                <span className="font-medium text-gray-900">
                  {form.conditions.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Approver steps</span>
                <span className="font-medium text-gray-900">
                  {form.steps.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Match strategy</span>
                <span className="font-medium text-gray-900">
                  {form.match_strategy === 'any'
                    ? 'Any condition'
                    : 'All conditions'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="font-medium text-gray-900">
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {currentChain && (
                <>
                  <div className="flex items-center justify-between">
                    <span>Created</span>
                    <span className="font-medium text-gray-900">
                      {formatTimestamp(currentChain.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Updated</span>
                    <span className="font-medium text-gray-900">
                      {formatTimestamp(currentChain.updated_at)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Scope notes
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li>
                This editor currently supports chain metadata,
                conditions, and specific-user approver steps.
              </li>
              <li>
                Health insights, skip logic, parallel approvals, and
                import or export flows are intentionally omitted.
              </li>
              <li>
                Condition operators and field compatibility come
                directly from the approval chain catalog API.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
