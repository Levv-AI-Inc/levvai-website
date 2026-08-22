import { NextResponse } from 'next/server'
import { callApprovalGPT } from '@/lib/intelligence/gpt/callApprovalGPT'

export async function POST(req: Request) {
  try {
    const { input } = await req.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      )
    }

    // ✅ callApprovalGPT already returns a parsed ApprovalRuleSet
    const rules = await callApprovalGPT(input)

    return NextResponse.json(rules)
  } catch (err: any) {
    console.error('[Approval Parse] ERROR:', err)

    return NextResponse.json(
      { error: err.message || 'Approval parse failed' },
      { status: 500 }
    )
  }
}
