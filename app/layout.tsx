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
  LogOut,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { CWRequestProvider } from './requests/new/job/context/CWRequestContext'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isExternal = pathname.startsWith('/external')

  if (isExternal) {
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
      <body className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
        {/* Sidebar */}
        <aside className="w-64 flex flex-col bg-[#0f172a] text-slate-200 border-r border-slate-800 shadow-2xl">
          
          {/* Top Left: User Profile (Replaces LEVV Logo Section) */}
          <div className="flex items-center gap-3 px-6 h-20 border-b border-white/5 bg-black/10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
              FC
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">Faraz Chatta</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Administrator</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-7 overflow-y-auto custom-scrollbar">
            {/* Category: Main */}
            <div>
              <p className="px-3 mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400/80">
                Main
              </p>
              <div className="space-y-1">
                <NavItem label="Home" href="/" icon={Home} />
                <NavGroup
                  label="My Items"
                  icon={Folder}
                  items={[
                    { label: 'My SOWs', href: '/my-items/sow' },
                    { label: 'My Job Postings', href: '/my-items/jobs' },
                    { label: 'Approvals', href: '/my-items/approvals' },
                  ]}
                />
              </div>
            </div>

            {/* Category: Management */}
            <div>
              <p className="px-3 mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400/80">
                Management
              </p>
              <div className="space-y-1">
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
                    { label: 'Expenses', href: '/workers/expenses' },
                  ]}
                />
                <NavItem label="Suppliers" href="/suppliers" icon={Building2} />
              </div>
            </div>

            {/* Category: System */}
            <div>
              <p className="px-3 mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400/80">
                System
              </p>
              <div className="space-y-1">
                <NavGroup
                  label="Finance"
                  icon={CreditCard}
                  items={[
                    { label: 'Invoices', href: '/payments/invoices' },
                    { label: 'Payments', href: '/payments/payments' },
                  ]}
                />
                <NavItem label="Settings" href="/admin" icon={Settings} />
              </div>
            </div>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-white/5 space-y-1">
            <Link
              href="/external/act-as-worker/timesheet"
              className="flex items-center gap-3 px-3 py-2 w-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 rounded-lg transition-all text-sm font-medium"
            >
              <Users className="w-4 h-4" />
              Worker Profile
            </Link>
            <button className="flex items-center gap-3 px-3 py-2 w-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all text-sm font-medium">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8 justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-cyan-500 rounded flex items-center justify-center font-bold text-white text-[10px]">L</div>
                <span className="text-sm font-bold tracking-[0.2em] text-slate-900">LEVV</span>
            </div>
            
            <div className="text-xs font-medium text-slate-400 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                {pathname === '/' ? 'DASHBOARD' : pathname.split('/').pop()?.replace(/-/g, ' ').toUpperCase()}
            </div>
          </header>
          
          <main className="flex-1 p-8">
            <CWRequestProvider>{children}</CWRequestProvider>
          </main>
        </div>
      </body>
    </html>
  )
}

/* =========================
   Individual Nav Item Component
========================= */
function NavItem({ label, href, icon: Icon }: { label: string; href: string; icon: any }) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-200
        ${isActive 
          ? 'bg-cyan-500/15 text-white shadow-sm' 
          : 'text-slate-300 hover:bg-white/10 hover:text-white'}
      `}
    >
      <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
      {label}
      
      {isActive && (
        <span className="absolute left-[-12px] top-2 bottom-2 w-1 bg-cyan-400 rounded-r-full shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
      )}
    </Link>
  )
}

/* =========================
   Collapsible Nav Group Component
========================= */
function NavGroup({ label, icon: Icon, items }: { label: string; icon: any; items: { label: string; href: string }[] }) {
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
          w-full flex items-center justify-between px-3 py-2.5 rounded-lg
          text-sm font-medium transition-all duration-200
          ${isAnyActive ? 'text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}
        `}
      >
        <span className="flex items-center gap-3">
          <Icon className={`w-[18px] h-[18px] ${isAnyActive ? 'text-cyan-400' : 'text-slate-400'}`} />
          {label}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180 text-white' : 'text-slate-500'}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="ml-5 pl-4 border-l border-slate-700/60 my-1 space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  block px-3 py-2 rounded-md text-[13px] transition-colors
                  ${isActive 
                    ? 'text-cyan-400 font-bold bg-cyan-400/5' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'}
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
