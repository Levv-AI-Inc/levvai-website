"use client"

const timesheets = [
  {
    id: "TS-2024-089",
    worker: "James Carter",
    role: "Senior Backend Engineer",
    supplier: "TEKsystems",
    period: "Apr 1 – Apr 7, 2024",
    hours: 40,
    rate: "$105/hr",
    total: "$4,200",
    submitted: "Apr 8, 2024",
    approval: "Pending",
    payroll: "Not Processed",
  },
  {
    id: "TS-2024-083",
    worker: "Priya Shah",
    role: "Business Analyst",
    supplier: "Randstad",
    period: "Apr 1 – Apr 7, 2024",
    hours: 38,
    rate: "$88/hr",
    total: "$3,344",
    submitted: "Apr 7, 2024",
    approval: "Approved",
    payroll: "Processed",
  },
  {
    id: "TS-2024-074",
    worker: "Daniel Wong",
    role: "QA Automation Engineer",
    supplier: "Insight Global",
    period: "Mar 25 – Mar 31, 2024",
    hours: 42,
    rate: "$80/hr",
    total: "$3,360",
    submitted: "Apr 1, 2024",
    approval: "Rejected",
    payroll: "On Hold",
  },
]

export default function TimesheetsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Timesheets
        </h1>
        <p className="text-sm text-gray-500">
          Timesheet records
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">Timesheet ID</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Bill Rate</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3">Payroll</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {timesheets.map((ts) => (
                <tr
                  key={ts.id}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {ts.id}
                  </td>
                  <td className="px-4 py-3">{ts.worker}</td>
                  <td className="px-4 py-3">{ts.role}</td>
                  <td className="px-4 py-3">{ts.supplier}</td>
                  <td className="px-4 py-3">{ts.period}</td>
                  <td className="px-4 py-3">{ts.hours}</td>
                  <td className="px-4 py-3">{ts.rate}</td>
                  <td className="px-4 py-3">{ts.total}</td>
                  <td className="px-4 py-3">{ts.submitted}</td>

                  {/* Approval Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ts.approval === "Approved"
                          ? "bg-green-100 text-green-700"
                          : ts.approval === "Pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {ts.approval}
                    </span>
                  </td>

                  {/* Payroll Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ts.payroll === "Processed"
                          ? "bg-cyan-100 text-cyan-700"
                          : ts.payroll === "On Hold"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {ts.payroll}
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
