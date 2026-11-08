'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

import { LevvPage, LevvRecordHeader, levvUi } from '@/components/ui/levv-app'
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

/** The membership in one sentence, from the profile as loaded. */
function profileStatement(user: AdminUserProfile) {
  const status = statusLabel(user.status) || 'A'
  return `${status} member with the ${getAccessRole(user.role).label} role, signing in with ${
    user.ssoEnabled ? 'single sign-on' : 'a password'
  }.`
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

  const statement = loading
    ? 'Loading user profile…'
    : forbidden
      ? 'You do not have permission to view tenant user profiles.'
      : notFound
        ? 'This membership was not found in the active tenant.'
        : error
          ? 'This profile could not be loaded.'
          : user
            ? profileStatement(user)
            : 'View tenant membership and profile defaults.'

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Users"
          title={user?.name || 'User profile'}
          statement={statement}
          actions={
            <Link href={returnHref} className={`${levvUi.ghostButton} -ml-3.5 lg:ml-0`}>
              <ArrowLeft />
              Back to users
            </Link>
          }
        />

        <nav
          aria-label="User record sections"
          className="flex gap-6 overflow-x-auto border-b border-[var(--line)]"
        >
          <span
            aria-current="page"
            className={`-mb-px inline-flex h-10 shrink-0 items-center whitespace-nowrap border-b-2 border-blue-600 ${levvUi.legend} text-[12px] text-slate-950`}
          >
            Profile
          </span>
          {FUTURE_TABS.map((tab) => (
            <span
              key={tab}
              aria-disabled="true"
              className={`-mb-px inline-flex h-10 shrink-0 cursor-not-allowed items-center whitespace-nowrap border-b-2 border-transparent ${levvUi.legend} text-[12px] text-slate-400`}
              title="Available in a later iteration"
            >
              {tab}
            </span>
          ))}
        </nav>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center border-t-2 border-slate-950 p-8">
            <div className="flex items-center gap-3 text-[13px] font-medium text-slate-600" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 motion-reduce:animate-none" />
              Loading user profile…
            </div>
          </div>
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
          <div className="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <RecordSection title="Profile" description="Identity, preferences, and working defaults.">
              <dl className="grid sm:grid-cols-2 sm:gap-x-8">
                <ProfileField label="Full name" value={user.name} />
                <ProfileField label="Email" value={user.email} />
                <ProfileField label="Title" value={user.title} />
                <ProfileField label="Phone" value={user.phone} />
                <ProfileField label="Supported language" value={user.supportedLanguage} />
                <ProfileField label="Time zone" value={user.timeZone} />
                <ProfileField label="Manager" value={user.manager} />
                <ProfileField label="Authentication" value={user.ssoEnabled ? 'Single sign-on' : 'Password'} />
              </dl>
            </RecordSection>

            <div className="space-y-8">
              <RecordSection title="Membership">
                <dl>
                  <ProfileField label="Status" value={statusLabel(user.status)} />
                  <ProfileField label="Role" value={getAccessRole(user.role).label} />
                  <ProfileField label="Membership ID" value={user.membershipId} numeric />
                </dl>
              </RecordSection>
              <RecordSection title="Working defaults" description="Defaults help prefill work. They do not grant record access.">
                <dl>
                  <ProfileField label="Business unit" value={user.businessUnit || user.businessUnitId} />
                  <ProfileField label="Legal entity" value={user.legalEntity || user.legalEntityId} />
                  <ProfileField label="Cost center" value={user.costCenterName || user.costCenter} />
                  <ProfileField label="Location" value={user.site || user.siteId} />
                </dl>
              </RecordSection>
            </div>
          </div>
        ) : (
          <StatePanel title="No profile data" message="No profile information was returned for this membership." />
        )}
      </div>
    </LevvPage>
  )
}

/** A section of the record on the paper: its heading, then the fields under a 2px navy rule. */
function RecordSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold text-slate-950">{title}</h2>
      {description ? <p className="mt-0.5 text-[13px] text-slate-500">{description}</p> : null}
      <div className="mt-3 border-t-2 border-slate-950">{children}</div>
    </section>
  )
}

function ProfileField({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="border-b border-[var(--line)] py-3">
      <dt className={levvUi.label}>{label}</dt>
      <dd className={`mt-1 break-words text-[14px] ${numeric ? 'tabular-nums' : ''} ${value ? 'font-medium text-slate-950' : 'text-slate-500'}`}>
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
    <div className="flex min-h-64 flex-col items-center justify-center border-t-2 border-slate-950 p-8 text-center">
      <AlertCircle className="h-6 w-6 text-rose-600" />
      <h2 className="mt-3 text-[15px] font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 max-w-lg text-[13px] text-slate-600">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={`${levvUi.secondaryButton} mt-5`}
        >
          <RefreshCw /> Retry
        </button>
      ) : null}
    </div>
  )
}
