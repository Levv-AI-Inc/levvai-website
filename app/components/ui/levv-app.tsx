import Image from 'next/image'
import type { ElementType, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Check, ChevronDown, Search, Sparkles } from 'lucide-react'

/* =========================
   Class recipes
   One vocabulary for every screen: navy primary, white secondary, blue for selection and focus.
========================= */
const BUTTON =
  'levv-press inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0'

export const levvUi = {
  primaryButton: `${BUTTON} bg-slate-900 text-white shadow-sm hover:bg-slate-800`,
  accentButton: `${BUTTON} bg-blue-600 text-white shadow-sm hover:bg-blue-700`,
  secondaryButton: `${BUTTON} border border-[var(--line-strong)] bg-white text-slate-800 shadow-sm hover:border-slate-400/60 hover:bg-slate-50`,
  ghostButton: `${BUTTON} text-slate-600 hover:bg-slate-100 hover:text-slate-900`,
  dangerButton: `${BUTTON} bg-rose-600 text-white shadow-sm hover:bg-rose-700`,
  input:
    'h-9 w-full rounded-lg border border-[var(--line-strong)] bg-white px-3 text-[13px] text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-400/60 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus)]',
  tableShell: 'levv-table-shell overflow-hidden rounded-xl border border-[var(--line)] bg-white',
  th: 'px-4 py-2.5 text-left text-xs font-medium text-slate-500',
  td: 'px-4 py-3 align-middle text-[13px] text-slate-700',
  label: 'text-xs font-medium text-slate-500',
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
        <h1 className="text-[1.625rem] font-semibold leading-tight tracking-[-0.022em] text-slate-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[68ch] text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:pt-1">{actions}</div>
      ) : null}
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
      className={`grid grid-cols-2 divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-white max-lg:gap-px max-lg:divide-y-0 max-lg:bg-[var(--line)] lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:divide-x ${className}`}
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
    <div className="bg-white px-5 py-4">
      <dt className="flex items-center gap-1.5 text-[13px] text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
        {label}
      </dt>
      <dd className={`mt-1 text-[1.375rem] font-semibold leading-tight tracking-[-0.015em] tabular-nums ${valueTone}`}>
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
    <div className="levv-stat-card rounded-xl border border-[var(--line)] bg-white px-5 py-4">
      <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
        {label}
      </div>
      <div className="mt-1 text-[1.375rem] font-semibold leading-tight tracking-[-0.015em] tabular-nums text-slate-950">
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
      className={`levv-panel rounded-xl border border-[var(--line)] bg-white ${className}`}
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

const BADGE_TONES: Record<LevvTone, { badge: string; dot: string }> = {
  blue: { badge: 'bg-blue-50 text-blue-700 ring-blue-600/15', dot: 'bg-blue-600' },
  emerald: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', dot: 'bg-emerald-500' },
  amber: { badge: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
  rose: { badge: 'bg-rose-50 text-rose-700 ring-rose-600/15', dot: 'bg-rose-500' },
  slate: { badge: 'bg-slate-100 text-slate-600 ring-slate-500/15', dot: 'bg-slate-400' },
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
  const style = BADGE_TONES[tone]
  return (
    <span
      className={`levv-pill inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.badge}`}
    >
      {Icon ? <Icon className="h-3 w-3" /> : dot ? <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} /> : null}
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
              className={`h-1.5 rounded-full transition-colors duration-200 ${
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
        className="levv-bare min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:ring-0"
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
    blue: 'bg-blue-50 text-blue-900 ring-blue-600/15 [&_svg]:text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-900 ring-emerald-600/15 [&_svg]:text-emerald-600',
    amber: 'bg-amber-50 text-amber-900 ring-amber-600/20 [&_svg]:text-amber-600',
    rose: 'bg-rose-50 text-rose-900 ring-rose-600/15 [&_svg]:text-rose-600',
    slate: 'bg-slate-50 text-slate-800 ring-slate-500/15 [&_svg]:text-slate-500',
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
