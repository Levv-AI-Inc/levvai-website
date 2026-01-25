"use client";

import React, { useState, useMemo } from "react";
import { 
  Search, 
  User, 
  MapPin, 
  Clock, 
  X, 
  ChevronRight, 
  FileText, 
  Calendar, 
  Sparkles,
  ChevronDown,
  Filter,
  ArrowRight,
  Eye,
  ShieldCheck,
  Briefcase,
  AlertCircle,
  Users,
  Fingerprint
} from "lucide-react";

// --- Data ---
const workers = [
  {
    cwsId: "CWS-000231",
    hrSystemId: "WD-784512",
    name: "James Carter",
    workerType: "Contingent",
    supplier: "TEKsystems",
    role: "Senior Backend Engineer",
    owner: "Alex Morgan",
    status: "Active",
    start: "Jan 15, 2024",
    end: "Dec 31, 2024",
    location: "Remote – US",
    compliance: "Compliant",
    email: "j.carter@contractor.com",
    department: "Engineering - Fintech"
  },
  {
    cwsId: "CWS-000198",
    hrSystemId: "WD-772903",
    name: "Priya Shah",
    workerType: "Contingent",
    supplier: "Randstad",
    role: "Business Analyst",
    owner: "Rachel Adams",
    status: "Onboarding",
    start: "Apr 22, 2024",
    end: "Oct 31, 2024",
    location: "Toronto, ON",
    compliance: "Review Required",
    email: "p.shah@contractor.com",
    department: "Transformation Office"
  },
  {
    cwsId: "CWS-000164",
    hrSystemId: "WD-761442",
    name: "Daniel Wong",
    workerType: "SOW",
    supplier: "Insight Global",
    role: "QA Automation Engineer",
    owner: "Daniel Lee",
    status: "Offboarded",
    start: "Jul 01, 2023",
    end: "Mar 31, 2024",
    location: "New York, NY",
    compliance: "Compliant",
    email: "d.wong@consultant.com",
    department: "Quality Assurance"
  },
  {
    cwsId: "CWS-000245",
    hrSystemId: "WD-791002",
    name: "Elena Rossi",
    workerType: "Contingent",
    supplier: "TEKsystems",
    role: "UX Researcher",
    owner: "Alex Morgan",
    status: "Active",
    start: "Feb 01, 2024",
    end: "Jan 31, 2025",
    location: "Remote – US",
    compliance: "Non-Compliant",
    email: "e.rossi@contractor.com",
    department: "Product Design"
  }
];

export default function WorkersIndexPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiInput, setAiInput] = useState("");

  const statuses = ["All", "Active", "Onboarding", "Offboarded"];

  // --- Logic: Filtering ---
  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchesSearch = 
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.cwsId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.role.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = selectedStatus === "All" || w.status === selectedStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus]);

  const nonCompliantCount = workers.filter(w => w.compliance !== "Compliant" && w.status !== "Offboarded").length;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Workers</h1>
            <p className="text-slate-500 font-medium mt-1">Master directory of contingent and SOW workforce records.</p>
          </div>

          {/* Nova AI Command Bar - Cyan / Dark Navy Theme */}
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-0 bg-cyan-500/5 blur-xl group-hover:bg-cyan-500/10 transition-all rounded-3xl" />
            <div className="relative flex items-center bg-white border border-cyan-100 rounded-2xl shadow-sm overflow-hidden p-1 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
              <div className="bg-slate-950 p-2 rounded-xl text-cyan-400 ml-1 shadow-lg shadow-cyan-900/10">
                <Sparkles size={18} />
              </div>
              <input 
                type="text" 
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Nova to audit compliance..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold px-3 py-2 placeholder:text-slate-400"
              />
              <button className="pr-3 text-cyan-600 font-bold text-xs uppercase hover:text-cyan-800 transition-colors">
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* METRICS & FILTERS */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Compliance Alerts</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck size={24} className={nonCompliantCount > 0 ? "text-rose-500" : "text-emerald-500"} />
              {nonCompliantCount}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Worker Status</label>
              <div className="relative">
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                >
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex-1 min-w-[300px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Quick Search</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={16} />
                <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  placeholder="Worker Name, CWS ID, or Role..."
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

        {/* WORKER TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Worker Information</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">IDs & Type</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Lifecycle</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Compliance Status</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkers.map((w) => (
                  <tr 
                    key={w.cwsId} 
                    className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                    onClick={() => setSelectedRecord(w)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200">
                          {w.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight mb-0.5">{w.name}</div>
                          <div className="text-[10px] font-bold text-cyan-600 uppercase tracking-tight">
                            {w.role}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-1">{w.cwsId}</div>
                      <div className="text-xs font-bold text-slate-800">{w.workerType}</div>
                      <div className="text-[10px] text-slate-400 font-medium">via {w.supplier}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          w.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          w.status === 'Onboarding' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                          {w.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        Ends: {w.end}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white ${
                        w.compliance === 'Compliant' ? 'text-emerald-700 border-emerald-100' : 
                        w.compliance === 'Review Required' ? 'text-amber-700 border-amber-100' : 'text-rose-700 border-rose-100'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          w.compliance === 'Compliant' ? 'bg-emerald-500' : 
                          w.compliance === 'Review Required' ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        {w.compliance}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest bg-cyan-100/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                          <Eye size={12} /> View Preview
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PREVIEW DRAWER */}
      {selectedRecord && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" onClick={() => setSelectedRecord(null)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out border-l border-slate-200 flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-950 flex items-center justify-center text-cyan-400 font-black text-2xl shadow-lg shadow-cyan-900/10">
                  {selectedRecord.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{selectedRecord.name}</h2>
                  <p className="text-sm font-bold text-cyan-600 uppercase tracking-widest leading-none mt-1">{selectedRecord.role}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedRecord.compliance !== "Compliant" && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="text-rose-600 shrink-0" size={20} />
                    <div>
                        <p className="text-sm font-bold text-rose-900">Compliance Action Required</p>
                        <p className="text-xs text-rose-700 font-medium">Worker documentation is out of sync with current policy. Access may be restricted if not resolved.</p>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Fingerprint size={10}/> CWS ID</p>
                  <p className="text-lg font-black text-slate-900">{selectedRecord.cwsId}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Users size={10}/> HR ID</p>
                  <p className="text-lg font-black text-slate-900">{selectedRecord.hrSystemId}</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Briefcase size={14}/> Assignment Brief</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Department</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.department}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                    <p className="text-sm font-bold text-cyan-600">{selectedRecord.email}</p>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><User size={14} /> Management</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Supplier</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.supplier}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Owner</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.owner}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Calendar size={14} /> Contract Dates</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Start Date</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.start}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">End Date</p>
                    <p className="text-sm font-bold text-rose-600">{selectedRecord.end}</p>
                  </div>
                </div>
              </section>

              <div className="pt-6 border-t border-slate-100">
                <button className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-cyan-900/10">
                    View Full Worker Profile <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <Calendar size={14} /> Extend Contract
                  </button>
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-rose-600">
                    <AlertCircle size={14} /> Offboard Worker
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}