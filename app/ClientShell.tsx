'use client'

import { usePathname } from 'next/navigation'

export default function ClientShell({
  children,
  sidebar,
}: {
  children: React.ReactNode
  sidebar: React.ReactNode
}) {
  const pathname = usePathname()
  const isExternal = pathname?.startsWith('/external')

  // External pages: no internal shell, no sidebar
  if (isExternal) {
    return <>{children}</>
  }

  // Internal pages: show your normal shell
  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-900">
      {sidebar}
      <main className="flex-1">{children}</main>
    </div>
  )
}
