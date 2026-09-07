'use client'

import { useEffect, useState } from 'react'

export type StoredPolicyStatus = {
  active: boolean
  fileName?: string
  policyName?: string
  summary?: string
  activatedAt?: string
  updatedAt: string
  analysis?: unknown
  history?: StoredPolicyHistoryItem[]
}

export type StoredPolicyHistoryItem = {
  id: string
  active: boolean
  status: 'active' | 'deactivated' | 'removed'
  fileName?: string
  policyName?: string
  summary?: string
  activatedAt?: string
  updatedAt: string
  removedAt?: string
  analysis?: unknown
}

const POLICY_STATUS_KEY = 'levv:nova-policy-status'
const POLICY_STATUS_EVENT = 'levv:nova-policy-status-changed'

const inactivePolicyStatus: StoredPolicyStatus = {
  active: false,
  updatedAt: '',
  history: [],
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function readPolicyStatus(): StoredPolicyStatus {
  if (!canUseStorage()) return inactivePolicyStatus

  try {
    const raw = window.localStorage.getItem(POLICY_STATUS_KEY)
    if (!raw) return inactivePolicyStatus

    const parsed = JSON.parse(raw) as Partial<StoredPolicyStatus>
    const history = Array.isArray(parsed.history)
      ? parsed.history
          .map(normalizeHistoryItem)
          .filter((item): item is StoredPolicyHistoryItem => Boolean(item))
      : []

    return {
      active: parsed.active === true,
      fileName: parsed.fileName,
      policyName: parsed.policyName,
      summary: parsed.summary,
      activatedAt: parsed.activatedAt,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      analysis: parsed.analysis,
      history,
    }
  } catch {
    return inactivePolicyStatus
  }
}

function notifyPolicyStatusChanged() {
  window.dispatchEvent(new Event(POLICY_STATUS_EVENT))
}

function createPolicyRecordId() {
  if (
    typeof window !== 'undefined' &&
    window.crypto &&
    typeof window.crypto.randomUUID === 'function'
  ) {
    return window.crypto.randomUUID()
  }

  return `policy-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function hasPolicyRecord(status: StoredPolicyStatus) {
  return Boolean(status.fileName || status.policyName || status.analysis)
}

function normalizeHistoryItem(value: unknown): StoredPolicyHistoryItem | null {
  if (!value || typeof value !== 'object') return null

  const item = value as Partial<StoredPolicyHistoryItem>
  const updatedAt =
    typeof item.updatedAt === 'string' && item.updatedAt
      ? item.updatedAt
      : typeof item.activatedAt === 'string'
        ? item.activatedAt
        : ''

  if (!item.fileName && !item.policyName && !item.analysis) return null

  const status =
    item.status === 'removed' || item.status === 'deactivated'
      ? item.status
      : item.active === true
        ? 'active'
        : 'deactivated'

  return {
    id: typeof item.id === 'string' && item.id ? item.id : createPolicyRecordId(),
    active: status === 'active',
    status,
    fileName: item.fileName,
    policyName: item.policyName,
    summary: item.summary,
    activatedAt: item.activatedAt,
    updatedAt,
    removedAt: item.removedAt,
    analysis: item.analysis,
  }
}

function currentStatusToHistoryItem(
  status: StoredPolicyStatus,
  fallbackStatus?: StoredPolicyHistoryItem['status'],
): StoredPolicyHistoryItem | null {
  if (!hasPolicyRecord(status)) return null

  const now = new Date().toISOString()
  const recordStatus =
    fallbackStatus ?? (status.active ? 'active' : 'deactivated')

  return {
    id: createPolicyRecordId(),
    active: recordStatus === 'active',
    status: recordStatus,
    fileName: status.fileName,
    policyName: status.policyName,
    summary: status.summary,
    activatedAt: status.activatedAt,
    updatedAt: recordStatus === 'removed' ? now : status.updatedAt,
    removedAt: recordStatus === 'removed' ? now : undefined,
    analysis: status.analysis,
  }
}

export function setUploadedPolicyStatus({
  fileName,
  analysis,
  active = true,
}: {
  fileName: string
  active?: boolean
  analysis?: {
    policyName?: string
    summary?: string
    activatedAt?: string
  } & Record<string, unknown>
}) {
  if (!canUseStorage()) return

  const now = new Date().toISOString()
  const current = readPolicyStatus()
  const previous = currentStatusToHistoryItem(current, 'deactivated')
  const history = previous
    ? [...(current.history ?? []), previous]
    : (current.history ?? [])
  const status: StoredPolicyStatus = {
    active,
    fileName,
    policyName: analysis?.policyName,
    summary: analysis?.summary,
    activatedAt: analysis?.activatedAt ?? now,
    updatedAt: now,
    analysis,
    history,
  }

  window.localStorage.setItem(POLICY_STATUS_KEY, JSON.stringify(status))
  notifyPolicyStatusChanged()
}

export function setPolicyStatusActive(active: boolean) {
  if (!canUseStorage()) return

  const current = readPolicyStatus()
  if (!current.fileName && !current.policyName && !current.analysis) return

  const status: StoredPolicyStatus = {
    ...current,
    active,
    updatedAt: new Date().toISOString(),
    history: current.history ?? [],
  }

  window.localStorage.setItem(POLICY_STATUS_KEY, JSON.stringify(status))
  notifyPolicyStatusChanged()
}

export function clearUploadedPolicyStatus() {
  if (!canUseStorage()) return

  const current = readPolicyStatus()
  const removed = currentStatusToHistoryItem(current, 'removed')
  const history = removed
    ? [...(current.history ?? []), removed]
    : (current.history ?? [])

  const status: StoredPolicyStatus = {
    active: false,
    updatedAt: '',
    history,
  }

  window.localStorage.setItem(POLICY_STATUS_KEY, JSON.stringify(status))
  notifyPolicyStatusChanged()
}

export function usePolicyStatus() {
  const [policyStatus, setPolicyStatus] = useState<StoredPolicyStatus>(
    inactivePolicyStatus,
  )

  useEffect(() => {
    const syncPolicyStatus = () => setPolicyStatus(readPolicyStatus())

    syncPolicyStatus()
    window.addEventListener('storage', syncPolicyStatus)
    window.addEventListener(POLICY_STATUS_EVENT, syncPolicyStatus)

    return () => {
      window.removeEventListener('storage', syncPolicyStatus)
      window.removeEventListener(POLICY_STATUS_EVENT, syncPolicyStatus)
    }
  }, [])

  return policyStatus
}
