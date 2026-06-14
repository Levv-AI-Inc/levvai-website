'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  ShieldCheck,
} from 'lucide-react'
import { useCWRequest } from '../../context/CWRequestContext'

type Selection = 'yes' | 'no' | null

export default function QualificationsIntroPage() {
  const router = useRouter()
  const { request, update } = useCWRequest()

  const [selection, setSelection] = useState<Selection>(() => {
    if (request.qualificationsEnabled === true) return 'yes'
    if (request.qualificationsEnabled === false) return 'no'
    if ((request.qualifications?.length || 0) > 0) return 'yes'
    return null
  })

  const qualificationCount = request.qualifications?.length || 0

  const handleContinue = () => {
    if (!selection) return

    const enabled = selection === 'yes'
    update({
      qualificationsEnabled: enabled,
    })

    router.push(
      enabled
        ? '/requests/new/job/create/qualifications/setup'
        : '/requests/new/job/create/financials',
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,_#f8fafc,_#f8fafc,_#eef6ff)] pb-20 font-sans">
      <div className="mx-auto max-w-6xl px-8 py-12">
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-700">
            <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-cyan-800">
              Step 2 of 5
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Qualifications</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Do you want to add any qualifications?
          </h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Add must-have and nice-to-have qualifications if this request
            needs structured screening criteria for suppliers and the hiring
            team.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelection('yes')}
                className={`rounded-3xl border p-6 text-left transition ${
                  selection === 'yes'
                    ? 'border-slate-900 bg-slate-950 text-white shadow-xl'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                        selection === 'yes'
                          ? 'bg-white/10'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      <ListChecks className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-lg font-bold">Yes, add qualifications</div>
                      <p
                        className={`mt-2 text-sm leading-6 ${
                          selection === 'yes'
                            ? 'text-white/75'
                            : 'text-slate-600'
                        }`}
                      >
                        Configure screening requirements, weighted preferences,
                        and knockout criteria before pricing and supplier routing.
                      </p>
                    </div>
                  </div>

                  {selection === 'yes' && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelection('no')}
                className={`rounded-3xl border p-6 text-left transition ${
                  selection === 'no'
                    ? 'border-slate-900 bg-slate-950 text-white shadow-xl'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                        selection === 'no'
                          ? 'bg-white/10'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-lg font-bold">No, skip for now</div>
                      <p
                        className={`mt-2 text-sm leading-6 ${
                          selection === 'no'
                            ? 'text-white/75'
                            : 'text-slate-600'
                        }`}
                      >
                        Continue straight to rates and suppliers without adding
                        evaluation criteria on this request.
                      </p>
                    </div>
                  </div>

                  {selection === 'no' && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                  )}
                </div>
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">
                Current request state
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Role: <span className="font-medium text-slate-900">{request.role || 'Not selected'}</span>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Saved qualifications:{' '}
                <span className="font-medium text-slate-900">{qualificationCount}</span>
              </p>
              {qualificationCount > 0 && (
                <p className="mt-2 text-sm text-slate-500">
                  Existing qualifications stay in the request context even if
                  you skip this step, so you can come back without losing work.
                </p>
              )}
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">
              What this step adds
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">
                  Must-have criteria
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Define mandatory skills, tools, certifications, or experience.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">
                  Weighted preferences
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Capture nice-to-have qualifications that improve fit scoring.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">
                  Knockout rules
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Flag requirements that automatically disqualify a response.
                </p>
              </div>
            </div>
          </aside>
        </div>

        <footer className="mt-10 flex items-center justify-between border-t border-slate-200 pt-8">
          <button
            type="button"
            onClick={() => router.push('/requests/new/job/create/define')}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selection}
            className={`inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full px-10 py-3.5 text-sm font-bold shadow-lg transition-all ${
              selection
                ? 'bg-slate-950 text-white hover:bg-slate-800'
                : 'cursor-not-allowed bg-slate-300 text-slate-600'
            }`}
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        </footer>
      </div>
    </div>
  )
}
