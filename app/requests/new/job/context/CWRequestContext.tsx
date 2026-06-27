'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { Qualification } from '@/lib/qualifications'

export type CWRequest = {
  intakeId?: number
  roleId?: number
  jobTemplateId?: number | string

  role?: string
  description?: string

  country?: string
  region?: string
  city?: string
  stateProvince?: string

  startDate?: string
  endDate?: string
  hoursPerWeek?: number
  positions?: number

  pricingModel?: 'pay_markup' | 'bill_only'
  enteredRate?: number
  targetRate?: number
  targetRateMin?: number
  targetRateMax?: number
  rateMode?: 'fixed' | 'range'
  overtimeEnabled?: boolean
  overtimeFactor?: number
  selectedRateCardId?: number
  financialsSeedRateCardId?: number
  financialsBaseRateVersion?: number
  qualificationsEnabled?: boolean
  qualifications?: Qualification[]
  budgetAmount?: number
  rateUnit?: string
  currency?: string

  costCenter?: string
  costCenterId?: number
  siteId?: number
  legalEntityId?: string
  supplierId?: number
  suppliers?: string[]
  customFields?: Record<string, unknown>

  /* -----------------------------
     Calculated / Derived (MVP)
  -------------------------------- */
  estimatedTotal?: number

  stRate?: number
  otRate?: number
}

const STORAGE_KEY = 'cw-request-form:v1'

function readPersistedRequest(): CWRequest {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed as CWRequest
  } catch {
    return {}
  }
}

const CWRequestContext = createContext<{
  request: CWRequest
  update: (data: Partial<CWRequest>) => void
  replace: (data: CWRequest) => void
  clear: () => void
}>({
  request: {},
  update: () => {},
  replace: () => {},
  clear: () => {},
})

export const CWRequestProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [request, setRequest] = useState<CWRequest>(() =>
    readPersistedRequest(),
  )

  const update = (data: Partial<CWRequest>) =>
    setRequest(prev => ({ ...prev, ...data }))

  const replace = (data: CWRequest) => setRequest(data)

  const clear = () => setRequest({})

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      if (Object.keys(request).length === 0) {
        window.sessionStorage.removeItem(STORAGE_KEY)
        return
      }
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(request),
      )
    } catch {
      // best-effort persistence
    }
  }, [request])

  return (
    <CWRequestContext.Provider value={{ request, update, replace, clear }}>
      {children}
    </CWRequestContext.Provider>
  )
}

export const useCWRequest = () => useContext(CWRequestContext)
