'use client'

import type { IntakeRecord } from '@/lib/api/intake'
import type { CWRequest } from '../app/requests/new/job/context/CWRequestContext'

export const CURRENT_FINANCIALS_BASE_RATE_VERSION = 2

function parseNumber(value: string | undefined) {
  if (!value?.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function hasValue(value: unknown) {
  if (typeof value === 'string') return value.trim().length > 0
  return value !== null && value !== undefined
}

export function buildCWRequestFromIntake(intake: IntakeRecord): CWRequest {
  const targetRate = parseNumber(intake.baseRate || intake.targetRate)
  const budgetAmount = parseNumber(intake.budgetAmount)
  const overtimeFactor = parseNumber(intake.overtimeMultiplier)
  const legalEntityId =
    intake.legalEntity !== null && intake.legalEntity !== undefined
      ? String(intake.legalEntity)
      : undefined
  const supplierId =
    typeof intake.supplier === 'number' ? intake.supplier : undefined

  return {
    intakeId: intake.id,
    roleId: intake.roleDefinition,
    role: intake.roleDefinitionName || intake.title || undefined,
    description: intake.description || undefined,
    country: intake.country || undefined,
    stateProvince: intake.stateProvince || undefined,
    region: intake.stateProvince || undefined,
    city: intake.city || undefined,
    startDate: intake.startDate || undefined,
    endDate: intake.endDate || undefined,
    positions: intake.workerCount,
    enteredRate: targetRate,
    targetRate,
    rateMode: 'fixed',
    overtimeEnabled: intake.overtimeEnabled === true,
    overtimeFactor,
    selectedRateCardId: intake.rateCard,
    financialsSeedRateCardId: intake.rateCard,
    financialsBaseRateVersion:
      intake.rateCard && targetRate !== undefined
        ? CURRENT_FINANCIALS_BASE_RATE_VERSION
        : undefined,
    qualificationsEnabled: intake.qualificationsEnabled,
    qualifications: intake.qualifications || [],
    budgetAmount,
    rateUnit: intake.rateUnit || undefined,
    currency: intake.currency || undefined,
    costCenter:
      intake.costCenterName ||
      (intake.costCenter !== undefined ? String(intake.costCenter) : undefined),
    costCenterId: intake.costCenter,
    siteId: intake.site,
    legalEntityId,
    supplierId,
    suppliers:
      supplierId !== undefined ? [String(supplierId)] : undefined,
    customFields: intake.customFields || {},
    stRate: targetRate,
  }
}

export function getResumePathForDraft(intake: IntakeRecord) {
  const hasDefineState = Boolean(
    intake.roleDefinition || (intake.title && intake.title.trim()),
  )
  if (!hasDefineState) {
    return '/requests/new/job/create/define'
  }

  if (hasValue(intake.supplier)) {
    return '/requests/new/job/create/suppliers'
  }

  if (
    hasValue(intake.targetRate) ||
    hasValue(intake.rateCard) ||
    hasValue(intake.budgetAmount) ||
    hasValue(intake.currency)
  ) {
    return '/requests/new/job/create/financials'
  }

  if (intake.qualificationsEnabled === true) {
    return '/requests/new/job/create/qualifications/setup'
  }

  if (intake.qualificationsEnabled === false) {
    return '/requests/new/job/create/financials'
  }

  if ((intake.qualifications || []).length > 0) {
    return '/requests/new/job/create/qualifications/setup'
  }

  return '/requests/new/job/create/qualifications'
}
