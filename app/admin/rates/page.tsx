'use client'

import { useRouter } from 'next/navigation'
import {
  Calculator,
  Clock,
  CreditCard,
  DollarSign,
  Layers,
  Table,
} from 'lucide-react'

const MODULES = [
  {
    title: 'Units of Measure',
    description: 'Define local work billing units such as hour, day, and unit.',
    icon: Layers,
    path: '/admin/rates/units',
  },
  {
    title: 'Rate Categories',
    description: 'Define local standard, overtime, and premium rate categories.',
    icon: Clock,
    path: '/admin/rates/categories',
  },
  {
    title: 'Structure Designer',
    description: 'Sketch local pay, tax, and markup calculation components.',
    icon: Calculator,
    path: '/admin/rates/structure',
  },
  {
    title: 'Backend Rate Structures',
    description: 'Create reusable API-backed structures for rate cards.',
    icon: Table,
    path: '/admin/rates/structures',
  },
  {
    title: 'Backend Rate Cards',
    description: 'Manage supplier pricing by role, location, and effective date.',
    icon: CreditCard,
    path: '/admin/rates/cards',
  },
  {
    title: 'Backend Rate Rules',
    description: 'Automate overtime, shift, and pricing adjustments.',
    icon: DollarSign,
    path: '/admin/rates/rules',
  },
]

export default function AdminRatesPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Rate Configuration
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Use local design surfaces for setup work and backend-backed modules
          for production rate structures, cards, and rules.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((module) => {
          const Icon = module.icon

          return (
            <button
              key={module.path}
              type="button"
              onClick={() => router.push(module.path)}
              className="group rounded-lg border border-slate-200 bg-white p-5 text-left transition hover:border-slate-400 hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-slate-100 p-2 group-hover:bg-slate-200">
                  <Icon className="h-5 w-5 text-slate-700" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {module.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
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
