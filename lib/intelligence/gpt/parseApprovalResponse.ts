import { ApprovalRuleSet } from './types'

export function parseApprovalResponse(raw: string): ApprovalRuleSet {
  // Clean up common GPT formatting issues
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  let parsed: any

  try {
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('Raw GPT output:', raw)
    throw new Error('GPT returned invalid JSON')
  }

  if (
    !parsed ||
    !Array.isArray(parsed.dimensions) ||
    !Array.isArray(parsed.rules) ||
    !parsed.metadata
  ) {
    console.error('Parsed GPT output:', parsed)
    throw new Error('Invalid approval rule schema')
  }

  // 🔒 GUARANTEE APPROVER DIMENSION EXISTS
  const hasApprover = parsed.dimensions.some(
    (d: any) => d.key === 'approver'
  )

  if (!hasApprover) {
    // Add approver column
    parsed.dimensions.unshift({
      key: 'approver',
      label: 'Approver',
      type: 'enum',
    })

    // Default approver inference
    parsed.rules = parsed.rules.map((r: any) => ({
      approver: 'Procurement',
      ...r,
    }))

    parsed.metadata.assumptions = [
      ...(parsed.metadata.assumptions || []),
      'Approver inferred as Procurement because no explicit approver was provided.',
    ]
  }

  return parsed as ApprovalRuleSet
}
