'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MailPlus, MapPin, MoreVertical, Pencil, Trash2 } from 'lucide-react'

import { levvUi } from '@/components/ui/levv-app'

const ITEM_BASE =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] outline-none focus-visible:bg-slate-100 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0'
const ITEM = `${ITEM_BASE} text-slate-800 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-400 [&_svg]:text-slate-500 disabled:[&_svg]:text-slate-300`

type SupplierRowActionsProps = {
  canManage: boolean
  canManageContactAccess: boolean
  canManageCoverage: boolean
  onEdit: () => void
  onInvite: () => void
  onCoverage: () => void
  onDelete: () => void
}

export default function SupplierRowActions({
  canManage,
  canManageContactAccess,
  canManageCoverage,
  onEdit,
  onInvite,
  onCoverage,
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
        className={levvUi.iconButton}
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
        className={`${levvUi.iconButton} ${open ? 'bg-slate-100 text-slate-950' : ''}`}
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
            className="fixed z-[120] w-44 overflow-hidden border border-[var(--line)] bg-[var(--surface)] py-1"
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
              className={ITEM}
            >
              <Pencil className="h-4 w-4" />
              Edit supplier
            </button>
            <button
              type="button"
              disabled={!canManageContactAccess}
              onClick={() => {
                if (!canManageContactAccess) return
                setOpen(false)
                onInvite()
              }}
              className={ITEM}
            >
              <MailPlus className="h-4 w-4" />
              Contact access
            </button>
            <button
              type="button"
              disabled={!canManageCoverage}
              onClick={() => {
                if (!canManageCoverage) return
                setOpen(false)
                onCoverage()
              }}
              className={ITEM}
            >
              <MapPin className="h-4 w-4" />
              Coverage
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
              className={`${ITEM_BASE} mt-1 border-t border-[var(--line)] text-rose-700 hover:bg-rose-50 hover:text-rose-800`}
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
