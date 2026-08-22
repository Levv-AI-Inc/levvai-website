export type RateComponentType = 'currency' | 'percentage'

export type RateComponent = {
  id: string
  key: string
  name: string
  type: RateComponentType
  required: boolean
  editableOnCard: boolean
  includedInBillRate: boolean
}

export type RateModel = {
  id: string
  name: string
  code: string
  currency: string
  unit: string
  components: RateComponent[]
}

export type SupplierRateRow = {
  id: string
  supplier: string
  location: string
  values: Record<string, number>
}

export type RateCardDetail = {
  id: string
  name: string
  role: string
  currency: string
  unit: string
  effectiveDate: string
  endDate: string
  rateModelId: string
  rows: SupplierRateRow[]
}

export const rateModels: RateModel[] = [
  {
    id: 'model-pay-statutory-markup',
    name: 'Pay + Statutory + Markup',
    code: 'PAY_STAT_MARKUP',
    currency: 'CAD',
    unit: 'Hour',
    components: [
      {
        id: 'c1',
        key: 'payRate',
        name: 'Pay Rate',
        type: 'currency',
        required: true,
        editableOnCard: true,
        includedInBillRate: true,
      },
      {
        id: 'c2',
        key: 'statutoryBurden',
        name: 'Statutory Burden',
        type: 'percentage',
        required: true,
        editableOnCard: true,
        includedInBillRate: true,
      },
      {
        id: 'c3',
        key: 'supplierMarkup',
        name: 'Supplier Markup',
        type: 'percentage',
        required: true,
        editableOnCard: true,
        includedInBillRate: true,
      },
    ],
  },
  {
    id: 'model-fixed-bill',
    name: 'Fixed Bill Rate',
    code: 'FIXED_BILL',
    currency: 'CAD',
    unit: 'Hour',
    components: [
      {
        id: 'c4',
        key: 'billRate',
        name: 'Bill Rate',
        type: 'currency',
        required: true,
        editableOnCard: true,
        includedInBillRate: true,
      },
    ],
  },
]

export const rateCards: RateCardDetail[] = [
  {
    id: '1',
    name: 'Senior Developer – Toronto',
    role: 'Senior Developer',
    currency: 'CAD',
    unit: 'Hour',
    effectiveDate: '2026-01-01',
    endDate: '2026-12-31',
    rateModelId: 'model-pay-statutory-markup',
    rows: [
      {
        id: 'r1',
        supplier: 'Supplier A',
        location: 'Toronto',
        values: {
          payRate: 50,
          statutoryBurden: 10,
          supplierMarkup: 20,
        },
      },
      {
        id: 'r2',
        supplier: 'Supplier B',
        location: 'Toronto',
        values: {
          payRate: 52,
          statutoryBurden: 9,
          supplierMarkup: 18,
        },
      },
    ],
  },
  {
    id: '2',
    name: 'QA Analyst – Toronto',
    role: 'QA Analyst',
    currency: 'CAD',
    unit: 'Hour',
    effectiveDate: '2026-01-01',
    endDate: '2026-12-31',
    rateModelId: 'model-fixed-bill',
    rows: [
      {
        id: 'r3',
        supplier: 'Supplier A',
        location: 'Toronto',
        values: {
          billRate: 55,
        },
      },
      {
        id: 'r4',
        supplier: 'Supplier C',
        location: 'Toronto',
        values: {
          billRate: 58,
        },
      },
    ],
  },
]

export function getRateModelById(rateModelId: string) {
  return rateModels.find((model) => model.id === rateModelId)
}

export function calculateBillRate(
  model: RateModel,
  values: Record<string, number>
): number {
  if (model.code === 'FIXED_BILL') {
    return values.billRate ?? 0
  }

  if (model.code === 'PAY_STAT_MARKUP') {
    const payRate = values.payRate ?? 0
    const statutoryBurden = values.statutoryBurden ?? 0
    const supplierMarkup = values.supplierMarkup ?? 0

    const statutoryAmount = payRate * (statutoryBurden / 100)
    const markupBase = payRate + statutoryAmount
    const markupAmount = markupBase * (supplierMarkup / 100)

    return Number((payRate + statutoryAmount + markupAmount).toFixed(2))
  }

  return 0
}