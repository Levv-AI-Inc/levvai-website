"use client"

const suppliers = [
  {
    id: "SUP-00124",
    name: "Acme consulting",
    type: "Staffing",
    category: "IT Staffing",
    workers: 18,
    sows: 0,
    owner: "Emily Carter",
    status: "Active",
    risk: "Low",
    compliance: "Compliant",
  },
  {
    id: "SUP-00107",
    name: "BluePeak Solutions",
    type: "Services",
    category: "IT Consulting",
    workers: 0,
    sows: 6,
    owner: "Michael Roberts",
    status: "Active",
    risk: "Medium",
    compliance: "Compliant",
  },
  {
    id: "SUP-00089",
    name: "NorthStar Advisory",
    type: "Both",
    category: "IT Staffing",
    workers: 12,
    sows: 2,
    owner: "Rachel Adams",
    status: "Active",
    risk: "High",
    compliance: "Review Required",
  },
  {
    id: "SUP-00089",
    name: "Quantum Services",
    type: "Both",
    category: "Consulting",
    workers: 8,
    sows: 2,
    owner: "Jason Mclaw",
    status: "Active",
    risk: "Medium",
    compliance: "Review Required",
  },
]

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Suppliers
        </h1>
        <p className="text-sm text-gray-500">
          Supplier records
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">Supplier ID</th>
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Active Workers</th>
                <th className="px-4 py-3">Active SOWs</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Compliance</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {s.id}
                  </td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">{s.type}</td>
                  <td className="px-4 py-3">{s.category}</td>
                  <td className="px-4 py-3">{s.workers}</td>
                  <td className="px-4 py-3">{s.sows}</td>
                  <td className="px-4 py-3">{s.owner}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>

                  {/* Risk */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s.risk === "Low"
                          ? "bg-green-100 text-green-700"
                          : s.risk === "Medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.risk}
                    </span>
                  </td>

                  {/* Compliance */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s.compliance === "Compliant"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {s.compliance}
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
