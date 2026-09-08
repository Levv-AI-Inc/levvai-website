'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowUp,
  Briefcase,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Sparkles,
  X,
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

const railVariants: Record<string, { card: string; eyebrow: string; badge: string; sub: string; action: string }> = {
  best: {
    card: 'border-[#89d3bd] bg-[#eefaf5]',
    eyebrow: 'text-[#1f3d38]',
    badge: 'bg-[#d9f3e9] text-[#1f3d38]',
    sub: 'text-[#52605c]',
    action: 'text-[#1f3d38]',
  },
  warn: {
    card: 'border-[#e5b766] bg-[#fff7e6]',
    eyebrow: 'text-[#9a651e]',
    badge: 'bg-[#f8e4b6] text-[#9a651e]',
    sub: 'text-[#665742]',
    action: 'text-[#9a651e]',
  },
  risk: {
    card: 'border-[#e8b5ad] bg-[#fff4f1]',
    eyebrow: 'text-[#a44135]',
    badge: 'bg-[#f5d8d3] text-[#a44135]',
    sub: 'text-[#66504b]',
    action: 'text-[#a44135]',
  },
  default: {
    card: 'border-[#d8d1c4] bg-white',
    eyebrow: 'text-[#1f3d38]',
    badge: 'bg-[#ebe5d8] text-[#52605c]',
    sub: 'text-[#6b746f]',
    action: 'text-[#1f3d38]',
  },
}

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

const workerRoutes: Record<string, string> = {
  'Sarah Cheng': '/cw/work-orders/WO-2024-0089',
  'Marcus Holloway': '/cw/work-orders/WO-2024-0067',
  'Priya Kapoor': '/cw/work-orders/WO-2024-0078',
  'Jin Park': '/cw/work-orders/WO-2024-0079',
  'David Nakamura': '/cw/work-orders/WO-2024-0091',
}

const recordPattern = /(Sarah Cheng|Marcus Holloway|Priya Kapoor|Jin Park|David Nakamura|SOW-\d{4}-\d{4}|WO-\d{4}-\d{4})/g

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
  const pendingRequestCopy = loadingPendingRequests
    ? 'Loading submitted request queue. One critical renewal, two policy advisories, and four work packages are waiting for routing.'
    : `${pendingRequestCount.toLocaleString()} submitted ${pendingRequestCount === 1 ? 'request needs' : 'requests need'} review today. One critical renewal, two policy advisories, and four work packages are waiting for routing.`
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
          setPendingRequestsError(
            error instanceof Error
              ? error.message
              : 'Unable to load pending requests.',
          )
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
          className="inline align-baseline font-semibold text-[#1f3d38] underline decoration-[#89d3bd] underline-offset-2 hover:text-[#255345]"
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
          className={`my-3 space-y-1.5 pl-5 ${listType === 'ul' ? 'list-disc' : 'list-decimal'}`}
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

  const inputBox = (
    <div className="rounded-lg border border-[#cfc7b8] bg-[#fcfbf7] shadow-[0_18px_45px_-36px_rgba(31,61,56,0.75)] focus-within:border-[#1f3d38]">
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
        rows={1}
        disabled={isLoading}
        className="w-full resize-none bg-transparent px-5 pb-2 pt-4 text-[15px] leading-relaxed text-[#1e2528] outline-none placeholder:text-[#8b918e]"
        style={{ minHeight: 32, maxHeight: 180 }}
      />
      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-2">
          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase ${policyActive
              ? 'border-[#b9dfcf] bg-[#eefaf5] text-[#1f3d38]'
              : policyUploaded
                ? 'border-[#d8d1c4] bg-[#f4f1ea] text-[#6b746f]'
                : 'border-[#e8c5bf] bg-[#fff4f1] text-[#a44135]'
              }`}
            title={policyStatusTitle}
          >
            {policyActive ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5" />
            )}
            {policyActive
              ? 'Policy active'
              : policyUploaded
                ? 'Policy deactivated'
                : 'Policy inactive'}
          </span>
          {hasChat && (
            <button
              type="button"
              onClick={endConversation}
              className="rounded-md px-2.5 py-1 text-[10px] font-bold uppercase text-[#6b746f] hover:bg-[#f4f1ea] hover:text-[#1e2528]"
            >
              End conversation
            </button>
          )}
        </div>
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1f3d38] text-white disabled:bg-[#ebe5d8] disabled:text-[#aaa296]"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  if (hasChat) {
    return (
      <div className="h-[calc(100vh-7rem)] overflow-hidden bg-[#f4f1ea] lg:h-[calc(100vh-8rem)]">
        <div ref={chatScrollRef} className="h-full overflow-y-auto">
          <div className="mx-auto max-w-[1120px] space-y-5 px-6 py-8 pb-48">
            <div className="flex items-center justify-between border-b border-[#d8d1c4] pb-4">
              <div className="flex items-center gap-3 text-xs font-bold uppercase text-[#6b746f]">
                <span className="h-2 w-2 rounded-full bg-[#89d3bd]" />
                Nova desk / {clockTime || '--:--'}
              </div>
            </div>

            <div className={hasRail ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]' : ''}>
              <div className="space-y-5">
                {chatMessages.map((message, index) => (
                  <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={message.role === 'user' ? 'max-w-[78%] rounded-lg bg-[#e4ddcf] px-5 py-3 text-sm text-[#1e2528]' : 'max-w-[88%] text-sm leading-7 text-[#3d4945]'}>
                      {message.role === 'nova' ? renderNovaContent(message.content) : message.content}
                      {message.role === 'nova' && message.actions && message.actions.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {message.actions.map((action) => {
                            const isRoute = action.prompt.startsWith('/')
                            return (
                              <button
                                key={action.label}
                                type="button"
                                onClick={() => handleAction(action, message)}
                                className={
                                  isRoute
                                    ? 'inline-flex items-center gap-1.5 rounded-md bg-[#1f3d38] px-3 py-2 text-xs font-semibold text-white hover:bg-[#255345]'
                                    : 'inline-flex items-center gap-1.5 rounded-md border border-[#cfc7b8] bg-[#fcfbf7] px-3 py-2 text-xs font-semibold text-[#1f3d38] hover:bg-[#f4f1ea]'
                                }
                              >
                                {action.label}
                                {isRoute && <ArrowRight className="h-3 w-3" />}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && <div className="text-sm text-[#6b746f]">Nova is reviewing the record...</div>}
                <div ref={chatEndRef} />
              </div>

              {activeRail && (
                <aside className="hidden lg:block">
                  <div className="sticky top-24 rounded-lg border border-[#cfc7b8] bg-[#fcfbf7] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase text-[#1f3d38]">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{activeRail.header}</span>
                      </div>
                      <button
                        type="button"
                        onClick={dismissRail}
                        className="rounded-md p-1 text-[#8b918e] hover:bg-[#f4f1ea] hover:text-[#52605c]"
                        aria-label="Hide Nova rail"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {activeRail.tiles.map((tile, index) => (
                        <RailTile
                          key={`${tile.title}-${index}`}
                          tile={tile}
                          onClick={() => handleAction({ label: tile.action, prompt: tile.destination }, chatMessages[activeRailInfo!.index])}
                        />
                      ))}
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-[#f4f1ea] via-[#f4f1ea] to-transparent pb-4 pt-12 lg:left-64">
          <div className="mx-auto max-w-[1120px] px-6">{inputBox}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-6">
        <section className="rounded-lg border border-[#cfc7b8] bg-[#fcfbf7] p-6 shadow-[0_18px_45px_-36px_rgba(31,61,56,0.8)]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#6b746f]">
                <span className="h-2 w-2 rounded-full bg-[#89d3bd]" />
                Nova monitoring
              </div>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-[#1e2528]">Control desk</h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#52605c]">
                {pendingRequestCopy}
              </p>
              {pendingRequestsError && <p className="mt-2 text-sm font-medium text-[#9a651e]">{pendingRequestsError}</p>}
            </div>
          </div>
          <div className="mt-6">{inputBox}</div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Link
              href="/requests/sow/create"
              onClick={clearSowDrafts}
              className="group flex min-h-[76px] items-center justify-between gap-4 rounded-lg border border-[#bfc9c0] bg-[#f7fbf8] px-4 py-3 text-left shadow-[0_14px_35px_-30px_rgba(31,61,56,0.85)] transition hover:-translate-y-0.5 hover:border-[#89d3bd] hover:bg-[#eefaf5] hover:shadow-[0_18px_38px_-28px_rgba(31,61,56,0.75)] focus:outline-none focus:ring-2 focus:ring-[#89d3bd] focus:ring-offset-2 focus:ring-offset-[#fcfbf7]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#1f3d38] text-white shadow-sm">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-[#1e2528]">Create SOW</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#52605c]">Scope, terms, and commercials</span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#1f3d38] transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/requests/new/job/create/define"
              onClick={clearJobDrafts}
              className="group flex min-h-[76px] items-center justify-between gap-4 rounded-lg border border-[#d8c49a] bg-[#fffaf0] px-4 py-3 text-left shadow-[0_14px_35px_-30px_rgba(154,101,30,0.75)] transition hover:-translate-y-0.5 hover:border-[#e5b766] hover:bg-[#fff7e6] hover:shadow-[0_18px_38px_-28px_rgba(154,101,30,0.7)] focus:outline-none focus:ring-2 focus:ring-[#e5b766] focus:ring-offset-2 focus:ring-offset-[#fcfbf7]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#9a651e] text-white shadow-sm">
                  <Briefcase className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-[#1e2528]">Create Job Posting</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#665742]">Role, suppliers, and rates</span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#9a651e] transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </div>

      <div>
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#1f3d38]">
            <Sparkles className="h-3.5 w-3.5" />
            Nova brief
          </div>
          {observations.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#cfc7b8] bg-[#fcfbf7] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-[#e9f5ef] px-2 py-1 text-[10px] font-bold uppercase text-[#1f3d38]">{item.tag}</span>
                <span className="text-[10px] font-bold uppercase text-[#6b746f]">{item.severity}</span>
                <span className="text-[10px] text-[#8b918e]">{item.time}</span>
              </div>
              <p className="text-sm leading-6 text-[#3d4945]">{item.body}</p>
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => sendMessage(item.prompt)} className="rounded-md bg-[#1f3d38] px-3 py-2 text-xs font-semibold text-white">
                  {item.primary}
                </button>
                <button onClick={() => router.push(item.href)} className="rounded-md px-3 py-2 text-xs font-semibold text-[#52605c] hover:bg-[#f4f1ea]">
                  Open record
                </button>
                <CheckCircle2 className="ml-auto h-4 w-4 text-[#255345]" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function RailTile({
  tile,
  onClick,
}: {
  tile: RailTileData
  onClick: () => void
}) {
  const variant = railVariants[tile.variant] || railVariants.default

  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${variant.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`text-[10px] font-bold uppercase ${variant.eyebrow}`}>
          {tile.eyebrow}
        </div>
        {tile.badge && (
          <div className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${variant.badge}`}>
            {tile.badge}
          </div>
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#1e2528]">
        {tile.title}
      </div>
      <div className={`mt-1 text-xs leading-5 ${variant.sub}`}>
        {tile.subtitle}
      </div>
      <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${variant.action}`}>
        {tile.action}
        <ArrowRight className="h-3 w-3" />
      </div>
    </button>
  )
}
