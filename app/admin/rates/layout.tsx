'use client'

import { RatesConfigProvider } from './context/RatesConfigContext'

export default function RatesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RatesConfigProvider>
      {children}
    </RatesConfigProvider>
  )
}