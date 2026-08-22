import { NextResponse } from 'next/server'
import { parseNovaUser } from '@/lib/intelligence/nova/parseNovaUser'

export async function POST(req: Request) {
  try {
    const { input } = await req.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 },
      )
    }

    const result = await parseNovaUser(input)

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'User parse failed' },
      { status: 500 },
    )
  }
}
