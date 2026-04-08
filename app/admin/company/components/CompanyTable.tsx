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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
        <button
          onClick={onAdd}
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + {config.addLabel}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {config.columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left font-medium">
                  {column.label}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {config.rows.map((row, index) => (
              <tr key={row.id ?? index} className="hover:bg-gray-50">
                {config.columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-gray-900">
                    {row[column.key]}
                  </td>
                ))}

                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>

                <td className="px-4 py-3">
                  {renderActions ? (
                    renderActions(row)
                  ) : (
                    <button
                      className="inline-flex items-center justify-center rounded-md p-2 transition hover:bg-gray-100"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4 text-gray-600" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: RowStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        status === 'Active'
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-200 text-gray-700'
      }`}
    >
      {status}
    </span>
  )
}
