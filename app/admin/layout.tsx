'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const ADMIN_NAV = [
  { label: 'Users', href: '/admin/users' },
  { label: 'Company', href: '/admin/company' },
  { label: 'Approval', href: '/admin/approval' },
  { label: 'Financial', href: '/admin/financial' },
  { label: 'Rates', href: '/admin/rates' }, // ← ADDED
  { label: 'Suppliers', href: '/admin/suppliers' },
  { label: 'Integrations', href: '/admin/integrations' },
  { label: 'Configuration', href: '/admin/configuration' },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-1 bg-gray-100">
      {/* =========================
          Admin Tabs (Column 2)
         ========================= */}
      <aside className="w-64 bg-white border-r border-gray-200 px-4 py-6">
        <div className="mb-6">
          <h2 className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            admin settings
          </h2>
        </div>

        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'block rounded-md px-3 py-2 text-sm transition',
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* =========================
          Admin Content (Column 3)
         ========================= */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
