'use client'

import { useRouter } from 'next/navigation'

const onboardingRows = [
  {
    workerId: '123',
    name: 'John Smith',
    startDate: 'Sep 23, 2025',
    readiness: '86%',
    status: 'In Progress',
    blocker: 'Access pending',
  },
  {
    workerId: '124',
    name: 'Maria Gonzalez',
    startDate: 'Sep 25, 2025',
    readiness: '72%',
    status: 'Blocked',
    blocker: 'Screening incomplete',
  },
  {
    workerId: '125',
    name: 'David Chen',
    startDate: 'Oct 1, 2025',
    readiness: '100%',
    status: 'Ready',
    blocker: '—',
  },
]

export default function OnboardingOverviewPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-md border bg-white p-4">
        <h2 className="text-lg font-semibold">Onboarding</h2>
        <p className="text-sm text-gray-500">
          Track onboarding progress across active workers
        </p>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3">Start Date</th>
              <th className="px-4 py-3">Readiness</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Blocker</th>
            </tr>
          </thead>
          <tbody>
            {onboardingRows.map((row) => (
              <tr
                key={row.workerId}
                onClick={() =>
                  router.push(
                    `/workers/${row.workerId}/engagements/onboarding/workspace`
                  )
                }
                className="cursor-pointer border-t hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {row.name}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {row.startDate}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {row.readiness}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      row.status === 'Ready'
                        ? 'bg-green-100 text-green-700'
                        : row.status === 'Blocked'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {row.blocker}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
