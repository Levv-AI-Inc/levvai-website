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
} from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'nova'
  content: string
  actions?: { label: string; prompt: string }[]
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

function parseNovaResponse(raw: string) {
  const match = raw.match(/\[NOVA_ACTIONS:\s*([^\]]+)\]\s*$/)
  if (!match) return { text: raw.trim(), actions: [] }

  const actions = match[1]
    .split(';')
    .map((item) => {
      const [label = '', prompt = ''] = item.split('|').map((s) => s.trim())
      return { label, prompt }
    })
    .filter((action) => action.label && action.prompt)
    .slice(0, 3)

  return { text: raw.replace(match[0], '').trim(), actions }
}

export default function Home() {
  const router = useRouter()
  const [clockTime, setClockTime] = useState('')
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(true)
  const [pendingRequestsError, setPendingRequestsError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const conversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  const hasChat = chatMessages.length > 0
  const pendingRequestLabel = loadingPendingRequests ? '...' : String(pendingRequestCount)

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
        body: JSON.stringify({ messages: conversationRef.current }),
      })
      const data = await res.json()
      const raw: string = data.reply ?? 'I encountered an issue. Please try again.'
      const { text: reply, actions } = parseNovaResponse(raw)
      conversationRef.current = [...conversationRef.current, { role: 'assistant', content: raw }]
      setChatMessages((prev) => [...prev, { role: 'nova', content: reply, actions }])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'nova', content: 'Nova is temporarily unavailable. Please try again.' }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading])

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
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#e8c5bf] bg-[#fff4f1] px-2.5 py-1 text-[10px] font-bold uppercase text-[#a44135]">
            <ShieldAlert className="h-3.5 w-3.5" />
            Policy inactive
          </span>
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
            <button onClick={() => setChatMessages([])} className="rounded-md px-3 py-1.5 text-xs font-semibold text-[#6b746f] hover:bg-[#fcfbf7]">
              End conversation
            </button>
          </div>

          {chatMessages.map((message, index) => (
            <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={message.role === 'user' ? 'max-w-[78%] rounded-lg bg-[#e4ddcf] px-5 py-3 text-sm text-[#1e2528]' : 'max-w-[88%] text-sm leading-7 text-[#3d4945]'}>
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && <div className="text-sm text-[#6b746f]">Nova is reviewing the record...</div>}
          <div ref={chatEndRef} />
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
