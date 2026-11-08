'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import {
  LevvNotice,
  LevvRecordHeader,
  LevvStatusBadge,
  levvUi,
  type LevvTone,
} from '@/components/ui/levv-app'
import {
  deleteComplianceWorkflow,
  getComplianceWorkflows,
  type Workflow,
  type WorkflowType,
} from '@/lib/api/complianceWorkflows'
import WorkersTabs from './WorkersTabs'

type WorkflowTypeLabel = 'Onboarding' | 'Offboarding'

const WORKFLOW_TYPE_BY_LABEL: Record<WorkflowTypeLabel, WorkflowType> = {
  Onboarding: 'onboarding',
  Offboarding: 'offboarding',
}

const STATUS_TONE: Record<Workflow['status'], LevvTone> = {
  published: 'blue',
  draft: 'slate',
  archived: 'slate',
}

function formatStatus(status: Workflow['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function WorkflowListPage({
  workflowType,
}: {
  workflowType: WorkflowTypeLabel
}) {
  const [workflowRows, setWorkflowRows] = useState<Workflow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  // The header speaks only once the first load has settled, so it never claims "none" before it knows.
  const [hasLoaded, setHasLoaded] = useState(false)

  const apiWorkflowType = WORKFLOW_TYPE_BY_LABEL[workflowType]
  const isOnboarding = workflowType === 'Onboarding'
  const basePath = `/admin/workers/${apiWorkflowType}`
  const colSpan = isOnboarding ? 4 : 3

  const loadWorkflows = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const rows = await getComplianceWorkflows({
        workflow_type: apiWorkflowType,
      })
      setWorkflowRows(rows)
    } catch (loadError) {
      setWorkflowRows([])
      setError(toErrorMessage(loadError, 'Failed to load workflows.'))
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
    }
  }, [apiWorkflowType])

  useEffect(() => {
    void loadWorkflows()
  }, [loadWorkflows])

  async function handleDeleteWorkflow(workflowId: number, workflowName: string) {
    const shouldDelete = window.confirm(
      `Delete ${workflowName || 'this workflow'}?`,
    )
    if (!shouldDelete) return

    setDeletingId(workflowId)
    setError('')

    try {
      await deleteComplianceWorkflow(workflowId)
      setWorkflowRows((current) =>
        current.filter((workflow) => workflow.id !== workflowId),
      )
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, 'Failed to delete workflow.'))
    } finally {
      setDeletingId(null)
    }
  }

  const published = workflowRows.filter((row) => row.status === 'published').length
  const drafts = workflowRows.filter((row) => row.status === 'draft').length
  const archived = workflowRows.filter((row) => row.status === 'archived').length
  const active = workflowRows.filter((row) => row.is_active).length
  const kind = workflowType.toLowerCase()
  const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`
  const statusParts = [
    `${published} published`,
    `${drafts} ${drafts === 1 ? 'draft' : 'drafts'}`,
    ...(archived > 0 ? [`${archived} archived`] : []),
  ]
  const pending = isLoading || !hasLoaded
  const statement = pending
    ? `Loading ${kind} workflows…`
    : error && workflowRows.length === 0
      ? `${workflowType} workflows could not be loaded, so their status cannot be shown.`
      : workflowRows.length === 0
        ? `No ${kind} workflows yet.`
        : `${plural(workflowRows.length, `${kind} workflow`)}: ${statusParts.join(', ')}${
            isOnboarding ? `; ${active} active` : ''
          }.`
  const figure = (value: number) => (pending || (error && workflowRows.length === 0) ? '—' : value)

  return (
    <div className="space-y-6">
      <LevvRecordHeader
        trail="Admin settings / Workers"
        title={`${workflowType} Workflows`}
        statement={statement}
        figures={[
          { label: 'Published', value: figure(published) },
          { label: 'Draft', value: figure(drafts) },
          ...(isOnboarding ? [{ label: 'Active', value: figure(active) }] : []),
        ]}
        actions={
          <Link href={`${basePath}/new`} className={levvUi.primaryButton}>
            <Plus />
            Add {workflowType} Workflow
          </Link>
        }
      />

      <WorkersTabs />

      {error && (
        <LevvNotice tone="rose">{error}</LevvNotice>
      )}

      <div className="relative overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className={levvUi.th}>Policy</th>
              <th className={`${levvUi.th} hidden w-40 sm:table-cell`}>Status</th>
              {isOnboarding && (
                <th className={`${levvUi.th} hidden w-32 sm:table-cell`}>Active</th>
              )}
              <th className={`${levvUi.th} w-[124px] text-right`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr className="[&>td]:border-b [&>td]:border-[var(--line)]">
                <td
                  className={`${levvUi.td} py-8 text-center text-slate-500`}
                  colSpan={colSpan}
                >
                  Loading workflows...
                </td>
              </tr>
            ) : workflowRows.length === 0 ? (
              <tr className="[&>td]:border-b [&>td]:border-[var(--line)]">
                <td
                  className={`${levvUi.td} py-8 text-center text-slate-500`}
                  colSpan={colSpan}
                >
                  No {workflowType.toLowerCase()} workflows yet.
                </td>
              </tr>
            ) : (
              workflowRows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-[var(--surface)] [&>td]:border-b [&>td]:border-[var(--line)]"
                >
                  <td className={`${levvUi.td} font-medium text-slate-950`}>
                    {row.name}
                    {/* On a phone the status columns fold under the name. */}
                    <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-normal sm:hidden">
                      <LevvStatusBadge tone={STATUS_TONE[row.status]}>
                        {formatStatus(row.status)}
                      </LevvStatusBadge>
                      {isOnboarding && row.is_active ? (
                        <LevvStatusBadge tone="emerald">Active</LevvStatusBadge>
                      ) : null}
                    </span>
                  </td>
                  <td className={`${levvUi.td} hidden sm:table-cell`}>
                    <LevvStatusBadge tone={STATUS_TONE[row.status]}>
                      {formatStatus(row.status)}
                    </LevvStatusBadge>
                  </td>
                  {isOnboarding && (
                    <td className={`${levvUi.td} hidden sm:table-cell`}>
                      {row.is_active ? (
                        <LevvStatusBadge tone="emerald">Active</LevvStatusBadge>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  )}
                  <td className={`${levvUi.td} text-right`}>
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`${basePath}/${row.id}`}
                        aria-label={`Edit ${row.name}`}
                        className={levvUi.secondaryButton}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${row.name}`}
                        onClick={() => handleDeleteWorkflow(row.id, row.name)}
                        className={levvUi.dangerIconButton}
                        disabled={deletingId === row.id}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
