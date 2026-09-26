export type AccessRoleDefinition = {
  value: string
  label: string
  description: string
  permissions: string[]
}

/**
 * Tenant access roles are deliberately separate from worker classifications,
 * supplier contacts, and the job/rate roles managed under /admin/roles.
 */
export const ACCESS_ROLES: AccessRoleDefinition[] = [
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full tenant configuration and user administration access.',
    permissions: [
      'Manage users',
      'Assign roles',
      'Configure approval chains',
      'Manage integrations',
      'View audit logs',
      'Access all reports',
    ],
  },
  {
    value: 'business',
    label: 'Hiring Manager',
    description: 'Creates requests and manages workers for their team.',
    permissions: [
      'Create and edit requests',
      'View supplier submissions',
      'Approve timesheets',
      'Approve extensions',
      'View team analytics',
    ],
  },
  {
    value: 'finance',
    label: 'Accounts Payable Supervisor',
    description: 'Supervises invoice review, payment controls, and spend reporting.',
    permissions: [
      'Approve invoices',
      'Review payment exceptions',
      'View spend summaries',
      'Export financial reports',
      'View audit logs',
    ],
  },
  {
    value: 'manager',
    label: 'Procurement Manager',
    description: 'Manages suppliers, SOWs, and commercial approval routing.',
    permissions: [
      'Manage suppliers',
      'Create and edit SOWs',
      'Configure approval chains',
      'Review rate exceptions',
      'View supplier analytics',
    ],
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to operational records and reports.',
    permissions: [
      'View requests',
      'View contracts',
      'View worker profiles',
      'View timesheets and invoices',
      'View reports',
    ],
  },
]

const LEGACY_ROLE_ALIASES: Record<string, string> = {
  administrator: 'admin',
  hiring_manager: 'business',
  accounts_payable_supervisor: 'finance',
  procurement: 'manager',
  procurement_manager: 'manager',
  hr: 'viewer',
  hr_manager: 'viewer',
  read_only: 'viewer',
}

export function normalizeAccessRole(value: unknown): string {
  if (typeof value !== 'string') return 'viewer'
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!normalized) return 'viewer'
  return LEGACY_ROLE_ALIASES[normalized] || normalized
}

export function getAccessRole(value: string): AccessRoleDefinition {
  const normalized = normalizeAccessRole(value)
  return (
    ACCESS_ROLES.find((role) => role.value === normalized) ||
    ACCESS_ROLES[ACCESS_ROLES.length - 1]
  )
}

export function isInternalAccessUser(role: unknown, accountType?: unknown) {
  const normalizedRole = normalizeAccessRole(role)
  const normalizedType =
    typeof accountType === 'string'
      ? accountType.trim().toLowerCase().replace(/[\s-]+/g, '_')
      : ''

  return !['supplier', 'worker'].includes(normalizedRole) &&
    !['supplier', 'worker'].includes(normalizedType)
}
