'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useCWRequest } from '../../context/CWRequestContext'
import {
  ApiError,
  getSuppliers,
  type SupplierRecord,
} from '@/lib/api/suppliers'
import {
  IntakeApiError,
  createIntakeDraft,
  patchIntake,
  submitIntake,
} from '@/lib/api/intake'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  LevvPanel,
  LevvRequestHeader,
  levvUi,
} from '@/components/ui/levv-app'

function supplierKey(supplier: SupplierRecord) {
  return String(supplier.id ?? supplier.supplier_id)
}

function normalizeMatchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function matchesSupplier(supplier: SupplierRecord, value: string) {
  const query = normalizeMatchValue(value)
  if (!query) return false

  return [supplier.name, supplier.supplier_code, supplier.supplier_id]
    .filter(Boolean)
    .some((candidate) => normalizeMatchValue(String(candidate)) === query)
}

export default function CWSuppliersPage() {
  const router = useRouter()
  const { request, update } = useCWRequest()

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [suppliersError, setSuppliersError] = useState('')

  const [selectedSupplierId, setSelectedSupplierId] = useState(
    request.supplierId !== undefined &&
      request.supplierId !== null
      ? String(request.supplierId)
      : request.suppliers?.[0] || '',
  )
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

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

    const loadSuppliers = async (searchTerm: string) => {
      setLoadingSuppliers(true)
      setSuppliersError('')

      try {
        const rows = await getSuppliers({
          status: 'active',
          search: searchTerm || undefined,
        })
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

    const timer = window.setTimeout(() => {
      void loadSuppliers(search.trim())
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search])

  useEffect(() => {
    if (loadingSuppliers || suppliers.length === 0) return
    if (selectedSupplierId && Number.isFinite(Number(selectedSupplierId))) return

    const candidateSuppliers = [
      selectedSupplierId,
      ...(request.suppliers || []),
    ].filter(Boolean)

    const preferredSupplier = candidateSuppliers.find((supplier) =>
      suppliers.some((row) => matchesSupplier(row, supplier)),
    )
    if (!preferredSupplier) return

    const matchedSupplier = suppliers.find((supplier) =>
      matchesSupplier(supplier, preferredSupplier),
    )
    if (matchedSupplier) {
      setSelectedSupplierId(supplierKey(matchedSupplier))
    }
  }, [
    loadingSuppliers,
    request.suppliers,
    selectedSupplierId,
    suppliers,
  ])

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

  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!search.trim()) return true
    return supplier.name
      .toLowerCase()
      .includes(search.toLowerCase())
  })

  const chooseSupplier = (id: string) => {
    setSelectedSupplierId(id)
    setSearch('')
    setOpen(false)
  }

  const clearSupplier = () => {
    setSelectedSupplierId('')
  }

  const handleContinue = async () => {
    if (!selectedSupplierId) return
    setSubmitError('')
    setSubmitting(true)

    const supplierId = Number(selectedSupplierId)
    if (!Number.isFinite(supplierId)) {
      setSubmitting(false)
      setSubmitError('Selected supplier is invalid.')
      return
    }

    try {
      let intakeId = request.intakeId

      if (!intakeId) {
        const created = await createIntakeDraft({
          engagementType: 'staffing',
          title: request.role?.trim() || undefined,
          description: request.description?.trim() || undefined,
          startDate: request.startDate || undefined,
          endDate: request.endDate || undefined,
          workerCount:
            typeof request.positions === 'number' &&
            request.positions > 0
              ? request.positions
              : undefined,
          costCenter: request.costCenterId,
          site: request.siteId,
          supplier: supplierId,
          roleDefinition: request.roleId,
          legalEntity: request.legalEntityId,
          targetRate:
            typeof request.targetRate === 'number'
              ? request.targetRate.toFixed(2)
              : undefined,
          rateUnit: request.rateUnit || 'hourly',
          budgetAmount:
            typeof request.budgetAmount === 'number'
              ? request.budgetAmount.toFixed(2)
              : undefined,
          currency: request.currency || 'USD',
          country: request.country || undefined,
          stateProvince:
            request.stateProvince || request.region || undefined,
          city: request.city || undefined,
          rateCard: request.selectedRateCardId,
          overtimeEnabled: request.overtimeEnabled,
          overtimeMultiplier:
            typeof request.overtimeFactor === 'number'
              ? request.overtimeFactor.toFixed(2)
              : undefined,
          customFields: request.customFields || {},
          qualificationsEnabled: request.qualificationsEnabled,
          qualifications: request.qualifications,
        })
        intakeId = created.id
        update({ intakeId: created.id })
      } else {
        await patchIntake(intakeId, { supplier: supplierId })
      }

      const submitted = await submitIntake(intakeId)

      update({
        intakeId: submitted.id,
        supplierId,
        suppliers: [selectedSupplierId],
      })
      router.push(
        `/requests/new/job/submitted?id=${encodeURIComponent(
          String(submitted.id),
        )}`,
      )
    } catch (error) {
      if (
        error instanceof IntakeApiError &&
        error.status === 401
      ) {
        router.replace('/auth/login?next=/requests/new/job/create/suppliers')
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to submit intake.'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="levv-request-page pb-6 font-sans text-[#101b3c]">
      <div className="w-full space-y-5">
        <LevvRequestHeader
          currentStep={5}
          title="Suppliers"
          description="Choose the supplier that should receive this request."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#52637a]">
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">
                {request.role || 'Job request'}
              </span>
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">
                {suppliers.length} available
              </span>
            </div>
          }
        />

        {submitError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.5fr)]">
          <LevvPanel className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#2563eb]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-[#101b3c]">Recommended</h2>
                <p className="text-xs text-[#64748b]">Matches based on this request.</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {recommendedSuppliers.map((supplier) => {
                const id = supplierKey(supplier)
                const selected = selectedSupplierId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => chooseSupplier(id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-[#93b4f8] bg-[#eef5ff]'
                        : 'border-[#dbe3ee] bg-[#f8fafc] hover:border-[#b8c8df]'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold text-[#17213c]">{supplier.name}</span>
                      <span className="mt-0.5 block text-xs text-[#64748b]">{supplier.category || supplier.supplier_type || 'Supplier'}</span>
                    </span>
                    {selected ? <CheckCircle2 className="h-5 w-5 text-[#2563eb]" /> : null}
                  </button>
                )
              })}

              {!loadingSuppliers && recommendedSuppliers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-sm text-[#64748b]">
                  No strong automatic match. Search the supplier directory instead.
                </div>
              ) : null}
            </div>
          </LevvPanel>

          <LevvPanel className="relative p-5" >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dcfce7] text-[#059669]">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-[#101b3c]">Supplier directory</h2>
                <p className="text-xs text-[#64748b]">Search and select one supplier.</p>
              </div>
            </div>

            <div ref={dropdownRef} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Search suppliers by name"
                value={search}
                onFocus={() => {
                  if (!loadingSuppliers && !suppliersError) setOpen(true)
                }}
                onChange={(event) => setSearch(event.target.value)}
                className={`${levvUi.input} pl-9`}
              />

              {open && !loadingSuppliers && !suppliersError ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-xl border border-[#dbe3ee] bg-white p-1.5 shadow-xl">
                  {filteredSuppliers.map((supplier) => (
                    <button
                      key={supplierKey(supplier)}
                      type="button"
                      onClick={() => chooseSupplier(supplierKey(supplier))}
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-[#eef5ff]"
                    >
                      <div className="font-semibold text-[#17213c]">{supplier.name}</div>
                      <div className="mt-0.5 text-xs text-[#64748b]">
                        {[supplier.supplier_type, supplier.category].filter(Boolean).join(' · ') || 'Supplier'}
                      </div>
                    </button>
                  ))}
                  {filteredSuppliers.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-[#64748b]">No suppliers found.</div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {loadingSuppliers ? (
              <p className="mt-3 text-sm text-[#64748b]">Loading suppliers…</p>
            ) : null}
            {!loadingSuppliers && suppliersError ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {suppliersError}
              </div>
            ) : null}

            {selectedSupplierId ? (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Selected supplier</div>
                  <div className="mt-1 font-bold text-[#17213c]">
                    {suppliers.find((supplier) => supplierKey(supplier) === selectedSupplierId)?.name || selectedSupplierId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSupplier}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-[#52637a] hover:bg-white"
                >
                  Change
                </button>
              </div>
            ) : null}
          </LevvPanel>
        </div>

        <footer className="sticky bottom-3 z-20 flex items-center justify-between rounded-[15px] border border-[#dce5f1] bg-white/95 px-5 py-3 shadow-[0_16px_42px_-26px_rgba(15,23,42,0.45)] backdrop-blur">
          <button
            type="button"
            onClick={() => router.push('/requests/new/job/create/financials')}
            className={levvUi.secondaryButton}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            disabled={!selectedSupplierId || submitting}
            onClick={() => void handleContinue()}
            className={`${levvUi.primaryButton} min-w-[150px]`}
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </footer>
      </div>
    </div>
  )
}
