"use client"

import { useState } from "react"

type ApprovalItem = {
  id: string
  type: string
  title: string
  requester: string
  supplier: string
  amount: string
  approvalType: string
  submitted: string
  decision?: "Approved" | "Rejected"
  decidedOn?: string
}

const initialPending: ApprovalItem[] = [
  {
    id: "APR-2024-014",
    type: "Statement of Work",
    title: "Cloud Migration Program",
    requester: "Sarah Johnson",
    supplier: "Deloitte",
    amount: "$1,250,000",
    approvalType: "Financial",
    submitted: "2 days ago",
  },
  {
    id: "APR-2024-011",
    type: "Job Posting",
    title: "Senior React Developer",
    requester: "Mike Chen",
    supplier: "TEKsystems",
    amount: "$95/hr",
    approvalType: "Rate Approval",
    submitted: "3 days ago",
  },
  {
    id: "APR-2024-008",
    type: "Invoice",
    title: "March Services Invoice",
    requester: "Accounts Payable",
    supplier: "Infosys",
    amount: "$185,000",
    approvalType: "Invoice Approval",
    submitted: "1 week ago",
  },
]

export default function MyApprovalsPage() {
  const [pending, setPending] = useState<ApprovalItem[]>(initialPending)
  const [history, setHistory] = useState<ApprovalItem[]>([])

  const handleDecision = (
    item: ApprovalItem,
    decision: "Approved" | "Rejected"
  ) => {
    setPending((prev) => prev.filter((p) => p.id !== item.id))
    setHistory((prev) => [
      {
        ...item,
        decision,
        decidedOn: "Just now",
      },
      ...prev,
    ])
  }

  return (
    <div className="space-y-10">
      {/* ================= Pending Approvals ================= */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            My Queue
          </h1>
          <p className="text-sm text-gray-500">
            Requests awaiting your action
          </p>
        </div>

        <ApprovalTable
          data={pending}
          showActions
          onDecision={handleDecision}
          emptyMessage="No pending approvals 🎉"
        />
      </div>

      {/* ================= Decision History ================= */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            My Approvals
          </h2>
          <p className="text-sm text-gray-500">
            Requests you have approved or rejected
          </p>
        </div>

        <ApprovalTable
          data={history}
          showActions={false}
          emptyMessage="No approvals processed yet"
        />
      </div>
    </div>
  )
}

/* ================= Table Component ================= */

function ApprovalTable({
  data,
  showActions,
  onDecision,
  emptyMessage,
}: {
  data: ApprovalItem[]
  showActions: boolean
  onDecision?: (item: ApprovalItem, d: "Approved" | "Rejected") => void
  emptyMessage: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3">Request ID</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Requested By</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Approval Type</th>
              <th className="px-4 py-3">
                {showActions ? "Submitted" : "Decision"}
              </th>
              <th className="px-4 py-3 text-right">
                {showActions ? "Action" : ""}
              </th>
            </tr>
          </thead>

          <tbody>
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}

            {data.map((item) => (
              <tr
                key={item.id}
                className="bg-gray-50 hover:bg-gray-100 transition rounded-lg"
              >
                <td className="px-4 py-3 font-medium text-gray-900 rounded-l-lg">
                  {item.id}
                </td>
                <td className="px-4 py-3">{item.type}</td>
                <td className="px-4 py-3">{item.title}</td>
                <td className="px-4 py-3">{item.requester}</td>
                <td className="px-4 py-3">{item.supplier}</td>
                <td className="px-4 py-3">{item.amount}</td>
                <td className="px-4 py-3">{item.approvalType}</td>

                {/* Submitted / Decision */}
                <td className="px-4 py-3">
                  {showActions ? (
                    item.submitted
                  ) : (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.decision === "Approved"
                          ? "bg-cyan-100 text-cyan-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.decision}
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right rounded-r-lg">
                  {showActions && onDecision && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onDecision(item, "Approved")}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-100 text-cyan-700 hover:bg-cyan-200 transition"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onDecision(item, "Rejected")}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
