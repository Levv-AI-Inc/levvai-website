'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  Briefcase,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react'
import { getIntakes, IntakeApiError } from '@/lib/api/intake'
import { usePolicyStatus, type StoredPolicyStatus } from '../../lib/policyStatus'
import {
  NOVA_SOW_DRAFT_STORAGE_KEY,
  SOW_DRAFT_STORAGE_KEY,
  type SOWData,
  type SOWProgressStep,
} from '../requests/sow/create/context'
import {
  CW_REQUEST_STORAGE_KEY,
  NOVA_JOB_DRAFT_STORAGE_KEY,
  type CWRequest,
} from '../requests/new/job/context/CWRequestContext'
import {
  LevvNotice,
  LevvPage,
  LevvRecordHeader,
  LevvPanel,
  LevvPanelHeader,
  LevvStatusBadge,
  levvUi,
  type LevvTone,
} from '@/components/ui/levv-app'
import { MOCK_WORKERS } from '@/lib/mockWorkers'

interface ChatMessage {
  role: 'user' | 'nova'
  content: string
  actions?: { label: string; prompt: string }[]
  rail?: RailData | null
  sowDraft?: Partial<SOWData> | null
  jobDraft?: Partial<CWRequest> | null
}

interface RailTileData {
  variant: string
  eyebrow: string
  title: string
  subtitle: string
  action: string
  destination: string
  badge: string
}

interface RailData {
  header: string
  tiles: RailTileData[]
}

type UploadedPolicyAnalysis = {
  policyName?: string
  summary?: string
  rules?: Array<{
    title?: string
    statement?: string
    citation?: string
    enforcementStatus?: string
  }>
  gaps?: Array<{
    severity?: string
    title?: string
    description?: string
  }>
  intakeImpacts?: string[]
  configChanges?: string[]
}

function isUploadedPolicyAnalysis(value: unknown): value is UploadedPolicyAnalysis {
  return Boolean(value) && typeof value === 'object'
}

function compactList(items: string[], limit: number) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function buildPolicyContext(policyStatus: StoredPolicyStatus) {
  if (!policyStatus.fileName && !policyStatus.policyName && !policyStatus.analysis) {
    return ''
  }

  const analysis = isUploadedPolicyAnalysis(policyStatus.analysis)
    ? policyStatus.analysis
    : null
  const lines: string[] = []

  const name = analysis?.policyName || policyStatus.policyName || policyStatus.fileName
  if (name) lines.push(`Policy: ${name}`)

  const summary = analysis?.summary || policyStatus.summary
  if (summary) lines.push(`Summary: ${summary}`)

  const rules = (analysis?.rules ?? [])
    .map((rule) =>
      [
        rule.title,
        rule.statement,
        rule.citation ? `(${rule.citation})` : '',
        rule.enforcementStatus ? `[${rule.enforcementStatus}]` : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .slice(0, 8)
  if (rules.length) lines.push(`Key rules:\n- ${rules.join('\n- ')}`)

  const intakeImpacts = compactList(analysis?.intakeImpacts ?? [], 5)
  if (intakeImpacts.length) {
    lines.push(`Intake impacts:\n- ${intakeImpacts.join('\n- ')}`)
  }

  const configChanges = compactList(analysis?.configChanges ?? [], 5)
  if (configChanges.length) {
    lines.push(`Configuration changes:\n- ${configChanges.join('\n- ')}`)
  }

  const gaps = (analysis?.gaps ?? [])
    .map((gap) =>
      [gap.severity ? `${gap.severity}:` : '', gap.title, gap.description]
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .slice(0, 5)
  if (gaps.length) lines.push(`Open configuration gaps:\n- ${gaps.join('\n- ')}`)

  return lines.join('\n\n').slice(0, 3500)
}

const observations = [
  {
    id: 3,
    tag: 'Tenure limit',
    severity: 'Advisory',
    time: 'Flagged 2 hours ago',
    body: "Three contingent workers are within 60 days of the 18-month policy ceiling under §4.2. They'll need recertification or off-boarding.",
    primary: 'Start recertification',
    prompt: 'Show me the workers approaching the 18-month tenure limit and start recertification',
    href: '/workers/workers',
  },
]

/* Rail tiles carry Nova's read of each option; the variant only ever shows as a status tone. */
const railTones: Record<string, LevvTone> = {
  best: 'blue',
  warn: 'amber',
  risk: 'rose',
  default: 'slate',
}

const railToneDot: Record<LevvTone, string> = {
  blue: 'bg-blue-600',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
}

/* Nova writes rail labels in capitals ("RECORD REVIEW"); show them in sentence case, keeping real acronyms. */
const KEEP_UPPERCASE = new Set(['SOW', 'SOWS', 'T&M', 'HR', 'HCM', 'IR35', 'AI', 'PO', 'CW', 'CWS', 'HQ', 'NY', 'SLA', 'MSA', 'KPI', 'ID'])

function displayLabel(label: string) {
  if (!label || label !== label.toUpperCase() || !/[A-Z]/.test(label)) return label
  const words = label.split(/(\s+)/).map((word) => {
    const core = word.replace(/[^A-Z0-9&]/g, '')
    if (KEEP_UPPERCASE.has(core) || (/\d/.test(core) && /[A-Z]/.test(core))) return word
    return word.toLowerCase()
  })
  const text = words.join('')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/* Bare textarea inside the composer: outranks the app layer's field styling (globals.css) so the composer owns the border and focus ring. */
const BARE_TEXTAREA =
  '[.levv-auth-shell_&&&]:!rounded-none [.levv-auth-shell_&&&]:!bg-transparent [.levv-auth-shell_&&&]:!shadow-none'

const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2'

function parseNovaResponse(raw: string): {
  text: string
  actions: { label: string; prompt: string }[]
  rail: RailData | null
  sowDraft: Partial<SOWData> | null
  jobDraft: Partial<CWRequest> | null
} {
  const extractedSowDraft = extractNovaDraft(raw, '[NOVA_SOW_DRAFT:')
  const extractedJobDraft = extractNovaDraft(extractedSowDraft.text, '[NOVA_JOB_DRAFT:')
  let text = extractedJobDraft.text
  let rail: RailData | null = null

  const railMatch = text.match(/\[NOVA_RAIL:\s*([^\]]+)\]/)
  if (railMatch) {
    const body = railMatch[1].trim()
    text = text.replace(railMatch[0], '')

    const [headerPart = '', tilesPart = body] = body.split('::')
    const tilesRaw = body.includes('::') ? tilesPart : body
    const tiles = tilesRaw
      .split(';')
      .map((tile) => {
        const parts = tile.split('|').map((part) => part.trim())
        return {
          variant: (parts[0] || 'default').toLowerCase(),
          eyebrow: parts[1] || '',
          title: parts[2] || '',
          subtitle: parts[3] || '',
          action: parts[4] || '',
          destination: parts[5] || '',
          badge: parts[6] || '',
        }
      })
      .filter((tile) => tile.title && tile.action && tile.destination)
      .slice(0, 3)

    if (tiles.length > 0) {
      rail = { header: body.includes('::') ? headerPart.trim() : 'For this', tiles }
    }
  }

  let actions: { label: string; prompt: string }[] = []
  const actionMatch = text.match(/\[NOVA_ACTIONS:\s*([^\]]+)\]/)
  if (actionMatch) {
    actions = actionMatch[1]
      .split(';')
      .map((item) => {
        const [label = '', prompt = ''] = item.split('|').map((part) => part.trim())
        return { label, prompt }
      })
      .filter((action) => action.label && action.prompt)
      .slice(0, 3)
    text = text.replace(actionMatch[0], '')
  }

  return {
    text: text.trim(),
    actions,
    rail,
    sowDraft: extractedSowDraft.draft
      ? normalizeNovaSowDraft(extractedSowDraft.draft as Partial<SOWData>)
      : null,
    jobDraft: extractedJobDraft.draft
      ? normalizeNovaJobDraft(extractedJobDraft.draft as Partial<CWRequest>)
      : null,
  }
}

function extractNovaDraft(raw: string, marker: string): {
  text: string
  draft: Record<string, unknown> | null
} {
  const markerIndex = raw.indexOf(marker)
  if (markerIndex === -1) return { text: raw, draft: null }

  const jsonStart = raw.indexOf('{', markerIndex + marker.length)
  if (jsonStart === -1) {
    return { text: raw.replace(marker, '').trim(), draft: null }
  }

  let depth = 0
  let inString = false
  let escaped = false
  let jsonEnd = -1

  for (let index = jsonStart; index < raw.length; index += 1) {
    const char = raw[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        jsonEnd = index
        break
      }
    }
  }

  if (jsonEnd === -1) {
    return {
      text: `${raw.slice(0, markerIndex)}${raw.slice(jsonStart)}`.trim(),
      draft: null,
    }
  }

  const tagEnd = raw[jsonEnd + 1] === ']' ? jsonEnd + 2 : jsonEnd + 1
  const text = `${raw.slice(0, markerIndex)}${raw.slice(tagEnd)}`.trim()

  try {
    return {
      text,
      draft: JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>,
    }
  } catch (error) {
    console.error('Unable to parse Nova draft', error)
    return { text, draft: null }
  }
}

function normalizeNovaSowDraft(draft: Partial<SOWData>): Partial<SOWData> {
  const normalized: Partial<SOWData> = { ...draft }
  const rawGateAnswer =
    typeof draft.aiGateAnswer === 'string'
      ? draft.aiGateAnswer.toLowerCase().trim()
      : draft.aiGateAnswer

  if (rawGateAnswer === 'no' || rawGateAnswer === 'false') {
    normalized.aiGateAnswer = 'no'
    normalized.aiAutomation = []
    normalized.aiAutomationFormOpen = false
  } else if (rawGateAnswer === 'yes' || rawGateAnswer === 'true') {
    normalized.aiGateAnswer = 'yes'
  }

  if (normalized.aiGateAnswer === 'no') {
    normalized.completedSteps = Array.from(
      new Set<SOWProgressStep>([...(draft.completedSteps || []), 'ai-automation']),
    )
  }

  return normalized
}

function normalizeNovaJobDraft(draft: Partial<CWRequest>): Partial<CWRequest> {
  const normalized: Partial<CWRequest> = { ...draft }
  const parseNumber = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^0-9.-]/g, ''))
      if (Number.isFinite(parsed)) return parsed
    }
    return undefined
  }

  const targetRate = parseNumber(draft.targetRate ?? draft.enteredRate)
  if (targetRate !== undefined) {
    normalized.targetRate = targetRate
    normalized.enteredRate = targetRate
    normalized.stRate = targetRate
    normalized.rateMode = 'fixed'
  }

  const positions = parseNumber(draft.positions)
  if (positions !== undefined) normalized.positions = Math.max(1, Math.round(positions))

  const hoursPerWeek = parseNumber(draft.hoursPerWeek)
  if (hoursPerWeek !== undefined) normalized.hoursPerWeek = hoursPerWeek

  normalized.rateUnit = normalized.rateUnit || 'hourly'
  normalized.currency = normalized.currency || 'USD'

  return normalized
}

function persistNovaSowDraft(sowDraft: Partial<SOWData> | null | undefined) {
  if (!sowDraft) {
    clearSowDrafts()
    return
  }

  window.sessionStorage.setItem(NOVA_SOW_DRAFT_STORAGE_KEY, JSON.stringify(sowDraft))
}

function persistNovaJobDraft(jobDraft: Partial<CWRequest> | null | undefined) {
  if (!jobDraft) {
    clearJobDrafts()
    return
  }

  window.sessionStorage.setItem(NOVA_JOB_DRAFT_STORAGE_KEY, JSON.stringify(jobDraft))
}

function clearSowDrafts() {
  window.sessionStorage.removeItem(NOVA_SOW_DRAFT_STORAGE_KEY)
  window.sessionStorage.removeItem(SOW_DRAFT_STORAGE_KEY)
}

function clearJobDrafts() {
  window.sessionStorage.removeItem(NOVA_JOB_DRAFT_STORAGE_KEY)
  window.sessionStorage.removeItem(CW_REQUEST_STORAGE_KEY)
}

const workerRoutes = Object.fromEntries(
  MOCK_WORKERS.map((worker) => [worker.name, '/workers/workers']),
) as Record<string, string>

const workerNamePattern = MOCK_WORKERS.map((worker) =>
  worker.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
).join('|')
const recordPattern = new RegExp(
  `(${workerNamePattern}|SOW-\\d{4}-\\d{4}|WO-\\d{4}-\\d{4})`,
  'g',
)

function recordRoute(token: string): string | null {
  if (workerRoutes[token]) return workerRoutes[token]
  if (token.startsWith('SOW-')) return `/services/sow/${token.replace('SOW-', '')}`
  if (token.startsWith('WO-')) return `/cw/work-orders/${token}`
  return null
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length !== 2) return ''
  return parts.pop()?.split(';').shift() ?? ''
}

function csrfHeaders() {
  const csrfToken = getCookie('csrftoken')
  return csrfToken ? { 'X-CSRFToken': csrfToken } : {}
}

export default function Home() {
  const router = useRouter()
  const [clockTime, setClockTime] = useState('')
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [dismissedRailIndex, setDismissedRailIndex] = useState<number | null>(null)
  const policyStatus = usePolicyStatus()
  const policyUploaded = Boolean(policyStatus.fileName || policyStatus.policyName || policyStatus.analysis)
  const policyActive = policyStatus.active
  const policyContext = policyActive ? buildPolicyContext(policyStatus) : ''
  const policyStatusTitle = policyUploaded
    ? [
      policyStatus.policyName || policyStatus.fileName || 'Policy uploaded',
      policyStatus.summary,
    ]
      .filter(Boolean)
      .join(': ')
    : 'No policy loaded. Nova advises without blocking.'
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(true)
  const [pendingRequestsError, setPendingRequestsError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const conversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  const hasChat = chatMessages.length > 0
  // The desk's sentence says only what the page knows: the caller's submitted queue and the policy state.
  const queueSentence = loadingPendingRequests
    ? 'Loading your requests…'
    : pendingRequestsError
      ? 'Your request queue could not be loaded.'
      : pendingRequestCount === 0
        ? 'None of your submitted requests is waiting for review.'
        : `${pendingRequestCount.toLocaleString()} of your submitted ${pendingRequestCount === 1 ? 'requests is' : 'requests are'} waiting for review.`
  const policySentence = policyActive
    ? 'Your policy is loaded and active.'
    : policyUploaded
      ? 'Your policy is uploaded but switched off, so Nova advises without blocking.'
      : 'No policy is loaded, so Nova advises without blocking.'
  const activeRailInfo = (() => {
    const index = chatMessages.length - 1
    const message = chatMessages[index]

    if (message?.role !== 'nova' || !message.rail?.tiles.length) return null

    return { rail: message.rail, index }
  })()
  const hasRail = !!activeRailInfo && activeRailInfo.index !== dismissedRailIndex
  const activeRail = hasRail ? activeRailInfo!.rail : null

  useEffect(() => {
    const tick = () =>
      setClockTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
    tick()
    const id = setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadPendingRequests() {
      setLoadingPendingRequests(true)
      setPendingRequestsError('')

      try {
        const response = await getIntakes({
          mine: true,
          status: 'submitted',
          page: 1,
          page_size: 1,
        })
        if (controller.signal.aborted) return
        setPendingRequestCount(response.pagination.total_count)
      } catch (error) {
        if (error instanceof IntakeApiError && error.status === 401) {
          router.replace('/auth/login?next=/home')
          return
        }
        if ((error as { name?: string })?.name !== 'AbortError') {
          setPendingRequestCount(0)
          // People see a plain sentence; the raw failure goes to the console for whoever debugs it.
          console.error('Control desk: request queue failed to load', error)
          setPendingRequestsError('Your request queue could not be loaded. Refresh the page to try again.')
        }
      } finally {
        if (!controller.signal.aborted) setLoadingPendingRequests(false)
      }
    }

    void loadPendingRequests()
    return () => controller.abort()
  }, [router])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  useEffect(() => {
    if (!hasChat) return

    let frame = 0
    const timeout = window.setTimeout(() => {
      frame = window.requestAnimationFrame(() => {
        const container = chatScrollRef.current
        if (!container) return

        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth',
        })
      })
    }, 0)

    return () => {
      window.clearTimeout(timeout)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [chatMessages, isLoading, hasChat, hasRail])

  const sendMessage = useCallback(async (text?: string) => {
    const value = (text ?? input).trim()
    if (!value || isLoading) return

    setInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: value }])
    conversationRef.current = [...conversationRef.current, { role: 'user', content: value }]
    setIsLoading(true)

    try {
      const res = await fetch('/api/nova/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          messages: conversationRef.current,
          policyActive,
          policyUploaded: policyActive && policyUploaded,
          policyContext,
        }),
      })
      const data = await res.json()
      const raw: string = data.reply ?? 'I encountered an issue. Please try again.'
      const { text: reply, actions, rail, sowDraft, jobDraft } = parseNovaResponse(raw)
      conversationRef.current = [...conversationRef.current, { role: 'assistant', content: raw }]
      setChatMessages((prev) => [...prev, { role: 'nova', content: reply, actions, rail, sowDraft, jobDraft }])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'nova', content: 'Nova is temporarily unavailable. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, policyActive, policyUploaded, policyContext])

  const navigateToRoute = useCallback((
    destination: string,
    drafts?: {
      sowDraft?: Partial<SOWData> | null
      jobDraft?: Partial<CWRequest> | null
    },
  ) => {
    if (destination.startsWith('/requests/sow/create')) {
      persistNovaSowDraft(drafts?.sowDraft)
    } else if (destination.startsWith('/requests/new/job/create')) {
      persistNovaJobDraft(drafts?.jobDraft)
    }

    router.push(destination)
  }, [router])

  const handleAction = useCallback((action: { label: string; prompt: string }, message?: ChatMessage) => {
    if (action.prompt.startsWith('/')) {
      navigateToRoute(action.prompt, {
        sowDraft: message?.sowDraft,
        jobDraft: message?.jobDraft,
      })
      return
    }
    void sendMessage(action.prompt)
  }, [navigateToRoute, sendMessage])

  const linkifyRecords = useCallback((content: string) =>
    content.split(recordPattern).map((part, index) => {
      const route = recordRoute(part)
      if (!route) return <span key={index}>{part}</span>
      return (
        <button
          key={index}
          type="button"
          onClick={() => navigateToRoute(route)}
          className="inline rounded-sm align-baseline font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 transition-colors duration-150 ease-out hover:text-blue-800 hover:decoration-blue-600"
        >
          {part}
        </button>
      )
    }), [navigateToRoute])

  const renderNovaContent = useCallback((content: string) => {
    const blocks: ReactNode[] = []
    const lines = content.split(/\r?\n/)
    let paragraph: string[] = []
    let listItems: string[] = []
    let listType: 'ul' | 'ol' | null = null

    const flushParagraph = () => {
      const text = paragraph.join('\n').trim()
      if (!text) {
        paragraph = []
        return
      }
      blocks.push(
        <p key={`p-${blocks.length}`} className="whitespace-pre-wrap">
          {linkifyRecords(text)}
        </p>,
      )
      paragraph = []
    }

    const flushList = () => {
      if (!listType || listItems.length === 0) return
      const Tag = listType
      blocks.push(
        <Tag
          key={`list-${blocks.length}`}
          className={`space-y-1.5 pl-5 marker:text-slate-400 ${listType === 'ul' ? 'list-disc' : 'list-decimal'}`}
        >
          {listItems.map((item, index) => (
            <li key={index} className="pl-1">
              {linkifyRecords(item)}
            </li>
          ))}
        </Tag>,
      )
      listItems = []
      listType = null
    }

    lines.forEach((line) => {
      const trimmed = line.trim()
      const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/)
      const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)

      if (!trimmed) {
        flushParagraph()
        flushList()
        return
      }

      if (bulletMatch || numberedMatch) {
        const nextType = bulletMatch ? 'ul' : 'ol'
        flushParagraph()
        if (listType && listType !== nextType) flushList()
        listType = nextType
        listItems.push((bulletMatch?.[1] ?? numberedMatch?.[1] ?? '').trim())
        return
      }

      flushList()
      paragraph.push(line)
    })

    flushParagraph()
    flushList()

    return <div className="space-y-3">{blocks.length ? blocks : linkifyRecords(content)}</div>
  }, [linkifyRecords])

  const endConversation = useCallback(() => {
    setChatMessages([])
    conversationRef.current = []
    setInput('')
    setDismissedRailIndex(null)
  }, [])

  const dismissRail = useCallback(() => {
    setDismissedRailIndex(activeRailInfo?.index ?? null)
  }, [activeRailInfo])

  const policyTone: LevvTone = policyActive ? 'emerald' : policyUploaded ? 'slate' : 'amber'

  const inputBox = (
    <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3 pb-3 pt-3 transition-[border-color,box-shadow] duration-150 ease-out hover:border-slate-400/60 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--focus)]">
      <div className="flex items-start gap-3">
        <NovaMark className="mt-1" />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              sendMessage()
            }
          }}
          placeholder="Ask Nova to inspect an SOW, explain a blocker, or prepare an approval note..."
          aria-label="Message Nova"
          rows={1}
          disabled={isLoading}
          className={`levv-bare min-w-0 flex-1 resize-none border-0 bg-transparent px-0 py-1.5 text-sm leading-6 text-slate-900 outline-none focus-visible:outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 ${BARE_TEXTAREA}`}
          style={{ minHeight: 36, maxHeight: 180 }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span role="status" aria-live="polite" title={policyStatusTitle} className="inline-flex">
            <LevvStatusBadge tone={policyTone} icon={policyActive ? CheckCircle2 : ShieldAlert}>
              {policyActive
                ? 'Policy active'
                : policyUploaded
                  ? 'Policy deactivated'
                  : 'Policy inactive'}
            </LevvStatusBadge>
          </span>
          {hasChat && (
            <button
              type="button"
              onClick={endConversation}
              className={`levv-press inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${FOCUS_RING}`}
            >
              End conversation
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          className={`levv-press ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${FOCUS_RING}`}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  if (hasChat) {
    return (
      <LevvPage width="standard">
        <section
          aria-label="Nova desk"
          className="flex h-[calc(100dvh-6.5rem)] flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white sm:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-8rem)]"
        >
          <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--line)] px-4 py-3 sm:px-5">
            <NovaMark />
            <p className="text-[13px] font-medium text-slate-900">
              Nova desk <span className="text-slate-400">/</span>{' '}
              <span className="font-normal tabular-nums text-slate-500">{clockTime || '--:--'}</span>
            </p>
            <span aria-hidden className="ml-1 h-1.5 w-1.5 bg-emerald-600" />
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <div role="log" aria-label="Conversation with Nova" className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
                  {chatMessages.map((message, index) =>
                    message.role === 'user' ? (
                      <div key={index} className="flex justify-end">
                        <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-xl bg-slate-100 px-4 py-2.5 text-sm leading-6 text-slate-900">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div key={index} className="flex justify-start gap-3">
                        <NovaMark className="mt-0.5" />
                        <div className="min-w-0 max-w-[88%] text-sm leading-6 text-slate-700">
                          {renderNovaContent(message.content)}
                          {message.actions && message.actions.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {message.actions.map((action) => {
                                const isRoute = action.prompt.startsWith('/')
                                return (
                                  <button
                                    key={action.label}
                                    type="button"
                                    onClick={() => handleAction(action, message)}
                                    className={`${isRoute ? levvUi.primaryButton : levvUi.secondaryButton} group`}
                                  >
                                    {action.label}
                                    {isRoute && (
                                      <ArrowRight className="transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                  {isLoading && (
                    <div role="status" className="flex items-center gap-3">
                      <NovaMark />
                      <span className="flex items-center gap-2 text-[13px] text-slate-500">
                        <span aria-hidden className="h-1.5 w-1.5 animate-pulse bg-[var(--nova)] motion-reduce:animate-none" />
                        Nova is reviewing the record...
                      </span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>
              <div className="shrink-0 px-4 pb-4 pt-2 sm:px-6">
                <div className="mx-auto max-w-3xl">{inputBox}</div>
              </div>
            </div>

            {activeRail && (
              <aside
                aria-label={displayLabel(activeRail.header)}
                className="hidden w-80 shrink-0 flex-col border-l border-[var(--line)] bg-[var(--surface-sunken)] lg:flex"
              >
                <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
                  <h2 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-950">
                    <Sparkles className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{displayLabel(activeRail.header)}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={dismissRail}
                    className={`levv-press flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 ${FOCUS_RING}`}
                    aria-label="Hide Nova rail"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4 pt-1">
                  {activeRail.tiles.map((tile, index) => (
                    <RailTile
                      key={`${tile.title}-${index}`}
                      tile={tile}
                      onClick={() => handleAction({ label: tile.action, prompt: tile.destination }, chatMessages[activeRailInfo!.index])}
                    />
                  ))}
                </div>
              </aside>
            )}
          </div>
        </section>
      </LevvPage>
    )
  }

  return (
    <LevvPage width="standard">
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Home"
          title="Control desk"
          statement={<span aria-live="polite">{queueSentence} {policySentence}</span>}
          figures={[
            {
              label: 'Waiting for review',
              value: loadingPendingRequests || pendingRequestsError ? '—' : pendingRequestCount.toLocaleString(),
            },
          ]}
        >
          <section aria-label="Ask Nova">{inputBox}</section>
        </LevvRecordHeader>

        {pendingRequestsError && (
          <LevvNotice tone="amber" icon={AlertTriangle}>
            {pendingRequestsError}
          </LevvNotice>
        )}

        <section aria-label="Start a request">
          <div className="grid gap-3 sm:grid-cols-2">
            <StartLink
              href="/requests/sow/create"
              onClick={clearSowDrafts}
              icon={FileText}
              title="Create SOW"
              detail="Scope, terms, and commercials"
            />
            <StartLink
              href="/requests/new/job/create/define"
              onClick={clearJobDrafts}
              icon={Briefcase}
              title="Create Job Posting"
              detail="Role, suppliers, and rates"
            />
          </div>
        </section>

        <LevvPanel>
          <LevvPanelHeader
            title={
              <span className="flex items-center gap-2.5">
                <NovaMark />
                Nova brief
              </span>
            }
            className="border-b border-[var(--line)] px-5 py-3.5"
          />
          <ul className="divide-y divide-[var(--line)]">
            {observations.map((item) => (
              <li key={item.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <h3 className="text-sm font-semibold text-slate-950">{item.tag}</h3>
                  <LevvStatusBadge tone="amber">{item.severity}</LevvStatusBadge>
                  <span className="text-xs text-slate-500 sm:ml-auto">{item.time}</span>
                </div>
                <p className="mt-2 max-w-[80ch] text-sm leading-6 text-slate-700">{item.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => sendMessage(item.prompt)} className={levvUi.primaryButton}>
                    {item.primary}
                  </button>
                  <Link href={item.href} className={levvUi.ghostButton}>
                    Open record
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </LevvPanel>
      </div>
    </LevvPage>
  )
}

/* Nova's mark: the navy chip with the sky icon, as in LevvNovaPrompt. */
function NovaMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--rail)] text-[var(--nova)] ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  )
}

function StartLink({
  href,
  onClick,
  icon: Icon,
  title,
  detail,
}: {
  href: string
  onClick: () => void
  icon: LucideIcon
  title: string
  detail: string
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`levv-press group flex min-h-[64px] min-w-0 items-center gap-3 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-3 hover:border-slate-950 ${FOCUS_RING}`}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-950">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>
      </span>
      <ArrowRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-slate-400 transition-[color,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-slate-700"
      />
    </Link>
  )
}

function RailTile({
  tile,
  onClick,
}: {
  tile: RailTileData
  onClick: () => void
}) {
  const tone = railTones[tile.variant] || railTones.default

  return (
    <button
      type="button"
      onClick={onClick}
      className={`levv-press group block w-full rounded-lg border border-[var(--line)] bg-white p-3 text-left hover:border-[var(--line-strong)] ${FOCUS_RING}`}
    >
      {(tile.eyebrow || tile.badge) && (
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
            {tone !== 'slate' && <span aria-hidden className={`h-1.5 w-1.5 shrink-0 ${railToneDot[tone]}`} />}
            <span className="truncate">{displayLabel(tile.eyebrow)}</span>
          </span>
          {tile.badge && (
            <LevvStatusBadge tone={tone} dot={false}>
              {displayLabel(tile.badge)}
            </LevvStatusBadge>
          )}
        </div>
      )}
      <div className="mt-1.5 text-[13px] font-semibold text-slate-950">
        {tile.title}
      </div>
      {tile.subtitle && (
        <div className="mt-0.5 text-xs leading-5 text-slate-500">
          {tile.subtitle}
        </div>
      )}
      <div className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-blue-700">
        {tile.action}
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}
