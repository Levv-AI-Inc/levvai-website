'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  LevvPage,
  LevvRecordHeader,
  LevvStatusBadge,
  levvUi,
  type LevvTone,
} from '@/components/ui/levv-app'
import {
  usePolicyStatus,
  type StoredPolicyHistoryItem,
} from '../../../../lib/policyStatus'
import { getBusinessUnits } from '@/lib/api/businessUnits'
import { getCostCenters } from '@/lib/api/costCenters'
import { getLegalEntities } from '@/lib/api/legalEntities'
import { getLocations } from '@/lib/api/locations'
import { getSites } from '@/lib/api/sites'
import PolicyUploadPanel, {
  type PolicyMasterData,
} from './components/PolicyUploadPanel'
import { TABS } from '../../company/types'

type PolicyRule = {
  id?: string
}

type PolicyGap = {
  id?: string
  severity?: 'low' | 'medium' | 'high'
  title?: string
  description?: string
  recommendation?: string
}

type UploadedPolicyAnalysis = {
  policyName?: string
  summary?: string
  activatedAt?: string
  counts?: {
    totalRules?: number
    rateClassification?: number
    tenureDuration?: number
    supplierEligibility?: number
    approvalException?: number
  }
  rules?: PolicyRule[]
  gaps?: PolicyGap[]
  intakeImpacts?: string[]
  configChanges?: string[]
}

type PolicyTableRow = {
  id: string
  active: boolean
  status: StoredPolicyHistoryItem['status']
  fileName?: string
  policyName?: string
  updatedAt: string
  analysis?: unknown
}

type UpdatedAtSortDirection = 'desc' | 'asc'

function isUploadedPolicyAnalysis(
  value: unknown,
): value is UploadedPolicyAnalysis {
  return Boolean(value && typeof value === 'object')
}

function formatDate(value?: string) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function emptyPolicyMasterData(): PolicyMasterData {
  return TABS.reduce(
    (data, tab) => ({ ...data, [tab]: [] }),
    {} as PolicyMasterData,
  )
}

function buildCurrentPolicyRow(
  policyStatus: ReturnType<typeof usePolicyStatus>,
): PolicyTableRow | null {
  if (
    !policyStatus.fileName &&
    !policyStatus.policyName &&
    !policyStatus.analysis
  ) {
    return null
  }

  return {
    id: 'current-policy',
    active: policyStatus.active,
    status: policyStatus.active ? 'active' : 'deactivated',
    fileName: policyStatus.fileName,
    policyName: policyStatus.policyName,
    updatedAt: policyStatus.updatedAt,
    analysis: policyStatus.analysis,
  }
}

function getPolicyName(row: PolicyTableRow) {
  const rowAnalysis = isUploadedPolicyAnalysis(row.analysis)
    ? row.analysis
    : null

  return (
    rowAnalysis?.policyName ||
    row.policyName ||
    row.fileName ||
    'Uploaded policy'
  )
}

function getRuleCount(row: PolicyTableRow) {
  const rowAnalysis = isUploadedPolicyAnalysis(row.analysis)
    ? row.analysis
    : null

  return rowAnalysis?.counts?.totalRules ?? rowAnalysis?.rules?.length ?? 0
}

function getGapCount(row: PolicyTableRow) {
  const rowAnalysis = isUploadedPolicyAnalysis(row.analysis)
    ? row.analysis
    : null

  return rowAnalysis?.gaps?.length ?? 0
}

function getStatusMeta(row: PolicyTableRow): { label: string; tone: LevvTone } {
  if (row.status === 'removed') {
    return { label: 'REMOVED', tone: 'slate' }
  }

  if (row.active) {
    return { label: 'ACTIVE', tone: 'emerald' }
  }

  return { label: 'DEACTIVATED', tone: 'slate' }
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

/** What the policy record says today, in one sentence: the policy in force, if any, and what Nova does with it. */
function policyStatement(current: PolicyTableRow | null, earlier: number) {
  if (!current) {
    return earlier === 0
      ? 'No policy is uploaded, so Nova advises without blocking.'
      : `No policy is uploaded, so Nova advises without blocking; ${plural(earlier, 'earlier upload')} ${earlier === 1 ? 'is' : 'are'} listed below.`
  }

  const name = getPolicyName(current)
  return current.active
    ? `${name} is active: Nova applies its ${plural(getRuleCount(current), 'rule')} across intake and approval workflows, and its analysis found ${plural(getGapCount(current), 'configuration gap')}.`
    : `${name} is uploaded but deactivated, so Nova advises without blocking.`
}

function getUpdatedAtTime(row: PolicyTableRow) {
  if (!row.updatedAt) return 0

  const time = new Date(row.updatedAt).getTime()
  return Number.isNaN(time) ? 0 : time
}

async function loadPolicyMasterData(): Promise<PolicyMasterData> {
  const [
    businessUnitsResult,
    costCentersResult,
    locationsResult,
    sitesResult,
    legalEntitiesResult,
  ] = await Promise.allSettled([
    getBusinessUnits(),
    getCostCenters(),
    getLocations(),
    getSites(),
    getLegalEntities(),
  ])

  return {
    'Business Units':
      businessUnitsResult.status === 'fulfilled' ? businessUnitsResult.value : [],
    'Cost Centers':
      costCentersResult.status === 'fulfilled' ? costCentersResult.value : [],
    Locations:
      locationsResult.status === 'fulfilled' ? locationsResult.value : [],
    Worksites: sitesResult.status === 'fulfilled' ? sitesResult.value : [],
    'Legal Entities':
      legalEntitiesResult.status === 'fulfilled' ? legalEntitiesResult.value : [],
    Subsidiaries: [],
  }
}

export default function CompliancePoliciesPage() {
  const policyStatus = usePolicyStatus()
  // The policy record lives in this browser; the header waits for the first read rather than claiming "none".
  const [ready, setReady] = useState(false)
  const [updatedAtSortDirection, setUpdatedAtSortDirection] =
    useState<UpdatedAtSortDirection>('desc')
  const [policyMasterData, setPolicyMasterData] = useState<PolicyMasterData>(
    () => emptyPolicyMasterData(),
  )
  const currentPolicyRow = buildCurrentPolicyRow(policyStatus)
  const policyRows = [
    ...(currentPolicyRow ? [currentPolicyRow] : []),
    ...(policyStatus.history ?? []),
  ]
  const sortedPolicyRows = [...policyRows].sort((left, right) => {
    const directionMultiplier = updatedAtSortDirection === 'desc' ? -1 : 1
    const timeDifference = getUpdatedAtTime(left) - getUpdatedAtTime(right)

    if (timeDifference !== 0) return timeDifference * directionMultiplier

    return getPolicyName(left).localeCompare(getPolicyName(right))
  })

  useEffect(() => setReady(true), [])

  useEffect(() => {
    let cancelled = false

    loadPolicyMasterData()
      .then((masterData) => {
        if (!cancelled) setPolicyMasterData(masterData)
      })
      .catch(() => {
        if (!cancelled) setPolicyMasterData(emptyPolicyMasterData())
      })

    return () => {
      cancelled = true
    }
  }, [])

  const earlier = policyStatus.history?.length ?? 0

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Compliance Policies"
          title="Compliance Policies"
          statement={ready ? policyStatement(currentPolicyRow, earlier) : 'Loading compliance policies…'}
          figures={
            ready && currentPolicyRow
              ? [
                  { label: 'Rules', value: getRuleCount(currentPolicyRow) },
                  { label: 'Gaps', value: getGapCount(currentPolicyRow) },
                  { label: 'Uploads', value: policyRows.length },
                ]
              : []
          }
        />

        <PolicyUploadPanel masterData={policyMasterData} />

        {policyRows.length === 0 ? null : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={levvUi.th}>Policy Name</th>
                  <th className={levvUi.th}>Source File</th>
                  <th className={`${levvUi.th} w-20`}>Rules</th>
                  <th className={`${levvUi.th} w-20`}>Gaps</th>
                  <th className={`${levvUi.th} w-36`}>Status</th>
                  <th className={`${levvUi.th} w-40`}>
                    <button
                      type="button"
                      onClick={() =>
                        setUpdatedAtSortDirection((direction) =>
                          direction === 'desc' ? 'asc' : 'desc',
                        )
                      }
                      className={`inline-flex items-center gap-1.5 ${levvUi.legend} text-slate-500 outline-none transition-colors hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
                      aria-label={`Sort by last updated ${
                        updatedAtSortDirection === 'desc'
                          ? 'oldest first'
                          : 'newest first'
                      }`}
                    >
                      <span>Last Updated</span>
                      {updatedAtSortDirection === 'desc' ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedPolicyRows.map((row) => {
                  const statusMeta = getStatusMeta(row)

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-[var(--surface)] [&>td]:border-b [&>td]:border-[var(--line)]"
                    >
                      <td className={`${levvUi.td} font-medium text-slate-950`}>
                        {getPolicyName(row)}
                      </td>
                      <td className={`${levvUi.td} text-slate-600`}>
                        {row.fileName || '-'}
                      </td>
                      <td className={`${levvUi.td} font-semibold tabular-nums text-slate-950`}>
                        {getRuleCount(row)}
                      </td>
                      <td className={`${levvUi.td} font-semibold tabular-nums text-slate-950`}>
                        {getGapCount(row)}
                      </td>
                      <td className={levvUi.td}>
                        <LevvStatusBadge tone={statusMeta.tone}>
                          {statusMeta.label}
                        </LevvStatusBadge>
                      </td>
                      <td className={`${levvUi.td} tabular-nums text-slate-600`}>
                        {formatDate(row.updatedAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LevvPage>
  )
}
