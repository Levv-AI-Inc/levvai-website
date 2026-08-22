'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const TABS = [
  { label: 'Onboarding', href: '/admin/workers/onboarding' },
  { label: 'Offboarding', href: '/admin/workers/offboarding' },
  { label: 'Requirements List', href: '/admin/workers/requirements' },
]

export default function WorkersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <div className="flex gap-6 border-b">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'pb-2 text-sm',
                active
                  ? 'border-b-2 border-slate-900 font-medium text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
