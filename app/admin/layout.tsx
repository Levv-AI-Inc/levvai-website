'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

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
  { label: 'Roles', href: '/admin/roles' },
  { label: 'Approval Chains', href: '/admin/approval-chains' },
  { label: 'Financial', href: '/admin/financial' },
  { label: 'Rates', href: '/admin/rates' },
  { label: 'Suppliers', href: '/admin/suppliers' },
  { label: 'Workers', href: '/admin/workers' },
  { label: 'Compliance Policies', href: '/compliance/policies' },
  { label: 'Tenant Docs', href: '/admin/tenant-docs' },
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
  const hasAuthorizedRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    const verifyAccess = async () => {
      setCheckingAccess(!hasAuthorizedRef.current)

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

        hasAuthorizedRef.current = true
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

  const shouldShowAccessCheck = checkingAccess && !isAuthorized

  return (
    <div className="flex min-h-full min-w-0 overflow-hidden rounded-lg border border-[#d8d1c4] bg-[#fcfbf7] shadow-[0_1px_2px_rgba(30,37,40,0.04)]">
      {/* =========================
          Admin Tabs (Column 2)
         ========================= */}
      <aside className="w-60 shrink-0 border-r border-[#ded7ca] bg-white px-3 py-4">
        <div className="mb-6">
          <h2 className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8376]">
            Settings
          </h2>
          <p className="mt-1 px-3 text-xs leading-5 text-[#6b746f]">
            Tenant controls and access.
          </p>
        </div>

        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + '/') ||
              (item.href === '/compliance/policies' &&
                (pathname === '/admin/compliance/policies' ||
                  pathname.startsWith('/admin/compliance/policies/')))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'block rounded-md px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-[#e7f3ee] text-[#1f3d38]'
                    : 'text-[#5d665f] hover:bg-[#f4f1ea] hover:text-[#1e2528]'
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
      <main className="min-w-0 flex-1 overflow-x-hidden bg-[#f7f5ef] p-5 lg:p-6">
        {shouldShowAccessCheck ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="w-full max-w-sm rounded-lg border border-[#ded7ca] bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[#6b746f]" />
                <div>
                  <p className="text-sm font-semibold text-[#1e2528]">
                    Checking access...
                  </p>
                  <p className="text-xs text-[#6b746f]">
                    Verifying your admin session.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
