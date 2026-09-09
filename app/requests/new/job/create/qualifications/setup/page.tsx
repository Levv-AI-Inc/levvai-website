'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Search,
  Plus,
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
import {
  LevvRequestHeader,
  levvUi,
} from '@/components/ui/levv-app'

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
        'rounded-xl border px-3.5 py-2 text-sm font-semibold transition',
        active
          ? 'border-[#2563eb] bg-[#eaf2ff] text-[#2563eb]'
          : 'border-[#dbe3ee] bg-white text-[#52637a] hover:border-[#b8c8df] hover:bg-[#f8fafc]',
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
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-semibold text-[#52637a]">
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
        'rounded-[16px] border border-[#dce5f1] bg-white shadow-[0_10px_30px_-26px_rgba(15,23,42,0.35)]',
        className,
      )}
    >
      {children}
    </div>
  )
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
  const [libraryType, setLibraryType] = useState<'all' | QualificationType>('all')
  const [selectedId, setSelectedId] = useState<string>(
    request.qualifications?.[0]?.id || '',
  )
  const [editorOpen, setEditorOpen] = useState(false)
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
    return QUALIFICATION_LIBRARY.filter((item) => {
      if (libraryType !== 'all' && item.type !== libraryType) return false
      if (!query) return true
      const haystack = [item.name, item.type, ...(item.tags || [])]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [libraryType, search])

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
    setEditorOpen(false)
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
    setEditorOpen(false)
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
    setEditorOpen(false)

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
    <div className="levv-request-page pb-6 font-sans text-[#101b3c]">
      <div className="w-full space-y-5">
        <LevvRequestHeader
          currentStep={3}
          title="Qualifications"
          description={`Add only the criteria that matter for ${roleLabel}.`}
          meta={
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#52637a]">
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">
                {request.intakeId ? `INT-${request.intakeId}` : 'Draft'}
              </span>
              <span className="rounded-full border border-[#dbe3ee] bg-white px-3 py-1.5">
                {mustHaveCount + niceToHaveCount} criteria
              </span>
              {knockoutCount > 0 ? (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700">
                  {knockoutCount} knockout
                </span>
              ) : null}
            </div>
          }
        />

        {saveError && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {saveError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.7fr)]">
          <div className="xl:sticky xl:top-24 xl:self-start">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#101b3c]">
                    Qualification Library
                  </h2>
                  <p className="text-xs text-[#64748b]">
                    Search reusable skills and tools.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCustomQualificationModal()}
                  className={levvUi.secondaryButton}
                >
                  + Custom
                </button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  placeholder="Search skills, tools, or certifications"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={`${levvUi.input} pl-9`}
                />
              </div>

              <div className="my-3 flex flex-wrap gap-1.5">
                {(
                  [
                    ['all', 'All'],
                    ['tool', 'Tools'],
                    ['skill', 'Skills'],
                    ['certification', 'Certifications'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLibraryType(value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      libraryType === value
                        ? 'border-[#93b4f8] bg-[#eaf2ff] text-[#2563eb]'
                        : 'border-[#dbe3ee] bg-white text-[#64748b] hover:bg-[#f8fafc]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="max-h-[430px] space-y-2 overflow-auto pr-1">
                {filteredLibrary.map((item) => (
                  <button
                    key={`${item.type}-${item.name}`}
                    type="button"
                    onClick={() => addQualificationFromLibrary(item)}
                    className="w-full rounded-xl border border-[#dbe3ee] bg-[#f8fafc] p-3 text-left transition hover:border-[#93b4f8] hover:bg-white"
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
                      <span className="rounded-lg border border-[#bdd2fb] bg-white px-2.5 py-1 text-xs font-semibold text-[#2563eb]">
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

          <div className="space-y-4">
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#101b3c]">
                    Qualification Setup
                  </h2>
                  <p className="text-xs text-[#64748b]">
                    Add criteria, then select one to edit it.
                  </p>
                </div>

                <div className="flex gap-2">
                  <SectionPill
                    active={activeGroup === 'must_have'}
                    onClick={() => {
                      setActiveGroup('must_have')
                      setEditorOpen(false)
                    }}
                  >
                    Must Have ({mustHaveCount})
                  </SectionPill>
                  <SectionPill
                    active={activeGroup === 'nice_to_have'}
                    onClick={() => {
                      setActiveGroup('nice_to_have')
                      setEditorOpen(false)
                    }}
                  >
                    Nice to Have ({niceToHaveCount})
                  </SectionPill>
                </div>
              </div>

              <div className="space-y-3">
                {currentList.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-8 text-center">
                    <div className="text-sm text-slate-500">
                      No qualifications in this section yet.
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openCustomQualificationModal(activeGroup)
                      }
                      className={`${levvUi.primaryButton} mt-4`}
                    >
                      Add qualification
                    </button>
                  </div>
                )}

                {currentList.map((item, index) => {
                  const isSelected = selectedQualification?.id === item.id

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedId(item.id)
                        }
                      }}
                      className={cn(
                        'w-full cursor-pointer rounded-xl border p-3 text-left transition',
                        isSelected
                          ? 'border-[#93b4f8] bg-[#eef5ff] shadow-[0_0_0_2px_rgba(37,99,235,0.08)]'
                          : 'border-[#dbe3ee] bg-white hover:border-[#b8c8df] hover:bg-[#f8fafc]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={cn(
                                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                                isSelected
                                  ? 'bg-white text-[#2563eb]'
                                  : 'bg-[#eef2f7] text-[#52637a]',
                              )}
                            >
                              {index + 1}
                            </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-[#17213c]">{item.name}</div>
                            <div className="mt-0.5 text-xs text-[#64748b]">
                              {item.responseMode === 'years'
                                ? `${item.minYears}+ years · ${item.proficiency}`
                                : item.responseMode === 'rating'
                                  ? `Rated · ${item.proficiency}`
                                  : item.responseMode === 'yes_no'
                                    ? 'Yes / No response'
                                    : 'Free text response'}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <SmallBadge tone={item.group === 'must_have' ? 'red' : 'green'}>
                            {item.group === 'must_have' ? 'Must have' : 'Nice to have'}
                          </SmallBadge>
                          {item.knockout ? <SmallBadge tone="red">Knockout</SmallBadge> : null}
                          {isSelected ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setEditorOpen(true)
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#bdd2fb] bg-white px-2.5 py-1 text-xs font-semibold text-[#2563eb] hover:bg-[#f8fbff]"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              moveQualification(item.id, 'up')
                            }}
                            aria-label={`Move ${item.name} up`}
                            className="rounded-lg border border-[#dbe3ee] bg-white px-2 py-1 text-xs text-[#52637a] hover:bg-[#f8fafc]"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              moveQualification(item.id, 'down')
                            }}
                            aria-label={`Move ${item.name} down`}
                            className="rounded-lg border border-[#dbe3ee] bg-white px-2 py-1 text-xs text-[#52637a] hover:bg-[#f8fafc]"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {selectedQualification && editorOpen && (
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#101b3c]">
                      Edit qualification
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
                      className={levvUi.secondaryButton}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQualification(selectedQualification.id)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="xl:col-span-2">
                    <FieldLabel>Qualification name</FieldLabel>
                    <input
                      value={selectedQualification.name}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          name: event.target.value,
                        })
                      }
                      className={levvUi.input}
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
                      className={levvUi.input}
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
                      className={levvUi.input}
                    >
                      <option value="must_have">Must Have</option>
                      <option value="nice_to_have">Nice to Have</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 xl:col-span-4">
                    <FieldLabel>Description / Guidance</FieldLabel>
                    <textarea
                      rows={2}
                      value={selectedQualification.description}
                      onChange={(event) =>
                        updateQualification(selectedQualification.id, {
                          description: event.target.value,
                        })
                      }
                      className={levvUi.input}
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
                      className={levvUi.input}
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
                      className={levvUi.input}
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
                      className={levvUi.input}
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

                  <div className="flex items-center justify-between rounded-xl border border-[#dbe3ee] bg-[#f8fafc] p-3 md:col-span-1 xl:col-span-2">
                    <div>
                      <div className="text-sm font-semibold text-[#17213c]">
                        Response required
                      </div>
                      <div className="text-xs text-[#64748b]">
                        A response must be provided.
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

                  <div className="flex items-center justify-between rounded-xl border border-[#dbe3ee] bg-[#f8fafc] p-3 md:col-span-1 xl:col-span-2">
                    <div>
                      <div className="text-sm font-semibold text-[#17213c]">
                        Knockout rule
                      </div>
                      <div className="text-xs text-[#64748b]">
                        Fail the response when unmet.
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

        <footer className="sticky bottom-3 z-20 flex items-center justify-between rounded-[15px] border border-[#dce5f1] bg-white/95 px-5 py-3 shadow-[0_16px_42px_-26px_rgba(15,23,42,0.45)] backdrop-blur">
          <button
            type="button"
            onClick={() => router.push('/requests/new/job/create/qualifications')}
            className={levvUi.secondaryButton}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openCustomQualificationModal()}
              className={levvUi.secondaryButton}
            >
              <Plus className="h-4 w-4" />
              Add qualification
            </button>
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={savingStep}
              className={cn(
                `${levvUi.primaryButton} min-w-[150px]`,
                savingStep
                  ? 'cursor-not-allowed opacity-60'
                  : '',
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
