'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useCWRequest } from '../../context/CWRequestContext'
import {
  ApiError,
  getSuppliers,
  type SupplierRecord,
} from '@/lib/api/suppliers'

function supplierKey(supplier: SupplierRecord) {
  return String(supplier.id ?? supplier.supplier_id)
}

export default function CWSuppliersPage() {
  const router = useRouter()
  const { request, update } = useCWRequest()

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [suppliersError, setSuppliersError] = useState('')

  const [selected, setSelected] = useState<string[]>(request.suppliers || [])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)

  /* Close dropdown on outside click */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () =>
      document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadSuppliers = async () => {
      setLoadingSuppliers(true)
      setSuppliersError('')

      try {
        const rows = await getSuppliers()
        if (cancelled) return
        setSuppliers(rows)
      } catch (error) {
        if (cancelled) return
        const message =
          error instanceof ApiError || error instanceof Error
            ? error.message
            : 'Unable to load suppliers.'
        setSuppliersError(message)
        setSuppliers([])
      } finally {
        if (!cancelled) {
          setLoadingSuppliers(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      cancelled = true
    }
  }, [])

  const roleQuery = request.role?.trim().toLowerCase() || ''

  const recommendedSuppliers = suppliers.filter((supplier) => {
    if (!roleQuery) return false
    const searchable = [
      supplier.name,
      supplier.category,
      supplier.supplier_type,
    ]
      .join(' ')
      .toLowerCase()

    return searchable.includes(roleQuery)
  })

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(search.toLowerCase()) &&
      !selected.includes(supplierKey(supplier))
  )

  const toggleSupplier = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    )
    setSearch('')
  }

  const removeSupplier = (id: string) => {
    setSelected(prev => prev.filter(s => s !== id))
  }

  const handleContinue = () => {
    update({ suppliers: selected })
    router.push('/requests/new/job/create/review')
  }

  return (
    <div className="max-w-5xl mx-auto p-10 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <p className="text-sm text-gray-600 mt-1">
          Nova has identified suppliers that best match your request.
        </p>
      </div>

      {/* Recommended */}
      <div className="border rounded-xl p-6 bg-white space-y-3 shadow-sm">
        <div className="font-medium">Recommended by Nova</div>

        {recommendedSuppliers.length === 0 && (
          <div className="text-sm text-gray-500">
            No strong matches found.
          </div>
        )}

        <ul className="text-sm list-disc pl-5">
          {recommendedSuppliers.map(s => (
            <li key={supplierKey(s)}>{s.name}</li>
          ))}
        </ul>
      </div>

      {/* Supplier selector */}
      <div
        ref={dropdownRef}
        className="border rounded-xl p-6 bg-white space-y-3 relative shadow-sm"
      >
        <label className="block font-medium text-sm">
          Select suppliers
        </label>

        <input
          type="text"
          placeholder="Search suppliers"
          value={search}
          onFocus={() => {
            if (!loadingSuppliers && !suppliersError) {
              setOpen(true)
            }
          }}
          onChange={e => setSearch(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
        />

        {loadingSuppliers && (
          <div className="text-sm text-gray-500">Loading suppliers...</div>
        )}

        {!loadingSuppliers && suppliersError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {suppliersError}
          </div>
        )}

        {open && !loadingSuppliers && !suppliersError && (
          <div className="absolute left-6 right-6 top-[92px] z-20 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredSuppliers.map(s => (
              <button
                key={supplierKey(s)}
                type="button"
                onClick={() => toggleSupplier(supplierKey(s))}
                className="w-full text-left px-3 py-2 text-sm hover:bg-cyan-50"
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">
                  Type: {s.supplier_type || 'N/A'} - Category: {s.category || 'N/A'}
                </div>
              </button>
            ))}

            {filteredSuppliers.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">
                No suppliers found
              </div>
            )}
          </div>
        )}

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {selected.map(id => {
              const supplier = suppliers.find(s => supplierKey(s) === id)

              return (
                <div
                  key={id}
                  className="flex items-center gap-2 bg-cyan-50 text-sm px-3 py-1.5 rounded-full"
                >
                  <span>{supplier?.name || id}</span>
                  <button
                    onClick={() => removeSupplier(id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() =>
            router.push('/requests/new/job/create/financials')
          }
          className="
          px-4 py-2 text-sm rounded-full
          border border-gray-300
          text-gray-700
          hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-700
          focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400
          active:border-cyan-400
        "

        >
          Back
        </button>

        <button
          disabled={selected.length === 0}
          onClick={handleContinue}
          className={`px-6 py-2.5 rounded-full text-sm font-medium text-white 
           ${
              selected.length === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-black hover:bg-gray-900'
            }
          `}>
          Submit
        </button>
      </div>
    </div>
  )
}
