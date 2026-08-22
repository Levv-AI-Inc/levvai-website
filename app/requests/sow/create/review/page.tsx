'use client'

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Same extended fields as AIAutomationPage — must be added to
// AIAutomationItem in ../context (deploymentModel, oversightLevel,
// vendorRetainsData, vendorTrainsOnData, complianceScope, exitPlan).
// ─────────────────────────────────────────────────────────────────────────────

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSOW } from '../context'
import { assignSeverity } from '@/lib/intelligence/nova/severity'
import {
  AlertTriangle,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cpu,
  DollarSign,
  Download,
  Eye,
  FileText,
  Loader2,
  Lock,
  LogOut,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react'
import { AIAutomationItem } from '../context'

// ─── Extended types ────────────────────────────────────────────────────────────

type DeploymentModel = 'your_tenant' | 'vendor_hosted' | 'hybrid'
type OversightLevel  = 'autonomous' | 'human_in_loop' | 'human_on_loop'
type ExitPlan        = 'decommission' | 'transition_internal' | 'continue_renewal'

type ExtendedItem = AIAutomationItem & {
  deploymentModel?:    DeploymentModel
  oversightLevel?:     OversightLevel
  vendorRetainsData?:  boolean
  vendorTrainsOnData?: boolean
  complianceScope?:    string[]
  exitPlan?:           ExitPlan
}

// ─── Labels & styles ──────────────────────────────────────────────────────────

const DEPLOYMENT_LABEL: Record<DeploymentModel, string> = {
  your_tenant: 'Your tenant', vendor_hosted: 'Vendor hosted', hybrid: 'Hybrid',
}
const OVERSIGHT_LABEL: Record<OversightLevel, string> = {
  human_in_loop: 'Human-in-loop', human_on_loop: 'Human-on-loop', autonomous: 'Autonomous',
}
const EXIT_LABEL: Record<ExitPlan, string> = {
  decommission: 'Decommission', transition_internal: 'Transition internal', continue_renewal: 'Continue / renew',
}

const riskPill: Record<string, string> = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  High: 'bg-rose-50 text-rose-700 border-rose-200',
}
const dataClassPill: Record<string, string> = {
  Public: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Internal: 'bg-slate-100 text-slate-600 border-slate-200',
  Confidential: 'bg-amber-50 text-amber-700 border-amber-200',
  PII: 'bg-rose-50 text-rose-700 border-rose-200',
  'Financial Data': 'bg-amber-50 text-amber-700 border-amber-200',
}
const DEPLOYMENT_PILL: Record<DeploymentModel, string> = {
  your_tenant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  vendor_hosted: 'bg-amber-50 text-amber-700 border-amber-200',
  hybrid: 'bg-blue-50 text-blue-700 border-blue-200',
}
const OVERSIGHT_PILL: Record<OversightLevel, string> = {
  human_in_loop: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  human_on_loop: 'bg-amber-50 text-amber-700 border-amber-200',
  autonomous: 'bg-rose-50 text-rose-700 border-rose-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUsageBased(item: ExtendedItem): boolean {
  return item.costModel === 'API Usage' || item.costModel === 'Usage Based'
}

function isSensitiveData(dc: string | undefined): boolean {
  return dc === 'PII' || dc === 'Financial Data' || dc === 'Confidential'
}

// ─── Nova signal type ─────────────────────────────────────────────────────────

type NovaSignal = {
  id: string
  severity: 'info' | 'caution' | 'risk'
  title: string
  message: string
  section?: string
}

// ─── Governance gap logic ─────────────────────────────────────────────────────

type GovernanceGap = { label: string; severity: 'blocking' | 'warning' }

function getGovernanceGaps(item: ExtendedItem): GovernanceGap[] {
  const gaps: GovernanceGap[] = []
  const usageBased = isUsageBased(item)
  const sensitive  = isSensitiveData(item.dataClassification)

  if (!item.technicalOwner?.trim())
    gaps.push({ label: 'No technical owner assigned', severity: 'blocking' })
  if (!item.accessScope || item.accessScope.length === 0)
    gaps.push({ label: 'Access scope not defined', severity: 'blocking' })
  if (!item.businessOwner?.trim())
    gaps.push({ label: 'No business owner assigned', severity: 'blocking' })
  if (item.riskLevel === 'High' && (item.dataClassification === 'PII' || item.dataClassification === 'Financial Data'))
    gaps.push({ label: 'High-risk + sensitive data — DPA required before approval', severity: 'blocking' })
  if (usageBased && !item.spendCap)
    gaps.push({ label: 'Usage-based cost requires a monthly spend cap', severity: 'blocking' })
  if (usageBased && !item.spendApprover?.trim())
    gaps.push({ label: 'Spend approver required for usage-based cost', severity: 'blocking' })
  if (item.oversightLevel === 'autonomous' && sensitive)
    gaps.push({ label: 'Autonomous agent with sensitive data — human-in-the-loop or escalation path required', severity: 'blocking' })
  if (item.deploymentModel === 'vendor_hosted' && sensitive && item.vendorRetainsData === undefined)
    gaps.push({ label: 'Vendor-hosted with sensitive data — data retention policy must be confirmed', severity: 'blocking' })
  if (item.vendorTrainsOnData === true && sensitive)
    gaps.push({ label: 'Vendor trains on your data with sensitive classification — requires opt-out clause in SOW', severity: 'blocking' })
  if (item.riskLevel === 'High' && !item.exitPlan)
    gaps.push({ label: 'High-risk agent with no exit plan — SOW must define decommission or transition terms', severity: 'blocking' })

  if (!item.purpose?.trim())
    gaps.push({ label: 'Purpose not described', severity: 'warning' })
  if (!item.aiPlatform?.trim())
    gaps.push({ label: 'AI platform / technology not specified', severity: 'warning' })
  if (item.deploymentModel === 'hybrid')
    gaps.push({ label: 'Hybrid deployment — shared responsibility model should be documented in SOW', severity: 'warning' })
  if (item.oversightLevel === 'autonomous' && item.riskLevel === 'Medium' && !sensitive)
    gaps.push({ label: 'Autonomous medium-risk agent — consider human-in-the-loop for initial period', severity: 'warning' })
  if (item.complianceScope?.includes('GDPR') && item.deploymentModel === 'vendor_hosted')
    gaps.push({ label: 'GDPR scope with vendor-hosted deployment — cross-border data transfer review may apply', severity: 'warning' })
  if (item.exitPlan === 'continue_renewal')
    gaps.push({ label: 'Agent continues under renewal — flagged for contract renewal planning', severity: 'warning' })

  return gaps
}

// ─── Review package artifact logic ───────────────────────────────────────────

type ReviewArtifact = {
  id: string
  label: string
  detail: string
  icon: React.ReactNode
}

function getReviewArtifacts(items: ExtendedItem[]): ReviewArtifact[] {
  const artifacts: ReviewArtifact[] = []

  const sensitiveItems = items.filter(i => isSensitiveData(i.dataClassification))
  const accessItems    = items.filter(i => i.accessScope && i.accessScope.length > 0)
  const legalItems     = items.filter(i =>
    i.riskLevel === 'High' ||
    isSensitiveData(i.dataClassification) ||
    i.vendorTrainsOnData === true
  )
  const financeItems = items.filter(i => isUsageBased(i))

  if (sensitiveItems.length > 0) {
    const classes = [...new Set(sensitiveItems.map(i => i.dataClassification).filter(Boolean))]
    artifacts.push({
      id: 'dpia',
      label: 'Data Processing Impact Assessment',
      detail: `Triggered by: ${classes.join(', ')} classification${sensitiveItems.length > 1 ? ` across ${sensitiveItems.length} agents` : ''}`,
      icon: <Shield className="h-4 w-4 text-indigo-500" />,
    })
  }

  if (accessItems.length > 0) {
    const systems = [...new Set(accessItems.flatMap(i => i.accessScope || []))]
    artifacts.push({
      id: 'security',
      label: 'Security Review Questionnaire',
      detail: `Scoped to: ${systems.slice(0, 3).join(', ')}${systems.length > 3 ? ` +${systems.length - 3} more` : ''}`,
      icon: <ShieldAlert className="h-4 w-4 text-indigo-500" />,
    })
  }

  if (legalItems.length > 0) {
    const reasons: string[] = []
    if (legalItems.some(i => i.riskLevel === 'High')) reasons.push('high-risk agent')
    if (legalItems.some(i => isSensitiveData(i.dataClassification))) reasons.push('sensitive data')
    if (legalItems.some(i => i.vendorTrainsOnData === true)) reasons.push('vendor trains on data')
    artifacts.push({
      id: 'legal',
      label: 'Legal & DPA Checklist',
      detail: `Triggered by: ${reasons.join(', ')}`,
      icon: <FileText className="h-4 w-4 text-indigo-500" />,
    })
  }

  if (financeItems.length > 0) {
    artifacts.push({
      id: 'finance',
      label: 'Finance Control Sheet',
      detail: `${financeItems.length} usage-based agent${financeItems.length !== 1 ? 's' : ''} — spend caps and escalation paths`,
      icon: <DollarSign className="h-4 w-4 text-indigo-500" />,
    })
  }

  return artifacts
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const router = useRouter()
  const { sow } = useSOW()

  const { name, vendor, startDate, endDate, rawScope } = sow
  const financials: any  = sow.financials  || {}
  const commercials: any = sow.commercials || {}
  const attachments: any[] = sow.attachments || []
  const aiItems: ExtendedItem[] = (sow.aiAutomation || []) as ExtendedItem[]

  const [novaSignals, setNovaSignals]       = useState<NovaSignal[]>([])
  const [isScanning, setIsScanning]         = useState(false)
  const [packageContent, setPackageContent] = useState<string>('')
  const [isGenerating, setIsGenerating]     = useState(false)
  const [generateError, setGenerateError]   = useState(false)

  // Derived AI governance state
  const aiTotalCost     = aiItems.reduce((s, i) => s + (i.estimatedMonthlyCost || 0), 0)
  const aiBlockingGaps  = aiItems.flatMap(i => getGovernanceGaps(i).filter(g => g.severity === 'blocking'))
  const aiHighRisk      = aiItems.filter(i => i.riskLevel === 'High')
  const aiAutonomous    = aiItems.filter(i => i.oversightLevel === 'autonomous')
  const aiVendorHosted  = aiItems.filter(i => i.deploymentModel === 'vendor_hosted' || i.deploymentModel === 'hybrid')
  const aiVendorTrains  = aiItems.filter(i => i.vendorTrainsOnData === true)
  const aiUsageBased    = aiItems.filter(i => isUsageBased(i))
  const reviewArtifacts = getReviewArtifacts(aiItems)

  const hasBlockers = aiBlockingGaps.length > 0

  // ── Nova SOW scan ──
  useEffect(() => {
    async function runNovaScan() {
      if (!rawScope) return
      try {
        setIsScanning(true)
        const res = await fetch('/api/nova/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workType: sow.workType,
            pricingModel: commercials.pricingModel || null,
            billingFrequency: commercials.billingFrequency || (commercials.recurringAmount ? 'Recurring' : null),
            scopeSummary: rawScope || sow.scope || '',
          }),
        })
        const data = await res.json()
        if (!data?.ok || !Array.isArray(data.findings)) { setNovaSignals([]); return }
        const mapped: NovaSignal[] = data.findings.map((f: any, idx: number) => ({
          id: `nova-${idx}`,
          severity: assignSeverity(f).toLowerCase() as 'info' | 'caution' | 'risk',
          title: f.dimension === 'commercials' ? 'Commercial Alignment' : f.dimension === 'scope' ? 'Scope Consistency' : 'Structural Completeness',
          message: f.message,
          section: f.dimension === 'commercials' ? 'Commercials' : f.dimension === 'scope' ? 'Description' : undefined,
        }))
        setNovaSignals(mapped)
      } catch {
        setNovaSignals([])
      } finally {
        setIsScanning(false)
      }
    }
    runNovaScan()
  }, [rawScope, sow.workType, commercials.pricingModel, commercials.billingFrequency])

  // ── Auto-generate review package on load ──
  useEffect(() => {
    async function generatePackage() {
      if (aiItems.length === 0 || reviewArtifacts.length === 0) return
      setIsGenerating(true)
      setGenerateError(false)
      try {
        const res = await fetch('/api/nova/review-package', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sowName: name, vendor, startDate, endDate, aiItems }),
        })
        const data = await res.json()
        if (data.ok && data.content) {
          setPackageContent(data.content)
        } else {
          setGenerateError(true)
        }
      } catch {
        setGenerateError(true)
      } finally {
        setIsGenerating(false)
      }
    }
    generatePackage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function downloadPackage() {
    const blob = new Blob([packageContent], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${name || 'SOW'}_Review_Package.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ── Header ── */}
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                <FileText className="h-4 w-4" />
                Final Review
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Review & Submit</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Verify all engagement details before submission. Nova has scanned for scope, commercial, and governance risks.
                {hasBlockers && (
                  <span className="ml-1 font-medium text-rose-600">
                    {aiBlockingGaps.length} governance gap{aiBlockingGaps.length !== 1 ? 's' : ''} must be resolved before this SOW can be approved.
                  </span>
                )}
              </p>
            </div>

            <div className={`hidden shrink-0 rounded-2xl border p-5 md:block ${
              hasBlockers ? 'border-rose-200 bg-rose-50' : novaSignals.some(s => s.severity === 'risk') ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className={`h-4 w-4 ${hasBlockers ? 'text-rose-600' : novaSignals.some(s => s.severity === 'risk') ? 'text-amber-600' : 'text-emerald-600'}`} />
                <p className={`text-sm font-semibold ${hasBlockers ? 'text-rose-700' : novaSignals.some(s => s.severity === 'risk') ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {isScanning ? 'Nova scanning…' : hasBlockers ? 'Governance blockers' : novaSignals.length > 0 ? `${novaSignals.length} finding${novaSignals.length !== 1 ? 's' : ''}` : 'All clear'}
                </p>
              </div>
              <p className={`text-xs ${hasBlockers ? 'text-rose-600' : 'text-slate-500'}`}>
                {hasBlockers ? `${aiBlockingGaps.length} AI governance gap${aiBlockingGaps.length !== 1 ? 's' : ''} blocking approval` : 'Ready to submit'}
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">

          {/* ── Left: review sections ── */}
          <div className="space-y-5">

            {/* Scope Definition */}
            <ReviewSection title="Scope Definition" icon={<Briefcase className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <ReviewItem label="Engagement Name" value={name} />
                <ReviewItem label="Primary Vendor" value={vendor} />
                <ReviewItem label="Effective Period" value={startDate && endDate ? `${startDate} → ${endDate}` : '—'} />
                <ReviewItem label="SOW Type" value={sow.workType?.replace('_', ' ')} />
              </div>
              {rawScope && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <ReviewItem label="Scope Description" value={rawScope} multiline />
                </div>
              )}
            </ReviewSection>

            {/* Financial Allocation */}
            <ReviewSection title="Financial Allocation" icon={<DollarSign className="h-4 w-4" />}>
              <ReviewItem
                label="Total Estimated Value"
                value={financials.totalValue
                  ? `$${Number(financials.totalValue).toLocaleString()} ${financials.currency || 'USD'}`
                  : 'Not provided'}
              />
              {Array.isArray(financials.allocations) && financials.allocations.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Cost Center Breakdown</p>
                  <div className="flex flex-wrap gap-2">
                    {financials.allocations.map((a: any) => (
                      <span key={a.costCenterId} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                        {a.costCenterName} · {a.mode === 'percentage' ? `${a.value}%` : `$${a.value}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </ReviewSection>

            {/* Commercial Terms */}
            <ReviewSection title="Commercial Terms" icon={<ShieldCheck className="h-4 w-4" />}>
              <ReviewItem label="Pricing Model" value={commercials.pricingModel || '—'} />
              {Array.isArray(commercials.milestones) && commercials.milestones.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Payment Milestones</p>
                  <div className="space-y-2">
                    {commercials.milestones.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">{m.name}</span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-slate-900">${Number(m.amount).toLocaleString()}</span>
                          {m.due && <span className="ml-2 text-xs text-slate-400">{m.due}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ReviewSection>

            {/* AI & Automation */}
            <ReviewSection
              title="AI & Automation"
              icon={<Bot className="h-4 w-4" />}
              badge={aiItems.length > 0 ? `${aiItems.length} item${aiItems.length !== 1 ? 's' : ''}` : undefined}
              badgeStyle={hasBlockers ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'}
            >
              {aiItems.length === 0 ? (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6">
                  <Bot className="h-5 w-5 text-slate-300" />
                  <p className="text-sm text-slate-400">No AI or automation tools are being procured under this SOW.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {aiTotalCost > 0 && (
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
                      <span className="text-sm text-slate-500">Total AI spend under this SOW</span>
                      <span className="text-sm font-semibold text-slate-900">${aiTotalCost.toLocaleString()}/mo</span>
                    </div>
                  )}

                  {aiBlockingGaps.length > 0 && (
                    <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                      <div>
                        <p className="text-sm font-semibold text-rose-800">
                          {aiBlockingGaps.length} governance gap{aiBlockingGaps.length !== 1 ? 's' : ''} will block SOW approval
                        </p>
                        <p className="mt-0.5 text-xs text-rose-700">
                          Nova requires these to be resolved before the digital worker record can be activated. You can submit the SOW now and resolve gaps before the approval step.
                        </p>
                      </div>
                    </div>
                  )}

                  {aiItems.map(item => {
                    const gaps       = getGovernanceGaps(item)
                    const blocking   = gaps.filter(g => g.severity === 'blocking')
                    const warnings   = gaps.filter(g => g.severity === 'warning')
                    const clean      = gaps.length === 0
                    const usageBased = isUsageBased(item)

                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-5 ${
                          blocking.length > 0 ? 'border-rose-200' : warnings.length > 0 ? 'border-amber-200' : 'border-emerald-200'
                        } bg-white`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                              blocking.length > 0 ? 'bg-rose-50' : warnings.length > 0 ? 'bg-amber-50' : 'bg-emerald-50'
                            }`}>
                              <Bot className={`h-4 w-4 ${blocking.length > 0 ? 'text-rose-600' : warnings.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{item.name}</p>
                              <p className="text-xs text-slate-400">{item.category}{item.aiPlatform ? ` · ${item.aiPlatform}` : ''}</p>
                            </div>
                          </div>

                          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                            clean ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : blocking.length > 0 ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}>
                            {clean ? <CheckCircle2 className="h-3 w-3" /> : blocking.length > 0 ? <XCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {clean ? 'Governance complete' : blocking.length > 0 ? `${blocking.length} blocking` : 'Warnings'}
                          </span>
                        </div>

                        {item.purpose && (
                          <p className="mt-3 text-sm leading-5 text-slate-500 line-clamp-2">{item.purpose}</p>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <MiniFact icon={<Eye className="h-3.5 w-3.5" />} label="Oversight" value={item.oversightLevel ? OVERSIGHT_LABEL[item.oversightLevel] : '—'} warn={item.oversightLevel === 'autonomous'} />
                          <MiniFact icon={<Shield className="h-3.5 w-3.5" />} label="Deployment" value={item.deploymentModel ? DEPLOYMENT_LABEL[item.deploymentModel] : '—'} />
                          <MiniFact icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Risk" value={item.riskLevel || '—'} />
                          <MiniFact icon={<LogOut className="h-3.5 w-3.5" />} label="Exit plan" value={item.exitPlan ? EXIT_LABEL[item.exitPlan] : '—'} warn={item.riskLevel === 'High' && !item.exitPlan} />
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <MiniFact icon={<User className="h-3.5 w-3.5" />} label="Business owner" value={item.businessOwner || '—'} warn={!item.businessOwner} />
                          <MiniFact icon={<Cpu className="h-3.5 w-3.5" />} label="Technical owner" value={item.technicalOwner || '—'} warn={!item.technicalOwner} />
                          <MiniFact icon={<FileText className="h-3.5 w-3.5" />} label="Data handling" value={item.vendorRetainsData === true ? 'Vendor retains' : item.vendorRetainsData === false ? 'No retention' : '—'} warn={item.vendorTrainsOnData === true} />
                          <MiniFact
                            icon={<DollarSign className="h-3.5 w-3.5" />}
                            label={usageBased ? 'Spend cap' : 'Cost type'}
                            value={usageBased ? (item.spendCap ? `$${item.spendCap.toLocaleString()}/mo` : 'No cap set') : item.costModel === 'Included in SOW' ? 'Included' : 'Fixed'}
                            warn={usageBased && !item.spendCap}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {item.riskLevel && <Pill className={riskPill[item.riskLevel]}>{item.riskLevel} risk</Pill>}
                          {item.dataClassification && (
                            <Pill className={dataClassPill[item.dataClassification] || 'border-slate-200 bg-slate-50 text-slate-600'}>
                              {item.dataClassification}
                            </Pill>
                          )}
                          {item.deploymentModel && <Pill className={DEPLOYMENT_PILL[item.deploymentModel]}>{DEPLOYMENT_LABEL[item.deploymentModel]}</Pill>}
                          {item.oversightLevel && <Pill className={OVERSIGHT_PILL[item.oversightLevel]}>{OVERSIGHT_LABEL[item.oversightLevel]}</Pill>}
                          <Pill className={usageBased ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>
                            {usageBased ? 'Variable cost' : 'Fixed cost'}
                          </Pill>
                          {item.vendorTrainsOnData === true && <Pill className="border-rose-200 bg-rose-50 text-rose-700">Vendor trains on data</Pill>}
                          {item.complianceScope?.map(c => <Pill key={c} className="border-slate-200 bg-slate-50 text-slate-600">{c}</Pill>)}
                          {item.accessScope?.map(a => (
                            <Pill key={a} className="border-slate-200 bg-slate-50 text-slate-500">
                              <Lock className="mr-1 inline h-3 w-3" />{a}
                            </Pill>
                          ))}
                        </div>

                        {gaps.length > 0 && (
                          <div className={`mt-4 rounded-xl border p-3 ${blocking.length > 0 ? 'border-rose-100 bg-rose-50' : 'border-amber-100 bg-amber-50'}`}>
                            <p className={`mb-1.5 text-xs font-semibold ${blocking.length > 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                              Nova · {blocking.length} blocking · {warnings.length} warning
                            </p>
                            <ul className="space-y-1">
                              {gaps.map((g, i) => (
                                <li key={i} className={`flex items-start gap-1.5 text-xs ${g.severity === 'blocking' ? 'text-rose-700' : 'text-amber-700'}`}>
                                  {g.severity === 'blocking'
                                    ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                                  {g.label}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {clean && (
                          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5">
                            <p className="text-xs text-emerald-700">
                              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                              Digital worker record will be created in <span className="font-medium">Pending Review</span> on SOW approval.
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </ReviewSection>

            {/* ── Nova Review Package ── */}
            {aiItems.length > 0 && (
              <ReviewSection
                title="Nova Review Package"
                icon={<Sparkles className="h-4 w-4" />}
                badge={packageContent ? 'Ready' : isGenerating ? 'Drafting…' : `${reviewArtifacts.length} artifact${reviewArtifacts.length !== 1 ? 's' : ''}`}
                badgeStyle={packageContent ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : isGenerating ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}
              >
                <p className="text-sm text-slate-500 leading-6">
                  Nova drafts governance artifacts from your SOW answers. Reviewers receive pre-filled documents at submission — they verify, not author.
                </p>

                {/* Artifact rows */}
                <div className="mt-4 space-y-2">
                  {reviewArtifacts.map(artifact => (
                    <div
                      key={artifact.id}
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
                        packageContent ? 'border-emerald-200 bg-emerald-50' : 'border-indigo-100 bg-indigo-50'
                      }`}
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-indigo-100">
                        {packageContent
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : isGenerating
                          ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                          : artifact.icon}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${packageContent ? 'text-emerald-800' : 'text-indigo-900'}`}>
                          {artifact.label}
                        </p>
                        <p className={`text-xs mt-0.5 ${packageContent ? 'text-emerald-700' : 'text-indigo-600'}`}>
                          {artifact.detail}
                        </p>
                      </div>
                      {packageContent && (
                        <span className="ml-auto shrink-0 rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Draft ready
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action row — no manual trigger, just status + download */}
                <div className="mt-5 flex items-center gap-3">
                  {isGenerating && (
                    <div className="inline-flex items-center gap-2 text-sm text-indigo-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Nova is drafting your review package…
                    </div>
                  )}
                  {packageContent && (
                    <>
                      <button
                        onClick={downloadPackage}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download Package
                      </button>
                      <p className="text-xs text-slate-400">
                        In production, this pre-fills your organization's approved templates.
                      </p>
                    </>
                  )}
                  {generateError && !isGenerating && (
                    <p className="text-xs text-rose-600">Generation failed — check your connection and try again.</p>
                  )}
                </div>
              </ReviewSection>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <ReviewSection title="Attachments" icon={<FileText className="h-4 w-4" />}>
                <div className="space-y-2">
                  {attachments.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">{a.name || a}</span>
                    </div>
                  ))}
                </div>
              </ReviewSection>
            )}

            {/* Nova scan */}
            <NovaPanel signals={novaSignals} isScanning={isScanning} />

          </div>

          {/* ── Right: Progress sidebar ── */}
          <aside className="space-y-4 lg:sticky lg:top-8 lg:h-fit">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="mb-5 text-xs font-medium uppercase tracking-wide text-slate-400">SOW Progress</p>
              <div className="space-y-3">
                <SidebarStep label="Scope Definition" status="complete" />
                <SidebarStep label="Financials" status="complete" />
                <SidebarStep label="Commercials" status="complete" />
                <SidebarStep label="AI & Automation" status={aiItems.length > 0 ? 'complete' : 'skipped'} note={aiItems.length > 0 ? `${aiItems.length} item${aiItems.length !== 1 ? 's' : ''}` : 'Skipped'} />
                <SidebarStep label="Final Review" status="active" />
              </div>
            </div>

            {aiItems.length > 0 && (
              <div className={`rounded-3xl border p-5 ${hasBlockers ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="mb-3 flex items-center gap-2">
                  <Bot className={`h-4 w-4 ${hasBlockers ? 'text-rose-600' : 'text-emerald-600'}`} />
                  <p className={`text-sm font-semibold ${hasBlockers ? 'text-rose-800' : 'text-emerald-800'}`}>
                    AI Governance
                  </p>
                </div>
                <div className="space-y-2">
                  <SidebarFact label="AI items" value={aiItems.length.toString()} />
                  <SidebarFact label="High risk" value={aiHighRisk.length.toString()} warn={aiHighRisk.length > 0} />
                  <SidebarFact label="Autonomous" value={aiAutonomous.length.toString()} warn={aiAutonomous.length > 0} />
                  <SidebarFact label="Vendor-hosted" value={aiVendorHosted.length.toString()} warn={aiVendorHosted.length > 0} />
                  {aiVendorTrains.length > 0 && (
                    <SidebarFact label="Vendor trains on data" value={aiVendorTrains.length.toString()} warn />
                  )}
                  {aiUsageBased.length > 0 && (
                    <SidebarFact label="Variable cost" value={aiUsageBased.length.toString()} />
                  )}
                  <SidebarFact label="Blocking gaps" value={aiBlockingGaps.length.toString()} warn={aiBlockingGaps.length > 0} />
                  <SidebarFact label="Review artifacts" value={reviewArtifacts.length.toString()} />
                </div>
                {hasBlockers ? (
                  <p className="mt-3 text-xs text-rose-700">Gaps must be resolved before SOW approval.</p>
                ) : (
                  <p className="mt-3 text-xs text-emerald-700">All digital worker records will be created on approval.</p>
                )}
              </div>
            )}
          </aside>
        </div>

        {/* ── Footer ── */}
        <footer className="flex items-center justify-between border-t border-slate-200 pt-6 mt-2">
          <button
            onClick={() => router.push('/requests/sow/create/ai-automation')}
            className="rounded-full border border-slate-200 bg-white px-8 py-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            Back
          </button>
          <button
            onClick={() => router.push(`/requests/sow_submitted?sow=${encodeURIComponent(JSON.stringify(sow))}`)}
            className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-12 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Confirm & Submit
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </footer>
      </div>
    </main>
  )
}

// ─── Nova panel ───────────────────────────────────────────────────────────────

function NovaPanel({ signals, isScanning }: { signals: NovaSignal[]; isScanning: boolean }) {
  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-indigo-200 bg-indigo-50 py-10">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
        <p className="mt-3 text-sm font-medium text-indigo-700">Nova is scanning scope and commercial alignment…</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-indigo-600" />
        <h3 className="text-sm font-semibold text-indigo-900">Nova · SOW Intelligence Scan</h3>
        {signals.length > 0 && (
          <span className="ml-auto rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            {signals.length} finding{signals.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {signals.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <p className="text-sm text-emerald-800">No material risks or scope gaps detected in this SOW.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map(s => (
            <div
              key={s.id}
              className={`flex items-start gap-3 rounded-2xl border bg-white p-4 ${
                s.severity === 'risk' ? 'border-rose-200' : s.severity === 'caution' ? 'border-amber-200' : 'border-indigo-200'
              }`}
            >
              {s.severity === 'risk'
                ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                : s.severity === 'caution'
                ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                : <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />}
              <div>
                <p className="text-sm font-medium text-slate-900">{s.title}</p>
                <p className="mt-0.5 text-sm leading-5 text-slate-500">{s.message}</p>
                {s.section && (
                  <span className="mt-2 inline-block text-xs font-medium text-indigo-600">
                    Affects: {s.section}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReviewSection({
  title, icon, badge, badgeStyle, children,
}: {
  title: string; icon: React.ReactNode; badge?: string; badgeStyle?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {icon}{title}
        </div>
        {badge && (
          <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${badgeStyle}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  )
}

function ReviewItem({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm font-medium text-slate-900 ${multiline ? 'whitespace-pre-line leading-relaxed' : ''}`}>
        {value || '—'}
      </p>
    </div>
  )
}

function SidebarStep({ label, status, note }: { label: string; status: 'complete' | 'active' | 'pending' | 'skipped'; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      {status === 'complete' ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
      ) : status === 'active' ? (
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-indigo-500">
          <div className="h-2 w-2 rounded-full bg-indigo-500" />
        </div>
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-slate-200" />
      )}
      <div className="min-w-0">
        <p className={`text-sm font-medium ${status === 'active' ? 'text-slate-900' : status === 'skipped' ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </p>
        {note && <p className="text-xs text-slate-400">{note}</p>}
      </div>
    </div>
  )
}

function SidebarFact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-semibold ${warn ? 'text-rose-600' : 'text-slate-700'}`}>{value}</span>
    </div>
  )
}

function MiniFact({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">{icon}{label}</div>
      <p className={`mt-1 truncate text-sm font-medium ${warn ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
        {warn && <AlertTriangle className="ml-1 inline h-3 w-3 text-rose-400" />}
      </p>
    </div>
  )
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}