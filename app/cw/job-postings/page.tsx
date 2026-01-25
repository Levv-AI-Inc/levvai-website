"use client"

const jobPostings = [
  {
    id: "JP-2024-041",
    role: "Senior Backend Engineer",
    manager: "Alex Morgan",
    workerType: "Contingent",
    location: "Remote – US",
    supplier: "TEKsystems",
    rate: "$105/hr",
    openings: 2,
    candidates: 3,
    aging: 18,
    status: "Open",
    priority: "High",
  },
  {
    id: "JP-2024-036",
    role: "Business Analyst",
    manager: "Rachel Adams",
    workerType: "Contract",
    location: "Chicago, IL",
    supplier: "Randstad",
    rate: "$85/hr",
    openings: 1,
    candidates: 6,
    aging: 9,
    status: "Open",
    priority: "Normal",
  },
  {
    id: "JP-2024-028",
    role: "QA Automation Engineer",
    manager: "Daniel Lee",
    workerType: "Temp",
    location: "New York, NY",
    supplier: "Insight Global",
    rate: "$78/hr",
    openings: 1,
    candidates: 11,
    aging: 27,
    status: "Escalated",
    priority: "High",
  },
]

export default function ContingentJobPostingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Contingent Job Postings
        </h1>
        <p className="text-sm text-gray-500">
           Contingent requisitions
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Hiring Manager</th>
                <th className="px-4 py-3">Worker Type</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Bill Rate</th>
                <th className="px-4 py-3">Openings</th>
                <th className="px-4 py-3">Candidates</th>
                <th className="px-4 py-3">Days Open</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {jobPostings.map((job) => (
                <tr
                  key={job.id}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {job.id}
                  </td>
                  <td className="px-4 py-3">{job.role}</td>
                  <td className="px-4 py-3">{job.manager}</td>
                  <td className="px-4 py-3">{job.workerType}</td>
                  <td className="px-4 py-3">{job.location}</td>
                  <td className="px-4 py-3">{job.supplier}</td>
                  <td className="px-4 py-3">{job.rate}</td>
                  <td className="px-4 py-3">{job.openings}</td>
                  <td className="px-4 py-3">{job.candidates}</td>
                  <td className="px-4 py-3">{job.aging}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.status === "Open"
                          ? "bg-green-100 text-green-700"
                          : job.status === "Escalated"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.priority === "High"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {job.priority}
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
