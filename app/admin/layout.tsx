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
    <div className="flex flex-1 bg-[#f4f7fb]">
      {/* =========================
          Admin Tabs (Column 2)
         ========================= */}
      <aside className="sticky top-20 h-[calc(100vh-5rem)] w-60 shrink-0 overflow-y-auto border-r border-[#e1e8f2] bg-white px-4 py-6">
        <div className="mb-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Admin settings
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
                  'block rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-[inset_3px_0_0_#2563eb]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
      <main className="min-w-0 flex-1 p-6 lg:p-8">
        {shouldShowAccessCheck ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Checking access...
                  </p>
                  <p className="text-xs text-slate-500">
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
