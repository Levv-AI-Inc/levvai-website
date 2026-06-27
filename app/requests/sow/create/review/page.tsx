'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSOW } from '../context'
import { assignSeverity } from '@/lib/intelligence/nova/severity'

type NovaSignal = {
  id: string
  severity: 'info' | 'caution' | 'risk'
  title: string
  message: string
  section?: string
}

export default function ReviewPage() {
  const router = useRouter()
  const { sow } = useSOW()

  const { name, vendor, startDate, endDate, rawScope } = sow
  const financials: any = sow.financials || {}
  const commercials: any = sow.commercials || {}
  const aiAutomation = sow.aiAutomation || []
  const attachments: any[] = sow.attachments || []

  /* -----------------------------------------
     Nova – GPT Triangulation Scan (Moment 2)
     ----------------------------------------- */

  const [novaSignals, setNovaSignals] = useState<NovaSignal[]>([])
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    async function runNovaScan() {
      if (!rawScope) return

      try {
        setIsScanning(true)
console.log('REVIEW PAGE: calling /api/nova/scan')

        const res = await fetch('/api/nova/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          workType: sow.workType,
          pricingModel: commercials.pricingModel || null,
          billingFrequency:
            commercials.billingFrequency ||
            (commercials.recurringAmount ? 'Recurring' : null),
          scopeSummary: rawScope || sow.scope || '',

        }),
        })

        const data = await res.json()
        console.log('NOVA RESPONSE', data)

        if (!data?.ok || !Array.isArray(data.findings)) {
          setNovaSignals([])
          return
        }

        const mapped: NovaSignal[] = data.findings.map(
          (f: any, idx: number) => ({
            id: `nova-${idx}`,
            severity: assignSeverity(f).toLowerCase() as
              | 'info'
              | 'caution'
              | 'risk',
            title:
              f.dimension === 'commercials'
                ? 'Commercial alignment'
                : f.dimension === 'scope'
                ? 'Scope consistency'
                : 'Structural completeness',
            message: f.message,
            section:
              f.dimension === 'commercials'
                ? 'Commercials'
                : f.dimension === 'scope'
                ? 'Description'
                : undefined,
          })
        )

        setNovaSignals(mapped)
      } catch (err) {
        console.error('Nova scan failed', err)
        setNovaSignals([])
      } finally {
        setIsScanning(false)
      }
    }

    runNovaScan()
  }, [
    rawScope,
    sow.workType,
    commercials.pricingModel,
    commercials.billingFrequency,
  ])

  return (
    <div className="max-w-7xl mx-auto p-10 grid grid-cols-[1fr_260px] gap-10">
      {/* LEFT */}
      <div className="space-y-10">
        <div>
          <h1 className="text-2xl font-semibold">Review</h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Review all details before submitting for approval.
          </p>
        </div>

        {/* DESCRIPTION */}
        <Section title="Description">
          <Item label="Name" value={name} />
          <Item label="Vendor" value={vendor} />
          <Item
            label="Period"
            value={
              startDate && endDate
                ? `${startDate} → ${endDate}`
                : '—'
            }
          />
          <Item label="Scope" value={rawScope || '—'} multiline />
        </Section>

        {/* FINANCIALS */}
        <Section title="Financials">
          <Item
            label="Estimated value"
            value={
              financials.totalValue
                ? `$${financials.totalValue} ${
                    financials.currency || 'USD'
                  }`
                : 'Not provided'
            }
          />

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-700">
              Cost centers
            </div>

            {Array.isArray(financials.allocations) &&
            financials.allocations.length ? (
              <ul className="space-y-1 text-sm text-gray-800">
                {financials.allocations.map((a: any) => (
                  <li key={a.costCenterId || a.costCenterName}>
                    {a.costCenterName}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500">
                No cost centers allocated
              </div>
            )}
          </div>
        </Section>

        {/* COMMERCIALS */}
        <Section title="Commercials">
          <Item
            label="Pricing model"
            value={commercials.pricingModel || '—'}
          />

          {Array.isArray(commercials.milestones) &&
            commercials.milestones.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-700">
                  Milestones
                </div>

                <ul className="space-y-2 text-sm">
                  {commercials.milestones.map((m: any) => (
                    <li
                      key={m.id}
                      className="flex justify-between"
                    >
                      <span>{m.name}</span>
                      <span className="text-gray-600">
                        ${m.amount} — {m.due}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {Array.isArray(commercials.tmRoles) &&
            commercials.tmRoles.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-700">
                  Roles & rates
                </div>

                <ul className="space-y-2 text-sm">
                  {commercials.tmRoles.map((r: any) => (
                    <li
                      key={r.id}
                      className="flex justify-between"
                    >
                      <span>{r.role}</span>
                      <span className="text-gray-600">
                        ${r.rate}/hr · {r.startDate} →{' '}
                        {r.endDate}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {commercials.recurringAmount && (
            <Item
              label="Recurring"
              value={`$${commercials.recurringAmount} · ${commercials.billingFrequency}`}
            />
          )}
        </Section>

        {/* AI AUTOMATION */}
        <Section title="AI & Automation">
          {aiAutomation.length ? (
            <ul className="space-y-3 text-sm">
              {aiAutomation.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-900">
                        {item.name || 'Unnamed automation'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.category}
                        {item.aiPlatform ? ` · ${item.aiPlatform}` : ''}
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {item.riskLevel || 'Unrated'} risk
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                    <div>Owner: {item.businessOwner || '—'}</div>
                    <div>Technical: {item.technicalOwner || '—'}</div>
                    <div>Data: {item.dataClassification || '—'}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-500">
              No AI or automation items registered.
            </div>
          )}
        </Section>

        {/* ATTACHMENTS */}
        <Section title="Attachments">
          {attachments.length ? (
            <ul className="space-y-2 text-sm">
              {attachments.map((file: any, i: number) => (
                <li
                  key={`${file?.name || 'file'}-${i}`}
                  className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2 bg-white"
                >
                  <span className="text-gray-800">
                    {file?.name || 'Uploaded document'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Attached
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-500">
              No attachments provided
            </div>
          )}
        </Section>

        {/* NOVA SCANNER */}
        <NovaScanner signals={novaSignals} />

        {/* ACTIONS */}
        <div className="flex justify-between pt-4">
          <button
            onClick={() =>
              router.push('/requests/sow/create/ai-automation')
            }
            className="text-sm text-cyan-700 border border-cyan-200 px-4 py-2 rounded-full hover:bg-cyan-50 transition"
          >
            Back
          </button>

          <button
            onClick={() =>
              router.push(
                `/requests/sow_submitted?sow=${encodeURIComponent(
                  JSON.stringify(sow)
                )}`
              )
            }
            className="px-6 py-2.5 rounded-full text-sm bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Submit
          </button>

        </div>
      </div>

      {/* RIGHT STATUS */}
      <div className="sticky top-10 h-fit border border-slate-200 rounded-xl p-5 bg-white space-y-4">
        <div className="font-medium">SOW progress</div>
        <StatusItem label="Description" status="complete" />
        <StatusItem label="Financials" status="complete" />
        <StatusItem label="Commercials" status="complete" />
        <StatusItem label="AI Automation" status="complete" />
        <StatusItem label="Review" status="active" />
      </div>
    </div>
  )
}

/* ---------- Nova Scanner UI ---------- */

function NovaScanner({ signals }: { signals: NovaSignal[] }) {
  if (!signals.length) {
    return (
      <div className="border border-green-200 rounded-xl p-6 bg-green-50">
        <div className="font-semibold text-green-800">
          Nova review
        </div>
        <p className="text-sm text-green-700 mt-1">
          No material risks or gaps detected based on the
          information provided.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-purple-200 rounded-xl p-6 bg-purple-50 space-y-4">
      <div>
        <div className="font-semibold text-gray-900">
          Nova Analysis
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Based on rules and workflows enabled.
          No changes were made.
        </p>
      </div>

      <div className="space-y-3">
        {signals.map(s => (
          <NovaSignalItem key={s.id} signal={s} />
        ))}
      </div>

      <div className="text-xs text-slate-500 pt-2">

      </div>
    </div>
  )
}

function NovaSignalItem({ signal }: { signal: NovaSignal }) {
  const badge =
    signal.severity === 'risk'
      ? 'bg-red-100 text-red-700'
      : signal.severity === 'caution'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-blue-100 text-blue-700'

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${badge}`}
        >
          {signal.severity.toUpperCase()}
        </span>
        <span className="font-medium text-sm">
          {signal.title}
        </span>
      </div>

      <p className="text-sm text-gray-700">
        {signal.message}
      </p>

      {signal.section && (
        <div className="text-xs text-slate-500">
          Section: {signal.section}
        </div>
      )}
    </div>
  )
}

/* ---------- UI Helpers ---------- */

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-4">
      <div className="text-lg font-semibold">{title}</div>
      {children}
    </div>
  )
}

function Item({
  label,
  value,
  multiline,
}: {
  label: string
  value?: string
  multiline?: boolean
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-700">
        {label}
      </div>
      <div
        className={`text-sm text-slate-800 ${
          multiline ? 'whitespace-pre-line' : ''
        }`}
      >
        {value || '—'}
      </div>
    </div>
  )
}

function StatusItem({
  label,
  status,
}: {
  label: string
  status: 'complete' | 'active' | 'pending'
}) {
  const color =
    status === 'complete'
      ? 'bg-green-500'
      : status === 'active'
      ? 'bg-amber-400'
      : 'bg-gray-300'

  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`w-2.5 h-2.5 rounded-full ${color}`}
      />
      <span>{label}</span>
    </div>
  )
}
