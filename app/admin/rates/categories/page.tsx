'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

type Category = {
  id: string
  code: string
  name: string
  multiplier: number
}

export default function RateCategoriesPage() {

  const [categories, setCategories] = useState<Category[]>([
    { id: '1', code: 'ST', name: 'Standard', multiplier: 1 },
    { id: '2', code: 'OT', name: 'Overtime', multiplier: 1.5 },
    { id: '3', code: 'DT', name: 'Double Time', multiplier: 2 },
  ])

  function updateField(index: number, field: keyof Category, value: string) {

    const updated = [...categories]

    if (field === 'multiplier') {
      updated[index][field] = Number(value)
    } else {
      updated[index][field] = value
    }

    setCategories(updated)
  }

  function addCategory() {
    setCategories([
      ...categories,
      { id: Date.now().toString(), code: '', name: '', multiplier: 1 }
    ])
  }

  function deleteCategory(index: number) {
    const updated = categories.filter((_, i) => i !== index)
    setCategories(updated)
  }

  return (

    <div className="p-6 space-y-6">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Rate Categories
          </h1>

          <p className="text-sm text-slate-500">
            Define the time classifications used in timesheets and rate cards.
          </p>
        </div>

        <button
          onClick={addCategory}
          className="flex items-center gap-2 rounded-md bg-slate-900 text-white px-3 py-2 text-sm hover:bg-slate-800"
        >
          <Plus size={16} />
          Add Category
        </button>

      </div>

      {/* Table */}

      <div className="rounded-lg border bg-white overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-slate-50 border-b">

            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Multiplier</th>
              <th className="px-4 py-3"></th>
            </tr>

          </thead>

          <tbody>

            {categories.map((cat, index) => (

              <tr key={cat.id} className="border-b hover:bg-slate-50 group">

                <td className="px-4 py-2">

                  <input
                    value={cat.code}
                    onChange={(e) =>
                      updateField(index, 'code', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />

                </td>

                <td className="px-4 py-2">

                  <input
                    value={cat.name}
                    onChange={(e) =>
                      updateField(index, 'name', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />

                </td>

                <td className="px-4 py-2">

                  <input
                    value={cat.multiplier}
                    onChange={(e) =>
                      updateField(index, 'multiplier', e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />

                </td>

                <td className="px-4 py-2 opacity-0 group-hover:opacity-100 text-right">

                  <button
                    onClick={() => deleteCategory(index)}
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