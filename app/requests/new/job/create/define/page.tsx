'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCWRequest } from '../../context/CWRequestContext'
import RequiredIndicator from '@/components/ui/RequiredIndicator'
import {
  IntakeApiError,
  createIntakeDraft,
  getCostCenters,
  getSites,
  patchIntake,
  type ReferenceOption,
} from '@/lib/api/intake'
import {
  getRoles,
  RolesApiError,
  type RoleRecord,
} from '@/lib/api/roles'
import {
  LegalEntitiesApiError,
  getLegalEntities,
  type LegalEntityRecord,
} from '@/lib/api/legalEntities'

function readErrorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback
}

function isUnauthorizedError(reason: unknown) {
  return (
    (reason instanceof IntakeApiError ||
      reason instanceof RolesApiError ||
      reason instanceof LegalEntitiesApiError) &&
    reason.status === 401
  )
}

function mapRoleUnitToRateUnit(unit: RoleRecord['default_unit']) {
  return unit === 'day' ? 'daily' : 'hourly'
}

function readRoleLocation(role: RoleRecord) {
  return (
    role.location_label ||
    [role.city, role.region, role.country]
      .filter((value) => value && value.trim())
      .join(', ')
  )
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function readFirstDefinedString(
  source: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = readOptionalString(source[key])
    if (value) return value
  }
  return undefined
}

function readSiteDerivedFields(siteOption: ReferenceOption | null) {
  if (!siteOption) {
    return {
      city: undefined,
      stateProvince: undefined,
      country: undefined,
      legalEntityId: undefined,
    }
  }

  const raw = siteOption.raw || {}
  const city = readFirstDefinedString(raw, ['city', 'site_city'])
  const stateProvince = readFirstDefinedString(raw, [
    'state_province',
    'state',
    'province',
    'region',
  ])
  const country = readFirstDefinedString(raw, ['country', 'site_country'])

  const legalEntityIdRaw = raw.legal_entity_id ?? raw.legal_entity
  const legalEntityId =
    typeof legalEntityIdRaw === 'string'
      ? legalEntityIdRaw.trim() || undefined
      : typeof legalEntityIdRaw === 'number' && Number.isFinite(legalEntityIdRaw)
        ? String(legalEntityIdRaw)
        : undefined

  return {
    city,
    stateProvince,
    country,
    legalEntityId,
  }
}

type DefineField =
  | 'role'
  | 'description'
  | 'startDate'
  | 'endDate'
  | 'positions'
  | 'costCenter'
  | 'site'
  | 'legalEntity'

type DefineErrors = Partial<Record<DefineField, string>>

const DEFINE_FIELD_IDS: Record<DefineField, string> = {
  role: 'job-role',
  description: 'job-description',
  startDate: 'job-start-date',
  endDate: 'job-end-date',
  positions: 'job-positions',
  costCenter: 'job-cost-center',
  site: 'job-site',
  legalEntity: 'job-legal-entity',
}

function fieldControlClass(hasError = false) {
  return [
    'mt-2 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] text-[#26312f] shadow-sm outline-none transition',
    'placeholder:text-[#9aa09d] hover:border-[#aaa191] focus:ring-4',
    hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
      : 'border-[#cfc7b8] focus:border-[#255345] focus:ring-[#d9efe5]',
  ].join(' ')
}

function FieldError({
  field,
  message,
}: {
  field: DefineField
  message?: string
}) {
  if (!message) return null

  return (
    <p
      id={`${DEFINE_FIELD_IDS[field]}-error`}
      role="alert"
      className="mt-2 text-xs font-medium text-rose-600"
    >
      {message}
    </p>
  )
}

export default function CWDefinePage() {
  const router = useRouter()
  const { request, update } = useCWRequest()

  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [costCenters, setCostCenters] = useState<ReferenceOption[]>(
    [],
  )
  const [sites, setSites] = useState<ReferenceOption[]>([])
  const [legalEntities, setLegalEntities] = useState<LegalEntityRecord[]>(
    [],
  )
  const [referenceLoading, setReferenceLoading] = useState(false)
  const [referenceError, setReferenceError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [savingStep, setSavingStep] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<DefineErrors>({})

  const selectedRole =
    request.roleId !== undefined
      ? roles.find((role) => role.id === request.roleId) || null
      : null
  const selectedRoleLocation = selectedRole
    ? readRoleLocation(selectedRole)
    : ''
  const roleSelectValue =
    request.roleId !== undefined
      ? String(request.roleId)
      : request.role
        ? '__legacy__'
        : ''
  const legalEntitySelectValue = request.legalEntityId || ''

  const clearFieldError = (field: DefineField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setSaveError('')
  }

  const validateDefineStep = () => {
    const errors: DefineErrors = {}

    if (request.roleId === undefined) {
      errors.role = 'Select a role from the master data list.'
    }
    if (!request.description?.trim()) {
      errors.description = 'Add a description of the work to be performed.'
    }
    if (!request.startDate) {
      errors.startDate = 'Select a start date.'
    }
    if (!request.endDate) {
      errors.endDate = 'Select an end date.'
    } else if (request.startDate && request.endDate < request.startDate) {
      errors.endDate = 'End date must be on or after the start date.'
    }
    if (
      request.positions === undefined ||
      !Number.isInteger(request.positions) ||
      request.positions <= 0
    ) {
      errors.positions = 'Enter at least one position using a whole number.'
    }
    if (request.costCenterId === undefined) {
      errors.costCenter = 'Select a cost center.'
    }
    if (request.siteId === undefined) {
      errors.site = 'Select a site.'
    }
    if (!request.legalEntityId) {
      errors.legalEntity = 'Select a legal entity.'
    }

    return errors
  }

  const handleRoleChange = (value: string) => {
    if (!value) {
      update({
        roleId: undefined,
        jobTemplateId: undefined,
        role: undefined,
      })
      return
    }

    const nextRole = roles.find((role) => role.id === Number(value))
    if (!nextRole) return

    update({
      roleId: nextRole.id,
      jobTemplateId: undefined,
      role: nextRole.name,
      description: nextRole.description || '',
      country: nextRole.country || '',
      stateProvince: nextRole.region || '',
      city: nextRole.city || '',
      region: nextRole.region || nextRole.city || '',
      currency: nextRole.default_currency || undefined,
      rateUnit: mapRoleUnitToRateUnit(nextRole.default_unit),
    })
  }

  const handleContinue = async () => {
    const errors = validateDefineStep()
    const firstInvalidField = Object.keys(errors)[0] as
      | DefineField
      | undefined

    if (firstInvalidField) {
      setFieldErrors(errors)
      setSaveError('Complete the highlighted required fields to continue.')
      window.requestAnimationFrame(() => {
        document.getElementById(DEFINE_FIELD_IDS[firstInvalidField])?.focus()
      })
      return
    }

    const role = request.role?.trim() || ''

    setSavingStep(true)
    setSaveError('')
    setFieldErrors({})

    const customFields = request.customFields || {}

    const definePayload = {
      title: role,
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
      roleDefinition: request.roleId,
      legalEntity: request.legalEntityId,
      country: request.country || undefined,
      stateProvince:
        request.stateProvince || request.region || undefined,
      city: request.city || undefined,
      customFields,
    }

    try {
      let intakeId = request.intakeId

      if (!intakeId) {
        const created = await createIntakeDraft({
          engagementType: 'staffing',
          ...definePayload,
          targetRate:
            typeof request.targetRate === 'number'
              ? request.targetRate.toFixed(2)
              : undefined,
          rateUnit: request.rateUnit || 'hourly',
          budgetAmount:
            typeof request.budgetAmount === 'number'
              ? request.budgetAmount.toFixed(2)
              : undefined,
          currency: request.currency || 'USD',
          supplier: request.supplierId,
          rateCard: request.selectedRateCardId,
          overtimeEnabled: request.overtimeEnabled,
          overtimeMultiplier:
            typeof request.overtimeFactor === 'number'
              ? request.overtimeFactor.toFixed(2)
              : undefined,
          qualificationsEnabled: request.qualificationsEnabled,
          qualifications: request.qualifications,
        })

        intakeId = created.id
        update({ intakeId: created.id })
      } else {
        await patchIntake(intakeId, definePayload)
      }

      router.push('/requests/new/job/create/qualifications')
    } catch (error) {
      if (
        error instanceof IntakeApiError &&
        error.status === 401
      ) {
        router.replace('/auth/login?next=/requests/new/job/create/define')
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

  useEffect(() => {
    let cancelled = false

    const loadReferenceData = async () => {
      setReferenceLoading(true)
      setReferenceError('')

      const [
        rolesResult,
        costCentersResult,
        sitesResult,
        legalEntitiesResult,
      ] = await Promise.allSettled([
        getRoles({ is_active: true }),
        getCostCenters(),
        getSites(),
        getLegalEntities(),
      ])

      if (cancelled) return

      const results = [
        rolesResult,
        costCentersResult,
        sitesResult,
        legalEntitiesResult,
      ]
      if (
        results.some(
          (result) =>
            result.status === 'rejected' &&
            isUnauthorizedError(result.reason),
        )
      ) {
        setReferenceLoading(false)
        router.replace('/auth/login?next=/requests/new/job/create/define')
        return
      }

      if (rolesResult.status === 'fulfilled') {
        setRoles(rolesResult.value)
      } else {
        setRoles([])
      }

      if (costCentersResult.status === 'fulfilled') {
        setCostCenters(costCentersResult.value)
      } else {
        setCostCenters([])
      }

      if (sitesResult.status === 'fulfilled') {
        setSites(sitesResult.value)
      } else {
        setSites([])
      }

      if (legalEntitiesResult.status === 'fulfilled') {
        setLegalEntities(legalEntitiesResult.value)
      } else {
        setLegalEntities([])
      }

      const errors: string[] = []
      if (rolesResult.status === 'rejected') {
        errors.push(
          readErrorMessage(rolesResult.reason, 'Unable to load roles.'),
        )
      }
      if (costCentersResult.status === 'rejected') {
        errors.push(
          readErrorMessage(
            costCentersResult.reason,
            'Unable to load cost centers.',
          ),
        )
      }
      if (sitesResult.status === 'rejected') {
        errors.push(
          readErrorMessage(sitesResult.reason, 'Unable to load sites.'),
        )
      }
      if (legalEntitiesResult.status === 'rejected') {
        errors.push(
          readErrorMessage(
            legalEntitiesResult.reason,
            'Unable to load legal entities.',
          ),
        )
      }

      setReferenceError(
        Array.from(new Set(errors.filter(Boolean))).join(' '),
      )
      setReferenceLoading(false)
    }

    void loadReferenceData()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <form
      className="mx-auto max-w-6xl space-y-6 pb-10"
      onSubmit={(event) => {
        event.preventDefault()
        void handleContinue()
      }}
      noValidate
    >
      <header className="relative overflow-hidden rounded-lg border border-[#33413d] bg-[#1e2528] px-6 py-7 text-white shadow-[0_24px_60px_-42px_rgba(31,61,56,0.8)] sm:px-8">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#89d3bd]/10" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#89d3bd]">
              <span className="h-2 w-2 rounded-full bg-[#89d3bd]" />
              New job request
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight !text-white">
              Job setup
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c8d0cc]">
              Define the role, timing, ownership, and work location for this
              engagement.
            </p>
          </div>
          <p className="text-xs text-[#aeb8b2]">
            Required fields are marked <span className="text-[#ff8d7e]">*</span>
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-[#cfc7b8] bg-[#fcfbf7] shadow-[0_20px_50px_-42px_rgba(31,61,56,0.7)]">
        <div className="flex items-start gap-4 border-b border-[#e5ded2] px-6 py-5 sm:px-7">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e9f5ef] text-xs font-bold text-[#1f3d38]">
            01
          </span>
          <div>
            <h2 className="text-base font-semibold text-[#26312f]">
              Role and defaults
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#6b746f]">
              Select a governed role to prefill its description, location,
              currency, and rate-unit defaults.
            </p>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-7">
          <label
            htmlFor={DEFINE_FIELD_IDS.role}
            className="block text-sm font-semibold text-[#3d4945]"
          >
            Role
            <RequiredIndicator />
          </label>
          <select
            id={DEFINE_FIELD_IDS.role}
            className={`${fieldControlClass(Boolean(fieldErrors.role))} h-12 disabled:cursor-wait disabled:bg-[#f4f1ea]`}
            value={roleSelectValue}
            onChange={(event) => {
              clearFieldError('role')
              handleRoleChange(event.target.value)
            }}
            disabled={referenceLoading}
            required
            aria-invalid={Boolean(fieldErrors.role)}
            aria-describedby={fieldErrors.role ? `${DEFINE_FIELD_IDS.role}-error` : undefined}
          >
            <option value="">Select a role</option>
            {request.role && request.roleId === undefined && (
              <option value="__legacy__">
                {request.role} (legacy selection)
              </option>
            )}
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
                {readRoleLocation(role)
                  ? ` · ${readRoleLocation(role)}`
                  : ''}
              </option>
            ))}
          </select>
          <FieldError field="role" message={fieldErrors.role} />

          {selectedRole && (
            <dl className="mt-4 flex flex-wrap gap-2 text-xs text-[#52605c]">
              <div className="rounded-full border border-[#d8d1c4] bg-[#f4f1ea] px-3 py-1.5">
                <dt className="inline text-[#8b918e]">Code </dt>
                <dd className="inline font-semibold text-[#3d4945]">
                  {selectedRole.code}
                </dd>
              </div>
              <div className="rounded-full border border-[#d8d1c4] bg-[#f4f1ea] px-3 py-1.5">
                <dt className="inline text-[#8b918e]">Location </dt>
                <dd className="inline font-semibold text-[#3d4945]">
                  {selectedRoleLocation || 'N/A'}
                </dd>
              </div>
              <div className="rounded-full border border-[#d8d1c4] bg-[#f4f1ea] px-3 py-1.5">
                <dt className="inline text-[#8b918e]">Default </dt>
                <dd className="inline font-semibold text-[#3d4945]">
                  {selectedRole.default_currency}/{selectedRole.default_unit}
                </dd>
              </div>
            </dl>
          )}

          {!selectedRole && request.role && request.roleId === undefined && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              This draft references a deprecated freeform role. Select a role
              from the master data list to continue.
            </p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#cfc7b8] bg-[#fcfbf7] shadow-[0_20px_50px_-42px_rgba(31,61,56,0.7)]">
        <div className="flex items-start gap-4 border-b border-[#e5ded2] px-6 py-5 sm:px-7">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e9f5ef] text-xs font-bold text-[#1f3d38]">
            02
          </span>
          <div>
            <h2 className="text-base font-semibold text-[#26312f]">
              Engagement details
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#6b746f]">
              Add the scope, dates, organization ownership, and primary work
              location.
            </p>
          </div>
        </div>

        <div className="space-y-7 px-6 py-6 sm:px-7">
          <div>
            <label
              htmlFor={DEFINE_FIELD_IDS.description}
              className="block text-sm font-semibold text-[#3d4945]"
            >
              Description
              <RequiredIndicator />
            </label>
            <p className="mt-1 text-xs text-[#8b918e]">
              Summarize the outcome, responsibilities, and work to be performed.
            </p>
            <textarea
              id={DEFINE_FIELD_IDS.description}
              className={`${fieldControlClass(Boolean(fieldErrors.description))} min-h-[140px] resize-y`}
              rows={5}
              value={request.description || ''}
              onChange={(event) => {
                clearFieldError('description')
                update({ description: event.target.value })
              }}
              placeholder="Describe the work to be performed"
              required
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? `${DEFINE_FIELD_IDS.description}-error` : undefined}
            />
            <FieldError field="description" message={fieldErrors.description} />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor={DEFINE_FIELD_IDS.startDate}
                className="block text-sm font-semibold text-[#3d4945]"
              >
                Start date
                <RequiredIndicator />
              </label>
              <input
                id={DEFINE_FIELD_IDS.startDate}
                type="date"
                className={`${fieldControlClass(Boolean(fieldErrors.startDate))} h-12`}
                value={request.startDate || ''}
                onChange={(event) => {
                  clearFieldError('startDate')
                  clearFieldError('endDate')
                  update({ startDate: event.target.value })
                }}
                required
                aria-invalid={Boolean(fieldErrors.startDate)}
                aria-describedby={fieldErrors.startDate ? `${DEFINE_FIELD_IDS.startDate}-error` : undefined}
              />
              <FieldError field="startDate" message={fieldErrors.startDate} />
            </div>

            <div>
              <label
                htmlFor={DEFINE_FIELD_IDS.endDate}
                className="block text-sm font-semibold text-[#3d4945]"
              >
                End date
                <RequiredIndicator />
              </label>
              <input
                id={DEFINE_FIELD_IDS.endDate}
                type="date"
                min={request.startDate || undefined}
                className={`${fieldControlClass(Boolean(fieldErrors.endDate))} h-12`}
                value={request.endDate || ''}
                onChange={(event) => {
                  clearFieldError('endDate')
                  update({ endDate: event.target.value })
                }}
                required
                aria-invalid={Boolean(fieldErrors.endDate)}
                aria-describedby={fieldErrors.endDate ? `${DEFINE_FIELD_IDS.endDate}-error` : undefined}
              />
              <FieldError field="endDate" message={fieldErrors.endDate} />
            </div>
          </div>

          <div className="h-px bg-[#ebe5d8]" />

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label
                htmlFor={DEFINE_FIELD_IDS.positions}
                className="block text-sm font-semibold text-[#3d4945]"
              >
                Positions
                <RequiredIndicator />
              </label>
              <input
                id={DEFINE_FIELD_IDS.positions}
                type="number"
                min={1}
                step={1}
                className={`${fieldControlClass(Boolean(fieldErrors.positions))} h-12`}
                value={request.positions ?? ''}
                onChange={(event) => {
                  clearFieldError('positions')
                  update({
                    positions: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }}
                placeholder="1"
                required
                aria-invalid={Boolean(fieldErrors.positions)}
                aria-describedby={fieldErrors.positions ? `${DEFINE_FIELD_IDS.positions}-error` : undefined}
              />
              <FieldError field="positions" message={fieldErrors.positions} />
            </div>

            <div>
              <label
                htmlFor={DEFINE_FIELD_IDS.costCenter}
                className="block text-sm font-semibold text-[#3d4945]"
              >
                Cost center
                <RequiredIndicator />
              </label>
              <select
                id={DEFINE_FIELD_IDS.costCenter}
                className={`${fieldControlClass(Boolean(fieldErrors.costCenter))} h-12 disabled:cursor-wait disabled:bg-[#f4f1ea]`}
                value={request.costCenterId ?? ''}
                onChange={(event) => {
                  clearFieldError('costCenter')
                  update({
                    costCenterId: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                    costCenter: event.target.value
                      ? costCenters.find(
                          (option) =>
                            option.id === Number(event.target.value),
                        )?.label
                      : undefined,
                  })
                }}
                disabled={referenceLoading}
                required
                aria-invalid={Boolean(fieldErrors.costCenter)}
                aria-describedby={fieldErrors.costCenter ? `${DEFINE_FIELD_IDS.costCenter}-error` : undefined}
              >
                <option value="">Select a cost center</option>
                {costCenters.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError field="costCenter" message={fieldErrors.costCenter} />
            </div>

            <div>
              <label
                htmlFor={DEFINE_FIELD_IDS.site}
                className="block text-sm font-semibold text-[#3d4945]"
              >
                Site
                <RequiredIndicator />
              </label>
              <select
                id={DEFINE_FIELD_IDS.site}
                className={`${fieldControlClass(Boolean(fieldErrors.site))} h-12 disabled:cursor-wait disabled:bg-[#f4f1ea]`}
                value={request.siteId ?? ''}
                onChange={(event) => {
                  clearFieldError('site')
                  if (!event.target.value) {
                    update({
                      siteId: undefined,
                      city: undefined,
                      stateProvince: undefined,
                      region: undefined,
                    })
                    return
                  }

                  const nextSiteId = Number(event.target.value)
                  const selectedSite =
                    sites.find((option) => option.id === nextSiteId) ||
                    null
                  const derived = readSiteDerivedFields(selectedSite)

                  if (derived.legalEntityId) {
                    clearFieldError('legalEntity')
                  }
                  update({
                    siteId: nextSiteId,
                    city: derived.city ?? undefined,
                    stateProvince: derived.stateProvince ?? undefined,
                    region: derived.stateProvince ?? undefined,
                    country: derived.country ?? request.country,
                    legalEntityId:
                      derived.legalEntityId ?? request.legalEntityId,
                  })
                }}
                disabled={referenceLoading}
                required
                aria-invalid={Boolean(fieldErrors.site)}
                aria-describedby={fieldErrors.site ? `${DEFINE_FIELD_IDS.site}-error` : undefined}
              >
                <option value="">Select a site</option>
                {sites.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError field="site" message={fieldErrors.site} />
            </div>

            <div>
              <label
                htmlFor={DEFINE_FIELD_IDS.legalEntity}
                className="block text-sm font-semibold text-[#3d4945]"
              >
                Legal entity
                <RequiredIndicator />
              </label>
              <select
                id={DEFINE_FIELD_IDS.legalEntity}
                className={`${fieldControlClass(Boolean(fieldErrors.legalEntity))} h-12 disabled:cursor-wait disabled:bg-[#f4f1ea]`}
                value={legalEntitySelectValue}
                onChange={(event) => {
                  clearFieldError('legalEntity')
                  update({
                    legalEntityId: event.target.value || undefined,
                  })
                }}
                disabled={referenceLoading}
                required
                aria-invalid={Boolean(fieldErrors.legalEntity)}
                aria-describedby={fieldErrors.legalEntity ? `${DEFINE_FIELD_IDS.legalEntity}-error` : undefined}
              >
                <option value="">Select a legal entity</option>
                {legalEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                    {entity.country ? ` · ${entity.country}` : ''}
                  </option>
                ))}
              </select>
              <FieldError field="legalEntity" message={fieldErrors.legalEntity} />
            </div>
          </div>

          <div className="rounded-lg border border-[#d8d1c4] bg-[#f4f1ea]/70 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#3d4945]">
                  Derived location
                </h3>
                <p className="mt-1 text-xs text-[#8b918e]">
                  These values are filled automatically from the selected site.
                </p>
              </div>
              <span className="rounded-full border border-[#cfc7b8] bg-[#fcfbf7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#6b746f]">
                Read only
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="job-country" className="block text-xs font-semibold text-[#6b746f]">
                  Country
                </label>
                <input
                  id="job-country"
                  className="mt-2 w-full rounded-lg border border-[#ded7ca] bg-[#ebe5d8]/70 px-3.5 py-2.5 text-sm font-medium text-[#52605c] outline-none"
                  value={request.country || ''}
                  placeholder="Derived from site"
                  readOnly
                />
              </div>

              <div>
                <label htmlFor="job-region" className="block text-xs font-semibold text-[#6b746f]">
                  State / Province
                </label>
                <input
                  id="job-region"
                  className="mt-2 w-full rounded-lg border border-[#ded7ca] bg-[#ebe5d8]/70 px-3.5 py-2.5 text-sm font-medium text-[#52605c] outline-none"
                  value={request.stateProvince || request.region || ''}
                  placeholder="Derived from site"
                  readOnly
                />
              </div>

              <div>
                <label htmlFor="job-city" className="block text-xs font-semibold text-[#6b746f]">
                  City
                </label>
                <input
                  id="job-city"
                  className="mt-2 w-full rounded-lg border border-[#ded7ca] bg-[#ebe5d8]/70 px-3.5 py-2.5 text-sm font-medium text-[#52605c] outline-none"
                  value={request.city || ''}
                  placeholder="Derived from site"
                  readOnly
                />
              </div>
            </div>
          </div>

          {referenceError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {referenceError}
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-4 z-20 flex flex-col gap-4 rounded-lg border border-[#cfc7b8] bg-[#fcfbf7]/95 px-5 py-4 shadow-[0_18px_48px_-28px_rgba(31,61,56,0.55)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          {saveError ? (
            <p className="text-sm font-semibold text-rose-700">{saveError}</p>
          ) : (
            <p className="text-sm font-medium text-[#52605c]">
              Complete this step to continue to qualifications.
            </p>
          )}
          <p className="mt-1 text-xs text-[#8b918e]">
            Your progress is saved as a draft when you continue.
          </p>
        </div>
        <button
          type="submit"
          disabled={savingStep}
          className="inline-flex h-11 min-w-[132px] items-center justify-center rounded-lg bg-[#1f3d38] px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#255345] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#d9efe5] disabled:cursor-wait disabled:opacity-60"
        >
          {savingStep ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}
