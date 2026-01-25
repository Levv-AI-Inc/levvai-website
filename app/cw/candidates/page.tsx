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
  DollarSign,
  UserCheck,
  Briefcase,
  AlertCircle,
  Timer
} from "lucide-react";

// --- Data ---
const candidates = [
  {
    name: "James Carter",
    role: "Senior Backend Engineer",
    jobId: "JP-2024-041",
    supplier: "TEKsystems",
    location: "Remote – US",
    rate: "$108/hr",
    availability: "2 weeks",
    stage: "Interview",
    daysInStage: 6,
    manager: "Alex Morgan",
    status: "Active",
    email: "j.carter@example.com",
    skills: ["Golang", "Kubernetes", "AWS"],
    description: "James has 10+ years of experience in distributed systems. Strong performance in technical screen."
  },
  {
    name: "Priya Shah",
    role: "Business Analyst",
    jobId: "JP-2024-036",
    supplier: "Randstad",
    location: "Chicago, IL",
    rate: "$88/hr",
    availability: "Immediate",
    stage: "Submitted",
    daysInStage: 3,
    manager: "Rachel Adams",
    status: "Active",
    email: "p.shah@example.com",
    skills: ["SQL", "Agile", "Tableau"],
    description: "Strong background in retail banking transformation. Previous experience with Randstad was highly rated."
  },
  {
    name: "Daniel Wong",
    role: "QA Automation Engineer",
    jobId: "JP-2024-028",
    supplier: "Insight Global",
    location: "New York, NY",
    rate: "$80/hr",
    availability: "1 week",
    stage: "Offer",
    daysInStage: 4,
    manager: "Daniel Lee",
    status: "Pending Decision",
    email: "d.wong@example.com",
    skills: ["Selenium", "Python", "Jenkins"],
    description: "Top-tier candidate. Successfully completed all interview rounds. Offer pending internal sign-off."
  },
  {
    name: "Elena Rossi",
    role: "UX Designer",
    jobId: "JP-2024-012",
    supplier: "Aquent",
    location: "Remote",
    rate: "$95/hr",
    availability: "Immediate",
    stage: "Interview",
    daysInStage: 9,
    manager: "Sarah Jenkins",
    status: "Active",
    email: "e.rossi@example.com",
    skills: ["Figma", "User Research", "Prototyping"],
    description: "Stalled in interview stage due to manager travel. High risk of drop-off."
  }
];

export default function CandidatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiInput, setAiInput] = useState("");

  const stages = ["All", "Submitted", "Interview", "Offer", "Hired"];

  // --- Logic: Filtering ---
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.jobId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStage = selectedStage === "All" || c.stage === selectedStage;
      
      return matchesSearch && matchesStage;
    });
  }, [searchTerm, selectedStage]);

  const stalledCandidates = candidates.filter(c => c.daysInStage > 7).length;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Candidates</h1>
            <p className="text-slate-500 font-medium mt-1">Track candidate progression and pipeline velocity.</p>
          </div>

          {/* Nova AI Command Bar - Custom Cyan/Teal & Dark Navy Theme */}
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all rounded-3xl" />
            <div className="relative flex items-center bg-white border border-cyan-100 rounded-2xl shadow-sm overflow-hidden p-1 focus-within:ring-2 focus-within:ring-cyan-400/30 transition-all">
              <div className="bg-slate-950 p-2.5 rounded-xl text-cyan-400 ml-1 shadow-lg shadow-cyan-900/10">
                <Sparkles size={18} />
              </div>
              <input 
                type="text" 
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Nova about stalled candidates..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold px-3 py-2 placeholder:text-slate-400"
              />
              <button className="pr-3 text-cyan-500 font-bold text-xs uppercase hover:text-cyan-600 transition-colors">
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* METRICS & FILTERS */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stalled {'>'} 7 Days</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <Timer size={24} className={stalledCandidates > 0 ? "text-rose-500" : "text-emerald-500"} />
              {stalledCandidates}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Pipeline Stage</label>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Search Candidates</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={16} />
                <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  placeholder="Name, role, or Job ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <button 
              onClick={() => {setSearchTerm(""); setSelectedStage("All");}}
              className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-2"
            >
              <X size={14} /> Reset
            </button>
          </div>
        </div>

        {/* CANDIDATE TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Candidate Info</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Rate & Availability</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Pipeline Progress</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Manager / Status</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCandidates.map((c) => (
                  <tr 
                    key={`${c.name}-${c.jobId}`} 
                    className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                    onClick={() => setSelectedRecord(c)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-sm">
                          {c.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight mb-1">{c.name}</div>
                          <div className="text-[10px] font-black text-cyan-600 uppercase tracking-tighter">
                            {c.role} • {c.jobId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-900 leading-none">{c.rate}</div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 block italic">
                        Start: {c.availability}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          c.stage === 'Interview' ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                          c.stage === 'Offer' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                          {c.stage}
                        </span>
                        <span className={`text-[10px] font-bold ${c.daysInStage > 7 ? 'text-rose-500' : 'text-slate-400'}`}>
                          ({c.daysInStage} days)
                        </span>
                      </div>
                      <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          c.stage === 'Submitted' ? 'w-1/4 bg-slate-400' :
                          c.stage === 'Interview' ? 'w-2/4 bg-cyan-400' :
                          c.stage === 'Offer' ? 'w-3/4 bg-cyan-600' : 'w-full bg-emerald-500'
                        }`} />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-xs font-bold text-slate-800">{c.manager}</div>
                      <div className={`text-[10px] font-black uppercase mt-1 ${c.status === 'Active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        • {c.status}
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
                  <p className="text-sm font-bold text-cyan-600">{selectedRecord.role}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedRecord.daysInStage > 7 && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="text-rose-600 shrink-0" size={20} />
                    <div>
                        <p className="text-sm font-bold text-rose-900">Pipeline Alert</p>
                        <p className="text-xs text-rose-700 font-medium">Candidate has been in {selectedRecord.stage} for {selectedRecord.daysInStage} days. High risk of candidate withdrawal.</p>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><DollarSign size={10}/> Proposed Rate</p>
                  <p className="text-lg font-black text-slate-900">{selectedRecord.rate}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock size={10}/> Current Stage</p>
                  <p className="text-lg font-black text-cyan-600 uppercase">{selectedRecord.stage}</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Core Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedRecord.skills.map(skill => (
                    <span key={skill} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:border-cyan-300 transition-colors">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Submission Notes</h3>
                <p className="text-slate-600 leading-relaxed font-medium italic">"{selectedRecord.description}"</p>
              </section>

              <section className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Briefcase size={14} /> Requisition</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Supplier</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.supplier}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Hiring Manager</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.manager}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><User size={14} /> Details</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Location</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.location}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Availability</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.availability}</p>
                  </div>
                </div>
              </section>

              <div className="pt-6 border-t border-slate-100">
                <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-slate-200">
                    View Full Candidate Profile <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 hover:border-cyan-200 transition-all flex items-center justify-center gap-2">
                    <Calendar size={14} /> Schedule Interview
                  </button>
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 hover:border-cyan-200 transition-all flex items-center justify-center gap-2">
                    <UserCheck size={14} /> Initiate Offer
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