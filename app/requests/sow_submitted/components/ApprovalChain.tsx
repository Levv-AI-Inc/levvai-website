'use client'

import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock, Circle } from 'lucide-react'

type ApprovalStep = {
  name: string
  role: string
  status: 'completed' | 'active' | 'pending'
  note?: string
}

const BASE_STEPS: ApprovalStep[] = [
  { name: 'Amy Jackson', role: 'Supervisor', status: 'completed' },
  { name: 'Christopher Chang', role: 'Cost Center Owner', status: 'active' },
]

function buildApprovalSteps(sow: any): ApprovalStep[] {
  const aiItems = sow?.aiAutomation || []
  const steps = [...BASE_STEPS]

  const hasHighRisk = aiItems.some((i: any) => i.riskLevel === 'High')
  const hasSensitive = aiItems.some((i: any) =>
    ['PII', 'Financial Data', 'Confidential'].includes(i.dataClassification)
  )
  const hasVendorHosted = aiItems.some((i: any) =>
    i.deploymentModel === 'vendor_hosted' || i.deploymentModel === 'hybrid'
  )
  const hasGDPR = aiItems.some((i: any) => i.complianceScope?.includes('GDPR'))

  if (hasSensitive || hasGDPR) {
    steps.push({ name: 'Harjot Kaur', role: 'Data Privacy Officer', status: 'pending', note: 'DPIA review' })
  }

  if (hasVendorHosted || hasHighRisk) {
    steps.push({ name: 'Marcus Reid', role: 'InfoSec', status: 'pending', note: 'Security questionnaire' })
  }

  if (hasHighRisk && hasSensitive) {
    steps.push({ name: 'Sandra Nwosu', role: 'Legal Counsel', status: 'pending', note: 'DPA & AI rider' })
  }

  if (!aiItems.length) {
    steps.push({ name: 'Harjot Kaur', role: 'InfoSec', status: 'pending' })
  }

  return steps
}

export default function ApprovalChain() {
  const searchParams = useSearchParams()
  const sowParam = searchParams.get('sow')
  const sow = sowParam ? JSON.parse(decodeURIComponent(sowParam)) : {}
  const steps = buildApprovalSteps(sow)
  const aiItems = sow?.aiAutomation || []
  const isAIRouted = aiItems.length > 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Approval routing</h2>
          {isAIRouted && (
            <p className="mt-1 text-xs text-slate-400">
              Reviewers and packages resolved by Nova from AI governance answers
            </p>
          )}
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
          {steps.filter(s => s.status === 'completed').length} of {steps.length} approved
        </span>
      </div>

      {/* Steps — vertical on wider chains */}
      <div className={`${steps.length > 3 ? 'flex flex-col gap-0' : 'flex items-start justify-between'}`}>
        {steps.length <= 3 ? (
          // Horizontal layout for short chains
          steps.map((step, index) => {
            const isLast = index === steps.length - 1
            return (
              <div key={index} className="flex items-start flex-1">
                <div className="flex flex-col items-center">
                  <StepNode step={step} />
                  <div className="mt-2 text-center">
                    <p className="text-sm font-medium text-slate-900">{step.name}</p>
                    <p className="text-xs text-slate-400">{step.role}</p>
                    {step.note && <p className="text-xs text-indigo-500 mt-0.5">{step.note}</p>}
                  </div>
                </div>
                {!isLast && (
                  <div className={`flex-1 h-px mt-4 mx-4 ${step.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })
        ) : (
          // Vertical layout for longer chains
          steps.map((step, index) => {
            const isLast = index === steps.length - 1
            return (
              <div key={index} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <StepNode step={step} />
                  {!isLast && (
                    <div className={`w-px flex-1 min-h-[32px] ${step.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  )}
                </div>
                <div className="pb-6">
                  <p className="text-sm font-medium text-slate-900">{step.name}</p>
                  <p className="text-xs text-slate-400">{step.role}</p>
                  {step.note && <p className="text-xs text-indigo-500 mt-0.5">{step.note}</p>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function StepNode({ step }: { step: ApprovalStep }) {
  if (step.status === 'completed') {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 border-2 border-emerald-500">
        <CheckCircle2 className="h-5 w-5 text-white" />
      </div>
    )
  }
  if (step.status === 'active') {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-50">
        <Clock className="h-4 w-4 text-amber-500" />
      </div>
    )
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-200 bg-white">
      <Circle className="h-4 w-4 text-slate-300" />
    </div>
  )
}