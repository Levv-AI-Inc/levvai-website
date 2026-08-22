export async function novaImproveDescription(payload: {
  sowType: string
  rawDescription: string
}) {
  const res = await fetch('/api/nova/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return res.json()
}
// ===== Approval: initial parse =====
export async function parseApprovalRules(input: string) {
  const res = await fetch('/api/approval/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  })

  return res.json()
}

// ===== Approval: evolve existing rules =====
export async function evolveApprovalRules(payload: {
  existingRules: any
  input: string
}) {
  const res = await fetch('/api/approval/evolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return res.json()
}
// ===== Users: initial parse =====
export async function parseUser(input: string) {
  const res = await fetch('/api/users/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  })

  return res.json()
}
