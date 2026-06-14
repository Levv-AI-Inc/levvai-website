'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  GitBranch,
  Loader2,
  MapPin,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  IntakeApiError,
  getIntakeApprovalPreview,
  getIntakeById,
  type IntakeRecord,
} from '@/lib/api/intake'
import { getCostCenters } from '@/lib/api/costCenters'
import { getLegalEntities } from '@/lib/api/legalEntities'
import {
  countApprovalsRemaining,
  describeApprovalMatchStrategy,
  extractApprovalChainView,
  getApprovalComputedAt,
  getCurrentApproverName,
  formatApprovalDateTime,
  formatApprovalStepAmount,
  labelApprovalStepStatus,
  normalizeApprovalStepStatus,
} from '@/lib/intakeApprovalRoute'
import { useCWRequest } from '../../../requests/new/job/context/CWRequestContext'
import { getRoles } from '@/lib/api/roles'
import { getSites } from '@/lib/api/sites'
import { getSuppliers } from '@/lib/api/suppliers'
import {
  buildCWRequestFromIntake,
  getResumePathForDraft,
} from '@/lib/cwRequestDraft'

type LookupLabels = {
  role: string
  site: string
  supplier: string
  costCenter: string
  legalEntity: string
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function parseIntakeId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function toTitleCase(value: string | undefined) {
  if (!value) return '-'
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatMoney(amount?: string, currency?: string, unit?: string) {
  if (!amount?.trim()) return '-'

  const numeric = Number(amount)
  if (Number.isFinite(numeric) && currency?.trim()) {
    try {
      const formatted = new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: currency.trim().toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric)
      return unit ? `${formatted}/${unit}` : formatted
    } catch {
      return `${currency.trim().toUpperCase()} ${amount}`
    }
  }

  return unit ? `${amount}/${unit}` : amount
}

function formatQualificationSummary(
  responseMode?: string,
  minYears?: number,
  proficiency?: string,
  weight?: number,
) {
  if (responseMode === 'years') {
    return `${minYears || 0}+ years • ${proficiency || 'Intermediate'}`
  }
  if (responseMode === 'rating') {
    return `Rated qualification • ${proficiency || 'Intermediate'}`
  }
  if (responseMode === 'yes_no') {
    return 'Yes / No response'
  }
  return `Weighted preference • ${weight || 1}/5`
}

function stringifyWarning(value: unknown) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function statusClasses(status: string | undefined) {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'submitted' || normalized === 'processing') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (normalized === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  if (normalized === 'draft') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function StepStatusBadge({
  status,
  index,
}: {
  status?: string
  index: number
}) {
  const normalized = normalizeApprovalStepStatus(status, index)
  const classes =
    normalized === 'approved'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalized === 'rejected'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : normalized === 'current'
          ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
          : 'border-slate-200 bg-slate-50 text-slate-600'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        classes,
      )}
    >
      {labelApprovalStepStatus(status, index)}
    </span>
  )
}

export default function JobPostingDetailPage() {
  const params = useParams<{ intakeId: string }>()
  const router = useRouter()
  const { replace } = useCWRequest()
  const intakeId = parseIntakeId(params?.intakeId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [intake, setIntake] = useState<IntakeRecord | null>(null)
  const [approvalPreview, setApprovalPreview] = useState<
    Record<string, unknown>
  >({})
  const [lookupLabels, setLookupLabels] = useState<LookupLabels>({
    role: '',
    site: '',
    supplier: '',
    costCenter: '',
    legalEntity: '',
  })
  const [resuming, setResuming] = useState(false)
  const [resumeError, setResumeError] = useState('')

  useEffect(() => {
    if (intakeId === null) {
      setLoading(false)
      setError('This request could not be identified.')
      return
    }

    let cancelled = false

    const loadRequest = async () => {
      setLoading(true)
      setError('')

      const [intakeResult, previewResult] = await Promise.allSettled([
        getIntakeById(intakeId),
        getIntakeApprovalPreview(intakeId),
      ])

      if (cancelled) return

      if (intakeResult.status === 'rejected') {
        if (
          intakeResult.reason instanceof IntakeApiError &&
          intakeResult.reason.status === 401
        ) {
          router.replace(
            `/auth/login?next=/my-items/jobs/${encodeURIComponent(
              String(intakeId),
            )}`,
          )
          return
        }

        setError(
          intakeResult.reason instanceof Error
            ? intakeResult.reason.message
            : 'Unable to load request details.',
        )
        setIntake(null)
        setApprovalPreview({})
        setLoading(false)
        return
      }

      setIntake(intakeResult.value)

      if (previewResult.status === 'fulfilled') {
        setApprovalPreview(previewResult.value)
      } else {
        setApprovalPreview({})
      }

      setLoading(false)
    }

    void loadRequest()

    return () => {
      cancelled = true
    }
  }, [intakeId, router])

  useEffect(() => {
    if (!intake) return

    const missingRole = !intake.roleDefinitionName && intake.roleDefinition
    const missingSite = !intake.siteName && intake.site
    const missingSupplier = !intake.supplierName && intake.supplier
    const missingCostCenter = !intake.costCenterName && intake.costCenter
    const missingLegalEntity = !intake.legalEntityName && intake.legalEntity

    if (
      !missingRole &&
      !missingSite &&
      !missingSupplier &&
      !missingCostCenter &&
      !missingLegalEntity
    ) {
      setLookupLabels({
        role: '',
        site: '',
        supplier: '',
        costCenter: '',
        legalEntity: '',
      })
      return
    }

    let cancelled = false

    const loadLookupLabels = async () => {
      const [
        rolesResult,
        sitesResult,
        suppliersResult,
        costCentersResult,
        legalEntitiesResult,
      ] = await Promise.allSettled([
        missingRole ? getRoles() : Promise.resolve([]),
        missingSite ? getSites() : Promise.resolve([]),
        missingSupplier ? getSuppliers() : Promise.resolve([]),
        missingCostCenter ? getCostCenters() : Promise.resolve([]),
        missingLegalEntity ? getLegalEntities() : Promise.resolve([]),
      ])

      if (cancelled) return

      setLookupLabels({
        role:
          rolesResult.status === 'fulfilled'
            ? rolesResult.value.find(
                (role) => role.id === intake.roleDefinition,
              )?.name || ''
            : '',
        site:
          sitesResult.status === 'fulfilled'
            ? sitesResult.value.find(
                (site) => String(site.id) === String(intake.site),
              )?.name || ''
            : '',
        supplier:
          suppliersResult.status === 'fulfilled'
            ? suppliersResult.value.find((supplier) => {
                const supplierId =
                  typeof supplier.id === 'number' ||
                  typeof supplier.id === 'string'
                    ? String(supplier.id)
                    : supplier.supplier_id
                return supplierId === String(intake.supplier)
              })?.name || ''
            : '',
        costCenter:
          costCentersResult.status === 'fulfilled'
            ? costCentersResult.value.find(
                (costCenter) =>
                  String(costCenter.id) === String(intake.costCenter),
              )?.name || ''
            : '',
        legalEntity:
          legalEntitiesResult.status === 'fulfilled'
            ? legalEntitiesResult.value.find(
                (entity) =>
                  String(entity.id) === String(intake.legalEntity),
              )?.name || ''
            : '',
      })
    }

    void loadLookupLabels()

    return () => {
      cancelled = true
    }
  }, [intake])

  const chain = useMemo(
    () => extractApprovalChainView(intake, approvalPreview),
    [approvalPreview, intake],
  )
  const workflowStatus =
    intake?.approvalStatus || intake?.status || 'submitted'
  const isDraft =
    intake?.status?.trim().toLowerCase() === 'draft'
  const currentApproverName = getCurrentApproverName(
    intake,
    chain.steps,
    workflowStatus,
  )
  const approvalsRemaining = countApprovalsRemaining(
    chain.steps,
    workflowStatus,
    intake?.approvalRuntime?.approvalsRemaining,
  )

  const roleLabel =
    intake?.roleDefinitionName ||
    lookupLabels.role ||
    intake?.title ||
    '-'
  const supplierLabel =
    intake?.supplierName ||
    lookupLabels.supplier ||
    (intake?.supplier ? `Supplier #${intake.supplier}` : '-')
  const siteLabel =
    intake?.siteName ||
    lookupLabels.site ||
    (intake?.site ? `Site #${intake.site}` : '-')
  const costCenterLabel =
    intake?.costCenterName ||
    lookupLabels.costCenter ||
    (intake?.costCenter ? `Cost center #${intake.costCenter}` : '-')
  const legalEntityLabel =
    intake?.legalEntityName ||
    lookupLabels.legalEntity ||
    (intake?.legalEntity
      ? `Legal entity #${intake.legalEntity}`
      : '-')

  const handleResumeDraft = async () => {
    if (!intake || !isDraft) return

    setResumeError('')
    setResuming(true)

    try {
      replace(buildCWRequestFromIntake(intake))
      router.push(getResumePathForDraft(intake))
    } catch (error) {
      setResumeError(
        error instanceof Error
          ? error.message
          : 'Unable to resume this draft request.',
      )
      setResuming(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/my-items/jobs"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to My Job Postings
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {intake?.title || roleLabel || 'Request detail'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review request details, matched approval routing, and remaining
              approvals.
            </p>
          </div>

          {intake ? (
            <div className="flex flex-wrap items-center gap-3">
              {isDraft ? (
                <button
                  type="button"
                  onClick={() => void handleResumeDraft()}
                  disabled={resuming}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resuming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Resuming
                    </>
                  ) : (
                    <>
                      Resume editing
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : null}
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${statusClasses(
                  intake.status,
                )}`}
              >
                {toTitleCase(intake.status)}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${statusClasses(
                  intake.approvalStatus,
                )}`}
              >
                Approval: {toTitleCase(intake.approvalStatus)}
              </span>
            </div>
          ) : null}
        </div>

        {loading ? (
          <section className="rounded-3xl border bg-white p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Loading request detail
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pulling request information and approval routing.
                </p>
              </div>
            </div>
          </section>
        ) : error || !intake ? (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-900">
              Request detail unavailable
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-700">
              {error || 'Unable to load request detail.'}
            </p>
            <div className="mt-5">
              <Link
                href="/my-items/jobs"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Back to requests
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : (
          <>
            {resumeError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {resumeError}
              </div>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Request ID"
                value={intake.requestId || `INT-${intake.id}`}
              />
              <SummaryCard
                label="Current approver"
                value={currentApproverName || 'Completed'}
              />
              <SummaryCard
                label="Approvals remaining"
                value={String(approvalsRemaining)}
              />
              <SummaryCard
                label="Submitted"
                value={formatDate(intake.submittedAt || intake.createdAt)}
              />
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
              <div className="space-y-6">
                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <ReceiptText className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Request overview
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Core request fields submitted for this staffing intake.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <DetailField label="Role" value={roleLabel} />
                    <DetailField
                      label="Engagement type"
                      value={toTitleCase(intake.engagementType)}
                    />
                    <DetailField
                      label="Worker count"
                      value={String(intake.workerCount || 0)}
                    />
                    <DetailField label="Supplier" value={supplierLabel} />
                    <DetailField
                      label="Start date"
                      value={formatDate(intake.startDate)}
                    />
                    <DetailField
                      label="End date"
                      value={formatDate(intake.endDate)}
                    />
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Description
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                      {intake.description || 'No description provided.'}
                    </p>
                  </div>
                </section>

                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Commercials and location
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Financial, worksite, and entity context used in the
                        request.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <DetailField
                      label="Bill rate"
                      value={formatMoney(
                        intake.billRate || intake.targetRate,
                        intake.currency,
                        intake.rateCardPricing?.unit || intake.rateUnit,
                      )}
                    />
                    <DetailField
                      label="Base rate"
                      value={formatMoney(
                        intake.baseRate || intake.targetRate,
                        intake.currency,
                        intake.rateCardPricing?.unit || intake.rateUnit,
                      )}
                    />
                    <DetailField
                      label="Budget amount"
                      value={formatMoney(
                        intake.budgetAmount,
                        intake.currency,
                      )}
                    />
                    <DetailField
                      label="Markup"
                      value={
                        intake.markupPercent?.trim()
                          ? `${intake.markupPercent}%`
                          : '-'
                      }
                    />
                    <DetailField
                      label="Currency"
                      value={intake.currency || '-'}
                    />
                    <DetailField
                      label="Overtime"
                      value={
                        intake.overtimeEnabled
                          ? `Enabled${
                              intake.overtimeMultiplier
                                ? ` • ${intake.overtimeMultiplier}x`
                                : ''
                            }`
                          : 'Disabled'
                      }
                    />
                    <DetailField
                      label="Cost center"
                      value={costCenterLabel}
                    />
                    <DetailField
                      label="Legal entity"
                      value={legalEntityLabel}
                    />
                    <DetailField label="Site" value={siteLabel} />
                    <DetailField
                      label="Location"
                      value={intake.workLocationLabel || [
                        intake.city,
                        intake.stateProvince,
                        intake.country,
                      ]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    />
                  </div>
                </section>

                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Qualifications
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Required and preferred qualifications attached to this
                        request.
                      </p>
                    </div>
                  </div>

                  {intake.qualificationsEnabled &&
                  intake.qualifications &&
                  intake.qualifications.length > 0 ? (
                    <div className="mt-6 space-y-4">
                      {intake.qualifications.map((qualification, index) => (
                        <div
                          key={qualification.id || `${qualification.name}-${index}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-semibold text-slate-900">
                                {qualification.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {formatQualificationSummary(
                                  qualification.responseMode,
                                  qualification.minYears,
                                  qualification.proficiency,
                                  qualification.weight,
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <TinyBadge tone="blue">
                                {toTitleCase(qualification.type)}
                              </TinyBadge>
                              <TinyBadge
                                tone={
                                  qualification.group === 'must_have'
                                    ? 'rose'
                                    : 'emerald'
                                }
                              >
                                {qualification.group === 'must_have'
                                  ? 'Must have'
                                  : 'Nice to have'}
                              </TinyBadge>
                              {qualification.knockout ? (
                                <TinyBadge tone="rose">Knockout</TinyBadge>
                              ) : null}
                              {qualification.mandatory ? (
                                <TinyBadge tone="amber">Required</TinyBadge>
                              ) : null}
                            </div>
                          </div>
                          {qualification.description ? (
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              {qualification.description}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      No qualifications were added to this request.
                    </div>
                  )}
                </section>

                {Array.isArray(intake.validationWarnings) &&
                intake.validationWarnings.length > 0 ? (
                  <section className="rounded-3xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-slate-900">
                      Validation warnings
                    </h2>
                    <div className="mt-4 space-y-3">
                      {intake.validationWarnings.map((warning, index) => (
                        <div
                          key={`warning-${index}`}
                          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                        >
                          {stringifyWarning(warning)}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="space-y-6">
                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Matched chain
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900">
                        {chain.name}
                      </h2>
                    </div>
                  </div>

                  {chain.description ? (
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {chain.description}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-slate-500">
                      This request matched the approval chain below.
                    </p>
                  )}

                  <dl className="mt-6 space-y-4 text-sm">
                    <InfoRow
                      label="Match strategy"
                      value={describeApprovalMatchStrategy(
                        chain.matchStrategy,
                      )}
                    />
                  <InfoRow
                    label="Computed at"
                    value={formatApprovalDateTime(
                      getApprovalComputedAt(intake),
                    )}
                  />
                  <InfoRow
                    label="Current approver"
                    value={currentApproverName || 'Completed'}
                  />
                  <InfoRow
                    label="Approvals remaining"
                      value={String(approvalsRemaining)}
                    />
                  </dl>
                </section>

                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="border-b border-slate-200 pb-5">
                    <h2 className="text-xl font-semibold text-slate-900">
                      Approval route
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      See what approvals have to occur and what is still left in
                      the chain.
                    </p>
                  </div>

                  {chain.steps.length > 0 ? (
                    <div className="mt-6 space-y-5">
                      {chain.steps.map((step, index) => (
                        <div
                          key={`${step.sequence}-${step.approverId || step.approverName}`}
                        >
                          <div className="flex gap-4">
                            <div className="flex w-12 flex-col items-center">
                              <div
                                className={cn(
                                  'flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold',
                                  normalizeApprovalStepStatus(
                                    step.status,
                                    index,
                                  ) === 'current'
                                    ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                    : normalizeApprovalStepStatus(
                                          step.status,
                                          index,
                                        ) === 'approved'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-600',
                                )}
                              >
                                {step.sequence}
                              </div>
                              {index < chain.steps.length - 1 ? (
                                <div className="mt-2 h-full w-px bg-slate-200" />
                              ) : null}
                            </div>

                            <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <UserRound className="h-4 w-4 text-slate-500" />
                                    <h3 className="truncate text-base font-semibold text-slate-900">
                                      {step.approverName}
                                    </h3>
                                  </div>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {step.stepType === 'specific_user'
                                      ? 'Specific user approval'
                                      : 'Approval step'}
                                  </p>
                                </div>
                                <StepStatusBadge
                                  status={step.status}
                                  index={index}
                                />
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <DetailMini label="Threshold">
                                  {formatApprovalStepAmount(
                                    step.amount,
                                    step.currency,
                                  )}
                                </DetailMini>
                                <DetailMini label="Sequence">
                                  Step {step.sequence}
                                </DetailMini>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <div className="text-base font-medium text-slate-900">
                        No approval steps returned
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        The request detail loaded, but the approval preview did
                        not include resolved approvers.
                      </p>
                    </div>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-900">
        {value}
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-900">
        {value}
      </div>
    </div>
  )
}

function DetailMini({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-900">
        {children}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  )
}

function TinyBadge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'blue' | 'emerald' | 'rose' | 'amber'
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
