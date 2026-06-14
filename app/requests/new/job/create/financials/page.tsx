'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useCWRequest } from '../../context/CWRequestContext'
import {
  IntakeApiError,
  createIntakeDraft,
  patchIntake,
} from '@/lib/api/intake'
import {
  RatesApiError,
  getRateCard,
  getRateCards,
  type RateCard,
  type RateCardLine,
  type RateStructureComponent,
} from '@/lib/api/rates'
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Minus,
  Sparkles,
} from 'lucide-react'
import { CURRENT_FINANCIALS_BASE_RATE_VERSION } from '@/lib/cwRequestDraft'

type BillRateMode = 'fixed' | 'range'

type MarketAssessment = {
  label: string
  tone: 'good' | 'warning' | 'critical' | 'neutral'
  message: string
  suppliersLikely: number
}

function calculateBusinessDays(start?: string, end?: string) {
  if (!start || !end) return null

  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return null

  let days = 0
  const cur = new Date(s)

  while (cur <= e) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) days++
    cur.setDate(cur.getDate() + 1)
  }

  return days
}

function parseNumeric(value: string | number | undefined | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseNonNegativeNumber(value: string): number | '' {
  if (value === '') return ''
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return ''
  return Math.max(0, parsed)
}

function parseNonNegativeDecimal(value: string, fallback: number): number {
  if (value === '') return fallback
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

function mapRequestRateUnitToCardUnit(
  rateUnit: string | undefined,
): 'hour' | 'day' | undefined {
  if (!rateUnit) return undefined
  return rateUnit.toLowerCase().startsWith('day') ? 'day' : 'hour'
}

function mapCardUnitToRequestRateUnit(unit: RateCard['unit']): string {
  return unit === 'day' ? 'daily' : 'hourly'
}

function formatCurrencyAmount(
  amount: number | null,
  currency: string,
  fractionDigits = 2,
): string {
  if (amount === null) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(fractionDigits)}`
  }
}

function buildRateName(
  card: RateCard | null,
  baseComponent: RateStructureComponent | null,
): string {
  if (baseComponent?.code?.trim()) {
    return baseComponent.code.trim().toUpperCase()
  }

  if (!card) return 'USD_ST_HR'
  return `${card.currency || 'USD'}_ST_${card.unit === 'day' ? 'DAY' : 'HR'}`
}

function selectedFallbackRoleFromRequest(
  request: ReturnType<typeof useCWRequest>['request'],
) {
  const dynamicRequest = request as Record<string, unknown>
  const readDynamicString = (key: string) =>
    typeof dynamicRequest[key] === 'string'
      ? (dynamicRequest[key] as string)
      : ''

  return (
    readDynamicString('workerTypeLabel') ||
    readDynamicString('templateName') ||
    readDynamicString('category') ||
    readDynamicString('roleName') ||
    ''
  )
}

function inferRole(request: ReturnType<typeof useCWRequest>['request']) {
  const dynamicRequest = request as Record<string, unknown>
  const readDynamicString = (key: string) =>
    typeof dynamicRequest[key] === 'string'
      ? (dynamicRequest[key] as string)
      : ''

  return (
    readDynamicString('jobTitle') ||
    request.role ||
    readDynamicString('title') ||
    selectedFallbackRoleFromRequest(request) ||
    ''
  )
}

function pickPreferredRateCard(
  cards: RateCard[],
  request: ReturnType<typeof useCWRequest>['request'],
): RateCard {
  if (request.selectedRateCardId !== undefined) {
    const selectedById = cards.find(
      (card) => card.id === request.selectedRateCardId,
    )
    if (selectedById) return selectedById
  }

  const role = inferRole(request).trim().toLowerCase()
  if (role) {
    const byRoleName = cards.find(
      (card) =>
        (card.role_name || '').trim().toLowerCase() === role,
    )
    if (byRoleName) return byRoleName

    const byName = cards.find((card) =>
      (card.name || '').trim().toLowerCase().includes(role),
    )
    if (byName) return byName
  }

  return cards[0]
}

function readBaseComponentRates(
  lines: RateCardLine[] | undefined,
  baseComponentId: number | undefined,
): number[] {
  if (!lines?.length || baseComponentId === undefined) return []

  return lines
    .map((line) => {
      const baseValue = line.component_values.find(
        (value) => value.rate_structure_component === baseComponentId,
      )
      return parseNumeric(baseValue?.numeric_value)
    })
    .filter((rate): rate is number => rate !== null)
}

function readBillRates(lines: RateCardLine[] | undefined): number[] {
  if (!lines?.length) return []

  return lines
    .map((line) => parseNumeric(line.bill_rate))
    .filter((rate): rate is number => rate !== null)
}

export default function CWFinancialsPage() {
  const router = useRouter()
  const { request, update } = useCWRequest()
  const previousStepHref = request.qualificationsEnabled
    ? '/requests/new/job/create/qualifications/setup'
    : '/requests/new/job/create/qualifications'

  const [stMode, setStMode] = useState<BillRateMode>(
    request.rateMode === 'range' ? 'range' : 'fixed',
  )
  const [stFixed, setStFixed] = useState<number | ''>(
    request.targetRate ?? '',
  )
  const [stMin, setStMin] = useState<number | ''>(
    request.targetRateMin ?? '',
  )
  const [stMax, setStMax] = useState<number | ''>(
    request.targetRateMax ?? '',
  )
  const [selectedRateCard, setSelectedRateCard] = useState<RateCard | null>(null)
  const [baseComponent, setBaseComponent] =
    useState<RateStructureComponent | null>(null)

  const [otEnabled, setOtEnabled] = useState(Boolean(request.overtimeEnabled))
  const [otFactor, setOtFactor] = useState<number>(request.overtimeFactor ?? 1.5)

  const [rateCardsLoading, setRateCardsLoading] = useState(false)
  const [rateCardsError, setRateCardsError] = useState('')
  const [savingStep, setSavingStep] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadRateCards = async () => {
      setRateCardsLoading(true)
      setRateCardsError('')
      try {
        const rows = await getRateCards({
          status: 'active',
          role_definition: request.roleId || undefined,
          currency: request.currency || undefined,
          unit: mapRequestRateUnitToCardUnit(request.rateUnit),
        })
        if (cancelled) return

        if (rows.length === 0) {
          setSelectedRateCard(null)
          setBaseComponent(null)
          if (request.targetRate === undefined) {
            setStFixed('')
          }
          if (request.targetRateMin === undefined) {
            setStMin('')
          }
          if (request.targetRateMax === undefined) {
            setStMax('')
          }
          return
        }

        const preferred = pickPreferredRateCard(rows, request)
        const detailed = await getRateCard(preferred.id)
        if (cancelled) return

        setSelectedRateCard(detailed)
        if (request.selectedRateCardId !== detailed.id) {
          update({ selectedRateCardId: detailed.id })
        }

        const structureBaseComponent =
          detailed.rate_structure_components?.find(
            (component) =>
              component.calculation_role === 'base' &&
              component.is_active,
          ) || null
        setBaseComponent(structureBaseComponent)

        const baseRates = readBaseComponentRates(
          detailed.lines,
          structureBaseComponent?.id,
        )
        const fallbackBillRates = readBillRates(detailed.lines)
        const ratesForDefaults =
          baseRates.length > 0 ? baseRates : fallbackBillRates
        const shouldReseedForCard =
          request.financialsBaseRateVersion !==
            CURRENT_FINANCIALS_BASE_RATE_VERSION ||
          request.financialsSeedRateCardId !== detailed.id

        if (ratesForDefaults.length > 0 && shouldReseedForCard) {
          const minRate = Math.min(...ratesForDefaults)
          const maxRate = Math.max(...ratesForDefaults)

          setStFixed(minRate)
          setStMin(minRate)
          setStMax(maxRate)
          update({
            targetRate: minRate,
            enteredRate: minRate,
            stRate: minRate,
            targetRateMin: minRate,
            targetRateMax: maxRate,
            financialsBaseRateVersion: CURRENT_FINANCIALS_BASE_RATE_VERSION,
            financialsSeedRateCardId: detailed.id,
          })
        }

        const nextCurrency = detailed.currency || request.currency
        const nextRateUnit = mapCardUnitToRequestRateUnit(detailed.unit)
        if (
          nextCurrency &&
          (nextCurrency !== request.currency ||
            nextRateUnit !== request.rateUnit)
        ) {
          update({
            currency: nextCurrency,
            rateUnit: nextRateUnit,
          })
        }
      } catch (error) {
        if (cancelled) return
        if (
          error instanceof IntakeApiError &&
          error.status === 401
        ) {
          router.replace('/auth/login?next=/requests/new/job/create/financials')
          return
        }
        if (
          error instanceof RatesApiError &&
          error.status === 401
        ) {
          router.replace('/auth/login?next=/requests/new/job/create/financials')
          return
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load configured rate cards.'
        setRateCardsError(message)
      } finally {
        if (!cancelled) {
          setRateCardsLoading(false)
        }
      }
    }

    void loadRateCards()

    return () => {
      cancelled = true
    }
  }, [
    request.currency,
    request.financialsBaseRateVersion,
    request.financialsSeedRateCardId,
    request.rateUnit,
    request.roleId,
    request.role,
    request.selectedRateCardId,
    router,
    update,
  ])

  const displayCurrency = (
    selectedRateCard?.currency ||
    request.currency ||
    'USD'
  ).toUpperCase()
  const durationDays = calculateBusinessDays(request.startDate, request.endDate)
  const hoursPerDay = 8
  const positions = request.positions ?? 1
  const baseHours = durationDays !== null ? durationDays * hoursPerDay : null
  const otHoursPct = 0.2
  const inferredRole = inferRole(request) || selectedRateCard?.role_name || selectedRateCard?.name || 'Role'

  const rangeMid =
    typeof stMin === 'number' && typeof stMax === 'number'
      ? (stMin + stMax) / 2
      : null
  const targetRateForCalc =
    stMode === 'range'
      ? rangeMid
      : typeof stFixed === 'number'
        ? stFixed
        : null

  const marketStats = useMemo(() => {
    const baseRates = readBaseComponentRates(
      selectedRateCard?.lines,
      baseComponent?.id,
    )
    const fallbackBillRates = readBillRates(selectedRateCard?.lines)
    const ratesForBand =
      baseRates.length > 0 ? baseRates : fallbackBillRates
    const hasBand = ratesForBand.length > 0

    const min = hasBand ? Math.min(...ratesForBand) : null
    const max = hasBand ? Math.max(...ratesForBand) : null
    const avg = hasBand
      ? ratesForBand.reduce((sum, value) => sum + value, 0) / ratesForBand.length
      : null

    const uniqueSuppliers = new Set(
      (selectedRateCard?.lines || []).map((line) => String(line.supplier)),
    ).size
    const totalSuppliers = Math.max(uniqueSuppliers, (selectedRateCard?.lines || []).length, 1)

    return {
      marketMin: min,
      marketMax: max,
      recommendedRate: avg,
      supplierCoverage: uniqueSuppliers,
      totalSuppliers,
    }
  }, [baseComponent?.id, selectedRateCard])

  const modeledBreakdown = useMemo(() => {
    if (targetRateForCalc === null) {
      return {
        rows: [] as Array<{ label: string; amount: number }>,
        modeledBillRate: null as number | null,
      }
    }

    const base = targetRateForCalc
    const components =
      selectedRateCard?.rate_structure_components?.filter((component) => component.is_active) || []
    const line = selectedRateCard?.lines?.[0]
    const valueByComponentId = new Map<number, number>()

    for (const value of line?.component_values || []) {
      const numericValue = parseNumeric(value.numeric_value)
      if (
        numericValue !== null &&
        Number.isFinite(value.rate_structure_component)
      ) {
        valueByComponentId.set(value.rate_structure_component, numericValue)
      }
    }

    const rows: Array<{ label: string; amount: number }> = []
    let modeled = base

    for (const component of components) {
      if (component.calculation_role === 'base') continue
      if (component.id === undefined) continue
      const componentRawValue = valueByComponentId.get(component.id) || 0

      if (component.calculation_role === 'additive_percent') {
        const amount = base * (componentRawValue / 100)
        modeled += amount
        rows.push({
          label: `${component.label} (${componentRawValue}%)`,
          amount,
        })
      } else if (component.calculation_role === 'additive_amount') {
        modeled += componentRawValue
        rows.push({
          label: component.label,
          amount: componentRawValue,
        })
      }
    }

    return {
      rows,
      modeledBillRate: modeled,
    }
  }, [selectedRateCard, targetRateForCalc])

  const effectiveBillRate = modeledBreakdown.modeledBillRate

  const marketAssessment: MarketAssessment = useMemo(() => {
    if (
      targetRateForCalc === null ||
      targetRateForCalc <= 0 ||
      marketStats.marketMin === null ||
      marketStats.marketMax === null
    ) {
      return {
        label: 'Incomplete',
        tone: 'neutral',
        message: 'Enter a rate to see market alignment and supplier match.',
        suppliersLikely: 0,
      }
    }

    const { marketMin, marketMax, recommendedRate, supplierCoverage, totalSuppliers } = marketStats

    if (targetRateForCalc < marketMin) {
      const coveragePenalty = targetRateForCalc < marketMin - 10 ? 3 : 2
      const suppliersLikely = Math.max(0, supplierCoverage - coveragePenalty)
      return {
        label: 'Below market',
        tone: 'critical',
        message: `This is below your configured market band (${formatCurrencyAmount(
          marketMin,
          displayCurrency,
        )}–${formatCurrencyAmount(
          marketMax,
          displayCurrency,
        )} per ${selectedRateCard?.unit || 'hour'}). Supplier response may be weak.`,
        suppliersLikely,
      }
    }

    if (targetRateForCalc > marketMax) {
      const suppliersLikely = Math.min(totalSuppliers, supplierCoverage + 1)
      return {
        label: 'Above market',
        tone: 'warning',
        message: `This is above your configured market band (${formatCurrencyAmount(
          marketMin,
          displayCurrency,
        )}–${formatCurrencyAmount(
          marketMax,
          displayCurrency,
        )} per ${selectedRateCard?.unit || 'hour'}). Fill likelihood is good, but cost is elevated.`,
        suppliersLikely,
      }
    }

    let suppliersLikely = supplierCoverage
    if (recommendedRate !== null && targetRateForCalc >= recommendedRate) {
      suppliersLikely = Math.min(totalSuppliers, supplierCoverage + 1)
    }

    return {
      label: 'Within range',
      tone: 'good',
      message:
        recommendedRate !== null
          ? `This aligns to the configured market band. Recommended target is around ${formatCurrencyAmount(
              recommendedRate,
              displayCurrency,
            )} per ${selectedRateCard?.unit || 'hour'}.`
          : 'This aligns to the configured market band.',
      suppliersLikely,
    }
  }, [
    displayCurrency,
    marketStats,
    selectedRateCard?.unit,
    targetRateForCalc,
  ])

  const otHours =
    otEnabled && baseHours !== null
      ? baseHours * otHoursPct
      : null

  const stLineTotal =
    baseHours !== null && effectiveBillRate !== null
      ? baseHours * effectiveBillRate * positions
      : null

  const otLineTotal =
    otEnabled &&
    otHours !== null &&
    effectiveBillRate !== null
      ? otHours * (effectiveBillRate * otFactor) * positions
      : null

  const totalValue =
    stLineTotal !== null
      ? stLineTotal + (otLineTotal ?? 0)
      : null

  const canContinue = targetRateForCalc !== null && targetRateForCalc >= 0
  const rateName = buildRateName(selectedRateCard, baseComponent)
  const rateDescription = baseComponent?.label || 'Standard time'
  const rateCategory = `ST / ${selectedRateCard?.unit === 'day' ? 'Day' : 'Hour'}`

  const handleFixedRateChange = (value: string) => {
    const next = parseNonNegativeNumber(value)
    setStFixed(next)
    update({
      rateMode: 'fixed',
      targetRate: typeof next === 'number' ? next : undefined,
      enteredRate: typeof next === 'number' ? next : undefined,
      stRate: typeof next === 'number' ? next : undefined,
      financialsBaseRateVersion: CURRENT_FINANCIALS_BASE_RATE_VERSION,
      financialsSeedRateCardId: selectedRateCard?.id,
    })
  }

  const handleRangeMinChange = (value: string) => {
    const next = parseNonNegativeNumber(value)
    setStMin(next)
    update({
      rateMode: 'range',
      targetRateMin: typeof next === 'number' ? next : undefined,
      financialsBaseRateVersion: CURRENT_FINANCIALS_BASE_RATE_VERSION,
      financialsSeedRateCardId: selectedRateCard?.id,
    })
  }

  const handleRangeMaxChange = (value: string) => {
    const next = parseNonNegativeNumber(value)
    setStMax(next)
    update({
      rateMode: 'range',
      targetRateMax: typeof next === 'number' ? next : undefined,
      financialsBaseRateVersion: CURRENT_FINANCIALS_BASE_RATE_VERSION,
      financialsSeedRateCardId: selectedRateCard?.id,
    })
  }

  const handleContinue = async () => {
    if (!canContinue) {
      setSaveError('Enter a valid target rate before continuing.')
      return
    }

    setSavingStep(true)
    setSaveError('')

    const targetRate = targetRateForCalc ?? undefined
    const budgetAmount = totalValue ?? undefined
    const rateUnit = request.rateUnit || 'hourly'
    const currency = displayCurrency

    const financialPayload = {
      targetRate:
        targetRate !== undefined
          ? targetRate.toFixed(2)
          : undefined,
      rateUnit,
      budgetAmount:
        budgetAmount !== undefined
          ? budgetAmount.toFixed(2)
          : undefined,
      currency,
      rateCard: selectedRateCard?.id,
      overtimeEnabled: otEnabled,
      overtimeMultiplier: otFactor.toFixed(2),
      qualificationsEnabled: request.qualificationsEnabled,
      qualifications: request.qualifications,
      roleDefinition: request.roleId,
      legalEntity: request.legalEntityId,
      country: request.country || undefined,
      stateProvince:
        request.stateProvince || request.region || undefined,
      city: request.city || undefined,
    }

    try {
      let intakeId = request.intakeId

      if (!intakeId) {
        const created = await createIntakeDraft({
          engagementType: 'staffing',
          title: request.role?.trim() || undefined,
          description: request.description?.trim() || undefined,
          startDate: request.startDate || undefined,
          endDate: request.endDate || undefined,
          workerCount:
            typeof request.positions === 'number' &&
            request.positions > 0
              ? request.positions
              : undefined,
          costCenter: request.costCenterId,
          site: request.siteId,
          supplier: request.supplierId,
          roleDefinition: request.roleId,
          legalEntity: request.legalEntityId,
          country: request.country || undefined,
          stateProvince:
            request.stateProvince || request.region || undefined,
          city: request.city || undefined,
          ...financialPayload,
          customFields: request.customFields || {},
        })
        intakeId = created.id
        update({ intakeId: created.id })
      } else {
        await patchIntake(intakeId, financialPayload)
      }

      update({
        enteredRate: targetRate,
        targetRate,
        targetRateMin: typeof stMin === 'number' ? stMin : undefined,
        targetRateMax: typeof stMax === 'number' ? stMax : undefined,
        rateMode: stMode,
        overtimeEnabled: otEnabled,
        overtimeFactor: otFactor,
        budgetAmount,
        rateUnit,
        currency,
        financialsBaseRateVersion: CURRENT_FINANCIALS_BASE_RATE_VERSION,
        financialsSeedRateCardId: selectedRateCard?.id,
      })

      router.push('/requests/new/job/create/suppliers')
    } catch (error) {
      if (
        error instanceof IntakeApiError &&
        error.status === 401
      ) {
        router.replace('/auth/login?next=/requests/new/job/create/financials')
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save this step.'
      setSaveError(message)
    } finally {
      setSavingStep(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,_#f8fafc,_#f8fafc,_#eef6ff)] pb-20 font-sans">
      <div className="max-w-[1500px] mx-auto px-8 py-12">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-700 mb-3">
            <span className="bg-cyan-100 text-cyan-800 px-2.5 py-1 rounded-full">
              Step 4 of 5
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Financials</span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Rates & Spend
          </h1>
          <p className="text-slate-600 mt-2 max-w-3xl">
            Define the target rate, assess market alignment from configured
            rate cards, and preview total engagement cost before routing to suppliers.
          </p>
        </header>

        <div className="space-y-6">
          {rateCardsLoading && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Loading configured rate cards...
            </div>
          )}

          {rateCardsError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {rateCardsError}
            </div>
          )}

          {saveError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {saveError}
            </div>
          )}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7">
            <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-6 items-start">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">
                  Role
                </div>
                <h2 className="text-lg font-bold text-slate-900">Role and baseline pricing</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Using active rate card data for {inferredRole}.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                    <BriefcaseBusiness className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">
                      Selected rate card
                    </div>
                    <div className="text-lg font-bold text-slate-900 truncate">
                      {selectedRateCard?.name || inferredRole} — {selectedRateCard?.role_name || request.role || 'Role'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {displayCurrency} · {rateCategory} · {rateName}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-7 py-6 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <DollarSign className="w-4 h-4 text-cyan-600" />
                Target Rate Builder
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Set the target standard rate (base pay) for this request. Market alignment and cost impact update immediately.
              </p>
            </div>

            <div className="p-7 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 block mb-2">
                    Pricing structure
                  </label>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStMode('fixed')
                        update({ rateMode: 'fixed' })
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        stMode === 'fixed'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Fixed rate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStMode('range')
                        update({ rateMode: 'range' })
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        stMode === 'range'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Rate range
                    </button>
                  </div>
                </div>

                {stMode === 'fixed' ? (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 block mb-2">
                      Target standard rate
                    </label>
                    <div className="relative max-w-md">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                        {displayCurrency}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={stFixed}
                        onChange={(event) => handleFixedRateChange(event.target.value)}
                        className="w-full border border-slate-300 rounded-xl pl-16 pr-4 py-3 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      {rateDescription || 'Base pay rate'} input for spend modeling.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 block mb-2">
                      Target range
                    </label>
                    <div className="grid grid-cols-[minmax(0,220px)_auto_minmax(0,220px)] gap-3 items-center max-w-[620px]">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                          {displayCurrency}
                        </span>
                        <input
                          type="number"
                          min={0}
                          placeholder="Min"
                          value={stMin}
                          onChange={(event) => handleRangeMinChange(event.target.value)}
                          className="w-full border border-slate-300 rounded-xl pl-16 pr-4 py-3 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>

                      <Minus className="w-4 h-4 text-slate-300" />

                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                          {displayCurrency}
                        </span>
                        <input
                          type="number"
                          min={0}
                          placeholder="Max"
                          value={stMax}
                          onChange={(event) => handleRangeMaxChange(event.target.value)}
                          className="w-full border border-slate-300 rounded-xl pl-16 pr-4 py-3 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      Average rate used for modeling:{' '}
                      <span className="font-semibold text-slate-700">
                        {formatCurrencyAmount(rangeMid, displayCurrency)}
                      </span>
                    </p>
                  </div>
                )}

                <div className="rounded-2xl bg-cyan-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-cyan-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-slate-900">AI guidance</div>
                      <p className="text-sm text-slate-600 mt-1">
                        Recommended target for this role and market is around{' '}
                        <span className="font-bold text-slate-900">
                          {formatCurrencyAmount(marketStats.recommendedRate, displayCurrency)}
                        </span>{' '}
                        per {selectedRateCard?.unit || 'hour'}.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <MarketInsightCard
                assessment={marketAssessment}
                recommendedRate={marketStats.recommendedRate}
                totalSuppliers={marketStats.totalSuppliers}
                displayCurrency={displayCurrency}
                unit={selectedRateCard?.unit || 'hour'}
              />

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                  <div className="text-sm font-bold text-slate-900">Overtime structure</div>
                  <p className="text-sm text-slate-600 mt-1">
                    Decide whether overtime should be included in the estimate.
                  </p>
                </div>

                <div className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOtEnabled(false)
                        update({ overtimeEnabled: false })
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        !otEnabled
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      No overtime
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtEnabled(true)
                        update({ overtimeEnabled: true })
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                        otEnabled
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Include overtime
                    </button>
                  </div>

                  {otEnabled && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Multiplier
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={otFactor}
                        onChange={(event) => {
                          const next = parseNonNegativeDecimal(event.target.value, otFactor)
                          setOtFactor(next)
                          update({ overtimeFactor: next })
                        }}
                        className="w-24 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-slate-500">
                        OT modeled bill rate:{' '}
                        <span className="font-bold text-slate-900">
                          {formatCurrencyAmount(
                            effectiveBillRate !== null
                              ? effectiveBillRate * otFactor
                              : null,
                            displayCurrency,
                          )}
                          /{selectedRateCard?.unit || 'hour'}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-7 py-6 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <BarChart3 className="w-4 h-4 text-cyan-600" />
                Cost Breakdown
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Transparent view of modeled hourly rate and total commitment.
              </p>
            </div>

            <div className="p-7 space-y-7">
              {durationDays === null && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Start date and end date are required to calculate duration-based spend.
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-7">
                <div className="rounded-2xl border border-slate-200 p-6">
                  <div className="text-sm font-bold text-slate-900 mb-4">Hourly cost breakdown</div>

                  <div className="space-y-3">
                    <BreakdownRow
                      label="Target standard rate (base)"
                      value={formatCurrencyAmount(targetRateForCalc, displayCurrency)}
                      strong
                    />
                    {modeledBreakdown.rows.map((row) => (
                      <BreakdownRow
                        key={row.label}
                        label={row.label}
                        value={formatCurrencyAmount(row.amount, displayCurrency)}
                      />
                    ))}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Modeled bill rate</span>
                    <span className="text-2xl font-black text-slate-900">
                      {formatCurrencyAmount(
                        effectiveBillRate,
                        displayCurrency,
                      )}
                      /{selectedRateCard?.unit || 'hour'}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-6">
                  <div className="text-sm font-bold text-slate-900 mb-4">Commitment summary</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SummaryStat label="Duration" value={durationDays !== null ? `${durationDays} days` : '—'} />
                    <SummaryStat label="Positions" value={String(positions)} />
                    <SummaryStat label="Base hours" value={baseHours !== null ? `${baseHours.toLocaleString()} hrs` : '—'} />
                    <SummaryStat label="OT hours" value={otEnabled ? `${Math.round(otHours || 0)} hrs` : 'Excluded'} />
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">Total commitment</span>
                    <span className="text-3xl font-black text-slate-900">
                      {formatCurrencyAmount(totalValue, displayCurrency, 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-slate-900 mb-4">Spend breakdown</div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SpendLine
                    label="Standard time commitment"
                    basis={
                      baseHours !== null
                        ? `${baseHours} hrs × ${positions} pos × ${formatCurrencyAmount(
                            effectiveBillRate,
                            displayCurrency,
                          )}/${selectedRateCard?.unit || 'hour'}`
                        : 'Dates required'
                    }
                    total={formatCurrencyAmount(stLineTotal, displayCurrency, 0)}
                  />
                  {otEnabled && (
                    <SpendLine
                      label="Overtime commitment"
                      basis={`${Math.round(otHours || 0)} hrs × ${positions} pos × ${formatCurrencyAmount(
                        effectiveBillRate !== null
                          ? effectiveBillRate * otFactor
                          : null,
                        displayCurrency,
                      )}/${selectedRateCard?.unit || 'hour'}`}
                      total={formatCurrencyAmount(otLineTotal, displayCurrency, 0)}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          <footer className="flex justify-between items-center pt-8 border-t border-slate-200">
            <button
              onClick={() => router.push(previousStepHref)}
              className="px-8 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors rounded-full"
            >
              Back
            </button>

            <button
              onClick={() => void handleContinue()}
              disabled={!canContinue || savingStep}
              className={`group flex items-center justify-center gap-2 px-10 py-3.5 rounded-full text-sm font-bold transition-all shadow-lg min-w-[180px] ${
                !canContinue || savingStep
                  ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-950 text-white hover:bg-slate-800'
              }`}
            >
              {savingStep ? 'Saving...' : 'Continue'}
              {!savingStep && (
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              )}
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}

function MarketInsightCard({
  assessment,
  recommendedRate,
  totalSuppliers,
  displayCurrency,
  unit,
}: {
  assessment: MarketAssessment
  recommendedRate: number | null
  totalSuppliers: number
  displayCurrency: string
  unit: 'hour' | 'day'
}) {
  const styles = {
    good: {
      wrap: 'border-emerald-200 bg-emerald-50/70',
      badge: 'bg-emerald-100 text-emerald-700',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    },
    warning: {
      wrap: 'border-amber-200 bg-amber-50/70',
      badge: 'bg-amber-100 text-amber-700',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
    },
    critical: {
      wrap: 'border-rose-200 bg-rose-50/70',
      badge: 'bg-rose-100 text-rose-700',
      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
    },
    neutral: {
      wrap: 'border-slate-200 bg-slate-50/70',
      badge: 'bg-slate-100 text-slate-700',
      icon: <DollarSign className="w-5 h-5 text-slate-500" />,
    },
  }[assessment.tone]

  return (
    <div className={`rounded-2xl border p-7 ${styles.wrap}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 max-w-3xl">
          <div className="mt-0.5">{styles.icon}</div>
          <div>
            <div className="text-base font-bold text-slate-900">Market assessment</div>
            <p className="text-sm text-slate-700 mt-2 leading-7 max-w-2xl">{assessment.message}</p>
          </div>
        </div>

        <span className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${styles.badge}`}>
          {assessment.label}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="rounded-xl bg-white/80 border border-white/80 p-5 min-h-[96px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">
            Recommended target
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatCurrencyAmount(recommendedRate, displayCurrency)}/{unit}
          </div>
        </div>

        <div className="rounded-xl bg-white/80 border border-white/80 p-5 min-h-[96px]">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">
            Potential supplier match
          </div>
          <div className="text-2xl font-black text-slate-900">
            {assessment.suppliersLikely}/{totalSuppliers}
          </div>
        </div>
      </div>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${strong ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
        {label}
      </span>
      <span className={`text-sm ${strong ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
        {value}
      </span>
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-lg font-black text-slate-900">{value}</div>
    </div>
  )
}

function SpendLine({
  label,
  basis,
  total,
}: {
  label: string
  basis: string
  total: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">{label}</div>
          <div className="text-sm text-slate-500 mt-2 leading-6">{basis}</div>
        </div>
        <div className="text-right text-lg font-black text-slate-900 whitespace-nowrap">
          {total}
        </div>
      </div>
    </div>
  )
}
