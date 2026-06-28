"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  Calendar,
  AlertCircle,
  Clock,
  ExternalLink,
  Sparkles,
  ArrowLeft,
  Briefcase,
  FileText,
  ShieldCheck,
  Plus,
  MoreHorizontal,
  Activity,
  Paperclip,
  MessageSquare,
  GitBranch,
  X,
  Bell,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";

/* ─── TYPES ────────────────────────────────────────────── */
type MilestoneStatus = "Complete" | "In Progress" | "Upcoming";
type RiskLevel = "Low" | "Medium" | "High" | "Critical";
type RiskStatus = "Open" | "Mitigating" | "Monitoring" | "Closed";
type Tab = "overview" | "milestones" | "risks" | "documents" | "activity";

interface Risk {
  id: string;
  title: string;
  category: string;
  severity: RiskLevel;
  likelihood: RiskLevel;
  owner: string;
  status: RiskStatus;
  detail: string;
}

interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  time: string;
  type: string;
  icon: string;
}

/* ─── PILL ─────────────────────────────────────────────── */
const pillMap: Record<string, string> = {
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Approved: "bg-sky-50 text-sky-700 border-sky-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Active: "bg-cyan-50 text-cyan-700 border-cyan-200",
  Complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "In Progress": "bg-sky-50 text-sky-700 border-sky-200",
  Upcoming: "bg-slate-100 text-slate-500 border-slate-200",
  "Not Submitted": "bg-slate-100 text-slate-500 border-slate-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-rose-50 text-rose-700 border-rose-200",
  Critical: "bg-red-100 text-red-800 border-red-300",
};

const StatusPill = ({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) => (
  <span className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${pillMap[status] ?? "bg-slate-100 text-slate-500 border-slate-200"} ${size === "xs" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-0.5 text-[10px]"}`}>
    {status}
  </span>
);

/* ─── PROGRESS BAR ──────────────────────────────────────── */
function ProgressBar({ segments, height = 8 }: { segments: { pct: number; color: string }[]; height?: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-slate-100" style={{ height }}>
      {segments.map((s, i) => (
        <div key={i} className="h-full transition-all duration-700 ease-out"
          style={{ width: animated ? `${s.pct}%` : "0%", background: s.color, transitionDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

/* ─── STATIC DATA ───────────────────────────────────────── */
const SOW_DATA = {
  id: "SOW-2024-021",
  name: "Core banking platform modernization",
  supplier: "Accenture",
  owner: "James Park",
  ownerInitials: "JP",
  commercials: "Milestone Based",
  status: "Active" as const,
  description: "Modernize the core banking platform including system integration, data migration, testing, and go-live support for the NA region.",
  totalValue: 3_200_000,
  startDate: "Jan 10, 2024",
  endDate: "Dec 31, 2024",
  daysRemaining: 128,
  timePct: 68,
};

const INVOICES = [
  { label: "Phase 1: Discovery", amount: 450_000, status: "Paid" },
  { label: "Phase 2: Core Build", amount: 1_375_000, status: "Pending" },
  { label: "Phase 3: UAT", amount: 1_375_000, status: "Not Submitted" },
];

const MILESTONES = [
  {
    id: "m1", name: "Discovery & Planning", period: "Jan – Feb 2024", amount: 450_000,
    status: "Complete" as MilestoneStatus, risk: "Low" as RiskLevel,
    description: "Requirements definition, architecture planning, stakeholder alignment, and delivery roadmap.",
    expectedDate: "Feb 28, 2024", actualDate: "Feb 26, 2024",
    variance: "2 days early", variancePositive: true,
    invoiceStatus: "Paid", approvalStatus: "Verified", paymentDate: "Mar 5, 2024",
  },
  {
    id: "m2", name: "Core Build & Integration", period: "Mar – Jul 2024", amount: 1_375_000,
    status: "In Progress" as MilestoneStatus, risk: "Medium" as RiskLevel,
    description: "Core platform build, legacy system integrations, data migration pipelines, and API gateway setup.",
    expectedDate: "Jul 31, 2024", actualDate: "—",
    variance: "~2–3 wk at risk", variancePositive: false,
    invoiceStatus: "Pending", approvalStatus: "Pending Verification", paymentDate: "—",
    novaAlert: "Jira velocity 23% below baseline. Integration dependencies unresolved.",
  },
  {
    id: "m3", name: "Testing & Stabilization", period: "Aug – Oct 2024", amount: 1_375_000,
    status: "Upcoming" as MilestoneStatus, risk: "Low" as RiskLevel,
    description: "UAT, defect remediation, performance stabilization, and go-live readiness sign-off.",
    expectedDate: "Oct 15, 2024", actualDate: "—",
    variance: "—", variancePositive: true,
    invoiceStatus: "Not Submitted", approvalStatus: "Not Started", paymentDate: "—",
  },
];

const INITIAL_RISKS: Risk[] = [
  { id: "r1", title: "Integration delay – Phase 2", category: "Delivery", severity: "High", likelihood: "High", owner: "James Park", status: "Open", detail: "Jira velocity 23% below plan; 3 dependencies unresolved." },
  { id: "r2", title: "Resource gap – Phase 3 not staffed", category: "Resource", severity: "Medium", likelihood: "Medium", owner: "Sarah Chen", status: "Mitigating", detail: "Accenture confirmation due Aug 31." },
  { id: "r3", title: "Data migration complexity", category: "Technical", severity: "Medium", likelihood: "Low", owner: "Dev Kapoor", status: "Monitoring", detail: "Legacy schema mapping incomplete for 2 tables." },
];

const DOCUMENTS = [
  { id: "d1", name: "SOW-2024-021 Executed Contract", type: "PDF", size: "2.4 MB", uploaded: "Jan 10, 2024", uploader: "James Park", icon: "📄" },
  { id: "d2", name: "Phase 1 Delivery Sign-Off", type: "PDF", size: "840 KB", uploaded: "Mar 1, 2024", uploader: "Sarah Chen", icon: "✅" },
  { id: "d3", name: "Change Order #1 – Scope Addendum", type: "DOCX", size: "310 KB", uploaded: "Apr 18, 2024", uploader: "James Park", icon: "📝" },
  { id: "d4", name: "Integration Architecture Diagram", type: "PNG", size: "1.1 MB", uploaded: "May 2, 2024", uploader: "Dev Kapoor", icon: "🗺" },
  { id: "d5", name: "Phase 2 Invoice – Accenture", type: "PDF", size: "190 KB", uploaded: "Aug 1, 2024", uploader: "AP System", icon: "💰" },
];

const ACTIVITY_SEED: ActivityItem[] = [
  { id: "a1", actor: "Nova AI", action: "flagged a delivery risk on Phase 2 integration dependencies.", time: "2 hours ago", type: "ai", icon: "✦" },
  { id: "a2", actor: "James Park", action: "uploaded Phase 2 Invoice for approval.", time: "Aug 1, 2024", type: "document", icon: "📎" },
  { id: "a3", actor: "Sarah Chen", action: "added Risk R2: Resource gap for Phase 3.", time: "Jul 30, 2024", type: "risk", icon: "⚠" },
  { id: "a4", actor: "AP System", action: "marked Phase 1 invoice as Paid ($450,000).", time: "Mar 5, 2024", type: "financial", icon: "$" },
  { id: "a5", actor: "James Park", action: "uploaded Phase 1 Delivery Sign-Off document.", time: "Mar 1, 2024", type: "document", icon: "📎" },
  { id: "a6", actor: "System", action: "SOW-2024-021 activated and engagement started.", time: "Jan 10, 2024", type: "system", icon: "◉" },
];

const NOVA_INSIGHTS = [
  { type: "warn", text: "Jira sprint velocity is 23% below baseline for Phase 2.", meta: "Detected via Jira integration · Updated 2h ago" },
  { type: "error", text: "3 integration dependencies remain unresolved past their due date.", meta: "Cross-referenced with Confluence · High confidence" },
  { type: "ok", text: "Budget burn rate is on plan at 14.1% ($450K of $3.2M).", meta: "Verified against AP system · Low risk" },
  { type: "warn", text: "Phase 3 resource allocation not yet confirmed by supplier.", meta: "Expected by Aug 31 — 6 days away" },
];

const RISK_CATEGORIES = ["Delivery", "Resource", "Technical", "Financial", "Compliance", "Security", "Vendor", "Other"];
const RISK_LEVELS: RiskLevel[] = ["Low", "Medium", "High", "Critical"];
const RISK_STATUSES: RiskStatus[] = ["Open", "Mitigating", "Monitoring", "Closed"];

/* ─── ADD RISK MODAL ────────────────────────────────────── */
const EMPTY_FORM = {
  title: "", category: "Delivery", severity: "Medium" as RiskLevel,
  likelihood: "Medium" as RiskLevel, owner: "", status: "Open" as RiskStatus, detail: "",
};

function AddRiskModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (r: Risk) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setErrors({}); setTimeout(() => titleRef.current?.focus(), 80); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Risk title is required.";
    if (!form.owner.trim()) e.owner = "Owner is required.";
    if (!form.detail.trim()) e.detail = "Detail is required.";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    setTimeout(() => {
      onSubmit({ id: `r${Date.now()}`, title: form.title.trim(), category: form.category, severity: form.severity, likelihood: form.likelihood, owner: form.owner.trim(), status: form.status, detail: form.detail.trim() });
      setSubmitting(false);
      onClose();
    }, 300);
  }

  const inputBase = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 placeholder:text-slate-300";
  const selectBase = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 appearance-none cursor-pointer";
  const labelBase = "block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5";

  const levelColors = (level: RiskLevel, active: boolean): string => {
    const map: Record<RiskLevel, { on: string; off: string }> = {
      Low: { on: "bg-emerald-50 border-emerald-400 text-emerald-700", off: "border-slate-200 text-slate-500 hover:border-emerald-200" },
      Medium: { on: "bg-amber-50 border-amber-400 text-amber-700", off: "border-slate-200 text-slate-500 hover:border-amber-200" },
      High: { on: "bg-rose-50 border-rose-400 text-rose-700", off: "border-slate-200 text-slate-500 hover:border-rose-200" },
      Critical: { on: "bg-red-100 border-red-400 text-red-800", off: "border-slate-200 text-slate-500 hover:border-red-200" },
    };
    return map[level][active ? "on" : "off"];
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl md:rounded-l-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Risk Register</p>
            <h2 className="mt-0.5 text-lg font-black text-slate-900">Add New Risk</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-5 px-6 py-6">

            {/* Title */}
            <div>
              <label className={labelBase}>Risk Title *</label>
              <input ref={titleRef}
                className={`${inputBase} ${errors.title ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : ""}`}
                placeholder="e.g. Integration delay – Phase 2"
                value={form.title}
                onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setErrors((err) => ({ ...err, title: "" })); }}
              />
              {errors.title && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.title}</p>}
            </div>

            {/* Category + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>Category</label>
                <div className="relative">
                  <select className={selectBase} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {RISK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div>
                <label className={labelBase}>Status</label>
                <div className="relative">
                  <select className={selectBase} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RiskStatus }))}>
                    {RISK_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Severity */}
            <div>
              <label className={labelBase}>Severity</label>
              <div className="grid grid-cols-4 gap-2">
                {RISK_LEVELS.map((level) => (
                  <button key={level} type="button"
                    onClick={() => setForm((f) => ({ ...f, severity: level }))}
                    className={`rounded-xl border px-2 py-2 text-[11px] font-bold transition-all ${levelColors(level, form.severity === level)}`}>
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Likelihood */}
            <div>
              <label className={labelBase}>Likelihood</label>
              <div className="grid grid-cols-4 gap-2">
                {RISK_LEVELS.map((level) => (
                  <button key={level} type="button"
                    onClick={() => setForm((f) => ({ ...f, likelihood: level }))}
                    className={`rounded-xl border px-2 py-2 text-[11px] font-bold transition-all ${levelColors(level, form.likelihood === level)}`}>
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Owner */}
            <div>
              <label className={labelBase}>Owner *</label>
              <input
                className={`${inputBase} ${errors.owner ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : ""}`}
                placeholder="e.g. James Park"
                value={form.owner}
                onChange={(e) => { setForm((f) => ({ ...f, owner: e.target.value })); setErrors((err) => ({ ...err, owner: "" })); }}
              />
              {errors.owner && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.owner}</p>}
            </div>

            {/* Detail */}
            <div>
              <label className={labelBase}>Risk Detail *</label>
              <textarea
                className={`${inputBase} min-h-[90px] resize-none leading-relaxed ${errors.detail ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : ""}`}
                placeholder="Describe the risk, root cause, and any known context…"
                value={form.detail}
                onChange={(e) => { setForm((f) => ({ ...f, detail: e.target.value })); setErrors((err) => ({ ...err, detail: "" })); }}
              />
              {errors.detail && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.detail}</p>}
            </div>

            {/* Live Preview */}
            {form.title && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Preview</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{form.title}</span>
                  <StatusPill status={form.severity} size="xs" />
                  <StatusPill status={form.likelihood} size="xs" />
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${form.status === "Open" ? "bg-rose-50 text-rose-700" : form.status === "Mitigating" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {form.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-black disabled:opacity-60">
              {submitting
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <Plus size={14} />}
              {submitting ? "Saving…" : "Add to Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── STAT CARD ─────────────────────────────────────────── */
function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: "warn" | "danger" | "ok" }) {
  const accentColor = accent === "warn" ? "text-amber-600" : accent === "danger" ? "text-rose-600" : accent === "ok" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${accentColor}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] font-medium text-slate-400">{sub}</p>}
    </div>
  );
}

/* ─── OVERVIEW TAB ──────────────────────────────────────── */
function OverviewTab({ openRiskCount }: { openRiskCount: number }) {
  const [novaOpen, setNovaOpen] = useState(false);
  const paidPct = 14.1;
  const pendingPct = (1_375_000 / 3_200_000) * 100;
  const insightDot: Record<string, string> = { warn: "bg-amber-400", error: "bg-rose-500", ok: "bg-emerald-400" };

  return (
    <div className="space-y-5">
      {/* Nova Banner */}
      <div className="rounded-3xl border-2 border-cyan-200 bg-white p-6 shadow-sm shadow-cyan-100">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 shadow-lg shadow-cyan-200">
            <Sparkles size={18} className="text-cyan-400" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black uppercase tracking-widest text-cyan-600">Nova Insights</span>
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-700">Predictive Analysis</span>
            </div>
            <p className="mt-1 font-bold text-slate-900">Delivery slippage detected in Phase 2: Core Build.</p>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              Execution signals indicate a <span className="font-bold text-rose-600">2–3 week delay risk</span> driven by integration complexity. A proactive warning has been synced with Accenture stakeholders.
            </p>
            {novaOpen && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                {NOVA_INSIGHTS.map((ins, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${insightDot[ins.type] ?? "bg-slate-300"}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{ins.text}</p>
                      <p className="text-[11px] text-slate-400">{ins.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setNovaOpen((o) => !o)} className="mt-3 flex items-center gap-1 text-xs font-bold text-cyan-600 hover:text-cyan-800">
              {novaOpen ? <><span>Hide insights</span><ChevronDown size={13} /></> : <><span>Show all insights</span><ChevronRight size={13} /></>}
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Contract Value" value="$3,200,000" sub="Milestone-based" />
        <StatCard label="Budget Consumed" value="$450K" sub="14.1% of TCV" accent="ok" />
        <StatCard label="Days Remaining" value={SOW_DATA.daysRemaining} sub="Target: Dec 31, 2024" />
        <StatCard label="Open Risks" value={openRiskCount} sub="in risk register" accent={openRiskCount >= 3 ? "warn" : openRiskCount === 0 ? "ok" : undefined} />
      </div>

      {/* Financial + Timeline */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign size={14} className="text-slate-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financial Exposure</h3>
          </div>
          <div className="mb-1 flex justify-between text-[11px] font-bold">
            <span className="text-slate-600">Paid: {paidPct.toFixed(1)}% ($450K)</span>
            <span className="text-amber-600">Pending: {pendingPct.toFixed(0)}% ($1.38M)</span>
          </div>
          <ProgressBar segments={[{ pct: paidPct, color: "#0f172a" }, { pct: pendingPct, color: "#fbbf24" }]} height={10} />
          <div className="mt-2 flex gap-4">
            {[{ color: "#0f172a", label: "Paid" }, { color: "#fbbf24", label: "Pending" }, { color: "#e2e8f0", label: "Uncommitted" }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                <div className="h-2 w-2 rounded-full" style={{ background: l.color }} />{l.label}
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t border-slate-50 pt-4">
            {INVOICES.map((inv) => (
              <div key={inv.label} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-bold text-slate-700">{inv.label}</p>
                  <p className="text-[11px] text-slate-400">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(inv.amount)}</p>
                </div>
                <StatusPill status={inv.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Timeline Analytics</h3>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-4">
            {[{ label: "Start Date", value: SOW_DATA.startDate }, { label: "End Date", value: SOW_DATA.endDate }, { label: "Days Elapsed", value: "229 of 357" }, { label: "Today", value: "Aug 25, 2024" }].map((item) => (
              <div key={item.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                <p className="text-sm font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-400">
            <span>Start</span><span className="text-slate-700">{SOW_DATA.timePct}% Elapsed</span><span>End</span>
          </div>
          <div className="relative">
            <ProgressBar segments={[{ pct: SOW_DATA.timePct, color: "#10b981" }]} height={10} />
            <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-rose-500" style={{ left: `${SOW_DATA.timePct}%` }} />
          </div>
          <p className="mt-1 text-[10px] font-bold text-rose-500">● Today</p>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-50 pt-4">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time Consumed</p>
              <p className="mt-0.5 text-xl font-black text-slate-900">68%</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Budget Remaining</p>
              <p className="mt-0.5 text-xl font-black text-emerald-600">$2.75M</p>
              <p className="text-[10px] text-slate-400">86% unspent</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scope */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Briefcase size={14} className="text-slate-400" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scope Description</h3>
        </div>
        <p className="text-sm font-medium leading-relaxed text-slate-600">{SOW_DATA.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["System Integration", "Data Migration", "UAT", "Go-live Support", "NA Region"].map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── MILESTONES TAB ────────────────────────────────────── */
function MilestonesTab() {
  const [openId, setOpenId] = useState<string | null>("m2");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Engagement Milestones</p>
        <span className="text-xs font-bold text-slate-400">$3,200,000 total</span>
      </div>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {MILESTONES.map((m, idx) => {
          const isOpen = openId === m.id;
          return (
            <div key={m.id} className={`${idx < MILESTONES.length - 1 ? "border-b border-slate-100" : ""} ${isOpen ? "bg-cyan-50/30" : ""}`}>
              <button onClick={() => setOpenId(isOpen ? null : m.id)} className="flex w-full items-center justify-between gap-4 px-7 py-5 text-left transition-colors hover:bg-slate-50/70">
                <div className="flex items-center gap-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all ${isOpen ? "border-cyan-200 bg-white shadow-sm" : "border-slate-100 bg-slate-50"}`}>
                    {isOpen ? <ChevronDown size={15} className="text-cyan-600" /> : <ChevronRight size={15} className="text-slate-400" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{m.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.period}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(m.amount)}</p>
                    <p className="text-[9px] font-bold uppercase text-slate-400">Milestone Value</p>
                  </div>
                  <StatusPill status={m.status} />
                  <StatusPill status={m.invoiceStatus} />
                  <StatusPill status={m.risk} size="xs" />
                </div>
              </button>
              {isOpen && (
                <div className="grid grid-cols-1 gap-8 px-20 pb-8 pt-2 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Deliverables</p>
                      <p className="text-sm font-medium leading-relaxed text-slate-600">{m.description}</p>
                    </div>
                    {m.novaAlert && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                        <p className="text-xs font-medium text-amber-800">{m.novaAlert}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      {[{ label: "Expected", value: m.expectedDate }, { label: "Actual", value: m.actualDate }, { label: "Variance", value: m.variance, highlight: !m.variancePositive }].map((chip) => (
                        <div key={chip.label} className={`rounded-xl border px-4 py-2 shadow-sm ${chip.highlight ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-white"}`}>
                          <p className="text-[9px] font-bold uppercase text-slate-400">{chip.label}</p>
                          <p className={`text-xs font-bold ${chip.highlight ? "text-amber-700" : "text-slate-800"}`}>{chip.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="mb-3 flex items-center gap-1.5 border-b border-slate-50 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <DollarSign size={12} /> Financial Reconciliation
                    </p>
                    {[
                      { label: "Invoice Status", value: m.invoiceStatus, pill: true },
                      { label: "Internal Approval", value: m.approvalStatus },
                      { label: "Payment Date", value: m.paymentDate },
                      { label: "Amount", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(m.amount) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between border-b border-slate-50 py-2 last:border-none">
                        <span className="text-xs font-medium text-slate-500">{row.label}</span>
                        {row.pill ? <StatusPill status={row.value} size="xs" /> : <span className="text-xs font-bold text-slate-800">{row.value}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── RISKS TAB ─────────────────────────────────────────── */
function RisksTab({ risks, onAddRisk, onUpdateStatus }: { risks: Risk[]; onAddRisk: () => void; onUpdateStatus: (id: string, status: RiskStatus) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const severityWidth: Record<RiskLevel, string> = { Low: "25%", Medium: "55%", High: "80%", Critical: "100%" };
  const severityColor: Record<RiskLevel, string> = { Low: "#10b981", Medium: "#f59e0b", High: "#f43f5e", Critical: "#dc2626" };
  const openCount = risks.filter((r) => r.status === "Open" || r.status === "Mitigating").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Risk Register</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-500">{risks.length} total · {openCount} active</span>
        </div>
        <button onClick={onAddRisk} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700">
          <Plus size={13} /> Add Risk
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>Risk</span><span>Severity</span><span>Likelihood</span><span>Owner</span><span>Status</span>
        </div>

        {risks.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <ShieldCheck size={22} className="text-slate-400" />
            </div>
            <p className="font-bold text-slate-700">No risks logged yet</p>
            <p className="mt-1 text-sm text-slate-400">Click "Add Risk" to log the first risk for this engagement.</p>
            <button onClick={onAddRisk} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-black">
              <Plus size={14} /> Add Risk
            </button>
          </div>
        )}

        {risks.map((r, idx) => (
          <div key={r.id} className={`${idx < risks.length - 1 ? "border-b border-slate-100" : ""}`}>
            <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-4 px-6 py-4 text-left hover:bg-slate-50">
              <div>
                <p className="text-sm font-bold text-slate-900">{r.title}</p>
                <p className="text-[10px] font-medium text-slate-400">{r.category}</p>
              </div>
              <div className="flex flex-col gap-1">
                <StatusPill status={r.severity} size="xs" />
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all" style={{ width: severityWidth[r.severity], background: severityColor[r.severity] }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <StatusPill status={r.likelihood} size="xs" />
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: severityWidth[r.likelihood], background: severityColor[r.likelihood] }} />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-700">{r.owner}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${r.status === "Open" ? "bg-rose-50 text-rose-700" : r.status === "Mitigating" ? "bg-amber-50 text-amber-700" : r.status === "Monitoring" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"}`}>
                {r.status}
              </span>
            </button>
            {expandedId === r.id && (
              <div className="mx-6 mb-4 rounded-2xl bg-slate-50 px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Risk Detail</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{r.detail}</p>
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {RISK_STATUSES.map((s) => (
                      <button key={s} onClick={() => onUpdateStatus(r.id, s)}
                        className={`rounded-lg border px-3 py-1 text-xs font-bold transition-all ${r.status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DOCUMENTS TAB ─────────────────────────────────────── */
function DocumentsTab() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documents</p>
        <button className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50">
          <Plus size={13} /> Upload
        </button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {DOCUMENTS.map((doc, idx) => (
          <div key={doc.id} className={`flex items-center justify-between px-6 py-4 hover:bg-slate-50 ${idx < DOCUMENTS.length - 1 ? "border-b border-slate-100" : ""}`}>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">{doc.icon}</div>
              <div>
                <p className="text-sm font-bold text-slate-900">{doc.name}</p>
                <p className="text-[10px] font-medium text-slate-400">{doc.type} · {doc.size} · Uploaded {doc.uploaded} by {doc.uploader}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><ExternalLink size={13} /></button>
              <button className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><MoreHorizontal size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ACTIVITY TAB ──────────────────────────────────────── */
function ActivityTab({ activity }: { activity: ActivityItem[] }) {
  const actorColors: Record<string, string> = {
    ai: "bg-cyan-100 text-cyan-700", document: "bg-sky-100 text-sky-700",
    risk: "bg-amber-100 text-amber-700", financial: "bg-emerald-100 text-emerald-700",
    system: "bg-slate-100 text-slate-500",
  };
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activity Feed</p>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {activity.map((item, idx) => (
          <div key={item.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${actorColors[item.type] ?? "bg-slate-100 text-slate-500"}`}>{item.icon}</div>
              {idx < activity.length - 1 && <div className="my-1 w-px flex-1 bg-slate-100" />}
            </div>
            <div className="pb-6">
              <p className="text-sm text-slate-700"><span className="font-bold text-slate-900">{item.actor}</span> {item.action}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ─────────────────────────────────────────── */
export default function SOWDetailPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showActions, setShowActions] = useState(false);
  const [showAddRisk, setShowAddRisk] = useState(false);
  const [risks, setRisks] = useState<Risk[]>(INITIAL_RISKS);
  const [activity, setActivity] = useState<ActivityItem[]>(ACTIVITY_SEED);
  const actionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) setShowActions(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleAddRisk(newRisk: Risk) {
    setRisks((prev) => [newRisk, ...prev]);
    setActivity((prev) => [{
      id: `a-${Date.now()}`,
      actor: "You",
      action: `added a new ${newRisk.severity.toLowerCase()} risk: "${newRisk.title}".`,
      time: "Just now",
      type: "risk",
      icon: "⚠",
    }, ...prev]);
    setActiveTab("risks");
  }

  function handleUpdateStatus(id: string, status: RiskStatus) {
    const risk = risks.find((r) => r.id === id);
    setRisks((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    if (risk) {
      setActivity((prev) => [{
        id: `a-${Date.now()}`,
        actor: "You",
        action: `updated risk "${risk.title}" to ${status}.`,
        time: "Just now",
        type: "risk",
        icon: "⚠",
      }, ...prev]);
    }
  }

  const openRiskCount = risks.filter((r) => r.status === "Open" || r.status === "Mitigating").length;

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "overview", label: "Overview", icon: <Activity size={13} /> },
    { key: "milestones", label: "Milestones", icon: <Clock size={13} /> },
    { key: "risks", label: "Risks", icon: <ShieldCheck size={13} />, badge: openRiskCount },
    { key: "documents", label: "Documents", icon: <Paperclip size={13} /> },
    { key: "activity", label: "Activity", icon: <MessageSquare size={13} /> },
  ];

  const actions = [
    { label: "Initiate Change Order", icon: <GitBranch size={15} />, handler: () => {} },
    { label: "Request Extension", icon: <Clock size={15} />, handler: () => {} },
    { label: "Request Pause", icon: <AlertCircle size={15} />, handler: () => {} },
    { label: "View Audit Log", icon: <FileText size={15} />, handler: () => {} },
  ];

  return (
    <>
      <main className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900 md:p-10">
        <div className="mx-auto max-w-6xl space-y-6">

          {/* HEADER */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <button onClick={() => router.push("/services/sow")} className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:border-cyan-200 hover:bg-cyan-50">
                <ArrowLeft size={16} className="text-slate-400" />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{SOW_DATA.id}</p>
                  <StatusPill status={SOW_DATA.status} />
                </div>
                <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{SOW_DATA.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-400">
                  <span className="flex cursor-pointer items-center gap-1 text-cyan-600 hover:underline">{SOW_DATA.supplier} <ExternalLink size={11} /></span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[8px] font-black text-slate-600">{SOW_DATA.ownerInitials}</div>
                    {SOW_DATA.owner}
                  </span>
                  <span>·</span>
                  <span>{SOW_DATA.commercials}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2" ref={actionRef}>
              <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50"><Bell size={15} className="text-slate-400" /></button>
              <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50"><Search size={15} className="text-slate-400" /></button>
              <button onClick={() => setShowActions((s) => !s)} className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-black">
                Engagement Actions <ChevronDown size={15} className="text-cyan-400" />
              </button>
              {showActions && (
                <div className="absolute right-6 top-24 z-50 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl md:right-10">
                  {actions.map((a) => (
                    <button key={a.label} onClick={() => { a.handler(); setShowActions(false); }}
                      className="mx-1 flex w-[calc(100%-8px)] items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-cyan-50 hover:text-cyan-700">
                      <span className="text-slate-400">{a.icon}</span>{a.label}
                    </button>
                  ))}
                  <div className="mx-3 my-1 h-px bg-slate-100" />
                  <button onClick={() => setShowActions(false)} className="mx-1 flex w-[calc(100%-8px)] items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50">
                    <AlertCircle size={15} /> Terminate Engagement
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === t.key ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
                {t.icon}{t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black ${activeTab === t.key ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"}`}>{t.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          {activeTab === "overview" && <OverviewTab openRiskCount={openRiskCount} />}
          {activeTab === "milestones" && <MilestonesTab />}
          {activeTab === "risks" && <RisksTab risks={risks} onAddRisk={() => setShowAddRisk(true)} onUpdateStatus={handleUpdateStatus} />}
          {activeTab === "documents" && <DocumentsTab />}
          {activeTab === "activity" && <ActivityTab activity={activity} />}
        </div>
      </main>

      <AddRiskModal open={showAddRisk} onClose={() => setShowAddRisk(false)} onSubmit={handleAddRisk} />
    </>
  );
}