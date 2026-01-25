'use client'

import React, { createContext, useContext, useState } from 'react'

export type StructuredScope = {
  summary: string
  deliverables: string[]
  timeline: string
}

export type ContractTerms = {
  contractType?: 'SOW' | 'MSA' | 'Amendment'
  pricingModel?: 'fixed' | 'tm' | 'recurring'
  currency?: string
  totalValue?: number

  // Recurring-only
  billingFrequency?: 'monthly' | 'quarterly' | 'annually'
  recurringAmount?: number

  paymentTerms?: string
  sowStatus?: 'draft' | 'signed' | 'not_provided'
}

export type SOWData = {
  workType?: string
  rawScope?: string
  structuredScope?: StructuredScope
  contractTerms?: ContractTerms
}

type SOWContextValue = {
  sow: Partial<SOWData>
  setSOW: (data: Partial<SOWData>) => void
}

const SOWContext = createContext<SOWContextValue>({
  sow: {},
  setSOW: () => {},
})

export function SOWProvider({ children }: { children: React.ReactNode }) {
  const [sow, setSOWState] = useState<Partial<SOWData>>({})

  const setSOW = (data: Partial<SOWData>) => {
    setSOWState(prev => ({
      ...prev,
      ...data,
      contractTerms: {
        ...prev.contractTerms,
        ...data.contractTerms,
      },
    }))
  }

  return (
    <SOWContext.Provider value={{ sow, setSOW }}>
      {children}
    </SOWContext.Provider>
  )
}

export function useSOW() {
  return useContext(SOWContext)
}
