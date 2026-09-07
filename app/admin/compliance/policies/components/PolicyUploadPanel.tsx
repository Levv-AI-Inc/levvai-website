'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react'
import {
  clearUploadedPolicyStatus,
  readPolicyStatus,
  setPolicyStatusActive,
  setUploadedPolicyStatus,
} from '../../../../../lib/policyStatus'
import { TABS, type Tab } from '../../../company/types'

export type PolicyMasterData = Record<Tab, Array<Record<string, unknown>>>

export type PolicyAnalysisSummary = {
  policyName?: string
  summary?: string
  activatedAt?: string
  counts?: {
    totalRules?: number
    rateClassification?: number
    tenureDuration?: number
    supplierEligibility?: number
    approvalException?: number
  }
  rules?: PolicyRule[]
  gaps?: PolicyGap[]
  intakeImpacts?: Array<string>
  configChanges?: Array<string>
}

type PolicyRule = {
  id: string
  category:
    | 'rate_classification'
    | 'tenure_duration'
    | 'supplier_eligibility'
    | 'approval_exception'
    | 'worker_type'
    | 'location_jurisdiction'
  title: string
  statement: string
  citation: string
  severity: 'low' | 'medium' | 'high'
  enforcementType: 'intake' | 'configuration' | 'both'
  triggerPoint: string
  enforcementStatus: 'active' | 'pending'
}

type PolicyGap = {
  id: string
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  recommendation: string
  relatedRuleIds: string[]
  suggestedTab: string
  suggestedRowKey: string
  suggestedRowValue: string
}

const EMPTY_MASTER_DATA = TABS.reduce(
  (data, tab) => ({ ...data, [tab]: [] }),
  {} as PolicyMasterData,
)

const CATEGORY_META: Record<
  PolicyRule['category'],
  { label: string; color: string }
> = {
  rate_classification: {
    label: 'Rate & classification',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  tenure_duration: {
    label: 'Tenure & duration',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  supplier_eligibility: {
    label: 'Supplier eligibility',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  approval_exception: {
    label: 'Approval & exception',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  worker_type: {
    label: 'Worker type',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  location_jurisdiction: {
    label: 'Location & jurisdiction',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
}

const SEVERITY_BADGE: Record<PolicyGap['severity'], string> = {
  high: 'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
}

function formatSeverity(severity: PolicyGap['severity']) {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

const PROCESSING_STEPS = [
  { label: 'Uploading document', duration: 0 },
  { label: 'Reading document structure', duration: 1800 },
  { label: 'Identifying policy clauses', duration: 2400 },
  { label: 'Extracting enforceable workforce rules', duration: 3200 },
  { label: 'Separating intake controls from config controls', duration: 2800 },
  { label: 'Cross-referencing current company setup', duration: 2600 },
  { label: 'Flagging policy-to-config gaps', duration: 3000 },
  { label: 'Building action plan', duration: 99999 },
]

function uploadPolicyWithProgress({
  payload,
  onUploadProgress,
}: {
  payload: FormData
  onUploadProgress: (progress: number | null) => void
}) {
  return new Promise<PolicyAnalysisSummary>((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.open('POST', '/api/nova/policy')

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        onUploadProgress(null)
        return
      }

      onUploadProgress(
        Math.min(100, Math.round((event.loaded / event.total) * 100)),
      )
    }
    request.upload.onload = () => onUploadProgress(100)

    request.onerror = () => reject(new Error('Policy upload failed.'))
    request.onabort = () => reject(new Error('Policy upload was cancelled.'))
    request.onload = () => {
      let data: unknown = {}

      try {
        data = request.responseText ? JSON.parse(request.responseText) : {}
      } catch {
        data = {}
      }

      if (request.status < 200 || request.status >= 300) {
        const errorMessage =
          data &&
          typeof data === 'object' &&
          'error' in data &&
          typeof data.error === 'string'
            ? data.error
            : 'Policy analysis failed.'

        reject(new Error(errorMessage))
        return
      }

      resolve(data as PolicyAnalysisSummary)
    }

    request.send(payload)
  })
}

function PolicyProcessingSteps({
  fileName,
  uploadProgress,
  analysisReady,
  onComplete,
}: {
  fileName: string
  uploadProgress: number | null
  analysisReady: boolean
  onComplete: () => void
}) {
  const [currentStep, setCurrentStep] = useState(
    uploadProgress === 100 ? 1 : 0,
  )

  useEffect(() => {
    if (analysisReady) return

    if (uploadProgress !== 100) {
      setCurrentStep(0)
      return
    }

    let step = 1
    let timeout: ReturnType<typeof setTimeout>

    const advance = () => {
      const nextStep = step + 1
      if (nextStep < PROCESSING_STEPS.length) {
        step = nextStep
        setCurrentStep(step)
        timeout = setTimeout(advance, PROCESSING_STEPS[step].duration)
      }
    }

    setCurrentStep(step)
    timeout = setTimeout(advance, PROCESSING_STEPS[step].duration)
    return () => clearTimeout(timeout)
  }, [analysisReady, uploadProgress])

  useEffect(() => {
    if (!analysisReady || uploadProgress !== 100) return

    let timeout: ReturnType<typeof setTimeout>

    setCurrentStep(PROCESSING_STEPS.length)
    timeout = setTimeout(onComplete, 0)
    return () => clearTimeout(timeout)
  }, [analysisReady, onComplete, uploadProgress])

  const uploadPercent =
    uploadProgress === null ? null : Math.max(0, Math.min(100, uploadProgress))

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">
          <FileText className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-900">
            {fileName || 'Policy document'}
          </p>
          <p className="text-xs font-medium text-slate-400">
            {uploadPercent === 100
              ? 'Policy uploaded · Nova is reading...'
              : 'Uploading policy document...'}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-700">
            {uploadPercent === 100 ? 'Upload complete' : 'Uploading to Nova'}
          </span>
          <span className="text-xs font-black text-slate-900">
            {uploadPercent === null ? 'Measuring...' : `${uploadPercent}%`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full bg-cyan-500 transition-all duration-300 ${
              uploadPercent === null ? 'w-1/3 animate-pulse' : ''
            }`}
            style={
              uploadPercent === null ? undefined : { width: `${uploadPercent}%` }
            }
          />
        </div>
        {uploadPercent === 100 ? (
          <p className="mt-2 text-[10px] font-medium text-slate-400">
            The file is uploaded. Waiting for Nova's policy analysis to finish.
          </p>
        ) : null}
      </div>

      <ul className="space-y-1">
        {PROCESSING_STEPS.map((step, index) => {
          const isDone = index < currentStep
          const isActive = index === currentStep && currentStep < PROCESSING_STEPS.length

          return (
            <li
              key={step.label}
              className={`flex items-center gap-2.5 rounded-xl px-2 py-2 transition-all duration-300 ${
                isActive ? 'bg-amber-50' : ''
              }`}
            >
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                {isDone ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  </span>
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-slate-300" />
                )}
              </span>
              <span
                className={`text-xs transition-all duration-300 ${
                  isDone
                    ? 'text-slate-400 line-through decoration-slate-300'
                    : isActive
                      ? 'font-bold text-amber-700'
                      : 'font-medium text-slate-400'
                }`}
              >
                {step.label}
                {isActive ? (
                  <span className="ml-1 inline-flex">
                    <span className="inline-block animate-[bounce_1s_infinite_0ms]">
                      .
                    </span>
                    <span className="inline-block animate-[bounce_1s_infinite_150ms]">
                      .
                    </span>
                    <span className="inline-block animate-[bounce_1s_infinite_300ms]">
                      .
                    </span>
                  </span>
                ) : null}
              </span>
              {isDone ? (
                <span className="ml-auto text-[10px] font-bold text-emerald-600">
                  Done
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-center text-[10px] font-medium text-slate-400">
        {uploadPercent === 100
          ? analysisReady
            ? 'Analysis complete. Preparing results.'
            : 'Nova is analysing your document. Results will appear when the server finishes.'
          : 'Sending the document before analysis begins.'}
      </p>
    </div>
  )
}

export default function PolicyUploadPanel({
  masterData = EMPTY_MASTER_DATA,
  onSelectTab,
}: {
  masterData?: PolicyMasterData
  onSelectTab?: (tab: Tab) => void
}) {
  const policyInputRef = useRef<HTMLInputElement>(null)
  const [policyState, setPolicyState] = useState<
    'upload' | 'processing' | 'results' | 'error'
  >('upload')
  const [policyFileName, setPolicyFileName] = useState('')
  const [policyError, setPolicyError] = useState('')
  const [analysis, setAnalysis] = useState<PolicyAnalysisSummary | null>(null)
  const [pendingAnalysis, setPendingAnalysis] =
    useState<PolicyAnalysisSummary | null>(null)
  const [policyActive, setPolicyActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(0)

  useEffect(() => {
    const savedPolicy = readPolicyStatus()
    if (!savedPolicy.fileName && !savedPolicy.policyName && !savedPolicy.analysis) return

    const savedAnalysis =
      savedPolicy.analysis && typeof savedPolicy.analysis === 'object'
        ? (savedPolicy.analysis as PolicyAnalysisSummary)
        : {
            policyName: savedPolicy.policyName,
            summary: savedPolicy.summary,
            activatedAt: savedPolicy.activatedAt,
          }

    setPolicyFileName(savedPolicy.fileName ?? '')
    setAnalysis(savedAnalysis)
    setPolicyActive(savedPolicy.active)
    setPolicyState('results')
  }, [])

  const handlePolicyUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPolicyFileName(file.name)
    setPolicyError('')
    setAnalysis(null)
    setPendingAnalysis(null)
    setUploadProgress(0)
    setPolicyState('processing')

    try {
      const payload = new FormData()
      payload.append('file', file)
      payload.append('masterData', JSON.stringify(masterData))

      const data = await uploadPolicyWithProgress({
        payload,
        onUploadProgress: setUploadProgress,
      })

      setUploadProgress(100)
      setPendingAnalysis(data)
    } catch (error) {
      setPolicyError(
        error instanceof Error
          ? error.message
          : 'Nova could not analyse the policy.',
      )
      setPolicyState('error')
    } finally {
      if (policyInputRef.current) policyInputRef.current.value = ''
    }
  }

  const completePolicyUpload = useCallback(() => {
    if (!pendingAnalysis) return

    setAnalysis(pendingAnalysis)
    setUploadedPolicyStatus({
      fileName: policyFileName,
      analysis: pendingAnalysis,
    })
    setPolicyActive(true)
    setPendingAnalysis(null)
    setPolicyState('results')
  }, [pendingAnalysis, policyFileName])

  const policyBadge =
    policyState === 'results'
      ? policyActive
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-slate-100 text-slate-600 border-slate-200'
      : policyState === 'processing'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : policyState === 'error'
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : 'bg-slate-100 text-slate-500 border-slate-200'

  return (
    <div className="overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <span className="rounded-xl bg-[#1f3d38] p-2 text-[#89d3bd]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-slate-900">
            {policyState === 'upload'
              ? 'No policy uploaded'
              : policyState === 'processing'
                ? `Analysing ${policyFileName || 'policy'}...`
                : policyState === 'error'
                  ? 'Policy analysis failed'
                  : analysis?.policyName || policyFileName || 'Policy uploaded'}
          </h2>
          <p className="text-xs font-medium text-slate-500">
            External workforce policy upload
          </p>
        </div>
        <span
          className={`ml-auto rounded-full border px-2.5 py-1 text-xs font-bold ${policyBadge}`}
        >
          {policyState === 'results'
            ? policyActive
              ? 'Active'
              : 'Deactivated'
            : policyState === 'processing'
              ? 'Processing'
              : policyState === 'error'
                ? 'Error'
                : 'Not configured'}
        </span>
      </div>

      <div className="p-6">
        {policyState === 'processing' ? (
          <PolicyProcessingSteps
            fileName={policyFileName}
            uploadProgress={uploadProgress}
            analysisReady={Boolean(pendingAnalysis)}
            onComplete={completePolicyUpload}
          />
        ) : policyState === 'results' && analysis ? (
          <PolicyResults
            analysis={analysis}
            active={policyActive}
            onActiveChange={(active) => {
              setPolicyStatusActive(active)
              setPolicyActive(active)
            }}
            onSelectTab={onSelectTab}
            onReset={() => {
              setPolicyState('upload')
              setAnalysis(null)
              setPendingAnalysis(null)
              setPolicyFileName('')
              setPolicyActive(false)
              clearUploadedPolicyStatus()
              if (policyInputRef.current) policyInputRef.current.value = ''
            }}
          />
        ) : (
          <div>
            <p className="mb-3 text-xs font-medium text-slate-500">
              Upload your External Workforce Policy. Nova will extract
              enforceable rules, intake impacts, and configuration gaps.
            </p>
            <div
              onClick={() => policyInputRef.current?.click()}
              className="cursor-pointer rounded-2xl border border-dashed border-slate-300 p-6 text-center transition hover:border-cyan-300 hover:bg-cyan-50/40"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f3d38] text-[#89d3bd]">
                <FileText className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold text-slate-900">
                Drop your policy document here
              </p>
              <p className="mb-4 mt-1 text-xs font-medium text-slate-400">
                Supports .pdf, .docx, .txt
              </p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  policyInputRef.current?.click()
                }}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Upload className="h-3.5 w-3.5" />
                Select file
              </button>
            </div>
            {policyError ? (
              <p className="mt-3 text-xs font-medium text-rose-600">
                {policyError}
              </p>
            ) : null}
          </div>
        )}

        <input
          ref={policyInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={handlePolicyUpload}
        />
      </div>
    </div>
  )
}

function PolicyResults({
  analysis,
  active,
  onActiveChange,
  onReset,
  onSelectTab,
}: {
  analysis: PolicyAnalysisSummary
  active: boolean
  onActiveChange: (active: boolean) => void
  onReset: () => void
  onSelectTab?: (tab: Tab) => void
}) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(['gaps']),
  )
  const gaps = analysis.gaps ?? []
  const rules = analysis.rules ?? []
  const intakeImpacts = analysis.intakeImpacts ?? []
  const configChanges = analysis.configChanges ?? []
  const totalRules = analysis.counts?.totalRules ?? rules.length
  const highGaps = gaps.filter((gap) => gap.severity === 'high').length
  const activeRules = rules.filter(
    (rule) => rule.enforcementStatus === 'active',
  ).length

  const toggleSection = (id: string) => {
    setOpenSections((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex gap-3 rounded-2xl border p-4 ${
          active
            ? 'border-emerald-100 bg-emerald-50'
            : 'border-slate-200 bg-slate-50'
        }`}
      >
        <CheckCircle2
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            active ? 'text-emerald-600' : 'text-slate-500'
          }`}
        />
        <div className="min-w-0">
          <p
            className={`text-sm font-bold ${
              active ? 'text-emerald-900' : 'text-slate-900'
            }`}
          >
            {analysis.summary || 'Policy uploaded and analysed.'}
          </p>
          <p
            className={`mt-1 text-xs font-medium ${
              active ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            {active ? 'Enforcement active' : 'Enforcement deactivated'} ·{' '}
            {totalRules} rules · {gaps.length} configuration gaps
            {analysis.activatedAt ? ` · ${analysis.activatedAt}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Total', value: totalRules },
          { label: 'Rate', value: analysis.counts?.rateClassification ?? 0 },
          { label: 'Tenure', value: analysis.counts?.tenureDuration ?? 0 },
          {
            label: 'Supplier',
            value:
              (analysis.counts?.supplierEligibility ?? 0) +
              (analysis.counts?.approvalException ?? 0),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-1.5 text-center"
          >
            <p className="text-sm font-black text-slate-900">{stat.value}</p>
            <p className="text-[10px] font-medium text-slate-500">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <PolicyAccordion
        id="gaps"
        openSections={openSections}
        toggleSection={toggleSection}
        label="Configuration gaps"
        count={gaps.length}
        badges={
          highGaps > 0
            ? [
                {
                  text: `${highGaps} High`,
                  className: 'bg-rose-50 text-rose-700 border-rose-200',
                },
              ]
            : []
        }
      >
        {gaps.length === 0 ? (
          <div className="flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <p className="text-xs font-medium text-emerald-800">
              No configuration gaps found.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {gaps.map((gap, index) => {
              const suggestedTab = TABS.includes(gap.suggestedTab as Tab)
                ? (gap.suggestedTab as Tab)
                : null

              return (
                <div
                  key={gap.id || `${gap.title}-${index}`}
                  className="rounded-xl border border-amber-100 bg-amber-50 p-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs font-black text-amber-950">
                          {gap.title}
                        </p>
                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${SEVERITY_BADGE[gap.severity]}`}
                        >
                          {formatSeverity(gap.severity)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-amber-900">
                        {gap.description}
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-amber-800">
                        {gap.recommendation}
                      </p>
                      {suggestedTab && gap.suggestedRowValue ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-amber-200 bg-white/80 px-2 py-1 text-[10px] font-bold text-amber-700">
                            {suggestedTab}: {gap.suggestedRowValue}
                          </span>
                          {onSelectTab ? (
                            <button
                              type="button"
                              onClick={() => onSelectTab(suggestedTab)}
                              className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Review table
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </PolicyAccordion>

      <PolicyAccordion
        id="intake"
        openSections={openSections}
        toggleSection={toggleSection}
        label="Intake impacts"
        count={intakeImpacts.length}
      >
        <PolicyList
          items={intakeImpacts}
          emptyLabel="No intake impacts were identified."
        />
      </PolicyAccordion>

      <PolicyAccordion
        id="config"
        openSections={openSections}
        toggleSection={toggleSection}
        label="Config changes"
        count={configChanges.length}
      >
        <PolicyList
          items={configChanges}
          emptyLabel="No configuration changes were identified."
        />
      </PolicyAccordion>

      <PolicyAccordion
        id="rules"
        openSections={openSections}
        toggleSection={toggleSection}
        label="Active enforcement rules"
        count={totalRules}
        badges={[
          {
            text: active ? `${activeRules} live` : `${activeRules} paused`,
            className: active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200',
          },
        ]}
      >
        <div
          className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5 ${
            active ? 'bg-slate-950' : 'bg-slate-100'
          }`}
        >
          <Zap
            className={`h-3.5 w-3.5 shrink-0 ${
              active ? 'text-amber-400' : 'text-slate-400'
            }`}
          />
          <p className="text-xs font-medium text-white">
            <span className={active ? 'font-black text-white' : 'font-black text-slate-700'}>
              {activeRules} rules are {active ? 'active' : 'deactivated'}.
            </span>{' '}
            <span className={active ? 'text-white' : 'text-slate-600'}>
              {active
                ? 'Nova will use them across intake and approval workflows.'
                : 'Nova can summarize this policy, but will not enforce it in chat or workflows.'}
            </span>
          </p>
        </div>

        {rules.length === 0 ? (
          <p className="text-xs font-medium text-slate-500">
            No enforcement rules were returned.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, index) => {
              const category =
                CATEGORY_META[rule.category] ??
                CATEGORY_META.rate_classification

              return (
                <div
                  key={rule.id || `${rule.title}-${index}`}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${category.color}`}
                    >
                      {category.label}
                    </span>
                    <span className="ml-auto rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {rule.enforcementType}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {rule.enforcementStatus}
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-black text-slate-900">
                      {rule.title}
                    </p>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700">
                      {rule.statement}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500">
                      {rule.triggerPoint ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                          {rule.triggerPoint}
                        </span>
                      ) : null}
                      {rule.citation ? <span>{rule.citation}</span> : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </PolicyAccordion>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => onActiveChange(!active)}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
            active
              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {active ? 'Deactivate policy' : 'Activate policy'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-bold text-slate-400 underline underline-offset-2 hover:text-slate-600"
        >
          Re-upload policy
        </button>
      </div>
    </div>
  )
}

function PolicyAccordion({
  id,
  openSections,
  toggleSection,
  label,
  count,
  badges = [],
  children,
}: {
  id: string
  openSections: Set<string>
  toggleSection: (id: string) => void
  label: string
  count: number
  badges?: { text: string; className: string }[]
  children: ReactNode
}) {
  const isOpen = openSections.has(id)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-100"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-900">{label}</span>
          <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
            {count}
          </span>
          {badges.map((badge) => (
            <span
              key={badge.text}
              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${badge.className}`}
            >
              {badge.text}
            </span>
          ))}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen ? (
        <div className="border-t border-slate-100 p-3">{children}</div>
      ) : null}
    </div>
  )
}

function PolicyList({
  items,
  emptyLabel,
}: {
  items: string[]
  emptyLabel: string
}) {
  if (items.length === 0) {
    return <p className="text-xs font-medium text-slate-500">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2 text-xs font-medium text-slate-700">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
