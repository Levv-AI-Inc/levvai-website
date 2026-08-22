'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Home,
  FileText,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  LogOut,
  Clock,
  AlertCircle,
  Building2,
  CheckCircle2,
  Archive,
} from 'lucide-react'
import { useWorkerClient, getMondayOfWeek } from './layout'

const STATUS_STYLES: Record<'Draft' | 'Submitted' | 'Approved', string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-amber-50 text-amber-700',
  Approved: 'bg-green-50 text-green-700',
}

const MONTH_STATS_BY_CLIENT: Record<string, { hours: number; needsAttention: number }> = {
  northbridge: { hours: 148, needsAttention: 1 },
  acme: { hours: 0, needsAttention: 0 },
}

export default function WorkerHomePage() {
  const router = useRouter()
  const { activeClient, engagementStatuses, activeClientId, workItemsByClient } = useWorkerClient()
  const status = engagementStatuses[activeClientId]
  const isActive = status?.status === 'active'
  const isExpired = status?.status === 'expired'
  const primaryAssignment = activeClient.assignments[0]

  const allItems = workItemsByClient[activeClientId] ?? []
  const archiveItems = allItems.filter((i) => i.status !== 'Draft')

  return (
    <div className="min-h-screen bg-slate-50">
      <WorkerTopNav active="Home" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, Jordan Reyes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Contingent Worker · {primaryAssignment.label} · {primaryAssignment.id} · {activeClient.name}
        </p>

        {isExpired && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-800">
              <span className="font-semibold">Engagement with {activeClient.name} has ended.</span>{' '}
              {status?.expiredReason} ({status?.expiredAt})
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            {isActive ? (
              <>
                <ShortcutCard
                  icon={Clock}
                  label="Submit This Week's Timesheet"
                  onClick={() =>
                    router.push(`/external/act-as-worker/timesheet?week=${getMondayOfWeek(0).iso}`)
                  }
                />
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-xs text-slate-500">
                No new time sheets can be created — this engagement isn't active.
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                This Month
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-slate-900">
                  {MONTH_STATS_BY_CLIENT[activeClientId]?.hours ?? 0}
                </span>
                <span className="text-xs text-slate-500">hours logged</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {MONTH_STATS_BY_CLIENT[activeClientId]?.needsAttention
                  ? `${MONTH_STATS_BY_CLIENT[activeClientId].needsAttention} sheet needs attention`
                  : 'No activity yet'}
              </div>
            </div>
          </div>

          {isActive ? (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">Work Items to Act Upon</span>
                <span className="text-xs text-slate-400 font-medium">{allItems.length} items</span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-2.5 font-medium">Information / Reason</th>
                    <th className="px-3 py-2.5 font-medium">ID</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Period</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {allItems.map((item) => {
                    const clickable = item.status === 'Draft'
                    const href = item.weekStart
                      ? `/external/act-as-worker/timesheet?week=${item.weekStart}`
                      : '/external/act-as-worker/timesheet'
                    return (
                      <tr
                        key={item.id}
                        onClick={() => clickable && router.push(href)}
                        className={`border-b border-slate-50 last:border-0 ${
                          clickable ? 'cursor-pointer hover:bg-slate-50' : ''
                        }`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {item.status === 'Draft' ? (
                              <span className="text-cyan-700 font-medium">Complete Time Sheet</span>
                            ) : (
                              <span className="text-slate-500">
                                {item.kind === 'expense' ? 'Expense Sheet' : 'Time Sheet'}
                              </span>
                            )}
                            {item.flagged && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                                <AlertCircle className="w-2.5 h-2.5" />
                                Needs reason
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-xs font-mono">{item.id}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[item.status]}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-xs">{item.period}</td>
                        <td className="px-5 py-3 text-right">
                          {clickable && <ChevronRight className="w-4 h-4 text-slate-300 inline-block" />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Archive className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-900">Time &amp; Expense Sheet Archive</span>
                <span className="text-xs text-slate-400 font-medium ml-auto">
                  {archiveItems.length} record{archiveItems.length === 1 ? '' : 's'}
                </span>
              </div>

              {archiveItems.length === 0 ? (
                <div className="px-5 py-10 text-center text-xs text-slate-400">
                  {status?.status === 'not_started'
                    ? "No records on file — this engagement hasn't started."
                    : 'No records on file for this engagement.'}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-slate-400 border-b border-slate-100">
                      <th className="px-5 py-2.5 font-medium">Record</th>
                      <th className="px-3 py-2.5 font-medium">ID</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archiveItems.map((item) => (
                      <tr key={item.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3 text-slate-400">
                          {item.kind === 'expense' ? 'Expense Sheet' : 'Time Sheet'}
                        </td>
                        <td className="px-3 py-3 text-slate-400 text-xs font-mono">{item.id}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[item.status]} opacity-70`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-400 text-xs">{item.period}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* =========================
   Shared worker-tenant top nav with client switcher
========================= */

export function WorkerTopNav({ active }: { active: 'Home' | 'Time Sheets' | 'Expenses' | 'Documents' }) {
  const router = useRouter()
  const { clients, activeClientId, activeClient, engagementStatuses, switchClient } = useWorkerClient()
  const [clientMenuOpen, setClientMenuOpen] = useState(false)

  const tabs = [
    { label: 'Home', icon: Home, href: '/external/act-as-worker' },
    { label: 'Time Sheets', icon: FileText, href: '/external/act-as-worker/timesheet' },
    { label: 'Documents', icon: FolderOpen, href: '#' },
  ] as const

  return (
    <div className="bg-[#0f172a] border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-cyan-500 rounded flex items-center justify-center font-bold text-white text-[10px]">
              L
            </div>
            <span className="text-sm font-bold tracking-[0.2em] text-white">LEVV</span>
            <span className="text-[10px] font-medium text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 ml-1">
              Worker Portal
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setClientMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 border border-slate-700"
            >
              <Building2 className="w-3.5 h-3.5" />
              {activeClient.name}
              <ChevronDown className={`w-3 h-3 transition-transform ${clientMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {clientMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setClientMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 w-64 rounded-lg border border-slate-700 bg-[#0f172a] shadow-xl z-50 overflow-hidden">
                  {clients.map((c) => {
                    const s = engagementStatuses[c.id]
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          switchClient(c.id)
                          setClientMenuOpen(false)
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5 ${
                          c.id === activeClientId ? 'bg-white/5' : ''
                        }`}
                      >
                        <span className="text-slate-200 font-medium">{c.name}</span>
                        {s?.status === 'active' && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                        {s?.status === 'expired' && (
                          <span className="text-[10px] font-semibold text-red-400">Ended</span>
                        )}
                        {s?.status === 'not_started' && (
                          <span className="text-[10px] font-medium text-slate-500">Not started</span>
                        )}
                      </button>
                    )
                  })}
                  <div className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-800">
                    Only one engagement can be active at a time.
                  </div>
                </div>
              </>
            )}
          </div>

          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = tab.label === active
              const Icon = tab.icon
              return (
                <button
                  key={tab.label}
                  onClick={() => tab.href !== '#' && router.push(tab.href)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Exit to Buyer View
          </button>
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
            JR
          </div>
        </div>
      </div>
    </div>
  )
}

function ShortcutCard({
  icon: Icon,
  label,
  onClick,
}: {
  icon: any
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left hover:border-cyan-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-cyan-700" />
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </button>
  )
}