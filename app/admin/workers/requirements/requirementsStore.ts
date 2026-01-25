'use client'

export type ValidationStrategy = 'manual' | 'ai_extraction' | 'third_party'
export type ApproverGroup = 'HR' | 'LEGAL' | 'IT' | 'FINANCE' | 'SECURITY'

// The structured prefixes that guide the AI's weightage
export type LogicPrefix = 'MUST_HAVE' | 'SHOULD_HAVE' | 'EQUAL_TO' | 'MATCHES_FORMAT' | 'IS_GREATER_THAN';

export type ComplianceRule = {
  id: string
  field: string
  prefix: LogicPrefix
  logicValue: string // The fluid text field
  criticality: 'BLOCKER' | 'FLAG'
}

export type Requirement = {
  id: string
  name: string
  owner: 'Worker' | 'Supplier' | 'Hiring Manager' | 'IT' | 'System'
  strategy: ValidationStrategy
  fallbackApprover: ApproverGroup 
  compliance?: {
    rules: ComplianceRule[]
    confidenceThreshold: number
  }
}

// Initial seed data reflecting real-world onboarding blocks
let requirements: Requirement[] = [
  { 
    id: 'gov-id', 
    name: 'Government ID Photo Check', 
    owner: 'Worker', 
    strategy: 'ai_extraction', 
    fallbackApprover: 'HR',
    compliance: { 
        rules: [{ id: '1', field: 'Expiry Date', operator: 'IS_FUTURE', criticality: 'BLOCKER' }], 
        confidenceThreshold: 85 
    }
  },
  { 
    id: 'bg-check', 
    name: 'Background Screening', 
    owner: 'Worker', 
    strategy: 'third_party', 
    fallbackApprover: 'SECURITY',
    integration: { provider: 'Checkr' }
  },
  { 
    id: 'nda-sign', 
    name: 'Non-Disclosure Agreement', 
    owner: 'Worker', 
    strategy: 'manual', 
    fallbackApprover: 'LEGAL' 
  },
]

export function getRequirements() {
  return requirements
}

export function setRequirements(next: Requirement[]) {
  requirements = next
}