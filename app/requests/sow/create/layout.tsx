'use client'

import { SOWProvider } from './context'

export default function CreateSOWLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SOWProvider>{children}</SOWProvider>
}
