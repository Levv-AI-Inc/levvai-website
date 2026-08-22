import { NextResponse } from 'next/server'
import { callGPT } from '@/lib/intelligence/gpt/callGPT'
import { buildNovaPrompt } from '@/lib/intelligence/nova/buildNovaPrompt'
import { parseNovaResponse } from '@/lib/intelligence/nova/parseNovaResponse'
import { EXPECTED_ALIGNMENT } from '@/lib/intelligence/nova/expectations'

export const runtime = 'nodejs' // 🔴 REQUIRED

function normalizeWorkType(workType: string | null) {
  if (!workType) return null
  const v = workType.toLowerCase()

  // Managed Services / MSP
  if (
    v.includes('managed') ||
    v.includes('msp') ||
    v.includes('managed service provider') ||
    v.includes('operations') ||
    v.includes('support')
  ) {
    return 'managed_services'
  }

  // Implementation / Project
  if (
    v.includes('implement') ||
    v.includes('project') ||
    v.includes('deployment') ||
    v.includes('go-live')
  ) {
    return 'implementation'
  }

  // Advisory / Consulting
  if (v.includes('advisory') || v.includes('consult')) {
    return 'advisory'
  }

  return null
}

export async function POST(req: Request) {
  try {
   console.log('SCAN ROUTE HIT')

    const body = await req.json()

    const workType = String(body?.workType ?? '')
    const pricingModel = body?.pricingModel
      ? String(body.pricingModel)
      : null
    const billingFrequency = body?.billingFrequency
      ? String(body.billingFrequency)
      : null
    const scopeSummary = String(body?.scopeSummary ?? '')

   

    // 🟢 NEW: pull vendor + allocations (non-breaking)
    const vendor = String(body?.vendor ?? '')
    const allocations = Array.isArray(body?.allocations)
      ? body.allocations
      : []

    console.log('NOVA DEBUG INPUT', {
      workType,
      scopeSummary,
      normalizedFromWorkType: normalizeWorkType(workType),
      normalizedFromScope: normalizeWorkType(scopeSummary),
    })

    let key = normalizeWorkType(workType)

    console.log('SCAN INPUT vendor/allocations', { vendor, allocationsCount: allocations.length })

    // 🔑 Fallback: infer intent from scope text
    if (!key && scopeSummary) {
      key = normalizeWorkType(scopeSummary)
    }

    // 🔑 Final fallback: semantic intent inference
    if (!key && scopeSummary.toLowerCase().includes('managed service')) {
      key = 'managed_services'
    }

    const expectedPatterns = key
      ? EXPECTED_ALIGNMENT[key as keyof typeof EXPECTED_ALIGNMENT]
      : null

    // 🧠 COLLECT FINDINGS (NEW)
    const findings: any[] = []

    // --------------------------------------------------
    // 🟡 RULE: Consulting + Acme + Finance cost center
    // --------------------------------------------------
    const isConsulting = key === 'advisory'
    const isAcme = vendor.toLowerCase().includes('acme')

    const hasFinanceCostCenter = allocations.some(a => {
      const name = String(a?.costCenterName || '').toLowerCase()
      return name.includes('finance') || name.includes('financial')
    })

    if (isConsulting && isAcme && hasFinanceCostCenter) {
      findings.push({
        type: 'misalignment',
        dimension: 'structure',
        message:
          'Finance-related cost centers are not typically used for consulting engagements with this vendor. This selection has historically required additional internal justification.',
        confidence: 'medium',
      })
    }

    // --------------------------------------------------
    // 🔒 If we have no expectations, return structural findings only
    // --------------------------------------------------
    if (!expectedPatterns) {
      return NextResponse.json({
        ok: true,
        findings,
      })
    }

    // 🧠 GPT TRIANGULATION (UNCHANGED)
    const messages = buildNovaPrompt({
      sowType: workType,
      pricingModel,
      billingFrequency,
      scopeSummary,
      expectedPatterns,
    })

    const raw = await callGPT(messages)
    const gptFindings = parseNovaResponse(raw)

    return NextResponse.json({
      ok: true,
      findings: [...findings, ...gptFindings],
    })
  } catch (err) {
    console.error('Nova scan error:', err)
    return NextResponse.json(
      { ok: false, findings: [] },
      { status: 500 }
    )
  }
}
