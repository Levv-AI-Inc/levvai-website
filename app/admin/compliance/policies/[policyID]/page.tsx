'use client'
import {
  getRequirements,
  currentApprover, resolvePeople, roleLabel,
  HUMAN_APPROVERS,
  UNWIND_VERBS, composeAction,
  type Requirement as StoreRequirement,
  type ApproverGroup,
  type UnwindVerb,
} from '../../../workers/requirements/requirementsStore'
import {
  Cog, GripVertical, ChevronRight, Zap, Shield, AlertTriangle,
  Plus, X, Check, Link2, Users, CheckCircle2, XCircle,
  ArrowDown, Plug, ClipboardList, AlertCircle, Info,
  RotateCcw, ArrowRight, User, Search, Workflow,
} from 'lucide-react'
import { addWorkflow } from '../../../workers/onboarding/workflow'
import { useRouter } from 'next/navigation'
import React from 'react'
import { useParams } from 'next/navigation'

/* ======================
   TYPES — the block carries the FULL store requirement now (not a lossy copy)
====================== */
type BlockReq = StoreRequirement & { source?: 'BASE' | 'OVERRIDE'; optional?: boolean }
type IntegrationKey = 'NONE' | 'WORKDAY' | 'SERVICENOW' | 'SAP_FG' | 'ORACLE'
type CompletionRule = 'ALL' | 'ANY' | 'N_OF'
/* a system block just talks to another system — push (send out), pull (get back), or both */
type SystemUnwind = { verb: UnwindVerb; action: string; mode: 'automated' | 'manual'; reconcile?: boolean }
type Block = {
  id: string
  name: string
  order: number
  gate: 'HARD' | 'SOFT'
  completionRule: CompletionRule
  completionN?: number                   // for N_OF — how many of the required set
  accountableOwner?: ApproverGroup       // RACI Accountable — one throat to choke for the gate
  requirements: BlockReq[]
  type?: 'MANUAL' | 'SYSTEM'
  // ── system block contract ──
  integration?: IntegrationKey
  push?: boolean                         // sends data OUT to the system
  pull?: boolean                         // gets data BACK from the system
  reads?: string[]                       // canonical LEVV fields pushed OUT
  writes?: string[]                      // fields pulled BACK and stored
  reconcile?: boolean                    // poll the system of record to confirm
  systemUnwind?: SystemUnwind            // registered reversal; undefined when nothing was created
  systemType?: 'API_CALL'
  connectionConfig?: { endpoint: string; authType: string; environment: string }
}
type Dependency = { from: string; to: string }
type Mode = 'onboarding' | 'offboarding'

/* the connector catalog — each one ships pre-built; you finish the last 10% (which fields) */
type IntegrationMeta = { key: IntegrationKey; label: string; blurb: string; push: boolean; pull: boolean; reverseVerb?: UnwindVerb; reverseLabel?: string }
const INTEGRATIONS: IntegrationMeta[] = [
  { key: 'WORKDAY',    label: 'Workday',        blurb: 'HR record & system access', push: true, pull: true, reverseVerb: 'Deactivate', reverseLabel: 'Deactivate worker record' },
  { key: 'SERVICENOW', label: 'ServiceNow',     blurb: 'Laptop / asset request',    push: true, pull: true, reverseVerb: 'Collect',    reverseLabel: 'Open asset return ticket' },
  { key: 'SAP_FG',     label: 'SAP Fieldglass', blurb: 'Contingent worker record',  push: true, pull: true, reverseVerb: 'Close',      reverseLabel: 'Close worker assignment' },
  { key: 'ORACLE',     label: 'Oracle',         blurb: 'HCM / ERP record',          push: true, pull: true, reverseVerb: 'Deactivate', reverseLabel: 'Deactivate HCM record' },
]
const integrationMeta = (k?: IntegrationKey) => INTEGRATIONS.find(i => i.key === k)
/* canonical worker/SOW fields LEVV can send out (per-client in production — stand-in list here) */
const LEVV_FIELDS = ['Legal name', 'Work email', 'Start date', 'End date', 'Worker type', 'Job title', 'Manager', 'Cost center', 'Work location', 'SOW ID', 'Supplier']
/* fields a system returns that LEVV stores back (stand-in) */
const RETURN_FIELDS = ['Account ID', 'Status', 'External ID', 'Created date']
const defaultReads = (): string[] => ['Legal name', 'Work email', 'Start date', 'Manager']
const defaultWrites = (): string[] => ['Account ID', 'Status']

/* the worker/SOW attributes a policy can match on — values [] on a condition means "Any" */
const DIMENSIONS: Record<string, string[]> = {
  'Worker type': ['Contingent', 'SOW', 'Non-transactional', 'Independent contractor', 'Temp / Agency', 'Consultant', 'Intern', 'Freelancer'],
  'Country': ['United States', 'Canada', 'United Kingdom', 'Ireland', 'Germany', 'France', 'Netherlands', 'Spain', 'India', 'Singapore', 'Australia', 'Japan', 'Mexico', 'Brazil'],
  'Worksite': ['New York', 'Chicago', 'San Francisco', 'Austin', 'Boston', 'Seattle', 'Atlanta', 'Toronto', 'Ontario', 'London', 'Bangalore', 'Remote', 'Hybrid'],
  'Department': ['Engineering', 'Product', 'Design', 'Finance', 'Operations', 'Marketing', 'Sales', 'Customer Success', 'HR', 'Legal', 'IT', 'Security'],
  'Cost center': ['CC-1000', 'CC-1100', 'CC-2000', 'CC-2200', 'CC-3000', 'CC-3300', 'CC-4000', 'CC-5000'],
  'Business unit': ['Commercial', 'Enterprise', 'SMB', 'Public Sector', 'International', 'Strategic Accounts'],
  'Job level': ['Junior', 'Mid', 'Senior', 'Staff', 'Principal', 'Lead', 'Manager', 'Director'],
  'Supplier': ['Randstad', 'Adecco', 'ManpowerGroup', 'Allegis', 'Kelly Services', 'Direct sourced'],
}

/* the real catalog — every requirement here carries approver, Nova & unwind */
const LIB = getRequirements()
const byId = (id: string) => LIB.find(r => r.id === id)
const seedReqs = (...ids: string[]) =>
  ids.map(id => byId(id)).filter(Boolean).map(r => ({ ...(r as StoreRequirement), source: 'BASE' as const }))

/* ======================
   AVATARS — resolve an approver role to live people (same as the catalog)
====================== */
const AVA_COLORS = ['#0e7490', '#7c3aed', '#be185d', '#b45309', '#15803d', '#1d4ed8', '#9333ea', '#0891b2']
function initials(name: string) { return name.split(' ').map(w => w[0]).slice(0, 2).join('') }
function avaColor(name: string) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVA_COLORS[h % AVA_COLORS.length] }
function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  return <span className="bx-ava" title={name} style={{ width: size, height: size, background: avaColor(name), fontSize: size * 0.4 }}>{initials(name)}</span>
}
function AvatarStack({ names, max = 2 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max)
  return (
    <span className="bx-ava-stack">
      {shown.map(n => <Avatar key={n} name={n} />)}
      {names.length > max && <span className="bx-ava more">+{names.length - max}</span>}
    </span>
  )
}

/* multi-value picker — empty selection reads as "Any" (no constraint on this dimension) */
function MultiSelect({ options, values, onChange }: { options: string[]; values: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="ms">
      <button type="button" className="ms-trigger" onClick={() => { setOpen(o => !o); setQ('') }}>
        {values.length === 0
          ? <span className="ms-any">Any</span>
          : <span className="ms-vals">{values.map(v => <span key={v} className="ms-chip">{v}</span>)}</span>}
        <ChevronRight style={{ width: 12, height: 12, transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', color: 'var(--ink-muted)', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="ms-panel">
          <div className="ms-search">
            <Search style={{ width: 13, height: 13, color: 'var(--ink-muted)', flexShrink: 0 }} />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" />
          </div>
          <button type="button" className={`ms-opt ${values.length === 0 ? 'on' : ''}`} onClick={() => onChange([])}>
            <span>Any</span>{values.length === 0 && <Check style={{ width: 12, height: 12, color: 'var(--accent)' }} />}
          </button>
          <div className="ms-div" />
          {filtered.map(o => {
            const on = values.includes(o)
            return (
              <button type="button" key={o} className={`ms-opt ${on ? 'on' : ''}`} onClick={() => onChange(on ? values.filter(x => x !== o) : [...values, o])}>
                <span>{o}</span>{on && <Check style={{ width: 12, height: 12, color: 'var(--accent)' }} />}
              </button>
            )
          })}
          {filtered.length === 0 && <div className="ms-none">No matches</div>}
        </div>
      )}
    </div>
  )
}
function AccountableField({ value, onChange }: { value: ApproverGroup; onChange: (g: ApproverGroup) => void }) {
  const [open, setOpen] = React.useState(false)
  const people = resolvePeople(value)
  return (
    <div className="acctf">
      <button type="button" className="acctf-trigger" onClick={() => setOpen(o => !o)}>
        <AvatarStack names={people.map(p => p.name)} max={3} />
        <span className="acctf-role">{roleLabel(value)}</span>
        <span className="acctf-names">{people.map(p => p.name).join(', ')}</span>
        <ChevronRight style={{ width: 13, height: 13, transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', color: 'var(--ink-muted)', marginLeft: 'auto', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="acctf-panel">
          <div className="acctf-cap">Who’s accountable · resolves to live people</div>
          {HUMAN_APPROVERS.map(g => {
            const ppl = resolvePeople(g)
            return (
              <button type="button" key={g} className={`acctf-opt ${g === value ? 'on' : ''}`} onClick={() => { onChange(g); setOpen(false) }}>
                <AvatarStack names={ppl.map(p => p.name)} max={3} />
                <span className="acctf-opt-main">
                  <span className="acctf-opt-role">{roleLabel(g)}</span>
                  <span className="acctf-opt-people">{ppl.map(p => p.name).join(', ')}</span>
                </span>
                {g === value && <Check style={{ width: 13, height: 13, color: 'var(--accent)', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ======================
   HELPERS
====================== */
function getBlockIssues(block: Block): string[] {
  const issues: string[] = []
  if (block.type === 'MANUAL') {
    if (block.requirements.length === 0) issues.push('No requirements added')
    const unassigned = block.requirements.filter(r => !r.owner)
    if (unassigned.length > 0) issues.push(`${unassigned.length} requirement(s) have no owner`)
  }
  if (block.type === 'SYSTEM') {
    if (!block.integration || block.integration === 'NONE') issues.push('No system connected')
  }
  return issues
}

function getOwnerColor(owner: string) {
  switch (owner) {
    case 'Worker':         return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
    case 'Supplier':       return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
    case 'Hiring Manager': return { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' }
    case 'IT':             return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
    default:               return { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' }
  }
}

/* smart default for the block's accountable owner: the approver group that
   shows up most across its requirements. Coherence, not a hard rule. */
function suggestedAccountable(reqs: BlockReq[]): ApproverGroup {
  const counts: Partial<Record<ApproverGroup, number>> = {}
  for (const r of reqs) {
    const ap = currentApprover(r)
    if (ap !== 'Integration') counts[ap] = (counts[ap] ?? 0) + 1
  }
  const top = (Object.entries(counts) as [ApproverGroup, number][]).sort((a, b) => b[1] - a[1])[0]
  return top?.[0] ?? 'HR'
}

/* short label for a non-default completion rule */
function completionLabel(rule: CompletionRule, n: number | undefined, requiredTotal: number): string | null {
  if (rule === 'ANY') return 'ANY one'
  if (rule === 'N_OF') return `${n ?? 1} of ${requiredTotal}`
  return null
}

/* the scope a requirement is conditionally limited to, if any */
function scopeBadge(req: BlockReq): string | null {
  const wt = req.applicability?.workerTypes
  return wt && wt.length ? `${wt.join(' / ')} only` : null
}

/* build the reversal a system block registers — only if it pushed/created something */
function systemReversalFor(meta: IntegrationMeta | undefined, push: boolean): SystemUnwind | undefined {
  if (!push || !meta?.reverseVerb) return undefined
  return {
    verb: meta.reverseVerb,
    action: meta.reverseLabel ?? composeAction(meta.reverseVerb, meta.label),
    mode: 'automated',
    reconcile: true,
  }
}

/* ── one requirement row, rendered for whichever direction we're viewing ── */
function ReqRow({ req, mode }: { req: BlockReq; mode: Mode }) {
  if (mode === 'offboarding') {
    const auto = req.unwind.mode === 'automated'
    return (
      <div className="bx-row exit">
        <RotateCcw style={{ width: 12, height: 12, color: 'var(--ink)', flexShrink: 0 }} />
        <span className="bx-row-name">{req.unwind.action}</span>
        <span className="bx-row-right">
          {auto
            ? <span className="bx-run auto"><Zap style={{ width: 9, height: 9 }} /> Nova</span>
            : <span className="bx-run team"><User style={{ width: 9, height: 9 }} /> {req.unwind.owner}</span>}
          <span className="bx-when">{req.unwind.condition}</span>
        </span>
      </div>
    )
  }
  const ap = currentApprover(req)
  const ppl = resolvePeople(ap)
  return (
    <div className="bx-row">
      <span className="bx-row-name">
        {req.name}
        {req.source === 'OVERRIDE' && <span className="req-src">custom</span>}
        {req.nova && <span className="bx-nova"><Zap style={{ width: 8, height: 8 }} /> Nova</span>}
      </span>
      <span className="bx-row-right">
        {ap === 'Integration'
          ? <span className="bx-int"><Link2 style={{ width: 10, height: 10 }} /> Integration</span>
          : <span className="bx-approver"><AvatarStack names={ppl.map(p => p.name)} max={2} /><span className="bx-role">{roleLabel(ap)}</span></span>}
      </span>
    </div>
  )
}

/* derives a real process diagram from the blocks. Explicit dependency edges win;
   otherwise gates drive the shape — a HARD gate is a barrier (everything waits for it),
   a SOFT gate doesn't block, so what follows runs in parallel beside it. */
function ProcessView({ blocks, dependencies, mode }: { blocks: Block[]; dependencies: Dependency[]; mode: Mode }) {
  const ordered = mode === 'onboarding' ? blocks : [...blocks].reverse()
  const ids = ordered.map(b => b.id)
  const byId = new Map(ordered.map(b => [b.id, b]))
  const idset = new Set(ids)
  let edges = dependencies.filter(d => idset.has(d.from) && idset.has(d.to))
  if (mode === 'offboarding') edges = edges.map(d => ({ from: d.to, to: d.from }))

  const layer = new Map<string, number>(); ids.forEach(id => layer.set(id, 0))
  const links: { from: string; to: string; soft?: boolean }[] = []

  if (edges.length === 0) {
    /* group blocks into layers — a HARD-gate block closes its layer (barrier);
       SOFT blocks accumulate, so they sit parallel to the next hard gate */
    const layers: string[][] = []; let cur: string[] = []
    for (const b of ordered) { cur.push(b.id); if (b.gate === 'HARD') { layers.push(cur); cur = [] } }
    if (cur.length) layers.push(cur)
    layers.forEach((col, l) => col.forEach(id => layer.set(id, l)))
    const barrierOf = (col: string[]) => { for (let i = col.length - 1; i >= 0; i--) if (byId.get(col[i])!.gate === 'HARD') return col[i]; return col[col.length - 1] }
    layers.forEach((col, l) => {
      const bar = barrierOf(col); const next = layers[l + 1]
      if (next) {
        const nbar = barrierOf(next)
        next.forEach(t => links.push({ from: bar, to: t }))
        col.forEach(x => { if (x !== bar) links.push({ from: x, to: nbar, soft: true }) })
      }
    })
  } else {
    const adj = new Map<string, string[]>(); const indeg = new Map<string, number>()
    ids.forEach(id => { adj.set(id, []); indeg.set(id, 0) })
    edges.forEach(e => { adj.get(e.from)!.push(e.to); indeg.set(e.to, (indeg.get(e.to) || 0) + 1); links.push({ from: e.from, to: e.to }) })
    const ind = new Map(indeg); const q = ids.filter(id => ind.get(id) === 0)
    while (q.length) { const n = q.shift()!; for (const m of adj.get(n)!) { layer.set(m, Math.max(layer.get(m)!, layer.get(n)! + 1)); ind.set(m, ind.get(m)! - 1); if (ind.get(m) === 0) q.push(m) } }
  }

  const maxLayer = ids.length ? Math.max(...ids.map(id => layer.get(id)!)) : 0
  const cols: string[][] = []; for (let l = 0; l <= maxLayer; l++) cols.push(ids.filter(id => layer.get(id) === l))
  const NW = 198, NH = 60, HG = 76, VG = 22, MX = 128, MY = 34
  const maxRows = Math.max(1, ...cols.map(c => c.length))
  const pos = new Map<string, { x: number; y: number }>()
  cols.forEach((col, l) => {
    const colTop = MY + ((maxRows - col.length) * (NH + VG)) / 2
    col.forEach((id, i) => pos.set(id, { x: MX + l * (NW + HG), y: colTop + i * (NH + VG) }))
  })
  const contentRight = MX + (maxLayer + 1) * (NW + HG)
  const W = contentRight + MX
  const H = MY + maxRows * (NH + VG) + MY
  const midY = H / 2
  const startX = 30, endX = contentRight + 6
  const hasIn = new Set(links.map(l => l.to)); const hasOut = new Set(links.map(l => l.from))
  const sources = ids.filter(id => !hasIn.has(id))
  const sinks = ids.filter(id => !hasOut.has(id))
  const exit = mode === 'offboarding'
  const ep = (x1: number, y1: number, x2: number, y2: number) => { const mx = (x1 + x2) / 2; return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` }

  if (!ids.length) return <div className="pv-empty">Add blocks in the builder to see the process.</div>

  return (
    <div className="pv-wrap">
      <svg className="pv-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <defs>
          <marker id="pv-arrow" markerWidth="9" markerHeight="9" refX="6.5" refY="4" orient="auto">
            <path d="M0,0 L7,4 L0,8" fill="none" stroke="var(--pv-edge)" strokeWidth="1.4" />
          </marker>
        </defs>
        {sources.map(id => { const p = pos.get(id)!; return <path key={'s' + id} d={ep(startX + 9, midY, p.x, p.y + NH / 2)} className="pv-edge" markerEnd="url(#pv-arrow)" /> })}
        {links.map((lk, i) => { const a = pos.get(lk.from)!, b = pos.get(lk.to)!; return <path key={i} d={ep(a.x + NW, a.y + NH / 2, b.x, b.y + NH / 2)} className={`pv-edge ${lk.soft ? 'soft' : ''}`} markerEnd="url(#pv-arrow)" /> })}
        {sinks.map(id => { const p = pos.get(id)!; return <path key={'e' + id} d={ep(p.x + NW, p.y + NH / 2, endX, midY)} className="pv-edge" markerEnd="url(#pv-arrow)" /> })}
        <circle cx={startX} cy={midY} r="9" fill={exit ? '#0a0a0a' : '#007a8a'} />
        <text x={startX} y={midY + 24} textAnchor="middle" className="pv-term">{exit ? 'Exit' : 'Start'}</text>
        <circle cx={endX} cy={midY} r="9" fill="none" stroke={exit ? '#0a0a0a' : '#007a8a'} strokeWidth="2" />
        <circle cx={endX} cy={midY} r="3.5" fill={exit ? '#0a0a0a' : '#007a8a'} />
        <text x={endX} y={midY + 24} textAnchor="middle" className="pv-term">{exit ? 'Offboarded' : 'Active'}</text>
        {ids.map(id => {
          const b = byId.get(id)!; const p = pos.get(id)!; const sys = b.type === 'SYSTEM'
          return (
            <foreignObject key={id} x={p.x} y={p.y} width={NW} height={NH}>
              <div className={`pv-node ${sys ? 'sys' : ''} ${exit ? 'exit' : (b.gate === 'HARD' ? 'hard' : 'soft')}`}>
                <div className="pv-node-name">{b.name}</div>
                <div className="pv-node-sub">
                  {exit
                    ? (sys ? (b.systemUnwind?.action ?? 'reverse') : `${b.requirements.length} unwind${b.requirements.length !== 1 ? 's' : ''}`)
                    : (sys ? `${integrationMeta(b.integration)?.label ?? 'System'} · ${b.push && b.pull ? 'push · pull' : b.push ? 'push' : 'pull'}` : `${b.requirements.length} req${b.requirements.length !== 1 ? 's' : ''} · ${b.gate === 'HARD' ? 'hard gate' : 'soft gate · parallel'}`)}
                </div>
              </div>
            </foreignObject>
          )
        })}
      </svg>
    </div>
  )
}

/* ======================
   PAGE
====================== */
export default function PolicyArchitectPage() {
  const params = useParams()
  const policyId = params.policyId as string
  const router = useRouter()

  const [mode, setMode] = React.useState<Mode>('onboarding')
  const [view, setView] = React.useState<'build' | 'process'>('build')
  const [policyName, setPolicyName] = React.useState('')
  const [conditions, setConditions] = React.useState<{ id: string; dimension: string; values: string[] }[]>([
    { id: 'c-wt', dimension: 'Worker type', values: ['Contingent'] },
    { id: 'c-co', dimension: 'Country', values: ['United States'] },
    { id: 'c-ws', dimension: 'Worksite', values: ['NY'] },
  ])
  const [showAddCond, setShowAddCond] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)

  function addCondition(dim: string) {
    setConditions(prev => [...prev, { id: crypto.randomUUID(), dimension: dim, values: [] }])
    setShowAddCond(false)
  }
  function setCondValues(id: string, values: string[]) {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, values } : c))
  }
  function removeCondition(id: string) {
    setConditions(prev => prev.filter(c => c.id !== id))
  }

  /* DRAG */
  const [activeDragBlock, setActiveDragBlock] = React.useState<any | null>(null)
  const [dragPosition, setDragPosition] = React.useState({ x: 0, y: 0 })
  const canvasRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!activeDragBlock) return
    const onMove = (e: MouseEvent) => setDragPosition({ x: e.clientX, y: e.clientY })
    const onUp = (e: MouseEvent) => {
      if (!canvasRef.current) { setActiveDragBlock(null); return }
      const r = canvasRef.current.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        setBlocks(prev => [...prev, {
          id: crypto.randomUUID(), name: activeDragBlock.name, type: activeDragBlock.type,
          order: prev.length + 1, gate: activeDragBlock.gate ?? 'HARD',
          completionRule: activeDragBlock.completionRule ?? 'ALL', completionN: activeDragBlock.completionN,
          accountableOwner: activeDragBlock.accountableOwner,
          integration: activeDragBlock.integration, push: activeDragBlock.push, pull: activeDragBlock.pull,
          reads: activeDragBlock.reads, writes: activeDragBlock.writes,
          reconcile: activeDragBlock.reconcile,
          systemUnwind: activeDragBlock.systemUnwind, systemType: activeDragBlock.systemType,
          connectionConfig: activeDragBlock.connectionConfig,
          requirements: (activeDragBlock.requirements ?? []).map((r: BlockReq) => ({ ...r, source: 'BASE' })),
        }])
      }
      setActiveDragBlock(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [activeDragBlock])

  /* INSPECTOR BLOCKS — seeded from the real catalog so they carry full richness */
  const [inspectorBlocks, setInspectorBlocks] = React.useState<
    { id: string; name: string; requirements: BlockReq[]; type: 'MANUAL' | 'SYSTEM'; gate: 'HARD' | 'SOFT'; accountableOwner?: ApproverGroup; completionRule: CompletionRule; completionN?: number; integration?: IntegrationKey; push?: boolean; pull?: boolean; reads?: string[]; writes?: string[]; reconcile?: boolean; systemUnwind?: SystemUnwind; systemType?: 'API_CALL'; connectionConfig?: { endpoint: string; authType: string; environment: string } }[]
  >([
    { id: 'identity-eligibility', name: 'Identity & Eligibility', type: 'MANUAL', gate: 'HARD', accountableOwner: 'HR', completionRule: 'ALL', requirements: seedReqs('gov-id') },
    { id: 'legal-compliance', name: 'Legal & Compliance', type: 'MANUAL', gate: 'HARD', accountableOwner: 'LEGAL', completionRule: 'ALL', requirements: seedReqs('nda-sign', 'bg-check') },
    { id: 'vendor-insurance', name: 'Vendor Insurance', type: 'MANUAL', gate: 'SOFT', accountableOwner: 'PROCUREMENT', completionRule: 'ALL', requirements: seedReqs('coi') },
    { id: 'wd-provision', name: 'Workday Provisioning', type: 'SYSTEM', gate: 'HARD', accountableOwner: 'IT', completionRule: 'ALL', requirements: [], integration: 'WORKDAY', push: true, pull: true, reads: defaultReads(), writes: defaultWrites(), reconcile: true, systemUnwind: systemReversalFor(integrationMeta('WORKDAY'), true) },
  ])

  const [showAddBlockModal, setShowAddBlockModal] = React.useState<null | 'MANUAL' | 'SYSTEM'>(null)
  const [editingInspectorBlockId, setEditingInspectorBlockId] = React.useState<string | null>(null)
  const [newBlockName, setNewBlockName] = React.useState('')
  const [newBlockRequirements, setNewBlockRequirements] = React.useState<BlockReq[]>([])
  const [newBlockGate, setNewBlockGate] = React.useState<'HARD' | 'SOFT'>('HARD')
  const [newBlockAccountable, setNewBlockAccountable] = React.useState<ApproverGroup>('HR')
  const [accountableTouched, setAccountableTouched] = React.useState(false)
  const [newBlockCompletion, setNewBlockCompletion] = React.useState<CompletionRule>('ALL')
  const [newBlockN, setNewBlockN] = React.useState(1)
  const [newSystemType, setNewSystemType] = React.useState<'API_CALL' | null>(null)
  const [apiConfig, setApiConfig] = React.useState({ endpoint: '', authType: 'OAuth', environment: 'Production' })
  const [endpointStatus, setEndpointStatus] = React.useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [newIntegration, setNewIntegration] = React.useState<IntegrationKey>('NONE')
  const [newPush, setNewPush] = React.useState(true)
  const [newPull, setNewPull] = React.useState(true)
  const [newReads, setNewReads] = React.useState<string[]>(defaultReads())
  const [newWrites, setNewWrites] = React.useState<string[]>(defaultWrites())
  const [newReconcile, setNewReconcile] = React.useState(true)
  const [blocks, setBlocks] = React.useState<Block[]>([])
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [dropIdx, setDropIdx] = React.useState<number | null>(null)
  const canvasListRef = React.useRef<HTMLDivElement | null>(null)
  const [showRequirementLibrary, setShowRequirementLibrary] = React.useState(false)
  const usedInspectorBlockNames = new Set(blocks.map(b => b.name))
  const REQUIREMENT_LIBRARY = LIB

  /* DEPENDENCIES */
  const [dependencies, setDependencies] = React.useState<Dependency[]>([])
  const [linkFromId, setLinkFromId] = React.useState<string | null>(null)

  const circularWarning = React.useMemo(() => {
    if (!dependencies.length) return null
    const adj = new Map<string, string[]>()
    for (const n of blocks.map(b => b.id)) adj.set(n, [])
    for (const d of dependencies) adj.get(d.from)?.push(d.to)
    const visiting = new Set<string>(), visited = new Set<string>()
    function dfs(n: string): boolean {
      if (visiting.has(n)) return true; if (visited.has(n)) return false
      visiting.add(n)
      for (const nxt of adj.get(n) ?? []) if (dfs(nxt)) return true
      visiting.delete(n); visited.add(n); return false
    }
    for (const n of blocks.map(b => b.id)) if (dfs(n)) return 'Circular dependency detected'
    return null
  }, [dependencies, blocks])

  /* VALIDATION */
  const blockIssuesMap = React.useMemo(() => {
    const m = new Map<string, string[]>()
    for (const b of blocks) m.set(b.id, getBlockIssues(b))
    return m
  }, [blocks])
  const totalIssues = React.useMemo(() => Array.from(blockIssuesMap.values()).reduce((count, issues) => count + issues.length, 0), [blockIssuesMap])
  const totalRequirements = blocks.reduce((s, b) => s + b.requirements.length, 0)
  const hardGateCount = blocks.filter(b => b.gate === 'HARD').length
  const softGateCount = blocks.filter(b => b.gate === 'SOFT').length
  const systemBlockCount = blocks.filter(b => b.type === 'SYSTEM').length
  const unassignedOwners = blocks.reduce((s, b) => s + b.requirements.filter(r => !r.owner).length, 0)
  const isWorkflowReady = blocks.length > 0 && totalIssues === 0 && !circularWarning && !!policyName.trim()

  /* derived offboarding stats — requirement unwinds + system-block reversals */
  const reqUnwinds = blocks.flatMap(b => b.requirements)
  const sysReversals = blocks.filter(b => b.type === 'SYSTEM' && b.systemUnwind)
  const allReversals = reqUnwinds.length + sysReversals.length
  const autoUnwinds = reqUnwinds.filter(r => r.unwind.mode === 'automated').length + sysReversals.length
  const manualUnwinds = allReversals - autoUnwinds

  /* HANDLERS */
  function handleAddRequirement(req: StoreRequirement) {
    if (!selectedBlockId) return
    setBlocks(prev => prev.map(b => {
      if (b.id !== selectedBlockId) return b
      if (b.requirements.some(r => r.id === req.id)) return b
      return { ...b, requirements: [...b.requirements, { ...req, source: 'OVERRIDE' }] }
    }))
    setShowRequirementLibrary(false)
  }
  function handleCanvasBlockClick(blockId: string) {
    if (mode === 'offboarding') return
    if (linkFromId) {
      if (linkFromId === blockId) { setLinkFromId(null); return }
      setDependencies(prev => prev.some(d => d.from === linkFromId && d.to === blockId) ? prev : [...prev, { from: linkFromId, to: blockId }])
      setLinkFromId(null); return
    }
    setSelectedBlockId(prev => prev === blockId ? null : blockId)
  }
  /* grab anywhere on a block → drag → drop on the teal line between steps.
     a plain click (no movement) still inspects the block. */
  function computeDropIndex(clientY: number): number {
    const els = Array.from(canvasListRef.current?.querySelectorAll('[data-bid]') ?? []) as HTMLElement[]
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return els.length
  }
  function moveBlockTo(id: string, toIdx: number) {
    setBlocks(prev => {
      const from = prev.findIndex(b => b.id === id)
      if (from === -1) return prev
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      let insert = from < toIdx ? toIdx - 1 : toIdx
      insert = Math.max(0, Math.min(insert, arr.length))
      arr.splice(insert, 0, item)
      return arr.map((b, i) => ({ ...b, order: i + 1 }))
    })
  }
  function onBlockMouseDown(e: React.MouseEvent, blockId: string) {
    if (!editable || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, input, select, .no-drag')) return
    const start = { x: e.clientX, y: e.clientY }
    let moved = false
    const onMove = (ev: MouseEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 5) {
        moved = true; setDragId(blockId); document.body.classList.add('reordering')
      }
      if (moved) setDropIdx(computeDropIndex(ev.clientY))
    }
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.classList.remove('reordering')
      if (moved) moveBlockTo(blockId, computeDropIndex(ev.clientY))
      else handleCanvasBlockClick(blockId)
      setDragId(null); setDropIdx(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  function removeCanvasBlock(blockId: string) {
    setBlocks(prev => prev.filter(b => b.id !== blockId).map((b, i) => ({ ...b, order: i + 1 })))
    setDependencies(prev => prev.filter(d => d.from !== blockId && d.to !== blockId))
    setSelectedBlockId(prev => prev === blockId ? null : prev)
  }
  function validateEndpoint(endpoint: string) {
    if (!endpoint) return
    setEndpointStatus('checking')
    setTimeout(() => { try { new URL(endpoint); setEndpointStatus('valid') } catch { setEndpointStatus('invalid') } }, 700)
  }
  /* modal: add a requirement (carries its full catalog definition), keep accountable smart */
  function addModalReq(req: StoreRequirement) {
    setNewBlockRequirements(prev => {
      if (prev.some(r => r.id === req.id)) return prev
      const next = [...prev, { ...req, source: 'BASE' as const }]
      if (!accountableTouched) setNewBlockAccountable(suggestedAccountable(next))
      return next
    })
  }
  function removeModalReq(id: string) {
    setNewBlockRequirements(prev => {
      const next = prev.filter(r => r.id !== id)
      if (!accountableTouched && next.length) setNewBlockAccountable(suggestedAccountable(next))
      return next
    })
  }
  function toggleModalReqOptional(id: string) {
    setNewBlockRequirements(prev => prev.map(r => r.id === id ? { ...r, optional: !r.optional } : r))
  }

  /* picking a connector finishes the build to ~90% — you choose the last 10% (fields) */
  function pickIntegration(key: IntegrationKey) {
    setNewIntegration(key)
    const meta = integrationMeta(key)
    if (!meta) return
    setNewPush(meta.push)
    setNewPull(meta.pull)
    setNewReads(defaultReads())
    setNewWrites(defaultWrites())
    setNewReconcile(!!meta.reverseVerb)
  }
  function toggleRead(f: string) {
    setNewReads(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }
  function toggleWrite(f: string) {
    setNewWrites(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  function handleCreateInspectorBlock() {
    if (!newBlockName.trim() || (showAddBlockModal === 'MANUAL' && newBlockRequirements.length === 0)) return
    if (showAddBlockModal === 'SYSTEM' && (!newIntegration || newIntegration === 'NONE')) return
    const completionN = newBlockCompletion === 'N_OF' ? Math.max(1, Math.min(newBlockN, newBlockRequirements.length || 1)) : undefined
    const sysMeta = integrationMeta(newIntegration)
    const systemFields = showAddBlockModal === 'SYSTEM'
      ? {
          integration: newIntegration,
          push: newPush,
          pull: newPull,
          reads: newPush ? newReads : [],
          writes: newPull ? newWrites : [],
          reconcile: newReconcile,
          systemUnwind: systemReversalFor(sysMeta, newPush),
          ...(newSystemType === 'API_CALL' ? { systemType: 'API_CALL' as const, connectionConfig: apiConfig } : {}),
        }
      : {}
    setInspectorBlocks(prev => {
      if (editingInspectorBlockId) return prev.map(b => b.id === editingInspectorBlockId ? { ...b, name: newBlockName.trim(), gate: newBlockGate, accountableOwner: newBlockAccountable, completionRule: newBlockCompletion, completionN, requirements: newBlockRequirements, ...systemFields } : b)
      return [...prev, { id: crypto.randomUUID(), name: newBlockName.trim(), type: showAddBlockModal === 'SYSTEM' ? 'SYSTEM' : 'MANUAL', gate: newBlockGate, accountableOwner: newBlockAccountable, completionRule: newBlockCompletion, completionN, requirements: newBlockRequirements, ...systemFields }]
    })
    setNewBlockName(''); setNewBlockRequirements([]); setNewSystemType(null); setNewBlockAccountable('HR')
    setNewBlockCompletion('ALL'); setNewBlockN(1); setAccountableTouched(false)
    setNewIntegration('NONE'); setNewPush(true); setNewPull(true); setNewReads(defaultReads()); setNewWrites(defaultWrites()); setNewReconcile(true)
    setApiConfig({ endpoint: '', authType: 'OAuth', environment: 'Production' })
    setEditingInspectorBlockId(null); setShowAddBlockModal(null)
  }
  function handleSave() {
    /* assemble the FULL policy — scope, the block graph (with rich requirements
       + their unwinds), dependencies and version. Nothing is dropped now. */
    const policy = {
      id: policyId || crypto.randomUUID(),
      name: policyName || 'Untitled policy',
      version: 'v1.0',
      status: 'DRAFT' as const,
      appliesTo: conditions,
      blocks: blocks.map(b => ({
        id: b.id, name: b.name, order: b.order, gate: b.gate, completionRule: b.completionRule,
        accountableOwner: b.accountableOwner, type: b.type, integration: b.integration,
        connectionConfig: b.connectionConfig,
        requirements: b.requirements.map(r => ({ id: r.id, source: r.source })), // refs, not copies
      })),
      dependencies,
    }
    // eslint-disable-next-line no-console
    console.log('[LEVV] saving policy', policy)
    addWorkflow({ id: policy.id, name: policy.name, status: 'Draft', active: true })
    setSaveSuccess(true)
    setTimeout(() => router.push('/admin/workers/onboarding'), 900)
  }

  const scopeSummary = (() => {
    const parts = conditions.map(c => c.values.length ? c.values.join(' or ') : null).filter(Boolean) as string[]
    return parts.length ? parts.join(' · ') : 'all workers'
  })()
  const orderedBlocks = mode === 'onboarding' ? blocks : [...blocks].reverse()
  const editable = mode === 'onboarding'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body,.pa-root{font-family:'DM Sans',sans-serif;background:#f8f9fb;}
        .pa-root{
          --bg:#f8f9fb; --surface:#fff; --surface-raised:#f3f4f6;
          --border:#e5e7eb; --border-strong:#d1d5db;
          --ink:#0a0a0a; --ink-soft:#374151; --ink-muted:#9ca3af;
          --accent:#007a8a; --accent-soft:rgba(0,122,138,.07); --accent-mid:rgba(0,122,138,.14); --accent-border:rgba(0,122,138,.3);
          --red:#dc2626; --red-soft:#fef2f2; --red-border:#fecaca;
          --amber:#b45309; --amber-soft:#fffbeb; --amber-border:#fde68a;
          --green:#047857; --green-soft:#ecfdf5; --green-border:#a7f3d0;
          --exit-tint:#f5f4f2;
          --sys:#0f172a; --sys-text:#e2e8f0; --sys-muted:#94a3b8;
          --sh-sm:0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.04);
          --sh-md:0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.04);
          --sh-lg:0 12px 32px rgba(0,0,0,.11),0 4px 8px rgba(0,0,0,.05);
          --r-sm:8px; --r-md:12px; --r-lg:16px; --r-xl:20px;
          min-height:100vh; background:var(--bg);
        }
        .hd{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 28px;height:58px;display:flex;align-items:center;justify-content:space-between;}
        .hd-l{display:flex;align-items:center;gap:14px;}
        .back-link{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ink-muted);text-decoration:none;padding:4px 8px;border-radius:6px;transition:all .15s;}
        .back-link:hover{color:var(--accent);background:var(--accent-soft);}
        .hdiv{width:1px;height:18px;background:var(--border);}
        .hd-title{font-size:14px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:8px;}
        .draft-pill{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;padding:2px 8px;border-radius:100px;background:var(--amber-soft);border:1px solid var(--amber-border);color:var(--amber);}
        .btn-ghost{height:32px;padding:0 14px;border-radius:7px;border:1px solid var(--border-strong);background:#fff;font-size:12px;font-weight:500;color:var(--ink-soft);cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
        .btn-ghost:hover{border-color:var(--accent-border);color:var(--accent);background:var(--accent-soft);}
        .btn-ghost.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
        .pv-panel{background:#fff;border:1px solid var(--border);border-radius:var(--r-xl);box-shadow:var(--sh-sm);overflow:hidden;}
        .pv-head{padding:14px 20px;border-bottom:1px solid var(--border);background:var(--surface-raised);display:flex;align-items:center;justify-content:space-between;}
        .pv-head h2{font-size:13px;font-weight:600;color:var(--ink);}
        .pv-head p{font-size:11px;color:var(--ink-muted);margin-top:1px;}
        .pv-wrap{padding:8px 12px 16px;overflow-x:auto;--pv-edge:#94a3b8;}
        .pv-svg{display:block;min-width:100%;height:auto;}
        .pv-edge{fill:none;stroke:var(--pv-edge);stroke-width:1.6;}
        .pv-edge.soft{stroke-dasharray:5 4;opacity:.75;}
        .pv-term{font-family:'DM Mono',monospace;font-size:10px;fill:var(--ink-muted);font-weight:500;}
        .pv-node{box-sizing:border-box;width:100%;height:100%;border-radius:11px;border:1px solid var(--border);background:#fff;box-shadow:var(--sh-sm);padding:10px 13px;display:flex;flex-direction:column;justify-content:center;gap:3px;border-left:4px solid var(--border-strong);}
        .pv-node.hard{border-left-color:var(--red);}
        .pv-node.soft{border-left-color:var(--amber);}
        .pv-node.sys{background:var(--sys);border-color:#1e293b;border-left-color:var(--accent);}
        .pv-node.exit{border-left-color:var(--ink);}
        .pv-node.sys.exit{border-left-color:var(--accent);}
        .pv-node-name{font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .pv-node.sys .pv-node-name{color:var(--sys-text);}
        .pv-node-sub{font-family:'DM Sans',sans-serif;font-size:10.5px;color:var(--ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .pv-node.sys .pv-node-sub{color:var(--sys-muted);}
        .pv-empty{padding:60px 20px;text-align:center;font-size:13px;color:var(--ink-muted);}
        .btn-primary{height:32px;padding:0 18px;border-radius:7px;border:none;background:#0a0a0a;font-size:12px;font-weight:600;color:#fff;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;}
        .btn-primary:hover{background:var(--accent);box-shadow:0 4px 12px rgba(0,122,138,.25);transform:translateY(-1px);}
        .btn-primary:disabled{background:var(--border-strong);color:var(--ink-muted);cursor:not-allowed;transform:none;box-shadow:none;}
        .body-grid{display:grid;grid-template-columns:1fr 310px;min-height:calc(100vh - 58px);}
        .main-col{padding:24px 20px 32px 28px;display:flex;flex-direction:column;gap:20px;overflow-y:auto;}
        .sidebar{border-left:1px solid var(--border);background:#fff;display:flex;flex-direction:column;position:sticky;top:58px;height:calc(100vh - 58px);overflow-y:auto;}
        .scope-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-xl);box-shadow:var(--sh-sm);overflow:visible;}
        .scope-hd{padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface-raised);display:flex;align-items:center;justify-content:space-between;border-radius:var(--r-xl) var(--r-xl) 0 0;}
        .scope-icon{width:26px;height:26px;border-radius:7px;background:var(--accent-soft);border:1px solid var(--accent-border);display:flex;align-items:center;justify-content:center;color:var(--accent);}
        .scope-label{font-size:12px;font-weight:600;color:var(--ink);}
        .scope-preview{font-size:11px;color:var(--ink-muted);margin-top:1px;}
        .scope-body{padding:16px 20px;display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;}
        .addcond-wrap{position:relative;}
        .addcond-menu{position:absolute;top:38px;right:0;z-index:20;background:#fff;border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--sh-lg);padding:6px;min-width:170px;display:flex;flex-direction:column;gap:2px;}
        .addcond-empty{font-size:11px;color:var(--ink-muted);padding:8px 10px;}
        .cond-area{display:flex;flex-direction:column;gap:7px;flex:1;min-width:300px;}
        .cond-rows{display:flex;flex-direction:column;gap:7px;}
        .cond-row{display:flex;align-items:center;gap:9px;}
        .cond-dim{font-size:12.5px;font-weight:600;color:var(--ink);min-width:96px;}
        .cond-is{font-size:11px;color:var(--ink-muted);font-style:italic;}
        .cond-rm{width:22px;height:22px;border:none;background:none;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ink-muted);transition:all .15s;flex-shrink:0;}
        .cond-rm:hover{background:var(--red-soft);color:var(--red);}
        .cond-empty{font-size:12px;color:var(--ink-muted);}
        .ms{position:relative;flex:1;max-width:340px;}
        .ms-trigger{display:flex;align-items:center;gap:8px;width:100%;min-height:34px;padding:4px 10px;border-radius:var(--r-sm);border:1px solid var(--border);background:#fff;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .ms-trigger:hover{border-color:var(--accent-border);}
        .ms-any{font-size:12.5px;color:var(--ink-muted);flex:1;text-align:left;}
        .ms-vals{display:flex;flex-wrap:wrap;gap:4px;flex:1;}
        .ms-chip{font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);}
        .ms-panel{position:absolute;top:38px;left:0;right:0;z-index:25;background:#fff;border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--sh-lg);padding:5px;max-height:260px;overflow-y:auto;}
        .ms-search{display:flex;align-items:center;gap:6px;padding:6px 8px;margin-bottom:3px;border-bottom:1px solid var(--border);position:sticky;top:-5px;background:#fff;}
        .ms-search input{border:none;outline:none;background:none;font-family:'DM Sans',sans-serif;font-size:12.5px;color:var(--ink);width:100%;}
        .ms-search input::placeholder{color:var(--ink-muted);}
        .ms-none{font-size:11.5px;color:var(--ink-muted);padding:8px 10px;}
        .ms-opt{display:flex;align-items:center;justify-content:space-between;width:100%;padding:8px 10px;border-radius:var(--r-sm);border:none;background:none;cursor:pointer;font-size:12.5px;color:var(--ink-soft);font-family:'DM Sans',sans-serif;transition:all .12s;}
        .ms-opt:hover{background:var(--accent-soft);}
        .ms-opt.on{color:var(--ink);font-weight:600;}
        .ms-div{height:1px;background:var(--border);margin:4px 0;}
        .f-group{display:flex;flex-direction:column;gap:4px;min-width:148px;}
        .f-lbl{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-muted);display:flex;align-items:center;justify-content:space-between;}
        .f-inp,.f-sel{height:34px;padding:0 10px;border-radius:var(--r-sm);border:1px solid var(--border);background:#fff;color:var(--ink);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:all .15s;width:100%;}
        .f-inp:focus,.f-sel:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid);}
        .f-inp::placeholder{color:var(--ink-muted);}
        .x-btn{width:15px;height:15px;border:none;background:none;cursor:pointer;color:var(--ink-muted);display:flex;align-items:center;justify-content:center;border-radius:3px;padding:0;transition:all .15s;}
        .x-btn:hover{color:var(--red);background:var(--red-soft);}
        .add-field-btn{height:34px;padding:0 12px;border-radius:var(--r-sm);border:1px dashed var(--border-strong);background:transparent;font-size:11px;font-weight:500;color:var(--ink-muted);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:4px;font-family:'DM Sans',sans-serif;align-self:flex-end;white-space:nowrap;}
        .add-field-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
        .canvas-wrap{background:#fff;border:1px solid var(--border);border-radius:var(--r-xl);box-shadow:var(--sh-sm);overflow:hidden;transition:border-color .2s,box-shadow .2s;}
        .canvas-wrap.drag-on{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid),var(--sh-md);}
        .canvas-wrap.exit{background:var(--exit-tint);}
        .canvas-hd{padding:14px 20px;border-bottom:1px solid var(--border);background:var(--surface-raised);display:flex;align-items:center;justify-content:space-between;}
        .canvas-hd h2{font-size:13px;font-weight:600;color:var(--ink);}
        .canvas-hd p{font-size:11px;color:var(--ink-muted);margin-top:1px;}
        .canvas-body{padding:20px;min-height:260px;}
        /* mode toggle */
        .mode-seg{display:inline-flex;border:1px solid var(--border-strong);border-radius:8px;overflow:hidden;background:#fff;}
        .mode-btn{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;border:none;background:#fff;color:var(--ink-muted);font-size:11.5px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .12s;}
        .mode-btn+.mode-btn{border-left:1px solid var(--border);}
        .mode-btn.on{color:var(--ink);background:var(--surface-raised);}
        .mode-btn.on.exit{background:var(--ink);color:#fff;}
        .derive-note{display:flex;align-items:center;gap:7px;margin-bottom:14px;padding:9px 13px;border-radius:var(--r-md);background:var(--exit-tint);border:1px solid var(--border-strong);font-size:11.5px;color:var(--ink-soft);}
        .derive-note strong{color:var(--ink);font-weight:600;}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px 20px;gap:10px;}
        .empty-icon{width:50px;height:50px;border-radius:14px;background:var(--surface-raised);border:2px dashed var(--border-strong);display:flex;align-items:center;justify-content:center;color:var(--ink-muted);margin-bottom:4px;}
        .empty-state h3{font-size:14px;font-weight:600;color:var(--ink-soft);}
        .empty-state p{font-size:12px;color:var(--ink-muted);text-align:center;max-width:220px;line-height:1.5;}
        .drop-hint{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 14px;border-radius:var(--r-md);background:var(--accent-soft);border:1px dashed var(--accent-border);font-size:12px;font-weight:500;color:var(--accent);animation:hint-pulse 1.4s ease-in-out infinite;}
        @keyframes hint-pulse{0%,100%{opacity:1}50%{opacity:.65}}
        .drop-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;animation:dot-p 1.4s ease-in-out infinite;}
        @keyframes dot-p{0%,100%{transform:scale(1)}50%{transform:scale(.7)}}
        .link-banner{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;margin-bottom:12px;border-radius:var(--r-md);background:var(--amber-soft);border:1px solid var(--amber-border);}
        .link-banner-txt{font-size:12px;font-weight:500;color:var(--amber);display:flex;align-items:center;gap:6px;}
        .circ-warn{display:flex;align-items:center;gap:6px;padding:8px 12px;margin-bottom:12px;border-radius:7px;background:var(--red-soft);border:1px solid var(--red-border);font-size:11px;font-weight:500;color:var(--red);}
        .connector{display:flex;flex-direction:column;align-items:center;margin:0 auto;width:40px;}
        .conn-line{width:2px;height:14px;}
        .conn-line.hard{background:#fca5a5;}
        .conn-line.soft{background:#fcd34d;}
        .conn-line.exit{background:var(--border-strong);}
        .conn-arrow{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;}
        .conn-arrow.hard{border-top:6px solid #f87171;}
        .conn-arrow.soft{border-top:6px solid #f59e0b;}
        .conn-arrow.exit{border-top:6px solid var(--ink-muted);}
        .m-block{border:1px solid var(--border);border-radius:var(--r-lg);background:#fff;cursor:pointer;transition:all .2s cubic-bezier(.4,0,.2,1);overflow:hidden;position:relative;}
        .m-block:hover{border-color:var(--accent-border);box-shadow:var(--sh-md);transform:translateY(-1px);}
        .m-block.sel{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid),var(--sh-md);transform:translateY(-1px);}
        .m-block.issues{border-color:var(--red-border);}
        .m-block.issues:hover{border-color:var(--red);}
        .m-block.lsrc{border-color:var(--amber);box-shadow:0 0 0 3px var(--amber-soft);}
        .m-block.exit{cursor:default;}
        .m-block.exit:hover{transform:none;box-shadow:var(--sh-sm);border-color:var(--border-strong);}
        .accent-bar{position:absolute;left:0;top:0;bottom:0;width:4px;}
        .accent-bar.hard{background:var(--red);}
        .accent-bar.soft{background:var(--amber);}
        .accent-bar.exit{background:var(--ink);}
        .m-block-hd{padding:11px 14px 11px 18px;display:flex;align-items:center;gap:9px;}
        .blk-drag{color:var(--ink-muted);cursor:grab;flex-shrink:0;padding:2px;border-radius:4px;transition:color .15s;}
        .grabbable{cursor:grab;}
        .grabbable:active{cursor:grabbing;}
        .m-block.dragging,.s-block.dragging{opacity:.4;}
        body.reordering{user-select:none;cursor:grabbing;}
        body.reordering *{cursor:grabbing !important;}
        .drop-line{height:3px;background:var(--accent);border-radius:2px;margin:5px 2px;position:relative;animation:dlpop .12s ease;}
        .drop-line::before{content:'';position:absolute;left:-2px;top:-3px;width:9px;height:9px;border-radius:50%;background:var(--accent);}
        @keyframes dlpop{from{transform:scaleX(.96);opacity:.4;}to{transform:scaleX(1);opacity:1;}}
        .blk-drag:hover{color:var(--accent);}
        .blk-drag:active{cursor:grabbing;}
        .blk-num{width:22px;height:22px;border-radius:5px;flex-shrink:0;border:1.5px solid var(--ink);background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--ink);font-family:'DM Mono',monospace;transition:all .2s;}
        .m-block.sel .blk-num{background:var(--accent);border-color:var(--accent);color:#fff;}
        .m-block.exit .blk-num{background:var(--ink);border-color:var(--ink);color:#fff;}
        .blk-name{font-size:13px;font-weight:600;color:var(--ink);flex:1;display:flex;align-items:center;gap:6px;}
        .blk-badges{display:flex;align-items:center;gap:5px;flex-shrink:0;}
        .acct-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 3px;border-radius:100px;font-size:9.5px;font-weight:600;background:var(--surface-raised);border:1px solid var(--border);color:var(--ink-soft);}
        .acct-pill .bx-ava{width:15px;height:15px;font-size:6px;}
        .acctf{position:relative;}
        .acctf-trigger{display:flex;align-items:center;gap:8px;width:100%;height:42px;padding:0 12px;border-radius:var(--r-sm);border:1px solid var(--border);background:#fff;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .acctf-trigger:hover{border-color:var(--accent-border);}
        .acctf-role{font-size:12.5px;font-weight:600;color:var(--ink);flex-shrink:0;}
        .acctf-names{font-size:11px;color:var(--ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .acctf-panel{position:absolute;top:46px;left:0;right:0;z-index:20;background:#fff;border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--sh-lg);padding:6px;max-height:280px;overflow-y:auto;}
        .acctf-cap{font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-muted);padding:6px 8px 8px;}
        .acctf-opt{display:flex;align-items:center;gap:9px;width:100%;padding:8px 9px;border-radius:var(--r-sm);border:none;background:none;cursor:pointer;text-align:left;font-family:'DM Sans',sans-serif;transition:all .12s;}
        .acctf-opt:hover{background:var(--accent-soft);}
        .acctf-opt.on{background:var(--accent-soft);}
        .acctf-opt-main{display:flex;flex-direction:column;flex:1;min-width:0;}
        .acctf-opt-role{font-size:12.5px;font-weight:600;color:var(--ink);}
        .acctf-opt-people{font-size:10.5px;color:var(--ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .gate-pill{padding:2px 7px;border-radius:100px;font-size:10px;font-weight:600;flex-shrink:0;}
        .gate-pill.hard{background:var(--red-soft);border:1px solid var(--red-border);color:var(--red);}
        .gate-pill.soft{background:var(--amber-soft);border:1px solid var(--amber-border);color:var(--amber);}
        .issue-dot{width:6px;height:6px;border-radius:50%;background:var(--red);flex-shrink:0;animation:issue-p 2s ease-in-out infinite;}
        @keyframes issue-p{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
        .blk-rm{width:22px;height:22px;border:none;background:none;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ink-muted);transition:all .15s;flex-shrink:0;}
        .blk-rm:hover{background:var(--red-soft);color:var(--red);}
        .blk-expand{max-height:0;overflow:hidden;transition:max-height .3s cubic-bezier(.4,0,.2,1);}
        .blk-expand.open{max-height:640px;}
        .blk-expand-in{padding:4px 14px 12px 18px;border-top:1px solid var(--border);}
        .blk-issues-box{margin:0 14px 10px 18px;padding:8px 10px;border-radius:7px;background:var(--red-soft);border:1px solid var(--red-border);display:flex;flex-direction:column;gap:3px;}
        .blk-issue-row{font-size:11px;color:var(--red);display:flex;align-items:center;gap:5px;}
        /* rich requirement rows */
        .bx-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);}
        .bx-row:last-child{border-bottom:none;}
        .bx-row.exit{}
        .bx-row-name{font-size:12px;color:var(--ink-soft);flex:1;display:flex;align-items:center;gap:6px;min-width:0;}
        .bx-row-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
        .req-src{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:1px 5px;border-radius:3px;background:var(--accent-soft);color:var(--accent);}
        .bx-nova{display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:600;padding:1px 6px;border-radius:100px;background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);}
        .bx-approver{display:inline-flex;align-items:center;gap:6px;}
        .bx-role{font-size:11px;font-weight:600;color:var(--ink-soft);}
        .bx-int{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--ink-soft);}
        .bx-run{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:100px;}
        .bx-run.auto{background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);}
        .bx-run.team{background:var(--surface-raised);border:1px solid var(--border);color:var(--ink-soft);}
        .bx-when{font-size:10px;color:var(--ink-muted);font-family:'DM Mono',monospace;}
        .bx-ava-stack{display:inline-flex;align-items:center;}
        .bx-ava-stack .bx-ava:not(:first-child){margin-left:-7px;}
        .bx-ava{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:700;font-family:'DM Sans',sans-serif;border:1.5px solid #fff;flex-shrink:0;letter-spacing:-.02em;}
        .bx-ava.more{width:20px;height:20px;background:var(--surface-raised);color:var(--ink-soft);font-size:9px;border:1.5px solid #fff;}
        /* System Block */
        .s-block{border-radius:var(--r-lg);overflow:hidden;cursor:pointer;transition:all .2s cubic-bezier(.4,0,.2,1);border:1px solid #1e293b;box-shadow:var(--sh-sm);}
        .s-block:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(15,23,42,.22);border-color:var(--accent);}
        .s-block.sel{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid),0 4px 16px rgba(15,23,42,.22);transform:translateY(-1px);}
        .s-block.issues{border-color:#7f1d1d;}
        .s-block.lsrc{border-color:var(--amber);}
        .s-hd{background:var(--sys);padding:11px 14px;display:flex;align-items:center;gap:9px;}
        .s-num{width:22px;height:22px;border-radius:5px;flex-shrink:0;border:1.5px solid #334155;background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--sys-text);font-family:'DM Mono',monospace;transition:all .2s;}
        .s-block.sel .s-num{background:var(--accent);border-color:var(--accent);color:#fff;}
        .s-name{font-size:13px;font-weight:600;color:var(--sys-text);flex:1;display:flex;align-items:center;gap:7px;}
        .s-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:100px;background:rgba(0,122,138,.22);border:1px solid rgba(0,122,138,.38);font-size:9px;font-weight:600;color:#67e8f9;text-transform:uppercase;letter-spacing:.07em;}
        .s-cog{animation:spin 4s linear infinite;}
        .s-block:not(:hover) .s-cog{animation-play-state:paused;}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .s-body{background:#131f35;padding:10px 14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
        .s-chip{font-size:10px;font-weight:500;padding:3px 8px;border-radius:5px;background:#1e293b;border:1px solid #334155;color:var(--sys-muted);font-family:'DM Mono',monospace;display:flex;align-items:center;gap:4px;}
        .s-chip.ok{color:#34d399;border-color:rgba(52,211,153,.25);}
        .s-chip.warn{color:#fbbf24;border-color:rgba(251,191,36,.25);}
        .s-chip.err{color:#f87171;border-color:rgba(248,113,113,.25);}
        .s-chip.exit{color:#67e8f9;border-color:rgba(0,122,138,.4);}
        .s-rm{width:22px;height:22px;border:none;background:none;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#475569;transition:all .15s;flex-shrink:0;margin-left:auto;}
        .s-rm:hover{background:rgba(248,113,113,.15);color:#f87171;}
        .sb-section{border-bottom:1px solid var(--border);padding:16px;}
        .sb-title{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:12px;display:flex;align-items:center;gap:6px;}
        .health-card{border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border);background:#fff;}
        .health-hd{padding:11px 14px;background:var(--surface-raised);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:7px;}
        .health-title{font-size:12px;font-weight:600;color:var(--ink);}
        .health-score{margin-left:auto;font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;}
        .health-score.good{background:var(--green-soft);color:var(--green);border:1px solid var(--green-border);}
        .health-score.bad{background:var(--red-soft);color:var(--red);border:1px solid var(--red-border);}
        .health-score.warn{background:var(--amber-soft);color:var(--amber);border:1px solid var(--amber-border);}
        .health-body{padding:12px 14px;display:flex;flex-direction:column;gap:7px;}
        .stat-row{display:flex;align-items:center;justify-content:space-between;}
        .stat-lbl{font-size:11px;color:var(--ink-muted);display:flex;align-items:center;gap:5px;}
        .stat-val{font-size:12px;font-weight:700;color:var(--ink);font-family:'DM Mono',monospace;}
        .stat-val.good{color:var(--green);}
        .stat-val.bad{color:var(--red);}
        .stat-val.accent{color:var(--accent);}
        .checklist{display:flex;flex-direction:column;gap:4px;padding-top:8px;border-top:1px solid var(--border);margin-top:2px;}
        .chk-item{display:flex;align-items:center;gap:6px;font-size:11px;}
        .chk-item.pass{color:var(--green);}
        .chk-item.fail{color:var(--ink-muted);}
        .save-wrap{padding:14px 16px;border-top:1px solid var(--border);background:var(--surface-raised);}
        .save-btn{width:100%;height:36px;border-radius:8px;border:none;background:#0a0a0a;color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px;font-family:'DM Sans',sans-serif;}
        .save-btn:hover:not(:disabled){background:var(--accent);box-shadow:0 4px 12px rgba(0,122,138,.25);transform:translateY(-1px);}
        .save-btn:disabled{background:var(--border-strong);color:var(--ink-muted);cursor:not-allowed;transform:none;}
        .save-btn.success{background:var(--green)!important;}
        .save-hint{font-size:10px;color:var(--ink-muted);text-align:center;margin-top:8px;line-height:1.5;}
        .save-hint.ready{color:var(--green);}
        .lib-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
        .lib-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:12px 6px;border-radius:var(--r-md);border:1.5px dashed var(--border-strong);background:#fff;cursor:pointer;transition:all .2s;font-family:'DM Sans',sans-serif;}
        .lib-btn:hover{border-color:var(--accent);background:var(--accent-soft);transform:translateY(-1px);box-shadow:var(--sh-md);}
        .lib-btn-icon{width:28px;height:28px;border-radius:7px;background:var(--surface-raised);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;transition:all .2s;}
        .lib-btn:hover .lib-btn-icon{background:var(--accent);border-color:var(--accent);color:#fff;}
        .lib-btn-lbl{font-size:10px;font-weight:600;color:var(--ink-soft);text-align:center;}
        .icard{border:1px solid var(--border);border-radius:var(--r-md);background:#fff;padding:10px;margin-bottom:8px;transition:all .2s;position:relative;}
        .icard:last-child{margin-bottom:0;}
        .icard.drag{cursor:grab;}
        .icard.drag:hover{border-color:var(--accent-border);background:var(--accent-soft);transform:translateY(-1px);box-shadow:var(--sh-md);}
        .icard.drag:active{cursor:grabbing;}
        .icard.used{opacity:.4;cursor:not-allowed;background:var(--surface-raised);}
        .icard.sys{border-left:3px solid #334155;}
        .icard.sys.drag:hover{border-left-color:var(--accent);}
        .icard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:6px;}
        .icard-name{font-size:12px;font-weight:600;color:var(--ink);}
        .icard-meta{display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:wrap;}
        .icard-acts{display:flex;align-items:center;gap:2px;flex-shrink:0;}
        .icard-act{font-size:11px;font-weight:500;color:var(--ink-muted);background:none;border:none;cursor:pointer;padding:2px 5px;border-radius:4px;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .icard-act:hover{background:var(--surface-raised);color:var(--ink);}
        .icard-act.del:hover{background:var(--red-soft);color:var(--red);}
        .icard-reqs{list-style:none;display:flex;flex-direction:column;gap:2px;}
        .icard-req{font-size:10px;color:var(--ink-soft);display:flex;align-items:center;gap:4px;}
        .icard-req::before{content:'';width:3px;height:3px;border-radius:50%;background:var(--ink-muted);flex-shrink:0;}
        .added-badge{display:inline-flex;align-items:center;gap:2px;padding:1px 5px;border-radius:100px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;background:var(--green-soft);color:var(--green);border:1px solid var(--green-border);}
        .sys-icard-pill{font-size:9px;font-weight:600;padding:1px 5px;border-radius:100px;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;display:inline-flex;align-items:center;gap:3px;}
        .overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(10,10,10,.45);backdrop-filter:blur(4px);padding:16px;}
        .modal{width:100%;max-width:540px;background:#fff;border-radius:var(--r-xl);box-shadow:var(--sh-lg);overflow:hidden;animation:modal-in .2s cubic-bezier(.4,0,.2,1);}
        @keyframes modal-in{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .modal-hd{padding:14px 18px;border-bottom:1px solid var(--border);background:var(--surface-raised);display:flex;align-items:center;justify-content:space-between;}
        .modal-title{font-size:13px;font-weight:600;color:var(--ink);}
        .modal-x{width:26px;height:26px;border:1px solid var(--border);background:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-muted);transition:all .15s;}
        .modal-x:hover{background:var(--red-soft);color:var(--red);border-color:var(--red-border);}
        .modal-body{padding:18px;display:flex;flex-direction:column;gap:14px;max-height:60vh;overflow-y:auto;}
        .modal-ft{padding:12px 18px;border-top:1px solid var(--border);background:var(--surface-raised);display:flex;align-items:center;justify-content:space-between;}
        .form-grp{display:flex;flex-direction:column;gap:5px;}
        .form-lbl{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-muted);}
        .form-inp,.form-sel{height:36px;padding:0 11px;border-radius:var(--r-sm);border:1px solid var(--border);background:#fff;font-size:13px;color:var(--ink);font-family:'DM Sans',sans-serif;outline:none;transition:all .15s;width:100%;}
        .form-inp:focus,.form-sel:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid);}
        .form-inp::placeholder{color:var(--ink-muted);}
        .gate-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .gate-opt{padding:10px 11px;border-radius:var(--r-sm);border:1.5px solid var(--border);cursor:pointer;background:#fff;text-align:left;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .gate-opt.h{border-color:var(--red);background:var(--red-soft);}
        .gate-opt.s{border-color:var(--amber);background:var(--amber-soft);}
        .gate-opt-lbl{font-size:12px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:4px;}
        .gate-opt-desc{font-size:10px;color:var(--ink-muted);margin-top:2px;}
        .req-chips{display:flex;flex-wrap:wrap;gap:5px;min-height:38px;padding:8px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--surface-raised);}
        .req-chip{display:flex;align-items:center;gap:5px;padding:3px 7px 3px 9px;border-radius:100px;border:1px solid var(--border);background:#fff;font-size:11px;font-weight:500;color:var(--ink-soft);}
        .req-chip select{border:none;background:none;font-size:10px;color:var(--ink-muted);font-family:'DM Sans',sans-serif;cursor:pointer;outline:none;padding:0;}
        .chip-x{width:13px;height:13px;border:none;background:none;cursor:pointer;color:var(--ink-muted);display:flex;align-items:center;justify-content:center;padding:0;border-radius:50%;transition:all .15s;}
        .chip-x:hover{background:var(--red-soft);color:var(--red);}
        .req-list{display:flex;flex-direction:column;gap:3px;}
        .req-list-item{display:flex;align-items:center;justify-content:space-between;padding:8px 11px;border-radius:var(--r-sm);border:1px solid var(--border);background:#fff;cursor:pointer;font-size:12px;color:var(--ink-soft);font-family:'DM Sans',sans-serif;transition:all .15s;}
        .req-list-item:hover{border-color:var(--accent-border);background:var(--accent-soft);color:var(--ink);}
        .req-list-own{font-size:10px;color:var(--ink-muted);font-weight:500;}
        .api-box{padding:12px;border-radius:var(--r-md);border:1px solid var(--border);background:var(--surface-raised);display:flex;flex-direction:column;gap:10px;}
        .api-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .ep-wrap{position:relative;}
        .ep-status{position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:12px;}
        .field-opt{padding:9px 12px;border-radius:var(--r-sm);border:1px solid var(--border);background:#fff;cursor:pointer;font-size:13px;color:var(--ink-soft);text-align:left;width:100%;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .field-opt:hover{border-color:var(--accent-border);background:var(--accent-soft);color:var(--ink);}
        .ghost{position:fixed;z-index:9999;pointer-events:none;width:224px;}
        .ghost-inner{transform:translate(-50%,-50%) rotate(1.5deg);background:#fff;border:1.5px solid var(--accent-border);border-radius:var(--r-md);padding:11px;box-shadow:0 16px 32px rgba(0,122,138,.14),0 4px 8px rgba(0,0,0,.08);}
        .ghost-name{font-size:12px;font-weight:600;color:var(--ink);margin-bottom:5px;display:flex;align-items:center;justify-content:space-between;}
        .scrollbar-thin::-webkit-scrollbar{width:4px;}
        .scrollbar-thin::-webkit-scrollbar-track{background:transparent;}
        .scrollbar-thin::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:2px;}
        /* modal: completion rule + rich requirement rows */
        .lbl-hint{text-transform:none;letter-spacing:0;font-weight:400;color:var(--ink-muted);}
        .lbl-suggest{font-size:10px;color:var(--accent);margin-top:5px;display:block;}
        .comp-pill{display:inline-flex;align-items:center;padding:2px 7px;border-radius:100px;font-size:9.5px;font-weight:700;background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);letter-spacing:.02em;}
        .comp-seg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
        .comp-seg button{height:34px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:#fff;font-size:11.5px;font-weight:600;color:var(--ink-muted);cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .comp-seg button:hover{border-color:var(--accent-border);color:var(--accent);}
        .comp-seg button.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);}
        .comp-n{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:var(--ink-soft);}
        .comp-n input{width:56px;height:32px;text-align:center;border-radius:var(--r-sm);border:1px solid var(--border);background:#fff;font-size:13px;font-family:'DM Mono',monospace;color:var(--ink);outline:none;}
        .comp-n input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid);}
        .comp-readout{display:flex;align-items:center;gap:5px;margin-top:9px;font-size:11px;color:var(--ink-soft);background:var(--surface-raised);border:1px solid var(--border);border-radius:7px;padding:7px 10px;}
        .msel-list{display:flex;flex-direction:column;gap:6px;}
        .msel-empty{font-size:11.5px;color:var(--ink-muted);line-height:1.5;padding:10px 12px;border:1px dashed var(--border-strong);border-radius:var(--r-sm);background:var(--surface-raised);}
        .msel-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-md);border:1px solid var(--border);background:#fff;transition:all .15s;}
        .msel-row.opt{background:var(--surface-raised);border-style:dashed;}
        .msel-main{flex:1;min-width:0;}
        .msel-name{font-size:12.5px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:5px;}
        .msel-scope{font-size:9px;font-weight:600;padding:1px 6px;border-radius:100px;background:var(--amber-soft);border:1px solid var(--amber-border);color:var(--amber);}
        .msel-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
        .msel-owner{font-size:10px;font-weight:600;padding:2px 8px;border-radius:100px;border:1px solid;}
        .msel-dot{color:var(--ink-muted);font-size:10px;}
        .msel-approver{display:inline-flex;align-items:center;gap:5px;}
        .msel-unwind{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--ink-soft);font-weight:500;}
        .msel-right{display:flex;align-items:center;gap:6px;flex-shrink:0;}
        .reqopt{height:26px;padding:0 11px;border-radius:100px;border:1px solid var(--border-strong);background:#fff;font-size:10.5px;font-weight:700;color:var(--ink-muted);cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .reqopt:hover{border-color:var(--accent-border);}
        .reqopt.on-opt{background:var(--amber-soft);border-color:var(--amber-border);color:var(--amber);}
        .mavail{margin-top:12px;border-top:1px solid var(--border);padding-top:10px;display:flex;flex-direction:column;gap:4px;}
        .mavail-hd{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:3px;}
        .mavail-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 11px;border-radius:var(--r-sm);border:1px solid var(--border);background:#fff;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .mavail-row:hover{border-color:var(--accent-border);background:var(--accent-soft);}
        .mavail-name{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--ink);}
        .mavail-name svg{color:var(--ink-muted);}
        .mavail-row:hover .mavail-name svg{color:var(--accent);}
        .mavail-meta{display:flex;align-items:center;gap:7px;flex-shrink:0;}
        .mavail-ap{font-size:10.5px;color:var(--ink-muted);font-weight:500;}
        /* system block contract */
        .comp-seg.three{grid-template-columns:1fr 1fr 1fr;}
        .intg-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .intg-card{position:relative;display:flex;flex-direction:column;gap:3px;padding:11px 12px;border-radius:var(--r-md);border:1.5px solid var(--border);background:#fff;cursor:pointer;text-align:left;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .intg-card:hover{border-color:var(--accent-border);background:var(--accent-soft);}
        .intg-card.on{border-color:var(--accent);background:var(--accent-soft);box-shadow:0 0 0 3px var(--accent-mid);}
        .intg-top{display:flex;align-items:center;justify-content:space-between;}
        .intg-name{font-size:12.5px;font-weight:600;color:var(--ink);}
        .intg-blurb{font-size:10.5px;color:var(--ink-muted);}
        .kind-dot{width:7px;height:7px;border-radius:50%;}
        .kind-dot.provision{background:var(--accent);}
        .kind-dot.fulfill{background:#7c3aed;}
        .kind-dot.sync{background:var(--ink-muted);}
        .kind-tag{align-self:flex-start;margin-top:3px;font-size:8.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:1px 6px;border-radius:100px;}
        .kind-tag.provision{background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);}
        .kind-tag.fulfill{background:#f5f3ff;border:1px solid #ddd6fe;color:#7c3aed;}
        .kind-tag.sync{background:var(--surface-raised);border:1px solid var(--border);color:var(--ink-soft);}
        .s-kind{font-size:8.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:100px;background:rgba(0,122,138,.22);border:1px solid rgba(0,122,138,.4);color:#67e8f9;}
        .dir-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .dir-toggle{display:flex;align-items:center;gap:6px;height:42px;padding:0 13px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:#fff;font-size:12.5px;font-weight:600;color:var(--ink-muted);cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .dir-toggle span{font-size:10.5px;font-weight:400;color:var(--ink-muted);margin-left:2px;}
        .dir-toggle:hover{border-color:var(--accent-border);}
        .dir-toggle.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);}
        .dir-toggle.on span{color:var(--accent);}
        .conn-status{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--ink-soft);background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--r-sm);padding:9px 12px;}
        .conn-dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px var(--green-soft);flex-shrink:0;}
        .dataflow{border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface-raised);padding:12px;display:flex;flex-direction:column;gap:9px;}
        .df-line{display:flex;align-items:center;gap:7px;}
        .df-end{font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:100px;letter-spacing:.02em;}
        .df-end.levv{background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);}
        .df-end.sys{background:#fff;border:1px solid var(--border-strong);color:var(--ink-soft);}
        .df-arrow{color:var(--ink-muted);display:flex;}
        .df-cap{font-size:10px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-left:2px;}
        .df-fields{display:flex;flex-wrap:wrap;gap:5px;}
        .df-chip{font-size:10.5px;font-weight:500;padding:3px 9px;border-radius:100px;border:1px solid var(--border);background:#fff;color:var(--ink-muted);cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .12s;}
        .df-chip:hover{border-color:var(--accent-border);color:var(--accent);}
        .df-chip.on{background:var(--accent);border-color:var(--accent);color:#fff;}
        .df-wb{height:32px;font-size:12px;}
        .df-nova{display:flex;align-items:flex-start;gap:5px;font-size:10.5px;color:var(--accent);line-height:1.45;margin-top:1px;}
        .df-nova svg{flex-shrink:0;margin-top:1px;}
        .sys-rev{border:1px solid var(--border);border-radius:var(--r-md);background:#fff;padding:11px 12px;display:flex;flex-direction:column;gap:9px;}
        .sys-rev-body{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink);}
        .sys-rev-body strong{font-weight:600;}
        .sys-rev-auto{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:100px;background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);margin-left:auto;}
        .recon-row{display:flex;align-items:flex-start;gap:8px;font-size:11px;color:var(--ink-soft);line-height:1.45;cursor:pointer;padding-top:9px;border-top:1px solid var(--border);}
        .recon-row input{margin-top:2px;accent-color:var(--accent);width:14px;height:14px;flex-shrink:0;cursor:pointer;}
        .recon-row strong{color:var(--ink);font-weight:600;}
        .sys-rev.none{flex-direction:row;align-items:center;gap:7px;font-size:11.5px;color:var(--ink-muted);background:var(--surface-raised);}
      `}</style>

      <div className={`pa-root ${activeDragBlock ? 'select-none' : ''}`} style={{ cursor: activeDragBlock ? 'grabbing' : 'auto' }}>

        {/* HEADER */}
        <header className="hd">
          <div className="hd-l">
            <a href="/admin/workers/onboarding" className="back-link">
              <ChevronRight style={{ transform: 'rotate(180deg)', width: 13, height: 13 }} />
              Onboarding
            </a>
            <div className="hdiv" />
            <div className="hd-title">
              Onboarding &amp; Offboarding
            </div>
          </div>
          <button className={`btn-ghost ${view === 'process' ? 'on' : ''}`} onClick={() => setView(v => v === 'process' ? 'build' : 'process')}>
            <Workflow style={{ width: 13, height: 13, marginRight: 5, display: 'inline', verticalAlign: '-2px' }} />
            {view === 'process' ? 'Back to builder' : 'Process view'}
          </button>
        </header>

        {/* BODY */}
        <div className="body-grid">

          {/* ── MAIN COLUMN ── */}
          <div className="main-col">

            {view === 'process' ? (
              <div className="pv-panel">
                <div className="pv-head">
                  <div>
                    <h2>Process view</h2>
                    <p>{mode === 'onboarding' ? 'Hard gates sequence the flow · soft gates run in parallel' : 'Offboarding flow — every registered unwind, in reverse'}</p>
                  </div>
                  <div className="mode-seg">
                    <button className={`mode-btn ${mode === 'onboarding' ? 'on' : ''}`} onClick={() => setMode('onboarding')}><ArrowRight style={{ width: 12, height: 12 }} /> Onboarding</button>
                    <button className={`mode-btn ${mode === 'offboarding' ? 'on exit' : ''}`} onClick={() => setMode('offboarding')}><RotateCcw style={{ width: 12, height: 12 }} /> Offboarding</button>
                  </div>
                </div>
                <ProcessView blocks={blocks} dependencies={dependencies} mode={mode} />
              </div>
            ) : (
            <>
            {/* APPLIES-TO */}
            <div className="scope-card">
              <div className="scope-hd">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="scope-icon"><Shield style={{ width: 13, height: 13 }} /></div>
                  <div>
                    {policyName && <div className="scope-label">{policyName}</div>}
                    <div className="scope-preview">Applies to {scopeSummary}</div>
                  </div>
                </div>
                <div className="addcond-wrap">
                  <button className="add-field-btn" onClick={() => setShowAddCond(s => !s)}>
                    <Plus style={{ width: 11, height: 11 }} /> Add condition
                  </button>
                  {showAddCond && (
                    <div className="addcond-menu">
                      {Object.keys(DIMENSIONS).filter(d => !conditions.some(c => c.dimension === d)).map(d => (
                        <button key={d} className="field-opt" onClick={() => addCondition(d)}>{d}</button>
                      ))}
                      {Object.keys(DIMENSIONS).filter(d => !conditions.some(c => c.dimension === d)).length === 0 && (
                        <div className="addcond-empty">Every condition is in use</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="scope-body">
                <div className="f-group" style={{ minWidth: 230 }}>
                  <span className="f-lbl">Policy name</span>
                  <input type="text" value={policyName} onChange={e => setPolicyName(e.target.value)} className="f-inp" placeholder="e.g. US SOW Worker" />
                </div>
                <div className="cond-area">
                  <span className="f-lbl">Applies to workers where</span>
                  <div className="cond-rows">
                    {conditions.map(c => (
                      <div key={c.id} className="cond-row">
                        <span className="cond-dim">{c.dimension}</span>
                        <span className="cond-is">is</span>
                        <MultiSelect options={DIMENSIONS[c.dimension] ?? []} values={c.values} onChange={v => setCondValues(c.id, v)} />
                        <button className="cond-rm" onClick={() => removeCondition(c.id)}><X style={{ width: 11, height: 11 }} /></button>
                      </div>
                    ))}
                    {conditions.length === 0 && <span className="cond-empty">No conditions — this policy applies to all workers.</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* CANVAS */}
            <div ref={canvasRef} className={`canvas-wrap ${activeDragBlock ? 'drag-on' : ''} ${mode === 'offboarding' ? 'exit' : ''}`}>
              <div className="canvas-hd">
                <div>
                  <h2>{mode === 'onboarding' ? 'Onboarding Pipeline' : 'Offboarding — derived'}</h2>
                  <p>{mode === 'onboarding'
                    ? 'Drag blocks from the right · Click a block to inspect · Executes top to bottom'
                    : 'Every grant’s unwind, executed in reverse gate order · Read-only'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {mode === 'onboarding' && linkFromId && <button className="btn-ghost" style={{ fontSize: 11, height: 28 }} onClick={() => setLinkFromId(null)}>Cancel Link</button>}
                  <div className="mode-seg">
                    <button className={`mode-btn ${mode === 'onboarding' ? 'on' : ''}`} onClick={() => { setMode('onboarding') }}>
                      <ArrowRight style={{ width: 12, height: 12 }} /> Onboarding
                    </button>
                    <button className={`mode-btn ${mode === 'offboarding' ? 'on exit' : ''}`} onClick={() => { setMode('offboarding'); setSelectedBlockId(null); setLinkFromId(null) }}>
                      <RotateCcw style={{ width: 12, height: 12 }} /> Offboarding
                    </button>
                  </div>
                </div>
              </div>
              <div className="canvas-body">
                {mode === 'offboarding' && blocks.length > 0 && (
                  <div className="derive-note">
                    <RotateCcw style={{ width: 13, height: 13, color: 'var(--ink)', flexShrink: 0 }} />
                    <span>This isn’t authored — it’s <strong>derived</strong> from the onboarding blocks above. Each requirement’s registered unwind runs in reverse, <strong>{autoUnwinds}</strong> automatically via Nova, <strong>{manualUnwinds}</strong> in a team’s queue.</span>
                  </div>
                )}
                {mode === 'onboarding' && circularWarning && <div className="circ-warn"><AlertTriangle style={{ width: 12, height: 12 }} />{circularWarning}</div>}
                {mode === 'onboarding' && linkFromId && (
                  <div className="link-banner">
                    <span className="link-banner-txt"><Link2 style={{ width: 12, height: 12 }} />Select a block to create dependency</span>
                    <button className="btn-ghost" style={{ fontSize: 11, height: 26 }} onClick={() => setLinkFromId(null)}>Cancel</button>
                  </div>
                )}
                {activeDragBlock && (
                  <div className="drop-hint"><div className="drop-dot" />Drop to add <strong style={{ marginLeft: 3 }}>{activeDragBlock.name}</strong></div>
                )}

                {blocks.length === 0 && !activeDragBlock ? (
                  <div className="empty-state">
                    <div className="empty-icon"><ArrowDown style={{ width: 22, height: 22 }} /></div>
                    <h3>No steps yet</h3>
                    <p>Drag a block from the right panel to start building the onboarding pipeline.</p>
                  </div>
                ) : (
                  <div ref={canvasListRef} style={{ display: 'flex', flexDirection: 'column' }}>
                    {orderedBlocks.map((block, idx) => {
                      const isSel = selectedBlockId === block.id && editable
                      const isLSrc = linkFromId === block.id
                      const issues = blockIssuesMap.get(block.id) ?? []
                      const hasIssues = issues.length > 0 && editable
                      const isSys = block.type === 'SYSTEM'
                      const displayNum = idx + 1
                      const expanded = isSel || mode === 'offboarding'
                      const acct = block.accountableOwner

                      return (
                        <React.Fragment key={block.id}>
                          {dragId && dropIdx === idx && editable && <div className="drop-line" />}
                          {isSys ? (
                            /* SYSTEM BLOCK */
                            <div
                              data-bid={block.id}
                              className={`s-block ${isSel ? 'sel' : ''} ${hasIssues ? 'issues' : ''} ${isLSrc ? 'lsrc' : ''} ${editable ? 'grabbable' : ''} ${dragId === block.id ? 'dragging' : ''}`}
                              onMouseDown={e => onBlockMouseDown(e, block.id)}
                            >
                              <div className="s-hd">
                                <div className="s-num">{displayNum}</div>
                                <div className="s-name">
                                  <Cog className="s-cog" style={{ width: 13, height: 13, color: '#67e8f9' }} />
                                  {block.name}
                                  {(block.push || block.pull) && <span className="s-kind">{block.push && block.pull ? 'Push · Pull' : block.push ? 'Push' : 'Pull'}</span>}
                                </div>
                                {hasIssues && <div className="issue-dot" />}
                                {editable && <button className="s-rm no-drag" onClick={e => { e.stopPropagation(); removeCanvasBlock(block.id) }}><X style={{ width: 12, height: 12 }} /></button>}
                              </div>
                              <div className="s-body">
                                {mode === 'offboarding' ? (
                                  block.systemUnwind ? (
                                    <>
                                      <span className="s-chip exit"><RotateCcw style={{ width: 9, height: 9 }} />{block.systemUnwind.action}</span>
                                      <span className="s-chip exit"><Zap style={{ width: 9, height: 9 }} />Nova · automated</span>
                                      {block.reconcile && <span className="s-chip exit">reconciled</span>}
                                    </>
                                  ) : (
                                    <span className="s-chip">One-way sync · nothing to unwind</span>
                                  )
                                ) : (
                                  <>
                                    <span className={`s-chip ${block.integration && block.integration !== 'NONE' ? 'ok' : 'warn'}`}>
                                      <Plug style={{ width: 9, height: 9 }} />
                                      {integrationMeta(block.integration)?.label ?? 'No system'}
                                    </span>
                                    {block.push && block.reads && block.reads.length > 0 && (
                                      <span className="s-chip">{block.reads.length} out</span>
                                    )}
                                    {block.pull && block.writes && block.writes.length > 0 && (
                                      <span className="s-chip">{block.writes.length} back</span>
                                    )}
                                    {block.reconcile && <span className="s-chip ok">reconcile</span>}
                                    <span className={`s-chip ${block.gate === 'HARD' ? 'err' : 'warn'}`}>
                                      {block.gate === 'HARD' ? '⛔ Hard Gate' : '⚠ Soft Gate'}
                                    </span>
                                    {hasIssues && issues.map((iss, i) => (
                                      <span key={i} className="s-chip err"><AlertCircle style={{ width: 9, height: 9 }} />{iss}</span>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* MANUAL BLOCK */
                            <div
                              data-bid={block.id}
                              className={`m-block ${isSel ? 'sel' : ''} ${hasIssues ? 'issues' : ''} ${isLSrc ? 'lsrc' : ''} ${mode === 'offboarding' ? 'exit' : ''} ${editable ? 'grabbable' : ''} ${dragId === block.id ? 'dragging' : ''}`}
                              onMouseDown={e => onBlockMouseDown(e, block.id)}
                            >
                              <div className={`accent-bar ${mode === 'offboarding' ? 'exit' : block.gate}`} />
                              <div className="m-block-hd">
                                <div className="blk-num">{displayNum}</div>
                                <div className="blk-name">
                                  {block.name}
                                  {hasIssues && <div className="issue-dot" title={issues.join(', ')} />}
                                </div>
                                <div className="blk-badges">
                                  {acct && <span className="acct-pill" title={resolvePeople(acct).map(p => p.name).join(', ')}><AvatarStack names={resolvePeople(acct).map(p => p.name)} max={2} />{roleLabel(acct)}</span>}
                                  {mode === 'onboarding' && completionLabel(block.completionRule, block.completionN, block.requirements.length) && (
                                    <span className="comp-pill">{completionLabel(block.completionRule, block.completionN, block.requirements.length)}</span>
                                  )}
                                  {mode === 'onboarding' && <span className={`gate-pill ${block.gate}`}>{block.gate === 'HARD' ? 'Hard Gate' : 'Soft Gate'}</span>}
                                  {block.requirements.length > 0 && (
                                    <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontFamily: 'DM Mono,monospace' }}>{block.requirements.length} {mode === 'offboarding' ? 'unwind' : 'req'}{block.requirements.length !== 1 ? 's' : ''}</span>
                                  )}
                                </div>
                                {editable && <button className="blk-rm no-drag" onClick={e => { e.stopPropagation(); removeCanvasBlock(block.id) }}><X style={{ width: 12, height: 12 }} /></button>}
                              </div>

                              <div className={`blk-expand ${expanded ? 'open' : ''}`}>
                                {hasIssues && (
                                  <div className="blk-issues-box">
                                    {issues.map((iss, i) => <div key={i} className="blk-issue-row"><AlertCircle style={{ width: 10, height: 10, flexShrink: 0 }} />{iss}</div>)}
                                  </div>
                                )}
                                <div className="blk-expand-in">
                                  {block.requirements.map(req => <ReqRow key={req.id} req={req} mode={mode} />)}
                                  {block.requirements.length === 0 && <div style={{ fontSize: 11, color: 'var(--ink-muted)', padding: '8px 0' }}>No requirements — add from library</div>}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* PIPELINE CONNECTOR */}
                          {idx < orderedBlocks.length - 1 && (
                            <div className="connector">
                              <div className={`conn-line ${mode === 'offboarding' ? 'exit' : block.gate}`} />
                              <div className={`conn-arrow ${mode === 'offboarding' ? 'exit' : block.gate}`} />
                              <div className={`conn-line ${mode === 'offboarding' ? 'exit' : orderedBlocks[idx + 1].gate}`} />
                            </div>
                          )}
                        </React.Fragment>
                      )
                    })}
                    {dragId && dropIdx === orderedBlocks.length && editable && <div className="drop-line" />}
                  </div>
                )}
              </div>
            </div>
            </>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <div className="sidebar scrollbar-thin">

            {/* WORKFLOW HEALTH */}
            <div className="sb-section">
              <button
                className={`save-btn${saveSuccess ? ' success' : ''}`}
                onClick={handleSave}
                disabled={blocks.length === 0}
              >
                {saveSuccess ? <><Check style={{ width: 13, height: 13 }} /> Saved</> : 'Save'}
              </button>
              {(() => {
                const blocker = !policyName.trim() ? 'Add a policy name to save'
                  : blocks.length === 0 ? 'Add at least one block'
                  : circularWarning ? 'Resolve the circular dependency'
                  : totalIssues > 0 ? `Fix ${totalIssues} block issue${totalIssues !== 1 ? 's' : ''} on the canvas`
                  : null
                return blocker
                  ? <div className="save-hint"><Info style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />{blocker}</div>
                  : <div className="save-hint ready"><Check style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />Ready to save</div>
              })()}
            </div>

            {/* BLOCK LIBRARY */}
            <div className="sb-section" style={{ flex: 1 }}>
              <div className="sb-title"><Plus style={{ width: 11, height: 11 }} />Block Library</div>
              <div className="lib-row">
                <button className="lib-btn" onClick={() => { setEditingInspectorBlockId(null); setNewBlockName(''); setNewBlockRequirements([]); setNewBlockGate('HARD'); setNewBlockAccountable('HR'); setAccountableTouched(false); setNewBlockCompletion('ALL'); setNewBlockN(1); setNewSystemType(null); setShowAddBlockModal('MANUAL') }}>
                  <div className="lib-btn-icon"><ClipboardList style={{ width: 14, height: 14, color: 'var(--ink-soft)' }} /></div>
                  <div className="lib-btn-lbl">Requirement<br />Block</div>
                </button>
                <button className="lib-btn" onClick={() => { setEditingInspectorBlockId(null); setNewBlockName(''); setNewBlockRequirements([]); setNewBlockGate('HARD'); setNewBlockAccountable('IT'); setAccountableTouched(true); setNewBlockCompletion('ALL'); setNewBlockN(1); setNewSystemType(null); setNewIntegration('NONE'); setNewPush(true); setNewPull(true); setNewReads(defaultReads()); setNewWrites(defaultWrites()); setNewReconcile(true); setShowAddBlockModal('SYSTEM') }}>
                  <div className="lib-btn-icon"><Cog style={{ width: 14, height: 14, color: 'var(--ink-soft)' }} /></div>
                  <div className="lib-btn-lbl">System<br />Block</div>
                </button>
              </div>

              {inspectorBlocks.map(block => {
                const isUsed = usedInspectorBlockNames.has(block.name)
                const isSys = block.type === 'SYSTEM'
                return (
                  <div
                    key={block.id}
                    className={`icard ${isSys ? 'sys' : ''} ${isUsed ? 'used' : 'drag'}`}
                    onMouseDown={e => {
                      if (isUsed) return
                      e.preventDefault(); e.stopPropagation()
                      setActiveDragBlock(block)
                      setDragPosition({ x: e.clientX, y: e.clientY })
                    }}
                  >
                    <div className="icard-top">
                      <div>
                        <div className="icard-name">{block.name}</div>
                        <div className="icard-meta">
                          <span className={`gate-pill ${block.gate}`} style={{ fontSize: 9 }}>{block.gate === 'HARD' ? 'Hard' : 'Soft'}</span>
                          {completionLabel(block.completionRule, block.completionN, block.requirements.length) && (
                            <span className="comp-pill" style={{ fontSize: 9 }}>{completionLabel(block.completionRule, block.completionN, block.requirements.length)}</span>
                          )}
                          {block.accountableOwner && <span className="acct-pill" style={{ fontSize: 9 }}>{roleLabel(block.accountableOwner)}</span>}
                          {isSys && <span className="sys-icard-pill"><Cog style={{ width: 8, height: 8 }} />System</span>}
                          {isUsed && <span className="added-badge"><Check style={{ width: 7, height: 7 }} />Added</span>}
                        </div>
                      </div>
                      <div className="icard-acts">
                        {!isUsed && (
                          <button className="icard-act" onClick={() => {
                            setEditingInspectorBlockId(block.id); setShowAddBlockModal(block.type)
                            setNewBlockName(block.name); setNewBlockRequirements(block.requirements); setNewBlockGate(block.gate); setNewBlockAccountable(block.accountableOwner ?? 'HR'); setAccountableTouched(true); setNewBlockCompletion(block.completionRule ?? 'ALL'); setNewBlockN(block.completionN ?? 1)
                            if (block.type === 'SYSTEM') { setNewIntegration(block.integration ?? 'NONE'); setNewPush(block.push ?? true); setNewPull(block.pull ?? true); setNewReads(block.reads ?? defaultReads()); setNewWrites(block.writes ?? defaultWrites()); setNewReconcile(block.reconcile ?? true); setNewSystemType(block.systemType ?? null); if (block.connectionConfig) setApiConfig(block.connectionConfig) }
                          }}>Edit</button>
                        )}
                        <button className="icard-act del" onClick={() => setInspectorBlocks(prev => prev.filter(b => b.id !== block.id))}><X style={{ width: 10, height: 10 }} /></button>
                      </div>
                    </div>
                    <ul className="icard-reqs">
                      {block.requirements.slice(0, 4).map(req => <li key={req.id} className="icard-req">{req.name}</li>)}
                      {block.requirements.length > 4 && <li className="icard-req" style={{ fontStyle: 'italic', color: 'var(--ink-muted)' }}>+{block.requirements.length - 4} more</li>}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* DRAG GHOST */}
        {activeDragBlock && (
          <div className="ghost" style={{ left: dragPosition.x, top: dragPosition.y }}>
            <div className="ghost-inner">
              <div className="ghost-name">
                {activeDragBlock.name}
                <span className={`gate-pill ${(activeDragBlock.gate ?? 'HARD') === 'HARD' ? 'hard' : 'soft'}`} style={{ fontSize: 9 }}>{(activeDragBlock.gate ?? 'HARD') === 'HARD' ? 'Hard' : 'Soft'}</span>
              </div>
              <ul className="icard-reqs">
                {(activeDragBlock.requirements ?? []).slice(0, 3).map((req: BlockReq) => <li key={req.id} className="icard-req">{req.name}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* REQUIREMENT LIBRARY MODAL */}
        {showRequirementLibrary && (
          <div className="overlay">
            <div className="modal">
              <div className="modal-hd"><span className="modal-title">Requirement Library</span><button className="modal-x" onClick={() => setShowRequirementLibrary(false)}><X style={{ width: 12, height: 12 }} /></button></div>
              <div className="modal-body scrollbar-thin">
                <div className="req-list">{REQUIREMENT_LIBRARY.map(req => <button key={req.id} className="req-list-item" onClick={() => handleAddRequirement(req)}><span>{req.name}</span><span className="req-list-own">{req.owner}</span></button>)}</div>
              </div>
              <div className="modal-ft"><span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>Adds to the selected block.</span></div>
            </div>
          </div>
        )}

        {/* ADD / EDIT BLOCK MODAL */}
        {showAddBlockModal && (
          <div className="overlay">
            <div className="modal">
              <div className="modal-hd">
                <span className="modal-title">{editingInspectorBlockId ? 'Edit Block' : showAddBlockModal === 'MANUAL' ? 'New Requirement Block' : 'New System Block'}</span>
                <button className="modal-x" onClick={() => setShowAddBlockModal(null)}><X style={{ width: 12, height: 12 }} /></button>
              </div>
              <div className="modal-body scrollbar-thin">
                <div className="form-grp">
                  <label className="form-lbl">Block Name</label>
                  <input type="text" value={newBlockName} onChange={e => setNewBlockName(e.target.value)} className="form-inp" placeholder={showAddBlockModal === 'MANUAL' ? 'e.g. Identity Verification' : 'e.g. Workday Provisioning'} autoFocus />
                </div>
                <div className="form-grp">
                  <label className="form-lbl">Gate Type <span className="lbl-hint">· does it hold up everything downstream?</span></label>
                  <div className="gate-grid">
                    <button className={`gate-opt ${newBlockGate === 'HARD' ? 'h' : ''}`} onClick={() => setNewBlockGate('HARD')}>
                      <div className="gate-opt-lbl"><Shield style={{ width: 11, height: 11, color: 'var(--red)' }} />Hard Gate</div>
                      <div className="gate-opt-desc">Blocks all progression until complete</div>
                    </button>
                    <button className={`gate-opt ${newBlockGate === 'SOFT' ? 's' : ''}`} onClick={() => setNewBlockGate('SOFT')}>
                      <div className="gate-opt-lbl"><Zap style={{ width: 11, height: 11, color: 'var(--amber)' }} />Soft Gate</div>
                      <div className="gate-opt-desc">Allows progression with warnings</div>
                    </button>
                  </div>
                </div>
                {showAddBlockModal === 'MANUAL' && (() => {
                  const reqCount = newBlockRequirements.length
                  const readout = newBlockCompletion === 'ALL'
                    ? `Clears when all ${reqCount || 0} requirement${reqCount !== 1 ? 's are' : ' is'} satisfied.`
                    : newBlockCompletion === 'ANY'
                      ? 'Clears when any one of them is satisfied.'
                      : `Clears when ${Math.min(newBlockN, reqCount || 1)} of ${reqCount || 0} are satisfied.`
                  return (
                    <div className="form-grp">
                      <label className="form-lbl">Completion rule <span className="lbl-hint">· what makes this block satisfied</span></label>
                      <div className="comp-seg">
                        <button className={newBlockCompletion === 'ALL' ? 'on' : ''} onClick={() => setNewBlockCompletion('ALL')}>All</button>
                        <button className={newBlockCompletion === 'ANY' ? 'on' : ''} onClick={() => setNewBlockCompletion('ANY')}>Any one</button>
                        <button className={newBlockCompletion === 'N_OF' ? 'on' : ''} onClick={() => setNewBlockCompletion('N_OF')}>N of M</button>
                      </div>
                      {newBlockCompletion === 'N_OF' && (
                        <div className="comp-n">
                          Needs
                          <input type="number" min={1} max={Math.max(1, reqCount)} value={newBlockN}
                            onChange={e => setNewBlockN(Math.max(1, Math.min(Number(e.target.value) || 1, Math.max(1, reqCount))))} />
                          of {reqCount}
                        </div>
                      )}
                      <div className="comp-readout"><Info style={{ width: 10, height: 10 }} />{readout}</div>
                    </div>
                  )
                })()}
                <div className="form-grp">
                  <label className="form-lbl">Accountable <span className="lbl-hint">· who owns this gate — resolves to live people</span></label>
                  <AccountableField value={newBlockAccountable} onChange={g => { setNewBlockAccountable(g); setAccountableTouched(true) }} />
                  {showAddBlockModal === 'MANUAL' && !accountableTouched && newBlockRequirements.length > 0 && (
                    <span className="lbl-suggest">Suggested from this block’s approvers — change if needed</span>
                  )}
                </div>
                {showAddBlockModal === 'SYSTEM' && (() => {
                  const meta = integrationMeta(newIntegration)
                  const rev = systemReversalFor(meta, newPush)
                  return (
                    <>
                      <div className="form-grp">
                        <label className="form-lbl">Connect a system <span className="lbl-hint">· pre-built — you finish the last 10%</span></label>
                        <div className="intg-grid">
                          {INTEGRATIONS.map(i => (
                            <button key={i.key} className={`intg-card ${newIntegration === i.key ? 'on' : ''}`} onClick={() => pickIntegration(i.key)}>
                              <div className="intg-top">
                                <span className="intg-name">{i.label}</span>
                              </div>
                              <span className="intg-blurb">{i.blurb}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {meta && (
                        <>
                          <div className="form-grp">
                            <label className="form-lbl">Direction <span className="lbl-hint">· what this block does with {meta.label}</span></label>
                            <div className="dir-row">
                              <button className={`dir-toggle ${newPush ? 'on' : ''}`} onClick={() => setNewPush(p => !p)}>
                                <ArrowRight style={{ width: 13, height: 13 }} /> Push <span>send data out</span>
                              </button>
                              <button className={`dir-toggle ${newPull ? 'on' : ''}`} onClick={() => setNewPull(p => !p)}>
                                <ArrowDown style={{ width: 13, height: 13, transform: 'rotate(90deg)' }} /> Pull <span>get data back</span>
                              </button>
                            </div>
                          </div>

                          {/* DATA FLOW — the last 10%: which fields */}
                          {(newPush || newPull) && (
                            <div className="form-grp">
                              <label className="form-lbl">Data flow <span className="lbl-hint">· which fields cross the boundary</span></label>
                              <div className="dataflow">
                                {newPush && (
                                  <>
                                    <div className="df-line">
                                      <span className="df-end levv">LEVV</span>
                                      <span className="df-arrow"><ArrowRight style={{ width: 13, height: 13 }} /></span>
                                      <span className="df-end sys">{meta.label}</span>
                                      <span className="df-cap">sends</span>
                                    </div>
                                    <div className="df-fields">
                                      {LEVV_FIELDS.map(f => (
                                        <button key={f} className={`df-chip ${newReads.includes(f) ? 'on' : ''}`} onClick={() => toggleRead(f)}>{f}</button>
                                      ))}
                                    </div>
                                  </>
                                )}
                                {newPull && (
                                  <>
                                    <div className="df-line">
                                      <span className="df-end sys">{meta.label}</span>
                                      <span className="df-arrow"><ArrowRight style={{ width: 13, height: 13 }} /></span>
                                      <span className="df-end levv">LEVV</span>
                                      <span className="df-cap">writes back</span>
                                    </div>
                                    <div className="df-fields">
                                      {RETURN_FIELDS.map(f => (
                                        <button key={f} className={`df-chip ${newWrites.includes(f) ? 'on' : ''}`} onClick={() => toggleWrite(f)}>{f}</button>
                                      ))}
                                    </div>
                                  </>
                                )}
                                <div className="df-nova"><Zap style={{ width: 10, height: 10 }} />Nova maps these to {meta.label}’s fields and reads the response. It never decides whether to fire.</div>
                              </div>
                            </div>
                          )}

                          {/* REGISTERED REVERSAL */}
                          {rev && (
                            <div className="form-grp">
                              <label className="form-lbl">On exit <span className="lbl-hint">· registered now, runs in offboarding</span></label>
                              <div className="sys-rev">
                                <div className="sys-rev-body"><RotateCcw style={{ width: 12, height: 12 }} /><strong>{rev.action}</strong><span className="sys-rev-auto"><Zap style={{ width: 9, height: 9 }} />automated</span></div>
                                <label className="recon-row">
                                  <input type="checkbox" checked={newReconcile} onChange={e => setNewReconcile(e.target.checked)} />
                                  <span><strong>Reconcile</strong> — poll {meta.label} to confirm it’s actually gone, don’t trust the call. Kills lingering access.</span>
                                </label>
                              </div>
                            </div>
                          )}

                          {/* CONNECTION — managed by the pre-built connector, not configured here */}
                          <div className="form-grp">
                            <div className="conn-status"><span className="conn-dot" />{meta.label} connector connected · Production · OAuth managed by LEVV</div>
                          </div>
                        </>
                      )}
                    </>
                  )
                })()}
                {showAddBlockModal === 'MANUAL' && (
                  <div className="form-grp">
                    <label className="form-lbl">Requirements <span className="lbl-hint">· owner, approver &amp; unwind are inherited from the catalog</span></label>
                    <div className="msel-list">
                      {newBlockRequirements.length === 0 && <div className="msel-empty">Add from the catalog below. Each one brings its owner, approver and unwind — set here only whether it holds the gate.</div>}
                      {newBlockRequirements.map(req => {
                        const oc = getOwnerColor(req.owner)
                        const ap = currentApprover(req)
                        const ppl = resolvePeople(ap)
                        const sb = scopeBadge(req)
                        return (
                          <div key={req.id} className="msel-row">
                            <div className="msel-main">
                              <div className="msel-name">
                                {req.name}
                                {sb && <span className="msel-scope">{sb}</span>}
                                {req.nova && <span className="bx-nova"><Zap style={{ width: 8, height: 8 }} /> Nova</span>}
                              </div>
                              <div className="msel-meta">
                                <span className="msel-owner" style={{ background: oc.bg, color: oc.color, borderColor: oc.border }}>{req.owner}</span>
                                <span className="msel-dot">·</span>
                                {ap === 'Integration'
                                  ? <span className="bx-int"><Link2 style={{ width: 10, height: 10 }} /> Integration</span>
                                  : <span className="msel-approver"><AvatarStack names={ppl.map(p => p.name)} max={2} /><span className="bx-role">{roleLabel(ap)}</span></span>}
                                <span className="msel-dot">·</span>
                                <span className="msel-unwind"><RotateCcw style={{ width: 10, height: 10 }} />{req.unwind.verb}{req.unwind.mode === 'automated' ? ' · Nova' : ` · ${req.unwind.owner}`}</span>
                              </div>
                            </div>
                            <div className="msel-right">
                              <button className="chip-x" onClick={() => removeModalReq(req.id)}><X style={{ width: 11, height: 11 }} /></button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mavail">
                      <div className="mavail-hd">Catalog</div>
                      {REQUIREMENT_LIBRARY.filter(req => !newBlockRequirements.some(r => r.id === req.id)).map(req => {
                        const ap = currentApprover(req)
                        const oc = getOwnerColor(req.owner)
                        return (
                          <button key={req.id} className="mavail-row" onClick={() => addModalReq(req)}>
                            <span className="mavail-name"><Plus style={{ width: 11, height: 11 }} />{req.name}</span>
                            <span className="mavail-meta">
                              <span className="msel-owner" style={{ background: oc.bg, color: oc.color, borderColor: oc.border }}>{req.owner}</span>
                              <span className="mavail-ap">{ap === 'Integration' ? 'Integration' : roleLabel(ap)}</span>
                            </span>
                          </button>
                        )
                      })}
                      {REQUIREMENT_LIBRARY.filter(req => !newBlockRequirements.some(r => r.id === req.id)).length === 0 && (
                        <div className="msel-empty" style={{ margin: 0 }}>Every catalog requirement is in this block.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-ft">
                <button className="btn-ghost" onClick={() => setShowAddBlockModal(null)}>Cancel</button>
                <button className="btn-primary" onClick={handleCreateInspectorBlock} disabled={!newBlockName.trim() || (showAddBlockModal === 'MANUAL' && newBlockRequirements.length === 0)}>{editingInspectorBlockId ? 'Save Changes' : 'Create Block'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
