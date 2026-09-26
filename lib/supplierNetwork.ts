'use client'

export type SupplierTier = 'tier1' | 'tier2' | 'excluded'

export type SupplierNetworkMap = Record<string, Record<string, SupplierTier>>

export const SUPPLIER_NETWORK_STORAGE_KEY = 'levv:supplier-network:v1'

export function readSupplierNetwork(): SupplierNetworkMap {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(SUPPLIER_NETWORK_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as SupplierNetworkMap
  } catch {
    return {}
  }
}

export function writeSupplierNetwork(network: SupplierNetworkMap) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    SUPPLIER_NETWORK_STORAGE_KEY,
    JSON.stringify(network),
  )
  window.dispatchEvent(new Event('supplier-network-change'))
}

export function getSupplierTier(
  network: SupplierNetworkMap,
  roleId: number | string,
  supplierId: number | string,
): SupplierTier {
  return network[String(roleId)]?.[String(supplierId)] || 'excluded'
}

export function setSupplierTier(
  network: SupplierNetworkMap,
  roleId: number | string,
  supplierId: number | string,
  tier: SupplierTier,
): SupplierNetworkMap {
  return {
    ...network,
    [String(roleId)]: {
      ...(network[String(roleId)] || {}),
      [String(supplierId)]: tier,
    },
  }
}
