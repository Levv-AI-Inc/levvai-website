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
  UserRound,
  LogOut,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isTenantHost, normalizeHost } from '@/lib/tenant'
import { CWRequestProvider } from './requests/new/job/context/CWRequestContext'

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

function getSessionDisplay(user: SessionUser | null) {
  if (!user) {
    return {
      name: 'Levv',
      label: 'Workspace',
      initials: 'L',
    }
  }

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  const name = fullName || user.username || user.email || 'Account'
  const label = user.role || user.email || user.username || 'Signed-in account'
  const initialsSource = fullName || user.username || user.email || 'Levv'
  const initials = initialsSource
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'L'

  return {
    name,
    label,
    initials,
  }
}

function formatCurrentPage(pathname: string) {
  if (pathname === '/home') return 'DASHBOARD'
  const segment = pathname.split('/').filter(Boolean).pop()
  if (!segment) return 'LEVV'
  return segment.replace(/-/g, ' ').toUpperCase()
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const isAdmin =
    (sessionUser?.role || '').trim().toLowerCase() === ROLE_ADMIN

  const isStandalone =
    pathname === '/' ||
    pathname === '/security' ||
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
        <body className="min-h-screen bg-slate-50 text-slate-900 font-sans">
          {children}
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <body className="flex min-h-screen bg-[#f4f1ea] text-[#1e2528] font-sans">
        <aside className="w-64 min-w-[16rem] flex flex-col bg-[#1e2528] text-[#d9ddd8] border-r border-[#33413d]">
          <SidebarAccount user={sessionUser} />

          <nav className="flex-1 px-4 py-6 space-y-7 overflow-y-auto">
            <NavSection label="Main">
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
            </NavSection>

            <NavSection label="Management">
              <NavGroup
                label="Contingent Workforce"
                icon={Users}
                items={[
                  { label: 'Work Orders', href: '/cw/work-orders' },
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
                  { label: 'Digital Workers', href: '/workers/digital-workers' },
                  { label: 'Worker Lifecycle', href: '/workers/123/engagements' },
                  { label: 'Timesheets', href: '/workers/timesheets' },
                  { label: 'Expenses', href: '/workers/expenses' },
                ]}
              />
              <NavItem label="Suppliers" href="/suppliers" icon={Building2} />
            </NavSection>

            <NavSection label="System">
              <NavGroup
                label="Finance"
                icon={CreditCard}
                items={[
                  { label: 'Invoices', href: '/payments/invoices' },
                  { label: 'Payments', href: '/payments/payments' },
                ]}
              />
              {isAdmin && (
                <NavItem label="Settings" href="/admin" icon={Settings} />
              )}
            </NavSection>
          </nav>

          {sessionUser && (
            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-3 px-3 py-2 w-full text-[#aeb8b2] hover:text-[#ffb4a6] hover:bg-white/10 rounded-md transition-all text-sm font-medium disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" />
                {signingOut ? 'Signing Out...' : 'Sign Out'}
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-[#d8d1c4] bg-[#fcfbf7]/95 backdrop-blur flex items-center px-8 justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#1f3d38] rounded-md flex items-center justify-center font-bold text-white text-[10px]">
                L
              </div>
              <span className="text-sm font-bold text-[#1e2528]">
                LEVV
              </span>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-xs font-medium text-[#6b746f] flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#9a651e]" />
                {formatCurrentPage(pathname)}
              </div>
              {sessionUser && (
                <AccountMenu
                  user={sessionUser}
                  signingOut={signingOut}
                  onSignOut={handleSignOut}
                />
              )}
            </div>
          </header>

          <main className="flex-1 p-6 lg:p-8">
            <CWRequestProvider>{children}</CWRequestProvider>
          </main>
        </div>
      </body>
    </html>
  )
}

function SidebarAccount({ user }: { user: SessionUser | null }) {
  const display = getSessionDisplay(user)

  return (
    <div className="flex items-center gap-3 px-6 h-20 border-b border-white/10 bg-black/10">
      <div className="w-9 h-9 rounded-md bg-[#89d3bd] flex items-center justify-center text-xs font-bold text-[#1e2528]">
        {display.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {display.name}
        </p>
        <p className="text-[10px] text-[#aeb8b2] uppercase truncate">
          {display.label}
        </p>
      </div>
    </div>
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
  const display = getSessionDisplay(user)

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
        className="inline-flex items-center gap-2 rounded-md border border-[#cfc7b8] bg-white px-3 py-2 text-sm font-semibold text-[#26312f] shadow-sm hover:bg-[#f8f5ee]"
      >
        <UserCircle2 className="h-4 w-4 text-[#6b746f]" />
        <span>{display.name}</span>
        <ChevronDown className={open ? 'h-4 w-4 rotate-180 text-[#6b746f]' : 'h-4 w-4 text-[#6b746f]'} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-lg border border-[#cfc7b8] bg-[#fcfbf7] text-[#26312f] shadow-2xl">
          <div className="border-b border-[#d8d1c4] px-4 py-3">
            <div className="text-sm font-semibold text-[#1e2528]">{display.name}</div>
            <div className="mt-1 text-xs text-[#6b746f]">{display.label}</div>
          </div>

          <Link
            href="/external/act-as-worker/timesheet"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-[#26312f] hover:bg-[#f4f1ea]"
            role="menuitem"
          >
            <UserRound className="h-4 w-4" />
            <span>Switch to Worker Profile</span>
          </Link>

          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 border-t border-[#d8d1c4] px-4 py-3 text-sm font-medium text-[#26312f] hover:bg-[#f4f1ea] disabled:opacity-60"
            role="menuitem"
          >
            <LogOut className="h-4 w-4" />
            <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

function NavSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="px-3 mb-3 text-[11px] font-bold uppercase text-[#8e9a94]">
        {label}
      </p>
      <div className="space-y-1">{children}</div>
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
        group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
        transition-all duration-200
        ${
          isActive
            ? 'bg-[#89d3bd]/16 text-white shadow-sm'
            : 'text-[#d9ddd8] hover:bg-white/10 hover:text-white'
        }
      `}
    >
      <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-[#89d3bd]' : 'text-[#8e9a94] group-hover:text-[#d9ddd8]'}`} />
      {label}

      {isActive && (
        <span className="absolute left-[-12px] top-2 bottom-2 w-1 bg-[#89d3bd] rounded-r-full" />
      )}
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

  useEffect(() => {
    if (isAnyActive) setOpen(true)
  }, [isAnyActive])

  return (
    <div className="space-y-1">
      <button
        onClick={() => setOpen(!open)}
        className={`
          w-full flex items-center justify-between px-3 py-2.5 rounded-md
          text-sm font-medium transition-all duration-200
          ${
            isAnyActive
              ? 'text-white'
              : 'text-[#d9ddd8] hover:bg-white/10 hover:text-white'
          }
        `}
      >
        <span className="flex items-center gap-3">
          <Icon className={`w-[18px] h-[18px] ${isAnyActive ? 'text-[#89d3bd]' : 'text-[#8e9a94]'}`} />
          {label}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180 text-white' : 'text-[#8e9a94]'}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="ml-5 pl-4 border-l border-white/12 my-1 space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  block px-3 py-2 rounded-md text-[13px] transition-colors
                  ${
                    isActive
                      ? 'text-[#89d3bd] font-bold bg-[#89d3bd]/8'
                      : 'text-[#aeb8b2] hover:text-white hover:bg-white/5'
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
