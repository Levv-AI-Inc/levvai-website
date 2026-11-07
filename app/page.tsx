'use client'

/*
  Landing page. Kind: software (site-kind software). Built with the taste skill's rules in the project's own stack.
  Deal: hero split (product window on a lit sky ground, one result card) · nav centre (mega re-dealt: four anchors,
  no sub-pages) · footer columns · close word (the name set across the column) · rhythm dark band (Nova) ·
  buttons tonal · moment line-carries-colour on the dark band · palette and type: the Levv brand (navy, Levv blue,
  sky; Archivo wide display after the wordmark, Inter text).
*/

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleDashed,
  Clock3,
  Lock,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { FormEvent, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

const CONTACT = 'mailto:hello@levv.ai'

const NAV = [
  ['Worker record', '#record'],
  ['Controls', '#controls'],
  ['Nova', '#nova'],
  ['Integrations', '#integrations'],
] as const

const lifecycleStages = [
  {
    label: 'Requisition',
    title: 'Start with a governed request, not an email thread.',
    description:
      'Structured intake checks role type, location, budget, and classification before the request enters an approval queue.',
    tags: ['Role type check', 'Budget guardrails', 'Automatic routing'],
  },
  {
    label: 'Approval',
    title: 'Route every decision with the right context attached.',
    description:
      'Policy-aware approval chains send requests to the correct business, finance, and procurement owners with a complete audit history.',
    tags: ['Dynamic approvers', 'SLA escalation', 'Decision history'],
  },
  {
    label: 'Onboarding',
    title: 'Turn an approved work order into a ready worker.',
    description:
      'Levv matches the worker to the correct onboarding policy, coordinates stakeholders, and gates access until every hard requirement clears.',
    tags: ['Identity checks', 'Supplier tasks', 'System access'],
  },
  {
    label: 'In engagement',
    title: 'Keep time, tenure, and cost on one operating record.',
    description:
      'Monitor timesheets, extensions, worker tenure, and compliance events without rebuilding the story across spreadsheets and inboxes.',
    tags: ['Time capture', 'Tenure alerts', 'Cost visibility'],
  },
  {
    label: 'Offboarding',
    title: 'Close access and obligations when the work ends.',
    description:
      'End dates trigger the right deprovisioning, asset, finance, and supplier actions with completion evidence retained on the worker record.',
    tags: ['Access removal', 'Asset recovery', 'Audit evidence'],
  },
]

const requisitions = [
  { id: 'REQ-0091', role: 'Senior DevOps Engineer', status: 'Pending approval', tone: 'amber', stage: 1 },
  { id: 'REQ-0090', role: 'UX Research Lead', status: 'Approved', tone: 'emerald', stage: 2 },
  { id: 'REQ-0089', role: 'ERP Integration Consultant', status: 'In onboarding', tone: 'blue', stage: 2 },
  { id: 'REQ-0088', role: 'Data Privacy Counsel', status: 'Classification review', tone: 'rose', stage: 0 },
] as const

const novaTrace = [
  ['req:8821 received', 'classification:check running'],
  ['policy:IR35 matched', 'routing to VP Engineering'],
  ['approval:granted', 'onboarding tasks dispatched'],
  ['tenure:monitor set', 'alert at day 180 / limit day 270'],
]

const novaCapabilities = [
  ['Autonomous routing', 'Reads each request, applies your policy, and routes it to the right approval chain.'],
  ['Classification enforcement', 'Evaluates worker type and jurisdiction rules before an engagement can proceed.'],
  ['Offboarding trigger', 'Tracks end dates and initiates deprovisioning at the moment your policy requires.'],
  ['Tenure monitoring', 'Surfaces thresholds early and routes extension decisions to accountable owners.'],
]

const questions = [
  [
    'Does Nova approve requests?',
    'No. Nova reads the request, applies your policy and routes it. A person approves, and never the person who raised the request.',
  ],
  [
    'Which systems does Levv connect to?',
    'Workday HCM for the worker record and onboarding tasks, DocuSign for agreements and attestations, and Microsoft Teams and Slack for approvals and notifications.',
  ],
  [
    'Do we have to replace the tools we use today?',
    'No. Levv comes with guided onboarding and works beside the systems you keep. There is no rip-and-replace.',
  ],
  [
    'Who works in Levv?',
    'Procurement, HR, finance, hiring managers, suppliers and workers, each with their own view of the same worker record.',
  ],
  [
    'Can we change how approvals are routed?',
    'Yes. Admins design each workflow in Flow Studio: who approves, in what order, and what happens when nobody eligible is available.',
  ],
]

const TONE_DOT = { amber: 'bg-amber-500', emerald: 'bg-emerald-500', blue: 'bg-blue-600', rose: 'bg-rose-500' } as const

/* =========================
   Shared pieces
========================= */
const WRAP = 'wrap mx-auto w-full max-w-[1264px] px-5 sm:px-8'
const DISPLAY_FACE = 'font-display font-medium tracking-[-0.032em]'
const DISPLAY = `${DISPLAY_FACE} [font-stretch:112%]`
const BUTTON =
  'levv-press inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-medium outline-none hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2'
const MAIN_BUTTON = `${BUTTON} bg-blue-600 text-white hover:bg-blue-700`
const TONAL_BUTTON = `${BUTTON} bg-blue-50 text-blue-700 hover:bg-blue-100`
const UNDERLINE =
  'bg-gradient-to-r from-current to-current bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size,color] duration-200 ease-out hover:bg-[length:100%_1px]'

function MainAction({ developerMode, onRequest, className = '' }: { developerMode: boolean; onRequest: () => void; className?: string }) {
  if (developerMode) {
    return (
      <button type="button" onClick={onRequest} className={`${MAIN_BUTTON} ${className}`}>
        Request early access
      </button>
    )
  }
  return (
    <a href={CONTACT} className={`${MAIN_BUTTON} ${className}`}>
      Contact Levv
    </a>
  )
}

function Mark({ size = 32 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-[var(--line)]" style={{ width: size, height: size }}>
      <Image src="/logos/levvai-mark.png" alt="" width={700} height={780} className="h-[68%] w-auto object-contain" priority />
    </span>
  )
}

function StatusDot({ tone }: { tone: keyof typeof TONE_DOT }) {
  return <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
}

function Track({ at, size = 'sm' }: { at: number; size?: 'sm' | 'md' }) {
  return (
    <span aria-hidden className="flex items-center gap-[3px]">
      {lifecycleStages.map((stage, index) => (
        <span
          key={stage.label}
          className={`rounded-full transition-[width,background-color] duration-300 ease-out ${size === 'md' ? 'h-2' : 'h-1.5'} ${
            index === at ? `${size === 'md' ? 'w-7' : 'w-4'} bg-blue-600` : index < at ? `${size === 'md' ? 'w-4' : 'w-2.5'} bg-slate-400` : `${size === 'md' ? 'w-4' : 'w-2.5'} bg-slate-200`
          }`}
        />
      ))}
    </span>
  )
}

/** The product's own window, drawn in live HTML. */
function AppWindow({ path, children, className = '' }: { path: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[0_24px_60px_-28px_rgb(10_17_40/0.35),0_2px_6px_rgb(10_17_40/0.05)] ${className}`}>
      <div className="flex h-10 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-sunken)] px-4">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </span>
        <span className="truncate text-xs text-slate-600">{path}</span>
      </div>
      {children}
    </div>
  )
}

/* =========================
   Hero visual: a request on its way to approval
========================= */
function HeroVisual() {
  return (
    <div className="relative h-full min-h-[300px] overflow-hidden rounded-2xl bg-[#e9f1fd] lg:min-h-0">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_80%_at_85%_0%,#ffffff_0%,rgb(255_255_255/0)_60%)]" />
      <div className="absolute -bottom-12 left-6 top-6 w-[calc(100%-1.5rem+28px)] sm:left-12 sm:top-12 sm:w-[calc(100%-3rem+28px)] lg:left-16 lg:top-16 lg:w-[calc(100%-4rem+28px)]">
        <AppWindow path="acme.levvai.com / requests / REQ-0091" className="h-full">
          <div className="grid sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
            <ul className="hidden border-r border-[var(--line)] py-2 sm:block" aria-label="Requests">
              {requisitions.map((req, index) => (
                <li key={req.id} className={`px-4 py-2.5 ${index === 0 ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-2 text-[11px] tabular-nums text-slate-600">
                    <StatusDot tone={req.tone} />
                    {req.id}
                  </div>
                  <div className={`mt-0.5 truncate text-[13px] ${index === 0 ? 'font-semibold text-slate-950' : 'font-medium text-slate-700'}`}>{req.role}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-4 p-5 pr-10 sm:pr-12">
              <div>
                <div className="text-[11px] tabular-nums text-slate-500">REQ-0091</div>
                <div className="mt-0.5 text-[15px] font-semibold text-slate-950">Senior DevOps Engineer</div>
                <div className="mt-2 flex items-center gap-2.5 text-xs text-slate-600">
                  <Track at={1} />
                  Approval
                </div>
              </div>
              <dl className="space-y-2 border-t border-[var(--line)] pt-3 text-xs">
                {[
                  ['Classification', 'IR35 policy matched'],
                  ['Approver', 'Sarah Chen, VP Engineering'],
                  ['Due', 'Today 17:00'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="truncate text-right font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                <Clock3 className="h-3.5 w-3.5" /> Awaiting decision
              </div>
              <div className="hidden border-t border-[var(--line)] pt-3 sm:block">
                <div className="text-xs font-medium text-slate-500">Approval chain</div>
                <ol className="mt-2 space-y-2 text-xs">
                  {[
                    ['Cost centre owner', 'Approved', 'done'],
                    ['VP Engineering', 'Deciding', 'now'],
                    ['Procurement', 'Next', 'next'],
                  ].map(([who, state, at]) => (
                    <li key={who} className="flex items-center gap-2">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${at === 'done' ? 'bg-slate-900 text-white' : at === 'now' ? 'bg-blue-600 ring-4 ring-blue-100' : 'border border-[var(--line-strong)]'}`}>
                        {at === 'done' ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                      </span>
                      <span className="font-medium text-slate-900">{who}</span>
                      <span className="ml-auto text-slate-500">{state}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="hidden border-t border-[var(--line)] pt-3 sm:block">
                <div className="text-xs font-medium text-slate-500">Onboarding, after approval</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['Right to work', 'Laptop and VPN', 'Workday account'].map((task) => (
                    <span key={task} className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                      <Lock className="h-3 w-3" /> {task}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </AppWindow>
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded-xl sm:bottom-8 sm:left-8 sm:right-auto sm:w-[min(300px,calc(100%-4rem))] border border-[var(--line)] bg-white p-4 sm:bottom-8 sm:left-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 motion-safe:delay-500 motion-safe:fill-mode-both">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-950">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--rail)] text-[var(--nova)]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          Nova routed REQ-0091
          <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
        </div>
        <p className="mt-2 text-[13px] leading-snug text-slate-600">IR35 policy matched. Sent to Sarah Chen, VP Engineering, with the budget and supplier attached.</p>
      </div>
    </div>
  )
}

/* =========================
   The worker record, stage by stage
========================= */
function RecordFrame() {
  const [active, setActive] = useState(1)
  const stage = lifecycleStages[active]

  return (
    <AppWindow path="acme.levvai.com / workers / record">
      <div role="tablist" aria-label="Lifecycle stage" className="flex flex-wrap border-b border-[var(--line)] px-2 sm:flex-nowrap">
        {lifecycleStages.map((item, index) => {
          const selected = index === active
          return (
            <button
              key={item.label}
              type="button"
              role="tab"
              id={`stage-tab-${index}`}
              aria-selected={selected}
              aria-controls="stage-panel"
              onClick={() => setActive(index)}
              className={`relative flex h-11 shrink-0 items-center gap-2 px-2.5 text-[13px] font-medium transition-colors duration-150 sm:h-12 sm:px-4 sm:text-sm ${
                selected ? 'text-slate-950' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums ${index < active ? 'bg-slate-900 text-white' : selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {index < active ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
              </span>
              {item.label}
              <span aria-hidden className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-colors duration-200 ${selected ? 'bg-blue-600' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>
      <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
        <ul className="hidden border-r border-[var(--line)] py-2 md:block" aria-label="Requests">
          {requisitions.map((req, index) => (
            <li key={req.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${index === 0 ? 'bg-[var(--surface-sunken)]' : ''}`}>
              <div className="min-w-0">
                <div className="text-[11px] tabular-nums text-slate-500">{req.id}</div>
                <div className="truncate text-[13px] font-medium text-slate-900">{req.role}</div>
              </div>
              <StatusDot tone={req.tone} />
            </li>
          ))}
        </ul>
        <div id="stage-panel" role="tabpanel" aria-labelledby={`stage-tab-${active}`} className="min-h-[300px] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] text-slate-500">REQ-0091 · Senior DevOps Engineer</div>
            <div className="flex items-center gap-2.5 text-[13px] text-slate-600">
              <Track at={active} size="md" />
              Stage {active + 1} of 5
            </div>
          </div>
          <h3 key={`t-${active}`} className="mt-6 max-w-xl text-xl font-semibold leading-snug text-slate-950 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            {stage.title}
          </h3>
          <p key={`d-${active}`} className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-600 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            {stage.description}
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-3">
            {stage.tags.map((tag, index) => (
              <li
                key={`${active}-${tag}`}
                style={{ animationDelay: `${index * 60}ms` }}
                className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2.5 text-[13px] font-medium text-slate-800 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-both"
              >
                <Check className="h-4 w-4 text-emerald-600" />
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppWindow>
  )
}

/* =========================
   Control fragments
========================= */
function Fragment({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-[var(--line)] bg-white p-4 text-[13px]">{children}</div>
}

function ClassificationFragment() {
  return (
    <Fragment>
      {[
        ['Worker type', 'Contractor'],
        ['Jurisdiction', 'United Kingdom'],
        ['IR35', 'Policy matched'],
      ].map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2 first:pt-0 last:border-0 last:pb-0">
          <span className="text-slate-500">{label}</span>
          <span className="flex items-center gap-1.5 font-medium text-slate-900">
            <Check className="h-3.5 w-3.5 text-emerald-600" /> {value}
          </span>
        </div>
      ))}
    </Fragment>
  )
}

function TenureFragment() {
  return (
    <Fragment>
      <div className="flex items-baseline justify-between">
        <span className="text-slate-500">Tenure</span>
        <span className="font-medium tabular-nums text-slate-900">Day 180 of 270</span>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-slate-100">
        <div className="h-2 w-2/3 rounded-full bg-blue-600" />
        <span aria-hidden className="absolute -top-1 left-2/3 h-4 w-px bg-amber-500" />
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-800">
        <Clock3 className="h-3.5 w-3.5" /> Extension decision routed to the cost centre owner
      </div>
    </Fragment>
  )
}

function AccessFragment() {
  return (
    <Fragment>
      {[
        ['Right to work', 'Verified', true],
        ['Laptop and VPN', 'Waiting on right to work', false],
        ['Workday account', 'Waiting on right to work', false],
      ].map(([label, value, ready]) => (
        <div key={label as string} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2 first:pt-0 last:border-0 last:pb-0">
          <span className="font-medium text-slate-900">{label}</span>
          <span className={`flex items-center gap-1.5 text-xs ${ready ? 'text-emerald-700' : 'text-slate-500'}`}>
            {ready ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} {value}
          </span>
        </div>
      ))}
    </Fragment>
  )
}

function ApprovalFragment() {
  return (
    <Fragment>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-900">Sarah Chen, VP Engineering</span>
        <span className="text-xs tabular-nums text-slate-500">Due today 17:00</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['Policy', 'Rate card', 'Supplier', 'Worker', 'Budget'].map((chip) => (
          <span key={chip} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {chip}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <span className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">Approve</span>
        <span className="rounded-md border border-[var(--line-strong)] px-2.5 py-1 text-xs font-medium text-slate-700">Ask a question</span>
      </div>
    </Fragment>
  )
}

const controls = [
  {
    title: 'Checks classification before work starts',
    copy: 'Worker type and jurisdiction checks happen before a request becomes operational exposure.',
    fragment: <ClassificationFragment />,
  },
  {
    title: 'Tracks tenure across assignments',
    copy: 'Tenure and ownership remain visible across assignments, suppliers, and extensions.',
    fragment: <TenureFragment />,
  },
  {
    title: 'Gates access on onboarding readiness',
    copy: 'System access is gated by onboarding readiness and unwound when work ends.',
    fragment: <AccessFragment />,
  },
  {
    title: 'Sends each approval with its context',
    copy: 'Every decision carries policy, commercial, worker, and supplier context with it.',
    fragment: <ApprovalFragment />,
  },
]

/* =========================
   Integrations: one record in the middle, the systems around it
========================= */
function IntegrationsDiagram() {
  const lanes = [
    { name: 'Workday HCM', job: 'Worker record and onboarding tasks', icons: [] as string[] },
    { name: 'DocuSign', job: 'Agreements and attestations', icons: [] as string[] },
    { name: 'Microsoft Teams and Slack', job: 'Approvals and notifications', icons: ['/integrations/teams.svg', '/integrations/slack.svg'] },
  ]
  return (
    <div className="group grid items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-sunken)] p-6 sm:p-10 lg:grid-cols-[minmax(0,0.75fr)_7rem_minmax(0,1fr)] lg:gap-0 lg:p-14">
      <div className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-white p-6">
        <Mark size={48} />
        <div>
          <div className="text-[17px] font-semibold text-slate-950">Levv worker record</div>
          <div className="mt-0.5 text-[13px] text-slate-500">Requests, approvals, timesheets</div>
        </div>
      </div>
      <div aria-hidden className="relative hidden self-stretch lg:block">
        <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
          {[16.7, 50, 83.3].map((y, index) => (
            <g key={y}>
              <path d={`M 0 50 C 55 50, 45 ${y}, 100 ${y}`} fill="none" stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.25 }} />
              <path
                d={`M 0 50 C 55 50, 45 ${y}, 100 ${y}`}
                fill="none"
                stroke="var(--accent)"
                vectorEffect="non-scaling-stroke"
                pathLength={100}
                className="levv-pulse"
                style={{ strokeWidth: 2, animationDelay: `${index * 0.45}s` } as CSSProperties}
              />
            </g>
          ))}
        </svg>
      </div>
      <ul className="space-y-3">
        {lanes.map((lane) => (
          <li key={lane.name} className="flex min-h-[88px] items-center gap-4 rounded-xl border border-[var(--line)] bg-white px-6 py-5">
            {lane.icons.length ? (
              <span className="flex shrink-0 items-center gap-1.5">
                {lane.icons.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                ))}
              </span>
            ) : null}
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-slate-950">{lane.name}</div>
              <div className="text-[13px] text-slate-500">{lane.job}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* =========================
   Page
========================= */
export default function LandingPage() {
  const [accessOpen, setAccessOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [developerMode, setDeveloperMode] = useState(false)
  const novaRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setDeveloperMode(window.localStorage.getItem('developer') === 'true')
  }, [])

  // The dealt moment, mounted by the taste kit's own loader (public/assets/moments).
  useEffect(() => {
    const host = novaRef.current
    if (!host) return
    let cancelled = false
    let unmount: ((root?: Document) => void) | undefined
    ;(window as unknown as { __momentsManual?: boolean }).__momentsManual = true
    import(/* webpackIgnore: true */ '/assets/moments/moments.js' as string)
      .then((moments: { mount: (el: Element) => Promise<unknown>; unmountAll: (root?: Document) => void }) => {
        if (cancelled) return
        unmount = moments.unmountAll
        return moments.mount(host)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      unmount?.(document)
    }
  }, [])

  return (
    <>
      <a href="#top" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-pop">
        Skip to content
      </a>

      <header className="nav sticky top-0 z-40 border-b border-[var(--line)] bg-white text-slate-950">
        <div className={`${WRAP} flex h-16 items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]`}>
          <Link href="/" className="flex items-center gap-3 justify-self-start rounded-lg" aria-label="Levv home">
            <Mark />
            <Image src="/logos/levvai-wordmark.png" alt="LEVVAI" width={1250} height={250} className="h-[0.8rem] w-auto" priority />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className={`${UNDERLINE} inline-flex min-h-[44px] items-center hover:text-slate-950 sm:min-h-0`}>
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 justify-self-end">
            {developerMode ? (
              <Link href="/auth/login" className={`hidden text-sm font-medium text-slate-700 hover:text-slate-950 md:inline ${UNDERLINE}`}>
                Sign in
              </Link>
            ) : null}
            <MainAction developerMode={developerMode} onRequest={() => setAccessOpen(true)} className="hidden h-9 px-4 text-sm md:inline-flex" />
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileOpen((current) => !current)}
              className="levv-press flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] text-slate-700 md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col bg-white px-5 pb-8 pt-4 md:hidden">
            <nav aria-label="Mobile" className="grid gap-1">
              {NAV.map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMobileOpen(false)} className={`${DISPLAY} flex h-14 items-center border-b border-[var(--line)] text-2xl`}>
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-auto grid gap-3">
              {developerMode ? (
                <Link href="/auth/login" className={`${TONAL_BUTTON} w-full`}>
                  Sign in
                </Link>
              ) : null}
              <MainAction developerMode={developerMode} onRequest={() => { setMobileOpen(false); setAccessOpen(true) }} className="w-full" />
            </div>
          </div>
        ) : null}
      </header>

      <main id="top" className="bg-white text-slate-950">
        {/* Hero: split */}
        <section className="lg:min-h-[100svh]" data-enter>
          <div className={`${WRAP} grid gap-10 py-12 sm:py-16 lg:h-[calc(100svh-4rem)] lg:min-h-[640px] lg:grid-cols-12 lg:items-start lg:gap-6 lg:py-14`}>
            <div className="flex flex-col lg:col-span-6 lg:pr-8 lg:pt-10">
              <h1 className={`${DISPLAY} text-[2.5rem] leading-[1.02] sm:text-5xl lg:text-[3.75rem] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both`}>
                External workforce management for enterprises
              </h1>
              <p className="mt-6 max-w-[42ch] text-[17px] leading-[1.55] text-slate-600 sm:text-xl sm:leading-[1.5] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:delay-100 motion-safe:fill-mode-both">
                Levv keeps every contractor and SOW engagement on one worker record, from requisition to offboarding. Nova applies your policy and routes each approval to its owner.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:delay-200 motion-safe:fill-mode-both">
                <MainAction developerMode={developerMode} onRequest={() => setAccessOpen(true)} />
                <a href="#record" className={TONAL_BUTTON}>
                  See how it works
                </a>
              </div>
              <p className="mt-6 text-[13px] text-slate-500 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 motion-safe:delay-300 motion-safe:fill-mode-both">
                Built by practitioners from complex extended-workforce programs.
              </p>
            </div>
            <div className="h-[500px] sm:h-[520px] lg:col-span-6 lg:col-start-7 lg:h-full motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-1000 motion-safe:delay-150 motion-safe:fill-mode-both">
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* The product big: the worker record */}
        <section id="record" className="border-t border-[var(--line)] bg-[var(--surface-sunken)] py-20 sm:py-28 lg:min-h-[100svh]">
          <div className={WRAP}>
            <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
              <h2 className={`${DISPLAY} text-4xl leading-[1.05] sm:text-5xl lg:col-span-6`}>Five stages. One record.</h2>
              <p className="max-w-[46ch] text-[17px] leading-relaxed text-slate-600 lg:col-span-5 lg:col-start-7 lg:pt-2">
                Policy checks, approvals, onboarding tasks, time and exit steps stay on the same record, so nobody rebuilds the story from inboxes.
              </p>
            </div>
            <div className="mt-10 sm:mt-14">
              <RecordFrame />
            </div>
          </div>
        </section>

        {/* Controls: 2x2 */}
        <section id="controls" className="py-20 sm:py-28 lg:min-h-[100svh]">
          <div className={WRAP}>
            <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
              <h2 className={`${DISPLAY} text-4xl leading-[1.05] sm:text-5xl lg:col-span-6`}>Classification, <span className="whitespace-nowrap">co-employment</span>, and access.</h2>
              <p className="max-w-[46ch] text-[17px] leading-relaxed text-slate-600 lg:col-span-5 lg:col-start-7 lg:pt-2">
                Levv checks the four risks of external work on the record itself, as each request moves.
              </p>
            </div>
            <div className="mt-10 grid gap-x-10 gap-y-12 sm:mt-14 md:grid-cols-2">
              {controls.map((control) => (
                <article key={control.title} className="flex flex-col gap-5">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{control.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{control.copy}</p>
                  </div>
                  <div className="mt-auto">{control.fragment}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Nova: the dark band, with the dealt moment */}
        <section
          id="nova"
          ref={novaRef}
          data-moment="line-carries-colour"
          data-moment-opts='{"from":"base"}'
          className="relative bg-[var(--rail)] py-20 text-white [--accent:var(--nova)] [--bg:#ffffff] [--r-lg:16px] sm:py-28"
        >
          <div className={`${WRAP} grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-6`}>
            <div className="lg:col-span-5">
              <h2 className={`${DISPLAY} text-4xl leading-[1.05] sm:text-5xl`}>Nova routes every request to the person who decides</h2>
              <p className="mt-6 max-w-[44ch] text-[17px] leading-relaxed text-slate-300">
                Nova is the decision engine in Levv’s workflow layer. It reads policy, applies rules and closes operational loops while people keep the decision.
              </p>
              <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-slate-400">
                Nova never approves or rejects. A person does, and never the one who raised the request.
              </p>
              <dl className="mt-10 grid gap-5 sm:grid-cols-2">
                {novaCapabilities.map(([title, copy]) => (
                  <div key={title}>
                    <dt className="text-[15px] font-semibold text-white">{title}</dt>
                    <dd className="mt-1 text-[13px] leading-relaxed text-slate-400">{copy}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5 text-[13px] text-slate-300">
                  <Sparkles className="h-4 w-4 text-[var(--nova)]" />
                  Nova, live trace for REQ-0091
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Running
                  </span>
                </div>
                <ol className="space-y-px p-2 font-mono text-[13px]">
                  {novaTrace.map(([event, outcome], index) => (
                    <li key={event} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 rounded-lg px-3 py-3 hover:bg-white/[0.04]">
                      <span className="pt-0.5 text-[var(--nova)]">{index < novaTrace.length - 1 ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}</span>
                      <span>
                        <span className="block text-white">{event}</span>
                        <span className="block text-slate-400">{outcome}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4 text-[13px] text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-[var(--nova)]" />
                  Decision waiting with Sarah Chen, VP Engineering
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations: hub diagram */}
        <section id="integrations" className="py-20 sm:py-28 lg:min-h-[100svh]">
          <div className={WRAP}>
            <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
              <h2 className={`${DISPLAY} text-4xl leading-[1.05] sm:text-5xl lg:col-span-6`}>Works with Workday, DocuSign, Teams and Slack</h2>
              <p className="max-w-[46ch] text-[17px] leading-relaxed text-slate-600 lg:col-span-5 lg:col-start-7 lg:pt-2">
                An operational record for procurement, HR, finance, suppliers, and workers, connected to the systems they already use.
              </p>
            </div>
            <div className="mt-10 sm:mt-14">
              <IntegrationsDiagram />
            </div>
          </div>
        </section>

        {/* Questions */}
        <section id="questions" className="bg-[var(--surface-sunken)] py-20 sm:py-28">
          <div className={`${WRAP} grid gap-10 lg:grid-cols-12 lg:gap-6`}>
            <h2 className={`${DISPLAY} text-4xl leading-[1.05] sm:text-5xl lg:col-span-5`}>Questions about Levv</h2>
            <div className="divide-y divide-[var(--line)] border-y border-[var(--line)] lg:col-span-6 lg:col-start-7">
              {questions.map(([question, answer]) => (
                <details key={question} className="group">
                  <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-6 py-4 text-[17px] font-medium text-slate-950 [&::-webkit-details-marker]:hidden">
                    {question}
                    <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ease-out group-open:rotate-180" />
                  </summary>
                  <p className="max-w-[62ch] pb-6 text-[15px] leading-relaxed text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="closing bg-white text-slate-950">
        {/* Close: the line, the button, then the name set across the column */}
        <div className={`${WRAP} pt-20 sm:pt-28`}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className={`${DISPLAY} max-w-[16ch] text-4xl leading-[1.05] sm:text-5xl`}>The operating system for external work.</h2>
              <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed text-slate-600">
                Replace spreadsheets and manual approval threads with one governed system, one audit trail, and one current worker record.
              </p>
            </div>
            <MainAction developerMode={developerMode} onRequest={() => setAccessOpen(true)} className="h-12 px-6 text-base sm:self-start lg:self-end" />
          </div>
          <div aria-hidden className={`${DISPLAY} mt-16 select-none whitespace-nowrap text-center text-[19.5vw] leading-[0.8] tracking-[0.06em] text-[var(--rail)] [font-stretch:125%] xl:text-[15.4rem]`}>
            LEVVAI
          </div>
        </div>

        <div className="bg-[var(--surface-sunken)]">
          <div className={`${WRAP} grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12`}>
            <div className="lg:col-span-5">
              <div className="flex items-center gap-3">
                <Mark />
                <Image src="/logos/levvai-wordmark.png" alt="LEVVAI" width={1250} height={250} className="h-[0.8rem] w-auto" />
              </div>
              <p className="mt-4 text-sm text-slate-500">External workforce infrastructure.</p>
            </div>
            <nav aria-label="Product" className="lg:col-span-3 lg:col-start-7">
              <h3 className="text-sm font-semibold text-slate-950">Product</h3>
              <ul className="mt-3 text-sm text-slate-600 sm:space-y-2">
                {[...NAV, ['Questions', '#questions'] as const].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className={`${UNDERLINE} inline-flex min-h-[44px] items-center hover:text-slate-950 sm:min-h-0`}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Company" className="lg:col-span-3 lg:col-start-10">
              <h3 className="text-sm font-semibold text-slate-950">Company</h3>
              <ul className="mt-3 text-sm text-slate-600 sm:space-y-2">
                <li>
                  <Link href="/security" className={`${UNDERLINE} inline-flex min-h-[44px] items-center hover:text-slate-950 sm:min-h-0`}>
                    Security
                  </Link>
                </li>
                <li>
                  <a href={CONTACT} className={`${UNDERLINE} inline-flex min-h-[44px] items-center hover:text-slate-950 sm:min-h-0`}>
                    Contact
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          <div className={`${WRAP} flex flex-col gap-2 pb-8 text-xs text-slate-500 sm:flex-row sm:justify-between`}>
            <span>© 2026 Levv. External workforce infrastructure.</span>
            <span>Product names and logos are trademarks of their owners.</span>
          </div>
        </div>
      </footer>

      <RequestAccessModal open={accessOpen} onClose={() => setAccessOpen(false)} />
    </>
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

  const field =
    'h-11 w-full rounded-lg border border-[var(--line-strong)] bg-white px-3 text-[15px] text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus)]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
        className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-6 shadow-pop sm:p-8 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200"
      >
        <div className="flex items-start justify-between gap-5">
          <h2 id="access-title" className={`${DISPLAY} text-2xl leading-tight`}>
            See Levv in your workflow.
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close request form"
            className="levv-press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-5 w-5" />
            </span>
            <p className="mt-4 font-semibold text-slate-950">Request received.</p>
            <p className="mt-1.5 text-sm text-slate-500">
              We will follow up directly with next steps.
            </p>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-700">First name</span>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required autoComplete="given-name" className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Company</span>
              <input value={company} onChange={(event) => setCompany(event.target.value)} required autoComplete="organization" className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Work email</span>
              <input type="email" value={workEmail} onChange={(event) => setWorkEmail(event.target.value)} required autoComplete="email" className={field} />
            </label>
            {sendError ? (
              <p role="alert" className="text-sm text-rose-700">
                {sendError}
              </p>
            ) : null}
            <button type="submit" disabled={sending} className={`${MAIN_BUTTON} w-full disabled:cursor-not-allowed disabled:opacity-60`}>
              {sending ? 'Sending request...' : 'Request access'}
              {!sending ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
            <p className="text-center text-xs text-slate-500">Direct response. No mailing list.</p>
          </form>
        )}
      </div>
    </div>
  )
}
