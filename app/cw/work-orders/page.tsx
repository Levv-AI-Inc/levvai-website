"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  ChevronDown,
  Eye,
  Sparkles,
  User,
  Calendar,
  DollarSign,
  ArrowRight,
  Clock,
  Building2,
  MapPin,
  FileText,
  Briefcase,
  Hash,
  TrendingUp,
} from "lucide-react";

// --- Types ---
type WorkOrderStatus =
  | "Active"
  | "Pending Approval"
  | "Expiring"
  | "Closed"
  | "Declined";

interface WorkOrder {
  id: string;
  workerName: string;
  jobTitle: string;
  supplier: string;
  hiringManager: string;
  site: string;
  businessUnit: string;
  startDate: string;
  endDate: string;
  status: WorkOrderStatus;
  billRate: number;
  rateUnit: string;
  currency: string;
  committedSpend: number;
  spendToDate: number;
  costCenter: string;
  jobPostingRef: string;
  hoursPerWeek: number;
  revision: number;
}

// --- Mock Data (realistic CW work order records) ---
const workOrderData: WorkOrder[] = [
  {
    id: "WO-2024-00142",
    workerName: "Marcus Webb",
    jobTitle: "Senior Java Developer",
    supplier: "Accenture",
    hiringManager: "Sarah Jenkins",
    site: "Toronto HQ",
    businessUnit: "Technology",
    startDate: "Jan 15, 2024",
    endDate: "Jul 15, 2024",
    status: "Active",
    billRate: 145,
    rateUnit: "Hr",
    currency: "CAD",
    committedSpend: 112840,
    spendToDate: 68400,
    costCenter: "CC-TECH-001",
    jobPostingRef: "JP-2023-0891",
    hoursPerWeek: 40,
    revision: 1,
  },
  {
    id: "WO-2024-00137",
    workerName: "Priya Nair",
    jobTitle: "Data Analyst",
    supplier: "Infosys",
    hiringManager: "Michael Chen",
    site: "Mississauga Office",
    businessUnit: "Finance",
    startDate: "Feb 01, 2024",
    endDate: "Aug 31, 2024",
    status: "Active",
    billRate: 98,
    rateUnit: "Hr",
    currency: "CAD",
    committedSpend: 61152,
    spendToDate: 29400,
    costCenter: "CC-FIN-007",
    jobPostingRef: "JP-2024-0034",
    hoursPerWeek: 37.5,
    revision: 2,
  },
  {
    id: "WO-2024-00129",
    workerName: "Daniel Okafor",
    jobTitle: "Cloud Infrastructure Engineer",
    supplier: "IBM",
    hiringManager: "Amanda Ross",
    site: "Remote – ON",
    businessUnit: "Technology",
    startDate: "Nov 20, 2023",
    endDate: "May 20, 2024",
    status: "Expiring",
    billRate: 162,
    rateUnit: "Hr",
    currency: "USD",
    committedSpend: 189216,
    spendToDate: 180000,
    costCenter: "CC-TECH-003",
    jobPostingRef: "JP-2023-0756",
    hoursPerWeek: 40,
    revision: 3,
  },
  {
    id: "WO-2024-00188",
    workerName: "Leila Mansouri",
    jobTitle: "Business Systems Analyst",
    supplier: "Deloitte",
    hiringManager: "David Volek",
    site: "Calgary Branch",
    businessUnit: "Operations",
    startDate: "Mar 11, 2024",
    endDate: "Sep 11, 2024",
    status: "Pending Approval",
    billRate: 115,
    rateUnit: "Hr",
    currency: "CAD",
    committedSpend: 71760,
    spendToDate: 0,
    costCenter: "CC-OPS-012",
    jobPostingRef: "JP-2024-0101",
    hoursPerWeek: 40,
    revision: 1,
  },
  {
    id: "WO-2024-00203",
    workerName: "Thomas Bergmann",
    jobTitle: "Scrum Master",
    supplier: "KPMG",
    hiringManager: "Elena Rodriguez",
    site: "Toronto HQ",
    businessUnit: "Technology",
    startDate: "Apr 01, 2024",
    endDate: "Dec 31, 2024",
    status: "Active",
    billRate: 130,
    rateUnit: "Hr",
    currency: "CAD",
    committedSpend: 135200,
    spendToDate: 41600,
    costCenter: "CC-TECH-001",
    jobPostingRef: "JP-2024-0118",
    hoursPerWeek: 40,
    revision: 1,
  },
  {
    id: "WO-2023-00991",
    workerName: "Sofia Reyes",
    jobTitle: "Cybersecurity Analyst",
    supplier: "Accenture",
    hiringManager: "Robert Smith",
    site: "Remote – BC",
    businessUnit: "Risk & Compliance",
    startDate: "Sep 01, 2023",
    endDate: "Feb 29, 2024",
    status: "Closed",
    billRate: 122,
    rateUnit: "Hr",
    currency: "CAD",
    committedSpend: 76960,
    spendToDate: 76960,
    costCenter: "CC-RISK-005",
    jobPostingRef: "JP-2023-0612",
    hoursPerWeek: 40,
    revision: 2,
  },
];

// --- Helpers ---
const STATUS_CONFIG: Record<
  WorkOrderStatus,
  { dot: string; text: string; border: string }
> = {
  Active: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-emerald-100",
  },
  "Pending Approval": {
    dot: "bg-amber-500",
    text: "text-amber-700",
    border: "border-amber-100",
  },
  Expiring: {
    dot: "bg-orange-500",
    text: "text-orange-700",
    border: "border-orange-100",
  },
  Closed: {
    dot: "bg-slate-400",
    text: "text-slate-500",
    border: "border-slate-100",
  },
  Declined: {
    dot: "bg-rose-500",
    text: "text-rose-700",
    border: "border-rose-100",
  },
};

function spendPercent(spent: number, committed: number) {
  if (!committed) return 0;
  return Math.min(100, Math.round((spent / committed) * 100));
}

function fmt(n: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

// ============================================================
// PAGE
// ============================================================
export default function WorkOrdersPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedSupplier, setSelectedSupplier] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState<WorkOrder | null>(null);
  const [aiInput, setAiInput] = useState("");

  const suppliers = useMemo(
    () => ["All", ...new Set(workOrderData.map((w) => w.supplier))],
    []
  );

  const filtered = useMemo(() => {
    return workOrderData.filter((wo) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        wo.workerName.toLowerCase().includes(q) ||
        wo.id.toLowerCase().includes(q) ||
        wo.jobTitle.toLowerCase().includes(q);
      const matchStatus =
        selectedStatus === "All" || wo.status === selectedStatus;
      const matchSupplier =
        selectedSupplier === "All" || wo.supplier === selectedSupplier;
      return matchSearch && matchStatus && matchSupplier;
    });
  }, [searchTerm, selectedStatus, selectedSupplier]);

  const totalCommitted = filtered.reduce((a, b) => a + b.committedSpend, 0);
  const totalSpent = filtered.reduce((a, b) => a + b.spendToDate, 0);
  const activeCount = filtered.filter((w) => w.status === "Active").length;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Work Orders
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Manage active contingent worker engagements and spend governance.
            </p>
          </div>

          {/* Nova Search */}
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
                placeholder="Ask Nova about work orders..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold px-3 py-2 placeholder:text-slate-400"
              />
              <button className="pr-3 text-cyan-500 font-bold text-xs uppercase hover:text-cyan-700 transition-colors">
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats Row ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Active count */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Active Workers
            </span>
            <div className="text-3xl font-black text-slate-900 flex items-center gap-2">
              <Briefcase size={22} className="text-cyan-500" />
              {activeCount}
            </div>
          </div>

          {/* Committed spend */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Committed Spend
            </span>
            <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <DollarSign size={20} className="text-emerald-500" />
              {fmt(totalCommitted)}
            </div>
          </div>

          {/* Spend to date */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Spend to Date
            </span>
            <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <TrendingUp size={20} className="text-amber-500" />
              {fmt(totalSpent)}
            </div>
          </div>

          {/* Filters panel */}
          <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
            {/* Supplier */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                Supplier
              </label>
              <div className="relative">
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2 pl-3 pr-8 rounded-xl text-xs font-bold focus:ring-2 focus:ring-cyan-500 outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
            {/* Status */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
                Status
              </label>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-100 py-2 pl-3 pr-8 rounded-xl text-xs font-bold focus:ring-2 focus:ring-cyan-500 outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Expiring">Expiring</option>
                  <option value="Closed">Closed</option>
                  <option value="Declined">Declined</option>
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
            {/* Reset */}
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedStatus("All");
                setSelectedSupplier("All");
              }}
              className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1.5 self-start"
            >
              <X size={11} /> Reset Filters
            </button>
          </div>
        </div>

        {/* ── Search ───────────────────────────────────────────── */}
        <div className="mb-6 relative group">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-500 transition-colors"
            size={18}
          />
          <input
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-cyan-400/10 focus:border-cyan-500 shadow-sm transition-all font-medium"
            placeholder="Search by worker name, WO number, or job title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ── Table ────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    Worker & Role
                  </th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    Supplier
                  </th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    Period
                  </th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    Spend
                  </th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    Status
                  </th>
                  <th className="px-8 py-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length > 0 ? (
                  filtered.map((wo) => {
                    const sc = STATUS_CONFIG[wo.status];
                    const pct = spendPercent(wo.spendToDate, wo.committedSpend);
                    return (
                      <tr
                        key={wo.id}
                        className="group hover:bg-cyan-50/40 transition-all cursor-pointer"
                        onClick={() =>
                          router.push(`/cw/work-orders/${wo.id}`)
                        }
                      >
                        {/* Worker & Role */}
                        <td className="px-8 py-5">
                          <div className="text-[10px] font-black text-cyan-600 bg-cyan-50 w-fit px-2 py-0.5 rounded-md mb-1.5 uppercase tracking-tighter leading-none">
                            {wo.id}
                          </div>
                          <div className="font-bold text-slate-900 leading-tight group-hover:text-cyan-700 transition-colors">
                            {wo.workerName}
                          </div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5">
                            {wo.jobTitle}
                          </div>
                        </td>

                        {/* Supplier */}
                        <td className="px-8 py-5">
                          <div className="font-bold text-slate-800 text-sm">
                            {wo.supplier}
                          </div>
                          <div className="text-xs text-slate-400 font-medium mt-0.5">
                            {wo.businessUnit}
                          </div>
                        </td>

                        {/* Period */}
                        <td className="px-8 py-5">
                          <div className="text-sm font-bold text-slate-800">
                            {wo.startDate}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            — TO —
                          </div>
                          <div className="text-sm font-bold text-slate-800">
                            {wo.endDate}
                          </div>
                        </td>

                        {/* Spend w/ progress */}
                        <td className="px-8 py-5 min-w-[160px]">
                          <div className="text-sm font-black text-slate-900">
                            {fmt(wo.spendToDate, wo.currency)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            of {fmt(wo.committedSpend, wo.currency)}
                          </div>
                          {/* spend bar */}
                          <div className="mt-2 h-1.5 bg-slate-100 rounded-full w-28 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 90
                                  ? "bg-rose-400"
                                  : pct >= 70
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                            {pct}% utilized
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-8 py-5">
                          <div
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm bg-white ${sc.text} ${sc.border}`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}
                            />
                            {wo.status}
                          </div>
                          {wo.revision > 1 && (
                            <div className="text-[10px] text-slate-400 font-bold mt-1.5">
                              Rev. {wo.revision}
                            </div>
                          )}
                        </td>

                        {/* Hover action */}
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecord(wo);
                              }}
                              className="text-[10px] font-black text-cyan-600 uppercase tracking-widest bg-cyan-100/50 px-3 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer"
                            >
                              <Eye size={12} /> Preview
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-8 py-24 text-center text-slate-400"
                    >
                      No work orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Preview Drawer ─────────────────────────────────────── */}
      {selectedRecord && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            onClick={() => setSelectedRecord(null)}
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 border-l border-slate-200 flex flex-col">
            {/* Drawer Header */}
            <div className="p-8 border-b border-slate-100 flex justify-between items-start">
              <div>
                <span className="text-xs font-black text-cyan-600 bg-cyan-50 px-2 py-1 rounded-md uppercase tracking-tighter leading-none">
                  {selectedRecord.id}
                </span>
                <h2 className="text-2xl font-black text-slate-900 mt-3 tracking-tight leading-tight">
                  {selectedRecord.workerName}
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  {selectedRecord.jobTitle}
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Status + Rate */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Status
                  </p>
                  <div
                    className={`inline-flex items-center gap-1.5 text-xs font-black uppercase ${
                      STATUS_CONFIG[selectedRecord.status].text
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        STATUS_CONFIG[selectedRecord.status].dot
                      }`}
                    />
                    {selectedRecord.status}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Bill Rate
                  </p>
                  <p className="text-lg font-black text-slate-900">
                    {selectedRecord.currency} ${selectedRecord.billRate}/
                    {selectedRecord.rateUnit}
                  </p>
                </div>
              </div>

              {/* Spend block */}
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <DollarSign size={14} /> Spend Governance
                </h3>
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-500">
                      Committed
                    </span>
                    <span className="font-black text-slate-900">
                      {fmt(selectedRecord.committedSpend, selectedRecord.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-500">
                      Spent to Date
                    </span>
                    <span className="font-black text-slate-900">
                      {fmt(selectedRecord.spendToDate, selectedRecord.currency)}
                    </span>
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase mb-1">
                      <span>Utilization</span>
                      <span>
                        {spendPercent(
                          selectedRecord.spendToDate,
                          selectedRecord.committedSpend
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          spendPercent(
                            selectedRecord.spendToDate,
                            selectedRecord.committedSpend
                          ) >= 90
                            ? "bg-rose-400"
                            : spendPercent(
                                selectedRecord.spendToDate,
                                selectedRecord.committedSpend
                              ) >= 70
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                        style={{
                          width: `${spendPercent(
                            selectedRecord.spendToDate,
                            selectedRecord.committedSpend
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Stakeholders + Period */}
              <section className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <User size={14} /> Parties
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    Supplier
                  </p>
                  <p className="text-sm font-bold text-slate-900 mb-2">
                    {selectedRecord.supplier}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    Hiring Manager
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedRecord.hiringManager}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <Calendar size={14} /> Period
                  </h3>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedRecord.startDate}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                    — TO —
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedRecord.endDate}
                  </p>
                </div>
              </section>

              {/* Site + Cost Centre */}
              <section className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <MapPin size={10} /> Site
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedRecord.site}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Hash size={10} /> Cost Centre
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedRecord.costCenter}
                  </p>
                </div>
              </section>

              {/* Ref fields */}
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <FileText size={14} /> Reference
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">
                      Job Posting
                    </span>
                    <span className="font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded text-xs uppercase tracking-tight">
                      {selectedRecord.jobPostingRef}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">
                      Hours / Week
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedRecord.hoursPerWeek} hrs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Revision</span>
                    <span className="font-bold text-slate-900">
                      Rev. {selectedRecord.revision}
                    </span>
                  </div>
                </div>
              </section>

              {/* CTA */}
              <div className="pt-6 border-t border-slate-100">
                <button
                  onClick={() =>
                    router.push(`/cw/work-orders/${selectedRecord.id}`)
                  }
                  className="w-full bg-slate-950 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all group shadow-xl shadow-slate-200"
                >
                  View Full Work Order{" "}
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}