export const EXPECTED_ALIGNMENT = {
  managed_services: {
    expectedPricing: ['Recurring'],
    discouragedPricing: ['Fixed Fee'],
    semanticIndicators: ['ongoing', 'support', 'operations', 'sla'],
  },
  implementation: {
    expectedPricing: ['Fixed Fee', 'Milestone-based'],
    discouragedPricing: ['Recurring'],
    semanticIndicators: ['implementation', 'project', 'go-live'],
  },
  advisory: {
    expectedPricing: ['T&M', 'Hourly'],
    discouragedPricing: ['Recurring'],
    semanticIndicators: ['advisory', 'assessment', 'strategy'],
  },
}
