import type { Tab } from '../types'

export default function CompanyTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: readonly Tab[]
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}) {
  return (
    <div className="flex flex-wrap gap-6 border-b text-sm font-medium">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`pb-3 transition ${
            activeTab === tab
              ? 'border-b-2 border-black text-black'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
