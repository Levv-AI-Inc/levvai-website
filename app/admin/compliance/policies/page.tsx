'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, FileText } from 'lucide-react'
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

function getStatusMeta(row: PolicyTableRow) {
  if (row.status === 'removed') {
    return {
      label: 'REMOVED',
      className: 'bg-rose-50 text-rose-700',
    }
  }

  if (row.active) {
    return {
      label: 'ACTIVE',
      className: 'bg-emerald-100 text-emerald-700',
    }
  }

  return {
    label: 'DEACTIVATED',
    className: 'bg-slate-100 text-slate-600',
  }
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

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Compliance Policies
          </h1>
          <p className="text-sm text-slate-500">
            Upload and manage external workforce policy enforcement.
          </p>
        </div>
      </div>

      <PolicyUploadPanel masterData={policyMasterData} />

      {policyRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#1f3d38] text-[#89d3bd]">
            <FileText className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">
            No policy uploaded
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Use the uploader above to add a policy for compliance enforcement.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3">Policy Name</th>
                  <th className="px-4 py-3">Source File</th>
                  <th className="px-4 py-3">Rules</th>
                  <th className="px-4 py-3">Gaps</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setUpdatedAtSortDirection((direction) =>
                          direction === 'desc' ? 'asc' : 'desc',
                        )
                      }
                      className="inline-flex items-center gap-1.5 font-medium text-slate-600 transition hover:text-slate-900"
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
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {getPolicyName(row)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.fileName || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {getRuleCount(row)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {getGapCount(row)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(row.updatedAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
