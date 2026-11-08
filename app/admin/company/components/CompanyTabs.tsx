import { LevvTabs } from '@/components/ui/levv-app'
import type { Tab } from '../types'

export default function CompanyTabs({
  tabs,
  activeTab,
  onTabChange,
  counts = {},
}: {
  tabs: readonly Tab[]
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  /** Records loaded for a tab; a tab without a count shows none. */
  counts?: Partial<Record<Tab, number>>
}) {
  return (
    <LevvTabs<Tab>
      label="Company records"
      value={activeTab}
      onChange={onTabChange}
      options={tabs.map((tab) => ({ value: tab, label: tab, count: counts[tab] }))}
    />
  )
}
