"use client"

const expenses = [
  {
    id: "EXP-2024-057",
    worker: "James Carter",
    role: "Senior Backend Engineer",
    supplier: "TEKsystems",
    type: "Travel",
    date: "Apr 3, 2024",
    amount: "$420.00",
    currency: "USD",
    submitted: "Apr 5, 2024",
    policy: "Compliant",
    approval: "Pending",
    payment: "Not Paid",
  },
  {
    id: "EXP-2024-049",
    worker: "Priya Shah",
    role: "Business Analyst",
    supplier: "Randstad",
    type: "Meals",
    date: "Mar 29, 2024",
    amount: "$68.50",
    currency: "USD",
    submitted: "Mar 30, 2024",
    policy: "Compliant",
    approval: "Approved",
    payment: "Paid",
  },
  {
    id: "EXP-2024-041",
    worker: "Daniel Wong",
    role: "QA Automation Engineer",
    supplier: "Insight Global",
    type: "Lodging",
    date: "Mar 22, 2024",
    amount: "$980.00",
    currency: "USD",
    submitted: "Mar 24, 2024",
    policy: "Exception",
    approval: "Rejected",
    payment: "On Hold",
  },
]

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Expenses
        </h1>
        <p className="text-sm text-gray-500">
          Expense records
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3">Expense ID</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Expense Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Policy</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {expenses.map((exp) => (
                <tr
                  key={exp.id}
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                    {exp.id}
                  </td>
                  <td className="px-4 py-3">{exp.worker}</td>
                  <td className="px-4 py-3">{exp.role}</td>
                  <td className="px-4 py-3">{exp.supplier}</td>
                  <td className="px-4 py-3">{exp.type}</td>
                  <td className="px-4 py-3">{exp.date}</td>
                  <td className="px-4 py-3">{exp.amount}</td>
                  <td className="px-4 py-3">{exp.currency}</td>
                  <td className="px-4 py-3">{exp.submitted}</td>

                  {/* Policy */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        exp.policy === "Compliant"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {exp.policy}
                    </span>
                  </td>

                  {/* Approval */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        exp.approval === "Approved"
                          ? "bg-green-100 text-green-700"
                          : exp.approval === "Pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {exp.approval}
                    </span>
                  </td>

                  {/* Payment */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        exp.payment === "Paid"
                          ? "bg-cyan-100 text-cyan-700"
                          : exp.payment === "On Hold"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {exp.payment}
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
