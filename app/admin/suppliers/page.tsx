'use client'

import { useState, useRef } from 'react'
import { Pencil, Upload, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

/* =========================
   TYPES
========================= */

type SupplierStatus = 'Active' | 'Inactive'

type Supplier = {
  name: string
  supplierId: string
  country: string
  status: SupplierStatus
}

/* =========================
   PAGE
========================= */

export default function SuppliersPage() {
  const [supplierList, setSupplierList] = useState<Supplier[]>(MOCK_SUPPLIERS)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle Excel Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const data = XLSX.utils.sheet_to_json(ws)

      // Map Excel data to Supplier type
      const newSuppliers: Supplier[] = data.map((row: any) => ({
        name: row.name || row['Supplier name'] || 'Unknown Supplier',
        supplierId: row.supplierId || row['Supplier ID'] || `SUP-${Math.floor(Math.random() * 90000)}`,
        country: row.country || 'N/A',
        status: row.status === 'Inactive' ? 'Inactive' : 'Active',
      }))

      setSupplierList((prev) => [...newSuppliers, ...prev])
      
      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* =========================
          Header
      ========================= */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Manage supplier master data used across sourcing, contracts,
            onboarding, invoicing, and payments.
          </p>
        </div>

        <button className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          + Add new supplier
        </button>
      </div>

      {/* =========================
          ACTION PANELS (AI + BULK)
      ========================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI Assistant */}
        <div className="rounded-lg border bg-white p-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            AI Assistant
          </label>
          <textarea
            className="w-full rounded-md border p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10"
            rows={3}
            placeholder="e.g. Add a new supplier named Global Tech in Germany"
          />
          <button className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900">
            ✨ Generate updates
          </button>
        </div>

        {/* Bulk Upload */}
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-white p-2 shadow-sm mb-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">Mass Upload Suppliers</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Upload an .xlsx with name, supplierId, country, and status.
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".xlsx,.xls" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            Select Excel File
          </button>
        </div>
      </div>

      {/* =========================
          Suppliers Table
      ========================= */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Supplier name</th>
              <th className="px-4 py-3 text-left font-medium">Supplier ID</th>
              <th className="px-4 py-3 text-left font-medium">Country</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {supplierList.map((supplier, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-gray-900">{supplier.name}</td>
                <td className="px-4 py-3 text-gray-700">{supplier.supplierId}</td>
                <td className="px-4 py-3 text-gray-700">{supplier.country}</td>
                <td className="px-4 py-3"><StatusPill status={supplier.status} /></td>
                <td className="px-4 py-3">
                  <button className="p-2 rounded-md hover:bg-gray-100 transition">
                    <Pencil className="h-4 w-4 text-gray-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* =========================
   Status Pill & Mock Data
========================= */

function StatusPill({ status }: { status: SupplierStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
      status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
    }`}>
      {status}
    </span>
  )
}

const MOCK_SUPPLIERS: Supplier[] = [
  { name: 'Honeycomb Manufacturing Inc.', supplierId: 'SUP-10021', country: 'United States', status: 'Active' },
  { name: 'Northstar Consulting Group', supplierId: 'SUP-10034', country: 'Canada', status: 'Inactive' },
  { name: 'Vertex IT Services', supplierId: 'SUP-10058', country: 'United Kingdom', status: 'Active' },
]