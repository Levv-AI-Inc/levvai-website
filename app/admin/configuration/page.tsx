'use client'

import { Plus, Pencil, Trash2 } from 'lucide-react'

type CustomField = {
  id: string
  module: string
  label: string
  name: string
  type: string
  required: boolean
}

const customFields: CustomField[] = []

export default function ConfigurationPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Configuration
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Define custom fields and system configuration used across CWS.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-lg border bg-white">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-sm font-medium text-gray-900">
            Custom Fields
          </h2>

          <button
            className="
              inline-flex items-center gap-2
              rounded-full bg-black px-3 py-2
              text-sm font-medium text-white
              hover:bg-gray-800
            "
          >
            <Plus className="h-4 w-4" />
            Add field
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Module</th>
                <th className="px-6 py-3 text-left font-medium">Label</th>
                <th className="px-6 py-3 text-left font-medium">Name</th>
                <th className="px-6 py-3 text-left font-medium">Type</th>
                <th className="px-6 py-3 text-left font-medium">
                  Required
                </th>
                <th className="px-6 py-3 text-right font-medium">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {customFields.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-gray-500"
                  >
                    No custom fields configured
                  </td>
                </tr>
              )}

              {customFields.map((field) => (
                <tr key={field.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{field.module}</td>
                  <td className="px-6 py-4">{field.label}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {field.name}
                  </td>
                  <td className="px-6 py-4">{field.type}</td>
                  <td className="px-6 py-4">
                    {field.required ? 'Yes' : 'No'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-3">
                      <button className="text-gray-500 hover:text-gray-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="text-gray-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 text-sm text-gray-500">
          <span>Showing 0 of 0 entries</span>
          <div className="flex gap-3">
            <button className="hover:text-gray-700">Previous</button>
            <button className="hover:text-gray-700">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
