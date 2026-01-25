'use client'

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: The following fields must be added to AIAutomationItem in ../context:
//
//   deploymentModel?:    'your_tenant' | 'vendor_hosted' | 'hybrid'
//   oversightLevel?:     'autonomous' | 'human_in_loop' | 'human_on_loop'
//   vendorRetainsData?:  boolean
//   vendorTrainsOnData?: boolean
//   complianceScope?:    string[]
//   exitPlan?:           'decommission' | 'transition_internal' | 'continue_renewal'
//
// Until then, these fields are spread onto items at runtime and will pass
// through any context that doesn't strip unknown keys.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Bell,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cpu,
  DollarSign,
  Eye,
  FileText,
  Lock,
  LogOut,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  AIAutomationItem,
  OveragePolicy,
  ReviewCadence,
  useSOW,
} from '../context'

// ─── Extended types for SOW-level governance ──────────────────────────────────

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

type FormState = {
  name:               string
  category:           AIAutomationItem['category']
  aiPlatform:         string
  businessOwner:      string
  businessOwnerDept:  string
  technicalOwner:     string
  technicalOwnerDept: string
  purpose:            string
  dataClassification: AIAutomationItem['dataClassification']
  accessScope:        string[]
  riskLevel:          AIAutomationItem['riskLevel']
  usageBasedCost:     boolean
  spendCap:           number | undefined
  alertThreshold:     number
  overpagePolicy:     OveragePolicy
  spendApprover:      string
  reviewCadence:      ReviewCadence
  deploymentModel:    DeploymentModel
  oversightLevel:     OversightLevel
  vendorRetainsData:  boolean | null
  vendorTrainsOnData: boolean | null
  complianceScope:    string[]
  exitPlan:           ExitPlan | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORK_TYPE_LABELS: Record<string, string> = {
  consulting:       'Advisory / Consulting',
  managed_services: 'Managed Services',
  implementation:   'Implementation / Project',
  staff_aug:        'Staff Aug (SOW-based)',
  other:            'Other',
}

function isUsageBased(item: ExtendedItem): boolean {
  return item.costModel === 'API Usage' || item.costModel === 'Usage Based'
}

function isSensitiveData(dc: string | undefined): boolean {
  return dc === 'PII' || dc === 'Financial Data' || dc === 'Confidential'
}

// ─── Governance gap logic ─────────────────────────────────────────────────────

type GovernanceGap = { field: string; label: string; severity: 'blocking' | 'warning' }

function getFormGaps(form: FormState, accessScope: string[]): GovernanceGap[] {
  const gaps: GovernanceGap[] = []
  const sensitive = isSensitiveData(form.dataClassification)

  if (!form.technicalOwner?.trim())
    gaps.push({ field: 'technicalOwner', label: 'No technical owner assigned', severity: 'blocking' })
  if (accessScope.length === 0)
    gaps.push({ field: 'accessScope', label: 'Access scope not defined', severity: 'blocking' })
  if (!form.businessOwner?.trim())
    gaps.push({ field: 'businessOwner', label: 'No business owner assigned', severity: 'blocking' })
  if (form.riskLevel === 'High' && (form.dataClassification === 'PII' || form.dataClassification === 'Financial Data'))
    gaps.push({ field: 'risk', label: 'High-risk + sensitive data — DPA required before approval', severity: 'blocking' })
  if (form.usageBasedCost && !form.spendCap)
    gaps.push({ field: 'spendCap', label: 'Usage-based cost requires a monthly spend cap', severity: 'blocking' })
  if (form.usageBasedCost && !form.spendApprover?.trim())
    gaps.push({ field: 'spendApprover', label: 'Spend approver required for usage-based cost', severity: 'blocking' })
  if (!form.purpose?.trim())
    gaps.push({ field: 'purpose', label: 'Purpose not described', severity: 'warning' })
  if (!form.aiPlatform?.trim())
    gaps.push({ field: 'aiPlatform', label: 'AI platform / technology not specified', severity: 'warning' })

  // SOW governance gaps
  if (form.oversightLevel === 'autonomous' && sensitive)
    gaps.push({ field: 'oversight', label: 'Autonomous agent with sensitive data — human-in-the-loop or escalation path required', severity: 'blocking' })
  if (form.deploymentModel === 'vendor_hosted' && sensitive && form.vendorRetainsData === null)
    gaps.push({ field: 'vendorRetainsData', label: 'Vendor-hosted with sensitive data — data retention policy must be confirmed', severity: 'blocking' })
  if (form.vendorTrainsOnData === true && sensitive)
    gaps.push({ field: 'vendorTrainsOnData', label: 'Vendor trains on your data with sensitive classification — requires opt-out clause in SOW', severity: 'blocking' })
  if (form.riskLevel === 'High' && form.exitPlan === null)
    gaps.push({ field: 'exitPlan', label: 'High-risk agent with no exit plan — SOW must define decommission or transition terms', severity: 'blocking' })
  if (form.deploymentModel === 'hybrid')
    gaps.push({ field: 'deployment', label: 'Hybrid deployment — shared responsibility model should be documented in SOW', severity: 'warning' })
  if (form.oversightLevel === 'autonomous' && form.riskLevel === 'Medium' && !sensitive)
    gaps.push({ field: 'oversight', label: 'Autonomous medium-risk agent — consider human-in-the-loop for initial period', severity: 'warning' })
  if (form.complianceScope.includes('GDPR') && form.deploymentModel === 'vendor_hosted')
    gaps.push({ field: 'compliance', label: 'GDPR scope with vendor-hosted deployment — cross-border data transfer review may apply', severity: 'warning' })
  if (form.exitPlan === 'continue_renewal')
    gaps.push({ field: 'exitPlan', label: 'Agent continues under renewal — flagged for contract renewal planning', severity: 'warning' })

  return gaps
}

function getItemGaps(item: ExtendedItem): GovernanceGap[] {
  const gaps: GovernanceGap[] = []
  const usageBased = isUsageBased(item)
  const sensitive  = isSensitiveData(item.dataClassification)

  if (!item.technicalOwner?.trim())
    gaps.push({ field: 'technicalOwner', label: 'No technical owner assigned', severity: 'blocking' })
  if (!item.accessScope || item.accessScope.length === 0)
    gaps.push({ field: 'accessScope', label: 'Access scope not defined', severity: 'blocking' })
  if (!item.businessOwner?.trim())
    gaps.push({ field: 'businessOwner', label: 'No business owner assigned', severity: 'blocking' })
  if (item.riskLevel === 'High' && (item.dataClassification === 'PII' || item.dataClassification === 'Financial Data'))
    gaps.push({ field: 'risk', label: 'High-risk + sensitive data — DPA required before approval', severity: 'blocking' })
  if (usageBased && !item.spendCap)
    gaps.push({ field: 'spendCap', label: 'Usage-based cost requires a monthly spend cap', severity: 'blocking' })
  if (usageBased && !item.spendApprover?.trim())
    gaps.push({ field: 'spendApprover', label: 'Spend approver required for usage-based cost', severity: 'blocking' })
  if (!item.purpose?.trim())
    gaps.push({ field: 'purpose', label: 'Purpose not described', severity: 'warning' })
  if (!item.aiPlatform?.trim())
    gaps.push({ field: 'aiPlatform', label: 'AI platform / technology not specified', severity: 'warning' })

  if (item.oversightLevel === 'autonomous' && sensitive)
    gaps.push({ field: 'oversight', label: 'Autonomous agent with sensitive data — human-in-the-loop or escalation path required', severity: 'blocking' })
  if (item.deploymentModel === 'vendor_hosted' && sensitive && item.vendorRetainsData === undefined)
    gaps.push({ field: 'vendorRetainsData', label: 'Vendor-hosted with sensitive data — data retention policy must be confirmed', severity: 'blocking' })
  if (item.vendorTrainsOnData === true && sensitive)
    gaps.push({ field: 'vendorTrainsOnData', label: 'Vendor trains on your data with sensitive classification — requires opt-out clause in SOW', severity: 'blocking' })
  if (item.riskLevel === 'High' && !item.exitPlan)
    gaps.push({ field: 'exitPlan', label: 'High-risk agent with no exit plan — SOW must define decommission or transition terms', severity: 'blocking' })
  if (item.deploymentModel === 'hybrid')
    gaps.push({ field: 'deployment', label: 'Hybrid deployment — shared responsibility model should be documented in SOW', severity: 'warning' })
  if (item.oversightLevel === 'autonomous' && item.riskLevel === 'Medium' && !sensitive)
    gaps.push({ field: 'oversight', label: 'Autonomous medium-risk agent — consider human-in-the-loop for initial period', severity: 'warning' })
  if (item.complianceScope?.includes('GDPR') && item.deploymentModel === 'vendor_hosted')
    gaps.push({ field: 'compliance', label: 'GDPR scope with vendor-hosted deployment — cross-border data transfer review may apply', severity: 'warning' })
  if (item.exitPlan === 'continue_renewal')
    gaps.push({ field: 'exitPlan', label: 'Agent continues under renewal — flagged for contract renewal planning', severity: 'warning' })

  return gaps
}

function getGovernanceScore(item: ExtendedItem): 'complete' | 'gaps' | 'critical' {
  const gaps = getItemGaps(item)
  if (gaps.some(g => g.severity === 'blocking')) return 'critical'
  if (gaps.length > 0) return 'gaps'
  return 'complete'
}

// ─── Nova flags ───────────────────────────────────────────────────────────────

type NovaFlag = { severity: 'blocking' | 'warning' | 'ok'; message: string }

function buildNovaFlags(items: ExtendedItem[]): NovaFlag[] {
  if (items.length === 0) return []
  const flags: NovaFlag[] = []

  const noTechOwner       = items.filter(i => !i.technicalOwner?.trim())
  const noAccessScope     = items.filter(i => !i.accessScope || i.accessScope.length === 0)
  const highRiskSensitive = items.filter(i => i.riskLevel === 'High' && (i.dataClassification === 'PII' || i.dataClassification === 'Financial Data'))
  const usageNoCap        = items.filter(i => isUsageBased(i) && !i.spendCap)
  const highRisk          = items.filter(i => i.riskLevel === 'High')
  const usageWithCap      = items.filter(i => isUsageBased(i) && i.spendCap)
  const autonomousSensitive = items.filter(i => i.oversightLevel === 'autonomous' && isSensitiveData(i.dataClassification))
  const vendorTraining      = items.filter(i => i.vendorTrainsOnData === true && isSensitiveData(i.dataClassification))
  const noExitPlan          = items.filter(i => i.riskLevel === 'High' && !i.exitPlan)

  if (noTechOwner.length > 0)
    flags.push({ severity: 'blocking', message: `${noTechOwner.map(i => i.name).join(', ')} ${noTechOwner.length === 1 ? 'has' : 'have'} no technical owner — required before SOW approval.` })
  if (noAccessScope.length > 0)
    flags.push({ severity: 'blocking', message: `Access scope undefined for ${noAccessScope.map(i => i.name).join(', ')}. IT security review cannot proceed without it.` })
  if (highRiskSensitive.length > 0)
    flags.push({ severity: 'blocking', message: `${highRiskSensitive.map(i => i.name).join(', ')} ${highRiskSensitive.length === 1 ? 'is' : 'are'} high-risk with sensitive data access. A data processing agreement must be attached.` })
  if (usageNoCap.length > 0)
    flags.push({ severity: 'blocking', message: `${usageNoCap.map(i => i.name).join(', ')} ${usageNoCap.length === 1 ? 'has' : 'have'} variable cost but no spend cap. Uncapped usage is a financial control risk.` })
  if (autonomousSensitive.length > 0)
    flags.push({ severity: 'blocking', message: `${autonomousSensitive.map(i => i.name).join(', ')} ${autonomousSensitive.length === 1 ? 'runs' : 'run'} autonomously with sensitive data. Human oversight or an escalation path is required.` })
  if (vendorTraining.length > 0)
    flags.push({ severity: 'blocking', message: `${vendorTraining.map(i => i.name).join(', ')} — vendor can train on your sensitive data. An opt-out clause must be included in the SOW.` })
  if (noExitPlan.length > 0)
    flags.push({ severity: 'blocking', message: `${noExitPlan.map(i => i.name).join(', ')} ${noExitPlan.length === 1 ? 'is' : 'are'} high-risk with no exit plan. SOW must define what happens at contract end.` })

  if (highRisk.length > 0 && highRiskSensitive.length === 0)
    flags.push({ severity: 'warning', message: `${highRisk.length} high-risk agent${highRisk.length > 1 ? 's' : ''} will require quarterly recertification after activation.` })
  if (usageWithCap.length > 0) {
    const totalCap = usageWithCap.reduce((s, i) => s + (i.spendCap || 0), 0)
    flags.push({ severity: 'warning', message: `$${totalCap.toLocaleString()}/mo in variable AI spend is under active governance. Nova will alert approvers at defined thresholds.` })
  }
  const vendorHostedGdpr = items.filter(i => i.complianceScope?.includes('GDPR') && i.deploymentModel === 'vendor_hosted')
  if (vendorHostedGdpr.length > 0)
    flags.push({ severity: 'warning', message: `${vendorHostedGdpr.map(i => i.name).join(', ')} — GDPR scope with vendor-hosted deployment. Cross-border data transfer review may apply.` })
  const hybrid = items.filter(i => i.deploymentModel === 'hybrid')
  if (hybrid.length > 0)
    flags.push({ severity: 'warning', message: `${hybrid.map(i => i.name).join(', ')} ${hybrid.length === 1 ? 'uses' : 'use'} hybrid deployment. Shared responsibility model should be documented in the SOW.` })

  if (flags.length === 0)
    flags.push({ severity: 'ok', message: `All ${items.length} item${items.length > 1 ? 's' : ''} have complete governance profiles. Digital worker records will be created in Pending Review on SOW approval.` })
  return flags
}

// ─── Review artifact logic ────────────────────────────────────────────────────

type ReviewArtifact = { label: string; detail: string; iconType: 'privacy' | 'security' | 'legal' | 'finance' }

function getApplicableArtifacts(items: ExtendedItem[]): ReviewArtifact[] {
  if (items.length === 0) return []
  const artifacts: ReviewArtifact[] = []
  const hasSensitiveData = items.some(i => isSensitiveData(i.dataClassification))
  const hasAccessScope   = items.some(i => i.accessScope && i.accessScope.length > 0)
  const hasHighRisk      = items.some(i => i.riskLevel === 'High')
  const hasUsageBased    = items.some(i => isUsageBased(i))
  const hasCompliance    = items.some(i => i.complianceScope && i.complianceScope.length > 0)
  const hasVendorHosted  = items.some(i => i.deploymentModel === 'vendor_hosted' || i.deploymentModel === 'hybrid')

  if (hasSensitiveData || hasVendorHosted) {
    artifacts.push({
      label: 'Data privacy impact assessment',
      detail: hasVendorHosted && hasSensitiveData
        ? 'Vendor-hosted with sensitive data — retention and residency review'
        : hasSensitiveData ? 'Pre-filled from data classification and access scope'
        : 'Vendor-hosted deployment — data residency review',
      iconType: 'privacy',
    })
  }
  if (hasAccessScope) {
    const allSystems = [...new Set(items.flatMap(i => i.accessScope || []))]
    artifacts.push({
      label: 'Security review package',
      detail: allSystems.length <= 3 ? `Scoped to ${allSystems.join(', ')}` : `Scoped to ${allSystems.length} systems in access list`,
      iconType: 'security',
    })
  }
  if (hasHighRisk || hasSensitiveData || hasCompliance) {
    const regs = [...new Set(items.flatMap(i => i.complianceScope || []))]
    artifacts.push({
      label: 'Legal & DPA checklist',
      detail: regs.length > 0 ? `${regs.join(', ')} compliance + DPA terms`
        : hasHighRisk && hasSensitiveData ? 'DPA required — high risk with sensitive data'
        : hasHighRisk ? 'Triggered by high-risk classification'
        : 'Triggered by sensitive data access',
      iconType: 'legal',
    })
  }
  if (hasUsageBased) {
    artifacts.push({ label: 'Spend governance record', detail: 'Cap, threshold, and escalation policy', iconType: 'finance' })
  }
  return artifacts
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: AIAutomationItem['category'][]             = ['AI Agent', 'Automation Bot', 'AI Platform', 'Workflow Assistant']
const DATA_CLASSES: AIAutomationItem['dataClassification'][] = ['Public', 'Internal', 'Confidential', 'PII', 'Financial Data']
const RISK_LEVELS: AIAutomationItem['riskLevel'][]           = ['Low', 'Medium', 'High']
const ALERT_THRESHOLDS                                       = [60, 70, 80, 90]

const OVERAGE_POLICIES: { value: OveragePolicy; label: string; description: string }[] = [
  { value: 'hard_stop',     label: 'Hard Stop',            description: 'Agent is paused automatically when cap is reached' },
  { value: 'escalate',      label: 'Escalate to Approver', description: 'Nova routes a work item for approval to continue' },
  { value: 'continue_flag', label: 'Continue & Flag',      description: 'Agent continues; Nova flags for review at end of period' },
]

const REVIEW_CADENCES: { value: ReviewCadence; label: string }[] = [
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly' },
  { value: 'at_renewal', label: 'At SOW Renewal' },
]

const AI_PLATFORM_SUGGESTIONS = [
  'Azure OpenAI', 'OpenAI API', 'AWS Bedrock', 'Google Vertex AI',
  'UiPath', 'Automation Anywhere', 'Microsoft Copilot', 'Salesforce Einstein',
]

const DEPLOYMENT_OPTIONS: { value: DeploymentModel; label: string; description: string }[] = [
  { value: 'your_tenant',   label: 'Your tenant',      description: 'Runs in your cloud environment — you control infrastructure and data residency' },
  { value: 'vendor_hosted', label: 'Vendor hosted',     description: 'Runs in the vendor\'s environment — data leaves your perimeter' },
  { value: 'hybrid',        label: 'Hybrid',            description: 'Spans both environments — shared responsibility model applies' },
]

const OVERSIGHT_OPTIONS: { value: OversightLevel; label: string; description: string }[] = [
  { value: 'human_in_loop', label: 'Human-in-the-loop', description: 'Agent recommends actions — a human approves before execution' },
  { value: 'human_on_loop', label: 'Human-on-the-loop', description: 'Agent acts autonomously — a human reviews outcomes after the fact' },
  { value: 'autonomous',    label: 'Fully autonomous',  description: 'Agent acts without human approval — decisions are executed automatically' },
]

const EXIT_OPTIONS: { value: ExitPlan; label: string; description: string }[] = [
  { value: 'decommission',        label: 'Decommission',            description: 'Agent is shut down when SOW ends — all data and access revoked' },
  { value: 'transition_internal', label: 'Transition to internal',  description: 'Your team takes over operation and maintenance' },
  { value: 'continue_renewal',    label: 'Continue under renewal',  description: 'Agent continues operating under a renewed or extended SOW' },
]

const COMPLIANCE_OPTIONS = ['GDPR', 'SOC 2', 'HIPAA', 'EU AI Act', 'CCPA', 'Internal Policy']

const emptyForm: FormState = {
  name: '', category: 'AI Agent', aiPlatform: '', businessOwner: '', businessOwnerDept: '',
  technicalOwner: '', technicalOwnerDept: '', purpose: '', dataClassification: 'Internal',
  accessScope: [], riskLevel: 'Medium', usageBasedCost: false, spendCap: undefined,
  alertThreshold: 80, overpagePolicy: 'escalate', spendApprover: '', reviewCadence: 'quarterly',
  deploymentModel: 'your_tenant', oversightLevel: 'human_in_loop',
  vendorRetainsData: null, vendorTrainsOnData: null, complianceScope: [], exitPlan: null,
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
const DEPLOYMENT_LABEL: Record<DeploymentModel, string> = {
  your_tenant: 'Your tenant', vendor_hosted: 'Vendor hosted', hybrid: 'Hybrid',
}
const OVERSIGHT_LABEL: Record<OversightLevel, string> = {
  human_in_loop: 'Human-in-loop', human_on_loop: 'Human-on-loop', autonomous: 'Autonomous',
}
const EXIT_LABEL: Record<ExitPlan, string> = {
  decommission: 'Decommission', transition_internal: 'Transition internal', continue_renewal: 'Continue / renew',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIAutomationPage() {
  const router = useRouter()
  const { sow, setSOW } = useSOW()
  const workTypeLabel = WORK_TYPE_LABELS[sow.workType ?? ''] ?? sow.workType ?? 'Unknown'

  const [gateAnswer, setGateAnswer] = useState<'yes' | 'no' | null>(sow.aiGateAnswer ?? null)
  const [items, setItems]           = useState<ExtendedItem[]>((sow.aiAutomation ?? []) as ExtendedItem[])
  const [form, setForm]             = useState<FormState>(emptyForm)
  const [accessInput, setAccessInput] = useState('')
  const [errors, setErrors]         = useState<Set<string>>(new Set())
  const [showForm, setShowForm]     = useState(items.length === 0)

  const novaFlags       = useMemo(() => buildNovaFlags(items), [items])
  const artifacts       = useMemo(() => getApplicableArtifacts(items), [items])
  const blockingCount   = novaFlags.filter(f => f.severity === 'blocking').length
  const usageBasedItems = items.filter(i => isUsageBased(i))
  const accessChips     = accessInput.split(',').map(s => s.trim()).filter(Boolean)

  const liveGaps = useMemo(() => {
    if (!form.name.trim()) return []
    return getFormGaps(form, accessInput.split(',').map(s => s.trim()).filter(Boolean))
  }, [form, accessInput])

  function validate(): boolean {
    const e = new Set<string>()
    if (!form.name.trim()) e.add('name')
    setErrors(e)
    return e.size === 0
  }

  function handleAdd() {
    if (!validate()) return
    const parsed = accessInput.split(',').map(s => s.trim()).filter(Boolean)
    const newItem: ExtendedItem = {
      id: `AI-${Date.now()}`,
      name: form.name, category: form.category, aiPlatform: form.aiPlatform,
      purpose: form.purpose, dataClassification: form.dataClassification, riskLevel: form.riskLevel,
      businessOwner: [form.businessOwner, form.businessOwnerDept].filter(Boolean).join(' · '),
      technicalOwner: [form.technicalOwner, form.technicalOwnerDept].filter(Boolean).join(' · '),
      costModel: form.usageBasedCost ? 'API Usage' : 'Fixed Fee',
      accessScope: parsed,
      ...(form.usageBasedCost
        ? { spendCap: form.spendCap, alertThreshold: form.alertThreshold, overpagePolicy: form.overpagePolicy, spendApprover: form.spendApprover, reviewCadence: form.reviewCadence }
        : {}),
      deploymentModel: form.deploymentModel,
      oversightLevel: form.oversightLevel,
      vendorRetainsData: form.vendorRetainsData ?? undefined,
      vendorTrainsOnData: form.vendorTrainsOnData ?? undefined,
      complianceScope: form.complianceScope,
      exitPlan: form.exitPlan ?? undefined,
    }
    const updated = [...items, newItem]
    setItems(updated)
    setSOW({ aiAutomation: updated as AIAutomationItem[] })
    setForm(emptyForm)
    setAccessInput('')
    setErrors(new Set())
    setShowForm(false)
  }

  function handleRemove(id: string) {
    const updated = items.filter(i => i.id !== id)
    setItems(updated)
    setSOW({ aiAutomation: updated as AIAutomationItem[] })
    if (updated.length === 0) setShowForm(true)
  }

  function handleGateAnswer(answer: 'yes' | 'no') {
    setGateAnswer(answer)
    setSOW({ aiGateAnswer: answer })
    if (answer === 'no') setItems([])
  }

  function handleContinue() {
    setSOW({ aiAutomation: items as AIAutomationItem[], aiGateAnswer: gateAnswer })
    router.push('/requests/sow/create/review')
  }

  function toggleCompliance(value: string) {
    setForm(prev => ({
      ...prev,
      complianceScope: prev.complianceScope.includes(value)
        ? prev.complianceScope.filter(v => v !== value)
        : [...prev.complianceScope, value],
    }))
  }

  return (
    <PageShell workTypeLabel={workTypeLabel}>

      {/* ── Gate question ── */}
      <div className={`rounded-3xl border p-6 shadow-sm transition-colors ${
        gateAnswer === null ? 'border-indigo-200 bg-indigo-50'
        : gateAnswer === 'yes' ? 'border-emerald-200 bg-emerald-50'
        : 'border-slate-200 bg-white'
      }`}>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
            <Bot className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">
              Will this SOW result in an AI agent or automation tool operating in your environment?
            </p>
            <p className="mt-1 text-sm text-slate-500">
              This means AI systems that remain active after the SOW closes — not tools the supplier uses internally to deliver the work.
            </p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => handleGateAnswer('yes')} className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition ${gateAnswer === 'yes' ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'}`}>
                Yes — register AI items
              </button>
              <button onClick={() => handleGateAnswer('no')} className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition ${gateAnswer === 'no' ? 'border-slate-500 bg-slate-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                No — skip this step
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Skipped ── */}
      {gateAnswer === 'no' && (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No AI items will be registered for this SOW.</p>
          <p className="mt-1 text-xs text-slate-400">You can add items from the SOW detail view after submission if needed.</p>
          <button onClick={handleContinue} className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-10 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Continue to Review <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Main surface ── */}
      {gateAnswer === 'yes' && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard icon={<Bot className="h-5 w-5" />} label="AI Items" value={items.length.toString()} />
            <MetricCard icon={<Zap className="h-5 w-5" />} label="Variable Cost" value={usageBasedItems.length.toString()} />
            <MetricCard icon={<ShieldAlert className="h-5 w-5" />} label="High Risk" value={items.filter(i => i.riskLevel === 'High').length.toString()} alert={items.some(i => i.riskLevel === 'High')} />
            <MetricCard icon={<XCircle className="h-5 w-5" />} label="Blocking Gaps" value={blockingCount.toString()} alert={blockingCount > 0} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            {/* ── Left ── */}
            <div className="space-y-4">
              {items.map(item => <ItemCard key={item.id} item={item} onRemove={handleRemove} />)}

              {showForm ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold">Add AI / automation item</h2>
                      <p className="text-sm text-slate-400">Fields marked * are required for governance approval.</p>
                    </div>
                    {items.length > 0 && (
                      <button onClick={() => setShowForm(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                    )}
                  </div>

                  <div className="space-y-5">

                    {/* ── Identity ── */}
                    <SectionDivider label="Identity" />

                    <FormField label="Agent / tool name" required error={errors.has('name') ? 'Required' : undefined}>
                      <input value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setErrors(new Set()) }} placeholder="e.g. Invoice Exception Agent, UiPath Orchestrator" className={inputCls(errors.has('name'))} />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Category">
                        <SelectInput value={form.category!} onChange={v => setForm({ ...form, category: v as AIAutomationItem['category'] })} options={CATEGORIES} />
                      </FormField>
                      <FormField label="Risk level" required>
                        <SelectInput value={form.riskLevel!} onChange={v => setForm({ ...form, riskLevel: v as AIAutomationItem['riskLevel'] })} options={RISK_LEVELS} />
                      </FormField>
                    </div>

                    <FormField label="AI platform / technology" helperText="The underlying tech stack deployed in your environment — not the SI or supplier delivering this SOW.">
                      <input value={form.aiPlatform ?? ''} onChange={e => setForm({ ...form, aiPlatform: e.target.value })} placeholder="e.g. Azure OpenAI, UiPath, AWS Bedrock, Google Vertex AI" className={inputCls(false)} list="ai-platform-suggestions" />
                      <datalist id="ai-platform-suggestions">{AI_PLATFORM_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist>
                    </FormField>

                    <FormField label="Purpose">
                      <textarea value={form.purpose ?? ''} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="What will this agent do in your environment after this SOW closes?" rows={3} className={`${inputCls(false)} resize-none`} />
                    </FormField>

                    {/* ── Deployment & Oversight ── */}
                    <SectionDivider label="Deployment & Oversight" />

                    <FormField label="Deployment model" required helperText="Where does this agent run after the SOW closes?">
                      <div className="space-y-2">
                        {DEPLOYMENT_OPTIONS.map(d => (
                          <RadioCard key={d.value} selected={form.deploymentModel === d.value} onClick={() => setForm({ ...form, deploymentModel: d.value })} label={d.label} description={d.description} />
                        ))}
                      </div>
                    </FormField>

                    <FormField label="Human oversight" required helperText="How much autonomy does this agent have over decisions and actions?">
                      <div className="space-y-2">
                        {OVERSIGHT_OPTIONS.map(o => (
                          <RadioCard key={o.value} selected={form.oversightLevel === o.value} onClick={() => setForm({ ...form, oversightLevel: o.value })} label={o.label} description={o.description} warn={o.value === 'autonomous'} />
                        ))}
                      </div>
                    </FormField>

                    {/* ── Ownership ── */}
                    <SectionDivider label="Ownership" />

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business Owner</p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Full name" required>
                          <input value={form.businessOwner ?? ''} onChange={e => setForm({ ...form, businessOwner: e.target.value })} placeholder="e.g. Sarah Chen" className={inputCls(false)} />
                        </FormField>
                        <FormField label="Business unit">
                          <input value={form.businessOwnerDept} onChange={e => setForm({ ...form, businessOwnerDept: e.target.value })} placeholder="e.g. Legal, Finance, Marketing" className={inputCls(false)} />
                        </FormField>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Technical Owner</p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Full name" required>
                          <input value={form.technicalOwner ?? ''} onChange={e => setForm({ ...form, technicalOwner: e.target.value })} placeholder="e.g. James Park" className={inputCls(false)} />
                        </FormField>
                        <FormField label="Team">
                          <input value={form.technicalOwnerDept} onChange={e => setForm({ ...form, technicalOwnerDept: e.target.value })} placeholder="e.g. Platform Engineering, IT" className={inputCls(false)} />
                        </FormField>
                      </div>
                    </div>

                    {/* ── Data & Access ── */}
                    <SectionDivider label="Data & Access" />

                    <FormField label="Data classification" required>
                      <SelectInput value={form.dataClassification!} onChange={v => setForm({ ...form, dataClassification: v as AIAutomationItem['dataClassification'] })} options={DATA_CLASSES} />
                    </FormField>

                    <FormField label="Access scope" required helperText="Systems and data stores this agent will access. Comma-separated.">
                      <input value={accessInput} onChange={e => setAccessInput(e.target.value)} placeholder="SharePoint, Contract Repository, AP Queue…" className={inputCls(false)} />
                      {accessChips.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {accessChips.map(c => (
                            <span key={c} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                              <Lock className="h-3 w-3 text-slate-400" />{c}
                            </span>
                          ))}
                        </div>
                      )}
                    </FormField>

                    {/* ── Data Handling ── */}
                    <SectionDivider label="Data Handling" />

                    <FormField label="Does the vendor retain data this agent processes?" required helperText="Beyond the active session — includes logs, training sets, and analytics.">
                      <div className="grid grid-cols-2 gap-3">
                        <YesNoButton selected={form.vendorRetainsData === true} onClick={() => setForm({ ...form, vendorRetainsData: true })} label="Yes" />
                        <YesNoButton selected={form.vendorRetainsData === false} onClick={() => setForm({ ...form, vendorRetainsData: false })} label="No" />
                      </div>
                    </FormField>

                    <FormField label="Can the vendor use your data to train their AI models?" required helperText="Includes fine-tuning, RLHF, and model improvement — even if anonymized.">
                      <div className="grid grid-cols-2 gap-3">
                        <YesNoButton selected={form.vendorTrainsOnData === true} onClick={() => setForm({ ...form, vendorTrainsOnData: true })} label="Yes" warn />
                        <YesNoButton selected={form.vendorTrainsOnData === false} onClick={() => setForm({ ...form, vendorTrainsOnData: false })} label="No" />
                      </div>
                      {form.vendorTrainsOnData === true && isSensitiveData(form.dataClassification) && (
                        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                          <p className="flex items-start gap-1.5 text-xs text-rose-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            Vendor training on sensitive data requires an explicit opt-out clause in the SOW.
                          </p>
                        </div>
                      )}
                    </FormField>

                    {/* ── Compliance ── */}
                    <SectionDivider label="Compliance" />

                    <FormField label="Applicable regulations" helperText="Select all that apply to this agent's operation and data handling.">
                      <div className="flex flex-wrap gap-2">
                        {COMPLIANCE_OPTIONS.map(c => (
                          <button key={c} type="button" onClick={() => toggleCompliance(c)}
                            className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                              form.complianceScope.includes(c) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}>{c}</button>
                        ))}
                      </div>
                    </FormField>

                    {/* ── SOW Exit ── */}
                    <SectionDivider label="SOW Exit" />

                    <FormField label="What happens when this SOW ends?" required helperText="Defines the agent's lifecycle beyond the contract term.">
                      <div className="space-y-2">
                        {EXIT_OPTIONS.map(e => (
                          <RadioCard key={e.value} selected={form.exitPlan === e.value} onClick={() => setForm({ ...form, exitPlan: e.value })} label={e.label} description={e.description} />
                        ))}
                      </div>
                    </FormField>

                    {/* ── Spend Governance ── */}
                    <SectionDivider label="Spend Governance" />

                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-700">Cost type</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setForm({ ...form, usageBasedCost: false })}
                          className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${!form.usageBasedCost ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${!form.usageBasedCost ? 'border-white' : 'border-slate-300'}`}>
                            {!form.usageBasedCost && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${!form.usageBasedCost ? 'text-white' : 'text-slate-900'}`}>Fixed cost</p>
                            <p className={`mt-0.5 text-xs ${!form.usageBasedCost ? 'text-slate-300' : 'text-slate-500'}`}>Subscription, flat fee, or included in contract — no variable spend exposure</p>
                          </div>
                        </button>
                        <button type="button" onClick={() => setForm({ ...form, usageBasedCost: true })}
                          className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${form.usageBasedCost ? 'border-amber-500 bg-amber-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${form.usageBasedCost ? 'border-white' : 'border-slate-300'}`}>
                            {form.usageBasedCost && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${form.usageBasedCost ? 'text-white' : 'text-slate-900'}`}>Variable / usage-based</p>
                            <p className={`mt-0.5 text-xs ${form.usageBasedCost ? 'text-amber-100' : 'text-slate-500'}`}>Billed per API call or consumption — requires spend cap and escalation policy</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {form.usageBasedCost ? (
                      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                        <div className="flex items-start gap-3">
                          <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                          <div>
                            <p className="text-sm font-semibold text-amber-900">Spend governance required</p>
                            <p className="mt-0.5 text-xs leading-5 text-amber-700">Define a monthly cap and what Nova should do when it's reached.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField label="Monthly spend cap (USD)" required>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">$</span>
                              <input type="number" min="0" value={form.spendCap ?? ''} onChange={e => setForm({ ...form, spendCap: Number(e.target.value) || undefined })} placeholder="3000" className={`${inputCls(false)} pl-7`} />
                            </div>
                          </FormField>
                          <FormField label="Alert threshold" helperText="% of cap that triggers a Nova work item">
                            <div className="relative">
                              <select value={form.alertThreshold ?? 80} onChange={e => setForm({ ...form, alertThreshold: Number(e.target.value) })} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-8 text-sm text-slate-900 outline-none focus:border-slate-400">
                                {ALERT_THRESHOLDS.map(t => <option key={t} value={t}>{t}% of cap</option>)}
                              </select>
                              <ChevronRight className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 rotate-90 text-slate-400" />
                            </div>
                          </FormField>
                        </div>
                        <FormField label="When the cap is reached" required>
                          <div className="space-y-2">
                            {OVERAGE_POLICIES.map(p => (
                              <button key={p.value} type="button" onClick={() => setForm({ ...form, overpagePolicy: p.value })}
                                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${form.overpagePolicy === p.value ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${form.overpagePolicy === p.value ? 'border-white' : 'border-slate-300'}`}>
                                  {form.overpagePolicy === p.value && <div className="h-2 w-2 rounded-full bg-white" />}
                                </div>
                                <div>
                                  <p className={`text-sm font-medium ${form.overpagePolicy === p.value ? 'text-white' : 'text-slate-900'}`}>{p.label}</p>
                                  <p className={`text-xs ${form.overpagePolicy === p.value ? 'text-slate-300' : 'text-slate-500'}`}>{p.description}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </FormField>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField label="Spend approver" required helperText="Who Nova routes the escalation to">
                            <input value={form.spendApprover ?? ''} onChange={e => setForm({ ...form, spendApprover: e.target.value })} placeholder="e.g. James Park" className={inputCls(false)} />
                          </FormField>
                          <FormField label="Review cadence">
                            <div className="relative">
                              <select value={form.reviewCadence ?? 'quarterly'} onChange={e => setForm({ ...form, reviewCadence: e.target.value as ReviewCadence })} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-8 text-sm text-slate-900 outline-none focus:border-slate-400">
                                {REVIEW_CADENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                              <ChevronRight className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 rotate-90 text-slate-400" />
                            </div>
                          </FormField>
                        </div>
                        {form.spendCap && form.alertThreshold && (
                          <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                            <p className="text-xs text-amber-800">
                              <Bell className="mr-1 inline h-3.5 w-3.5" />
                              Nova will alert <span className="font-medium">{form.spendApprover || 'the approver'}</span> when spend reaches{' '}
                              <span className="font-medium">${Math.round((form.spendCap * form.alertThreshold) / 100).toLocaleString()}</span>
                              {' '}({form.alertThreshold}% of the ${form.spendCap.toLocaleString()}/mo cap).
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">
                          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-500" />
                          Fixed cost — no variable spend exposure. No spend governance required.
                        </p>
                      </div>
                    )}

                    {/* Live gap preview */}
                    {form.name.trim() && liveGaps.length > 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="mb-2 text-xs font-semibold text-amber-800">Nova · Governance gaps before adding</p>
                        <ul className="space-y-1">
                          {liveGaps.map((g, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                              {g.severity === 'blocking' ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                              {g.label}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-amber-700">You can add this item now — gaps must be resolved before SOW approval.</p>
                      </div>
                    )}

                    {form.name.trim() && liveGaps.length === 0 && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Governance profile complete — ready for SOW submission.
                        </div>
                      </div>
                    )}

                    <button onClick={handleAdd} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800">
                      <Plus className="h-4 w-4" /> Add to SOW
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowForm(true)} className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white py-5 text-sm font-medium text-slate-500 hover:border-slate-400 hover:bg-slate-50">
                  <Plus className="h-4 w-4" /> Add another AI / automation item
                </button>
              )}
            </div>

            {/* ── Right: Nova ── */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-indigo-900">Nova · AI Governance</h3>
                </div>

                {items.length === 0 ? (
                  <p className="text-sm leading-6 text-indigo-700">
                    Add an AI item and Nova will evaluate deployment, oversight, ownership, data handling, compliance, and spend governance — blocking SOW approval until critical gaps are resolved.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {novaFlags.map((flag, i) => (
                      <div key={i} className={`flex items-start gap-2.5 rounded-2xl border bg-white p-3 ${flag.severity === 'blocking' ? 'border-rose-200' : flag.severity === 'warning' ? 'border-amber-200' : 'border-emerald-200'}`}>
                        {flag.severity === 'blocking' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                          : flag.severity === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
                        <p className={`text-xs leading-5 ${flag.severity === 'blocking' ? 'text-rose-800' : flag.severity === 'warning' ? 'text-amber-800' : 'text-emerald-800'}`}>{flag.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {items.length > 0 && (
                  <div className="mt-5 space-y-3 border-t border-indigo-200 pt-4">
                    {artifacts.length > 0 ? (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">PACKAGES NEEDED</p>
                        {artifacts.map((a, i) => <ArtifactRow key={i} artifact={a} />)}
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">On SOW approval</p>
                        <GovernanceCheckItem label="Digital worker records created in Pending Review" />
                      </>
                    )}
                    {blockingCount > 0 && (
                      <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                        <p className="text-xs font-medium text-rose-700">{blockingCount} blocking gap{blockingCount !== 1 ? 's' : ''} must be resolved before SOW approval.</p>
                      </div>
                    )}
                    <p className="text-xs text-indigo-600"></p>
                  </div>
                )}
              </div>

              {usageBasedItems.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-700">Variable spend governance</p>
                  </div>
                  <div className="space-y-2">
                    {usageBasedItems.map(item => (
                      <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs font-medium text-slate-700">{item.name}</span>
                          {item.spendCap ? <span className="ml-2 shrink-0 text-xs font-semibold text-slate-900">${item.spendCap.toLocaleString()}/mo cap</span> : <span className="ml-2 shrink-0 text-xs font-medium text-rose-600">No cap set</span>}
                        </div>
                        {item.spendCap && item.alertThreshold && (
                          <p className="mt-1 text-xs text-slate-400">Alert at {item.alertThreshold}% · {OVERAGE_POLICIES.find(p => p.value === item.overpagePolicy)?.label ?? '—'}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="flex items-center justify-between border-t border-slate-200 pt-6">
            <p className="text-sm text-slate-400">
              {items.length === 0 ? 'No AI items added yet.' : `${items.length} item${items.length !== 1 ? 's' : ''} · ${blockingCount > 0 ? `${blockingCount} blocking gap${blockingCount !== 1 ? 's' : ''}` : 'governance complete'}`}
            </p>
            <button onClick={handleContinue} className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-10 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
              Continue <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </footer>
        </>
      )}

      {gateAnswer === null && (
        <footer className="flex justify-end border-t border-slate-200 pt-6">
          <button onClick={handleContinue} className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-10 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50">
            Skip for now <ChevronRight className="h-4 w-4" />
          </button>
        </footer>
      )}
    </PageShell>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function PageShell({ workTypeLabel, children }: { workTypeLabel: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
            <Bot className="h-4 w-4" />AI & Automation
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">AI & Automation</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Register any AI agent, automation platform, or bot that will operate in your environment after this SOW closes.
            Levv creates a governed digital worker record — covering deployment, oversight, data handling, compliance, and spend — on SOW approval.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
            <Briefcase className="h-3.5 w-3.5" />{workTypeLabel}
          </div>
        </section>
        {children}
      </div>
    </main>
  )
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onRemove }: { item: ExtendedItem; onRemove: (id: string) => void }) {
  const gaps = getItemGaps(item)
  const score = getGovernanceScore(item)
  const usageBased = isUsageBased(item)

  return (
    <div className={`rounded-3xl border bg-white p-6 shadow-sm ${score === 'critical' ? 'border-rose-200' : score === 'gaps' ? 'border-amber-200' : 'border-emerald-200'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${score === 'critical' ? 'bg-rose-50' : score === 'gaps' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            <Bot className={`h-5 w-5 ${score === 'critical' ? 'text-rose-600' : score === 'gaps' ? 'text-amber-600' : 'text-emerald-600'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{item.name}</h3>
            <p className="text-xs text-slate-400">{item.category}{item.aiPlatform ? ` · ${item.aiPlatform}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${score === 'critical' ? 'border-rose-200 bg-rose-50 text-rose-700' : score === 'gaps' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {score === 'critical' ? <XCircle className="h-3 w-3" /> : score === 'gaps' ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {score === 'critical' ? 'Governance gaps' : score === 'gaps' ? 'Warnings' : 'Complete'}
          </span>
          <button onClick={() => onRemove(item.id)} className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {item.purpose && <p className="mt-3 text-sm leading-5 text-slate-500 line-clamp-2">{item.purpose}</p>}

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
        <MiniFact icon={<DollarSign className="h-3.5 w-3.5" />} label={usageBased ? 'Spend cap' : 'Cost type'} value={usageBased ? (item.spendCap ? `$${item.spendCap.toLocaleString()}/mo` : 'No cap set') : 'Fixed'} warn={usageBased && !item.spendCap} />
      </div>

      {usageBased && item.spendCap && (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5">
          <p className="text-xs text-amber-800">
            <Bell className="mr-1 inline h-3.5 w-3.5" />
            Alert at <span className="font-medium">{item.alertThreshold}%</span>{' '}
            (${Math.round((item.spendCap * (item.alertThreshold || 80)) / 100).toLocaleString()}) ·{' '}
            <span className="font-medium">{OVERAGE_POLICIES.find(p => p.value === item.overpagePolicy)?.label}</span>
            {item.spendApprover ? ` → ${item.spendApprover}` : ''}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {item.riskLevel && <Pill className={riskPill[item.riskLevel]}>{item.riskLevel} risk</Pill>}
        {item.dataClassification && <Pill className={dataClassPill[item.dataClassification]}>{item.dataClassification}</Pill>}
        {item.deploymentModel && <Pill className={DEPLOYMENT_PILL[item.deploymentModel]}>{DEPLOYMENT_LABEL[item.deploymentModel]}</Pill>}
        {item.oversightLevel && <Pill className={OVERSIGHT_PILL[item.oversightLevel]}>{OVERSIGHT_LABEL[item.oversightLevel]}</Pill>}
        <Pill className={usageBased ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>{usageBased ? 'Variable cost' : 'Fixed cost'}</Pill>
        {item.vendorTrainsOnData === true && <Pill className="border-rose-200 bg-rose-50 text-rose-700">Vendor trains on data</Pill>}
        {item.complianceScope?.map(c => <Pill key={c} className="border-slate-200 bg-slate-50 text-slate-600">{c}</Pill>)}
        {item.accessScope?.map(a => <Pill key={a} className="border-slate-200 bg-slate-50 text-slate-500"><Lock className="mr-1 inline h-3 w-3" />{a}</Pill>)}
      </div>

      {gaps.length > 0 && (
        <div className={`mt-4 rounded-2xl border p-3 ${score === 'critical' ? 'border-rose-100 bg-rose-50' : 'border-amber-100 bg-amber-50'}`}>
          <p className={`mb-1.5 text-xs font-semibold ${score === 'critical' ? 'text-rose-700' : 'text-amber-700'}`}>
            Nova · {gaps.filter(g => g.severity === 'blocking').length} blocking · {gaps.filter(g => g.severity === 'warning').length} warning
          </p>
          <ul className="space-y-1">
            {gaps.map((g, i) => (
              <li key={i} className={`flex items-start gap-1.5 text-xs ${g.severity === 'blocking' ? 'text-rose-700' : 'text-amber-700'}`}>
                {g.severity === 'blocking' ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {g.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Primitive components ─────────────────────────────────────────────────────

function inputCls(error: boolean) {
  return `w-full rounded-2xl border ${error ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'} px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition`
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex-1 border-t border-slate-100" />
    </div>
  )
}

function FormField({ label, required, error, helperText, children }: { label: string; required?: boolean; error?: string; helperText?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}{required && <span className="ml-1 text-rose-400">*</span>}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-slate-400">{helperText}</p>}
    </div>
  )
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-8 text-sm text-slate-900 outline-none focus:border-slate-400">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronRight className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 rotate-90 text-slate-400" />
    </div>
  )
}

function RadioCard({ selected, onClick, label, description, warn }: { selected: boolean; onClick: () => void; label: string; description: string; warn?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${selected ? (warn ? 'border-rose-500 bg-rose-500' : 'border-slate-900 bg-slate-900') : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-white' : 'border-slate-300'}`}>
        {selected && <div className="h-2 w-2 rounded-full bg-white" />}
      </div>
      <div>
        <p className={`text-sm font-medium ${selected ? 'text-white' : 'text-slate-900'}`}>{label}</p>
        <p className={`text-xs ${selected ? (warn ? 'text-rose-100' : 'text-slate-300') : 'text-slate-500'}`}>{description}</p>
      </div>
    </button>
  )
}

function YesNoButton({ selected, onClick, label, warn }: { selected: boolean; onClick: () => void; label: string; warn?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${selected ? (warn ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-900 bg-slate-900 text-white') : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
      {label}
    </button>
  )
}

function MiniFact({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">{icon}{label}</div>
      <p className={`mt-1 truncate text-sm font-medium ${warn ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}{warn && <AlertTriangle className="ml-1 inline h-3 w-3 text-rose-400" />}
      </p>
    </div>
  )
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>
}

function MetricCard({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${alert ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ${alert ? 'text-rose-600' : 'text-slate-700'}`}>{icon}</div>
      <div className={`text-2xl font-semibold ${alert ? 'text-rose-700' : 'text-slate-900'}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  )
}

function GovernanceCheckItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-indigo-700">
      <Circle className="h-3 w-3 shrink-0 fill-indigo-300 text-indigo-300" />{label}
    </div>
  )
}

type ReviewArtifactIconConfig = { icon: typeof FileText; color: string; bg: string }
const ARTIFACT_ICONS: Record<ReviewArtifact['iconType'], ReviewArtifactIconConfig> = {
  privacy: { icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-100' },
  security: { icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-100' },
  legal: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100' },
  finance: { icon: DollarSign, color: 'text-amber-500', bg: 'bg-amber-100' },
}

function ArtifactRow({ artifact }: { artifact: ReviewArtifact }) {
  const config = ARTIFACT_ICONS[artifact.iconType]
  const Icon = config.icon
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-white p-3">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-800">{artifact.label}</p>
        <p className="mt-0.5 text-xs text-slate-400">{artifact.detail}</p>
      </div>
    </div>
  )
}