'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, GitBranch, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react'
import {
  LevvEmptyState,
  LevvNotice,
  LevvPage,
  LevvRecordHeader,
  LevvSearchField,
  LevvSegmented,
  LevvSelect,
  LevvStatusBadge,
  levvUi,
} from '@/components/ui/levv-app'
import {
  ApprovalChainsApiError,
  deleteApprovalChain,
  getApprovalChains,
  type ApprovalChain,
  type ApprovalChainCondition,
  type ApprovalChainStep,
} from '@/lib/api/approvalChains'
import { getApprovalGroups, type ApprovalGroup } from '@/lib/approvalGroups'

function formatDate(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const OPERATOR_WORDS: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  contains: 'contains',
  not_contains: 'does not contain',
  in: 'is one of',
  not_in: 'is not one of',
}

function conditionValue(condition: ApprovalChainCondition) {
  const { value, data_type: type } = condition
  if (Array.isArray(value)) return value.join(', ')
  if (type === 'number' && value !== '' && !Number.isNaN(Number(value))) return Number(value).toLocaleString('en-US')
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value ?? '')
}

/** The conditions as one sentence: field names in ink, joined by the chain's match strategy. */
function ConditionSentence({ chain }: { chain: ApprovalChain }) {
  const conditions = [...chain.conditions].sort((a, b) => a.sequence - b.sequence)
  if (conditions.length === 0) return <span className="text-slate-500">Every request</span>
  return (
    <span className="text-slate-500">
      {conditions.map((condition, index) => (
        <Fragment key={`${condition.field_key}-${index}`}>
          {index > 0 ? (chain.match_strategy === 'any' ? ' or ' : ' and ') : null}
          <span className="font-medium text-slate-700">{condition.field_label || condition.field_key}</span>{' '}
          {OPERATOR_WORDS[condition.operator] ?? condition.operator.replace(/_/g, ' ')}{' '}
          <span className="text-slate-700">{conditionValue(condition)}</span>
        </Fragment>
      ))}
    </span>
  )
}

type Person = { key: string; name: string }

/** Who can complete a step: one named approver, any one member of a group, or (all must) effectively one at a time. */
function readStep(step: ApprovalChainStep, groups: Map<string, ApprovalGroup>) {
  if (step.step_type !== 'approval_group') {
    return {
      who: step.approver_name || 'Approver',
      rule: 'One person',
      capacity: 1 as number | null,
      people: step.approver != null ? [{ key: `user:${step.approver}`, name: step.approver_name || 'An approver' }] : [],
    }
  }
  const group = step.approval_group_id ? groups.get(step.approval_group_id) : undefined
  const all = (step.decision_rule ?? group?.decisionRule) === 'all'
  const size = group?.members.length ?? null
  return {
    who: step.approval_group_name || group?.name || 'Approval group',
    rule: size === null ? (all ? 'All must' : 'Any one') : all ? `All must · ${size}` : `Any one of ${size}`,
    capacity: size === null ? null : all ? 1 : size,
    people: (group?.members ?? []).map((member): Person => ({ key: `member:${member.id}`, name: member.name })),
  }
}

/** People who sit in more than one step of the same chain, so one person could approve twice. */
function findConflicts(chain: ApprovalChain, groups: Map<string, ApprovalGroup>) {
  const seen = new Map<string, { name: string; steps: number[] }>()
  ;[...chain.steps]
    .sort((a, b) => a.sequence - b.sequence)
    .forEach((step, index) => {
      readStep(step, groups).people.forEach((person) => {
        const entry = seen.get(person.key) ?? { name: person.name, steps: [] }
        if (!entry.steps.includes(index)) entry.steps.push(index)
        seen.set(person.key, entry)
      })
    })
  return Array.from(seen.values()).filter((entry) => entry.steps.length > 1)
}

function hatchFor(capacity: number | null) {
  if (capacity === null) return ''
  if (capacity <= 1) return 'levv-hatch-dense'
  if (capacity === 2) return 'levv-hatch-mid'
  return 'levv-hatch-light'
}

/** The approvers in order: square blocks hatched by how few people can complete each step; a conflict cross-hatches. */
function StepBlocks({ chain, groups, conflictSteps }: { chain: ApprovalChain; groups: Map<string, ApprovalGroup>; conflictSteps: Set<number> }) {
  const steps = [...chain.steps].sort((a, b) => a.sequence - b.sequence)
  if (steps.length === 0) return <span className="text-slate-500">No approvers</span>
  return (
    <ol className="flex flex-wrap items-center gap-y-1.5" aria-label={`Approvers for ${chain.name}`}>
      {steps.map((step, index) => {
        const read = readStep(step, groups)
        const conflict = conflictSteps.has(index)
        const threshold = Number(step.amount) > 0 ? `${step.currency} ${Number(step.amount).toLocaleString('en-US')}` : null
        return (
          <li key={`${step.sequence}-${index}`} className="flex items-center">
            {index > 0 ? <span aria-hidden className="h-px w-2 bg-slate-500" /> : null}
            <span className={`inline-flex items-stretch border bg-[var(--surface)] ${conflict ? 'border-[#c0392b]' : 'border-slate-500'}`}>
              <span aria-hidden className={`w-3.5 shrink-0 border-r ${conflict ? 'levv-hatch-conflict border-[#c0392b]' : `${hatchFor(read.capacity)} border-slate-500`}`} />
              <span className="flex flex-col px-2 py-1">
                <span className="flex items-baseline gap-1.5 whitespace-nowrap text-[13px] text-slate-950">
                  <span className="font-semibold tabular-nums text-[11px] text-slate-500">{index + 1}</span>
                  {read.who}
                </span>
                <span className={`${levvUi.legend} whitespace-nowrap ${conflict ? 'text-[#a32f23]' : 'text-slate-500'}`}>
                  {read.rule}
                  {threshold ? <> · from <span className="font-semibold tabular-nums normal-case tracking-normal">{threshold}</span></> : null}
                </span>
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function ApprovalChainsListPage() {
  const router = useRouter()
  const [chains, setChains] = useState<ApprovalChain[]>([])
  // Every chain, unfiltered: the band states the policy as it stands, whatever the toolbar shows.
  const [allChains, setAllChains] = useState<ApprovalChain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState('')
  const [matchStrategyFilter, setMatchStrategyFilter] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  // Approval groups live in this browser (lib/approvalGroups); chains name them by id.
  const [groups, setGroups] = useState<Map<string, ApprovalGroup>>(new Map())

  useEffect(() => {
    setGroups(new Map(getApprovalGroups().map((group) => [group.id, group])))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadChains = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const filtered = Boolean(search || isActiveFilter || matchStrategyFilter)
      const [rows, everything] = await Promise.all([
        getApprovalChains({
          search: search || undefined,
          is_active: isActiveFilter || undefined,
          match_strategy:
            matchStrategyFilter === 'all' || matchStrategyFilter === 'any'
              ? matchStrategyFilter
              : undefined,
        }),
        filtered ? getApprovalChains() : null,
      ])
      setChains(rows)
      setAllChains(everything ?? rows)
    } catch (requestError) {
      if (
        requestError instanceof ApprovalChainsApiError &&
        requestError.status === 401
      ) {
        router.replace('/auth/login?next=/admin/approval-chains')
        return
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load approval chains.',
      )
      setChains([])
    } finally {
      setLoading(false)
    }
  }, [isActiveFilter, matchStrategyFilter, router, search])

  useEffect(() => {
    void loadChains()
  }, [loadChains])

  const handleDelete = useCallback(
    async (chain: ApprovalChain) => {
      const confirmed = window.confirm(
        `Delete approval chain "${chain.name}"?`,
      )
      if (!confirmed) return

      setDeletingId(chain.id)
      setError('')

      try {
        await deleteApprovalChain(chain.id)
        setChains((current) =>
          current.filter((row) => row.id !== chain.id),
        )
        setAllChains((current) =>
          current.filter((row) => row.id !== chain.id),
        )
      } catch (requestError) {
        if (
          requestError instanceof ApprovalChainsApiError &&
          requestError.status === 401
        ) {
          router.replace('/auth/login?next=/admin/approval-chains')
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to delete approval chain.',
        )
      } finally {
        setDeletingId(null)
      }
    },
    [router],
  )

  const filtersChanged = searchInput !== '' || isActiveFilter !== '' || matchStrategyFilter !== ''
  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setIsActiveFilter('')
    setMatchStrategyFilter('')
  }

  const active = allChains.filter((chain) => chain.is_active)
  const steps = active.reduce((total, chain) => total + chain.steps.length, 0)
  const statement = loading
    ? 'Loading approval chains…'
    : error
      ? 'Approval chains could not be loaded, so their routing cannot be shown.'
      : allChains.length === 0
        ? 'No approval chains yet. A chain names the requests it covers and their approvers, in order.'
        : active.length === 0
          ? `None of the ${allChains.length} chains is active, so none routes requests.`
          : active.length === 1
            ? 'A request that matches the one active chain goes to its approvers in order.'
            : `A request takes the first of ${active.length} active chains it matches, lowest priority number first, then goes to its approvers in order.`
  const figure = (value: number) => (loading || error ? '—' : value)

  const conflicts = useMemo(
    () => new Map(chains.map((chain) => [chain.id, findConflicts(chain, groups)])),
    [chains, groups],
  )
  const conflictList = chains.flatMap((chain) => (conflicts.get(chain.id) ?? []).map((conflict) => ({ chain, ...conflict })))
  const conflictStepsFor = (chain: ApprovalChain) => new Set((conflicts.get(chain.id) ?? []).flatMap((conflict) => conflict.steps))
  const href = (chain: ApprovalChain) => `/admin/approval-chains/${encodeURIComponent(String(chain.id))}`
  const status = (chain: ApprovalChain) => (chain.is_active ? <LevvStatusBadge tone="emerald">Active</LevvStatusBadge> : <LevvStatusBadge>Inactive</LevvStatusBadge>)

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Approval chains"
          title="Approval chains"
          statement={statement}
          figures={[
            { label: 'Active', value: figure(active.length) },
            { label: 'Inactive', value: figure(allChains.length - active.length) },
            { label: 'Approver steps', value: figure(steps) },
          ]}
          actions={
            <Link href="/admin/approval-chains/new" className={levvUi.primaryButton}>
              <Plus /> New chain
            </Link>
          }
        />

        {conflictList.length > 0 ? (
          <LevvNotice tone="rose" icon={AlertTriangle} title={`${conflictList.length} ${conflictList.length === 1 ? 'conflict' : 'conflicts'}`}>
            {conflictList.map((conflict) => (
              <span key={`${conflict.chain.id}-${conflict.name}`} className="block">
                {conflict.name} sits in {conflict.steps.length} steps of <Link href={href(conflict.chain)} className="font-semibold underline underline-offset-2">{conflict.chain.name}</Link>, so one person could approve twice.
              </span>
            ))}
          </LevvNotice>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <label className="grid w-full gap-1.5 sm:w-72">
            <span className={levvUi.label}>Search</span>
            <LevvSearchField placeholder="Search chains" aria-label="Search approval chains" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          </label>
          <div className="grid gap-1.5">
            <span className={levvUi.label} aria-hidden>Status</span>
            <LevvSegmented
              label="Status"
              value={isActiveFilter}
              onChange={setIsActiveFilter}
              options={[
                { value: '', label: 'All' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
            />
          </div>
          <label className="grid w-full gap-1.5 sm:w-52">
            <span className={levvUi.label}>Match strategy</span>
            <LevvSelect aria-label="Match strategy" value={matchStrategyFilter} onChange={(event) => setMatchStrategyFilter(event.target.value)}>
              <option value="">All match strategies</option>
              <option value="all">All conditions</option>
              <option value="any">Any condition</option>
            </LevvSelect>
          </label>
          {filtersChanged ? (
            <button type="button" onClick={resetFilters} className={levvUi.ghostButton}>
              Reset
            </button>
          ) : null}
          <span className="ml-auto flex items-center gap-3">
            <span className={`${levvUi.legend} text-slate-500`}>
              Showing <span className="font-semibold tabular-nums normal-case tracking-normal text-slate-950">{loading ? '—' : chains.length}</span>
            </span>
            <button type="button" onClick={() => void loadChains()} className={levvUi.secondaryButton}>
              <RefreshCcw /> Refresh
            </button>
          </span>
        </div>

        {error ? (
          <LevvNotice
            tone="rose"
            title="Approval chains could not be loaded"
            action={<button type="button" onClick={() => void loadChains()} className={levvUi.secondaryButton}><RefreshCcw /> Retry</button>}
          >
            {error}
          </LevvNotice>
        ) : (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-600">
              <span className={`${levvUi.legend} text-slate-500`}>Legend</span>
              {[['levv-hatch-dense', '1'], ['levv-hatch-mid', '2'], ['levv-hatch-light', '3+']].map(([hatch, count]) => (
                <span key={count} className="flex items-center gap-1.5">
                  <span aria-hidden className={`h-3 w-5 border border-slate-500 ${hatch}`} />
                  <span className="font-semibold tabular-nums text-[12px]">{count}</span>
                </span>
              ))}
              <span>Hatch density: fewer people can complete that step.</span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="levv-hatch-conflict h-3 w-5 border border-[#c0392b]" />
                Cross-hatch: one person in two steps.
              </span>
            </p>

            <div className={`${levvUi.tableShell} levv-cq`}>
              {loading ? (
                <div aria-busy="true" aria-label="Loading approval chains" className="divide-y divide-[var(--line)] border-t-2 border-slate-950">
                  {[0, 1].map((row) => (
                    <div key={row} className="flex items-center gap-6 px-3 py-5">
                      <span className="h-3 w-8 bg-slate-100" />
                      <span className="h-3 w-64 bg-slate-100" />
                      <span className="h-6 w-48 bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : chains.length === 0 ? (
                filtersChanged ? (
                  <LevvEmptyState
                    icon={Search}
                    title="No chains match"
                    action={<button type="button" onClick={resetFilters} className={levvUi.secondaryButton}>Reset filters</button>}
                  >
                    Try another name, or show every status and match strategy.
                  </LevvEmptyState>
                ) : (
                  <LevvEmptyState
                    icon={GitBranch}
                    title="No approval chains yet"
                    action={<Link href="/admin/approval-chains/new" className={levvUi.primaryButton}><Plus /> New chain</Link>}
                  >
                    A chain says which requests it covers and who approves them, in order.
                  </LevvEmptyState>
                )
              ) : (
                <>
                  <ul className="levv-cq-list divide-y divide-[var(--line)] border-t-2 border-slate-950">
                    {chains.map((chain) => (
                      <li key={chain.id} className="space-y-2.5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <Link href={href(chain)} className="min-w-0 rounded text-[14px] font-medium text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
                            <span className="mr-2 font-semibold tabular-nums text-[12px] text-slate-500">P{chain.priority}</span>
                            {chain.name}
                          </Link>
                          {status(chain)}
                        </div>
                        <p className="text-[13px] leading-relaxed"><ConditionSentence chain={chain} /></p>
                        <StepBlocks chain={chain} groups={groups} conflictSteps={conflictStepsFor(chain)} />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] tabular-nums text-slate-500">Updated {formatDate(chain.updated_at)}</span>
                          <span className="flex gap-1">
                            <Link href={href(chain)} className={levvUi.secondaryButton}>Edit</Link>
                            <button type="button" onClick={() => void handleDelete(chain)} disabled={deletingId === chain.id} aria-label={`Delete ${chain.name}`} className={`${levvUi.dangerGhostButton} w-9 px-0`}>
                              <Trash2 />
                            </button>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="levv-cq-table relative overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead>
                        <tr>
                          <th className={`${levvUi.th} w-16`}>Priority</th>
                          <th className={levvUi.th}>Chain</th>
                          <th className={`${levvUi.th} levv-cq-wide w-[190px]`}>Applies when</th>
                          <th className={levvUi.th}>Approvers, in order</th>
                          <th className={`${levvUi.th} w-24`}>Status</th>
                          <th className={`${levvUi.th} w-[104px]`}><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {chains.map((chain) => {
                          const rowConflicts = conflicts.get(chain.id) ?? []
                          return (
                            <tr key={chain.id} className={`align-top hover:bg-[var(--surface-sunken)] [&>td]:border-b [&>td]:border-[var(--line)] ${chain.is_active ? '' : 'text-slate-500'}`}>
                              <td className={`${levvUi.td} pt-4 font-semibold tabular-nums text-[13px] text-slate-950`}>P{chain.priority}</td>
                              <td className={`${levvUi.td} pt-3.5`}>
                                <Link href={href(chain)} className={`rounded font-medium outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${chain.is_active ? 'text-slate-950' : 'text-slate-500'}`}>
                                  {chain.name}
                                </Link>
                                <p className="levv-cq-narrow mt-1 max-w-[52ch] text-[13px] leading-relaxed"><ConditionSentence chain={chain} /></p>
                                <p className="mt-0.5 line-clamp-2 max-w-[44ch] text-[13px] text-slate-500">{chain.description || 'No description'}</p>
                                <p className="mt-1 whitespace-nowrap text-[11px] tabular-nums text-slate-500">Updated {formatDate(chain.updated_at)}</p>
                                {rowConflicts.map((conflict) => (
                                  <p key={conflict.name} className="mt-1.5 text-[13px] text-[#a32f23]">
                                    <span className={`${levvUi.legend} mr-1.5`}>Conflict</span>
                                    {conflict.name} is in steps {conflict.steps.map((step) => step + 1).join(' and ')}.
                                  </p>
                                ))}
                              </td>
                              <td className={`${levvUi.td} levv-cq-wide pt-3.5 text-[13px] leading-relaxed`}>
                                <ConditionSentence chain={chain} />
                              </td>
                              <td className={`${levvUi.td} pt-3`}>
                                <StepBlocks chain={chain} groups={groups} conflictSteps={conflictStepsFor(chain)} />
                              </td>
                              <td className={`${levvUi.td} pt-3.5`}>{status(chain)}</td>
                              <td className={`${levvUi.td} pt-3`}>
                                <span className="flex justify-end gap-1">
                                  <Link href={href(chain)} className={levvUi.secondaryButton} aria-label={`Edit ${chain.name}`}>Edit</Link>
                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(chain)}
                                    disabled={deletingId === chain.id}
                                    aria-label={deletingId === chain.id ? `Deleting ${chain.name}` : `Delete ${chain.name}`}
                                    title="Delete"
                                    className={`${levvUi.dangerGhostButton} w-9 px-0`}
                                  >
                                    <Trash2 />
                                  </button>
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </LevvPage>
  )
}
