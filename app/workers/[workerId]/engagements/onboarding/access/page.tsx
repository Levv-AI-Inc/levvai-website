'use client'

export default function AccessPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-white p-4">
        <h2 className="text-lg font-semibold">Access Provisioning</h2>
        <p className="text-sm text-gray-500">
          System and application access required before start date
        </p>
      </div>

      <div className="rounded-md border bg-white p-4">
        <p className="text-sm text-gray-700">
          Access requests will appear here.
        </p>
      </div>
    </div>
  )
}
