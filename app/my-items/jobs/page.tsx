"use client";

import React, { useState, useMemo } from "react";
import { 
  Search, 
  Users, 
  MapPin, 
  Briefcase, 
  Clock, 
  X, 
  ChevronRight, 
  FileText, 
  Calendar, 
  User, 
  Sparkles,
  ChevronDown,
  Filter,
  ArrowRight,
  Eye,
  BarChart3,
  AlertCircle,
  Flag
} from "lucide-react";

// --- Data ---
const jobPostings = [
  { id: "JP-2024-041", role: "Senior Backend Engineer", manager: "Alex Morgan", workerType: "Contingent", location: "Remote – US", supplier: "TEKsystems", rate: "$105/hr", openings: 2, candidates: 3, aging: 18, status: "Open", priority: "High", description: "Critical backfill for the Core API squad. Requires heavy Golang and Kubernetes experience." },
  { id: "JP-2024-036", role: "Business Analyst", manager: "Rachel Adams", workerType: "Contract", location: "Chicago, IL", supplier: "Randstad", rate: "$85/hr", openings: 1, candidates: 6, aging: 9, status: "Open", priority: "Normal", description: "Supporting the Q3 Digital Transformation roadmap for retail banking." },
  { id: "JP-2024-028", role: "QA Automation Engineer", manager: "Daniel Lee", workerType: "Temp", location: "New York, NY", supplier: "Insight Global", rate: "$78/hr", openings: 1, candidates: 11, aging: 27, status: "Escalated", priority: "High", description: "Automation lead for the mobile banking application. Search has stalled; supplier performance review pending." },
  { id: "JP-2024-052", role: "DevOps Architect", manager: "Sarah Chen", workerType: "Contingent", location: "Remote", supplier: "Acorena", rate: "$140/hr", openings: 1, candidates: 2, aging: 4, status: "Open", priority: "High", description: "Designing the multi-cloud disaster recovery strategy." },
  { id: "JP-2024-015", role: "Project Manager", manager: "James Wilson", workerType: "Contract", location: "Toronto, ON", supplier: "Collabera", rate: "$90/hr", openings: 1, candidates: 15, aging: 42, status: "Escalated", priority: "Normal", description: "Long-standing vacancy for the Infrastructure upgrade project. Requires PMP." },
];

export default function ContingentJobPostingsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedSupplier, setSelectedSupplier] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiInput, setAiInput] = useState("");

  const suppliers = useMemo(() => ["All", ...new Set(jobPostings.map(j => j.supplier))], []);

  const filteredJobs = useMemo(() => {
    return jobPostings.filter((job) => {
      const matchesSearch = 
        job.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.manager.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = selectedStatus === "All" || job.status === selectedStatus;
      const matchesSupplier = selectedSupplier === "All" || job.supplier === selectedSupplier;
      
      return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [searchTerm, selectedStatus, selectedSupplier]);

  const totalOpenings = filteredJobs.reduce((acc, curr) => acc + curr.openings, 0);
  const escalatedCount = filteredJobs.filter(j => j.status === "Escalated").length;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Contingent Job Postings</h1>
            <p className="text-slate-500 font-medium mt-1">Cross-organizational requisition tracking and bottleneck analysis.</p>
          </div>

          {/* Nova AI Command Bar - Custom Teal (Cyan) / Dark Navy Blue Theme */}
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all rounded-3xl" />
            <div className="relative flex items-center bg-white border border-cyan-100 rounded-2xl shadow-sm overflow-hidden p-1 focus-within:ring-2 focus-within:ring-cyan-400/30 transition-all">
              {/* Dark Navy Background with Teal Icon */}
              <div className="bg-slate-950 p-2.5 rounded-xl text-cyan-400 ml-1 shadow-lg shadow-cyan-900/10">
                <Sparkles size={18} />
              </div>
              <input 
                type="text" 
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Nova to analyze aging or suppliers..."
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Vacancies</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <BarChart3 size={24} className="text-cyan-500" />
              {totalOpenings}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Supplier Performance</label>
              <div className="relative">
                <select 
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-400 outline-none transition-all"
                >
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Requisition Status</label>
              <div className="relative">
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-400 outline-none transition-all"
                >
                  <option value="All">All Postings</option>
                  <option value="Open">Open</option>
                  <option value="Escalated">Escalated</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">High Risk</p>
                <div className={`px-4 py-1.5 rounded-xl font-black text-sm border shadow-sm ${escalatedCount > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    {escalatedCount} Escalated
                </div>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="mb-6 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={18} />
          <input 
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-400/10 focus:border-cyan-500 shadow-sm transition-all font-medium"
            placeholder="Search by Role, ID, or Hiring Manager..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ORG JOB TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Identification</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Hiring Manager</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Aging & Pipeline</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Priority & Status</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => (
                  <tr 
                    key={job.id} 
                    className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                    onClick={() => setSelectedRecord(job)}
                  >
                    <td className="px-8 py-6">
                      <div className="text-[10px] font-black text-cyan-600 bg-cyan-50 w-fit px-2 py-0.5 rounded-md mb-1.5 uppercase leading-none">{job.id}</div>
                      <div className="font-bold text-slate-900 leading-tight mb-1">{job.role}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                        <MapPin size={12} /> {job.location}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-slate-800">{job.manager}</div>
                      <div className="text-xs text-slate-500 font-medium">{job.supplier}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className={`text-sm font-black leading-none ${job.aging > 25 ? 'text-rose-600' : 'text-slate-900'}`}>{job.aging}d</div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">Aging</span>
                        </div>
                        <div className="h-8 w-[1px] bg-slate-100" />
                        <div>
                          <div className="text-sm font-black text-slate-900 leading-none">{job.candidates}</div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">Candidates</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2">
                        <div className={`w-fit inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white ${
                          job.priority === 'High' ? 'text-rose-700 border-rose-100' : 'text-slate-600 border-slate-100'
                        }`}>
                          {job.priority === 'High' && <Flag size={12} className="text-rose-500 fill-rose-500" />}
                          {job.priority}
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-tighter ${job.status === 'Open' ? 'text-emerald-500' : 'text-rose-500 animate-pulse'}`}>
                          • {job.status}
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
                <span className="text-xs font-black text-cyan-600 bg-cyan-50 px-2 py-1 rounded-md uppercase">{selectedRecord.id}</span>
                <h2 className="text-2xl font-black text-slate-900 mt-3 tracking-tight leading-tight">{selectedRecord.role}</h2>
                <div className="flex items-center gap-2 mt-1 text-slate-400 font-bold text-xs">
                  <MapPin size={14} /> {selectedRecord.location}
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedRecord.status === "Escalated" && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="text-rose-600 shrink-0" size={20} />
                    <div>
                        <p className="text-sm font-bold text-rose-900">Requisition Escalated</p>
                        <p className="text-xs text-rose-700 font-medium">This role has exceeded the 25-day fulfillment SLA. Action required.</p>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bill Rate</p>
                  <p className="text-lg font-black text-slate-900 flex items-center gap-1">
                    {selectedRecord.rate} <span className="text-[10px] text-slate-400">/hr</span>
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Time in Status</p>
                  <p className="text-lg font-black text-slate-900">{selectedRecord.aging} Days</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Organization Brief</h3>
                <p className="text-slate-600 leading-relaxed font-medium">{selectedRecord.description}</p>
              </section>

              <div className="pt-6 border-t border-slate-100">
                <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-slate-200">
                    View Full Organizational Record <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-rose-600">
                    <Flag size={14} /> Mark for Review
                  </button>
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <Users size={14} /> Supplier Stats
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