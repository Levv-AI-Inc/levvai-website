'use client'

import { useState } from 'react'
import { useRatesConfig } from '../context/RatesConfigContext'

export default function RateStructurePage() {

  const { rateStructures, setRateStructures } = useRatesConfig()

  const [newComponentName, setNewComponentName] = useState('')
  const [componentType, setComponentType] = useState<'currency' | 'percentage'>('currency')

  function addComponent(structureId: string) {

    if (!newComponentName) return

    const updated = rateStructures.map((structure) => {

      if (structure.id !== structureId) return structure

      return {
        ...structure,
        components: [
          ...structure.components,
          {
            id: Date.now().toString(),
            key: newComponentName.toLowerCase().replace(/\s/g, ''),
            name: newComponentName,
            type: componentType
          }
        ]
      }

    })

    setRateStructures(updated)
    setNewComponentName('')
  }

  return (

    <div className="p-6 space-y-6">

      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Rate Structures
        </h1>

        <p className="text-sm text-slate-500">
          Configure how bill rates are calculated.
        </p>
      </div>

      {rateStructures.map((structure) => (

        <div
          key={structure.id}
          className="rounded-lg border bg-white overflow-hidden"
        >

          <div className="px-4 py-3 border-b bg-slate-50 flex justify-between items-center">

            <h2 className="text-sm font-medium text-slate-900">
              {structure.name}
            </h2>

          </div>

          <table className="w-full text-sm">

            <thead className="bg-white border-b">

              <tr>
                <th className="text-left px-4 py-3">Component</th>
                <th className="text-left px-4 py-3">Type</th>
              </tr>

            </thead>

            <tbody>

              {structure.components.map((component) => (

                <tr key={component.id} className="border-b">

                  <td className="px-4 py-3">
                    {component.name}
                  </td>

                  <td className="px-4 py-3 text-slate-500">
                    {component.type}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

          <div className="p-4 border-t flex items-center gap-3">

            <input
              placeholder="Component name (ex: Vendor Fee)"
              value={newComponentName}
              onChange={(e) => setNewComponentName(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            />

            <select
              value={componentType}
              onChange={(e) => setComponentType(e.target.value as any)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="currency">Currency</option>
              <option value="percentage">Percentage</option>
            </select>

            <button
              onClick={() => addComponent(structure.id)}
              className="bg-slate-900 text-white px-3 py-2 rounded text-sm"
            >
              Add Component
            </button>

          </div>

        </div>

      ))}

    </div>

  )

}