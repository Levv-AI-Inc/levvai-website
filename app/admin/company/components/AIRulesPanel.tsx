export default function AIRulesPanel() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="rounded-lg border bg-white p-4 md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-gray-900">
          Type the desired changes or updates
        </label>
        <textarea
          className="w-full rounded-md border p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10"
          rows={3}
          placeholder="Type to create or edit company information"
        />
        <button className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900">
          ✨ Generate rules
        </button>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-1 font-medium text-gray-900">✨ AI Insights</div>
        <p className="text-sm text-gray-600">Generate rules to see insights.</p>
      </div>
    </div>
  )
}
