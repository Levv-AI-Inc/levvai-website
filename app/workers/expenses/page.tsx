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
  AlertTriangle,
  CreditCard,
  Calendar,
  Wallet,
  CheckCircle2,
  User,
  Plane
} from "lucide-react";

// --- Data ---
const expenses = [
  {
    id: "EXP-2024-057",
    worker: "James Carter",
    role: "Senior Backend Engineer",
    supplier: "TEKsystems",
    type: "Travel",
    date: "Apr 3, 2024",
    amount: 420.00,
    currency: "USD",
    submitted: "Apr 5, 2024",
    policy: "Compliant",
    approval: "Pending",
    payment: "Not Paid",
    description: "Flight to NYC for architecture planning sessions."
  },
  {
    id: "EXP-2024-049",
    worker: "Priya Shah",
    role: "Business Analyst",
    supplier: "Randstad",
    type: "Meals",
    date: "Mar 29, 2024",
    amount: 68.50,
    currency: "USD",
    submitted: "Mar 30, 2024",
    policy: "Compliant",
    approval: "Approved",
    payment: "Paid",
    description: "Project team dinner during UAT phase."
  },
  {
    id: "EXP-2024-041",
    worker: "Daniel Wong",
    role: "QA Automation Engineer",
    supplier: "Insight Global",
    type: "Lodging",
    date: "Mar 22, 2024",
    amount: 980.00,
    currency: "USD",
    submitted: "Mar 24, 2024",
    policy: "Exception",
    approval: "Rejected",
    payment: "On Hold",
    description: "Hotel stay (exceeds nightly corporate cap of $250)."
  },
  {
    id: "EXP-2024-062",
    worker: "Elena Rossi",
    role: "UX Designer",
    supplier: "Aquent",
    type: "Travel",
    date: "Apr 10, 2024",
    amount: 150.00,
    currency: "USD",
    submitted: "Apr 11, 2024",
    policy: "Compliant",
    approval: "Pending",
    payment: "Not Paid",
    description: "Train fare and taxi for onsite user testing."
  }
];

export default function ExpensesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiInput, setAiInput] = useState("");

  const statuses = ["All", "Approved", "Pending", "Rejected"];

  // --- Logic: Filtering ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesSearch = 
        exp.worker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.type.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = selectedStatus === "All" || exp.approval === selectedStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus]);

  const exceptionCount = expenses.filter(e => e.policy === 'Exception' && e.approval !== 'Rejected').length;
  const pendingTotal = expenses.filter(e => e.approval === 'Pending').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Expenses</h1>
            <p className="text-slate-500 font-medium mt-1">Audit and process workforce reimbursement claims.</p>
          </div>

          {/* Nova AI Command Bar - Cyan / Dark Navy Theme */}
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
                placeholder="Ask Nova to flag out-of-policy items..."
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Policy Exceptions</span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle size={24} className={exceptionCount > 0 ? "text-rose-500" : "text-emerald-500"} />
              {exceptionCount}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Approval Stage</label>
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

            <div className="flex-1 min-w-[250px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1 text-gray-400">Search Claims</label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors" size={16} />
                <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                  placeholder="Worker, Type, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 border-l border-slate-100 pl-6">
                <div className="text-center">
                    <p className="text-sm font-black text-slate-900">${pendingTotal.toFixed(0)}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Pending</p>
                </div>
            </div>
          </div>
        </div>

        {/* EXPENSE TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Expense & Worker</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Financials</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Compliance</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Workflow</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr 
                    key={exp.id} 
                    className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                    onClick={() => setSelectedRecord(exp)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center border shadow-sm ${
                            exp.type === 'Travel' ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                            exp.type === 'Lodging' ? 'bg-slate-900 text-cyan-400 border-slate-800' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {exp.type === 'Travel' ? <Plane size={18} /> : <Receipt size={18} />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight mb-0.5">{exp.worker}</div>
                          <div className="text-[10px] font-black text-cyan-600 uppercase tracking-tight">ID: {exp.id} • {exp.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-900 leading-none">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: exp.currency }).format(exp.amount)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1 italic">
                        Spent: {exp.date}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white ${
                        exp.policy === 'Compliant' ? 'text-emerald-700 border-emerald-100' : 'text-rose-700 border-rose-100'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${exp.policy === 'Compliant' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {exp.policy}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <div className={`w-fit inline-flex items-center gap-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          exp.approval === 'Approved' ? 'text-emerald-600' : 
                          exp.approval === 'Pending' ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          • {exp.approval}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase pl-3 tracking-tighter">
                          Payment: {exp.payment}
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
                <div className="h-16 w-16 rounded-2xl bg-slate-950 flex items-center justify-center text-cyan-400 font-black text-2xl shadow-lg shadow-cyan-900/10">
                  {selectedRecord.worker.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{selectedRecord.worker}</h2>
                  <p className="text-sm font-bold text-cyan-600 uppercase tracking-widest">{selectedRecord.type} Claim</p>
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {selectedRecord.policy === "Exception" && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3">
                    <AlertTriangle className="text-rose-600 shrink-0" size={20} />
                    <div>
                        <p className="text-sm font-bold text-rose-900">Policy Violation Detected</p>
                        <p className="text-xs text-rose-700 font-medium">This expense exceeds the standard nightly cap for Lodging in this region ($250/night). Justification required.</p>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><DollarSign size={10}/> Total Amount</p>
                  <p className="text-2xl font-black text-slate-900">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedRecord.currency }).format(selectedRecord.amount)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Calendar size={10}/> Expense Date</p>
                  <p className="text-2xl font-black text-cyan-600">{selectedRecord.date}</p>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Receipt size={14}/> Claim Justification</h3>
                <p className="text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                  "{selectedRecord.description}"
                </p>
              </section>

              <section className="grid grid-cols-2 gap-6 pt-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><User size={14} /> Stakeholders</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Contractor</p>
                  <p className="text-sm font-bold text-slate-900">{selectedRecord.worker}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Supplier</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.supplier}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><CreditCard size={14} /> Disbursement</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Payment Status</p>
                  <p className="text-sm font-bold text-cyan-600">{selectedRecord.payment}</p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Submitted On</p>
                    <p className="text-sm font-bold text-slate-900">{selectedRecord.submitted}</p>
                  </div>
                </div>
              </section>

              <div className="pt-6 border-t border-slate-100">
                <button className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-cyan-900/10">
                    View Original Receipt <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                {selectedRecord.approval === 'Pending' && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <button className="bg-emerald-600 text-white py-3 rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button className="bg-white border border-slate-200 text-rose-600 py-3 rounded-2xl font-bold text-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2">
                      <X size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}