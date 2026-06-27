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

export type OveragePolicy = 'hard_stop' | 'escalate' | 'continue_flag'
export type ReviewCadence = 'monthly' | 'quarterly' | 'at_renewal'
export type CostModel =
  | 'API Usage'
  | 'Usage Based'
  | 'Subscription'
  | 'Fixed Fee'
  | 'Included in SOW'

export type AIAutomationItem = {
  id: string
  name: string
  category: 'AI Agent' | 'Automation Bot' | 'AI Platform' | 'Workflow Assistant'
  aiPlatform?: string
  businessOwner?: string
  technicalOwner?: string
  purpose?: string
  dataClassification?: 'Public' | 'Internal' | 'Confidential' | 'PII' | 'Financial Data'
  accessScope?: string[]
  riskLevel?: 'Low' | 'Medium' | 'High'
  costModel?: CostModel
  spendCap?: number
  alertThreshold?: number
  overpagePolicy?: OveragePolicy
  spendApprover?: string
  reviewCadence?: ReviewCadence
  deploymentModel?: 'your_tenant' | 'vendor_hosted' | 'hybrid'
  oversightLevel?: 'autonomous' | 'human_in_loop' | 'human_on_loop'
  vendorRetainsData?: boolean
  vendorTrainsOnData?: boolean
  complianceScope?: string[]
  exitPlan?: 'decommission' | 'transition_internal' | 'continue_renewal'
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
  aiGateAnswer?: 'yes' | 'no' | null
  aiAutomation?: AIAutomationItem[]
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
      aiAutomation: data.aiAutomation ?? prev.aiAutomation,
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
