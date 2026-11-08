'use client'

import { useEffect, useState, useMemo, type SelectHTMLAttributes } from 'react'
import {
  Cog, Zap, Link2, Plus, X, Search, Filter, Trash2,
  ArrowRight, RotateCcw, Users, Globe, Layers,
  AlertCircle, CheckCircle2, Sliders, Target, User, ChevronDown, Check,
  FileText, PenLine, Upload, CheckSquare,
} from 'lucide-react'
import RequiredIndicator from '@/components/ui/RequiredIndicator'
import { useLevvDialog } from '@/components/ui/levv-dialog'
import {
  LevvEmptyState,
  LevvPanel,
  LevvRecordHeader,
  LevvSearchField,
  LevvSelect,
  levvUi,
} from '@/components/ui/levv-app'
import WorkersTabs from '../WorkersTabs'
import {
  getRequirements,
  setRequirements as setStore,
  smartUnwind,
  composeAction,
  VERB_MODE,
  allowedApprovers,
  coerceApprover,
  approverLabel,
  applyApprover,
  currentApprover,
  resolvePeople,
  roleLabel,
  DIRECTORY,
  HUMAN_APPROVERS,
  NOVA_CHECKS,
  NOVA_CHECK_LABEL,
  UNWIND_VERBS,
  DOC_METHODS,
  docSummary,
  coerceDocument,
  type Unwind,
  type UnwindVerb,
  type Approver,
  type Person,
  type NovaCheckKind,
  type Requirement,
  type OwnerRole,
  type ApproverGroup,
  type UnwindCondition,
  type DocMethod,
  type RequirementDocument,
} from './requirementsStore'

/* ─────────────────────────────────────────
   CONFIG MAPS
───────────────────────────────────────── */
const OWNER_OPTIONS: OwnerRole[] = ['Worker', 'IT', 'Supplier', 'Hiring Manager', 'System']
const UNWIND_WHEN: UnwindCondition[] = ['on end-date', 'within 3 days of end-date', 'immediately on exit', 'on final invoice']
const WORKER_TYPES = ['Contingent', 'SOW', 'Staff-aug'] as const
const DOC_METHOD_ICON: Record<DocMethod, typeof PenLine> = { esign: PenLine, upload: Upload, acknowledge: CheckSquare }

/* ─────────────────────────────────────────
   PAGE
───────────────────────────────────────── */
export default function RequirementsPage() {
  // The library is saved in this browser: read it after mount so the server and the first client render agree.
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setRequirements(getRequirements()); setLoaded(true) }, [])
  const [selected, setSelected] = useState<Requirement | null>(null)
  const [search, setSearch] = useState('')
  const [filterOwner, setFilterOwner] = useState('all')
  const [filterStrategy, setFilterStrategy] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  const [newReq, setNewReq] = useState<{ name: string; owner: OwnerRole; approver: Approver }>({
    name: '', owner: 'Worker', approver: 'HR',
  })
  const [newUnwind, setNewUnwind] = useState<Unwind>(smartUnwind(''))
  const [unwindTouched, setUnwindTouched] = useState(false)
  const [addError, setAddError] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)

  // name infers the unwind default (category is derived silently, used later by the builder)
  const onNameChange = (name: string) => {
    setNewReq(r => ({ ...r, name })); setAddError('')
    if (!unwindTouched) setNewUnwind(smartUnwind(name))
  }
  const editUnwind = (patch: Partial<Unwind>) => { setUnwindTouched(true); setNewUnwind(u => ({ ...u, ...patch })) }
  const editVerb = (verb: UnwindVerb) => { setUnwindTouched(true); setNewUnwind(u => ({ ...u, verb, action: composeAction(verb, newReq.name), mode: VERB_MODE[verb] })) }
  const resetDraft = () => { setNewUnwind(smartUnwind('')); setUnwindTouched(false) }

  const commit = (next: Requirement[]) => { setRequirements(next); setStore(next) }

  const addRequirement = () => {
    const name = newReq.name.trim()
    if (!name) { setAddError('Requirement name is required'); return }
    if (requirements.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      setAddError('A requirement with this name already exists'); return
    }
    const { strategy, fallbackApprover } = applyApprover(newReq.approver)
    const req: Requirement = {
      id: crypto.randomUUID(),
      name,
      owner: newReq.owner,
      strategy,
      fallbackApprover,
      unwind: newUnwind,
      acceptedVariants: [],
    }
    commit([...requirements, req])
    setJustAdded(req.id)
    setTimeout(() => setJustAdded(null), 1600)
    setNewReq({ name: '', owner: 'Worker', approver: 'HR' })
    resetDraft()
    setAddError('')
  }

  const filtered = useMemo(() =>
    requirements.filter(r =>
      (!search || r.name.toLowerCase().includes(search.toLowerCase())) &&
      (filterOwner === 'all' || r.owner === filterOwner) &&
      (filterStrategy === 'all' || r.strategy === filterStrategy)
    ), [requirements, search, filterOwner, filterStrategy])

  const aiCount = requirements.filter(r => !!r.nova).length
  const thirdPartyCount = requirements.filter(r => r.strategy === 'third_party').length
  const activeFilters = [filterOwner !== 'all', filterStrategy !== 'all', !!search].filter(Boolean).length

  const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`
  const statement = !loaded
    ? 'Loading requirements…'
    : requirements.length === 0
    ? 'No requirements yet. Each requirement is defined once — how it’s satisfied and how it’s unwound.'
    : `${plural(requirements.length, 'requirement')}, each with an unwind step for offboarding. ${aiCount} ${aiCount === 1 ? 'is' : 'are'} Nova-assisted and ${thirdPartyCount} ${thirdPartyCount === 1 ? 'is' : 'are'} approved by a third-party integration.`

  return (
    <div className="space-y-6">
      <LevvRecordHeader
        trail="Admin settings / Workers"
        title="Requirement Library"
        statement={statement}
        figures={[
          { label: 'Total requirements', value: loaded ? requirements.length : '—' },
          { label: 'Nova-assisted', value: loaded ? aiCount : '—' },
          { label: '3rd party', value: loaded ? thirdPartyCount : '—' },
        ]}
      />

      <WorkersTabs />

      {/* ADD */}
      <LevvPanel className="p-5">
        <h2 className="text-[15px] font-semibold text-slate-950">New requirement</h2>
        <div className="mt-4 grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,220px)_auto]">
          <div className="grid gap-1.5">
            <label className="flex items-center">
              <span className={levvUi.label}>Requirement</span>
              <RequiredIndicator />
            </label>
            <input
              value={newReq.name}
              onChange={e => onNameChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRequirement()}
              className={`${levvUi.input} ${addError ? 'outline outline-1 -outline-offset-1 outline-[#c0392b]' : ''}`}
              placeholder="e.g. Background Check, Degree Verification…"
            />
          </div>
          <div className="grid gap-1.5">
            <label><span className={levvUi.label}>Actioned by</span></label>
            <LevvSelect value={newReq.owner} onChange={e => { const owner = e.target.value as OwnerRole; setNewReq(r => ({ ...r, owner, approver: coerceApprover(owner, r.approver) })) }}>
              {OWNER_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </LevvSelect>
          </div>
          <div className="grid gap-1.5">
            <label><span className={levvUi.label}>Approved by</span></label>
            <ApproverField value={newReq.approver} owner={newReq.owner} onChange={a => setNewReq({ ...newReq, approver: a })} />
          </div>
          <button className={levvUi.primaryButton} onClick={addRequirement}><Plus /> Add</button>
        </div>
        {addError && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[#a32f23]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{addError}
          </p>
        )}

        {/* unwind — auto-registered, editable inline, only once there's something to reverse */}
        {newReq.name.trim() ? (
          <div className="mt-4 flex flex-wrap items-center gap-2.5 border border-[var(--line)] border-l-2 border-l-slate-950 bg-[var(--surface-sunken)] px-3 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-slate-950 text-white"><RotateCcw className="h-3 w-3" /></span>
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-slate-800">
              At offboarding
              {!unwindTouched && <em title="Smart default — change anything" className={`border border-slate-400 px-1 not-italic ${levvUi.legend} text-[10px] text-slate-600`}>auto</em>}
            </span>
            <InlineSelect value={newUnwind.verb} onChange={e => editVerb(e.target.value as UnwindVerb)} title="What we do at exit">
              {UNWIND_VERBS.map(v => <option key={v}>{v}</option>)}
            </InlineSelect>
            <span aria-hidden className="text-slate-400">·</span>
            <RunBy u={newUnwind} onChange={editUnwind} />
            <span aria-hidden className="text-slate-400">·</span>
            <InlineSelect value={newUnwind.condition} onChange={e => editUnwind({ condition: e.target.value as Requirement['unwind']['condition'] })} title="When it fires">
              {UNWIND_WHEN.map(c => <option key={c}>{c}</option>)}
            </InlineSelect>
            <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[13px]" title="Confirm against source of truth">
              <input type="checkbox" className={CHECKBOX} checked={!!newUnwind.reconcile} onChange={e => editUnwind({ reconcile: e.target.checked })} />
              <span className="text-slate-700">reconcile</span>
            </label>
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-slate-500">
            <RotateCcw className="h-3.5 w-3.5 shrink-0" /> Name a requirement and LEVV registers its unwind automatically — reversed at offboarding.
          </p>
        )}
      </LevvPanel>

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid w-full gap-1.5 sm:w-72">
          <span className={levvUi.label}>Search</span>
          <LevvSearchField placeholder="Search requirements…" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <button className={`${levvUi.secondaryButton} ${showFilters ? 'bg-slate-100' : ''}`} aria-expanded={showFilters} onClick={() => setShowFilters(p => !p)}>
          <Filter /> Filters
          {activeFilters > 0 && <span className="flex h-4 min-w-4 items-center justify-center bg-slate-950 px-1 text-[10px] tabular-nums text-white">{activeFilters}</span>}
        </button>
        {activeFilters > 0 && (
          <button className={levvUi.ghostButton} onClick={() => { setFilterOwner('all'); setFilterStrategy('all'); setSearch('') }}>
            <X /> Clear
          </button>
        )}
        <span className="ml-auto pb-2 text-[13px] font-semibold tabular-nums text-slate-500">{loaded ? `${filtered.length}/${requirements.length}` : '—'}</span>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid w-full gap-1.5 sm:w-56">
            <span className={levvUi.label}>Owner</span>
            <LevvSelect value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
              <option value="all">All owners</option>
              {OWNER_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </LevvSelect>
          </label>
          <label className="grid w-full gap-1.5 sm:w-56">
            <span className={levvUi.label}>Validation strategy</span>
            <LevvSelect value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)}>
              <option value="all">All approvers</option>
              <option value="manual">Human review</option>
              <option value="third_party">Integration</option>
            </LevvSelect>
          </label>
        </div>
      )}

      {/* LIST — rows on the paper under one navy rule; stacked when the column is narrow */}
      <div className="levv-cq border-t-2 border-slate-950">
        {!loaded ? (
          <div aria-busy="true" aria-label="Loading requirements" className="divide-y divide-[var(--line)] border-b border-[var(--line)]">
            {[0, 1, 2].map(row => (
              <div key={row} className="flex items-center gap-6 px-3 py-5">
                <span className="h-3 w-48 bg-slate-100" />
                <span className="h-3 w-32 bg-slate-100" />
                <span className="h-3 w-40 bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <LevvEmptyState icon={Search} title={requirements.length === 0 ? 'No requirements yet' : 'No results'}>
            {requirements.length === 0 ? 'Add your first requirement above.' : 'Adjust your search or filters.'}
          </LevvEmptyState>
        ) : (
          ([false, true] as const).map(wide => (
            <ul key={String(wide)} className={`${wide ? 'levv-cq-table' : 'levv-cq-list'} divide-y divide-[var(--line)] border-b border-[var(--line)]`}>
              {filtered.map(req => (
                <RequirementRow
                  key={req.id}
                  req={req}
                  wide={wide}
                  justAdded={req.id === justAdded}
                  onConfigure={() => setSelected(req)}
                  onDelete={() => commit(requirements.filter(r => r.id !== req.id))}
                />
              ))}
            </ul>
          ))
        )}
      </div>

      {selected && (
        <ConfigModal
          requirement={selected}
          onClose={() => setSelected(null)}
          onSave={updates => { commit(requirements.map(r => r.id === selected.id ? { ...r, ...updates } : r)); setSelected(null) }}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────
   RECIPES — this page's small parts, in the world's terms
───────────────────────────────────────── */
const TAG = `inline-flex items-center gap-1 whitespace-nowrap border border-slate-400 px-1.5 py-px ${levvUi.legend} text-slate-600 [&_svg]:h-3 [&_svg]:w-3`
const CHECKBOX = 'h-4 w-4 shrink-0 cursor-pointer accent-blue-600'
const SECTION_TITLE = `flex flex-wrap items-center gap-1.5 ${levvUi.legend} text-slate-500 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-slate-400`
const HINT = 'text-[12px] font-normal normal-case tracking-normal text-slate-500'
const MINI_LABEL = `mb-1.5 block ${levvUi.label}`
const SEGMENTS = 'inline-flex border border-slate-950'
const segment = (on: boolean) =>
  `levv-press inline-flex h-8 items-center gap-1.5 whitespace-nowrap border-l border-slate-950 px-3 ${levvUi.legend} outline-none first:border-l-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] [&_svg]:h-3.5 [&_svg]:w-3.5 ${
    on ? 'bg-blue-600 text-white' : 'text-slate-800 hover:bg-slate-100'
  }`
const choice = (on: boolean) =>
  `levv-press border p-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
    on ? 'border-blue-600 bg-blue-50' : 'border-[var(--line-strong)] bg-[var(--surface)] hover:border-slate-500'
  }`
const checkMark = (on: boolean) =>
  `mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-500 bg-[var(--surface)]'}`

/* A compact select for the inline unwind strip. */
function InlineSelect({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative inline-flex">
      <select {...props} className="h-8 cursor-pointer appearance-none border border-[var(--line-strong)] bg-[var(--surface)] pl-2.5 pr-7 text-[13px] text-slate-900 outline-none">
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </span>
  )
}

/* Run-by — the loud Automated vs Manual choice for an unwind.
   Automated = Nova runs it (no human). Manual = lands in a team's queue. */
function RunBy({ u, onChange }: { u: { mode: 'automated' | 'manual'; owner: ApproverGroup }; onChange: (patch: { mode?: 'automated' | 'manual'; owner?: ApproverGroup }) => void }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={SEGMENTS}>
        <button className={segment(u.mode === 'automated')} aria-pressed={u.mode === 'automated'} onClick={() => onChange({ mode: 'automated' })} title="Nova runs it — no human needed">
          <Zap /> Automated
        </button>
        <button className={segment(u.mode === 'manual')} aria-pressed={u.mode === 'manual'} onClick={() => onChange({ mode: 'manual' })} title="A team does it">
          <User /> Manual
        </button>
      </span>
      {u.mode === 'automated' ? (
        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-700"><Zap className="h-3 w-3" /> Nova runs it</span>
      ) : (
        <InlineSelect value={u.owner} onChange={e => onChange({ owner: e.target.value as ApproverGroup })} title="Whose queue it lands in">
          {HUMAN_APPROVERS.map(o => <option key={o}>{o}</option>)}
        </InlineSelect>
      )}
    </span>
  )
}

function initials(name: string) { return name.split(' ').map(w => w[0]).slice(0, 2).join('') }

function Avatar({ p, size = 22 }: { p: Person; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center bg-slate-100 font-semibold text-slate-800" title={`${p.name} · ${p.title}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}>
      {initials(p.name)}
    </span>
  )
}
function AvatarStack({ people, max = 3 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max)
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {shown.map(p => <Avatar key={p.id} p={p} />)}
      {people.length > max && <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center bg-slate-100 px-0.5 text-[10px] font-semibold tabular-nums text-slate-600">+{people.length - max}</span>}
    </span>
  )
}

/* Approved by — a resolved ROLE, not a label. Shows who it currently lands on
   (live from the directory), pre-filled from the requirement, search-to-override. */
function ApproverField({ value, owner, onChange }: { value: Approver; owner: OwnerRole; onChange: (a: Approver) => void }) {
  const [open, setOpen] = useState(false)
  const allowed = allowedApprovers(owner)
  const humans = allowed.filter(a => a !== 'Integration') as ApproverGroup[]
  const hasIntegration = allowed.includes('Integration')
  const people = resolvePeople(value)
  const row = (on: boolean) =>
    `flex w-full items-center gap-2.5 px-2.5 py-2 text-left outline-none transition-colors duration-100 focus-visible:bg-blue-50 ${on ? 'bg-blue-50' : 'hover:bg-[var(--surface-sunken)]'}`

  return (
    <div className="relative w-full">
      <button className="flex min-h-9 w-full items-center gap-2.5 border border-[var(--line-strong)] bg-[var(--surface)] px-2.5 py-1 text-left outline-none transition-colors duration-150 hover:border-slate-500 focus-visible:border-[var(--accent)] focus-visible:shadow-[0_0_0_3px_var(--focus)]" onClick={() => setOpen(o => !o)}>
        {value === 'Integration' ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-800"><Link2 className="h-3.5 w-3.5" /> Integration</span>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <AvatarStack people={people} max={2} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold text-slate-950">{roleLabel(value)}</span>
              <span className="truncate text-[11px] text-slate-500">{people[0]?.name}{people.length > 1 ? ` +${people.length - 1}` : ''}</span>
            </span>
          </span>
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[81] max-h-[340px] min-w-[280px] overflow-y-auto border border-slate-950 bg-[var(--surface)] p-1">
            <div className="flex items-baseline justify-between gap-3 px-2.5 pb-1.5 pt-2">
              <span className="text-[13px] font-semibold text-slate-950">Who renders the verdict</span>
              <span className={`${levvUi.legend} text-[10px] text-slate-500`}>resolves to live people</span>
            </div>
            {hasIntegration && (
              <button className={row(value === 'Integration')} onClick={() => { onChange('Integration'); setOpen(false) }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-slate-950 text-white"><Link2 className="h-3.5 w-3.5" /></span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-semibold text-slate-950">Integration</span>
                  <span className="truncate text-[12px] text-slate-500">External system returns a pass/fail · no person</span>
                </span>
                {value === 'Integration' && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
              </button>
            )}
            {humans.length > 0 && <div className={`px-2.5 pb-1 pt-2.5 ${levvUi.legend} text-slate-500`}>Roles</div>}
            {humans.map(role => {
              const ppl = DIRECTORY[role].people
              return (
                <button key={role} className={row(value === role)} onClick={() => { onChange(role); setOpen(false) }}>
                  <AvatarStack people={ppl} max={3} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-semibold text-slate-950">{DIRECTORY[role].role}</span>
                    <span className="truncate text-[12px] text-slate-500">{ppl.map(p => p.name).join(', ')}</span>
                  </span>
                  {value === role && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────
   ROW — what it is, how it's approved on entry, how it unwinds on exit
───────────────────────────────────────── */
function RequirementRow({ req, wide, justAdded, onConfigure, onDelete }: {
  req: Requirement; wide: boolean; justAdded: boolean; onConfigure: () => void; onDelete: () => void
}) {
  const scoped = req.applicability?.workerTypes?.length
    ? `${req.applicability.workerTypes.join(' / ')} only` : null
  const variants = req.acceptedVariants?.length ? req.acceptedVariants.map(v => v.label).join(' · ') : null
  const ap = currentApprover(req)
  const ppl = resolvePeople(ap)

  return (
    <li className={`grid items-start gap-x-5 gap-y-3 px-3 py-4 transition-colors duration-300 ${justAdded ? 'bg-blue-50' : 'hover:bg-[var(--surface)]'} ${
      wide ? 'grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]'
    }`}>
      <div className={`min-w-0 ${wide ? '' : 'col-start-1 row-start-1'}`}>
        <h3 className="text-[15px] font-semibold leading-snug text-slate-950">{req.name}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={TAG}>{req.owner}</span>
          <span className={TAG}>{approverLabel(ap)}</span>
          {req.document && (
            <span className={TAG}>
              <PenLine /> {req.document.method === 'acknowledge' ? 'Acknowledge' : 'Sign & return'}
            </span>
          )}
        </div>
        <div className="mt-2 space-y-1 text-[13px] text-slate-500">
          <p className="flex flex-wrap items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" /> applies to:
            {scoped ? <span className={TAG}>{scoped}</span> : <strong className="font-medium text-slate-800">All workers</strong>}
          </p>
          {variants && (
            <p className="flex items-start gap-1.5">
              <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>accepts: <strong className="font-medium text-slate-800">{variants}</strong> (any one)</span>
            </p>
          )}
          {req.document && (
            <p className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" /> <strong className="font-medium text-slate-800">{docSummary(req.document)}</strong>
            </p>
          )}
        </div>
      </div>

      {/* entry: who approves */}
      <div className={`min-w-0 border-l border-[var(--line-strong)] pl-3 ${wide ? '' : 'col-span-2'}`}>
        <p className={`flex items-center gap-1.5 ${levvUi.label}`}><ArrowRight className="h-3.5 w-3.5 shrink-0" /> On entry · approved by</p>
        {ap === 'Integration'
          ? <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-slate-800"><Link2 className="h-3.5 w-3.5" /> Integration</p>
          : <div className="mt-1.5 flex items-center gap-2">
              <AvatarStack people={ppl} max={3} />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[13px] font-semibold text-slate-950">{roleLabel(ap)}</span>
                <span className="truncate text-[12px] text-slate-500">{ppl.map(p => p.name).join(', ')}</span>
              </span>
            </div>}
        {req.nova && req.nova.checks.length > 0 && (
          <div className="mt-2 flex items-start gap-2">
            <span className={TAG}><Zap /> Nova</span>
            <span className="text-[13px] leading-snug text-slate-600">
              pre-checks {req.nova.checks.map(c => NOVA_CHECK_LABEL[c].toLowerCase()).join(', ')} → {roleLabel(ap)} confirms
            </span>
          </div>
        )}
      </div>

      {/* exit: how it unwinds */}
      <div className={`min-w-0 border-l-2 border-slate-950 pl-3 ${wide ? '' : 'col-span-2'}`}>
        <p className={`flex items-center gap-1.5 ${levvUi.legend} text-slate-950`}><RotateCcw className="h-3.5 w-3.5 shrink-0" /> On exit · unwind</p>
        <p className="mt-1.5 text-[13px] font-medium text-slate-800">{req.unwind.action}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-slate-500">
          {req.unwind.mode === 'automated'
            ? <span className="inline-flex items-center gap-1 font-medium text-slate-800"><Zap className="h-3 w-3" /> Nova</span>
            : <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {req.unwind.owner}</span>}
          <span className="text-slate-700">{req.unwind.condition}</span>
          {req.unwind.reconcile && <span className={`${levvUi.legend} text-[10px] text-slate-600`}>reconciled</span>}
        </p>
      </div>

      <div className={`flex gap-1 ${wide ? '' : 'col-start-2 row-start-1'}`}>
        <button className={levvUi.iconButton} onClick={onConfigure} title="Configure" aria-label={`Configure ${req.name}`}><Cog /></button>
        <button className={levvUi.dangerIconButton} onClick={onDelete} title="Delete" aria-label={`Delete ${req.name}`}><Trash2 /></button>
      </div>
    </li>
  )
}

/* ─────────────────────────────────────────
   CONFIG MODAL — unified, real DSL, unwind, scope, variants
───────────────────────────────────────── */
function ConfigModal({ requirement, onClose, onSave }: {
  requirement: Requirement; onClose: () => void; onSave: (u: Partial<Requirement>) => void
}) {
  const [r, setR] = useState<Requirement>(JSON.parse(JSON.stringify(requirement)))
  const set = (patch: Partial<Requirement>) => setR(prev => ({ ...prev, ...patch }))
  const setUnwind = (patch: Partial<Requirement['unwind']>) => setR(prev => ({ ...prev, unwind: { ...prev.unwind, ...patch } }))

  // document exchange — the fulfillment axis
  const enableDoc = (on: boolean) => set({ document: on ? { template: { name: r.name, version: 'v1' }, method: 'esign', capturesReturn: true } : undefined })
  const patchDoc = (patch: Partial<RequirementDocument>) =>
    setR(prev => prev.document ? { ...prev, document: coerceDocument({ ...prev.document, ...patch }) } : prev)

  const workerType = r.applicability?.workerTypes?.[0] ?? 'ALL'
  const setScope = (v: string) =>
    set({ applicability: v === 'ALL' ? undefined : { ...r.applicability, workerTypes: [v as typeof WORKER_TYPES[number]] } })

  const [variantInput, setVariantInput] = useState('')
  const addVariant = () => {
    const label = variantInput.trim(); if (!label) return
    set({ acceptedVariants: [...(r.acceptedVariants ?? []), { id: crypto.randomUUID(), label }] })
    setVariantInput('')
  }
  const removeVariant = (id: string) => set({ acceptedVariants: (r.acceptedVariants ?? []).filter(v => v.id !== id) })

  const toggleNova = (on: boolean) => set({ nova: on ? { checks: ['doc_type'] } : undefined })
  const toggleCheck = (kind: NovaCheckKind) => {
    const cur = r.nova?.checks ?? []
    const next = cur.includes(kind) ? cur.filter(k => k !== kind) : [...cur, kind]
    set({ nova: { checks: next } })
  }

  const dialogRef = useLevvDialog<HTMLDivElement>(true, onClose)

  const option = (on: boolean) =>
    `flex cursor-pointer items-center gap-2.5 border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 ${on ? '' : 'opacity-60'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="requirement-config-title" tabIndex={-1} className="flex max-h-[88vh] outline-none w-full max-w-[560px] flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)] shadow-[0_20px_44px_-12px_rgb(10_17_40/0.18),0_4px_10px_-4px_rgb(10_17_40/0.06)]">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
          <Sliders className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <h2 id="requirement-config-title" className="text-lg font-semibold leading-tight text-slate-950">{requirement.name}</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">How it&apos;s satisfied, scoped, and unwound</p>
          </div>
          <button className={`${levvUi.iconButton} ml-auto`} onClick={onClose} aria-label="Close"><X /></button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          {/* actioned by + approved by */}
          <section>
            <p className={`${SECTION_TITLE} mb-2.5`}><Target /> Actioned &amp; approved</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={MINI_LABEL}>Actioned by</span>
                <LevvSelect value={r.owner} onChange={e => {
                  const owner = e.target.value as OwnerRole
                  const approver = coerceApprover(owner, currentApprover(r))
                  set({ owner, ...applyApprover(approver) })
                }}>
                  {OWNER_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </LevvSelect>
              </div>
              <div>
                <span className={MINI_LABEL}>Approved by</span>
                <ApproverField value={currentApprover(r)} owner={r.owner} onChange={a => set({ ...applyApprover(a) })} />
              </div>
            </div>
            {r.owner === 'System' && (
              <p className="mt-2.5 flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-2 text-[13px] text-slate-700"><Cog className="h-3.5 w-3.5 shrink-0 text-slate-500" /> System-owned — only an integration can approve it. No human review.</p>
            )}
          </section>

          {/* applicability */}
          <section>
            <p className={`${SECTION_TITLE} mb-2.5`}><Globe /> Applies to</p>
            <LevvSelect value={workerType} onChange={e => setScope(e.target.value)}>
              <option value="ALL">All workers</option>
              {WORKER_TYPES.map(t => <option key={t} value={t}>{t} only</option>)}
            </LevvSelect>
          </section>

          {/* document exchange — the fulfillment axis */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className={SECTION_TITLE}><FileText /> Document exchange <span className={HINT}>supply a form · worker signs · return</span></p>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
                <input type="checkbox" className={CHECKBOX} checked={!!r.document} onChange={e => enableDoc(e.target.checked)} />
                <span className={`${levvUi.legend} text-slate-700`}>{r.document ? 'On' : 'Off'}</span>
              </label>
            </div>
            {r.document && (
              <>
                <label className={option(true)}>
                  <input type="checkbox" className={CHECKBOX} checked={!!r.document.template} onChange={e => patchDoc({ template: e.target.checked ? { name: r.name, version: 'v1' } : null })} />
                  <span className="text-[13px] text-slate-700"><strong className="font-semibold text-slate-950">Customer provides a template</strong> — attach a form for the worker; off = worker brings their own</span>
                </label>
                {r.document.template && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className={MINI_LABEL}>Template</span>
                      <input className={levvUi.input} value={r.document.template.name} placeholder="e.g. Mutual NDA"
                        onChange={e => patchDoc({ template: { name: e.target.value, version: r.document!.template!.version } })} />
                    </div>
                    <div>
                      <span className={MINI_LABEL}>Version</span>
                      <input className={levvUi.input} value={r.document.template.version} placeholder="v1"
                        onChange={e => patchDoc({ template: { name: r.document!.template!.name, version: e.target.value } })} />
                    </div>
                  </div>
                )}
                <div>
                  <span className={MINI_LABEL}>Worker completes by</span>
                  <div className={SEGMENTS}>
                    {DOC_METHODS.map(m => {
                      const Ic = DOC_METHOD_ICON[m.kind]
                      const on = r.document!.method === m.kind
                      return (
                        <button key={m.kind} className={segment(on)} aria-pressed={on} onClick={() => patchDoc({ method: m.kind })} title={m.desc}>
                          <Ic /> {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <label className={option(r.document.method !== 'acknowledge')}>
                  <input type="checkbox" className={CHECKBOX} checked={!!r.document.capturesReturn} disabled={r.document.method === 'acknowledge'} onChange={e => patchDoc({ capturesReturn: e.target.checked })} />
                  <span className="text-[13px] text-slate-700"><strong className="font-semibold text-slate-950">Capture returned copy</strong> — {r.document.method === 'acknowledge' ? 'records a timestamped acknowledgment instead of a file' : 'store the signed / completed artifact as evidence'}</span>
                </label>
                <p className="flex items-center gap-1.5 text-[13px] text-slate-500"><FileText className="h-3.5 w-3.5 shrink-0" /> {docSummary(r.document)} → {roleLabel(currentApprover(r))} validates</p>
              </>
            )}
          </section>

          {/* accepted variants */}
          <section>
            <p className={`${SECTION_TITLE} mb-2.5`}><Layers /> Accepted documents <span className={HINT}>any one satisfies</span></p>
            <div className="mb-2 flex min-h-[38px] flex-wrap gap-1.5 border border-[var(--line)] bg-[var(--surface-sunken)] p-1.5">
              {(r.acceptedVariants ?? []).map(v => (
                <span key={v.id} className="inline-flex items-center gap-1 border border-[var(--line-strong)] bg-[var(--surface)] py-0.5 pl-2 pr-0.5 text-[12px] font-medium text-slate-800">
                  {v.label}
                  <button className="inline-flex h-5 w-5 items-center justify-center text-slate-500 outline-none hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-[var(--accent)]" aria-label={`Remove ${v.label}`} onClick={() => removeVariant(v.id)}><X className="h-3 w-3" /></button>
                </span>
              ))}
              {(r.acceptedVariants ?? []).length === 0 && <span className="px-1 py-0.5 text-[13px] text-slate-500">None — a single submission satisfies</span>}
            </div>
            <div className="flex gap-2">
              <input className={levvUi.input} placeholder="e.g. Passport" value={variantInput}
                onChange={e => setVariantInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addVariant()} />
              <button className={levvUi.secondaryButton} onClick={addVariant}><Plus /> Add</button>
            </div>
          </section>

          {/* THE WEDGE — unwind plan */}
          <section className="flex flex-col gap-3 border border-[var(--line)] border-l-2 border-l-slate-950 bg-[var(--surface-sunken)] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-slate-950 text-white"><RotateCcw className="h-4 w-4" /></span>
              <div>
                <p className="text-[14px] font-semibold text-slate-950">On exit · unwind plan</p>
                <p className="text-[12px] text-slate-500">Registered now, so offboarding runs itself in reverse</p>
              </div>
            </div>
            <div>
              <span className={MINI_LABEL}>At offboarding we will…</span>
              <div className="grid grid-cols-2 gap-2">
                <LevvSelect value={r.unwind.verb} onChange={e => { const verb = e.target.value as UnwindVerb; setUnwind({ verb, action: composeAction(verb, r.name), mode: VERB_MODE[verb] }) }}>
                  {UNWIND_VERBS.map(v => <option key={v}>{v}</option>)}
                </LevvSelect>
                <div className="flex h-9 min-w-0 items-center border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-slate-700"><span className="truncate">{r.unwind.action}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className={choice(r.unwind.mode === 'automated')} aria-pressed={r.unwind.mode === 'automated'} onClick={() => setUnwind({ mode: 'automated' })}>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-950"><Zap className="h-3.5 w-3.5 shrink-0" /> Automated — Nova runs it</span>
                <span className="mt-1 block text-[12px] leading-snug text-slate-500">Nova triggers the integration at offboarding. No human in the loop.</span>
              </button>
              <button className={choice(r.unwind.mode === 'manual')} aria-pressed={r.unwind.mode === 'manual'} onClick={() => setUnwind({ mode: 'manual' })}>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-950"><User className="h-3.5 w-3.5 shrink-0" /> Manual — a team does it</span>
                <span className="mt-1 block text-[12px] leading-snug text-slate-500">Lands in a team&apos;s queue (e.g. IT collects the laptop).</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={MINI_LABEL}>{r.unwind.mode === 'automated' ? 'Accountable team' : 'Runs in queue of'}</span>
                <LevvSelect value={r.unwind.owner} onChange={e => setUnwind({ owner: e.target.value as ApproverGroup })}>
                  {HUMAN_APPROVERS.map(o => <option key={o}>{o}</option>)}
                </LevvSelect>
              </div>
              <div>
                <span className={MINI_LABEL}>When it fires</span>
                <LevvSelect value={r.unwind.condition} onChange={e => setUnwind({ condition: e.target.value as UnwindCondition })}>
                  {UNWIND_WHEN.map(c => <option key={c}>{c}</option>)}
                </LevvSelect>
              </div>
            </div>
            <label className={option(true)}>
              <input type="checkbox" className={CHECKBOX} checked={!!r.unwind.reconcile} onChange={e => setUnwind({ reconcile: e.target.checked })} />
              <span className="text-[13px] text-slate-700"><strong className="font-semibold text-slate-950">Reconcile</strong> — confirm against the source of truth, not fire-and-forget</span>
            </label>
          </section>

          {/* Nova pre-check — OPTIONAL. Nova runs concrete checks first and
              flags; the human approval group still renders the verdict. */}
          {r.strategy === 'manual' && (() => {
            const ap = currentApprover(r)
            const ppl = resolvePeople(ap)
            return (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className={SECTION_TITLE}><Zap /> Nova pre-check <span className={HINT}>optional · runs before {roleLabel(ap)}</span></p>
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
                    <input type="checkbox" className={CHECKBOX} checked={!!r.nova} onChange={e => toggleNova(e.target.checked)} />
                    <span className={`${levvUi.legend} text-slate-700`}>{r.nova ? 'On' : 'Off'}</span>
                  </label>
                </div>
                {r.nova && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {NOVA_CHECKS.map(c => {
                        const on = r.nova!.checks.includes(c.kind)
                        return (
                          <button key={c.kind} className={`${choice(on)} flex items-start gap-2.5`} aria-pressed={on} onClick={() => toggleCheck(c.kind)}>
                            <span className={checkMark(on)}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                            <span className="flex min-w-0 flex-col">
                              <span className="text-[13px] font-semibold text-slate-950">{c.label}</span>
                              <span className="mt-0.5 text-[12px] leading-snug text-slate-500">{c.desc}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* the flow: square marks on a rule — Nova screens → group confirms */}
                    <div className="px-1 pt-2">
                      <div className="flex items-center">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-[var(--rail)] text-[var(--nova)]"><Zap className="h-4 w-4" /></span>
                        <span className="relative h-px flex-1 bg-slate-500">
                          <span className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-[var(--line-strong)] bg-[var(--surface)] text-slate-600"><ArrowRight className="h-3 w-3" /></span>
                        </span>
                        {ap === 'Integration'
                          ? <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-slate-950 text-white"><Link2 className="h-4 w-4" /></span>
                          : <span className="relative flex h-11 w-11 shrink-0 items-center justify-center border border-slate-950 bg-[var(--surface)] text-[15px] font-semibold text-slate-950">
                              {initials(ppl[0]?.name ?? '?')}
                              {ppl.length > 1 && <span className="absolute -bottom-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center bg-slate-950 px-0.5 text-[10px] font-semibold tabular-nums text-white">+{ppl.length - 1}</span>}
                            </span>}
                      </div>
                      <div className="mt-2.5 flex justify-between gap-4">
                        <div className="max-w-[46%] text-left">
                          <p className="text-[13px] font-semibold text-slate-950">Nova pre-checks</p>
                          <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{r.nova.checks.length ? `${r.nova.checks.length} check${r.nova.checks.length > 1 ? 's' : ''}` : 'no checks'}</p>
                        </div>
                        <div className="max-w-[46%] text-right">
                          <p className="text-[13px] font-semibold text-slate-950">{roleLabel(ap)}</p>
                          <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{ap === 'Integration' ? 'returns pass/fail' : ppl.map(p => p.name).join(', ')}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-500">Nova reads &amp; flags only — it never approves. {roleLabel(ap)} makes the call.</p>
                  </>
                )}
              </section>
            )
          })()}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-4">
          <button className={levvUi.secondaryButton} onClick={onClose}>Cancel</button>
          <button className={levvUi.primaryButton} onClick={() => onSave(r)}><CheckCircle2 /> Save requirement</button>
        </div>
      </div>
    </div>
  )
}
