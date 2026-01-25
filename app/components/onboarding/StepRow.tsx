'use client'

import { useState, useRef } from 'react'
import { PlugZap } from 'lucide-react'

type NovaState = {
  state: 'reminded' | 'escalated' | 'waiting'
  timeAgo?: string
}

type Step = {
  id: string
  label: string
  status: 'Complete' | 'In Progress' | 'Pending'
  owner: 'Worker' | 'Internal' | 'Supplier'
  blocker?: string
  novaState?: NovaState

  // ✅ Integration-specific
  integrationStatus?: 'Failed' | 'Synced'
}

export default function StepRow({
  step,
  sequence,
  showIntegrationAction,
}: {
  step: Step
  sequence?: number
  showIntegrationAction?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [integrationMenuOpen, setIntegrationMenuOpen] = useState(false)

  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  )
  const [integrationMenuPos, setIntegrationMenuPos] = useState<{
    top: number
    left: number
  } | null>(null)

  const actionButtonRef = useRef<HTMLButtonElement | null>(null)
  const integrationButtonRef = useRef<HTMLButtonElement | null>(null)

  const openActionMenu = () => {
    if (!actionButtonRef.current) return
    const rect = actionButtonRef.current.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.right - 160,
    })
    setMenuOpen(true)
  }

  const openIntegrationMenu = () => {
    if (!integrationButtonRef.current) return
    const rect = integrationButtonRef.current.getBoundingClientRect()
    setIntegrationMenuPos({
      top: rect.bottom + 6,
      left: rect.right - 200,
    })
    setIntegrationMenuOpen(true)
  }

  return (
    <>
      <div className="relative rounded-md border border-gray-200 bg-white px-4 py-3">
        {/* SEQUENCE BADGE */}
        {typeof sequence === 'number' && (
          <div className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
            {sequence}
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          {/* LEFT CONTENT */}
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {step.label}
            </div>

            <div className="mt-1 text-xs text-gray-600">
              Owner: {step.owner}
            </div>

            {/* ✅ INTEGRATION STATUS (FIXED) */}
            {step.integrationStatus && (
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                <span>Integrations:</span>
                <span
                  className={[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
                    step.integrationStatus === 'Failed'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-green-50 text-green-700 border-green-200',
                  ].join(' ')}
                >
                  {step.integrationStatus}
                </span>
              </div>
            )}

            {step.blocker && (
              <div className="mt-1 text-xs text-red-600">
                Blocker: {step.blocker}
              </div>
            )}
          </div>

          {/* RIGHT TOP */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={[
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border',
                step.status === 'Complete' &&
                  'bg-green-50 text-green-700 border-green-200',
                step.status === 'In Progress' &&
                  'bg-blue-50 text-blue-700 border-blue-200',
                step.status === 'Pending' &&
                  'bg-gray-100 text-gray-700 border-gray-200',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {step.status}
            </span>

            <button
              ref={actionButtonRef}
              type="button"
              className="rounded-md px-2 py-1 hover:bg-gray-100 text-xs text-gray-600"
              onClick={openActionMenu}
            >
              ⋯
            </button>
          </div>
        </div>

        {/* ✅ BOTTOM-RIGHT INTEGRATION ICON */}
        {showIntegrationAction && (
          <div className="absolute bottom-2 right-2">
            <button
              ref={integrationButtonRef}
              type="button"
              onClick={openIntegrationMenu}
              className="rounded-md p-1.5 hover:bg-gray-100 text-gray-600"
              title="Integration actions"
            >
              <PlugZap className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ACTION MENU (⋯) */}
      {menuOpen && menuPos && (
        <div
          className="fixed z-50 w-44 rounded-md border bg-white shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button
            className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
            onClick={() => setMenuOpen(false)}
          >
            Send reminder again
          </button>

          <button
            className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
            onClick={() => setMenuOpen(false)}
          >
            Escalate manually
          </button>

          <button
            className="block w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
            onClick={() => setMenuOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ✅ INTEGRATION MENU (NEW, SAME PATTERN) */}
      {integrationMenuOpen && integrationMenuPos && (
        <div
          className="fixed z-50 w-52 rounded-md border bg-white shadow-lg"
          style={{
            top: integrationMenuPos.top,
            left: integrationMenuPos.left,
          }}
        >
          <button
            className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
            onClick={() => {
              console.log('Manual sync triggered for', step.id)
              setIntegrationMenuOpen(false)
            }}
          >
            Manually trigger sync
          </button>

          <button
            className="block w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
            onClick={() => setIntegrationMenuOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </>
  )
}
