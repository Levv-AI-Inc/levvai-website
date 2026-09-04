'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'
import RequiredIndicator from '@/components/ui/RequiredIndicator'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

const intakeRows = [
  {
    title: 'Salesforce CPQ implementation support',
    owner: 'Revenue Operations',
    status: 'Needs scope',
    value: '$186k',
    risk: 'Medium',
  },
  {
    title: 'Data privacy review contractor',
    owner: 'Legal',
    status: 'Policy routed',
    value: '$74k',
    risk: 'Low',
  },
  {
    title: 'Plant maintenance technicians',
    owner: 'Facilities',
    status: 'Supplier match',
    value: '$420k',
    risk: 'High',
  },
]

const signals = [
  { label: 'Rate benchmark', value: '+18%', note: 'above Denver median', tone: 'amber' },
  { label: 'Classification', value: 'SOW fit', note: 'milestone-based scope', tone: 'green' },
  { label: 'Budget path', value: '2 approvers', note: 'cost center 4812', tone: 'blue' },
]

const suppliers = [
  { name: 'Northstar Delivery', fit: '94%', detail: '4 similar programs, MSA active' },
  { name: 'BrightPath Talent', fit: '88%', detail: 'rate aligned, onboarding fast' },
  { name: 'VectorWorks', fit: '81%', detail: 'needs insurance refresh' },
]

const proofPoints = [
  {
    icon: FileSearch,
    title: 'Request clean-up before procurement sees it',
    desc: 'Levv turns vague asks into structured scope, role, budget, location, supplier, and approval fields.',
  },
  {
    icon: ShieldCheck,
    title: 'Policy checks in the flow of work',
    desc: 'Classification, spend limits, supplier rules, and required documents show up as live operating signals.',
  },
  {
    icon: GitBranch,
    title: 'Approvals with context attached',
    desc: 'Every handoff carries the rate evidence, audit trail, and recommended next action.',
  },
]

const lifecycle = [
  'Ask captured',
  'Scope normalized',
  'Risk checked',
  'Supplier matched',
  'Approval routed',
  'Worker tracked',
]

export default function DemoPage() {
  const [demoOpen, setDemoOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [company, setCompany] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#1e2528]">
      <header className="sticky top-0 z-10 border-b border-[#d8d1c4] bg-[#f4f1ea]/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1f3d38] text-sm font-semibold text-[#f4f1ea]">
              L
            </div>
            <div>
              <div className="text-base font-semibold">Levv AI</div>
              <div className="text-[11px] font-medium uppercase text-[#6b746f]">
                External workforce control
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setDemoOpen(true)
              }}
              className="rounded-md border border-[#bcb4a5] px-4 py-2 text-[#31413d] transition hover:border-[#857c6c] hover:bg-white/55"
            >
              Request demo
            </Link>
            <Link
              href="/auth/login"
              className="rounded-md bg-[#1f3d38] px-4 py-2 text-white transition hover:bg-[#162d29]"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-[#d8d1c4] bg-[#f4f1ea]">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:py-14">
            <div className="flex flex-col justify-between gap-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-md border border-[#cfc7b8] bg-white/50 px-3 py-2 text-xs font-semibold uppercase text-[#51645f]">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI intake to governed work order
                </div>
                <div className="space-y-5">
                  <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] text-[#1e2528] sm:text-6xl">
                    Turn messy external-work requests into clean decisions.
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-[#52605c] sm:text-lg">
                    Levv AI gives procurement, HR, finance, and legal one operating surface for contingent labor, SOWs, suppliers, approvals, onboarding, time, and settlement.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDemoOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-[#1f3d38] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#162d29]"
                  >
                    See the workflow
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <Link
                    href="/security"
                    className="inline-flex items-center gap-2 rounded-md border border-[#bcb4a5] bg-white/35 px-4 py-3 text-sm font-semibold text-[#31413d] transition hover:bg-white/70"
                  >
                    Security posture
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-y border-[#d8d1c4] py-5">
                <div>
                  <div className="text-2xl font-semibold text-[#1f3d38]">37%</div>
                  <div className="mt-1 text-xs font-medium uppercase text-[#6b746f]">
                    fewer intake loops
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-[#1f3d38]">6</div>
                  <div className="mt-1 text-xs font-medium uppercase text-[#6b746f]">
                    live policy checks
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-[#1f3d38]">1</div>
                  <div className="mt-1 text-xs font-medium uppercase text-[#6b746f]">
                    approval record
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="overflow-hidden rounded-lg border border-[#bdb4a4] bg-[#fcfbf7] shadow-[0_28px_70px_-42px_rgba(31,61,56,0.65)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8d1c4] bg-[#e9e2d4] px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-[#1e2528]">External Work Desk</div>
                  <div className="text-xs text-[#68736e]">Today, 8:42 AM - Intake triage</div>
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <span className="rounded-md bg-[#1f3d38] px-2.5 py-1.5 text-white">Live</span>
                  <span className="rounded-md border border-[#bcb4a5] bg-white/55 px-2.5 py-1.5 text-[#51645f]">Audit on</span>
                </div>
              </div>

              <div className="grid min-h-[520px] lg:grid-cols-[260px_1fr]">
                <aside className="border-b border-[#d8d1c4] bg-[#f4f1ea] p-4 lg:border-b-0 lg:border-r">
                  <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-[#6b746f]">
                    Intake queue
                    <span>12</span>
                  </div>
                  <div className="space-y-2">
                    {intakeRows.map((row, index) => (
                      <div
                        key={row.title}
                        className={`rounded-md border p-3 ${
                          index === 0
                            ? 'border-[#1f3d38] bg-white shadow-sm'
                            : 'border-[#d8d1c4] bg-white/45'
                        }`}
                      >
                        <div className="text-sm font-semibold leading-snug text-[#26312f]">{row.title}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-[#6b746f]">
                          <span>{row.owner}</span>
                          <span>{row.value}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="rounded bg-[#e1eee6] px-2 py-1 text-[11px] font-semibold text-[#255345]">
                            {row.status}
                          </span>
                          <span className="text-[11px] font-semibold text-[#8a5d22]">{row.risk} risk</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="bg-[#fcfbf7] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d8d1c4] pb-4">
                    <div>
                      <div className="text-xs font-semibold uppercase text-[#6b746f]">
                        Draft work order
                      </div>
                      <h2 className="mt-1 text-xl font-semibold text-[#1e2528]">
                        Salesforce CPQ implementation support
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5a6662]">
                        Converted from a 4-line manager request into milestones, acceptance criteria, rate guardrails, and supplier routing.
                      </p>
                    </div>
                    <div className="rounded-md border border-[#d8d1c4] bg-white px-3 py-2 text-right">
                      <div className="text-xs text-[#6b746f]">Recommended path</div>
                      <div className="text-sm font-semibold text-[#1f3d38]">SOW, 14 weeks</div>
                    </div>
                  </div>

                  <div className="grid gap-3 py-4 sm:grid-cols-3">
                    {signals.map((signal) => (
                      <div key={signal.label} className="rounded-md border border-[#d8d1c4] bg-white p-3">
                        <div className="text-xs font-medium text-[#6b746f]">{signal.label}</div>
                        <div
                          className={`mt-2 text-xl font-semibold ${
                            signal.tone === 'amber'
                              ? 'text-[#9a651e]'
                              : signal.tone === 'green'
                                ? 'text-[#255345]'
                                : 'text-[#315c75]'
                          }`}
                        >
                          {signal.value}
                        </div>
                        <div className="mt-1 text-xs text-[#6b746f]">{signal.note}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                    <div className="rounded-md border border-[#d8d1c4] bg-white">
                      <div className="flex items-center justify-between border-b border-[#e5ded2] px-4 py-3">
                        <div className="text-sm font-semibold text-[#26312f]">Supplier shortlist</div>
                        <div className="text-xs font-semibold text-[#6b746f]">Fit score</div>
                      </div>
                      {suppliers.map((supplier) => (
                        <div
                          key={supplier.name}
                          className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#eee8de] px-4 py-3 last:border-b-0"
                        >
                          <div>
                            <div className="text-sm font-semibold text-[#26312f]">{supplier.name}</div>
                            <div className="mt-1 text-xs text-[#6b746f]">{supplier.detail}</div>
                          </div>
                          <div className="text-sm font-semibold text-[#1f3d38]">{supplier.fit}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-md border border-[#d8d1c4] bg-[#f8f5ee] p-4">
                      <div className="mb-3 text-sm font-semibold text-[#26312f]">Approval route</div>
                      <div className="space-y-3">
                        {['Budget owner', 'Procurement', 'Legal'].map((step, index) => (
                          <div key={step} className="flex items-center gap-3">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold ${
                                index === 0 ? 'bg-[#1f3d38] text-white' : 'bg-white text-[#6b746f]'
                              }`}
                            >
                              {index === 0 ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-[#26312f]">{step}</div>
                              <div className="text-xs text-[#6b746f]">
                                {index === 0 ? 'Ready to approve' : 'Context attached'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="bg-[#fcfbf7] py-14">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
              <div>
                <div className="text-xs font-semibold uppercase text-[#6b746f]">
                  What changes
                </div>
                <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#1e2528]">
                  The workbench replaces the follow-up chain.
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {proofPoints.map((point) => {
                  const Icon = point.icon
                  return (
                    <div key={point.title} className="border-l border-[#cfc7b8] pl-5">
                      <Icon className="h-5 w-5 text-[#1f3d38]" />
                      <h3 className="mt-4 text-base font-semibold text-[#26312f]">{point.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#5a6662]">{point.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#1e2528] py-14 text-white">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
              <div>
                <div className="text-xs font-semibold uppercase text-[#aeb8b2]">
                  Lifecycle control
                </div>
                <h2 className="mt-3 text-3xl font-semibold leading-tight">
                  One record from request through settlement.
                </h2>
                <p className="mt-4 text-sm leading-6 text-[#cbd3cd]">
                  Every external worker decision keeps the reason, evidence, rate, supplier, and approver connected.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {lifecycle.map((item, index) => (
                  <div key={item} className="rounded-md border border-white/12 bg-white/[0.06] p-3">
                    <div className="mb-8 text-xs font-semibold text-[#89d3bd]">0{index + 1}</div>
                    <div className="text-sm font-medium leading-snug text-white">{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f4f1ea] py-14" id="demo">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="text-xs font-semibold uppercase text-[#6b746f]">
                Why teams switch
              </div>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#1e2528]">
                Less chasing. More governed throughput.
              </h2>
            </div>
            <div className="grid gap-3">
              {[
                ['Procurement', 'Receives complete work packages instead of open-ended manager notes.'],
                ['Finance', 'Sees rate variance, budget ownership, and settlement exposure before approval.'],
                ['HR and Legal', 'Get classification and compliance prompts before a worker is engaged.'],
              ].map(([team, desc]) => (
                <div key={team} className="grid gap-3 border-t border-[#cfc7b8] py-4 sm:grid-cols-[140px_1fr]">
                  <div className="font-semibold text-[#1f3d38]">{team}</div>
                  <div className="text-sm leading-6 text-[#52605c]">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#d8d1c4] bg-[#fcfbf7] py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#1e2528]">
                Bring the first governed request into view.
              </h2>
              <p className="mt-2 text-sm text-[#5a6662]">
                See how Levv turns one messy contractor ask into an approved, auditable work order.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDemoOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1f3d38] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#162d29]"
            >
              Request demo
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {demoOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#1e2528]/55 px-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-lg bg-[#fcfbf7] p-7 shadow-2xl">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-semibold text-[#1e2528]">Request a demo</h3>
                  <p className="mt-2 text-sm text-[#5a6662]">Share your details and we will reach out directly.</p>
                </div>
                <div className="hidden rounded-md border border-[#d8d1c4] bg-white p-3 text-[#1f3d38] sm:block">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
              </div>

              <form
                className="mt-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setSending(true)
                  setSendError('')
                  try {
                    const res = await fetch('/api/demo-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ firstName, company, workEmail }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) {
                      throw new Error(data.error || data.detail || 'Failed to send')
                    }
                    setDemoOpen(false)
                    setFirstName('')
                    setCompany('')
                    setWorkEmail('')
                  } catch (err) {
                    console.error(err)
                    setSendError(err instanceof Error ? err.message : 'Could not send demo request.')
                  } finally {
                    setSending(false)
                  }
                }}
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#4d5451]">
                    First name
                    <RequiredIndicator />
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-3 text-sm text-[#1e2528] shadow-sm outline-none transition placeholder:text-[#8b918e] focus:border-[#1f3d38]"
                    placeholder="First name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#4d5451]">
                    Company
                    <RequiredIndicator />
                  </label>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-3 text-sm text-[#1e2528] shadow-sm outline-none transition placeholder:text-[#8b918e] focus:border-[#1f3d38]"
                    placeholder="Company"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#4d5451]">
                    Work email
                    <RequiredIndicator />
                  </label>
                  <input
                    type="email"
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    className="w-full rounded-md border border-[#cfc7b8] bg-white px-3 py-3 text-sm text-[#1e2528] shadow-sm outline-none transition placeholder:text-[#8b918e] focus:border-[#1f3d38]"
                    placeholder="Work email"
                    required
                  />
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex flex-1 items-center justify-center rounded-md bg-[#1f3d38] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#162d29] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sending ? 'Sending...' : 'Submit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoOpen(false)}
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-[#cfc7b8] bg-white px-4 py-3 text-sm font-semibold text-[#52605c] transition hover:bg-[#f4f1ea]"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-[#6b746f]">No spam. Direct response.</p>
                {sendError && <p className="text-xs text-rose-700">{sendError}</p>}
              </form>
            </div>
          </div>
        )}

        <footer className="bg-[#1e2528] py-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-[#cbd3cd] sm:px-8">
            <span>(c) 2026 Levv AI. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="/security" className="hover:text-white">Security</Link>
              <Link href="#" className="hover:text-white">Privacy</Link>
              <Link href="#" className="hover:text-white">Contact</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
