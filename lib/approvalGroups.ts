'use client'

export type ApprovalGroupDecisionRule = 'all' | 'any'

export type ApprovalGroupMember = {
  id: string
  name: string
  email: string
  title?: string
}

export type ApprovalGroup = {
  id: string
  name: string
  description: string
  decisionRule: ApprovalGroupDecisionRule
  members: ApprovalGroupMember[]
  updatedAt: string
}

export const APPROVAL_GROUPS_STORAGE_KEY = 'levv_approval_groups'
export const APPROVAL_GROUPS_CHANGED_EVENT = 'levv:approval-groups-changed'

const SEED_GROUPS: ApprovalGroup[] = [
  {
    id: 'ONBOARDING_APPROVERS',
    name: 'Onboarding Approvers',
    description: 'Cross-functional approval group for worker onboarding and access readiness.',
    decisionRule: 'any',
    members: [
      { id: 'p1', name: 'Dana Reyes', email: 'dana.reyes@example.com', title: 'HR Business Partner' },
      { id: 'p3', name: 'Priya Nair', email: 'priya.nair@example.com', title: 'Senior Counsel' },
      { id: 'p6', name: 'Sam Patel', email: 'sam.patel@example.com', title: 'IT Admin' },
    ],
    updatedAt: '2026-09-26T00:00:00.000Z',
  },
  {
    id: 'HR',
    name: 'People Ops sign-off',
    description: 'People Operations and HR approvals.',
    decisionRule: 'any',
    members: [
      { id: 'p1', name: 'Dana Reyes', email: 'dana.reyes@example.com', title: 'HR Business Partner' },
      { id: 'p2', name: 'Tom Okafor', email: 'tom.okafor@example.com', title: 'People Ops Lead' },
    ],
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'LEGAL',
    name: 'Legal sign-off',
    description: 'Legal review and policy approval.',
    decisionRule: 'all',
    members: [{ id: 'p3', name: 'Priya Nair', email: 'priya.nair@example.com', title: 'Senior Counsel' }],
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'SECURITY',
    name: 'Security review',
    description: 'Security, access, and risk approvals.',
    decisionRule: 'any',
    members: [
      { id: 'p4', name: 'Alex Stone', email: 'alex.stone@example.com', title: 'Security Analyst' },
      { id: 'p5', name: 'Jin Park', email: 'jin.park@example.com', title: 'Security Lead' },
    ],
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'IT',
    name: 'IT provisioning',
    description: 'IT access and provisioning approvals.',
    decisionRule: 'any',
    members: [
      { id: 'p6', name: 'Sam Patel', email: 'sam.patel@example.com', title: 'IT Admin' },
      { id: 'p7', name: 'Lena Cho', email: 'lena.cho@example.com', title: 'Systems Engineer' },
    ],
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'PROCUREMENT',
    name: 'Vendor & insurance sign-off',
    description: 'Supplier, insurance, and procurement approvals.',
    decisionRule: 'any',
    members: [
      { id: 'p8', name: 'Sarah Chen', email: 'sarah.chen@example.com', title: 'Procurement Lead' },
      { id: 'p9', name: 'Marcus Lee', email: 'marcus.lee@example.com', title: 'Vendor Manager' },
    ],
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'FINANCE',
    name: 'Finance sign-off',
    description: 'Finance and payment approvals.',
    decisionRule: 'all',
    members: [{ id: 'p10', name: 'Olu Bello', email: 'olu.bello@example.com', title: 'Controller' }],
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
]

function isApprovalGroup(value: unknown): value is ApprovalGroup {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<ApprovalGroup>
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.description === 'string' &&
    (row.decisionRule === 'all' || row.decisionRule === 'any') &&
    Array.isArray(row.members)
  )
}

export function getApprovalGroups(): ApprovalGroup[] {
  if (typeof window === 'undefined') return SEED_GROUPS

  try {
    const raw = window.localStorage.getItem(APPROVAL_GROUPS_STORAGE_KEY)
    if (!raw) return SEED_GROUPS
    const parsed = JSON.parse(raw)
    const storedGroups = Array.isArray(parsed)
      ? parsed.filter(isApprovalGroup)
      : SEED_GROUPS
    const onboardingGroup = SEED_GROUPS[0]
    if (!storedGroups.some((group) => group.id === onboardingGroup.id)) {
      const migratedGroups = [onboardingGroup, ...storedGroups]
      saveApprovalGroups(migratedGroups)
      return migratedGroups
    }
    return storedGroups
  } catch {
    return SEED_GROUPS
  }
}

export function saveApprovalGroups(groups: ApprovalGroup[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(APPROVAL_GROUPS_STORAGE_KEY, JSON.stringify(groups))
  window.dispatchEvent(new CustomEvent(APPROVAL_GROUPS_CHANGED_EVENT))
}

export function getApprovalGroup(id: string): ApprovalGroup | undefined {
  return getApprovalGroups().find((group) => group.id === id)
}

export function createApprovalGroupId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'approval-group'}-${Date.now().toString(36)}`
}
