'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, Sparkles } from 'lucide-react'

type ApprovalItem = {
  id: string
  intakeId: number | null
  type: string
  title: string
  requester: string
  supplier: string
  amount: string
  approvalType: string
  submitted: string
  decidedOn: string
  decision?: 'Approved' | 'Rejected'
}

type SessionUser = {
  id?: number | string
}

type SessionStatusResponse = {
  authenticated?: boolean
  user?: SessionUser
}

type DashboardQueueRow = {
  intake_id?: number | string
  request_id?: string
  type?: string
  title?: string
  requested_by?: string
  supplier?: string
  amount?: string
  approval_type?: string
  submitted_ago?: string
  submitted_at?: string
}

type DashboardResponse = {
  my_approval_queue?: DashboardQueueRow[]
  meta?: {
    is_approver?: boolean
    role?: string
  }
}

type IntakeRow = {
  id?: number | string
  request_id?: string
  type?: string
  title?: string
  description?: string
  engagement_type?: string
  requested_by?: string
  created_by?: number | string
  supplier?: number | string
  supplier_name?: string
  amount?: string
  approval_type?: string
  budget_amount?: string
  bill_rate?: string
  target_rate?: string
  rate_unit?: string
  currency?: string
  submitted_ago?: string
  submitted_at?: string
  created_at?: string
  decision_at?: string | null
  decided_by?: number | string | null
  status?: string
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readIntakeId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function parseJsonSafe(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}))
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || ''
  }
  return ''
}

function getCsrfHeaders(): Record<string, string> {
  const csrfToken = getCookie('csrftoken')
  if (!csrfToken) return {}
  return {
    'X-CSRFToken': csrfToken,
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }
  }
  return fallback
}

function toRequestId(requestId: unknown, intakeId: unknown): string {
  const stringRequestId = readString(requestId)
  if (stringRequestId) return stringRequestId

  const intake = readIntakeId(intakeId)
  if (intake !== null) return `INT-${intake}`
  return '-'
}

function formatAmountFromIntake(row: IntakeRow): string {
  const amount = readString(row.amount)
  if (amount) return amount

  const currency = readString(row.currency) || 'USD'
  const budgetAmount = readString(row.budget_amount)
  if (budgetAmount) return `${currency} ${budgetAmount}`

  const targetRate = readString(row.bill_rate) || readString(row.target_rate)
  if (targetRate) {
    const unit = readString(row.rate_unit)
    return unit
      ? `${currency} ${targetRate}/${unit}`
      : `${currency} ${targetRate}`
  }

  return '-'
}

function formatDate(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function mapQueueRowToApprovalItem(row: DashboardQueueRow): ApprovalItem {
  const intakeId = readIntakeId(row.intake_id)
  const submittedAgo = readString(row.submitted_ago)
  const submittedAt = readString(row.submitted_at)

  return {
    id: toRequestId(row.request_id, row.intake_id),
    intakeId,
    type: readString(row.type) || '-',
    title: readString(row.title) || '-',
    requester: readString(row.requested_by) || '-',
    supplier: readString(row.supplier) || '-',
    amount: readString(row.amount) || '-',
    approvalType: readString(row.approval_type) || '-',
    submitted: submittedAgo || formatDate(submittedAt) || '-',
    decidedOn: '',
  }
}

function mapHistoryRowToApprovalItem(row: IntakeRow): ApprovalItem {
  const intakeId = readIntakeId(row.id)
  const createdBy = row.created_by
  const requester =
    readString(row.requested_by) ||
    (createdBy !== undefined && createdBy !== null
      ? `User ${String(createdBy)}`
      : '-')
  const supplier =
    readString(row.supplier_name) ||
    (row.supplier !== undefined && row.supplier !== null
      ? `Supplier ${String(row.supplier)}`
      : '-')
  const type = readString(row.type || row.engagement_type)
  const status = readString(row.status).toLowerCase()
  const submittedAgo = readString(row.submitted_ago)
  const submittedAt = readString(row.submitted_at || row.created_at)
  const decisionAt = readString(row.decision_at)

  return {
    id: toRequestId(row.request_id, row.id),
    intakeId,
    type: type ? toTitleCase(type) : '-',
    title:
      readString(row.title) ||
      readString(row.description) ||
      '-',
    requester,
    supplier,
    amount: formatAmountFromIntake(row),
    approvalType: readString(row.approval_type) || '-',
    submitted: submittedAgo || formatDate(submittedAt) || '-',
    decidedOn: formatDate(decisionAt) || '-',
    decision: status === 'approved' ? 'Approved' : 'Rejected',
  }
}

function extractResults(payload: unknown): IntakeRow[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (row): row is IntakeRow =>
        Boolean(row) && typeof row === 'object',
    )
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { results?: unknown[] }).results)
  ) {
    return ((payload as { results: unknown[] }).results).filter(
      (row): row is IntakeRow =>
        Boolean(row) && typeof row === 'object',
    )
  }

  return []
}

function decisionFallbackMessage(
  status: number,
  action: 'approve' | 'reject',
): string {
  if (status === 400) {
    return `Unable to ${action} request (invalid input or tenant context).`
  }
  if (status === 403) {
    return 'You are not the current approver for this request.'
  }
  if (status === 404) {
    return 'Request not found.'
  }
  if (status === 409) {
    return 'Invalid transition. Only submitted requests can be decided.'
  }
  return `Unable to ${action} request (${status}).`
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-lg font-black tracking-tight text-slate-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm font-medium text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-6">
      {children}
      </div>
    </section>
  )
}

export default function MyApprovalsPage() {
  const router = useRouter()

  const [loadingQueue, setLoadingQueue] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [queueError, setQueueError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [pending, setPending] = useState<ApprovalItem[]>([])
  const [history, setHistory] = useState<ApprovalItem[]>([])
  const [isApprover, setIsApprover] = useState(false)
  const [role, setRole] = useState('')
  const [tenantPendingSubmittedCount, setTenantPendingSubmittedCount] =
    useState<number | null>(null)
  const [decisionBusyKey, setDecisionBusyKey] = useState<string | null>(
    null,
  )
  const [decisionModal, setDecisionModal] = useState<{
    item: ApprovalItem
    action: 'approve' | 'reject'
    note: string
  } | null>(null)
  const [decisionModalError, setDecisionModalError] = useState('')

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingQueue(true)
      setLoadingHistory(true)
      setQueueError('')
      setHistoryError('')

      try {
        const sessionResponse = await fetch('/api/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal,
        })

        const sessionPayload = (await parseJsonSafe(
          sessionResponse,
        )) as SessionStatusResponse

        if (
          sessionResponse.status === 401 ||
          !sessionResponse.ok ||
          !sessionPayload.authenticated
        ) {
          router.replace('/auth/login?next=/my-items/approvals')
          return
        }

        const currentUserId =
          sessionPayload.user?.id !== undefined &&
          sessionPayload.user?.id !== null
            ? String(sessionPayload.user.id)
            : ''

        const [
          dashboardResult,
          submittedResult,
          approvedResult,
          rejectedResult,
        ] = await Promise.all([
          fetch('/api/approvals/dashboard', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            signal,
          }),
          fetch('/api/intake?status=submitted', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            signal,
          }),
          fetch('/api/intake?status=approved', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            signal,
          }),
          fetch('/api/intake?status=rejected', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            signal,
          }),
        ])

        const [
          dashboardPayload,
          submittedPayload,
          approvedPayload,
          rejectedPayload,
        ] = await Promise.all([
          parseJsonSafe(dashboardResult),
          parseJsonSafe(submittedResult),
          parseJsonSafe(approvedResult),
          parseJsonSafe(rejectedResult),
        ])

        if (
          dashboardResult.status === 401 ||
          submittedResult.status === 401 ||
          approvedResult.status === 401 ||
          rejectedResult.status === 401
        ) {
          router.replace('/auth/login?next=/my-items/approvals')
          return
        }

        if (!dashboardResult.ok) {
          setPending([])
          setQueueError(
            extractErrorMessage(
              dashboardPayload,
              `Unable to load approval queue (${dashboardResult.status}).`,
            ),
          )
        } else {
          const dashboardData = dashboardPayload as DashboardResponse
          const queueRows = Array.isArray(
            dashboardData.my_approval_queue,
          )
            ? dashboardData.my_approval_queue
            : []

          setIsApprover(Boolean(dashboardData.meta?.is_approver))
          setRole(readString(dashboardData.meta?.role))
          setPending(queueRows.map(mapQueueRowToApprovalItem))
        }

        if (submittedResult.ok) {
          setTenantPendingSubmittedCount(
            extractResults(submittedPayload).length,
          )
        } else {
          setTenantPendingSubmittedCount(null)
        }

        if (!approvedResult.ok || !rejectedResult.ok) {
          const failingPayload = !approvedResult.ok
            ? approvedPayload
            : rejectedPayload
          const failingStatus = !approvedResult.ok
            ? approvedResult.status
            : rejectedResult.status

          setHistory([])
          setHistoryError(
            extractErrorMessage(
              failingPayload,
              `Unable to load approval history (${failingStatus}).`,
            ),
          )
        } else if (!currentUserId) {
          setHistory([])
          setHistoryError(
            'Unable to determine current user for approval history.',
          )
        } else {
          const combinedRows = [
            ...extractResults(approvedPayload),
            ...extractResults(rejectedPayload),
          ].filter((row) => {
            const decidedBy =
              row.decided_by !== undefined &&
              row.decided_by !== null
                ? String(row.decided_by)
                : ''
            return decidedBy === currentUserId
          })

          const mappedHistory = combinedRows
            .sort((a, b) => {
              const aTime = new Date(
                readString(a.decision_at || a.created_at || a.submitted_at),
              ).getTime()
              const bTime = new Date(
                readString(b.decision_at || b.created_at || b.submitted_at),
              ).getTime()
              return bTime - aTime
            })
            .map(mapHistoryRowToApprovalItem)

          setHistory(mappedHistory)
        }
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
          return
        }

        setPending([])
        setHistory([])
        setQueueError('Unable to load approval queue.')
        setHistoryError('Unable to load approval history.')
      } finally {
        setLoadingQueue(false)
        setLoadingHistory(false)
      }
    },
    [router],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  const queueDescription = useMemo(() => {
    const details: string[] = ['Requests awaiting your action']
    if (tenantPendingSubmittedCount !== null) {
      details.push(
        `${tenantPendingSubmittedCount} submitted requests in tenant`,
      )
    }
    if (role) {
      details.push(`Role: ${toTitleCase(role)}`)
    }
    return details.join(' - ')
  }, [role, tenantPendingSubmittedCount])

  const openDecisionModal = useCallback(
    (item: ApprovalItem, action: 'approve' | 'reject') => {
      if (item.intakeId === null) {
        setQueueError('Cannot process this request: missing intake ID.')
        return
      }

      setQueueError('')
      setDecisionModalError('')
      setDecisionModal({
        item,
        action,
        note: '',
      })
    },
    [],
  )

  const closeDecisionModal = useCallback(() => {
    if (decisionBusyKey) return
    setDecisionModal(null)
    setDecisionModalError('')
  }, [decisionBusyKey])

  const confirmDecision = useCallback(async () => {
    if (!decisionModal) return

    const { item, action, note } = decisionModal

    if (item.intakeId === null) {
      setDecisionModalError('Cannot process this request: missing intake ID.')
      return
    }

    const busyKey = `${item.intakeId}:${action}`
    setDecisionBusyKey(busyKey)
    setQueueError('')
    setDecisionModalError('')

    try {
      const trimmedReason = note.trim()
      const payload =
        trimmedReason.length > 0
          ? { decision_reason: trimmedReason }
          : {}

      const response = await fetch(
        `/api/intake/${encodeURIComponent(
          String(item.intakeId),
        )}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            ...getCsrfHeaders(),
          },
          body: JSON.stringify(payload),
        },
      )

      const responsePayload = await parseJsonSafe(response)

      if (response.status === 401) {
        router.replace('/auth/login?next=/my-items/approvals')
        return
      }

      if (!response.ok) {
        setDecisionModalError(
          extractErrorMessage(
            responsePayload,
            decisionFallbackMessage(response.status, action),
          ),
        )
        return
      }

      setDecisionModal(null)
      setDecisionModalError('')
      await loadData()
    } catch {
      setDecisionModalError(`Unable to ${action} request.`)
    } finally {
      setDecisionBusyKey(null)
    }
  }, [decisionModal, loadData, router])

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              My Approvals
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Review approval queue, make decisions, and audit your completed
              approvals.
            </p>
          </div>

          <div className="group relative w-full md:w-96">
            <div className="absolute inset-0 rounded-3xl bg-cyan-400/10 blur-xl transition-all group-hover:bg-cyan-400/20" />
            <div className="relative flex items-center overflow-hidden rounded-2xl border border-cyan-100 bg-white p-1 shadow-sm">
              <div className="ml-1 rounded-xl bg-slate-950 p-2.5 text-cyan-400 shadow-lg shadow-cyan-900/10">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="px-3 py-2 text-sm font-semibold text-slate-500">
                Tenant approval workload
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Pending queue
              </span>
              <Clock3 className="h-5 w-5 text-cyan-500" />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {pending.length}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Completed
              </span>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {history.length}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Tenant submitted
            </span>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {tenantPendingSubmittedCount ?? '-'}
            </div>
          </div>
        </div>

      <Card title="My Queue" description={queueDescription}>
        {!isApprover && !loadingQueue && !queueError && (
          <p className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            You are not marked as an approver for this tenant.
          </p>
        )}
        <ApprovalTable
          data={pending}
          showActions
          loading={loadingQueue}
          error={queueError}
          emptyMessage="No pending approvals"
          decisionBusyKey={decisionBusyKey}
          onDecision={openDecisionModal}
        />
      </Card>

      <Card
        title="Decision History"
        description="Requests you have approved or rejected"
      >
        <ApprovalTable
          data={history}
          showActions={false}
          loading={loadingHistory}
          error={historyError}
          emptyMessage="No approvals processed yet"
        />
      </Card>

      {decisionModal && (
        <DecisionModal
          item={decisionModal.item}
          action={decisionModal.action}
          note={decisionModal.note}
          error={decisionModalError}
          busy={
            decisionBusyKey ===
            `${decisionModal.item.intakeId}:${decisionModal.action}`
          }
          onCancel={closeDecisionModal}
          onChangeNote={(note) =>
            setDecisionModal((current) =>
              current ? { ...current, note } : current,
            )
          }
          onConfirm={() => void confirmDecision()}
        />
      )}
      </div>
    </div>
  )
}

function DecisionModal({
  item,
  action,
  note,
  error,
  busy,
  onCancel,
  onChangeNote,
  onConfirm,
}: {
  item: ApprovalItem
  action: 'approve' | 'reject'
  note: string
  error: string
  busy: boolean
  onCancel: () => void
  onChangeNote: (value: string) => void
  onConfirm: () => void
}) {
  const actionLabel = action === 'approve' ? 'Approve' : 'Reject'
  const confirmLabel =
    action === 'approve'
      ? busy
        ? 'Approving...'
        : 'Approve'
      : busy
        ? 'Rejecting...'
        : 'Reject'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {actionLabel} {item.id}?
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add an optional decision note for the approval record.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Decision note
            </label>
            <textarea
              rows={4}
              value={note}
              onChange={(event) => onChangeNote(event.target.value)}
              placeholder="Optional context for this decision"
              disabled={busy}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              action === 'approve'
                ? 'bg-cyan-700 hover:bg-cyan-800'
                : 'bg-rose-700 hover:bg-rose-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApprovalTable({
  data,
  showActions,
  loading,
  error,
  emptyMessage,
  decisionBusyKey,
  onDecision,
}: {
  data: ApprovalItem[]
  showActions: boolean
  loading: boolean
  error: string
  emptyMessage: string
  decisionBusyKey?: string | null
  onDecision?: (
    item: ApprovalItem,
    action: 'approve' | 'reject',
  ) => void
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Request ID</th>
              <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Type</th>
              <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Title</th>
              <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Requested By</th>
              <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Supplier</th>
              <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Amount</th>
              <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Approval Type</th>
              <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {showActions ? 'Submitted' : 'Decision'}
              </th>
              <th className="px-6 py-5 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {showActions ? 'Action' : ''}
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-12 text-center text-sm font-medium text-slate-500"
                >
                  Loading...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-12 text-center text-sm font-medium text-rose-600"
                >
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && data.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-12 text-center text-sm font-medium text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              data.map((item) => (
                <tr
                  key={`${item.id}-${item.intakeId ?? ''}`}
                  className="group transition-all hover:bg-cyan-50/40"
                >
                  <td className="px-6 py-5 font-bold text-slate-900">
                    {item.id}
                  </td>
                  <td className="px-6 py-5 text-slate-700">{item.type}</td>
                  <td className="px-6 py-5 font-semibold text-slate-800">{item.title}</td>
                  <td className="px-6 py-5 text-slate-700">{item.requester}</td>
                  <td className="px-6 py-5 text-slate-700">{item.supplier}</td>
                  <td className="px-6 py-5 text-slate-700">{item.amount}</td>
                  <td className="px-6 py-5 text-slate-700">{item.approvalType}</td>

                  <td className="px-6 py-5">
                    {showActions ? (
                      item.submitted
                    ) : (
                      <div className="space-y-1">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            item.decision === 'Approved'
                              ? 'bg-cyan-100 text-cyan-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {item.decision}
                        </span>
                        <div className="text-xs text-slate-500">
                          {item.decidedOn}
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-5 text-right">
                    {showActions && onDecision && (
                      <div className="flex justify-end gap-2">
                        {(() => {
                          const busyKey = decisionBusyKey || ''
                          const rowKeyPrefix = `${
                            item.intakeId ?? 'missing'
                          }:`
                          const rowBusy =
                            busyKey.length > 0 &&
                            busyKey.startsWith(rowKeyPrefix)
                          const approveBusy =
                            busyKey === `${item.intakeId}:approve`
                          const rejectBusy =
                            busyKey === `${item.intakeId}:reject`
                          const disabled =
                            item.intakeId === null ||
                            busyKey.length > 0

                          return (
                            <>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  onDecision(item, 'approve')
                                }
                                title={
                                  item.intakeId === null
                                    ? 'Missing intake ID'
                                    : undefined
                                }
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                                  disabled
                                    ? 'bg-cyan-100 text-cyan-700 opacity-60 cursor-not-allowed'
                                    : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                                }`}
                              >
                                {approveBusy
                                  ? 'Approving...'
                                  : rowBusy
                                    ? 'Working...'
                                    : 'Approve'}
                              </button>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                  onDecision(item, 'reject')
                                }
                                title={
                                  item.intakeId === null
                                    ? 'Missing intake ID'
                                    : undefined
                                }
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                                  disabled
                                    ? 'bg-red-100 text-red-700 opacity-60 cursor-not-allowed'
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                              >
                                {rejectBusy
                                  ? 'Rejecting...'
                                  : rowBusy
                                    ? 'Working...'
                                    : 'Reject'}
                              </button>
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
