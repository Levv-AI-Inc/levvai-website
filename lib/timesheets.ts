export const TIMESHEET_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
export const ANOMALY_THRESHOLD_PCT = 15
export const MAX_REASONABLE_DAY_HOURS = 16
export const GERMANY_DAILY_CAP = 10

export type TimesheetTask = { id: string; name: string }
export type TimesheetHours = Record<string, number[]>
export type TaskAllocation = {
  costCenter: string
  taskCode: string
  rationale: string
  assignedForName: string
}
export type JurisdictionFlag = { text: string; severity: 'high' | 'info' }
export type ReadinessLevel = 'ready' | 'needs-attention' | 'blocked'

export function getMondayOfWeek(offsetWeeks: number): { iso: string; label: string } {
  const today = new Date()
  const day = today.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const currentMonday = new Date(today)
  currentMonday.setDate(today.getDate() + diffToMonday)

  const monday = new Date(currentMonday)
  monday.setDate(currentMonday.getDate() - offsetWeeks * 7)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return {
    iso: monday.toISOString().split('T')[0],
    label: `${fmt(monday)} – ${fmt(friday)}, ${monday.getFullYear()}`,
  }
}

export function getRowTotal(hours: TimesheetHours, taskId: string) {
  return (hours[taskId] ?? []).reduce((a, b) => a + b, 0)
}

export function getDayTotal(tasks: TimesheetTask[], hours: TimesheetHours, dayIndex: number) {
  return tasks.reduce((sum, task) => sum + (hours[task.id]?.[dayIndex] ?? 0), 0)
}

export function getWeekTotal(tasks: TimesheetTask[], hours: TimesheetHours) {
  return tasks.reduce((sum, task) => sum + getRowTotal(hours, task.id), 0)
}

export function getDaysCovered(tasks: TimesheetTask[], hours: TimesheetHours, totalDays = TIMESHEET_DAYS.length) {
  let covered = 0
  for (let i = 0; i < totalDays; i++) {
    if (getDayTotal(tasks, hours, i) > 0) covered++
  }
  return covered
}

export function getTasksNeedingAllocation(
  tasks: TimesheetTask[],
  allocations: Record<string, TaskAllocation>
) {
  return tasks.filter((task) => {
    const allocation = allocations[task.id]
    return !allocation || allocation.assignedForName !== task.name
  })
}

export function getTimesheetQaIssues({
  tasks,
  hours,
  tasksNeedingAllocation,
  weekTotal,
}: {
  tasks: TimesheetTask[]
  hours: TimesheetHours
  tasksNeedingAllocation: TimesheetTask[]
  weekTotal: number
}) {
  const issues: string[] = []
  const unnamedTasks = tasks.filter((task) => task.name.trim() === 'New task')

  if (unnamedTasks.length > 0) {
    issues.push(
      `${unnamedTasks.length} task${unnamedTasks.length > 1 ? 's' : ''} still labeled "New task" — rename before submitting.`
    )
  }

  const emptyTasks = tasks.filter((task) => getRowTotal(hours, task.id) === 0)
  if (emptyTasks.length > 0) {
    issues.push(`"${emptyTasks[0].name}" has no hours logged. Remove the row or add time.`)
  }

  tasks.forEach((task) => {
    const dayHours = hours[task.id] ?? []
    dayHours.forEach((dayHour, index) => {
      if (dayHour > MAX_REASONABLE_DAY_HOURS) {
        issues.push(
          `${TIMESHEET_DAYS[index]} shows ${dayHour} hours on "${task.name}" — please confirm this is correct.`
        )
      }
    })
  })

  if (weekTotal === 0) issues.push('No hours entered for this week yet.')
  if (tasksNeedingAllocation.length > 0 && weekTotal > 0) {
    issues.push(
      `${tasksNeedingAllocation.length} task${tasksNeedingAllocation.length > 1 ? 's need' : ' needs'} a cost allocation — click "Auto-assign with Nova."`
    )
  }

  return issues
}

export function getJurisdictionFlags({
  jurisdiction,
  tasks,
  hours,
  weekTotal,
}: {
  jurisdiction: string
  tasks: TimesheetTask[]
  hours: TimesheetHours
  weekTotal: number
}) {
  const flags: JurisdictionFlag[] = []

  if (jurisdiction === 'Germany') {
    for (let i = 0; i < TIMESHEET_DAYS.length; i++) {
      const total = getDayTotal(tasks, hours, i)
      if (total > GERMANY_DAILY_CAP) {
        flags.push({
          text: `${TIMESHEET_DAYS[i]} shows ${total} hours, above Germany's standard ${GERMANY_DAILY_CAP}-hour daily limit under the Arbeitszeitgesetz — confirm rest-period compliance before approval.`,
          severity: 'high',
        })
      }
    }
  }

  if (jurisdiction === 'United States' && weekTotal > 40) {
    flags.push({
      text: 'Weekly hours exceed 40 — under the FLSA, non-exempt workers are generally owed overtime pay above this threshold.',
      severity: 'info',
    })
  }

  return flags
}

export function getDeviationPct(weekTotal: number, expectedHours: number) {
  return expectedHours ? Math.round(Math.abs((weekTotal - expectedHours) / expectedHours) * 100) : 0
}

export function getReadinessLevel({
  qaIssues,
  jurisdictionFlags,
  isAnomaly,
  anomalyReason,
}: {
  qaIssues: string[]
  jurisdictionFlags: JurisdictionFlag[]
  isAnomaly: boolean
  anomalyReason: string
}): ReadinessLevel {
  if (qaIssues.length > 0) return 'blocked'
  if (jurisdictionFlags.some((flag) => flag.severity === 'high')) return 'blocked'
  if (isAnomaly && !anomalyReason.trim()) return 'needs-attention'
  return 'ready'
}

export function getHistoricalAverage(hours: number[]) {
  if (hours.length === 0) return 0
  return Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10
}

export function parseApprovalBrief(brief: string | null) {
  const lines = brief ? brief.split('\n').filter((line) => line.trim()) : []
  const recommendationLine = lines.find((line) => line.toLowerCase().startsWith('recommendation'))
  const bulletLines = lines.filter((line) => line.trim().startsWith('-'))
  const recommendationText = recommendationLine?.split(':')[1]?.trim() ?? ''

  return { bulletLines, recommendationText }
}
