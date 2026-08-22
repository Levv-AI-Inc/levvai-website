'use client'

import { createContext, useContext, useState, useMemo } from 'react'

export type CostAllocation = {
  costCenter: string
  taskCode: string
  label: string
}

export type Assignment = {
  id: string
  label: string
  type: 'SOW' | 'Work Order'
  expectedHours: number
  jurisdiction: string
  // A WO/SOW can have one or several valid cost allocations. Nova assigns
  // each task line to one of these — the worker never picks directly.
  costAllocations: CostAllocation[]
}

export type Client = {
  id: string
  name: string
  assignments: Assignment[]
}

export type EngagementStatus = {
  status: 'active' | 'expired' | 'not_started'
  expiredAt?: string
  expiredReason?: string
}

export type WorkItem = {
  id: string
  period: string
  status: 'Draft' | 'Submitted' | 'Approved'
  flagged?: boolean
  kind?: 'timesheet' | 'expense'
  weekStart?: string // ISO date of the Monday this item's period covers
}

// Single source of truth for "what week is this" — both Home's mock data and
// the Timesheet page's week dropdown derive from this, so they can't drift
// out of sync with each other or with the real current date.
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

export const CLIENTS: Client[] = [
  {
    id: 'northbridge',
    name: 'NorthBridge Financial',
    assignments: [
      {
        id: 'SOW-10492',
        label: 'Managed Services – Finance Ops',
        type: 'SOW',
        expectedHours: 40,
        jurisdiction: 'Germany',
        costAllocations: [
          { costCenter: '93582_Operations', taskCode: 'Hours Worked', label: 'Operations' },
          { costCenter: '93590_Reporting', taskCode: 'Hours Worked', label: 'Reporting & Compliance' },
        ],
      },
      {
        id: 'WO-88321',
        label: 'Data Migration Support',
        type: 'Work Order',
        expectedHours: 40,
        jurisdiction: 'United States',
        costAllocations: [
          { costCenter: '77210_IT_Delivery', taskCode: 'Hours Worked', label: 'IT Delivery' },
          { costCenter: '77225_IT_QA', taskCode: 'Hours Worked', label: 'IT Quality Assurance' },
        ],
      },
    ],
  },
  {
    id: 'acme',
    name: 'Acme Manufacturing',
    assignments: [
      {
        id: 'WO-55210',
        label: 'Supply Chain Analytics',
        type: 'Work Order',
        expectedHours: 40,
        jurisdiction: 'United States',
        costAllocations: [
          { costCenter: '41100_Ops_Analytics', taskCode: 'Hours Worked', label: 'Operations Analytics' },
        ],
      },
    ],
  },
]

const INITIAL_WORK_ITEMS: Record<string, WorkItem[]> = {
  northbridge: [
    {
      id: 'LVTS-000119',
      period: getMondayOfWeek(0).label,
      weekStart: getMondayOfWeek(0).iso,
      status: 'Draft',
    },
    {
      id: 'LVTS-000118',
      period: getMondayOfWeek(1).label,
      weekStart: getMondayOfWeek(1).iso,
      status: 'Draft',
      flagged: true,
    },
    {
      id: 'LVTS-000117',
      period: getMondayOfWeek(2).label,
      weekStart: getMondayOfWeek(2).iso,
      status: 'Submitted',
    },
    {
      id: 'LVTS-000116',
      period: getMondayOfWeek(3).label,
      weekStart: getMondayOfWeek(3).iso,
      status: 'Approved',
    },
  ],
  acme: [
    { id: 'LVTS-000098', period: getMondayOfWeek(9).label, weekStart: getMondayOfWeek(9).iso, status: 'Approved' },
    { id: 'LVTS-000097', period: getMondayOfWeek(10).label, weekStart: getMondayOfWeek(10).iso, status: 'Approved' },
    { id: 'LVTS-000096', period: getMondayOfWeek(11).label, weekStart: getMondayOfWeek(11).iso, status: 'Approved' },
  ],
}

type ContextValue = {
  clients: Client[]
  activeClientId: string
  activeClient: Client
  engagementStatuses: Record<string, EngagementStatus>
  switchClient: (clientId: string) => void
  workItemsByClient: Record<string, WorkItem[]>
  submitCurrentWeek: (weekStart: string) => void
  submitExpenseSheet: (period: string) => void
}

const WorkerClientContext = createContext<ContextValue | null>(null)

export function useWorkerClient() {
  const ctx = useContext(WorkerClientContext)
  if (!ctx) throw new Error('useWorkerClient must be used within the worker portal layout')
  return ctx
}

export default function ActAsWorkerLayout({ children }: { children: React.ReactNode }) {
  const [activeClientId, setActiveClientId] = useState(CLIENTS[0].id)
  const [engagementStatuses, setEngagementStatuses] = useState<Record<string, EngagementStatus>>({
    [CLIENTS[0].id]: { status: 'active' },
    [CLIENTS[1].id]: {
      status: 'expired',
      expiredAt: 'Jun 12, 2026',
      expiredReason: 'Engagement completed — Work Order term ended.',
    },
  })
  const [workItemsByClient, setWorkItemsByClient] = useState<Record<string, WorkItem[]>>(
    INITIAL_WORK_ITEMS
  )

  const switchClient = (clientId: string) => {
    if (clientId === activeClientId) return

    setEngagementStatuses((prev) => {
      const next = { ...prev }
      const outgoing = prev[activeClientId]
      const incomingName = CLIENTS.find((c) => c.id === clientId)?.name ?? 'another client'

      if (outgoing?.status === 'active') {
        next[activeClientId] = {
          status: 'expired',
          expiredAt: new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
          expiredReason: `Automatically ended — an active engagement began with ${incomingName}.`,
        }
      }

      next[clientId] = { status: 'active' }
      return next
    })

    setActiveClientId(clientId)
  }

  // Flips this client's most recent Draft item to Submitted — the piece that
  // makes the timesheet flow feel real without a backend: the state change
  // is visible back on Home immediately after submitting.
  const submitCurrentWeek = (weekStart: string) => {
    setWorkItemsByClient((prev) => {
      const items = prev[activeClientId] ?? []
      let index = items.findIndex(
        (i) => i.status === 'Draft' && i.kind !== 'expense' && i.weekStart === weekStart
      )
      // Fall back to "first draft" only if nothing matches this exact week —
      // keeps this working even for mock rows that don't carry a weekStart.
      if (index === -1) {
        index = items.findIndex((i) => i.status === 'Draft' && i.kind !== 'expense')
      }
      if (index === -1) return prev

      const updated = [...items]
      updated[index] = { ...updated[index], status: 'Submitted', flagged: false }
      return { ...prev, [activeClientId]: updated }
    })
  }

  // Expense sheets aren't pre-queued as drafts the way time sheets are — they're
  // created on demand — so submitting adds a new row rather than flipping an
  // existing one.
  const submitExpenseSheet = (period: string) => {
    setWorkItemsByClient((prev) => {
      const items = prev[activeClientId] ?? []
      const newItem: WorkItem = {
        id: `LVEX-${Date.now().toString().slice(-6)}`,
        period,
        status: 'Submitted',
        kind: 'expense',
      }
      return { ...prev, [activeClientId]: [newItem, ...items] }
    })
  }

  const activeClient = useMemo(
    () => CLIENTS.find((c) => c.id === activeClientId) ?? CLIENTS[0],
    [activeClientId]
  )

  return (
    <WorkerClientContext.Provider
      value={{
        clients: CLIENTS,
        activeClientId,
        activeClient,
        engagementStatuses,
        switchClient,
        workItemsByClient,
        submitCurrentWeek,
        submitExpenseSheet,
      }}
    >
      {children}
    </WorkerClientContext.Provider>
  )
}