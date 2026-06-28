'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, X } from 'lucide-react'
import {
  deleteComplianceWorkflow,
  getComplianceWorkflows,
  type Workflow,
  type WorkflowType,
} from '@/lib/api/complianceWorkflows'

type WorkflowTypeLabel = 'Onboarding' | 'Offboarding'

const WORKFLOW_TYPE_BY_LABEL: Record<WorkflowTypeLabel, WorkflowType> = {
  Onboarding: 'onboarding',
  Offboarding: 'offboarding',
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

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-950">
          {workflowType} Workflows
        </h1>

        <Link
          href={`${basePath}/new`}
          className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add {workflowType} Workflow
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-gray-950">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Policy</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              {isOnboarding && (
                <th className="px-4 py-3 text-left font-semibold">Active</th>
              )}
              <th className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-slate-400"
                  colSpan={colSpan}
                >
                  Loading workflows...
                </td>
              </tr>
            ) : workflowRows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-slate-400"
                  colSpan={colSpan}
                >
                  No {workflowType.toLowerCase()} workflows yet.
                </td>
              </tr>
            ) : (
              workflowRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-gray-950">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatStatus(row.status)}
                  </td>
                  {isOnboarding && (
                    <td className="px-4 py-3">
                      {row.is_active ? (
                        <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-4">
                      <Link
                        href={`${basePath}/${row.id}`}
                        aria-label={`Edit ${row.name}`}
                        className="text-slate-700 hover:text-slate-950"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${row.name}`}
                        onClick={() => handleDeleteWorkflow(row.id, row.name)}
                        className="text-slate-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={deletingId === row.id}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
