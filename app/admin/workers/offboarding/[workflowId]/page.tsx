import WorkflowBuilder from '../../WorkflowBuilder'

export default function EditOffboardingWorkflowPage({
  params,
}: {
  params: { workflowId: string }
}) {
  return (
    <WorkflowBuilder
      workflowType="Offboarding"
      workflowId={params.workflowId}
    />
  )
}
