'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

type Rule = {
  id: string
  name: string
  condition: string
  result: string
}

export default function RateRulesPage() {

  const [rules, setRules] = useState<Rule[]>([
    {
      id: '1',
      name: 'Daily Overtime',
      condition: 'Hours > 8',
      result: 'Apply OT'
    },
    {
      id: '2',
      name: 'Double Time',
      condition: 'Hours > 12',
      result: 'Apply DT'
    }
  ])

  function updateField(index: number, field: keyof Rule, value: string) {

    const updated = [...rules]
    updated[index][field] = value
    setRules(updated)

  }

  function addRule() {

    setRules([
      ...rules,
      {
        id: Date.now().toString(),
        name: '',
        condition: '',
        result: ''
      }
    ])

  }

  function deleteRule(index: number) {

    const updated = rules.filter((_, i) => i !== index)
    setRules(updated)

  }

  return (

    <div className="p-6 space-y-6">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Rate Rules
          </h1>

          <p className="text-sm text-slate-500">
            Define logic that automatically applies rate categories to timesheets.
          </p>
        </div>

        <button
          onClick={addRule}
          className="flex items-center gap-2 rounded-md bg-slate-900 text-white px-3 py-2 text-sm hover:bg-slate-800"
        >
          <Plus size={16} />
          Add Rule
        </button>

      </div>

      {/* Table */}

      <div className="rounded-lg border bg-white overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-slate-50 border-b">

            <tr>
              <th className="text-left px-4 py-3">Rule Name</th>
              <th className="text-left px-4 py-3">Condition</th>
              <th className="text-left px-4 py-3">Result</th>
              <th className="px-4 py-3"></th>
            </tr>

          </thead>

          <tbody>

            {rules.map((rule, index) => (

              <tr key={rule.id} className="border-b hover:bg-slate-50 group">

                <td className="px-4 py-2">

                  <input
                    value={rule.name}
                    onChange={(e) =>
                      updateField(index, 'name', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />

                </td>

                <td className="px-4 py-2">

                  <input
                    value={rule.condition}
                    onChange={(e) =>
                      updateField(index, 'condition', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />

                </td>

                <td className="px-4 py-2">

                  <input
                    value={rule.result}
                    onChange={(e) =>
                      updateField(index, 'result', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />

                </td>

                <td className="px-4 py-2 opacity-0 group-hover:opacity-100 text-right">

                  <button
                    onClick={() => deleteRule(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>

  )
}