'use client'

import './globals.css'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  UserRound,
  LogOut,
  Bell,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isTenantHost, normalizeHost } from '@/lib/tenant'
import { CWRequestProvider } from './requests/new/job/context/CWRequestContext'
import { LevvBrand } from './components/ui/levv-app'

type SessionUser = {
  first_name?: string
  last_name?: string
  email?: string
  username?: string
  role?: string
}

const ROLE_ADMIN = 'admin'

type PageSearchItem = {
  label: string
  href: string
  section: string
  keywords?: string
  adminOnly?: boolean
}

const PAGE_SEARCH_ITEMS: PageSearchItem[] = [
  { label: 'Home', href: '/home', section: 'Main', keywords: 'dashboard control desk nova' },
  { label: 'My SOWs', href: '/my-items/sow', section: 'My Items', keywords: 'statements of work requests' },
  { label: 'My Job Postings', href: '/my-items/jobs', section: 'My Items', keywords: 'staffing requests roles' },
  { label: 'My Approvals', href: '/my-items/approvals', section: 'My Items', keywords: 'queue decisions' },
  { label: 'Create Job Posting', href: '/requests/new/job/create/define', section: 'Create', keywords: 'new staffing request' },
  { label: 'Work Orders', href: '/cw/work-orders', section: 'Contingent Workforce', keywords: 'engagements assignments' },
  { label: 'Job Postings', href: '/cw/job-postings', section: 'Contingent Workforce', keywords: 'staffing intake requests' },
  { label: 'Candidates', href: '/cw/candidates', section: 'Contingent Workforce', keywords: 'applicants submissions' },
  { label: 'Statement of Work', href: '/services/sow', section: 'Services', keywords: 'sow contracts' },
  { label: 'RFx', href: '/services/rfx', section: 'Services', keywords: 'rfp rfi sourcing' },
  { label: 'Workers', href: '/workers/workers', section: 'Workers', keywords: 'people workforce' },
  { label: 'Digital Workers', href: '/workers/digital-workers', section: 'Workers', keywords: 'automation agents' },
  { label: 'Worker Lifecycle', href: '/workers/123/engagements', section: 'Workers', keywords: 'engagement onboarding offboarding' },
  { label: 'Timesheets', href: '/workers/timesheets', section: 'Workers', keywords: 'time hours' },
  { label: 'Expenses', href: '/workers/expenses', section: 'Workers', keywords: 'spend reimbursement' },
  { label: 'Suppliers', href: '/suppliers', section: 'Management', keywords: 'vendors' },
  { label: 'Invoices', href: '/payments/invoices', section: 'Finance', keywords: 'billing' },
  { label: 'Payments', href: '/payments/payments', section: 'Finance', keywords: 'transactions' },
  { label: 'Settings', href: '/admin', section: 'Administration', keywords: 'configuration tenant', adminOnly: true },
  { label: 'Users', href: '/admin/users', section: 'Settings', keywords: 'access accounts roles', adminOnly: true },
  { label: 'Company', href: '/admin/company', section: 'Settings', keywords: 'organization tenant', adminOnly: true },
  { label: 'Roles', href: '/admin/roles', section: 'Settings', keywords: 'permissions access', adminOnly: true },
  { label: 'Approval Chains', href: '/admin/approval-chains', section: 'Settings', keywords: 'routing approvers', adminOnly: true },
  { label: 'Financial Settings', href: '/admin/financial', section: 'Settings', keywords: 'currency budget', adminOnly: true },
  { label: 'Rates', href: '/admin/rates', section: 'Settings', keywords: 'bill pay markup', adminOnly: true },
  { label: 'Supplier Settings', href: '/admin/suppliers', section: 'Settings', keywords: 'vendors', adminOnly: true },
  { label: 'Worker Settings', href: '/admin/workers', section: 'Settings', keywords: 'workforce', adminOnly: true },
  { label: 'Compliance Policies', href: '/admin/compliance/policies', section: 'Settings', keywords: 'rules risk', adminOnly: true },
  { label: 'Tenant Documents', href: '/admin/tenant-docs', section: 'Settings', keywords: 'files knowledge', adminOnly: true },
  { label: 'Integrations', href: '/admin/integrations', section: 'Settings', keywords: 'connections systems', adminOnly: true },
  { label: 'Configuration', href: '/admin/configuration', section: 'Settings', keywords: 'preferences setup', adminOnly: true },
]

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
    readOptionalString(membership?.role) || readOptionalString(candidate.role)

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
  const initials =
    initialsSource
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isAdmin = (sessionUser?.role || '').trim().toLowerCase() === ROLE_ADMIN

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
          },
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
      setSessionChecking(false)
      return
    }

    const controller = new AbortController()
    setSessionChecking(true)

    const loadSessionUser = async () => {
      let redirecting = false

      try {
        const response = await fetch('/api/session', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          signal: controller.signal,
        })

        if (!response.ok) {
          setSessionUser(null)
          if (response.status === 401 || response.status === 403) {
            redirecting = true
            window.location.replace(
              `/auth/login?next=${encodeURIComponent(pathname)}`,
            )
          }
          return
        }

        const payload = await response.json().catch(() => ({}))
        const user = parseSessionUser(payload)
        setSessionUser(user)
        if (!user) {
          redirecting = true
          window.location.replace(
            `/auth/login?next=${encodeURIComponent(pathname)}`,
          )
        }
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return
        setSessionUser(null)
      } finally {
        if (!controller.signal.aborted && !redirecting) {
          setSessionChecking(false)
        }
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
      <body className="levv-auth-shell flex min-h-screen bg-[#f4f7fb] text-slate-950 font-sans">
        <aside
          className={`relative sticky top-0 z-30 flex h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#081a31] text-slate-200 shadow-[10px_0_40px_rgba(15,23,42,0.08)] transition-[width,min-width] duration-300 ${
            sidebarCollapsed
              ? 'w-[5.5rem] min-w-[5.5rem]'
              : 'w-[17.5rem] min-w-[17.5rem]'
          }`}
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 overflow-hidden opacity-70">
            <div className="absolute -bottom-36 -left-24 h-72 w-72 rounded-full bg-[#123456]" />
            <div className="absolute -bottom-44 left-8 h-72 w-72 rounded-full bg-[#102942]" />
          </div>

          <div
            className={`relative z-10 flex h-20 shrink-0 items-center border-b border-white/10 ${
              sidebarCollapsed ? 'justify-center px-3' : 'px-7'
            }`}
          >
            <Link
              href="/home"
              className="flex items-center gap-3"
              aria-label="LEVVAI home"
            >
              <LevvBrand compact={sidebarCollapsed} />
            </Link>
          </div>

          <nav
            className={`relative z-10 flex-1 space-y-7 overflow-y-auto py-6 ${
              sidebarCollapsed ? 'px-3' : 'px-4'
            }`}
          >
            <NavSection label="Main" collapsed={sidebarCollapsed}>
              <NavItem
                label="Home"
                href="/home"
                icon={Home}
                collapsed={sidebarCollapsed}
              />
              <NavGroup
                label="My Items"
                icon={Folder}
                collapsed={sidebarCollapsed}
                items={[
                  { label: 'My SOWs', href: '/my-items/sow' },
                  { label: 'My Job Postings', href: '/my-items/jobs' },
                  { label: 'Approvals', href: '/my-items/approvals' },
                ]}
              />
            </NavSection>

            <NavSection label="Management" collapsed={sidebarCollapsed}>
              <NavGroup
                label="Contingent Workforce"
                icon={Users}
                collapsed={sidebarCollapsed}
                items={[
                  { label: 'Work Orders', href: '/cw/work-orders' },
                  { label: 'Job Postings', href: '/cw/job-postings' },
                  { label: 'Candidates', href: '/cw/candidates' },
                ]}
              />
              <NavGroup
                label="Services"
                icon={FileText}
                collapsed={sidebarCollapsed}
                items={[
                  { label: 'Statement of Work', href: '/services/sow' },
                  { label: 'RFx', href: '/services/rfx' },
                ]}
              />
              <NavGroup
                label="Workers"
                icon={Briefcase}
                collapsed={sidebarCollapsed}
                items={[
                  { label: 'Workers', href: '/workers/workers' },
                  {
                    label: 'Digital Workers',
                    href: '/workers/digital-workers',
                  },
                  {
                    label: 'Worker Lifecycle',
                    href: '/workers/123/engagements',
                  },
                  { label: 'Timesheets', href: '/workers/timesheets' },
                  { label: 'Expenses', href: '/workers/expenses' },
                ]}
              />
              <NavItem
                label="Suppliers"
                href="/suppliers"
                icon={Building2}
                collapsed={sidebarCollapsed}
              />
            </NavSection>

            <NavSection label="System" collapsed={sidebarCollapsed}>
              <NavGroup
                label="Finance"
                icon={CreditCard}
                collapsed={sidebarCollapsed}
                items={[
                  { label: 'Invoices', href: '/payments/invoices' },
                  { label: 'Payments', href: '/payments/payments' },
                ]}
              />
              {sessionChecking ? (
                <NavItemPlaceholder collapsed={sidebarCollapsed} />
              ) : isAdmin ? (
                <NavItem
                  label="Settings"
                  href="/admin"
                  icon={Settings}
                  collapsed={sidebarCollapsed}
                />
              ) : null}
            </NavSection>
          </nav>

          <div className="relative z-10 border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-white ${
                sidebarCollapsed ? 'justify-center' : 'gap-3'
              }`}
              aria-label={
                sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
              }
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
              {!sidebarCollapsed ? <span>Collapse</span> : null}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur-xl lg:px-10">
            <PageSearch isAdmin={isAdmin} />

            <div className="ml-auto flex items-center gap-3 sm:gap-5">
              <button
                type="button"
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
              </button>
              <div className="h-8 w-px bg-slate-200" />
              {sessionUser && (
                <AccountMenu
                  user={sessionUser}
                  signingOut={signingOut}
                  onSignOut={handleSignOut}
                />
              )}
            </div>
          </header>

          <main className="levv-auth-main min-w-0 flex-1 bg-[#f4f7fb] p-5 sm:p-6 lg:p-8">
            <CWRequestProvider>{children}</CWRequestProvider>
          </main>
        </div>
      </body>
    </html>
  )
}

function PageSearch({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []

    return PAGE_SEARCH_ITEMS.filter((item) => {
      if (item.adminOnly && !isAdmin) return false
      const searchable = `${item.label} ${item.section} ${item.keywords || ''}`.toLowerCase()
      return searchable.includes(normalized)
    }).slice(0, 8)
  }, [isAdmin, query])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    setQuery('')
    setOpen(false)
  }, [pathname])

  const goToFirstResult = () => {
    if (!results[0]) return
    router.push(results[0].href)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-[31rem] sm:block">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          goToFirstResult()
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(Boolean(query.trim()))}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              inputRef.current?.blur()
            }
          }}
          aria-label="Search pages and subpages"
          aria-expanded={open}
          aria-controls="levvai-page-search-results"
          placeholder="Search pages and subpages..."
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-12 pr-16 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/70"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-400 shadow-sm">
          ⌘ K
        </span>
      </form>

      {open && query.trim() ? (
        <div
          id="levvai-page-search-results"
          className="absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.35)]"
          role="listbox"
        >
          {results.length > 0 ? (
            <div className="max-h-[26rem] overflow-y-auto">
              {results.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setQuery('')
                    setOpen(false)
                  }}
                  className="group flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition hover:bg-blue-50"
                  role="option"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {item.section}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-slate-400 group-hover:text-blue-600">
                    Open
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No matching page
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Try a page name such as approvals, workers, or settings.
              </p>
            </div>
          )}
          {results.length > 0 ? (
            <div className="border-t border-slate-100 px-3 pb-1 pt-2 text-[11px] text-slate-400">
              Press Enter to open the first result
            </div>
          ) : null}
        </div>
      ) : null}
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
    <div ref={containerRef} className="relative z-[1001]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-bold text-white shadow-md shadow-blue-200">
          {display.initials}
        </span>
        <span className="hidden max-w-40 truncate sm:block">
          {display.name}
        </span>
        <ChevronDown
          className={
            open
              ? 'h-4 w-4 rotate-180 text-slate-500'
              : 'h-4 w-4 text-slate-500'
          }
        />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-[0_22px_60px_-18px_rgba(15,23,42,0.28)]">
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="text-sm font-semibold text-slate-950">
              {display.name}
            </div>
            <div className="mt-1 text-xs text-slate-500">{display.label}</div>
          </div>

          <Link
            href="/external/act-as-worker/timesheet"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            role="menuitem"
          >
            <UserRound className="h-4 w-4" />
            <span>Switch to Worker Profile</span>
          </Link>

          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
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
  collapsed,
}: {
  label: string
  children: React.ReactNode
  collapsed: boolean
}) {
  return (
    <div>
      {!collapsed ? (
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
      ) : (
        <div className="mx-3 mb-3 h-px bg-white/10" />
      )}
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function NavItemPlaceholder({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium text-transparent ${
        collapsed ? 'justify-center' : 'gap-3'
      }`}
    >
      <div className="h-4 w-4 rounded bg-white/10" />
      {!collapsed ? <div className="h-3 w-16 rounded bg-white/10" /> : null}
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
  collapsed,
}: {
  label: string
  href: string
  icon: React.ElementType
  collapsed: boolean
}) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`
        group relative flex items-center rounded-xl px-3 py-2.5 text-sm font-medium
        transition-all duration-200
        ${collapsed ? 'justify-center' : 'gap-3'}
        ${
          isActive
            ? 'bg-gradient-to-r from-white/14 to-white/[0.07] text-white shadow-sm ring-1 ring-white/10'
            : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
        }
      `}
    >
      <Icon
        className={`h-[19px] w-[19px] shrink-0 transition-colors ${isActive ? 'text-blue-300' : 'text-slate-400 group-hover:text-slate-200'}`}
      />
      {!collapsed ? label : null}

      {isActive && (
        <span className="absolute -left-3 bottom-2 top-2 w-1 rounded-r-full bg-gradient-to-b from-blue-500 to-cyan-300 shadow-[0_0_14px_rgba(59,130,246,0.5)]" />
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
  collapsed,
}: {
  label: string
  icon: React.ElementType
  items: { label: string; href: string }[]
  collapsed: boolean
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
        onClick={() => (collapsed ? undefined : setOpen(!open))}
        title={collapsed ? label : undefined}
        className={`
          w-full flex items-center rounded-xl px-3 py-2.5
          text-sm font-medium transition-all duration-200
          ${collapsed ? 'justify-center' : 'justify-between'}
          ${
            isAnyActive
              ? 'bg-white/[0.06] text-white'
              : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
          }
        `}
      >
        <span className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
          <Icon
            className={`h-[19px] w-[19px] shrink-0 ${isAnyActive ? 'text-blue-300' : 'text-slate-400'}`}
          />
          {!collapsed ? label : null}
        </span>
        {!collapsed ? (
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180 text-white' : 'text-[#8e9a94]'}`}
          />
        ) : null}
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open && !collapsed ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="my-1 ml-5 space-y-1 border-l border-white/15 pl-4">
          {items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  block rounded-lg px-3 py-2 text-[13px] transition-colors
                  ${
                    isActive
                      ? 'bg-blue-400/10 font-semibold text-blue-200'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
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
