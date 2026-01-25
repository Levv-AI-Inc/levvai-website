const ALLOWED_ROLES = [
  'Admin',
  'Hiring Manager',
  'Finance',
  'Procurement',
  'HR',
  'Viewer',
] as const

type AllowedRole = (typeof ALLOWED_ROLES)[number]

export function parseNovaUserResponse(raw: string) {
  let obj: any

  try {
    obj = JSON.parse(raw)
  } catch {
    throw new Error('Nova User response is not valid JSON')
  }

  const safeString = (v: any) =>
    typeof v === 'string' && v.trim().length
      ? v.trim()
      : undefined

  const roleRaw = safeString(obj.role) as AllowedRole | undefined
  const role: AllowedRole = ALLOWED_ROLES.includes(roleRaw!)
    ? roleRaw!
    : 'Viewer'

  return {
    name: safeString(obj.name) ?? 'Pending user',
    email: safeString(obj.email),
    role,
    status:
      obj.status === 'Inactive' ? 'Inactive' : 'Active',

    // ✅ KEEP THESE
    businessUnit:
      safeString(obj.businessUnit) ??
      safeString(obj.bu) ??
      safeString(obj.business_unit),

    costCenter:
      safeString(obj.costCenter) ??
      safeString(obj.cc) ??
      safeString(obj.cost_center),
  }
}
