'use client'

import { useRouter } from 'next/navigation'
import { CompliancePolicy } from './types'

const MOCK_POLICIES: CompliancePolicy[] = [
  {
    id: 'policy-us-it-v1',
    name: 'US IT Contractors',
    version: 'v1.0',
    status: 'ACTIVE',
    scope: {
      regions: ['United States'],
      workerTypes: ['Contingent'],
      roles: ['IT Developer'],
    },
    blocks: [],
    createdAt: '2025-01-10',
    updatedAt: '2025-01-12',
  },
  {
    id: 'policy-us-sow-v1',
    name: 'US SOW – Professional Services',
    version: 'v1.0',
    status: 'DRAFT',
    scope: {
      regions: ['United States'],
      workerTypes: ['SOW'],
    },
    blocks: [],
    createdAt: '2025-01-15',
    updatedAt: '2025-01-15',
  },
]

export default function CompliancePoliciesPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Compliance Policies
          </h1>
          <p className="text-sm text-slate-500">
            Blueprints that define onboarding and offboarding requirements
          </p>
        </div>

        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => router.push('/admin/compliance/policies/new')}
        >
          Create Policy
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-4 py-3">Policy Name</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>

          <tbody>
            {MOCK_POLICIES.map((policy) => (
              <tr
                key={policy.id}
                className="border-b border-slate-100 last:border-b-0"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {policy.name}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {policy.version}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {[
                    ...(policy.scope.regions || []),
                    ...(policy.scope.roles || []),
                    ...(policy.scope.workerTypes || []),
                  ].join(' · ') || '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      policy.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {policy.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {policy.updatedAt}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="text-sm font-medium text-slate-900 hover:underline"
                    onClick={() =>
                      router.push(
                        `/admin/compliance/policies/${policy.id}`
                      )
                    }
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
