import { RATE_TABLES, CWRateTable } from '../../data/rates'

type ResolveRateInput = {
  role: string
  country: string
  region?: string
}

export type RateResolutionResult = {
  rate: CWRateTable | null
  outcome: 'allowed' | 'exception' | 'blocked'
  reason?: string
}

export function resolveCWRate(
  input: ResolveRateInput
): RateResolutionResult {
  const { role, country, region } = input

  // Active exact match
  const exactMatch = RATE_TABLES.find(
    (r) =>
      r.role === role &&
      r.location.country === country &&
      r.location.region === region &&
      r.status === 'active'
  )

  if (exactMatch) {
    return {
      rate: exactMatch,
      outcome: 'allowed',
    }
  }

  // Future rate exists → exception
  const futureMatch = RATE_TABLES.find(
    (r) =>
      r.role === role &&
      r.location.country === country &&
      r.location.region === region &&
      r.status === 'future'
  )

  if (futureMatch) {
    return {
      rate: futureMatch,
      outcome: 'exception',
      reason: 'Rate exists but is not yet effective',
    }
  }

  // Hard stop
  return {
    rate: null,
    outcome: 'blocked',
    reason: 'No approved rate found for this role and location',
  }
}
