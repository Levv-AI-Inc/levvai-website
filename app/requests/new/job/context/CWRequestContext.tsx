'use client'

import {
  useCallback,
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
  site?: string
  legalEntityId?: string
  legalEntity?: string
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

export const CW_REQUEST_STORAGE_KEY = 'cw-request-form:v1'
export const NOVA_JOB_DRAFT_STORAGE_KEY = 'levv:nova:jobDraft'

function readPersistedRequest(): CWRequest {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.sessionStorage.getItem(CW_REQUEST_STORAGE_KEY)
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

function readNovaDraft(): CWRequest {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.sessionStorage.getItem(NOVA_JOB_DRAFT_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed as CWRequest
  } catch (error) {
    console.error('Unable to load Nova job draft', error)
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
  const [hydrated, setHydrated] = useState(false)

  const update = useCallback((data: Partial<CWRequest>) =>
    setRequest(prev => ({ ...prev, ...data }))
  , [])

  const replace = useCallback((data: CWRequest) => setRequest(data), [])

  const clear = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(NOVA_JOB_DRAFT_STORAGE_KEY)
      window.sessionStorage.removeItem(CW_REQUEST_STORAGE_KEY)
    }
    setRequest({})
  }, [])

  useEffect(() => {
    const novaDraft = readNovaDraft()
    if (Object.keys(novaDraft).length > 0) {
      setRequest(novaDraft)
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(NOVA_JOB_DRAFT_STORAGE_KEY)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hydrated) return

    try {
      if (Object.keys(request).length === 0) {
        window.sessionStorage.removeItem(CW_REQUEST_STORAGE_KEY)
        return
      }
      window.sessionStorage.setItem(
        CW_REQUEST_STORAGE_KEY,
        JSON.stringify(request),
      )
    } catch {
      // best-effort persistence
    }
  }, [hydrated, request])

  if (!hydrated) return null

  return (
    <CWRequestContext.Provider value={{ request, update, replace, clear }}>
      {children}
    </CWRequestContext.Provider>
  )
}

export const useCWRequest = () => useContext(CWRequestContext)
