'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const RATE_TABS = [
  { label: 'Rate Structures', href: '/admin/rates/structures' },
  { label: 'Rate Cards', href: '/admin/rates/cards' },
  { label: 'Rate Rules', href: '/admin/rates/rules' },
]

export default function RatesModuleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Rates</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Configure the reusable rate structures, market-facing rate
          cards, and adjustment rules that feed contingent labor pricing.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-2">
          {RATE_TABS.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`)

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={clsx(
                  'rounded-t-md px-4 py-3 text-sm font-medium transition',
                  isActive
                    ? 'border-b-2 border-black text-black'
                    : 'text-gray-500 hover:text-gray-800',
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {children}
    </div>
  )
}
