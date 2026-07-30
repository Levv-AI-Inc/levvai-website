'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDot,
  Cog,
  FileCheck2,
  Layers3,
  Link2,
  Loader2,
  Lock,
  Mail,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  User,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'

import {
  getWorkerLifecycle,
  sendWorkerInvite,
  startWorkerOffboarding,
  updateLifecycleActivity,
  WorkerLifecycleApiError,
  type LifecycleActivity,
  type LifecycleBlock,
  type LifecycleDetail,
  type LifecycleType,
} from '@/lib/api/workerLifecycle'

type Feedback = {
  tone: 'success' | 'error'
  message: string
} | null

type GraphLink = {
  from: string
  to: string
}

type GraphLayout = {
  columns: LifecycleBlock[][]
  links: GraphLink[]
  positions: Map<string, { x: number; y: number }>
  sourceKeys: string[]
  sinkKeys: string[]
  width: number
  height: number
  nodeWidth: number
  nodeHeight: number
  startX: number
  endX: number
  middleY: number
}

const COMPLETE_ACTIVITY_STATUSES = new Set(['complete', 'waived'])
const NODE_WIDTH = 272
const NODE_HEIGHT = 176
const HORIZONTAL_GAP = 96
const VERTICAL_GAP = 28
const MARGIN_X = 76
const MARGIN_Y = 36

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function activityProgress(block: LifecycleBlock) {
  if (!block.activities.length) return 0
  const completed = block.activities.filter((activity) =>
    COMPLETE_ACTIVITY_STATUSES.has(activity.status),
  ).length
  return Math.round((completed * 100) / block.activities.length)
}

function blockSort(left: LifecycleBlock, right: LifecycleBlock) {
  const leftPosition = readNumber(left.layout.position, left.sequence)
  const rightPosition = readNumber(right.layout.position, right.sequence)
  return leftPosition - rightPosition || left.sequence - right.sequence
}

function buildGraphLayout(detail: LifecycleDetail): GraphLayout {
  const blocks = [...detail.blocks].sort(
    (left, right) => left.sequence - right.sequence,
  )
  const byKey = new Map(blocks.map((block) => [block.clientKey, block]))
  const rawDependencies = detail.graph.dependencies.filter(
    (dependency) => dependency.fromBlockKey && dependency.toBlockKey,
  )
  let links = rawDependencies
    .filter(
      (dependency) =>
        byKey.has(dependency.fromBlockKey) &&
        byKey.has(dependency.toBlockKey),
    )
    .map((dependency) => ({
      from: dependency.fromBlockKey,
      to: dependency.toBlockKey,
    }))

  const levels = new Map<string, number>()
  blocks.forEach((block) => levels.set(block.clientKey, 0))

  if (links.length) {
    const adjacency = new Map<string, string[]>()
    const indegree = new Map<string, number>()
    blocks.forEach((block) => {
      adjacency.set(block.clientKey, [])
      indegree.set(block.clientKey, 0)
    })
    links.forEach((link) => {
      adjacency.get(link.from)?.push(link.to)
      indegree.set(link.to, (indegree.get(link.to) ?? 0) + 1)
    })

    const queue = blocks
      .map((block) => block.clientKey)
      .filter((key) => indegree.get(key) === 0)
    while (queue.length) {
      const key = queue.shift()!
      for (const child of adjacency.get(key) ?? []) {
        levels.set(
          child,
          Math.max(levels.get(child) ?? 0, (levels.get(key) ?? 0) + 1),
        )
        indegree.set(child, (indegree.get(child) ?? 0) - 1)
        if (indegree.get(child) === 0) queue.push(child)
      }
    }
  } else {
    let nextLevel = 0
    blocks.forEach((block) => {
      const configuredLevel = readNumber(block.layout.level, nextLevel)
      levels.set(block.clientKey, Math.max(nextLevel, configuredLevel))
      if (block.gateType === 'hard') nextLevel += 1
    })
  }

  const maxLevel = blocks.length
    ? Math.max(...blocks.map((block) => levels.get(block.clientKey) ?? 0))
    : 0
  const columnsWithGaps: LifecycleBlock[][] = Array.from(
    { length: maxLevel + 1 },
    () => [],
  )
  blocks.forEach((block) => {
    columnsWithGaps[levels.get(block.clientKey) ?? 0]?.push(block)
  })
  const columns = columnsWithGaps
    .filter((column) => column.length)
    .map((column) => column.sort(blockSort))

  if (!links.length && columns.length > 1) {
    const barrierKey = (column: LifecycleBlock[]) => {
      const hardBlocks = column.filter((block) => block.gateType === 'hard')
      return (hardBlocks.at(-1) ?? column.at(-1))?.clientKey
    }
    links = []
    columns.forEach((column, columnIndex) => {
      const nextColumn = columns[columnIndex + 1]
      if (!nextColumn) return
      const from = barrierKey(column)
      if (!from) return
      nextColumn.forEach((block) => {
        links.push({ from, to: block.clientKey })
      })
    })
  }

  const incoming = new Set(links.map((link) => link.to))
  const outgoing = new Set(links.map((link) => link.from))
  const explicitSources = rawDependencies
    .filter(
      (dependency) =>
        dependency.fromBlockKey === '__start__' &&
        byKey.has(dependency.toBlockKey),
    )
    .map((dependency) => dependency.toBlockKey)
  const explicitSinks = rawDependencies
    .filter(
      (dependency) =>
        dependency.toBlockKey === '__end__' &&
        byKey.has(dependency.fromBlockKey),
    )
    .map((dependency) => dependency.fromBlockKey)
  const sourceKeys = explicitSources.length
    ? explicitSources
    : blocks
        .map((block) => block.clientKey)
        .filter((key) => !incoming.has(key))
  const sinkKeys = explicitSinks.length
    ? explicitSinks
    : blocks
        .map((block) => block.clientKey)
        .filter((key) => !outgoing.has(key))

  const maxRows = Math.max(1, ...columns.map((column) => column.length))
  const width = Math.max(
    760,
    MARGIN_X * 2 +
      columns.length * NODE_WIDTH +
      Math.max(0, columns.length - 1) * HORIZONTAL_GAP,
  )
  const height = Math.max(
    310,
    MARGIN_Y * 2 +
      maxRows * NODE_HEIGHT +
      Math.max(0, maxRows - 1) * VERTICAL_GAP,
  )
  const positions = new Map<string, { x: number; y: number }>()
  columns.forEach((column, columnIndex) => {
    const top =
      MARGIN_Y +
      ((maxRows - column.length) * (NODE_HEIGHT + VERTICAL_GAP)) / 2
    column.forEach((block, rowIndex) => {
      positions.set(block.clientKey, {
        x: MARGIN_X + columnIndex * (NODE_WIDTH + HORIZONTAL_GAP),
        y: top + rowIndex * (NODE_HEIGHT + VERTICAL_GAP),
      })
    })
  })

  return {
    columns,
    links,
    positions,
    sourceKeys,
    sinkKeys,
    width,
    height,
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
    startX: 28,
    endX: width - 28,
    middleY: height / 2,
  }
}

function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const midpoint = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${midpoint} ${y1}, ${midpoint} ${y2}, ${x2} ${y2}`
}

function statusClasses(status: string) {
  switch (status) {
    case 'complete':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'in_progress':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700'
    case 'blocked':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'waived':
    case 'skipped':
      return 'border-violet-200 bg-violet-50 text-violet-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500'
  }
}

function StatusIcon({
  status,
  className = 'h-4 w-4',
}: {
  status: string
  className?: string
}) {
  if (status === 'complete' || status === 'waived') {
    return <CheckCircle2 className={`${className} text-emerald-500`} />
  }
  if (status === 'in_progress') {
    return <Zap className={`${className} text-cyan-600`} />
  }
  if (status === 'blocked') {
    return <AlertTriangle className={`${className} text-rose-500`} />
  }
  return <Lock className={`${className} text-slate-400`} />
}

function ownerIcon(owner: string) {
  if (owner === 'system' || owner === 'it') return Cog
  if (owner === 'supplier') return Users
  return User
}

function BlockNode({
  block,
  selected,
  onSelect,
}: {
  block: LifecycleBlock
  selected: boolean
  onSelect: () => void
}) {
  const progress = activityProgress(block)
  const system = block.blockType === 'system'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`absolute flex h-44 flex-col overflow-visible rounded-lg border text-left shadow-sm transition ${
        system
          ? 'border-slate-800 bg-slate-950 text-white'
          : 'border-slate-200 bg-white text-slate-900'
      } ${
        selected
          ? 'ring-2 ring-cyan-500 ring-offset-2'
          : 'hover:border-cyan-300 hover:shadow-md'
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${
          block.status === 'complete'
            ? 'bg-emerald-500'
            : block.status === 'blocked'
              ? 'bg-rose-500'
              : block.status === 'in_progress'
                ? 'bg-cyan-500'
                : 'bg-slate-300'
        }`}
      />
      <span className="absolute right-3 top-0 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">
        {block.gateType} gate
      </span>
      <span className="flex items-center gap-3 border-b border-slate-200/70 px-4 pb-3 pt-5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            system
              ? 'bg-cyan-500/15 text-cyan-300'
              : block.status === 'complete'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-600'
          }`}
        >
          {system ? <Cog className="h-4 w-4" /> : <StatusIcon status={block.status} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{block.name}</span>
          <span
            className={`mt-0.5 block text-[9px] font-bold uppercase tracking-widest ${
              system ? 'text-cyan-300' : 'text-slate-400'
            }`}
          >
            {titleCase(block.status)}
          </span>
        </span>
      </span>
      <span className="min-h-0 flex-1 space-y-2 overflow-hidden px-4 py-3">
        {block.activities.slice(0, 2).map((activity) => (
          <span
            key={activity.id}
            className={`flex items-center justify-between gap-2 text-[11px] ${
              system ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            <span className="truncate">{activity.name}</span>
            <StatusIcon status={activity.status} className="h-3.5 w-3.5 shrink-0" />
          </span>
        ))}
        {block.activities.length > 2 ? (
          <span
            className={`block text-[10px] ${
              system ? 'text-slate-400' : 'text-slate-400'
            }`}
          >
            +{block.activities.length - 2} more activities
          </span>
        ) : null}
      </span>
      <span className="px-4 pb-3">
        <span
          className={`block h-1 overflow-hidden rounded-full ${
            system ? 'bg-slate-700' : 'bg-slate-100'
          }`}
        >
          <span
            className={`block h-full ${
              progress === 100 ? 'bg-emerald-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </span>
      </span>
    </button>
  )
}

function ActivityRow({
  activity,
  blockIsGated,
  note,
  onNoteChange,
  updating,
  onUpdate,
}: {
  activity: LifecycleActivity
  blockIsGated: boolean
  note: string
  onNoteChange: (value: string) => void
  updating: boolean
  onUpdate: (status: LifecycleActivity['status']) => void
}) {
  const OwnerIcon = ownerIcon(activity.owner)
  const complete = COMPLETE_ACTIVITY_STATUSES.has(activity.status)
  const actionable = activity.canUpdate && !blockIsGated

  return (
    <div className="border-b border-slate-100 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <OwnerIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{activity.name}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {titleCase(activity.owner)}
              {activity.completedAt
                ? ` · ${formatDateTime(activity.completedAt)}`
                : ''}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${statusClasses(
            activity.status,
          )}`}
        >
          {titleCase(activity.status)}
        </span>
      </div>

      {activity.notes ? (
        <p className="ml-11 mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          {activity.notes}
        </p>
      ) : null}

      {actionable ? (
        <div className="ml-11 mt-3 space-y-2">
          {!complete ? (
            <input
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Completion note (optional)"
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!complete && activity.status !== 'in_progress' ? (
              <button
                type="button"
                disabled={updating}
                onClick={() => onUpdate('in_progress')}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Start
              </button>
            ) : null}
            {!complete ? (
              <button
                type="button"
                disabled={updating}
                onClick={() => onUpdate('complete')}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Mark complete
              </button>
            ) : (
              <button
                type="button"
                disabled={updating}
                onClick={() => onUpdate('in_progress')}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Reopen
              </button>
            )}
          </div>
        </div>
      ) : blockIsGated && !complete ? (
        <p className="ml-11 mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5" />
          Complete the upstream hard gate first.
        </p>
      ) : null}
    </div>
  )
}

export default function LifecycleWorkspace({
  initialLifecycleType,
}: {
  initialLifecycleType: LifecycleType
}) {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const workerId = Number(params.workerId)
  const workOrderParam = searchParams.get('work_order')
  const workOrderIdValue = workOrderParam ? Number(workOrderParam) : 0
  const workOrderId =
    Number.isFinite(workOrderIdValue) && workOrderIdValue > 0
      ? workOrderIdValue
      : undefined
  const engagementParam = searchParams.get('engagement')
  const engagementIdValue = engagementParam ? Number(engagementParam) : 0
  const engagementId =
    Number.isFinite(engagementIdValue) && engagementIdValue > 0
      ? engagementIdValue
      : undefined
  const [detail, setDetail] = useState<LifecycleDetail | null>(null)
  const [fallbackOnboarding, setFallbackOnboarding] =
    useState<LifecycleDetail | null>(null)
  const [selectedBlockKey, setSelectedBlockKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [notStarted, setNotStarted] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [startingOffboarding, setStartingOffboarding] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [updatingActivityId, setUpdatingActivityId] = useState<number | null>(
    null,
  )
  const [activityNotes, setActivityNotes] = useState<Record<number, string>>({})

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(workerId) || workerId < 1) {
      setLoadError('The worker ID is invalid.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    setNotStarted(false)
    setFeedback(null)
    try {
      const response = await getWorkerLifecycle(
        workerId,
        initialLifecycleType,
        { workOrderId, engagementId },
      )
      setDetail(response)
      setFallbackOnboarding(null)
    } catch (error) {
      if (
        initialLifecycleType === 'offboarding' &&
        error instanceof WorkerLifecycleApiError &&
        error.status === 404
      ) {
        setNotStarted(true)
        setDetail(null)
        try {
          const onboarding = await getWorkerLifecycle(
            workerId,
            'onboarding',
            { workOrderId, engagementId },
          )
          setFallbackOnboarding(onboarding)
        } catch {
          setFallbackOnboarding(null)
        }
      } else {
        setDetail(null)
        setLoadError(
          error instanceof Error
            ? error.message
            : `Unable to load ${initialLifecycleType}.`,
        )
      }
    } finally {
      setLoading(false)
    }
  }, [engagementId, initialLifecycleType, workOrderId, workerId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!detail?.blocks.length) {
      setSelectedBlockKey('')
      return
    }
    const current =
      detail.blocks.find((block) => block.status === 'blocked') ??
      detail.blocks.find((block) => block.status === 'in_progress') ??
      detail.blocks[0]
    setSelectedBlockKey((existing) =>
      detail.blocks.some((block) => block.clientKey === existing)
        ? existing
        : current.clientKey,
    )
  }, [detail])

  const graph = useMemo(
    () => (detail ? buildGraphLayout(detail) : null),
    [detail],
  )
  const selectedBlock =
    detail?.blocks.find((block) => block.clientKey === selectedBlockKey) ?? null
  const displayDetail = detail ?? fallbackOnboarding
  const markerId = `lifecycle-arrow-${initialLifecycleType}`

  function navigateTo(type: LifecycleType) {
    const query = workOrderId
      ? `?work_order=${workOrderId}`
      : engagementId
        ? `?engagement=${engagementId}`
        : ''
    router.push(
      `/workers/${workerId}/engagements/${type}/workspace${query}`,
    )
  }

  async function handleStartOffboarding() {
    setStartingOffboarding(true)
    setFeedback(null)
    try {
      const response = await startWorkerOffboarding(workerId, {
        workOrderId,
        engagementId,
      })
      setDetail(response)
      setNotStarted(false)
      setFeedback({
        tone: 'success',
        message: 'Offboarding workflow started.',
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to start offboarding.',
      })
    } finally {
      setStartingOffboarding(false)
    }
  }

  async function handleSendInvite() {
    setSendingInvite(true)
    setFeedback(null)
    try {
      await sendWorkerInvite(workerId, { workOrderId, engagementId })
      setFeedback({
        tone: 'success',
        message: 'Registration invite sent.',
      })
      await loadDetail()
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to send the registration invite.',
      })
    } finally {
      setSendingInvite(false)
    }
  }

  async function handleActivityUpdate(
    activity: LifecycleActivity,
    status: LifecycleActivity['status'],
  ) {
    setUpdatingActivityId(activity.id)
    setFeedback(null)
    try {
      const response = await updateLifecycleActivity(
        workerId,
        initialLifecycleType,
        activity.id,
        {
          status,
          notes:
            status === 'complete'
              ? activityNotes[activity.id]?.trim() || activity.notes
              : activity.notes,
        },
      )
      setDetail(response)
      setActivityNotes((current) => ({ ...current, [activity.id]: '' }))
      setFeedback({
        tone: 'success',
        message:
          status === 'complete'
            ? `${activity.name} completed.`
            : `${activity.name} updated.`,
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to update the activity.',
      })
    } finally {
      setUpdatingActivityId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
          Loading {initialLifecycleType}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <XCircle className="mx-auto h-8 w-8 text-rose-500" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            Lifecycle unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadDetail()}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (notStarted && displayDetail) {
    const canStart = displayDetail.permissions.canStartOffboarding
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-6 lg:p-10">
        <div className="mx-auto max-w-5xl">
          <WorkerHeader
            detail={displayDetail}
            activeType="offboarding"
            onNavigate={navigateTo}
          />
          <div className="mt-12 border-y border-slate-200 bg-white px-6 py-16 text-center">
            <Power className="mx-auto h-9 w-9 text-slate-400" />
            <h1 className="mt-4 text-xl font-semibold text-slate-900">
              Offboarding has not started
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              Start the matching offboarding workflow for this assignment. If
              no dedicated workflow exists, LEVV derives the reversal from the
              matched onboarding configuration.
            </p>
            {canStart ? (
              <button
                type="button"
                disabled={startingOffboarding}
                onClick={() => void handleStartOffboarding()}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {startingOffboarding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                Start offboarding
              </button>
            ) : (
              <p className="mt-6 text-xs font-medium text-slate-400">
                An administrator must start this workflow.
              </p>
            )}
            {feedback ? <FeedbackBanner feedback={feedback} /> : null}
          </div>
        </div>
      </div>
    )
  }

  if (!detail || !graph) return null

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-4 text-slate-900 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <WorkerHeader
          detail={detail}
          activeType={initialLifecycleType}
          onNavigate={navigateTo}
        />

        {detail.registrationStatus !== 'registered' &&
        initialLifecycleType === 'onboarding' ? (
          <div className="mt-5 flex flex-col justify-between gap-3 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  Worker registration {titleCase(detail.registrationStatus)}
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  The worker must register before completing worker-owned
                  activities.
                </p>
              </div>
            </div>
            {detail.permissions.canSendInvite ? (
              <button
                type="button"
                disabled={sendingInvite}
                onClick={() => void handleSendInvite()}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 disabled:opacity-50"
              >
                {sendingInvite ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
                Resend invite
              </button>
            ) : null}
          </div>
        ) : null}

        {feedback ? <FeedbackBanner feedback={feedback} /> : null}

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {titleCase(initialLifecycleType)} flow
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {detail.workflow.name} · version {detail.workflow.version}
                {detail.workflow.derived ? ' · derived reversal' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Layers3 className="h-4 w-4 text-cyan-600" />
              {detail.blocks.length} blocks · {detail.readiness}% ready
            </div>
          </div>

          {detail.blocks.length ? (
            <div className="overflow-x-auto p-3">
              <div
                className="relative rounded-md border border-slate-100"
                style={{
                  width: graph.width,
                  height: graph.height,
                  backgroundColor: '#fbfdff',
                  backgroundImage:
                    'radial-gradient(circle, #dce4ee 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                }}
              >
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${graph.width} ${graph.height}`}
                  aria-hidden="true"
                >
                  <defs>
                    <marker
                      id={markerId}
                      markerWidth="9"
                      markerHeight="9"
                      refX="7"
                      refY="4"
                      orient="auto"
                    >
                      <path
                        d="M0,0 L7,4 L0,8"
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="1.4"
                      />
                    </marker>
                  </defs>

                  {graph.sourceKeys.map((key) => {
                    const point = graph.positions.get(key)
                    if (!point) return null
                    return (
                      <path
                        key={`source-${key}`}
                        d={edgePath(
                          graph.startX + 9,
                          graph.middleY,
                          point.x,
                          point.y + graph.nodeHeight / 2,
                        )}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1.6"
                        markerEnd={`url(#${markerId})`}
                      />
                    )
                  })}
                  {graph.links.map((link) => {
                    const from = graph.positions.get(link.from)
                    const to = graph.positions.get(link.to)
                    if (!from || !to) return null
                    return (
                      <path
                        key={`${link.from}-${link.to}`}
                        d={edgePath(
                          from.x + graph.nodeWidth,
                          from.y + graph.nodeHeight / 2,
                          to.x,
                          to.y + graph.nodeHeight / 2,
                        )}
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="1.6"
                        markerEnd={`url(#${markerId})`}
                      />
                    )
                  })}
                  {graph.sinkKeys.map((key) => {
                    const point = graph.positions.get(key)
                    if (!point) return null
                    return (
                      <path
                        key={`sink-${key}`}
                        d={edgePath(
                          point.x + graph.nodeWidth,
                          point.y + graph.nodeHeight / 2,
                          graph.endX,
                          graph.middleY,
                        )}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1.6"
                        markerEnd={`url(#${markerId})`}
                      />
                    )
                  })}

                  <circle
                    cx={graph.startX}
                    cy={graph.middleY}
                    r="8"
                    fill={initialLifecycleType === 'onboarding' ? '#0891b2' : '#0f172a'}
                  />
                  <text
                    x={graph.startX}
                    y={graph.middleY + 25}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {initialLifecycleType === 'onboarding' ? 'Start' : 'Exit'}
                  </text>
                  <circle
                    cx={graph.endX}
                    cy={graph.middleY}
                    r="8"
                    fill="white"
                    stroke={
                      initialLifecycleType === 'onboarding' ? '#0891b2' : '#0f172a'
                    }
                    strokeWidth="2"
                  />
                  <circle
                    cx={graph.endX}
                    cy={graph.middleY}
                    r="3"
                    fill={initialLifecycleType === 'onboarding' ? '#0891b2' : '#0f172a'}
                  />
                  <text
                    x={graph.endX}
                    y={graph.middleY + 25}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {initialLifecycleType === 'onboarding'
                      ? 'Active'
                      : 'Offboarded'}
                  </text>
                </svg>

                {detail.blocks.map((block) => {
                  const point = graph.positions.get(block.clientKey)
                  if (!point) return null
                  return (
                    <div
                      key={block.id}
                      className="absolute"
                      style={{ left: point.x, top: point.y }}
                    >
                      <BlockNode
                        block={block}
                        selected={block.clientKey === selectedBlockKey}
                        onSelect={() => setSelectedBlockKey(block.clientKey)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <FileCheck2 className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                This workflow has no configured blocks.
              </p>
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
          <section className="overflow-hidden border-y border-slate-200 bg-white xl:rounded-lg xl:border">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {selectedBlock?.name ?? 'Block details'}
                </h2>
                {selectedBlock ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {titleCase(selectedBlock.blockType)} ·{' '}
                    {titleCase(selectedBlock.gateType)} gate ·{' '}
                    {readString(selectedBlock.config.completion_rule, 'ALL')}{' '}
                    completion
                  </p>
                ) : null}
              </div>
              {selectedBlock ? (
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClasses(
                    selectedBlock.status,
                  )}`}
                >
                  {titleCase(selectedBlock.status)}
                </span>
              ) : null}
            </div>
            <div className="px-5">
              {selectedBlock?.activities.length ? (
                selectedBlock.activities.map((activity) => (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    blockIsGated={selectedBlock.status === 'gated'}
                    note={activityNotes[activity.id] ?? ''}
                    onNoteChange={(value) =>
                      setActivityNotes((current) => ({
                        ...current,
                        [activity.id]: value,
                      }))
                    }
                    updating={updatingActivityId === activity.id}
                    onUpdate={(status) =>
                      void handleActivityUpdate(activity, status)
                    }
                  />
                ))
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  Select a workflow block to inspect its activities.
                </p>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="border-y border-slate-200 bg-white px-5 py-4 xl:rounded-lg xl:border">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CircleDot className="h-4 w-4 text-emerald-500" />
                Governance log
              </h2>
              <div className="mt-3 divide-y divide-slate-100">
                {detail.governanceLog.length ? (
                  detail.governanceLog.slice(0, 6).map((event) => (
                    <div
                      key={event.activityId}
                      className="flex items-start gap-3 py-3"
                    >
                      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">
                          {event.name}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {titleCase(event.owner)} ·{' '}
                          {formatDateTime(event.completedAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-5 text-xs leading-5 text-slate-500">
                    Completed activities will appear here.
                  </p>
                )}
              </div>
            </section>

            <section className="border-y border-slate-200 bg-white px-5 py-4 xl:rounded-lg xl:border">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Assignment
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div>
                  <dt className="text-slate-400">Manager</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {detail.manager || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Supplier</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {detail.supplier || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Cost center</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {detail.costCenter || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Location</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {detail.workOrder.location || '-'}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

function WorkerHeader({
  detail,
  activeType,
  onNavigate,
}: {
  detail: LifecycleDetail
  activeType: LifecycleType
  onNavigate: (type: LifecycleType) => void
}) {
  const targetDate =
    activeType === 'onboarding' ? detail.startDate : detail.endDate
  return (
    <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-cyan-600 bg-slate-950 text-sm font-bold text-cyan-300">
          {initials(detail.name)}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-slate-950">
            {detail.name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {detail.role || 'Role not assigned'} · {detail.supplier || 'Direct'} ·{' '}
            {detail.workOrderNumber}
          </p>
          <div className="mt-3 flex gap-5">
            {(['onboarding', 'offboarding'] as LifecycleType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onNavigate(type)}
                className={`border-b-2 pb-1 text-[10px] font-bold uppercase tracking-widest ${
                  activeType === type
                    ? 'border-cyan-600 text-cyan-700'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[120px_150px_minmax(280px,420px)]">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Gated readiness
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {detail.readiness}%
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            {activeType === 'onboarding' ? 'Activation' : 'Target exit'}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {formatDate(targetDate)}
          </p>
        </div>
        <div className="flex min-h-[72px] gap-3 rounded-lg bg-slate-950 px-4 py-3 text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-cyan-300">
              Orchestration pulse
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              {detail.orchestrationPulse}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}

function FeedbackBanner({ feedback }: { feedback: NonNullable<Feedback> }) {
  return (
    <div
      className={`mt-4 flex items-start gap-2 border-l-4 px-4 py-3 text-sm ${
        feedback.tone === 'success'
          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
          : 'border-rose-500 bg-rose-50 text-rose-800'
      }`}
    >
      {feedback.tone === 'success' ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {feedback.message}
    </div>
  )
}
