'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  Link2,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react'

import {
  getWorkerLifecycle,
  getWorkerLifecycles,
  type LifecycleDetail,
  type LifecycleSummary,
} from '@/lib/api/workerLifecycle'

const STATUSES = ['All', 'Ready', 'In Progress', 'Blocked', 'Pending']

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function WorkerLifecyclePage() {
  const router = useRouter()
  const [rows, setRows] = useState<LifecycleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [selectedRecord, setSelectedRecord] =
    useState<LifecycleSummary | null>(null)
  const [selectedDetail, setSelectedDetail] =
    useState<LifecycleDetail | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadRows() {
      setLoading(true)
      setError('')
      try {
        const response = await getWorkerLifecycles({
          lifecycle_type: 'onboarding',
          page_size: 200,
        })
        if (!cancelled) setRows(response.results)
      } catch (loadError) {
        if (!cancelled) {
          setRows([])
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load worker lifecycles.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadRows()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    if (!selectedRecord) {
      setSelectedDetail(null)
      setDrawerError('')
      return
    }

    let cancelled = false
    async function loadDetail() {
      setDrawerLoading(true)
      setDrawerError('')
      try {
        const detail = await getWorkerLifecycle(
          selectedRecord!.workerId,
          'onboarding',
          {
            workOrderId: selectedRecord!.workOrderId,
            engagementId: selectedRecord!.engagementId,
          },
        )
        if (!cancelled) setSelectedDetail(detail)
      } catch (loadError) {
        if (!cancelled) {
          setSelectedDetail(null)
          setDrawerError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load onboarding details.',
          )
        }
      } finally {
        if (!cancelled) setDrawerLoading(false)
      }
    }

    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [selectedRecord])

  const filteredLifecycles = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        row.name.toLowerCase().includes(search) ||
        String(row.workerId).includes(search) ||
        row.email.toLowerCase().includes(search) ||
        row.workOrderNumber.toLowerCase().includes(search)
      const matchesStatus =
        selectedStatus === 'All' || row.status === selectedStatus
      return matchesSearch && matchesStatus
    })
  }, [rows, searchTerm, selectedStatus])

  const blockedCount = rows.filter((row) => row.activeGateBlocker).length

  function closeDrawer() {
    setSelectedRecord(null)
    setSelectedDetail(null)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 p-4 font-sans text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Workers Lifecycle
            </h1>
            <p className="font-medium text-slate-500">
              Monitoring requirement blocks and departmental bottlenecks.
            </p>
          </div>

          <div className="group relative w-full md:w-96">
            <div className="absolute inset-0 rounded-3xl bg-cyan-400/10 blur-xl transition-all group-hover:bg-cyan-400/20" />
            <div className="relative flex items-center overflow-hidden rounded-2xl border border-cyan-100 bg-white p-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-cyan-400/30">
              <div className="ml-1 rounded-xl bg-slate-950 p-2 text-cyan-400">
                <Sparkles size={18} />
              </div>
              <input
                type="text"
                value={aiInput}
                onChange={(event) => setAiInput(event.target.value)}
                placeholder="Ask Nova: 'Who is blocking John?'"
                className="flex-1 border-none bg-transparent px-3 py-2 text-sm font-semibold placeholder:text-slate-400 focus:ring-0"
              />
              <button
                type="button"
                className="pr-3 text-xs font-bold uppercase text-cyan-500 transition-colors hover:text-cyan-700"
              >
                Ask
              </button>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="flex flex-col justify-center rounded-3xl border border-l-4 border-slate-200 border-l-rose-500 bg-white p-6 shadow-sm">
            <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Active Gate Blockers
            </span>
            <div className="flex items-center gap-2 text-3xl font-black text-slate-900">
              <ShieldAlert
                size={24}
                className={blockedCount > 0 ? 'text-rose-500' : 'text-emerald-500'}
              />
              {blockedCount}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm lg:col-span-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Lifecycle Status
              </label>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-4 pr-10 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-cyan-400"
                >
                  {STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>

            <div className="min-w-[280px] flex-1">
              <label className="mb-2 block px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Search Records
              </label>
              <div className="group relative">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-500"
                />
                <input
                  className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Worker name or ID..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setSelectedStatus('All')
              }}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 transition-colors hover:text-rose-500"
            >
              <X size={14} /> Reset
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-medium text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading worker lifecycles
            </div>
          ) : error ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center">
              <ShieldAlert className="h-7 w-7 text-rose-500" />
              <p className="max-w-lg text-sm font-medium text-rose-700">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Worker
                    </th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Block Readiness
                    </th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Departmental Gate
                    </th>
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Day 1 Target
                    </th>
                    <th className="px-8 py-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLifecycles.map((row) => (
                    <tr
                      key={row.runId}
                      className="group cursor-pointer transition-all hover:bg-cyan-50/40"
                      onClick={() => setSelectedRecord(row)}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-bold text-cyan-400 shadow-lg shadow-cyan-900/10">
                            {initials(row.name)}
                          </div>
                          <div>
                            <div className="mb-0.5 font-bold leading-tight text-slate-900">
                              {row.name}
                            </div>
                            <div className="text-[10px] font-bold uppercase leading-none tracking-tight text-slate-400">
                              {row.role || 'Role not assigned'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-12 w-12 items-center justify-center">
                            <svg className="h-full w-full -rotate-90">
                              <circle
                                cx="24"
                                cy="24"
                                r="20"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="transparent"
                                className="text-slate-100"
                              />
                              <circle
                                cx="24"
                                cy="24"
                                r="20"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="transparent"
                                strokeDasharray={125.6}
                                strokeDashoffset={
                                  125.6 - (125.6 * row.readiness) / 100
                                }
                                className={
                                  row.readiness === 100
                                    ? 'text-emerald-500'
                                    : 'text-cyan-500'
                                }
                              />
                            </svg>
                            <span className="absolute text-[10px] font-black">
                              {row.readiness}%
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase leading-none text-slate-700">
                              Complete
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                              Requirements
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {row.status === 'Ready' ? (
                          <div className="flex w-fit items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700">
                            <CheckCircle2 size={12} /> Certified Ready
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <div
                              className={`inline-flex w-fit items-center gap-2 rounded-xl border bg-white px-3 py-1.5 text-[10px] font-black uppercase shadow-sm ${
                                row.status === 'Blocked'
                                  ? 'border-rose-100 text-rose-700'
                                  : 'border-amber-100 text-amber-700'
                              }`}
                            >
                              <div
                                className={`h-1.5 w-1.5 rounded-full ${
                                  row.status === 'Blocked'
                                    ? 'animate-pulse bg-rose-500'
                                    : 'bg-amber-500'
                                }`}
                              />
                              Pending {row.pendingWith || 'Team'}
                            </div>
                            <div className="max-w-[180px] truncate px-1 text-[10px] font-bold text-slate-400">
                              {row.currentBlockerTask || 'Waiting to start'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black tracking-tight text-slate-800">
                          {formatDate(row.startDate)}
                        </div>
                        <div
                          className={`mt-1 text-[10px] font-bold uppercase tracking-tight ${
                            row.status === 'Blocked'
                              ? 'text-rose-500'
                              : 'text-emerald-600'
                          }`}
                        >
                          {row.status === 'Blocked' ? 'Risks Delay' : 'On Track'}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <ChevronRight
                          size={20}
                          className="inline text-slate-300 transition-colors group-hover:text-cyan-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredLifecycles.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center px-6 text-sm font-medium text-slate-500">
                  No worker lifecycles match the current filters.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {selectedRecord ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-md"
            onClick={closeDrawer}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/50 p-5 sm:p-8">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-2xl font-black text-cyan-400 shadow-xl shadow-cyan-900/20">
                  {initials(selectedRecord.name)}
                </div>
                <div>
                  <h2 className="text-2xl font-black leading-tight tracking-tight">
                    {selectedRecord.name}
                  </h2>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-600">
                      {selectedRecord.role || 'Role not assigned'}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {selectedRecord.workerId}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close worker preview"
                onClick={closeDrawer}
                className="rounded-xl border border-transparent p-2 text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto p-5 sm:p-8">
              {selectedRecord.status !== 'Ready' ? (
                <div
                  className={`flex gap-4 rounded-2xl border-l-4 p-4 ${
                    selectedRecord.status === 'Blocked'
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-amber-500 bg-amber-50'
                  }`}
                >
                  <ShieldAlert
                    size={24}
                    className={
                      selectedRecord.status === 'Blocked'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    }
                  />
                  <div>
                    <p
                      className={`text-sm font-black uppercase tracking-tight ${
                        selectedRecord.status === 'Blocked'
                          ? 'text-rose-900'
                          : 'text-amber-900'
                      }`}
                    >
                      {selectedRecord.status === 'Blocked' ? 'Halt' : 'Pending'}:{' '}
                      {selectedRecord.pendingWith || 'Team'} activity
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {selectedRecord.currentBlockerTask || 'Waiting to start'} is
                      the current requirement in this workflow.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Layers size={12} /> Readiness
                  </p>
                  <p className="text-4xl font-black text-cyan-600">
                    {selectedRecord.readiness}
                    <span className="text-lg text-slate-400">%</span>
                  </p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-cyan-500"
                      style={{ width: `${selectedRecord.readiness}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Calendar size={12} /> Launch
                  </p>
                  <p className="text-xl font-black text-slate-900">
                    {formatDate(selectedRecord.startDate)}
                  </p>
                  <p className="mt-2 text-[10px] font-bold uppercase text-rose-500">
                    {selectedRecord.businessDaysUntilStart === null
                      ? 'Target date pending'
                      : selectedRecord.businessDaysUntilStart === 0
                        ? 'Due now'
                        : `In ${selectedRecord.businessDaysUntilStart} business days`}
                  </p>
                </div>
              </div>

              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Governance Log
                </h3>
                {drawerLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading governance history
                  </div>
                ) : drawerError ? (
                  <p className="text-sm font-medium text-rose-600">{drawerError}</p>
                ) : selectedDetail?.governanceLog.length ? (
                  <div className="space-y-3">
                    {selectedDetail.governanceLog.slice(0, 5).map((event) => (
                      <div
                        key={event.activityId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {event.owner === 'system' ? (
                            <Zap size={14} className="shrink-0 text-indigo-500" />
                          ) : (
                            <Link2 size={14} className="shrink-0 text-blue-500" />
                          )}
                          <span className="truncate text-sm font-bold text-slate-700">
                            {event.name}
                          </span>
                        </div>
                        <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">
                          {event.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No completed governance activities yet.
                  </p>
                )}
              </section>

              <section className="grid grid-cols-2 gap-8 border-t border-slate-100 pt-6">
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <User size={14} /> Stakeholders
                  </h3>
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase text-slate-400">
                      Hiring Manager
                    </p>
                    <p className="text-sm font-black leading-none text-slate-900">
                      {selectedRecord.manager || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase text-slate-400">
                      Supplier
                    </p>
                    <p className="text-sm font-bold leading-none text-slate-700">
                      {selectedRecord.supplier || '-'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <ShieldCheck size={14} /> Compliance
                  </h3>
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase text-slate-400">
                      Cost Center
                    </p>
                    <p className="text-sm font-black leading-none text-slate-900">
                      {selectedRecord.costCenter || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-black uppercase text-slate-400">
                      Registration
                    </p>
                    <p className="truncate text-sm font-bold capitalize leading-none text-slate-700">
                      {selectedRecord.registrationStatus.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
              </section>

              <div className="pt-8">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/workers/${selectedRecord.workerId}/engagements/onboarding/workspace?work_order=${selectedRecord.workOrderId}`,
                    )
                  }
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 py-4 font-black text-white shadow-2xl shadow-cyan-900/20 transition-all hover:bg-black active:scale-[0.98]"
                >
                  Review Onboarding Block
                  <Zap
                    size={18}
                    className="fill-amber-400 text-amber-400 transition-transform group-hover:rotate-12"
                  />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
