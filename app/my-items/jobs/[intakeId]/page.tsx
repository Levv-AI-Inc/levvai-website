'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronUp,
  Circle,
  Clock3,
  DollarSign,
  FileText,
  GitBranch,
  Info,
  Landmark,
  Loader2,
  MapPin,
  Percent,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
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
import {
  LevvDetailTile,
  LevvPanel,
  LevvPanelHeader,
  LevvStatCard,
} from '@/components/ui/levv-app'
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
        'levv-pill inline-flex items-center rounded-[999px] border px-2.5 py-1 text-[10px] font-semibold',
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
                (entity) => String(entity.id) === String(intake.legalEntity),
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
  const workflowStatus = intake?.approvalStatus || intake?.status || 'submitted'
  const isDraft = intake?.status?.trim().toLowerCase() === 'draft'
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
    intake?.roleDefinitionName || lookupLabels.role || intake?.title || '-'
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
    (intake?.legalEntity ? `Legal entity #${intake.legalEntity}` : '-')

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

  const approvalStatus = workflowStatus.trim().toLowerCase()
  const approvalComplete =
    approvalStatus === 'approved' ||
    (chain.steps.length > 0 && approvalsRemaining === 0)

  return (
    <div className="levv-job-detail -m-5 min-h-full bg-[#f4f7fb] sm:-m-6 lg:-m-8">
      <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/my-items/jobs"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#64748b] transition hover:text-[#2563eb]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to My Job Postings
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[#101b3c] lg:text-[2.15rem]">
              {intake?.title || roleLabel || 'Request detail'}
            </h1>
            <p className="mt-1.5 text-sm text-[#64748b]">
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
                  className="inline-flex items-center gap-2 rounded-xl bg-[#101b3c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#192a56] disabled:cursor-not-allowed disabled:opacity-60"
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
              <StatusPill
                icon={CheckCircle2}
                label={toTitleCase(intake.status)}
                tone="success"
              />
              <StatusPill
                icon={approvalComplete ? CheckCircle2 : Clock3}
                label={`Approval: ${toTitleCase(intake.approvalStatus || workflowStatus)}`}
                tone={approvalComplete ? 'success' : 'warning'}
              />
            </div>
          ) : null}
        </div>

        {loading ? (
          <section className="rounded-[18px] border border-[#e1e8f2] bg-[#ffffff] p-12 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#eef4ff]">
                <Loader2 className="h-7 w-7 animate-spin text-[#2563eb]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#101b3c]">
                  Loading request detail
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Pulling request information and approval routing.
                </p>
              </div>
            </div>
          </section>
        ) : error || !intake ? (
          <section className="rounded-[18px] border border-rose-200 bg-rose-50 p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-900">
              Request detail unavailable
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-700">
              {error || 'Unable to load request detail.'}
            </p>
            <div className="mt-5">
              <Link
                href="/my-items/jobs"
                className="inline-flex items-center gap-2 rounded-xl bg-[#101b3c] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#192a56]"
              >
                Back to requests
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : (
          <>
            {resumeError ? (
              <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {resumeError}
              </div>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={ReceiptText}
                label="Request ID"
                value={intake.requestId || `INT-${intake.id}`}
                tone="emerald"
              />
              <SummaryCard
                icon={UserRound}
                label="Current approver"
                value={currentApproverName || 'Completed'}
                tone="blue"
              />
              <SummaryCard
                icon={Clock3}
                label="Approvals remaining"
                value={String(approvalsRemaining)}
                tone="blue"
              />
              <SummaryCard
                icon={CalendarDays}
                label="Submitted"
                value={formatDate(intake.submittedAt || intake.createdAt)}
                tone="blue"
              />
            </section>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="space-y-5">
                <DetailSection
                  icon={ReceiptText}
                  title="Request details"
                  description="Core details for this staffing request."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailField
                      icon={Briefcase}
                      label="Role"
                      value={roleLabel}
                    />
                    <DetailField
                      icon={Users}
                      label="Engagement type"
                      value={toTitleCase(intake.engagementType)}
                    />
                    <DetailField
                      icon={Users}
                      label="Worker count"
                      value={String(intake.workerCount || 0)}
                    />
                    <DetailField
                      icon={Building2}
                      label="Supplier"
                      value={supplierLabel}
                    />
                    <DetailField
                      icon={CalendarDays}
                      label="Start date"
                      value={formatDate(intake.startDate)}
                    />
                    <DetailField
                      icon={CalendarDays}
                      label="End date"
                      value={formatDate(intake.endDate)}
                    />
                    <DetailField
                      icon={FileText}
                      label="Description"
                      value={intake.description || 'No description provided.'}
                      wide
                    />
                  </div>
                </DetailSection>

                <DetailSection
                  icon={DollarSign}
                  title="Commercials"
                  description="Financial details for this request."
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField
                      icon={DollarSign}
                      label="Bill rate"
                      value={formatMoney(
                        intake.billRate || intake.targetRate,
                        intake.currency,
                        intake.rateCardPricing?.unit || intake.rateUnit,
                      )}
                    />
                    <DetailField
                      icon={DollarSign}
                      label="Base rate"
                      value={formatMoney(
                        intake.baseRate || intake.targetRate,
                        intake.currency,
                        intake.rateCardPricing?.unit || intake.rateUnit,
                      )}
                    />
                    <DetailField
                      icon={Wallet}
                      label="Budget amount"
                      value={formatMoney(intake.budgetAmount, intake.currency)}
                    />
                    <DetailField
                      icon={Percent}
                      label="Markup"
                      value={
                        intake.markupPercent?.trim()
                          ? `${intake.markupPercent}%`
                          : '-'
                      }
                    />
                    <DetailField
                      icon={Landmark}
                      label="Currency"
                      value={intake.currency || '-'}
                    />
                    <DetailField
                      icon={Clock3}
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
                  </div>
                </DetailSection>

                <DetailSection
                  icon={MapPin}
                  title="Location & entity"
                  description="Worksite and organizational context."
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DetailField
                      icon={Building2}
                      label="Site"
                      value={siteLabel}
                    />
                    <DetailField
                      icon={MapPin}
                      label="Location"
                      value={
                        intake.workLocationLabel ||
                        [intake.city, intake.stateProvince, intake.country]
                          .filter(Boolean)
                          .join(', ') ||
                        '-'
                      }
                    />
                    <DetailField
                      icon={Landmark}
                      label="Legal entity"
                      value={legalEntityLabel}
                    />
                    <DetailField
                      icon={Wallet}
                      label="Cost center"
                      value={costCenterLabel}
                    />
                  </div>
                </DetailSection>

                <DetailSection
                  icon={ShieldCheck}
                  title="Qualifications"
                  description="Required and preferred qualifications attached to this request."
                >
                  {intake.qualificationsEnabled &&
                  intake.qualifications &&
                  intake.qualifications.length > 0 ? (
                    <div className="space-y-3">
                      {intake.qualifications.map((qualification, index) => (
                        <div
                          key={
                            qualification.id || `${qualification.name}-${index}`
                          }
                          className="levv-soft-card rounded-[14px] border border-[#e2e8f0] bg-[#f8fafc] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[#17213c]">
                                {qualification.name}
                              </div>
                              <div className="mt-1 text-sm text-[#64748b]">
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
                            <p className="mt-3 text-sm leading-6 text-[#52637a]">
                              {qualification.description}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center rounded-[14px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-5 py-7 text-center">
                      <FileText className="h-6 w-6 text-[#94a3b8]" />
                      <div className="mt-2 text-sm font-medium text-[#64748b]">
                        No qualifications were added to this request.
                      </div>
                      <p className="mt-1 text-xs text-[#94a3b8]">
                        Add qualifications to define required skills,
                        experience, or certifications.
                      </p>
                    </div>
                  )}
                </DetailSection>

                {Array.isArray(intake.validationWarnings) &&
                intake.validationWarnings.length > 0 ? (
                  <DetailSection
                    icon={Info}
                    title="Validation warnings"
                    description="Items that may need attention on this request."
                  >
                    <div className="space-y-3">
                      {intake.validationWarnings.map((warning, index) => (
                        <div
                          key={`warning-${index}`}
                          className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                        >
                          {stringifyWarning(warning)}
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                ) : null}
              </div>

              <aside className="space-y-5 xl:sticky xl:top-24">
                <ApprovalStatusCard
                  approvalComplete={approvalComplete}
                  approvalsRemaining={approvalsRemaining}
                  currentApproverName={currentApproverName}
                  submittedAt={intake.submittedAt || intake.createdAt}
                />

                <section className="levv-detail-panel rounded-[18px] border border-[#e1e8f2] bg-[#ffffff] p-5 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#eaf2ff] text-[#2563eb]">
                        <GitBranch className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[#101b3c]">
                          Matched chain
                        </h2>
                        <p className="mt-0.5 text-xs text-[#64748b]">
                          This request matched the approval chain below.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="levv-soft-card mt-5 rounded-[14px] border border-[#e6edf6] bg-[#fbfdff] p-4">
                    <div className="text-sm font-semibold text-[#17213c]">
                      {chain.name}
                    </div>
                    {chain.description ? (
                      <p className="mt-1 text-xs leading-5 text-[#64748b]">
                        {chain.description}
                      </p>
                    ) : null}
                    <dl className="mt-4 space-y-3 text-xs">
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
                  </div>

                  <div className="mt-5 border-t border-[#e8edf5] pt-5">
                    <h3 className="text-sm font-semibold text-[#17213c]">
                      Approval route
                    </h3>
                    {chain.steps.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {chain.steps.map((step, index) => {
                          const stepStatus = normalizeApprovalStepStatus(
                            step.status,
                            index,
                          )

                          return (
                            <div
                              key={`${step.sequence}-${step.approverId || step.approverName}`}
                              className="levv-soft-card rounded-[14px] border border-[#e2e8f0] bg-[#f8fafc] p-4"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                                    stepStatus === 'current'
                                      ? 'border-blue-200 bg-blue-50 text-blue-600'
                                      : stepStatus === 'approved'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                        : 'border-slate-200 bg-[#ffffff] text-slate-500',
                                  )}
                                >
                                  {stepStatus === 'approved' ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    step.sequence
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-semibold text-[#17213c]">
                                        {step.approverName}
                                      </div>
                                      <p className="mt-0.5 text-xs text-[#64748b]">
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
                                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#64748b]">
                                    <span>
                                      Threshold:{' '}
                                      <strong className="font-semibold text-[#334155]">
                                        {formatApprovalStepAmount(
                                          step.amount,
                                          step.currency,
                                        )}
                                      </strong>
                                    </span>
                                    <span>
                                      Sequence:{' '}
                                      <strong className="font-semibold text-[#334155]">
                                        Step {step.sequence}
                                      </strong>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[14px] border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-center text-sm text-[#64748b]">
                        No approval steps were returned.
                      </div>
                    )}
                  </div>

                  <div className="levv-blue-note mt-5 flex gap-3 rounded-[14px] border border-[#dbeafe] bg-[#eff6ff] p-4 text-xs leading-5 text-[#4f6b95]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
                    <p>
                      The approval chain is determined by your
                      organization&apos;s staffing policies and may vary based
                      on request details.
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ElementType
  label: string
  tone: 'success' | 'warning'
}) {
  const tones = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
  }

  return (
    <span
      className={`levv-status-chip inline-flex items-center gap-2 rounded-[12px] border px-4 py-2.5 text-sm font-semibold shadow-sm ${tones[tone]}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </span>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  tone: 'emerald' | 'blue'
}) {
  return (
    <LevvStatCard icon={Icon} label={label} value={value} tone={tone} />
  )
}

function DetailSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <LevvPanel className="levv-detail-panel p-5 sm:p-6">
      <LevvPanelHeader
        icon={Icon}
        title={title}
        description={description}
        actions={
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748b] transition hover:scale-105 hover:bg-[#f1f5f9] hover:text-[#2563eb] active:scale-95"
          >
            <ChevronUp
              className={`h-5 w-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        }
        className={collapsed ? 'mb-0' : 'mb-5'}
      />
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          collapsed
            ? 'grid-rows-[0fr] opacity-0'
            : 'grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </LevvPanel>
  )
}

function DetailField({
  icon: Icon,
  label,
  value,
  wide = false,
}: {
  icon: React.ElementType
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <LevvDetailTile
      icon={Icon}
      label={label}
      value={value}
      className={wide ? 'sm:col-span-2' : ''}
    />
  )
}

function ApprovalStatusCard({
  approvalComplete,
  approvalsRemaining,
  currentApproverName,
  submittedAt,
}: {
  approvalComplete: boolean
  approvalsRemaining: number
  currentApproverName: string
  submittedAt?: string | null
}) {
  return (
    <section className="levv-detail-panel rounded-[18px] border border-[#e1e8f2] bg-[#ffffff] p-5 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#eaf2ff] text-[#2563eb]">
            <GitBranch className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-[#101b3c]">Approval status</h2>
        </div>
      </div>

      <div className="mt-6 pl-1">
        <ProgressStep
          icon={Check}
          title="Request submitted"
          detail={formatDate(submittedAt)}
          state="complete"
          connector="complete"
        />
        <ProgressStep
          icon={approvalComplete ? Check : Clock3}
          title={
            approvalComplete ? 'Approval complete' : 'Approval in progress'
          }
          detail={
            approvalComplete
              ? 'All required approvals completed'
              : `Currently with ${currentApproverName || 'assigned approver'}`
          }
          state={approvalComplete ? 'complete' : 'current'}
          connector={approvalComplete ? 'complete' : 'current'}
        >
          {!approvalComplete ? (
            <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-[#dbeafe] bg-[#eff6ff] px-3 py-2.5 text-xs font-medium text-[#2563eb]">
              <Info className="h-4 w-4" />
              {approvalsRemaining} approval
              {approvalsRemaining === 1 ? '' : 's'} remaining
            </div>
          ) : null}
        </ProgressStep>
        <ProgressStep
          icon={approvalComplete ? Check : Circle}
          title="Approved"
          detail={approvalComplete ? 'Request approved' : 'Pending'}
          state={approvalComplete ? 'complete' : 'pending'}
        />
      </div>
    </section>
  )
}

function ProgressStep({
  icon: Icon,
  title,
  detail,
  state,
  connector,
  children,
}: {
  icon: React.ElementType
  title: string
  detail: string
  state: 'complete' | 'current' | 'pending'
  connector?: 'complete' | 'current'
  children?: React.ReactNode
}) {
  const iconClasses = {
    complete:
      'border-emerald-100 bg-emerald-500 text-white shadow-[0_0_0_5px_rgba(16,185,129,0.08)]',
    current:
      'border-blue-200 bg-blue-500 text-white shadow-[0_0_0_5px_rgba(59,130,246,0.12)]',
    pending: 'border-slate-300 bg-[#ffffff] text-slate-400',
  }

  return (
    <div className="relative flex gap-4 pb-7 last:pb-0">
      {connector ? (
        <div
          className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5 ${
            connector === 'complete'
              ? 'bg-emerald-400'
              : 'bg-gradient-to-b from-blue-500 to-slate-200'
          }`}
        />
      ) : null}
      <div
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-[999px] border ${iconClasses[state]}`}
      >
        <Icon className={state === 'pending' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-sm font-semibold text-[#17213c]">{title}</div>
        <p className="mt-1 text-xs leading-5 text-[#64748b]">{detail}</p>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[#64748b]">{label}</dt>
      <dd className="text-right font-medium text-[#17213c]">{value}</dd>
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
      className={`levv-pill inline-flex items-center rounded-[999px] border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
