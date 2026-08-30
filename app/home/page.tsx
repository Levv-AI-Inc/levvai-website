'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, ArrowRight, X, Paperclip, ArrowUp, FileText, Briefcase } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Nova's observations ──────────────────────────────────────────────────────

const OBSERVATIONS = [
  {
    id: 1,
    severity: 'CRITICAL',
    tag: 'Expiry risk',
    time: 'Flagged 12 min ago',
    body: "Accenture SOW-2024-0041 expires in 14 days and no renewal is in flight. Given the strategic nature of this work, I'd suggest contacting procurement by Friday.",
    primary: { label: 'Draft renewal', href: '/services/sow/2024-0041', prompt: 'Draft a renewal for Accenture SOW-2024-0041 expiring in 14 days' },
    secondary: { label: 'Open SOW', href: '/services/sow/2024-0041' },
    barClass: 'bg-rose-500',
    dotClass: 'bg-rose-500',
    pulseClass: 'bg-rose-400',
    chipClass: 'text-rose-700',
    primaryBtnClass: 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_6px_18px_-6px_rgba(225,29,72,0.5)]',
  },
  {
    id: 2,
    severity: 'ELEVATED',
    tag: 'Spend velocity',
    time: 'Flagged 47 min ago',
    body: "The Deloitte engagement is tracking 12% above its approved cap, which projects a $182k overage by quarter-end. You'll want to either expand scope or trim.",
    primary: { label: 'Adjust budget', href: '/payments/invoices', prompt: 'Review the Deloitte budget overrun and suggest remediation options' },
    secondary: { label: 'View spend', href: '/payments/invoices' },
    barClass: 'bg-amber-500',
    dotClass: 'bg-amber-500',
    pulseClass: 'bg-amber-400',
    chipClass: 'text-amber-700',
    primaryBtnClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-[0_6px_18px_-6px_rgba(217,119,6,0.5)]',
  },
  {
    id: 3,
    severity: 'ADVISORY',
    tag: 'Tenure limit',
    time: 'Flagged 2 hours ago',
    body: "Three contingent workers are within 60 days of the 18-month policy ceiling under §4.2. They'll need recertification or off-boarding.",
    primary: { label: 'Start recertification', href: '/workers/workers', prompt: 'Show me the workers approaching the 18-month tenure limit and start recertification' },
    secondary: { label: 'Review workers', href: '/workers/workers' },
    barClass: 'bg-cyan-500',
    dotClass: 'bg-cyan-500',
    pulseClass: 'bg-cyan-400',
    chipClass: 'text-cyan-700',
    primaryBtnClass: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-[0_6px_18px_-6px_rgba(8,145,178,0.5)]',
  },
]

// ─── Rail tile variant styling ────────────────────────────────────────────────

const RAIL_VARIANTS: Record<string, { card: string; eyebrow: string; badge: string; sub: string; action: string }> = {
  best: {
    card: 'bg-cyan-50 border-cyan-400 shadow-[0_4px_16px_-8px_rgba(8,145,178,0.45)]',
    eyebrow: 'text-cyan-700',
    badge: 'text-cyan-800 bg-cyan-200/70',
    sub: 'text-cyan-800/80',
    action: 'text-cyan-700',
  },
  warn: {
    card: 'bg-white border-amber-300',
    eyebrow: 'text-cyan-700',
    badge: 'text-amber-700 bg-amber-100',
    sub: 'text-slate-500',
    action: 'text-cyan-700',
  },
  risk: {
    card: 'bg-white border-rose-300',
    eyebrow: 'text-cyan-700',
    badge: 'text-rose-700 bg-rose-100',
    sub: 'text-slate-500',
    action: 'text-cyan-700',
  },
  default: {
    card: 'bg-white border-slate-200',
    eyebrow: 'text-cyan-700',
    badge: 'text-slate-600 bg-slate-100',
    sub: 'text-slate-500',
    action: 'text-cyan-700',
  },
}

// ─── Parse Nova's tag protocols (actions + rail, any order) ──────────────────

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

    let header = ''
    let tilesRaw = body
    const headerSplit = body.split('::')
    if (headerSplit.length > 1) {
      header = headerSplit[0].trim()
      tilesRaw = headerSplit.slice(1).join('::').trim()
    }

    const tiles = tilesRaw
      .split(';')
      .map((t) => {
        const p = t.split('|').map((s) => s.trim())
        return {
          variant: (p[0] ?? 'default').toLowerCase(),
          eyebrow: p[1] ?? '',
          title: p[2] ?? '',
          subtitle: p[3] ?? '',
          action: p[4] ?? '',
          destination: p[5] ?? '',
          badge: p[6] ?? '',
        }
      })
      .filter((t) => t.title && t.action && t.destination)
      .slice(0, 3)

    if (tiles.length > 0) rail = { header: header || 'For this', tiles }
  }

  let actions: { label: string; prompt: string }[] = []
  const actionMatch = text.match(/\[NOVA_ACTIONS:\s*([^\]]+)\]/)
  if (actionMatch) {
    const actionsRaw = actionMatch[1]
    text = text.replace(actionMatch[0], '')
    actions = actionsRaw
      .split(';')
      .map((item) => {
        const parts = item.split('|').map((s) => s.trim())
        return { label: parts[0] ?? '', prompt: parts[1] ?? '' }
      })
      .filter((a) => a.label && a.prompt)
      .slice(0, 3)
  }

  return { text: text.trim(), actions, rail }
}

// ─── Inline record links ──────────────────────────────────────────────────────

const WORKER_ROUTES: Record<string, string> = {
  'Sarah Cheng': '/cw/work-orders/WO-2024-0089',
  'Marcus Holloway': '/cw/work-orders/WO-2024-0067',
  'Priya Kapoor': '/cw/work-orders/WO-2024-0078',
  'Jin Park': '/cw/work-orders/WO-2024-0079',
  'David Nakamura': '/cw/work-orders/WO-2024-0091',
}

const RECORD_RE = /(Sarah Cheng|Marcus Holloway|Priya Kapoor|Jin Park|David Nakamura|SOW-\d{4}-\d{4}|WO-\d{4}-\d{4})/g

function recordRoute(token: string): string | null {
  if (WORKER_ROUTES[token]) return WORKER_ROUTES[token]
  if (token.startsWith('SOW-')) return '/services/sow/' + token.replace('SOW-', '')
  if (token.startsWith('WO-')) return '/cw/work-orders/' + token
  return null
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
  const pendingRequestText = `pending request${pendingRequestCount === 1 ? '' : 's'}`

  const activeRailInfo = (() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].role === 'nova') {
        const rail = chatMessages[i].rail
        return rail && rail.tiles.length > 0 ? { rail, index: i } : null
      }
    }
    return null
  })()
  const hasRail = !!activeRailInfo && activeRailInfo.index !== dismissedRailIndex
  const activeRail = hasRail ? activeRailInfo!.rail : null

  const dismissRail = () => setDismissedRailIndex(activeRailInfo?.index ?? null)

  // Clock
  useEffect(() => {
    const tick = () =>
      setClockTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
    tick()
    const id = setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const loadPendingRequests = async () => {
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

        if (response.status === 400 || response.status === 403) {
          setPendingRequestCount(0)
          setPendingRequestsError(
            typeof payload.detail === 'string'
              ? payload.detail
              : 'Unable to load pending requests for this tenant.',
          )
          return
        }

        if (!response.ok) {
          setPendingRequestCount(0)
          setPendingRequestsError(
            typeof payload.detail === 'string'
              ? payload.detail
              : `Failed to load pending requests (${response.status}).`,
          )
          return
        }

        setPendingRequestCount(Array.isArray(payload.results) ? payload.results.length : 0)
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return
        setPendingRequestCount(0)
        setPendingRequestsError('Unable to load pending requests.')
      } finally {
        if (!controller.signal.aborted) {
          setLoadingPendingRequests(false)
        }
      }
    }

    void loadPendingRequests()

    return () => controller.abort()
  }, [router])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  // Auto-scroll to bottom of chat thread when new messages arrive
  useEffect(() => {
    if (hasChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages, isLoading, hasChat])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 5) return 'Working late, Faraz.'
    if (h < 12) return 'Good morning, Faraz.'
    if (h < 17) return 'Good afternoon, Faraz.'
    return 'Good evening, Faraz.'
  })()

  const sendMessage = useCallback(async (text?: string) => {
    const value = (text ?? input).trim()
    if (!value || isLoading) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

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
      const { text, actions, rail } = parseNovaResponse(raw)
      conversationRef.current = [...conversationRef.current, { role: 'assistant', content: raw }]
      setChatMessages((prev) => [...prev, { role: 'nova', content: text, actions, rail }])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'nova', content: 'Nova is temporarily unavailable. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, policyActive])

  const prefill = (text: string) => {
    setInput(text)
    textareaRef.current?.focus()
  }

  const navigateToRoute = (destination: string) => {
    if (typeof window === 'undefined') {
      router.push(destination)
      return
    }

    window.location.assign(destination)
  }

  const handleAction = (action: { label: string; prompt: string }) => {
    if (action.prompt.startsWith('/')) {
      navigateToRoute(action.prompt)
    } else {
      sendMessage(action.prompt)
    }
  }

  const linkifyRecords = (content: string) =>
    content.split(RECORD_RE).map((part, idx) => {
      const route = recordRoute(part)
      if (!route) return <span key={idx}>{part}</span>
      return (
        <button
          key={idx}
          type="button"
          onClick={() => navigateToRoute(route)}
          className="inline align-baseline font-medium text-cyan-700 underline decoration-cyan-200 underline-offset-2 hover:text-cyan-800 hover:decoration-cyan-400 transition-colors"
        >
          {part}
        </button>
      )
    })

  const endConversation = () => {
    setChatMessages([])
    conversationRef.current = []
    setInput('')
    setDismissedRailIndex(null)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  // ─── Nova input box (shared between home and chat layouts) ─────────────────
  const novaInputBox = (
    <div className="nova-input-wrap group relative w-full">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.08)] focus-within:border-slate-300 focus-within:shadow-[0_8px_24px_-8px_rgba(8,145,178,0.18)] focus-within:ring-4 focus-within:ring-cyan-50 transition-all duration-200">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
          placeholder={hasChat ? 'Ask Nova, or issue a command…' : 'Ask Nova anything about your workforce, contracts, or spend…'}
          rows={1}
          disabled={isLoading}
          className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-[15px] leading-relaxed resize-none focus:outline-none disabled:opacity-50 px-6 pt-5 pb-2"
          style={{ minHeight: '32px', maxHeight: '200px' }}
        />

        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPolicyActive((v) => !v)}
              title={policyActive ? 'A policy is loaded — Nova enforces it. Click to simulate no policy.' : 'No policy loaded — Nova advises but never blocks. Click to simulate a loaded policy.'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors ${
                policyActive
                  ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-200'
                  : 'bg-red-50 border-red-100 hover:border-red-200'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${policyActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${policyActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${policyActive ? 'text-emerald-700' : 'text-red-700'}`}>
                {policyActive ? 'Policy Active' : 'Policy Inactive'}
              </span>
            </button>

            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Attach a document"
            >
              <Paperclip className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 ${
              input.trim() && !isLoading
                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.4)] hover:scale-105'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            ) : (
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  )

  // ─── CHAT MODE — sticky header, scrolling thread, fixed input, live cockpit rail ─
  if (hasChat) {
    return (
      <div className="min-h-screen bg-slate-50 antialiased" style={{ fontFamily: '"Inter", sans-serif' }}>

        {/* Sticky top header — stays visible as the thread scrolls */}
        <header className="bg-white/95 backdrop-blur border-b border-slate-100 sticky top-0 z-30">
          <div className={`max-w-[820px] mx-auto px-8 py-5 flex items-center justify-between ${hasRail ? 'lg:mr-80' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              <span className="text-[13px] font-semibold tracking-tight text-slate-900">Nova</span>
            </div>

            <button
              type="button"
              onClick={endConversation}
              className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
            >
              End conversation
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="flex min-h-[70vh] items-stretch">
          <main className="flex-1 min-w-0">
            <div className="max-w-[820px] mx-auto px-8 py-10 pb-48 space-y-8">
            {chatMessages.map((msg, i) =>
              msg.role === 'user' ? (
                <div key={i} className="flex justify-end animate-in slide-in-from-bottom-1 fade-in duration-300">
                  <div className="max-w-[72%] bg-slate-100 text-slate-700 rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13.5px] leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="relative pl-6 max-w-[660px] animate-in slide-in-from-bottom-1 fade-in duration-300">
                  <span className="absolute left-0 top-[0.7rem] h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  <div className="text-[15.5px] text-slate-800 leading-[1.78] whitespace-pre-wrap">
                    {linkifyRecords(msg.content)}
                  </div>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-4">
                      {msg.actions.map((a) => {
                        const isRoute = a.prompt.startsWith('/')
                        return (
                          <button
                            key={a.label}
                            type="button"
                            onClick={() => handleAction(a)}
                            className={
                              isRoute
                                ? 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all hover:-translate-y-px shadow-[0_2px_8px_-2px_rgba(15,23,42,0.3)]'
                                : 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-cyan-700 border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 hover:border-cyan-300 transition-colors'
                            }
                          >
                            {a.label}
                            {isRoute && <ArrowRight className="w-3 h-3" strokeWidth={2.5} />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            )}

            {isLoading && (
              <div className="relative pl-6 animate-in fade-in duration-200">
                <span className="absolute left-0 top-[0.45rem] h-1.5 w-1.5 rounded-full bg-cyan-500" />
                <div className="inline-flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {/* Scroll target with scroll-margin so it lands above the fixed input bar */}
            <div ref={chatEndRef} style={{ scrollMarginBottom: '140px' }} />
          </div>
          </main>

          {hasRail && (
            <aside className="hidden lg:block w-80 shrink-0 bg-white border-l border-slate-200">
              <div className="px-5 py-7">
                <div className="flex items-center justify-between gap-1.5 mb-4">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles className="w-3 h-3 text-cyan-600 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">{activeRail!.header}</span>
                  </div>
                  <button
                    type="button"
                    onClick={dismissRail}
                    className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-slate-600 transition-colors"
                    title="Hide for now — Nova will bring it back when it has something useful"
                  >
                    Not now
                  </button>
                </div>
                <div className="space-y-2.5">
                  {activeRail!.tiles.map((t, i) => (
                    <RailTile key={i} t={t} onClick={() => handleAction({ label: t.action, prompt: t.destination })} />
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* Fixed bottom input — respects sidebar + rail, fades into messages above */}
        <div className={`fixed bottom-0 left-0 lg:left-64 right-0 z-30 pointer-events-none ${hasRail ? 'lg:right-80' : ''}`}>
          <div className="bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-12 pb-4 pointer-events-auto">
            {hasRail && (
              <div className="lg:hidden flex items-stretch gap-2.5 overflow-x-auto px-8 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activeRail!.tiles.map((t, i) => (
                  <div key={i} className="shrink-0 w-60">
                    <RailTile t={t} onClick={() => handleAction({ label: t.action, prompt: t.destination })} />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={dismissRail}
                  className="shrink-0 self-center px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Not now
                </button>
              </div>
            )}
            <div className="max-w-[820px] mx-auto px-8">
              {novaInputBox}
            </div>
          </div>
        </div>

      </div>
    )
  }

  // ─── HOME MODE — regular page flow ──────────────────────────────────────────
  return (
    <div className="max-w-[1100px] mx-auto px-8 py-10 antialiased" style={{ fontFamily: '"Inter", sans-serif' }}>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600">Nova Online</span>
          <span className="text-slate-200 select-none">·</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 tabular-nums">
            {clockTime || '··:··'}
          </span>
        </div>
      </div>

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-[40px] leading-[1.05] font-semibold text-slate-900 tracking-tight mb-3">
          {greeting}
        </h1>
        <p className="text-[17px] text-slate-500 font-normal animate-in fade-in duration-300">
          <span className="text-slate-700 font-medium">
            {pendingRequestLabel} {pendingRequestText}
          </span>{' '}
          need your attention today
          {' . '}
          <span className="text-rose-600 font-medium">One critical</span>,{' '}two advisories.
        </p>
        {pendingRequestsError && (
          <p className="mt-2 text-sm font-medium text-amber-700">
            {pendingRequestsError}
          </p>
        )}
      </div>

      {/* Nova input */}
      <div className="mb-4">
        {novaInputBox}
      </div>

      {/* Quick action pills */}
      <div className="flex flex-wrap gap-2 mb-12 animate-in fade-in duration-300">
        <button
          type="button"
          onClick={() => navigateToRoute('/requests/sow/create')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-[13px] font-medium transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_-4px_rgba(15,23,42,0.08)]"
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
          Create SOW
        </button>
        <button
          type="button"
          onClick={() => navigateToRoute('/requests/new/job/create/define')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-[13px] font-medium transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_-4px_rgba(15,23,42,0.08)]"
        >
          <Briefcase className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
          Create Job Posting
        </button>
      </div>

      {/* Nova's Brief */}
      <div className="animate-in fade-in duration-300">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-70" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500" />
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-600">Nova's Brief</p>
          </div>
          <span className="text-slate-200 select-none">·</span>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            3 observations · Monitoring active
          </p>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        <div className="space-y-3">
          {OBSERVATIONS.map((o) => (
            <NovaMessage
              key={o.id}
              o={o}
              onAct={navigateToRoute}
              onAskNova={(prompt) => sendMessage(prompt)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Rail tile ────────────────────────────────────────────────────────────────

function RailTile({ t, onClick }: { t: RailTileData; onClick: () => void }) {
  const v = RAIL_VARIANTS[t.variant] ?? RAIL_VARIANTS.default
  const actionLabel = t.action.replace(/[\s→·]+$/, '')

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(15,23,42,0.22)] ${v.card}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`text-[9px] font-black uppercase tracking-wider ${v.eyebrow}`}>{t.eyebrow}</span>
        {t.badge && (
          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${v.badge}`}>
            {t.badge}
          </span>
        )}
      </div>
      <div className="text-[13px] font-semibold text-slate-900 mb-1 leading-snug">{t.title}</div>
      {t.subtitle && <div className={`text-[11px] leading-snug mb-2.5 ${v.sub}`}>{t.subtitle}</div>}
      <div className={`flex items-center gap-1 text-[11px] font-bold ${v.action}`}>
        {actionLabel}
        <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
      </div>
    </button>
  )
}

// ─── NovaMessage card ─────────────────────────────────────────────────────────

function NovaMessage({
  o,
  onAct,
  onAskNova,
}: {
  o: typeof OBSERVATIONS[number]
  onAct: (href: string) => void
  onAskNova: (prompt: string) => void
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="group relative flex bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all duration-200 hover:shadow-[0_10px_30px_-12px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 overflow-hidden">
      <div className={`w-1.5 flex-shrink-0 ${o.barClass} group-hover:w-2 transition-all duration-200`} />

      <div className="flex items-start gap-5 flex-1 p-6">
        <div className="flex-shrink-0 pt-1.5">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${o.pulseClass}`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${o.dotClass} ring-4 ring-white`} />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${o.chipClass}`}>{o.tag}</span>
            <span className="text-slate-200 select-none">·</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{o.severity}</span>
            <span className="text-slate-200 select-none">·</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-300">{o.time}</span>
          </div>

          <p className="text-[15px] text-slate-700 leading-[1.65] font-normal mb-4 max-w-[720px]">{o.body}</p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onAskNova(o.primary.prompt)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all hover:translate-y-[-1px] active:scale-95 ${o.primaryBtnClass}`}
            >
              {o.primary.label}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>

            <button
              onClick={() => onAct(o.secondary.href)}
              className="px-4 py-2 rounded-full text-[12px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              {o.secondary.label}
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="flex items-center gap-1 px-3 py-2 rounded-full text-[12px] font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" strokeWidth={2.5} />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
