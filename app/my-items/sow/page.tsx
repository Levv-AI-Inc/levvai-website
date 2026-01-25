"use client"

const sowData = [
  {
    id: "SOW-2024-001",
    title: "Application Modernization Program",
    supplier: "Accenture",
    type: "Fixed Fee",
    value: "$1,250,000",
    start: "Jan 15, 2024",
    end: "Dec 31, 2024",
    status: "Active",
    health: "Perfect",
    updated: "2 days ago",
  },
  {
    id: "SOW-2024-002",
    title: "Cloud Migration Advisory",
    supplier: "Deloitte",
    type: "T&M",
    value: "$480,000",
    start: "Mar 01, 2024",
    end: "Sep 30, 2024",
    status: "Active",
    health: "Attention",
    updated: "5 days ago",
  },
  {
    id: "SOW-2023-118",
    title: "Data Platform Support",
    supplier: "Infosys",
    type: "Managed Services",
    value: "$2,100,000",
    start: "Jul 01, 2023",
    end: "Jun 30, 2024",
    status: "Expiring",
    health: "At Risk",
    updated: "1 week ago",
  },
]

export default function MySOWsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          My Statements of Work
        </h1>
        <p className="text-sm text-gray-500">
          Your Statement of Works
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">SOW ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Total Value</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {sowData.map((sow) => (
                <tr
                  key={sow.id}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {sow.id}
                  </td>
                  <td className="px-4 py-3">{sow.title}</td>
                  <td className="px-4 py-3">{sow.supplier}</td>
                  <td className="px-4 py-3">{sow.type}</td>
                  <td className="px-4 py-3">{sow.value}</td>
                  <td className="px-4 py-3">{sow.start}</td>
                  <td className="px-4 py-3">{sow.end}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sow.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : sow.status === "Expiring"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {sow.status}
                    </span>
                  </td>

                  {/* Health */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sow.health === "Perfect"
                          ? "bg-cyan-100 text-cyan-700"
                          : sow.health === "Attention"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {sow.health}
                    </span>
                  </td>

                  <td className="px-4 py-3">{sow.updated}</td>

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
