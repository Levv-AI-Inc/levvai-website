'use client'

import { useState } from 'react'

type Dimension = {
  key: string
  label: string
  type: 'enum' | 'number' | 'string'
}

type ApprovalRuleSet = {
  dimensions: Dimension[]
  rules: {
    [key: string]: string | number
  }[]
}

export default function ApprovalRulesTable({
  data,
  onChange,
}: {
  data: ApprovalRuleSet
  onChange: (updated: ApprovalRuleSet) => void
}) {
  const dimensions = data?.dimensions ?? []
const rules = data?.rules ?? []
  const [editing, setEditing] = useState<{
    row: number
    key: string
  } | null>(null)

  const updateCell = (
    rowIndex: number,
    key: string,
    value: string
  ) => {
    const updatedRules = [...rules]
    updatedRules[rowIndex] = {
      ...updatedRules[rowIndex],
      [key]: value,
    }

    onChange({
      ...data,
      rules: updatedRules,
    })

    setEditing(null)
  }

  if (!dimensions.length || !rules.length) {
    return (
      <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
        No approval rules defined yet.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {dimensions.map((dim) => (
              <th
                key={dim.key}
                className="px-4 py-3 text-left font-medium text-gray-600"
              >
                {dim.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y">
          {rules.map((rule, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {dimensions.map((dim) => {
                const isEditing =
                  editing?.row === rowIndex &&
                  editing.key === dim.key

                return (
                  <td
                    key={dim.key}
                    className="px-4 py-3 cursor-pointer"
                    onClick={() =>
                      setEditing({
                        row: rowIndex,
                        key: dim.key,
                      })
                    }
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        defaultValue={
                          rule[dim.key]?.toString() ?? ''
                        }
                        onBlur={(e) =>
                          updateCell(
                            rowIndex,
                            dim.key,
                            e.target.value
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateCell(
                              rowIndex,
                              dim.key,
                              (
                                e.target as HTMLInputElement
                              ).value
                            )
                          }
                        }}
                        className="w-full rounded-md border px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="text-gray-900">
                        {rule[dim.key] ?? '—'}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
