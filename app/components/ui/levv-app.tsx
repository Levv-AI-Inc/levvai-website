import Image from 'next/image'
import type { ElementType, ReactNode } from 'react'
import { Check } from 'lucide-react'

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
      className={`rounded-[16px] border border-[#dce5f1] bg-white px-4 py-3 shadow-[0_10px_30px_-26px_rgba(15,23,42,0.35)] ${className}`}
    >
      <div className="flex items-center gap-4">
        <span className="shrink-0 rounded-full bg-[#eaf2ff] px-3 py-1.5 text-xs font-bold text-[#2563eb]">
          Step {safeStep} of {requestSteps.length}
        </span>
        <span className="ml-auto text-xs font-semibold text-[#101b3c] sm:hidden">
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
                className={`flex min-w-0 items-center ${index < requestSteps.length - 1 ? 'flex-1' : ''}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${
                      complete
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : active
                          ? 'border-[#2563eb] bg-[#2563eb] text-white shadow-[0_0_0_4px_rgba(37,99,235,0.12)]'
                          : 'border-[#cbd5e1] bg-white text-[#64748b]'
                    }`}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                  </span>
                  <span
                    className={`hidden truncate text-xs font-semibold lg:block ${
                      active
                        ? 'text-[#101b3c]'
                        : complete
                          ? 'text-[#334155]'
                          : 'text-[#94a3b8]'
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {index < requestSteps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={`mx-3 h-px min-w-3 flex-1 ${complete ? 'bg-emerald-300' : 'bg-[#dbe3ee]'}`}
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
    <div className={`space-y-4 ${className}`}>
      <LevvRequestStepper currentStep={currentStep} />
      <header className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.035em] !text-[#101b3c]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-[#64748b]">{description}</p>
          ) : null}
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </header>
    </div>
  )
}

export function LevvBrand({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/80 bg-gradient-to-br from-white to-blue-50 shadow-[0_8px_24px_-12px_rgba(37,99,235,0.9)]">
        <Image
          src="/logos/levvai-mark.png"
          alt="LEVVAI"
          width={700}
          height={780}
          className="h-8 w-auto object-contain"
          priority
        />
      </span>
    )
  }

  return (
    <span className="flex items-center gap-3" aria-label="LEVVAI">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/80 bg-gradient-to-br from-white to-blue-50 shadow-[0_8px_24px_-12px_rgba(37,99,235,0.9)]">
        <Image
          src="/logos/levvai-mark.png"
          alt=""
          width={700}
          height={780}
          className="h-8 w-auto object-contain"
          priority
        />
      </span>
      <Image
        src="/logos/levvai-wordmark.png"
        alt="LEVVAI"
        width={1250}
        height={250}
        className="h-[1.05rem] w-auto object-contain brightness-0 invert"
        priority
      />
    </span>
  )
}

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
    standard: 'max-w-7xl',
    wide: 'max-w-[1500px]',
    full: 'max-w-none',
  }

  return (
    <div className={`levv-page min-h-full ${className}`}>
      <div className={`mx-auto w-full ${widths[width]}`}>{children}</div>
    </div>
  )
}

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
    <header className="levv-page-header flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <div className="mb-3 text-sm font-medium text-[#64748b]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-[#101b3c] lg:text-[2.15rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm text-[#64748b]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  )
}

export function LevvStatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'blue',
}: {
  icon?: ElementType
  label: ReactNode
  value: ReactNode
  detail?: ReactNode
  tone?: 'blue' | 'emerald' | 'amber' | 'slate'
}) {
  const tones = {
    blue: 'bg-[#eaf2ff] text-[#2563eb]',
    emerald: 'bg-[#dcfce7] text-[#059669]',
    amber: 'bg-[#fff7e6] text-[#d97706]',
    slate: 'bg-[#eef2f7] text-[#52637a]',
  }

  return (
    <div className="levv-stat-card flex min-h-[96px] items-center gap-4 rounded-[17px] border border-[#e1e8f2] bg-white px-5 py-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
      {Icon ? (
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${tones[tone]}`}
        >
          <Icon className="h-6 w-6" />
        </span>
      ) : null}
      <div className="min-w-0">
        <div className="text-xs font-medium text-[#64748b]">{label}</div>
        <div className="mt-1 text-2xl font-bold tracking-[-0.02em] text-[#101b3c]">
          {value}
        </div>
        {detail ? (
          <div className="mt-1 text-xs text-[#94a3b8]">{detail}</div>
        ) : null}
      </div>
    </div>
  )
}

export function LevvPanel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`levv-panel rounded-[18px] border border-[#e1e8f2] bg-white shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)] ${className}`}
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
  tone = 'emerald',
  className = '',
}: {
  icon?: ElementType
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tone?: 'blue' | 'emerald' | 'amber' | 'slate'
  className?: string
}) {
  const tones = {
    blue: 'bg-[#eaf2ff] text-[#2563eb]',
    emerald: 'bg-[#dcfce7] text-[#059669]',
    amber: 'bg-[#fff7e6] text-[#d97706]',
    slate: 'bg-[#eef2f7] text-[#52637a]',
  }

  return (
    <div
      className={`levv-panel-header flex items-start justify-between gap-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        {Icon ? (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${tones[tone]}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div>
          <h2 className="text-lg font-bold text-[#101b3c]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-[#64748b]">{description}</p>
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
      className={`levv-detail-tile flex min-h-[62px] items-center gap-3 rounded-[13px] border border-[#e3e9f2] bg-[#f8fafc] px-4 py-3 ${className}`}
    >
      {Icon ? <Icon className="h-5 w-5 shrink-0 text-[#52637a]" /> : null}
      <div className="min-w-0">
        <div className="text-xs font-medium text-[#718096]">{label}</div>
        <div className="mt-0.5 whitespace-pre-line text-sm font-semibold text-[#17213c]">
          {value}
        </div>
      </div>
    </div>
  )
}

export function LevvStatusBadge({
  children,
  tone = 'slate',
  icon: Icon,
}: {
  children: ReactNode
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate'
  icon?: ElementType
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }

  return (
    <span
      className={`levv-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${tones[tone]}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  )
}

export const levvUi = {
  primaryButton:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#101b3c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#192a56] disabled:cursor-not-allowed disabled:opacity-60',
  secondaryButton:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[#dbe3ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] shadow-sm transition hover:border-[#c8d4e3] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60',
  dangerButton:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#dc2626] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-60',
  input:
    'w-full rounded-xl border border-[#dbe3ee] bg-white px-3.5 py-2.5 text-sm text-[#17213c] outline-none transition placeholder:text-[#94a3b8] focus:border-[#93b4f8] focus:ring-4 focus:ring-[#dbeafe]/70',
  tableShell:
    'levv-table-shell overflow-hidden rounded-[18px] border border-[#e1e8f2] bg-white shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)]',
}
