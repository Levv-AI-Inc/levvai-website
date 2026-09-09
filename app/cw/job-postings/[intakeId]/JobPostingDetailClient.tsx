'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronUp,
  Circle,
  Clock3,
  DollarSign,
  ExternalLink,
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
  X,
} from 'lucide-react'
import {
  IntakeApiError,
  createSelectedCandidate,
  getIntakeApprovalPreview,
  getIntakeById,
  getSelectedCandidates,
  type IntakeRecord,
  type SelectedCandidateCreatePayload,
  type SelectedCandidateRecord,
} from '@/lib/api/intake'
import {
  WorkOrderApiError,
  createWorkOrder,
  getWorkOrderById,
  getWorkOrders,
  patchWorkOrder,
  submitWorkOrder,
  type WorkOrderRecord,
  type WorkOrderWritePayload,
} from '@/lib/api/workOrders'
import { getSuppliers } from '@/lib/api/suppliers'
import {
  countApprovalsRemaining,
  describeApprovalMatchStrategy,
  extractApprovalChainView,
  formatApprovalDateTime,
  formatApprovalStepAmount,
  getApprovalComputedAt,
  getCurrentApproverName,
  normalizeApprovalStepStatus,
  labelApprovalStepStatus,
} from '@/lib/intakeApprovalRoute'
import {
  buildPendingWorkOrderCandidateFromSelection,
  clearPendingWorkOrderCandidate,
  getPendingWorkOrderCandidate,
  type PendingWorkOrderCandidate,
  savePendingWorkOrderCandidate,
} from '@/lib/workOrders'
import {
  LevvDetailTile,
  LevvPanel,
  LevvPanelHeader,
  LevvStatCard,
  levvUi,
} from '@/components/ui/levv-app'
import {
  normalizeRole,
  parseSessionRole,
  type SessionResponse,
} from '../../../suppliers/utils'

type CandidateFormState = {
  fullName: string
  email: string
  phone: string
  notes: string
  resumeUrl: string
  availableStartDate: string
  endDate: string
  proposedRate: string
  payRate: string
  currency: string
}

type JobPostingDetailClientProps = {
  backHref: string
  backLabel: string
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

function normalizeRateToTwoDecimals(value: string | null | undefined) {
  const raw = value?.trim()
  if (!raw) return ''

  const normalized = raw.replace(/,/g, '')
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return raw

  return numeric.toFixed(2)
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
  if (responseMode === 'yes_no') return 'Yes / No response'
  return `Weighted preference • ${weight || 1}/5`
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

function createInitialCandidateForm(
  intake: IntakeRecord | null,
): CandidateFormState {
  return {
    fullName: '',
    email: '',
    phone: '',
    notes: '',
    resumeUrl: '',
    availableStartDate: intake?.startDate || '',
    endDate: intake?.endDate || '',
    proposedRate: normalizeRateToTwoDecimals(
      intake?.payRate || intake?.baseRate || intake?.targetRate || '',
    ),
    payRate: '',
    currency: intake?.currency || 'USD',
  }
}

function buildWorkOrderPayload(args: {
  intake: IntakeRecord
  candidate: PendingWorkOrderCandidate
  workLocationLabel: string
}): WorkOrderWritePayload {
  const { intake, candidate, workLocationLabel } = args

  return {
    intake: intake.id,
    selected_candidate: candidate.candidateId,
    supplier: intake.supplier,
    worker_full_name: candidate.workerName,
    worker_email: candidate.email,
    worker_phone: candidate.phone,
    role_definition: intake.roleDefinition,
    start_date: candidate.startDate || intake.startDate,
    end_date: candidate.endDate || intake.endDate,
    pay_rate: candidate.payRate,
    currency: candidate.currency || intake.currency,
    hours_per_week: 40,
    overtime_enabled: intake.overtimeEnabled,
    overtime_multiplier: intake.overtimeMultiplier,
    budget_amount: intake.budgetAmount,
    cost_center: intake.costCenter,
    legal_entity: intake.legalEntity,
    site: intake.site,
    work_location_label: candidate.workLocation || workLocationLabel,
    notes: candidate.notes,
    resume_url: candidate.resumeUrl,
  }
}

async function loadSessionRole(signal?: AbortSignal) {
  const response = await fetch('/api/session', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    signal,
  })

  if (response.status === 401) return ''
  if (!response.ok) return ''

  const payload = (await response.json().catch(() => ({}))) as SessionResponse
  return normalizeRole(parseSessionRole(payload))
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

export default function JobPostingDetailClient({
  backHref,
  backLabel,
}: JobPostingDetailClientProps) {
  const params = useParams<{ intakeId: string }>()
  const router = useRouter()
  const intakeId = parseIntakeId(params?.intakeId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [intake, setIntake] = useState<IntakeRecord | null>(null)
  const [approvalPreview, setApprovalPreview] = useState<
    Record<string, unknown>
  >({})
  const [selectedCandidates, setSelectedCandidates] = useState<
    SelectedCandidateRecord[]
  >([])
  const [supplierLabel, setSupplierLabel] = useState('')
  const [candidateLoadError, setCandidateLoadError] = useState('')
  const [sessionRole, setSessionRole] = useState('')
  const [workOrderCandidate, setWorkOrderCandidate] =
    useState<PendingWorkOrderCandidate | null>(null)
  const [existingWorkOrder, setExistingWorkOrder] =
    useState<WorkOrderRecord | null>(null)
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(
    createInitialCandidateForm(null),
  )
  const [candidateBusy, setCandidateBusy] = useState(false)
  const [candidateSubmitError, setCandidateSubmitError] = useState('')
  const [candidateSubmitSuccess, setCandidateSubmitSuccess] = useState('')
  const [candidateModalOpen, setCandidateModalOpen] = useState(false)
  const [workOrderBusy, setWorkOrderBusy] = useState(false)
  const [workOrderError, setWorkOrderError] = useState('')

  useEffect(() => {
    if (intakeId === null) {
      setLoading(false)
      setError('This job posting could not be identified.')
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const loadDetail = async () => {
      setLoading(true)
      setError('')
      setCandidateLoadError('')

      const [
        intakeResult,
        previewResult,
        candidatesResult,
        sessionRoleResult,
      ] = await Promise.allSettled([
        getIntakeById(intakeId),
        getIntakeApprovalPreview(intakeId),
        getSelectedCandidates(intakeId),
        loadSessionRole(controller.signal),
      ])

      if (cancelled) return

      if (intakeResult.status === 'rejected') {
        if (
          intakeResult.reason instanceof IntakeApiError &&
          intakeResult.reason.status === 401
        ) {
          router.replace(
            `/auth/login?next=/my-items/job-postings/${encodeURIComponent(
              String(intakeId),
            )}`,
          )
          return
        }

        setError(
          intakeResult.reason instanceof Error
            ? intakeResult.reason.message
            : 'Unable to load job posting detail.',
        )
        setLoading(false)
        return
      }

      setIntake(intakeResult.value)
      setCandidateForm(createInitialCandidateForm(intakeResult.value))

      if (previewResult.status === 'fulfilled') {
        setApprovalPreview(previewResult.value)
      } else {
        setApprovalPreview({})
      }

      if (candidatesResult.status === 'fulfilled') {
        setSelectedCandidates(candidatesResult.value)
      } else {
        setSelectedCandidates([])
        setCandidateLoadError(
          candidatesResult.reason instanceof Error
            ? candidatesResult.reason.message
            : 'Unable to load candidate submissions.',
        )
      }

      if (sessionRoleResult.status === 'fulfilled') {
        setSessionRole(sessionRoleResult.value)
      } else {
        setSessionRole('')
      }

      setLoading(false)
    }

    void loadDetail()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [intakeId, router])

  useEffect(() => {
    if (!intake) return

    if (intake.supplierName?.trim()) {
      setSupplierLabel(intake.supplierName.trim())
      return
    }

    if (!intake.supplier) {
      setSupplierLabel('')
      return
    }

    let cancelled = false

    const loadSupplierLabel = async () => {
      try {
        const suppliers = await getSuppliers({ status: 'active' })
        if (cancelled) return

        const match =
          suppliers.find((supplier) => {
            const supplierKey =
              supplier.id !== undefined && supplier.id !== null
                ? String(supplier.id)
                : supplier.supplier_id
            return supplierKey === String(intake.supplier)
          }) || null

        setSupplierLabel(
          match?.name || `Supplier #${String(intake.supplier)}`,
        )
      } catch {
        if (cancelled) return
        setSupplierLabel(`Supplier #${String(intake.supplier)}`)
      }
    }

    void loadSupplierLabel()

    return () => {
      cancelled = true
    }
  }, [intake])

  useEffect(() => {
    if (intakeId === null) {
      setExistingWorkOrder(null)
      return
    }

    let cancelled = false

    const loadExistingWorkOrder = async () => {
      try {
        const response = await getWorkOrders({
          intake: intakeId,
          page: 1,
          page_size: 1,
        })
        if (cancelled) return

        const existingSummary = response.results[0] || null
        if (!existingSummary) {
          setExistingWorkOrder(null)
          return
        }

        try {
          const existingDetail = await getWorkOrderById(existingSummary.id)
          if (cancelled) return
          setExistingWorkOrder(existingDetail)
        } catch {
          if (cancelled) return
          setExistingWorkOrder(existingSummary)
        }
      } catch {
        if (cancelled) return
        setExistingWorkOrder(null)
      }
    }

    void loadExistingWorkOrder()

    return () => {
      cancelled = true
    }
  }, [intakeId])

  const chain = useMemo(
    () => extractApprovalChainView(intake, approvalPreview),
    [approvalPreview, intake],
  )
  const workflowStatus =
    intake?.approvalStatus || intake?.status || 'submitted'
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
  const approvalStatus = workflowStatus.trim().toLowerCase()
  const approvalComplete =
    approvalStatus === 'approved' ||
    (chain.steps.length > 0 && approvalsRemaining === 0)
  const isFullyApproved =
    intake?.status?.trim().toLowerCase() === 'approved' &&
    intake?.approvalStatus?.trim().toLowerCase() === 'approved'
  const isSupplierUser = sessionRole.includes('supplier')
  const canSubmitCandidate = isSupplierUser && isFullyApproved
  const canCreateWorkOrder =
    isFullyApproved &&
    workOrderCandidate !== null &&
    (!existingWorkOrder ||
      existingWorkOrder.status?.trim().toLowerCase() === 'draft')
  const workLocationLabel =
    intake?.workLocationLabel ||
    [intake?.city, intake?.stateProvince, intake?.country]
      .filter(Boolean)
      .join(', ') ||
    '-'
  const displayRateUnit =
    intake?.rateCardPricing?.unit ||
    intake?.rateUnit ||
    undefined
  const displayBillRate =
    intake?.billRate ||
    intake?.rateCardPricing?.billRate ||
    intake?.targetRate ||
    undefined
  const displayBaseRate =
    intake?.baseRate ||
    intake?.rateCardPricing?.baseAmount ||
    intake?.targetRate ||
    undefined
  const displayMarkupPercent =
    intake?.markupPercent ||
    intake?.rateCardPricing?.totalPercentMarkup ||
    undefined

  const handleCandidateFieldChange = <
    Key extends keyof CandidateFormState,
  >(
    key: Key,
    value: CandidateFormState[Key],
  ) => {
    setCandidateForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleCandidateSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (intakeId === null) return

    setCandidateBusy(true)
    setCandidateSubmitError('')
    setCandidateSubmitSuccess('')

    try {
      const payload: SelectedCandidateCreatePayload = {
        fullName: candidateForm.fullName,
        email: candidateForm.email,
        phone: candidateForm.phone,
        notes: candidateForm.notes,
        resumeUrl: candidateForm.resumeUrl,
        availableStartDate: candidateForm.availableStartDate,
        proposedRate: normalizeRateToTwoDecimals(candidateForm.proposedRate),
        currency: candidateForm.currency,
      }

      const createdCandidate = await createSelectedCandidate(intakeId, payload)
      const pendingCandidate = intake
        ? buildPendingWorkOrderCandidateFromSelection({
            intake,
            selectedCandidate: createdCandidate,
            supplierName:
              intake.supplierName ||
              supplierLabel ||
              (intake.supplier
                ? `Supplier #${String(intake.supplier)}`
                : undefined),
            roleName:
              intake.roleDefinitionName || intake.title || undefined,
            workLocation: workLocationLabel,
            payRate: candidateForm.payRate,
          })
        : null

      setSelectedCandidates((current) => [createdCandidate, ...current])
      setCandidateSubmitSuccess('Candidate submission saved.')
      setCandidateForm(createInitialCandidateForm(intake))
      setCandidateModalOpen(false)
      if (pendingCandidate) {
        savePendingWorkOrderCandidate(pendingCandidate)
        setWorkOrderCandidate(pendingCandidate)
      }
    } catch (submitError) {
      if (
        submitError instanceof IntakeApiError &&
        submitError.status === 401
      ) {
        router.replace(
          `/auth/login?next=/my-items/job-postings/${encodeURIComponent(
            String(intakeId),
          )}`,
        )
        return
      }

      setCandidateSubmitError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to submit candidate.',
      )
    } finally {
      setCandidateBusy(false)
    }
  }

  useEffect(() => {
    if (!intakeId || !intake) return

    if (
      existingWorkOrder &&
      existingWorkOrder.status?.trim().toLowerCase() !== 'draft'
    ) {
      clearPendingWorkOrderCandidate(intakeId)
      setWorkOrderCandidate(null)
      return
    }

    const pendingCandidate = getPendingWorkOrderCandidate(intakeId)
    if (pendingCandidate) {
      setWorkOrderCandidate(pendingCandidate)
      return
    }

    if (selectedCandidates.length > 0) {
      setWorkOrderCandidate(
        buildPendingWorkOrderCandidateFromSelection({
          intake,
          selectedCandidate: selectedCandidates[0],
          supplierName:
            intake.supplierName ||
            supplierLabel ||
            (intake.supplier
              ? `Supplier #${String(intake.supplier)}`
              : undefined),
          roleName: intake.roleDefinitionName || intake.title || undefined,
          workLocation: workLocationLabel,
        }),
      )
      return
    }

    setWorkOrderCandidate(null)
  }, [
    existingWorkOrder,
    intake,
    intakeId,
    selectedCandidates,
    supplierLabel,
    workLocationLabel,
  ])

  const handleSubmitWorkOrder = async () => {
    if (!intake || !workOrderCandidate) return

    setWorkOrderBusy(true)
    setWorkOrderError('')

    try {
      const payload = buildWorkOrderPayload({
        intake,
        candidate: workOrderCandidate,
        workLocationLabel,
      })

      const draftWorkOrder =
        existingWorkOrder?.status?.trim().toLowerCase() === 'draft'
          ? await patchWorkOrder(existingWorkOrder.id, payload)
          : await createWorkOrder(payload)

      try {
        const submittedWorkOrder = await submitWorkOrder(draftWorkOrder.id)
        clearPendingWorkOrderCandidate(intake.id)
        setExistingWorkOrder(submittedWorkOrder)
        setWorkOrderCandidate(null)
        router.push(
          `/cw/work-orders/${encodeURIComponent(
            String(submittedWorkOrder.id),
          )}`,
        )
      } catch (submitError) {
        if (
          submitError instanceof WorkOrderApiError &&
          submitError.status === 401
        ) {
          router.replace(
            `/auth/login?next=/cw/job-postings/${encodeURIComponent(
              String(intake.id),
            )}`,
          )
          return
        }

        setExistingWorkOrder(draftWorkOrder)
        setWorkOrderError(
          submitError instanceof Error
            ? submitError.message
            : 'Unable to submit work order.',
        )
      }
    } catch (error) {
      if (
        error instanceof WorkOrderApiError &&
        error.status === 401
      ) {
        router.replace(
          `/auth/login?next=/cw/job-postings/${encodeURIComponent(
            String(intake.id),
          )}`,
        )
        return
      }

      setWorkOrderError(
        error instanceof Error
          ? error.message
          : 'Unable to create work order.',
      )
    } finally {
      setWorkOrderBusy(false)
    }
  }

  return (
    <div className="levv-job-detail -m-5 min-h-full bg-[#f4f7fb] sm:-m-6 lg:-m-8">
      <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-7 sm:px-7 lg:px-10 lg:py-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#64748b] transition hover:text-[#2563eb]"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[#101b3c] lg:text-[2.15rem]">
              {intake?.title || intake?.roleDefinitionName || 'Job posting detail'}
            </h1>
            <p className="mt-1.5 text-sm text-[#64748b]">
              Review request details, matched approval routing, and selected candidates.
            </p>
          </div>

          {intake ? (
            <div className="flex flex-wrap items-center gap-3">
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
          <section className="rounded-[18px] border border-[#e1e8f2] bg-white p-12 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#eef4ff]">
                <Loader2 className="h-7 w-7 animate-spin text-[#2563eb]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#101b3c]">
                  Loading job posting
                </h2>
                <p className="mt-1 text-sm text-[#64748b]">
                  Pulling request details, approval progress, and candidate
                  submissions.
                </p>
              </div>
            </div>
          </section>
        ) : error || !intake ? (
          <section className="rounded-[18px] border border-rose-200 bg-rose-50 p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-900">
              Job posting unavailable
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-700">
              {error || 'Unable to load this job posting.'}
            </p>
            <Link
              href={backHref}
              className={`${levvUi.primaryButton} mt-5`}
            >
              Back to job postings
            </Link>
          </section>
        ) : (
          <>
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
                      value={intake.roleDefinitionName || intake.title || '-'}
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
                      value={
                        intake.supplierName ||
                        supplierLabel ||
                        (intake.supplier
                          ? `Supplier #${String(intake.supplier)}`
                          : '-')
                      }
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
                        displayBillRate,
                        intake.currency,
                        displayRateUnit,
                      )}
                    />
                    <DetailField
                      icon={DollarSign}
                      label="Base rate"
                      value={formatMoney(
                        displayBaseRate,
                        intake.currency,
                        displayRateUnit,
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
                        displayMarkupPercent?.trim()
                          ? `${displayMarkupPercent}%`
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
                      value={
                        intake.siteName ||
                        (intake.site ? `Site #${String(intake.site)}` : '-')
                      }
                    />
                    <DetailField
                      icon={MapPin}
                      label="Location"
                      value={workLocationLabel}
                    />
                    <DetailField
                      icon={Landmark}
                      label="Legal entity"
                      value={
                        intake.legalEntityName ||
                        (intake.legalEntity
                          ? `Legal entity #${String(intake.legalEntity)}`
                          : '-')
                      }
                    />
                    <DetailField
                      icon={Wallet}
                      label="Cost center"
                      value={
                        intake.costCenterName ||
                        (intake.costCenter
                          ? `Cost center #${String(intake.costCenter)}`
                          : '-')
                      }
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
                          key={qualification.id || `${qualification.name}-${index}`}
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
                                tone={qualification.group === 'must_have' ? 'rose' : 'emerald'}
                              >
                                {qualification.group === 'must_have' ? 'Must have' : 'Nice to have'}
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
                    </div>
                  )}
                </DetailSection>

                <DetailSection
                  icon={CheckCircle2}
                  title="Selected candidates"
                  description="Submit the final selected candidate only after approval is complete."
                >

                  {!isFullyApproved ? (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Candidate submissions are available only after the job
                      posting is fully approved.
                    </div>
                  ) : null}

                  {isFullyApproved && !isSupplierUser ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      This posting is fully approved. Supplier users can submit
                      the selected candidate from this page.
                    </div>
                  ) : null}

                  {canSubmitCandidate ? (
                    <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          Capture the selected candidate for this approved job posting.
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          Use the modal to record the chosen worker and attach the resume link.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCandidateSubmitError('')
                          setCandidateSubmitSuccess('')
                          setCandidateForm(createInitialCandidateForm(intake))
                          setCandidateModalOpen(true)
                        }}
                        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Capture selected candidate
                      </button>
                    </div>
                  ) : null}

                  {candidateLoadError ? (
                    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {candidateLoadError}
                    </div>
                  ) : null}

                  {candidateSubmitSuccess ? (
                    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {candidateSubmitSuccess}
                    </div>
                  ) : null}

                  <div className="mt-6 space-y-4">
                    {selectedCandidates.length > 0 ? (
                      selectedCandidates.map((candidate) => (
                        <div
                          key={
                            candidate.id ||
                            `${candidate.email || candidate.fullName}-${candidate.createdAt || ''}`
                          }
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-base font-semibold text-slate-900">
                                {candidate.fullName || 'Unnamed candidate'}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {candidate.email || 'No email provided'}
                              </div>
                            </div>
                            <div className="text-right text-sm text-slate-500">
                              <div>
                                {formatMoney(
                                  candidate.proposedRate,
                                  candidate.currency,
                                )}
                              </div>
                              <div className="mt-1">
                                {formatDate(candidate.availableStartDate)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <DetailMini label="Phone">
                              {candidate.phone || '-'}
                            </DetailMini>
                            <DetailMini label="Submitted">
                              {formatDate(candidate.createdAt)}
                            </DetailMini>
                            <DetailMini label="Resume">
                              {candidate.resumeUrl ? (
                                <a
                                  href={candidate.resumeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 transition hover:text-cyan-800"
                                >
                                  Open resume
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : (
                                '-'
                              )}
                            </DetailMini>
                            <DetailMini label="Notes">
                              {candidate.notes || '-'}
                            </DetailMini>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                        No selected candidates have been submitted yet.
                      </div>
                    )}
                  </div>

                  {workOrderCandidate || existingWorkOrder ? (
                    <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-lg font-semibold text-slate-900">
                            {existingWorkOrder
                              ? existingWorkOrder.status
                                  ?.trim()
                                  .toLowerCase() === 'draft'
                                ? 'Work order draft ready'
                                : 'Work order created'
                              : 'Ready to create work order'}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {existingWorkOrder
                              ? existingWorkOrder.status
                                  ?.trim()
                                  .toLowerCase() === 'draft'
                                ? 'A draft work order already exists for this posting. You can submit it again after updating the selected-candidate details.'
                                : 'A work order has already been created from the selected candidate for this posting.'
                              : 'The selected candidate is now attached to the job posting. Review the worker details below, then submit the work order.'}
                          </p>
                        </div>

                        {existingWorkOrder &&
                        existingWorkOrder.status
                          ?.trim()
                          .toLowerCase() !== 'draft' ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/cw/work-orders/${encodeURIComponent(
                                String(existingWorkOrder.id),
                              )}`}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              View work order
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </div>
                        ) : canCreateWorkOrder ? (
                          <button
                            type="button"
                            onClick={() => void handleSubmitWorkOrder()}
                            disabled={workOrderBusy}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {workOrderBusy ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting
                              </>
                            ) : (
                              existingWorkOrder?.status
                                ?.trim()
                                .toLowerCase() === 'draft'
                                ? 'Submit draft'
                                : 'Submit'
                            )}
                          </button>
                        ) : null}
                      </div>

                      {workOrderError ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {workOrderError}
                        </div>
                      ) : null}

                      {(workOrderCandidate || existingWorkOrder) ? (
                        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <DetailField
                            label="Worker"
                            value={
                              existingWorkOrder?.workerFullName ||
                              workOrderCandidate?.workerName ||
                              '-'
                            }
                          />
                          <DetailField
                            label="Supplier"
                            value={
                              existingWorkOrder?.supplierName ||
                              workOrderCandidate?.supplierName ||
                              '-'
                            }
                          />
                          <DetailField
                            label="Role"
                            value={
                              existingWorkOrder?.roleName ||
                              workOrderCandidate?.roleName ||
                              '-'
                            }
                          />
                          <DetailField
                            label="Work location"
                            value={
                              existingWorkOrder?.workLocationLabel ||
                              workOrderCandidate?.workLocation ||
                              '-'
                            }
                          />
                          <DetailField
                            label="Start date"
                            value={formatDate(
                              existingWorkOrder?.startDate ||
                                workOrderCandidate?.startDate,
                            )}
                          />
                          <DetailField
                            label="End date"
                            value={formatDate(
                              existingWorkOrder?.endDate ||
                                workOrderCandidate?.endDate,
                            )}
                          />
                          <DetailField
                            label="Bill rate"
                            value={formatMoney(
                              existingWorkOrder?.billRate ||
                                workOrderCandidate?.billRate,
                              existingWorkOrder?.currency ||
                                workOrderCandidate?.currency,
                              existingWorkOrder?.pricing?.unit ||
                                displayRateUnit,
                            )}
                          />
                          <DetailField
                            label="Pay rate"
                            value={formatMoney(
                              existingWorkOrder?.payRate ||
                                workOrderCandidate?.payRate,
                              existingWorkOrder?.currency ||
                                workOrderCandidate?.currency,
                              existingWorkOrder?.pricing?.unit ||
                                displayRateUnit,
                            )}
                          />
                          <DetailField
                            label="Base rate"
                            value={formatMoney(
                              existingWorkOrder?.baseRate || displayBaseRate,
                              existingWorkOrder?.currency ||
                                workOrderCandidate?.currency ||
                                intake.currency,
                              existingWorkOrder?.pricing?.unit ||
                                displayRateUnit,
                            )}
                          />
                          <DetailField
                            label="Markup"
                            value={
                              existingWorkOrder?.markupPercent?.trim()
                                ? `${existingWorkOrder.markupPercent}%`
                                : displayMarkupPercent?.trim()
                                  ? `${displayMarkupPercent}%`
                                  : '-'
                            }
                          />
                          {existingWorkOrder?.engagementId ? (
                            <DetailField
                              label="Engagement"
                              value={
                                existingWorkOrder.engagementNumber ||
                                `ENG-${String(existingWorkOrder.engagementId)}`
                              }
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </DetailSection>
              </div>

              <aside className="space-y-5 xl:sticky xl:top-24">
                <ApprovalStatusCard
                  approvalComplete={approvalComplete}
                  approvalsRemaining={approvalsRemaining}
                  currentApproverName={currentApproverName}
                  submittedAt={intake.submittedAt || intake.createdAt}
                />

                <section className="levv-detail-panel rounded-[18px] border border-[#e1e8f2] bg-white p-5 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)]">
                  <LevvPanelHeader
                    icon={GitBranch}
                    title="Matched chain"
                    description="This posting matched the approval chain below."
                    tone="blue"
                  />

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
                        value={describeApprovalMatchStrategy(chain.matchStrategy)}
                      />
                      <InfoRow
                        label="Computed at"
                        value={formatApprovalDateTime(getApprovalComputedAt(intake))}
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
                                        : 'border-slate-200 bg-white text-slate-500',
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
                                    <StepStatusBadge status={step.status} index={index} />
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#64748b]">
                                    <span>
                                      Threshold:{' '}
                                      <strong className="font-semibold text-[#334155]">
                                        {formatApprovalStepAmount(step.amount, step.currency)}
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
                      The approval chain is determined by your organization&apos;s
                      staffing policies and may vary based on request details.
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>

      {candidateModalOpen && intake ? (
        <SelectedCandidateModal
          form={candidateForm}
          supplierName={
            intake.supplierName ||
            supplierLabel ||
            (intake.supplier ? `Supplier #${String(intake.supplier)}` : '-')
          }
          roleName={intake.roleDefinitionName || intake.title || '-'}
          workLocation={workLocationLabel}
          error={candidateSubmitError}
          busy={candidateBusy}
          onClose={() => {
            if (candidateBusy) return
            setCandidateModalOpen(false)
            setCandidateSubmitError('')
          }}
          onChange={handleCandidateFieldChange}
          onSubmit={(event) => void handleCandidateSubmit(event)}
        />
      ) : null}
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
  return <LevvStatCard icon={Icon} label={label} value={value} tone={tone} />
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
  icon?: React.ElementType
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
    <section className="levv-detail-panel rounded-[18px] border border-[#e1e8f2] bg-white p-5 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#eaf2ff] text-[#2563eb]">
          <GitBranch className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-[#101b3c]">Approval status</h2>
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
          title={approvalComplete ? 'Approval complete' : 'Approval in progress'}
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
    pending: 'border-slate-300 bg-white text-slate-400',
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
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${iconClasses[state]}`}
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

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
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
      className={`levv-pill inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {children}
    </label>
  )
}

function FormField({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        required={required}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
    </div>
  )
}

function SelectedCandidateModal({
  form,
  supplierName,
  roleName,
  workLocation,
  error,
  busy,
  onClose,
  onChange,
  onSubmit,
}: {
  form: CandidateFormState
  supplierName: string
  roleName: string
  workLocation: string
  error: string
  busy: boolean
  onClose: () => void
  onChange: <Key extends keyof CandidateFormState>(
    key: Key,
    value: CandidateFormState[Key],
  ) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <form onSubmit={onSubmit}>
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Capture Selected Candidate
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Record the selected worker for this approved job posting.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Candidate Name"
                value={form.fullName}
                onChange={(value) => onChange('fullName', value)}
                required
              />
              <div>
                <FieldLabel>Supplier</FieldLabel>
                <input
                  value={supplierName}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                />
              </div>

              <div>
                <FieldLabel>Role</FieldLabel>
                <input
                  value={roleName}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                />
              </div>
              <FormField
                label="Start Date"
                value={form.availableStartDate}
                onChange={(value) => onChange('availableStartDate', value)}
                type="date"
              />

              <div>
                <FieldLabel>End Date</FieldLabel>
                <input
                  value={form.endDate}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                />
              </div>
              <FormField
                label="Proposed Rate"
                value={form.proposedRate}
                onChange={(value) => onChange('proposedRate', value)}
                onBlur={() =>
                  onChange(
                    'proposedRate',
                    normalizeRateToTwoDecimals(form.proposedRate),
                  )
                }
              />

              <FormField
                label="Pay Rate Override"
                value={form.payRate}
                onChange={(value) => onChange('payRate', value)}
                onBlur={() =>
                  onChange('payRate', normalizeRateToTwoDecimals(form.payRate))
                }
              />
              <div>
                <FieldLabel>Work Location</FieldLabel>
                <input
                  value={workLocation}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                />
              </div>

              <FormField
                label="Email"
                value={form.email}
                onChange={(value) => onChange('email', value)}
                type="email"
                required
              />
              <FormField
                label="Phone"
                value={form.phone}
                onChange={(value) => onChange('phone', value)}
              />
            </div>

            <div>
              <FieldLabel>Notes</FieldLabel>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => onChange('notes', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <FieldLabel>Attachment / Resume URL</FieldLabel>
              <input
                type="url"
                value={form.resumeUrl}
                onChange={(event) => onChange('resumeUrl', event.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              <p className="mt-2 text-xs text-slate-500">
                The current API accepts a resume or email link URL rather than direct file upload.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Currency"
                value={form.currency}
                onChange={(value) => onChange('currency', value)}
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#dbeafe] px-5 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-[#bfdbfe] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Saving...' : 'Continue to Job Posting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
