'use client'
import { getRequirements } from '../../../workers/requirements/requirementsStore'
import {
  Cog, GripVertical, ChevronRight, Zap, Shield, AlertTriangle,
  Plus, X, Check, Link2, Users, CheckCircle2, XCircle,
  ArrowDown, Plug, ClipboardList, AlertCircle, Info
} from 'lucide-react'
import { addWorkflow } from '../../../workers/onboarding/workflow'
import { useRouter } from 'next/navigation'
import React from 'react'
import { useParams } from 'next/navigation'

/* ======================
   TYPES
====================== */
type Requirement = {
  id: string
  name: string
  owner: string
  source?: 'BASE' | 'OVERRIDE'
}
type IntegrationKey = 'NONE' | 'OKTA' | 'AZURE_AD' | 'SERVICENOW' | 'DOCUSIGN'
type Block = {
  id: string
  name: string
  order: number
  gate: 'HARD' | 'SOFT'
  completionRule: 'ALL' | 'ANY'
  requirements: Requirement[]
  integration?: IntegrationKey
  type?: 'MANUAL' | 'SYSTEM'
  systemType?: 'API_CALL'
  connectionConfig?: { endpoint: string; authType: string; environment: string }
}
type Dependency = { from: string; to: string }

/* ======================
   HELPERS
====================== */
function getBlockIssues(block: Block): string[] {
  const issues: string[] = []
  if (block.type === 'MANUAL') {
    if (block.requirements.length === 0) issues.push('No requirements added')
    const unassigned = block.requirements.filter(r => !r.owner || r.owner === '')
    if (unassigned.length > 0) issues.push(`${unassigned.length} requirement(s) have no owner`)
  }
  if (block.type === 'SYSTEM') {
    if ((!block.integration || block.integration === 'NONE') && !block.connectionConfig?.endpoint) {
      issues.push('No integration or endpoint configured')
    }
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

/* ======================
   PAGE
====================== */
export default function PolicyArchitectPage() {
  const params = useParams()
  const policyId = params.policyId as string
  const router = useRouter()

  const [scope, setScope] = React.useState({ name: '', workerType: 'Contingent', country: 'United States', worksite: 'NY' })
  const [extraFields, setExtraFields] = React.useState<{ id: string; label: string; value: string }[]>([])
  const [showAddFieldModal, setShowAddFieldModal] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const AVAILABLE_EXTRA_FIELDS = ['Cost Center', 'Business Unit', 'Role', 'Location']

  function handleAddExtraField(label: string) {
    setExtraFields(prev => [...prev, { id: crypto.randomUUID(), label, value: '' }])
    setShowAddFieldModal(false)
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
          order: prev.length + 1, gate: activeDragBlock.gate ?? 'HARD', completionRule: 'ALL', integration: 'NONE',
          requirements: (activeDragBlock.requirements ?? []).map((r: Requirement) => ({ ...r, source: 'BASE' })),
        }])
      }
      setActiveDragBlock(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [activeDragBlock])

  /* INSPECTOR BLOCKS */
  const [inspectorBlocks, setInspectorBlocks] = React.useState<
    { id: string; name: string; requirements: Requirement[]; type: 'MANUAL' | 'SYSTEM'; gate: 'HARD' | 'SOFT' }[]
  >([
    { id: 'identity-eligibility', name: 'Identity & Eligibility', type: 'MANUAL', gate: 'HARD', requirements: [{ id: 'photo-id', name: 'Photo ID', owner: 'Worker' }, { id: 'rtw', name: 'Right to Work (I-9 / Visa)', owner: 'Worker' }] },
    { id: 'legal-compliance', name: 'Legal & Compliance', type: 'MANUAL', gate: 'SOFT', requirements: [{ id: 'nda', name: 'Signed NDA', owner: 'Worker' }, { id: 'ip', name: 'IP Agreement', owner: 'Worker' }, { id: 'fingerprint', name: 'Fingerprinting', owner: 'Supplier' }] },
  ])

  const [showAddBlockModal, setShowAddBlockModal] = React.useState<null | 'MANUAL' | 'SYSTEM'>(null)
  const [editingInspectorBlockId, setEditingInspectorBlockId] = React.useState<string | null>(null)
  const [newBlockName, setNewBlockName] = React.useState('')
  const [newBlockRequirements, setNewBlockRequirements] = React.useState<Requirement[]>([])
  const [newBlockGate, setNewBlockGate] = React.useState<'HARD' | 'SOFT'>('HARD')
  const [newSystemType, setNewSystemType] = React.useState<'API_CALL' | null>(null)
  const [apiConfig, setApiConfig] = React.useState({ endpoint: '', authType: 'OAuth', environment: 'Production' })
  const [endpointStatus, setEndpointStatus] = React.useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [blocks, setBlocks] = React.useState<Block[]>([])
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(null)
  const [draggingCanvasBlockId, setDraggingCanvasBlockId] = React.useState<string | null>(null)
  const [showRequirementLibrary, setShowRequirementLibrary] = React.useState(false)
  const usedInspectorBlockNames = new Set(blocks.map(b => b.name))
  const REQUIREMENT_LIBRARY = getRequirements()

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
  const totalIssues = React.useMemo(() => { let c = 0; for (const i of blockIssuesMap.values()) c += i.length; return c }, [blockIssuesMap])
  const totalRequirements = blocks.reduce((s, b) => s + b.requirements.length, 0)
  const hardGateCount = blocks.filter(b => b.gate === 'HARD').length
  const softGateCount = blocks.filter(b => b.gate === 'SOFT').length
  const systemBlockCount = blocks.filter(b => b.type === 'SYSTEM').length
  const unassignedOwners = blocks.reduce((s, b) => s + b.requirements.filter(r => !r.owner).length, 0)
  const isWorkflowReady = blocks.length > 0 && totalIssues === 0 && !circularWarning && !!scope.name.trim()

  /* HANDLERS */
  function handleAddRequirement(req: Requirement) {
    if (!selectedBlockId) return
    setBlocks(prev => prev.map(b => {
      if (b.id !== selectedBlockId) return b
      if (b.requirements.some(r => r.id === req.id)) return b
      return { ...b, requirements: [...b.requirements, { ...req, source: 'OVERRIDE' }] }
    }))
    setShowRequirementLibrary(false)
  }
  function handleUpdateGate(nextGate: 'HARD' | 'SOFT') {
    if (!selectedBlockId) return
    setBlocks(prev => prev.map(b => b.id === selectedBlockId ? { ...b, gate: nextGate } : b))
  }
  function handleUpdateCompletionRule(nextRule: 'ALL' | 'ANY') {
    if (!selectedBlockId) return
    setBlocks(prev => prev.map(b => b.id === selectedBlockId ? { ...b, completionRule: nextRule } : b))
  }
  function handleUpdateIntegration(nextIntegration: IntegrationKey) {
    if (!selectedBlockId) return
    setBlocks(prev => prev.map(b => b.id === selectedBlockId ? { ...b, integration: nextIntegration } : b))
  }
  function validateEndpoint(endpoint: string) {
    if (!endpoint) return
    setEndpointStatus('checking')
    setTimeout(() => { try { new URL(endpoint); setEndpointStatus('valid') } catch { setEndpointStatus('invalid') } }, 700)
  }
  function handleCanvasBlockClick(blockId: string) {
    if (linkFromId) {
      if (linkFromId === blockId) { setLinkFromId(null); return }
      setDependencies(prev => prev.some(d => d.from === linkFromId && d.to === blockId) ? prev : [...prev, { from: linkFromId, to: blockId }])
      setLinkFromId(null); return
    }
    setSelectedBlockId(prev => prev === blockId ? null : blockId)
  }
  function reorderBlocks(draggedId: string, targetId: string) {
    if (draggedId === targetId) return
    setBlocks(prev => {
      const di = prev.findIndex(b => b.id === draggedId), ti = prev.findIndex(b => b.id === targetId)
      if (di === -1 || ti === -1) return prev
      const u = [...prev]; const [m] = u.splice(di, 1); u.splice(ti, 0, m)
      return u.map((b, i) => ({ ...b, order: i + 1 }))
    })
  }
  function removeCanvasBlock(blockId: string) {
    setBlocks(prev => prev.filter(b => b.id !== blockId).map((b, i) => ({ ...b, order: i + 1 })))
    setDependencies(prev => prev.filter(d => d.from !== blockId && d.to !== blockId))
    setSelectedBlockId(prev => prev === blockId ? null : prev)
  }
  function handleCreateInspectorBlock() {
    if (!newBlockName.trim() || (showAddBlockModal === 'MANUAL' && newBlockRequirements.length === 0)) return
    setInspectorBlocks(prev => {
      if (editingInspectorBlockId) return prev.map(b => b.id === editingInspectorBlockId ? { ...b, name: newBlockName.trim(), gate: newBlockGate, requirements: newBlockRequirements } : b)
      return [...prev, { id: crypto.randomUUID(), name: newBlockName.trim(), type: showAddBlockModal === 'SYSTEM' ? 'SYSTEM' : 'MANUAL', gate: newBlockGate, requirements: newBlockRequirements, ...(showAddBlockModal === 'SYSTEM' && newSystemType === 'API_CALL' ? { systemType: 'API_CALL' as const, connectionConfig: apiConfig } : {}) }]
    })
    setNewBlockName(''); setNewBlockRequirements([]); setNewSystemType(null)
    setApiConfig({ endpoint: '', authType: 'OAuth', environment: 'Production' })
    setEditingInspectorBlockId(null); setShowAddBlockModal(null)
  }
  function handleSave() {
    addWorkflow({ id: crypto.randomUUID(), name: scope.name || 'Untitled Workflow', status: 'Draft' })
    setSaveSuccess(true)
    setTimeout(() => router.push('/admin/workers/onboarding'), 900)
  }

  const scopeSummary = [scope.workerType, scope.country, scope.worksite].filter(Boolean).join(' · ')

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
          --sys:#0f172a; --sys-text:#e2e8f0; --sys-muted:#94a3b8;
          --sh-sm:0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.04);
          --sh-md:0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.04);
          --sh-lg:0 12px 32px rgba(0,0,0,.11),0 4px 8px rgba(0,0,0,.05);
          --r-sm:8px; --r-md:12px; --r-lg:16px; --r-xl:20px;
          min-height:100vh; background:var(--bg);
        }
        /* ── Header ── */
        .hd{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 28px;height:58px;display:flex;align-items:center;justify-content:space-between;}
        .hd-l{display:flex;align-items:center;gap:14px;}
        .back-link{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ink-muted);text-decoration:none;padding:4px 8px;border-radius:6px;transition:all .15s;}
        .back-link:hover{color:var(--accent);background:var(--accent-soft);}
        .hdiv{width:1px;height:18px;background:var(--border);}
        .hd-title{font-size:14px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:8px;}
        .draft-pill{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;padding:2px 8px;border-radius:100px;background:var(--amber-soft);border:1px solid var(--amber-border);color:var(--amber);}
        /* Buttons */
        .btn-ghost{height:32px;padding:0 14px;border-radius:7px;border:1px solid var(--border-strong);background:#fff;font-size:12px;font-weight:500;color:var(--ink-soft);cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
        .btn-ghost:hover{border-color:var(--accent-border);color:var(--accent);background:var(--accent-soft);}
        .btn-primary{height:32px;padding:0 18px;border-radius:7px;border:none;background:#0a0a0a;font-size:12px;font-weight:600;color:#fff;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;}
        .btn-primary:hover{background:var(--accent);box-shadow:0 4px 12px rgba(0,122,138,.25);transform:translateY(-1px);}
        .btn-primary:disabled{background:var(--border-strong);color:var(--ink-muted);cursor:not-allowed;transform:none;box-shadow:none;}
        /* Layout */
        .body-grid{display:grid;grid-template-columns:1fr 310px;min-height:calc(100vh - 58px);}
        .main-col{padding:24px 20px 32px 28px;display:flex;flex-direction:column;gap:20px;overflow-y:auto;}
        .sidebar{border-left:1px solid var(--border);background:#fff;display:flex;flex-direction:column;position:sticky;top:58px;height:calc(100vh - 58px);overflow-y:auto;}
        /* Scope */
        .scope-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-xl);box-shadow:var(--sh-sm);overflow:hidden;}
        .scope-hd{padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface-raised);display:flex;align-items:center;justify-content:space-between;}
        .scope-icon{width:26px;height:26px;border-radius:7px;background:var(--accent-soft);border:1px solid var(--accent-border);display:flex;align-items:center;justify-content:center;color:var(--accent);}
        .scope-label{font-size:12px;font-weight:600;color:var(--ink);}
        .scope-preview{font-size:11px;color:var(--ink-muted);margin-top:1px;}
        .scope-body{padding:16px 20px;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;}
        .f-group{display:flex;flex-direction:column;gap:4px;min-width:148px;}
        .f-lbl{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-muted);display:flex;align-items:center;justify-content:space-between;}
        .f-inp,.f-sel{height:34px;padding:0 10px;border-radius:var(--r-sm);border:1px solid var(--border);background:#fff;color:var(--ink);font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:all .15s;width:100%;}
        .f-inp:focus,.f-sel:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid);}
        .f-inp::placeholder{color:var(--ink-muted);}
        .x-btn{width:15px;height:15px;border:none;background:none;cursor:pointer;color:var(--ink-muted);display:flex;align-items:center;justify-content:center;border-radius:3px;padding:0;transition:all .15s;}
        .x-btn:hover{color:var(--red);background:var(--red-soft);}
        .add-field-btn{height:34px;padding:0 12px;border-radius:var(--r-sm);border:1px dashed var(--border-strong);background:transparent;font-size:11px;font-weight:500;color:var(--ink-muted);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:4px;font-family:'DM Sans',sans-serif;align-self:flex-end;white-space:nowrap;}
        .add-field-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);}
        /* Canvas */
        .canvas-wrap{background:#fff;border:1px solid var(--border);border-radius:var(--r-xl);box-shadow:var(--sh-sm);overflow:hidden;transition:border-color .2s,box-shadow .2s;}
        .canvas-wrap.drag-on{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid),var(--sh-md);}
        .canvas-hd{padding:14px 20px;border-bottom:1px solid var(--border);background:var(--surface-raised);display:flex;align-items:center;justify-content:space-between;}
        .canvas-hd h2{font-size:13px;font-weight:600;color:var(--ink);}
        .canvas-hd p{font-size:11px;color:var(--ink-muted);margin-top:1px;}
        .canvas-body{padding:20px;min-height:260px;}
        /* Empty */
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px 20px;gap:10px;}
        .empty-icon{width:50px;height:50px;border-radius:14px;background:var(--surface-raised);border:2px dashed var(--border-strong);display:flex;align-items:center;justify-content:center;color:var(--ink-muted);margin-bottom:4px;}
        .empty-state h3{font-size:14px;font-weight:600;color:var(--ink-soft);}
        .empty-state p{font-size:12px;color:var(--ink-muted);text-align:center;max-width:220px;line-height:1.5;}
        /* Banners */
        .drop-hint{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 14px;border-radius:var(--r-md);background:var(--accent-soft);border:1px dashed var(--accent-border);font-size:12px;font-weight:500;color:var(--accent);animation:hint-pulse 1.4s ease-in-out infinite;}
        @keyframes hint-pulse{0%,100%{opacity:1}50%{opacity:.65}}
        .drop-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;animation:dot-p 1.4s ease-in-out infinite;}
        @keyframes dot-p{0%,100%{transform:scale(1)}50%{transform:scale(.7)}}
        .link-banner{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;margin-bottom:12px;border-radius:var(--r-md);background:var(--amber-soft);border:1px solid var(--amber-border);}
        .link-banner-txt{font-size:12px;font-weight:500;color:var(--amber);display:flex;align-items:center;gap:6px;}
        .circ-warn{display:flex;align-items:center;gap:6px;padding:8px 12px;margin-bottom:12px;border-radius:7px;background:var(--red-soft);border:1px solid var(--red-border);font-size:11px;font-weight:500;color:var(--red);}
        /* Pipeline connector */
        .connector{display:flex;flex-direction:column;align-items:center;margin:0 auto;width:40px;}
        .conn-line{width:2px;height:14px;}
        .conn-line.hard{background:#fca5a5;}
        .conn-line.soft{background:#fcd34d;}
        .conn-arrow{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;}
        .conn-arrow.hard{border-top:6px solid #f87171;}
        .conn-arrow.soft{border-top:6px solid #f59e0b;}
        /* Manual Block */
        .m-block{border:1px solid var(--border);border-radius:var(--r-lg);background:#fff;cursor:pointer;transition:all .2s cubic-bezier(.4,0,.2,1);overflow:hidden;position:relative;}
        .m-block:hover{border-color:var(--accent-border);box-shadow:var(--sh-md);transform:translateY(-1px);}
        .m-block.sel{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-mid),var(--sh-md);transform:translateY(-1px);}
        .m-block.issues{border-color:var(--red-border);}
        .m-block.issues:hover{border-color:var(--red);}
        .m-block.lsrc{border-color:var(--amber);box-shadow:0 0 0 3px var(--amber-soft);}
        .accent-bar{position:absolute;left:0;top:0;bottom:0;width:4px;}
        .accent-bar.hard{background:var(--red);}
        .accent-bar.soft{background:var(--amber);}
        .m-block-hd{padding:11px 14px 11px 18px;display:flex;align-items:center;gap:9px;}
        .blk-drag{color:var(--ink-muted);cursor:grab;flex-shrink:0;padding:2px;border-radius:4px;transition:color .15s;}
        .blk-drag:hover{color:var(--accent);}
        .blk-drag:active{cursor:grabbing;}
        .blk-num{width:22px;height:22px;border-radius:5px;flex-shrink:0;border:1.5px solid var(--ink);background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--ink);font-family:'DM Mono',monospace;transition:all .2s;}
        .m-block.sel .blk-num{background:var(--accent);border-color:var(--accent);color:#fff;}
        .blk-name{font-size:13px;font-weight:600;color:var(--ink);flex:1;display:flex;align-items:center;gap:6px;}
        .blk-badges{display:flex;align-items:center;gap:5px;flex-shrink:0;}
        .gate-pill{padding:2px 7px;border-radius:100px;font-size:10px;font-weight:600;flex-shrink:0;}
        .gate-pill.hard{background:var(--red-soft);border:1px solid var(--red-border);color:var(--red);}
        .gate-pill.soft{background:var(--amber-soft);border:1px solid var(--amber-border);color:var(--amber);}
        .issue-dot{width:6px;height:6px;border-radius:50%;background:var(--red);flex-shrink:0;animation:issue-p 2s ease-in-out infinite;}
        @keyframes issue-p{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
        .blk-rm{width:22px;height:22px;border:none;background:none;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ink-muted);transition:all .15s;flex-shrink:0;}
        .blk-rm:hover{background:var(--red-soft);color:var(--red);}
        .blk-expand{max-height:0;overflow:hidden;transition:max-height .3s cubic-bezier(.4,0,.2,1);}
        .blk-expand.open{max-height:500px;}
        .blk-expand-in{padding:0 14px 14px 18px;border-top:1px solid var(--border);}
        .req-hd{display:grid;grid-template-columns:1fr auto;padding:8px 0 5px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-muted);}
        .req-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);}
        .req-row:last-child{border-bottom:none;}
        .req-name{font-size:12px;color:var(--ink-soft);flex:1;}
        .req-owner-tag{font-size:10px;font-weight:600;padding:2px 7px;border-radius:100px;border:1px solid;white-space:nowrap;}
        .req-src{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:1px 5px;border-radius:3px;background:var(--accent-soft);color:var(--accent);margin-left:5px;}
        .blk-issues-box{margin:0 14px 10px 18px;padding:8px 10px;border-radius:7px;background:var(--red-soft);border:1px solid var(--red-border);display:flex;flex-direction:column;gap:3px;}
        .blk-issue-row{font-size:11px;color:var(--red);display:flex;align-items:center;gap:5px;}
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
        .s-rm{width:22px;height:22px;border:none;background:none;border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#475569;transition:all .15s;flex-shrink:0;margin-left:auto;}
        .s-rm:hover{background:rgba(248,113,113,.15);color:#f87171;}
        /* Sidebar */
        .sb-section{border-bottom:1px solid var(--border);padding:16px;}
        .sb-title{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:12px;display:flex;align-items:center;gap:6px;}
        /* Health */
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
        .checklist{display:flex;flex-direction:column;gap:4px;padding-top:8px;border-top:1px solid var(--border);margin-top:2px;}
        .chk-item{display:flex;align-items:center;gap:6px;font-size:11px;}
        .chk-item.pass{color:var(--green);}
        .chk-item.fail{color:var(--ink-muted);}
        .save-wrap{padding:14px 16px;border-top:1px solid var(--border);background:var(--surface-raised);}
        .save-btn{width:100%;height:36px;border-radius:8px;border:none;background:#0a0a0a;color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px;font-family:'DM Sans',sans-serif;}
        .save-btn:hover:not(:disabled){background:var(--accent);box-shadow:0 4px 12px rgba(0,122,138,.25);transform:translateY(-1px);}
        .save-btn:disabled{background:var(--border-strong);color:var(--ink-muted);cursor:not-allowed;transform:none;}
        .save-btn.success{background:var(--green)!important;}
        .save-hint{font-size:10px;color:var(--ink-muted);text-align:center;margin-top:6px;line-height:1.5;}
        /* Library */
        .lib-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
        .lib-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:12px 6px;border-radius:var(--r-md);border:1.5px dashed var(--border-strong);background:#fff;cursor:pointer;transition:all .2s;font-family:'DM Sans',sans-serif;}
        .lib-btn:hover{border-color:var(--accent);background:var(--accent-soft);transform:translateY(-1px);box-shadow:var(--sh-md);}
        .lib-btn-icon{width:28px;height:28px;border-radius:7px;background:var(--surface-raised);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;transition:all .2s;}
        .lib-btn:hover .lib-btn-icon{background:var(--accent);border-color:var(--accent);color:#fff;}
        .lib-btn-lbl{font-size:10px;font-weight:600;color:var(--ink-soft);text-align:center;}
        /* iCard */
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
        /* Modals */
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
        /* Ghost */
        .ghost{position:fixed;z-index:9999;pointer-events:none;width:224px;}
        .ghost-inner{transform:translate(-50%,-50%) rotate(1.5deg);background:#fff;border:1.5px solid var(--accent-border);border-radius:var(--r-md);padding:11px;box-shadow:0 16px 32px rgba(0,122,138,.14),0 4px 8px rgba(0,0,0,.08);}
        .ghost-name{font-size:12px;font-weight:600;color:var(--ink);margin-bottom:5px;display:flex;align-items:center;justify-content:space-between;}
        .scrollbar-thin::-webkit-scrollbar{width:4px;}
        .scrollbar-thin::-webkit-scrollbar-track{background:transparent;}
        .scrollbar-thin::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:2px;}
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
              Workflow Builder
              <span className="draft-pill">Draft</span>
            </div>
          </div>
          <button className="btn-ghost">Preview</button>
        </header>

        {/* BODY */}
        <div className="body-grid">

          {/* ── MAIN COLUMN ── */}
          <div className="main-col">

            {/* SCOPE */}
            <div className="scope-card">
              <div className="scope-hd">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="scope-icon"><Shield style={{ width: 13, height: 13 }} /></div>
                  <div>
                    <div className="scope-label">Policy Scope</div>
                    {scopeSummary && <div className="scope-preview">Applies to: {scopeSummary}</div>}
                  </div>
                </div>
                <button className="add-field-btn" onClick={() => setShowAddFieldModal(true)}>
                  <Plus style={{ width: 11, height: 11 }} /> Add Field
                </button>
              </div>
              <div className="scope-body">
                <div className="f-group" style={{ minWidth: 200 }}>
                  <span className="f-lbl">Policy Name</span>
                  <input type="text" value={scope.name} onChange={e => setScope({ ...scope, name: e.target.value })} className="f-inp" placeholder="e.g. US SOW Worker" />
                </div>
                {scope.workerType && (
                  <div className="f-group">
                    <div className="f-lbl">Worker Type <button className="x-btn" onClick={() => setScope({ ...scope, workerType: '' })}><X style={{ width: 9, height: 9 }} /></button></div>
                    <select value={scope.workerType} onChange={e => setScope({ ...scope, workerType: e.target.value })} className="f-sel"><option>Contingent</option><option>SOW</option><option>Non-transactional</option></select>
                  </div>
                )}
                {scope.country && (
                  <div className="f-group">
                    <div className="f-lbl">Country <button className="x-btn" onClick={() => setScope({ ...scope, country: '' })}><X style={{ width: 9, height: 9 }} /></button></div>
                    <select value={scope.country} onChange={e => setScope({ ...scope, country: e.target.value })} className="f-sel"><option>United States</option><option>Canada</option><option>UK</option></select>
                  </div>
                )}
                {scope.worksite && (
                  <div className="f-group">
                    <div className="f-lbl">Worksite <button className="x-btn" onClick={() => setScope({ ...scope, worksite: '' })}><X style={{ width: 9, height: 9 }} /></button></div>
                    <select value={scope.worksite} onChange={e => setScope({ ...scope, worksite: e.target.value })} className="f-sel"><option>NY</option><option>Chicago</option><option>Ontario</option></select>
                  </div>
                )}
                {extraFields.map(f => (
                  <div className="f-group" key={f.id}>
                    <div className="f-lbl">{f.label} <button className="x-btn" onClick={() => setExtraFields(prev => prev.filter(x => x.id !== f.id))}><X style={{ width: 9, height: 9 }} /></button></div>
                    <input type="text" value={f.value} onChange={e => setExtraFields(prev => prev.map(x => x.id === f.id ? { ...x, value: e.target.value } : x))} className="f-inp" />
                  </div>
                ))}
              </div>
            </div>

            {/* CANVAS */}
            <div ref={canvasRef} className={`canvas-wrap ${activeDragBlock ? 'drag-on' : ''}`}>
              <div className="canvas-hd">
                <div>
                  <h2>Workflow Pipeline</h2>
                  <p>Drag blocks from the right panel · Click a block to inspect · Executes top to bottom</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {blocks.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)', fontFamily: 'DM Mono,monospace' }}>{blocks.length} step{blocks.length !== 1 ? 's' : ''}</span>}
                  {linkFromId && <button className="btn-ghost" style={{ fontSize: 11, height: 28 }} onClick={() => setLinkFromId(null)}>Cancel Link</button>}
                </div>
              </div>
              <div className="canvas-body">
                {circularWarning && <div className="circ-warn"><AlertTriangle style={{ width: 12, height: 12 }} />{circularWarning}</div>}
                {linkFromId && (
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
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {blocks.map((block, idx) => {
                      const isSel = selectedBlockId === block.id
                      const isLSrc = linkFromId === block.id
                      const issues = blockIssuesMap.get(block.id) ?? []
                      const hasIssues = issues.length > 0
                      const isSys = block.type === 'SYSTEM'

                      return (
                        <React.Fragment key={block.id}>
                          {isSys ? (
                            /* SYSTEM BLOCK */
                            <div
                              className={`s-block ${isSel ? 'sel' : ''} ${hasIssues ? 'issues' : ''} ${isLSrc ? 'lsrc' : ''}`}
                              onClick={() => handleCanvasBlockClick(block.id)}
                            >
                              <div className="s-hd">
                                <div
                                  draggable
                                  onDragStart={e => { e.stopPropagation(); setDraggingCanvasBlockId(block.id) }}
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={e => { e.preventDefault(); if (draggingCanvasBlockId) { reorderBlocks(draggingCanvasBlockId, block.id); setDraggingCanvasBlockId(null) } }}
                                  onClick={e => e.stopPropagation()}
                                  style={{ color: '#475569', cursor: 'grab', flexShrink: 0 }}
                                >
                                  <GripVertical style={{ width: 13, height: 13 }} />
                                </div>
                                <div className="s-num">{block.order}</div>
                                <div className="s-name">
                                  <Cog className="s-cog" style={{ width: 13, height: 13, color: '#67e8f9' }} />
                                  {block.name}
                                  <span className="s-badge">SYSTEM</span>
                                </div>
                                {hasIssues && <div className="issue-dot" />}
                                <button className="s-rm" onClick={e => { e.stopPropagation(); removeCanvasBlock(block.id) }}><X style={{ width: 12, height: 12 }} /></button>
                              </div>
                              <div className="s-body">
                                <span className={`s-chip ${block.integration && block.integration !== 'NONE' ? 'ok' : 'warn'}`}>
                                  <Plug style={{ width: 9, height: 9 }} />
                                  {block.integration && block.integration !== 'NONE' ? block.integration.replace('_', ' ') : 'No integration'}
                                </span>
                                <span className={`s-chip ${block.gate === 'HARD' ? 'err' : 'warn'}`}>
                                  {block.gate === 'HARD' ? '⛔ Hard Gate' : '⚠ Soft Gate'}
                                </span>
                                {block.connectionConfig?.endpoint && (
                                  <span className="s-chip ok" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {block.connectionConfig.endpoint}
                                  </span>
                                )}
                                {hasIssues && issues.map((iss, i) => (
                                  <span key={i} className="s-chip err"><AlertCircle style={{ width: 9, height: 9 }} />{iss}</span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            /* MANUAL BLOCK */
                            <div
                              className={`m-block ${isSel ? 'sel' : ''} ${hasIssues ? 'issues' : ''} ${isLSrc ? 'lsrc' : ''}`}
                              onClick={() => handleCanvasBlockClick(block.id)}
                            >
                              <div className={`accent-bar ${block.gate}`} />
                              <div className="m-block-hd">
                                <div
                                  className="blk-drag"
                                  draggable
                                  onDragStart={e => { e.stopPropagation(); setDraggingCanvasBlockId(block.id) }}
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={e => { e.preventDefault(); if (draggingCanvasBlockId) { reorderBlocks(draggingCanvasBlockId, block.id); setDraggingCanvasBlockId(null) } }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <GripVertical style={{ width: 13, height: 13 }} />
                                </div>
                                <div className="blk-num">{block.order}</div>
                                <div className="blk-name">
                                  {block.name}
                                  {hasIssues && <div className="issue-dot" title={issues.join(', ')} />}
                                </div>
                                <div className="blk-badges">
                                  <span className={`gate-pill ${block.gate}`}>{block.gate === 'HARD' ? 'Hard Gate' : 'Soft Gate'}</span>
                                  {block.requirements.length > 0 && (
                                    <span style={{ fontSize: 10, color: 'var(--ink-muted)', fontFamily: 'DM Mono,monospace' }}>{block.requirements.length} req{block.requirements.length !== 1 ? 's' : ''}</span>
                                  )}
                                </div>
                                <button className="blk-rm" onClick={e => { e.stopPropagation(); removeCanvasBlock(block.id) }}><X style={{ width: 12, height: 12 }} /></button>
                              </div>

                              <div className={`blk-expand ${isSel ? 'open' : ''}`}>
                                {hasIssues && (
                                  <div className="blk-issues-box">
                                    {issues.map((iss, i) => <div key={i} className="blk-issue-row"><AlertCircle style={{ width: 10, height: 10, flexShrink: 0 }} />{iss}</div>)}
                                  </div>
                                )}
                                <div className="blk-expand-in">
                                  <div className="req-hd"><div>Requirement</div><div>Owner</div></div>
                                  {block.requirements.map(req => {
                                    const oc = getOwnerColor(req.owner)
                                    return (
                                      <div key={req.id} className="req-row">
                                        <span className="req-name">
                                          {req.name}
                                          {req.source === 'OVERRIDE' && <span className="req-src">custom</span>}
                                        </span>
                                        <span className="req-owner-tag" style={{ background: oc.bg, color: oc.color, borderColor: oc.border }}>{req.owner}</span>
                                      </div>
                                    )
                                  })}
                                  {block.requirements.length === 0 && <div style={{ fontSize: 11, color: 'var(--ink-muted)', padding: '8px 0' }}>No requirements — add from library</div>}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* PIPELINE CONNECTOR */}
                          {idx < blocks.length - 1 && (
                            <div className="connector">
                              <div className={`conn-line ${block.gate}`} />
                              <div className={`conn-arrow ${block.gate}`} />
                              <div className={`conn-line ${blocks[idx + 1].gate}`} />
                            </div>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <div className="sidebar scrollbar-thin">

            {/* WORKFLOW HEALTH */}
            <div className="sb-section">
              <div className="sb-title"><CheckCircle2 style={{ width: 11, height: 11 }} />Workflow Health</div>
              <div className="health-card">
                <div className="health-hd">
                  <CheckCircle2 style={{ width: 13, height: 13, color: isWorkflowReady ? 'var(--green)' : 'var(--ink-muted)' }} />
                  <span className="health-title">Readiness Check</span>
                  <span className={`health-score ${isWorkflowReady ? 'good' : totalIssues > 0 ? 'bad' : 'warn'}`}>
                    {isWorkflowReady ? 'Ready' : totalIssues > 0 ? `${totalIssues} issue${totalIssues !== 1 ? 's' : ''}` : 'Incomplete'}
                  </span>
                </div>
                <div className="health-body">
                  <div className="stat-row">
                    <span className="stat-lbl"><Shield style={{ width: 10, height: 10 }} />Steps</span>
                    <span className={`stat-val ${blocks.length === 0 ? 'bad' : 'good'}`}>{blocks.length}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-lbl"><ClipboardList style={{ width: 10, height: 10 }} />Requirements</span>
                    <span className="stat-val">{totalRequirements}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-lbl" style={{ color: 'var(--red)' }}><XCircle style={{ width: 10, height: 10 }} />Hard Gates</span>
                    <span className="stat-val">{hardGateCount}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-lbl" style={{ color: 'var(--amber)' }}><AlertTriangle style={{ width: 10, height: 10 }} />Soft Gates</span>
                    <span className="stat-val">{softGateCount}</span>
                  </div>
                  {systemBlockCount > 0 && (
                    <div className="stat-row">
                      <span className="stat-lbl"><Cog style={{ width: 10, height: 10 }} />System Blocks</span>
                      <span className="stat-val">{systemBlockCount}</span>
                    </div>
                  )}
                  {unassignedOwners > 0 && (
                    <div className="stat-row">
                      <span className="stat-lbl"><Users style={{ width: 10, height: 10 }} />Unassigned</span>
                      <span className="stat-val bad">{unassignedOwners}</span>
                    </div>
                  )}
                  <div className="checklist">
                    {[
                      { label: 'Policy name set', pass: !!scope.name.trim() },
                      { label: 'At least one step', pass: blocks.length > 0 },
                      { label: 'No block issues', pass: totalIssues === 0 && blocks.length > 0 },
                      { label: 'No circular dependencies', pass: !circularWarning },
                    ].map(({ label, pass }) => (
                      <div key={label} className={`chk-item ${pass ? 'pass' : 'fail'}`}>
                        {pass ? <Check style={{ width: 11, height: 11 }} /> : <X style={{ width: 11, height: 11 }} />}
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="save-wrap">
                <button
                  className={`save-btn${saveSuccess ? ' success' : ''}`}
                  onClick={handleSave}
                  disabled={blocks.length === 0}
                >
                  {saveSuccess ? <><Check style={{ width: 13, height: 13 }} /> Saved</> : 'Save as Draft'}
                </button>
                {!isWorkflowReady && blocks.length > 0 && (
                  <div className="save-hint">
                    <Info style={{ width: 10, height: 10, display: 'inline', marginRight: 3 }} />
                    {!scope.name.trim() ? 'Add a policy name to publish' : totalIssues > 0 ? `Fix ${totalIssues} issue${totalIssues !== 1 ? 's' : ''} before publishing` : 'Workflow looks good'}
                  </div>
                )}
              </div>
            </div>

            {/* BLOCK LIBRARY */}
            <div className="sb-section" style={{ flex: 1 }}>
              <div className="sb-title"><Plus style={{ width: 11, height: 11 }} />Block Library</div>
              <div className="lib-row">
                <button className="lib-btn" onClick={() => { setEditingInspectorBlockId(null); setNewBlockName(''); setNewBlockRequirements([]); setNewBlockGate('HARD'); setNewSystemType(null); setShowAddBlockModal('MANUAL') }}>
                  <div className="lib-btn-icon"><ClipboardList style={{ width: 14, height: 14, color: 'var(--ink-soft)' }} /></div>
                  <div className="lib-btn-lbl">Requirement<br />Block</div>
                </button>
                <button className="lib-btn" onClick={() => { setEditingInspectorBlockId(null); setNewBlockName(''); setNewBlockRequirements([]); setNewBlockGate('HARD'); setNewSystemType(null); setShowAddBlockModal('SYSTEM') }}>
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
                          {isSys && <span className="sys-icard-pill"><Cog style={{ width: 8, height: 8 }} />System</span>}
                          {isUsed && <span className="added-badge"><Check style={{ width: 7, height: 7 }} />Added</span>}
                        </div>
                      </div>
                      <div className="icard-acts">
                        {!isUsed && (
                          <button className="icard-act" onClick={() => {
                            setEditingInspectorBlockId(block.id); setShowAddBlockModal(block.type)
                            setNewBlockName(block.name); setNewBlockRequirements(block.requirements); setNewBlockGate(block.gate)
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
                <span className={`gate-pill ${activeDragBlock.gate ?? 'hard'}`} style={{ fontSize: 9 }}>{(activeDragBlock.gate ?? 'HARD') === 'HARD' ? 'Hard' : 'Soft'}</span>
              </div>
              <ul className="icard-reqs">
                {(activeDragBlock.requirements ?? []).slice(0, 3).map((req: Requirement) => <li key={req.id} className="icard-req">{req.name}</li>)}
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
                  <label className="form-lbl">Gate Type</label>
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
                {showAddBlockModal === 'SYSTEM' && (
                  <div className="form-grp">
                    <label className="form-lbl">Integration Type</label>
                    <select value={newSystemType ?? ''} onChange={e => setNewSystemType(e.target.value as 'API_CALL')} className="form-sel">
                      <option value="">Select type</option><option value="API_CALL">API Call</option>
                    </select>
                    {newSystemType === 'API_CALL' && (
                      <div className="api-box" style={{ marginTop: 8 }}>
                        <div className="form-grp">
                          <label className="form-lbl">Endpoint URL</label>
                          <div className="ep-wrap">
                            <input type="text" value={apiConfig.endpoint} onChange={e => { setApiConfig(p => ({ ...p, endpoint: e.target.value })); setEndpointStatus('idle') }} onBlur={() => validateEndpoint(apiConfig.endpoint)} className="form-inp" placeholder="https://api.company.com/provision" style={{ paddingRight: 30 }} />
                            <div className="ep-status">{endpointStatus === 'checking' ? '⏳' : endpointStatus === 'valid' ? '✅' : endpointStatus === 'invalid' ? '❌' : ''}</div>
                          </div>
                        </div>
                        <div className="api-grid">
                          <div className="form-grp">
                            <label className="form-lbl">Auth Type</label>
                            <select value={apiConfig.authType} onChange={e => setApiConfig(p => ({ ...p, authType: e.target.value }))} className="form-sel"><option>OAuth</option><option>API Key</option><option>Basic Auth</option></select>
                          </div>
                          <div className="form-grp">
                            <label className="form-lbl">Environment</label>
                            <select value={apiConfig.environment} onChange={e => setApiConfig(p => ({ ...p, environment: e.target.value }))} className="form-sel"><option>Production</option><option>Sandbox</option><option>Dev</option></select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {showAddBlockModal === 'MANUAL' && (
                  <div className="form-grp">
                    <label className="form-lbl">Requirements</label>
                    <div className="req-chips">
                      {newBlockRequirements.length === 0 && <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>Select from the list below</span>}
                      {newBlockRequirements.map(req => (
                        <div key={req.id} className="req-chip">
                          <span>{req.name}</span>
                          <select value={req.owner} onChange={e => setNewBlockRequirements(prev => prev.map(r => r.id === req.id ? { ...r, owner: e.target.value } : r))}>
                            <option>Worker</option><option>Supplier</option><option>Hiring Manager</option><option>IT</option><option>System</option>
                          </select>
                          <button className="chip-x" onClick={() => setNewBlockRequirements(prev => prev.filter(r => r.id !== req.id))}><X style={{ width: 9, height: 9 }} /></button>
                        </div>
                      ))}
                    </div>
                    <div className="req-list" style={{ marginTop: 6 }}>
                      {REQUIREMENT_LIBRARY.filter(req => !newBlockRequirements.some(r => r.id === req.id)).map(req => (
                        <button key={req.id} className="req-list-item" onClick={() => setNewBlockRequirements(prev => [...prev, req])}>
                          <span>{req.name}</span><span className="req-list-own">{req.owner}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-ft">
                <button className="btn-ghost" onClick={() => setShowAddBlockModal(null)}>Cancel</button>
                <button className="btn-primary" onClick={handleCreateInspectorBlock} disabled={!newBlockName.trim()}>{editingInspectorBlockId ? 'Save Changes' : 'Create Block'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ADD FIELD MODAL */}
        {showAddFieldModal && (
          <div className="overlay">
            <div className="modal" style={{ maxWidth: 320 }}>
              <div className="modal-hd"><span className="modal-title">Add Scope Field</span><button className="modal-x" onClick={() => setShowAddFieldModal(false)}><X style={{ width: 12, height: 12 }} /></button></div>
              <div className="modal-body">
                {AVAILABLE_EXTRA_FIELDS.filter(f => !extraFields.some(x => x.label === f) && !Object.values(scope).includes(f)).map(f => (
                  <button key={f} className="field-opt" onClick={() => handleAddExtraField(f)}>{f}</button>
                ))}
              </div>
              <div className="modal-ft"><span /><button className="btn-ghost" onClick={() => setShowAddFieldModal(false)}>Cancel</button></div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}