export default function AIRulesPanel() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm md:col-span-2">
        <label className="mb-2 block text-sm font-black text-slate-900">
          Type the desired changes or updates
        </label>
        <textarea
          className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          rows={3}
          placeholder="Type to create or edit company information"
        />
        <button className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-cyan-900/10 hover:bg-slate-800">
          ✨ Generate rules
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-1 font-black text-slate-900">✨ AI Insights</div>
        <p className="text-sm font-medium text-slate-500">Generate rules to see insights.</p>
      </div>
    </div>
  )
}
