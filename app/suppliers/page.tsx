"use client";

import React, { useState, useMemo } from "react";
import { 
  Search, 
  User, 
  Clock, 
  X, 
  ChevronRight, 
  Sparkles,
  ChevronDown,
  Filter,
  ArrowRight,
  Eye,
  ShieldCheck,
  Briefcase,
  AlertCircle,
  Users,
  Building2,
  Globe,
  Activity,
  ShieldAlert,
  FileText
} from "lucide-react";

// --- Data ---
const suppliers = [
  {
    id: "SUP-00124",
    name: "Acme Consulting",
    type: "Staffing",
    category: "IT Staffing",
    workers: 18,
    sows: 0,
    owner: "Emily Carter",
    status: "Active",
    risk: "Low",
    compliance: "Compliant",
    description: "Primary provider for high-volume Java and DevOps engineering talent.",
    location: "Global",
    since: "2019"
  },
  {
    id: "SUP-00107",
    name: "BluePeak Solutions",
    type: "Services",
    category: "IT Consulting",
    workers: 0,
    sows: 6,
    owner: "Michael Roberts",
    status: "Active",
    risk: "Medium",
    compliance: "Compliant",
    description: "Specialized advisory for cloud native infrastructure and platform engineering.",
    location: "North America",
    since: "2021"
  },
  {
    id: "SUP-00089",
    name: "NorthStar Advisory",
    type: "Both",
    category: "IT Staffing",
    workers: 12,
    sows: 2,
    owner: "Rachel Adams",
    status: "Active",
    risk: "High",
    compliance: "Review Required",
    description: "Provides both niche security staffing and managed cybersecurity assessments.",
    location: "EMEA / US",
    since: "2018"
  },
  {
    id: "SUP-00095",
    name: "Quantum Services",
    type: "Both",
    category: "Consulting",
    workers: 8,
    sows: 2,
    owner: "Jason Mclaw",
    status: "Active",
    risk: "Medium",
    compliance: "Review Required",
    description: "Technical implementation partner for data platform migrations.",
    location: "Remote / US",
    since: "2022"
  },
];

export default function SuppliersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiInput, setAiInput] = useState("");

  const types = ["All", "Staffing", "Services", "Both"];

  // --- Logic: Filtering ---
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchesSearch = 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = selectedType === "All" || s.type === selectedType;
      
      return matchesSearch && matchesType;
    });
  }, [searchTerm, selectedType]);

  const highRiskCount = suppliers.filter(s => s.risk === 'High' || s.compliance !== 'Compliant').length;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Suppliers</h1>
            <p className="text-slate-500 font-medium mt-1">Manage vendor relationships, compliance health, and performance.</p>
          </div>

          {/* Nova AI Command Bar - Cyan / Dark Navy Theme */}
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
                placeholder="Ask Nova to audit vendor risk..."
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Risk Flags</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <ShieldAlert size={24} className={highRiskCount > 0 ? "text-rose-500" : "text-emerald-500"} />
              {highRiskCount}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Engagement Type</label>
              <div className="relative">
                <select 
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                >
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex-1 min-w-[300px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Search Directory</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={16} />
                <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  placeholder="Supplier Name, ID, or Category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <button 
              onClick={() => {setSearchTerm(""); setSelectedType("All");}}
              className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-2"
            >
              <X size={14} /> Reset
            </button>
          </div>
        </div>

        {/* SUPPLIER TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Supplier Information</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Relationship Footprint</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ownership</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Risk & Compliance</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((s) => (
                  <tr 
                    key={s.id} 
                    className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                    onClick={() => setSelectedRecord(s)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-cyan-600 font-bold text-sm border border-slate-200 shadow-sm leading-none">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight mb-0.5">{s.name}</div>
                          <div className="text-[10px] font-black text-cyan-600 uppercase tracking-tight">ID: {s.id} • {s.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-6">
                        <div>
                          <div className="text-sm font-black text-slate-900 leading-none">{s.workers}</div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">Workers</span>
                        </div>
                        <div className="h-8 w-[1px] bg-slate-100" />
                        <div>
                          <div className="text-sm font-black text-slate-900 leading-none">{s.sows}</div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">SOWs</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-xs font-bold text-slate-800 leading-none mb-1">{s.owner}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Primary Manager</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2">
                        <div className={`w-fit inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white ${
                          s.compliance === 'Compliant' ? 'text-emerald-700 border-emerald-100' : 'text-amber-700 border-amber-100'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${s.compliance === 'Compliant' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {s.compliance}
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-tighter flex items-center gap-1 ${
                          s.risk === 'Low' ? 'text-emerald-500' : s.risk === 'Medium' ? 'text-amber-500' : 'text-rose-500'
                        }`}>
                          • {s.risk} Risk
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest bg-cyan-100/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                          <Eye size={12} /> Preview
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
                <div className="h-16 w-16 rounded-2xl bg-slate-950 flex items-center justify-center text-cyan-400 shadow-lg">
                  <Building2 size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{selectedRecord.name}</h2>
                  <p className="text-sm font-bold text-cyan-600 uppercase tracking-widest">{selectedRecord.category}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedRecord.risk === "High" && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="text-rose-600 shrink-0" size={20} />
                    <div>
                        <p className="text-sm font-bold text-rose-900">High Risk Profile</p>
                        <p className="text-xs text-rose-700 font-medium leading-relaxed">This supplier has been flagged due to recent compliance document expiry and insurance review requirement.</p>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Portfolio Footprint</p>
                  <p className="text-3xl font-black text-cyan-600">{selectedRecord.workers + selectedRecord.sows}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total Engagements</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Partner Since</p>
                  <p className="text-3xl font-black text-slate-900">{selectedRecord.since}</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><FileText size={14}/> Supplier Profile</h3>
                <p className="text-slate-600 leading-relaxed font-medium">
                  {selectedRecord.description}
                </p>
              </section>

              <section className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Activity size={14} /> Logistics</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Operating Region</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
                    <Globe size={14} className="text-slate-400"/> {selectedRecord.location}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Service Type</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.type}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><User size={14} /> Management</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Relationship Owner</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.owner}</p>
                </div>
              </section>

              <div className="pt-6 border-t border-slate-100">
                <button className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-cyan-900/10">
                    View Full Supplier Record <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <Briefcase size={14} /> All SOWs
                  </button>
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <Users size={14} /> All Workers
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