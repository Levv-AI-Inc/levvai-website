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
  const showTabs = TABS.some((tab) => pathname === tab.href)

  if (!showTabs) {
    return <>{children}</>
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 text-sm">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href)

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={clsx(
                  'pb-3 transition',
                  active
                    ? 'border-b-2 border-black font-medium text-gray-950'
                    : 'text-slate-500 hover:text-slate-800',
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
