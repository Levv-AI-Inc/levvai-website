import type { ReactNode } from 'react'
import { LevvStatusBadge, levvUi } from '@/components/ui/levv-app'
import type { RowStatus, TableConfig, TableRow } from '../types'

/**
 * One tab's records on the paper: a table under the 2px head rule when the column is wide enough, stacked rows
 * when it is not (the pilots' container-query pattern).
 */
export default function CompanyTable({
  config,
  renderActions,
}: {
  config: TableConfig
  renderActions?: (row: TableRow) => ReactNode
}) {
  const [lead, ...rest] = config.columns
  const actions = (row: TableRow) =>
    renderActions ? (
      renderActions(row)
    ) : (
      <button className={levvUi.secondaryButton} aria-label={`Edit ${row[lead.key]}`}>
        Edit
      </button>
    )

  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold text-slate-950">{config.title}</h2>

      <div className={`${levvUi.tableShell} levv-cq`}>
        <ul className="levv-cq-list divide-y divide-[var(--line)] border-t-2 border-slate-950">
          {config.rows.map((row, index) => (
            <li key={row.id ?? index} className="flex items-start justify-between gap-3 py-3.5">
              <div className="min-w-0 space-y-1.5">
                <p className="text-[14px] font-medium text-slate-950">{row[lead.key]}</p>
                {rest.length > 0 ? (
                  <dl className="grid gap-x-5 gap-y-1">
                    {rest.map((column) => (
                      <div key={column.key} className="flex flex-wrap items-baseline gap-x-2">
                        <dt className={levvUi.label}>{column.label}</dt>
                        <dd className="text-[13px] tabular-nums text-slate-800">{row[column.key]}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <StatusMark status={row.status} />
              </div>
              <div className="shrink-0">{actions(row)}</div>
            </li>
          ))}
        </ul>

        <div className="levv-cq-table relative overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column.key} className={levvUi.th}>
                    {column.label}
                  </th>
                ))}
                <th className={`${levvUi.th} w-32`}>Status</th>
                <th className={`${levvUi.th} w-40`}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {config.rows.map((row, index) => (
                <tr
                  key={row.id ?? index}
                  className="hover:bg-[var(--surface)] [&>td]:border-b [&>td]:border-[var(--line)]"
                >
                  {config.columns.map((column, columnIndex) => (
                    <td
                      key={column.key}
                      className={`${levvUi.td} tabular-nums ${columnIndex === 0 ? 'font-medium text-slate-950' : ''}`}
                    >
                      {row[column.key]}
                    </td>
                  ))}

                  <td className={levvUi.td}>
                    <StatusMark status={row.status} />
                  </td>

                  <td className={`${levvUi.td} py-2`}>{actions(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function StatusMark({ status }: { status: RowStatus }) {
  return <LevvStatusBadge tone={status === 'Active' ? 'emerald' : 'slate'}>{status}</LevvStatusBadge>
}
