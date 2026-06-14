'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCWRequest } from '../../context/CWRequestContext'
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
    const role = request.role?.trim() || ''
    if (!role) {
      setSaveError('Role is required before continuing.')
      return
    }

    setSavingStep(true)
    setSaveError('')

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
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Job setup</h1>
        <p className="text-sm text-gray-600 mt-1">
          Define the role and engagement details.
        </p>
      </div>

      <div className="border rounded-xl p-6 space-y-4 bg-white shadow-sm">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            Role
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Job templates are deprecated. Select a role to
            prefill the description, location, currency, and
            rate unit defaults for this request.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Role</label>
          <select
            className="mt-1 w-full border border-gray-300 rounded-md bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
            value={roleSelectValue}
            onChange={(event) => handleRoleChange(event.target.value)}
            disabled={referenceLoading}
          >
            <option value="">Select role</option>
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

          {selectedRole && (
            <p className="mt-2 text-sm text-gray-600">
              Code: {selectedRole.code} · Location:{' '}
              {selectedRoleLocation || 'N/A'} · Defaults:{' '}
              {selectedRole.default_currency}/
              {selectedRole.default_unit}
            </p>
          )}

          {!selectedRole && request.role && request.roleId === undefined && (
            <p className="mt-2 text-sm text-amber-700">
              This request still references a deprecated freeform
              role. Select a masterdata role to refresh the
              defaults.
            </p>
          )}
        </div>
      </div>

      <div className="border rounded-xl p-6 bg-white space-y-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium">
            Description
          </label>
          <textarea
            className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
            rows={4}
            value={request.description || ''}
            onChange={(event) =>
              update({ description: event.target.value })
            }
            placeholder="Describe the work to be performed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium">
              Start date
            </label>
            <input
              type="date"
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.startDate || ''}
              onChange={(event) =>
                update({ startDate: event.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              End date
            </label>
            <input
              type="date"
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.endDate || ''}
              onChange={(event) =>
                update({ endDate: event.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium">
              Positions
            </label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.positions || ''}
              onChange={(event) =>
                update({
                  positions: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              placeholder="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              Cost center
            </label>
            <select
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.costCenterId ?? ''}
              onChange={(event) =>
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
              }
              disabled={referenceLoading}
            >
              <option value="">Select cost center</option>
              {costCenters.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Site</label>
            <select
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.siteId ?? ''}
              onChange={(event) => {
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
            >
              <option value="">Select site</option>
              {sites.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">
              Legal entity
            </label>
            <select
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={legalEntitySelectValue}
              onChange={(event) =>
                update({
                  legalEntityId: event.target.value || undefined,
                })
              }
              disabled={referenceLoading}
            >
              <option value="">Select legal entity</option>
              {legalEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                  {entity.country
                    ? ` · ${entity.country}`
                    : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium">Country</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md bg-gray-50 p-2 text-sm text-gray-700"
              value={request.country || ''}
              placeholder="Derived from site"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              State / Province
            </label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md bg-gray-50 p-2 text-sm text-gray-700"
              value={request.stateProvince || request.region || ''}
              placeholder="Derived from site"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium">City</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md bg-gray-50 p-2 text-sm text-gray-700"
              value={request.city || ''}
              placeholder="Derived from site"
              readOnly
            />
          </div>
        </div>

        {referenceError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {referenceError}
          </div>
        )}

        {saveError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {saveError}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => void handleContinue()}
          disabled={savingStep}
          className="px-6 py-2.5 rounded-full bg-black text-white text-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          {savingStep ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
