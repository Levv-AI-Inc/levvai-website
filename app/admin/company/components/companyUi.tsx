'use client'

import { useId, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'
import { levvUi } from '@/components/ui/levv-app'
import { useLevvDialog } from '@/components/ui/levv-dialog'

/** The company modals: a square sheet on the surface, one hairline border and one soft offset shadow. */
export const modalUi = {
  overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4',
  sheet:
    'w-full border border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_40px_-20px_rgb(10_19_48/0.35)] outline-none',
  header: 'flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-4',
  title: 'text-lg font-semibold text-slate-950',
  description: 'mt-1 text-[13px] text-slate-500',
  body: 'grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2',
  input: levvUi.input,
  textarea: levvUi.textarea,
  error: 'text-[13px] text-rose-700 md:col-span-2',
  footer: 'flex justify-end gap-2 border-t border-[var(--line)] px-6 py-4',
}

/**
 * The shell every company modal shares: a labelled dialog that takes focus when it opens (to `initialFocus`),
 * keeps Tab inside, closes on Escape through `onClose`, and hands focus back to whatever opened it.
 * Mount it only while the modal is open.
 */
export function CompanyModal({
  title,
  description,
  closeLabel,
  closeDisabled,
  onClose,
  initialFocus,
  className = '',
  headerClassName = '',
  children,
}: {
  title: ReactNode
  description: ReactNode
  closeLabel: string
  closeDisabled: boolean
  onClose: () => void
  initialFocus?: RefObject<HTMLElement>
  className?: string
  headerClassName?: string
  children: ReactNode
}) {
  const titleId = useId()
  const dialogRef = useLevvDialog<HTMLDivElement>(true, onClose, initialFocus)

  return (
    <div className={modalUi.overlay}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${modalUi.sheet} ${className}`}
      >
        <div className={`${modalUi.header} ${headerClassName}`}>
          <div>
            <h3 id={titleId} className={modalUi.title}>
              {title}
            </h3>
            <p className={modalUi.description}>{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={closeLabel}
            className={`${levvUi.iconButton} -mr-2`}
          >
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** A field caption in tracked capitals; the span carries the tracking the app layer strips from labels. */
export function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="mb-1.5 block">
      <span className={levvUi.label}>{children}</span>
      {required ? (
        <>
          {' '}
          <span className="text-rose-600">*</span>
        </>
      ) : null}
    </label>
  )
}
