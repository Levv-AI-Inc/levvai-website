'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  MessageCircle,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import InitiateRequestButton from '../components/InitiateRequestButton'

type SessionUser = {
  first_name?: string
  username?: string
  email?: string
}

type SessionStatusResponse = {
  authenticated?: boolean
  user?: SessionUser
}

type IntakeRequest = {
  id: number | string
  title: string
  description: string
  engagement_type: string
  target_rate: string
  rate_unit: string
  currency: string
  worker_count: number
  created_at: string
  submitted_at: string
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function normalizeIntakeRequest(row: Record<string, unknown>): IntakeRequest {
  return {
    id:
      typeof row.id === 'string' || typeof row.id === 'number'
        ? row.id
        : '',
    title: readString(row.title),
    description: readString(row.description),
    engagement_type: readString(row.engagement_type),
    target_rate: readString(row.target_rate),
    rate_unit: readString(row.rate_unit),
    currency: readString(row.currency),
    worker_count: readNumber(row.worker_count),
    created_at: readString(row.created_at),
    submitted_at: readString(row.submitted_at),
  }
}

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatRequestSubtitle(request: IntakeRequest): string {
  const parts: string[] = []

  if (request.engagement_type) {
    parts.push(toTitleCase(request.engagement_type))
  }

  if (request.target_rate) {
    const currency = request.currency || 'USD'
    const unit = request.rate_unit ? `/${request.rate_unit}` : ''
    parts.push(`${currency} ${request.target_rate}${unit}`)
  }

  if (request.worker_count > 0) {
    parts.push(
      `${request.worker_count} worker${request.worker_count === 1 ? '' : 's'}`,
    )
  }

  return parts.join(' - ')
}

function formatRequestDate(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-base font-semibold text-slate-900">
          {title}
        </h3>
      </div>
      <div className="px-6 pb-6">{children}</div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [greetingName, setGreetingName] = useState('there')
  const [showAgent, setShowAgent] = useState(false)
  const [openRequest, setOpenRequest] = useState<string | null>(
    null
  )
  const [openWorker, setOpenWorker] = useState<string | null>(
    null
  )
  const [pendingRequests, setPendingRequests] = useState<
    IntakeRequest[]
  >([])
  const [loadingPendingRequests, setLoadingPendingRequests] =
    useState(true)
  const [pendingRequestsError, setPendingRequestsError] =
    useState('')

  /* ================= NOVA (HARD-CODED MVP) ================= */
  const [novaInput, setNovaInput] = useState('')
  const [novaResponse, setNovaResponse] = useState<null | {
    title: string
    body: string[]
    cta?: string
    disclaimer?: string
  }>(null)
  /* ========================================================= */


  useEffect(() => {
    const controller = new AbortController()

    const verifySession = async () => {
      try {
        const response = await fetch('/api/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          router.replace('/auth/login?next=/home')
          return
        }

        const payload = (await response.json().catch(() => ({}))) as SessionStatusResponse
        if (!payload.authenticated || !payload.user) {
          router.replace('/auth/login?next=/home')
          return
        }

        const user = payload.user
        const derivedName =
          user.first_name?.trim() ||
          user.username?.trim() ||
          user.email?.split('@')[0]?.trim() ||
          'there'
        setGreetingName(derivedName)
        setCheckingSession(false)
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return
        router.replace('/auth/login?next=/home')
      }
    }

    void verifySession()

    return () => controller.abort()
  }, [router])

  useEffect(() => {
    if (checkingSession) return

    const controller = new AbortController()

    const loadPendingRequests = async () => {
      setLoadingPendingRequests(true)
      setPendingRequestsError('')

      try {
        const response = await fetch(
          '/api/intake?status=submitted&mine=true',
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        const payload = (await response
          .json()
          .catch(() => ({}))) as {
          detail?: unknown
          results?: unknown[]
        }

        if (response.status === 401) {
          router.replace('/auth/login?next=/home')
          return
        }

        if (response.status === 400) {
          setPendingRequests([])
          setPendingRequestsError(
            typeof payload.detail === 'string'
              ? payload.detail
              : 'Tenant context is required to load pending requests.',
          )
          return
        }

        if (response.status === 403) {
          setPendingRequests([])
          setPendingRequestsError(
            typeof payload.detail === 'string'
              ? payload.detail
              : 'You are not an active member of this tenant.',
          )
          return
        }

        if (!response.ok) {
          setPendingRequests([])
          setPendingRequestsError(
            typeof payload.detail === 'string'
              ? payload.detail
              : `Failed to load pending requests (${response.status}).`,
          )
          return
        }

        const rows = Array.isArray(payload.results)
          ? payload.results
          : []

        const normalized = rows
          .filter(
            (row): row is Record<string, unknown> =>
              Boolean(row) && typeof row === 'object',
          )
          .map((row) => normalizeIntakeRequest(row))
          .sort((a, b) => {
            const aTime = new Date(
              a.created_at || a.submitted_at,
            ).getTime()
            const bTime = new Date(
              b.created_at || b.submitted_at,
            ).getTime()
            return bTime - aTime
          })

        setPendingRequests(normalized)
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
          return
        }
        setPendingRequests([])
        setPendingRequestsError('Unable to load pending requests.')
      } finally {
        setLoadingPendingRequests(false)
      }
    }

    void loadPendingRequests()

    return () => controller.abort()
  }, [checkingSession, router])

  if (checkingSession) {
    return <main className="min-h-screen bg-slate-100" />
  }

  return (
    /* ================= ROOT BACKGROUND ================= */
    <main className="min-h-screen bg-slate-100">
      {/* ================= CONTENT WRAPPER ================= */}
      <div className="px-10 py-8 space-y-10">
        {/* ================= HEADER ================= */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Hi {greetingName}, welcome back
            </h1>
            <p className="mt-2 text-base text-slate-500">
              You have{' '}
              <strong>
                {loadingPendingRequests
                  ? '...'
                  : pendingRequests.length}{' '}
                pending requests
              </strong>{' '}
              and{' '}
              <strong>3 workers</strong> nearing end date
            </p>
          </div>

          <InitiateRequestButton className="mt-1 rounded-full px-8 py-4 text-base font-semibold shadow-md hover:shadow-lg transition" />
        </div>

        {/* ================= PENDING REQUESTS ================= */}
        <Card
          title={`Pending Requests (${loadingPendingRequests ? '...' : pendingRequests.length})`}
        >
          {loadingPendingRequests ? (
            <div className="text-sm text-slate-500">
              Loading pending requests...
            </div>
          ) : pendingRequestsError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {pendingRequestsError}
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-sm text-slate-500">
              No pending requests.
            </div>
          ) : (
            <div className="divide-y">
              {pendingRequests.map((request) => {
              const requestKey = String(request.id)
              const open = openRequest === requestKey
              return (
                <div key={requestKey} className="py-4">
                  <button
                    onClick={() =>
                      setOpenRequest(open ? null : requestKey)
                    }
                    className="w-full flex justify-between items-center"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900">
                        {request.title || `Request #${requestKey}`}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatRequestSubtitle(request) ||
                          `Request ID ${requestKey}`}
                      </p>
                    </div>
                    {open ? (
                      <ChevronDown />
                    ) : (
                      <ChevronRight />
                    )}
                  </button>

                  {open && (
                    <div className="mt-4 ml-4 space-y-3 text-sm">
                      {request.description ? (
                        <p className="text-slate-700">
                          {request.description}
                        </p>
                      ) : (
                        <p className="text-slate-500">
                          No description provided.
                        </p>
                      )}
                      {(request.submitted_at ||
                        request.created_at) && (
                        <p className="text-xs text-slate-500">
                          Submitted{' '}
                          {formatRequestDate(
                            request.submitted_at ||
                              request.created_at,
                          )}
                        </p>
                      )}
                      <div>
                        <Link
                          href={`/my-items/jobs/${encodeURIComponent(
                            String(request.id),
                          )}`}
                          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-900"
                        >
                          View request details
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )
              })}
            </div>
          )}
        </Card>

        {/* ================= METRICS ================= */}
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Pending Requests
            </p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {loadingPendingRequests
                ? '...'
                : pendingRequests.length}
            </p>
          </div>

          <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Workers Near End Date
            </p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              3
            </p>
          </div>
        </div>

        {/* ================= WORKERS NEARING END ================= */}
        <Card title="Workers Nearing End Date">
          <div className="divide-y">
            {NEARING_END.map((w) => {
              const open = openWorker === w.id
              return (
                <div key={w.id} className="py-4">
                  <button
                    onClick={() =>
                      setOpenWorker(open ? null : w.id)
                    }
                    className="w-full flex justify-between items-center"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900">
                        {w.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        Ends in {w.days} days · {w.role}
                      </p>
                    </div>
                    {open ? (
                      <ChevronDown />
                    ) : (
                      <ChevronRight />
                    )}
                  </button>

                  {open && (
                    <div className="mt-4 ml-4 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span>Extension not confirmed</span>
                        <a
                          href="#"
                          className="underline font-medium"
                        >
                          Review extension
                        </a>
                      </div>
                      <div className="flex justify-between">
                        <span>Budget approval required</span>
                        <a
                          href="#"
                          className="underline font-medium"
                        >
                          Assign owner
                        </a>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          Auto-termination scheduled
                        </span>
                        <a
                          href="#"
                          className="underline font-medium"
                        >
                          Take action
                        </a>
                      </div>
                      <a
                        href="#"
                        className="inline-block mt-2 font-medium text-blue-600 hover:underline"
                      >
                        Open worker record →
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* ================= ACTION PANELS ================= */}
        <div className="grid grid-cols-2 gap-8">
          <Card title="Upcoming Auto-Actions (Next 30 Days)">
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between">
                <span>
                  3 workers scheduled for auto-termination
                </span>
                <a href="#" className="underline font-medium">
                  Review
                </a>
              </li>
              <li className="flex justify-between">
                <span>2 SOWs expiring without renewal</span>
                <a href="#" className="underline font-medium">
                  Open SOWs
                </a>
              </li>
              <li className="flex justify-between">
                <span>
                  1 rate card locking pending refresh
                </span>
                <a href="#" className="underline font-medium">
                  Refresh rate card
                </a>
              </li>
            </ul>
          </Card>

          <Card title="Required This Week">
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between">
                <span>Confirm extension (S. Ahmed)</span>
                <a href="#" className="underline font-medium">
                  Review
                </a>
              </li>
              <li className="flex justify-between">
                <span>Assign budget owner to JP-1021</span>
                <a href="#" className="underline font-medium">
                  Assign
                </a>
              </li>
              <li className="flex justify-between">
                <span>Approve above-policy rate</span>
                <a href="#" className="underline font-medium">
                  Decide
                </a>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* ================= NOVA ================= */}
      <div className="fixed bottom-6 right-6 z-50">
        {showAgent ? (
          <div className="w-[420px] rounded-2xl bg-white border shadow-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold">
                Nova · AI Operations Assistant
              </h3>
              <button onClick={() => setShowAgent(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* INPUT */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!novaInput.trim()) return

                const q = novaInput.toLowerCase()

                // HARD-CODED INTELLIGENCE
                if (q.includes('amy')) {
                  setNovaResponse({
                    title: 'Amy James — Worker Status',
                    body: [
                      'Role: Software Contractor',
                      'Status: Offboarded',
                      'Offboarded on Jan 25, 2026',
                      'Reason: End of SOW',
                      'Manager: Sarah Patel',
                    ],
                  })
                } else if (q.includes('offboard')) {
                  setNovaResponse({
                    title: 'Offboard Worker',
                    body: [
                      'Manager confirmation required',
                      'Finance review required',
                      'System access will be revoked',
                    ],
                    cta: 'View Offboarding Workflow',
                    disclaimer:
                      'Preview only. Execution requires approvals and permissions.',
                  })
                } else if (q.includes('jp-1021')) {
                  setNovaResponse({
                    title: 'JP-1021 — Request Blockers',
                    body: [
                      'Missing JP owner',
                      'Rate exceeds policy threshold',
                      
                    ],
                  })
                } else {
                  setNovaResponse({
                    title: 'Nova - ask me anything',
                    body: [
                      ,
                      'E.g, “What happened to [workers name]?”',
                    ],
                  })
                }

                setNovaInput('')
              }}
            >
              <input
                value={novaInput}
                onChange={(e) =>
                  setNovaInput(e.target.value)
                }
                placeholder="Ask Nova something…"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </form>

            {/* RESPONSE */}
            {novaResponse && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium mb-2">
                  {novaResponse.title}
                </p>

                <ul className="space-y-1">
                  {novaResponse.body.map((b, i) => (
                    <li key={i}>• {b}</li>
                  ))}
                </ul>

                {novaResponse.cta && (
                  <a
                    href="#"
                    className="inline-block mt-3 text-blue-600 underline text-sm"
                  >
                    {novaResponse.cta}
                  </a>
                )}

                {novaResponse.disclaimer && (
                  <p className="mt-2 text-xs text-slate-400">
                    {novaResponse.disclaimer}
                  </p>
                )}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-400">
              Responses shown using sample system data
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowAgent(true)}
            className="rounded-full bg-slate-900 p-4 text-white shadow-lg hover:shadow-xl transition"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        )}
      </div>
    </main>
  )
}

/* ================= MOCK DATA ================= */

const NEARING_END = [
  { id: 'W1', name: 'S. Ahmed', role: 'Senior Developer', days: 5 },
  { id: 'W2', name: 'L. Chen', role: 'Business Analyst', days: 12 },
  { id: 'W3', name: 'R. Patel', role: 'Project Manager', days: 18 },
]
