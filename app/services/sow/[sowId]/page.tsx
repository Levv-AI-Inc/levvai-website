'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

/* =====================
   TYPES + HELPERS
===================== */
type InvoiceStatus =
  | 'Paid'
  | 'Approved'
  | 'Pending'
  | 'Not Submitted'

type Invoice = {
  label: string
  amount?: number
  status: InvoiceStatus
}

function formatMoney(n: number) {
  return `$${n.toLocaleString()}`
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const cls =
    status === 'Paid'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'Approved'
      ? 'bg-blue-100 text-blue-700'
      : status === 'Pending'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-600'

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  )
}

/* =====================
   SOW STATUS PILL
===================== */
function SOWStatusPill({
  status,
}: {
  status: 'Active' | 'Paused' | 'Closed'
}) {
  const cls =
    status === 'Active'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'Paused'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-600'

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

/* =====================
   MILESTONES SECTION
===================== */
function MilestonesSection() {
  const [openId, setOpenId] = useState<string | null>(null)

  const milestones = [
    {
      id: 'm1',
      name: 'Discovery & Planning',
      period: 'Jan – Feb',
      amount: '$450,000',
      status: 'Complete',
      risk: 'Low',
      description:
        'Requirements definition, architecture planning, and delivery roadmap.',
      expectedDate: 'Feb 28, 2024',
      actualDate: 'Feb 26, 2024',
      invoiceAmount: '$450,000 (14%)',
      invoiceApproved: 'Yes',
      invoicePaid: 'Yes',
    },
    {
      id: 'm2',
      name: 'Core Build & Integration',
      period: 'Mar – Jul',
      amount: '$1,375,000',
      status: 'In Progress',
      risk: 'Medium',
      description:
        'Core platform build, system integrations, and data migration.',
      expectedDate: 'Jul 31, 2024',
      actualDate: '—',
      invoiceAmount: '$1,375,000 (43%)',
      invoiceApproved: 'Yes',
      invoicePaid: 'No',
    },
    {
      id: 'm3',
      name: 'Testing & Stabilization',
      period: 'Aug – Oct',
      amount: '$1,375,000',
      status: 'Upcoming',
      risk: 'Low',
      description:
        'UAT, defect remediation, and performance stabilization.',
      expectedDate: 'Oct 15, 2024',
      actualDate: '—',
      invoiceAmount: '$1,375,000 (43%)',
      invoiceApproved: 'No',
      invoicePaid: 'No',
    },
  ]

  const pill = (text: string, type: 'status' | 'risk') => {
    const cls =
      type === 'status'
        ? text === 'Complete'
          ? 'bg-emerald-100 text-emerald-700'
          : text === 'In Progress'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-slate-100 text-slate-600'
        : text === 'Medium'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700'

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
        {type === 'risk' ? `${text} Risk` : text}
      </span>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 mt-8">
      <h3 className="text-sm font-semibold mb-4">Milestones</h3>

      <div className="space-y-3">
        {milestones.map(m => {
          const isOpen = openId === m.id

          return (
            <div key={m.id} className="border rounded-lg">
              <button
                onClick={() => setOpenId(isOpen ? null : m.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3 text-left">
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  )}

                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.period}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span>{m.amount}</span>
                  {pill(m.status, 'status')}
                  {pill(m.risk, 'risk')}
                </div>
              </button>

              {isOpen && (
                <div className="px-8 pb-4 text-sm text-slate-700">
                  <p className="mb-3">{m.description}</p>

                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-slate-500">Expected Completion</p>
                      <p>{m.expectedDate}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Actual Completion</p>
                      <p>{m.actualDate}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Invoice Amount</p>
                      <p>{m.invoiceAmount}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Invoice Approved</p>
                      <p>{m.invoiceApproved}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Invoice Paid</p>
                      <p>{m.invoicePaid}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* =====================
   MAIN PAGE
===================== */
export default function SOWDetailPage() {
  const [showActions, setShowActions] = useState(false)
  const [showInvoices, setShowInvoices] = useState(true)

  const sow = {
    id: 'SOW-2024-021',
    name: 'Core banking platform modernization',
    supplier: 'Accenture',
    supplierLink: '/suppliers/accenture',
    owner: 'James Park',
    commercials: 'Milestone Based',
    status: 'Active' as const,
    description:
      'Modernize the core banking platform. This includes integration, testing, and go-live support for the NA region.',
    totalValue: 3_200_000,
    startDate: new Date('2024-01-10'),
    endDate: new Date('2024-12-31'),
  }

  const invoices: Invoice[] = [
    { label: 'Invoice 1: $450,000', amount: 450_000, status: 'Paid' },
    { label: 'Invoice 2', status: 'Pending' },
    { label: 'Invoice 3', status: 'Not Submitted' },
  ]

  const { paidAmount, nextAmount, paidPct, nextPct } = useMemo(() => {
    const paid = invoices
      .filter(i => i.status === 'Paid' && i.amount)
      .reduce((sum, i) => sum + (i.amount || 0), 0)

    const next = invoices.find(
      i => i.status !== 'Paid' && i.amount
    )?.amount

    return {
      paidAmount: paid,
      nextAmount: next || 0,
      paidPct: (paid / sow.totalValue) * 100,
      nextPct: next ? (next / sow.totalValue) * 100 : 0,
    }
  }, [invoices, sow.totalValue])

  const today = new Date('2024-08-25')
  const totalDuration =
    sow.endDate.getTime() - sow.startDate.getTime()
  const elapsed =
    today.getTime() - sow.startDate.getTime()

  const timePct = Math.min(
    Math.max((elapsed / totalDuration) * 100, 0),
    100
  )

  const daysRemaining = Math.ceil(
    (sow.endDate.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  )

  return (
    <main className="p-8 space-y-6 max-w-7xl">
      {/* HEADER + ACTIONS */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold">
          {sow.id}: {sow.name}
        </h1>

        <div className="relative">
          <button
            onClick={() => setShowActions(v => !v)}
            className="px-4 py-2 rounded-lg border bg-white text-sm font-medium hover:bg-slate-50"
          >
            Actions ▾
          </button>

          {showActions && (
            <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-white shadow-lg z-50">
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">
                Initiate Change Order
              </button>
              <button className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">
                Pause
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                Terminate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* INFO BOX */}
      <div className="relative rounded-2xl border bg-white p-5 text-sm space-y-1">
        <div className="absolute top-4 right-4">
          <SOWStatusPill status={sow.status} />
        </div>

        <div>
          Supplier:{' '}
          <a
            href={sow.supplierLink}
            className="text-blue-600 hover:underline"
          >
            {sow.supplier}
          </a>
        </div>
        <div>Owner: {sow.owner}</div>
        <div>Commercials: {sow.commercials}</div>
        <div>Description: {sow.description}</div>
      </div>

      {/* CONTRACT + DURATION */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-5">
          <div className="flex justify-between">
            <div>
              Contract Value:{' '}
              <strong>{formatMoney(sow.totalValue)}</strong>
              <div className="mt-2">
                Amount Consumed:{' '}
                <strong>{formatMoney(paidAmount)}</strong> (
                {Math.round(paidPct)}%)
              </div>
            </div>
            <button onClick={() => setShowInvoices(!showInvoices)}>
              {showInvoices ? <ChevronDown /> : <ChevronRight />}
            </button>
          </div>

          <div className="relative h-2 bg-slate-100 rounded mt-3">
            <div
              className="absolute h-2 bg-slate-900 rounded"
              style={{ width: `${paidPct}%` }}
            />
            {nextAmount > 0 && (
              <div
                className="absolute h-2 bg-slate-300 rounded"
                style={{
                  left: `${paidPct}%`,
                  width: `${nextPct}%`,
                }}
              />
            )}
          </div>

          {showInvoices && (
            <div className="mt-4 space-y-2">
              {invoices.map(inv => (
                <div key={inv.label} className="flex justify-between">
                  <span>{inv.label}</span>
                  <StatusPill status={inv.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div>Jan 10, 2024 → Dec 31, 2024</div>
          <div className="mt-2">{daysRemaining} days remaining</div>

          <div className="relative h-2 bg-slate-100 rounded mt-3">
            <div
              className="absolute h-2 bg-emerald-600 rounded"
              style={{ width: `${timePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* NOVA INSIGHTS */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
          </div>

          <div className="text-sm text-slate-800">
            <p className="font-medium">
              Potential delivery slippage detected in Phase 2
            </p>

            <p className="mt-1 text-slate-700">
              Execution signals indicate a 2–3 week delay risk driven by
              integration complexity. A proactive warning has been sent
              to the SOW Owner.
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Notified: James Park · Today at 9:12 AM
            </p>
          </div>
        </div>
      </div>

      {/* MILESTONES */}
      <MilestonesSection />
    </main>
  )
}
