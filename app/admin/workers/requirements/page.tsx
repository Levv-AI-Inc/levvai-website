'use client'

import { useState, useMemo } from 'react'
import {
  Cog, Zap, Link2, Clock, Plus, X, Search, Filter,
  ShieldCheck, ArrowRight, RotateCcw, Users, Globe, Layers,
  AlertCircle, CheckCircle2, Sliders, Trash2, Target, User, ChevronDown, Check,
  FileText, PenLine, Upload, CheckSquare,
} from 'lucide-react'
import {
  getRequirements,
  setRequirements as setStore,
  smartUnwind,
  composeAction,
  VERB_MODE,
  unwindRunner,
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
  type Nova,
  type NovaCheckKind,
  type Requirement,
  type ValidationStrategy,
  type OwnerRole,
  type ApproverGroup,
  type UnwindCondition,
  type DocMethod,
  type RequirementDocument,
} from './requirementsStore'

/* ─────────────────────────────────────────
   CONFIG MAPS
───────────────────────────────────────── */
const OWNER_CONFIG: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  Worker:           { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  Supplier:         { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  'Hiring Manager': { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff', dot: '#a855f7' },
  IT:               { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#f97316' },
  System:           { bg: '#f8fafc', color: '#475569', border: '#cbd5e1', dot: '#94a3b8' },
}

const STRATEGY_LABEL: Record<ValidationStrategy, string> = {
  manual: 'Human review',
  third_party: 'Integration',
}
const PRIMARY_LABEL: Record<ValidationStrategy, string> = {
  manual: 'Human review',
  third_party: 'Integration',
}

const OWNER_OPTIONS: OwnerRole[] = ['Worker', 'IT', 'Supplier', 'Hiring Manager', 'System']
const APPROVER_OPTIONS: ApproverGroup[] = ['HR', 'LEGAL', 'IT', 'FINANCE', 'SECURITY', 'PROCUREMENT']
const UNWIND_OWNER_OPTIONS = ['HR', 'IT', 'LEGAL', 'SECURITY', 'PROCUREMENT', 'FINANCE', 'System']
const UNWIND_WHEN: UnwindCondition[] = ['on end-date', 'within 3 days of end-date', 'immediately on exit', 'on final invoice']
const WORKER_TYPES = ['Contingent', 'SOW', 'Staff-aug'] as const
const DOC_METHOD_ICON: Record<DocMethod, typeof PenLine> = { esign: PenLine, upload: Upload, acknowledge: CheckSquare }

/* ─────────────────────────────────────────
   PAGE
───────────────────────────────────────── */
export default function RequirementsPage() {
  const [requirements, setRequirements] = useState<Requirement[]>(getRequirements())
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

  return (
    <>
      <style>{css}</style>

      <div className="rp-root">
        {/* HEADER */}
        <div className="rp-page-hd">
          <div className="rp-breadcrumb">
            <span>Catalog</span>
            <ArrowRight size={11} />
            <span>Requirement Library</span>
          </div>
          <h1 className="rp-title">Requirement Library</h1>
          <p className="rp-subtitle">
            Each requirement is defined once — how it&apos;s satisfied <strong>and how it&apos;s unwound</strong>.
            Offboarding reads the unwind side; it is never authored separately.
          </p>
        </div>

        {/* STATS */}
        <div className="rp-stats">
          <Stat dot="#0a0a0a" value={requirements.length} label="Total requirements" />
          <Stat dot="var(--ink)" value={requirements.length} label="Reversible · unwind set" mono />
          <Stat dot="var(--accent)" value={aiCount} label="Nova-assisted" />
          <Stat dot="#3b82f6" value={thirdPartyCount} label="3rd party" />
        </div>

        {/* ADD */}
        <div className="rp-add-card">
          <div className="rp-add-title"><Plus size={11} /> New requirement</div>
          <div className="rp-add-row">
            <div className="rp-field-wrap">
              <label className="rp-add-lbl">Requirement</label>
              <input
                value={newReq.name}
                onChange={e => onNameChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRequirement()}
                className={`rp-input ${addError ? 'err' : ''}`}
                placeholder="e.g. Background Check, Degree Verification…"
              />
              {addError && <span className="rp-error"><AlertCircle size={10} />{addError}</span>}
            </div>
            <div className="rp-field-wrap">
              <label className="rp-add-lbl">Actioned by</label>
              <select value={newReq.owner} onChange={e => { const owner = e.target.value as OwnerRole; setNewReq(r => ({ ...r, owner, approver: coerceApprover(owner, r.approver) })) }} className="rp-select">
                {OWNER_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="rp-field-wrap">
              <label className="rp-add-lbl">Approved by</label>
              <ApproverField value={newReq.approver} owner={newReq.owner} onChange={a => setNewReq({ ...newReq, approver: a })} />
            </div>
            <button className="rp-add-btn" onClick={addRequirement}><Plus size={14} /> Add</button>
          </div>

          {/* unwind — auto-registered, editable inline, only once there's something to reverse */}
          {newReq.name.trim() ? (
            <div className="rp-unwind-edit">
              <span className="chip-ink"><RotateCcw size={11} /></span>
              <span className="rp-ue-label">
                At offboarding
                {!unwindTouched && <em title="Smart default — change anything">auto</em>}
              </span>
              <select className="rp-ue-verb" value={newUnwind.verb} onChange={e => editVerb(e.target.value as UnwindVerb)} title="What we do at exit">
                {UNWIND_VERBS.map(v => <option key={v}>{v}</option>)}
              </select>
              <span className="rp-ue-sep">·</span>
              <RunBy u={newUnwind} onChange={editUnwind} />
              <span className="rp-ue-sep">·</span>
              <select className="rp-ue-sel" value={newUnwind.condition} onChange={e => editUnwind({ condition: e.target.value as Requirement['unwind']['condition'] })} title="When it fires">
                {UNWIND_WHEN.map(c => <option key={c}>{c}</option>)}
              </select>
              <label className="rp-ue-recon" title="Confirm against source of truth">
                <input type="checkbox" checked={!!newUnwind.reconcile} onChange={e => editUnwind({ reconcile: e.target.checked })} />
                reconcile
              </label>
            </div>
          ) : (
            <div className="rp-unwind-hint">
              <RotateCcw size={11} /> Name a requirement and LEVV registers its unwind automatically — reversed at offboarding.
            </div>
          )}
        </div>

        {/* TOOLBAR */}
        <div className="rp-toolbar">
          <div className="rp-search-wrap">
            <Search className="rp-search-icon" size={14} />
            <input className="rp-search" placeholder="Search requirements…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className={`rp-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(p => !p)}>
            <Filter size={13} /> Filters
            {activeFilters > 0 && <span className="rp-filter-badge">{activeFilters}</span>}
          </button>
          {activeFilters > 0 && (
            <button className="rp-btn-ghost" onClick={() => { setFilterOwner('all'); setFilterStrategy('all'); setSearch('') }}>
              <X size={11} /> Clear
            </button>
          )}
          <span className="rp-count">{filtered.length}/{requirements.length}</span>
        </div>

        {showFilters && (
          <div className="rp-filter-panel">
            <div className="rp-filter-group">
              <label className="rp-filter-label">Owner</label>
              <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="rp-select">
                <option value="all">All owners</option>
                {OWNER_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="rp-filter-group">
              <label className="rp-filter-label">Validation strategy</label>
              <select value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)} className="rp-select">
                <option value="all">All approvers</option>
                <option value="manual">Human review</option>
                <option value="third_party">Integration</option>
              </select>
            </div>
          </div>
        )}

        {/* GRID */}
        {filtered.length === 0 ? (
          <div className="rp-empty">
            <div className="rp-empty-icon"><Search size={20} /></div>
            <h3>{requirements.length === 0 ? 'No requirements yet' : 'No results'}</h3>
            <p>{requirements.length === 0 ? 'Add your first requirement above.' : 'Adjust your search or filters.'}</p>
          </div>
        ) : (
          <div className="rp-grid">
            {filtered.map(req => (
              <RequirementCard
                key={req.id}
                req={req}
                justAdded={req.id === justAdded}
                onConfigure={() => setSelected(req)}
                onDelete={() => commit(requirements.filter(r => r.id !== req.id))}
              />
            ))}
          </div>
        )}

        {selected && (
          <ConfigModal
            requirement={selected}
            onClose={() => setSelected(null)}
            onSave={updates => { commit(requirements.map(r => r.id === selected.id ? { ...r, ...updates } : r)); setSelected(null) }}
          />
        )}
      </div>
    </>
  )
}

/* approver dropdown options, grouped and filtered by owner */
function ApproverOptions({ owner }: { owner: OwnerRole }) {
  const allowed = allowedApprovers(owner)
  const autos = allowed.filter(a => a === 'Integration')
  const humans = allowed.filter(a => a !== 'Integration')
  return (
    <>
      {autos.length > 0 && (
        <optgroup label="Automated">
          {autos.map(a => <option key={a} value={a}>{approverLabel(a)}</option>)}
        </optgroup>
      )}
      {humans.length > 0 && (
        <optgroup label="People">
          {humans.map(a => <option key={a} value={a}>{a}</option>)}
        </optgroup>
      )}
    </>
  )
}

/* Run-by — the loud Automated vs Manual choice for an unwind.
   Automated = Nova runs it (no human). Manual = lands in a team's queue. */
function RunBy({ u, onChange }: { u: { mode: 'automated' | 'manual'; owner: ApproverGroup }; onChange: (patch: { mode?: 'automated' | 'manual'; owner?: ApproverGroup }) => void }) {
  return (
    <span className="rp-runby">
      <span className="rp-rb-seg">
        <button className={`rp-rb ${u.mode === 'automated' ? 'on auto' : ''}`} onClick={() => onChange({ mode: 'automated' })} title="Nova runs it — no human needed">
          <Zap size={11} /> Automated
        </button>
        <button className={`rp-rb ${u.mode === 'manual' ? 'on' : ''}`} onClick={() => onChange({ mode: 'manual' })} title="A team does it">
          <User size={11} /> Manual
        </button>
      </span>
      {u.mode === 'automated' ? (
        <span className="rp-rb-runner auto"><Zap size={10} /> Nova runs it</span>
      ) : (
        <select className="rp-ue-sel" value={u.owner} onChange={e => onChange({ owner: e.target.value as ApproverGroup })} title="Whose queue it lands in">
          {HUMAN_APPROVERS.map(o => <option key={o}>{o}</option>)}
        </select>
      )}
    </span>
  )
}

/* deterministic avatar color from a name */
const AVA_COLORS = ['#0e7490', '#7c3aed', '#be185d', '#b45309', '#15803d', '#1d4ed8', '#9333ea', '#0891b2']
function initials(name: string) { return name.split(' ').map(w => w[0]).slice(0, 2).join('') }
function avaColor(name: string) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVA_COLORS[h % AVA_COLORS.length] }

function Avatar({ p, size = 22 }: { p: Person; size?: number }) {
  return (
    <span className="rp-ava" title={`${p.name} · ${p.title}`}
      style={{ width: size, height: size, background: avaColor(p.name), fontSize: size * 0.4 }}>
      {initials(p.name)}
    </span>
  )
}
function AvatarStack({ people, max = 3 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max)
  return (
    <span className="rp-ava-stack">
      {shown.map(p => <Avatar key={p.id} p={p} />)}
      {people.length > max && <span className="rp-ava more">+{people.length - max}</span>}
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

  return (
    <div className="rp-apf">
      <button className="rp-apf-trigger" onClick={() => setOpen(o => !o)}>
        {value === 'Integration' ? (
          <span className="rp-apf-int"><Link2 size={13} /> Integration</span>
        ) : (
          <span className="rp-apf-resolved">
            <AvatarStack people={people} max={2} />
            <span className="rp-apf-txt">
              <span className="rp-apf-role">{roleLabel(value)}</span>
              <span className="rp-apf-who">{people[0]?.name}{people.length > 1 ? ` +${people.length - 1}` : ''}</span>
            </span>
          </span>
        )}
        <ChevronDown size={14} className="rp-apf-chev" />
      </button>
      {open && (
        <>
          <div className="rp-apf-back" onClick={() => setOpen(false)} />
          <div className="rp-apf-panel">
            <div className="rp-apf-hd">Who renders the verdict <span>resolves to live people</span></div>
            {hasIntegration && (
              <button className={`rp-apf-row ${value === 'Integration' ? 'on' : ''}`} onClick={() => { onChange('Integration'); setOpen(false) }}>
                <span className="rp-apf-sys"><Link2 size={14} /></span>
                <span className="rp-apf-rowmain">
                  <span className="rp-apf-rowrole">Integration</span>
                  <span className="rp-apf-rowsub">External system returns a pass/fail · no person</span>
                </span>
                {value === 'Integration' && <Check size={15} className="rp-apf-ck" />}
              </button>
            )}
            {humans.length > 0 && <div className="rp-apf-sec">Roles</div>}
            {humans.map(role => {
              const ppl = DIRECTORY[role].people
              return (
                <button key={role} className={`rp-apf-row ${value === role ? 'on' : ''}`} onClick={() => { onChange(role); setOpen(false) }}>
                  <AvatarStack people={ppl} max={3} />
                  <span className="rp-apf-rowmain">
                    <span className="rp-apf-rowrole">{DIRECTORY[role].role}</span>
                    <span className="rp-apf-rowsub">{ppl.map(p => p.name).join(', ')}</span>
                  </span>
                  {value === role && <Check size={15} className="rp-apf-ck" />}
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
   STAT
───────────────────────────────────────── */
function Stat({ dot, value, label, mono }: { dot: string; value: number; label: string; mono?: boolean }) {
  return (
    <div className="rp-stat">
      <div className="rp-stat-ind" style={{ background: dot }} />
      <div className="rp-stat-val">{value}</div>
      <div className="rp-stat-lbl">{label}</div>
    </div>
  )
}

/* ─────────────────────────────────────────
   CARD — with On entry / On exit lifecycle
───────────────────────────────────────── */
function RequirementCard({ req, justAdded, onConfigure, onDelete }: {
  req: Requirement; justAdded: boolean; onConfigure: () => void; onDelete: () => void
}) {
  const oc = OWNER_CONFIG[req.owner] ?? OWNER_CONFIG.System
  const scoped = req.applicability?.workerTypes?.length
    ? `${req.applicability.workerTypes.join(' / ')} only` : null
  const variants = req.acceptedVariants?.length ? req.acceptedVariants.map(v => v.label).join(' · ') : null

  return (
    <div className={`rp-card ${justAdded ? 'just-added' : ''}`}>
      <div className={`rp-card-bar ${req.nova ? 'nova' : req.strategy}`} />
      <div className="rp-card-body">
        <div className="rp-card-hd">
          <div className="rp-card-name">{req.name}</div>
          <button className="rp-icon-btn" onClick={onConfigure} title="Configure"><Cog size={14} /></button>
          <button className="rp-icon-btn del" onClick={onDelete} title="Delete"><X size={13} /></button>
        </div>

        <div className="rp-tags">
          <span className="rp-tag" style={{ background: oc.bg, color: oc.color, borderColor: oc.border }}>
            <span className="rp-dot" style={{ background: oc.dot }} />{req.owner}
          </span>
          <span className="rp-tag" style={{ background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }}>
            {approverLabel(currentApprover(req))}
          </span>
          {req.document && (
            <span className="rp-tag rp-tag-doc">
              <PenLine size={9} /> {req.document.method === 'acknowledge' ? 'Acknowledge' : 'Sign & return'}
            </span>
          )}
        </div>

        <div className="rp-applies">
          <Users size={11} /> applies to:&nbsp;
          {scoped ? <span className="rp-scoped">{scoped}</span> : <strong>All workers</strong>}
        </div>
        {variants && (
          <div className="rp-applies">
            <Layers size={11} /> accepts:&nbsp;<strong>{variants}</strong>&nbsp;<span style={{ color: 'var(--ink-muted)' }}>(any one)</span>
          </div>
        )}
        {req.document && (
          <div className="rp-applies">
            <FileText size={11} /> <strong>{docSummary(req.document)}</strong>
          </div>
        )}

        {/* lifecycle: entry (validate) → exit (unwind) */}
        <div className="rp-life">
          <div className="rp-life-row entry">
            <div className="rp-life-glyph entry"><ArrowRight size={13} /></div>
            <div className="rp-life-main">
              <div className="rp-life-lbl">On entry · approved by</div>
              {(() => {
                const ap = currentApprover(req)
                const ppl = resolvePeople(ap)
                return ap === 'Integration'
                  ? <div className="rp-life-val"><Link2 size={12} /> Integration</div>
                  : <div className="rp-life-approver">
                      <AvatarStack people={ppl} max={3} />
                      <span className="rp-life-approver-txt">
                        <span className="rp-life-role">{roleLabel(ap)}</span>
                        <span className="rp-life-people">{ppl.map(p => p.name).join(', ')}</span>
                      </span>
                    </div>
              })()}
            </div>
          </div>
          <div className="rp-life-row exit">
            <div className="rp-life-glyph exit"><RotateCcw size={13} /></div>
            <div className="rp-life-main">
              <div className="rp-life-lbl exit">On exit · unwind</div>
              <div className="rp-life-val">{req.unwind.action}</div>
            </div>
            <div className="rp-life-meta">
              {req.unwind.mode === 'automated'
                ? <span className="rp-run-auto"><Zap size={9} /> Nova</span>
                : <span className="rp-run-manual"><User size={9} /> {req.unwind.owner}</span>}
              <span className="rp-when">{req.unwind.condition}</span>
              {req.unwind.reconcile && <span className="rp-reconcile-tag">reconciled</span>}
            </div>
          </div>
        </div>

        {req.nova && req.nova.checks.length > 0 && (
          <div className="rp-nova">
            <span className="rp-ai-badge"><Zap size={9} /> Nova</span>
            <span className="rp-nova-txt">
              pre-checks {req.nova.checks.map(c => NOVA_CHECK_LABEL[c].toLowerCase()).join(', ')} → {roleLabel(currentApprover(req))} confirms
            </span>
          </div>
        )}
      </div>
    </div>
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

  return (
    <div className="rp-ov" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rp-modal">
        <div className="rp-modal-hd">
          <div className="rp-modal-icon"><Sliders size={16} /></div>
          <div>
            <div className="rp-modal-title">{requirement.name}</div>
            <div className="rp-modal-sub">How it&apos;s satisfied, scoped, and unwound</div>
          </div>
          <button className="rp-modal-x" onClick={onClose}><X size={13} /></button>
        </div>

        <div className="rp-modal-body">
          {/* actioned by + approved by */}
          <section>
            <div className="rp-sec-title"><Target size={11} /> Actioned &amp; approved</div>
            <div className="rp-two">
              <div>
                <span className="rp-mini-lbl">Actioned by</span>
                <select className="rp-mfield" value={r.owner} onChange={e => {
                  const owner = e.target.value as OwnerRole
                  const approver = coerceApprover(owner, currentApprover(r))
                  set({ owner, ...applyApprover(approver) })
                }}>
                  {OWNER_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <span className="rp-mini-lbl">Approved by</span>
                <ApproverField value={currentApprover(r)} owner={r.owner} onChange={a => set({ ...applyApprover(a) })} />
              </div>
            </div>
            {r.owner === 'System' && (
              <div className="rp-sys-note"><Cog size={11} /> System-owned — only an integration can approve it. No human review.</div>
            )}
          </section>

          {/* applicability */}
          <section>
            <div className="rp-sec-title"><Globe size={11} /> Applies to</div>
            <select className="rp-mfield" value={workerType} onChange={e => setScope(e.target.value)}>
              <option value="ALL">All workers</option>
              {WORKER_TYPES.map(t => <option key={t} value={t}>{t} only</option>)}
            </select>
          </section>

          {/* document exchange — the fulfillment axis */}
          <section className="rp-doc-sec">
            <div className="rp-nova-head">
              <div className="rp-sec-title" style={{ margin: 0 }}><FileText size={11} /> Document exchange <span className="rp-sec-hint">supply a form · worker signs · return</span></div>
              <label className="rp-nova-switch">
                <input type="checkbox" checked={!!r.document} onChange={e => enableDoc(e.target.checked)} />
                <span>{r.document ? 'On' : 'Off'}</span>
              </label>
            </div>
            {r.document && (
              <>
                <label className="rp-reconcile">
                  <input type="checkbox" checked={!!r.document.template} onChange={e => patchDoc({ template: e.target.checked ? { name: r.name, version: 'v1' } : null })} />
                  <span><strong>Customer provides a template</strong> — attach a form for the worker; off = worker brings their own</span>
                </label>
                {r.document.template && (
                  <div className="rp-two">
                    <div>
                      <span className="rp-mini-lbl">Template</span>
                      <input className="rp-mfield" value={r.document.template.name} placeholder="e.g. Mutual NDA"
                        onChange={e => patchDoc({ template: { name: e.target.value, version: r.document!.template!.version } })} />
                    </div>
                    <div>
                      <span className="rp-mini-lbl">Version</span>
                      <input className="rp-mfield" value={r.document.template.version} placeholder="v1"
                        onChange={e => patchDoc({ template: { name: r.document!.template!.name, version: e.target.value } })} />
                    </div>
                  </div>
                )}
                <div>
                  <span className="rp-mini-lbl">Worker completes by</span>
                  <div className="rp-rb-seg rp-doc-methods">
                    {DOC_METHODS.map(m => {
                      const Ic = DOC_METHOD_ICON[m.kind]
                      return (
                        <button key={m.kind} className={`rp-rb ${r.document!.method === m.kind ? 'on auto' : ''}`} onClick={() => patchDoc({ method: m.kind })} title={m.desc}>
                          <Ic size={11} /> {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <label className={`rp-reconcile ${r.document.method === 'acknowledge' ? 'disabled' : ''}`}>
                  <input type="checkbox" checked={!!r.document.capturesReturn} disabled={r.document.method === 'acknowledge'} onChange={e => patchDoc({ capturesReturn: e.target.checked })} />
                  <span><strong>Capture returned copy</strong> — {r.document.method === 'acknowledge' ? 'records a timestamped acknowledgment instead of a file' : 'store the signed / completed artifact as evidence'}</span>
                </label>
                <div className="rp-nova-note"><FileText size={11} /> {docSummary(r.document)} → {roleLabel(currentApprover(r))} validates</div>
              </>
            )}
          </section>

          {/* accepted variants */}
          <section>
            <div className="rp-sec-title"><Layers size={11} /> Accepted documents <span className="rp-sec-hint">any one satisfies</span></div>
            <div className="rp-variant-row">
              {(r.acceptedVariants ?? []).map(v => (
                <span key={v.id} className="rp-variant">
                  {v.label}
                  <button onClick={() => removeVariant(v.id)}><X size={10} /></button>
                </span>
              ))}
              {(r.acceptedVariants ?? []).length === 0 && <span className="rp-variant-empty">None — a single submission satisfies</span>}
            </div>
            <div className="rp-variant-add">
              <input className="rp-mfield" placeholder="e.g. Passport" value={variantInput}
                onChange={e => setVariantInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addVariant()} />
              <button className="rp-mini-btn" onClick={addVariant}><Plus size={12} /> Add</button>
            </div>
          </section>

          {/* THE WEDGE — unwind plan */}
          <section className="rp-unwind-sec">
            <div className="rp-unwind-head">
              <div className="rp-unwind-glyph"><RotateCcw size={15} /></div>
              <div>
                <div className="rp-unwind-t">On exit · unwind plan</div>
                <div className="rp-unwind-s">Registered now, so offboarding runs itself in reverse</div>
              </div>
            </div>
            <div>
              <span className="rp-mini-lbl">At offboarding we will…</span>
              <div className="rp-two">
                <select className="rp-mfield" value={r.unwind.verb} onChange={e => { const verb = e.target.value as UnwindVerb; setUnwind({ verb, action: composeAction(verb, r.name), mode: VERB_MODE[verb] }) }}>
                  {UNWIND_VERBS.map(v => <option key={v}>{v}</option>)}
                </select>
                <div className="rp-unwind-readout">{r.unwind.action}</div>
              </div>
            </div>
            <div className="rp-runby-modes">
              <button className={`rp-nova-mode ${r.unwind.mode === 'automated' ? 'on' : ''}`} onClick={() => setUnwind({ mode: 'automated' })}>
                <div className="rp-nova-mode-t"><Zap size={12} /> Automated — Nova runs it</div>
                <div className="rp-nova-mode-d">Nova triggers the integration at offboarding. No human in the loop.</div>
              </button>
              <button className={`rp-nova-mode ${r.unwind.mode === 'manual' ? 'on' : ''}`} onClick={() => setUnwind({ mode: 'manual' })}>
                <div className="rp-nova-mode-t"><User size={12} /> Manual — a team does it</div>
                <div className="rp-nova-mode-d">Lands in a team's queue (e.g. IT collects the laptop).</div>
              </button>
            </div>
            <div className="rp-two">
              <div>
                <span className="rp-mini-lbl">{r.unwind.mode === 'automated' ? 'Accountable team' : 'Runs in queue of'}</span>
                <select className="rp-mfield" value={r.unwind.owner} onChange={e => setUnwind({ owner: e.target.value as ApproverGroup })}>
                  {HUMAN_APPROVERS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <span className="rp-mini-lbl">When it fires</span>
                <select className="rp-mfield" value={r.unwind.condition} onChange={e => setUnwind({ condition: e.target.value as UnwindCondition })}>
                  {UNWIND_WHEN.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <label className="rp-reconcile">
              <input type="checkbox" checked={!!r.unwind.reconcile} onChange={e => setUnwind({ reconcile: e.target.checked })} />
              <span><strong>Reconcile</strong> — confirm against the source of truth, not fire-and-forget</span>
            </label>
          </section>

          {/* Nova pre-check — OPTIONAL. Nova runs concrete checks first and
              flags; the human approval group still renders the verdict. */}
          {r.strategy === 'manual' && (() => {
            const ap = currentApprover(r)
            const ppl = resolvePeople(ap)
            return (
              <section className="rp-nova-sec">
                <div className="rp-nova-head">
                  <div className="rp-sec-title" style={{ margin: 0 }}><Zap size={11} /> Nova pre-check <span className="rp-sec-hint">optional · runs before {roleLabel(ap)}</span></div>
                  <label className="rp-nova-switch">
                    <input type="checkbox" checked={!!r.nova} onChange={e => toggleNova(e.target.checked)} />
                    <span>{r.nova ? 'On' : 'Off'}</span>
                  </label>
                </div>
                {r.nova && (
                  <>
                    <div className="rp-nova-checks">
                      {NOVA_CHECKS.map(c => {
                        const on = r.nova!.checks.includes(c.kind)
                        return (
                          <button key={c.kind} className={`rp-check ${on ? 'on' : ''}`} onClick={() => toggleCheck(c.kind)}>
                            <span className="rp-check-box">{on && <Check size={11} />}</span>
                            <span className="rp-check-main">
                              <span className="rp-check-t">{c.label}</span>
                              <span className="rp-check-d">{c.desc}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* the flow: round nodes on a connector — Nova screens → group confirms */}
                    <div className="rp-flow2">
                      <div className="rp-flow2-rail">
                        <div className="rp-flow2-node nova"><Zap size={17} /></div>
                        <div className="rp-flow2-line"><span className="rp-flow2-arrow"><ArrowRight size={12} /></span></div>
                        {ap === 'Integration'
                          ? <div className="rp-flow2-node human int"><Link2 size={17} /></div>
                          : <div className="rp-flow2-node human" style={{ background: avaColor(ppl[0]?.name ?? 'X') }}>
                              {initials(ppl[0]?.name ?? '?')}
                              {ppl.length > 1 && <span className="rp-flow2-badge">+{ppl.length - 1}</span>}
                            </div>}
                      </div>
                      <div className="rp-flow2-caps">
                        <div className="rp-flow2-cap left">
                          <div className="rp-flow2-t">Nova pre-checks</div>
                          <div className="rp-flow2-s">{r.nova.checks.length ? `${r.nova.checks.length} check${r.nova.checks.length > 1 ? 's' : ''}` : 'no checks'}</div>
                        </div>
                        <div className="rp-flow2-cap right">
                          <div className="rp-flow2-t">{roleLabel(ap)}</div>
                          <div className="rp-flow2-s">{ap === 'Integration' ? 'returns pass/fail' : ppl.map(p => p.name).join(', ')}</div>
                        </div>
                      </div>
                    </div>
                    <div className="rp-nova-note">Nova reads &amp; flags only — it never approves. {roleLabel(ap)} makes the call.</div>
                  </>
                )}
              </section>
            )
          })()}
        </div>

        <div className="rp-modal-ft">
          <button className="rp-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="rp-btn-save" onClick={() => onSave(r)}><CheckCircle2 size={13} /> Save requirement</button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   STYLES — DM Sans, teal system, monochrome unwind
───────────────────────────────────────── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
.rp-root *{box-sizing:border-box}
.rp-root{
  --bg:#f8f9fb;--surface:#fff;--surface-raised:#f3f4f6;--border:#e5e7eb;--border-strong:#d1d5db;
  --ink:#0a0a0a;--ink-soft:#374151;--ink-muted:#9ca3af;
  --accent:#007a8a;--accent-soft:rgba(0,122,138,.07);--accent-mid:rgba(0,122,138,.14);--accent-border:rgba(0,122,138,.28);
  --red:#dc2626;--red-soft:#fef2f2;--red-border:#fecaca;
  --amber:#b45309;--amber-soft:#fffbeb;--amber-border:#fde68a;
  --green:#047857;--green-soft:#ecfdf5;--green-border:#a7f3d0;
  --exit-tint:#f5f4f2;
  --mono:'DM Mono',monospace;
  --sh-sm:0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.04);
  --sh-md:0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.04);
  --r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;
  font-family:'DM Sans',sans-serif;min-height:100vh;background:var(--bg);padding:32px;color:var(--ink);
}
.rp-page-hd{margin-bottom:24px}
.rp-breadcrumb{font-size:11px;color:var(--ink-muted);margin-bottom:6px;display:flex;align-items:center;gap:5px}
.rp-title{font-size:22px;font-weight:700;letter-spacing:-.3px}
.rp-subtitle{font-size:13px;color:var(--ink-muted);margin-top:3px;line-height:1.5;max-width:640px}
.rp-subtitle strong{color:var(--ink-soft);font-weight:600}
/* stats */
.rp-stats{display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap}
.rp-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:13px 18px;display:flex;flex-direction:column;gap:2px;box-shadow:var(--sh-sm);min-width:124px}
.rp-stat-ind{width:8px;height:8px;border-radius:50%;margin-bottom:4px}
.rp-stat-val{font-size:22px;font-weight:700;font-family:var(--mono);line-height:1}
.rp-stat-lbl{font-size:11px;color:var(--ink-muted);font-weight:500}
/* add */
.rp-add-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);padding:18px 22px;margin-bottom:18px;box-shadow:var(--sh-sm)}
.rp-add-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-muted);margin-bottom:13px;display:flex;align-items:center;gap:6px}
.rp-add-row{display:grid;grid-template-columns:1fr 150px 180px auto;gap:10px;align-items:end}
.rp-add-lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted);display:block;margin-bottom:5px}
.rp-field-wrap{display:flex;flex-direction:column;gap:4px}
.rp-input,.rp-select{height:38px;padding:0 12px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-raised);font-size:13px;color:var(--ink);font-family:'DM Sans',sans-serif;outline:none;transition:all .15s;width:100%}
.rp-input:focus,.rp-select:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid);background:#fff}
.rp-input.err{border-color:var(--red);box-shadow:0 0 0 3px rgba(220,38,38,.1)}
.rp-error{font-size:11px;color:var(--red);display:flex;align-items:center;gap:4px}
.rp-add-btn{height:38px;padding:0 20px;border-radius:var(--r-sm);border:none;background:#0a0a0a;color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;white-space:nowrap}
.rp-add-btn:hover{background:var(--accent);box-shadow:0 4px 12px rgba(0,122,138,.25);transform:translateY(-1px)}
.rp-unwind-hint{margin-top:11px;padding:9px 13px;border-radius:var(--r-sm);background:var(--surface-raised);border:1px dashed var(--border-strong);display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ink-muted)}
.rp-unwind-edit{margin-top:11px;padding:10px 12px;border-radius:var(--r-sm);background:var(--exit-tint);border:1px solid var(--border-strong);border-left:2px solid var(--ink);display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.rp-ue-label{font-size:11px;font-weight:600;color:var(--ink-soft);display:flex;align-items:center;gap:6px;white-space:nowrap}
.rp-ue-label em{font-style:normal;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-muted);background:#fff;border:1px solid var(--border);border-radius:4px;padding:1px 5px}
.rp-ava-stack{display:inline-flex;align-items:center}
.rp-ava-stack .rp-ava:not(:first-child){margin-left:-7px}
.rp-ava{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:700;font-family:'DM Sans',sans-serif;border:1.5px solid #fff;flex-shrink:0;letter-spacing:-.02em}
.rp-ava.more{width:22px;height:22px;background:var(--surface-raised);color:var(--ink-soft);font-size:9px;border:1.5px solid #fff}
.rp-apf{position:relative;width:100%}
.rp-apf-trigger{width:100%;min-height:42px;display:flex;align-items:center;gap:9px;padding:6px 11px;border-radius:10px;border:1px solid var(--border);background:#fff;cursor:pointer;font-family:'DM Sans',sans-serif;text-align:left;transition:border-color .12s}
.rp-apf-trigger:hover{border-color:var(--border-strong)}
.rp-apf-int{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--ink-soft)}
.rp-apf-resolved{display:inline-flex;align-items:center;gap:9px;flex:1;min-width:0}
.rp-apf-txt{display:flex;flex-direction:column;min-width:0}
.rp-apf-role{font-size:12.5px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-apf-who{font-size:10.5px;color:var(--ink-muted);font-family:'DM Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-apf-chev{margin-left:auto;color:var(--ink-muted);flex-shrink:0}
.rp-apf-back{position:fixed;inset:0;z-index:80}
.rp-apf-panel{position:absolute;top:calc(100% + 6px);left:0;right:0;min-width:300px;z-index:81;background:#fff;border:1px solid var(--border-strong);border-radius:14px;box-shadow:0 16px 40px rgba(10,10,10,.16);padding:7px;max-height:340px;overflow-y:auto}
.rp-apf-hd{padding:8px 10px 4px;font-size:11px;font-weight:700;color:var(--ink-soft);display:flex;justify-content:space-between;align-items:baseline}
.rp-apf-hd span{font-size:9.5px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.04em}
.rp-apf-sec{padding:8px 10px 3px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted)}
.rp-apf-row{width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border:none;background:none;border-radius:9px;cursor:pointer;text-align:left;transition:background .1s}
.rp-apf-row:hover{background:var(--surface-raised)}
.rp-apf-row.on{background:var(--accent-soft)}
.rp-apf-sys{width:30px;height:30px;border-radius:8px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rp-apf-rowmain{display:flex;flex-direction:column;min-width:0;flex:1}
.rp-apf-rowrole{font-size:12.5px;font-weight:700;color:var(--ink)}
.rp-apf-rowsub{font-size:10.5px;color:var(--ink-muted);font-family:'DM Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-apf-ck{color:var(--accent);flex-shrink:0}
.rp-life-approver{display:flex;align-items:center;gap:8px;margin-top:2px}
.rp-life-approver-txt{display:flex;flex-direction:column;min-width:0}
.rp-life-role{font-size:12px;font-weight:700;color:var(--ink);line-height:1.2}
.rp-life-people{font-size:10px;color:var(--ink-muted);font-family:'DM Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.rp-ue-verb{height:32px;padding:0 10px;border-radius:7px;border:1px solid var(--ink);background:var(--ink);color:#fff;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;outline:none;cursor:pointer}
.rp-runby{display:inline-flex;align-items:center;gap:8px}
.rp-rb-seg{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#fff}
.rp-rb{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 11px;border:none;background:#fff;color:var(--ink-muted);font-size:11px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all .12s}
.rp-rb+.rp-rb{border-left:1px solid var(--border)}
.rp-rb.on{color:var(--ink);background:var(--surface-raised)}
.rp-rb.on.auto{background:var(--accent);color:#fff}
.rp-rb-runner.auto{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--accent);font-family:'DM Mono',monospace}
.rp-runby-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rp-run-auto{display:inline-flex;align-items:center;gap:3px;color:var(--accent);font-weight:600}
.rp-run-manual{display:inline-flex;align-items:center;gap:3px}
.rp-ue-sep{color:var(--ink-muted);font-size:13px}
.rp-ue-action{flex:1;min-width:160px;height:32px;padding:0 10px;border-radius:7px;border:1px solid var(--border);background:#fff;font-size:12px;color:var(--ink);font-family:'DM Sans',sans-serif;outline:none}
.rp-unwind-readout{height:36px;display:flex;align-items:center;padding:0 11px;border-radius:8px;border:1px dashed var(--border-strong);background:#fff;font-size:12px;color:var(--ink-soft);font-family:'DM Mono',monospace;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.rp-tag-cat{background:#fff;color:var(--ink);border-color:var(--ink)!important;font-weight:700}
.rp-tag-doc{background:var(--accent-soft);color:var(--accent);border-color:var(--accent-border)!important}
.rp-ue-action:focus{border-color:var(--ink);box-shadow:0 0 0 3px rgba(10,10,10,.06)}
.chip-ink{width:22px;height:22px;border-radius:6px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rp-ue-sel{height:32px;padding:0 8px;border-radius:7px;border:1px solid var(--border);background:#fff;font-size:11px;color:var(--ink-soft);font-family:'DM Mono',monospace;outline:none;cursor:pointer}
.rp-ue-sel:focus{border-color:var(--ink)}
.rp-ue-recon{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--ink-soft);font-family:'DM Mono',monospace;cursor:pointer;white-space:nowrap}
.rp-ue-recon input{accent-color:var(--ink);width:14px;height:14px;cursor:pointer}
/* toolbar */
.rp-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.rp-search-wrap{position:relative;flex:1;max-width:340px}
.rp-search{width:100%;height:36px;padding:0 12px 0 34px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface);font-size:13px;color:var(--ink);font-family:'DM Sans',sans-serif;outline:none}
.rp-search:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid)}
.rp-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--ink-muted)}
.rp-filter-btn{height:36px;padding:0 14px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface);font-size:12px;font-weight:500;color:var(--ink-soft);cursor:pointer;display:flex;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;position:relative}
.rp-filter-btn:hover,.rp-filter-btn.active{border-color:var(--accent-border);color:var(--accent);background:var(--accent-soft)}
.rp-filter-badge{position:absolute;top:-5px;right:-5px;width:16px;height:16px;border-radius:50%;background:var(--accent);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center}
.rp-btn-ghost{height:36px;padding:0 14px;border-radius:var(--r-sm);border:1px solid var(--border-strong);background:#fff;font-size:12px;font-weight:500;color:var(--ink-soft);cursor:pointer;font-family:'DM Sans',sans-serif;display:inline-flex;align-items:center;gap:5px}
.rp-btn-ghost:hover{border-color:var(--accent-border);color:var(--accent);background:var(--accent-soft)}
.rp-count{font-size:12px;color:var(--ink-muted);font-weight:500;font-family:var(--mono);margin-left:auto}
.rp-filter-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:14px;box-shadow:var(--sh-sm)}
.rp-filter-group{display:flex;flex-direction:column;gap:5px}
.rp-filter-label{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-muted)}
/* grid + card */
.rp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.rp-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;transition:all .2s cubic-bezier(.4,0,.2,1);box-shadow:var(--sh-sm)}
.rp-card:hover{box-shadow:var(--sh-md);transform:translateY(-2px);border-color:var(--border-strong)}
.rp-card.just-added{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid),var(--sh-md)}
.rp-card-bar{height:3px;width:100%}
.rp-card-bar.manual{background:var(--border-strong)}
.rp-card-bar.ai_extraction{background:linear-gradient(90deg,var(--accent),#00b8cc)}
.rp-card-bar.nova{background:linear-gradient(90deg,var(--accent),#00b8cc)}
.rp-card-bar.third_party{background:linear-gradient(90deg,#3b82f6,#6366f1)}
.rp-card-body{padding:15px 16px}
.rp-card-hd{display:flex;align-items:flex-start;gap:8px;margin-bottom:11px}
.rp-card-name{font-size:14px;font-weight:700;line-height:1.3;flex:1}
.rp-icon-btn{width:30px;height:30px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-muted);transition:all .15s;flex-shrink:0}
.rp-icon-btn:hover{border-color:var(--accent-border);color:var(--accent);background:var(--accent-soft)}
.rp-icon-btn.del:hover{border-color:var(--red-border);color:var(--red);background:var(--red-soft)}
.rp-tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
.rp-tag{font-size:10px;font-weight:600;padding:3px 9px;border-radius:100px;border:1px solid;display:flex;align-items:center;gap:4px}
.rp-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;display:inline-block}
.rp-applies{font-size:10.5px;color:var(--ink-muted);margin-bottom:8px;display:flex;align-items:center;gap:4px}
.rp-applies strong{color:var(--ink-soft);font-weight:600}
.rp-scoped{color:var(--amber);background:var(--amber-soft);border:1px solid var(--amber-border);border-radius:5px;padding:1px 6px;font-weight:600}
/* lifecycle */
.rp-life{border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;margin-top:4px}
.rp-life-row{display:flex;align-items:center;gap:9px;padding:9px 11px}
.rp-life-row.entry{background:var(--surface-raised)}
.rp-life-row.exit{background:var(--exit-tint);border-top:1px solid var(--border);border-left:2px solid var(--ink)}
.rp-life-glyph{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rp-life-glyph.entry{background:#fff;border:1px solid var(--border);color:var(--ink-soft)}
.rp-life-glyph.exit{background:var(--ink);color:#fff}
.rp-life-main{flex:1;min-width:0}
.rp-life-lbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-muted);margin-bottom:1px}
.rp-life-lbl.exit{color:var(--ink)}
.rp-life-val{font-size:11.5px;font-weight:600;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-life-meta{font-size:10px;color:var(--ink-muted);font-family:var(--mono);flex-shrink:0;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:1px}
.rp-life-meta>span{display:block}
.rp-when{color:var(--ink-soft)}
.rp-reconcile-tag{color:var(--green);font-family:'DM Sans';font-weight:600;font-size:9px}
/* ai */
.rp-ai{margin-top:11px}
.rp-ai-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.rp-ai-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:100px;background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);font-size:10px;font-weight:600}
.rp-ai-rules{font-size:10px;color:var(--ink-muted)}
.rp-conf-lbl{font-size:10px;color:var(--ink-muted);display:flex;justify-content:space-between;margin-bottom:4px}
.rp-conf-track{height:4px;background:var(--border);border-radius:2px;overflow:hidden}
.rp-conf-fill{height:100%;background:linear-gradient(90deg,var(--accent),#00b8cc);border-radius:2px}
/* document exchange */
.rp-doc-sec{display:flex;flex-direction:column;gap:10px}
.rp-doc-methods{display:inline-flex}
.rp-reconcile.disabled{opacity:.55}
/* empty */
.rp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:10px;background:#fff;border:1px solid var(--border);border-radius:var(--r-xl)}
.rp-empty-icon{width:52px;height:52px;border-radius:14px;background:var(--surface-raised);border:2px dashed var(--border-strong);display:flex;align-items:center;justify-content:center;color:var(--ink-muted)}
.rp-empty h3{font-size:14px;font-weight:600;color:var(--ink-soft)}
.rp-empty p{font-size:12px;color:var(--ink-muted)}
/* modal */
.rp-ov{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(10,10,10,.5);backdrop-filter:blur(5px);padding:16px}
.rp-modal{width:100%;max-width:560px;background:#fff;border-radius:22px;box-shadow:0 24px 60px rgba(0,0,0,.18);overflow:hidden;max-height:88vh;display:flex;flex-direction:column}
.rp-modal-hd{padding:18px 22px;border-bottom:1px solid var(--border);background:var(--surface-raised);display:flex;align-items:center;gap:12px}
.rp-modal-icon{width:36px;height:36px;border-radius:10px;background:var(--accent-soft);border:1px solid var(--accent-border);display:flex;align-items:center;justify-content:center;color:var(--accent)}
.rp-modal-title{font-size:15px;font-weight:700}
.rp-modal-sub{font-size:12px;color:var(--ink-muted);margin-top:1px}
.rp-modal-x{margin-left:auto;width:28px;height:28px;border:1px solid var(--border);background:#fff;border-radius:7px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-muted)}
.rp-modal-x:hover{background:var(--red-soft);color:var(--red);border-color:var(--red-border)}
.rp-modal-body{padding:20px 22px;display:flex;flex-direction:column;gap:18px;overflow-y:auto}
.rp-sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-muted);margin-bottom:9px;display:flex;align-items:center;gap:6px}
.rp-sec-hint{font-weight:500;text-transform:none;letter-spacing:0;color:var(--ink-muted);opacity:.8}
.rp-two{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.rp-mfield{height:36px;padding:0 11px;border-radius:8px;border:1px solid var(--border);background:var(--surface-raised);font-size:13px;color:var(--ink);font-family:'DM Sans',sans-serif;outline:none;width:100%}
.rp-mfield:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid);background:#fff}
.rp-area{height:auto;padding:9px 11px;resize:none;min-height:48px;line-height:1.45}
.rp-sub-field{margin-top:9px}
.rp-sys-note{margin-top:9px;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-soft);background:var(--surface-raised);border:1px solid var(--border);border-radius:7px;padding:7px 10px}
.rp-mini-lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted);display:block;margin-bottom:5px}
.rp-variant-row{display:flex;flex-wrap:wrap;gap:6px;min-height:34px;padding:7px;border-radius:8px;border:1px solid var(--border);background:var(--surface-raised);margin-bottom:8px}
.rp-variant{display:flex;align-items:center;gap:6px;padding:3px 6px 3px 10px;border-radius:100px;border:1px solid var(--border);background:#fff;font-size:11px;font-weight:500;color:var(--ink-soft)}
.rp-variant button{border:none;background:none;cursor:pointer;color:var(--ink-muted);display:flex;padding:0;border-radius:50%}
.rp-variant button:hover{color:var(--red)}
.rp-variant-empty{font-size:11px;color:var(--ink-muted);padding:4px}
.rp-variant-add{display:flex;gap:7px}
.rp-mini-btn{height:36px;padding:0 13px;border-radius:8px;border:none;background:var(--ink);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:4px;white-space:nowrap}
.rp-mini-btn.ghost{background:#fff;border:1px dashed var(--border-strong);color:var(--ink-soft)}
.rp-mini-btn.ghost:hover{border-color:var(--accent);color:var(--accent)}
/* unwind section — monochrome, editorial */
.rp-unwind-sec{padding:16px;border-radius:14px;border:1px solid var(--border-strong);background:var(--exit-tint);display:flex;flex-direction:column;gap:12px}
.rp-unwind-head{display:flex;align-items:center;gap:10px}
.rp-unwind-glyph{width:32px;height:32px;border-radius:9px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rp-unwind-t{font-size:12.5px;font-weight:700;color:var(--ink)}
.rp-unwind-s{font-size:11px;color:var(--ink-muted);margin-top:1px}
.rp-reconcile{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;background:#fff;border:1px solid var(--border)}
.rp-reconcile input{accent-color:var(--ink);width:15px;height:15px;cursor:pointer;flex-shrink:0}
.rp-reconcile span{font-size:11.5px;color:var(--ink-soft)}
.rp-reconcile strong{color:var(--ink)}
/* threshold + rules */
.rp-nova{margin-top:11px;display:flex;align-items:flex-start;gap:7px}
.rp-nova-txt{font-size:11px;color:var(--ink-soft);line-height:1.4;padding-top:2px}
.rp-nova-sec{display:flex;flex-direction:column;gap:10px}
.rp-nova-head{display:flex;align-items:center;justify-content:space-between}
.rp-nova-switch{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--ink-soft);cursor:pointer;font-family:'DM Mono',monospace}
.rp-nova-switch input{accent-color:var(--accent);width:15px;height:15px;cursor:pointer}
.rp-nova-checks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rp-check{display:flex;align-items:flex-start;gap:9px;text-align:left;padding:10px 11px;border-radius:10px;border:1.5px solid var(--border);background:#fff;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .12s}
.rp-check:hover{border-color:var(--accent-border)}
.rp-check.on{border-color:var(--accent);background:var(--accent-soft)}
.rp-check-box{width:17px;height:17px;border-radius:5px;border:1.5px solid var(--border-strong);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;color:#fff}
.rp-check.on .rp-check-box{background:var(--accent);border-color:var(--accent)}
.rp-check-main{display:flex;flex-direction:column;min-width:0}
.rp-check-t{font-size:12px;font-weight:700;color:var(--ink)}
.rp-check-d{font-size:10px;color:var(--ink-muted);line-height:1.35;margin-top:2px}
.rp-flow2{padding:18px 18px 8px}
.rp-flow2-rail{display:flex;align-items:center;padding:0 4px}
.rp-flow2-node{width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;z-index:1;color:#fff;font-weight:700;font-size:16px;font-family:'DM Sans',sans-serif;letter-spacing:-.02em}
.rp-flow2-node.nova{background:var(--accent);box-shadow:0 5px 14px rgba(14,116,144,.32)}
.rp-flow2-node.human{box-shadow:0 5px 14px rgba(10,10,10,.16);border:2px solid #fff}
.rp-flow2-node.human.int{background:var(--ink)}
.rp-flow2-badge{position:absolute;right:-3px;bottom:-3px;min-width:18px;height:18px;padding:0 3px;border-radius:9px;background:var(--ink);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-family:'DM Mono',monospace}
.rp-flow2-line{flex:1;height:2px;background:linear-gradient(90deg,var(--accent),var(--ink));position:relative}
.rp-flow2-arrow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border:1.5px solid var(--border-strong);border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:var(--ink-soft)}
.rp-flow2-caps{display:flex;justify-content:space-between;margin-top:10px}
.rp-flow2-cap{max-width:46%}
.rp-flow2-cap.left{text-align:left}
.rp-flow2-cap.right{text-align:right}
.rp-flow2-t{font-size:12px;font-weight:700;color:var(--ink)}
.rp-flow2-s{font-size:10px;color:var(--ink-muted);font-family:'DM Mono',monospace;margin-top:2px;line-height:1.35}
.rp-nova-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rp-nova-mode{text-align:left;padding:11px 12px;border-radius:10px;border:1.5px solid var(--border);background:#fff;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
.rp-nova-mode:hover{border-color:var(--accent-border)}
.rp-nova-mode.on{border-color:var(--accent);background:var(--accent-soft)}
.rp-nova-mode-t{font-size:12px;font-weight:700;color:var(--ink)}
.rp-nova-mode-d{font-size:10.5px;color:var(--ink-muted);margin-top:3px;line-height:1.4}
.rp-nova-route{display:flex;align-items:center;gap:10px}
.rp-nova-note{font-size:11px;color:var(--ink-muted);font-style:italic;display:flex;align-items:center;gap:5px}
.rp-rule{background:var(--surface-raised);border:1px solid var(--border);border-radius:10px;padding:9px;display:flex;flex-direction:column;gap:7px}
.rp-rule-top{display:flex;align-items:center;gap:6px}
.rp-rule-field{flex:1;height:32px}
.rp-rule-prefix{width:140px;height:32px}
.rp-crit{display:flex;border:1px solid var(--border);border-radius:7px;overflow:hidden;flex-shrink:0}
.rp-crit button{border:none;background:#fff;font-size:10px;font-weight:600;padding:6px 9px;cursor:pointer;color:var(--ink-muted);font-family:'DM Sans',sans-serif}
.rp-crit button.on.block{background:var(--red-soft);color:var(--red)}
.rp-crit button.on.flag{background:var(--amber-soft);color:var(--amber)}
.rp-rule-rm{width:30px;height:30px;border:none;background:none;border-radius:6px;cursor:pointer;color:var(--ink-muted);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rp-rule-rm:hover{background:var(--red-soft);color:var(--red)}
.rp-modal-ft{padding:14px 22px;border-top:1px solid var(--border);background:var(--surface-raised);display:flex;justify-content:flex-end;gap:10px}
.rp-btn-save{height:36px;padding:0 20px;border-radius:8px;border:none;background:#0a0a0a;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:6px}
.rp-btn-save:hover{background:var(--accent)}
`