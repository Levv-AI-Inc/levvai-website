'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowUp,
  Briefcase,
  CheckCircle2,
  FileText,
  Paperclip,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'nova'
  content: string
  actions?: { label: string; prompt: string }[]
  rail?: RailData | null
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

type IntakeListResponse = {
  detail?: unknown
  results?: unknown[]
}

const observations = [
  {
    id: 1,
    tag: 'Expiry risk',
    severity: 'Critical',
    time: '12 min ago',
    body: 'Accenture SOW-2024-0041 expires in 14 days and no renewal is in flight. Strategic dependency is high.',
    primary: 'Draft renewal',
    prompt: 'Draft a renewal for Accenture SOW-2024-0041 expiring in 14 days',
    href: '/services/sow/2024-0041',
  },
  {
    id: 2,
    tag: 'Spend velocity',
    severity: 'Elevated',
    time: '47 min ago',
    body: 'Deloitte is tracking 12% above its approved cap, projecting a $182k overage by quarter-end.',
    primary: 'Review budget',
    prompt: 'Review the Deloitte budget overrun and suggest remediation options',
    href: '/payments/invoices',
  },
  {
    id: 3,
    tag: 'Tenure limit',
    severity: 'Advisory',
    time: '2 hr ago',
    body: 'Three contingent workers are within 60 days of the 18-month policy ceiling.',
    primary: 'Start review',
    prompt: 'Show me the workers approaching the 18-month tenure limit and start recertification',
    href: '/workers/workers',
  },
]

const workstreams = [
  ['Submitted requests', '18', '5 need owner review'],
  ['Active SOWs', '42', '7 renew in 30 days'],
  ['Worker starts', '11', '3 blocked by access'],
  ['Invoice holds', '$96k', 'missing approvals'],
]

const queue = [
  ['Salesforce CPQ support', 'SOW request', '$186k', 'Scope review'],
  ['Plant maintenance technicians', 'Job posting', '$420k', 'Supplier match'],
  ['Data privacy contractor', 'Worker request', '$74k', 'Legal routed'],
  ['Deloitte change order', 'SOW amendment', '$182k', 'Budget variance'],
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
} {
  let text = raw
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

  return { text: text.trim(), actions, rail }
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

export default function Home() {
  const router = useRouter()
  const [clockTime, setClockTime] = useState('')
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [dismissedRailIndex, setDismissedRailIndex] = useState<number | null>(null)
  const [policyActive, setPolicyActive] = useState(false)
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(true)
  const [pendingRequestsError, setPendingRequestsError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const conversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  const hasChat = chatMessages.length > 0
  const pendingRequestLabel = loadingPendingRequests ? '...' : String(pendingRequestCount)
  const activeRailInfo = (() => {
    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const message = chatMessages[index]
      if (message.role === 'nova' && message.rail?.tiles.length) {
        return { rail: message.rail, index }
      }
    }
    return null
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
        const response = await fetch('/api/intake?status=submitted&mine=true', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = (await response.json().catch(() => ({}))) as IntakeListResponse

        if (response.status === 401) {
          router.replace('/auth/login?next=/home')
          return
        }
        if (!response.ok) {
          setPendingRequestCount(0)
          setPendingRequestsError(typeof payload.detail === 'string' ? payload.detail : 'Unable to load pending requests.')
          return
        }
        setPendingRequestCount(Array.isArray(payload.results) ? payload.results.length : 0)
      } catch (error) {
        if ((error as { name?: string })?.name !== 'AbortError') {
          setPendingRequestCount(0)
          setPendingRequestsError('Unable to load pending requests.')
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
    if (hasChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages, isLoading, hasChat])

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationRef.current, policyActive }),
      })
      const data = await res.json()
      const raw: string = data.reply ?? 'I encountered an issue. Please try again.'
      const { text: reply, actions, rail } = parseNovaResponse(raw)
      conversationRef.current = [...conversationRef.current, { role: 'assistant', content: raw }]
      setChatMessages((prev) => [...prev, { role: 'nova', content: reply, actions, rail }])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'nova', content: 'Nova is temporarily unavailable. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, policyActive])

  const navigateToRoute = useCallback((destination: string) => {
    router.push(destination)
  }, [router])

  const handleAction = useCallback((action: { label: string; prompt: string }) => {
    if (action.prompt.startsWith('/')) {
      navigateToRoute(action.prompt)
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
          <button
            type="button"
            onClick={() => setPolicyActive((current) => !current)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase ${
              policyActive
                ? 'border-[#b9dfcf] bg-[#eefaf5] text-[#1f3d38]'
                : 'border-[#e8c5bf] bg-[#fff4f1] text-[#a44135]'
            }`}
            title={policyActive ? 'Policy loaded. Nova can enforce hard stops.' : 'No policy loaded. Nova advises without blocking.'}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {policyActive ? 'Policy active' : 'Policy inactive'}
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-md text-[#6b746f] hover:bg-[#f4f1ea]" title="Attach a document">
            <Paperclip className="h-4 w-4" />
          </button>
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
      <div className="min-h-[calc(100vh-4rem)] bg-[#f4f1ea]">
        <div className="mx-auto max-w-[1120px] space-y-5 px-6 py-8 pb-48">
          <div className="flex items-center justify-between border-b border-[#d8d1c4] pb-4">
            <div className="flex items-center gap-3 text-xs font-bold uppercase text-[#6b746f]">
              <span className="h-2 w-2 rounded-full bg-[#89d3bd]" />
              Nova desk / {clockTime || '--:--'}
            </div>
            <button onClick={endConversation} className="rounded-md px-3 py-1.5 text-xs font-semibold text-[#6b746f] hover:bg-[#fcfbf7]">
              End conversation
            </button>
          </div>

          <div className={hasRail ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]' : ''}>
            <div className="space-y-5">
              {chatMessages.map((message, index) => (
                <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={message.role === 'user' ? 'max-w-[78%] rounded-lg bg-[#e4ddcf] px-5 py-3 text-sm text-[#1e2528]' : 'max-w-[88%] text-sm leading-7 text-[#3d4945]'}>
                    {message.role === 'nova' ? linkifyRecords(message.content) : message.content}
                    {message.role === 'nova' && message.actions && message.actions.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {message.actions.map((action) => {
                          const isRoute = action.prompt.startsWith('/')
                          return (
                            <button
                              key={action.label}
                              type="button"
                              onClick={() => handleAction(action)}
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
                        onClick={() => handleAction({ label: tile.action, prompt: tile.destination })}
                      />
                    ))}
                  </div>
                </div>
              </aside>
            )}
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
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-[#cfc7b8] bg-[#fcfbf7] p-6 shadow-[0_18px_45px_-36px_rgba(31,61,56,0.8)]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#6b746f]">
                <span className="h-2 w-2 rounded-full bg-[#89d3bd]" />
                Nova monitoring / {clockTime || '--:--'}
              </div>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-[#1e2528]">Control desk</h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#52605c]">
                {pendingRequestLabel} submitted requests need review today. One critical renewal, two policy advisories, and four work packages are waiting for routing.
              </p>
              {pendingRequestsError && <p className="mt-2 text-sm font-medium text-[#9a651e]">{pendingRequestsError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button onClick={() => router.push('/requests/sow/create')} className="flex items-center gap-2 rounded-md border border-[#cfc7b8] bg-white px-3 py-2 font-semibold text-[#26312f]">
                <FileText className="h-4 w-4 text-[#1f3d38]" />
                Create SOW
              </button>
              <button onClick={() => router.push('/requests/new/job/create/define')} className="flex items-center gap-2 rounded-md border border-[#cfc7b8] bg-white px-3 py-2 font-semibold text-[#26312f]">
                <Briefcase className="h-4 w-4 text-[#1f3d38]" />
                New posting
              </button>
            </div>
          </div>
          <div className="mt-6">{inputBox}</div>
        </section>

        <section className="rounded-lg border border-[#cfc7b8] bg-[#1e2528] p-5 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#aeb8b2]">
            <Search className="h-3.5 w-3.5" />
            Operating picture
          </div>
          <div className="mt-5 space-y-4">
            {workstreams.map(([label, value, note]) => (
              <div key={label} className="border-t border-white/12 pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-[#d9ddd8]">{label}</span>
                  <span className="text-xl font-semibold text-[#89d3bd]">{value}</span>
                </div>
                <div className="mt-1 text-xs text-[#aeb8b2]">{note}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-[#cfc7b8] bg-[#fcfbf7]">
          <div className="flex items-center justify-between border-b border-[#d8d1c4] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#1e2528]">Work package queue</h2>
              <p className="mt-1 text-xs text-[#6b746f]">Requests that need a decision, owner, or evidence check.</p>
            </div>
            <button onClick={() => router.push('/my-items/jobs')} className="rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-xs font-semibold text-[#26312f]">
              View all
            </button>
          </div>
          <div className="divide-y divide-[#ebe5d8]">
            {queue.map(([title, type, value, state]) => (
              <div key={title} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_130px_100px_120px] sm:items-center">
                <div>
                  <div className="font-semibold text-[#26312f]">{title}</div>
                  <div className="mt-1 text-xs text-[#6b746f]">{type}</div>
                </div>
                <div className="text-sm font-medium text-[#52605c]">{value}</div>
                <div className="text-sm font-medium text-[#52605c]">{state}</div>
                <button className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1f3d38] px-3 py-2 text-xs font-semibold text-white">
                  Open
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </section>

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
