"use client";

import React, { useState, useMemo } from "react";
import { 
  Search, 
  DollarSign, 
  Clock, 
  X, 
  ChevronRight, 
  Sparkles,
  ChevronDown,
  Filter,
  Eye,
  ArrowRight,
  Gavel,
  Users,
  Calendar,
  AlertCircle,
  Trophy,
  FileText,
  User 
} from "lucide-react";

// --- Data ---
const rfxData = [
  { id: "RFX-2024-009", name: "Core Banking Platform Upgrade", category: "IT Services", owner: "Emily Carter", invited: 5, responses: 3, type: "RFP", value: 3500000, due: "Apr 22, 2024", stage: "In Review", competition: "Healthy", description: "Strategic sourcing for the Phase 2 core banking migration. Evaluating technical architecture and cloud-native capabilities." },
  { id: "RFX-2024-006", name: "Data Platform Managed Services", category: "Managed Services", owner: "Daniel Lee", invited: 4, responses: 1, type: "RFP", value: 6200000, due: "Apr 15, 2024", stage: "Response Open", competition: "Weak", description: "Seeking a 3-year managed services partner for enterprise data lake support and ETL optimization." },
  { id: "RFX-2024-002", name: "Cloud Security Assessment", category: "Advisory", owner: "Rachel Adams", invited: 3, responses: 3, type: "RFQ", value: 450000, due: "Mar 28, 2024", stage: "Awarded", competition: "Strong", description: "Quick-turn security audit for new multi-cloud landing zones." },
  { id: "RFX-2024-015", name: "Mobile App Redesign", category: "Digital", owner: "Sarah Jenkins", invited: 6, responses: 4, type: "RFP", value: 850000, due: "May 10, 2024", stage: "Draft", competition: "Healthy", description: "Creative RFP for the next-generation retail banking mobile application." },
];

export default function RFxPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiInput, setAiInput] = useState("");

  const stages = ["All", "Draft", "Response Open", "In Review", "Awarded"];

  // --- Logic: Filtering ---
  const filteredRFx = useMemo(() => {
    return rfxData.filter((rfx) => {
      const matchesSearch = 
        rfx.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfx.owner.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStage = selectedStage === "All" || rfx.stage === selectedStage;
      
      return matchesSearch && matchesStage;
    });
  }, [searchTerm, selectedStage]);

  const totalValue = filteredRFx.reduce((acc, curr) => acc + curr.value, 0);
  const totalResponses = filteredRFx.reduce((acc, curr) => acc + curr.responses, 0);

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">RFx</h1>
            <p className="text-slate-500 font-medium mt-1">Direct sourcing events and competitive bid management.</p>
          </div>

          {/* Nova AI Command Bar - Cyan / Dark Navy Theme */}
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all rounded-3xl" />
            <div className="relative flex items-center bg-white border border-cyan-100 rounded-2xl shadow-sm overflow-hidden p-1 focus-within:ring-2 focus-within:ring-cyan-400/30 transition-all">
              <div className="bg-slate-950 p-2 rounded-xl text-cyan-400 ml-1 shadow-lg shadow-cyan-900/10">
                <Sparkles size={18} />
              </div>
              <input 
                type="text" 
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Nova to analyze bid health..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold px-3 py-2 placeholder:text-slate-400"
              />
              <button className="pr-3 text-cyan-500 font-bold text-xs uppercase hover:text-cyan-700 transition-colors">
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* TOP SECTION: Bid Analytics + Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Pipeline Value</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <DollarSign size={24} className="text-emerald-500" />
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue)}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Current Stage</label>
              <div className="relative">
                <select 
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                >
                  {stages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex-1 min-w-[300px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Search RFx Events</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={16} />
                <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  placeholder="Engagement name, ID, or owner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pr-2">
                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{totalResponses}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Responses</p>
                </div>
            </div>
          </div>
        </div>

        {/* RFx TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Identification</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Competition Gauge</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Value & Timing</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Stage & Health</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRFx.map((rfx) => (
                  <tr 
                    key={rfx.id} 
                    className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                    onClick={() => setSelectedRecord(rfx)}
                  >
                    <td className="px-8 py-6">
                      <div className="text-[10px] font-black text-cyan-600 bg-cyan-50 w-fit px-2 py-0.5 rounded-md mb-1.5 uppercase tracking-tighter leading-none">{rfx.id} • {rfx.type}</div>
                      <div className="font-bold text-slate-900 leading-tight mb-1">{rfx.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                        <User size={12} /> {rfx.owner}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-sm font-black text-slate-900">{rfx.responses} / {rfx.invited}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">Bids</span>
                      </div>
                      <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className={`h-full rounded-full transition-all duration-700 ${
                            rfx.responses / rfx.invited > 0.5 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} style={{ width: `${(rfx.responses / rfx.invited) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-900 leading-none">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(rfx.value)}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 block italic">
                        <Calendar size={10} /> Due: {rfx.due}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2">
                        <div className={`w-fit inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white ${
                          rfx.competition === 'Strong' ? 'text-emerald-700 border-emerald-100' :
                          rfx.competition === 'Healthy' ? 'text-cyan-700 border-cyan-100' : 'text-rose-700 border-rose-100'
                        }`}>
                          {rfx.competition} Market
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-tighter ${rfx.stage === 'Awarded' ? 'text-emerald-500' : 'text-cyan-600'}`}>
                          • {rfx.stage}
                        </span>
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
              <div>
                <span className="text-xs font-black text-cyan-600 bg-cyan-50 px-2 py-1 rounded-md uppercase tracking-tighter leading-none">{selectedRecord.id}</span>
                <h2 className="text-2xl font-black text-slate-900 mt-3 tracking-tight leading-tight">{selectedRecord.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-slate-400 font-bold text-xs uppercase tracking-widest">
                  {selectedRecord.type} • {selectedRecord.category}
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedRecord.competition === "Weak" && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="text-rose-600 shrink-0" size={20} />
                    <div>
                        <p className="text-sm font-bold text-rose-900">Low Competition Risk</p>
                        <p className="text-xs text-rose-700 font-medium">Only 1 response received from 4 invited suppliers. Market tension is insufficient for optimal pricing.</p>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><DollarSign size={10}/> Estimated Value</p>
                  <p className="text-lg font-black text-slate-900">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(selectedRecord.value)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Users size={10}/> Participation</p>
                  <p className="text-lg font-black text-cyan-600 uppercase">{selectedRecord.responses} / {selectedRecord.invited} Bid(s)</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Bid Narrative</h3>
                <p className="text-slate-600 leading-relaxed font-medium">{selectedRecord.description}</p>
              </section>

              <section className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Gavel size={14} /> Sourcing</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Category Owner</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.owner}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Event Type</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.type}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Clock size={14} /> Critical Dates</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Response Due</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.due}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Market Health</p>
                    <p className="text-sm font-bold text-cyan-600">{selectedRecord.competition}</p>
                  </div>
                </div>
              </section>

              <div className="pt-6 border-t border-slate-100">
                <button className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-cyan-900/10">
                   View Bid Comparison Matrix <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <FileText size={14} /> RFx Documents
                  </button>
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <Trophy size={14} /> Decision Log
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