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
import {
  LevvPanel,
  LevvRequestHeader,
  levvUi,
} from '@/components/ui/levv-app'

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
    <div className="levv-request-page pb-6 font-sans text-[#101b3c]">
      <div className="w-full space-y-5">
        <LevvRequestHeader
          currentStep={2}
          title="Qualifications"
          description="Choose whether this request needs structured screening criteria."
          meta={
            <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5 text-xs font-semibold text-[#52637a]">
              {request.role || 'Role not selected'}
            </span>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.5fr)]">
          <LevvPanel className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-[#101b3c]">
                Add screening criteria?
              </h2>
              <p className="mt-1 text-sm text-[#64748b]">
                You can add skills and requirements now, or skip this step.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelection('yes')}
                className={`rounded-[16px] border p-5 text-left transition ${
                  selection === 'yes'
                    ? 'border-[#2563eb] bg-[#eef5ff] shadow-[0_0_0_3px_rgba(37,99,235,0.1)]'
                    : 'border-[#dbe3ee] bg-[#f8fafc] hover:border-[#b8c8df] hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dcfce7] text-[#059669]"
                    >
                      <ListChecks className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-[#101b3c]">Add qualifications</div>
                      <p className="mt-1 text-sm leading-5 text-[#64748b]">
                        Set must-have, preferred, and knockout criteria.
                      </p>
                    </div>
                  </div>

                  {selection === 'yes' && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2563eb]" />
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelection('no')}
                className={`rounded-[16px] border p-5 text-left transition ${
                  selection === 'no'
                    ? 'border-[#2563eb] bg-[#eef5ff] shadow-[0_0_0_3px_rgba(37,99,235,0.1)]'
                    : 'border-[#dbe3ee] bg-[#f8fafc] hover:border-[#b8c8df] hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff7e6] text-[#d97706]"
                    >
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-[#101b3c]">Skip for now</div>
                      <p className="mt-1 text-sm leading-5 text-[#64748b]">
                        Continue to commercials without screening criteria.
                      </p>
                    </div>
                  </div>

                  {selection === 'no' && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2563eb]" />
                  )}
                </div>
              </button>
            </div>
          </LevvPanel>

          <LevvPanel className="p-5">
            <h2 className="text-sm font-bold text-[#101b3c]">Request summary</h2>
            <dl className="mt-4 divide-y divide-[#e8edf4] text-sm">
              <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
                <dt className="text-[#64748b]">Role</dt>
                <dd className="font-semibold text-[#17213c]">{request.role || 'Not selected'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[#64748b]">Saved criteria</dt>
                <dd className="font-semibold text-[#17213c]">{qualificationCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5 last:pb-0">
                <dt className="text-[#64748b]">Next</dt>
                <dd className="font-semibold text-[#17213c]">Commercials</dd>
              </div>
            </dl>
          </LevvPanel>
        </div>

        <footer className="sticky bottom-3 z-20 flex items-center justify-between rounded-[15px] border border-[#dce5f1] bg-white/95 px-5 py-3 shadow-[0_16px_42px_-26px_rgba(15,23,42,0.45)] backdrop-blur">
          <button
            type="button"
            onClick={() => router.push('/requests/new/job/create/define')}
            className={levvUi.secondaryButton}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selection}
            className={`${levvUi.primaryButton} min-w-[150px]`}
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        </footer>
      </div>
    </div>
  )
}
