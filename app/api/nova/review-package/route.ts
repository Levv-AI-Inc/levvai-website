import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIClient } from '@/lib/intelligence/gpt/client'

export const runtime = 'nodejs'

const MODEL = 'gpt-4o-mini'

type ReviewPackageItem = {
  name?: string
  aiPlatform?: string
  category?: string
  purpose?: string
  riskLevel?: string
  dataClassification?: string
  deploymentModel?: string
  oversightLevel?: string
  accessScope?: string[]
  vendorRetainsData?: boolean
  vendorTrainsOnData?: boolean
  complianceScope?: string[]
  exitPlan?: string
  costModel?: string
  spendCap?: number
  alertThreshold?: number
  spendApprover?: string
  reviewCadence?: string
}

function boolLabel(value: boolean | undefined) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'Not confirmed'
}

function moneyLabel(value: number | undefined) {
  return value ? `$${value.toLocaleString()}` : 'Not provided'
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sowName?: string
      vendor?: string
      startDate?: string
      endDate?: string
      aiItems?: ReviewPackageItem[]
    }

    const aiItems = Array.isArray(body.aiItems) ? body.aiItems : []

    if (!aiItems.length) {
      return NextResponse.json(
        { ok: false, error: 'No AI automation items were provided.' },
        { status: 400 },
      )
    }

    const itemSummaries = aiItems
      .map((item, index) =>
        [
          `Agent ${index + 1}: ${item.name || 'Unnamed AI item'}`,
          `- Platform: ${item.aiPlatform || 'Not specified'}`,
          `- Category: ${item.category || 'Not specified'}`,
          `- Purpose: ${item.purpose || 'Not confirmed'}`,
          `- Risk level: ${item.riskLevel || 'Not specified'}`,
          `- Data classification: ${item.dataClassification || 'Not specified'}`,
          `- Deployment model: ${item.deploymentModel || 'Not specified'}`,
          `- Human oversight: ${item.oversightLevel || 'Not specified'}`,
          `- Access scope: ${item.accessScope?.join(', ') || 'None defined'}`,
          `- Vendor retains data: ${boolLabel(item.vendorRetainsData)}`,
          `- Vendor trains on data: ${boolLabel(item.vendorTrainsOnData)}`,
          `- Compliance scope: ${item.complianceScope?.join(', ') || 'None specified'}`,
          `- Exit plan: ${item.exitPlan || 'Not defined'}`,
          `- Cost model: ${item.costModel || 'Not specified'}`,
          `- Spend cap: ${moneyLabel(item.spendCap)}`,
          `- Alert threshold: ${item.alertThreshold ? `${item.alertThreshold}%` : 'Not provided'}`,
          `- Spend approver: ${item.spendApprover || 'Not provided'}`,
          `- Review cadence: ${item.reviewCadence || 'Not provided'}`,
        ].join('\n'),
      )
      .join('\n\n')

    const sensitiveClasses = new Set(['PII', 'Financial Data', 'Confidential'])
    const needsDpia = aiItems.some((item) => item.dataClassification && sensitiveClasses.has(item.dataClassification))
    const needsSecurity = aiItems.some((item) => item.accessScope && item.accessScope.length > 0)
    const needsLegal = aiItems.some(
      (item) =>
        item.riskLevel === 'High' ||
        (item.dataClassification && sensitiveClasses.has(item.dataClassification)) ||
        item.vendorTrainsOnData === true,
    )
    const needsFinance = aiItems.some((item) => item.costModel === 'API Usage' || item.costModel === 'Usage Based')

    const sections = [
      needsDpia && 'DPIA (Data Processing Impact Assessment)',
      needsSecurity && 'Security Review Questionnaire',
      needsLegal && 'Legal & DPA Checklist',
      needsFinance && 'Finance Control Sheet',
    ].filter(Boolean)

    if (!sections.length) {
      sections.push('AI Governance Summary')
    }

    const prompt = `You are Nova, a senior enterprise risk and compliance analyst preparing an AI agent governance review package for a procurement team. Generate a professional, realistic pre-filled review package for the following SOW engagement.

SOW: ${body.sowName || 'Unnamed SOW'}
Vendor: ${body.vendor || 'Not specified'}
Period: ${body.startDate || 'Not provided'} to ${body.endDate || 'Not provided'}

AI AGENTS UNDER THIS SOW:
${itemSummaries}

Generate these sections only:
${sections.map((section) => `- ${section}`).join('\n')}

Format rules:
- Use clear section headers in ALL CAPS with a divider line underneath.
- Pre-fill every field using the actual data provided above.
- Where data is missing, write "Not confirmed - requires completion before approval".
- Be specific and realistic. Write as if this is an actual enterprise governance document.
- Each section should include "Prepared by Nova AI - draft for reviewer verification".

For DPIA: include processing activities, data subjects, legal basis, retention, cross-border transfer risk, identified risks, and proposed mitigations.
For Security Review Questionnaire: scope the control questions to the access systems listed for each agent, including authentication, logging, incident response, and data egress controls.
For Legal & DPA Checklist: include whether a DPA is required, whether an AI-specific rider is required, whether a model-training opt-out clause is required, indemnification posture, and liability-cap considerations.
For Finance Control Sheet: include spend cap confirmation, escalation path, overage policy, and review cadence.

Do not include preamble or closing remarks outside the document sections.`

    const completion = await getOpenAIClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2500,
    })

    const content = completion.choices?.[0]?.message?.content?.trim() || ''
    return NextResponse.json({ ok: true, content })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate review package.'
    return NextResponse.json({ ok: false, error: message, content: '' }, { status: 500 })
  }
}
