const RESERVED_SUBDOMAINS = new Set(['www', 'api'])
const DEFAULT_BASE_DOMAIN = 'levvai.com'

export function normalizeHost(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .replace(/\.$/, '')
    .split(':')[0]
}

export function isTenantHost(
  host: string,
  baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? DEFAULT_BASE_DOMAIN
) {
  const normalizedHost = normalizeHost(host)
  const normalizedBaseDomain = normalizeHost(baseDomain)

  if (
    !normalizedHost ||
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1'
  ) {
    return false
  }
  if (!normalizedBaseDomain) return false
  if (normalizedHost.endsWith('.run.app')) return false
  if (normalizedHost === normalizedBaseDomain) return false
  if (!normalizedHost.endsWith(`.${normalizedBaseDomain}`)) return false

  const subdomain = normalizedHost.slice(
    0,
    -(`.${normalizedBaseDomain}`.length)
  )
  return Boolean(subdomain && !RESERVED_SUBDOMAINS.has(subdomain))
}
