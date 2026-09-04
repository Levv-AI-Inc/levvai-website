import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, ArrowLeft, GitBranch } from 'lucide-react'
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
    <main className="levv-standalone-app flex min-h-screen items-center justify-center px-6 py-10">
      <div className="levv-standalone-card w-full max-w-xl rounded-lg border border-slate-200 bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
            <GitBranch className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="text-base font-semibold text-slate-950">Levv</span>
        </div>

        <div className="mt-10 flex h-11 w-11 items-center justify-center rounded-md bg-amber-50 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-slate-950">Tenant does not exist</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The tenant host is not configured.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Verify the URL or contact your Levv AI administrator.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Levv
        </Link>
      </div>
    </main>
  )
}
