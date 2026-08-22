import { ApprovalRuleSet } from './types'

export function buildApprovalEvolutionPrompt(
  existingRules: ApprovalRuleSet,
  userInput: string
) {
  return `
You are an enterprise configuration assistant.

You are updating existing approval rules based on new user input.

RULES:
- Do NOT remove existing dimensions or rules
- Add new dimensions ONLY if explicitly required
- Preserve existing logic
- Only return valid JSON
- Follow the schema exactly

Existing approval rules:
${JSON.stringify(existingRules, null, 2)}

Schema:
{
  "dimensions": [
    { "key": string, "label": string, "type": "enum" | "number" | "string" }
  ],
  "rules": [
    { "<dimensionKey>": "<value>" }
  ],
  "metadata": {
    "assumptions": string[],
    "gaps": string[]
  }
}

User input:
"${userInput}"
`
}
