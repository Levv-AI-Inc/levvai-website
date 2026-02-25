import type { GPTMessage } from '@/lib/intelligence/gpt/callGPT'

export function buildNovaPrompt(input: {
  sowType: string
  pricingModel: string | null
  billingFrequency: string | null
  scopeSummary: string
  expectedPatterns: {
    expectedPricing: string[]
    discouragedPricing: string[]
    semanticIndicators: string[]
  }
}): GPTMessage[] {
  return [
    {
      role: 'system',
      content: `
You are Nova Scanner.

You MUST return a valid JSON object and nothing else.

Rules:
- Do NOT explain
- Do NOT add commentary
- Do NOT include markdown
- Do NOT include text outside JSON

Return EXACTLY this shape:

{
  "findings": [
    {
      "type": "misalignment" | "missing",
      "dimension": "commercials" | "scope" | "structure",
      "message": "string",
      "confidence": "low" | "medium" | "high"
    }
  ]
}

If no issues are found, return:

{ "findings": [] }
`,
    },
    {
      role: 'user',
      content: JSON.stringify(input, null, 2),
    },
  ]
}
