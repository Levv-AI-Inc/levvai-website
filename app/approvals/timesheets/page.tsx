'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

export default function TimesheetApprovalsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isDemoSubmitted = searchParams.get('demo') === 'submitted'

  const baseRows = [
    {
      worker: 'Sarah Lee',
      week: 'Aug 5 – Aug 9',
      hours: 38,
      status: 'Approved',
      signals: [],
    },
  ]

  const demoRow = {
    worker: 'John Smith',
    week: 'Aug 12 – Aug 16',
    hours: 46,
    status: 'Pending approval',
    signals: ['Overtime detected'],
  }

  const rows = isDemoSubmitted
    ? [demoRow, ...baseRows]
    : baseRows

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-lg font-semibold mb-4">
        Timesheet approvals
      </h1>

      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">Worker</th>
              <th className="px-4 py-3 text-left">Week</th>
              <th className="px-4 py-3 text-center">Hours</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Signals</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b last:border-0"
              >
                <td className="px-4 py-3 font-medium">
                  {row.worker}
                </td>
                <td className="px-4 py-3">{row.week}</td>
                <td className="px-4 py-3 text-center">
                  {row.hours}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      row.status === 'Pending approval'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.signals.length > 0 && (
                    <div className="flex items-center gap-1 text-red-600 text-xs">
                      <AlertTriangle className="h-4 w-4" />
                      {row.signals[0]}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.status === 'Pending approval' && (
                    <button
                      onClick={() =>
                        router.push(
                          '/approvals/timesheets/review'
                        )
                      }
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Review
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
