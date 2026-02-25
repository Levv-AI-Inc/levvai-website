export type GPTRole = 'system' | 'user'

export interface GPTMessage {
  role: GPTRole
  content: string
}

export interface GPTCallParams {
  messages: GPTMessage[]
  temperature?: number
}

export type ApprovalDimensionType = 'enum' | 'number' | 'string'

export interface ApprovalDimension {
  key: string
  label: string
  type: ApprovalDimensionType
}

export type ApprovalRule = Record<
  string,
  string | number | boolean | null
>

export interface ApprovalMetadata {
  assumptions: string[]
  gaps: string[]
}

export interface ApprovalRuleSet {
  dimensions: ApprovalDimension[]
  rules: ApprovalRule[]
  metadata: ApprovalMetadata
}
