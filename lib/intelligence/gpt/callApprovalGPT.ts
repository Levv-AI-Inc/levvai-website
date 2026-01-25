import { callGPT } from './callGPT'
import { buildApprovalPrompt } from './buildApprovalPrompt'
import { parseApprovalResponse } from './parseApprovalResponse'
import { ApprovalRuleSet } from './types'

export async function callApprovalGPT(
  userInput: string
): Promise<ApprovalRuleSet> {
  const prompt = buildApprovalPrompt(userInput)

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

    return parseApprovalResponse(
    typeof response === 'string' ? response : response.content
    )

}
