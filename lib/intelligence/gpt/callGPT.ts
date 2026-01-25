import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export type GPTMessage = {
  role: 'system' | 'user'
  content: string
}

export async function callGPT(messages: GPTMessage[]) {
  const response = await client.responses.create({
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

