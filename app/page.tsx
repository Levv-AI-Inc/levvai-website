'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  GitBranch,
  Layers3,
  LockKeyhole,
  Menu,
  RefreshCcw,
  Route,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

const lifecycleStages = [
  {
    label: 'Requisition',
    icon: FileText,
    title: 'Start with a governed request, not an email thread.',
    description:
      'Structured intake checks role type, location, budget, and classification before the request enters an approval queue.',
    tags: ['Role type check', 'Budget guardrails', 'Automatic routing'],
    metricA: '< 4h',
    metricALabel: 'Average cycle time',
    metricB: 'Zero',
    metricBLabel: 'Manual handoffs',
  },
  {
    label: 'Approval',
    icon: BadgeCheck,
    title: 'Route every decision with the right context attached.',
    description:
      'Policy-aware approval chains send requests to the correct business, finance, and procurement owners with a complete audit history.',
    tags: ['Dynamic approvers', 'SLA escalation', 'Decision history'],
    metricA: '100%',
    metricALabel: 'Route coverage',
    metricB: '1 record',
    metricBLabel: 'Decision context',
  },
  {
    label: 'Onboarding',
    icon: UserCheck,
    title: 'Turn an approved work order into a ready worker.',
    description:
      'Levv matches the worker to the correct onboarding policy, coordinates stakeholders, and gates access until every hard requirement clears.',
    tags: ['Identity checks', 'Supplier tasks', 'System access'],
    metricA: 'Live',
    metricALabel: 'Readiness status',
    metricB: 'Policy-led',
    metricBLabel: 'Task orchestration',
  },
  {
    label: 'In-engagement',
    icon: Clock3,
    title: 'Keep time, tenure, and cost on one operating record.',
    description:
      'Monitor timesheets, extensions, worker tenure, and compliance events without rebuilding the story across spreadsheets and inboxes.',
    tags: ['Time capture', 'Tenure alerts', 'Cost visibility'],
    metricA: 'Weekly',
    metricALabel: 'Control cadence',
    metricB: 'Always on',
    metricBLabel: 'Policy monitoring',
  },
  {
    label: 'Offboarding',
    icon: RefreshCcw,
    title: 'Close access and obligations when the work ends.',
    description:
      'End dates trigger the right deprovisioning, asset, finance, and supplier actions with completion evidence retained on the worker record.',
    tags: ['Access removal', 'Asset recovery', 'Audit evidence'],
    metricA: 'Day zero',
    metricALabel: 'Exit trigger',
    metricB: 'Tracked',
    metricBLabel: 'Every unwind task',
  },
]

const frictionPoints = [
  {
    icon: ShieldCheck,
    title: 'Classification risk',
    copy: 'Worker type and jurisdiction checks happen before a request becomes operational exposure.',
  },
  {
    icon: Users,
    title: 'Co-employment drift',
    copy: 'Tenure and ownership remain visible across assignments, suppliers, and extensions.',
  },
  {
    icon: LockKeyhole,
    title: 'Access without governance',
    copy: 'System access is gated by onboarding readiness and unwound when work ends.',
  },
  {
    icon: Layers3,
    title: 'Approval without context',
    copy: 'Every decision carries policy, commercial, worker, and supplier context with it.',
  },
]

const novaCapabilities = [
  {
    icon: Route,
    title: 'Autonomous routing',
    copy: 'Reads each request, applies your policy, and routes it to the right approval chain.',
  },
  {
    icon: ShieldCheck,
    title: 'Classification enforcement',
    copy: 'Evaluates worker type and jurisdiction rules before an engagement can proceed.',
  },
  {
    icon: TimerReset,
    title: 'Offboarding trigger',
    copy: 'Tracks end dates and initiates deprovisioning at the moment your policy requires.',
  },
  {
    icon: Sparkles,
    title: 'Tenure monitoring',
    copy: 'Surfaces thresholds early and routes extension decisions to accountable owners.',
  },
]

const requisitions = [
  ['REQ-0091', 'Senior DevOps Engineer', 'Pending approval', 'amber'],
  ['REQ-0090', 'UX Research Lead', 'Approved', 'emerald'],
  ['REQ-0089', 'ERP Integration Consultant', 'In onboarding', 'blue'],
  ['REQ-0088', 'Data Privacy Counsel', 'Classification review', 'rose'],
]

const approvals = [
  ['REQ-0091', 'Sarah Chen, VP Engineering', 'Due today 17:00', 'Awaiting'],
  ['REQ-0087', 'Marcus Webb, CPO', 'Due yesterday', 'Approved'],
  ['REQ-0085', 'Dana Park, CFO', 'Due 3 days ago', 'Approved'],
]

function BrandMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
      <GitBranch className="h-4 w-4" strokeWidth={2.4} />
    </span>
  )
}

function PrimaryButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
    >
      {children}
    </button>
  )
}

function WorkflowNode({
  icon: Icon,
  label,
  status,
  className,
}: {
  icon: typeof FileText
  label: string
  status: string
  className: string
}) {
  return (
    <div
      className={`absolute z-10 w-36 rounded-md border border-blue-200 bg-white p-3 shadow-[0_12px_30px_-18px_rgba(30,64,175,0.45)] sm:w-40 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          <Icon className="h-4 w-4" />
        </span>
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-[10px] font-medium uppercase text-blue-600">
        {status}
      </p>
    </div>
  )
}

function WorkflowVisual() {
  const mobileStages = [
    { icon: FileText, label: 'Requisition', status: 'Request captured' },
    { icon: BadgeCheck, label: 'Approval', status: 'Policy matched' },
    { icon: UserCheck, label: 'Onboarding', status: 'Tasks dispatched' },
    { icon: Clock3, label: 'In-engagement', status: 'Controls active' },
    { icon: RefreshCcw, label: 'Offboarding', status: 'Exit scheduled' },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-[0_28px_80px_-48px_rgba(30,64,175,0.55)]">
      <div className="flex h-10 items-center justify-between border-b border-blue-100 bg-blue-50/70 px-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-300" />
          <span className="h-2 w-2 rounded-full bg-blue-300" />
          <span className="h-2 w-2 rounded-full bg-blue-300" />
          <span className="ml-2 font-mono text-[10px] text-slate-400">
            levv.io / workforce-graph
          </span>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="sm:hidden">Live</span>
          <span className="hidden sm:inline">Nova is routing</span>
        </span>
      </div>

      <div className="grid gap-2 bg-blue-50/30 p-4 sm:hidden">
        {mobileStages.map(({ icon: Icon, label, status }, index) => (
          <div key={label} className="relative flex items-center gap-3">
            {index < mobileStages.length - 1 ? (
              <span className="absolute left-4 top-10 h-4 w-px bg-blue-200" />
            ) : null}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-white text-blue-600">
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex min-h-12 flex-1 items-center justify-between gap-3 rounded-md border border-blue-100 bg-white px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-slate-900">{label}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{status}</p>
              </div>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            </div>
          </div>
        ))}
      </div>

      <div className="relative hidden h-[360px] overflow-hidden bg-blue-50/40 sm:block">
        <div className="absolute left-[12%] top-1/2 h-px w-[31%] -translate-y-1/2 rotate-[-17deg] bg-blue-300" />
        <div className="absolute left-[12%] top-1/2 h-px w-[31%] -translate-y-1/2 rotate-[17deg] bg-blue-300" />
        <div className="absolute left-[42%] top-[31%] h-px w-[23%] bg-blue-400" />
        <div className="absolute left-[42%] top-[68%] h-px w-[23%] bg-blue-400" />
        <div className="absolute left-[64%] top-1/2 h-px w-[24%] -translate-y-1/2 rotate-[17deg] bg-blue-300" />
        <div className="absolute left-[64%] top-1/2 h-px w-[24%] -translate-y-1/2 rotate-[-17deg] bg-blue-300" />

        <div className="absolute left-[4%] top-1/2 z-10 -translate-y-1/2 text-center">
          <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-blue-600 shadow-sm">
            <FileText className="h-4 w-4" />
          </span>
          <span className="mt-2 block text-[10px] font-semibold text-slate-500">
            Requisition
          </span>
        </div>

        <WorkflowNode
          icon={BadgeCheck}
          label="Approval"
          status="Policy matched"
          className="left-[25%] top-[10%]"
        />
        <WorkflowNode
          icon={UserCheck}
          label="Onboarding"
          status="Ready to launch"
          className="left-[25%] bottom-[9%]"
        />
        <WorkflowNode
          icon={ShieldCheck}
          label="Compliance"
          status="Monitoring"
          className="right-[24%] top-[10%]"
        />
        <WorkflowNode
          icon={Clock3}
          label="Timesheets"
          status="Open · W24"
          className="right-[24%] bottom-[9%]"
        />

        <div className="absolute right-[4%] top-1/2 z-10 -translate-y-1/2 text-center">
          <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-700 bg-white text-slate-700 shadow-sm">
            <RefreshCcw className="h-4 w-4" />
          </span>
          <span className="mt-2 block text-[10px] font-semibold text-slate-500">
            Offboarding
          </span>
        </div>
      </div>
    </div>
  )
}

function RequestAccessModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [company, setCompany] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setSendError('')
    try {
      const response = await fetch('/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, company, workEmail }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || payload.detail || 'Unable to send request.')
      }
      setSent(true)
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : 'Unable to send request.',
      )
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
        className="w-full max-w-md rounded-lg border border-blue-100 bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <span className="text-xs font-semibold uppercase text-blue-600">
              Early access
            </span>
            <h2 id="access-title" className="mt-2 text-2xl font-semibold text-slate-950">
              See Levv in your workflow.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close request form"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-6 w-6" />
            </span>
            <p className="mt-4 font-semibold text-slate-950">Request received.</p>
            <p className="mt-2 text-sm text-slate-500">
              We will follow up directly with next steps.
            </p>
          </div>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                First name
              </span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                Company
              </span>
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                required
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                Work email
              </span>
              <input
                type="email"
                value={workEmail}
                onChange={(event) => setWorkEmail(event.target.value)}
                required
                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            {sendError ? (
              <p className="text-sm text-rose-600">{sendError}</p>
            ) : null}
            <button
              type="submit"
              disabled={sending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? 'Sending request...' : 'Request access'}
              {!sending ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
            <p className="text-center text-xs text-slate-400">
              Direct response. No mailing list.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [accessOpen, setAccessOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeStage, setActiveStage] = useState(0)
  const stage = lifecycleStages[activeStage]

  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-950 [&_h1]:tracking-normal [&_h2]:tracking-normal [&_h3]:tracking-normal">
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Levv home">
            <BrandMark />
            <span className="text-base font-semibold text-slate-950">Levv</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#platform" className="transition hover:text-blue-600">
              Platform
            </a>
            <a href="#lifecycle" className="transition hover:text-blue-600">
              Lifecycle
            </a>
            <a href="#nova" className="transition hover:text-blue-600">
              Nova AI
            </a>
            <a href="#integrations" className="transition hover:text-blue-600">
              Integrations
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/auth/login"
              className="inline-flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Sign in
            </Link>
            <PrimaryButton onClick={() => setAccessOpen(true)}>
              Request access
            </PrimaryButton>
          </div>

          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((current) => !current)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-blue-100 bg-white px-5 py-5 md:hidden">
            <nav className="grid gap-1 text-sm font-medium text-slate-700">
              {[
                ['Platform', '#platform'],
                ['Lifecycle', '#lifecycle'],
                ['Nova AI', '#nova'],
                ['Integrations', '#integrations'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-3 hover:bg-blue-50 hover:text-blue-700"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link
                href="/auth/login"
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-slate-700"
              >
                Sign in
              </Link>
              <PrimaryButton onClick={() => setAccessOpen(true)} className="px-3">
                Request access
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section id="platform" className="relative border-b border-blue-100 bg-white">
          <div className="mx-auto max-w-7xl px-5 pb-16 pt-20 text-center sm:px-8 sm:pt-24 lg:pb-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                <Zap className="h-3.5 w-3.5" />
                AI-native external workforce operations
              </span>
              <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-semibold leading-[1.08] text-slate-950 sm:text-5xl lg:text-6xl">
                The operating system for{' '}
                <span className="text-blue-600">external work.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Levv executes requisitions, applies workforce policy, routes every
                approval, and keeps the worker record current from onboarding to exit.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <PrimaryButton onClick={() => setAccessOpen(true)}>
                  Request early access
                  <ArrowRight className="h-4 w-4" />
                </PrimaryButton>
                <a
                  href="#lifecycle"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  See how it works
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-8 text-xs text-slate-400">
                Built by practitioners from complex extended-workforce programs.
              </p>
            </div>

            <div className="mx-auto mt-12 max-w-6xl text-left">
              <WorkflowVisual />
            </div>
          </div>
        </section>

        <section className="bg-blue-50/70 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <p className="text-xs font-semibold uppercase text-blue-600">
              The friction points
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
              Classification, co-employment, and access.
              <span className="block text-slate-500">Resolved on one operating record.</span>
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {frictionPoints.map(({ icon: Icon, title, copy }) => (
                <article
                  key={title}
                  className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-5 text-sm font-semibold text-slate-950">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="lifecycle" className="border-y border-blue-100 bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <p className="text-xs font-semibold uppercase text-blue-600">
              End-to-end lifecycle
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">
              Five stages. One record.
            </h2>

            <div className="mt-10 overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm">
              <div className="grid grid-cols-2 border-b border-blue-100 bg-blue-50/50 sm:grid-cols-5">
                {lifecycleStages.map(({ label, icon: Icon }, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveStage(index)}
                    className={`flex h-16 items-center gap-2 border-b-2 px-4 text-left text-xs font-semibold transition sm:border-b-2 ${
                      activeStage === index
                        ? 'border-blue-600 bg-white text-blue-700'
                        : 'border-transparent text-slate-500 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <span className="text-[10px] text-blue-500">0{index + 1}</span>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              <div
                key={stage.label}
                className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_240px] lg:p-10"
              >
                <div>
                  <h3 className="max-w-2xl text-xl font-semibold text-slate-950 sm:text-2xl">
                    {stage.title}
                  </h3>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                    {stage.description}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {stage.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-4 border-t border-blue-100 pt-6 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  <div>
                    <dt className="text-2xl font-semibold text-blue-600">{stage.metricA}</dt>
                    <dd className="mt-1 text-xs text-slate-500">{stage.metricALabel}</dd>
                  </div>
                  <div>
                    <dt className="text-2xl font-semibold text-blue-600">{stage.metricB}</dt>
                    <dd className="mt-1 text-xs text-slate-500">{stage.metricBLabel}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-blue-200 bg-blue-50/60 px-5 py-3 text-xs text-slate-500">
              <span className="flex items-center gap-2 font-semibold uppercase text-blue-700">
                <ShieldCheck className="h-4 w-4" />
                Governance rail
              </span>
              <span>Worker classification</span>
              <span>Co-employment tenure limits</span>
              <span>Access deprovisioning</span>
              <span>Regulatory audit trail</span>
            </div>
          </div>
        </section>

        <section id="nova" className="border-b border-blue-100 bg-blue-50 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-blue-600">
                  <Zap className="h-4 w-4" />
                  Nova — the AI engine
                </p>
                <h2 className="mt-5 max-w-xl text-3xl font-semibold leading-tight sm:text-5xl">
                  Nova does not show you more data.
                  <span className="block text-blue-600">It closes the loop.</span>
                </h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-slate-600">
                Nova is the decision engine embedded in Levv’s workflow layer. It
                reads policy, applies rules, routes actions, and closes operational
                loops while preserving human accountability.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {novaCapabilities.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
                  <div className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 overflow-hidden rounded-lg border border-blue-200 bg-white p-5 font-mono text-[11px] leading-6 text-blue-700 shadow-sm sm:p-6">
              <p className="text-slate-400">● nova.engine — live trace</p>
              <p>→ req:8821 received — classification:check running</p>
              <p>→ policy:IR35 matched — routing to VP Engineering</p>
              <p>→ approval:granted — onboarding tasks dispatched</p>
              <p>→ tenure:monitor set — alert at day 180 / limit day 270</p>
            </div>
          </div>
        </section>

        <section id="integrations" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <p className="text-xs font-semibold uppercase text-blue-600">System of record</p>
            <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                  One surface. Requisitions, approvals, timesheets.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                  An operational record for procurement, HR, finance, suppliers,
                  and workers — connected to the systems they already use.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Nova active
              </span>
            </div>

            <div className="mt-10 overflow-hidden rounded-lg border border-blue-200 bg-white shadow-[0_24px_70px_-45px_rgba(30,64,175,0.5)]">
              <div className="flex h-11 items-center border-b border-blue-100 bg-blue-50/60 px-4">
                <span className="h-2 w-2 rounded-full bg-blue-300" />
                <span className="ml-2 h-2 w-2 rounded-full bg-blue-300" />
                <span className="ml-2 h-2 w-2 rounded-full bg-blue-300" />
                <span className="ml-3 font-mono text-[10px] text-slate-400">
                  Levv — Workforce Operations
                </span>
              </div>
              <div className="grid lg:grid-cols-[1fr_1fr_1.05fr]">
                <div className="border-b border-blue-100 p-4 lg:border-b-0 lg:border-r">
                  <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase text-blue-700">
                    <FileText className="h-3.5 w-3.5" /> Requisitions
                  </h3>
                  <div className="mt-4 space-y-3">
                    {requisitions.map(([id, role, status, tone]) => (
                      <div key={id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[10px] text-slate-400">{id}</span>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              tone === 'amber'
                                ? 'bg-amber-400'
                                : tone === 'emerald'
                                  ? 'bg-emerald-400'
                                  : tone === 'rose'
                                    ? 'bg-rose-400'
                                    : 'bg-blue-400'
                            }`}
                          />
                        </div>
                        <p className="mt-2 text-xs font-semibold text-slate-900">{role}</p>
                        <p className="mt-2 text-[10px] text-slate-500">{status}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-b border-blue-100 p-4 lg:border-b-0 lg:border-r">
                  <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase text-blue-700">
                    <BadgeCheck className="h-3.5 w-3.5" /> Approval queue
                  </h3>
                  <div className="mt-4 space-y-3">
                    {approvals.map(([id, owner, due, status]) => (
                      <div key={id} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="font-mono text-[10px] text-slate-400">{id}</span>
                            <p className="mt-2 text-xs font-medium text-slate-800">{owner}</p>
                            <p className="mt-1 text-[10px] text-slate-400">{due}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[9px] font-medium ${status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-[10px] leading-5 text-blue-700">
                    Nova escalated REQ-0091 to the backup approver before its SLA breach.
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase text-blue-700">
                    <Clock3 className="h-3.5 w-3.5" /> Timesheets — W24
                  </h3>
                  <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-50 text-slate-400">
                        <tr>
                          <th className="px-3 py-2 font-medium">Worker</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                          <th className="px-3 py-2 font-medium">Hrs</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        <tr><td className="px-3 py-3 font-medium text-slate-800">J. Markov</td><td className="px-3 py-3">Cloud Architect</td><td className="px-3 py-3">38</td><td className="px-3 py-3 text-blue-600">Submitted</td></tr>
                        <tr><td className="px-3 py-3 font-medium text-slate-800">T. Osei</td><td className="px-3 py-3">Data Engineer</td><td className="px-3 py-3">40</td><td className="px-3 py-3 text-emerald-600">Approved</td></tr>
                        <tr><td className="px-3 py-3 font-medium text-slate-800">R. Nakamura</td><td className="px-3 py-3">Security Analyst</td><td className="px-3 py-3">35</td><td className="px-3 py-3 text-amber-600">Pending</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-5 text-[10px] font-medium uppercase text-slate-400">
                    Connected systems
                  </p>
                  <div className="mt-3 grid gap-2">
                    {[
                      ['/logos/workday.svg', 'Workday HCM', 'Worker record and onboarding tasks'],
                      ['/logos/docusign.svg', 'DocuSign', 'Agreements and attestations'],
                      ['/logos/teams.svg', 'Microsoft Teams', 'Approvals and notifications'],
                    ].map(([src, name, detail]) => (
                      <div key={name} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-5 w-5 object-contain" />
                        <div>
                          <p className="text-[10px] font-semibold text-slate-800">{name}</p>
                          <p className="mt-0.5 text-[9px] text-slate-400">{detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-blue-100 bg-blue-50 py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-600">Ready to operate</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                Stop managing your workforce in email.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Replace spreadsheets and manual approval threads with one governed
                system, one audit trail, and one current worker record.
              </p>
            </div>
            <div className="lg:text-right">
              <PrimaryButton onClick={() => setAccessOpen(true)}>
                Request early access
                <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
              <p className="mt-3 text-xs text-slate-400">
                Guided onboarding. No rip-and-replace.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
            <BrandMark />
            Levv
          </div>
          <span>© 2026 Levv. External workforce infrastructure.</span>
          <div className="flex items-center gap-5">
            <Link href="/security" className="transition hover:text-blue-600">Security</Link>
            <a href="#" className="transition hover:text-blue-600">Privacy</a>
            <a href="mailto:hello@levv.ai" className="transition hover:text-blue-600">Contact</a>
          </div>
        </div>
      </footer>

      <RequestAccessModal open={accessOpen} onClose={() => setAccessOpen(false)} />
    </div>
  )
}
