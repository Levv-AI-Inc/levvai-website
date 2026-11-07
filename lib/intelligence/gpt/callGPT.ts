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

export type GPTOptions = {
  temperature?: number
  signal?: AbortSignal
}

export async function callGPT(messages: GPTMessage[], options: GPTOptions = {}) {
  const openai = getOpenAIClient()

  const response = await openai.responses.create(
    {
      model: 'gpt-4.1-mini',
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      input: messages.map(m => ({
        role: m.role,
        content: [
          {
            type: 'input_text',
            text: m.content,
          },
        ],
      })),
    },
    options.signal ? { signal: options.signal } : undefined,
  )

  const text = (response.output_text || '').trim()
  console.log('GPT RAW OUTPUT:', text)

  return text
}
