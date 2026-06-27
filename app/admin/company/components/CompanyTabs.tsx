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
    <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm text-sm font-bold">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`rounded-2xl px-4 py-2.5 transition ${
            activeTab === tab
              ? 'bg-slate-950 text-white shadow-lg shadow-cyan-900/10'
              : 'text-slate-500 hover:bg-cyan-50 hover:text-cyan-700'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
