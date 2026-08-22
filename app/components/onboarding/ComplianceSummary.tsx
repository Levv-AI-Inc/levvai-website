'use client'

function ComplianceSummary() {
  return (
    <div className="rounded-md border bg-white p-4 space-y-4">
      <div>
        <p className="text-sm text-gray-500">Internal Policy Alignment</p>
        <p className="text-base font-medium text-gray-900">Partial</p>
      </div>

      <div>
        <p className="text-sm text-gray-500">Classification Risk</p>
        <p className="text-base font-medium text-yellow-700">Medium</p>
      </div>

      <div>
        <p className="text-sm text-gray-500">Explanation</p>
        <p className="text-sm text-gray-700">
          Onsite contingent engagement in NY exceeding 120 days requires enhanced
          classification review per internal policy.
        </p>
      </div>
    </div>
  )
}

export default ComplianceSummary
