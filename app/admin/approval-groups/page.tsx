'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react'
import {
  createApprovalGroupId,
  getApprovalGroups,
  saveApprovalGroups,
  type ApprovalGroup,
  type ApprovalGroupMember,
  type ApprovalGroupDecisionRule,
} from '@/lib/approvalGroups'
import { getApprovalChainApprovers } from '@/lib/api/approvalChains'

type GroupDraft = {
  id: string
  name: string
  description: string
  decisionRule: ApprovalGroupDecisionRule
  members: ApprovalGroupMember[]
}

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

export default function ApprovalGroupsPage() {
  const [groups, setGroups] = useState<ApprovalGroup[]>([])
  const [availableUsers, setAvailableUsers] = useState<ApprovalGroupMember[]>([])
  const [draft, setDraft] = useState<GroupDraft>(EMPTY_DRAFT)
  const [editorOpen, setEditorOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => setGroups(getApprovalGroups()), [])

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

  const userOptions = useMemo(() => {
    const map = new Map<string, ApprovalGroupMember>()
    groups.flatMap((group) => group.members).forEach((member) => map.set(member.id, member))
    availableUsers.forEach((member) => map.set(member.id, member))
    const needle = query.trim().toLowerCase()
    return Array.from(map.values())
      .filter((member) => !needle || `${member.name} ${member.email} ${member.title || ''}`.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [availableUsers, groups, query])

  const openCreate = () => {
    setDraft(EMPTY_DRAFT)
    setQuery('')
    setEditorOpen(true)
  }

  const openEdit = (group: ApprovalGroup) => {
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
    const updated = groups.filter((group) => group.id !== id)
    setGroups(updated)
    saveApprovalGroups(updated)
  }

  const toggleMember = (member: ApprovalGroupMember) => {
    setDraft((current) => ({
      ...current,
      members: current.members.some((row) => row.id === member.id)
        ? current.members.filter((row) => row.id !== member.id)
        : [...current.members, member],
    }))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">Settings</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Approval Groups</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Group users into reusable approval teams for approval chains and worker workflows.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
          <Plus className="h-4 w-4" /> Create approval group
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <article key={group.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Users className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-950">{group.name}</h2>
                  <p className="text-xs text-slate-500">{group.members.length} member{group.members.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => openEdit(group)} aria-label={`Edit ${group.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(group.id)} aria-label={`Delete ${group.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <p className="mt-4 min-h-10 text-sm leading-5 text-slate-600">{group.description || 'No description provided.'}</p>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex -space-x-2">
                {group.members.slice(0, 4).map((member) => (
                  <span key={member.id} title={member.name} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-[10px] font-bold text-white">{initials(member.name)}</span>
                ))}
                {group.members.length > 4 && <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-600">+{group.members.length - 4}</span>}
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{group.decisionRule === 'all' ? 'All must approve' : 'Any one can approve'}</span>
            </div>
          </article>
        ))}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Close editor" onClick={() => setEditorOpen(false)} className="absolute inset-0 bg-slate-950/40" />
          <section className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div><h2 className="text-xl font-semibold text-slate-950">{draft.id ? 'Edit approval group' : 'Create approval group'}</h2><p className="mt-1 text-sm text-slate-500">Choose the group details, members, and approval rule.</p></div>
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </header>
            <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <div className="grid gap-5">
                <label className="grid gap-1.5 text-sm font-medium text-slate-800">Group name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. North America Finance" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-800">Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What this group reviews" rows={3} className="resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold text-slate-900">Approval rule</legend>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {([['any', 'Any one member', 'The first approval completes the step.'], ['all', 'All members', 'Every member must approve.']] as const).map(([value, label, help]) => (
                    <label key={value} className={`cursor-pointer rounded-xl border p-4 ${draft.decisionRule === value ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200'}`}>
                      <input type="radio" name="decision-rule" value={value} checked={draft.decisionRule === value} onChange={() => setDraft({ ...draft, decisionRule: value })} className="sr-only" />
                      <span className="flex items-center justify-between text-sm font-semibold text-slate-900">{label}{draft.decisionRule === value && <Check className="h-4 w-4 text-blue-600" />}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{help}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <section>
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Members</h3><span className="text-xs text-slate-500">{draft.members.length} selected</span></div>
                <div className="relative mt-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
                <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                  {loadingUsers && <p className="p-4 text-sm text-slate-500">Loading users…</p>}
                  {!loadingUsers && userOptions.length === 0 && <p className="p-4 text-sm text-slate-500">No users found.</p>}
                  {userOptions.map((member) => {
                    const selected = draft.members.some((row) => row.id === member.id)
                    return <button key={member.id} type="button" onClick={() => toggleMember(member)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{member.name}</span><span className="block truncate text-xs text-slate-500">{member.email || member.title || 'No email'}</span></span></button>
                  })}
                </div>
              </section>
            </div>
            <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-4"><p className="text-xs text-slate-500">A name and at least one member are required.</p><div className="flex gap-3"><button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" disabled={!draft.name.trim() || draft.members.length === 0} onClick={commit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Save group</button></div></footer>
          </section>
        </div>
      )}
    </div>
  )
}
