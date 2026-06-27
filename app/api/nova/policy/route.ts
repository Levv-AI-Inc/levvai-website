import { NextResponse } from 'next/server'

function extensionFor(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName)
  return match?.[1]?.toLowerCase() || 'document'
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Policy file is required.' },
        { status: 400 },
      )
    }

    const now = new Date()
    const fileName = file.name || 'Uploaded policy'

    return NextResponse.json({
      policyName: fileName.replace(/\.[^.]+$/, '') || 'Uploaded policy',
      summary:
        'Policy uploaded. Nova extracted a local draft summary for configuration review.',
      activatedAt: now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      counts: {
        totalRules: 3,
        rateClassification: 1,
        tenureDuration: 1,
        supplierEligibility: 1,
        approvalException: 0,
      },
      rules: [
        {
          id: 'policy-local-rate',
          category: 'rate_classification',
          title: 'Rate policy review',
          statement:
            'Review rate ceilings from the uploaded policy before publishing intake controls.',
          citation: `${extensionFor(fileName).toUpperCase()} upload`,
          severity: 'medium',
          enforcementType: 'configuration',
          triggerPoint: 'Admin configuration',
          enforcementStatus: 'pending',
        },
      ],
      gaps: [
        {
          id: 'policy-local-business-unit-gap',
          severity: 'medium',
          title: 'Confirm business unit coverage',
          description:
            'Validate that policy-scoped business units exist in company master data.',
          recommendation:
            'Upload business units or add missing units before activating policy enforcement.',
          relatedRuleIds: ['policy-local-rate'],
          suggestedTab: 'Business Units',
          suggestedRowKey: 'businessUnit',
          suggestedRowValue: 'Policy Scoped Unit',
        },
      ],
      intakeImpacts: [
        'Use extracted policy rules to guide intake validations after admin review.',
      ],
      configChanges: [
        'Confirm business units, cost centers, and locations referenced by policy scope.',
      ],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to analyse policy.',
      },
      { status: 500 },
    )
  }
}
