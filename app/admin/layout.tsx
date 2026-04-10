'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

const ROLE_ADMIN = 'admin'

type SessionResponse = {
  authenticated?: boolean
  user?: {
    role?: string
  }
  membership?: {
    role?: string
  }
}

function readOptionalString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function parseRole(payload: SessionResponse): string {
  return (
    readOptionalString(payload.membership?.role) ||
    readOptionalString(payload.user?.role)
  ).toLowerCase()
}

const ADMIN_NAV = [
  { label: 'Users', href: '/admin/users' },
  { label: 'Company', href: '/admin/company' },
  { label: 'Approval Chains', href: '/admin/approval-chains' },
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
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const verifyAccess = async () => {
      setCheckingAccess(true)

      try {
        const response = await fetch('/api/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 401) {
          router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/admin')}`)
          return
        }

        const payload =
          (await response.json().catch(() => ({}))) as SessionResponse

        if (!response.ok || payload.authenticated !== true) {
          router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/admin')}`)
          return
        }

        if (parseRole(payload) !== ROLE_ADMIN) {
          router.replace('/home')
          return
        }

        setIsAuthorized(true)
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return
        router.replace('/home')
      } finally {
        if (!controller.signal.aborted) {
          setCheckingAccess(false)
        }
      }
    }

    void verifyAccess()
    return () => controller.abort()
  }, [pathname, router])

  if (checkingAccess || !isAuthorized) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
        Checking access...
      </div>
    )
  }

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
