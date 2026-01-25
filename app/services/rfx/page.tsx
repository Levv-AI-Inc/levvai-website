"use client"

const rfxData = [
  {
    id: "RFX-2024-009",
    name: "Core Banking Platform Upgrade",
    category: "IT Services",
    owner: "Emily Carter",
    invited: 5,
    responses: 3,
    type: "RFP",
    value: "$3,500,000",
    due: "Apr 22, 2024",
    stage: "In Review",
    competition: "Healthy",
  },
  {
    id: "RFX-2024-006",
    name: "Data Platform Managed Services",
    category: "Managed Services",
    owner: "Daniel Lee",
    invited: 4,
    responses: 1,
    type: "RFP",
    value: "$6,200,000",
    due: "Apr 15, 2024",
    stage: "Response Open",
    competition: "Weak",
  },
  {
    id: "RFX-2024-002",
    name: "Cloud Security Assessment",
    category: "Advisory",
    owner: "Rachel Adams",
    invited: 3,
    responses: 3,
    type: "RFQ",
    value: "$450,000",
    due: "Mar 28, 2024",
    stage: "Awarded",
    competition: "Strong",
  },
]

export default function RFxPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          RFx
        </h1>
        <p className="text-sm text-gray-500">
          SOW Bids
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">RFx ID</th>
                <th className="px-4 py-3">Engagement</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Suppliers Invited</th>
                <th className="px-4 py-3">Responses</th>
                <th className="px-4 py-3">Bid Type</th>
                <th className="px-4 py-3">Est. Value</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Competition</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {rfxData.map((rfx) => (
                <tr
                  key={rfx.id}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {rfx.id}
                  </td>
                  <td className="px-4 py-3">{rfx.name}</td>
                  <td className="px-4 py-3">{rfx.category}</td>
                  <td className="px-4 py-3">{rfx.owner}</td>
                  <td className="px-4 py-3">{rfx.invited}</td>
                  <td className="px-4 py-3">{rfx.responses}</td>
                  <td className="px-4 py-3">{rfx.type}</td>
                  <td className="px-4 py-3">{rfx.value}</td>
                  <td className="px-4 py-3">{rfx.due}</td>

                  {/* Stage */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rfx.stage === "Awarded"
                          ? "bg-green-100 text-green-700"
                          : rfx.stage === "In Review"
                          ? "bg-cyan-100 text-cyan-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {rfx.stage}
                    </span>
                  </td>

                  {/* Competition */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rfx.competition === "Strong"
                          ? "bg-green-100 text-green-700"
                          : rfx.competition === "Healthy"
                          ? "bg-cyan-100 text-cyan-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {rfx.competition}
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
