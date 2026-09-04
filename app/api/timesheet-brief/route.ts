import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIClient } from '@/lib/intelligence/gpt/client'

const MODEL = 'gpt-4o-mini'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      workerName,
      assignment,
      jurisdiction,
      weekTotal,
      expectedHours,
      deviationPct,
      tasks,
      qaIssues,
      anomalyReason,
      daysCovered,
      totalDays,
      historicalAvg,
      historicalWeeksOverExpected,
      historicalWeeksCount,
      jurisdictionFlags, // [{ text, severity: 'high' | 'info' }]
    } = body

    const hasHighSeverityJurisdictionFlag = (jurisdictionFlags ?? []).some(
      (f: { severity: string }) => f.severity === 'high'
    )

    let recommendation: 'Approve' | 'Approve with note' | 'Needs review before approval'
    if (qaIssues && qaIssues.length > 0) {
      recommendation = 'Needs review before approval'
    } else if (hasHighSeverityJurisdictionFlag) {
      recommendation = 'Needs review before approval'
    } else if (deviationPct >= 15 && !anomalyReason?.trim()) {
      recommendation = 'Needs review before approval'
    } else if (deviationPct >= 15 && anomalyReason?.trim()) {
      recommendation = 'Approve with note'
    } else if (historicalWeeksOverExpected >= 3 && historicalWeeksCount) {
      recommendation = 'Approve with note'
    } else if ((jurisdictionFlags ?? []).length > 0) {
      recommendation = 'Approve with note'
    } else {
      recommendation = 'Approve'
    }

    const taskSummary = (tasks ?? [])
      .map((t: { name: string; total: number }) => `${t.name}: ${t.total}h`)
      .join(', ')

    const firstName = (workerName || 'The worker').split(' ')[0]

    const jurisdictionSummary =
      (jurisdictionFlags ?? []).length > 0
        ? jurisdictionFlags.map((f: { text: string }) => f.text).join(' ')
        : 'none'

    const prompt = `You are writing a short approval brief for a manager reviewing ${firstName}'s weekly timesheet. A recommendation has already been determined by rule-based logic — your only job is to explain it clearly using the facts below. Do not change the recommendation. Do not invent any fact, percentage, or comparison not listed here. Refer to the person by first name (${firstName}), never as "the contractor" or "the worker."

Recommendation (already decided, do not alter): ${recommendation}

This week's facts:
- Assignment: ${assignment} (jurisdiction: ${jurisdiction})
- Total hours submitted: ${weekTotal} (expected: ${expectedHours})
- Deviation from expected hours: ${deviationPct}%
- Days with hours logged: ${daysCovered} of ${totalDays}
- Task breakdown: ${taskSummary || 'none listed'}
- ${firstName}'s stated reason for any deviation: ${anomalyReason || 'none provided'}
- Data quality issues flagged before submission: ${
      qaIssues && qaIssues.length > 0 ? qaIssues.join('; ') : 'none'
    }
- Jurisdiction compliance flags (${jurisdiction} labor rules): ${jurisdictionSummary}

Trend context (${firstName}'s last ${historicalWeeksCount ?? 0} submitted weeks on this assignment):
- Average hours per week: ${historicalAvg ?? 'not available'}
- Weeks at or above expected hours: ${historicalWeeksOverExpected ?? 'not available'} of ${historicalWeeksCount ?? 0}

Output format, plain text, no markdown symbols other than the dashes shown:
Recommendation: ${recommendation}
- (one bullet about this week's hours/task facts)
- (one bullet using the trend context, OR the jurisdiction flag if one exists — jurisdiction compliance takes priority if both are present)
- (one more bullet only if there's a distinct third fact worth flagging — otherwise omit)

Each bullet must be a single sentence, under 22 words, directly tied to a fact listed above. If a jurisdiction flag exists, it must appear in a bullet — this is the most important thing a manager needs to know before approving.`

    const response = await getOpenAIClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 260,
    })
    const brief = response.choices?.[0]?.message?.content?.trim() ?? 'Unable to generate brief.'

    return NextResponse.json({ brief, recommendation })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
