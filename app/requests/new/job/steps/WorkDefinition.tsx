'use client'

import { useCWRequest } from '../context/CWRequestContext'

export default function WorkDefinition() {
  const { request, update } = useCWRequest()

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="font-semibold text-gray-900">Work definition</h3>

      {/* Role */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Role
        </label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          placeholder="e.g. Data Analyst II"
          value={request.role ?? ''}
          onChange={(e) => update({ role: e.target.value })}
        />
      </div>

      {/* Country */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Country
        </label>
        <input
          className="mt-1 w-60 rounded-md border px-3 py-2 text-sm"
          placeholder="e.g. US"
          value={request.country ?? ''}
          onChange={(e) => update({ country: e.target.value })}
        />
      </div>

      {/* Region */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Region / State
        </label>
        <input
          className="mt-1 w-60 rounded-md border px-3 py-2 text-sm"
          placeholder="e.g. New York"
          value={request.region ?? ''}
          onChange={(e) => update({ region: e.target.value })}
        />
      </div>
    </div>
  )
}
