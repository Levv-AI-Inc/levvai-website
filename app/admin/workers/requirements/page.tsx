'use client'

import { useState, useMemo } from 'react'
import {
  Cog, Zap, Link2, User, ShieldCheck, Plus, X,
  Search, Filter, ChevronDown, Sparkles, AlertCircle,
  CheckCircle2, Clock, ArrowRight, GripVertical,
  Brain, Sliders, Target, Percent
} from 'lucide-react'
import {
  getRequirements,
  setRequirements as setStore,
  type Requirement,
  type ValidationStrategy
} from './requirementsStore'
import { AIComplianceModal } from './AIComplianceModal'

/* ─────────────────────────────────────────
   OWNER CONFIG
───────────────────────────────────────── */
const OWNER_CONFIG: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  Worker:         { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  Supplier:       { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  'Hiring Manager': { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff', dot: '#a855f7' },
  IT:             { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#f97316' },
  System:         { bg: '#f8fafc', color: '#475569', border: '#cbd5e1', dot: '#94a3b8' },
}

const STRATEGY_CONFIG: Record<ValidationStrategy, {
  label: string; icon: any; bg: string; color: string; border: string; description: string
}> = {
  manual: {
    label: 'Manual Review', icon: Clock,
    bg: '#f8fafc', color: '#475569', border: '#e2e8f0',
    description: 'Reviewed by an assigned approver'
  },
  ai_extraction: {
    label: 'AI Analysis', icon: Zap,
    bg: 'rgba(0,122,138,0.07)', color: '#007a8a', border: 'rgba(0,122,138,0.25)',
    description: 'Nova extracts and verifies automatically'
  },
  third_party: {
    label: '3rd Party API', icon: Link2,
    bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe',
    description: 'Verified via external integration'
  },
}

/* ─────────────────────────────────────────
   PAGE
───────────────────────────────────────── */
export default function RequirementsPage() {
  const [requirements, setRequirements] = useState(getRequirements())
  const [selected, setSelected] = useState<Requirement | null>(null)
  const [search, setSearch] = useState('')
  const [filterOwner, setFilterOwner] = useState<string>('all')
  const [filterStrategy, setFilterStrategy] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  /* Add form */
  const [newReq, setNewReq] = useState({
    name: '',
    owner: 'Worker' as Requirement['owner'],
    strategy: 'manual' as ValidationStrategy,
  })
  const [addError, setAddError] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const handleUpdate = (next: Requirement[]) => {
    setRequirements(next)
    setStore(next)
  }

  const addRequirement = () => {
    if (!newReq.name.trim()) { setAddError('Requirement name is required'); return }
    const duplicate = requirements.some(r => r.name.toLowerCase() === newReq.name.trim().toLowerCase())
    if (duplicate) { setAddError('A requirement with this name already exists'); return }

    const req: Requirement = {
      id: crypto.randomUUID(),
      ...newReq,
      name: newReq.name.trim(),
      fallbackApprover: 'HR',
      compliance: newReq.strategy === 'ai_extraction'
        ? { rules: [], confidenceThreshold: 85 }
        : undefined,
    }
    handleUpdate([...requirements, req])
    setJustAdded(req.id)
    setTimeout(() => setJustAdded(null), 2000)
    setNewReq({ name: '', owner: 'Worker', strategy: 'manual' })
    setAddError('')
  }

  /* Filtered list */
  const filtered = useMemo(() => {
    return requirements.filter(r => {
      const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase())
      const matchOwner = filterOwner === 'all' || r.owner === filterOwner
      const matchStrategy = filterStrategy === 'all' || r.strategy === filterStrategy
      return matchSearch && matchOwner && matchStrategy
    })
  }, [requirements, search, filterOwner, filterStrategy])

  /* Stats */
  const aiCount = requirements.filter(r => r.strategy === 'ai_extraction').length
  const manualCount = requirements.filter(r => r.strategy === 'manual').length
  const thirdPartyCount = requirements.filter(r => r.strategy === 'third_party').length

  /* Drag reorder */
  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return
    const from = requirements.findIndex(r => r.id === dragId)
    const to = requirements.findIndex(r => r.id === targetId)
    if (from === -1 || to === -1) return
    const updated = [...requirements]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved)
    handleUpdate(updated)
    setDragId(null)
  }

  const activeFilters = [filterOwner !== 'all', filterStrategy !== 'all', !!search].filter(Boolean).length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;}

        .rp-root {
          font-family: 'DM Sans', sans-serif;
          --bg: #f8f9fb;
          --surface: #ffffff;
          --surface-raised: #f3f4f6;
          --border: #e5e7eb;
          --border-strong: #d1d5db;
          --ink: #0a0a0a;
          --ink-soft: #374151;
          --ink-muted: #9ca3af;
          --accent: #007a8a;
          --accent-soft: rgba(0,122,138,0.07);
          --accent-mid: rgba(0,122,138,0.14);
          --accent-border: rgba(0,122,138,0.28);
          --red: #dc2626; --red-soft: #fef2f2; --red-border: #fecaca;
          --green: #047857; --green-soft: #ecfdf5; --green-border: #a7f3d0;
          --amber: #b45309; --amber-soft: #fffbeb; --amber-border: #fde68a;
          --sh-sm: 0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.04);
          --sh-md: 0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.04);
          --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 20px;
          min-height: 100vh;
          background: var(--bg);
          padding: 32px;
        }

        /* ── Page header ── */
        .rp-page-hd { margin-bottom: 28px; }
        .rp-breadcrumb { font-size: 11px; color: var(--ink-muted); margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }
        .rp-breadcrumb a { color: var(--ink-muted); text-decoration: none; transition: color .15s; }
        .rp-breadcrumb a:hover { color: var(--accent); }
        .rp-title { font-size: 22px; font-weight: 700; color: var(--ink); letter-spacing: -0.3px; }
        .rp-subtitle { font-size: 13px; color: var(--ink-muted); margin-top: 3px; line-height: 1.5; }

        /* ── Stats strip ── */
        .rp-stats { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .rp-stat {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
          padding: 14px 18px; display: flex; flex-direction: column; gap: 2px;
          box-shadow: var(--sh-sm); min-width: 120px;
        }
        .rp-stat-val { font-size: 22px; font-weight: 700; color: var(--ink); font-family: 'DM Mono', monospace; line-height: 1; }
        .rp-stat-lbl { font-size: 11px; color: var(--ink-muted); font-weight: 500; }
        .rp-stat-indicator { width: 8px; height: 8px; border-radius: 50%; margin-bottom: 4px; }

        /* ── Add form card ── */
        .rp-add-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-xl); padding: 20px 24px; margin-bottom: 20px;
          box-shadow: var(--sh-sm);
        }
        .rp-add-card-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-muted); margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
        .rp-add-row { display: grid; grid-template-columns: 1fr 160px 210px auto; gap: 10px; align-items: start; }
        .rp-field-wrap { display: flex; flex-direction: column; gap: 4px; }
        .rp-input, .rp-select {
          height: 38px; padding: 0 12px; border-radius: var(--r-sm);
          border: 1px solid var(--border); background: var(--surface-raised);
          font-size: 13px; color: var(--ink); font-family: 'DM Sans', sans-serif;
          outline: none; transition: all .15s; width: 100%;
        }
        .rp-input:focus, .rp-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-mid); background: #fff; }
        .rp-input::placeholder { color: var(--ink-muted); }
        .rp-input.err { border-color: var(--red); box-shadow: 0 0 0 3px rgba(220,38,38,.1); }
        .rp-error { font-size: 11px; color: var(--red); display: flex; align-items: center; gap: 4px; }
        .rp-add-btn {
          height: 38px; padding: 0 20px; border-radius: var(--r-sm); border: none;
          background: #0a0a0a; color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all .2s; display: flex; align-items: center; gap: 6px;
          font-family: 'DM Sans', sans-serif; white-space: nowrap;
        }
        .rp-add-btn:hover { background: var(--accent); box-shadow: 0 4px 12px rgba(0,122,138,.25); transform: translateY(-1px); }

        /* strategy preview hint */
        .rp-strategy-hint {
          margin-top: 10px; padding: 10px 14px; border-radius: var(--r-sm);
          display: flex; align-items: center; gap: 10px; font-size: 12px;
          border: 1px solid var(--border); background: var(--surface-raised);
          transition: all .2s;
        }
        .rp-strategy-hint.ai { background: var(--accent-soft); border-color: var(--accent-border); color: var(--accent); }
        .rp-strategy-hint.third_party { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
        .rp-strategy-hint.manual { background: var(--surface-raised); border-color: var(--border); color: var(--ink-soft); }

        /* ── Toolbar ── */
        .rp-toolbar {
          display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
        }
        .rp-search-wrap { position: relative; flex: 1; min-width: 200px; }
        .rp-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--ink-muted); }
        .rp-search {
          width: 100%; height: 36px; padding: 0 12px 0 34px; border-radius: var(--r-sm);
          border: 1px solid var(--border); background: var(--surface);
          font-size: 13px; color: var(--ink); font-family: 'DM Sans', sans-serif; outline: none; transition: all .15s;
        }
        .rp-search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-mid); }
        .rp-search::placeholder { color: var(--ink-muted); }
        .rp-filter-btn {
          height: 36px; padding: 0 14px; border-radius: var(--r-sm);
          border: 1px solid var(--border); background: var(--surface);
          font-size: 12px; font-weight: 500; color: var(--ink-soft);
          cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 6px;
          font-family: 'DM Sans', sans-serif; position: relative;
        }
        .rp-filter-btn:hover, .rp-filter-btn.active { border-color: var(--accent-border); color: var(--accent); background: var(--accent-soft); }
        .rp-filter-badge { position: absolute; top: -5px; right: -5px; width: 16px; height: 16px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .rp-result-count { font-size: 12px; color: var(--ink-muted); font-weight: 500; white-space: nowrap; font-family: 'DM Mono', monospace; }

        /* Filter panel */
        .rp-filter-panel {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg);
          padding: 16px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr;
          gap: 14px; box-shadow: var(--sh-sm);
          animation: panel-in .15s ease-out;
        }
        @keyframes panel-in { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }
        .rp-filter-group { display: flex; flex-direction: column; gap: 5px; }
        .rp-filter-label { font-size: 10px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-muted); }

        /* ── Requirement Cards Grid ── */
        .rp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }

        .rp-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-xl); overflow: hidden;
          transition: all .2s cubic-bezier(.4,0,.2,1);
          box-shadow: var(--sh-sm); position: relative;
          animation: card-in .25s ease-out both;
        }
        @keyframes card-in { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .rp-card:hover { box-shadow: var(--sh-md); transform: translateY(-2px); border-color: var(--border-strong); }
        .rp-card.just-added { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-mid), var(--sh-md); }
        .rp-card.dragging { opacity: .45; border-style: dashed; border-color: var(--accent-border); }

        /* top accent bar by strategy */
        .rp-card-top-bar { height: 3px; width: 100%; }
        .rp-card-top-bar.manual { background: var(--border-strong); }
        .rp-card-top-bar.ai_extraction { background: linear-gradient(90deg, var(--accent), #00b8cc); }
        .rp-card-top-bar.third_party { background: linear-gradient(90deg, #3b82f6, #6366f1); }

        .rp-card-body { padding: 16px; }

        .rp-card-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
        .rp-card-drag { color: var(--ink-muted); cursor: grab; padding: 2px; border-radius: 4px; transition: color .15s; margin-top: 1px; }
        .rp-card-drag:hover { color: var(--accent); }
        .rp-card-drag:active { cursor: grabbing; }
        .rp-card-name { font-size: 14px; font-weight: 700; color: var(--ink); line-height: 1.3; flex: 1; }
        .rp-card-configure {
          width: 30px; height: 30px; border-radius: var(--r-sm); border: 1px solid var(--border);
          background: var(--surface); display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--ink-muted); transition: all .15s; flex-shrink: 0;
        }
        .rp-card-configure:hover { border-color: var(--accent-border); color: var(--accent); background: var(--accent-soft); }
        /* spin on hover */
        .rp-card-configure:hover svg { animation: cog-spin .6s linear infinite; }
        @keyframes cog-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }

        .rp-card-delete {
          width: 30px; height: 30px; border-radius: var(--r-sm); border: 1px solid var(--border);
          background: var(--surface); display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--ink-muted); transition: all .15s; flex-shrink: 0;
        }
        .rp-card-delete:hover { border-color: var(--red-border); color: var(--red); background: var(--red-soft); }

        .rp-card-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px; }
        .rp-owner-tag { font-size: 10px; font-weight: 600; padding: 3px 9px; border-radius: 100px; border: 1px solid; display: flex; align-items: center; gap: 4px; }
        .rp-strategy-tag { font-size: 10px; font-weight: 600; padding: 3px 9px; border-radius: 100px; border: 1px solid; display: flex; align-items: center; gap: 4px; }

        /* Validation path row */
        .rp-path { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--r-sm); background: var(--surface-raised); border: 1px solid var(--border); }
        .rp-path-step { display: flex; flex-direction: column; gap: 1px; }
        .rp-path-step-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-muted); }
        .rp-path-step-val { font-size: 11px; font-weight: 600; color: var(--ink-soft); }
        .rp-path-arrow { color: var(--border-strong); flex-shrink: 0; }
        .rp-path-gateway { display: flex; align-items: center; gap: 4px; }

        /* AI badge on card */
        .rp-ai-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 100px;
          background: var(--accent-soft); border: 1px solid var(--accent-border);
          color: var(--accent); font-size: 10px; font-weight: 600;
        }
        .rp-ai-badge svg { animation: zap-flash 2s ease-in-out infinite; }
        @keyframes zap-flash { 0%,100%{opacity:1} 50%{opacity:.4} }

        /* confidence bar */
        .rp-conf-bar-wrap { margin-top: 8px; }
        .rp-conf-bar-label { font-size: 10px; color: var(--ink-muted); font-weight: 500; display: flex; justify-content: space-between; margin-bottom: 4px; }
        .rp-conf-bar-track { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
        .rp-conf-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #00b8cc); border-radius: 2px; transition: width .4s ease; }

        /* ── Empty state ── */
        .rp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 20px; gap: 12px; }
        .rp-empty-icon { width: 56px; height: 56px; border-radius: 16px; background: var(--surface-raised); border: 2px dashed var(--border-strong); display: flex; align-items: center; justify-content: center; color: var(--ink-muted); }
        .rp-empty h3 { font-size: 15px; font-weight: 600; color: var(--ink-soft); }
        .rp-empty p { font-size: 12px; color: var(--ink-muted); text-align: center; max-width: 240px; line-height: 1.5; }

        /* Buttons */
        .btn-ghost { height: 32px; padding: 0 14px; border-radius: 7px; border: 1px solid var(--border-strong); background: #fff; font-size: 12px; font-weight: 500; color: var(--ink-soft); cursor: pointer; transition: all .15s; font-family: 'DM Sans', sans-serif; display: inline-flex; align-items: center; gap: 5px; }
        .btn-ghost:hover { border-color: var(--accent-border); color: var(--accent); background: var(--accent-soft); }

        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }

        /* ── AI Modal ── (enhanced over default) */
        .ai-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(10,10,10,.5); backdrop-filter: blur(5px); padding: 16px; }
        .ai-modal { width: 100%; max-width: 600px; background: #fff; border-radius: 24px; box-shadow: 0 24px 60px rgba(0,0,0,.15); overflow: hidden; animation: modal-in .2s cubic-bezier(.4,0,.2,1); }
        @keyframes modal-in { from{opacity:0;transform:scale(.96) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .ai-modal-hd { padding: 20px 24px; border-bottom: 1px solid var(--border); background: var(--surface-raised); display: flex; align-items: center; gap: 12px; }
        .ai-modal-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--accent-soft); border: 1px solid var(--accent-border); display: flex; align-items: center; justify-content: center; color: var(--accent); }
        .ai-modal-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .ai-modal-sub { font-size: 12px; color: var(--ink-muted); margin-top: 1px; }
        .ai-modal-x { margin-left: auto; width: 28px; height: 28px; border: 1px solid var(--border); background: #fff; border-radius: 7px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--ink-muted); transition: all .15s; }
        .ai-modal-x:hover { background: var(--red-soft); color: var(--red); border-color: var(--red-border); }
        .ai-modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; max-height: 65vh; overflow-y: auto; }
        .ai-modal-ft { padding: 16px 24px; border-top: 1px solid var(--border); background: var(--surface-raised); display: flex; align-items: center; justify-content: space-between; }
        .ai-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; color: var(--ink-muted); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }

        /* strategy selector cards in modal */
        .ai-strategy-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .ai-strategy-opt {
          padding: 12px; border-radius: var(--r-md); border: 1.5px solid var(--border);
          cursor: pointer; background: #fff; text-align: left; font-family: 'DM Sans', sans-serif;
          transition: all .15s;
        }
        .ai-strategy-opt:hover { border-color: var(--accent-border); background: var(--accent-soft); }
        .ai-strategy-opt.active { border-color: var(--accent); background: var(--accent-soft); }
        .ai-strategy-opt-icon { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface-raised); display: flex; align-items: center; justify-content: center; margin-bottom: 7px; transition: all .15s; }
        .ai-strategy-opt.active .ai-strategy-opt-icon { background: var(--accent); border-color: var(--accent); color: #fff; }
        .ai-strategy-opt-name { font-size: 11px; font-weight: 700; color: var(--ink); }
        .ai-strategy-opt-desc { font-size: 10px; color: var(--ink-muted); margin-top: 2px; line-height: 1.4; }

        /* AI config section */
        .ai-conf-section {
          padding: 16px; border-radius: var(--r-lg); border: 1px solid var(--accent-border);
          background: var(--accent-soft); display: flex; flex-direction: column; gap: 14px;
        }
        .ai-conf-header { display: flex; align-items: center; gap: 8px; }
        .ai-conf-title { font-size: 12px; font-weight: 700; color: var(--accent); }
        .ai-conf-sub { font-size: 11px; color: var(--accent); opacity: .7; margin-top: 1px; }

        /* threshold slider */
        .threshold-row { display: flex; align-items: center; gap: 12px; }
        .threshold-slider { flex: 1; -webkit-appearance: none; height: 4px; border-radius: 2px; background: var(--accent-border); outline: none; cursor: pointer; }
        .threshold-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--accent); cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 2px var(--accent-border); transition: all .15s; }
        .threshold-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .threshold-value { font-size: 13px; font-weight: 700; color: var(--accent); font-family: 'DM Mono', monospace; min-width: 38px; text-align: right; }

        /* rules list */
        .rules-list { display: flex; flex-direction: column; gap: 5px; }
        .rule-row { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border-radius: var(--r-sm); background: #fff; border: 1px solid var(--accent-border); }
        .rule-text { font-size: 12px; color: var(--ink-soft); flex: 1; }
        .rule-rm { width: 18px; height: 18px; border: none; background: none; cursor: pointer; color: var(--ink-muted); display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 4px; transition: all .15s; }
        .rule-rm:hover { background: var(--red-soft); color: var(--red); }
        .rule-add-row { display: flex; gap: 7px; }
        .rule-add-input { flex: 1; height: 34px; padding: 0 10px; border-radius: var(--r-sm); border: 1px solid var(--accent-border); background: #fff; font-size: 12px; color: var(--ink); font-family: 'DM Sans', sans-serif; outline: none; }
        .rule-add-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-mid); }
        .rule-add-input::placeholder { color: var(--ink-muted); }
        .rule-add-btn { height: 34px; padding: 0 12px; border-radius: var(--r-sm); border: none; background: var(--accent); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .15s; display: flex; align-items: center; gap: 4px; }
        .rule-add-btn:hover { background: #006070; }

        /* fallback approver */
        .fallback-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--r-sm); background: var(--green-soft); border: 1px solid var(--green-border); }
        .fallback-lbl { font-size: 11px; font-weight: 600; color: var(--green); display: flex; align-items: center; gap: 5px; }
        .fallback-select { border: none; background: none; font-size: 12px; font-weight: 700; color: var(--green); font-family: 'DM Sans', sans-serif; cursor: pointer; outline: none; margin-left: auto; }
      `}</style>

      <div className="rp-root">

        {/* PAGE HEADER */}
        <div className="rp-page-hd">
          <div className="rp-breadcrumb">
            <a href="/admin/workers/onboarding">Onboarding</a>
            <ChevronDown style={{ width: 12, height: 12, transform: 'rotate(-90deg)' }} />
            <span>Requirement Library</span>
          </div>
          <h1 className="rp-title">Requirement Library</h1>
          <p className="rp-subtitle">
            Build reusable requirement blocks here — they appear automatically in the Workflow Builder when creating onboarding pipelines.
          </p>
        </div>

        {/* STATS STRIP */}
        <div className="rp-stats">
          <div className="rp-stat">
            <div className="rp-stat-indicator" style={{ background: '#0a0a0a' }} />
            <div className="rp-stat-val">{requirements.length}</div>
            <div className="rp-stat-lbl">Total Requirements</div>
          </div>
          <div className="rp-stat">
            <div className="rp-stat-indicator" style={{ background: '#9ca3af' }} />
            <div className="rp-stat-val">{manualCount}</div>
            <div className="rp-stat-lbl">Manual Review</div>
          </div>
          <div className="rp-stat">
            <div className="rp-stat-indicator" style={{ background: 'var(--accent)' }} />
            <div className="rp-stat-val">{aiCount}</div>
            <div className="rp-stat-lbl">AI Analysis</div>
          </div>
          <div className="rp-stat">
            <div className="rp-stat-indicator" style={{ background: '#3b82f6' }} />
            <div className="rp-stat-val">{thirdPartyCount}</div>
            <div className="rp-stat-lbl">3rd Party</div>
          </div>
        </div>

        {/* ADD FORM */}
        <div className="rp-add-card">
          <div className="rp-add-card-title">
            <Plus style={{ width: 11, height: 11 }} />
            New Requirement
          </div>
          <div className="rp-add-row">
            <div className="rp-field-wrap">
              <input
                value={newReq.name}
                onChange={e => { setNewReq({ ...newReq, name: e.target.value }); setAddError('') }}
                onKeyDown={e => e.key === 'Enter' && addRequirement()}
                className={`rp-input ${addError ? 'err' : ''}`}
                placeholder="e.g. Background Check, Degree Verification…"
              />
              {addError && (
                <span className="rp-error">
                  <AlertCircle style={{ width: 10, height: 10 }} />
                  {addError}
                </span>
              )}
            </div>
            <div>
              <select
                value={newReq.owner}
                onChange={e => setNewReq({ ...newReq, owner: e.target.value as Requirement['owner'] })}
                className="rp-select"
              >
                <option>Worker</option>
                <option>IT</option>
                <option>Supplier</option>
                <option>Hiring Manager</option>
                <option>System</option>
              </select>
            </div>
            <div>
              <select
                value={newReq.strategy}
                onChange={e => setNewReq({ ...newReq, strategy: e.target.value as ValidationStrategy })}
                className="rp-select"
              >
                <option value="manual">Manual Review</option>
                <option value="ai_extraction">AI Analysis</option>
                <option value="third_party">3rd Party Integration</option>
              </select>
            </div>
            <button className="rp-add-btn" onClick={addRequirement}>
              <Plus style={{ width: 14, height: 14 }} />
              Add
            </button>
          </div>

          {/* Strategy hint */}
          {newReq.strategy !== 'manual' && (
            <div className={`rp-strategy-hint ${newReq.strategy === 'ai_extraction' ? 'ai' : 'third_party'}`}>
              {newReq.strategy === 'ai_extraction' ? (
                <>
                  <Zap style={{ width: 14, height: 14, flexShrink: 0 }} />
                  <span><strong>AI Analysis:</strong> Nova will automatically extract and verify document data against configurable compliance rules. Set confidence thresholds after adding.</span>
                </>
              ) : (
                <>
                  <Link2 style={{ width: 14, height: 14, flexShrink: 0 }} />
                  <span><strong>3rd Party:</strong> Verification is handled via external API integration. Configure the endpoint in the compliance settings.</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* TOOLBAR */}
        <div className="rp-toolbar">
          <div className="rp-search-wrap">
            <Search className="rp-search-icon" style={{ width: 14, height: 14 }} />
            <input
              className="rp-search"
              placeholder="Search requirements…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`rp-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(p => !p)}
          >
            <Filter style={{ width: 13, height: 13 }} />
            Filters
            {activeFilters > 0 && <span className="rp-filter-badge">{activeFilters}</span>}
          </button>
          {activeFilters > 0 && (
            <button className="btn-ghost" onClick={() => { setFilterOwner('all'); setFilterStrategy('all'); setSearch('') }}>
              <X style={{ width: 11, height: 11 }} />
              Clear
            </button>
          )}
          <span className="rp-result-count">{filtered.length}/{requirements.length}</span>
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <div className="rp-filter-panel">
            <div className="rp-filter-group">
              <label className="rp-filter-label">Owner</label>
              <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="rp-select">
                <option value="all">All Owners</option>
                <option>Worker</option>
                <option>Supplier</option>
                <option>Hiring Manager</option>
                <option>IT</option>
                <option>System</option>
              </select>
            </div>
            <div className="rp-filter-group">
              <label className="rp-filter-label">Validation Strategy</label>
              <select value={filterStrategy} onChange={e => setFilterStrategy(e.target.value)} className="rp-select">
                <option value="all">All Strategies</option>
                <option value="manual">Manual Review</option>
                <option value="ai_extraction">AI Analysis</option>
                <option value="third_party">3rd Party</option>
              </select>
            </div>
          </div>
        )}

        {/* CARDS GRID */}
        {filtered.length === 0 ? (
          <div className="rp-empty" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)' }}>
            <div className="rp-empty-icon">
              <Search style={{ width: 22, height: 22 }} />
            </div>
            <h3>{requirements.length === 0 ? 'No requirements yet' : 'No results found'}</h3>
            <p>{requirements.length === 0 ? 'Add your first requirement above. It will be available in all onboarding workflows.' : 'Try adjusting your search or filters.'}</p>
          </div>
        ) : (
          <div className="rp-grid">
            {filtered.map((req, idx) => {
              const ownerStyle = OWNER_CONFIG[req.owner] ?? OWNER_CONFIG['System']
              const stratCfg = STRATEGY_CONFIG[req.strategy]
              const StratIcon = stratCfg.icon
              const isAI = req.strategy === 'ai_extraction'
              const isAdded = req.id === justAdded

              return (
                <div
                  key={req.id}
                  className={`rp-card ${isAdded ? 'just-added' : ''} ${dragId === req.id ? 'dragging' : ''}`}
                  style={{ animationDelay: `${idx * 0.04}s` }}
                  draggable
                  onDragStart={() => setDragId(req.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(req.id)}
                  onDragEnd={() => setDragId(null)}
                >
                  {/* Top accent bar by strategy */}
                  <div className={`rp-card-top-bar ${req.strategy}`} />

                  <div className="rp-card-body">
                    {/* Header */}
                    <div className="rp-card-hd">
                      <GripVertical className="rp-card-drag" style={{ width: 13, height: 13 }} />
                      <div className="rp-card-name">{req.name}</div>
                      <button className="rp-card-configure" onClick={() => setSelected(req)} title="Configure">
                        <Cog style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        className="rp-card-delete"
                        onClick={() => handleUpdate(requirements.filter(r => r.id !== req.id))}
                        title="Delete requirement"
                      >
                        <X style={{ width: 13, height: 13 }} />
                      </button>
                    </div>

                    {/* Tags */}
                    <div className="rp-card-tags">
                      <span
                        className="rp-owner-tag"
                        style={{ background: ownerStyle.bg, color: ownerStyle.color, borderColor: ownerStyle.border }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: ownerStyle.dot, flexShrink: 0, display: 'inline-block' }} />
                        {req.owner}
                      </span>
                      <span
                        className="rp-strategy-tag"
                        style={{ background: stratCfg.bg, color: stratCfg.color, borderColor: stratCfg.border }}
                      >
                        <StratIcon style={{ width: 9, height: 9 }} />
                        {stratCfg.label}
                      </span>
                    </div>

                    {/* Validation path */}
                    <div className="rp-path">
                      <div className="rp-path-step">
                        <div className="rp-path-step-lbl">Primary</div>
                        <div className="rp-path-step-val">
                          {req.strategy === 'manual' ? 'Human Review' : req.strategy === 'ai_extraction' ? 'AI Auto-Check' : '3rd Party API'}
                        </div>
                      </div>
                      <ArrowRight className="rp-path-arrow" style={{ width: 13, height: 13 }} />
                      <div className="rp-path-step">
                        <div className="rp-path-step-lbl" style={{ color: '#047857' }}>Gateway</div>
                        <div className="rp-path-gateway">
                          <ShieldCheck style={{ width: 11, height: 11, color: '#059669' }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)' }}>
                            {req.fallbackApprover ?? 'HR'} Group
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* AI section */}
                    {isAI && req.compliance && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span className="rp-ai-badge">
                            <Zap style={{ width: 9, height: 9 }} />
                            Nova Analysis
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--ink-muted)' }}>
                            {(req.compliance.rules ?? []).length} rule{(req.compliance.rules ?? []).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="rp-conf-bar-wrap">
                          <div className="rp-conf-bar-label">
                            <span>Confidence Threshold</span>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--accent)' }}>
                              {req.compliance.confidenceThreshold ?? 85}%
                            </span>
                          </div>
                          <div className="rp-conf-bar-track">
                            <div className="rp-conf-bar-fill" style={{ width: `${req.compliance.confidenceThreshold ?? 85}%` }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* AI COMPLIANCE MODAL */}
        {selected && (
          <EnhancedConfigModal
            requirement={selected}
            onClose={() => setSelected(null)}
            onSave={(updates) => {
              const next = requirements.map(r => r.id === selected.id ? { ...r, ...updates } : r)
              handleUpdate(next)
              setSelected(null)
            }}
          />
        )}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────
   ENHANCED CONFIG MODAL
   (replaces AIComplianceModal with a richer
   inline version that works without the
   external component if needed)
───────────────────────────────────────── */
function EnhancedConfigModal({
  requirement,
  onClose,
  onSave,
}: {
  requirement: Requirement
  onClose: () => void
  onSave: (updates: Partial<Requirement>) => void
}) {
  const [strategy, setStrategy] = useState<ValidationStrategy>(requirement.strategy)
  const [fallback, setFallback] = useState(requirement.fallbackApprover ?? 'HR')
  const [threshold, setThreshold] = useState(requirement.compliance?.confidenceThreshold ?? 85)
  const [rules, setRules] = useState<string[]>(requirement.compliance?.rules ?? [])
  const [newRule, setNewRule] = useState('')
  const [owner, setOwner] = useState<Requirement['owner']>(requirement.owner)
  const [saved, setSaved] = useState(false)

  const strategyOptions: { key: ValidationStrategy; label: string; icon: any; desc: string }[] = [
    { key: 'manual', label: 'Manual Review', icon: Clock, desc: 'Assigned approver reviews and approves manually' },
    { key: 'ai_extraction', label: 'AI Analysis', icon: Zap, desc: 'Nova extracts & verifies against your rules' },
    { key: 'third_party', label: '3rd Party API', icon: Link2, desc: 'External service handles verification' },
  ]

  function addRule() {
    if (!newRule.trim()) return
    setRules(p => [...p, newRule.trim()])
    setNewRule('')
  }

  function handleSave() {
    onSave({
      owner,
      strategy,
      fallbackApprover: fallback,
      compliance: strategy === 'ai_extraction' ? { rules, confidenceThreshold: threshold } : undefined,
    })
    setSaved(true)
  }

  return (
    <div className="ai-overlay">
      <div className="ai-modal">
        <div className="ai-modal-hd">
          <div className="ai-modal-icon">
            <Sliders style={{ width: 16, height: 16 }} />
          </div>
          <div>
            <div className="ai-modal-title">{requirement.name}</div>
            <div className="ai-modal-sub">Configure validation logic & compliance rules</div>
          </div>
          <button className="ai-modal-x" onClick={onClose}><X style={{ width: 13, height: 13 }} /></button>
        </div>

        <div className="ai-modal-body scrollbar-thin">

          {/* Owner */}
          <div>
            <div className="ai-section-title"><User style={{ width: 11, height: 11 }} />Accountable Owner</div>
            <select
              value={owner}
              onChange={e => setOwner(e.target.value as Requirement['owner'])}
              style={{ height: 36, padding: '0 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-raised)', fontSize: 13, color: 'var(--ink)', fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%' }}
            >
              <option>Worker</option>
              <option>IT</option>
              <option>Supplier</option>
              <option>Hiring Manager</option>
              <option>System</option>
            </select>
          </div>

          {/* Strategy */}
          <div>
            <div className="ai-section-title"><Target style={{ width: 11, height: 11 }} />Validation Strategy</div>
            <div className="ai-strategy-grid">
              {strategyOptions.map(opt => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.key}
                    className={`ai-strategy-opt ${strategy === opt.key ? 'active' : ''}`}
                    onClick={() => setStrategy(opt.key)}
                  >
                    <div className="ai-strategy-opt-icon">
                      <Icon style={{ width: 13, height: 13, color: strategy === opt.key ? '#fff' : 'var(--ink-soft)' }} />
                    </div>
                    <div className="ai-strategy-opt-name">{opt.label}</div>
                    <div className="ai-strategy-opt-desc">{opt.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* AI CONFIG — only when ai_extraction selected */}
          {strategy === 'ai_extraction' && (
            <div className="ai-conf-section">
              <div className="ai-conf-header">
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain style={{ width: 14, height: 14, color: '#fff' }} />
                </div>
                <div>
                  <div className="ai-conf-title">Nova Compliance Engine</div>
                  <div className="ai-conf-sub">Define rules Nova checks during document analysis</div>
                </div>
              </div>

              {/* Confidence threshold */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Percent style={{ width: 10, height: 10 }} />
                  Confidence Threshold
                </div>
                <div className="threshold-row">
                  <input
                    type="range" min={50} max={99} value={threshold}
                    onChange={e => setThreshold(Number(e.target.value))}
                    className="threshold-slider"
                  />
                  <span className="threshold-value">{threshold}%</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--accent)', opacity: 0.7, marginTop: 4 }}>
                  {threshold >= 90 ? '⚡ Very strict — high accuracy required' : threshold >= 75 ? '✓ Balanced — recommended for most cases' : '⚠ Lenient — may allow uncertain results'}
                </div>
              </div>

              {/* Rules */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
                  Compliance Rules
                </div>
                {rules.length > 0 && (
                  <div className="rules-list" style={{ marginBottom: 8 }}>
                    {rules.map((rule, i) => (
                      <div key={i} className="rule-row">
                        <CheckCircle2 style={{ width: 12, height: 12, color: 'var(--accent)', flexShrink: 0 }} />
                        <span className="rule-text">{rule}</span>
                        <button className="rule-rm" onClick={() => setRules(p => p.filter((_, j) => j !== i))}>
                          <X style={{ width: 10, height: 10 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rule-add-row">
                  <input
                    className="rule-add-input"
                    placeholder="e.g. Must be issued within last 3 years"
                    value={newRule}
                    onChange={e => setNewRule(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addRule()}
                  />
                  <button className="rule-add-btn" onClick={addRule}>
                    <Plus style={{ width: 12, height: 12 }} />
                    Add
                  </button>
                </div>
                {rules.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', opacity: 0.6, marginTop: 6, fontStyle: 'italic' }}>
                    No rules yet — Nova will use general document validation logic.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fallback approver */}
          <div>
            <div className="ai-section-title"><ShieldCheck style={{ width: 11, height: 11, color: '#047857' }} />Fallback Gateway</div>
            <div className="fallback-row">
              <ShieldCheck style={{ width: 14, height: 14, color: '#059669', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#047857' }}>Approval Gateway</div>
                <div style={{ fontSize: 10, color: '#059669', marginTop: 1 }}>
                  Manual escalation if primary validation fails
                </div>
              </div>
              <select
                value={fallback}
                onChange={e => setFallback(e.target.value)}
                className="fallback-select"
              >
                <option>HR</option>
                <option>Legal</option>
                <option>Compliance</option>
                <option>IT Security</option>
                <option>Manager</option>
              </select>
            </div>
          </div>
        </div>

        <div className="ai-modal-ft">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            onClick={handleSave}
            style={{
              height: 34, padding: '0 20px', borderRadius: 8, border: 'none',
              background: saved ? '#047857' : '#0a0a0a', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseOver={e => { if (!saved) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)' }}
            onMouseOut={e => { if (!saved) (e.currentTarget as HTMLButtonElement).style.background = '#0a0a0a' }}
          >
            {saved ? <><CheckCircle2 style={{ width: 13, height: 13 }} />Saved</> : <>Save Configuration</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function StrategyBadge({ strategy }: { strategy: ValidationStrategy }) {
  const cfg = STRATEGY_CONFIG[strategy]
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 100, border: `1px solid ${cfg.border}`,
      background: cfg.bg, color: cfg.color, fontSize: 9, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.07em',
    }}>
      <Icon style={{ width: 9, height: 9 }} />
      {cfg.label}
    </span>
  )
}