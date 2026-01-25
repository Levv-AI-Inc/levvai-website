'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSOW } from '../context'

const COST_CENTERS = [
  { id: 'CC-1001', name: 'Technology' },
  { id: 'CC-2034', name: 'Finance Transformation' },
  { id: 'CC-3109', name: 'Enterprise Data' },
  { id: 'CC-4210', name: 'Operations Excellence' },
]

type Allocation = {
  costCenterId: string
  costCenterName: string
  mode: 'percentage' | 'amount'
  value: number
}

export default function FinancialsPage() {
  const router = useRouter()
  const { sow, setSOW } = useSOW()

  const [totalValue, setTotalValue] = useState<number | ''>(
    sow.financials?.totalValue || ''
  )

  const [allocations, setAllocations] = useState<Allocation[]>(
    sow.financials?.allocations || []
  )

  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  const addCostCenter = (ccId: string) => {
    const cc = COST_CENTERS.find(c => c.id === ccId)
    if (!cc) return

    if (allocations.some(a => a.costCenterId === ccId)) return

    setAllocations([
      ...allocations,
      {
        costCenterId: cc.id,
        costCenterName: `${cc.id} – ${cc.name}`,
        mode: 'percentage',
        value: 0,
      },
    ])

    setShowModal(false)
    setSearch('')
  }

  const removeAllocation = (ccId: string) => {
    setAllocations(allocations.filter(a => a.costCenterId !== ccId))
  }

  const updateAllocation = (
    ccId: string,
    updates: Partial<Allocation>
  ) => {
    setAllocations(
      allocations.map(a =>
        a.costCenterId === ccId ? { ...a, ...updates } : a
      )
    )
  }

  const splitEvenly = () => {
    if (allocations.length === 0) return
    const even = Math.floor(100 / allocations.length)
    setAllocations(
      allocations.map(a => ({
        ...a,
        mode: 'percentage',
        value: even,
      }))
    )
  }

  const totalPercentage = allocations.reduce(
    (sum, a) => (a.mode === 'percentage' ? sum + a.value : sum),
    0
  )

  const filteredCostCenters = COST_CENTERS.filter(cc =>
    `${cc.id} ${cc.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const handleContinue = () => {
    setSOW({
      financials: {
        totalValue: totalValue || undefined,
        currency: 'USD',
        allocations,
      },
    })

    router.push('/requests/sow/create/commercials')
  }

  return (
    <div className="max-w-7xl mx-auto px-10 py-8 grid grid-cols-[1fr_280px] gap-12">
      {/* LEFT */}
      <div className="space-y-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            Financials
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Allocate this engagement across one or more cost centers.
          </p>
        </div>

        {/* Total Value */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            Estimated total value
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={totalValue}
              onChange={e =>
                setTotalValue(
                  e.target.value ? Number(e.target.value) : ''
                )
              }
              className="text-sm w-60 rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="200000"
            />
            <span className="text-sm text-slate-500">USD</span>
          </div>

          {!totalValue && (
            <div className="text-xs text-slate-500">
              Required for approvals and budget checks.
            </div>
          )}
        </div>

        {/* Add Cost Center */}
        <div>
          <button
            onClick={() => setShowModal(true)}
            className="text-sm text-slate-700 border border-slate-300 px-4 py-2 rounded-full hover:bg-slate-50 transition"
          >
            + Add cost center
          </button>
        </div>

        {/* Allocation Cards */}
        <div className="space-y-3">
          {allocations.map(a => (
            <div
              key={a.costCenterId}
              className="rounded-xl border border-slate-200 p-5 space-y-2"
            >
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium text-slate-900">
                  {a.costCenterName}
                </div>
                <button
                  onClick={() =>
                    removeAllocation(a.costCenterId)
                  }
                  className="text-sm text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    checked={a.mode === 'percentage'}
                    onChange={() =>
                      updateAllocation(a.costCenterId, {
                        mode: 'percentage',
                        value: 0,
                      })
                    }
                  />
                  Percentage
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    checked={a.mode === 'amount'}
                    onChange={() =>
                      updateAllocation(a.costCenterId, {
                        mode: 'amount',
                        value: 0,
                      })
                    }
                  />
                  Amount
                </label>
              </div>

              <input
                type="number"
                value={a.value}
                onChange={e =>
                  updateAllocation(a.costCenterId, {
                    value: Number(e.target.value),
                  })
                }
                className="text-sm w-40 rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                placeholder={
                  a.mode === 'percentage' ? '50 %' : '100000'
                }
              />
            </div>
          ))}
        </div>

        {allocations.length > 1 && (
          <button
            onClick={splitEvenly}
            className="text-sm border border-slate-300 px-4 py-2 rounded-full w-fit hover:bg-slate-50 transition"
          >
            Split evenly
          </button>
        )}

        <div className="text-sm text-slate-500">
          {totalPercentage === 100
            ? 'Allocation totals 100%.'
            : `Allocation totals ${totalPercentage}%.`}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            className="px-6 py-2.5 rounded-full text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Continue
          </button>
        </div>
      </div>

      {/* RIGHT STATUS */}
      <div className="sticky top-10 h-fit rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="text-sm font-medium text-slate-900">
          SOW progress
        </div>

        <StatusItem label="Description" status="complete" />
        <StatusItem label="Financials" status="active" />
        <StatusItem label="Commercials" status="pending" />
        <StatusItem label="Review" status="pending" />
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-slate-900">
                Add cost center
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cost centers"
              className="text-sm w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />

            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
              {filteredCostCenters.map(cc => (
                <button
                  key={cc.id}
                  onClick={() => addCostCenter(cc.id)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                >
                  {cc.id} – {cc.name}
                </button>
              ))}

              {filteredCostCenters.length === 0 && (
                <div className="text-sm text-slate-400 p-3">
                  No results
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
      ? 'bg-emerald-500'
      : status === 'active'
      ? 'bg-amber-400'
      : 'bg-slate-300'

  return (
    <div className="flex items-center gap-3 text-sm text-slate-700">
      <span
        className={`w-2.5 h-2.5 rounded-full ${color}`}
      />
      <span>{label}</span>
    </div>
  )
}
