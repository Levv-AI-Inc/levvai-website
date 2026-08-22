const ALLOWED_ROLES = [
  'Admin',
  'Hiring Manager',
  'Finance',
  'Procurement',
  'HR',
  'Viewer',
] as const

type AllowedRole = (typeof ALLOWED_ROLES)[number]

type ParsedUser = {
  name: string
  email?: string
  role: AllowedRole
  status: 'Active' | 'Inactive'
  businessUnit?: string
  costCenter?: string
}

function safeString(v: any) {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s.length ? s : undefined
}

export function parseNovaUserResponse(raw: string): ParsedUser {
  let obj: any = null

  try {
    obj = JSON.parse(raw)
  } catch {
    // If model ever returns extra text, try to extract the first JSON object
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      obj = JSON.parse(raw.slice(start, end + 1))
    } else {
      throw new Error('Nova returned non-JSON output')
    }
  }

  const name = safeString(obj?.name) ?? 'Pending user'
  const email = safeString(obj?.email)

  const roleRaw = safeString(obj?.role) as AllowedRole | undefined
  const role: AllowedRole = (ALLOWED_ROLES as readonly string[]).includes(roleRaw ?? '')
    ? (roleRaw as AllowedRole)
    : 'Viewer'

  const statusRaw = safeString(obj?.status)
  const status: 'Active' | 'Inactive' =
    statusRaw === 'Inactive' ? 'Inactive' : 'Active'

  // ✅ Keep BU/CC if present
  const businessUnit =
    safeString(obj?.businessUnit) ?? safeString(obj?.bu) ?? safeString(obj?.business_unit)

  const costCenter =
    safeString(obj?.costCenter) ?? safeString(obj?.cc) ?? safeString(obj?.cost_center)

  return {
    name,
    email,
    role,
    status,
    businessUnit,
    costCenter,
  }
}
// ------------------------------
// Nova Scan parser (Moment 2)
// ------------------------------
export type NovaFinding = {
  type: 'misalignment' | 'missing'
  dimension: 'commercials' | 'scope' | 'structure'
  message: string
  confidence: 'low' | 'medium' | 'high'
}

export function parseNovaResponse(raw: string): NovaFinding[] {
  if (!raw || typeof raw !== 'string') return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.findings) ? parsed.findings : []
  } catch {
    // fallback: extract first JSON object if model adds extra text
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1))
        return Array.isArray(parsed?.findings) ? parsed.findings : []
      } catch {
        return []
      }
    }
    return []
  }
}
