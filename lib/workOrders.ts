'use client'

import type {
  IntakeRecord,
  SelectedCandidateRecord,
} from '@/lib/api/intake'

const PENDING_WORK_ORDER_CANDIDATES_STORAGE_KEY =
  'cw_pending_work_order_candidates'

export type PendingWorkOrderCandidate = {
  intakeId: number
  requestId?: string
  candidateId?: number
  workerName: string
  email?: string
  phone?: string
  notes?: string
  resumeUrl?: string
  startDate?: string
  endDate?: string
  billRate?: string
  payRate?: string
  currency?: string
  supplierName?: string
  roleName?: string
  workLocation?: string
  updatedAt: string
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function parseStoredArray<T>(value: string | null): T[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function readStoredPendingCandidates(): PendingWorkOrderCandidate[] {
  if (!canUseStorage()) return []
  return parseStoredArray<PendingWorkOrderCandidate>(
    window.localStorage.getItem(
      PENDING_WORK_ORDER_CANDIDATES_STORAGE_KEY,
    ),
  )
}

function writeStoredPendingCandidates(value: PendingWorkOrderCandidate[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(
    PENDING_WORK_ORDER_CANDIDATES_STORAGE_KEY,
    JSON.stringify(value),
  )
}

export function savePendingWorkOrderCandidate(
  candidate: PendingWorkOrderCandidate,
) {
  const current = readStoredPendingCandidates().filter(
    (entry) => entry.intakeId !== candidate.intakeId,
  )
  current.push(candidate)
  writeStoredPendingCandidates(current)
}

export function getPendingWorkOrderCandidate(intakeId: number) {
  return (
    readStoredPendingCandidates().find(
      (candidate) => candidate.intakeId === intakeId,
    ) || null
  )
}

export function clearPendingWorkOrderCandidate(intakeId: number) {
  const current = readStoredPendingCandidates().filter(
    (candidate) => candidate.intakeId !== intakeId,
  )
  writeStoredPendingCandidates(current)
}

export function buildPendingWorkOrderCandidateFromSelection(args: {
  intake: IntakeRecord
  selectedCandidate: SelectedCandidateRecord
  supplierName?: string
  roleName?: string
  workLocation?: string
  payRate?: string
}) {
  const {
    intake,
    selectedCandidate,
    supplierName,
    roleName,
    workLocation,
    payRate,
  } = args

  return {
    intakeId: intake.id,
    requestId: intake.requestId,
    candidateId:
      selectedCandidate.id || selectedCandidate.supplierSubmissionId,
    workerName: selectedCandidate.fullName || 'Unnamed candidate',
    email: selectedCandidate.email,
    phone: selectedCandidate.phone,
    notes: selectedCandidate.notes,
    resumeUrl: selectedCandidate.resumeUrl,
    startDate:
      selectedCandidate.availableStartDate || intake.startDate,
    endDate: intake.endDate,
    billRate:
      intake.billRate ||
      intake.rateCardPricing?.billRate ||
      intake.targetRate,
    payRate:
      payRate?.trim() ||
      selectedCandidate.proposedRate ||
      intake.payRate ||
      intake.baseRate ||
      intake.targetRate,
    currency: selectedCandidate.currency || intake.currency,
    supplierName: supplierName || intake.supplierName,
    roleName: roleName || intake.roleDefinitionName || intake.title,
    workLocation:
      workLocation ||
      intake.workLocationLabel ||
      [intake.city, intake.stateProvince, intake.country]
        .filter(Boolean)
        .join(', ') ||
      undefined,
    updatedAt: new Date().toISOString(),
  }
}
