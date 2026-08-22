'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Calendar,
  MessageSquare,
  X,
  Receipt,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Loader2,
  Scale,
  Ban,
  Paperclip,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { WorkerTopNav } from '../page'
import { useWorkerClient, Assignment, getMondayOfWeek } from '../layout'

const WORKER_NAME = 'Jordan Reyes'
const MOCK_HISTORY_HOURS = [39, 41, 38, 43]

type Task = { id: string; name: string }
type TaskAllocation = {
  costCenter: string
  taskCode: string
  rationale: string
  assignedForName: string
}

// Mirrors FG's Expense Code + Expense Type model, but pre-configured instead
// of requiring an admin to create each one via a support ticket. Unit-based
// codes (mileage, per diem) auto-calculate the amount from a rate, exactly
// like FG's Table 7.1 examples — just without the setup step.
type ExpenseCode = {
  code: string
  name: string
  glAccount: string
  requiresReceipt: boolean
  unit?: { label: string; rate: number }
}

const EXPENSE_CODES: ExpenseCode[] = [
  { code: 'E001', name: 'Flights', glAccount: '6210-Travel', requiresReceipt: true },
  { code: 'E002', name: 'Lodging', glAccount: '6210-Travel', requiresReceipt: true },
  { code: 'E003', name: 'Meals (Per Diem)', glAccount: '6230-Meals', requiresReceipt: false, unit: { label: 'day', rate: 30 } },
  { code: 'E004', name: 'Mileage', glAccount: '6240-Transport', requiresReceipt: false, unit: { label: 'mile', rate: 0.3 } },
  { code: 'E005', name: 'Other', glAccount: '6290-Misc', requiresReceipt: false },
]

type Expense = {
  id: string
  date: string
  expenseCode: string // ExpenseCode.code
  merchant: string
  description: string
  amount: string // used directly for variable-amount codes
  units: string // used for unit-based codes; amount is derived from this
  hasReceipt: boolean
  fileName?: string
}
type JurisdictionFlag = { text: string; severity: 'high' | 'info' }

function expenseCodeFor(code: string) {
  return EXPENSE_CODES.find((c) => c.code === code) ?? EXPENSE_CODES[0]
}

function lineAmount(exp: Expense): number {
  const code = expenseCodeFor(exp.expenseCode)
  if (code.unit) return (parseFloat(exp.units) || 0) * code.unit.rate
  return parseFloat(exp.amount) || 0
}

let idCounter = 0
function makeId(prefix: string) {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

const ANOMALY_THRESHOLD_PCT = 15
const MAX_REASONABLE_DAY_HOURS = 16
const GERMANY_DAILY_CAP = 10

function getSelectableWeeks(count = 8) {
  const weeks: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const { iso, label } = getMondayOfWeek(i)
    weeks.push({ value: iso, label: i === 0 ? `Current week · ${label}` : label })
  }
  return weeks
}

// Fonts scoped to this page only — doesn't touch the shared root layout, so
// nothing else in the app is affected. Worth moving to next/font at the
// layout level later if this treatment gets rolled out further.
function PageFonts() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
      .font-data { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
    `}</style>
  )
}

export default function WorkerTimesheetPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const openExpensesOnLoad = searchParams.get('tab') === 'expenses'
  const requestedWeek = searchParams.get('week')
  const { activeClient, activeClientId, engagementStatuses, submitCurrentWeek, submitExpenseSheet } =
    useWorkerClient()
  const status = engagementStatuses[activeClientId]
  const isExpired = status?.status === 'expired'
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (weekStart: string) => {
    submitCurrentWeek(weekStart)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F4F6F9] to-[#EEF1F6]">
      <PageFonts />
      <WorkerTopNav active="Time Sheets" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <button
          onClick={() => router.push('/external/act-as-worker')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </button>

        {isExpired ? (
          <ExpiredEngagementNotice clientName={activeClient.name} status={status} />
        ) : submitted ? (
          <SubmittedNotice
            clientName={activeClient.name}
            onBackToHome={() => router.push('/external/act-as-worker')}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)]">
            <TimesheetPanel
              key={activeClientId}
              assignments={activeClient.assignments}
              onSubmit={handleSubmit}
              autoOpenExpenses={openExpensesOnLoad}
              onExpenseSubmit={submitExpenseSheet}
              initialWeek={requestedWeek}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SubmittedNotice({ clientName, onBackToHome }: { clientName: string; onBackToHome: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white shadow-[0_12px_32px_-16px_rgba(5,150,105,0.25)] p-10 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-5">
        <CheckCircle2 className="w-7 h-7 text-emerald-600" />
      </div>
      <h2 className="font-display text-xl font-semibold text-[#0B1220]">Timesheet submitted</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
        Your time sheet has been sent to {clientName} for approval. You'll see it marked{' '}
        <span className="font-data text-emerald-700 text-[13px]">Submitted</span> on your Home page.
      </p>
      <button
        onClick={onBackToHome}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 shadow-[0_8px_20px_-6px_rgba(5,150,105,0.5)]"
      >
        Back to Home
      </button>
    </div>
  )
}

function ExpiredEngagementNotice({
  clientName,
  status,
}: {
  clientName: string
  status: { expiredAt?: string; expiredReason?: string } | undefined
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-white shadow-[0_12px_32px_-16px_rgba(220,38,38,0.2)] p-10 text-center animate-in fade-in duration-300">
      <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
        <Ban className="w-7 h-7 text-red-600" />
      </div>
      <h2 className="font-display text-xl font-semibold text-[#0B1220]">This engagement has ended</h2>
      <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
        Your engagement with {clientName} ended on{' '}
        <span className="font-data text-slate-700">{status?.expiredAt}</span>. {status?.expiredReason}
      </p>
      <p className="text-xs text-slate-400 mt-4">
        Time sheets can't be submitted for an inactive engagement. Contact {clientName}'s administrator
        if this was unexpected.
      </p>
    </div>
  )
}

/* =========================
   TIMESHEET PANEL
========================= */

function TimesheetPanel({
  assignments,
  onSubmit,
  autoOpenExpenses,
  onExpenseSubmit,
  initialWeek,
}: {
  assignments: Assignment[]
  onSubmit: (weekStart: string) => void
  autoOpenExpenses?: boolean
  onExpenseSubmit: (period: string) => void
  initialWeek?: string | null
}) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const selectableWeeks = useMemo(() => getSelectableWeeks(8), [])

  const [assignment, setAssignment] = useState<Assignment>(assignments[0])
  const [weekStart, setWeekStart] = useState(() =>
    initialWeek && selectableWeeks.some((w) => w.value === initialWeek) ? initialWeek : selectableWeeks[0].value
  )
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState('')
  const [showExpenses, setShowExpenses] = useState(false)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expenseSheetSubmitted, setExpenseSheetSubmitted] = useState(false)
  const [showExpenseBlockedNotice, setShowExpenseBlockedNotice] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([
    { id: 'seed-1', name: 'Client workshops' },
    { id: 'seed-2', name: 'Design & documentation' },
  ])
  const [hours, setHours] = useState<Record<string, number[]>>({
    'seed-1': [8, 6, 6, 4, 0],
    'seed-2': [0, 2, 2, 4, 6],
  })
  const [anomalyReason, setAnomalyReason] = useState('')
  const [showSubmitBlockedNotice, setShowSubmitBlockedNotice] = useState(false)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [taskAllocations, setTaskAllocations] = useState<Record<string, TaskAllocation>>({})
  const [allocating, setAllocating] = useState(false)
  const [allocationError, setAllocationError] = useState<string | null>(null)

  useEffect(() => {
    setAssignment(assignments[0])
    setTaskAllocations({})
  }, [assignments])

  useEffect(() => {
    if (autoOpenExpenses) setShowExpenses(true)
  }, [autoOpenExpenses])

  const addTask = () => {
    const id = makeId('task')
    setTasks((prev) => [...prev, { id, name: 'New task' }])
    setHours((prev) => ({ ...prev, [id]: [0, 0, 0, 0, 0] }))
  }
  const updateTaskName = (id: string, newName: string) => {
    if (!newName.trim()) return
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, name: newName } : t)))
  }
  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setHours((prev) => {
      const { [id]: _, ...rest } = prev
      return rest
    })
    setTaskAllocations((prev) => {
      const { [id]: _, ...rest } = prev
      return rest
    })
  }
  const updateHour = (id: string, dayIndex: number, value: number) => {
    setHours((prev) => {
      const updated = [...(prev[id] ?? [0, 0, 0, 0, 0])]
      updated[dayIndex] = value
      return { ...prev, [id]: updated }
    })
  }
  const rowTotal = (id: string) => (hours[id] ?? []).reduce((a, b) => a + b, 0)
  const dayTotal = (dayIndex: number) => tasks.reduce((sum, t) => sum + (hours[t.id]?.[dayIndex] ?? 0), 0)
  const weekTotal = tasks.reduce((sum, t) => sum + rowTotal(t.id), 0)
  const overtime = weekTotal > 40

  const daysCovered = useMemo(() => {
    let covered = 0
    for (let i = 0; i < 5; i++) if (dayTotal(i) > 0) covered++
    return covered
  }, [tasks, hours])

  const addExpense = () =>
    setExpenses((prev) => [
      ...prev,
      {
        id: makeId('exp'),
        date: weekStart,
        expenseCode: EXPENSE_CODES[0].code,
        merchant: '',
        description: '',
        amount: '',
        units: '',
        hasReceipt: false,
      },
    ])
  const updateExpense = (id: string, field: keyof Omit<Expense, 'id'>, value: string | boolean) =>
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)))
  const deleteExpense = (id: string) => setExpenses((prev) => prev.filter((e) => e.id !== id))
  const expenseTotal = expenses.reduce((sum, e) => sum + lineAmount(e), 0)

  const expenseIssues = useMemo(() => {
    const issues: string[] = []
    if (expenses.length === 0) return issues
    expenses.forEach((exp) => {
      const code = expenseCodeFor(exp.expenseCode)
      if (code.requiresReceipt && !exp.hasReceipt) {
        issues.push(`${code.name} on ${exp.date || 'this date'} requires a receipt — none attached.`)
      }
      if (code.unit && (parseFloat(exp.units) || 0) <= 0) {
        issues.push(`${code.name} needs a ${code.unit.label} count greater than 0.`)
      }
      if (!code.unit && (parseFloat(exp.amount) || 0) <= 0) {
        issues.push(`${code.name} needs an amount greater than $0.`)
      }
    })
    return issues
  }, [expenses])

  const expenseReadiness: 'empty' | 'blocked' | 'ready' =
    expenses.length === 0 ? 'empty' : expenseIssues.length > 0 ? 'blocked' : 'ready'

  const handleExpenseSubmit = () => {
    if (expenseReadiness !== 'ready') {
      setShowExpenseBlockedNotice(true)
      return
    }
    const period = selectableWeeks.find((w) => w.value === weekStart)?.label.replace(/^Current week · /, '') ?? weekStart
    onExpenseSubmit(period)
    setExpenseSheetSubmitted(true)
  }

  const runNovaAllocation = async () => {
    setAllocating(true)
    setAllocationError(null)
    try {
      const res = await fetch('/api/nova/assign-cost-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: tasks.map((t) => ({ id: t.id, name: t.name })),
          costAllocations: assignment.costAllocations,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAllocationError(data.error ?? 'Nova could not assign cost allocations.')
        return
      }
      const next: Record<string, TaskAllocation> = {}
      for (const a of data.assignments as {
        taskId: string
        costCenter: string
        taskCode: string
        rationale: string
      }[]) {
        const task = tasks.find((t) => t.id === a.taskId)
        next[a.taskId] = {
          costCenter: a.costCenter,
          taskCode: a.taskCode,
          rationale: a.rationale,
          assignedForName: task?.name ?? '',
        }
      }
      setTaskAllocations((prev) => ({ ...prev, ...next }))
    } catch {
      setAllocationError('Could not reach Nova. Check your connection and try again.')
    } finally {
      setAllocating(false)
    }
  }

  const tasksNeedingAllocation = tasks.filter((t) => {
    const alloc = taskAllocations[t.id]
    return !alloc || alloc.assignedForName !== t.name
  })

  const qaIssues = useMemo(() => {
    const issues: string[] = []
    const unnamedTasks = tasks.filter((t) => t.name.trim() === 'New task')
    if (unnamedTasks.length > 0)
      issues.push(
        `${unnamedTasks.length} task${unnamedTasks.length > 1 ? 's' : ''} still labeled "New task" — rename before submitting.`
      )
    const emptyTasks = tasks.filter((t) => rowTotal(t.id) === 0)
    if (emptyTasks.length > 0) issues.push(`"${emptyTasks[0].name}" has no hours logged. Remove the row or add time.`)
    tasks.forEach((t) => {
      const dayHours = hours[t.id] ?? []
      dayHours.forEach((h, i) => {
        if (h > MAX_REASONABLE_DAY_HOURS)
          issues.push(`${days[i]} shows ${h} hours on "${t.name}" — please confirm this is correct.`)
      })
    })
    if (weekTotal === 0) issues.push('No hours entered for this week yet.')
    if (tasksNeedingAllocation.length > 0 && weekTotal > 0)
      issues.push(
        `${tasksNeedingAllocation.length} task${tasksNeedingAllocation.length > 1 ? 's need' : ' needs'} a cost allocation — click "Auto-assign with Nova."`
      )
    return issues
  }, [tasks, hours, weekTotal, tasksNeedingAllocation])

  const jurisdictionFlags: JurisdictionFlag[] = useMemo(() => {
    const flags: JurisdictionFlag[] = []
    if (assignment.jurisdiction === 'Germany') {
      for (let i = 0; i < 5; i++) {
        const total = dayTotal(i)
        if (total > GERMANY_DAILY_CAP) {
          flags.push({
            text: `${days[i]} shows ${total} hours, above Germany's standard ${GERMANY_DAILY_CAP}-hour daily limit under the Arbeitszeitgesetz — confirm rest-period compliance before approval.`,
            severity: 'high',
          })
        }
      }
    }
    if (assignment.jurisdiction === 'United States' && weekTotal > 40) {
      flags.push({
        text: `Weekly hours exceed 40 — under the FLSA, non-exempt workers are generally owed overtime pay above this threshold.`,
        severity: 'info',
      })
    }
    return flags
  }, [assignment.jurisdiction, tasks, hours, weekTotal])

  const deviationPct = assignment.expectedHours
    ? Math.round(Math.abs((weekTotal - assignment.expectedHours) / assignment.expectedHours) * 100)
    : 0
  const isAnomaly = deviationPct >= ANOMALY_THRESHOLD_PCT && weekTotal > 0
  const anomalyDirection = weekTotal > assignment.expectedHours ? 'above' : 'below'
  const hasHighSeverityJurisdictionFlag = jurisdictionFlags.some((f) => f.severity === 'high')

  const readinessLevel: 'ready' | 'needs-attention' | 'blocked' = useMemo(() => {
    if (qaIssues.length > 0) return 'blocked'
    if (hasHighSeverityJurisdictionFlag) return 'blocked'
    if (isAnomaly && !anomalyReason.trim()) return 'needs-attention'
    return 'ready'
  }, [qaIssues, hasHighSeverityJurisdictionFlag, isAnomaly, anomalyReason])

  const handleSubmitClick = () => {
    if (readinessLevel !== 'ready') {
      setShowSubmitBlockedNotice(true)
      return
    }
    onSubmit(weekStart)
  }

  const generateBrief = async () => {
    setBriefLoading(true)
    setBriefError(null)
    setBrief(null)
    const historicalAvg =
      Math.round((MOCK_HISTORY_HOURS.reduce((a, b) => a + b, 0) / MOCK_HISTORY_HOURS.length) * 10) / 10
    const historicalWeeksOverExpected = MOCK_HISTORY_HOURS.filter((h) => h > assignment.expectedHours).length
    try {
      const res = await fetch('/api/timesheet-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerName: WORKER_NAME,
          assignment: `${assignment.type} · ${assignment.id} — ${assignment.label}`,
          jurisdiction: assignment.jurisdiction,
          weekTotal,
          expectedHours: assignment.expectedHours,
          deviationPct,
          tasks: tasks.map((t) => ({ name: t.name, total: rowTotal(t.id) })),
          qaIssues,
          anomalyReason,
          daysCovered,
          totalDays: 5,
          historicalAvg,
          historicalWeeksOverExpected,
          historicalWeeksCount: MOCK_HISTORY_HOURS.length,
          jurisdictionFlags,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBriefError(data.error ?? 'Something went wrong generating the brief.')
        return
      }
      setBrief(data.brief)
    } catch {
      setBriefError('Could not reach the brief generator. Check your connection and try again.')
    } finally {
      setBriefLoading(false)
    }
  }

  const briefLines = brief ? brief.split('\n').filter((l) => l.trim()) : []
  const recommendationLine = briefLines.find((l) => l.toLowerCase().startsWith('recommendation'))
  const bulletLines = briefLines.filter((l) => l.trim().startsWith('-'))
  const recommendationText = recommendationLine?.split(':')[1]?.trim() ?? ''
  const recStyle = recommendationText.toLowerCase().includes('needs review')
    ? 'bg-red-50 text-red-700 border-red-200'
    : recommendationText.toLowerCase().includes('note')
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200'

  return (
    <>
      {/* Header */}
      <div className="px-7 py-6 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-data text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-700/70 mb-1.5">
              Time Sheet · {assignment.id}
            </div>
            <h2 className="font-display text-[21px] font-semibold text-[#0B1220] tracking-tight">
              Submit hours for {WORKER_NAME.split(' ')[0]}
            </h2>
            <div className="mt-1 text-[13px] text-slate-500">
              Hourly · Expected {assignment.expectedHours}h/week
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowExpenses(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:border-cyan-300 hover:bg-cyan-50/50 hover:text-cyan-800 transition-all"
            >
              <Receipt className="h-3.5 w-3.5" />
              Expenses
              {expenses.length > 0 && (
                <span className="font-data ml-0.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {expenses.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowComments(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:border-cyan-300 hover:bg-cyan-50/50 hover:text-cyan-800 transition-all"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Comment
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div>
            <label className="font-data text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Week
            </label>
            <div className="relative mt-1.5">
              <Calendar className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all"
              >
                {selectableWeeks.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-data text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Assignment
            </label>
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all"
              value={assignment.id}
              onChange={(e) => setAssignment(assignments.find((a) => a.id === e.target.value)!)}
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.type} · {a.id} — {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[11px] text-slate-400">
            Jurisdiction: <span className="font-data text-slate-600">{assignment.jurisdiction}</span>
          </span>
          <span className="text-[11px] text-slate-400">
            {assignment.costAllocations.length} cost allocation
            {assignment.costAllocations.length === 1 ? '' : 's'} on this {assignment.type}
          </span>
          <span className="text-[11px] text-slate-300">· assigned per task by Nova</span>
        </div>

        <div
          className={`mt-4 flex items-start gap-3 rounded-lg pl-4 pr-4 py-2.5 border-l-2 ${
            overtime ? 'bg-red-50/70 border-red-400 text-red-800' : 'bg-emerald-50/70 border-emerald-400 text-emerald-800'
          }`}
        >
          <span className="text-[13px] leading-relaxed">
            {overtime ? '⚠ Overtime detected · Manager approval will be required' : '✔ No overtime risk detected · Hours align with engagement terms'}
          </span>
        </div>

        {isAnomaly && (
          <div className="mt-3 rounded-lg bg-amber-50/70 border-l-2 border-amber-400 pl-4 pr-4 py-3 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-amber-900">
                  This week is <span className="font-data">{deviationPct}%</span> {anomalyDirection} the expected{' '}
                  {assignment.expectedHours} hours.
                </div>
                <div className="text-xs text-amber-700 mt-0.5">
                  Add a short reason so your approver has context — this attaches directly to your submission.
                </div>
                <textarea
                  value={anomalyReason}
                  onChange={(e) => setAnomalyReason(e.target.value)}
                  placeholder="e.g. Production deployment ran through the weekend"
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-amber-300/40"
                />
              </div>
            </div>
          </div>
        )}

        {jurisdictionFlags.length > 0 && (
          <div className="mt-3 space-y-2">
            {jurisdictionFlags.map((flag, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 rounded-lg pl-4 pr-4 py-2.5 border-l-2 animate-in fade-in slide-in-from-top-1 duration-300 ${
                  flag.severity === 'high' ? 'bg-red-50/70 border-red-400 text-red-800' : 'bg-slate-50 border-slate-300 text-slate-600'
                }`}
              >
                <Scale className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span className="text-[13px] leading-relaxed">{flag.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nova cost allocation */}
      <div className="px-7 py-3 border-b border-slate-100 bg-gradient-to-r from-cyan-50/60 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] text-cyan-900">
          <Sparkles className="h-3.5 w-3.5 text-cyan-600 flex-shrink-0" />
          {tasksNeedingAllocation.length === 0 ? (
            <span>All tasks have a Nova-assigned cost allocation.</span>
          ) : (
            <span>
              <span className="font-data font-semibold">{tasksNeedingAllocation.length}</span> task
              {tasksNeedingAllocation.length > 1 ? 's' : ''} need{tasksNeedingAllocation.length > 1 ? '' : 's'} a cost
              allocation from this {assignment.type}'s configured options.
            </span>
          )}
        </div>
        <button
          onClick={runNovaAllocation}
          disabled={allocating || tasks.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:text-cyan-800 disabled:text-slate-300 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
        >
          {allocating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Nova is assigning…
            </>
          ) : (
            'Auto-assign with Nova'
          )}
        </button>
      </div>

      {allocationError && (
        <div className="px-7 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700">{allocationError}</div>
      )}

      {/* Grid — the signature ledger treatment */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-100">
              <th className="px-7 py-3 text-left font-data text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Task / Activity
              </th>
              {days.map((d) => (
                <th key={d} className="px-3 py-3 text-center font-data text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {d}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-data text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Total
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const alloc = taskAllocations[task.id]
              const isStale = alloc && alloc.assignedForName !== task.name
              return (
                <tr key={task.id} className="group hover:bg-slate-50/60 transition-colors">
                  <td className="pl-7 pr-4 py-3 align-top">
                    <input
                      defaultValue={task.name}
                      onBlur={(e) => updateTaskName(task.id, e.target.value)}
                      className="w-full bg-transparent border-0 border-b border-slate-200 px-0 py-1 text-[14px] font-medium text-[#0B1220] focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    <div className="mt-1.5">
                      {alloc && !isStale ? (
                        <span
                          title={alloc.rationale}
                          className="font-data inline-flex items-center gap-1 text-[10px] font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-full px-2 py-0.5"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {alloc.costCenter} · {alloc.taskCode}
                        </span>
                      ) : isStale ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Re-run Nova — task renamed
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">Not yet assigned</span>
                      )}
                    </div>
                  </td>

                  {days.map((_, i) => (
                    <td key={i} className="px-3 py-3 text-center align-top">
                      <input
                        type="number"
                        min={0}
                        value={hours[task.id]?.[i] ?? 0}
                        onChange={(e) => updateHour(task.id, i, Number(e.target.value))}
                        className="font-data w-14 bg-transparent border-0 border-b border-slate-200 px-1 py-1 text-[14px] text-center tabular-nums text-[#0B1220] focus:outline-none focus:border-b-2 focus:border-cyan-500 focus:bg-cyan-50/30 rounded-t transition-all"
                      />
                    </td>
                  ))}

                  <td className="px-4 py-3 text-center align-top">
                    <span className="font-data text-[14px] font-semibold text-[#0B1220] tabular-nums">
                      {rowTotal(task.id)}
                    </span>
                  </td>

                  <td className="pr-7 pl-2 py-3 text-center align-top">
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Submission Readiness */}
      <div className="px-7 py-4 border-t border-slate-100 bg-slate-50/40">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
            <ShieldCheck className="h-3 w-3 text-slate-500" />
          </div>
          <span className="font-display text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Submission Readiness
          </span>
        </div>

        {qaIssues.length === 0 && !isAnomaly && !hasHighSeverityJurisdictionFlag && (
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            No issues found. Ready to submit.
          </div>
        )}

        {qaIssues.length > 0 && (
          <ul className="space-y-1 mb-2">
            {qaIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        )}

        {hasHighSeverityJurisdictionFlag && (
          <div className="flex items-start gap-2 text-xs text-red-700 mb-2">
            <Scale className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            Resolve the jurisdiction compliance flag above before submitting.
          </div>
        )}

        {isAnomaly && qaIssues.length === 0 && (
          <div className="flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            {anomalyReason.trim() ? 'Reason attached — this will be visible to your approver.' : 'Add a reason above before submitting.'}
          </div>
        )}

        {showSubmitBlockedNotice && readinessLevel !== 'ready' && (
          <div className="mt-2 text-xs font-medium text-slate-500">Please resolve the items above before submitting.</div>
        )}
      </div>

      {/* Approval Brief */}
      <div className="px-7 py-4 border-t border-slate-100 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-600" />
            <span className="font-display text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Approval Brief
            </span>
          </div>
          <button
            onClick={generateBrief}
            disabled={weekTotal === 0 || briefLoading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:text-cyan-800 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {briefLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : brief ? (
              'Regenerate'
            ) : (
              'Generate brief'
            )}
          </button>
        </div>

        {!brief && !briefLoading && !briefError && (
          <p className="text-xs text-slate-400">
            Generates a short summary for your approver — including trend and jurisdiction compliance context.
          </p>
        )}

        {briefError && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            {briefError}
          </div>
        )}

        {brief && !briefLoading && (
          <div className="rounded-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-300">
            {recommendationText && (
              <div className={`px-4 py-2 text-xs font-semibold border-b ${recStyle}`}>
                Recommendation: {recommendationText}
              </div>
            )}
            <ul className="px-4 py-3 space-y-2 bg-slate-50/50">
              {bulletLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700 leading-snug">
                  <span className="w-1 h-1 rounded-full bg-cyan-500 mt-2 flex-shrink-0" />
                  {line.replace(/^-\s*/, '')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-7 py-5 border-t border-slate-100 bg-slate-50/60">
        <button
          onClick={addTask}
          className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:text-cyan-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add task
        </button>

        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-slate-500">Week total </span>
            <span className="font-data font-semibold text-[#0B1220]">{weekTotal}</span>
            <span className="text-slate-500"> hours</span>
            {expenses.length > 0 && (
              <span className="ml-3 text-slate-500">
                · Expenses <span className="font-data font-semibold text-[#0B1220]">${expenseTotal.toFixed(2)}</span>
              </span>
            )}
          </div>

          <button
            onClick={handleSubmitClick}
            className={`font-display rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all ${
              readinessLevel === 'ready'
                ? 'bg-[#0B1220] hover:bg-slate-800 hover:-translate-y-0.5 shadow-[0_8px_20px_-8px_rgba(11,18,32,0.5)]'
                : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            Submit
          </button>
        </div>
      </div>

      {showComments && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowComments(false)} />
          <div className="w-[360px] bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="font-display text-sm font-semibold text-[#0B1220]">Add comment</div>
              <button onClick={() => setShowComments(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="p-4 flex-1">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add context for approver..."
                className="w-full h-full rounded-lg border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400"
              />
            </div>
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={() => setShowComments(false)}
                className="w-full rounded-full bg-[#0B1220] px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Save comment
              </button>
            </div>
          </div>
        </div>
      )}

      {showExpenses && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowExpenses(false)} />
          <div className="w-[460px] bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <div className="font-display text-sm font-semibold text-[#0B1220]">Expense Sheet</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {selectableWeeks.find((w) => w.value === weekStart)?.label ?? 'Current week'}
                </div>
              </div>
              <button onClick={() => setShowExpenses(false)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {expenseSheetSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-display text-base font-semibold text-[#0B1220]">Expense sheet submitted</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  <span className="font-data">${expenseTotal.toFixed(2)}</span> across {expenses.length} line
                  item{expenses.length === 1 ? '' : 's'} sent for approval.
                </p>
                <button
                  onClick={() => setShowExpenses(false)}
                  className="mt-6 rounded-full bg-[#0B1220] hover:bg-slate-800 px-5 py-2 text-sm font-semibold text-white transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="p-5 flex-1 overflow-y-auto space-y-3">
                  {expenses.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-10">
                      No expenses added yet. Every code below is pre-configured — no admin setup needed to use
                      any of them.
                    </div>
                  )}

                  {expenses.map((exp) => {
                    const code = expenseCodeFor(exp.expenseCode)
                    return (
                      <div key={exp.id} className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <select
                            value={exp.expenseCode}
                            onChange={(e) => updateExpense(exp.id, 'expenseCode', e.target.value)}
                            className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium"
                          >
                            {EXPENSE_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} · {c.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={exp.date}
                            onChange={(e) => updateExpense(exp.id, 'date', e.target.value)}
                            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                          <button onClick={() => deleteExpense(exp.id)} className="text-slate-300 hover:text-red-600 flex-shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="font-data text-[10px] text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                            GL {code.glAccount}
                          </span>
                          {code.unit && (
                            <span className="font-data text-[10px] text-slate-400">
                              ${code.unit.rate.toFixed(2)}/{code.unit.label}
                            </span>
                          )}
                        </div>

                        {code.unit ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              placeholder="0"
                              value={exp.units}
                              onChange={(e) => updateExpense(exp.id, 'units', e.target.value)}
                              className="font-data w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-center"
                            />
                            <span className="text-xs text-slate-400">{code.unit.label}(s)</span>
                            <span className="text-xs text-slate-300 ml-auto">
                              = <span className="font-data text-slate-600 font-medium">${lineAmount(exp).toFixed(2)}</span>
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-data text-xs text-slate-400">$</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="0.00"
                              value={exp.amount}
                              onChange={(e) => updateExpense(exp.id, 'amount', e.target.value)}
                              className="font-data w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Merchant (optional)"
                            value={exp.merchant}
                            onChange={(e) => updateExpense(exp.id, 'merchant', e.target.value)}
                            className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Description (optional)"
                            value={exp.description}
                            onChange={(e) => updateExpense(exp.id, 'description', e.target.value)}
                            className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                        </div>

                        {code.requiresReceipt && (
                          <label
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                              exp.hasReceipt
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            <Paperclip className="w-3 h-3 flex-shrink-0" />
                            <span className="flex-1 truncate">
                              {exp.hasReceipt ? exp.fileName ?? 'Receipt attached' : 'Receipt required — click to attach'}
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  updateExpense(exp.id, 'hasReceipt', true)
                                  updateExpense(exp.id, 'fileName', file.name)
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    )
                  })}

                  <button
                    onClick={addExpense}
                    className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:text-cyan-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add expense
                  </button>
                </div>

                {expenses.length > 0 && (
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-display text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                        Sheet Readiness
                      </span>
                    </div>
                    {expenseReadiness === 'ready' ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Ready to submit.
                      </div>
                    ) : (
                      <ul className="space-y-0.5">
                        {expenseIssues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                    {showExpenseBlockedNotice && expenseReadiness !== 'ready' && (
                      <div className="mt-1.5 text-[11px] text-slate-500">Resolve the items above to submit.</div>
                    )}
                  </div>
                )}

                <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-sm">
                    Total: <span className="font-data font-semibold text-[#0B1220]">${expenseTotal.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleExpenseSubmit}
                    disabled={expenseReadiness === 'empty'}
                    className={`rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors ${
                      expenseReadiness === 'ready'
                        ? 'bg-[#0B1220] hover:bg-slate-800'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    Submit Expense Sheet
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}