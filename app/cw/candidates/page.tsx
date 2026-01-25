"use client"

const candidates = [
  {
    name: "James Carter",
    role: "Senior Backend Engineer",
    jobId: "JP-2024-041",
    supplier: "TEKsystems",
    location: "Remote – US",
    rate: "$108/hr",
    availability: "2 weeks",
    stage: "Interview",
    daysInStage: 6,
    manager: "Alex Morgan",
    status: "Active",
  },
  {
    name: "Priya Shah",
    role: "Business Analyst",
    jobId: "JP-2024-036",
    supplier: "Randstad",
    location: "Chicago, IL",
    rate: "$88/hr",
    availability: "Immediate",
    stage: "Submitted",
    daysInStage: 3,
    manager: "Rachel Adams",
    status: "Active",
  },
  {
    name: "Daniel Wong",
    role: "QA Automation Engineer",
    jobId: "JP-2024-028",
    supplier: "Insight Global",
    location: "New York, NY",
    rate: "$80/hr",
    availability: "1 week",
    stage: "Offer",
    daysInStage: 4,
    manager: "Daniel Lee",
    status: "Pending Decision",
  },
]

export default function CandidatesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Candidates
        </h1>
        <p className="text-sm text-gray-500">
          Candidate pipeline 
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Proposed Rate</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Days in Stage</th>
                <th className="px-4 py-3">Hiring Manager</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {candidates.map((c) => (
                <tr
                  key={`${c.name}-${c.jobId}`}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {c.name}
                  </td>
                  <td className="px-4 py-3">{c.role}</td>
                  <td className="px-4 py-3">{c.jobId}</td>
                  <td className="px-4 py-3">{c.supplier}</td>
                  <td className="px-4 py-3">{c.location}</td>
                  <td className="px-4 py-3">{c.rate}</td>
                  <td className="px-4 py-3">{c.availability}</td>

                  {/* Stage */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.stage === "Interview"
                          ? "bg-blue-100 text-blue-700"
                          : c.stage === "Offer"
                          ? "bg-cyan-100 text-cyan-700"
                          : c.stage === "Submitted"
                          ? "bg-gray-200 text-gray-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {c.stage}
                    </span>
                  </td>

                  {/* Days in Stage */}
                  <td className="px-4 py-3">
                    <span
                      className={`font-medium ${
                        c.daysInStage > 7
                          ? "text-red-600"
                          : c.daysInStage > 4
                          ? "text-yellow-600"
                          : "text-gray-700"
                      }`}
                    >
                      {c.daysInStage}
                    </span>
                  </td>

                  <td className="px-4 py-3">{c.manager}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right rounded-r-lg">
                    <button className="text-gray-400 hover:text-gray-600">
                      ⋯
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
