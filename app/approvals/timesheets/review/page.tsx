'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

export default function ReviewTimesheetPage() {
  const router = useRouter()

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-lg font-semibold mb-4">
        Review timesheet
      </h1>

      {/* Summary */}
      <div className="rounded-lg border bg-white p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Info label="Worker" value="John Smith" />
          <Info label="Week" value="Aug 12 – Aug 16" />
          <Info label="Assignment" value="WO-88321" />
          <Info label="Total hours" value="46" />
        </div>
      </div>

      {/* Signal */}
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Overtime detected — approval required
      </div>

      {/* Timesheet grid */}
      <div className="rounded-lg border bg-white mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">Task</th>
              <th className="px-4 py-3 text-center">Mon</th>
              <th className="px-4 py-3 text-center">Tue</th>
              <th className="px-4 py-3 text-center">Wed</th>
              <th className="px-4 py-3 text-center">Thu</th>
              <th className="px-4 py-3 text-center">Fri</th>
              <th className="px-4 py-3 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            <Row task="Client workshops" hours={[8, 8, 8, 8, 6]} />
            <Row task="Design & documentation" hours={[2, 2, 2, 4, 6]} />
          </tbody>
        </table>
      </div>

      {/* Worker comment */}
      <div className="rounded-lg border bg-white p-4 mb-6">
        <div className="text-sm font-medium mb-1">
          Worker comment
        </div>
        <div className="text-sm text-gray-600">
          Stayed late Thursday to support client escalation.
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.push('/approvals/timesheets')}
          className="rounded-md border px-4 py-2 text-sm"
        >
          Reject
        </button>
        <button
          onClick={() => router.push('/approvals/timesheets')}
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          Approve
        </button>
      </div>
    </div>
  )
}

/* =========================
   HELPERS
========================= */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

function Row({
  task,
  hours,
}: {
  task: string
  hours: number[]
}) {
  const total = hours.reduce((a, b) => a + b, 0)
  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 font-medium">{task}</td>
      {hours.map((h, i) => (
        <td key={i} className="px-4 py-3 text-center">
          {h}
        </td>
      ))}
      <td className="px-4 py-3 text-center font-semibold">
        {total}
      </td>
    </tr>
  )
}
