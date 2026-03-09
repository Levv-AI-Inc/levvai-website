'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MailPlus, MoreVertical, Pencil, Trash2 } from 'lucide-react'

type SupplierRowActionsProps = {
  canManage: boolean
  onEdit: () => void
  onInvite: () => void
  onDelete: () => void
}

export default function SupplierRowActions({
  canManage,
  onEdit,
  onInvite,
  onDelete,
}: SupplierRowActionsProps) {
  const [open, setOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const menuWidth = 176
      const viewportPadding = 8
      const left = Math.max(
        viewportPadding,
        Math.min(
          rect.right - menuWidth,
          window.innerWidth - menuWidth - viewportPadding,
        ),
      )
      const top = rect.bottom + 8

      setMenuPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  if (!canManage) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300"
        aria-label="Actions unavailable"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        aria-label="Open supplier actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        isMounted &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[120] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onEdit()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit supplier
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onInvite()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <MailPlus className="h-4 w-4" />
              Resend invite
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete supplier
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
