'use client'

import Link from 'next/link'
import { flushSync } from 'react-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import type { SOWProgressStep } from '../context'

type StepDefinition = {
  id: SOWProgressStep
  label: string
  href: string
}

const STEPS: StepDefinition[] = [
  { id: 'engagement', label: 'Engagement Type', href: '/requests/sow/create' },
  { id: 'scope', label: 'Scope Definition', href: '/requests/sow/create/define' },
  { id: 'financials', label: 'Financials', href: '/requests/sow/create/financials' },
  { id: 'commercials', label: 'Commercials', href: '/requests/sow/create/commercials' },
  { id: 'ai-automation', label: 'AI & Automation', href: '/requests/sow/create/ai-automation' },
  { id: 'review', label: 'Final Review', href: '/requests/sow/create/review' },
]

export function SOWProgress({
  currentStep,
  workType,
  beforeNavigate,
  completedSteps = [],
}: {
  currentStep: SOWProgressStep
  workType?: string
  beforeNavigate?: () => void
  completedSteps?: SOWProgressStep[]
}) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep)
  const completedStepSet = new Set(completedSteps)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">
        SOW Progress
      </h3>
      <nav className="space-y-6">
        {STEPS.map((step, index) => {
          const status =
            index === currentIndex
              ? 'active'
              : index < currentIndex || completedStepSet.has(step.id)
                ? 'complete'
                : 'pending'
          const href =
            step.id === 'scope' && workType
              ? `${step.href}?workType=${encodeURIComponent(workType)}`
              : step.href

          return (
            <StatusItem
              key={step.id}
              label={step.label}
              status={status}
              href={index <= currentIndex || completedStepSet.has(step.id) ? href : undefined}
              beforeNavigate={beforeNavigate}
            />
          )
        })}
      </nav>
    </div>
  )
}

function StatusItem({
  label,
  status,
  href,
  beforeNavigate,
}: {
  label: string
  status: 'complete' | 'active' | 'pending'
  href?: string
  beforeNavigate?: () => void
}) {
  const content = (
    <>
      {status === 'complete' ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      ) : status === 'active' ? (
        <span className="w-5 h-5 rounded-full border-2 border-cyan-500 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
        </span>
      ) : (
        <Circle className="w-5 h-5 text-gray-200" />
      )}
      <span className={`text-sm font-bold tracking-tight transition-colors group-hover:text-cyan-700 ${status === 'active' ? 'text-gray-900' : 'text-gray-400'}`}>
        {label}
      </span>
    </>
  )

  if (!href) {
    return (
      <div
        aria-disabled="true"
        className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg text-left opacity-70"
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      href={href}
      onClick={() => {
        if (beforeNavigate) {
          flushSync(beforeNavigate)
        }
      }}
      aria-current={status === 'active' ? 'step' : undefined}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-lg text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-100"
    >
      {content}
    </Link>
  )
}
