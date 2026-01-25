'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

type RateCard = {
  id: string
  name: string
  role: string
  currency: string
  unit: string
  effective: string
  status: string
}

export default function RateCardsPage() {

  const router = useRouter()

  const rateCards: RateCard[] = [
    {
      id: '1',
      name: 'Senior Developer – Toronto',
      role: 'Senior Developer',
      currency: 'CAD',
      unit: 'Hour',
      effective: 'Jan 1 2026',
      status: 'Active'
    },
    {
      id: '2',
      name: 'QA Analyst – Toronto',
      role: 'QA Analyst',
      currency: 'CAD',
      unit: 'Hour',
      effective: 'Jan 1 2026',
      status: 'Active'
    },
    {
      id: '3',
      name: 'Project Manager – Remote',
      role: 'Project Manager',
      currency: 'USD',
      unit: 'Day',
      effective: 'Jan 1 2026',
      status: 'Draft'
    }
  ]

  return (

    <div className="p-6 space-y-6">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Rate Cards
          </h1>

          <p className="text-sm text-slate-500">
            Configure pricing rules used across jobs, timesheets, and invoices.
          </p>
        </div>

        <button
          className="flex items-center gap-2 rounded-md bg-slate-900 text-white px-3 py-2 text-sm hover:bg-slate-800"
        >
          <Plus size={16} />
          Create Rate Card
        </button>

      </div>

      {/* Table */}

      <div className="rounded-lg border bg-white overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-slate-50 border-b">

            <tr>

              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Currency</th>
              <th className="text-left px-4 py-3">Unit</th>
              <th className="text-left px-4 py-3">Effective</th>
              <th className="text-left px-4 py-3">Status</th>

            </tr>

          </thead>

          <tbody>

            {rateCards.map((card) => (

              <tr
                key={card.id}
                onClick={() => router.push(`/admin/rates/cards/${card.id}`)}
                className="border-b hover:bg-slate-50 cursor-pointer"
              >

                <td className="px-4 py-3 font-medium">
                  {card.name}
                </td>

                <td className="px-4 py-3">
                  {card.role}
                </td>

                <td className="px-4 py-3">
                  {card.currency}
                </td>

                <td className="px-4 py-3">
                  {card.unit}
                </td>

                <td className="px-4 py-3">
                  {card.effective}
                </td>

                <td className="px-4 py-3">

                  <span className={`text-xs px-2 py-1 rounded-full ${
                    card.status === 'Active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>

                    {card.status}

                  </span>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>

  )
}