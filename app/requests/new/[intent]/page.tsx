import { notFound, redirect } from 'next/navigation'

export default function IntentPage({ params }: { params: { intent: string } }) {
  const validIntents = ['job_posting', 'sow', 'source', 'sourcing', 'guided']

  if (!validIntents.includes(params.intent)) {
    notFound()
  }

  if (params.intent === 'sow') {
    redirect('/requests/sow/create')
  }

  // ✅ Option A: CW Intake
  if (params.intent === 'job_posting') {
    redirect('/requests/new/job/create/define')
  }

  if (params.intent === 'source' || params.intent === 'sourcing') {
    redirect('/requests/new/guided')
  }

  if (params.intent === 'guided') {
    redirect('/requests/new/guided')
  }

  return null
}
