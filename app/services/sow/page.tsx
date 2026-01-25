"use client"

import { useRouter } from 'next/navigation'

const sowPortfolio = [
  {
    id: "SOW-2024-021",
    name: "Core Banking Platform Upgrade",
    supplier: "Accenture",
    owner: "Michael Roberts",
    type: "Fixed Fee",
    value: "$3,200,000",
    spent: "$450,000",
    start: "Jan 10, 2024",
    end: "Dec 31, 2024",
    status: "Active",
    health: "Healthy",
    renewal: "Low",
  },
  {
    id: "SOW-2023-114",
    name: "Data Platform Managed Services",
    supplier: "Infosys",
    owner: "Rachel Adams",
    type: "Managed Services",
    value: "$5,800,000",
    spent: "$5,200,000",
    start: "Jul 01, 2023",
    end: "Jun 30, 2024",
    status: "Expiring",
    health: "At Risk",
    renewal: "High",
  },
  {
    id: "SOW-2024-006",
    name: "Cloud Security Assessment",
    supplier: "Deloitte",
    owner: "Daniel Lee",
    type: "T&M",
    value: "$420,000",
    spent: "$180,000",
    start: "Mar 01, 2024",
    end: "Aug 31, 2024",
    status: "Active",
    health: "Attention",
    renewal: "Medium",
  },
]

export default function ServicesSOWPage() {
   const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Statements of Work
        </h1>
        <p className="text-sm text-gray-500">
           Services engagements records
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">SOW ID</th>
                <th className="px-4 py-3">Engagement</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Total Value</th>
                <th className="px-4 py-3">Spend to Date</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Renewal Risk</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {sowPortfolio.map((sow) => (
                <tr
                  key={sow.id}
                  onClick={() => router.push(`/services/sow/${sow.id}`)}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg cursor-pointer"
                >

                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {sow.id}
                  </td>
                  <td className="px-4 py-3">{sow.name}</td>
                  <td className="px-4 py-3">{sow.supplier}</td>
                  <td className="px-4 py-3">{sow.owner}</td>
                  <td className="px-4 py-3">{sow.type}</td>
                  <td className="px-4 py-3">{sow.value}</td>
                  <td className="px-4 py-3">{sow.spent}</td>
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
                        sow.health === "Healthy"
                          ? "bg-cyan-100 text-cyan-700"
                          : sow.health === "Attention"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {sow.health}
                    </span>
                  </td>

                  {/* Renewal Risk */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sow.renewal === "Low"
                          ? "bg-green-100 text-green-700"
                          : sow.renewal === "Medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {sow.renewal}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                      className="px-4 py-3 text-right rounded-r-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
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
