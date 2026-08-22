// app/requests/sow_create/loading.tsx
export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-pulse">
      {/* Step header */}
      <div className="mb-6 space-y-2">
        <div className="h-6 w-1/3 bg-gray-300 rounded" />
        <div className="h-4 w-1/2 bg-gray-200 rounded" />
      </div>

      {/* Main content card */}
      <div className="border rounded-lg bg-white p-6 space-y-4">
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 rounded" />

        {/* Form fields */}
        <div className="pt-4 space-y-3">
          <div className="h-10 w-full bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-200 rounded" />
          <div className="h-10 w-2/3 bg-gray-200 rounded" />
        </div>

        {/* Footer actions */}
        <div className="pt-6 flex justify-end gap-3">
          <div className="h-9 w-24 bg-gray-200 rounded" />
          <div className="h-9 w-28 bg-gray-300 rounded" />
        </div>
      </div>
    </div>
  )
}
