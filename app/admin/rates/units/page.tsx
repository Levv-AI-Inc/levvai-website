'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

type Unit = {
  id: string
  code: string
  name: string
  description: string
}

export default function UnitsPage() {

  const [units, setUnits] = useState<Unit[]>([
    {
      id: '1',
      code: 'HR',
      name: 'Hour',
      description: 'Hourly work'
    },
    {
      id: '2',
      code: 'DY',
      name: 'Day',
      description: 'Daily consulting work'
    },
    {
      id: '3',
      code: 'EA',
      name: 'Each',
      description: 'Deliverable-based unit'
    }
  ])

  function updateField(index: number, field: keyof Unit, value: string) {

    const updated = [...units]
    updated[index][field] = value
    setUnits(updated)

  }

  function addUnit() {

    setUnits([
      ...units,
      {
        id: Date.now().toString(),
        code: '',
        name: '',
        description: ''
      }
    ])

  }

  function deleteUnit(index: number) {

    const updated = units.filter((_, i) => i !== index)
    setUnits(updated)

  }

  return (

    <div className="p-6 space-y-6">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Units of Measure
          </h1>

          <p className="text-sm text-slate-500">
            Define how work is billed across rate cards, timesheets, and invoices.
          </p>
        </div>

        <button
          onClick={addUnit}
          className="flex items-center gap-2 rounded-md bg-slate-900 text-white px-3 py-2 text-sm hover:bg-slate-800"
        >
          <Plus size={16} />
          Add Unit
        </button>

      </div>

      {/* Table */}

      <div className="rounded-lg border bg-white overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-slate-50 border-b">

            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Description</th>
              <th className="px-4 py-3"></th>
            </tr>

          </thead>

          <tbody>

            {units.map((unit, index) => (

              <tr key={unit.id} className="border-b hover:bg-slate-50 group">

                <td className="px-4 py-2">

                  <input
                    value={unit.code}
                    onChange={(e) =>
                      updateField(index, 'code', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />

                </td>

                <td className="px-4 py-2">

                  <input
                    value={unit.name}
                    onChange={(e) =>
                      updateField(index, 'name', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />

                </td>

                <td className="px-4 py-2">

                  <input
                    value={unit.description}
                    onChange={(e) =>
                      updateField(index, 'description', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />

                </td>

                <td className="px-4 py-2 opacity-0 group-hover:opacity-100 text-right">

                  <button
                    onClick={() => deleteUnit(index)}
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