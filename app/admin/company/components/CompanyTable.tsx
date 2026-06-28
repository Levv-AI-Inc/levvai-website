import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import type { RowStatus, TableConfig, TableRow } from '../types'

export default function CompanyTable({
  config,
  onAdd,
  renderActions,
}: {
  config: TableConfig
  onAdd: () => void
  renderActions?: (row: TableRow) => ReactNode
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900">{config.title}</h2>
        <button
          onClick={onAdd}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-cyan-900/10 hover:bg-slate-800"
        >
          + {config.addLabel}
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {config.columns.map((column) => (
                <th key={column.key} className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {column.label}
                </th>
              ))}
              <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</th>
              <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {config.rows.map((row, index) => (
              <tr key={row.id ?? index} className="transition-all hover:bg-cyan-50/40">
                {config.columns.map((column) => (
                  <td key={column.key} className="px-8 py-6 font-medium text-slate-900">
                    {row[column.key]}
                  </td>
                ))}

                <td className="px-8 py-6">
                  <StatusPill status={row.status} />
                </td>

                <td className="px-8 py-6">
                  {renderActions ? (
                    renderActions(row)
                  ) : (
                    <button
                      className="inline-flex items-center justify-center rounded-xl p-2 transition hover:bg-cyan-50"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4 text-slate-600" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: RowStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        status === 'Active'
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-200 text-slate-700'
      }`}
    >
      {status}
    </span>
  )
}
