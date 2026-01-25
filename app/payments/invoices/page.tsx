"use client"

const invoices = [
  {
    id: "INV-2024-091",
    supplier: "TEKsystems",
    type: "Timesheet",
    amount: "$12,600",
    currency: "USD",
    invoiceDate: "Apr 10, 2024",
    dueDate: "May 10, 2024",
    match: "3-Way Match",
    approval: "Approved",
    payment: "Scheduled",
    linked: "TS-2024-089",
  },
  {
    id: "INV-2024-084",
    supplier: "Insight Global",
    type: "Expense",
    amount: "$980",
    currency: "USD",
    invoiceDate: "Apr 02, 2024",
    dueDate: "May 02, 2024",
    match: "Exception",
    approval: "Pending",
    payment: "On Hold",
    linked: "EXP-2024-041",
  },
  {
    id: "INV-2024-073",
    supplier: "Accenture",
    type: "SOW",
    amount: "$450,000",
    currency: "USD",
    invoiceDate: "Mar 25, 2024",
    dueDate: "Apr 25, 2024",
    match: "2-Way Match",
    approval: "Approved",
    payment: "Paid",
    linked: "SOW-2024-021",
  },
]

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Invoices
        </h1>
        <p className="text-sm text-gray-500">
          Review, approve, and manage supplier invoices
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">Invoice ID</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Invoice Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Linked To</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {inv.id}
                  </td>
                  <td className="px-4 py-3">{inv.supplier}</td>
                  <td className="px-4 py-3">{inv.type}</td>
                  <td className="px-4 py-3">{inv.amount}</td>
                  <td className="px-4 py-3">{inv.currency}</td>
                  <td className="px-4 py-3">{inv.invoiceDate}</td>
                  <td className="px-4 py-3">{inv.dueDate}</td>

                  {/* Match */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        inv.match === "3-Way Match"
                          ? "bg-green-100 text-green-700"
                          : inv.match === "2-Way Match"
                          ? "bg-cyan-100 text-cyan-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {inv.match}
                    </span>
                  </td>

                  {/* Approval */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        inv.approval === "Approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {inv.approval}
                    </span>
                  </td>

                  {/* Payment */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        inv.payment === "Paid"
                          ? "bg-cyan-100 text-cyan-700"
                          : inv.payment === "Scheduled"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {inv.payment}
                    </span>
                  </td>

                  <td className="px-4 py-3">{inv.linked}</td>

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
