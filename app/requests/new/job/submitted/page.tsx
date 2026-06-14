'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Loader2,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  getIntakeApprovalPreview,
  getIntakeById,
  type IntakeRecord,
} from '@/lib/api/intake'
import {
  countApprovalsRemaining,
  describeApprovalMatchStrategy,
  extractApprovalChainView,
  getApprovalComputedAt,
  getCurrentApproverName,
  formatApprovalDateTime,
  formatApprovalStepAmount,
  getCurrentApprovalStep,
  labelApprovalStepStatus,
  normalizeApprovalStepStatus,
} from '@/lib/intakeApprovalRoute'
import { useCWRequest } from '../context/CWRequestContext'

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function parseIntakeId(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function badgeClasses(status: string | undefined, index: number) {
  const normalized = normalizeApprovalStepStatus(status, index)

  if (normalized === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (normalized === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }

  if (normalized === 'current') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }

  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function StepStatusBadge({
  status,
  index,
}: {
  status?: string
  index: number
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        badgeClasses(status, index),
      )}
    >
      {labelApprovalStepStatus(status, index)}
    </span>
  )
}

export default function CWRequestSubmittedPage() {
  const searchParams = useSearchParams()
  const { request, clear } = useCWRequest()

  const intakeIdParam = searchParams.get('id')
  const [intakeId, setIntakeId] = useState<number | null>(() =>
    parseIntakeId(intakeIdParam) ?? request.intakeId ?? null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [intake, setIntake] = useState<IntakeRecord | null>(null)
  const [approvalPreview, setApprovalPreview] = useState<
    Record<string, unknown>
  >({})
  const clearedRef = useRef(false)

  useEffect(() => {
    const nextIntakeId =
      parseIntakeId(intakeIdParam) ?? request.intakeId ?? null

    if (nextIntakeId !== null && nextIntakeId !== intakeId) {
      setIntakeId(nextIntakeId)
    }
  }, [intakeId, intakeIdParam, request.intakeId])

  useEffect(() => {
    if (intakeId === null || clearedRef.current) return

    clear()
    clearedRef.current = true
  }, [clear, intakeId])

  useEffect(() => {
    if (intakeId === null) {
      setLoading(false)
      setError(
        'The submitted request could not be identified. Open it from My Items or resubmit the request.',
      )
      return
    }

    let cancelled = false

    const loadApprovalState = async () => {
      setLoading(true)
      setError('')

      const [intakeResult, previewResult] = await Promise.allSettled([
        getIntakeById(intakeId),
        getIntakeApprovalPreview(intakeId),
      ])

      if (cancelled) return

      if (intakeResult.status === 'rejected') {
        setError(intakeResult.reason?.message || 'Unable to load request.')
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

    void loadApprovalState()

    return () => {
      cancelled = true
    }
  }, [intakeId])

  const chain = extractApprovalChainView(intake, approvalPreview)
  const requestStatus = intake?.approvalStatus || intake?.status || 'submitted'
  const chainSteps = chain.steps
  const currentApproverName = getCurrentApproverName(
    intake,
    chainSteps,
    requestStatus,
  )
  const currentStep = getCurrentApprovalStep(
    chainSteps,
    requestStatus,
    intake?.approvalRuntime?.currentStepSequence,
    intake?.approvalRuntime?.currentApproverId,
  )
  const approvalsRemaining = countApprovalsRemaining(
    chainSteps,
    requestStatus,
    intake?.approvalRuntime?.approvalsRemaining,
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="space-y-8">
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Request submitted
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Your contingent worker request has been submitted and matched
                  to an approval chain. The routing below shows the approvals it
                  will move through next.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Request ID"
                value={intakeId ? `#${intakeId}` : 'Pending'}
              />
              <SummaryCard
                label="Current approver"
                value={currentApproverName || 'Pending assignment'}
              />
              <SummaryCard
                label="Approvals remaining"
                value={String(approvalsRemaining)}
              />
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-3xl border bg-white p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Loading approval route
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pulling the matched approval chain and assigned approval
                  sequence for this request.
                </p>
              </div>
            </div>
          </section>
        ) : error ? (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-900">
              Approval route unavailable
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-rose-700">
              {error}
            </p>
            <div className="mt-5">
              <Link
                href="/my-items"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Go to My Items
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="space-y-6">
              <div className="rounded-3xl border bg-white p-6 shadow-sm">
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
                    This request matched the approval chain that will govern the
                    routed approvals below.
                  </p>
                )}

                <dl className="mt-6 space-y-4 text-sm">
                  <InfoRow
                    label="Match strategy"
                    value={describeApprovalMatchStrategy(chain.matchStrategy)}
                  />
                  <InfoRow
                    label="Computed at"
                    value={formatApprovalDateTime(
                      getApprovalComputedAt(intake),
                    )}
                  />
                  <InfoRow
                    label="Submission status"
                    value={requestStatus.replace(/_/g, ' ')}
                  />
                </dl>
              </div>

              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      What happens next
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {currentApproverName
                        ? `${currentApproverName} is the current approver. ${
                            approvalsRemaining > 1
                              ? `${approvalsRemaining - 1} more step${
                                  approvalsRemaining - 1 === 1 ? '' : 's'
                                } remain after this decision.`
                              : approvalsRemaining === 1
                                ? 'This is the last remaining approval step.'
                                : 'No further approval steps remain after the current decision.'
                          }`
                        : 'The request is moving through the matched approval chain. Remaining steps stay queued until earlier approvals complete.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Approval route
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Ordered approvers for the matched chain.
                  </p>
                </div>
                <div className="text-sm text-slate-500">
                  {chainSteps.length > 0
                    ? `${chainSteps.length} approver step${
                        chainSteps.length === 1 ? '' : 's'
                      }`
                    : 'No resolved steps returned'}
                </div>
              </div>

              {chainSteps.length > 0 ? (
                <div className="mt-6 space-y-5">
                  {chainSteps.map((step, index) => (
                    <div key={`${step.sequence}-${step.approverId || step.approverName}`}>
                      <div className="flex gap-4">
                        <div className="flex w-12 flex-col items-center">
                          <div
                            className={cn(
                              'flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold',
                              index === 0
                                ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600',
                            )}
                          >
                            {step.sequence}
                          </div>
                          {index < chainSteps.length - 1 ? (
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
                                {currentStep?.sequence === step.sequence &&
                                normalizeApprovalStepStatus(
                                  step.status,
                                  index,
                                ) === 'current'
                                  ? 'Current approval step'
                                  : step.stepType === 'specific_user'
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
                            <StepMeta label="Threshold">
                              {formatApprovalStepAmount(
                                step.amount,
                                step.currency,
                              )}
                            </StepMeta>
                            <StepMeta label="Sequence">
                              Step {step.sequence}
                            </StepMeta>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <div className="text-base font-medium text-slate-900">
                    No approval steps were returned
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    The request was submitted, but the approval preview did not
                    include resolved approvers. You can still track the request
                    from My Items.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/my-items/jobs"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              View My Job Postings
            </Link>
            {intakeId ? (
              <Link
                href={`/my-items/jobs/${encodeURIComponent(
                  String(intakeId),
                )}`}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                View request details
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            Back to home
          </Link>
        </div>
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
    <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">
        {value}
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

function StepMeta({
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
