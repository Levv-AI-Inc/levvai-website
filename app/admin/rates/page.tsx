'use client'

import { useRouter } from 'next/navigation'
import {
  DollarSign,
  Table,
  Calculator,
  Clock,
  Layers
} from 'lucide-react'

const modules = [
  {
    title: 'Units of Measure',
    description: 'Define how work is billed (hour, day, unit).',
    icon: Layers,
    path: '/admin/rates/units'
  },
  {
    title: 'Rate Categories',
    description: 'Define standard, overtime, and premium rates.',
    icon: Clock,
    path: '/admin/rates/categories'
  },
  {
    title: 'Rate Structure',
    description: 'Configure pay, tax, and markup calculations.',
    icon: Calculator,
    path: '/admin/rates/structure'
  },
  {
    title: 'Rate Cards',
    description: 'Manage supplier pricing by role and location.',
    icon: Table,
    path: '/admin/rates/cards'
  },
  {
    title: 'Rate Rules',
    description: 'Automate overtime and shift logic.',
    icon: DollarSign,
    path: '/admin/rates/rules'
  }
]

export default function RateConfigurationPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Rate Configuration
        </h1>
        <p className="text-sm text-slate-500">
          Configure pricing models, supplier rate cards, and billing rules.
        </p>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {modules.map((module) => {
          const Icon = module.icon

          return (
            <button
              key={module.title}
              onClick={() => router.push(module.path)}
              className="group rounded-lg border bg-white p-5 text-left hover:border-slate-400 hover:shadow-sm transition"
            >
              <div className="flex items-start gap-3">

                <div className="p-2 rounded-md bg-slate-100 group-hover:bg-slate-200">
                  <Icon size={18} />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {module.title}
                  </h2>

                  <p className="text-xs text-slate-500 mt-1">
                    {module.description}
                  </p>
                </div>

              </div>
            </button>
          )
        })}

      </div>
    </div>
  )
}