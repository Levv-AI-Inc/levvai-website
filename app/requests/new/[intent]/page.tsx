import { notFound, redirect } from 'next/navigation'

export default function IntentPage({ params }: { params: { intent: string } }) {
  const validIntents = ['job_posting', 'sow', 'sourcing', 'guided']

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

  // keep placeholders for now (we’ll wire later)
  if (params.intent === 'sourcing') {
    redirect('/requests/new/sourcing')
  }

  if (params.intent === 'guided') {
    redirect('/requests/new/guided')
  }

  return null
}
