'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'

export default function OnboardingHeader() {
  const pathname = usePathname()
  const params = useParams()

  const workerId = params.workerId as string

  const basePath = `/workers/${workerId}/engagements`

  const isOnboarding = pathname.includes('/onboarding')
  const isOffboarding = pathname.includes('/offboarding')

  return (
    <div className="rounded-md border bg-white p-4 space-y-3">
      {/* Name */}
      <h2 className="text-lg font-semibold text-gray-900">
        John Smith
      </h2>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200">
        <Link
          href={`${basePath}/onboarding/workspace`}
          className={[
            'pb-2 text-sm font-medium',
            isOnboarding
              ? 'border-b-2 border-black text-gray-900'
              : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}
        >
          Onboarding
        </Link>

        <Link
          href={`${basePath}/offboarding/workspace`}
          className={[
            'pb-2 text-sm font-medium',
            isOffboarding
              ? 'border-b-2 border-black text-gray-900'
              : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}
        >
          Offboarding
        </Link>
      </div>
    </div>
  )
}
