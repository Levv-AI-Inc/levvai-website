'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useCWRequest } from '../../../context/CWRequestContext'
import {
  createIntakeDraft,
  IntakeApiError,
  patchIntake,
} from '@/lib/api/intake'
import {
  QUALIFICATION_LIBRARY,
  createCustomQualification,
  createQualificationFromLibrary,
  type ProficiencyLevel,
  type Qualification,
  type QualificationGroup,
  type QualificationType,
  type ResponseMode,
} from '@/lib/qualifications'

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function SectionPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2 text-sm font-medium transition',
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  )
}

function SmallBadge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'green' | 'amber' | 'red' | 'blue'
}) {
  const tones = {
    default: 'border-slate-200 bg-slate-50 text-slate-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  )
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

function qualificationSummaryText(item: Qualification) {
  if (item.responseMode === 'years') {
    return `${item.minYears}+ years required`
  }
  if (item.responseMode === 'rating') {
    return `Minimum proficiency: ${item.proficiency}`
  }
  if (item.responseMode === 'yes_no') {
    return 'Must confirm yes'
  }
  return 'Free-text response required'
}

type CustomQualificationDraft = {
  name: string
  type: QualificationType
  group: QualificationGroup
  description: string
}

export default function QualificationsSetupPage() {
  const router = useRouter()
  const { request, update } = useCWRequest()

  const [qualifications, setQualifications] = useState<Qualification[]>(
    request.qualifications || [],
  )
  const [activeGroup, setActiveGroup] =
    useState<QualificationGroup>('must_have')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>(
    request.qualifications?.[0]?.id || '',
  )
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState<CustomQualificationDraft>({
    name: '',
    type: 'skill',
    group: 'must_have',
    description: '',
  })
  const [saveError, setSaveError] = useState('')
  const [savingStep, setSavingStep] = useState(false)

  useEffect(() => {
    if (request.qualificationsEnabled !== true) {
      update({ qualificationsEnabled: true })
    }
  }, [])

  const filteredLibrary = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return QUALIFICATION_LIBRARY

    return QUALIFICATION_LIBRARY.filter((item) => {
      const haystack = [item.name, item.type, ...(item.tags || [])]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [search])

  const currentList = useMemo(
    () => qualifications.filter((item) => item.group === activeGroup),
    [activeGroup, qualifications],
  )

  const selectedQualification = useMemo(() => {
    const currentSelection =
      qualifications.find((item) => item.id === selectedId) || null

    if (currentSelection?.group === activeGroup) {
      return currentSelection
    }

    return currentList[0] || null
  }, [activeGroup, currentList, qualifications, selectedId])

  useEffect(() => {
    if (selectedQualification && selectedQualification.id !== selectedId) {
      setSelectedId(selectedQualification.id)
      return
    }

    if (!selectedQualification && selectedId) {
      setSelectedId('')
    }
  }, [selectedId, selectedQualification])

  const mustHaveCount = qualifications.filter(
    (item) => item.group === 'must_have',
  ).length
  const niceToHaveCount = qualifications.filter(
    (item) => item.group === 'nice_to_have',
  ).length
  const knockoutCount = qualifications.filter((item) => item.knockout).length

  const persistQualifications = (next: Qualification[]) => {
    setQualifications(next)
    update({ qualifications: next })
  }

  const openCustomQualificationModal = (
    group: QualificationGroup = activeGroup,
  ) => {
    setCustomDraft({
      name: '',
      type: 'skill',
      group,
      description: '',
    })
    setIsCustomModalOpen(true)
  }

  const closeCustomQualificationModal = () => {
    setIsCustomModalOpen(false)
  }

  const addQualificationFromLibrary = (
    item: (typeof QUALIFICATION_LIBRARY)[number],
  ) => {
    const newItem = createQualificationFromLibrary(item, activeGroup)
    persistQualifications([newItem, ...qualifications])
    setSelectedId(newItem.id)
  }

  const addCustomQualificationToGroup = (
    group: QualificationGroup = activeGroup,
    overrides?: Partial<Qualification>,
  ) => {
    const newItem = {
      ...createCustomQualification(group),
      ...overrides,
      group,
      mandatory: group === 'must_have',
      tags: overrides?.tags || [],
    }
    persistQualifications([newItem, ...qualifications])
    setSelectedId(newItem.id)
  }

  const handleCreateCustomQualification = () => {
    const name = customDraft.name.trim()
    if (!name) return

    addCustomQualificationToGroup(customDraft.group, {
      name,
      type: customDraft.type,
      description: customDraft.description.trim(),
    })
    setActiveGroup(customDraft.group)
    closeCustomQualificationModal()
  }

  const updateQualification = (
    id: string,
    patch: Partial<Qualification>,
  ) => {
    persistQualifications(
      qualifications.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    )
  }

  const removeQualification = (id: string) => {
    const next = qualifications.filter((item) => item.id !== id)
    persistQualifications(next)

    if (selectedId === id) {
      const replacement =
        next.find((item) => item.group === activeGroup)?.id ||
        next[0]?.id ||
        ''
      setSelectedId(replacement)
    }
  }

  const moveQualification = (
    id: string,
    direction: 'up' | 'down',
  ) => {
    const scopedIndices = qualifications
      .map((item, index) =>
        item.group === activeGroup ? index : -1,
      )
      .filter((index) => index !== -1)

    const currentScopedIndex = scopedIndices.findIndex(
      (index) => qualifications[index]?.id === id,
    )
    if (currentScopedIndex === -1) return

    const nextScopedIndex =
      direction === 'up'
        ? currentScopedIndex - 1
        : currentScopedIndex + 1

    if (
      nextScopedIndex < 0 ||
      nextScopedIndex >= scopedIndices.length
    ) {
      return
    }

    const currentIndex = scopedIndices[currentScopedIndex]
    const targetIndex = scopedIndices[nextScopedIndex]
    const next = [...qualifications]
    ;[next[currentIndex], next[targetIndex]] = [
      next[targetIndex],
      next[currentIndex],
    ]
    persistQualifications(next)
  }

  const roleLabel = request.role || 'this role'

  const handleContinue = async () => {
    setSavingStep(true)
    setSaveError('')

    try {
      let intakeId = request.intakeId

      if (!intakeId) {
        const created = await createIntakeDraft({
          engagementType: 'staffing',
          title: request.role?.trim() || undefined,
          description: request.description?.trim() || undefined,
          startDate: request.startDate || undefined,
          endDate: request.endDate || undefined,
          workerCount:
            typeof request.positions === 'number' &&
            request.positions > 0
              ? request.positions
              : undefined,
          costCenter: request.costCenterId,
          site: request.siteId,
          supplier: request.supplierId,
          roleDefinition: request.roleId,
          legalEntity: request.legalEntityId,
          targetRate:
            typeof request.targetRate === 'number'
              ? request.targetRate.toFixed(2)
              : undefined,
          rateUnit: request.rateUnit || 'hourly',
          budgetAmount:
            typeof request.budgetAmount === 'number'
              ? request.budgetAmount.toFixed(2)
              : undefined,
          currency: request.currency || 'USD',
          country: request.country || undefined,
          stateProvince:
            request.stateProvince || request.region || undefined,
          city: request.city || undefined,
          rateCard: request.selectedRateCardId,
          overtimeEnabled: request.overtimeEnabled,
          overtimeMultiplier:
            typeof request.overtimeFactor === 'number'
              ? request.overtimeFactor.toFixed(2)
              : undefined,
          customFields: request.customFields || {},
          qualificationsEnabled: true,
          qualifications,
        })
        intakeId = created.id
        update({ intakeId: created.id })
      } else {
        await patchIntake(intakeId, {
          qualificationsEnabled: true,
          qualifications,
        })
      }

      update({
        qualificationsEnabled: true,
        qualifications,
      })

      router.push('/requests/new/job/create/financials')
    } catch (error) {
      if (
        error instanceof IntakeApiError &&
        error.status === 401
      ) {
        router.replace(
          '/auth/login?next=/requests/new/job/create/qualifications/setup',
        )
        return
      }

      setSaveError(
        error instanceof Error
          ? error.message
          : 'Unable to save qualifications.',
      )
    } finally {
      setSavingStep(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,_#f8fafc,_#f8fafc,_#eef6ff)] pb-20 font-sans text-slate-900">
      <div className="mx-auto max-w-[1500px] p-6">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <SmallBadge tone="blue">Step 3 of 5</SmallBadge>
              <SmallBadge>Qualifications</SmallBadge>
              {request.role && <SmallBadge>{request.role}</SmallBadge>}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Qualifications
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Define screening and evaluation requirements for {roleLabel}. Use
              must-have qualifications for mandatory criteria and nice-to-have
              qualifications for preferred fit.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Must Have
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {mustHaveCount}
              </div>
            </Card>
            <Card className="px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Nice to Have
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {niceToHaveCount}
              </div>
            </Card>
            <Card className="px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Knockout
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {knockoutCount}
              </div>
            </Card>
          </div>
        </div>

        {saveError && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {saveError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div>
            <Card className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    Qualification Library
                  </h2>
                  <p className="text-sm text-slate-500">
                    Search and add reusable skills.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCustomQualificationModal()}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  + Custom
                </button>
              </div>

              <input
                placeholder="Search skill, tool, certification..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />

              <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
                {filteredLibrary.map((item) => (
                  <button
                    key={`${item.type}-${item.name}`}
                    type="button"
                    onClick={() => addQualificationFromLibrary(item)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">
                          {item.name}
                        </div>
                        <div className="mt-1 text-xs capitalize text-slate-500">
                          {item.type}
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-medium text-white">
                        Add
                      </span>
                    </div>
                    {item.tags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <SmallBadge key={tag}>{tag}</SmallBadge>
                        ))}
                      </div>
                    ) : null}
                  </button>
                ))}

                {filteredLibrary.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No matches found.
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    Qualification Setup
                  </h2>
                  <p className="text-sm text-slate-500">
                    Build the list the hiring team and suppliers will evaluate
                    against.
                  </p>
                </div>

                <div className="flex gap-2">
                  <SectionPill
                    active={activeGroup === 'must_have'}
                    onClick={() => setActiveGroup('must_have')}
                  >
                    Must Have ({mustHaveCount})
                  </SectionPill>
                  <SectionPill
                    active={activeGroup === 'nice_to_have'}
                    onClick={() => setActiveGroup('nice_to_have')}
                  >
                    Nice to Have ({niceToHaveCount})
                  </SectionPill>
                </div>
              </div>

              <div className="space-y-3">
                {currentList.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                    <div className="text-sm text-slate-500">
                      No qualifications in this section yet.
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openCustomQualificationModal(activeGroup)
                      }
                      className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Add qualification
                    </button>
                  </div>
                )}

                {currentList.map((item, index) => {
                  const isSelected = selectedQualification?.id === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition',
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold',
                                isSelected
                                  ? 'bg-white/15 text-white'
                                  : 'bg-slate-100 text-slate-700',
                              )}
                            >
                              {index + 1}
                            </span>
                            <div className="truncate text-sm font-semibold">
                              {item.name}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <SmallBadge
                              tone={
                                item.group === 'must_have'
                                  ? 'red'
                                  : 'green'
                              }
                            >
                              {item.group === 'must_have'
                                ? 'Must Have'
                                : 'Nice to Have'}
                            </SmallBadge>
                            <SmallBadge tone="blue">{item.type}</SmallBadge>
                            {item.mandatory && (
                              <SmallBadge tone="amber">Required</SmallBadge>
                            )}
                            {item.knockout && (
                              <SmallBadge tone="red">Knockout</SmallBadge>
                            )}
                          </div>

                          <div
                            className={cn(
                              'mt-3 text-sm',
                              isSelected
                                ? 'text-white/80'
                                : 'text-slate-600',
                            )}
                          >
                            {item.responseMode === 'years'
                              ? `${item.minYears}+ years • ${item.proficiency}`
                              : item.responseMode === 'rating'
                                ? `Rated qualification • ${item.proficiency}`
                                : item.responseMode === 'yes_no'
                                  ? 'Yes / No response'
                                  : 'Free text response'}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              moveQualification(item.id, 'up')
                            }}
                            className={cn(
                              'rounded-lg border px-2 py-1 text-xs',
                              isSelected
                                ? 'border-white/20 bg-white/10 text-white'
                                : 'border-slate-300 bg-white text-slate-700',
                            )}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              moveQualification(item.id, 'down')
                            }}
                            className={cn(
                              'rounded-lg border px-2 py-1 text-xs',
                              isSelected
                                ? 'border-white/20 bg-white/10 text-white'
                                : 'border-slate-300 bg-white text-slate-700',
                            )}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>

            {selectedQualification && (
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">
                      Edit Qualification
                    </h3>
                    <p className="text-sm text-slate-500">
                      Fine-tune screening logic and evaluation guidance.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeQualification(selectedQualification.id)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <FieldLabel>Qualification name</FieldLabel>
                    <input
                      value={selectedQualification.name}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          name: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <FieldLabel>Type</FieldLabel>
                    <select
                      value={selectedQualification.type}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          type: event.target.value as QualificationType,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="skill">Skill</option>
                      <option value="tool">Tool</option>
                      <option value="certification">Certification</option>
                      <option value="education">Education</option>
                      <option value="language">Language</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Section</FieldLabel>
                    <select
                      value={selectedQualification.group}
                      onChange={(event) => {
                        const nextGroup =
                          event.target.value as QualificationGroup
                        updateQualification(selectedQualification.id, {
                          group: nextGroup,
                          mandatory: nextGroup === 'must_have',
                        })
                        setActiveGroup(nextGroup)
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="must_have">Must Have</option>
                      <option value="nice_to_have">Nice to Have</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <FieldLabel>Description / Guidance</FieldLabel>
                    <textarea
                      rows={3}
                      value={selectedQualification.description}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          description: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <FieldLabel>Response Mode</FieldLabel>
                    <select
                      value={selectedQualification.responseMode}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          responseMode: event.target.value as ResponseMode,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="years">Years of Experience</option>
                      <option value="rating">Proficiency Rating</option>
                      <option value="yes_no">Yes / No</option>
                      <option value="text">Free Text</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Proficiency</FieldLabel>
                    <select
                      value={selectedQualification.proficiency}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          proficiency:
                            event.target.value as ProficiencyLevel,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    >
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                      <option>Expert</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Minimum Years</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={selectedQualification.minYears}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          minYears: Number(event.target.value) || 0,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <div>
                    <FieldLabel>Weight</FieldLabel>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={selectedQualification.weight}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          weight: Number(event.target.value),
                        })
                      }
                      className="w-full"
                    />
                    <div className="mt-1 text-sm text-slate-500">
                      Score weight: {selectedQualification.weight}/5
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                    <div>
                      <div className="text-sm font-medium">
                        Mandatory Response
                      </div>
                      <div className="text-xs text-slate-500">
                        Candidate or supplier must explicitly answer this
                        qualification.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedQualification.mandatory}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          mandatory: event.target.checked,
                        })
                      }
                      className="h-5 w-5 rounded border-slate-300"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                    <div>
                      <div className="text-sm font-medium">
                        Knockout Rule
                      </div>
                      <div className="text-xs text-slate-500">
                        Automatically fail if this requirement is not met.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedQualification.knockout}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          knockout: event.target.checked,
                        })
                      }
                      className="h-5 w-5 rounded border-slate-300"
                    />
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold">Live Preview</h2>
              <p className="text-sm text-slate-500">
                What the hiring team sees when reviewing qualifications.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Qualification Summary
                  </div>
                  <div className="text-xs text-slate-500">
                    {request.role || 'Job'} request
                  </div>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Must Have
                  </div>
                  <div className="space-y-2">
                    {qualifications
                      .filter((item) => item.group === 'must_have')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-slate-900">
                                {item.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-600">
                                {qualificationSummaryText(item)}
                              </div>
                            </div>
                            {item.knockout && (
                              <SmallBadge tone="red">Knockout</SmallBadge>
                            )}
                          </div>
                        </div>
                      ))}
                    {mustHaveCount === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                        No must-have qualifications yet.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nice to Have
                  </div>
                  <div className="space-y-2">
                    {qualifications
                      .filter((item) => item.group === 'nice_to_have')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="font-medium text-slate-900">
                            {item.name}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            Weighted preference • {item.weight}/5
                          </div>
                        </div>
                      ))}
                    {niceToHaveCount === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                        No nice-to-have qualifications yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <footer className="mt-10 flex items-center justify-between border-t border-slate-200 pt-8">
          <button
            type="button"
            onClick={() => router.push('/requests/new/job/create/qualifications')}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openCustomQualificationModal()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Add qualification
            </button>
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={savingStep}
              className={cn(
                'inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full px-10 py-3.5 text-sm font-bold shadow-lg transition-all',
                savingStep
                  ? 'cursor-not-allowed bg-slate-300 text-slate-600'
                  : 'bg-slate-950 text-white hover:bg-slate-800',
              )}
            >
              {savingStep ? 'Saving...' : 'Continue'}
              {!savingStep && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </footer>
      </div>

      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Add Custom Qualification
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create a custom requirement and place it directly into the
                  correct section.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCustomQualificationModal}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>Qualification name</FieldLabel>
                <input
                  value={customDraft.name}
                  onChange={(event) =>
                    setCustomDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Vendor Management"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <FieldLabel>Type</FieldLabel>
                <select
                  value={customDraft.type}
                  onChange={(event) =>
                    setCustomDraft((current) => ({
                      ...current,
                      type: event.target.value as QualificationType,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="skill">Skill</option>
                  <option value="tool">Tool</option>
                  <option value="certification">Certification</option>
                  <option value="education">Education</option>
                  <option value="language">Language</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <FieldLabel>Section</FieldLabel>
                <select
                  value={customDraft.group}
                  onChange={(event) =>
                    setCustomDraft((current) => ({
                      ...current,
                      group: event.target.value as QualificationGroup,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="must_have">Must Have</option>
                  <option value="nice_to_have">Nice to Have</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Description / Guidance</FieldLabel>
                <textarea
                  rows={4}
                  value={customDraft.description}
                  onChange={(event) =>
                    setCustomDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe what good looks like for this qualification."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
              <div className="text-sm text-slate-500">
                New custom qualifications start with sensible defaults and can
                be refined immediately after creation.
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeCustomQualificationModal}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomQualification}
                  disabled={!customDraft.name.trim()}
                  className={cn(
                    'rounded-full px-5 py-2.5 text-sm font-semibold text-white transition',
                    customDraft.name.trim()
                      ? 'bg-slate-950 hover:bg-slate-800'
                      : 'cursor-not-allowed bg-slate-300',
                  )}
                >
                  Create qualification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
