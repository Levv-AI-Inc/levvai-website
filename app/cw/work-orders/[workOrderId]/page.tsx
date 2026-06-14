'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarDays,
  FileStack,
  GitBranch,
  Loader2,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { getEngagementStatusLabel } from '@/lib/api/engagements'
import {
  getWorkOrderById,
  type WorkOrderRecord,
} from '@/lib/api/workOrders'
import {
  countApprovalsRemaining,
  describeApprovalMatchStrategy,
  extractApprovalChainView,
  formatApprovalDateTime,
  formatApprovalStepAmount,
  getApprovalComputedAt,
  getCurrentApproverName,
  labelApprovalStepStatus,
  normalizeApprovalStepStatus,
  type ApprovalRouteSubject,
} from '@/lib/intakeApprovalRoute'

function parseWorkOrderId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatMoney(
  amount?: string | null,
  currency?: string,
  unit?: string,
) {
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

  if (normalized === 'approved' || normalized === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'submitted') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (normalized === 'rejected' || normalized === 'closed') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function approvalStatusClasses(status: string | undefined) {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'processing') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (normalized === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function engagementStatusClasses(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase()

  if (normalized === 'accepted') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
  if (normalized === 'pending_supplier_acceptance') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }
  if (normalized === 'changes_requested') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }
  if (normalized === 'cancelled') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
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
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      {labelApprovalStepStatus(status, index)}
    </span>
  )
}

export default function WorkOrderDetailPage() {
  const params = useParams<{ workOrderId: string }>()
  const workOrderId = parseWorkOrderId(params?.workOrderId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workOrder, setWorkOrder] = useState<WorkOrderRecord | null>(null)

  useEffect(() => {
    if (workOrderId === null) {
      setLoading(false)
      setError('This work order could not be identified.')
      return
    }

    let cancelled = false

    const loadWorkOrder = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await getWorkOrderById(workOrderId)
        if (cancelled) return
        setWorkOrder(response)
      } catch (loadError) {
        if (cancelled) return
        setWorkOrder(null)
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load work order.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadWorkOrder()

    return () => {
      cancelled = true
    }
  }, [workOrderId])

  const approvalSubject = useMemo<ApprovalRouteSubject | null>(
    () =>
      workOrder
        ? {
            approvalChain: workOrder.approvalChain,
            approvalChainSnapshot: workOrder.approvalChainSnapshot,
            approvalRuntime: workOrder.approvalRuntime,
            decisionAt: workOrder.submittedAt || null,
          }
        : null,
    [workOrder],
  )

  const chain = useMemo(
    () => extractApprovalChainView(approvalSubject, {}),
    [approvalSubject],
  )
  const currentApproverName =
    workOrder?.currentApproverName ||
    getCurrentApproverName(
      approvalSubject,
      chain.steps,
      workOrder?.approvalStatus || workOrder?.status,
    )
  const approvalsRemaining = countApprovalsRemaining(
    chain.steps,
    workOrder?.approvalStatus || workOrder?.status,
    workOrder?.approvalRuntime?.approvalsRemaining,
  )
  const pricingUnit = workOrder?.pricing?.unit || undefined
  const displayBillRate =
    workOrder?.billRate || workOrder?.pricing?.billRate || null
  const displayBaseRate =
    workOrder?.baseRate || workOrder?.pricing?.baseAmount || null
  const displayMarkup =
    workOrder?.markupPercent ||
    workOrder?.pricing?.totalPercentMarkup ||
    null
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading work order
      </div>
    )
  }

  if (!workOrder || error) {
    return (
      <div className="space-y-4">
        <Link
          href="/cw/work-orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to work orders
        </Link>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700">
          {error || 'Work order not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/cw/work-orders"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to work orders
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {workOrder.workOrderNumber || `WO-${String(workOrder.id)}`}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review the submitted work order created from the selected
              candidate and approved job posting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-4 py-2 text-sm font-medium ${statusClasses(
                workOrder.status,
              )}`}
            >
              {workOrder.status || 'draft'}
            </span>
            <span
              className={`inline-flex rounded-full border px-4 py-2 text-sm font-medium ${approvalStatusClasses(
                workOrder.approvalStatus,
              )}`}
            >
              {workOrder.approvalStatus || 'not_started'}
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="grid gap-6 md:grid-cols-2">
                <DetailStack
                  icon={<UserRound className="h-5 w-5" />}
                  label="Worker Name"
                  value={workOrder.workerFullName || '-'}
                />
                <DetailStack
                  icon={<BriefcaseBusiness className="h-5 w-5" />}
                  label="Supplier"
                  value={workOrder.supplierName || '-'}
                />
                <DetailStack
                  icon={<FileStack className="h-5 w-5" />}
                  label="Role"
                  value={workOrder.roleName || '-'}
                />
                <DetailStack
                  icon={<MapPin className="h-5 w-5" />}
                  label="Work Location"
                  value={workOrder.workLocationLabel || '-'}
                />
              </div>
            </section>

            <section className="rounded-3xl border bg-[#eaf3ff] p-6 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-semibold text-blue-700">
                <BadgeDollarSign className="h-5 w-5" />
                Commercials
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <MetricCard
                  label="Bill Rate"
                  value={formatMoney(
                    displayBillRate,
                    workOrder.currency,
                    pricingUnit,
                  )}
                />
                <MetricCard
                  label="Pay Rate"
                  value={formatMoney(
                    workOrder.payRate,
                    workOrder.currency,
                    pricingUnit,
                  )}
                />
                <MetricCard
                  label="Base Rate"
                  value={formatMoney(
                    displayBaseRate,
                    workOrder.currency,
                    pricingUnit,
                  )}
                />
                <MetricCard
                  label="Markup"
                  value={
                    displayMarkup?.trim() ? `${displayMarkup}%` : '-'
                  }
                />
                <MetricCard
                  label="Currency"
                  value={workOrder.currency || '-'}
                />
              </div>

              <div className="mt-6 rounded-2xl bg-white px-5 py-4">
                <div className="text-sm font-medium text-slate-500">
                  Estimated Total Cost
                </div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  {formatMoney(
                    workOrder.estimatedCost,
                    workOrder.currency,
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <CalendarDays className="h-5 w-5 text-slate-500" />
                Assignment Details
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <InfoTile
                  label="Start Date"
                  value={formatDate(workOrder.startDate)}
                />
                <InfoTile
                  label="End Date"
                  value={formatDate(workOrder.endDate)}
                />
                <InfoTile
                  label="Hours per Week"
                  value={
                    workOrder.hoursPerWeek !== null &&
                    workOrder.hoursPerWeek !== undefined
                      ? String(workOrder.hoursPerWeek)
                      : '-'
                  }
                />
                <InfoTile
                  label="Overtime Rules"
                  value={
                    workOrder.overtimeEnabled
                      ? `${workOrder.overtimeMultiplier || '1.0'}x overtime enabled`
                      : 'No overtime configured'
                  }
                />
                <InfoTile
                  label="Cost Center"
                  value={
                    workOrder.costCenterName ||
                    (workOrder.costCenter
                      ? `Cost center #${String(workOrder.costCenter)}`
                      : '-')
                  }
                />
                <InfoTile
                  label="Legal Entity"
                  value={
                    workOrder.legalEntityName ||
                    (workOrder.legalEntity
                      ? `Legal entity #${String(workOrder.legalEntity)}`
                      : '-')
                  }
                />
                <InfoTile
                  label="Intake"
                  value={
                    workOrder.intakeTitle ||
                    (workOrder.intake
                      ? `Intake #${String(workOrder.intake)}`
                      : '-')
                  }
                />
                <InfoTile
                  label="Budget Cap"
                  value={formatMoney(
                    workOrder.budgetAmount,
                    workOrder.currency,
                  )}
                />
              </div>
            </section>

            {workOrder.pricing?.components.length ? (
              <section className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <BadgeDollarSign className="h-5 w-5 text-slate-500" />
                  Pricing Breakdown
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {workOrder.pricing.components.map((component) => (
                    <InfoTile
                      key={`${component.componentId || component.code || component.label}`}
                      label={component.label || component.code || 'Component'}
                      value={[
                        component.numericValue || '-',
                        component.calculationRole
                          ? `(${component.calculationRole})`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                  ))}
                </div>
              </section>
            ) : null}

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

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <InfoTile
                  label="Match Strategy"
                  value={describeApprovalMatchStrategy(chain.matchStrategy)}
                />
                <InfoTile
                  label="Current Approver"
                  value={currentApproverName || 'Completed'}
                />
                <InfoTile
                  label="Approvals Remaining"
                  value={String(approvalsRemaining)}
                />
                <InfoTile
                  label="Computed At"
                  value={formatApprovalDateTime(
                    getApprovalComputedAt(approvalSubject),
                  )}
                />
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
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold ${
                              normalizeApprovalStepStatus(step.status, index) ===
                              'current'
                                ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                : normalizeApprovalStepStatus(
                                      step.status,
                                      index,
                                    ) === 'approved'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                            }`}
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
                  No approval steps were returned for this work order.
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-slate-900">
                Work Order Summary
              </h2>

              <div className="mt-6 space-y-5">
                <SummaryRow
                  label={workOrder.workerFullName || '-'}
                  value={workOrder.roleName || '-'}
                />
                <SummaryRow
                  label={workOrder.supplierName || '-'}
                  value="Supplier"
                />
                <SummaryRow
                  label={formatMoney(
                    workOrder.estimatedCost,
                    workOrder.currency,
                  )}
                  value="Estimated Cost"
                />
                <SummaryRow
                  label={formatDate(workOrder.startDate)}
                  value="Start Date"
                />
              </div>

              {workOrder.engagementId ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Engagement
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {workOrder.engagementNumber ||
                          `ENG-${String(workOrder.engagementId)}`}
                      </div>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${engagementStatusClasses(
                        workOrder.engagementStatus,
                      )}`}
                    >
                      {getEngagementStatusLabel(
                        (workOrder.engagementStatus ||
                          'pending_supplier_acceptance') as Parameters<
                          typeof getEngagementStatusLabel
                        >[0],
                      )}
                    </span>
                  </div>
                </div>
              ) : workOrder.status?.trim().toLowerCase() === 'approved' ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                  Engagement pending creation.
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
                Approval Progress
              </div>
              <dl className="mt-4 space-y-4 text-sm">
                <InfoRow
                  label="Approval status"
                  value={workOrder.approvalStatus || 'not_started'}
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
                  label="Submitted"
                  value={formatDate(workOrder.submittedAt)}
                />
              </dl>
            </section>

            <section className="rounded-3xl border bg-[#fff7e6] p-6 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-semibold text-amber-800">
                <AlertTriangle className="h-5 w-5" />
                Risk Flags
              </div>

              {workOrder.riskFlags.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm text-amber-900">
                  {workOrder.riskFlags.map((flag) => (
                    <li key={flag} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-700" />
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-amber-900">
                  No immediate risk flags detected.
                </p>
              )}
            </section>

            <section className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
                Notes
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">
                {workOrder.notes || 'No notes added.'}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

function DetailStack({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span className="text-slate-500">{icon}</span>
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </div>
    </div>
  )
}

function InfoTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-900">{value}</div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-xl font-semibold text-slate-900">{label}</div>
      <div className="mt-1 text-sm text-slate-500">{value}</div>
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

function DetailMini({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm text-slate-900">{children}</div>
    </div>
  )
}
