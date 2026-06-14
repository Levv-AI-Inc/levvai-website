'use client'

export type ApprovalRuntimeLike = {
  currentApproverId?: number | null
  currentApproverName?: string | null
  currentStepSequence?: number | null
  approvalsRemaining?: number
  matchedChainId?: number | null
  matchedChainName?: string | null
  matchStrategy?: string | null
  computedAt?: string | null
}

export type ApprovalRouteSubject = {
  approvalChain?: number | null
  approvalChainSnapshot?: Record<string, unknown> | null
  approvalRuntime?: ApprovalRuntimeLike | null
  decisionAt?: string | null
}

export type ApprovalStepView = {
  sequence: number
  approverName: string
  approverId?: number
  amount?: string
  currency?: string
  stepType?: string
  status?: string
}

export type ApprovalChainView = {
  id?: number
  name?: string
  description?: string
  matchStrategy?: string
  steps: ApprovalStepView[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function pickFirstRecord(
  ...candidates: Array<Record<string, unknown> | null | undefined>
) {
  return (
    candidates.find(
      (candidate) => candidate && Object.keys(candidate).length > 0,
    ) || null
  )
}

function normalizeStepRow(
  value: unknown,
  index: number,
): ApprovalStepView | null {
  const row = asRecord(value)
  if (!row) return null

  const sequence = readNumber(row.sequence) || index + 1
  const approverId =
    readNumber(row.approver_id) ||
    readNumber(row.approver) ||
    readNumber(row.user_id)
  const approverName =
    readString(row.approver_name) ||
    readString(row.approver_label) ||
    readString(row.user_name) ||
    readString(row.name) ||
    (approverId ? `Approver ${approverId}` : `Approval step ${sequence}`)

  return {
    sequence,
    approverId,
    approverName,
    amount: readString(row.amount),
    currency: readString(row.currency),
    stepType: readString(row.step_type),
    status:
      readString(row.status) ||
      readString(row.approval_status) ||
      readString(row.state),
  }
}

function extractSteps(...sources: unknown[]) {
  for (const source of sources) {
    const normalized = asArray(source)
      .map((row, index) => normalizeStepRow(row, index))
      .filter((row): row is ApprovalStepView => Boolean(row))
      .sort((left, right) => left.sequence - right.sequence)

    if (normalized.length > 0) {
      return normalized
    }
  }

  return []
}

export function extractApprovalChainView(
  subject: ApprovalRouteSubject | null,
  preview: Record<string, unknown>,
): ApprovalChainView {
  const previewResult = asRecord(preview.result)
  const snapshot = asRecord(subject?.approvalChainSnapshot)
  const snapshotChain = asRecord(snapshot?.chain)
  const chain = pickFirstRecord(
    asRecord(preview.chain),
    asRecord(preview.approval_chain),
    asRecord(preview.matched_chain),
    asRecord(previewResult?.chain),
    snapshotChain,
    snapshot,
  )

  const steps = extractSteps(
    preview.steps,
    preview.approval_steps,
    preview.resolved_steps,
    preview.assigned_steps,
    previewResult?.steps,
    previewResult?.approval_steps,
    previewResult?.resolved_steps,
    snapshot?.steps,
    snapshot?.approval_steps,
    snapshot?.resolved_steps,
    chain?.steps,
  )

  return {
    id:
      readNumber(chain?.id) ||
      subject?.approvalRuntime?.matchedChainId ||
      subject?.approvalChain ||
      undefined,
    name:
      readString(chain?.name) ||
      subject?.approvalRuntime?.matchedChainName ||
      (readNumber(chain?.id) || subject?.approvalChain
        ? `Approval chain #${
            readNumber(chain?.id) ||
            subject?.approvalRuntime?.matchedChainId ||
            subject?.approvalChain
          }`
        : 'Approval chain matched'),
    description: readString(chain?.description),
    matchStrategy:
      readString(chain?.match_strategy) ||
      subject?.approvalRuntime?.matchStrategy ||
      readString(snapshot?.match_strategy) ||
      readString(preview.match_strategy) ||
      readString(previewResult?.match_strategy),
    steps,
  }
}

export function formatApprovalDateTime(value: string | null | undefined) {
  if (!value) return 'Just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatApprovalStepAmount(
  amount?: string,
  currency?: string,
) {
  if (!amount?.trim()) return 'No threshold defined'

  const numeric = Number(amount)
  if (Number.isFinite(numeric) && currency?.trim()) {
    try {
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: currency.trim().toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric)
    } catch {
      return `${currency.trim().toUpperCase()} ${amount}`
    }
  }

  if (currency?.trim()) {
    return `${currency.trim().toUpperCase()} ${amount}`
  }

  return amount
}

export function describeApprovalMatchStrategy(value: string | undefined) {
  if (value === 'any') return 'Any one condition can match'
  if (value === 'all') return 'All conditions must match'
  return 'Matched during submission'
}

export function normalizeApprovalStepStatus(
  status: string | undefined,
  index: number,
) {
  const normalized = status?.trim().toLowerCase()

  if (
    normalized === 'approved' ||
    normalized === 'complete' ||
    normalized === 'completed'
  ) {
    return 'approved'
  }

  if (
    normalized === 'rejected' ||
    normalized === 'declined' ||
    normalized === 'failed'
  ) {
    return 'rejected'
  }

  if (
    normalized === 'pending' ||
    normalized === 'current' ||
    normalized === 'processing' ||
    normalized === 'in_progress'
  ) {
    return 'current'
  }

  if (
    normalized === 'queued' ||
    normalized === 'upcoming' ||
    normalized === 'waiting'
  ) {
    return 'queued'
  }

  return index === 0 ? 'current' : 'queued'
}

export function labelApprovalStepStatus(
  status: string | undefined,
  index: number,
) {
  const normalized = normalizeApprovalStepStatus(status, index)

  if (normalized === 'approved') return 'Approved'
  if (normalized === 'rejected') return 'Rejected'
  if (normalized === 'current') return 'Current approver'
  return 'Queued'
}

export function countApprovalsRemaining(
  steps: ApprovalStepView[],
  overallStatus?: string,
  runtimeRemaining?: number,
) {
  if (typeof runtimeRemaining === 'number' && runtimeRemaining >= 0) {
    return runtimeRemaining
  }

  const normalizedOverall = overallStatus?.trim().toLowerCase()
  if (
    normalizedOverall === 'approved' ||
    normalizedOverall === 'rejected'
  ) {
    return 0
  }

  return steps.filter((step, index) => {
    const status = normalizeApprovalStepStatus(step.status, index)
    return status !== 'approved'
  }).length
}

export function getCurrentApprovalStep(
  steps: ApprovalStepView[],
  overallStatus?: string,
  runtimeStepSequence?: number,
  runtimeApproverId?: number,
) {
  const normalizedOverall = overallStatus?.trim().toLowerCase()
  if (
    normalizedOverall === 'approved' ||
    normalizedOverall === 'rejected'
  ) {
    return null
  }

  if (typeof runtimeStepSequence === 'number') {
    const runtimeStep =
      steps.find((step) => step.sequence === runtimeStepSequence) || null
    if (runtimeStep) return runtimeStep
  }

  if (typeof runtimeApproverId === 'number') {
    const runtimeApproverStep =
      steps.find((step) => step.approverId === runtimeApproverId) || null
    if (runtimeApproverStep) return runtimeApproverStep
  }

  return (
    steps.find(
      (step, index) =>
        normalizeApprovalStepStatus(step.status, index) === 'current',
    ) ||
    steps.find(
      (step, index) =>
        normalizeApprovalStepStatus(step.status, index) !== 'approved',
    ) ||
    null
  )
}

export function getCurrentApproverName(
  subject: ApprovalRouteSubject | null,
  steps: ApprovalStepView[],
  overallStatus?: string,
) {
  const runtimeName = subject?.approvalRuntime?.currentApproverName?.trim()
  if (runtimeName) return runtimeName

  return (
    getCurrentApprovalStep(
      steps,
      overallStatus,
      subject?.approvalRuntime?.currentStepSequence,
      subject?.approvalRuntime?.currentApproverId,
    )?.approverName || ''
  )
}

export function getApprovalComputedAt(subject: ApprovalRouteSubject | null) {
  return subject?.approvalRuntime?.computedAt || subject?.decisionAt
}
