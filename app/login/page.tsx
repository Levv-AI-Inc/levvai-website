'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    const developerMode = window.localStorage.getItem('developer') === 'true'
    router.replace(developerMode ? '/auth/login' : '/')
  }, [router])

  return null
}
