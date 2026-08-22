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
  ShieldX
} from "lucide-react";

/* ======================
   TYPES & DATA
====================== */
type BlockStatus = "complete" | "active" | "locked";

interface Requirement {
  id: string;
  name: string;
  isDone: boolean;
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
      { id: "or1", name: "Manager Notification", isDone: false },
      { id: "or2", name: "Supplier De-activation", isDone: false },
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
      { id: "or3", name: "SSO/Okta Access Removal", isDone: false },
      { id: "or4", name: "Badge De-provisioning", isDone: false },
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
      { id: "or5", name: "Hardware Collection", isDone: false },
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
      { id: "or6", name: "Final Record Closure", isDone: false }
    ],
  },
];

export default function EngagementOffboardingWorkspacePage() {
  const [activeTab, setActiveTab] = useState<'onboarding' | 'offboarding'>('offboarding');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#fafafa] p-12 antialiased" style={{ fontFamily: '"Inter", sans-serif' }}>
      
      {/* HEADER: MIRRORED FROM ONBOARDING */}
      <div className="max-w-7xl mx-auto mb-10 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
            <User className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">John Smith</h1>
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab('onboarding')}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'onboarding' ? 'text-cyan-600 border-b-2 border-cyan-600' : 'text-slate-400'}`}
              >
                Onboarding
              </button>
              <button 
                onClick={() => setActiveTab('offboarding')}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'offboarding' ? 'text-cyan-600 border-b-2 border-cyan-600' : 'text-slate-400'}`}
              >
                Offboarding
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <StatTile label="Offboarding Readiness" value="0%" />
          <StatTile label="Est. Cleanup" value="7 Days" />
          
          {/* NOVA INTEL TILE (OFFBOARDING MODE) */}
          <div className="bg-slate-900 rounded-2xl p-4 px-6 text-white shadow-xl border border-white/10 flex items-center gap-4 max-w-sm opacity-50">
            <div className="p-2 bg-slate-700 rounded-lg shrink-0">
              <PowerOff className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nova Intel</p>
              <p className="text-xs font-medium text-slate-400">
                Offboarding sequence has not been initiated. Data is ready for archival.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ORCHESTRATION CANVAS: REVERSE FLOW */}
      <div className="max-w-7xl mx-auto py-20 flex items-center justify-center relative">
        
        {/* BLOCK 1: START (NOTIFICATION) */}
        <CompactNode 
          block={OFFBOARDING_BLOCKS[0]} 
          isSelected={selectedBlockId === "off-b1"}
          onClick={() => setSelectedBlockId(selectedBlockId === "off-b1" ? null : "off-b1")}
        />

        {/* FORK POINT */}
        <div className="flex flex-col items-center px-10">
          <div className="w-16 h-[2px] bg-slate-200 relative">
             <div className="absolute right-0 -top-2"><ChevronRight className="w-4 h-4 text-slate-200" /></div>
          </div>
        </div>

        {/* PARALLEL OFFBOARDING LANES */}
        <div className="flex flex-col gap-16 relative">
          {/* Top: Access (System) */}
          <div className="flex items-center">
            <CompactNode 
              block={OFFBOARDING_BLOCKS[1]} 
              isSelected={selectedBlockId === "off-b2"}
              onClick={() => setSelectedBlockId(selectedBlockId === "off-b2" ? null : "off-b2")}
              customIcon={ShieldX}
            />
          </div>
          
          {/* Bottom: Asset (Manual) */}
          <div className="flex items-center">
            <CompactNode 
              block={OFFBOARDING_BLOCKS[2]} 
              isSelected={selectedBlockId === "off-b3"}
              onClick={() => setSelectedBlockId(selectedBlockId === "off-b3" ? null : "off-b3")}
              customIcon={PackageCheck}
            />
          </div>

          {/* Convergence Bracket */}
          <div className="absolute -right-16 top-0 bottom-0 flex flex-col justify-center">
             <div className="w-[2px] h-full bg-slate-100 rounded-full" />
             <div className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-[2px] bg-slate-100" />
          </div>
        </div>

        {/* CONVERGENCE TO FINAL HCM DEACTIVATION */}
        <div className="px-16 flex items-center">
           <GitMerge className="w-6 h-6 text-slate-200 mr-10" />
           <CompactNode 
            block={OFFBOARDING_BLOCKS[3]} 
            isSelected={selectedBlockId === "off-b4"}
            onClick={() => setSelectedBlockId(selectedBlockId === "off-b4" ? null : "off-b4")}
            customIcon={PowerOff}
          />
        </div>

      </div>
    </div>
  );
}

/* ======================
   SUB-COMPONENTS (Greyed Out Theme)
====================== */

function StatTile({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 px-6 shadow-sm opacity-60">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-xl font-bold text-slate-400 tracking-tighter">{value}</p>
    </div>
  )
}

function CompactNode({ block, isSelected, onClick, customIcon: CustomIcon }: any) {
  const isLocked = block.status === "locked";

  return (
    <div 
      onClick={onClick}
      className={`
      relative flex flex-col w-64 rounded-[2rem] border transition-all duration-500 cursor-pointer bg-white
      ${isLocked ? "border-slate-100 opacity-60 border-dashed hover:opacity-90" : ""}
      ${isSelected ? "ring-2 ring-slate-200 scale-105 opacity-100" : ""}
    `}>
      <div className="absolute -top-2.5 right-6 px-2.5 py-1 rounded-full bg-white border border-slate-100 flex items-center gap-1 shadow-sm">
        {block.gate === "HARD" ? <ShieldAlert className="w-2.5 h-2.5 text-slate-300" /> : <AlertTriangle className="w-2.5 h-2.5 text-slate-300" />}
        <span className="text-[8px] font-black uppercase tracking-tighter text-slate-400">{block.gate}</span>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50">
            {CustomIcon ? (
              <CustomIcon className="w-5 h-5 text-slate-300" />
            ) : block.type === "SYSTEM" ? (
              <Cog className="w-5 h-5 text-slate-300" />
            ) : (
              <Activity className="w-5 h-5 text-slate-300" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate tracking-tight text-slate-400">
              {block.name}
            </h3>
            <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-300">
              Queued
            </p>
          </div>
        </div>

        {isSelected ? (
          <div className="space-y-3 py-2 border-t border-slate-50 mt-2 animate-in fade-in duration-300">
            {block.requirements.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{req.name}</span>
                <div className="w-3.5 h-3.5 rounded-full border border-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden mb-3" />
        )}

        <div className="flex justify-between items-center h-4 mt-1">
          <span className="text-[9px] font-black uppercase tracking-tighter text-slate-300">
            +{block.impactDays}d impact
          </span>
          {block.reason && !isSelected && (
            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-300">
              <Info className="w-2 h-2" />
              {block.reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}