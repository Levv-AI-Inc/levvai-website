'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  MessageCircle,
  X,
} from 'lucide-react'
import InitiateRequestButton from './components/InitiateRequestButton'

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
  const [showAgent, setShowAgent] = useState(false)
  const [openRequest, setOpenRequest] = useState<string | null>(
    null
  )
  const [openWorker, setOpenWorker] = useState<string | null>(
    null
  )

  /* ================= NOVA (HARD-CODED MVP) ================= */
  const [novaInput, setNovaInput] = useState('')
  const [novaResponse, setNovaResponse] = useState<null | {
    title: string
    body: string[]
    cta?: string
    disclaimer?: string
  }>(null)
  /* ========================================================= */

  return (
    /* ================= ROOT BACKGROUND ================= */
    <main className="min-h-screen bg-slate-100">
      {/* ================= CONTENT WRAPPER ================= */}
      <div className="px-10 py-8 space-y-10">
        {/* ================= HEADER ================= */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Hi Faraz, welcome back
            </h1>
            <p className="mt-2 text-base text-slate-500">
              You have <strong>8 pending requests</strong> and{' '}
              <strong>3 workers</strong> nearing end date
            </p>
          </div>

          <InitiateRequestButton className="mt-1 rounded-full px-8 py-4 text-base font-semibold shadow-md hover:shadow-lg transition" />
        </div>

        {/* ================= PENDING REQUESTS ================= */}
        <Card title="Pending Requests (8)">
          <div className="divide-y">
            {PENDING_REQUESTS.map((r) => {
              const open = openRequest === r.id
              return (
                <div key={r.id} className="py-4">
                  <button
                    onClick={() =>
                      setOpenRequest(open ? null : r.id)
                    }
                    className="w-full flex justify-between items-center"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900">
                        {r.title}
                      </p>
                      <p className="text-sm text-slate-500">
                        {r.subtitle}
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
                      {r.issues.map((i, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center"
                        >
                          <span className="text-slate-700">
                            {i.text}
                          </span>
                          <a
                            href="#"
                            className="font-medium underline text-slate-900 hover:text-slate-700"
                          >
                            {i.action}
                          </a>
                        </div>
                      ))}
                      <a
                        href="#"
                        className="inline-block mt-2 text-sm font-medium text-blue-600 hover:underline"
                      >
                        Open request →
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* ================= METRICS ================= */}
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Pending Requests
            </p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              8
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

const PENDING_REQUESTS = [
  {
    id: 'JP-1021',
    title: 'JP-1021 · Senior Data Analyst',
    subtitle: 'Finance · $145/hr · New hire',
    issues: [
      { text: 'Missing JP owner', action: 'Assign owner' },
      { text: 'Rate exceeds policy threshold', action: 'Review rate' },
      
    ],
  },
  {
    id: 'JP-1044',
    title: 'JP-1044 · Cloud Engineer',
    subtitle: 'IT · Contract extension',
    issues: [
      { text: 'Extension dates not confirmed', action: 'Confirm dates' },
    
    ],
  },
]

const NEARING_END = [
  { id: 'W1', name: 'S. Ahmed', role: 'Senior Developer', days: 5 },
  { id: 'W2', name: 'L. Chen', role: 'Business Analyst', days: 12 },
  { id: 'W3', name: 'R. Patel', role: 'Project Manager', days: 18 },
]
