'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useSession } from '../session-context'

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
  { label: 'Approval Groups', href: '/admin/approval-groups' },
  { label: 'Supplier Network', href: '/admin/supplier-network' },
  { label: 'Approval Chains', href: '/admin/approval-chains' },
  { label: 'Workflows', href: '/admin/workflows' },
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
  const session = useSession()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const hasAuthorizedRef = useRef(false)

  useEffect(() => {
    if (session.checking) {
      setCheckingAccess(true)
      return
    }

    if (session.user) {
      if ((session.user.role || '').trim().toLowerCase() === ROLE_ADMIN) {
        hasAuthorizedRef.current = true
        setIsAuthorized(true)
        setCheckingAccess(false)
      } else {
        router.replace('/home')
      }
      return
    }

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
  }, [pathname, router, session.checking, session.user])

  const shouldShowAccessCheck = checkingAccess && !isAuthorized
  // Flow Studio fills the column (notes, decision 1): no padding, and the page must not scroll under the canvas.
  const isFlowStudio =
    pathname === '/admin/workflows' || pathname.startsWith('/admin/workflows/')

  return (
    <div className={clsx('flex flex-1 flex-col lg:flex-row', isFlowStudio ? 'gap-4' : 'gap-4 lg:gap-8')}>
      <aside
        className={clsx(
          'shrink-0 rounded-xl border border-[var(--line)] bg-white p-2 lg:sticky lg:top-20 lg:w-52 lg:self-start lg:overflow-y-auto',
          isFlowStudio
            ? 'lg:h-[calc(100vh-8rem)]'
            : 'lg:max-h-[calc(100vh-6rem)]'
        )}
      >
        <div className="hidden px-2.5 pb-2 pt-1.5 lg:block">
          <h2 className="text-[13px] font-semibold text-slate-950">
            Admin settings
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tenant controls and access.
          </p>
        </div>

        <nav aria-label="Admin settings" className="flex gap-px overflow-x-auto lg:block lg:space-y-px lg:overflow-visible">
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
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-2.5 text-[13px] transition-colors duration-150',
                  isActive
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
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
      <main
        className={clsx(
          'min-w-0 flex-1',
          isFlowStudio ? 'relative min-h-[calc(100vh-11rem)] lg:min-h-0' : ''
        )}
      >
        {shouldShowAccessCheck ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="w-full max-w-sm rounded-xl border border-[var(--line)] bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                <div>
                  <p className="text-[13px] font-semibold text-slate-950">
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
