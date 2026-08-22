import { NextRequest, NextResponse } from 'next/server'

const MODEL = 'gpt-4o-mini'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tasks, costAllocations } = body as {
      tasks: { id: string; name: string }[]
      costAllocations: { costCenter: string; taskCode: string; label: string }[]
    }

    if (!costAllocations || costAllocations.length === 0) {
      return NextResponse.json(
        { error: 'No cost allocations configured on this Work Order.' },
        { status: 400 }
      )
    }

    // No inference needed — most WOs have exactly one allocation (per the FG
    // model: "usually associated with only one cost center"). Assign it
    // directly without a model call.
    if (costAllocations.length === 1) {
      const only = costAllocations[0]
      return NextResponse.json({
        assignments: tasks.map((t) => ({
          taskId: t.id,
          costCenter: only.costCenter,
          taskCode: only.taskCode,
          rationale: 'Only one cost allocation is configured on this Work Order.',
        })),
      })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not set in .env.local' },
        { status: 500 }
      )
    }

    const allocationList = costAllocations
      .map((a) => `- ${a.costCenter} (${a.taskCode}): ${a.label}`)
      .join('\n')
    const taskList = tasks.map((t) => `- [${t.id}] ${t.name}`).join('\n')

    const prompt = `You are Nova, matching each timesheet task description to the correct cost center and task code from this Work Order's configured allocations. Choose only from the allocations listed below — never invent a new one. If a task description doesn't clearly match any allocation, pick the closest reasonable match rather than leaving it unassigned.

Configured allocations on this Work Order:
${allocationList}

Tasks to classify:
${taskList}

Respond with ONLY a JSON array, no other text, no markdown fences, in this exact shape:
[{"taskId": "...", "costCenter": "...", "taskCode": "...", "rationale": "one short sentence, under 12 words"}]`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({ error: `OpenAI error: ${errText}` }, { status: 500 })
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '[]'
    const cleaned = raw.replace(/```json|```/g, '').trim()

    let assignments
    try {
      assignments = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Nova returned an unexpected format. Try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ assignments })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}