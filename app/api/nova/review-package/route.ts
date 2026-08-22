// app/api/nova/review-package/route.ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { sowName, vendor, startDate, endDate, aiItems } = await req.json()

    const itemSummaries = aiItems.map((item: any, i: number) => `
Agent ${i + 1}: ${item.name}
- Platform: ${item.aiPlatform || 'Not specified'}
- Category: ${item.category || '—'}
- Purpose: ${item.purpose || '—'}
- Risk level: ${item.riskLevel || '—'}
- Data classification: ${item.dataClassification || '—'}
- Deployment model: ${item.deploymentModel || '—'}
- Human oversight: ${item.oversightLevel || '—'}
- Access scope: ${(item.accessScope || []).join(', ') || 'None defined'}
- Vendor retains data: ${item.vendorRetainsData === true ? 'Yes' : item.vendorRetainsData === false ? 'No' : 'Not confirmed'}
- Vendor trains on data: ${item.vendorTrainsOnData === true ? 'Yes' : item.vendorTrainsOnData === false ? 'No' : 'Not confirmed'}
- Compliance scope: ${(item.complianceScope || []).join(', ') || 'None specified'}
- Exit plan: ${item.exitPlan || 'Not defined'}
- Cost model: ${item.costModel || '—'}
- Estimated monthly cost: ${item.estimatedMonthlyCost ? `$${item.estimatedMonthlyCost}` : '—'}
- Spend cap: ${item.spendCap ? `$${item.spendCap}/mo` : 'None set'}
- Business owner: ${item.businessOwner || '—'}
- Technical owner: ${item.technicalOwner || '—'}
    `.trim()).join('\n\n')

    const needsDPIA = aiItems.some((i: any) => ['PII', 'Financial Data', 'Confidential'].includes(i.dataClassification))
    const needsSecurity = aiItems.some((i: any) => i.accessScope && i.accessScope.length > 0)
    const needsLegal = aiItems.some((i: any) => i.riskLevel === 'High' || ['PII', 'Financial Data', 'Confidential'].includes(i.dataClassification) || i.vendorTrainsOnData === true)
    const needsFinance = aiItems.some((i: any) => i.costModel === 'API Usage' || i.costModel === 'Usage Based')

    const sections = [
      needsDPIA && 'DPIA (Data Processing Impact Assessment)',
      needsSecurity && 'Security Review Questionnaire',
      needsLegal && 'Legal & DPA Checklist',
      needsFinance && 'Finance Control Sheet',
    ].filter(Boolean).join(', ')

    const prompt = `You are a senior enterprise risk and compliance analyst preparing an AI agent governance review package for a procurement team. Generate a professional, realistic pre-filled review package for the following SOW engagement.

SOW: ${sowName || 'Unnamed SOW'}
Vendor: ${vendor || 'Not specified'}
Period: ${startDate || '—'} to ${endDate || '—'}

AI AGENTS UNDER THIS SOW:
${itemSummaries}

Generate the following sections (only those listed): ${sections}

Format rules:
- Use clear section headers in ALL CAPS with a line of dashes beneath
- Pre-fill every field using the actual data provided above — do not use placeholders like [INSERT]
- Where data is missing, write "Not confirmed — requires completion before approval"
- Be specific and realistic. Write as if this is an actual enterprise governance document
- Each section should include a "Prepared by Nova AI — draft for reviewer verification" footer line

For DPIA: include description of processing activities, data subjects, legal basis, retention, cross-border transfer risk, identified risks, and proposed mitigations — all drawn from the agent data above.
For Security Review Questionnaire: scope the control questions specifically to the access systems listed in each agent's access scope. Include authentication, logging, incident response, and data egress controls.
For Legal & DPA Checklist: include DPA required y/n, AI-specific rider required y/n, model training opt-out clause required y/n, indemnification posture, and liability cap — reasoned from the agent data.
For Finance Control Sheet: include spend cap confirmation, escalation path, overage policy, and review cadence — drawn from the spend governance fields.

Do not include any preamble or closing remarks outside the document sections themselves.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
    })

    const content = completion.choices[0]?.message?.content || ''
    return NextResponse.json({ ok: true, content })
  } catch (err) {
    console.error('[nova/review-package]', err)
    return NextResponse.json({ ok: false, content: '' }, { status: 500 })
  }
}