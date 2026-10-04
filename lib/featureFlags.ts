export const FEATURE_FLAGS = {
  user_detail_v2: process.env.NEXT_PUBLIC_FEATURE_USER_DETAIL_V2 === 'true',
  user_access_management:
    process.env.NEXT_PUBLIC_FEATURE_USER_ACCESS_MANAGEMENT === 'true',
  supplier_detail_v2:
    process.env.NEXT_PUBLIC_FEATURE_SUPPLIER_DETAIL_V2 === 'true',
  supplier_coverage:
    process.env.NEXT_PUBLIC_FEATURE_SUPPLIER_COVERAGE === 'true',
  supplier_rate_cards_v2:
    process.env.NEXT_PUBLIC_FEATURE_SUPPLIER_RATE_CARDS_V2 === 'true',
  agreement_extraction:
    process.env.NEXT_PUBLIC_FEATURE_AGREEMENT_EXTRACTION === 'true',
  deterministic_rate_resolution:
    process.env.NEXT_PUBLIC_FEATURE_DETERMINISTIC_RATE_RESOLUTION === 'true',
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}
