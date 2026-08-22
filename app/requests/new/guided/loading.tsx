export default function GuidedLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-32 bg-gray-200 rounded" />

      {/* Title */}
      <div className="space-y-2">
        <div className="h-6 w-2/3 bg-gray-300 rounded" />
        <div className="h-4 w-1/2 bg-gray-200 rounded" />
      </div>

      {/* Main cards / content area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="h-32 bg-gray-200 rounded-lg" />
        <div className="h-32 bg-gray-200 rounded-lg" />
        <div className="h-32 bg-gray-200 rounded-lg" />
      </div>

      {/* Footer action */}
      <div className="flex justify-end mt-10">
        <div className="h-10 w-32 bg-gray-300 rounded-lg" />
      </div>
    </div>
  )
}
