"use client";

import React, { useState, useMemo } from "react";
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  X, 
  ChevronRight, 
  FileText, 
  User, 
  Sparkles,
  ChevronDown,
  DollarSign,
  Briefcase,
  History,
  Inbox,
  ArrowRight,
  Eye,
  AlertCircle,
  Calendar
} from "lucide-react";

type ApprovalItem = {
  id: string;
  type: string;
  title: string;
  requester: string;
  supplier: string;
  amount: string;
  approvalType: string;
  submitted: string;
  description: string;
  decision?: "Approved" | "Rejected";
  decidedOn?: string;
};

const initialPending: ApprovalItem[] = [
  {
    id: "APR-2024-014",
    type: "SOW",
    title: "Cloud Migration Program",
    requester: "Sarah Johnson",
    supplier: "Deloitte",
    amount: "$1,250,000",
    approvalType: "Financial",
    submitted: "2 days ago",
    description: "Final funding release for Phase 2 infrastructure migration."
  },
  {
    id: "APR-2024-011",
    type: "Job Posting",
    title: "Senior React Developer",
    requester: "Mike Chen",
    supplier: "TEKsystems",
    amount: "$95/hr",
    approvalType: "Rate Approval",
    submitted: "3 days ago",
    description: "Urgent backfill for frontend lead role in Trading Systems."
  },
  {
    id: "APR-2024-008",
    type: "Invoice",
    title: "March Services Invoice",
    requester: "Accounts Payable",
    supplier: "Infosys",
    amount: "$185,000",
    approvalType: "Invoice Approval",
    submitted: "1 week ago",
    description: "Monthly recurring managed services for L1 support desk."
  },
];

export default function MyApprovalsPage() {
  const [pending, setPending] = useState<ApprovalItem[]>(initialPending);
  const [history, setHistory] = useState<ApprovalItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<ApprovalItem | null>(null);
  const [aiInput, setAiInput] = useState("");

  const handleDecision = (item: ApprovalItem, decision: "Approved" | "Rejected") => {
    setPending((prev) => prev.filter((p) => p.id !== item.id));
    setHistory((prev) => [
      { ...item, decision, decidedOn: "Just now" },
      ...prev,
    ]);
    setSelectedRecord(null);
  };

  const filteredPending = useMemo(() => {
    return pending.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pending, searchTerm]);

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Approvals</h1>
            <p className="text-slate-500 font-medium mt-1">Review and action pending requests across your portfolio.</p>
          </div>

          {/* Nova AI Command Bar - Teal / Dark Navy Theme */}
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-0 bg-teal-500/5 blur-xl group-hover:bg-teal-500/10 transition-all rounded-3xl" />
            <div className="relative flex items-center bg-white border border-teal-100 rounded-2xl shadow-sm overflow-hidden p-1 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
              <div className="bg-slate-950 p-2 rounded-xl text-teal-400 ml-1 shadow-lg shadow-teal-900/20">
                <Sparkles size={18} />
              </div>
              <input 
                type="text" 
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Nova to summarize this queue..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold px-3 py-2 placeholder:text-slate-400"
              />
              <button className="pr-3 text-teal-600 font-bold text-xs uppercase hover:text-teal-800 transition-colors">
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* METRICS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="bg-amber-50 text-amber-600 p-4 rounded-2xl">
              <Inbox size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Awaiting Action</p>
              <p className="text-2xl font-black">{pending.length} Items</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processed (24h)</p>
              <p className="text-2xl font-black">{history.length} Done</p>
            </div>
          </div>

          <div className="bg-teal-600 p-6 rounded-3xl shadow-lg shadow-teal-100 flex items-center gap-5 text-white">
            <div className="bg-white/20 p-4 rounded-2xl">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-teal-100 uppercase tracking-widest">Avg. Response</p>
              <p className="text-2xl font-black">4.2 Hours</p>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="mb-6 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={18} />
          <input 
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 shadow-sm transition-all font-medium"
            placeholder="Search by ID, requester, or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* PENDING TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
          <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Clock size={16} /> My Action Queue
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Request Details</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requested By</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount / Type</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPending.length > 0 ? (
                  filteredPending.map((item) => (
                    <tr 
                      key={item.id} 
                      className="group hover:bg-teal-50/40 transition-all cursor-pointer"
                      onClick={() => setSelectedRecord(item)}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              item.type === 'SOW' ? 'bg-blue-50 text-blue-600' : 
                              item.type === 'Job Posting' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {item.type === 'SOW' ? <FileText size={16} /> : item.type === 'Job Posting' ? <Briefcase size={16} /> : <DollarSign size={16} />}
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{item.id}</div>
                              <div className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{item.title}</div>
                            </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-800">{item.requester}</div>
                        <div className="text-xs text-slate-400 font-medium">via {item.supplier}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-slate-900 leading-none">{item.amount}</div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 block italic">{item.approvalType}</span>
                      </td>
                      <td className="px-8 py-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                            <button 
                             onClick={() => handleDecision(item, "Approved")}
                             className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100"
                            >
                              Approve
                            </button>
                            <button 
                             onClick={() => handleDecision(item, "Rejected")}
                             className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
                            >
                              Reject
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-16 text-center text-slate-400 font-medium">No pending items in your queue 🎉</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORY TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden opacity-80">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <History size={16} /> Decision History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Request ID</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Decision</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.length > 0 ? (
                  history.map((item) => (
                    <tr key={item.id} className="bg-white">
                      <td className="px-8 py-5 text-xs font-bold text-teal-600 uppercase">{item.id}</td>
                      <td className="px-8 py-5 font-bold text-slate-700 text-sm">{item.title}</td>
                      <td className="px-8 py-5">
                         <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                           item.decision === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                         }`}>
                           {item.decision}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-400">{item.decidedOn}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-slate-400 italic">No history available for this session.</td>
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
                <span className="text-xs font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-md uppercase">{selectedRecord.id}</span>
                <h2 className="text-2xl font-black text-slate-900 mt-3 tracking-tight leading-tight">{selectedRecord.title}</h2>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                 <AlertCircle className="text-amber-600 shrink-0" size={20} />
                 <div>
                   <p className="text-sm font-bold text-amber-900">Pending Financial Approval</p>
                   <p className="text-xs text-amber-700 font-medium">Please review the budget impact before deciding.</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Amount</p>
                  <p className="text-lg font-black text-slate-900">{selectedRecord.amount}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Approval Path</p>
                  <p className="text-sm font-bold text-slate-900 uppercase mt-1">{selectedRecord.approvalType}</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Request Narrative</h3>
                <p className="text-slate-600 leading-relaxed font-medium">{selectedRecord.description}</p>
              </section>

              <section className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><User size={14} /> Stakeholders</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Requester</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.requester}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Vendor</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.supplier}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Calendar size={14} /> Timeline</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Submitted Date</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.submitted}</p>
                </div>
              </section>

              <div className="pt-6 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleDecision(selectedRecord, "Approved")}
                    className="bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                  >
                    Confirm Approval
                  </button>
                  <button 
                    onClick={() => handleDecision(selectedRecord, "Rejected")}
                    className="bg-rose-500 text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-100"
                  >
                    Reject Request
                  </button>
                </div>
                <button className="w-full mt-3 bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                  <ArrowRight size={14} /> View Original Submission
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}