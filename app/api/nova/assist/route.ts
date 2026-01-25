import { NextResponse } from 'next/server'
import { callGPT } from '@/lib/intelligence/gpt/callGPT'
import { buildAssistPrompt } from '@/lib/intelligence/assist/buildAssistPrompt'
import { parseAssistResponse } from '@/lib/intelligence/assist/parseAssistResponse'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const sowType = String(body?.sowType ?? '')
    const rawDescription = String(body?.rawDescription ?? '')

    if (!rawDescription.trim()) {
      return NextResponse.json({
        ok: true,
        improvedDescription: '',
      })
    }

    const messages = buildAssistPrompt({
      sowType,
      rawDescription,
    })

    const raw = await callGPT(messages)
    const improvedDescription = parseAssistResponse(raw)

    return NextResponse.json({
      ok: true,
      improvedDescription,
    })
  } catch (err) {
    console.error('Nova Assist error:', err)
    return NextResponse.json(
      { ok: false },
      { status: 500 }
    )
  }
}
