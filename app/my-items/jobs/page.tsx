"use client"

const jobData = [
  {
    id: "JP-2024-031",
    role: "Senior React Developer",
    workerType: "Contingent",
    location: "New York – HQ",
    supplier: "TEKsystems",
    rate: "$95/hr",
    openings: 2,
    candidates: 6,
    status: "Open",
    urgency: "High",
    posted: "3 days ago",
  },
  {
    id: "JP-2024-027",
    role: "Data Engineer",
    workerType: "Contract",
    location: "Toronto, ON",
    supplier: "Randstad",
    rate: "$110/hr",
    openings: 1,
    candidates: 4,
    status: "Open",
    urgency: "Normal",
    posted: "1 week ago",
  },
  {
    id: "JP-2024-019",
    role: "QA Automation Analyst",
    workerType: "Temp",
    location: "New York-One Manhattan",
    supplier: "Insight Global",
    rate: "$75/hr",
    openings: 1,
    candidates: 9,
    status: "Filled",
    urgency: "Normal",
    posted: "2 weeks ago",
  },
]

export default function MyJobPostingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          My Job Postings
        </h1>
        <p className="text-sm text-gray-500">
          Your Job requisitions 
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
                <th className="px-4 py-3">Worker Type</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Bill Rate</th>
                <th className="px-4 py-3">Openings</th>
                <th className="px-4 py-3">Candidates</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Urgency</th>
                <th className="px-4 py-3">Posted</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {jobData.map((job) => (
                <tr
                  key={job.id}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {job.id}
                  </td>
                  <td className="px-4 py-3">{job.role}</td>
                  <td className="px-4 py-3">{job.workerType}</td>
                  <td className="px-4 py-3">{job.location}</td>
                  <td className="px-4 py-3">{job.supplier}</td>
                  <td className="px-4 py-3">{job.rate}</td>
                  <td className="px-4 py-3">{job.openings}</td>
                  <td className="px-4 py-3">{job.candidates}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.status === "Open"
                          ? "bg-green-100 text-green-700"
                          : job.status === "Filled"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>

                  {/* Urgency */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.urgency === "High"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {job.urgency}
                    </span>
                  </td>

                  <td className="px-4 py-3">{job.posted}</td>

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
