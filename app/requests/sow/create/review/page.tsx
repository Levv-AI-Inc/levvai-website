'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSOW } from '../context'
import type { AIAutomationItem, CostModel, SOWData } from '../context'
import { assignSeverity } from '@/lib/intelligence/nova/severity'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { SOWProgress } from '../components/SOWProgress'

type NovaSignal = {
  id: string
  severity: 'info' | 'caution' | 'risk'
  title: string
  message: string
  section?: string
}

type NovaScanState = {
  status: 'idle' | 'scanning' | 'complete' | 'unavailable'
  signals: NovaSignal[]
}

type GovernanceGap = {
  label: string
  severity: 'blocking' | 'warning'
}

const deploymentLabels = {
  your_tenant: 'Your tenant',
  vendor_hosted: 'Vendor hosted',
  hybrid: 'Hybrid',
} satisfies Record<NonNullable<AIAutomationItem['deploymentModel']>, string>

const oversightLabels = {
  human_in_loop: 'Human in loop',
  human_on_loop: 'Human on loop',
  autonomous: 'Autonomous',
} satisfies Record<NonNullable<AIAutomationItem['oversightLevel']>, string>

const exitPlanLabels = {
  decommission: 'Decommission',
  transition_internal: 'Transition internal',
  continue_renewal: 'Continue / renew',
} satisfies Record<NonNullable<AIAutomationItem['exitPlan']>, string>

function isUsageBased(costModel?: CostModel) {
  return costModel === 'API Usage' || costModel === 'Usage Based'
}

function isSensitiveData(value?: AIAutomationItem['dataClassification']) {
  return value === 'PII' || value === 'Financial Data' || value === 'Confidential'
}

function getGovernanceGaps(item: AIAutomationItem): GovernanceGap[] {
  const gaps: GovernanceGap[] = []
  const sensitive = isSensitiveData(item.dataClassification)
  const usageBased = isUsageBased(item.costModel)

  if (!item.name?.trim()) {
    gaps.push({ label: 'Automation name is required', severity: 'blocking' })
  }
  if (!item.businessOwner?.trim()) {
    gaps.push({ label: 'Business owner is required', severity: 'blocking' })
  }
  if (!item.technicalOwner?.trim()) {
    gaps.push({ label: 'Technical owner is required', severity: 'blocking' })
  }
  if (!item.accessScope?.length) {
    gaps.push({ label: 'Access scope must be defined', severity: 'blocking' })
  }
  if (item.riskLevel === 'High' && sensitive) {
    gaps.push({
      label: 'High-risk sensitive-data automation requires privacy/legal review',
      severity: 'blocking',
    })
  }
  if (usageBased && !item.spendCap) {
    gaps.push({
      label: 'Usage-based automation needs a monthly spend cap',
      severity: 'blocking',
    })
  }
  if (usageBased && !item.spendApprover?.trim()) {
    gaps.push({
      label: 'Usage-based automation needs a spend approver',
      severity: 'blocking',
    })
  }
  if (item.oversightLevel === 'autonomous' && sensitive) {
    gaps.push({
      label: 'Autonomous automation with sensitive data needs human oversight',
      severity: 'blocking',
    })
  }
  if (item.deploymentModel === 'vendor_hosted' && sensitive && item.vendorRetainsData === undefined) {
    gaps.push({
      label: 'Vendor-hosted sensitive-data retention must be confirmed',
      severity: 'blocking',
    })
  }
  if (item.vendorTrainsOnData && sensitive) {
    gaps.push({
      label: 'Vendor training on sensitive data requires an opt-out clause',
      severity: 'blocking',
    })
  }
  if (item.riskLevel === 'High' && !item.exitPlan) {
    gaps.push({
      label: 'High-risk automation needs an exit plan',
      severity: 'blocking',
    })
  }

  if (!item.purpose?.trim()) {
    gaps.push({ label: 'Purpose is not described', severity: 'warning' })
  }
  if (!item.aiPlatform?.trim()) {
    gaps.push({ label: 'AI platform / technology is not specified', severity: 'warning' })
  }
  if (item.deploymentModel === 'hybrid') {
    gaps.push({
      label: 'Hybrid deployment should document the shared responsibility model',
      severity: 'warning',
    })
  }
  if (item.oversightLevel === 'autonomous' && item.riskLevel === 'Medium' && !sensitive) {
    gaps.push({
      label: 'Autonomous medium-risk automation should be reviewed after launch',
      severity: 'warning',
    })
  }
  if (item.complianceScope?.includes('GDPR') && item.deploymentModel === 'vendor_hosted') {
    gaps.push({
      label: 'GDPR scope with vendor-hosted deployment may need transfer review',
      severity: 'warning',
    })
  }
  if (item.exitPlan === 'continue_renewal') {
    gaps.push({
      label: 'Continues under renewal; flag for contract renewal planning',
      severity: 'warning',
    })
  }

  return gaps
}

export default function ReviewPage() {
  const router = useRouter()
  const { sow } = useSOW()

  const { name, vendor, startDate, endDate, rawScope } = sow
  const financials: any = sow.financials || {}
  const commercials: any = sow.commercials || {}
  const aiAutomation: AIAutomationItem[] = sow.aiAutomation || []
  const attachments: any[] = sow.attachments || []

  /* -----------------------------------------
     Nova – GPT Triangulation Scan (Moment 2)
     ----------------------------------------- */

  const [novaScan, setNovaScan] = useState<NovaScanState>({
    status: 'idle',
    signals: [],
  })
  const scanRequestIdRef = useRef(0)
  const [packageContent, setPackageContent] = useState('')
  const [isGeneratingPackage, setIsGeneratingPackage] = useState(false)
  const [packageError, setPackageError] = useState('')

  const reviewArtifacts = getReviewArtifacts(aiAutomation)
  const aiTotalCost = aiAutomation.reduce(
    (sum, item) => sum + ((item as AIAutomationItem & { estimatedMonthlyCost?: number }).estimatedMonthlyCost || 0),
    0,
  )
  const aiAllGaps = aiAutomation.flatMap(getGovernanceGaps)
  const aiBlockingGaps = aiAllGaps.filter((gap) => gap.severity === 'blocking')
  const aiWarningGaps = aiAllGaps.filter((gap) => gap.severity === 'warning')
  const aiHighRisk = aiAutomation.filter((item) => item.riskLevel === 'High')
  const aiAutonomous = aiAutomation.filter((item) => item.oversightLevel === 'autonomous')
  const aiVendorHosted = aiAutomation.filter(
    (item) => item.deploymentModel === 'vendor_hosted' || item.deploymentModel === 'hybrid',
  )
  const aiVendorTrains = aiAutomation.filter((item) => item.vendorTrainsOnData)
  const aiUsageBased = aiAutomation.filter((item) => isUsageBased(item.costModel))
  const submissionPayload: Partial<SOWData> = {
    workType: sow.workType,
    otherWorkDescription: sow.otherWorkDescription,
    name,
    vendor,
    startDate,
    endDate,
    rawScope,
    structuredScope: sow.structuredScope,
    contractTerms: sow.contractTerms,
    financials,
    commercials,
    aiGateAnswer: sow.aiGateAnswer,
    aiAutomation,
    attachments,
  }

  const handleSubmit = () => {
    router.push(
      `/requests/sow_submitted?sow=${encodeURIComponent(
        JSON.stringify(submissionPayload)
      )}`
    )
  }

  useEffect(() => {
    const requestId = scanRequestIdRef.current + 1
    scanRequestIdRef.current = requestId

    async function runNovaScan() {
      if (!rawScope) {
        setNovaScan({ status: 'idle', signals: [] })
        return
      }

      try {
        setNovaScan({ status: 'scanning', signals: [] })

        const res = await fetch('/api/nova/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workType: sow.workType,
            pricingModel: commercials.pricingModel || null,
            billingFrequency:
              commercials.billingFrequency ||
              (commercials.recurringAmount ? 'Recurring' : null),
            scopeSummary: rawScope || sow.scope || '',

          }),
        })

        const data = await res.json()

        if (scanRequestIdRef.current !== requestId) return

        if (!data?.ok || !Array.isArray(data.findings)) {
          setNovaScan({ status: 'unavailable', signals: [] })
          return
        }

        const mapped: NovaSignal[] = data.findings.map(
          (f: any, idx: number) => ({
            id: `nova-${idx}`,
            severity: assignSeverity(f).toLowerCase() as
              | 'info'
              | 'caution'
              | 'risk',
            title:
              f.dimension === 'commercials'
                ? 'Commercial alignment'
                : f.dimension === 'scope'
                ? 'Scope consistency'
                : 'Structural completeness',
            message: f.message,
            section:
              f.dimension === 'commercials'
                ? 'Commercials'
                : f.dimension === 'scope'
                ? 'Description'
                : undefined,
          })
        )

        setNovaScan({ status: 'complete', signals: mapped })
      } catch (err) {
        if (scanRequestIdRef.current !== requestId) return
        console.error('Nova scan failed', err)
        setNovaScan({ status: 'unavailable', signals: [] })
      }
    }

    runNovaScan()
  }, [
    rawScope,
    sow.workType,
    commercials.pricingModel,
    commercials.billingFrequency,
  ])

  useEffect(() => {
    async function generateReviewPackage() {
      if (!aiAutomation.length || !reviewArtifacts.length) return

      try {
        setIsGeneratingPackage(true)
        setPackageError('')

        const res = await fetch('/api/nova/review-package', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sowName: name,
            vendor,
            startDate,
            endDate,
            aiItems: aiAutomation,
          }),
        })
        const data = await res.json()

        if (!res.ok || !data?.ok || !data?.content) {
          throw new Error(data?.error || 'Nova could not generate the review package.')
        }

        setPackageContent(data.content)
      } catch (error) {
        setPackageError(
          error instanceof Error
            ? error.message
            : 'Nova could not generate the review package.',
        )
      } finally {
        setIsGeneratingPackage(false)
      }
    }

    generateReviewPackage()
  }, [aiAutomation, endDate, name, reviewArtifacts.length, startDate, vendor])

  function downloadReviewPackage() {
    const blob = new Blob([packageContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${name || 'SOW'}_Nova_Review_Package.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-7xl mx-auto p-10 grid grid-cols-[1fr_260px] gap-10">
      {/* LEFT */}
      <div className="space-y-10">
        <div>
          <h1 className="text-2xl font-semibold">Review</h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Review all details before submitting for approval.
          </p>
        </div>

        {/* DESCRIPTION */}
        <Section title="Description">
          <Item label="Name" value={name} />
          <Item label="Vendor" value={vendor} />
          <Item
            label="Period"
            value={
              startDate && endDate
                ? `${startDate} → ${endDate}`
                : '—'
            }
          />
          <Item label="Scope" value={rawScope || '—'} multiline />
        </Section>

        {/* FINANCIALS */}
        <Section title="Financials">
          <Item
            label="Estimated value"
            value={
              financials.totalValue
                ? `$${financials.totalValue} ${
                    financials.currency || 'USD'
                  }`
                : 'Not provided'
            }
          />

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-700">
              Cost centers
            </div>

            {Array.isArray(financials.allocations) &&
            financials.allocations.length ? (
              <ul className="space-y-1 text-sm text-gray-800">
                {financials.allocations.map((a: any) => (
                  <li key={a.costCenterId || a.costCenterName}>
                    {a.costCenterName}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">
                No cost centers allocated
              </div>
            )}
          </div>
        </Section>

        {/* COMMERCIALS */}
        <Section title="Commercials">
          <Item
            label="Pricing model"
            value={commercials.pricingModel || '—'}
          />

          {Array.isArray(commercials.milestones) &&
            commercials.milestones.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-700">
                  Milestones
                </div>

                <ul className="space-y-2 text-sm">
                  {commercials.milestones.map((m: any) => (
                    <li
                      key={m.id}
                      className="flex justify-between"
                    >
                      <span>{m.name}</span>
                      <span className="text-gray-600">
                        ${m.amount} — {m.due}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {Array.isArray(commercials.tmRoles) &&
            commercials.tmRoles.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-700">
                  Roles & rates
                </div>

                <ul className="space-y-2 text-sm">
                  {commercials.tmRoles.map((r: any) => (
                    <li
                      key={r.id}
                      className="flex justify-between"
                    >
                      <span>{r.role}</span>
                      <span className="text-gray-600">
                        ${r.rate}/hr · {r.startDate} →{' '}
                        {r.endDate}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {commercials.recurringAmount && (
            <Item
              label="Recurring"
              value={`$${commercials.recurringAmount} · ${commercials.billingFrequency}`}
            />
          )}
        </Section>

        {/* AI AUTOMATION */}
        <Section title="AI & Automation">
          {aiAutomation.length ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <SummaryTile label="AI items" value={aiAutomation.length.toString()} />
                <SummaryTile label="High risk" value={aiHighRisk.length.toString()} warn={aiHighRisk.length > 0} />
                <SummaryTile label="Blocking gaps" value={aiBlockingGaps.length.toString()} warn={aiBlockingGaps.length > 0} />
                <SummaryTile label="Warnings" value={aiWarningGaps.length.toString()} warn={aiWarningGaps.length > 0} />
              </div>

              {aiTotalCost > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-600">Total AI spend under this SOW</span>
                  <span className="font-semibold text-slate-900">
                    ${aiTotalCost.toLocaleString()}/mo
                  </span>
                </div>
              )}

              {aiBlockingGaps.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <XCircle className="h-4 w-4" />
                    {aiBlockingGaps.length} governance gap{aiBlockingGaps.length !== 1 ? 's' : ''} will block approval
                  </div>
                  <p className="mt-1 text-xs text-rose-700">
                    Nova is assessing the saved AI fields and carrying unresolved blockers into final review.
                  </p>
                </div>
              )}

              <ul className="space-y-3 text-sm">
                {aiAutomation.map((item) => {
                  const gaps = getGovernanceGaps(item)
                  const blocking = gaps.filter((gap) => gap.severity === 'blocking')
                  const warnings = gaps.filter((gap) => gap.severity === 'warning')
                  const clean = gaps.length === 0
                  const usageBased = isUsageBased(item.costModel)

                  return (
                    <li
                      key={item.id}
                      className={`rounded-lg border bg-white px-4 py-4 ${
                        blocking.length > 0
                          ? 'border-rose-200'
                          : warnings.length > 0
                          ? 'border-amber-200'
                          : 'border-emerald-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-slate-900">
                            {item.name || 'Unnamed automation'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.category}
                            {item.aiPlatform ? ` · ${item.aiPlatform}` : ''}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                            clean
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : blocking.length > 0
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {clean ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : blocking.length > 0 ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          )}
                          {clean
                            ? 'Governance complete'
                            : `${blocking.length} blocking · ${warnings.length} warning`}
                        </span>
                      </div>

                      {item.purpose && (
                        <p className="mt-3 text-sm leading-5 text-slate-600">
                          {item.purpose}
                        </p>
                      )}

                      <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                        <MiniFact label="Business owner" value={item.businessOwner || '—'} warn={!item.businessOwner} />
                        <MiniFact label="Technical owner" value={item.technicalOwner || '—'} warn={!item.technicalOwner} />
                        <MiniFact label="Data" value={item.dataClassification || '—'} warn={isSensitiveData(item.dataClassification)} />
                        <MiniFact label="Risk" value={item.riskLevel || '—'} warn={item.riskLevel === 'High'} />
                        <MiniFact
                          label="Deployment"
                          value={item.deploymentModel ? deploymentLabels[item.deploymentModel] : '—'}
                          warn={item.deploymentModel === 'vendor_hosted' || item.deploymentModel === 'hybrid'}
                        />
                        <MiniFact
                          label="Oversight"
                          value={item.oversightLevel ? oversightLabels[item.oversightLevel] : '—'}
                          warn={item.oversightLevel === 'autonomous'}
                        />
                        <MiniFact
                          label={usageBased ? 'Spend cap' : 'Cost model'}
                          value={usageBased ? (item.spendCap ? `$${item.spendCap.toLocaleString()}/mo` : 'No cap') : item.costModel || '—'}
                          warn={usageBased && !item.spendCap}
                        />
                        <MiniFact
                          label="Exit plan"
                          value={item.exitPlan ? exitPlanLabels[item.exitPlan] : '—'}
                          warn={item.riskLevel === 'High' && !item.exitPlan}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.accessScope?.map((scope) => (
                          <Pill key={scope}>{scope}</Pill>
                        ))}
                        {item.complianceScope?.map((scope) => (
                          <Pill key={scope}>{scope}</Pill>
                        ))}
                        {item.vendorRetainsData === true && <Pill tone="amber">Vendor retains data</Pill>}
                        {item.vendorRetainsData === false && <Pill tone="green">No vendor retention</Pill>}
                        {item.vendorTrainsOnData === true && <Pill tone="red">Vendor trains on data</Pill>}
                        {usageBased && <Pill tone="amber">Variable cost</Pill>}
                      </div>

                      {gaps.length > 0 && (
                        <div
                          className={`mt-4 rounded-lg border px-4 py-3 ${
                            blocking.length > 0
                              ? 'border-rose-100 bg-rose-50'
                              : 'border-amber-100 bg-amber-50'
                          }`}
                        >
                          <div
                            className={`mb-2 text-xs font-semibold ${
                              blocking.length > 0 ? 'text-rose-700' : 'text-amber-700'
                            }`}
                          >
                            Nova assessment
                          </div>
                          <ul className="space-y-1">
                            {gaps.map((gap, index) => (
                              <li
                                key={`${gap.label}-${index}`}
                                className={`flex items-start gap-2 text-xs ${
                                  gap.severity === 'blocking' ? 'text-rose-700' : 'text-amber-700'
                                }`}
                              >
                                {gap.severity === 'blocking' ? (
                                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                )}
                                <span>{gap.label}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {clean && (
                        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-700">
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                          Digital worker record will be created in Pending Review on SOW approval.
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              No AI or automation items registered.
            </div>
          )}
        </Section>

        {aiAutomation.length > 0 && (
          <Section title="Nova Review Package">
            <p className="text-sm text-slate-500">
              Nova drafts the governance artifacts reviewers need from the AI
              and automation answers on this SOW.
            </p>

            <div className="space-y-2">
              {reviewArtifacts.map((artifact) => (
                <div
                  key={artifact.label}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    packageContent
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-purple-200 bg-purple-50 text-purple-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{artifact.label}</div>
                      <div className="mt-1 text-xs opacity-80">
                        {artifact.detail}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs font-medium">
                      {packageContent
                        ? 'Draft ready'
                        : isGeneratingPackage
                        ? 'Drafting'
                        : 'Queued'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {isGeneratingPackage && (
              <div className="text-sm text-purple-700">
                Nova is drafting the review package...
              </div>
            )}

            {packageError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {packageError}
              </div>
            )}

            {packageContent && (
              <button
                onClick={downloadReviewPackage}
                className="rounded-full bg-green-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-green-800"
              >
                Download package
              </button>
            )}
          </Section>
        )}

        {/* ATTACHMENTS */}
        <Section title="Attachments">
          {attachments.length ? (
            <ul className="space-y-2 text-sm">
              {attachments.map((file: any, i: number) => (
                <li
                  key={`${file?.name || 'file'}-${i}`}
                  className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2 bg-white"
                >
                  <span className="text-gray-800">
                    {file?.name || 'Uploaded document'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Attached
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-500">
              No attachments provided
            </div>
          )}
        </Section>

        {/* NOVA SCANNER */}
        <NovaScanner scan={novaScan} />

        {/* ACTIONS */}
        <div className="flex justify-between pt-4">
          <button
            onClick={() =>
              router.push('/requests/sow/create/ai-automation')
            }
            className="text-sm text-cyan-700 border border-cyan-200 px-4 py-2 rounded-full hover:bg-cyan-50 transition"
          >
            Back
          </button>

          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-full text-sm bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Submit
          </button>

        </div>
      </div>

      {/* RIGHT STATUS */}
      <div className="sticky top-10 h-fit space-y-4">
        <SOWProgress
          currentStep="review"
          workType={sow.workType}
          completedSteps={sow.completedSteps}
        />

        {aiAutomation.length > 0 && (
          <div
            className={`mt-5 rounded-xl border p-4 ${
              aiBlockingGaps.length > 0
                ? 'border-rose-200 bg-rose-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              <Bot
                className={`h-4 w-4 ${
                  aiBlockingGaps.length > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              />
              <div
                className={`text-sm font-semibold ${
                  aiBlockingGaps.length > 0 ? 'text-rose-800' : 'text-emerald-800'
                }`}
              >
                AI Governance
              </div>
            </div>

            <div className="space-y-2">
              <SidebarFact label="AI items" value={aiAutomation.length.toString()} />
              <SidebarFact label="High risk" value={aiHighRisk.length.toString()} warn={aiHighRisk.length > 0} />
              <SidebarFact label="Autonomous" value={aiAutonomous.length.toString()} warn={aiAutonomous.length > 0} />
              <SidebarFact label="Vendor-hosted" value={aiVendorHosted.length.toString()} warn={aiVendorHosted.length > 0} />
              {aiVendorTrains.length > 0 && (
                <SidebarFact label="Vendor trains" value={aiVendorTrains.length.toString()} warn />
              )}
              {aiUsageBased.length > 0 && (
                <SidebarFact label="Variable cost" value={aiUsageBased.length.toString()} warn />
              )}
              <SidebarFact label="Blocking gaps" value={aiBlockingGaps.length.toString()} warn={aiBlockingGaps.length > 0} />
              <SidebarFact label="Review artifacts" value={reviewArtifacts.length.toString()} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getReviewArtifacts(items: any[]) {
  if (!items.length) return []

  const sensitiveItems = items.filter((item) =>
    ['PII', 'Financial Data', 'Confidential'].includes(item.dataClassification),
  )
  const accessSystems = Array.from(
    new Set(
      items.flatMap((item) =>
        Array.isArray(item.accessScope) ? item.accessScope : [],
      ),
    ),
  )
  const legalItems = items.filter(
    (item) =>
      item.riskLevel === 'High' ||
      ['PII', 'Financial Data', 'Confidential'].includes(item.dataClassification) ||
      item.vendorTrainsOnData === true,
  )
  const financeItems = items.filter(
    (item) => item.costModel === 'API Usage' || item.costModel === 'Usage Based',
  )

  return [
    sensitiveItems.length > 0 && {
      label: 'DPIA draft',
      detail: `${sensitiveItems.length} sensitive AI item${sensitiveItems.length !== 1 ? 's' : ''}`,
    },
    accessSystems.length > 0 && {
      label: 'Security review package',
      detail:
        accessSystems.length <= 3
          ? `Scoped to ${accessSystems.join(', ')}`
          : `Scoped to ${accessSystems.length} systems`,
    },
    legalItems.length > 0 && {
      label: 'Legal and DPA checklist',
      detail: `${legalItems.length} AI item${legalItems.length !== 1 ? 's' : ''} requiring legal review`,
    },
    financeItems.length > 0 && {
      label: 'Finance control sheet',
      detail: `${financeItems.length} variable-cost AI item${financeItems.length !== 1 ? 's' : ''}`,
    },
  ].filter(Boolean) as { label: string; detail: string }[]
}

/* ---------- Nova Scanner UI ---------- */

function NovaScanner({ scan }: { scan: NovaScanState }) {
  const { status, signals } = scan

  if (status === 'idle') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <div className="font-semibold text-slate-800">
          Nova review
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Add scope details for Nova to complete the final review.
        </p>
      </div>
    )
  }

  if (status === 'scanning') {
    return (
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-purple-700" />
          <div className="font-semibold text-slate-900">
            Nova Analysis
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Reviewing scope, commercial terms, and structural completeness.
        </p>
      </div>
    )
  }

  if (status === 'unavailable') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="font-semibold text-amber-800">
          Nova review unavailable
        </div>
        <p className="mt-1 text-sm text-amber-700">
          Nova could not complete the automated scan. Review the SOW details before submitting.
        </p>
      </div>
    )
  }

  if (!signals.length) {
    return (
      <div className="border border-green-200 rounded-xl p-6 bg-green-50">
        <div className="font-semibold text-green-800">
          Nova review
        </div>
        <p className="text-sm text-green-700 mt-1">
          No material risks or gaps detected based on the
          information provided.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-purple-200 rounded-xl p-6 bg-purple-50 space-y-4">
      <div>
        <div className="font-semibold text-gray-900">
          Nova Analysis
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Based on rules and workflows enabled.
          No changes were made.
        </p>
      </div>

      <div className="space-y-3">
        {signals.map(s => (
          <NovaSignalItem key={s.id} signal={s} />
        ))}
      </div>

      <div className="text-xs text-slate-500 pt-2">

      </div>
    </div>
  )
}

function NovaSignalItem({ signal }: { signal: NovaSignal }) {
  const badge =
    signal.severity === 'risk'
      ? 'bg-red-100 text-red-700'
      : signal.severity === 'caution'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-blue-100 text-blue-700'

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${badge}`}
        >
          {signal.severity.toUpperCase()}
        </span>
        <span className="font-medium text-sm">
          {signal.title}
        </span>
      </div>

      <p className="text-sm text-gray-700">
        {signal.message}
      </p>

      {signal.section && (
        <div className="text-xs text-slate-500">
          Section: {signal.section}
        </div>
      )}
    </div>
  )
}

/* ---------- UI Helpers ---------- */

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-4">
      <div className="text-lg font-semibold">{title}</div>
      {children}
    </div>
  )
}

function Item({
  label,
  value,
  multiline,
}: {
  label: string
  value?: string
  multiline?: boolean
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-700">
        {label}
      </div>
      <div
        className={`text-sm text-slate-800 ${
          multiline ? 'whitespace-pre-line' : ''
        }`}
      >
        {value || '—'}
      </div>
    </div>
  )
}

function SummaryTile({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${warn ? 'text-amber-800' : 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  )
}

function MiniFact({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-medium uppercase text-slate-400">{label}</div>
      <div className={`mt-1 truncate text-xs font-medium ${warn ? 'text-rose-700' : 'text-slate-700'}`}>
        {value}
      </div>
    </div>
  )
}

function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'green' | 'amber' | 'red'
}) {
  const styles = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  )
}

function SidebarFact({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-slate-600">{label}</span>
      <span className={`text-xs font-semibold ${warn ? 'text-rose-700' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  )
}
