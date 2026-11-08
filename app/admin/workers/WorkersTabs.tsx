'use client'

import { usePathname } from 'next/navigation'
import { LevvTabs } from '@/components/ui/levv-app'

export const WORKERS_TABS = [
  { value: 'onboarding', label: 'Onboarding', href: '/admin/workers/onboarding' },
  { value: 'offboarding', label: 'Offboarding', href: '/admin/workers/offboarding' },
  { value: 'requirements', label: 'Requirements List', href: '/admin/workers/requirements' },
]

/** The sibling sections of Workers, under each section's record header. */
export default function WorkersTabs() {
  const pathname = usePathname()
  const current = WORKERS_TABS.find((tab) => pathname.startsWith(tab.href))?.value ?? 'onboarding'

  return <LevvTabs label="Workers" value={current} options={WORKERS_TABS} />
}
