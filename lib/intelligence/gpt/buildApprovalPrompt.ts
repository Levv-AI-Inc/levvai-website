export function buildApprovalPrompt(userInput: string) {
  return `
You are an enterprise configuration assistant.

CRITICAL OUTPUT RULES (MUST FOLLOW):
- Return ONLY a valid JSON object
- Do NOT include explanations
- Do NOT include markdown
- Do NOT include code fences
- Do NOT include any text before or after the JSON


Return JSON in EXACTLY this schema:

{
  "dimensions": [
    { "key": "approver", "label": "Approver", "type": "enum" },
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

IMPORTANT RULES:
- "approver" MUST always be included as a dimension
- If the approver is implied but not named, infer it and record the inference in metadata.assumptions

User requirement:
"${userInput}"
`
}
