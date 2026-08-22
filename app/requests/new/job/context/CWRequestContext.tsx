'use client'

import { createContext, useContext, useState } from 'react'

export type CWRequest = {
  role?: string
  description?: string

  country?: string
  region?: string

  startDate?: string
  endDate?: string
  hoursPerWeek?: number
  positions?: number

  pricingModel?: 'pay_markup' | 'bill_only'
  enteredRate?: number
  currency?: string

  costCenter?: string

  /* -----------------------------
     Calculated / Derived (MVP)
  -------------------------------- */
  estimatedTotal?: number
  
  stRate?: number
  otRate?: number
}

const CWRequestContext = createContext<{
  request: CWRequest
  update: (data: Partial<CWRequest>) => void
}>({
  request: {},
  update: () => {},
})

export const CWRequestProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [request, setRequest] = useState<CWRequest>({})

  const update = (data: Partial<CWRequest>) =>
    setRequest(prev => ({ ...prev, ...data }))

  return (
    <CWRequestContext.Provider value={{ request, update }}>
      {children}
    </CWRequestContext.Provider>
  )
}

export const useCWRequest = () => useContext(CWRequestContext)
