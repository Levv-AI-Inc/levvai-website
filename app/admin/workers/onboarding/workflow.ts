
export type Workflow = {
  id: string
  name: string
  status: 'Draft'
  active: boolean
}


let workflows: Workflow[] = [
  {
  id: 'policy-us-it-v1',
  name: 'US IT Worker',
  status: 'Draft',
  active: true,
}
]

export function getWorkflows() {
  return workflows
}

export function addWorkflow(workflow: Workflow) {
  workflows = [...workflows, workflow]
}
export function toggleWorkflowActive(id: string) {
  workflows = workflows.map((w) =>
    w.id === id ? { ...w, active: !w.active } : w
  )
}

export function deleteWorkflow(id: string) {
  workflows = workflows.filter((w) => w.id !== id)
}
