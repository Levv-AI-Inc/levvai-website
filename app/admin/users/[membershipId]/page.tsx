'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, Loader2, RefreshCw, UserRound } from 'lucide-react'

import { LevvPage, LevvPageHeader, LevvPanel } from '@/components/ui/levv-app'
import { getAccessRole } from '@/lib/accessControlRoles'
import {
  getAdminUser,
  type AdminUserProfile,
  UsersApiError,
} from '@/lib/api/users'
import { isFeatureEnabled } from '@/lib/featureFlags'

const FUTURE_TABS = ['Access', 'Approvals', 'Coverage & activity']

function display(value: string) {
  return value || 'Not set'
}

function statusLabel(status: string) {
  const normalized = status === 'disabled' ? 'suspended' : status
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function UserRecordPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const membershipId = String(params?.membershipId || '')
  const [user, setUser] = useState<AdminUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const returnHref = useMemo(() => {
    const requested = searchParams.get('return_to') || ''
    if (!requested.startsWith('/admin/users') || requested.startsWith('//')) {
      return '/admin/users'
    }
    try {
      const url = new URL(requested, 'https://levv.local')
      return url.origin === 'https://levv.local' && url.pathname === '/admin/users'
        ? `${url.pathname}${url.search}`
        : '/admin/users'
    } catch {
      return '/admin/users'
    }
  }, [searchParams])

  const loadUser = useCallback(() => setReloadKey((value) => value + 1), [])

  useEffect(() => {
    if (!isFeatureEnabled('user_detail_v2')) {
      router.replace(returnHref)
      return
    }
    if (!/^\d+$/.test(membershipId)) {
      setLoading(false)
      setNotFound(true)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')
    setForbidden(false)
    setNotFound(false)

    getAdminUser(membershipId, controller.signal)
      .then(setUser)
      .catch((requestError) => {
        if ((requestError as { name?: string })?.name === 'AbortError') return
        setUser(null)
        if (requestError instanceof UsersApiError && requestError.status === 401) {
          router.replace(
            `/auth/login?next=${encodeURIComponent(`/admin/users/${membershipId}`)}`,
          )
          return
        }
        if (requestError instanceof UsersApiError && requestError.status === 403) {
          setForbidden(true)
          return
        }
        if (requestError instanceof UsersApiError && requestError.status === 404) {
          setNotFound(true)
          return
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load this user profile.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [membershipId, reloadKey, returnHref, router])

  return (
    <LevvPage width="wide" className="p-0 sm:p-0 lg:p-0">
      <div className="space-y-6">
        <LevvPageHeader
          eyebrow={
            <Link
              href={returnHref}
              className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#89d3bd]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to users
            </Link>
          }
          title={user?.name || 'User profile'}
          description={
            user
              ? `Membership ${user.membershipId} · ${user.email}`
              : 'View tenant membership and profile defaults.'
          }
        />

        <nav
          aria-label="User record sections"
          className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1"
        >
          <span
            aria-current="page"
            className="whitespace-nowrap rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Profile
          </span>
          {FUTURE_TABS.map((tab) => (
            <span
              key={tab}
              aria-disabled="true"
              className="cursor-not-allowed whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-slate-400"
              title="Available in a later iteration"
            >
              {tab}
            </span>
          ))}
        </nav>

        {loading ? (
          <LevvPanel className="flex min-h-64 items-center justify-center p-8">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600" role="status">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading user profile…
            </div>
          </LevvPanel>
        ) : forbidden ? (
          <StatePanel
            title="Profile unavailable"
            message="You do not have permission to view tenant user profiles. Customer Administrator access is required."
          />
        ) : notFound ? (
          <StatePanel
            title="User not found"
            message="This membership does not exist in the active tenant or is not an internal user."
          />
        ) : error ? (
          <StatePanel title="Could not load profile" message={error} onRetry={loadUser} />
        ) : user ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <LevvPanel className="p-6">
              <div className="mb-6 flex items-center gap-3">
                <span className="rounded-xl bg-[#e7f3ee] p-3 text-[#1f3d38]">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Profile</h2>
                  <p className="text-sm text-slate-500">Identity, preferences, and working defaults.</p>
                </div>
              </div>
              <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <ProfileField label="Full name" value={user.name} />
                <ProfileField label="Email" value={user.email} />
                <ProfileField label="Title" value={user.title} />
                <ProfileField label="Phone" value={user.phone} />
                <ProfileField label="Supported language" value={user.supportedLanguage} />
                <ProfileField label="Time zone" value={user.timeZone} />
                <ProfileField label="Manager" value={user.manager} />
                <ProfileField label="Authentication" value={user.ssoEnabled ? 'Single sign-on' : 'Password'} />
              </dl>
            </LevvPanel>

            <div className="space-y-6">
              <LevvPanel className="p-6">
                <h2 className="text-base font-bold text-slate-950">Membership</h2>
                <dl className="mt-5 space-y-5">
                  <ProfileField label="Status" value={statusLabel(user.status)} />
                  <ProfileField label="Role" value={getAccessRole(user.role).label} />
                  <ProfileField label="Membership ID" value={user.membershipId} />
                </dl>
              </LevvPanel>
              <LevvPanel className="p-6">
                <h2 className="text-base font-bold text-slate-950">Working defaults</h2>
                <p className="mt-1 text-xs text-slate-500">Defaults help prefill work. They do not grant record access.</p>
                <dl className="mt-5 space-y-5">
                  <ProfileField label="Business unit" value={user.businessUnit || user.businessUnitId} />
                  <ProfileField label="Legal entity" value={user.legalEntity || user.legalEntityId} />
                  <ProfileField label="Cost center" value={user.costCenterName || user.costCenter} />
                  <ProfileField label="Location" value={user.site || user.siteId} />
                </dl>
              </LevvPanel>
            </div>
          </div>
        ) : (
          <StatePanel title="No profile data" message="No profile information was returned for this membership." />
        )}
      </div>
    </LevvPage>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</dt>
      <dd className={`mt-1.5 break-words text-sm font-semibold ${value ? 'text-slate-950' : 'text-slate-400'}`}>
        {display(value)}
      </dd>
    </div>
  )
}

function StatePanel({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <LevvPanel className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="h-8 w-8 text-rose-500" />
      <h2 className="mt-4 text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-lg text-sm text-slate-600">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#89d3bd]"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      ) : null}
    </LevvPanel>
  )
}
