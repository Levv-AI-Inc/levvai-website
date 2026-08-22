"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  DollarSign,
  Calendar,
  User,
  Building2,
  MapPin,
  Hash,
  Clock,
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Pencil,
  XCircle,
  RefreshCw,
  MoreHorizontal,
  Activity,
  CreditCard,
  ClipboardList,
  Info,
  Send,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type WOStatus = "Active" | "Pending Approval" | "Expiring" | "Closed" | "Declined";
type TSStatus = "Approved" | "Pending Approval" | "Rejected" | "Draft";

interface Rate {
  category: string;
  uom: string;
  billRate: number;
  currency: string;
}

interface Timesheet {
  id: string;
  period: string;
  hours: number;
  amount: number;
  status: TSStatus;
  submittedBy: string;
  submittedOn: string;
}

interface AuditEvent {
  id: string;
  date: string;
  actor: string;
  action: string;
  detail: string;
  type: "approve" | "submit" | "revise" | "system" | "close";
}

interface WorkOrderDetail {
  id: string;
  revision: number;
  workerName: string;
  workerEmail: string;
  jobTitle: string;
  supplier: string;
  supplierCode: string;
  hiringManager: string;
  hiringManagerEmail: string;
  site: string;
  businessUnit: string;
  costCenter: string;
  costCenterCode: string;
  taskCode: string;
  startDate: string;
  endDate: string;
  status: WOStatus;
  hoursPerDay: number;
  hoursPerWeek: number;
  timesheetType: string;
  timesheetFrequency: string;
  currency: string;
  committedSpend: number;
  spendToDate: number;
  estimatedExpenses: number;
  jobPostingRef: string;
  rates: Rate[];
  timesheets: Timesheet[];
  auditLog: AuditEvent[];
  novaFlags: { level: "warning" | "info" | "ok"; message: string }[];
}

// ─────────────────────────────────────────────────────────────
// Mock Data — indexed by WO ID
// ─────────────────────────────────────────────────────────────
const WO_DETAILS: Record<string, WorkOrderDetail> = {
  "WO-2024-00142": {
    id: "WO-2024-00142",
    revision: 1,
    workerName: "Marcus Webb",
    workerEmail: "m.webb@accenture.com",
    jobTitle: "Senior Java Developer",
    supplier: "Accenture",
    supplierCode: "ACC01",
    hiringManager: "Sarah Jenkins",
    hiringManagerEmail: "s.jenkins@levv.ai",
    site: "Toronto HQ",
    businessUnit: "Technology",
    costCenter: "Enterprise Technology",
    costCenterCode: "CC-TECH-001",
    taskCode: "SOFT-DEV-SR",
    startDate: "Jan 15, 2024",
    endDate: "Jul 15, 2024",
    status: "Active",
    hoursPerDay: 8,
    hoursPerWeek: 40,
    timesheetType: "Standard",
    timesheetFrequency: "Weekly",
    currency: "CAD",
    committedSpend: 112840,
    spendToDate: 68400,
    estimatedExpenses: 4200,
    jobPostingRef: "JP-2023-0891",
    rates: [
      { category: "ST", uom: "Hr", billRate: 145, currency: "CAD" },
      { category: "OT", uom: "Hr", billRate: 217.5, currency: "CAD" },
    ],
    timesheets: [
      { id: "TS-2024-04401", period: "Jun 24 – Jun 30, 2024", hours: 40, amount: 5800, status: "Approved", submittedBy: "Marcus Webb", submittedOn: "Jul 1, 2024" },
      { id: "TS-2024-04312", period: "Jun 17 – Jun 23, 2024", hours: 40, amount: 5800, status: "Approved", submittedBy: "Marcus Webb", submittedOn: "Jun 24, 2024" },
      { id: "TS-2024-04201", period: "Jun 10 – Jun 16, 2024", hours: 42, amount: 6090, status: "Approved", submittedBy: "Marcus Webb", submittedOn: "Jun 17, 2024" },
      { id: "TS-2024-04088", period: "Jun 3 – Jun 9, 2024", hours: 40, amount: 5800, status: "Approved", submittedBy: "Marcus Webb", submittedOn: "Jun 10, 2024" },
      { id: "TS-2024-04001", period: "May 27 – Jun 2, 2024", hours: 38, amount: 5510, status: "Pending Approval", submittedBy: "Marcus Webb", submittedOn: "Jun 3, 2024" },
    ],
    auditLog: [
      { id: "a1", date: "Jul 1, 2024  09:14", actor: "System", action: "Timesheet Auto-Approved", detail: "TS-2024-04401 approved via rule: manager approval within 24 hrs.", type: "approve" },
      { id: "a2", date: "Jun 24, 2024  10:02", actor: "Sarah Jenkins", action: "Timesheet Approved", detail: "TS-2024-04312 approved.", type: "approve" },
      { id: "a3", date: "Jun 17, 2024  11:30", actor: "Sarah Jenkins", action: "Timesheet Approved", detail: "TS-2024-04201 approved (2 OT hours included).", type: "approve" },
      { id: "a4", date: "Jan 18, 2024  08:55", actor: "Accenture Portal", action: "Work Order Accepted", detail: "Supplier accepted Rev. 1 terms.", type: "submit" },
      { id: "a5", date: "Jan 16, 2024  14:30", actor: "Sarah Jenkins", action: "Work Order Approved", detail: "Approved by hiring manager.", type: "approve" },
      { id: "a6", date: "Jan 15, 2024  09:00", actor: "System", action: "Work Order Created", detail: "WO created from JP-2023-0891. Worker registration email sent.", type: "system" },
    ],
    novaFlags: [
      { level: "warning", message: "Spend utilization at 61% with 14 days remaining. Review extension need before end date." },
      { level: "info", message: "OT hours detected in TS-2024-04201. 2 hrs billed at OT rate ($217.50/hr)." },
      { level: "ok", message: "All timesheets approved on time. No compliance gaps detected." },
    ],
  },
  "WO-2024-00188": {
    id: "WO-2024-00188",
    revision: 1,
    workerName: "Leila Mansouri",
    workerEmail: "l.mansouri@deloitte.com",
    jobTitle: "Business Systems Analyst",
    supplier: "Deloitte",
    supplierCode: "DEL03",
    hiringManager: "David Volek",
    hiringManagerEmail: "d.volek@levv.ai",
    site: "Calgary Branch",
    businessUnit: "Operations",
    costCenter: "Operations Planning",
    costCenterCode: "CC-OPS-012",
    taskCode: "BUS-ANLYS-GEN",
    startDate: "Mar 11, 2024",
    endDate: "Sep 11, 2024",
    status: "Pending Approval",
    hoursPerDay: 8,
    hoursPerWeek: 40,
    timesheetType: "Standard",
    timesheetFrequency: "Bi-Weekly",
    currency: "CAD",
    committedSpend: 71760,
    spendToDate: 0,
    estimatedExpenses: 1800,
    jobPostingRef: "JP-2024-0101",
    rates: [
      { category: "ST", uom: "Hr", billRate: 115, currency: "CAD" },
    ],
    timesheets: [],
    auditLog: [
      { id: "a1", date: "Mar 11, 2024  14:00", actor: "Deloitte Portal", action: "Work Order Submitted", detail: "Supplier submitted WO for buyer approval.", type: "submit" },
      { id: "a2", date: "Mar 11, 2024  09:00", actor: "System", action: "Work Order Created", detail: "WO created from JP-2024-0101.", type: "system" },
    ],
    novaFlags: [
      { level: "warning", message: "Work order has been Pending Approval for 3 days. Escalate to David Volek to unblock onboarding." },
      { level: "info", message: "Worker has not yet registered. Registration email will be triggered upon WO activation." },
    ],
  },
};

// Fallback to first record if ID not found
function getWO(id: string): WorkOrderDetail {
  return WO_DETAILS[id] ?? WO_DETAILS["WO-2024-00142"];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<WOStatus, { dot: string; text: string; bg: string; border: string }> = {
  Active:           { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  "Pending Approval":{ dot: "bg-amber-500",  text: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200"  },
  Expiring:         { dot: "bg-orange-500",  text: "text-orange-700", bg: "bg-orange-50",  border: "border-orange-200" },
  Closed:           { dot: "bg-slate-400",   text: "text-slate-500",  bg: "bg-slate-50",   border: "border-slate-200"  },
  Declined:         { dot: "bg-rose-500",    text: "text-rose-700",   bg: "bg-rose-50",    border: "border-rose-200"   },
};

const TS_CFG: Record<TSStatus, { text: string; bg: string }> = {
  Approved:          { text: "text-emerald-700", bg: "bg-emerald-50" },
  "Pending Approval":{ text: "text-amber-700",   bg: "bg-amber-50"  },
  Rejected:          { text: "text-rose-700",    bg: "bg-rose-50"   },
  Draft:             { text: "text-slate-500",   bg: "bg-slate-100" },
};

function fmt(n: number, cur = "CAD") {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
}

function pct(spent: number, committed: number) {
  if (!committed) return 0;
  return Math.min(100, Math.round((spent / committed) * 100));
}

const AUDIT_ICONS: Record<AuditEvent["type"], React.ReactNode> = {
  approve: <ThumbsUp size={14} className="text-emerald-500" />,
  submit:  <Send size={14} className="text-cyan-500" />,
  revise:  <RefreshCw size={14} className="text-amber-500" />,
  system:  <Activity size={14} className="text-slate-400" />,
  close:   <XCircle size={14} className="text-rose-400" />,
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-sm font-bold text-slate-900 ${mono ? "font-mono text-cyan-700" : ""}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
      {icon}
      {label}
    </h3>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────────────────────
function TabOverview({ wo }: { wo: WorkOrderDetail }) {
  const util = pct(wo.spendToDate, wo.committedSpend);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

      {/* Left col — details */}
      <div className="xl:col-span-2 space-y-6">

        {/* Worker & Engagement */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <SectionLabel icon={<User size={13} />} label="Worker & Engagement" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <InfoRow label="Worker" value={wo.workerName} />
            <InfoRow label="Email" value={wo.workerEmail} />
            <InfoRow label="Job Title" value={wo.jobTitle} />
            <InfoRow label="Hiring Manager" value={wo.hiringManager} />
            <InfoRow label="Supplier" value={wo.supplier} />
            <InfoRow label="Supplier Code" value={wo.supplierCode} mono />
          </div>
        </div>

        {/* Location & Structure */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <SectionLabel icon={<Building2 size={13} />} label="Location & Structure" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <InfoRow label="Site" value={wo.site} />
            <InfoRow label="Business Unit" value={wo.businessUnit} />
            <InfoRow label="Cost Centre" value={wo.costCenter} />
            <InfoRow label="Cost Centre Code" value={wo.costCenterCode} mono />
            <InfoRow label="Task Code" value={wo.taskCode} mono />
            <InfoRow label="Job Posting Ref" value={wo.jobPostingRef} mono />
          </div>
        </div>

        {/* Contract Terms */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <SectionLabel icon={<Calendar size={13} />} label="Contract Terms" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            <InfoRow label="Start Date" value={wo.startDate} />
            <InfoRow label="End Date" value={wo.endDate} />
            <InfoRow label="Revision" value={`Rev. ${wo.revision}`} />
            <InfoRow label="Hours / Day" value={`${wo.hoursPerDay} hrs`} />
            <InfoRow label="Hours / Week" value={`${wo.hoursPerWeek} hrs`} />
            <InfoRow label="Timesheet Freq." value={wo.timesheetFrequency} />
          </div>
        </div>
      </div>

      {/* Right col — spend + Nova */}
      <div className="space-y-6">

        {/* Spend Governance */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <SectionLabel icon={<DollarSign size={13} />} label="Spend Governance" />
          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-500 font-medium">Committed</span>
              <span className="text-sm font-black text-slate-900">{fmt(wo.committedSpend, wo.currency)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-500 font-medium">Spent to Date</span>
              <span className="text-sm font-black text-slate-900">{fmt(wo.spendToDate, wo.currency)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-500 font-medium">Est. Expenses</span>
              <span className="text-sm font-bold text-slate-700">{fmt(wo.estimatedExpenses, wo.currency)}</span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase mb-1.5">
                <span>Utilization</span>
                <span className={util >= 90 ? "text-rose-500" : util >= 70 ? "text-amber-500" : "text-emerald-600"}>{util}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${util >= 90 ? "bg-rose-400" : util >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${util}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Nova Flags */}
        <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-cyan-400/10 p-1.5 rounded-lg">
              <Sparkles size={14} className="text-cyan-400" />
            </div>
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Nova Insights</span>
          </div>
          <div className="space-y-3">
            {wo.novaFlags.map((flag, i) => (
              <div
                key={i}
                className={`flex gap-3 p-3 rounded-xl text-xs font-medium leading-relaxed border ${
                  flag.level === "warning"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-200"
                    : flag.level === "info"
                    ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-200"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
                }`}
              >
                <span className="shrink-0 mt-0.5">
                  {flag.level === "warning" ? <AlertTriangle size={13} /> : flag.level === "info" ? <Info size={13} /> : <CheckCircle2 size={13} />}
                </span>
                {flag.message}
              </div>
            ))}
          </div>
        </div>

        {/* Rate Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <SectionLabel icon={<CreditCard size={13} />} label="Rate Card" />
          <div className="space-y-2">
            {wo.rates.map((r) => (
              <div key={r.category} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{r.category} / {r.uom}</span>
                </div>
                <span className="text-sm font-black text-slate-900">{r.currency} ${r.billRate.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Timesheets
// ─────────────────────────────────────────────────────────────
function TabTimesheets({ wo }: { wo: WorkOrderDetail }) {
  if (wo.timesheets.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-24 text-slate-400">
        <ClipboardList size={32} className="mb-3 opacity-30" />
        <p className="font-bold text-sm">No timesheets submitted yet.</p>
        <p className="text-xs mt-1">Timesheets will appear here once the worker is activated.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Timesheet History</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{wo.timesheets.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">ID</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Period</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Hours</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Amount</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Status</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {wo.timesheets.map((ts) => {
              const cfg = TS_CFG[ts.status];
              return (
                <tr key={ts.id} className="group hover:bg-cyan-50/30 transition-all cursor-pointer">
                  <td className="px-8 py-4">
                    <span className="text-[10px] font-black text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                      {ts.id}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm font-semibold text-slate-800">{ts.period}</td>
                  <td className="px-8 py-4">
                    <span className="text-sm font-black text-slate-900">{ts.hours}</span>
                    <span className="text-xs text-slate-400 ml-1">hrs</span>
                  </td>
                  <td className="px-8 py-4 text-sm font-black text-slate-900">{fmt(ts.amount, wo.currency)}</td>
                  <td className="px-8 py-4">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${cfg.text} ${cfg.bg}`}>
                      {ts.status}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-xs text-slate-500 font-medium">{ts.submittedOn}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Activity Log
// ─────────────────────────────────────────────────────────────
function TabActivity({ wo }: { wo: WorkOrderDetail }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">Audit Trail</h3>
        <p className="text-xs text-slate-400 font-medium mt-0.5">All system and user actions on this work order.</p>
      </div>
      <div className="p-8">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-100" />

          <div className="space-y-6">
            {wo.auditLog.map((event) => (
              <div key={event.id} className="flex gap-5 items-start">
                {/* Icon bubble */}
                <div className="relative z-10 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                  {AUDIT_ICONS[event.type]}
                </div>
                {/* Content */}
                <div className="flex-1 pt-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-bold text-slate-900">{event.action}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{event.date}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{event.detail}</p>
                  <span className="text-[10px] text-slate-400 font-bold mt-1 block">By {event.actor}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
const TABS = ["Overview", "Timesheets", "Activity"] as const;
type Tab = (typeof TABS)[number];

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "WO-2024-00142";
  const wo = getWO(id);

  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const sc = STATUS_CFG[wo.status];
  const util = pct(wo.spendToDate, wo.committedSpend);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Hero Header ─────────────────────────────────────── */}
      <div className="bg-slate-950 text-white px-8 pt-8 pb-0">
        <div className="max-w-7xl mx-auto">

          {/* Back */}
          <button
            onClick={() => router.push("/cw/work-orders")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mb-6"
          >
            <ArrowLeft size={14} /> Work Orders
          </button>

          {/* Identity row */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div className="flex-1">
              {/* WO ID + Revision */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1 rounded-md uppercase tracking-tighter">
                  {wo.id}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Rev. {wo.revision}
                </span>
              </div>

              {/* Worker name */}
              <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
                {wo.workerName}
              </h1>
              <p className="text-slate-400 font-medium mt-1.5 text-sm">
                {wo.jobTitle} · {wo.supplier}
              </p>
            </div>

            {/* Status + Actions */}
            <div className="flex items-start gap-3 shrink-0">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm ${sc.bg} ${sc.text} ${sc.border}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {wo.status}
              </div>

              {/* Action buttons */}
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-all border border-white/10">
                <Pencil size={13} /> Revise
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider transition-all border border-rose-500/20">
                <XCircle size={13} /> Close
              </button>
            </div>
          </div>

          {/* Metric strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border-t border-white/5 rounded-t-xl overflow-hidden">
            {[
              { label: "Committed Spend", value: fmt(wo.committedSpend, wo.currency), icon: <DollarSign size={14} className="text-emerald-400" /> },
              { label: "Spend to Date",   value: fmt(wo.spendToDate, wo.currency),    icon: <TrendingUp size={14} className="text-amber-400" /> },
              { label: "Bill Rate",       value: `${wo.currency} $${wo.rates[0].billRate}/hr`, icon: <CreditCard size={14} className="text-cyan-400" /> },
              { label: "Utilization",     value: `${util}%`, icon: <Activity size={14} className={util >= 90 ? "text-rose-400" : util >= 70 ? "text-amber-400" : "text-emerald-400"} /> },
            ].map((m) => (
              <div key={m.label} className="bg-white/5 px-6 py-5 flex items-center gap-4">
                <div className="bg-white/5 p-2 rounded-lg">{m.icon}</div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.label}</p>
                  <p className="text-lg font-black text-white mt-0.5">{m.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-0 border-t border-white/5">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === tab
                    ? "text-cyan-400 border-cyan-400"
                    : "text-slate-500 border-transparent hover:text-slate-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {activeTab === "Overview"    && <TabOverview    wo={wo} />}
        {activeTab === "Timesheets"  && <TabTimesheets  wo={wo} />}
        {activeTab === "Activity"    && <TabActivity    wo={wo} />}
      </div>
    </div>
  );
}