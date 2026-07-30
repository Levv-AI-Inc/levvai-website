'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  X,
  ExternalLink,
  GitBranch,
  Loader2,
  MapPin,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  IntakeApiError,
  createSelectedCandidate,
  getIntakeApprovalPreview,
  getIntakeById,
  getSelectedCandidates,
  updateSelectedCandidateStatus,
  type IntakeRecord,
  type SelectedCandidateCreatePayload,
  type SelectedCandidateRecord,
  type SelectedCandidateStatus,
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

function candidateStatusLabel(status: SelectedCandidateStatus | undefined) {
  if (status === 'reviewed') return 'Interview / Review'
  if (status === 'accepted') return 'Selected'
  if (status === 'rejected') return 'Rejected'
  return 'Submitted'
}

function candidateStatusClasses(
  status: SelectedCandidateStatus | undefined,
) {
  if (status === 'reviewed') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (status === 'accepted') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (status === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
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
  const [candidateDecisionBusyId, setCandidateDecisionBusyId] = useState<
    number | null
  >(null)
  const [candidateDecisionError, setCandidateDecisionError] = useState('')
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
  const isFullyApproved =
    intake?.status?.trim().toLowerCase() === 'approved' &&
    intake?.approvalStatus?.trim().toLowerCase() === 'approved'
  const isSupplierUser = sessionRole.includes('supplier')
  const canManageCandidates = ['admin', 'business', 'manager'].includes(
    sessionRole,
  )
  const canSubmitCandidate = isSupplierUser && isFullyApproved
  const acceptedCandidate =
    selectedCandidates.find((candidate) => candidate.status === 'accepted') ||
    null
  const canCreateWorkOrder =
    canManageCandidates &&
    isFullyApproved &&
    acceptedCandidate !== null &&
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

      setSelectedCandidates((current) => [createdCandidate, ...current])
      setCandidateSubmitSuccess(
        'Candidate submitted for buyer review. No work order has been created.',
      )
      setCandidateForm(createInitialCandidateForm(intake))
      setCandidateModalOpen(false)
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

  const handleCandidateDecision = async (
    candidate: SelectedCandidateRecord,
    status: Exclude<SelectedCandidateStatus, 'submitted'>,
  ) => {
    if (!candidate.id || !intake || !canManageCandidates) return

    setCandidateDecisionBusyId(candidate.id)
    setCandidateDecisionError('')
    setCandidateSubmitSuccess('')

    try {
      const updatedCandidate = await updateSelectedCandidateStatus(
        candidate.id,
        status,
      )

      setSelectedCandidates((current) =>
        current.map((item) => {
          if (item.id === updatedCandidate.id) return updatedCandidate
          if (status === 'accepted' && item.status === 'accepted') {
            return { ...item, status: 'reviewed' }
          }
          return item
        }),
      )

      if (status === 'accepted') {
        const pendingCandidate = buildPendingWorkOrderCandidateFromSelection({
          intake,
          selectedCandidate: updatedCandidate,
          supplierName:
            intake.supplierName ||
            supplierLabel ||
            (intake.supplier
              ? `Supplier #${String(intake.supplier)}`
              : undefined),
          roleName: intake.roleDefinitionName || intake.title || undefined,
          workLocation: workLocationLabel,
        })
        savePendingWorkOrderCandidate(pendingCandidate)
        setWorkOrderCandidate(pendingCandidate)
        setCandidateSubmitSuccess(
          `${updatedCandidate.fullName || 'Candidate'} selected. The work order is ready for buyer review and submission.`,
        )
      } else if (workOrderCandidate?.candidateId === candidate.id) {
        clearPendingWorkOrderCandidate(intake.id)
        setWorkOrderCandidate(null)
      }
    } catch (decisionError) {
      if (
        decisionError instanceof IntakeApiError &&
        decisionError.status === 401
      ) {
        router.replace(
          `/auth/login?next=/cw/job-postings/${encodeURIComponent(
            String(intake.id),
          )}`,
        )
        return
      }

      setCandidateDecisionError(
        decisionError instanceof Error
          ? decisionError.message
          : 'Unable to update this candidate.',
      )
    } finally {
      setCandidateDecisionBusyId(null)
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

    const accepted = selectedCandidates.find(
      (candidate) => candidate.status === 'accepted',
    )
    if (!accepted) {
      clearPendingWorkOrderCandidate(intakeId)
      setWorkOrderCandidate(null)
      return
    }

    const pendingCandidate = getPendingWorkOrderCandidate(intakeId)
    if (pendingCandidate?.candidateId === accepted.id) {
      setWorkOrderCandidate(pendingCandidate)
      return
    }

    clearPendingWorkOrderCandidate(intakeId)
    const selectedWorkOrderCandidate =
      buildPendingWorkOrderCandidateFromSelection({
        intake,
        selectedCandidate: accepted,
        supplierName:
          intake.supplierName ||
          supplierLabel ||
          (intake.supplier
            ? `Supplier #${String(intake.supplier)}`
            : undefined),
        roleName: intake.roleDefinitionName || intake.title || undefined,
        workLocation: workLocationLabel,
      })
    savePendingWorkOrderCandidate(selectedWorkOrderCandidate)
    setWorkOrderCandidate(selectedWorkOrderCandidate)
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
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="space-y-8">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {intake?.title || intake?.roleDefinitionName || 'Job posting detail'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Track approvals, supplier submissions, buyer selection, and work
            order creation for this posting.
          </p>
        </div>

        {loading ? (
          <section className="rounded-3xl border bg-white p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Loading job posting
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pulling request details, approval progress, and candidate
                  submissions.
                </p>
              </div>
            </div>
          </section>
        ) : error || !intake ? (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-900">
              Job posting unavailable
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-700">
              {error || 'Unable to load this job posting.'}
            </p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Request ID"
                value={intake.requestId || `INT-${intake.id}`}
              />
              <SummaryCard
                label="Approval status"
                value={toTitleCase(intake.approvalStatus || intake.status)}
              />
              <SummaryCard
                label="Current approver"
                value={currentApproverName || 'Completed'}
              />
              <SummaryCard
                label="Approvals remaining"
                value={String(approvalsRemaining)}
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
                        Posting overview
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Commercial context and staffing details for this request.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <DetailField
                      label="Role"
                      value={intake.roleDefinitionName || intake.title || '-'}
                    />
                    <DetailField
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
                      label="Engagement type"
                      value={toTitleCase(intake.engagementType)}
                    />
                    <DetailField
                      label="Worker count"
                      value={String(intake.workerCount || 0)}
                    />
                    <DetailField
                      label="Bill rate"
                      value={formatMoney(
                        displayBillRate,
                        intake.currency,
                        displayRateUnit,
                      )}
                    />
                    <DetailField
                      label="Base rate"
                      value={formatMoney(
                        displayBaseRate,
                        intake.currency,
                        displayRateUnit,
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
                        displayMarkupPercent?.trim()
                          ? `${displayMarkupPercent}%`
                          : '-'
                      }
                    />
                    <DetailField
                      label="Location"
                      value={workLocationLabel}
                    />
                    <DetailField
                      label="Start date"
                      value={formatDate(intake.startDate)}
                    />
                  </div>
                </section>

                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Candidate workflow
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Suppliers submit candidates. Buyers review and interview
                        them offline, then select one before creating a work
                        order.
                      </p>
                    </div>
                  </div>

                  <CandidateWorkflowProgress
                    approved={isFullyApproved}
                    submitted={selectedCandidates.length > 0}
                    reviewed={selectedCandidates.some(
                      (candidate) =>
                        candidate.status === 'reviewed' ||
                        candidate.status === 'accepted',
                    )}
                    selected={acceptedCandidate !== null}
                    workOrderCreated={existingWorkOrder !== null}
                  />

                  {!isFullyApproved ? (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Candidate submissions are available only after the job
                      posting is fully approved.
                    </div>
                  ) : null}

                  {isFullyApproved && !isSupplierUser ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Review supplier submissions below. Interviews happen
                      outside LEVV; mark the candidate as under review after
                      starting that process, then select the final candidate.
                    </div>
                  ) : null}

                  {canSubmitCandidate ? (
                    <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          Submit a candidate for buyer review.
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          Candidate submission does not create or prepare a work
                          order.
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
                        Submit candidate
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

                  {candidateDecisionError ? (
                    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {candidateDecisionError}
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
                            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                              <span
                                className={cn(
                                  'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                                  candidateStatusClasses(candidate.status),
                                )}
                              >
                                {candidateStatusLabel(candidate.status)}
                              </span>
                              <div className="text-sm text-slate-500">
                                {formatMoney(
                                  candidate.proposedRate,
                                  candidate.currency,
                                )}
                              </div>
                              <div className="text-sm text-slate-500">
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

                          {canManageCandidates && !existingWorkOrder ? (
                            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                              {candidate.status === 'submitted' ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={
                                      candidateDecisionBusyId === candidate.id
                                    }
                                    onClick={() =>
                                      void handleCandidateDecision(
                                        candidate,
                                        'reviewed',
                                      )
                                    }
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {candidateDecisionBusyId === candidate.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : null}
                                    Start review
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      candidateDecisionBusyId === candidate.id
                                    }
                                    onClick={() =>
                                      void handleCandidateDecision(
                                        candidate,
                                        'rejected',
                                      )
                                    }
                                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : null}

                              {candidate.status === 'reviewed' ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={
                                      candidateDecisionBusyId === candidate.id
                                    }
                                    onClick={() =>
                                      void handleCandidateDecision(
                                        candidate,
                                        'rejected',
                                      )
                                    }
                                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      candidateDecisionBusyId === candidate.id
                                    }
                                    onClick={() =>
                                      void handleCandidateDecision(
                                        candidate,
                                        'accepted',
                                      )
                                    }
                                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {candidateDecisionBusyId === candidate.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    Select candidate
                                  </button>
                                </>
                              ) : null}

                              {candidate.status === 'rejected' ? (
                                <button
                                  type="button"
                                  disabled={
                                    candidateDecisionBusyId === candidate.id
                                  }
                                  onClick={() =>
                                    void handleCandidateDecision(
                                      candidate,
                                      'reviewed',
                                    )
                                  }
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {candidateDecisionBusyId === candidate.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : null}
                                  Reopen review
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                        No candidate submissions yet.
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
                              : 'Selection only prepares these details. No work order exists until a buyer creates and submits it below.'}
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
                                ? 'Submit work order draft'
                                : 'Create and submit work order'
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
                          {existingWorkOrder?.supplierAcceptanceStatus &&
                          existingWorkOrder.supplierAcceptanceStatus !==
                            'not_started' ? (
                            <DetailField
                              label="Supplier acceptance"
                              value={existingWorkOrder.supplierAcceptanceStatus
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, (letter) =>
                                  letter.toUpperCase(),
                                )}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Approval routing
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900">
                        {chain.name}
                      </h2>
                    </div>
                  </div>

                  <dl className="mt-6 space-y-4 text-sm">
                    <InfoRow
                      label="Match strategy"
                      value={describeApprovalMatchStrategy(chain.matchStrategy)}
                    />
                    <InfoRow
                      label="Current approver"
                      value={currentApproverName || 'Completed'}
                    />
                    <InfoRow
                      label="Approvals remaining"
                      value={String(approvalsRemaining)}
                    />
                    <InfoRow
                      label="Computed at"
                      value={formatApprovalDateTime(
                        getApprovalComputedAt(intake),
                      )}
                    />
                  </dl>
                </section>

                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        Approval route
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Current and remaining approval steps for this posting.
                      </p>
                    </div>
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
                    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      No approval steps were returned for this request.
                    </div>
                  )}
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

function CandidateWorkflowProgress({
  approved,
  submitted,
  reviewed,
  selected,
  workOrderCreated,
}: {
  approved: boolean
  submitted: boolean
  reviewed: boolean
  selected: boolean
  workOrderCreated: boolean
}) {
  const steps = [
    { label: 'Posting approved', complete: approved },
    { label: 'Candidate submitted', complete: submitted },
    { label: 'Offline interview', complete: reviewed },
    { label: 'Candidate selected', complete: selected },
    { label: 'Work order created', complete: workOrderCreated },
  ]

  return (
    <ol className="mt-6 grid gap-3 border-y border-slate-200 py-4 sm:grid-cols-2 lg:grid-cols-5">
      {steps.map((step, index) => (
        <li key={step.label} className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
              step.complete
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 bg-white text-slate-500',
            )}
          >
            {step.complete ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </span>
          <span
            className={cn(
              'text-xs font-medium leading-4',
              step.complete ? 'text-slate-900' : 'text-slate-500',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
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
                Submit Candidate
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Send this candidate to the buyer for review. This does not
                create a work order.
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
              {busy ? 'Submitting...' : 'Submit candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
