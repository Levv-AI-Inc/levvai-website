import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { isTenantHost, normalizeHost } from '@/lib/tenant'

export default async function TenantNotFoundPage() {
  const requestHeaders = headers()
  const rawHost =
    requestHeaders.get('x-forwarded-host') ||
    requestHeaders.get('x-original-host') ||
    requestHeaders.get('host') ||
    ''

  const host = normalizeHost(rawHost)

  if (isTenantHost(host)) {
    const protocol = requestHeaders.get('x-forwarded-proto') || 'https'

    try {
      const response = await fetch(
        `${protocol}://${host}/auth/password/tenant-exists?host=${encodeURIComponent(host)}`,
        {
          method: 'GET',
          cache: 'no-store',
        }
      )

      if (response.ok) {
        const payload = (await response.json()) as { exists?: boolean }
        if (payload.exists === true) {
          redirect('/')
        }
      }
    } catch {
      // If tenant validation fails, keep showing this page.
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Levv AI</p>
        <h1 className="mt-3 text-3xl font-semibold">Tenant does not exist</h1>
        <p className="mt-3 text-sm text-slate-300">
          The tenant host is not configured.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Verify the URL or contact your Levv AI administrator.
        </p>
      </div>
    </main>
  )
}
