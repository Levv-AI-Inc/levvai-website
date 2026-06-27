'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Cpu,
  DollarSign,
  Eye,
  Lock,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  User,
  XCircle,
} from 'lucide-react'
import type {
  AIAutomationItem,
  CostModel,
  OveragePolicy,
  ReviewCadence,
} from '../context'
import { useSOW } from '../context'

type DeploymentModel = NonNullable<AIAutomationItem['deploymentModel']>
type OversightLevel = NonNullable<AIAutomationItem['oversightLevel']>
type ExitPlan = NonNullable<AIAutomationItem['exitPlan']>

type FormState = {
  name: string
  category: AIAutomationItem['category']
  aiPlatform: string
  businessOwner: string
  technicalOwner: string
  purpose: string
  dataClassification: NonNullable<AIAutomationItem['dataClassification']>
  accessScopeText: string
  riskLevel: NonNullable<AIAutomationItem['riskLevel']>
  costModel: CostModel
  spendCap: string
  alertThreshold: number
  overpagePolicy: OveragePolicy
  spendApprover: string
  reviewCadence: ReviewCadence
  deploymentModel: DeploymentModel
  oversightLevel: OversightLevel
  vendorRetainsData: 'yes' | 'no' | ''
  vendorTrainsOnData: 'yes' | 'no' | ''
  complianceScopeText: string
  exitPlan: ExitPlan | ''
}

type Gap = {
  label: string
  severity: 'blocking' | 'warning'
}

const WORK_TYPE_LABELS: Record<string, string> = {
  consulting: 'Advisory / Consulting',
  managed_services: 'Managed Services',
  implementation: 'Implementation / Project',
  staff_aug: 'Staff Aug (SOW-based)',
  other: 'Other',
}

const CATEGORIES: AIAutomationItem['category'][] = [
  'AI Agent',
  'Automation Bot',
  'AI Platform',
  'Workflow Assistant',
]

const DATA_CLASSES: NonNullable<AIAutomationItem['dataClassification']>[] = [
  'Public',
  'Internal',
  'Confidential',
  'PII',
  'Financial Data',
]

const RISK_LEVELS: NonNullable<AIAutomationItem['riskLevel']>[] = [
  'Low',
  'Medium',
  'High',
]

const COST_MODELS: CostModel[] = [
  'Included in SOW',
  'Fixed Fee',
  'Subscription',
  'API Usage',
  'Usage Based',
]

const DEPLOYMENT_OPTIONS: {
  value: DeploymentModel
  label: string
  description: string
}[] = [
  {
    value: 'your_tenant',
    label: 'Your tenant',
    description: 'Runs in your cloud or workspace environment.',
  },
  {
    value: 'vendor_hosted',
    label: 'Vendor hosted',
    description: 'Runs in the supplier or platform environment.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Shared responsibility across your tenant and the vendor.',
  },
]

const OVERSIGHT_OPTIONS: {
  value: OversightLevel
  label: string
  description: string
}[] = [
  {
    value: 'human_in_loop',
    label: 'Human-in-the-loop',
    description: 'A person approves before the agent takes action.',
  },
  {
    value: 'human_on_loop',
    label: 'Human-on-the-loop',
    description: 'The agent acts, with scheduled human review.',
  },
  {
    value: 'autonomous',
    label: 'Autonomous',
    description: 'The agent acts without routine human approval.',
  },
]

const EXIT_OPTIONS: { value: ExitPlan; label: string }[] = [
  { value: 'decommission', label: 'Decommission at contract end' },
  { value: 'transition_internal', label: 'Transition internally' },
  { value: 'continue_renewal', label: 'Continue through renewal' },
]

const OVERAGE_POLICIES: { value: OveragePolicy; label: string }[] = [
  { value: 'hard_stop', label: 'Hard stop' },
  { value: 'escalate', label: 'Escalate to approver' },
  { value: 'continue_flag', label: 'Continue and flag' },
]

const REVIEW_CADENCES: { value: ReviewCadence; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'at_renewal', label: 'At renewal' },
]

const INITIAL_FORM: FormState = {
  name: '',
  category: 'AI Agent',
  aiPlatform: '',
  businessOwner: '',
  technicalOwner: '',
  purpose: '',
  dataClassification: 'Internal',
  accessScopeText: '',
  riskLevel: 'Medium',
  costModel: 'Included in SOW',
  spendCap: '',
  alertThreshold: 80,
  overpagePolicy: 'escalate',
  spendApprover: '',
  reviewCadence: 'quarterly',
  deploymentModel: 'your_tenant',
  oversightLevel: 'human_in_loop',
  vendorRetainsData: '',
  vendorTrainsOnData: '',
  complianceScopeText: '',
  exitPlan: '',
}

function isUsageBased(costModel?: CostModel) {
  return costModel === 'API Usage' || costModel === 'Usage Based'
}

function isSensitiveData(value?: AIAutomationItem['dataClassification']) {
  return value === 'PII' || value === 'Financial Data' || value === 'Confidential'
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getItemGaps(item: AIAutomationItem): Gap[] {
  const gaps: Gap[] = []
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
    gaps.push({ label: 'Purpose should be documented', severity: 'warning' })
  }
  if (item.deploymentModel === 'hybrid') {
    gaps.push({
      label: 'Hybrid deployment needs a shared responsibility model',
      severity: 'warning',
    })
  }

  return gaps
}

function buildItem(form: FormState): AIAutomationItem {
  const spendCap = Number(form.spendCap)

  return {
    id: crypto.randomUUID(),
    name: form.name.trim(),
    category: form.category,
    aiPlatform: form.aiPlatform.trim() || undefined,
    businessOwner: form.businessOwner.trim() || undefined,
    technicalOwner: form.technicalOwner.trim() || undefined,
    purpose: form.purpose.trim() || undefined,
    dataClassification: form.dataClassification,
    accessScope: splitList(form.accessScopeText),
    riskLevel: form.riskLevel,
    costModel: form.costModel,
    spendCap: isUsageBased(form.costModel) && Number.isFinite(spendCap) && spendCap > 0 ? spendCap : undefined,
    alertThreshold: isUsageBased(form.costModel) ? form.alertThreshold : undefined,
    overpagePolicy: isUsageBased(form.costModel) ? form.overpagePolicy : undefined,
    spendApprover: isUsageBased(form.costModel) ? form.spendApprover.trim() || undefined : undefined,
    reviewCadence: form.reviewCadence,
    deploymentModel: form.deploymentModel,
    oversightLevel: form.oversightLevel,
    vendorRetainsData:
      form.vendorRetainsData === 'yes'
        ? true
        : form.vendorRetainsData === 'no'
        ? false
        : undefined,
    vendorTrainsOnData:
      form.vendorTrainsOnData === 'yes'
        ? true
        : form.vendorTrainsOnData === 'no'
        ? false
        : undefined,
    complianceScope: splitList(form.complianceScopeText),
    exitPlan: form.exitPlan || undefined,
  }
}

export default function AIAutomationPage() {
  const router = useRouter()
  const { sow, setSOW } = useSOW()
  const items = sow.aiAutomation || []

  const [gateAnswer, setGateAnswer] = useState<'yes' | 'no' | null>(
    sow.aiGateAnswer ?? null
  )
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [showForm, setShowForm] = useState(items.length === 0)

  const allGaps = useMemo(() => items.flatMap(getItemGaps), [items])
  const blockingCount = allGaps.filter((gap) => gap.severity === 'blocking').length
  const warningCount = allGaps.filter((gap) => gap.severity === 'warning').length
  const usageBasedItems = items.filter((item) => isUsageBased(item.costModel))
  const highRiskCount = items.filter((item) => item.riskLevel === 'High').length

  const workTypeLabel =
    WORK_TYPE_LABELS[sow.workType || ''] || sow.workType || 'SOW request'

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleAdd = () => {
    const nextItem = buildItem(form)
    setSOW({
      aiGateAnswer: 'yes',
      aiAutomation: [...items, nextItem],
    })
    setGateAnswer('yes')
    setForm(INITIAL_FORM)
    setShowForm(false)
  }

  const handleRemove = (id: string) => {
    setSOW({
      aiAutomation: items.filter((item) => item.id !== id),
    })
  }

  const handleContinue = () => {
    setSOW({
      aiGateAnswer: gateAnswer,
      aiAutomation: gateAnswer === 'yes' ? items : [],
    })
    router.push('/requests/sow/create/review')
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
            <Bot className="h-4 w-4" />
            AI & Automation
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            AI & Automation
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Register any AI agent, automation platform, or bot that will operate
            in your environment after this SOW closes. Levv creates a governed
            digital worker record on SOW approval.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
            <Briefcase className="h-3.5 w-3.5" />
            {workTypeLabel}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Does this SOW include AI or automation?
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    This can be skipped for now, but captured items will be
                    visible in review.
                  </p>
                </div>
                <div className="flex gap-2">
                  <GateButton
                    active={gateAnswer === 'yes'}
                    label="Yes"
                    onClick={() => {
                      setGateAnswer('yes')
                      setSOW({ aiGateAnswer: 'yes' })
                      setShowForm(true)
                    }}
                  />
                  <GateButton
                    active={gateAnswer === 'no'}
                    label="No"
                    onClick={() => {
                      setGateAnswer('no')
                      setSOW({ aiGateAnswer: 'no', aiAutomation: [] })
                      setShowForm(false)
                    }}
                  />
                </div>
              </div>
            </div>

            {gateAnswer === 'yes' && (
              <>
                {items.length > 0 && (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onRemove={() => handleRemove(item.id)}
                      />
                    ))}
                  </div>
                )}

                {!showForm && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add automation
                  </button>
                )}

                {showForm && (
                  <AutomationForm
                    form={form}
                    updateForm={updateForm}
                    onAdd={handleAdd}
                    onCancel={() => setShowForm(false)}
                  />
                )}
              </>
            )}

            <footer className="flex items-center justify-between border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={() => router.push('/requests/sow/create/commercials')}
                className="rounded-full border border-slate-200 bg-white px-8 py-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-10 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Continue
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </footer>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-semibold text-indigo-900">
                  Nova AI Governance
                </h3>
              </div>
              {items.length === 0 ? (
                <p className="text-sm leading-6 text-indigo-700">
                  Add an AI item and Nova will evaluate ownership, access,
                  deployment, data handling, compliance, and spend controls.
                </p>
              ) : (
                <div className="space-y-2">
                  <SidebarFact label="AI items" value={items.length.toString()} />
                  <SidebarFact label="High risk" value={highRiskCount.toString()} warn={highRiskCount > 0} />
                  <SidebarFact label="Variable cost" value={usageBasedItems.length.toString()} warn={usageBasedItems.length > 0} />
                  <SidebarFact label="Blocking gaps" value={blockingCount.toString()} warn={blockingCount > 0} />
                  <SidebarFact label="Warnings" value={warningCount.toString()} warn={warningCount > 0} />
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

function AutomationForm({
  form,
  updateForm,
  onAdd,
  onCancel,
}: {
  form: FormState
  updateForm: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  onAdd: () => void
  onCancel: () => void
}) {
  const usageBased = isUsageBased(form.costModel)

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Automation profile</h2>
        <p className="mt-1 text-sm text-slate-500">
          Capture enough governance detail for downstream review.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Name">
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
            className={inputClass}
            placeholder="Invoice matching agent"
          />
        </FormField>
        <FormField label="Category">
          <Select
            value={form.category}
            onChange={(value) => updateForm('category', value as FormState['category'])}
            options={CATEGORIES}
          />
        </FormField>
        <FormField label="AI platform">
          <input
            value={form.aiPlatform}
            onChange={(event) => updateForm('aiPlatform', event.target.value)}
            className={inputClass}
            placeholder="Azure OpenAI, UiPath, AWS Bedrock"
          />
        </FormField>
        <FormField label="Data classification">
          <Select
            value={form.dataClassification}
            onChange={(value) => updateForm('dataClassification', value as FormState['dataClassification'])}
            options={DATA_CLASSES}
          />
        </FormField>
        <FormField label="Business owner">
          <input
            value={form.businessOwner}
            onChange={(event) => updateForm('businessOwner', event.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Technical owner">
          <input
            value={form.technicalOwner}
            onChange={(event) => updateForm('technicalOwner', event.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Risk level">
          <Select
            value={form.riskLevel}
            onChange={(value) => updateForm('riskLevel', value as FormState['riskLevel'])}
            options={RISK_LEVELS}
          />
        </FormField>
        <FormField label="Cost model">
          <Select
            value={form.costModel}
            onChange={(value) => updateForm('costModel', value as CostModel)}
            options={COST_MODELS}
          />
        </FormField>
      </div>

      <FormField label="Purpose">
        <textarea
          value={form.purpose}
          onChange={(event) => updateForm('purpose', event.target.value)}
          className={`${inputClass} min-h-24`}
          placeholder="Describe what the automation will do."
        />
      </FormField>

      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Access scope">
          <input
            value={form.accessScopeText}
            onChange={(event) => updateForm('accessScopeText', event.target.value)}
            className={inputClass}
            placeholder="Workday, Coupa, Slack"
          />
        </FormField>
        <FormField label="Compliance scope">
          <input
            value={form.complianceScopeText}
            onChange={(event) => updateForm('complianceScopeText', event.target.value)}
            className={inputClass}
            placeholder="SOC 2, GDPR"
          />
        </FormField>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {DEPLOYMENT_OPTIONS.map((option) => (
          <RadioCard
            key={option.value}
            selected={form.deploymentModel === option.value}
            label={option.label}
            description={option.description}
            onClick={() => updateForm('deploymentModel', option.value)}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {OVERSIGHT_OPTIONS.map((option) => (
          <RadioCard
            key={option.value}
            selected={form.oversightLevel === option.value}
            label={option.label}
            description={option.description}
            onClick={() => updateForm('oversightLevel', option.value)}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <FormField label="Vendor retains data">
          <Select
            value={form.vendorRetainsData}
            onChange={(value) => updateForm('vendorRetainsData', value as FormState['vendorRetainsData'])}
            options={['', 'yes', 'no']}
            labels={{ '': 'Unconfirmed', yes: 'Yes', no: 'No' }}
          />
        </FormField>
        <FormField label="Vendor trains on data">
          <Select
            value={form.vendorTrainsOnData}
            onChange={(value) => updateForm('vendorTrainsOnData', value as FormState['vendorTrainsOnData'])}
            options={['', 'yes', 'no']}
            labels={{ '': 'Unconfirmed', yes: 'Yes', no: 'No' }}
          />
        </FormField>
        <FormField label="Exit plan">
          <Select
            value={form.exitPlan}
            onChange={(value) => updateForm('exitPlan', value as FormState['exitPlan'])}
            options={['', ...EXIT_OPTIONS.map((option) => option.value)]}
            labels={{
              '': 'Not selected',
              decommission: 'Decommission',
              transition_internal: 'Transition internally',
              continue_renewal: 'Continue through renewal',
            }}
          />
        </FormField>
      </div>

      {usageBased && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <DollarSign className="h-4 w-4" />
            Variable spend governance
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Monthly spend cap">
              <input
                type="number"
                value={form.spendCap}
                onChange={(event) => updateForm('spendCap', event.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Spend approver">
              <input
                value={form.spendApprover}
                onChange={(event) => updateForm('spendApprover', event.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Alert threshold">
              <Select
                value={String(form.alertThreshold)}
                onChange={(value) => updateForm('alertThreshold', Number(value))}
                options={['60', '70', '80', '90']}
                labels={{ 60: '60%', 70: '70%', 80: '80%', 90: '90%' }}
              />
            </FormField>
            <FormField label="Overage policy">
              <Select
                value={form.overpagePolicy}
                onChange={(value) => updateForm('overpagePolicy', value as OveragePolicy)}
                options={OVERAGE_POLICIES.map((option) => option.value)}
                labels={Object.fromEntries(OVERAGE_POLICIES.map((option) => [option.value, option.label]))}
              />
            </FormField>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <FormField label="Review cadence">
          <Select
            value={form.reviewCadence}
            onChange={(value) => updateForm('reviewCadence', value as ReviewCadence)}
            options={REVIEW_CADENCES.map((option) => option.value)}
            labels={Object.fromEntries(REVIEW_CADENCES.map((option) => [option.value, option.label]))}
          />
        </FormField>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      </div>
    </div>
  )
}

function ItemCard({
  item,
  onRemove,
}: {
  item: AIAutomationItem
  onRemove: () => void
}) {
  const gaps = getItemGaps(item)
  const blocking = gaps.filter((gap) => gap.severity === 'blocking').length
  const usageBased = isUsageBased(item.costModel)

  return (
    <div className={`rounded-3xl border bg-white p-6 shadow-sm ${blocking ? 'border-rose-200' : gaps.length ? 'border-amber-200' : 'border-emerald-200'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${blocking ? 'bg-rose-50 text-rose-600' : gaps.length ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{item.name || 'Unnamed automation'}</h3>
            <p className="text-xs text-slate-400">
              {item.category}
              {item.aiPlatform ? ` - ${item.aiPlatform}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${blocking ? 'border-rose-200 bg-rose-50 text-rose-700' : gaps.length ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {blocking ? <XCircle className="h-3 w-3" /> : gaps.length ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {blocking ? 'Governance gaps' : gaps.length ? 'Warnings' : 'Complete'}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Remove automation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {item.purpose && (
        <p className="mt-3 text-sm leading-5 text-slate-500">{item.purpose}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <MiniFact icon={<Eye className="h-3.5 w-3.5" />} label="Oversight" value={formatToken(item.oversightLevel)} warn={item.oversightLevel === 'autonomous'} />
        <MiniFact icon={<Shield className="h-3.5 w-3.5" />} label="Deployment" value={formatToken(item.deploymentModel)} />
        <MiniFact icon={<User className="h-3.5 w-3.5" />} label="Owner" value={item.businessOwner || '-'} warn={!item.businessOwner} />
        <MiniFact icon={<Cpu className="h-3.5 w-3.5" />} label="Technical" value={item.technicalOwner || '-'} warn={!item.technicalOwner} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.riskLevel && <Pill tone={item.riskLevel === 'High' ? 'rose' : item.riskLevel === 'Medium' ? 'amber' : 'emerald'}>{item.riskLevel} risk</Pill>}
        {item.dataClassification && <Pill tone={isSensitiveData(item.dataClassification) ? 'rose' : 'slate'}>{item.dataClassification}</Pill>}
        <Pill tone={usageBased ? 'amber' : 'slate'}>{usageBased ? 'Variable cost' : item.costModel || 'Cost included'}</Pill>
        {item.vendorTrainsOnData && <Pill tone="rose">Vendor trains on data</Pill>}
        {item.accessScope?.map((scope) => (
          <Pill key={scope} tone="slate">
            <Lock className="mr-1 inline h-3 w-3" />
            {scope}
          </Pill>
        ))}
      </div>

      {gaps.length > 0 && (
        <div className={`mt-4 rounded-2xl border p-3 ${blocking ? 'border-rose-100 bg-rose-50' : 'border-amber-100 bg-amber-50'}`}>
          <p className={`mb-1.5 text-xs font-semibold ${blocking ? 'text-rose-700' : 'text-amber-700'}`}>
            Nova: {blocking} blocking, {gaps.length - blocking} warning
          </p>
          <ul className="space-y-1">
            {gaps.map((gap) => (
              <li key={gap.label} className={`flex items-start gap-1.5 text-xs ${gap.severity === 'blocking' ? 'text-rose-700' : 'text-amber-700'}`}>
                {gap.severity === 'blocking' ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {gap.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function GateButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-5 py-2 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  )
}

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

function FormField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-5">
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
  labels,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  labels?: Record<string, string>
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] || option}
        </option>
      ))}
    </select>
  )
}

function RadioCard({
  selected,
  onClick,
  label,
  description,
}: {
  selected: boolean
  onClick: () => void
  label: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
    >
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-white' : 'border-slate-300'}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className={`mt-0.5 block text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
          {description}
        </span>
      </span>
    </button>
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
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${warn ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  )
}

function MiniFact({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <p className={`mt-1 truncate text-sm font-medium ${warn ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'slate' | 'amber' | 'rose' | 'emerald'
}) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

function formatToken(value?: string) {
  if (!value) return '-'
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
