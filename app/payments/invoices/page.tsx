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
  Receipt,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Link as LinkIcon,
  ShieldCheck,
  CreditCard,
  FileText,
  User
} from "lucide-react";

// --- Data ---
const invoices = [
  {
    id: "INV-2024-091",
    supplier: "TEKsystems",
    type: "Timesheet",
    amount: 12600,
    currency: "USD",
    invoiceDate: "Apr 10, 2024",
    dueDate: "May 10, 2024",
    match: "3-Way Match",
    approval: "Approved",
    payment: "Scheduled",
    linked: "TS-2024-089",
    description: "Consolidated billing for period Apr 1 - Apr 7."
  },
  {
    id: "INV-2024-084",
    supplier: "Insight Global",
    type: "Expense",
    amount: 980,
    currency: "USD",
    invoiceDate: "Apr 02, 2024",
    dueDate: "May 02, 2024",
    match: "Exception",
    approval: "Pending",
    payment: "On Hold",
    linked: "EXP-2024-041",
    description: "Workforce travel reimbursement for Q1 site audit."
  },
  {
    id: "INV-2024-073",
    supplier: "Accenture",
    type: "SOW",
    amount: 450000,
    currency: "USD",
    invoiceDate: "Mar 25, 2024",
    dueDate: "Apr 25, 2024",
    match: "2-Way Match",
    approval: "Approved",
    payment: "Paid",
    linked: "SOW-2024-021",
    description: "Phase 1: Discovery & Planning milestone completion."
  },
  {
    id: "INV-2024-095",
    supplier: "Deloitte",
    type: "Timesheet",
    amount: 8400,
    currency: "USD",
    invoiceDate: "Apr 12, 2024",
    dueDate: "May 12, 2024",
    match: "3-Way Match",
    approval: "Pending",
    payment: "Not Paid",
    linked: "TS-2024-092",
    description: "Professional services for cloud security assessment."
  }
];

export default function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiInput, setAiInput] = useState("");

  const statuses = ["All", "Approved", "Pending", "Rejected"];

  // --- Logic: Filtering ---
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch = 
        inv.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.linked.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = selectedStatus === "All" || inv.approval === selectedStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus]);

  const exceptionCount = invoices.filter(i => i.match === 'Exception').length;
  const scheduledTotal = invoices.filter(i => i.payment === 'Scheduled').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Invoices</h1>
            <p className="text-slate-500 font-medium mt-1">Reconcile supplier billings against engagement records.</p>
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
                placeholder="Ask Nova to find billing gaps..."
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Match Exceptions</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <AlertCircle size={24} className={exceptionCount > 0 ? "text-rose-500" : "text-emerald-500"} />
              {exceptionCount}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Approval Status</label>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Quick Search</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={16} />
                <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  placeholder="Invoice ID, Supplier, or Linked ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 border-l border-slate-100 pl-6">
                <div className="text-center pr-2">
                    <p className="text-sm font-black text-slate-900">${scheduledTotal.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Scheduled</p>
                </div>
            </div>
          </div>
        </div>

        {/* INVOICE TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Invoice Information</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Financials</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Compliance Match</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Lifecycle Status</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr 
                    key={inv.id} 
                    className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                    onClick={() => setSelectedRecord(inv)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-cyan-600 font-bold text-sm border border-slate-200 shadow-sm leading-none">
                          <Receipt size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight mb-0.5">{inv.id}</div>
                          <div className="text-[10px] font-black text-cyan-600 uppercase tracking-tight leading-none">{inv.supplier}</div>
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase mt-1">
                             <LinkIcon size={10} /> Linked: {inv.linked}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-900 leading-none">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency }).format(inv.amount)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1 italic">
                        Type: {inv.type}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white ${
                        inv.match.includes('Match') ? 'text-emerald-700 border-emerald-100' : 'text-rose-700 border-rose-100'
                      }`}>
                        <ShieldCheck size={12} className={inv.match.includes('Match') ? "text-emerald-500" : "text-rose-500"} />
                        {inv.match}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <div className={`w-fit inline-flex items-center gap-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          inv.approval === 'Approved' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          • Approval: {inv.approval}
                        </div>
                        <span className={`text-[9px] font-bold uppercase pl-3 tracking-tighter ${
                            inv.payment === 'Paid' ? 'text-cyan-600' : 'text-slate-400'
                        }`}>
                          Payment: {inv.payment}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest bg-cyan-100/50 px-3 py-1.5 rounded-lg flex items-center gap-2 leading-none">
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
                <div className="h-16 w-16 rounded-2xl bg-slate-950 flex items-center justify-center text-cyan-400 font-black text-2xl shadow-lg shadow-cyan-900/10">
                  <Receipt size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{selectedRecord.id}</h2>
                  <p className="text-sm font-bold text-cyan-600 uppercase tracking-widest leading-none mt-1">{selectedRecord.supplier}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedRecord.match === "Exception" && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="text-rose-600 shrink-0" size={20} />
                    <div>
                        <p className="text-sm font-bold text-rose-900">3-Way Match Exception</p>
                        <p className="text-xs text-rose-700 font-medium">Invoice amount does not match the linked record ({selectedRecord.linked}). Variance exceeds 5% threshold.</p>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><DollarSign size={10}/> Invoice Amount</p>
                  <p className="text-2xl font-black text-slate-900">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedRecord.currency }).format(selectedRecord.amount)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Calendar size={10}/> Due Date</p>
                  <p className="text-2xl font-black text-rose-600">{selectedRecord.dueDate}</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><FileText size={14}/> Billing Description</h3>
                <p className="text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                  "{selectedRecord.description}"
                </p>
              </section>

              <section className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><User size={14} /> Stakeholders</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Supplier</p>
                  <p className="text-sm font-bold text-slate-900 leading-none mb-3">{selectedRecord.supplier}</p>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Linked Engagement</p>
                    <p className="text-sm font-bold text-cyan-600 flex items-center gap-1 leading-none">{selectedRecord.linked} <ArrowRight size={12}/></p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><CreditCard size={14} /> Disbursement</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Payment Status</p>
                  <p className="text-sm font-bold text-cyan-600 leading-none mb-3">{selectedRecord.payment}</p>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Invoiced On</p>
                    <p className="text-sm font-bold text-slate-900 leading-none">{selectedRecord.invoiceDate}</p>
                  </div>
                </div>
              </section>

              <div className="pt-6 border-t border-slate-100">
                <button className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-cyan-900/10">
                    Download Original PDF <FileText size={18} className="group-hover:scale-110 transition-transform" />
                </button>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 leading-none">
                    <CheckCircle2 size={14} className="text-emerald-500" /> Verify Match
                  </button>
                  <button className="bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 leading-none">
                    <AlertCircle size={14} className="text-amber-500" /> Flag Dispute
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