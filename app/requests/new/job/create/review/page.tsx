'use client'

export default function CWReviewPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* =====================
          Submitted Banner
         ===================== */}
      <div className="rounded-lg border border-green-200 bg-green-50 px-6 py-4">
        <h2 className="text-sm font-semibold text-green-800">
          Job request submitted
        </h2>
        <p className="text-sm text-green-700 mt-1">
          Your job posting has been submitted and is pending approval.
        </p>
      </div>

      {/* =====================
          Read-only Summary
         ===================== */}
      {/* <div className="rounded-lg border bg-white px-6 py-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Job posting summary
        </h3>

        <div className="grid grid-cols-2 gap-y-4 text-sm">
          <div>
            <p className="text-gray-500">Role</p>
            <p className="text-gray-900">Senior Software Engineer</p>
          </div>

          <div>
            <p className="text-gray-500">Location</p>
            <p className="text-gray-900">Remote</p>
          </div>

          <div>
            <p className="text-gray-500">Start date</p>
            <p className="text-gray-900">Jan 15, 2026</p>
          </div>

          <div>
            <p className="text-gray-500">End date</p>
            <p className="text-gray-900">Jul 15, 2026</p>
          </div>

          <div>
            <p className="text-gray-500">Positions</p>
            <p className="text-gray-900">1</p>
          </div>

          <div>
            <p className="text-gray-500">Bill rate</p>
            <p className="text-gray-900">$120 / hr</p>
          </div>
        </div>
      </div>

      {/* =====================
          Approval Routing
         ===================== */}
      <div className="rounded-lg border bg-white px-6 py-5">
        <h3 className="text-base font-semibold text-gray-900 mb-6">
          Approval routing
        </h3>

        <div className="flex items-center justify-between">
          <ApprovalNode
            name="Amy Jackson"
            role="Supervisor"
            status="approved"
          />
          <Line />
          <ApprovalNode
            name="Christopher Chang"
            role="CC Owner"
            status="pending"
          />
          <Line />
          <ApprovalNode
            name="Harjot Kaur"
            role="InfoSec"
            status="upcoming"
          />
        </div>
      </div>
    </div>
  )
}

/* =====================
   Inline Components
   ===================== */

function ApprovalNode({
  name,
  role,
  status,
}: {
  name: string
  role: string
  status: 'approved' | 'pending' | 'upcoming'
}) {
  const styles = {
    approved: 'bg-green-500 text-white',
    pending: 'border-2 border-orange-400 text-orange-600',
    upcoming: 'border border-gray-300 text-gray-400',
  }

  return (
    <div className="flex flex-col items-center text-center w-40">
      <div
        className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${styles[status]}`}
      >
        {status === 'approved' ? '✓' : ''}
      </div>
      <p className="mt-2 text-sm font-medium text-gray-900">{name}</p>
      <p className="text-xs text-gray-500">{role}</p>
    </div>
  )
}

function Line() {
  return <div className="flex-1 h-px bg-gray-200 mx-4" />
}
