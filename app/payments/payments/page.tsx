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
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Link as LinkIcon,
  ShieldCheck,
  Globe,
  ArrowUpRight,
  Wallet
} from "lucide-react";

// --- Data ---
const payments = [
  {
    id: "PAY-2024-056",
    supplier: "TEKsystems",
    method: "ACH",
    amount: 12600,
    currency: "USD",
    date: "May 12, 2024",
    status: "Paid",
    bank: "**** 4821",
    invoice: "INV-2024-091",
    processor: "AP Automation",
    description: "Electronic disbursement for approved weekly staffing invoices."
  },
  {
    id: "PAY-2024-051",
    supplier: "Accenture",
    method: "Wire",
    amount: 450000,
    currency: "USD",
    date: "Apr 28, 2024",
    status: "Paid",
    bank: "**** 9934",
    invoice: "INV-2024-073",
    processor: "Treasury",
    description: "High-value milestone payment for Core Banking Upgrade Phase 1."
  },
  {
    id: "PAY-2024-044",
    supplier: "Insight Global",
    method: "ACH",
    amount: 980,
    currency: "USD",
    date: "May 18, 2024",
    status: "Scheduled",
    bank: "**** 1172",
    invoice: "INV-2024-084",
    processor: "AP Automation",
    description: "Scheduled reimbursement for validated expense claims."
  },
  {
    id: "PAY-2024-060",
    supplier: "Deloitte",
    method: "Wire",
    amount: 8400,
    currency: "USD",
    date: "Pending",
    status: "Failed",
    bank: "**** 2201",
    invoice: "INV-2024-098",
    processor: "Treasury",
    description: "Payment rejected by receiving bank. Verify SWIFT/BIC details."
  }
];

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiInput, setAiInput] = useState("");

  const statuses = ["All", "Paid", "Scheduled", "Failed"];

  // --- Logic: Filtering ---
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch = 
        p.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.invoice.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = selectedStatus === "All" || p.status === selectedStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus]);

  const paidTotal = payments.filter(p => p.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0);
  const failedCount = payments.filter(p => p.status === 'Failed').length;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Payments</h1>
            <p className="text-slate-500 font-medium mt-1">Audit executed funds and monitor scheduled disbursements.</p>
          </div>

          {/* Nova AI Command Bar - Cyan / Dark Navy Theme */}
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all rounded-3xl" />
            <div className="relative flex items-center bg-white border border-cyan-100 rounded-2xl shadow-sm overflow-hidden p-1 focus-within:ring-2 focus-within:ring-cyan-400/30 transition-all">
              <div className="bg-slate-950 p-2.5 rounded-xl text-cyan-400 ml-1">
                <Sparkles size={18} />
              </div>
              <input 
                type="text" 
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask Nova to analyze cash outflow..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold px-3 py-2 placeholder:text-slate-400"
              />
              <button className="pr-3 text-cyan-500 font-bold text-xs uppercase hover:text-cyan-700 transition-colors">
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* METRICS & FILTERS */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Executed (MTD)</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <Wallet size={24} className="text-emerald-500" />
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(paidTotal)}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Payment Status</label>
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
                  placeholder="Payment ID, Supplier, or Invoice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 border-l border-slate-100 pl-6">
                <div className="text-center pr-2">
                    <p className={`text-sm font-black ${failedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{failedCount}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Failed</p>
                </div>
                <button 
                  onClick={() => {setSearchTerm(""); setSelectedStatus("All");}}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-all"
                >
                  <X size={18} className="text-slate-300" />
                </button>
            </div>
          </div>
        </div>

        {/* PAYMENT TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Transaction Details</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Disbursement</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Funding Source</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Processing Status</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr 
                    key={p.id} 
                    className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                    onClick={() => setSelectedRecord(p)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-cyan-600 font-bold text-sm border border-slate-200 shadow-sm leading-none">
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight mb-0.5">{p.id}</div>
                          <div className="text-[10px] font-black text-cyan-600 uppercase tracking-tight leading-none">{p.supplier}</div>
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase mt-1 leading-none">
                             <LinkIcon size={10} /> Invoice: {p.invoice}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-900 leading-none">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency }).format(p.amount)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1 italic leading-none">
                        via {p.method}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-slate-800 text-xs font-bold leading-none mb-1">
                        <Building2 size={12} className="text-slate-400" />
                        {p.bank}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight leading-none">Settlement Account</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <div className={`w-fit inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white ${
                          p.status === 'Paid' ? 'text-emerald-700 border-emerald-100' : 
                          p.status === 'Scheduled' ? 'text-cyan-700 border-cyan-100' : 'text-rose-700 border-rose-100'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${p.status === 'Paid' ? 'bg-emerald-500' : p.status === 'Scheduled' ? 'bg-cyan-500' : 'bg-rose-500'}`} />
                          {p.status}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase pl-1 tracking-tighter leading-none">
                          Unit: {p.processor}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest bg-cyan-100/50 px-3 py-1.5 rounded-lg flex items-center gap-2 leading-none">
                          <Eye size={12} /> Details
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
                  <CreditCard size={32} />
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
              {selectedRecord.status === "Failed" && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="text-rose-600 shrink-0" size={20} />
                    <div>
                        <p className="text-sm font-bold text-rose-900">Settlement Failure</p>
                        <p className="text-xs text-rose-700 font-medium leading-relaxed">Bank rejected Wire instruction. Technical code: R23 (Insufficient Info). Verify recipient's IBAN/BIC details.</p>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1 leading-none"><DollarSign size={10}/> Total Amount</p>
                  <p className="text-2xl font-black text-slate-900 leading-none mt-2">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedRecord.currency }).format(selectedRecord.amount)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1 leading-none"><Calendar size={10}/> Release Date</p>
                  <p className={`text-2xl font-black leading-none mt-2 ${selectedRecord.status === 'Scheduled' ? 'text-cyan-600' : 'text-slate-900'}`}>{selectedRecord.date}</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><FileText size={14}/> Transaction Memo</h3>
                <p className="text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                  "{selectedRecord.description}"
                </p>
              </section>

              <section className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 leading-none"><Globe size={14} /> Settlement</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Bank Account</p>
                  <p className="text-sm font-bold text-slate-900 leading-none mb-3">{selectedRecord.bank}</p>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Payment Method</p>
                    <p className="text-sm font-bold text-cyan-600 flex items-center gap-1 leading-none">{selectedRecord.method} Transfer</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 leading-none"><ShieldCheck size={14} /> Compliance</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Approved Processor</p>
                  <p className="text-sm font-bold text-slate-900 leading-none mb-3">{selectedRecord.processor}</p>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Linked Invoice</p>
                    <p className="text-sm font-bold text-cyan-600 flex items-center gap-1 leading-none">{selectedRecord.invoice} <ArrowUpRight size={12}/></p>
                  </div>
                </div>
              </section>

              <div className="pt-6 border-t border-slate-100">
                <button className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-cyan-900/10">
                    Download Remittance Advice <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}