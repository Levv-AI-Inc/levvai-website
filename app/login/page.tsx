'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { isTenantHost, normalizeHost } from '@/lib/tenant'

export default function LoginRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    const developerMode = window.localStorage.getItem('developer') === 'true'
    const tenantHost = isTenantHost(normalizeHost(window.location.hostname))
    router.replace(developerMode || tenantHost ? '/auth/login' : '/')
  }, [router])

  return null
}
