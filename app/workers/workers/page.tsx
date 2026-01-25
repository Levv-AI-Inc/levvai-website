"use client"

const workers = [
  {
    cwsId: "CWS-000231",
    hrSystemId: "WD-784512",
    name: "James Carter",
    workerType: "Contingent",
    supplier: "TEKsystems",
    role: "Senior Backend Engineer",
    owner: "Alex Morgan",
    status: "Active",
    start: "Jan 15, 2024",
    end: "Dec 31, 2024",
    location: "Remote – US",
    compliance: "Compliant",
  },
  {
    cwsId: "CWS-000198",
    hrSystemId: "WD-772903",
    name: "Priya Shah",
    workerType: "Contingent",
    supplier: "Randstad",
    role: "Business Analyst",
    owner: "Rachel Adams",
    status: "Onboarding",
    start: "Apr 22, 2024",
    end: "Oct 31, 2024",
    location: "Toronto, ON",
    compliance: "Review Required",
  },
  {
    cwsId: "CWS-000164",
    hrSystemId: "WD-761442",
    name: "Daniel Wong",
    workerType: "SOW",
    supplier: "Insight Global",
    role: "QA Automation Engineer",
    owner: "Daniel Lee",
    status: "Offboarded",
    start: "Jul 01, 2023",
    end: "Mar 31, 2024",
    location: "New York, NY",
    compliance: "Compliant",
  },
]

export default function WorkersIndexPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Workers</h1>
        <p className="text-sm text-gray-500">
          Worker records
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">CWS ID</th>
                <th className="px-4 py-3">HR System ID</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Compliance</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {workers.map((w) => (
                <tr
                  key={w.cwsId}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {w.cwsId}
                  </td>
                  <td className="px-4 py-3">{w.hrSystemId}</td>
                  <td className="px-4 py-3">{w.name}</td>
                  <td className="px-4 py-3">{w.workerType}</td>
                  <td className="px-4 py-3">{w.supplier}</td>
                  <td className="px-4 py-3">{w.role}</td>
                  <td className="px-4 py-3">{w.owner}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        w.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : w.status === "Onboarding"
                          ? "bg-yellow-100 text-yellow-700"
                          : w.status === "Offboarding"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {w.status}
                    </span>
                  </td>

                  <td className="px-4 py-3">{w.start}</td>
                  <td className="px-4 py-3">{w.end}</td>
                  <td className="px-4 py-3">{w.location}</td>

                  {/* Compliance */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        w.compliance === "Compliant"
                          ? "bg-green-100 text-green-700"
                          : w.compliance === "Review Required"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {w.compliance}
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
