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
  Inbox,
  Workflow,
  Menu,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isTenantHost, normalizeHost } from '@/lib/tenant'
import { CWRequestProvider } from './requests/new/job/context/CWRequestContext'
import { LevvBrand } from './components/ui/levv-app'
import { fontDisplay, fontSans } from './fonts'
import { SessionProvider, type SessionUser } from './session-context'

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
  { label: 'Inbox', href: '/inbox', section: 'Main', keywords: 'approvals tasks flow changes to do' },
  { label: 'Running workflows', href: '/runs', section: 'Main', keywords: 'runs pause resume stop', adminOnly: true },
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
  { label: 'Workflows', href: '/admin/workflows', section: 'Settings', keywords: 'flow studio builder approvals', adminOnly: true },
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

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
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
  const membershipIdValue = membership?.membership_id
  const membershipId =
    typeof membershipIdValue === 'number'
      ? String(membershipIdValue)
      : readOptionalString(membershipIdValue)

  return {
    first_name: firstName,
    last_name: lastName,
    email,
    username,
    role,
    membershipId,
    membershipState: readOptionalString(membership?.state),
    authorizationVersion: readOptionalNumber(
      membership?.authorization_version,
    ),
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const hasCheckedSessionRef = useRef(false)
  const isAdmin = (sessionUser?.role || '').trim().toLowerCase() === ROLE_ADMIN

  const isStandalone =
    pathname === '/' ||
    pathname === '/security' ||
    pathname.startsWith('/external') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/flow-studio') ||
    pathname.startsWith('/tenant-not-found')
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  // 05 §6: cyan and slate-950. Their screens carry `.levv-spec`, which restores Tailwind's own palette, and leave off
  // `flex-1`, the hook of globals.css's control normalisation, so they grow the same way without it.
  const isRunScreen =
    pathname === '/runs' ||
    pathname.startsWith('/runs/') ||
    pathname === '/inbox' ||
    pathname.startsWith('/inbox/')

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
      hasCheckedSessionRef.current = false
      return
    }

    const controller = new AbortController()
    setSessionChecking(!hasCheckedSessionRef.current)

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
          hasCheckedSessionRef.current = true
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

  const fontClasses = `${fontSans.variable} ${fontDisplay.variable}`
  const head = (
    <head>
      <title>{pathname === '/' ? 'Levv: external workforce management for enterprises' : 'Levv'}</title>
      <meta
        name="description"
        content="Levv keeps every contractor and SOW engagement on one worker record, from requisition to offboarding. Nova applies your policy and routes each approval to its owner."
      />
      <meta name="theme-color" content="#0a1330" />
    </head>
  )

  if (isStandalone) {
    return (
      <html lang="en" className={fontClasses}>
        {head}
        <body className="min-h-screen bg-[var(--ground)] font-sans text-slate-900">
          {children}
        </body>
      </html>
    )
  }

  return (
    <html lang="en" className={fontClasses}>
      {head}
      <body className="levv-auth-shell flex min-h-screen bg-[var(--ground)] font-sans text-slate-950">
        {mobileNavOpen ? (
          <div
            aria-hidden
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/40 animate-in fade-in duration-200 lg:hidden"
          />
        ) : null}
        <aside
          className={`z-50 flex h-screen shrink-0 flex-col border-r border-[var(--rail-line)] bg-[var(--rail)] text-slate-300 transition-[width,min-width,transform] duration-200 ease-out max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-[15.5rem] max-lg:min-w-[15.5rem] lg:sticky lg:top-0 lg:z-30 ${
            mobileNavOpen ? 'max-lg:translate-x-0 max-lg:shadow-xl' : 'max-lg:-translate-x-full'
          } ${
            sidebarCollapsed
              ? 'lg:w-[4.25rem] lg:min-w-[4.25rem]'
              : 'lg:w-[15.5rem] lg:min-w-[15.5rem]'
          }`}
        >
          <div
            className={`flex h-16 shrink-0 items-center ${
              sidebarCollapsed ? 'justify-center px-2' : 'px-5'
            }`}
          >
            <Link
              href="/home"
              className="flex items-center gap-3 rounded-lg"
              aria-label="LEVVAI home"
            >
              <LevvBrand compact={sidebarCollapsed} />
            </Link>
          </div>

          <nav
            className={`flex-1 space-y-6 overflow-y-auto pb-6 pt-3 [scrollbar-color:rgb(255_255_255/0.14)_transparent] ${
              sidebarCollapsed ? 'px-2.5' : 'px-3'
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
              <NavItem
                label="Inbox"
                href="/inbox"
                icon={Inbox}
                collapsed={sidebarCollapsed}
              />
              {isAdmin ? (
                <NavItem
                  label="Running workflows"
                  href="/runs"
                  icon={Workflow}
                  collapsed={sidebarCollapsed}
                />
              ) : null}
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
              {isAdmin ? (
                <NavItem
                  label="Settings"
                  href="/admin/users"
                  icon={Settings}
                  collapsed={sidebarCollapsed}
                  activeHrefs={['/admin', '/compliance/policies']}
                />
              ) : null}
            </NavSection>
          </nav>

          <div className="hidden border-t border-[var(--rail-line)] p-2.5 lg:block">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className={`levv-press flex h-9 w-full items-center rounded-lg px-2.5 text-[13px] font-medium text-slate-400 hover:bg-[var(--rail-raised)] hover:text-white ${
                sidebarCollapsed ? 'justify-center' : 'gap-3'
              }`}
              aria-label={
                sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
              }
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px]" />
              )}
              {!sidebarCollapsed ? <span>Collapse</span> : null}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--ground)] px-4 sm:px-5 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              className="levv-press -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <PageSearch isAdmin={isAdmin} />

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                aria-label="Notifications"
                className="levv-press relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line-strong)] text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              >
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-[#c0392b]" />
              </button>
              <div className="h-6 w-px bg-[var(--line)]" />
              {sessionUser && (
                <AccountMenu
                  user={sessionUser}
                  signingOut={signingOut}
                  onSignOut={handleSignOut}
                />
              )}
            </div>
          </header>

          <main
            className={`levv-auth-main min-w-0 ${isRunScreen ? 'grow basis-0' : 'flex-1'} bg-[var(--ground)] p-5 sm:p-6 lg:p-8`}
          >
            <SessionProvider
              value={{ user: sessionUser, checking: sessionChecking }}
            >
              <CWRequestProvider>{children}</CWRequestProvider>
            </SessionProvider>
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
    <div ref={containerRef} className="relative hidden w-full max-w-md sm:block">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          goToFirstResult()
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
          className="h-9 w-full rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] pl-9 pr-14 text-[14px] text-slate-900 outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-slate-500 hover:border-slate-500 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--focus)]"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--line)] bg-[var(--ground)] px-1.5 py-0.5 font-semibold tabular-nums text-[11px] text-slate-500">
          ⌘K
        </kbd>
      </form>

      {open && query.trim() ? (
        <div
          id="levvai-page-search-results"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-[var(--line)] bg-white p-1.5 shadow-pop"
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
                  className="group flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-slate-100"
                  role="option"
                >
                  <span className="min-w-0 truncate text-[13px] font-medium text-slate-900">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {item.section}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-3 py-5 text-center">
              <p className="text-[13px] font-medium text-slate-800">
                No matching page
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try a page name such as approvals, workers, or settings.
              </p>
            </div>
          )}
          {results.length > 0 ? (
            <div className="mt-1 border-t border-[var(--line)] px-3 pb-0.5 pt-2 text-[11px] text-slate-500">
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
        aria-expanded={open}
        className="levv-press inline-flex h-9 items-center gap-2.5 rounded-lg pl-1 pr-2 text-[13px] font-medium text-slate-800 hover:bg-slate-100"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[var(--rail)] text-[11px] font-semibold text-white">
          {display.initials}
        </span>
        <span className="hidden max-w-40 truncate sm:block">
          {display.name}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="levv-pop absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--line)] bg-white p-1.5 text-slate-800 shadow-pop"
          role="menu"
        >
          <div className="px-2.5 pb-2.5 pt-1.5">
            <div className="truncate text-[13px] font-semibold text-slate-950">
              {display.name}
            </div>
            <div className="mt-0.5 truncate text-xs capitalize text-slate-500">
              {display.label}
            </div>
          </div>
          <div className="-mx-1.5 mb-1.5 h-px bg-[var(--line)]" />

          <Link
            href="/external/act-as-worker/timesheet"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            role="menuitem"
          >
            <UserRound className="h-4 w-4 text-slate-400" />
            <span>Switch to Worker Profile</span>
          </Link>

          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
            role="menuitem"
          >
            <LogOut className="h-4 w-4 text-slate-400" />
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
        <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#82879a]">
          {label}
        </p>
      ) : (
        <div className="mx-2 mb-2 h-px bg-[var(--rail-line)]" />
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

const NAV_ROW =
  'flex h-9 w-full items-center rounded-lg px-2.5 text-[13.5px] font-medium transition-colors duration-150'

/* =========================
   Nav Item
========================= */
function NavItem({
  label,
  href,
  icon: Icon,
  collapsed,
  activeHrefs = [],
}: {
  label: string
  href: string
  icon: React.ElementType
  collapsed: boolean
  activeHrefs?: string[]
}) {
  const pathname = usePathname()
  const activeRoutes = [href, ...activeHrefs]
  const isActive = activeRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  )

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={`${NAV_ROW} ${collapsed ? 'justify-center' : 'gap-3'} ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:bg-[var(--rail-raised)] hover:text-white'
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
      />
      {!collapsed ? <span className="truncate">{label}</span> : null}
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
    <div>
      <button
        type="button"
        onClick={() => (collapsed ? undefined : setOpen(!open))}
        title={collapsed ? label : undefined}
        aria-expanded={collapsed ? undefined : open}
        className={`${NAV_ROW} ${collapsed ? 'justify-center' : 'justify-between'} ${
          isAnyActive
            ? 'text-white'
            : 'text-slate-300 hover:bg-[var(--rail-raised)] hover:text-white'
        }`}
      >
        <span className={`flex min-w-0 items-center ${collapsed ? '' : 'gap-3'}`}>
          <Icon
            className={`h-[18px] w-[18px] shrink-0 ${isAnyActive ? 'text-white' : 'text-slate-400'}`}
          />
          {!collapsed ? <span className="truncate">{label}</span> : null}
        </span>
        {!collapsed ? (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
          />
        ) : null}
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          open && !collapsed
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="my-0.5 ml-[1.15rem] space-y-0.5 border-l border-[var(--rail-line)] pl-2.5">
            {items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  tabIndex={open && !collapsed ? undefined : -1}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors duration-150 ${
                    isActive
                      ? 'bg-blue-600 font-medium text-white'
                      : 'text-slate-400 hover:bg-[var(--rail-raised)] hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
