import { NextResponse } from 'next/server'

type DemoPayload = {
  firstName: string
  company: string
  workEmail: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<DemoPayload>
  const firstName = body.firstName?.trim() || ''
  const company = body.company?.trim() || ''
  const workEmail = body.workEmail?.trim() || ''

  if (!firstName || !company || !workEmail) {
    return NextResponse.json(
      { error: 'First name, company, and work email are required.' },
      { status: 400 }
    )
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Email service is not configured (missing RESEND_API_KEY).' },
      { status: 500 }
    )
  }

  const to = 'faraz.chatta@levvai.com'
  const from = 'abdullah.mohamed@levvai.com'
  const subject = 'New demo request'
  const text = [
    `First name: ${firstName}`,
    `Company: ${company}`,
    `Work email: ${workEmail}`,
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    return NextResponse.json(
      { error: 'Failed to send email', detail },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
