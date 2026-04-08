export const TABS = [
  'Business Units',
  'Cost Centers',
  'Locations',
  'Worksites',
  'Legal Entities',
  'Subsidiaries',
] as const

export type Tab = (typeof TABS)[number]
export type RowStatus = 'Active' | 'Inactive'

export type TableRow = {
  id?: string | number
  status: RowStatus
  [key: string]: any
}

export type TableConfig = {
  title: string
  addLabel: string
  columns: { key: string; label: string }[]
  rows: TableRow[]
}
