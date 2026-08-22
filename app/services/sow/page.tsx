"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { 
  Search, 
  DollarSign, 
  Clock, 
  X, 
  ChevronRight, 
  Sparkles,
  ChevronDown,
  Eye,
  User,
  FileText,
  ArrowRight,
  Calendar,
  ExternalLink
} from "lucide-react";

// --- Data ---
const sowData = [
  { id: "SOW-2024-001", title: "Application Modernization Program", supplier: "Accenture", type: "Fixed Fee", value: 1250000, start: "Jan 15, 2024", end: "Dec 31, 2024", status: "Active", health: "Perfect", updated: "2 days ago", description: "Phase 2 of core banking migration to cloud-native microservices.", manager: "Sarah Jenkins" },
  { id: "SOW-2024-002", title: "Cloud Migration Advisory", supplier: "Deloitte", type: "T&M", value: 480000, start: "Mar 01, 2024", end: "Sep 30, 2024", status: "Active", health: "Attention", updated: "5 days ago", description: "Strategic consulting for multi-cloud governance.", manager: "Michael Chen" },
  { id: "SOW-2023-118", title: "Data Platform Support", supplier: "Infosys", type: "Managed Services", value: 2100000, start: "Jul 01, 2023", end: "Jun 30, 2024", status: "Expiring", health: "At Risk", updated: "1 week ago", description: "Ongoing 24/7 L2/L3 support for enterprise data warehouse.", manager: "Amanda Ross" },
  { id: "SOW-2024-045", title: "Cybersecurity Audit Q3", supplier: "KPMG", type: "Fixed Fee", value: 250000, start: "Aug 01, 2024", end: "Oct 31, 2024", status: "Active", health: "Perfect", updated: "3 hours ago", description: "Annual compliance and penetration testing audit.", manager: "David Volek" },
  { id: "SOW-2024-012", title: "AI/ML Model Training", supplier: "NVIDIA", type: "T&M", value: 890000, start: "Feb 10, 2024", end: "Nov 30, 2024", status: "Active", health: "Perfect", updated: "1 day ago", description: "Deep learning model optimization for customer churn prediction.", manager: "Elena Rodriguez" },
  { id: "SOW-2023-090", title: "Legacy System Decommission", supplier: "IBM", type: "Fixed Fee", value: 1100000, start: "Oct 15, 2023", end: "May 15, 2024", status: "Expiring", health: "Attention", updated: "4 days ago", description: "Final phase of sun-setting the mainframe environment.", manager: "Robert Smith" },
];

export default function MySOWsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedSupplier, setSelectedSupplier] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiInput, setAiInput] = useState("");

  const suppliers = useMemo(() => ["All", ...new Set(sowData.map(s => s.supplier))], []);

  const filteredSOWs = useMemo(() => {
    return sowData.filter((sow) => {
      const matchesSearch = 
        sow.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sow.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === "All" || sow.status === selectedStatus;
      const matchesSupplier = selectedSupplier === "All" || sow.supplier === selectedSupplier;
      return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [searchTerm, selectedStatus, selectedSupplier]);

  const totalValue = filteredSOWs.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Statement of Works</h1>
            <p className="text-slate-500 font-medium mt-1">Manage your active Statements of Work and engagement performance.</p>
          </div>

          {/* Nova AI Interactive Search Box - Cyan / Dark Navy Theme */}
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all rounded-3xl" />
            <div className="relative flex items-center bg-white border border-cyan-100 rounded-2xl shadow-sm overflow-hidden p-1 focus-within:ring-2 focus-within:ring-cyan-400/30 transition-all">
              {/* Dark Navy Background with Cyan Icon */}
              <div className="bg-slate-950 p-2 rounded-xl text-cyan-400 ml-1">
                <Sparkles size={18} />
              </div>
              <input 
                type="text" 
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Nova to analyze your engagements..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold px-3 py-2 placeholder:text-slate-400"
              />
              <button className="pr-3 text-cyan-500 font-bold text-xs uppercase hover:text-cyan-700 transition-colors">
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* Top Section Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">My Filtered Value</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <DollarSign size={24} className="text-emerald-500" />
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(totalValue)}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Supplier</label>
              <div className="relative">
                <select 
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                >
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Status</label>
              <div className="relative">
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Expiring">Expiring</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <button 
              onClick={() => {setSearchTerm(""); setSelectedStatus("All"); setSelectedSupplier("All")}}
              className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-2"
            >
              <X size={14} /> Reset Filters
            </button>
          </div>
        </div>

        {/* Quick Search */}
        <div className="mb-6 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={18} />
          <input 
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-400/10 focus:border-cyan-500 shadow-sm transition-all font-medium"
            placeholder="Quick search my records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Identification</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Supplier & Type</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Financials</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Health</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSOWs.length > 0 ? (
                  filteredSOWs.map((sow) => (
                    <tr 
                      key={sow.id} 
                      className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                      onClick={() => router.push(`/services/sow/${sow.id}`)}
                    >
                      <td className="px-8 py-6">
                        <div className="text-[10px] font-black text-cyan-600 bg-cyan-50 w-fit px-2 py-0.5 rounded-md mb-1.5 uppercase tracking-tighter leading-none">{sow.id}</div>
                        <div className="font-bold text-slate-900 leading-tight group-hover:text-cyan-700 transition-colors">{sow.title}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-800">{sow.supplier}</div>
                        <div className="text-xs text-slate-500 font-medium">{sow.type}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-slate-900 leading-none">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(sow.value)}
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 block italic">Value</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white ${
                          sow.health === 'Perfect' ? 'text-emerald-700 border-emerald-100' : 
                          sow.health === 'Attention' ? 'text-amber-700 border-amber-100' : 'text-rose-700 border-rose-100'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            sow.health === 'Perfect' ? 'bg-emerald-500' : 
                            sow.health === 'Attention' ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          {sow.health}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                          <span 
                            onClick={(e) => { e.stopPropagation(); setSelectedRecord(sow); }}
                            className="text-[10px] font-black text-cyan-600 uppercase tracking-widest bg-cyan-100/50 px-3 py-1.5 rounded-lg flex items-center gap-2"
                          >
                            <Eye size={12} /> View Preview
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-8 py-24 text-center text-slate-400">No records found.</td>
                  </tr>
                )}
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
                <h2 className="text-2xl font-black text-slate-900 mt-3 tracking-tight leading-tight">{selectedRecord.title}</h2>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Contract Value</p>
                  <p className="text-lg font-black text-slate-900">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedRecord.value)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status</p>
                  <p className="text-sm font-bold text-slate-900 uppercase mt-1">{selectedRecord.status}</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><FileText size={14}/> Engagement Brief</h3>
                <p className="text-slate-600 leading-relaxed font-medium">{selectedRecord.description}</p>
              </section>

              <section className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><User size={14} /> Stakeholders</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Supplier</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.supplier}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Lead</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.manager}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Calendar size={14} /> Period</h3>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.start}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">— TO —</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.end}</p>
                </div>
              </section>

              {/* Bottom Navy CTA */}
              <div className="pt-6 border-t border-slate-100">
                <button 
                  onClick={() => router.push(`/services/sow/${selectedRecord.id}`)}
                  className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-slate-200"
                >
                   View Full Details <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}