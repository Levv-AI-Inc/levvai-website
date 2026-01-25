"use client"

const payments = [
  {
    id: "PAY-2024-056",
    supplier: "TEKsystems",
    method: "ACH",
    amount: "$12,600",
    currency: "USD",
    date: "May 12, 2024",
    status: "Paid",
    bank: "**** 4821",
    invoice: "INV-2024-091",
    processor: "AP Automation",
  },
  {
    id: "PAY-2024-051",
    supplier: "Accenture",
    method: "Wire",
    amount: "$450,000",
    currency: "USD",
    date: "Apr 28, 2024",
    status: "Paid",
    bank: "**** 9934",
    invoice: "INV-2024-073",
    processor: "Treasury",
  },
  {
    id: "PAY-2024-044",
    supplier: "Insight Global",
    method: "ACH",
    amount: "$980",
    currency: "USD",
    date: "Scheduled – May 18, 2024",
    status: "Scheduled",
    bank: "**** 1172",
    invoice: "INV-2024-084",
    processor: "AP Automation",
  },
]

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Payments
        </h1>
        <p className="text-sm text-gray-500">
          Track executed and scheduled supplier payments
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">Payment ID</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bank Account</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Processed By</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {p.id}
                  </td>
                  <td className="px-4 py-3">{p.supplier}</td>
                  <td className="px-4 py-3">{p.method}</td>
                  <td className="px-4 py-3">{p.amount}</td>
                  <td className="px-4 py-3">{p.currency}</td>
                  <td className="px-4 py-3">{p.date}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        p.status === "Paid"
                          ? "bg-green-100 text-green-700"
                          : p.status === "Scheduled"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>

                  <td className="px-4 py-3">{p.bank}</td>
                  <td className="px-4 py-3">{p.invoice}</td>
                  <td className="px-4 py-3">{p.processor}</td>

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
