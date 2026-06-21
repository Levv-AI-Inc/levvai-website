import WorkflowBuilder from '../../WorkflowBuilder'

export default function EditOnboardingWorkflowPage({
  params,
}: {
  params: { workflowId: string }
}) {
  return (
    <WorkflowBuilder
      workflowType="Onboarding"
      workflowId={params.workflowId}
    />
  )
}
