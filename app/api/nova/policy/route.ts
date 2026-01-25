import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type MasterData = Record<string, Array<Record<string, unknown>>>

function flattenMasterData(masterData: MasterData): string[] {
  const entities: string[] = []
  for (const [section, rows] of Object.entries(masterData || {})) {
    for (const row of rows || []) {
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.trim() && key !== 'status') {
          entities.push(`${section}:${key}:${value}`)
        }
      }
    }
  }
  return entities.slice(0, 500)
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    const masterDataRaw = form.get('masterData')

    if (!file || typeof file !== 'object' || !('arrayBuffer' in file) || !('name' in file)) {
      return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 })
    }
    if (typeof masterDataRaw !== 'string') {
      return NextResponse.json({ error: 'Master data payload missing.' }, { status: 400 })
    }

    const uploadedFile = file as globalThis.File
    const masterData = JSON.parse(masterDataRaw) as MasterData
    const entityIndex = flattenMasterData(masterData)

    const bytes = await uploadedFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    let inputMimeType = uploadedFile.type || 'text/plain'
    const lower = uploadedFile.name.toLowerCase()
    if (lower.endsWith('.pdf')) inputMimeType = 'application/pdf'
    else if (lower.endsWith('.docx')) inputMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    else if (lower.endsWith('.txt')) inputMimeType = 'text/plain'

    const systemPrompt = [
      'You are Nova AI inside a workforce management platform called Levv.',
      'Your job is to read workforce policy documents and extract enforceable operational rules.',
      'Be conservative. Only extract rules clearly stated in the document.',
      'Every rule must include a citation pointing to the section or clause.',
      '',
      'CRITICAL — Tab and key mapping rules. You must use EXACTLY these tab names and primary keys:',
      '',
      '1. "Business Units" (key: "businessUnit")',
      '   → Organizational divisions, departments, or business areas within the company.',
      '   → Examples: Finance, Technology, IT, Operations, Marketing, HR, Legal, Engineering.',
      '   → These are internal org units, NOT registered legal companies.',
      '',
      '2. "Cost Centers" (key: "costCenter")',
      '   → Budget or accounting codes used to track spend, e.g. CC-1001, IT-DEPT-02.',
      '',
      '3. "Locations" (key: "location")',
      '   → Geographic cities or regions where work is performed, e.g. New York, London, Toronto.',
      '',
      '4. "Worksites" (key: "worksite")',
      '   → Specific physical offices or remote designations, e.g. NYC HQ, Remote US.',
      '',
      '5. "Legal Entities" (key: "legalEntity")',
      '   → Registered legal corporate entities with registration IDs or jurisdiction filings.',
      '   → Examples: Acme Corp Inc., CWS Canada Ltd., XYZ GmbH.',
      '   → Do NOT use this for internal departments or divisions.',
      '',
      '6. "Subsidiaries" (key: "subsidiary")',
      '   → Subsidiary companies owned by the parent organization.',
      '',
      'RULE: If the policy mentions a department, division, or business area by name (e.g. Finance, IT, Marketing),',
      'that maps to "Business Units" with key "businessUnit" — NEVER to "Legal Entities".',
      '',
      'For each gap where a named entity is missing from the entity index:',
      '  - Set suggestedTab to one of the six exact tab names above.',
      '  - Set suggestedRowKey to the primary key for that tab.',
      '  - Set suggestedRowValue to the entity name extracted from the policy.',
      'Leave suggestedTab, suggestedRowKey, suggestedRowValue as empty strings when the gap',
      'is not directly representable as a master data row.',
      '',
      'For each extracted rule, you must also provide:',
      '  - triggerPoint: a short phrase (max 6 words) describing WHEN this rule fires during a workflow.',
      '    Examples: "At intake submission", "On supplier invitation", "At tenure threshold",',
      '    "Before work authorisation", "On classification review", "At exception request",',
      '    "On contract deviation", "Before engagement start".',
      '  - enforcementStatus: always "active" — every extracted rule is considered live once the policy is uploaded.',
      '',
      'Do not invent policy language. Be fully deterministic for the same input.',
    ].join('\n')

    const userText = [
      'Analyse the uploaded workforce policy and return structured JSON.',
      'Focus on:',
      '1) rate & classification rules',
      '2) tenure & duration limits',
      '3) supplier eligibility rules',
      '4) approval & exception triggers',
      '5) worker type constraints',
      '6) location / jurisdiction constraints',
      '',
      'Current backend entity index (what is already configured):',
      entityIndex.length > 0 ? entityIndex.join('\n') : '(empty — nothing configured yet)',
      '',
      'Any entity named in the policy but absent from the entity index above is a gap.',
      '"intake" = changes how a request is captured, validated, defaulted, or blocked.',
      '"configuration" = drives master data, routing, rate cards, supplier distribution, approvals.',
      '"both" = both apply.',
    ].join('\n')

    const response = await client.responses.create({
      model: 'gpt-4o',
      temperature: 0,
      store: false,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userText },
            {
              type: 'input_file',
              filename: uploadedFile.name,
              file_data: `data:${inputMimeType};base64,${base64}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'nova_policy_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              policyName: { type: 'string' },
              summary: { type: 'string' },
              activatedAt: { type: 'string' },
              counts: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  totalRules: { type: 'number' },
                  rateClassification: { type: 'number' },
                  tenureDuration: { type: 'number' },
                  supplierEligibility: { type: 'number' },
                  approvalException: { type: 'number' },
                },
                required: ['totalRules', 'rateClassification', 'tenureDuration', 'supplierEligibility', 'approvalException'],
              },
              rules: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    category: {
                      type: 'string',
                      enum: ['rate_classification', 'tenure_duration', 'supplier_eligibility', 'approval_exception', 'worker_type', 'location_jurisdiction'],
                    },
                    title: { type: 'string' },
                    statement: { type: 'string' },
                    citation: { type: 'string' },
                    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
                    enforcementType: { type: 'string', enum: ['intake', 'configuration', 'both'] },
                    // ── New fields ──────────────────────────────────────────
                    triggerPoint: { type: 'string' },
                    enforcementStatus: { type: 'string', enum: ['active', 'pending'] },
                    // ────────────────────────────────────────────────────────
                    suggestedField: { type: 'string' },
                    suggestedValue: { type: 'string' },
                    matchedEntity: { type: 'string' },
                    matched: { type: 'boolean' },
                  },
                  required: [
                    'id', 'category', 'title', 'statement', 'citation',
                    'severity', 'enforcementType', 'triggerPoint', 'enforcementStatus',
                    'suggestedField', 'suggestedValue', 'matchedEntity', 'matched',
                  ],
                },
              },
              gaps: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    recommendation: { type: 'string' },
                    relatedRuleIds: { type: 'array', items: { type: 'string' } },
                    suggestedTab: { type: 'string' },
                    suggestedRowKey: { type: 'string' },
                    suggestedRowValue: { type: 'string' },
                  },
                  required: ['id', 'severity', 'title', 'description', 'recommendation', 'relatedRuleIds', 'suggestedTab', 'suggestedRowKey', 'suggestedRowValue'],
                },
              },
              intakeImpacts: { type: 'array', items: { type: 'string' } },
              configChanges: { type: 'array', items: { type: 'string' } },
            },
            required: ['policyName', 'summary', 'activatedAt', 'counts', 'rules', 'gaps', 'intakeImpacts', 'configChanges'],
          },
        },
      },
    })

    const raw = response.output_text
    if (!raw) return NextResponse.json({ error: 'OpenAI returned an empty response.' }, { status: 500 })

    const parsed = JSON.parse(raw)
    if (!parsed.activatedAt || parsed.activatedAt.trim() === '') {
      parsed.activatedAt = new Date().toLocaleString()
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('Nova policy route error:', error)
    return NextResponse.json(
      { error: error?.message || 'Unexpected server error while analysing the policy.' },
      { status: 500 }
    )
  }
}