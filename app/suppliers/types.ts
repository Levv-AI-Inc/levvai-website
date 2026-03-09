import type { SupplierUpsertPayload } from '@/lib/api/suppliers'

export type SupplierFormState = Omit<
  SupplierUpsertPayload,
  'active_workers' | 'active_sows'
> & {
  active_workers: string
  active_sows: string
}
