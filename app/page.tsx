'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, ArrowRight, X, Paperclip, ArrowUp, FileText, Briefcase } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ChatMessage {
  role: 'user' | 'nova'
  content: string
  actions?: { label: string; prompt: string }[]
  rail?: RailData | null
}

// ─── Portfolio stats ──────────────────────────────────────────────────────────
// The denominator Nova's brief is derived from. Wire these to real counts.

const STATS = [
  { value: '247', label: 'External workers', sub: 'Active today', href: '/workers', tone: 'neutral' as const },
  { value: '18', label: 'In onboarding', sub: '4 blocked on requirements', href: '/onboarding', tone: 'warn' as const },
  { value: '$2.4M', label: 'Contract value', sub: '38 open SOWs', href: '/sow', tone: 'neutral' as const },
  { value: '94%', label: 'Of approved cap', sub: 'Q3 spend to date', href: '/spend', tone: 'warn' as const },
]

// ─── Nova's observations ──────────────────────────────────────────────────────
// Operational voice: entity, fact, consequence, deadline. The recommendation is
// the last clause, never the frame.

const OBSERVATIONS = [
  {
    id: 1,
    severity: 'Critical',
    metric: '14d',
    metricLabel: 'To expiry',
    entity: 'Accenture',
    record: 'SOW-2024-0041',
    body: 'Expires Sep 2 with no renewal in flight. $840k of scope remains open and procurement lead time runs 21 days — a gap is already unavoidable unless drafting starts this week.',
    primary: { label: 'Draft renewal', prompt: 'Draft a renewal for Accenture SOW-2024-0041 expiring in 14 days' },
    secondary: { label: 'Open SOW', href: '/sow/2024-0041' },
    ruleClass: 'bg-rose-500',
    metricClass: 'text-rose-600',
    chipClass: 'text-rose-700 bg-rose-50 border-rose-200',
  },
  {
    id: 2,
    severity: 'Elevated',
    metric: '$182k',
    metricLabel: 'Projected over',
    entity: 'Deloitte',
    record: 'SOW-2024-0088',
    body: 'Burn is running 12% above the approved cap. At current velocity the engagement breaches in six weeks, before quarter-end reporting closes.',
    primary: { label: 'Adjust budget', prompt: 'Review the Deloitte budget overrun and suggest remediation options' },
    secondary: { label: 'View spend', href: '/spend' },
    ruleClass: 'bg-amber-500',
    metricClass: 'text-amber-600',
    chipClass: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  {
    id: 3,
    severity: 'Advisory',
    metric: '3',
    metricLabel: 'Workers',
    entity: 'Tenure policy',
    record: '§4.2',
    body: 'Sarah Cheng, Marcus Holloway and Priya Kapoor reach the 18-month ceiling within 60 days. Each needs recertification or an off-boarding date on file before the limit lands.',
    primary: { label: 'Start recertification', prompt: 'Show me the workers approaching the 18-month tenure limit and start recertification' },
    secondary: { label: 'Review workers', href: '/workers?filter=tenure-risk' },
    ruleClass: 'bg-slate-300',
    metricClass: 'text-slate-900',
    chipClass: 'text-slate-600 bg-slate-50 border-slate-200',
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

// ─── Parse Nova's tag protocols (actions + rail, any order) ────────────────────

function parseNovaResponse(raw: string): {
  text: string
  actions: { label: string; prompt: string }[]
  rail: RailData | null
} {
  let text = raw

  // ── Rail tag ──
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

  // ── Actions tag ──
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
// Records Nova mentions (worker names, SOW / WO numbers) render as links into the
// actual record. Plain values (rates, counts, dates) stay as prose.

const WORKER_ROUTES: Record<string, string> = {
  'Sarah Cheng': '/workers/WO-2024-0089',
  'Marcus Holloway': '/workers/WO-2024-0067',
  'Priya Kapoor': '/workers/WO-2024-0078',
  'Jin Park': '/workers/WO-2024-0079',
  'David Nakamura': '/workers/WO-2024-0091',
}

// Capturing group so String.split keeps the matched records in the result array.
const RECORD_RE = /(Sarah Cheng|Marcus Holloway|Priya Kapoor|Jin Park|David Nakamura|SOW-\d{4}-\d{4}|WO-\d{4}-\d{4})/g

function recordRoute(token: string): string | null {
  if (WORKER_ROUTES[token]) return WORKER_ROUTES[token]
  if (token.startsWith('SOW-')) return '/sow/' + token.replace('SOW-', '')
  if (token.startsWith('WO-')) return '/workers/' + token
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
  const [dismissedIds, setDismissedIds] = useState<number[]>([])
  // Whether a policy is loaded/enforcing. When false, Nova advises rather than blocks.
  // Wire this to your real "policy uploaded" signal; the pill below also toggles it.
  const [policyActive, setPolicyActive] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const conversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  const hasChat = chatMessages.length > 0
  const openObservations = OBSERVATIONS.filter((o) => !dismissedIds.includes(o.id))

  // The active rail = the most recent Nova turn's rail. No rail on that turn → panel disappears.
  // We also track which message it came from so the user can dismiss this one specifically;
  // the next Nova turn that carries a rail has a new index, so it reappears on its own.
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

  // Render Nova's prose with record mentions turned into links into the record.
  const linkifyRecords = (content: string) =>
    content.split(RECORD_RE).map((part, idx) => {
      const route = recordRoute(part)
      if (!route) return <span key={idx}>{part}</span>
      return (
        <button
          key={idx}
          onClick={() => router.push(route)}
          className="inline align-baseline font-medium text-cyan-700 underline decoration-cyan-200 underline-offset-2 hover:text-cyan-800 hover:decoration-cyan-400 transition-colors"
        >
          {part}
        </button>
      )
    })

  const handleAction = (action: { label: string; prompt: string }) => {
    if (action.prompt.startsWith('/')) {
      router.push(action.prompt)
    } else {
      sendMessage(action.prompt)
    }
  }

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
              onClick={() => setPolicyActive((v) => !v)}
              title={policyActive ? 'A policy is loaded — Nova enforces it. Click to simulate no policy.' : 'No policy loaded — Nova advises but never blocks. Click to simulate a loaded policy.'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors ${
                policyActive
                  ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-200'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`inline-flex rounded-full h-1.5 w-1.5 ${policyActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${policyActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                {policyActive ? 'Policy enforcing' : 'No policy loaded'}
              </span>
            </button>

            <button
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Attach a document"
            >
              <Paperclip className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <button
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
              onClick={endConversation}
              className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
            >
              End conversation
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </header>

        {/* Body — conversation and the cockpit rail are real flex columns inside the
            content area, so the rail can never overlap the header and the conversation
            width stays stable whether or not a rail is showing. */}
        <div className="flex min-h-[70vh] items-stretch">

          {/* Conversation column — stable width, never reflows when the rail toggles */}
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

          {/* Cockpit rail — an in-flow column (desktop) beside the conversation and
              below the header: no viewport offsets, so it can't overlap or clip. */}
          {hasRail && (
            <aside className="hidden lg:block w-80 shrink-0 bg-white border-l border-slate-200">
              <div className="px-5 py-7">
                <div className="flex items-center justify-between gap-1.5 mb-4">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles className="w-3 h-3 text-cyan-600 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">{activeRail!.header}</span>
                  </div>
                  <button
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
            {/* Mobile rail strip — horizontal scroll above the input on small screens */}
            {hasRail && (
              <div className="lg:hidden flex items-stretch gap-2.5 overflow-x-auto px-8 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activeRail!.tiles.map((t, i) => (
                  <div key={i} className="shrink-0 w-60">
                    <RailTile t={t} onClick={() => handleAction({ label: t.action, prompt: t.destination })} />
                  </div>
                ))}
                <button
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

  // ─── HOME MODE — one console: portfolio band above, decision queue below ────
  return (
    <div className="max-w-[1100px] mx-auto px-8 py-10 antialiased" style={{ fontFamily: '"Inter", sans-serif' }}>

      {/* Greeting + quiet system state */}
      <div className="flex items-start justify-between gap-6 mb-7">
        <div>
          <h1 className="text-[34px] leading-[1.1] font-semibold text-slate-900 tracking-tight mb-2">
            {greeting}
          </h1>
          <p className="text-[15px] text-slate-500">
            {openObservations.length > 0 ? (
              <>
                <span className="text-slate-800 font-medium">
                  {openObservations.length} {openObservations.length === 1 ? 'item needs' : 'items need'} a decision today.
                </span>{' '}
                Nova is watching 247 workers and 38 open contracts.
              </>
            ) : (
              <>Nothing needs a decision. Nova is watching 247 workers and 38 open contracts.</>
            )}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0 pt-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium text-slate-400 tabular-nums">
            Synced {clockTime || '··:··'}
          </span>
        </div>
      </div>

      {/* Nova input */}
      <div className="mb-3">
        {novaInputBox}
      </div>

      {/* Quick actions — quiet text buttons, not competing with the console below */}
      <div className="flex flex-wrap items-center gap-1 mb-8">
        <button
          onClick={() => router.push('/requests/new/sow')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[13px] font-medium transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
          Create SOW
        </button>
        <button
          onClick={() => router.push('/requests/new/job_posting')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[13px] font-medium transition-colors"
        >
          <Briefcase className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
          Create job posting
        </button>
      </div>

      {/* ── The console: portfolio band + decision queue in one object ────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">

        {/* Portfolio band — the denominator the brief is derived from */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100 border-b border-slate-100">
          {STATS.map((s) => (
            <button
              key={s.label}
              onClick={() => router.push(s.href)}
              className="group text-left px-5 py-4 hover:bg-slate-50 transition-colors first:border-l-0"
            >
              <div className="text-[24px] font-semibold tracking-tight text-slate-900 tabular-nums leading-none mb-1.5">
                {s.value}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                {s.label}
              </div>
              <div className={`text-[11px] ${s.tone === 'warn' ? 'text-amber-600' : 'text-slate-400'}`}>
                {s.sub}
              </div>
            </button>
          ))}
        </div>

        {/* Queue header */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50/60 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-cyan-600" strokeWidth={2.5} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Nova's brief</span>
            <span className="text-slate-300 select-none">·</span>
            <span className="text-[11px] font-medium text-slate-400 tabular-nums">
              {openObservations.length} open
            </span>
          </div>
          <button
            onClick={() => router.push('/worklist')}
            className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 transition-colors"
          >
            Open worklist
          </button>
        </div>

        {/* Decision rows */}
        {openObservations.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {openObservations.map((o) => (
              <ObservationRow
                key={o.id}
                o={o}
                onAskNova={(prompt) => sendMessage(prompt)}
                onNavigate={(href) => router.push(href)}
                onDismiss={() => setDismissedIds((prev) => [...prev, o.id])}
              />
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] text-slate-600 font-medium mb-1">Queue is clear.</p>
            <p className="text-[13px] text-slate-400 mb-5">
              Nova will surface the next item as soon as something crosses a threshold.
            </p>
            <button
              onClick={() => setDismissedIds([])}
              className="text-[12px] font-semibold text-cyan-700 hover:text-cyan-800 transition-colors"
            >
              Restore dismissed items
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Observation row ──────────────────────────────────────────────────────────
// Left column carries the quantified stake in tabular numerals so the queue reads
// in one vertical pass. Severity lives in the rule + chip only; every primary
// action is the same slate-900 so colour means severity, not importance.

function ObservationRow({
  o,
  onAskNova,
  onNavigate,
  onDismiss,
}: {
  o: typeof OBSERVATIONS[number]
  onAskNova: (prompt: string) => void
  onNavigate: (href: string) => void
  onDismiss: () => void
}) {
  return (
    <div className="group relative flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5 px-5 py-4 pl-6 hover:bg-slate-50/70 transition-colors">
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${o.ruleClass}`} aria-hidden="true" />

      {/* Stake */}
      <div className="sm:w-[104px] shrink-0">
        <div className={`text-[21px] font-semibold tracking-tight tabular-nums leading-none ${o.metricClass}`}>
          {o.metric}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
          {o.metricLabel}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
          <span className="text-[13.5px] font-semibold text-slate-900">{o.entity}</span>
          <button
            onClick={() => onNavigate(o.secondary.href)}
            className="text-[12.5px] font-medium text-cyan-700 hover:text-cyan-800 underline decoration-cyan-200 hover:decoration-cyan-400 underline-offset-2 transition-colors tabular-nums"
          >
            {o.record}
          </button>
          <span className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${o.chipClass}`}>
            {o.severity}
          </span>
        </div>
        <p className="text-[13.5px] text-slate-600 leading-[1.6] max-w-[600px]">{o.body}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 sm:pt-0.5">
        <button
          onClick={() => onAskNova(o.primary.prompt)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors active:scale-[0.98]"
        >
          {o.primary.label}
          <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
        </button>
        <button
          onClick={() => onNavigate(o.secondary.href)}
          className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          {o.secondary.label}
        </button>
        <button
          onClick={onDismiss}
          aria-label={`Dismiss ${o.entity} item`}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

// ─── Rail tile ────────────────────────────────────────────────────────────────

function RailTile({ t, onClick }: { t: RailTileData; onClick: () => void }) {
  const v = RAIL_VARIANTS[t.variant] ?? RAIL_VARIANTS.default
  const isRoute = t.destination.startsWith('/')
  const actionLabel = t.action.replace(/[\s→·]+$/, '') // strip any trailing arrow Nova added

  return (
    <button
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
      {!isRoute && <span className="sr-only">Ask Nova</span>}
    </button>
  )
}