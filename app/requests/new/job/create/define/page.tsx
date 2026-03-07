'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCWRequest } from '../../context/CWRequestContext'
import { createPortal } from 'react-dom'
import {
  getJobTemplates,
  uploadJobTemplatesJson,
  type JobTemplate,
} from '@/lib/jobTemplates'

type NewTemplateInput = {
  role: string
  description: string
  country: string
  region: string
}

const EMPTY_NEW_TEMPLATE: NewTemplateInput = {
  role: '',
  description: '',
  country: '',
  region: '',
}

export default function CWDefinePage() {
  const router = useRouter()
  const { request, update } = useCWRequest()

  const [templates, setTemplates] = useState<JobTemplate[]>([])
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)
  const [showCreateTemplateModal, setShowCreateTemplateModal] =
    useState(false)
  const [search, setSearch] = useState('')
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState('')
  const [newTemplate, setNewTemplate] = useState<NewTemplateInput>(
    EMPTY_NEW_TEMPLATE,
  )
  const [templateError, setTemplateError] = useState('')
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const templateRequestIdRef = useRef(0)

  const applyTemplate = (template: JobTemplate) => {
    update({
      role: template.role,
      description: template.description,
      country: template.country,
      region:
        template.region ||
        template.region_in_country ||
        '',
    })
    closeTemplatePanel()
    setSearch('')
  }

  const handleContinue = () => {
    router.push('/requests/new/job/create/financials')
  }

  const closeTemplatePanel = () => {
    setShowTemplatePanel(false)
    setShowCreateTemplateModal(false)
  }

  const updateNewTemplateField = (
    key: keyof NewTemplateInput,
    value: string,
  ) => {
    setNewTemplate((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const resetTemplateForm = () => {
    setNewTemplate(EMPTY_NEW_TEMPLATE)
    setTemplateError('')
  }

  const loadTemplates = async (searchTerm = '') => {
    const requestId = ++templateRequestIdRef.current
    setTemplatesLoading(true)
    setTemplatesError('')

    try {
      const rows = await getJobTemplates({
        search: searchTerm || undefined,
      })

      if (requestId !== templateRequestIdRef.current) return
      setTemplates(rows)
    } catch (error) {
      if (requestId !== templateRequestIdRef.current) return
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load templates.'
      setTemplatesError(message)
      setTemplates([])
    } finally {
      if (requestId === templateRequestIdRef.current) {
        setTemplatesLoading(false)
      }
    }
  }

  const handleCreateTemplate = async () => {
    const role = newTemplate.role.trim()
    const description = newTemplate.description.trim()
    const country = newTemplate.country.trim()
    const region = newTemplate.region.trim()

    if (!role || !country || !region) {
      setTemplateError(
        'Role, country, and region are required.',
      )
      return
    }

    setCreatingTemplate(true)
    setTemplateError('')

    try {
      const response = await uploadJobTemplatesJson([
        {
          role,
          description,
          country,
          region,
        },
      ])

      if (response.failed > 0) {
        const firstError = response.errors?.[0]
        setTemplateError(
          firstError
            ? `Upload failed on row ${firstError.row}.`
            : 'Template could not be saved.',
        )
        return
      }

      setShowCreateTemplateModal(false)
      resetTemplateForm()
      setSearch('')
      await loadTemplates('')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Template could not be saved.'
      setTemplateError(message)
    } finally {
      setCreatingTemplate(false)
    }
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!showTemplatePanel) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showTemplatePanel])

  useEffect(() => {
    if (!showTemplatePanel) return
    const timer = window.setTimeout(() => {
      void loadTemplates(search)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [showTemplatePanel, search])

  const templatePanel =
    isMounted && showTemplatePanel
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex h-dvh items-stretch">
            <div
              className="flex-1 bg-black/30"
              onClick={closeTemplatePanel}
            />

            <div className="h-dvh w-[420px] overflow-y-auto bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="font-medium">Select job template</div>
                <button
                  onClick={closeTemplatePanel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <input
                className="mt-4 w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                placeholder="Search templates or describe your need…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTemplateModal(true)
                    setTemplateError('')
                  }}
                  className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-cyan-300 hover:bg-cyan-50"
                >
                  + Create template
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {templatesLoading && (
                  <div className="rounded-xl border border-gray-200 p-3 text-sm text-gray-500">
                    Loading templates...
                  </div>
                )}

                {!templatesLoading &&
                  !templatesError &&
                  templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="w-full rounded-xl border border-gray-200 p-3 text-left hover:border-cyan-300 hover:bg-cyan-50"
                    >
                      <div className="font-medium text-sm">{t.role}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {t.country} ·{' '}
                        {t.region || t.region_in_country || 'N/A'}
                      </div>
                    </button>
                  ))}

                {!templatesLoading && templatesError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {templatesError}
                  </div>
                )}

                {!templatesLoading &&
                  !templatesError &&
                  templates.length === 0 && (
                  <div className="text-sm text-gray-400">No templates found</div>
                )}
              </div>
            </div>

            {showCreateTemplateModal && (
              <div
                className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4"
                onClick={() => {
                  setShowCreateTemplateModal(false)
                  resetTemplateForm()
                }}
              >
                <div
                  className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">
                      Create job posting template
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateTemplateModal(false)
                        resetTemplateForm()
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <input
                        value={newTemplate.role}
                        onChange={(e) =>
                          updateNewTemplateField('role', e.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                        placeholder="e.g. Data Engineer III"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Country
                      </label>
                      <input
                        value={newTemplate.country}
                        onChange={(e) =>
                          updateNewTemplateField('country', e.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                        placeholder="US"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Region / Worksite
                      </label>
                      <input
                        value={newTemplate.region}
                        onChange={(e) =>
                          updateNewTemplateField('region', e.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                        placeholder="New York"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        rows={4}
                        value={newTemplate.description}
                        onChange={(e) =>
                          updateNewTemplateField(
                            'description',
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                        placeholder="Describe the responsibilities for this template"
                      />
                    </div>
                  </div>

                  {templateError && (
                    <p className="mt-3 text-sm text-rose-600">
                      {templateError}
                    </p>
                  )}

                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateTemplateModal(false)
                        resetTemplateForm()
                      }}
                      className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateTemplate}
                      disabled={creatingTemplate}
                      className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
                    >
                      {creatingTemplate ? 'Saving...' : 'Save template'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )
      : null


  /* -----------------------------
     Persist duration into context
  -------------------------------- */

  return (
    <>
      <div className="max-w-5xl mx-auto px-8 py-10 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Job setup</h1>
        <p className="text-sm text-gray-600 mt-1">
          Define the role and engagement details.
        </p>
      </div>

      {/* JP Template */}
      <div className="border rounded-xl p-6 space-y-3 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Job posting template</div>
          <button
            onClick={() => setShowTemplatePanel(true)}
            className="text-sm border border-gray-300 px-4 py-1.5 rounded-full hover:border-cyan-300 hover:bg-cyan-50">
            Choose template
          </button>
        </div>

        {request.role && (
          <div className="text-sm text-gray-600">
            Template applied: <strong>{request.role}</strong>
          </div>
        )}
      </div>

      {/* Core fields */}
      <div className="border rounded-xl p-6 bg-white space-y-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium">Role</label>
          <input
            className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
            value={request.role || ''}
            onChange={e => update({ role: e.target.value })}
            placeholder="e.g. Data Analyst II"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
            rows={4}
            value={request.description || ''}
            onChange={e => update({ description: e.target.value })}
            placeholder="Describe the work to be performed"
          />
        </div>

        {/* Dates + Business days */}
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium">Start date</label>
            <input
              type="date"
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.startDate || ''}
              onChange={e => update({ startDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">End date</label>
            <input
              type="date"
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.endDate || ''}
              onChange={e => update({ endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium">Positions</label>
            <input
              type="number"
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.positions || ''}
              onChange={e =>
                update({ positions: Number(e.target.value) })
              }
              placeholder="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Country</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.country || ''}
              onChange={e => update({ country: e.target.value })}
              placeholder="US"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              Region / Worksite
            </label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              value={request.region || ''}
              onChange={e => update({ region: e.target.value })}
              placeholder="New York"
            />
          </div>
        </div>
      </div>

      {/* Continue */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          className="px-6 py-2.5 rounded-full bg-black text-white text-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-400">
          Continue
        </button>
      </div>
      </div>
      {templatePanel}
    </>
  )
}
