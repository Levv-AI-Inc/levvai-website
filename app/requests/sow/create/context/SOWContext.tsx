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
  billingFrequency?: 'monthly' | 'quarterly' | 'annually'
  recurringAmount?: number
  paymentTerms?: string
  sowStatus?: 'draft' | 'signed' | 'not_provided'
}

export type OveragePolicy = 'hard_stop' | 'escalate' | 'continue_flag'
export type ReviewCadence = 'monthly' | 'quarterly' | 'at_renewal'
export type CostModel = 'API Usage' | 'Usage Based' | 'Subscription' | 'Fixed Fee' | 'Included in SOW'

// Whether spend governance fields are relevant for a given cost model
export function isUsageBased(costModel?: CostModel): boolean {
  return costModel === 'API Usage' || costModel === 'Usage Based'
}

export type AIAutomationItem = {
  id: string

  // Identity
  name: string
  category: 'AI Agent' | 'Automation Bot' | 'AI Platform' | 'Workflow Assistant'

  // "aiPlatform" replaces "vendor" — this is the underlying technology stack,
  // NOT the SOW supplier. e.g. "Azure OpenAI", "UiPath", "AWS Bedrock".
  // The SOW supplier (SI, consultancy) is already captured at the SOW level.
  aiPlatform?: string

  // Ownership — both required for governance approval
  businessOwner?: string
  technicalOwner?: string

  // What it does and what data it touches
  purpose?: string
  dataClassification?: 'Public' | 'Internal' | 'Confidential' | 'PII' | 'Financial Data'
  accessScope?: string[]
  riskLevel?: 'Low' | 'Medium' | 'High'

  // Cost model — determines whether spend governance fields apply
  costModel?: CostModel

  // Spend governance — only populated when costModel is usage-based.
  // These become the live policy on the digital worker record after SOW approval.
  spendCap?: number           // Monthly approved ceiling in USD
  alertThreshold?: number     // % of cap that triggers a Nova work item (e.g. 80)
  overpagePolicy?: OveragePolicy
  spendApprover?: string      // Who receives the Nova escalation
  reviewCadence?: ReviewCadence

  // Digital worker record is always created — not optional
  // Status on creation: 'Pending Review'
}

export type SOWData = {
  workType?: string
  rawScope?: string
  structuredScope?: StructuredScope
  contractTerms?: ContractTerms

  // Whether the user explicitly answered the AI gate question
  // (relevant for managed_services and other work types)
  aiGateAnswer?: 'yes' | 'no' | null

  aiAutomation?: AIAutomationItem[]

  // Legacy fields retained for compatibility
  name?: string
  vendor?: string
  startDate?: string
  endDate?: string
  scope?: string
  financials?: Record<string, any>
  commercials?: Record<string, any>
  attachments?: any[]
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