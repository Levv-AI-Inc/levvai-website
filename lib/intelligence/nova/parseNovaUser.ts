import { callGPT } from '../gpt/callGPT'
import { buildNovaUserPrompt } from './buildNovaUserPrompt'
import { parseNovaUserResponse } from './parseNovaUserResponse'

export async function parseNovaUser(input: string) {
  // Build Nova-style messages (system + user)
  const messages = buildNovaUserPrompt(input)

  // Call existing GPT infrastructure (CORRECT)
  const rawResponse = await callGPT(messages)

  // Parse + validate
  return parseNovaUserResponse(rawResponse)
}
