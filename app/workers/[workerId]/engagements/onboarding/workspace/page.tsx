'use client'

import React, { useState } from 'react'
import {
  User, Zap, Link2, RotateCcw, Check, Clock, Lock, AlertCircle, Cog,
  ShieldAlert, AlertTriangle, ChevronRight, Plug,
} from 'lucide-react'

/* ──────────────────────────────────────────────
   MODEL — inlined copy of the requirements store so this
   view compiles with no import path dependency. Shapes and
   semantics match the real store 1:1; when you wire it for
   real, delete this block and import from requirementsStore:
     getRequirements, currentApprover, resolvePeople, roleLabel,
     NOVA_CHECK_LABEL, type Requirement, type Approver
────────────────────────────────────────────── */
type ValidationStrategy = 'manual' | 'third_party'
type ApproverGroup = 'HR' | 'LEGAL' | 'IT' | 'FINANCE' | 'SECURITY' | 'PROCUREMENT'
type OwnerRole = 'Worker' | 'Supplier' | 'Hiring Manager' | 'IT' | 'System'
type Approver = 'Integration' | ApproverGroup
type NovaCheckKind = 'doc_type' | 'name_match' | 'not_expired' | 'legible'
const NOVA_CHECK_LABEL: Record<NovaCheckKind, string> = {
  doc_type: 'Right document type', name_match: 'Name matches worker',
  not_expired: 'Not expired', legible: 'Legible & complete',
}
type UnwindVerb = 'Revoke' | 'Deactivate' | 'Archive' | 'Purge' | 'Expire' | 'Recover' | 'Release' | 'Collect' | 'Close' | 'Reverse'
type UnwindCondition = 'on end-date' | 'within 3 days of end-date' | 'immediately on exit' | 'on final invoice'
type Unwind = { verb: UnwindVerb; action: string; mode: 'automated' | 'manual'; owner: ApproverGroup; condition: UnwindCondition; reconcile?: boolean }
type Nova = { checks: NovaCheckKind[] }
type AcceptedVariant = { id: string; label: string }
type Requirement = {
  id: string; name: string; owner: OwnerRole; strategy: ValidationStrategy; fallbackApprover: ApproverGroup
  unwind: Unwind; applicability?: { workerTypes?: string[] }; acceptedVariants?: AcceptedVariant[]
  nova?: Nova; integration?: { provider: string }
}
type Person = { id: string; name: string; title: string }
const DIRECTORY: Record<ApproverGroup, { role: string; people: Person[] }> = {
  HR: { role: 'People Ops sign-off', people: [{ id: 'p1', name: 'Dana Reyes', title: 'HR Business Partner' }, { id: 'p2', name: 'Tom Okafor', title: 'People Ops Lead' }] },
  LEGAL: { role: 'Legal sign-off', people: [{ id: 'p3', name: 'Priya Nair', title: 'Senior Counsel' }] },
  SECURITY: { role: 'Security review', people: [{ id: 'p4', name: 'Alex Stone', title: 'Security Analyst' }, { id: 'p5', name: 'Jin Park', title: 'Security Lead' }] },
  IT: { role: 'IT provisioning', people: [{ id: 'p6', name: 'Sam Patel', title: 'IT Admin' }, { id: 'p7', name: 'Lena Cho', title: 'Systems Engineer' }] },
  PROCUREMENT: { role: 'Vendor & insurance sign-off', people: [{ id: 'p8', name: 'Sarah Chen', title: 'Procurement Lead' }, { id: 'p9', name: 'Marcus Lee', title: 'Vendor Manager' }] },
  FINANCE: { role: 'Finance sign-off', people: [{ id: 'p10', name: 'Olu Bello', title: 'Controller' }] },
}
function resolvePeople(a: Approver): Person[] { return a === 'Integration' ? [] : (DIRECTORY[a]?.people ?? []) }
function roleLabel(a: Approver): string { return a === 'Integration' ? 'Integration' : (DIRECTORY[a]?.role ?? a) }
function currentApprover(r: { strategy: ValidationStrategy; fallbackApprover: ApproverGroup }): Approver {
  return r.strategy === 'third_party' ? 'Integration' : r.fallbackApprover
}
const SEED_REQUIREMENTS: Requirement[] = [
  { id: 'gov-id', name: 'Government ID Photo Check', owner: 'Worker', strategy: 'manual', fallbackApprover: 'HR',
    acceptedVariants: [{ id: 'passport', label: 'Passport' }, { id: 'license', label: 'Driver License' }, { id: 'national', label: 'National ID' }],
    unwind: { verb: 'Purge', action: 'Purge Government ID Photo Check', mode: 'automated', owner: 'HR', condition: 'on end-date', reconcile: false } },
  { id: 'bg-check', name: 'Background Screening', owner: 'Worker', strategy: 'third_party', fallbackApprover: 'SECURITY',
    integration: { provider: 'Checkr' },
    unwind: { verb: 'Archive', action: 'Archive Background Screening', mode: 'automated', owner: 'SECURITY', condition: 'on end-date', reconcile: false } },
  { id: 'coi', name: 'Certificate of Insurance (COI)', owner: 'Supplier', strategy: 'manual', fallbackApprover: 'PROCUREMENT',
    nova: { checks: ['not_expired'] }, applicability: { workerTypes: ['SOW'] },
    unwind: { verb: 'Release', action: 'Release Certificate of Insurance (COI)', mode: 'manual', owner: 'PROCUREMENT', condition: 'on final invoice', reconcile: true } },
  { id: 'nda-sign', name: 'Non-Disclosure Agreement', owner: 'Worker', strategy: 'manual', fallbackApprover: 'LEGAL',
    unwind: { verb: 'Expire', action: 'Expire Non-Disclosure Agreement', mode: 'automated', owner: 'LEGAL', condition: 'on end-date', reconcile: false } },
]
function getRequirements(): Requirement[] { return SEED_REQUIREMENTS }

/* ──────────────────────────────────────────────
   RUNTIME VIEW — one worker moving through the policy
   the builder authored. It overlays per-worker STATUS on
   the SAME catalog requirements (owner, approver→people,
   Nova pre-check, unwind). Offboarding is DERIVED from each
   requirement's unwind, never authored separately.
────────────────────────────────────────────── */

type RunStatus = 'complete' | 'active' | 'locked'
type ReqState = 'satisfied' | 'in_progress' | 'pending' | 'flagged'

type SysUnwind = { action: string; mode: 'automated' | 'manual'; reconcile?: boolean; owner?: string }
type RunBlock = {
  id: string
  name: string
  gate: 'HARD' | 'SOFT'
  completionRule?: 'ALL' | 'ANY' | 'N_OF'
  type: 'MANUAL' | 'SYSTEM'
  reqIds: string[]
  reqState: Record<string, ReqState>
  status: RunStatus
  reason?: string
  // system contract
  integration?: string
  push?: boolean
  pull?: boolean
  systemUnwind?: SysUnwind
}

/* the run for John Smith — a SOW worker, so the SOW-only COI applies.
   reqIds reference the real catalog; status is the only thing invented here. */
const RUN: RunBlock[] = [
  {
    id: 'b1', name: 'Identity & Eligibility', gate: 'HARD', completionRule: 'ALL', type: 'MANUAL',
    reqIds: ['gov-id'], reqState: { 'gov-id': 'satisfied' }, status: 'complete',
  },
  {
    id: 'b2', name: 'Legal & Compliance', gate: 'HARD', completionRule: 'ALL', type: 'MANUAL',
    reqIds: ['nda-sign', 'bg-check'], reqState: { 'nda-sign': 'satisfied', 'bg-check': 'in_progress' },
    status: 'active', reason: 'Background Screening in third-party review',
  },
  {
    id: 'b3', name: 'Vendor Insurance', gate: 'SOFT', completionRule: 'ALL', type: 'MANUAL',
    reqIds: ['coi'], reqState: { 'coi': 'pending' }, status: 'active', reason: 'Awaiting supplier COI',
  },
  {
    id: 'b4', name: 'Workday Provisioning', gate: 'HARD', type: 'SYSTEM',
    integration: 'Workday', push: true, pull: true,
    systemUnwind: { action: 'Deactivate worker record', mode: 'automated', reconcile: true },
    reqIds: [], reqState: {}, status: 'locked',
  },
]

/* deterministic avatar (same model as the builder) */
function Avatar({ name }: { name: string }) {
  const colors = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6']
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0)
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  return <span className="ava" style={{ background: colors[h % colors.length] }}>{initials}</span>
}
function AvatarStack({ names, max = 2 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max)
  return <span className="ava-stack">{shown.map(n => <Avatar key={n} name={n} />)}{names.length > max && <span className="ava more">+{names.length - max}</span>}</span>
}

function ownerColor(owner: string) {
  switch (owner) {
    case 'Worker': return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
    case 'Supplier': return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
    case 'IT': return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
    case 'System': return { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' }
    default: return { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' }
  }
}

export default function WorkerLifecycle() {
  const [tab, setTab] = useState<'onboarding' | 'offboarding'>('onboarding')
  const [selId, setSelId] = useState<string | null>('b2')
  const LIB = getRequirements()
  const byId = new Map(LIB.map(r => [r.id, r]))

  const exit = tab === 'offboarding'
  const blocks = exit ? [...RUN].reverse() : RUN

  // readiness from real req states
  const allStates = RUN.flatMap(b => Object.values(b.reqState))
  const satisfied = allStates.filter(s => s === 'satisfied').length
  const readiness = allStates.length ? Math.round((satisfied / allStates.length) * 100) : 0

  // derived reversal counts for the offboarding pulse
  const reqUnwinds = RUN.flatMap(b => b.reqIds.map(id => byId.get(id)!.unwind))
  const sysUnwinds = RUN.filter(b => b.systemUnwind).map(b => b.systemUnwind!)
  const totalRev = reqUnwinds.length + sysUnwinds.length
  const autoRev = reqUnwinds.filter(u => u.mode === 'automated').length + sysUnwinds.filter(u => u.mode === 'automated').length

  /* group blocks into columns — a HARD gate closes its column (barrier);
     SOFT gates accumulate, so they render PARALLEL beside the next hard gate */
  const layers: RunBlock[][] = (() => {
    const out: RunBlock[][] = []; let cur: RunBlock[] = []
    for (const b of blocks) { cur.push(b); if (b.gate === 'HARD') { out.push(cur); cur = [] } }
    if (cur.length) out.push(cur)
    return out
  })()

  return (
    <div className="wl-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        .wl-root{--accent:#007a8a;--accent-soft:#e6f7f9;--accent-border:#9fd9e0;--ink:#0f172a;--ink-soft:#475569;--ink-muted:#94a3b8;--border:#e7eaee;--surface:#fafbfc;--green:#10b981;--green-soft:#ecfdf5;--red:#ef4444;--amber:#f59e0b;--amber-soft:#fffbeb;--amber-border:#fde68a;min-height:100vh;background:var(--surface);font-family:'DM Sans',sans-serif;color:var(--ink);padding:32px 36px;}
        .wl-hd{max-width:1180px;margin:0 auto 26px;display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap;}
        .wl-who{display:flex;align-items:center;gap:14px;}
        .wl-pf{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;background:#0a0a0a;border:2px solid var(--accent);}
        .wl-pf.exit{background:#64748b;border-color:#64748b;}
        .wl-name{font-size:22px;font-weight:700;letter-spacing:-.01em;}
        .wl-sub{font-size:11px;color:var(--ink-muted);margin-top:1px;}
        .wl-tabs{display:flex;gap:18px;margin-top:9px;}
        .wl-tab{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-muted);background:none;border:none;border-bottom:2px solid transparent;padding-bottom:3px;cursor:pointer;font-family:inherit;}
        .wl-tab.on{color:var(--accent);border-color:var(--accent);}
        .wl-stats{display:flex;gap:12px;align-items:stretch;flex-wrap:wrap;}
        .wl-stat{background:#fff;border:1px solid var(--border);border-radius:14px;padding:12px 16px;min-width:104px;box-shadow:0 1px 2px rgba(0,0,0,.03);}
        .wl-stat .l{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted);}
        .wl-stat .v{font-size:21px;font-weight:700;letter-spacing:-.01em;margin-top:3px;}
        .wl-pulse{background:#0a0a0a;color:#fff;border-radius:16px;padding:13px 16px;display:flex;gap:11px;max-width:380px;align-items:flex-start;}
        .wl-pulse.exit{background:#1e293b;}
        .wl-pulse-ic{flex-shrink:0;width:30px;height:30px;border-radius:9px;background:rgba(0,122,138,.22);display:flex;align-items:center;justify-content:center;}
        .wl-pulse-l{font-size:8.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#67e8f9;}
        .wl-pulse-t{font-size:11.5px;color:#cbd5e1;line-height:1.5;margin-top:3px;}
        .wl-flow{max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:0;overflow-x:auto;padding:8px 2px 24px;}
        .wl-term{display:flex;flex-direction:column;align-items:center;gap:7px;flex-shrink:0;}
        .wl-term-dot{width:13px;height:13px;border-radius:50%;background:var(--accent);}
        .wl-term-dot.ring{background:none;border:2px solid var(--accent);}
        .wl-term.exit .wl-term-dot{background:#0a0a0a;}
        .wl-term.exit .wl-term-dot.ring{background:none;border-color:#0a0a0a;}
        .wl-term-l{font-family:'DM Mono',monospace;font-size:9.5px;color:var(--ink-muted);}
        .wl-conn{flex-shrink:0;width:40px;height:2px;background:var(--border);position:relative;}
        .wl-conn.live{background:var(--accent);}
        .wl-col{flex-shrink:0;display:flex;flex-direction:column;gap:26px;justify-content:center;position:relative;}
        .wl-col.parallel{padding:0 14px;}
        .wl-col.parallel::before,.wl-col.parallel::after{content:'';position:absolute;top:25%;bottom:25%;width:2px;background:var(--border);}
        .wl-col.parallel::before{left:0;}
        .wl-col.parallel::after{right:0;}
        .wl-col.parallel .wl-card::before{content:'';position:absolute;top:50%;width:14px;height:2px;background:var(--border);left:-14px;}
        .wl-col.parallel .wl-card::after{content:'';position:absolute;top:50%;width:14px;height:2px;background:var(--border);right:-14px;}
        .wl-par-tag{position:absolute;top:-26px;left:50%;transform:translateX(-50%);font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber);background:var(--amber-soft);border:1px solid var(--amber-border);padding:2px 9px;border-radius:100px;white-space:nowrap;}
        .wl-card{flex-shrink:0;width:268px;background:#fff;border:1px solid var(--border);border-radius:18px;box-shadow:0 1px 3px rgba(0,0,0,.04);position:relative;transition:all .2s;cursor:pointer;border-top:3px solid var(--border);}
        .wl-card.complete{border-top-color:var(--green);}
        .wl-card.active{border-top-color:var(--accent);box-shadow:0 8px 24px rgba(0,122,138,.1);}
        .wl-card.locked{opacity:.6;border-style:dashed;}
        .wl-card.sel{box-shadow:0 0 0 3px var(--accent-soft),0 8px 24px rgba(0,122,138,.12);}
        .wl-card.sys{background:#0c1620;border-color:#1e293b;border-top-color:var(--accent);}
        .wl-gate{position:absolute;top:-10px;right:14px;display:flex;align-items:center;gap:4px;padding:2px 9px;border-radius:100px;background:#fff;border:1px solid var(--border);font-size:8.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);box-shadow:0 1px 2px rgba(0,0,0,.04);}
        .wl-cbody{padding:16px 16px 14px;}
        .wl-crow{display:flex;align-items:center;gap:11px;}
        .wl-cic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#f1f5f9;}
        .wl-cic.complete{background:var(--green-soft);}
        .wl-cic.active{background:#0a0a0a;}
        .wl-cic.sysic{background:rgba(0,122,138,.18);}
        .wl-cname{font-size:14px;font-weight:700;letter-spacing:-.01em;}
        .wl-card.sys .wl-cname{color:#f1f5f9;}
        .wl-cstatus{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:2px;color:var(--ink-muted);}
        .wl-cstatus.complete{color:var(--green);}
        .wl-cstatus.active{color:var(--accent);}
        .wl-prog{height:5px;background:#f1f5f9;border-radius:3px;margin:14px 0 0;overflow:hidden;}
        .wl-card.sys .wl-prog{background:#1e293b;}
        .wl-prog-f{height:100%;border-radius:3px;}
        .wl-meta{display:flex;align-items:center;justify-content:space-between;margin-top:11px;}
        .wl-reason{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 7px;border-radius:6px;background:var(--amber-soft);border:1px solid var(--amber-border);color:#b45309;}
        .wl-impact{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-muted);}
        .wl-reqs{border-top:1px solid var(--border);margin-top:13px;padding-top:13px;display:flex;flex-direction:column;gap:13px;}
        .wl-card.sys .wl-reqs{border-color:#1e293b;}
        .wl-req-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}
        .wl-req-name{font-size:12.5px;font-weight:600;color:var(--ink);}
        .wl-card.sys .wl-req-name{color:#e2e8f0;}
        .wl-rstate{flex-shrink:0;}
        .wl-req-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px;}
        .wl-owner{font-size:9.5px;font-weight:600;padding:1.5px 7px;border-radius:100px;border:1px solid;}
        .wl-by{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:var(--ink-soft);}
        .wl-role{color:var(--ink-soft);font-weight:500;}
        .wl-int{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;padding:1.5px 7px;border-radius:100px;background:var(--accent-soft);border:1px solid var(--accent-border);color:var(--accent);}
        .wl-dot{color:var(--ink-muted);font-size:9px;}
        .wl-nova{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:var(--accent);background:var(--accent-soft);border:1px solid var(--accent-border);padding:1.5px 7px;border-radius:100px;}
        .wl-nova-note{font-size:9.5px;color:var(--ink-muted);margin-top:5px;line-height:1.45;}
        .wl-unwind{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:var(--ink-soft);margin-top:6px;}
        .wl-card.sys .wl-unwind,.wl-card.sys .wl-by,.wl-card.sys .wl-role,.wl-card.sys .wl-nova-note{color:#94a3b8;}
        .ava{width:17px;height:17px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#fff;border:1.5px solid #fff;}
        .ava-stack{display:inline-flex;}.ava-stack .ava{margin-left:-5px;}.ava-stack .ava:first-child{margin-left:0;}
        .ava.more{background:#e2e8f0;color:#475569;}
        .wl-vary{font-size:9.5px;color:var(--ink-muted);margin-top:5px;}
      `}</style>

      {/* HEADER */}
      <div className="wl-hd">
        <div className="wl-who">
          <div className={`wl-pf ${exit ? 'exit' : ''}`}><User style={{ width: 26, height: 26 }} /></div>
          <div>
            <div className="wl-name">John Smith</div>
            <div className="wl-sub">SOW contractor · Acme Field Services · started 12 days ago</div>
            <div className="wl-tabs">
              <button className={`wl-tab ${!exit ? 'on' : ''}`} onClick={() => { setTab('onboarding'); setSelId('b2') }}>Onboarding</button>
              <button className={`wl-tab ${exit ? 'on' : ''}`} onClick={() => { setTab('offboarding'); setSelId(null) }}>Offboarding</button>
            </div>
          </div>
        </div>

        <div className="wl-stats">
          <div className="wl-stat">
            <div className="l">{exit ? 'Reversible' : 'Gated readiness'}</div>
            <div className="v" style={{ color: exit ? 'var(--accent)' : undefined }}>{exit ? `${autoRev}/${totalRev}` : `${readiness}%`}</div>
          </div>
          <div className="wl-stat">
            <div className="l">{exit ? 'Est. closure' : 'Est. activation'}</div>
            <div className="v">{exit ? '3 days' : '7 days'}</div>
          </div>
          <div className={`wl-pulse ${exit ? 'exit' : ''}`}>
            <div className="wl-pulse-ic">{exit ? <RotateCcw style={{ width: 15, height: 15, color: '#67e8f9' }} /> : <Zap style={{ width: 15, height: 15, color: '#67e8f9' }} />}</div>
            <div>
              <div className="wl-pulse-l">Orchestration pulse</div>
              <div className="wl-pulse-t">
                {exit
                  ? `On exit, ${totalRev} grants reverse — ${autoRev} automatically via Nova, ${totalRev - autoRev} in a team's queue. Workday deactivation reconciles to confirm access is gone.`
                  : 'Legal gate is blocking. Background Screening returns a pass/fail from Checkr (Integration); Security review handles exceptions. Workday provisioning stays locked until Legal clears.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLOW */}
      <div className="wl-flow">
        <div className={`wl-term ${exit ? 'exit' : ''}`}>
          <div className="wl-term-dot" />
          <div className="wl-term-l">{exit ? 'Exit' : 'Start'}</div>
        </div>
        {layers.map((layer, li) => {
          const live = !exit && layer.some(b => b.status !== 'locked')
          const parallel = layer.length > 1
          return (
            <React.Fragment key={li}>
              <div className={`wl-conn ${live ? 'live' : ''}`} />
              <div className={`wl-col ${parallel ? 'parallel' : ''}`}>
                {layer.map(b => (
                  <RunCard
                    key={b.id} block={b} byId={byId} exit={exit}
                    selected={selId === b.id}
                    onClick={() => setSelId(selId === b.id ? null : b.id)}
                  />
                ))}
              </div>
            </React.Fragment>
          )
        })}
        <div className="wl-conn" />
        <div className={`wl-term ${exit ? 'exit' : ''}`}>
          <div className="wl-term-dot ring" />
          <div className="wl-term-l">{exit ? 'Offboarded' : 'Active'}</div>
        </div>
      </div>
    </div>
  )
}

function stateIcon(s: ReqState) {
  if (s === 'satisfied') return <Check style={{ width: 15, height: 15, color: 'var(--green)' }} />
  if (s === 'in_progress') return <Clock style={{ width: 15, height: 15, color: 'var(--accent)' }} />
  if (s === 'flagged') return <AlertCircle style={{ width: 15, height: 15, color: 'var(--amber)' }} />
  return <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid #cbd5e1' }} />
}

function RunCard({ block, byId, exit, selected, onClick }: { block: RunBlock; byId: Map<string, Requirement>; exit: boolean; selected: boolean; onClick: () => void }) {
  const sys = block.type === 'SYSTEM'
  const progress = block.status === 'complete' ? 100 : block.status === 'active'
    ? Math.round((Object.values(block.reqState).filter(s => s === 'satisfied').length / Math.max(1, block.reqIds.length)) * 100)
    : 0
  const statusLabel = exit ? 'Reverses on exit' : block.status === 'complete' ? 'Cleared' : block.status === 'locked' ? 'Gated' : 'In flight'

  return (
    <div className={`wl-card ${block.status} ${sys ? 'sys' : ''} ${selected ? 'sel' : ''}`} onClick={onClick}>
      <div className="wl-gate">
        {block.gate === 'HARD' ? <ShieldAlert style={{ width: 11, height: 11, color: 'var(--red)' }} /> : <AlertTriangle style={{ width: 11, height: 11, color: 'var(--amber)' }} />}
        {block.gate} gate
      </div>
      <div className="wl-cbody">
        <div className="wl-crow">
          <div className={`wl-cic ${sys ? 'sysic' : block.status}`}>
            {sys ? <Cog style={{ width: 19, height: 19, color: '#67e8f9' }} />
              : block.status === 'complete' ? <Check style={{ width: 19, height: 19, color: 'var(--green)' }} />
                : block.status === 'locked' ? <Lock style={{ width: 17, height: 17, color: '#94a3b8' }} />
                  : <Zap style={{ width: 18, height: 18, color: '#67e8f9' }} />}
          </div>
          <div>
            <div className="wl-cname">{block.name}</div>
            <div className={`wl-cstatus ${block.status}`}>{statusLabel}</div>
          </div>
        </div>

        {!selected && !exit && (
          <div className="wl-prog"><div className="wl-prog-f" style={{ width: `${progress}%`, background: block.status === 'complete' ? 'var(--green)' : 'var(--accent)' }} /></div>
        )}

        {selected && (
          <div className="wl-reqs">
            {sys ? <SysRow block={block} exit={exit} /> : block.reqIds.map(id => {
              const req = byId.get(id)
              if (!req) return null
              return <RunReqRow key={id} req={req} state={block.reqState[id]} exit={exit} />
            })}
          </div>
        )}

        {!selected && (
          <div className="wl-meta">
            <span className="wl-impact">{exit ? `${block.reqIds.length || 1} unwind${(block.reqIds.length || 1) !== 1 ? 's' : ''}` : block.status === 'complete' ? 'Cleared' : 'Tap to inspect'}</span>
            {block.reason && block.status === 'active' && !exit && <span className="wl-reason"><Info /> {block.reason}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

/* a requirement row — the corrected model:
   owner (RACI Responsible) · Approved by (resolved role + people, or Integration)
   · Nova pre-check (flags, never approves) · the unwind it carries */
function RunReqRow({ req, state, exit }: { req: Requirement; state: ReqState; exit: boolean }) {
  const approver: Approver = currentApprover(req)
  const isInt = approver === 'Integration'
  const people = resolvePeople(approver)
  const oc = ownerColor(req.owner)
  const u = req.unwind

  if (exit) {
    return (
      <div className="wl-req">
        <div className="wl-req-top"><span className="wl-req-name">{req.name}</span></div>
        <div className="wl-unwind">
          <RotateCcw style={{ width: 12, height: 12 }} />
          <strong style={{ fontWeight: 600 }}>{u.action}</strong>
          <span className="wl-dot">·</span>
          {u.mode === 'automated' ? <span className="wl-nova"><Zap style={{ width: 9, height: 9 }} /> Nova</span> : <span className="wl-by">{u.owner}</span>}
          <span className="wl-dot">·</span>
          <span className="wl-role">{u.condition}</span>
          {u.reconcile && <><span className="wl-dot">·</span><span className="wl-role">reconcile</span></>}
        </div>
      </div>
    )
  }

  return (
    <div className="wl-req">
      <div className="wl-req-top">
        <span className="wl-req-name">{req.name}</span>
        <span className="wl-rstate">{stateIcon(state)}</span>
      </div>
      <div className="wl-req-line">
        <span className="wl-owner" style={{ background: oc.bg, color: oc.color, borderColor: oc.border }}>{req.owner}</span>
        <span className="wl-dot">·</span>
        <span style={{ fontSize: 9.5, color: 'var(--ink-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Approved by</span>
        {isInt
          ? <span className="wl-int"><Link2 style={{ width: 10, height: 10 }} /> Integration{req.integration ? ` · ${req.integration.provider}` : ''}</span>
          : <span className="wl-by"><AvatarStack names={people.map(p => p.name)} max={2} /><span className="wl-role">{roleLabel(approver)}</span></span>}
      </div>
      {req.acceptedVariants && req.acceptedVariants.length > 0 && (
        <div className="wl-vary">Any one: {req.acceptedVariants.map(v => v.label).join(' · ')}</div>
      )}
      {req.nova && (
        <div className="wl-nova-note">
          <span className="wl-nova"><Zap style={{ width: 9, height: 9 }} /> Nova pre-check</span>{' '}
          — {req.nova.checks.map(c => NOVA_CHECK_LABEL[c]).join(', ')}. Flags to {isInt ? 'the integration' : roleLabel(approver)}; never approves.
        </div>
      )}
      <div className="wl-unwind"><RotateCcw style={{ width: 11, height: 11 }} /><span className="wl-role">reverses: {u.verb} · {u.mode === 'automated' ? 'Nova' : u.owner}</span></div>
    </div>
  )
}

function SysRow({ block, exit }: { block: RunBlock; exit: boolean }) {
  if (exit && block.systemUnwind) {
    const u = block.systemUnwind
    return (
      <div className="wl-req">
        <div className="wl-unwind">
          <RotateCcw style={{ width: 12, height: 12 }} />
          <strong style={{ fontWeight: 600 }}>{u.action}</strong>
          <span className="wl-dot">·</span>
          <span className="wl-nova"><Zap style={{ width: 9, height: 9 }} /> Nova</span>
          {u.reconcile && <><span className="wl-dot">·</span><span className="wl-role">reconcile</span></>}
        </div>
      </div>
    )
  }
  return (
    <div className="wl-req">
      <div className="wl-req-line">
        <span className="wl-int"><Plug style={{ width: 10, height: 10 }} /> {block.integration}</span>
        <span className="wl-dot">·</span>
        <span className="wl-role">{block.push && block.pull ? 'push · pull' : block.push ? 'push' : 'pull'}</span>
      </div>
      <div className="wl-nova-note">Runs automatically when Legal clears. Field mapping by Nova; the integration returns the verdict.</div>
      {block.systemUnwind && <div className="wl-unwind"><RotateCcw style={{ width: 11, height: 11 }} /><span className="wl-role">reverses: {block.systemUnwind.action} · Nova</span></div>}
    </div>
  )
}

function Info() { return <AlertCircle style={{ width: 10, height: 10 }} /> }