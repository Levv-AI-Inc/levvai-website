'use client'

import type { FormEvent } from 'react'
import { Loader2, X } from 'lucide-react'

type SupplierInviteModalProps = {
  open: boolean
  supplierName: string
  inviteEmail: string
  inviteDays: string
  inviteError: string
  sendingInvite: boolean
  onInviteEmailChange: (value: string) => void
  onInviteDaysChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export default function SupplierInviteModal({
  open,
  supplierName,
  inviteEmail,
  inviteDays,
  inviteError,
  sendingInvite,
  onInviteEmailChange,
  onInviteDaysChange,
  onClose,
  onSubmit,
}: SupplierInviteModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Resend supplier invite</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-5 py-5">
          <p className="text-sm text-slate-600">
            Generate a new registration link for{' '}
            <span className="font-medium text-slate-900">{supplierName}</span>.
          </p>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Invite email<span className="ml-1 text-rose-500">*</span>
            </span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => onInviteEmailChange(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Expires in days<span className="ml-1 text-rose-500">*</span>
            </span>
            <input
              type="number"
              value={inviteDays}
              onChange={(event) => onInviteDaysChange(event.target.value)}
              required
              min="1"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </label>

          {inviteError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {inviteError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendingInvite}
              className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sendingInvite && <Loader2 className="h-4 w-4 animate-spin" />}
              Resend invite
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
