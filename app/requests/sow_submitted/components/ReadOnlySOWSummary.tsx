'use client'

import { useSearchParams } from 'next/navigation'
import { Bot, CheckCircle2, AlertTriangle, XCircle, Shield, Eye, LogOut, FileText, DollarSign } from 'lucide-react'

type ExtendedItem = {
  id: string
  name: string
  category?: string
  aiPlatform?: string
  riskLevel?: string
  dataClassification?: string
  deploymentModel?: string
  oversightLevel?: string
  exitPlan?: string
  vendorTrainsOnData?: boolean
  businessOwner?: string
  technicalOwner?: string
  estimatedMonthlyCost?: number
  costModel?: string
  accessScope?: string[]
  complianceScope?: string[]
}

const DEPLOYMENT_LABEL: Record<string, string> = {
  your_tenant: 'Your tenant', vendor_hosted: 'Vendor hosted', hybrid: 'Hybrid',
}
const OVERSIGHT_LABEL: Record<string, string> = {
  human_in_loop: 'Human-in-loop', human_on_loop: 'Human-on-loop', autonomous: 'Autonomous',
}
const EXIT_LABEL: Record<string, string> = {
  decommission: 'Decommission', transition_internal: 'Transition internal', continue_renewal: 'Continue / renew',
}
const riskColor: Record<string, string> = {
  Low: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Medium: 'text-amber-700 bg-amber-50 border-amber-200',
  High: 'text-rose-700 bg-rose-50 border-rose-200',
}

function isSensitive(dc?: string) {
  return dc === 'PII' || dc === 'Financial Data' || dc === 'Confidential'
}

function getArtifactCount(items: ExtendedItem[]): number {
  let count = 0
  if (items.some(i => isSensitive(i.dataClassification))) count++
  if (items.some(i => i.accessScope && i.accessScope.length > 0)) count++
  if (items.some(i => i.riskLevel === 'High' || isSensitive(i.dataClassification) || i.vendorTrainsOnData)) count++
  if (items.some(i => i.costModel === 'API Usage' || i.costModel === 'Usage Based')) count++
  return count
}

export default function ReadOnlySOWSummary() {
  const searchParams = useSearchParams()
  const sowParam = searchParams.get('sow')
  if (!sowParam) return null

  const sow = JSON.parse(decodeURIComponent(sowParam))
  const aiItems: ExtendedItem[] = sow.aiAutomation || []
  const artifactCount = getArtifactCount(aiItems)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-sm space-y-6">

      {/* Header */}
      <div>
        <div className="text-sm text-slate-400 mb-1">
          Statement of Work ID:{' '}
          <span className="font-medium text-slate-700">SW1249</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Statement of Work Summary</h2>
      </div>

      {/* Core fields */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
        <Row label="SOW Type" value={sow.workType} />
        <Row label="Primary Vendor" value={sow.vendor} />
        <Row label="Term" value={sow.startDate && sow.endDate ? `${sow.startDate} → ${sow.endDate}` : undefined} />
        <Row label="Commercial Model" value={sow?.commercials?.pricingModel} />
        {sow?.financials?.totalValue && (
          <Row label="Total Value" value={`$${Number(sow.financials.totalValue).toLocaleString()} ${sow.financials.currency || 'USD'}`} />
        )}
      </div>

      {sow.rawScope && (
        <div className="border-t border-slate-100 pt-5">
          <Row label="Scope Description" value={sow.rawScope} />
        </div>
      )}

      {/* AI & Automation section */}
      {aiItems.length > 0 && (
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-slate-800">AI & Automation</span>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {aiItems.length} agent{aiItems.length !== 1 ? 's' : ''}
              </span>
            </div>
            {artifactCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {artifactCount} governance artifact{artifactCount !== 1 ? 's' : ''} drafted by Nova
              </div>
            )}
          </div>

          <div className="space-y-3">
            {aiItems.map(item => {
              const isHighRisk = item.riskLevel === 'High'
              const isAutonomous = item.oversightLevel === 'autonomous'
              const vendorTrains = item.vendorTrainsOnData === true

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 ${
                    isHighRisk ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  {/* Item header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                        isHighRisk ? 'bg-rose-100' : 'bg-indigo-50'
                      }`}>
                        <Bot className={`h-4 w-4 ${isHighRisk ? 'text-rose-600' : 'text-indigo-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.category}{item.aiPlatform ? ` · ${item.aiPlatform}` : ''}</p>
                      </div>
                    </div>
                    {item.riskLevel && (
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${riskColor[item.riskLevel] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        {item.riskLevel} risk
                      </span>
                    )}
                  </div>

                  {/* Key governance facts */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    {item.oversightLevel && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Eye className="h-3 w-3 shrink-0" />
                        {OVERSIGHT_LABEL[item.oversightLevel] || item.oversightLevel}
                      </div>
                    )}
                    {item.deploymentModel && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Shield className="h-3 w-3 shrink-0" />
                        {DEPLOYMENT_LABEL[item.deploymentModel] || item.deploymentModel}
                      </div>
                    )}
                    {item.exitPlan && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <LogOut className="h-3 w-3 shrink-0" />
                        {EXIT_LABEL[item.exitPlan] || item.exitPlan}
                      </div>
                    )}
                    {item.dataClassification && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <FileText className="h-3 w-3 shrink-0" />
                        {item.dataClassification}
                      </div>
                    )}
                    {item.estimatedMonthlyCost && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <DollarSign className="h-3 w-3 shrink-0" />
                        ${item.estimatedMonthlyCost.toLocaleString()}/mo
                      </div>
                    )}
                  </div>

                  {/* Flags */}
                  {(isAutonomous || vendorTrains || isHighRisk) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {isAutonomous && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                          <AlertTriangle className="h-3 w-3" />Autonomous
                        </span>
                      )}
                      {vendorTrains && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                          <XCircle className="h-3 w-3" />Vendor trains on data
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Review package note */}
          {artifactCount > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <p className="text-xs text-indigo-700 leading-relaxed">
                Nova has pre-drafted {artifactCount} governance artifact{artifactCount !== 1 ? 's' : ''} for this SOW.
                Reviewers in the approval chain are working from pre-filled documents — not blank pages.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-800 leading-relaxed">{value}</div>
    </div>
  )
}