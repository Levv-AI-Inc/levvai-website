'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronRight, Plus, Search, Trash2, Users, X } from 'lucide-react'
import {
  LevvEmptyState,
  LevvPage,
  LevvRecordHeader,
  LevvSearchField,
  LevvSegmented,
  levvUi,
} from '@/components/ui/levv-app'
import {
  createApprovalGroupId,
  getApprovalGroups,
  saveApprovalGroups,
  type ApprovalGroup,
  type ApprovalGroupMember,
  type ApprovalGroupDecisionRule,
} from '@/lib/approvalGroups'
import { getApprovalChainApprovers, getApprovalChains } from '@/lib/api/approvalChains'

type GroupDraft = {
  id: string
  name: string
  description: string
  decisionRule: ApprovalGroupDecisionRule
  members: ApprovalGroupMember[]
}

type RuleFilter = 'every' | ApprovalGroupDecisionRule

const EMPTY_DRAFT: GroupDraft = {
  id: '',
  name: '',
  description: '',
  decisionRule: 'any',
  members: [],
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

/** The page's policy in one sentence, from the groups as they stand and the chains that name them. */
function policyStatement(groups: ApprovalGroup[], chainUse: Map<string, number> | null) {
  if (groups.length === 0) return 'No approval groups yet. A group is a team that approves together as one step.'
  const named = chainUse ? groups.filter((group) => (chainUse.get(group.id) ?? 0) > 0).length : null
  const lead =
    named === null
      ? `${plural(groups.length, 'group')}.`
      : named === 0
        ? `${plural(groups.length, 'group')}, none named in an approval chain yet.`
        : `${plural(groups.length, 'group')}, ${named} named in approval chains.`
  const strict = groups.filter((group) => group.decisionRule === 'all').length
  if (strict === 0) return `${lead} In each, any one member can approve.`
  if (strict === groups.length) return `${lead} Each needs every member to approve.`
  return `${lead} ${strict} ${strict === 1 ? 'needs' : 'need'} every member to approve; the rest, any one member.`
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ApprovalGroupsPage() {
  const [stored, setStored] = useState<ApprovalGroup[] | null>(null)
  const [chainUse, setChainUse] = useState<Map<string, number> | null>(null)
  const [availableUsers, setAvailableUsers] = useState<ApprovalGroupMember[]>([])
  const [draft, setDraft] = useState<GroupDraft>(EMPTY_DRAFT)
  const [editorOpen, setEditorOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('every')
  const [query, setQuery] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)

  const groups = useMemo(() => stored ?? [], [stored])
  const loaded = stored !== null
  const setGroups = setStored
  const editorRef = useRef<HTMLElement | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => setStored(getApprovalGroups()), [])

  // How many approval chains name each group in a step. Left unknown when chains cannot be read.
  useEffect(() => {
    let cancelled = false
    getApprovalChains()
      .then((chains) => {
        if (cancelled) return
        const counts = new Map<string, number>()
        chains.forEach((chain) => {
          const named = new Set(chain.steps.filter((step) => step.step_type === 'approval_group' && step.approval_group_id).map((step) => step.approval_group_id as string))
          named.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1))
        })
        setChainUse(counts)
      })
      .catch(() => !cancelled && setChainUse(null))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!editorOpen || availableUsers.length > 0) return
    let cancelled = false
    setLoadingUsers(true)
    getApprovalChainApprovers()
      .then((rows) => {
        if (cancelled) return
        setAvailableUsers(rows.map((row) => ({
          id: String(row.user_id),
          name: row.name,
          email: row.email,
          title: row.role,
        })))
      })
      .catch(() => setAvailableUsers([]))
      .finally(() => !cancelled && setLoadingUsers(false))
    return () => { cancelled = true }
  }, [availableUsers.length, editorOpen])

  useEffect(() => {
    if (!editorOpen) return
    nameRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditorOpen(false)
        return
      }
      if (event.key !== 'Tab' || !editorRef.current) return
      const items = Array.from(editorRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      returnFocusRef.current?.focus()
    }
  }, [editorOpen])

  const people = useMemo(() => new Set(groups.flatMap((group) => group.members.map((member) => member.id))).size, [groups])
  const strict = groups.filter((group) => group.decisionRule === 'all').length

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return groups.filter((group) => {
      if (ruleFilter !== 'every' && group.decisionRule !== ruleFilter) return false
      if (!needle) return true
      return `${group.name} ${group.description} ${group.members.map((member) => member.name).join(' ')}`.toLowerCase().includes(needle)
    })
  }, [groups, ruleFilter, search])

  const userOptions = useMemo(() => {
    const map = new Map<string, ApprovalGroupMember>()
    groups.flatMap((group) => group.members).forEach((member) => map.set(member.id, member))
    availableUsers.forEach((member) => map.set(member.id, member))
    const needle = query.trim().toLowerCase()
    return Array.from(map.values())
      .filter((member) => !needle || `${member.name} ${member.email} ${member.title || ''}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aIn = draft.members.some((member) => member.id === a.id)
        const bIn = draft.members.some((member) => member.id === b.id)
        return aIn === bIn ? a.name.localeCompare(b.name) : aIn ? -1 : 1
      })
    // Re-sort only when the editor opens on a group, so ticking a box never moves the row under the pointer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableUsers, groups, query, draft.id, editorOpen])

  const filtersChanged = search.trim() !== '' || ruleFilter !== 'every'

  const openCreate = () => {
    returnFocusRef.current = document.activeElement as HTMLElement | null
    setDraft(EMPTY_DRAFT)
    setQuery('')
    setEditorOpen(true)
  }

  const openEdit = (group: ApprovalGroup) => {
    returnFocusRef.current = document.activeElement as HTMLElement | null
    setDraft({ ...group, members: [...group.members] })
    setQuery('')
    setEditorOpen(true)
  }

  const commit = () => {
    if (!draft.name.trim() || draft.members.length === 0) return
    const next: ApprovalGroup = {
      ...draft,
      id: draft.id || createApprovalGroupId(draft.name),
      name: draft.name.trim(),
      description: draft.description.trim(),
      updatedAt: new Date().toISOString(),
    }
    const updated = groups.some((group) => group.id === next.id)
      ? groups.map((group) => group.id === next.id ? next : group)
      : [next, ...groups]
    setGroups(updated)
    saveApprovalGroups(updated)
    setEditorOpen(false)
  }

  const remove = (id: string) => {
    const group = groups.find((row) => row.id === id)
    if (!group) return
    const used = chainUse?.get(id) ?? 0
    const warning = used > 0 ? ` ${plural(used, 'approval chain')} ${used === 1 ? 'names' : 'name'} this group as a step.` : ''
    if (!window.confirm(`Delete approval group "${group.name}"?${warning}`)) return
    const updated = groups.filter((row) => row.id !== id)
    setGroups(updated)
    saveApprovalGroups(updated)
    setEditorOpen(false)
  }

  const toggleMember = (member: ApprovalGroupMember) => {
    setDraft((current) => ({
      ...current,
      members: current.members.some((row) => row.id === member.id)
        ? current.members.filter((row) => row.id !== member.id)
        : [...current.members, member],
    }))
  }

  const resetFilters = () => {
    setSearch('')
    setRuleFilter('every')
  }
  /** How many people can complete the step this group stands for: any one of n, or (all must) effectively one. */
  const capacity = (group: ApprovalGroup) => (group.decisionRule === 'all' ? 1 : group.members.length)
  const hatch = (group: ApprovalGroup) => {
    const value = capacity(group)
    return value <= 1 ? 'levv-hatch-dense' : value === 2 ? 'levv-hatch-mid' : 'levv-hatch-light'
  }
  const ruleText = (group: ApprovalGroup) =>
    group.decisionRule === 'all' ? `All must · ${group.members.length}` : `Any one of ${group.members.length}`
  const inChains = (group: ApprovalGroup) => {
    if (chainUse === null) return <span className="text-slate-500">—</span>
    const used = chainUse.get(group.id) ?? 0
    return used > 0 ? <span className="font-semibold tabular-nums text-[13px] text-slate-950">{used}</span> : <span className="text-slate-500">None</span>
  }
  const memberMarks = (group: ApprovalGroup) => (
    <span className="flex gap-1" aria-hidden>
      {group.members.slice(0, 3).map((member) => (
        <span key={member.id} title={member.name} className="flex h-6 w-6 items-center justify-center bg-slate-100 text-[11px] font-semibold text-slate-800">
          {initials(member.name)}
        </span>
      ))}
    </span>
  )

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvRecordHeader
          trail="Admin settings / Approval groups"
          title="Approval groups"
          statement={loaded ? policyStatement(groups, chainUse) : 'Loading approval groups…'}
          figures={[
            { label: 'Groups', value: loaded ? groups.length : '—' },
            { label: 'People', value: loaded ? people : '—' },
            { label: 'All must', value: loaded ? strict : '—' },
          ]}
          actions={
            <button type="button" onClick={openCreate} className={levvUi.primaryButton}>
              <Plus /> New group
            </button>
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="grid w-full gap-1.5 sm:w-72">
            <span className={levvUi.label}>Search</span>
            <LevvSearchField placeholder="Groups or members" aria-label="Search groups or members" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="grid gap-1.5">
            <span className={levvUi.label} aria-hidden>Decision rule</span>
            <LevvSegmented<RuleFilter>
              label="Decision rule"
              value={ruleFilter}
              onChange={setRuleFilter}
              options={[
                { value: 'every', label: 'All' },
                { value: 'any', label: 'Any one approves' },
                { value: 'all', label: 'All must approve' },
              ]}
            />
          </div>
          {filtersChanged ? (
            <button type="button" onClick={resetFilters} className={levvUi.ghostButton}>
              Reset
            </button>
          ) : null}
          <span className={`${levvUi.legend} ml-auto text-slate-500`}>
            Showing <span className="font-semibold tabular-nums normal-case tracking-normal text-slate-950">{loaded ? `${visible.length} of ${groups.length}` : '—'}</span>
          </span>
        </div>

        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-600">
            <span className={`${levvUi.legend} text-slate-500`}>Legend</span>
            {[['levv-hatch-dense', '1'], ['levv-hatch-mid', '2'], ['levv-hatch-light', '3+']].map(([pattern, count]) => (
              <span key={count} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-3 w-5 border border-slate-500 ${pattern}`} />
                <span className="font-semibold tabular-nums text-[12px]">{count}</span>
              </span>
            ))}
            <span>Hatch density: fewer people can complete the step. All must counts as one.</span>
          </p>

          <div className={`${levvUi.tableShell} levv-cq`}>
            {!loaded ? (
              <div aria-busy="true" aria-label="Loading approval groups" className="divide-y divide-[var(--line)] border-t-2 border-slate-950">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-6 px-3 py-5">
                    <span className="h-3 w-56 bg-slate-100" />
                    <span className="h-3 w-24 bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              groups.length === 0 ? (
                <LevvEmptyState
                  icon={Users}
                  title="No approval groups yet"
                  action={<button type="button" onClick={openCreate} className={levvUi.primaryButton}><Plus /> New group</button>}
                >
                  Create a group for each team that signs off together, then name it as a step in an approval chain.
                </LevvEmptyState>
              ) : (
                <LevvEmptyState
                  icon={Search}
                  title="No groups match"
                  action={<button type="button" onClick={resetFilters} className={levvUi.secondaryButton}>Reset filters</button>}
                >
                  Try another name or member, or show every decision rule.
                </LevvEmptyState>
              )
            ) : (
              <>
                <ul className="levv-cq-list divide-y divide-[var(--line)] border-t-2 border-slate-950">
                  {visible.map((group) => (
                    <li key={group.id}>
                      <button type="button" onClick={() => openEdit(group)} className="flex w-full items-start gap-3 py-3.5 text-left outline-none hover:bg-[var(--surface-sunken)] focus-visible:bg-blue-50">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium text-slate-950">{group.name}</span>
                          <span className="mt-0.5 block truncate text-[13px] text-slate-500">{group.description || 'No description'}</span>
                          <span className="mt-2 flex flex-wrap items-center gap-2.5">
                            <span className="inline-flex items-stretch border border-slate-500 bg-[var(--surface)]">
                              <span aria-hidden className={`w-3.5 shrink-0 border-r border-slate-500 ${hatch(group)}`} />
                              <span className={`${levvUi.legend} px-2 py-0.5 text-slate-700`}>{ruleText(group)}</span>
                            </span>
                            {memberMarks(group)}
                            {chainUse === null ? null : (
                              <span className={`${levvUi.legend} text-slate-500`}>
                                In chains <span className="ml-1 font-semibold tabular-nums normal-case tracking-normal text-slate-950">{chainUse.get(group.id) ?? 0}</span>
                              </span>
                            )}
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="levv-cq-table relative overflow-x-auto">
                  <table className="w-full min-w-[700px] table-fixed">
                    <thead>
                      <tr>
                        <th className={levvUi.th}>Group</th>
                        <th className={`${levvUi.th} w-44`}>Decision rule</th>
                        <th className={`${levvUi.th} w-40`}>Members</th>
                        <th className={`${levvUi.th} w-24`}>In chains</th>
                        <th className={`${levvUi.th} w-10`}><span className="sr-only">Open</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((group) => (
                        <tr
                          key={group.id}
                          onClick={() => openEdit(group)}
                          className="group cursor-pointer hover:bg-[var(--surface-sunken)] [&>td]:border-b [&>td]:border-[var(--line)]"
                        >
                          <td className={levvUi.td}>
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); openEdit(group) }}
                              className="rounded text-left font-medium text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                            >
                              {group.name}
                            </button>
                            <p className="mt-0.5 truncate text-[13px] text-slate-500">{group.description || 'No description'}</p>
                          </td>
                          <td className={levvUi.td}>
                            <span className="inline-flex items-stretch border border-slate-500 bg-[var(--surface)]">
                              <span aria-hidden className={`w-3.5 shrink-0 border-r border-slate-500 ${hatch(group)}`} />
                              <span className={`${levvUi.legend} whitespace-nowrap px-2 py-1 text-slate-800`}>{ruleText(group)}</span>
                            </span>
                          </td>
                          <td className={levvUi.td}>
                            <span className="flex items-center gap-2">
                              {memberMarks(group)}
                              {group.members.length > 3 ? <span className="font-semibold tabular-nums text-[12px] text-slate-500">+{group.members.length - 3}</span> : null}
                            </span>
                          </td>
                          <td className={levvUi.td}>{inChains(group)}</td>
                          <td className={`${levvUi.td} text-right`}>
                            <ChevronRight aria-hidden className="ml-auto h-4 w-4 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Close editor" onClick={() => setEditorOpen(false)} className="absolute inset-0 bg-slate-950/30" />
          <section ref={editorRef} role="dialog" aria-modal="true" aria-labelledby="group-editor-title" className="relative flex h-full w-full max-w-[440px] flex-col bg-white shadow-[0_20px_44px_-12px_rgb(10_17_40/0.18),0_4px_10px_-4px_rgb(10_17_40/0.06)]">
            <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
              <div>
                <h2 id="group-editor-title" className="text-lg font-semibold text-slate-950">{draft.id ? 'Edit approval group' : 'New approval group'}</h2>
                <p className="mt-1 text-[13px] text-slate-500">Name the team, choose its members and how they decide.</p>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label="Close" className={`${levvUi.ghostButton} w-9 px-0`}><X /></button>
            </header>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className={levvUi.label}>Group name</span>
                  <input ref={nameRef} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. North America finance" className={levvUi.input} />
                </label>
                <label className="grid gap-1.5">
                  <span className={levvUi.label}>Description</span>
                  <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What this group reviews" rows={3} className={`${levvUi.input} h-auto resize-none py-2`} />
                </label>
              </div>
              <fieldset>
                <legend className={levvUi.label}>Decision rule</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([['any', 'Any one member', 'The first approval completes the step.'], ['all', 'All members', 'Every member must approve.']] as const).map(([value, label, help]) => (
                    <label key={value} className={`cursor-pointer rounded-lg border p-3 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent)] ${draft.decisionRule === value ? 'border-blue-600 bg-blue-50' : 'border-[var(--line-strong)] hover:bg-slate-50'}`}>
                      <input type="radio" name="decision-rule" value={value} checked={draft.decisionRule === value} onChange={() => setDraft({ ...draft, decisionRule: value })} className="sr-only" />
                      <span className="flex items-center justify-between text-[13px] font-semibold text-slate-900">{label}{draft.decisionRule === value && <Check className="h-4 w-4 text-blue-600" />}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{help}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <section>
                <div className="flex items-center justify-between">
                  <h3 className={levvUi.label}>Members</h3>
                  <span className="text-xs tabular-nums text-slate-500">{draft.members.length} selected</span>
                </div>
                <LevvSearchField className="mt-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" aria-label="Search people" />
                <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-[var(--line)]">
                  {loadingUsers && <p className="p-4 text-[13px] text-slate-500">Loading people…</p>}
                  {!loadingUsers && userOptions.length === 0 && <p className="p-4 text-[13px] text-slate-500">Nobody matches that search.</p>}
                  {userOptions.map((member) => {
                    const selected = draft.members.some((row) => row.id === member.id)
                    return (
                      <button key={member.id} type="button" aria-pressed={selected} onClick={() => toggleMember(member)} className="flex w-full items-center gap-3 border-b border-[var(--line)] px-3 py-2.5 text-left outline-none last:border-0 hover:bg-[var(--surface-sunken)] focus-visible:bg-blue-50">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-[var(--line-strong)]'}`}>{selected && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-slate-900">{member.name}</span>
                          <span className="block truncate text-xs text-slate-500">{member.email || member.title || 'No email'}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-6 py-4">
              {draft.id ? (
                <button type="button" onClick={() => remove(draft.id)} className={`${levvUi.dangerGhostButton} -ml-2`}>
                  <Trash2 /> Delete group
                </button>
              ) : (
                <p className="text-xs text-slate-500">A name and at least one member are required.</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditorOpen(false)} className={levvUi.secondaryButton}>Cancel</button>
                <button type="button" disabled={!draft.name.trim() || draft.members.length === 0} onClick={commit} className={levvUi.primaryButton}>Save group</button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </LevvPage>
  )
}
