'use client'

import { createContext, useContext } from 'react'

export type SessionUser = {
  first_name?: string
  last_name?: string
  email?: string
  username?: string
  role?: string
}

type SessionContextValue = {
  user: SessionUser | null
  checking: boolean
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  checking: true,
})

export function SessionProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: SessionContextValue
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
