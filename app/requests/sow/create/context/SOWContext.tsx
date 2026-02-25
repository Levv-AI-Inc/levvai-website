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
  sowStatus?: 'draft' | 'signed' | 'uploaded' | 'not_provided'
}

export type FinancialAllocation = {
  costCenterId: string
  costCenterName: string
  mode: 'percentage' | 'amount'
  value: number
}

export type Financials = {
  totalValue?: number
  currency?: string
  allocations?: FinancialAllocation[]
}

export type CommercialMilestone = {
  id: string
  name: string
  amount: number
  due: string
}

export type CommercialTMRole = {
  id: string
  role: string
  rate: number
  startDate: string
  endDate: string
}

export type Commercials = {
  pricingModel?: string
  paymentTrigger?: string
  milestones?: CommercialMilestone[]
  recurringAmount?: number | string
  billingFrequency?: string
  tmRoles?: CommercialTMRole[]
}

export type SOWAttachment = {
  name?: string
  [key: string]: unknown
}

export type SOWData = {
  workType?: string
  name?: string
  vendor?: string
  startDate?: string
  endDate?: string
  scope?: string
  rawScope?: string
  structuredScope?: StructuredScope
  contractTerms?: ContractTerms
  financials?: Financials
  commercials?: Commercials
  attachments?: SOWAttachment[]
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
      contractTerms: data.contractTerms
        ? {
            ...prev.contractTerms,
            ...data.contractTerms,
          }
        : prev.contractTerms,
      financials: data.financials
        ? {
            ...prev.financials,
            ...data.financials,
          }
        : prev.financials,
      commercials: data.commercials
        ? {
            ...prev.commercials,
            ...data.commercials,
          }
        : prev.commercials,
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
