'use client'

import { useEffect, useState } from 'react'

export default function ApprovalBanner() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
    }, 3000) // 3 seconds

    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      className="
        rounded-xl border border-green-200 bg-green-50 px-6 py-4 shadow-sm
        transition-all duration-700 ease-in-out
        animate-banner
      "
    >
      <div className="mt-1 text-sm text-green-600 leading-relaxed">
        SOW created and sent for approval
      </div>
      <div className="mt-1 text-sm text-green-700">
        This Statement of Work has been successfully created and routed for approval.
      </div>
    </div>
  )
}
