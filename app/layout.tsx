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
} from 'lucide-react'
import { useState } from 'react'
import { CWRequestProvider } from './requests/new/job/context/CWRequestContext'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isExternal = pathname.startsWith('/external')

  if (isExternal) {
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

            <NavItem label="Settings" href="/admin" icon={Settings} />
          </nav>
        </aside>

        <main className="flex-1 px-8 py-6">
          {children}
        </main>
      </body>
    </html>
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
