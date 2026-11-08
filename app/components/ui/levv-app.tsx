import Image from 'next/image'
import Link from 'next/link'
import type { ElementType, InputHTMLAttributes, KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react'
import { Check, ChevronDown, FileSpreadsheet, Search, Sparkles } from 'lucide-react'

/* =========================
   Class recipes
   The exposure record: square controls, tracked capitals for every legend and button, Levv Blue as the one
   glowing accent (the primary action, selection and focus), figures tabular.
========================= */
const LEGEND = 'text-[11px] font-semibold uppercase tracking-[0.06em]'

const BUTTON = `levv-press inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 ${LEGEND} text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ground)] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0`

export const levvUi = {
  legend: LEGEND,
  primaryButton: `${BUTTON} bg-blue-600 text-white hover:bg-blue-700`,
  accentButton: `${BUTTON} bg-blue-600 text-white hover:bg-blue-700`,
  secondaryButton: `${BUTTON} border border-slate-950 bg-transparent text-slate-950 hover:bg-slate-100`,
  ghostButton: `${BUTTON} text-slate-700 hover:bg-slate-100 hover:text-slate-950`,
  dangerButton: `${BUTTON} bg-rose-600 text-white shadow-sm hover:bg-rose-700`,
  dangerGhostButton: `${BUTTON} text-rose-700 hover:bg-rose-50 hover:text-rose-800`,
  /** A row's quiet command as an icon (always with an `aria-label` naming the row). */
  iconButton: `${BUTTON} w-9 px-0 text-slate-500 hover:bg-slate-100 hover:text-slate-950`,
  /** A row's destructive command: a rose trash icon (with an `aria-label` naming the row). */
  dangerIconButton: `${BUTTON} w-9 px-0 text-rose-700 hover:bg-rose-50 hover:text-rose-800`,
  textarea:
    'block w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] leading-5 text-slate-950 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-500 hover:border-slate-500 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus)]',
  input:
    'h-9 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-[14px] text-slate-950 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-500 hover:border-slate-500 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus)]',
  /** Tables sit on the paper: no frame, a 2px Rail Navy rule under the heads. */
  tableShell: 'levv-table-shell overflow-hidden',
  th: `border-b-2 border-slate-950 px-3 py-2.5 text-left ${LEGEND} text-slate-500`,
  td: 'px-3 py-3 align-middle text-[14px] text-slate-800',
  label: `${LEGEND} text-slate-500`,
  figure: 'font-semibold tabular-nums',
}

/* =========================
   Request stepper
========================= */
const requestSteps = [
  'Job setup',
  'Screening',
  'Qualifications',
  'Rates & spend',
  'Suppliers',
]

export function LevvRequestStepper({
  currentStep,
  className = '',
}: {
  currentStep: number
  className?: string
}) {
  const safeStep = Math.min(Math.max(currentStep, 1), requestSteps.length)

  return (
    <nav
      aria-label="Job request progress"
      className={`rounded-xl border border-[var(--line)] bg-white px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-4">
        <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
          Step {safeStep} of {requestSteps.length}
        </span>
        <span className="ml-auto text-xs font-medium text-slate-900 sm:hidden">
          {requestSteps[safeStep - 1]}
        </span>
        <ol className="hidden min-w-0 flex-1 items-center sm:flex">
          {requestSteps.map((step, index) => {
            const stepNumber = index + 1
            const complete = stepNumber < safeStep
            const active = stepNumber === safeStep

            return (
              <li
                key={step}
                aria-current={active ? 'step' : undefined}
                className={`flex min-w-0 items-center ${index < requestSteps.length - 1 ? 'flex-1' : ''}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-200 ${
                      complete
                        ? 'bg-slate-900 text-white'
                        : active
                          ? 'bg-blue-600 text-white'
                          : 'border border-[var(--line-strong)] bg-white text-slate-500'
                    }`}
                  >
                    {complete ? <Check className="h-3 w-3" strokeWidth={3} /> : stepNumber}
                  </span>
                  <span
                    className={`hidden truncate text-xs lg:block ${
                      active
                        ? 'font-semibold text-slate-950'
                        : complete
                          ? 'font-medium text-slate-700'
                          : 'text-slate-400'
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {index < requestSteps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={`mx-3 h-px min-w-3 flex-1 ${complete ? 'bg-slate-400' : 'bg-[var(--line)]'}`}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}

export function LevvRequestHeader({
  currentStep,
  title,
  description,
  meta,
  className = '',
}: {
  currentStep: number
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-5 ${className}`}>
      <LevvRequestStepper currentStep={currentStep} />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.625rem] font-semibold leading-tight tracking-[-0.022em] text-slate-950">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-[68ch] text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </header>
    </div>
  )
}

/* =========================
   Brand
   The mark needs a light ground: its lower leaf is the wordmark's navy.
========================= */
export function LevvBrand({ compact = false }: { compact?: boolean }) {
  const mark = (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
      <Image
        src="/logos/levvai-mark.png"
        alt={compact ? 'LEVVAI' : ''}
        width={700}
        height={780}
        className="h-[1.375rem] w-auto object-contain"
        priority
      />
    </span>
  )

  if (compact) return mark

  return (
    <span className="flex items-center gap-3" aria-label="LEVVAI">
      {mark}
      <Image
        src="/logos/levvai-wordmark.png"
        alt="LEVVAI"
        width={1250}
        height={250}
        className="h-[0.8rem] w-auto object-contain brightness-0 invert"
        priority
      />
    </span>
  )
}

/* =========================
   Page scaffold
========================= */
export function LevvPage({
  children,
  className = '',
  width = 'wide',
}: {
  children: ReactNode
  className?: string
  width?: 'standard' | 'wide' | 'full'
}) {
  const widths = {
    standard: 'max-w-6xl',
    wide: 'max-w-[1440px]',
    full: 'max-w-none',
  }

  return (
    <div className={`levv-page min-h-full ${className}`}>
      <div className={`mx-auto w-full ${widths[width]}`}>{children}</div>
    </div>
  )
}

/** `eyebrow` is the way back (a link to the parent record), shown above the title. */
export function LevvPageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="levv-page-header flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 text-[13px] font-medium text-slate-500 [&_a:hover]:text-slate-900 [&_a]:transition-colors">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.025em] text-slate-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[72ch] text-[14px] text-slate-600">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:pt-1">{actions}</div>
      ) : null}
    </header>
  )
}

/** The world's one small mark: the eleven steps of the tonal ramp, Rail Navy to paper. */
export function LevvZoneWedge({ className = '' }: { className?: string }) {
  const steps = ['#0a1330', '#19213b', '#283049', '#3a425a', '#4f566c', '#676d81', '#82879a', '#a1a5b3', '#c2c4cd', '#e0e1e5', '#f5f4ef']
  return (
    <span aria-hidden className={`flex border border-[var(--line)] ${className}`}>
      {steps.map((step) => (
        <span key={step} className="h-1.5 w-2.5" style={{ background: step }} />
      ))}
    </span>
  )
}

/**
 * A page opens on its record: the trail in tracked capitals, the title, one plain sentence
 * computed from live data, the figures as one summary line, and the page's one command at the right.
 */
export function LevvRecordHeader({
  trail,
  title,
  statement,
  figures = [],
  actions,
  children,
}: {
  trail?: ReactNode
  title: ReactNode
  statement: ReactNode
  figures?: { label: ReactNode; value: ReactNode }[]
  actions?: ReactNode
  /** A working surface that belongs to the header, under it (the Control desk's Nova prompt). */
  children?: ReactNode
}) {
  return (
    <header className="levv-record-header">
      <div className="flex items-center justify-between gap-4">
        {trail ? <p className={`${LEGEND} text-slate-500`}>{trail}</p> : <span />}
        <LevvZoneWedge className="hidden sm:flex" />
      </div>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <h1 className="text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.025em] text-slate-950 sm:text-[2.125rem]">
            {title}
          </h1>
          <p className="mt-2 max-w-[72ch] text-[14px] leading-relaxed text-slate-700">{statement}</p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {figures.length > 0 ? (
        <dl className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          {figures.map((figure, index) => (
            <div key={index} className="flex flex-row-reverse items-baseline justify-end gap-2">
              <dt className={`${LEGEND} text-slate-500`}>{figure.label}</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-slate-950">{figure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  )
}

/* =========================
   Stats
   Figures read as one strip of a record, not a row of tiles.
========================= */
export function LevvStatStrip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={`grid grid-cols-2 border-t-2 border-slate-950 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none ${className}`}
    >
      {children}
    </dl>
  )
}

export function LevvStat({
  label,
  value,
  detail,
  tone = 'default',
  icon: Icon,
}: {
  label: ReactNode
  value: ReactNode
  detail?: ReactNode
  tone?: 'default' | 'positive' | 'attention' | 'critical'
  icon?: ElementType
}) {
  const valueTone = {
    default: 'text-slate-950',
    positive: 'text-emerald-700',
    attention: 'text-amber-700',
    critical: 'text-rose-700',
  }[tone]

  return (
    <div className="border-b border-[var(--line)] py-3 pr-6 lg:border-b-0">
      <dt className={`flex items-center gap-1.5 ${LEGEND} text-slate-500`}>
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
        {label}
      </dt>
      <dd className={`mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-[-0.015em] tabular-nums ${valueTone}`}>
        {value}
      </dd>
      {detail ? <dd className="mt-0.5 text-xs text-slate-500">{detail}</dd> : null}
    </div>
  )
}

/** A single figure on its own; prefer LevvStatStrip for a set. */
export function LevvStatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon?: ElementType
  label: ReactNode
  value: ReactNode
  detail?: ReactNode
  tone?: 'blue' | 'emerald' | 'amber' | 'slate'
}) {
  return (
    <div className="levv-stat-card border-t-2 border-slate-950 py-3">
      <div className={`flex items-center gap-1.5 ${LEGEND} text-slate-500`}>
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
        {label}
      </div>
      <div className="mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-[-0.015em] tabular-nums text-slate-950">
        {value}
      </div>
      {detail ? <div className="mt-0.5 text-xs text-slate-500">{detail}</div> : null}
    </div>
  )
}

/* =========================
   Panels
========================= */
export function LevvPanel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`levv-panel rounded-xl border border-[var(--line)] bg-[var(--surface)] ${className}`}
    >
      {children}
    </section>
  )
}

export function LevvPanelHeader({
  icon: Icon,
  title,
  description,
  actions,
  className = '',
}: {
  icon?: ElementType
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tone?: 'blue' | 'emerald' | 'amber' | 'slate'
  className?: string
}) {
  return (
    <div
      className={`levv-panel-header flex items-start justify-between gap-4 ${className}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : null}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {actions}
    </div>
  )
}

export function LevvDetailTile({
  icon: Icon,
  label,
  value,
  className = '',
}: {
  icon?: ElementType
  label: ReactNode
  value: ReactNode
  className?: string
}) {
  return (
    <div
      className={`levv-detail-tile flex min-h-[56px] items-start gap-2.5 rounded-lg bg-[var(--surface-sunken)] px-3.5 py-3 ${className}`}
    >
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : null}
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-0.5 whitespace-pre-line text-[13px] font-medium text-slate-900">
          {value}
        </div>
      </div>
    </div>
  )
}

/* =========================
   Status
========================= */
export type LevvTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate'

/* A status is a small solid square beside plain text; neutral is a hollow square. A tag without a marker is framed. */
const STATUS_TONES: Record<LevvTone, { mark: string; ink: string; frame: string }> = {
  blue: { mark: 'bg-blue-600', ink: 'text-blue-600', frame: 'border-blue-600/50 text-blue-700' },
  emerald: { mark: 'bg-[#1f8a5b]', ink: 'text-[#1f8a5b]', frame: 'border-[#1f8a5b]/50 text-[#17704a]' },
  amber: { mark: 'bg-amber-600', ink: 'text-amber-600', frame: 'border-amber-600/50 text-amber-800' },
  rose: { mark: 'bg-[#c0392b]', ink: 'text-[#c0392b]', frame: 'border-[#c0392b]/50 text-[#a32f23]' },
  slate: { mark: 'border border-slate-400', ink: 'text-slate-500', frame: 'border-slate-400 text-slate-600' },
}

export function LevvStatusBadge({
  children,
  tone = 'slate',
  icon: Icon,
  dot = true,
}: {
  children: ReactNode
  tone?: LevvTone
  icon?: ElementType
  dot?: boolean
}) {
  const style = STATUS_TONES[tone]
  if (!Icon && !dot) {
    return (
      <span className={`levv-pill inline-flex items-center whitespace-nowrap border px-1.5 py-px ${LEGEND} ${style.frame}`}>
        {children}
      </span>
    )
  }
  return (
    <span className={`levv-pill inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium ${tone === 'slate' ? 'text-slate-500' : 'text-slate-900'}`}>
      {Icon ? <Icon className={`h-3.5 w-3.5 ${style.ink}`} /> : <span aria-hidden className={`h-2 w-2 shrink-0 ${style.mark}`} />}
      {children}
    </span>
  )
}

/* =========================
   The operating record
   Every engagement moves through the same five stages; this track shows where a record stands.
========================= */
export const LIFECYCLE_STAGES = [
  'Requisition',
  'Approval',
  'Onboarding',
  'In engagement',
  'Offboarding',
] as const

export type LevvLifecycleStage = (typeof LIFECYCLE_STAGES)[number]

export function LevvLifecycle({
  stage,
  closed = false,
  tone = 'blue',
  showLabel = true,
}: {
  stage: LevvLifecycleStage
  /** The last stage is finished: the record is closed. */
  closed?: boolean
  tone?: 'blue' | 'amber' | 'rose'
  showLabel?: boolean
}) {
  const current = LIFECYCLE_STAGES.indexOf(stage)
  const fill = { blue: 'bg-blue-600', amber: 'bg-amber-500', rose: 'bg-rose-500' }[tone]
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        role="img"
        aria-label={`Lifecycle: ${stage}${closed ? ', closed' : ''} (stage ${current + 1} of ${LIFECYCLE_STAGES.length})`}
        className="flex shrink-0 items-center gap-[3px]"
      >
        {LIFECYCLE_STAGES.map((name, index) => {
          const done = index < current || (closed && index === current)
          const here = index === current && !closed
          return (
            <span
              key={name}
              className={`h-1.5 transition-colors duration-200 ${
                here ? `w-4 ${fill}` : done ? 'w-2.5 bg-slate-400' : 'w-2.5 bg-slate-200'
              }`}
            />
          )
        })}
      </span>
      {showLabel ? (
        <span className="truncate text-[13px] text-slate-700">{closed ? `${stage} complete` : stage}</span>
      ) : null}
    </span>
  )
}

/* =========================
   Controls
========================= */
export function LevvSearchField({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" {...props} className={`${levvUi.input} pl-9`} />
    </div>
  )
}

export function LevvSelect({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select {...props} className={`${levvUi.input} cursor-pointer appearance-none pr-9 font-medium`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}

/** Filters sit above what they scope, on the page itself rather than in a box of their own. */
export function LevvToolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>
}

/** One choice among two to four states, the chosen option in Levv Blue. */
export function LevvSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex border border-slate-950">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`levv-press h-[34px] whitespace-nowrap border-l border-slate-950 px-3.5 ${LEGEND} outline-none first:border-l-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] ${
              selected ? 'bg-blue-600 text-white' : 'text-slate-800 hover:bg-slate-100'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Sections of one page: tracked capitals on a hairline, the open section underlined in Levv Blue. Options with an
 * `href` are links to sibling routes; without one they are tabs, moved between with the arrow keys.
 */
export function LevvTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode; count?: number; href?: string }[]
  onChange?: (value: T) => void
  className?: string
}) {
  const tab = (selected: boolean) =>
    `levv-press -mb-px inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 ${LEGEND} text-[12px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] ${
      selected ? 'border-blue-600 text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-950'
    }`
  const count = (option: { count?: number }) =>
    option.count === undefined ? null : <span className="font-semibold tabular-nums text-slate-400">{option.count}</span>

  if (options.every((option) => option.href)) {
    return (
      <nav aria-label={label} className={`flex gap-6 overflow-x-auto border-b border-[var(--line)] ${className}`}>
        {options.map((option) => (
          <Link
            key={option.value}
            href={option.href as string}
            aria-current={option.value === value ? 'page' : undefined}
            className={tab(option.value === value)}
          >
            {option.label}
            {count(option)}
          </Link>
        ))}
      </nav>
    )
  }

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    const current = options.findIndex((option) => option.value === value)
    let next = current
    if (event.key in keys) next = (current + keys[event.key] + options.length) % options.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    else return
    event.preventDefault()
    onChange?.(options[next].value)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={move} className={`flex gap-6 overflow-x-auto border-b border-[var(--line)] ${className}`}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange?.(option.value)}
            className={tab(selected)}
          >
            {option.label}
            {count(option)}
          </button>
        )
      })}
    </div>
  )
}

/* =========================
   Nova
   One recognisable place to ask the agent, on every screen that offers it.
========================= */
export function LevvNovaPrompt({
  placeholder,
  value,
  onChange,
  onSubmit,
  className = '',
}: {
  placeholder: string
  value?: string
  onChange?: (value: string) => void
  onSubmit?: () => void
  className?: string
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.()
      }}
      className={`group flex h-9 items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-white pl-1 pr-1 transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--focus)] hover:border-slate-400/60 ${className}`}
    >
      <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--rail)] text-[var(--nova)]">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="levv-bare min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-slate-900 shadow-none outline-none ring-0 focus-visible:outline-none placeholder:text-slate-400 focus:ring-0"
      />
      <button
        type="submit"
        className="levv-press h-7 shrink-0 rounded-md px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
      >
        Ask Nova
      </button>
    </form>
  )
}

/** Asking Nova to change records: one panel, the same on every page that offers it. */
export function LevvNovaPanel({
  title,
  description,
  placeholder,
  value,
  onChange,
  onSubmit,
  submitLabel,
  busy = false,
  busyLabel,
  error,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  placeholder: string
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  submitLabel: string
  busy?: boolean
  busyLabel?: string
  error?: ReactNode
  className?: string
}) {
  return (
    <LevvPanel className={`flex min-w-0 flex-col px-5 py-4 ${className}`}>
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-slate-950">
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--rail)] text-[var(--nova)]">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        {title}
      </h2>
      {description ? <p className="mt-1 text-[13px] text-slate-500">{description}</p> : null}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={typeof title === 'string' ? title : placeholder}
        className={`${levvUi.textarea} mt-3 flex-1 resize-none`}
        rows={2}
        placeholder={placeholder}
      />
      <div className="mt-3">
        <button type="button" onClick={onSubmit} disabled={busy || !value.trim()} className={levvUi.secondaryButton}>
          {busy ? busyLabel ?? submitLabel : submitLabel}
        </button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </LevvPanel>
  )
}

/** A bulk upload: a dashed row on the surface, what to send at the left, the one file command at the right. */
export function LevvUploadZone({
  icon: Icon = FileSpreadsheet,
  title,
  description,
  error,
  action,
  className = '',
}: {
  icon?: ElementType
  title: ReactNode
  description?: ReactNode
  error?: ReactNode
  /** The file button; the hidden `<input type="file">` stays with the page that owns it. */
  action: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-4 border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 max-w-[64ch] text-[13px] text-slate-500">{description}</p> : null}
          {error ? <p role="alert" className="mt-2 text-[13px] text-rose-700">{error}</p> : null}
        </div>
      </div>
      <div className="shrink-0 self-start sm:self-auto">{action}</div>
    </div>
  )
}

/* =========================
   Inline states
========================= */
export function LevvNotice({
  tone = 'slate',
  title,
  children,
  icon: Icon,
  action,
  className = '',
}: {
  tone?: LevvTone
  title?: ReactNode
  children?: ReactNode
  icon?: ElementType
  action?: ReactNode
  className?: string
}) {
  const tones: Record<LevvTone, string> = {
    blue: 'bg-[var(--surface)] text-slate-900 ring-blue-600/40 [&_svg]:text-blue-600',
    emerald: 'bg-[var(--surface)] text-slate-900 ring-[#1f8a5b]/40 [&_svg]:text-[#1f8a5b]',
    amber: 'bg-[var(--surface)] text-slate-900 ring-amber-600/45 [&_svg]:text-amber-600',
    rose: 'bg-[var(--surface)] text-slate-900 ring-[#c0392b]/45 [&_svg]:text-[#c0392b]',
    slate: 'bg-[var(--surface)] text-slate-800 ring-slate-400 [&_svg]:text-slate-500',
  }
  return (
    <div role={tone === 'rose' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-lg px-4 py-3 text-[13px] ring-1 ring-inset ${tones[tone]} ${className}`}>
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function LevvEmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: ElementType
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon ? (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {children ? <p className="mt-1 max-w-sm text-[13px] text-slate-500">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
