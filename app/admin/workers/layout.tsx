'use client'

import { usePathname } from 'next/navigation'
import { LevvPage } from '@/components/ui/levv-app'
import { WORKERS_TABS } from './WorkersTabs'

/**
 * The three Workers sections share one page frame. Each section opens on its own record header with the tabs
 * under it (WorkersTabs); the workflow builder routes render bare.
 */
export default function WorkersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isSection = WORKERS_TABS.some((tab) => pathname === tab.href)

  if (!isSection) {
    return <>{children}</>
  }

  return <LevvPage>{children}</LevvPage>
}
