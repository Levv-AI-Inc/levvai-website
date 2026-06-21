'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { Pencil, Plus, X } from 'lucide-react'
import {
  deleteComplianceWorkflow,
  getComplianceWorkflows,
  type Workflow,
  type WorkflowType,
} from '@/lib/api/complianceWorkflows'

const TABS = ['Onboarding', 'Offboarding', 'Requirements List'] as const

type Tab = (typeof TABS)[number]
type RequirementStatus = 'Active' | 'Inactive'

type RequirementRow = {
  id: string
  requirement: string
  category: string
  appliesTo: string
  status: RequirementStatus
}

const REQUIREMENTS: RequirementRow[] = [
  {
    id: 'requirement-background-check',
    requirement: 'Background Check',
    category: 'Compliance',
    appliesTo: 'US IT Worker',
    status: 'Active',
  },
  {
    id: 'requirement-equipment-return',
    requirement: 'Equipment Return',
    category: 'Offboarding',
    appliesTo: 'All workers',
    status: 'Active',
  },
]

function statusPillClass(status: RequirementStatus) {
  return status === 'Active'
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-200 text-gray-700'
}

function workflowTypeFromTab(
  tab: Exclude<Tab, 'Requirements List'>,
): WorkflowType {
  return tab === 'Offboarding' ? 'offboarding' : 'onboarding'
}

function formatStatus(status: Workflow['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export default function AdminWorkersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Onboarding')
  const [workflowRows, setWorkflowRows] = useState<Workflow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadWorkflows = useCallback(async () => {
    if (activeTab === 'Requirements List') {
      setWorkflowRows([])
      setError('')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const rows = await getComplianceWorkflows({
        workflow_type: workflowTypeFromTab(activeTab),
      })
      setWorkflowRows(rows)
    } catch (loadError) {
      setWorkflowRows([])
      setError(toErrorMessage(loadError, 'Failed to load workflows.'))
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

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
    <div className="space-y-7">
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 text-sm">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'pb-3 transition',
                activeTab === tab
                  ? 'border-b-2 border-black font-medium text-gray-950'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'Requirements List' ? (
        <RequirementsList />
      ) : (
        <WorkflowList
          tab={activeTab}
          rows={workflowRows}
          loading={isLoading}
          error={error}
          deletingId={deletingId}
          onDelete={handleDeleteWorkflow}
        />
      )}
    </div>
  )
}

function WorkflowList({
  tab,
  rows,
  loading,
  error,
  deletingId,
  onDelete,
}: {
  tab: Exclude<Tab, 'Requirements List'>
  rows: Workflow[]
  loading: boolean
  error: string
  deletingId: number | null
  onDelete: (workflowId: number, workflowName: string) => void
}) {
  const isOnboarding = tab === 'Onboarding'
  const workflowType = workflowTypeFromTab(tab)
  const basePath = `/admin/workers/${workflowType}`
  const colSpan = isOnboarding ? 4 : 3

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-950">
          {tab} Workflows
        </h1>

        <Link
          href={`${basePath}/new`}
          className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add {tab} Workflow
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
            {loading ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-slate-400"
                  colSpan={colSpan}
                >
                  Loading workflows...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-slate-400"
                  colSpan={colSpan}
                >
                  No {tab.toLowerCase()} workflows yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
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
                        onClick={() => onDelete(row.id, row.name)}
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

function RequirementsList() {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-950">
          Requirements List
        </h1>

        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add Requirement
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-gray-950">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">
                Requirement
              </th>
              <th className="px-4 py-3 text-left font-semibold">Category</th>
              <th className="px-4 py-3 text-left font-semibold">
                Applies To
              </th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {REQUIREMENTS.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-gray-950">
                  {row.requirement}
                </td>
                <td className="px-4 py-3 text-slate-500">{row.category}</td>
                <td className="px-4 py-3 text-slate-500">{row.appliesTo}</td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'inline-flex rounded-full px-3 py-1 text-xs font-medium',
                      statusPillClass(row.status),
                    )}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    aria-label={`Edit ${row.requirement}`}
                    className="text-slate-700 hover:text-slate-950"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
