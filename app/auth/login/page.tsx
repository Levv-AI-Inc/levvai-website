'use client'

import { FormEvent, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Globe2, KeyRound, Loader2, Lock, Mail } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import RequiredIndicator from '@/components/ui/RequiredIndicator'
import { Button } from '@/components/ui/button'
import { isTenantHost, normalizeHost } from '@/lib/tenant'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

type Feedback =
  | { status: 'idle' }
  | { status: 'success'; title: string; detail?: string }
  | { status: 'error'; title: string; detail?: string }

type SessionStatusResponse = {
  authenticated?: boolean
}

type RegisterResponse = {
  linked_existing_user?: boolean
}

type JsonLike =
  | string
  | number
  | boolean
  | null
  | JsonLike[]
  | { [key: string]: JsonLike }

function toText(value: JsonLike | undefined): string[] {
  if (value === null || value === undefined) return []
  if (typeof value === 'string') return [value]
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  if (Array.isArray(value)) {
    return value.flatMap((item) => toText(item))
  }
  if (typeof value === 'object') {
    const lines: string[] = []
    for (const [key, val] of Object.entries(value)) {
      const messages = toText(val)
      if (!messages.length) continue
      if (key === 'detail' || key === 'non_field_errors') {
        lines.push(...messages)
      } else {
        const label = key.replace(/_/g, ' ')
        lines.push(...messages.map((message) => `${label}: ${message}`))
      }
    }
    return lines
  }
  return []
}

function formatApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const messages = toText(body as JsonLike)
  const unique = Array.from(new Set(messages.filter(Boolean)))
  return unique.length ? unique.join('\n') : fallback
}

function cleanNextPath(nextPath: string | null | undefined, fallback = '/home'): string {
  if (!nextPath) return fallback
  if (!nextPath.startsWith('/')) return fallback
  if (nextPath.startsWith('//')) return fallback
  return nextPath
}

export default function TenantLoginPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const modeParam = searchParams.get('mode')
  const inviteToken = searchParams.get('invite_token')?.trim() || ''
  const inviteEmail = searchParams.get('email')?.trim() || ''
  const [mode, setMode] = useState<Mode>('login')
  const [origin, setOrigin] = useState('')
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [developerModeChecked, setDeveloperModeChecked] = useState(false)
  const [developerMode, setDeveloperMode] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>({ status: 'idle' })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
      setDeveloperMode(window.localStorage.getItem('developer') === 'true')
      setDeveloperModeChecked(true)

      const host = normalizeHost(window.location.hostname)
      const baseDomain = normalizeHost(
        process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'levvai.com'
      )

      if (isTenantHost(host, baseDomain) && host.endsWith(`.${baseDomain}`)) {
        const subdomain = host.slice(0, -(`.${baseDomain}`.length))
        const tenant = subdomain.split('.')[0] || null
        setTenantName(tenant)
      } else {
        setTenantName(null)
      }
    }
  }, [])

  useEffect(() => {
    if (!developerModeChecked || developerMode) return
    router.replace('/')
  }, [developerMode, developerModeChecked, router])

  useEffect(() => {
    if (modeParam === 'register') {
      setMode('register')
    }
  }, [modeParam])

  useEffect(() => {
    if (!inviteEmail) return
    setEmail(inviteEmail)
  }, [inviteEmail])


  useEffect(() => {
    if (!developerModeChecked || !developerMode || !origin) return

    const controller = new AbortController()
    const nextPath = cleanNextPath(searchParams.get('next'), '/home')

    const checkSession = async () => {
      setSessionChecking(true)
      try {
        const response = await fetch(`${origin}/api/session`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        const payload = (await response.json().catch(() => ({}))) as SessionStatusResponse
        if (response.ok && payload.authenticated === true) {
          router.replace(nextPath)
        }
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return
      } finally {
        setSessionChecking(false)
      }
    }

    void checkSession()

    return () => controller.abort()
  }, [developerMode, developerModeChecked, origin, router, searchParams])

  useEffect(() => {
    const ssoError = searchParams.get('sso_error')
    const ssoErrorDescription = searchParams.get('sso_error_description')
    if (!ssoError && !ssoErrorDescription) return

    setFeedback({
      status: 'error',
      title: 'SSO sign-in failed',
      detail: ssoErrorDescription || 'Unable to sign in with SSO.',
    })
  }, [searchParams])

  const isInviteRegistration =
    mode === 'register' && Boolean(inviteToken)

  const endpoint =
    mode === 'login'
      ? '/auth/password/login-user'
      : isInviteRegistration
        ? '/auth/password/register'
        : '/auth/password/register-user'

  const submitLabel = mode === 'login' ? 'Sign in' : 'Create account'
  const ssoLabel = mode === 'login' ? 'Continue with SSO' : 'Sign up with SSO'
  const helperCopy =
    mode === 'login'
      ? 'Use your work email to sign in.'
      : isInviteRegistration
      ? 'Create your supplier account to access this tenant.'
      : 'Create your account to get started.'
  const passwordMismatch =
    mode === 'register' &&
    Boolean(confirmPassword) &&
    password !== confirmPassword

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!origin) {
      setFeedback({
        status: 'error',
        title: 'Missing tenant host',
        detail: 'The tenant host could not be detected. Refresh and try again.',
      })
      return
    }

    if (!email || !password) {
      setFeedback({
        status: 'error',
        title: 'Add your email and password',
        detail: 'Both fields are required to continue.',
      })
      return
    }

    if (mode === 'register' && !isInviteRegistration && (!firstName || !lastName)) {
      setFeedback({
        status: 'error',
        title: 'Add your name',
        detail: 'First and last name are required to register.',
      })
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      setFeedback({
        status: 'error',
        title: 'Passwords do not match',
        detail: 'Confirm your password before continuing.',
      })
      return
    }

    setLoading(true)
    setFeedback({ status: 'idle' })

    try {
      const payload =
        mode === 'login'
          ? { email, password }
          : isInviteRegistration
          ? { email, password, invite_token: inviteToken }
          : { email, password, first_name: firstName, last_name: lastName }

      const target = `${origin}${endpoint}`

      const response = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => undefined)

      if (!response.ok) {
        const detail = formatApiError(body, response.statusText || 'Request failed')

        throw new Error(detail)
      }

      if (mode === 'register') {
        const registerResponse =
          body && typeof body === 'object'
            ? (body as RegisterResponse)
            : {}

        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setFirstName('')
        setLastName('')
        setFeedback({
          status: 'success',
          title:
            registerResponse.linked_existing_user === true
              ? 'Access added to this tenant'
              : 'Registered successfully',
          detail:
            registerResponse.linked_existing_user === true
              ? 'Please sign in with your existing password.'
              : 'Your account has been created. Please sign in.',
        })
      } else {
        const nextPath = cleanNextPath(searchParams.get('next'), '/home')
        const homeTarget = origin ? `${origin}${nextPath}` : nextPath
        window.location.assign(homeTarget)
        return
      }
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'

      setFeedback({
        status: 'error',
        title: 'Request failed',
        detail,
      })
    } finally {
      setLoading(false)
    }
  }

  if (!developerModeChecked || !developerMode) {
    return null
  }

  if (sessionChecking) {
    return (
      <div className="levv-standalone-app relative flex min-h-screen items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative w-full max-w-xl"
        >
          <div className="levv-standalone-glow absolute -inset-0.5 rounded-[26px] bg-gradient-to-br from-cyan-400/50 via-blue-500/40 to-emerald-400/40 opacity-60 blur" />
          <div className="levv-standalone-card relative rounded-[22px] border border-white/10 bg-white px-6 py-14 text-slate-900 shadow-2xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              <p className="text-sm font-medium text-slate-700">Checking your session...</p>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="levv-standalone-app relative flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-xl"
      >
        <div className="levv-standalone-glow absolute -inset-0.5 rounded-[26px] bg-gradient-to-br from-cyan-400/50 via-blue-500/40 to-emerald-400/40 opacity-60 blur" />
        <div className="levv-standalone-card relative rounded-[22px] border border-white/10 bg-white text-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="space-y-2">
              <p className="text-lg font-semibold tracking-tight text-slate-900">
                {tenantName ? `${tenantName} · levvai` : 'levvai'}
              </p>
              <p className="text-sm font-medium text-slate-600">{helperCopy}</p>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <Lock className="h-4 w-4" />
              Secure
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
            <div className="flex items-center justify-between rounded-xl bg-slate-100 p-1 text-sm font-medium text-slate-600">
              {(['login', 'register'] as Mode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setMode(option)
                    if (option === 'register' && inviteEmail) {
                      setEmail(inviteEmail)
                    }
                  }}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-2 transition',
                    mode === option
                      ? 'bg-white text-slate-900 shadow'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  {option === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full rounded-xl border-slate-200 text-base font-semibold text-slate-900"
                onClick={() => {
                  const target = origin
                    ? `${origin}/auth/workos/login?next=/home`
                    : '/auth/workos/login?next=/home'
                  window.location.assign(target)
                }}
              >
                <Globe2 className="h-4 w-4" />
                <span>{ssoLabel}</span>
              </Button>
              <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                or
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">
                Email
                <RequiredIndicator />
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  readOnly={isInviteRegistration}
                  className={cn(
                    'flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none',
                    isInviteRegistration && 'cursor-not-allowed text-slate-500'
                  )}
                  placeholder="user@yourco.com"
                  required
                />
              </div>
              {isInviteRegistration && (
                <p className="text-xs text-slate-500">
                  Email is locked to the invited supplier contact.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">
                Password
                <RequiredIndicator />
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  placeholder="********"
                  required
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">
                  Confirm password
                  <RequiredIndicator />
                </label>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2',
                    passwordMismatch
                      ? 'border-rose-300 bg-rose-50/60'
                      : 'border-slate-200 bg-white'
                  )}
                >
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    placeholder="********"
                    aria-invalid={passwordMismatch}
                    required
                  />
                </div>
                {passwordMismatch && (
                  <p className="text-xs font-medium text-rose-600">
                    Password and confirm password must match.
                  </p>
                )}
              </div>
            )}

            {mode === 'register' && !isInviteRegistration && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    First name
                    <RequiredIndicator />
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    placeholder="Ada"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    Last name
                    <RequiredIndicator />
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    placeholder="Lovelace"
                    required
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full rounded-xl text-base font-semibold shadow-lg shadow-cyan-500/20"
                loading={loading}
                disabled={passwordMismatch || sessionChecking}
                loadingText={mode === 'login' ? 'Signing in...' : 'Registering...'}
              >
                <span>{submitLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {feedback.status !== 'idle' && (
              <div
                className={cn(
                  'rounded-xl border px-4 py-3 text-sm',
                  feedback.status === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                )}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <span>{feedback.title}</span>
                </div>
                {feedback.detail && (
                  <p className="mt-1 break-words whitespace-pre-line text-xs leading-relaxed text-current">
                    {feedback.detail}
                  </p>
                )}
              </div>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  )
}
