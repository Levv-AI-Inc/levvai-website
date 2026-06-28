'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function UserRecordPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/users')
  }, [router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Returning to users...
      </div>
    </div>
  )
}
