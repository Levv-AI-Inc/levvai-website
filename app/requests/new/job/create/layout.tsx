'use client'

import { CWRequestProvider } from '../context/CWRequestContext'

export default function JobCreateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <CWRequestProvider>{children}</CWRequestProvider>
}
