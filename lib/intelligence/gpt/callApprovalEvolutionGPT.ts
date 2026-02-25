import { callGPT } from './callGPT'
import { ApprovalRuleSet } from './types'
import { buildApprovalEvolutionPrompt } from './buildApprovalEvolutionPrompt'
import { parseApprovalResponse } from './parseApprovalResponse'

export async function callApprovalEvolutionGPT(
  existingRules: ApprovalRuleSet,
  userInput: string
): Promise<ApprovalRuleSet> {
  const prompt = buildApprovalEvolutionPrompt(existingRules, userInput)

  const response = await callGPT([
    {
      role: 'system',
      content:
        'You are an enterprise approval configuration assistant.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ])

  return parseApprovalResponse(response)
}
