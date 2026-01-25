export type CWRateTable = {
  id: string
  role: string
  location: {
    country: string
    region?: string
  }
  pricingModel: 'bill_only' | 'pay_plus_markup'
  billRate?: {
    min: number
    max: number
  }
  payRate?: {
    min: number
    max: number
  }
  overtimeRule: {
    label: string
    thresholdHours: number
    multiplier: number
  }
  status: 'active' | 'future'
}

export const RATE_TABLES: CWRateTable[] = [
  {
    id: 'RT-001',
    role: 'Data Analyst II',
    location: {
      country: 'US',
      region: 'New York',
    },
    pricingModel: 'pay_plus_markup',
    payRate: {
      min: 80,
      max: 90,
    },
    overtimeRule: {
      label: 'OT after 40 hrs',
      thresholdHours: 40,
      multiplier: 1.5,
    },
    status: 'active',
  },
  {
    id: 'RT-002',
    role: 'Software Engineer',
    location: {
      country: 'US',
      region: 'California',
    },
    pricingModel: 'bill_only',
    billRate: {
      min: 95,
      max: 110,
    },
    overtimeRule: {
      label: 'OT after 40 hrs',
      thresholdHours: 40,
      multiplier: 1.5,
    },
    status: 'future',
  },
]
