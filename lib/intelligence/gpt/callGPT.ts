import OpenAI from 'openai'

let client: OpenAI | null = null

function getOpenAIClient() {
  if (client) return client

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not configured.'
    )
  }

  client = new OpenAI({ apiKey })
  return client
}

export type GPTMessage = {
  role: 'system' | 'user'
  content: string
}

export async function callGPT(messages: GPTMessage[]) {
  const openai = getOpenAIClient()

  const response = await openai.responses.create({
    model: 'gpt-4.1-mini',
    input: messages.map(m => ({
      role: m.role,
      content: [
        {
          type: 'input_text',
          text: m.content,
        },
      ],
    })),
  })

  const text = (response.output_text || '').trim()
  console.log('GPT RAW OUTPUT:', text)

  return text
}
