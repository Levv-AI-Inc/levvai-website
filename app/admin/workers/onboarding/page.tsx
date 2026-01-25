'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import {
  getWorkflows,
  toggleWorkflowActive,
  deleteWorkflow,
} from './workflow'

export default function OnboardingPage() {
  const [workflows, setWorkflows] = useState(getWorkflows())

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Onboarding Workflows</h1>

        <Link
          href="/admin/compliance/policies/new"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Add Onboarding Workflow
        </Link>
      </div>

      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Policy</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Active</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>

          <tbody>
            {workflows.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-2">{p.name}</td>

                <td className="px-4 py-2 text-slate-500">
                  {p.status}
                </td>

                <td className="px-4 py-2">
                  <button
                    onClick={() => {
                      toggleWorkflowActive(p.id)
                      setWorkflows(getWorkflows())
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      p.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {p.active ? 'Active' : 'Inactive'}
                  </button>
                </td>

                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/admin/compliance/policies/${p.id}`}
                      className="text-slate-600 hover:text-slate-900"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>

                    <button
                      onClick={() => {
                        deleteWorkflow(p.id)
                        setWorkflows(getWorkflows())
                      }}
                      className="text-slate-400 hover:text-red-600"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {workflows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-sm text-slate-400"
                >
                  No onboarding workflows created
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
