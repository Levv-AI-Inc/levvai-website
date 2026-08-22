'use client'

import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useRatesConfig } from '../../context/RatesConfigContext'

const suppliers = ['Supplier A', 'Supplier B', 'Supplier C', 'Supplier D']
const locations = ['Toronto', 'New York', 'London', 'Remote']

export default function RateCardDetailPage() {

  const params = useParams()
  const cardId = String(params.id)

  const { rateCards, rateStructures, calculateBillRate } = useRatesConfig()

  const initialCard =
    rateCards.find((card) => card.id === cardId) ?? rateCards[0]

  const [card, setCard] = useState(initialCard)

  const rateStructure = useMemo(() => {
    return rateStructures.find(
      (structure) => structure.id === card.rateStructureId
    )
  }, [card.rateStructureId, rateStructures])

  if (!rateStructure) {
    return (
      <div className="p-6">
        <div className="border rounded-lg bg-white p-6 text-sm text-slate-600">
          Rate structure not found.
        </div>
      </div>
    )
  }

  function updateRowValue(
    rowIndex: number,
    componentKey: string,
    value: string
  ) {
    const updated = structuredClone(card)

    updated.rows[rowIndex].values[componentKey] = Number(value)

    setCard(updated)
  }

  function updateRowField(
    rowIndex: number,
    field: 'supplier' | 'location',
    value: string
  ) {
    const updated = structuredClone(card)

    updated.rows[rowIndex][field] = value

    setCard(updated)
  }

  function addRow() {

    const blankValues: Record<string, number> = {}

    rateStructure.components.forEach((component) => {
      blankValues[component.key] = 0
    })

    setCard({
      ...card,
      rows: [
        ...card.rows,
        {
          id: Date.now().toString(),
          supplier: '',
          location: '',
          values: blankValues
        }
      ]
    })
  }

  function deleteRow(rowIndex: number) {

    setCard({
      ...card,
      rows: card.rows.filter((_, i) => i !== rowIndex)
    })
  }

  return (

    <div className="p-6 space-y-6">

      {/* Header */}

      <div>

        <h1 className="text-xl font-semibold text-slate-900">
          {card.name}
        </h1>

        <p className="text-sm text-slate-500">
          Supplier pricing driven by the selected rate structure
        </p>

      </div>

      {/* Card Metadata */}

      <div className="border rounded-lg bg-white p-4">

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">

          <div>
            <label className="text-xs text-slate-500 uppercase">
              Role
            </label>
            <input
              value={card.role}
              readOnly
              className="w-full border rounded px-3 py-2 text-sm bg-slate-50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 uppercase">
              Currency
            </label>
            <input
              value={card.currency}
              readOnly
              className="w-full border rounded px-3 py-2 text-sm bg-slate-50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 uppercase">
              Unit
            </label>
            <input
              value={card.unit}
              readOnly
              className="w-full border rounded px-3 py-2 text-sm bg-slate-50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 uppercase">
              Effective Date
            </label>
            <input
              value={card.effectiveDate}
              readOnly
              className="w-full border rounded px-3 py-2 text-sm bg-slate-50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 uppercase">
              End Date
            </label>
            <input
              value={card.endDate}
              readOnly
              className="w-full border rounded px-3 py-2 text-sm bg-slate-50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 uppercase">
              Rate Structure
            </label>
            <input
              value={rateStructure.name}
              readOnly
              className="w-full border rounded px-3 py-2 text-sm bg-slate-50"
            />
          </div>

        </div>

      </div>

      {/* Rate Table */}

      <div className="border rounded-lg bg-white overflow-hidden">

        <table className="w-full text-sm">

          <thead className="bg-slate-50 border-b">

            <tr>

              <th className="px-4 py-3 text-left">Supplier</th>
              <th className="px-4 py-3 text-left">Location</th>

              {rateStructure.components.map((component) => (
                <th key={component.id} className="px-4 py-3 text-left">
                  {component.name}
                </th>
              ))}

              <th className="px-4 py-3 text-left">Bill Rate</th>

              <th className="px-4 py-3"></th>

            </tr>

          </thead>

          <tbody>

            {card.rows.map((row, rowIndex) => {

              const billRate = calculateBillRate(
                rateStructure,
                row.values
              )

              return (

                <tr key={row.id} className="border-b hover:bg-slate-50 group">

                  {/* Supplier */}

                  <td className="px-4 py-2">

                    <select
                      value={row.supplier}
                      onChange={(e) =>
                        updateRowField(rowIndex, 'supplier', e.target.value)
                      }
                      className="w-full border rounded px-2 py-1"
                    >

                      <option value="">Select supplier</option>

                      {suppliers.map((supplier) => (
                        <option key={supplier}>{supplier}</option>
                      ))}

                    </select>

                  </td>

                  {/* Location */}

                  <td className="px-4 py-2">

                    <select
                      value={row.location}
                      onChange={(e) =>
                        updateRowField(rowIndex, 'location', e.target.value)
                      }
                      className="w-full border rounded px-2 py-1"
                    >

                      <option value="">Select location</option>

                      {locations.map((location) => (
                        <option key={location}>{location}</option>
                      ))}

                    </select>

                  </td>

                  {/* Dynamic Rate Components */}

                  {rateStructure.components.map((component) => (

                    <td key={component.id} className="px-4 py-2">

                      <div className="flex items-center border rounded px-2">

                        {component.type === 'currency' && (
                          <span className="mr-1 text-slate-500">$</span>
                        )}

                        <input
                          value={row.values[component.key] ?? 0}
                          onChange={(e) =>
                            updateRowValue(
                              rowIndex,
                              component.key,
                              e.target.value
                            )
                          }
                          className="w-full py-1 outline-none"
                        />

                        {component.type === 'percentage' && (
                          <span className="ml-1 text-slate-500">%</span>
                        )}

                      </div>

                    </td>

                  ))}

                  {/* Calculated Bill Rate */}

                  <td className="px-4 py-2 font-medium">

                    ${billRate.toFixed(2)}

                  </td>

                  {/* Delete */}

                  <td className="px-4 py-2 opacity-0 group-hover:opacity-100 text-right">

                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="text-red-500 text-sm hover:text-red-700"
                    >
                      Delete
                    </button>

                  </td>

                </tr>

              )

            })}

          </tbody>

        </table>

        <div className="p-4 border-t">

          <button
            onClick={addRow}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Add Row
          </button>

        </div>

      </div>

    </div>

  )

}