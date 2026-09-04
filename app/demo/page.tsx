'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'
import RequiredIndicator from '@/components/ui/RequiredIndicator'

export default function DemoPage() {
  const [demoOpen, setDemoOpen] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [company, setCompany] = useState("")
  const [workEmail, setWorkEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="text-lg font-semibold text-slate-900">Levv AI</div>
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="#" onClick={(e) => { e.preventDefault(); setDemoOpen(true); }}
              className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Request demo
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero aligned to reference */}
        <section className="relative overflow-hidden bg-[#0b151c] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_45%,rgba(60,83,99,0.35),transparent_55%),radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06),transparent_45%)]" />
          <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                AI External Workforce Management Solution
              </p>
              <h1 className="text-5xl font-semibold leading-[1.05] sm:text-6xl">
                Bring intelligence and control to how external workers get managed
              </h1>
              <p className="text-lg leading-relaxed text-slate-200">
                Levv AI is the first AI-enabled external workforce management solution redefining how
                vendors and contingent labor are managed -- bringing speed, consistency, and governance
                to an area long defined by friction, complexity, and overhead.
              </p>
            </div>

            <div className="relative flex-1">
              <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
              <div className="mx-auto grid max-w-xl grid-cols-2 gap-4 text-sm text-slate-200">
                {[
                  'Intent Simplification',
                  'Frictionless Request Formation',
                  'Targeted Sourcing',
                  'Structured Engagement Definition',
                  'Frictionless Onboarding',
                  'Settlement & Pay',
                ].map((label) => (
                  <div
                    key={label}
                    className="flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-center shadow-sm"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="mx-auto mt-4 max-w-md rounded-2xl border border-white/20 bg-white/10 px-6 py-5 text-center shadow-lg backdrop-blur">
                <div className="text-lg font-semibold text-white">Levv AI</div>
                <div className="text-sm text-slate-200">AI-Enabled Intelligence</div>
                <div className="mt-2 text-xs text-slate-300">Governance * Compliance * Control</div>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="bg-slate-100 py-16" id="demo">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-semibold text-slate-900">
              Built around what enterprises actually need
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {[
                {
                  title: 'Operational Clarity',
                  desc:
                    'Bring structure to external workforce requests without slowing teams down -- so work starts with shared understanding, not follow-ups.',
                },
                {
                  title: 'Governance by Default',
                  desc:
                    'Ensure workforce decisions align with policy, financial guardrails, and supplier strategy -- without manual enforcement.',
                },
                {
                  title: 'Single Source of Truth',
                  desc:
                    'Maintain a unified view of external work -- from engagement through payment -- so HR, finance, and procurement always know what is happening and why.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Operating model */}
        <section className="bg-slate-800 py-16 text-white">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h3 className="text-2xl font-semibold">Designed around how external work actually operates</h3>
              <p className="mt-4 text-base text-slate-200">
                Levv AI models external workforce management as a connected system -- reinforcing clarity,
                alignment, and consistency as work moves from request through execution and settlement.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                'Request Formation',
                'Decision Alignment',
                'Supplier Engagement',
                'Work Definition',
                'Execution & Settlement',
                'Settlement & Pay Integrity',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center text-sm text-slate-100"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

                {/* System map */}
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-3xl text-left">
              <h3 className="text-3xl font-semibold leading-tight text-slate-900">
                Offload the busywork to Agentic AI.
                <br />While you focus on decisions.
              </h3>
              <p className="mt-3 text-base text-slate-600">
                Levv AI embeds intelligence directly into the external workforce lifecycle -- improving efficiency,
                consistency, and execution quality without exposing teams to unnecessary complexity.
              </p>
            </div>

            <div className="relative mt-16 flex justify-center">
              <div className="relative h-[380px] w-full max-w-5xl">
                <div className="pointer-events-none absolute left-16 right-16 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-300" />
                <div className="pointer-events-none absolute top-12 bottom-12 left-1/2 -translate-x-1/2 border-l border-dashed border-slate-300" />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 justify-center items-center flex-col items-center gap-2 rounded-[999px] -ml-24 -mt-12 border border-slate-200 bg-white px-10 py-7 text-center text-sm font-semibold text-slate-800 shadow-[0_25px_80px_-45px_rgba(0,0,0,0.45)]"
                >
                  <div>Levv AI</div>
                  <div className="text-xs font-normal text-slate-500">Embedded Intelligence</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.45 }}
                  className="absolute left-1/2 top-12 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-800 shadow-md"
                >
                  Request Quality
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.45 }}
                  className="absolute left-14 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-800 shadow-md"
                >
                  Engagement Consistency
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.45 }}
                  className="absolute right-14 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-800 shadow-md"
                >
                  Decision Support
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.45 }}
                  className="absolute bottom-12 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-6 py-2 text-sm font-medium text-slate-800 shadow-md"
                >
                  Time & Pay Integrity
                </motion.div>
              </div>
            </div>

            <p className="mt-12 text-center text-xs text-slate-500">
              AI embedded intelligence layer, augmenting workflows while keeping human judgment and governance firmly in control.
            </p>
          </div>
        </section>



        {demoOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="max-w-xl w-full rounded-2xl bg-white p-8 shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">Request a demo</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Share your details and we'll reach out directly.
                  </p>
                </div>
              </div>


                            <form
                className="mt-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setSending(true)
                  setSendError('')
                  try {
                    const res = await fetch('/api/demo-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ firstName, company, workEmail }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) {
                      throw new Error(data.error || data.detail || 'Failed to send')
                    }
                    setDemoOpen(false)
                    setFirstName('')
                    setCompany('')
                    setWorkEmail('')
                  } catch (err) {
                    console.error(err)
                    setSendError(err instanceof Error ? err.message : 'Could not send demo request.')
                  } finally {
                    setSending(false)
                  }
                }}
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    First name
                    <RequiredIndicator />
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="First name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    Company
                    <RequiredIndicator />
                  </label>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="Company"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    Work email
                    <RequiredIndicator />
                  </label>
                  <input
                    type="email"
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="Work email"
                    required
                  />
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {sending ? "Sending..." : "Submit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoOpen(false)}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-slate-500">No spam. Direct response.</p>
                {sendError && (
                  <p className="text-xs text-rose-600">{sendError}</p>
                )}
              </form>

            </div>
          </div>
        )}


        <footer className="border-t border-slate-200 bg-white py-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-slate-500">
            <span>(c) 2026 Levv AI. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="/security" className="hover:text-slate-800">Security</Link>
              <Link href="#" className="hover:text-slate-800">Privacy</Link>
              <Link href="#" className="hover:text-slate-800">Contact</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
