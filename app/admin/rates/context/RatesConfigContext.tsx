'use client'

import React, { createContext, useContext, useState } from 'react'

type RateComponent = {
  id: string
  key: string
  name: string
  type: 'currency' | 'percentage'
}

type RateStructure = {
  id: string
  name: string
  components: RateComponent[]
}

type RateRow = {
  id: string
  supplier: string
  location: string
  values: Record<string, number>
}

type RateCard = {
  id: string
  name: string
  role: string
  currency: string
  unit: string
  effectiveDate: string
  endDate: string
  rateStructureId: string
  rows: RateRow[]
}

type RatesContextType = {
  rateCards: RateCard[]
  setRateCards: React.Dispatch<React.SetStateAction<RateCard[]>>
  rateStructures: RateStructure[]
  setRateStructures: React.Dispatch<React.SetStateAction<RateStructure[]>>
  calculateBillRate: (structure: RateStructure, values: Record<string, number>) => number
}

const RatesConfigContext = createContext<RatesContextType | null>(null)

export function RatesConfigProvider({ children }: { children: React.ReactNode }) {

  const [rateStructures, setRateStructures] = useState<RateStructure[]>([
    {
      id: 'structure1',
      name: 'Standard Bill Rate',
      components: [
        { id: 'c1', key: 'payRate', name: 'Pay Rate', type: 'currency' },
        { id: 'c2', key: 'markup', name: 'Supplier Markup', type: 'percentage' }
      ]
    }
  ])

  const [rateCards, setRateCards] = useState<RateCard[]>([
    {
      id: '1',
      name: 'Senior Developer – Toronto',
      role: 'Senior Developer',
      currency: 'CAD',
      unit: 'Hour',
      effectiveDate: '2026-01-01',
      endDate: '2026-12-31',
      rateStructureId: 'structure1',
      rows: [
        {
          id: 'row1',
          supplier: 'Supplier A',
          location: 'Toronto',
          values: {
            payRate: 70,
            markup: 20
          }
        },
        {
          id: 'row2',
          supplier: 'Supplier B',
          location: 'Toronto',
          values: {
            payRate: 72,
            markup: 18
          }
        }
      ]
    }
  ])

  function calculateBillRate(
    structure: RateStructure,
    values: Record<string, number>
  ) {

    let total = 0

    structure.components.forEach((component) => {

      const value = values[component.key] ?? 0

      if (component.type === 'currency') {
        total += value
      }

      if (component.type === 'percentage') {
        total = total + total * (value / 100)
      }

    })

    return total

  }

  const value = {
    rateCards,
    setRateCards,
    rateStructures,
    setRateStructures,
    calculateBillRate
  }

  return (
    <RatesConfigContext.Provider value={value}>
      {children}
    </RatesConfigContext.Provider>
  )
}

export function useRatesConfig() {

  const context = useContext(RatesConfigContext)

  if (!context) {
    throw new Error('useRatesConfig must be used within RatesConfigProvider')
  }

  return context

}