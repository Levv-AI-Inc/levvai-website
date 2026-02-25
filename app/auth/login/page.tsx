'use client'

import { FormEvent, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Globe2, KeyRound, Lock, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

type Feedback =
  | { status: 'idle' }
  | { status: 'success'; title: string; detail?: string }
  | { status: 'error'; title: string; detail?: string }

export default function TenantLoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [origin, setOrigin] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>({ status: 'idle' })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const endpoint =
    mode === 'login'
      ? '/auth/password/login-user'
      : '/auth/password/register-user'

  const submitLabel = mode === 'login' ? 'Sign in' : 'Create account'
  const ssoLabel = mode === 'login' ? 'Continue with SSO' : 'Sign up with SSO'
  const helperCopy =
    mode === 'login'
      ? 'Use your work email to sign in.'
      : 'Create your account to get started.'

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

    if (mode === 'register' && (!firstName || !lastName)) {
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
        const detail =
          typeof body === 'object' && body
            ? body.message || body.detail || JSON.stringify(body)
            : response.statusText

        throw new Error(detail)
      }

      setFeedback({
        status: 'success',
        title: mode === 'login' ? 'Signed in' : 'Registered',
        detail:
          typeof body === 'object' && body
            ? JSON.stringify(body)
            : 'Request succeeded.',
      })
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

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-50">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-xl"
      >
        <div className="absolute -inset-0.5 rounded-[26px] bg-gradient-to-br from-cyan-400/50 via-blue-500/40 to-emerald-400/40 opacity-60 blur" />
        <div className="relative rounded-[22px] border border-white/10 bg-white text-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="space-y-2">
              <p className="text-lg font-semibold tracking-tight text-slate-900">levvai</p>
              <p className="text-sm font-medium text-slate-600">{helperCopy}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
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
                  onClick={() => setMode(option)}
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
                  // const target = origin
                  //   ? `${origin}/auth/workos/login?next=/home`
                  //   : '/auth/workos/login?next=/home'
                  const target = `https://test.levvai.com/auth/workos/login?next=/home`;
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
              <label className="text-sm font-medium text-slate-800">Email</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  placeholder="user@yourco.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Password</label>
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
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    placeholder="********"
                    required
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    placeholder="Ada"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    placeholder="Lovelace"
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
                  <p className="mt-1 break-words text-xs leading-relaxed text-current">
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
