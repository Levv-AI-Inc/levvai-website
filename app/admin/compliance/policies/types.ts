// ===============================
// COMPLIANCE BLUEPRINT TYPES
// ===============================

export type PolicyStatus = 'DRAFT' | 'ACTIVE'

export type GateType = 'HARD' | 'SOFT'

export type CompletionRule = 'ALL' | 'ANY'

export type RequirementType =
  | 'UPLOAD'
  | 'SIGNATURE'
  | 'DATA_FIELD'
  | 'INTEGRATION'

export type RequirementOwner =
  | 'WORKER'
  | 'SUPPLIER'
  | 'MANAGER'
  | 'IT'

// ===============================
// POLICY (TEMPLATE / BLUEPRINT)
// ===============================

export type CompliancePolicy = {
  id: string
  name: string
  version: string
  status: PolicyStatus

  scope: {
    regions?: string[]
    locations?: string[]
    workerTypes?: string[]   // Contingent, SOW
    roles?: string[]         // IT Developer, Analyst, etc
    modes?: string[]         // Onsite, Remote, Hybrid
  }

  blocks: PolicyBlock[]

  createdAt: string
  updatedAt: string
}

// ===============================
// BLOCK (CONTAINER)
// ===============================

export type PolicyBlock = {
  id: string
  name: string
  order: number

  gate: GateType
  completionRule: CompletionRule

  requirements: PolicyRequirement[]
}

// ===============================
// REQUIREMENT (ATOMIC UNIT)
// ===============================

export type PolicyRequirement = {
  id: string
  name: string

  type: RequirementType
  owner: RequirementOwner

  // Optional flags
  autoClearFromVault?: boolean

  // Only used if type === 'INTEGRATION'
  integration?: {
    provider: 'OKTA' | 'AZURE_AD' | 'SERVICENOW' | 'CUSTOM'
    trigger: 'ON_PREVIOUS_BLOCK_COMPLETE'
    requiresCallback: boolean
  }
}
