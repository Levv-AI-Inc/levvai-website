'use client'

import ApprovalBanner from './components/ApprovalBanner'
import ReadOnlySOWSummary from './components/ReadOnlySOWSummary'
import ApprovalChain from './components/ApprovalChain'

export default function SOWSubmittedPage() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-10">
      {/* Success banner */}
      <ApprovalBanner />

      {/* Read-only SOW summary */}
      <ReadOnlySOWSummary />

      {/* Approval routing */}
      <ApprovalChain />
    </div>
  )
}
