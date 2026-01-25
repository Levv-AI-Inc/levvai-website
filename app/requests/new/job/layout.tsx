'use client'

import { CWRequestProvider } from './context/CWRequestContext'

export default function JobLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <CWRequestProvider>{children}</CWRequestProvider>
}
