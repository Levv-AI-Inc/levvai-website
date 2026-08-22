'use client'

import { redirect } from 'next/navigation'

export default function ComplianceRedirect() {
  redirect('/workers/123/onboarding/compliance')
}
