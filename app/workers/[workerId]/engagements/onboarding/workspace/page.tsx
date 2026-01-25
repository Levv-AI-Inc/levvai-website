"use client";

import React, { useState } from "react";
import {
  Activity,
  Lock,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Zap,
  Cog,
  User,
  Info,
  CheckCircle2,
  GitMerge,
  PowerOff,
  PackageCheck,
  ShieldX,
  Link2,
  UserCircle2
} from "lucide-react";

/* ======================
    TYPES & MOCK DATA
====================== */
type BlockStatus = "complete" | "active" | "locked";
type ValidationStrategy = 'manual' | 'ai_extraction' | 'third_party';

interface Requirement {
  id: string;
  name: string;
  isDone: boolean;
  owner: string; // The "Accountable" person
  strategy: ValidationStrategy;
  approver: string; // The "Validator" group
}

interface OrchestrationBlock {
  id: string;
  name: string;
  gate: "HARD" | "SOFT";
  status: BlockStatus;
  progress: number;
  impactDays: number;
  reason?: string;
  type: "MANUAL" | "SYSTEM";
  requirements: Requirement[];
}

const ONBOARDING_BLOCKS: OrchestrationBlock[] = [
  {
    id: "b1",
    name: "Identity & Eligibility",
    gate: "HARD",
    status: "complete",
    progress: 100,
    impactDays: 0,
    type: "MANUAL",
    requirements: [
      { id: "r1", name: "Gov. Photo ID", isDone: true, owner: 'Worker', strategy: 'ai_extraction', approver: 'AI' },
      { id: "r2", name: "Right to Work", isDone: true, owner: 'Worker', strategy: 'manual', approver: 'HR' },
    ],
  },
  {
    id: "b2",
    name: "Legal & Compliance",
    gate: "HARD",
    status: "active",
    progress: 65,
    impactDays: 14,
    type: "MANUAL",
    reason: "Awaiting Background Check",
    requirements: [
      { id: "r3", name: "Signed NDA", isDone: true, owner: 'Worker', strategy: 'manual', approver: 'LEGAL' },
      { id: "r4", name: "Background Screening", isDone: false, owner: 'Worker', strategy: 'third_party', approver: 'SECURITY' },
    ],
  },
  {
    id: "b3",
    name: "Hardware Deployment",
    gate: "SOFT",
    status: "active",
    progress: 30,
    impactDays: 5,
    type: "SYSTEM",
    reason: "Order Placed",
    requirements: [
      { id: "r6", name: "Asset Assignment", isDone: false, owner: 'IT', strategy: 'third_party', approver: 'SYSTEM' },
    ],
  },
  {
    id: "b4",
    name: "HCM Integration",
    gate: "HARD",
    status: "locked",
    progress: 0,
    impactDays: 2,
    type: "SYSTEM",
    requirements: [
      { id: "r8", name: "Workday Record Sync", isDone: false, owner: 'System', strategy: 'third_party', approver: 'SYSTEM' }
    ],
  },
];

const OFFBOARDING_BLOCKS: OrchestrationBlock[] = [
  {
    id: "off-b1",
    name: "Offboarding Notification",
    gate: "HARD",
    status: "locked",
    progress: 0,
    impactDays: 0,
    type: "SYSTEM",
    requirements: [
      { id: "or1", name: "Manager Notification", isDone: false, owner: 'System', strategy: 'manual', approver: 'HR' },
      { id: "or2", name: "Supplier De-activation", isDone: false, owner: 'System', strategy: 'manual', approver: 'HR' },
    ],
  },
  {
    id: "off-b2",
    name: "Security & Access Revocation",
    gate: "HARD",
    status: "locked",
    progress: 0,
    impactDays: 1,
    type: "SYSTEM",
    reason: "Awaiting Trigger",
    requirements: [
      { id: "or3", name: "SSO/Okta Access Removal", isDone: false, owner: 'System', strategy: 'third_party', approver: 'SYSTEM' },
      { id: "or4", name: "Badge De-provisioning", isDone: false, owner: 'System', strategy: 'third_party', approver: 'SYSTEM' },
    ],
  },
  {
    id: "off-b3",
    name: "Asset Recovery",
    gate: "SOFT",
    status: "locked",
    progress: 0,
    impactDays: 7,
    type: "MANUAL",
    reason: "Logistics Queue",
    requirements: [
      { id: "or5", name: "Hardware Collection", isDone: false, owner: 'IT', strategy: 'manual', approver: 'IT' },
    ],
  },
  {
    id: "off-b4",
    name: "HCM Deactivation",
    gate: "HARD",
    status: "locked",
    progress: 0,
    impactDays: 0,
    type: "SYSTEM",
    requirements: [
      { id: "or6", name: "Final Record Closure", isDone: false, owner: 'System', strategy: 'third_party', approver: 'SYSTEM' }
    ],
  },
];

export default function UnifiedPulseWorkspace() {
  const [activeTab, setActiveTab] = useState<'onboarding' | 'offboarding'>('onboarding');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const currentBlocks = activeTab === 'onboarding' ? ONBOARDING_BLOCKS : OFFBOARDING_BLOCKS;

  return (
    <div className="min-h-screen bg-[#fafafa] p-12 antialiased" style={{ fontFamily: '"Inter", sans-serif' }}>
      
      {/* HEADER: WORKER & INTELLIGENCE TILES */}
      <div className="max-w-7xl mx-auto mb-10 flex justify-between items-center">
        <div className="flex items-center gap-4 text-slate-900">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all ${activeTab === 'onboarding' ? 'bg-slate-950 border-2 border-cyan-400' : 'bg-slate-400'}`}>
            <User className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight">John Smith</h1>
            <div className="flex gap-4">
              <button 
                onClick={() => { setActiveTab('onboarding'); setSelectedBlockId(null); }}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all pb-1 ${activeTab === 'onboarding' ? 'text-cyan-600 border-b-2 border-cyan-600' : 'text-slate-400 border-b-2 border-transparent hover:text-slate-600'}`}
              >
                Onboarding Flow
              </button>
              <button 
                onClick={() => { setActiveTab('offboarding'); setSelectedBlockId(null); }}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all pb-1 ${activeTab === 'offboarding' ? 'text-cyan-600 border-b-2 border-cyan-600' : 'text-slate-400 border-b-2 border-transparent hover:text-slate-600'}`}
              >
                Offboarding Flow
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <StatTile 
            label={activeTab === 'onboarding' ? "Gated Readiness" : "Cleanup Progress"} 
            value={activeTab === 'onboarding' ? "14%" : "0%"} 
            dim={activeTab === 'offboarding'}
          />
          <StatTile 
            label={activeTab === 'onboarding' ? "Est. Activation" : "Est. Closure"} 
            value={activeTab === 'onboarding' ? "12 Days" : "7 Days"} 
            dim={activeTab === 'offboarding'}
          />
          
          <div className={`rounded-2xl p-4 px-6 text-white shadow-xl border border-white/10 flex items-center gap-4 max-w-sm transition-all ${activeTab === 'onboarding' ? 'bg-slate-950' : 'bg-slate-800 opacity-60'}`}>
            <div className={`p-2 rounded-lg shrink-0 ${activeTab === 'onboarding' ? 'bg-cyan-500/20' : 'bg-slate-700'}`}>
              {activeTab === 'onboarding' ? <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400" /> : <PowerOff className="w-4 h-4 text-slate-400" />}
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest ${activeTab === 'onboarding' ? 'text-cyan-400' : 'text-slate-400'}`}>Orchestration Pulse</p>
              <p className="text-xs font-medium text-slate-300 italic leading-tight mt-1">
                {activeTab === 'onboarding' 
                  ? "Legal gate is locked. Background Screening (Worker) must be verified by Security Group to unlock HCM Sync." 
                  : "Worker is currently active. Initiating offboarding will trigger security revocation and asset recovery lanes."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DYNAMIC ORCHESTRATION CANVAS */}
      <div className="max-w-7xl mx-auto py-20 flex items-center justify-center relative">
        
        {/* BLOCK 1: START POINT */}
        <CompactNode 
          block={currentBlocks[0]} 
          isSelected={selectedBlockId === currentBlocks[0].id}
          onClick={() => setSelectedBlockId(selectedBlockId === currentBlocks[0].id ? null : currentBlocks[0].id)}
        />

        {/* FORK POINT */}
        <div className="flex flex-col items-center px-10">
          <div className={`w-20 h-[2px] relative transition-colors ${activeTab === 'onboarding' ? 'bg-slate-950' : 'bg-slate-200'}`}>
             <div className="absolute right-0 -top-2"><ChevronRight className={`w-4 h-4 ${activeTab === 'onboarding' ? 'text-slate-950' : 'text-slate-200'}`} /></div>
          </div>
        </div>

        {/* PARALLEL LANES */}
        <div className="flex flex-col gap-16 relative">
          <CompactNode 
            block={currentBlocks[1]} 
            isHeartbeat={activeTab === 'onboarding' && currentBlocks[1].status === 'active'} 
            isSelected={selectedBlockId === currentBlocks[1].id}
            onClick={() => setSelectedBlockId(selectedBlockId === currentBlocks[1].id ? null : currentBlocks[1].id)}
            customIcon={activeTab === 'offboarding' ? ShieldX : undefined}
          />
          
          <CompactNode 
            block={currentBlocks[2]} 
            isSpinning={activeTab === 'onboarding' && currentBlocks[2].status === 'active'} 
            isSelected={selectedBlockId === currentBlocks[2].id}
            onClick={() => setSelectedBlockId(selectedBlockId === currentBlocks[2].id ? null : currentBlocks[2].id)}
            customIcon={activeTab === 'offboarding' ? PackageCheck : undefined}
          />

          {/* Convergence Bracket */}
          <div className="absolute -right-16 top-0 bottom-0 flex flex-col justify-center">
             <div className="w-[2px] h-full bg-slate-200 rounded-full" />
             <div className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-[2px] bg-slate-200" />
          </div>
        </div>

        {/* CONVERGENCE POINT TO FINAL BLOCK */}
        <div className="px-16 flex items-center">
           <GitMerge className={`w-8 h-8 mr-12 transition-colors ${activeTab === 'onboarding' ? 'text-slate-400' : 'text-slate-200'}`} />
           <CompactNode 
            block={currentBlocks[3]} 
            isSelected={selectedBlockId === currentBlocks[3].id}
            onClick={() => setSelectedBlockId(selectedBlockId === currentBlocks[3].id ? null : currentBlocks[3].id)}
            customIcon={activeTab === 'offboarding' ? PowerOff : undefined}
          />
        </div>

      </div>

      <style jsx global>{`
        @keyframes softPulse {
          0% { box-shadow: 0 0 0 0 rgba(8, 145, 178, 0.4); transform: scale(1); }
          50% { box-shadow: 0 0 0 20px rgba(8, 145, 178, 0); transform: scale(1.03); }
          100% { box-shadow: 0 0 0 0 rgba(8, 145, 178, 0); transform: scale(1); }
        }
        .animate-heartbeat-subtle {
          animation: softPulse 2.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}

/* ======================
    SUB-COMPONENTS
====================== */

function StatTile({ label, value, dim }: { label: string, value: string, dim?: boolean }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-4 px-6 shadow-sm transition-all ${dim ? 'opacity-60 grayscale' : ''}`}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black tracking-tight ${dim ? 'text-slate-400' : 'text-slate-950'}`}>{value}</p>
    </div>
  )
}

function CompactNode({ block, isHeartbeat, isSpinning, isSelected, onClick, customIcon: CustomIcon }: any) {
  const isComplete = block.status === "complete";
  const isActive = block.status === "active";
  const isLocked = block.status === "locked";

  return (
    <div 
      onClick={onClick}
      className={`
      relative flex flex-col w-72 rounded-[2.5rem] border transition-all duration-500 cursor-pointer text-slate-900
      ${isComplete ? "bg-white border-emerald-200 shadow-md" : ""}
      ${isActive ? "bg-white border-slate-950 z-10 " + (isHeartbeat ? "animate-heartbeat-subtle shadow-2xl" : "shadow-xl") : ""}
      ${isLocked ? "bg-[#f8f8f8] border-slate-200 opacity-60 border-dashed" : ""}
      ${isSelected ? "ring-4 ring-cyan-500/10 scale-105" : "hover:scale-[1.02]"}
    `}>
      {/* Gating Label */}
      <div className="absolute -top-3 right-8 px-3 py-1 rounded-full bg-white border border-slate-200 flex items-center gap-1.5 shadow-sm">
        {block.gate === "HARD" ? <ShieldAlert className="w-3 h-3 text-rose-500" /> : <AlertTriangle className="w-3 h-3 text-amber-500" />}
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{block.gate} GATE</span>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${isComplete ? "bg-emerald-50 shadow-inner" : isActive ? "bg-slate-950 shadow-lg shadow-cyan-900/20" : "bg-slate-100"}`}>
            {CustomIcon ? (
                <CustomIcon className="w-6 h-6 text-slate-400" />
            ) : isComplete ? (
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            ) : isSpinning ? (
              <Cog className="w-6 h-6 text-cyan-400 animate-spin" />
            ) : (
              <Activity className={`w-6 h-6 ${isActive ? "text-cyan-400" : "text-slate-300"}`} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className={`text-base font-black truncate tracking-tight ${isLocked ? "text-slate-400" : "text-slate-950"}`}>
              {block.name}
            </h3>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isComplete ? 'text-emerald-600' : 'text-slate-400'}`}>
              {isComplete ? "Certified Done" : isLocked ? "Gated Access" : "In Flight"}
            </p>
          </div>
        </div>

        {isSelected ? (
          <div className="space-y-4 py-4 border-t border-slate-100 mt-2 animate-in slide-in-from-top-2 duration-300">
            {block.requirements.map((req: any) => (
              <div key={req.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{req.name}</span>
                  {req.isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-200" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                   <span className="flex items-center gap-1"><UserCircle2 className="w-2.5 h-2.5" /> {req.owner}</span>
                   <span className="text-slate-200">|</span>
                   <span className="flex items-center gap-1">
                     {req.strategy === 'ai_extraction' && <Zap className="w-2.5 h-2.5" />}
                     {req.strategy === 'third_party' && <Link2 className="w-2.5 h-2.5" />}
                     {req.strategy}
                   </span>
                   <span className="text-slate-200">|</span>
                   <span className="text-cyan-600">Review: {req.approver}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4 border border-slate-50">
            <div 
              className={`h-full transition-all duration-1000 ${isComplete ? "bg-emerald-500" : isLocked ? "bg-slate-200" : "bg-cyan-500"}`}
              style={{ width: `${block.progress}%` }}
            />
          </div>
        )}

        <div className="flex justify-between items-center h-5 mt-1">
          <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-slate-950' : 'text-slate-400'}`}>
            {isComplete ? 'Cleared' : `+${block.impactDays}d impact`}
          </span>
          {isActive && block.reason && !isSelected && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-[9px] font-black text-rose-600 uppercase">
              <Info className="w-2.5 h-2.5" />
              {block.reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}