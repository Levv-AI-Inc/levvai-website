"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from 'next/navigation';
import {
  Search,
  User,
  Clock,
  X,
  ChevronRight,
  Sparkles,
  ChevronDown,
  Filter,
  Eye,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  Zap,
  ShieldAlert,
  Layers,
  Link2
} from "lucide-react";

// --- Updated Data to reflect the Logic from the Requirements Store ---
const onboardingRows = [
  {
    workerId: '123',
    name: 'John Smith',
    role: 'Senior React Developer',
    supplier: 'TEKsystems',
    startDate: 'Sep 23, 2026',
    readiness: 50,
    status: 'In Progress',
    pendingWith: 'IT',
    currentBlockerTask: 'Hardware Provisioning',
    manager: 'Alex Morgan',
    department: 'Engineering'
  },
  {
    workerId: '124',
    name: 'Maria Gonzalez',
    role: 'Business Analyst',
    supplier: 'Randstad',
    startDate: 'Sep 25, 2026',
    readiness: 72,
    status: 'Blocked',
    pendingWith: 'LEGAL',
    currentBlockerTask: 'Non-Standard NDA Review',
    manager: 'Rachel Adams',
    department: 'Transformation Office'
  },
  {
    workerId: '125',
    name: 'David Chen',
    role: 'QA Engineer',
    supplier: 'Insight Global',
    startDate: 'Oct 01, 2026',
    readiness: 100,
    status: 'Ready',
    pendingWith: 'SYSTEM',
    currentBlockerTask: 'Fully Validated',
    manager: 'Daniel Lee',
    department: 'Product Quality'
  },
  {
    workerId: '126',
    name: 'Elena Rossi',
    role: 'UX Designer',
    supplier: 'Aquent',
    startDate: 'Oct 05, 2026',
    readiness: 45,
    status: 'In Progress',
    pendingWith: 'HR',
    currentBlockerTask: 'ID Document Verification',
    manager: 'Sarah Jenkins',
    department: 'Product Design'
  }
];

export default function EngagementsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [aiInput, setAiInput] = useState("");

  const statuses = ["All", "Ready", "In Progress", "Blocked"];

  const filteredEngagements = useMemo(() => {
    return onboardingRows.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.workerId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === "All" || row.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus]);

  const blockedCount = onboardingRows.filter(r => r.status === 'Blocked').length;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Workers Lifecycle</h1>
            <p className="text-slate-500 font-medium">Monitoring requirement blocks & departmental bottlenecks.</p>
          </div>

          {/* Nova AI Command Bar */}
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all rounded-3xl" />
            <div className="relative flex items-center bg-white border border-cyan-100 rounded-2xl shadow-sm overflow-hidden p-1 focus-within:ring-2 focus-within:ring-cyan-400/30 transition-all">
              <div className="bg-slate-950 p-2 rounded-xl text-cyan-400 ml-1">
                <Sparkles size={18} />
              </div>
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Nova: 'Who is blocking John?'"
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold px-3 py-2 placeholder:text-slate-400"
              />
              <button className="pr-3 text-cyan-500 font-bold text-xs uppercase hover:text-cyan-700 transition-colors">
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* ANALYTICS & FILTERS */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center border-l-4 border-l-rose-500">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Gate Blockers</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <ShieldAlert size={24} className={blockedCount > 0 ? "text-rose-500" : "text-emerald-500"} />
              {blockedCount}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6 text-slate-900">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Engagement Status</label>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-400 outline-none transition-all"
                >
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex-1 min-w-[300px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Search Records</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={16} />
                <input
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  placeholder="Worker name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={() => {setSearchTerm(""); setSelectedStatus("All");}}
              className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-2"
            >
              <X size={14} /> Reset
            </button>
          </div>
        </div>

        {/* ENGAGEMENT TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Worker</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Block Readiness</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Departmental Gate</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Day 1 Target</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEngagements.map((row) => (
                  <tr
                    key={row.workerId}
                    className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                    onClick={() => setSelectedRecord(row)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-cyan-400 font-bold text-sm border border-slate-700 shadow-lg shadow-cyan-900/10">
                          {row.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight mb-0.5">{row.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight leading-none italic">{row.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                         <div className="w-12 h-12 relative flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-100" />
                              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * row.readiness) / 100} className={row.readiness === 100 ? "text-emerald-500" : "text-cyan-500"} />
                            </svg>
                            <span className="absolute text-[10px] font-black">{row.readiness}%</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-700 uppercase leading-none">Complete</span>
                            <span className="text-[9px] font-bold text-slate-400 italic">Requirements</span>
                         </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {row.status === 'Ready' ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit">
                          <CheckCircle2 size={12} /> Certified Ready
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                           <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white w-fit ${
                             row.status === 'Blocked' ? 'text-rose-700 border-rose-100' : 'text-amber-700 border-amber-100'
                           }`}>
                             <div className={`w-1.5 h-1.5 rounded-full ${row.status === 'Blocked' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                             Pending {row.pendingWith}
                           </div>
                           <div className="text-[10px] text-slate-400 font-bold px-1 truncate max-w-[180px]">
                              {row.currentBlockerTask}
                           </div>
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-800 tracking-tight">{row.startDate}</div>
                      <div className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter mt-1 italic">
                        {row.status === 'Blocked' ? 'Risks Delay' : 'On Track'}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <ChevronRight size={20} className="text-slate-300 group-hover:text-cyan-500 transition-colors inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PREVIEW DRAWER - REFACTORED FOR GOVERNANCE */}
      {selectedRecord && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40" onClick={() => setSelectedRecord(null)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out border-l border-slate-200 flex flex-col text-slate-900">
            <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-2xl bg-slate-950 flex items-center justify-center text-cyan-400 font-black text-2xl shadow-xl shadow-cyan-900/20 border border-slate-800">
                  {selectedRecord.name.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight leading-tight">{selectedRecord.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest">{selectedRecord.role}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedRecord.workerId}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 border border-transparent hover:border-slate-200">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* BLOCKER ALERT */}
              {selectedRecord.status !== "Ready" && (
                  <div className={`p-4 rounded-2xl flex gap-4 border-l-4 ${
                    selectedRecord.status === 'Blocked' ? 'bg-rose-50 border-rose-500' : 'bg-amber-50 border-amber-500'
                  }`}>
                    <ShieldAlert className={selectedRecord.status === 'Blocked' ? 'text-rose-600' : 'text-amber-600'} size={24} />
                    <div>
                        <p className={`text-sm font-black uppercase tracking-tight ${selectedRecord.status === 'Blocked' ? 'text-rose-900' : 'text-amber-900'}`}>
                          Halt: Pending {selectedRecord.pendingWith} Approval
                        </p>
                        <p className="text-xs font-medium text-slate-600 mt-1 italic">
                          "{selectedRecord.currentBlockerTask}" is currently preventing this worker from progressing to the next requirement block.
                        </p>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                    <Layers size={12}/> Readiness
                  </p>
                  <p className="text-4xl font-black text-cyan-600">{selectedRecord.readiness}<span className="text-lg text-slate-400">%</span></p>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full mt-3 overflow-hidden">
                     <div className="h-full bg-cyan-500" style={{width: `${selectedRecord.readiness}%`}} />
                  </div>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                    <Calendar size={12}/> Launch
                  </p>
                  <p className="text-2xl font-black text-slate-900">{selectedRecord.startDate}</p>
                  <p className="text-[10px] font-bold text-rose-500 uppercase mt-2 italic">In 4 Business Days</p>
                </div>
              </div>

              {/* AUTOMATED VERIFICATION LOG */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500"/> Governance Log
                </h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <Zap size={14} className="text-indigo-500"/>
                        <span className="text-sm font-bold text-slate-700 leading-none">Government ID Verification</span>
                      </div>
                      <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md uppercase">AI Verified</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 opacity-60">
                      <div className="flex items-center gap-3">
                        <Link2 size={14} className="text-blue-500"/>
                        <span className="text-sm font-bold text-slate-700 leading-none">Background Screening</span>
                      </div>
                      <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-md uppercase">Partner Integrated</span>
                    </div>
                </div>
              </section>

              {/* TEAM & ACCOUNTABILITY */}
              <section className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <User size={14} /> Stakeholders
                  </h3>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Hiring Manager</p>
                    <p className="text-sm font-black text-slate-900 leading-none">{selectedRecord.manager}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Supplier</p>
                    <p className="text-sm font-bold text-slate-700 leading-none">{selectedRecord.supplier}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <ShieldCheck size={14} /> Compliance
                  </h3>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cost Center</p>
                    <p className="text-sm font-black text-slate-900 leading-none">NA-ENG-2025</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Dept.</p>
                    <p className="text-sm font-bold text-slate-700 leading-none truncate">{selectedRecord.department}</p>
                  </div>
                </div>
              </section>

              <div className="pt-8">
                <button
                  onClick={() => router.push(`/workers/${selectedRecord.workerId}/engagements/onboarding/workspace`)}
                  className="w-full bg-slate-950 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-2xl shadow-cyan-900/20 active:scale-[0.98]"
                >
                    Review Onboarding Block <Zap size={18} className="fill-amber-400 text-amber-400 group-hover:rotate-12 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}