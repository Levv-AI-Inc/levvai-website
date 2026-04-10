'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import {
  ApprovalChainsApiError,
  getApprovalChainApprovers,
  type ApprovalChainApprover,
} from '@/lib/api/approvalChains'

type ApproverAutocompleteProps = {
  value: number | null
  label: string
  onSelect: (approver: ApprovalChainApprover) => void
  onClear: () => void
  disabled?: boolean
}

export default function ApproverAutocomplete({
  value,
  label,
  onSelect,
  onClear,
  disabled = false,
}: ApproverAutocompleteProps) {
  const router = useRouter()
  const [query, setQuery] = useState(label)
  const [results, setResults] = useState<ApprovalChainApprover[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setQuery(label)
    }
  }, [label, open])

  useEffect(() => {
    if (!open || disabled) return

    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setLoading(false)
      setError('')
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')

      try {
        const rows = await getApprovalChainApprovers({
          search: trimmed,
        })
        if (cancelled) return
        setResults(rows)
      } catch (requestError) {
        if (
          requestError instanceof ApprovalChainsApiError &&
          requestError.status === 401
        ) {
          router.replace(
            `/auth/login?next=${encodeURIComponent(
              window.location.pathname,
            )}`,
          )
          return
        }

        if (cancelled) return
        setResults([])
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load approvers.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [disabled, open, query, router])

  return (
    <div className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false)
            }, 150)
          }}
          placeholder="Search approver by name or email"
          className="w-full rounded-md border px-3 py-2 pr-10 text-sm"
          disabled={disabled}
        />

        {value !== null && !disabled && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
              setError('')
              onClear()
            }}
            className="absolute inset-y-0 right-2 inline-flex items-center text-gray-400 hover:text-gray-700"
            aria-label="Clear approver"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-md border bg-white shadow-lg">
          {!query.trim() && (
            <div className="px-3 py-2 text-sm text-gray-500">
              Type to search approvers.
            </div>
          )}

          {loading && (
            <div className="px-3 py-2 text-sm text-gray-500">
              Searching approvers...
            </div>
          )}

          {!loading && error && (
            <div className="px-3 py-2 text-sm text-rose-600">{error}</div>
          )}

          {!loading && !error && query.trim() && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              No approvers found.
            </div>
          )}

          {!loading &&
            !error &&
            results.map((approver) => (
              <button
                key={approver.user_id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(approver)
                  setQuery(approver.name)
                  setOpen(false)
                }}
                className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-gray-50"
              >
                <div className="text-sm font-medium text-gray-900">
                  {approver.name}
                </div>
                <div className="text-xs text-gray-500">
                  {approver.email || 'No email'}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {[approver.role, approver.business_unit, approver.cost_center]
                    .filter(Boolean)
                    .join(' • ') || 'No assignment metadata'}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
