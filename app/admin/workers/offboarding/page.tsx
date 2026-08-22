'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'

const POLICIES = [
  {
    id: 'policy-us-it-v1',
    name: 'USTest',
    status: 'Draft',
  },
]

export default function OnboardingPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Onboarding Workflows</h1>

        <Link
          href="/admin/compliance/policies/new"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Add Offboarding Workflow
        </Link>
      </div>

      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Policy</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {POLICIES.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2 text-slate-500">{p.status}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/compliance/policies/${p.id}`}
                    className="text-slate-600 hover:text-slate-900"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
