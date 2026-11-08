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
  LevvNotice,
  LevvPanel,
  LevvStat,
  LevvStatStrip,
  LevvStatusBadge,
  LevvUploadZone,
  levvUi,
  type LevvTone,
} from '@/components/ui/levv-app'
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

const CATEGORY_META: Record<PolicyRule['category'], { label: string }> = {
  rate_classification: { label: 'Rate & classification' },
  tenure_duration: { label: 'Tenure & duration' },
  supplier_eligibility: { label: 'Supplier eligibility' },
  approval_exception: { label: 'Approval & exception' },
  worker_type: { label: 'Worker type' },
  location_jurisdiction: { label: 'Location & jurisdiction' },
}

const SEVERITY_TONE: Record<PolicyGap['severity'], LevvTone> = {
  high: 'rose',
  medium: 'amber',
  low: 'slate',
}

/** A tag that names a kind, not a state: framed, no marker. */
function Tag({ children }: { children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap border border-slate-400 px-1.5 py-px ${levvUi.legend} text-slate-600`}>
      {children}
    </span>
  )
}

function formatSeverity(severity: PolicyGap['severity']) {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

const PROCESSING_STEPS = [
  'Uploading document',
  'Reading document structure',
  'Identifying policy clauses',
  'Extracting enforceable workforce rules',
  'Separating intake controls from config controls',
  'Cross-referencing current company setup',
  'Flagging policy-to-config gaps',
  'Building action plan',
]

const ANALYSIS_WAIT_STEP_INDEX = PROCESSING_STEPS.indexOf(
  'Cross-referencing current company setup',
)
const PROCESSING_STEP_INTERVAL_MS = 1100
const RESULTS_HANDOFF_DELAY_MS = 650

function uploadPolicyWithProgress({
  payload,
  onUploadProgress,
}: {
  payload: FormData
  onUploadProgress: (progress: number | null) => void
}) {
  return new Promise<PolicyAnalysisSummary>((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.open('POST', '/nova/policy')

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
    if (uploadProgress !== 100) {
      setCurrentStep(0)
      return
    }

    setCurrentStep((step) => Math.max(step, 1))
  }, [uploadProgress])

  useEffect(() => {
    if (analysisReady || uploadProgress !== 100) return

    const timeout = setTimeout(() => {
      setCurrentStep((step) =>
        step < ANALYSIS_WAIT_STEP_INDEX ? step + 1 : step,
      )
    }, PROCESSING_STEP_INTERVAL_MS)
    return () => clearTimeout(timeout)
  }, [analysisReady, currentStep, uploadProgress])

  useEffect(() => {
    if (!analysisReady || uploadProgress !== 100) return

    let timeout: ReturnType<typeof setTimeout>

    setCurrentStep(PROCESSING_STEPS.length)
    timeout = setTimeout(onComplete, RESULTS_HANDOFF_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [analysisReady, onComplete, uploadProgress])

  const uploadPercent =
    uploadProgress === null ? null : Math.max(0, Math.min(100, uploadProgress))

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 border border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-2.5">
        <FileText className="h-4 w-4 shrink-0 text-slate-500" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-950">
            {fileName || 'Policy document'}
          </p>
          <p className="text-[13px] text-slate-500">
            {uploadPercent === 100
              ? 'Policy uploaded · Nova is reading...'
              : 'Uploading policy document...'}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className={`${levvUi.legend} text-slate-500`}>
            {uploadPercent === 100 ? 'Upload complete' : 'Uploading to Nova'}
          </span>
          <span className="text-[13px] font-semibold tabular-nums text-slate-950">
            {uploadPercent === null ? 'Measuring...' : `${uploadPercent}%`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden bg-slate-100">
          <div
            className={`h-full bg-blue-600 transition-all duration-300 ${
              uploadPercent === null ? 'w-1/3 animate-pulse' : ''
            }`}
            style={
              uploadPercent === null ? undefined : { width: `${uploadPercent}%` }
            }
          />
        </div>
        {uploadPercent === 100 ? (
          <p className="mt-2 text-xs text-slate-500">
            The file is uploaded. Waiting for Nova&apos;s policy analysis to finish.
          </p>
        ) : null}
      </div>

      <ul className="border-t border-[var(--line)]">
        {PROCESSING_STEPS.map((step, index) => {
          const isDone = index < currentStep
          const isActive = index === currentStep && currentStep < PROCESSING_STEPS.length

          return (
            <li
              key={step}
              className={`flex items-center gap-2.5 border-b border-[var(--line)] px-2 py-2 transition-colors duration-300 ${
                isActive ? 'bg-[var(--surface-sunken)]' : ''
              }`}
            >
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#1f8a5b]" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <span className="h-2 w-2 border border-slate-400" />
                )}
              </span>
              <span
                className={`text-[13px] transition-colors duration-300 ${
                  isDone
                    ? 'text-slate-500 line-through decoration-slate-300'
                    : isActive
                      ? 'font-semibold text-slate-950'
                      : 'text-slate-500'
                }`}
              >
                {step}
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
                <span className={`ml-auto ${levvUi.legend} text-[#17704a]`}>
                  Done
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-center text-xs text-slate-500">
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

  const policyTone: LevvTone =
    policyState === 'results'
      ? policyActive
        ? 'emerald'
        : 'slate'
      : policyState === 'processing'
        ? 'blue'
        : policyState === 'error'
          ? 'rose'
          : 'slate'

  return (
    <LevvPanel>
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--rail)] text-[var(--nova)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-slate-950">
            {policyState === 'upload'
              ? 'No policy uploaded'
              : policyState === 'processing'
                ? `Analysing ${policyFileName || 'policy'}...`
                : policyState === 'error'
                  ? 'Policy analysis failed'
                  : analysis?.policyName || policyFileName || 'Policy uploaded'}
          </h2>
          <p className="text-[13px] text-slate-500">
            External workforce policy upload
          </p>
        </div>
        <span className="ml-auto">
          <LevvStatusBadge tone={policyTone}>
            {policyState === 'results'
              ? policyActive
                ? 'Active'
                : 'Deactivated'
              : policyState === 'processing'
                ? 'Processing'
                : policyState === 'error'
                  ? 'Error'
                  : 'Not configured'}
          </LevvStatusBadge>
        </span>
      </div>

      <div className="p-5">
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
            <p className="mb-3 text-[13px] text-slate-600">
              Upload your External Workforce Policy. Nova will extract
              enforceable rules, intake impacts, and configuration gaps.
            </p>
            {/* The whole zone opens the file picker, as before; the button is the zone's one command. */}
            <div
              onClick={() => policyInputRef.current?.click()}
              className="cursor-pointer [&>div]:transition-colors [&>div]:duration-150 hover:[&>div]:border-slate-500"
            >
              <LevvUploadZone
                icon={FileText}
                title="Drop your policy document here"
                description="Supports .pdf, .docx, .txt"
                error={policyError || undefined}
                action={
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      policyInputRef.current?.click()
                    }}
                    className={levvUi.primaryButton}
                  >
                    <Upload />
                    Select file
                  </button>
                }
              />
            </div>
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
    </LevvPanel>
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
    <div className="space-y-4">
      <LevvNotice
        tone={active ? 'emerald' : 'slate'}
        icon={CheckCircle2}
        title={analysis.summary || 'Policy uploaded and analysed.'}
      >
        <span className="tabular-nums">
          {active ? 'Enforcement active' : 'Enforcement deactivated'} ·{' '}
          {totalRules} rules · {gaps.length} configuration gaps
          {analysis.activatedAt ? ` · ${analysis.activatedAt}` : ''}
        </span>
      </LevvNotice>

      <LevvStatStrip>
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
          <LevvStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </LevvStatStrip>

      <div className="border-t border-[var(--line)]">
        <PolicyAccordion
          id="gaps"
          openSections={openSections}
          toggleSection={toggleSection}
          label="Configuration gaps"
          count={gaps.length}
          badges={
            highGaps > 0 ? [{ text: `${highGaps} High`, tone: 'rose' }] : []
          }
        >
          {gaps.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#1f8a5b]" />
              No configuration gaps found.
            </p>
          ) : (
            <ul className="border-t border-[var(--line)]">
              {gaps.map((gap, index) => {
                const suggestedTab = TABS.includes(gap.suggestedTab as Tab)
                  ? (gap.suggestedTab as Tab)
                  : null

                return (
                  <li
                    key={gap.id || `${gap.title}-${index}`}
                    className="flex items-start gap-2.5 border-b border-[var(--line)] py-3"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-[14px] font-semibold text-slate-950">
                          {gap.title}
                        </p>
                        <LevvStatusBadge tone={SEVERITY_TONE[gap.severity]}>
                          {formatSeverity(gap.severity)}
                        </LevvStatusBadge>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                        {gap.description}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                        {gap.recommendation}
                      </p>
                      {suggestedTab && gap.suggestedRowValue ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Tag>
                            {suggestedTab}: {gap.suggestedRowValue}
                          </Tag>
                          {onSelectTab ? (
                            <button
                              type="button"
                              onClick={() => onSelectTab(suggestedTab)}
                              className={levvUi.secondaryButton}
                            >
                              Review table
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
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
              tone: active ? 'emerald' : 'slate',
            },
          ]}
        >
          <div
            className={`mb-3 flex items-center gap-2.5 px-3 py-2.5 ${
              active ? 'bg-[var(--rail)]' : 'bg-[var(--surface-sunken)]'
            }`}
          >
            <Zap
              className={`h-3.5 w-3.5 shrink-0 ${
                active ? 'text-[var(--nova)]' : 'text-slate-400'
              }`}
            />
            <p className="text-[13px] text-white">
              <span className={active ? 'font-semibold text-white' : 'font-semibold text-slate-800'}>
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
            <p className="text-[13px] text-slate-500">
              No enforcement rules were returned.
            </p>
          ) : (
            <ul className="border-t border-[var(--line)]">
              {rules.map((rule, index) => {
                const category =
                  CATEGORY_META[rule.category] ??
                  CATEGORY_META.rate_classification

                return (
                  <li
                    key={rule.id || `${rule.title}-${index}`}
                    className="border-b border-[var(--line)] py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag>{category.label}</Tag>
                      <span className="ml-auto">
                        <Tag>{rule.enforcementType}</Tag>
                      </span>
                      <LevvStatusBadge tone={rule.enforcementStatus === 'active' ? 'emerald' : 'amber'}>
                        {rule.enforcementStatus}
                      </LevvStatusBadge>
                    </div>
                    <p className="mt-2 text-[14px] font-semibold text-slate-950">
                      {rule.title}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                      {rule.statement}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {rule.triggerPoint ? <Tag>{rule.triggerPoint}</Tag> : null}
                      {rule.citation ? <span>{rule.citation}</span> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </PolicyAccordion>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onActiveChange(!active)}
          className={active ? levvUi.dangerGhostButton : levvUi.primaryButton}
        >
          {active ? 'Deactivate policy' : 'Activate policy'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className={levvUi.ghostButton}
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
  badges?: { text: string; tone: LevvTone }[]
  children: ReactNode
}) {
  const isOpen = openSections.has(id)

  return (
    <div className="border-b border-[var(--line)]">
      <button
        type="button"
        onClick={() => toggleSection(id)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left outline-none transition-colors hover:bg-[var(--surface-sunken)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[14px] font-semibold text-slate-950">{label}</span>
          <span className="text-[13px] font-semibold tabular-nums text-slate-500">
            {count}
          </span>
          {badges.map((badge) => (
            <LevvStatusBadge key={badge.text} tone={badge.tone}>
              {badge.text}
            </LevvStatusBadge>
          ))}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen ? <div className="px-1 pb-4 pt-1">{children}</div> : null}
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
    return <p className="text-[13px] text-slate-500">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2.5 text-[13px] text-slate-700">
          <span className="mt-2 h-1 w-1 shrink-0 bg-slate-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
