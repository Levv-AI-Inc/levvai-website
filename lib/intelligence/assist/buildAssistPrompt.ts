import type { GPTMessage } from '@/lib/intelligence/gpt/callGPT'

export function buildAssistPrompt({
  sowType,
  rawDescription,
}: {
  sowType: string
  rawDescription: string
}): GPTMessage[] {
  return [
    {
      role: 'system',
      content:
        'You assist users in clearly articulating Statements of Work. You do not validate, assess risk, or provide opinions.',
    },
    {
      role: 'user',
      content: `
SOW Type: ${sowType}

User Draft Description:
${rawDescription}

Task:
Rewrite the description to be clearer and more professional.
Do not add scope, obligations, or assumptions.
Return only the improved description text.
`,
    },
  ]
}
