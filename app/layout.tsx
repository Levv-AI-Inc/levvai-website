'use client'

import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Folder,
  Users,
  FileText,
  Briefcase,
  CreditCard,
  Building2,
  Settings,
  ChevronDown,
  UserCircle2,
  LogOut,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CWRequestProvider } from './requests/new/job/context/CWRequestContext'
import { isTenantHost, normalizeHost } from '@/lib/tenant'

type SessionUser = {
  first_name?: string
  last_name?: string
  email?: string
  username?: string
  role?: string
}

const ROLE_ADMIN = 'admin'

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function parseSessionUser(payload: unknown): SessionUser | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const topLevel = payload as Record<string, unknown>
  if (topLevel.authenticated !== true) {
    return null
  }

  const candidate =
    typeof topLevel.user === 'object' && topLevel.user
      ? (topLevel.user as Record<string, unknown>)
      : null

  const membership =
    typeof topLevel.membership === 'object' && topLevel.membership
      ? (topLevel.membership as Record<string, unknown>)
      : null

  if (!candidate) {
    return null
  }

  const firstName =
    readOptionalString(candidate.first_name) ??
    readOptionalString(candidate.firstName)
  const lastName =
    readOptionalString(candidate.last_name) ??
    readOptionalString(candidate.lastName)
  const email = readOptionalString(candidate.email)
  const username = readOptionalString(candidate.username)
  const role =
    readOptionalString(membership?.role) ||
    readOptionalString(candidate.role)

  return {
    first_name: firstName,
    last_name: lastName,
    email,
    username,
    role,
  }
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || ''
  return ''
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const isAdmin =
    (sessionUser?.role || '').trim().toLowerCase() === ROLE_ADMIN

  const isStandalone =
    pathname === '/' ||
    pathname.startsWith('/external') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/tenant-not-found')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const host = normalizeHost(window.location.hostname)
    if (!isTenantHost(host)) return

    const controller = new AbortController()

    const validateTenant = async () => {
      try {
        const response = await fetch(
          `/auth/password/tenant-exists?host=${encodeURIComponent(host)}`,
          {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          if (pathname !== '/tenant-not-found') {
            window.location.replace('/tenant-not-found')
          }
          return
        }

        const payload = (await response.json()) as { exists?: boolean }

        if (payload.exists === true) {
          if (pathname === '/tenant-not-found') {
            window.location.replace('/')
          }
          return
        }

        if (pathname !== '/tenant-not-found') {
          window.location.replace('/tenant-not-found')
        }
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return

        if (pathname !== '/tenant-not-found') {
          window.location.replace('/tenant-not-found')
        }
      }
    }

    void validateTenant()

    return () => controller.abort()
  }, [pathname])

  useEffect(() => {
    if (isStandalone) {
      setSessionUser(null)
      return
    }

    const controller = new AbortController()

    const loadSessionUser = async () => {
      try {
        const response = await fetch('/api/session', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        })

        if (!response.ok) {
          setSessionUser(null)
          return
        }

        const payload = await response.json().catch(() => ({}))
        setSessionUser(parseSessionUser(payload))
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return
        setSessionUser(null)
      }
    }

    void loadSessionUser()

    return () => controller.abort()
  }, [isStandalone, pathname])

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)

    try {
      const csrfToken = getCookie('csrftoken')

      const headers: Record<string, string> = {}
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken
      }

      let response = await fetch('/auth/logout/', {
        method: 'POST',
        credentials: 'include',
        headers,
      })

      if (!response.ok && response.status === 404) {
        response = await fetch('/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers,
        })
      }

      setSessionUser(null)
      window.location.assign('/auth/login')
    } catch {
      window.location.assign('/auth/login')
    } finally {
      setSigningOut(false)
    }
  }

  if (isStandalone) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-slate-50 text-slate-900">
          {children}
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <body className="flex min-h-screen bg-slate-100 text-slate-900">
        {/* Sidebar */}
        <aside className="w-64 min-w-[16rem] flex-shrink-0 bg-[#0b1023] text-slate-300 border-r border-white/10">
          <div className="px-6 py-6 text-lg font-semibold tracking-wide text-slate-100">
            LEVV
          </div>

          <nav className="px-3 space-y-1">
            <NavItem label="Home" href="/home" icon={Home} />

            <NavGroup
              label="My Items"
              icon={Folder}
              items={[
                { label: 'My SOWs', href: '/my-items/sow' },
                { label: 'My Job Postings', href: '/my-items/jobs' },
                { label: 'Approvals', href: '/my-items/approvals' },
              ]}
            />

            <NavGroup
              label="Contingent Workforce"
              icon={Users}
              items={[
                { label: 'Job Postings', href: '/cw/job-postings' },
                { label: 'Candidates', href: '/cw/candidates' },
              ]}
            />

            <NavGroup
              label="Services"
              icon={FileText}
              items={[
                { label: 'Statement of Work', href: '/services/sow' },
                { label: 'RFx', href: '/services/rfx' },
              ]}
            />

            <NavGroup
              label="Workers"
              icon={Briefcase}
              items={[
                { label: 'Workers', href: '/workers/workers' },
                { label: 'Engagements', href: '/workers/123/engagements' },
                { label: 'Timesheets', href: '/workers/timesheets' },
                { label: 'Expenses', href: '/workers/expenses' },
              ]}
            />

            <NavItem label="Suppliers" href="/suppliers" icon={Building2} />

            <NavGroup
              label="Payments"
              icon={CreditCard}
              items={[
                { label: 'Invoices', href: '/payments/invoices' },
                { label: 'Payments', href: '/payments/payments' },
              ]}
            />

            <div className="my-5 border-t border-white/10" />

            {isAdmin && (
              <NavItem label="Settings" href="/admin" icon={Settings} />
            )}
          </nav>
        </aside>

        <main className="flex-1 px-8 py-6">
          {sessionUser && (
            <div className="mb-6 flex justify-end">
              <AccountMenu
                user={sessionUser}
                signingOut={signingOut}
                onSignOut={handleSignOut}
              />
            </div>
          )}
          {children}
        </main>
      </body>
    </html>
  )
}

function AccountMenu({
  user,
  signingOut,
  onSignOut,
}: {
  user: SessionUser
  signingOut: boolean
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  const displayName = fullName || user.username || user.email || 'Account'
  const accountLabel = user.email || user.username || 'Signed-in account'

  useEffect(() => {
    if (!open) return

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (!containerRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        <UserCircle2 className="h-4 w-4 text-slate-500" />
        <span>{displayName}</span>
        <ChevronDown className={open ? 'h-4 w-4 rotate-180 text-slate-500' : 'h-4 w-4 text-slate-500'} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-slate-900 text-slate-100 shadow-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-sm font-semibold text-white">{displayName}</div>
            <div className="mt-1 text-xs text-slate-300">{accountLabel}</div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-white/10 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

/* =========================
   Nav Item
========================= */
function NavItem({
  label,
  href,
  icon: Icon,
}: {
  label: string
  href: string
  icon: React.ElementType
}) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
        transition-colors
        ${
          isActive
            ? 'bg-white/5 text-white shadow-[inset_3px_0_0_0_rgba(34,211,238,0.9)]'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }
      `}
    >
      <Icon className="w-4 h-4 opacity-80" />
      {label}
    </Link>
  )
}

/* =========================
   Nav Group
========================= */
function NavGroup({
  label,
  icon: Icon,
  items,
}: {
  label: string
  icon: React.ElementType
  items: { label: string; href: string }[]
}) {
  const pathname = usePathname()
  const isAnyActive = items.some((i) => pathname.startsWith(i.href))
  const [open, setOpen] = useState(isAnyActive)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`
          w-full flex items-center justify-between px-3 py-2.5 rounded-md
          text-sm font-medium transition-colors
          ${
            isAnyActive
              ? 'bg-white/5 text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          }
        `}
      >
        <span className="flex items-center gap-3">
          <Icon className="w-4 h-4 opacity-80" />
          {label}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all ${
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="ml-7 mt-1 space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  block px-3 py-1.5 rounded-md text-sm transition-colors
                  ${
                    isActive
                      ? 'text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }
                `}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return <CWRequestProvider>{children}</CWRequestProvider>
}
