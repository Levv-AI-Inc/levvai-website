'use client'

import { useRouter } from 'next/navigation'
import { UserCheck, Clock, AlertCircle, ShieldAlert, ArrowRight } from 'lucide-react'

// Updated mock data to reflect the Governance logic we built
const onboardingRows = [
  {
    workerId: '123',
    name: 'John Smith',
    startDate: 'Sep 23, 2026',
    readiness: 14, // Changed to number for progress bar logic
    status: 'In Progress',
    pendingWith: 'IT', // Maps to our ApproverGroups
    currentTask: 'Laptop Provisioning',
  },
  {
    workerId: '124',
    name: 'Maria Gonzalez',
    startDate: 'Sep 25, 2026',
    readiness: 72,
    status: 'Blocked',
    pendingWith: 'LEGAL',
    currentTask: 'NDA Verification',
  },
  {
    workerId: '125',
    name: 'David Chen',
    startDate: 'Oct 1, 2026',
    readiness: 100,
    status: 'Ready',
    pendingWith: 'SYSTEM',
    currentTask: 'Fully Validated',
  },
]

export default function OnboardingOverviewPage() {
  const router = useRouter()

  return (
    <div className="p-8 space-y-8 bg-slate-50/30 min-h-screen text-slate-900">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Onboarding Overview</h1>
          <p className="text-slate-500 font-medium">Real-time status of worker requirements and approval gates.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white border rounded-xl px-4 py-2 shadow-sm text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Avg. Velocity</div>
            <div className="text-lg font-black text-indigo-600">4.2 Days</div>
          </div>
        </div>
      </header>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4 text-slate-900">Worker Details</th>
              <th className="px-6 py-4">Start Date</th>
              <th className="px-6 py-4">Readiness Progress</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Current Bottleneck</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {onboardingRows.map((row) => (
              <tr
                key={row.workerId}
                onClick={() =>
                  router.push(`/workers/${row.workerId}/engagements/onboarding/workspace`)
                }
                className="group cursor-pointer hover:bg-slate-50/80 transition-all"
              >
                {/* Worker Name */}
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200">
                      {row.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-base">{row.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">ID: {row.workerId}</div>
                    </div>
                  </div>
                </td>

                {/* Start Date */}
                <td className="px-6 py-5 text-slate-600 font-medium">
                  {row.startDate}
                </td>

                {/* Readiness Progress Bar */}
                <td className="px-6 py-5">
                  <div className="w-48 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>{row.readiness}% Complete</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          row.readiness === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${row.readiness}%` }}
                      />
                    </div>
                  </div>
                </td>

                {/* Status Badge */}
                <td className="px-6 py-5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-black uppercase tracking-wider border ${
                      row.status === 'Ready'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : row.status === 'Blocked'
                        ? 'bg-red-50 text-red-700 border-red-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}
                  >
                    {row.status === 'Ready' && <UserCheck className="h-3 w-3" />}
                    {row.status === 'Blocked' && <AlertCircle className="h-3 w-3" />}
                    {row.status === 'In Progress' && <Clock className="h-3 w-3" />}
                    {row.status}
                  </span>
                </td>

                {/* Dynamic Blocker / Bottleneck */}
                <td className="px-6 py-5">
                  {row.status === 'Ready' ? (
                    <span className="text-slate-300 italic text-xs">Clear to start</span>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase leading-none">Pending {row.pendingWith}</div>
                        <div className="text-sm font-bold text-slate-700 tracking-tight">{row.currentTask}</div>
                      </div>
                    </div>
                  )}
                </td>

                {/* Action Icon */}
                <td className="px-6 py-5 text-right">
                  <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}