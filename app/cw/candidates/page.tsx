"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CalendarDays, Check, ChevronDown,
  ChevronRight, CircleDashed, FileCheck2, Mail, MapPin, Phone,
  Search, ShieldCheck, Sparkles, UserRound, UsersRound, X,
} from "lucide-react";

type StepStatus = "Complete" | "In progress" | "Blocked" | "Not started";
type OnboardingStatus = "Not started" | "In progress" | "Blocked" | "Complete";
type Lifecycle = "Submitted" | "Interview" | "Offer" | "Pre-boarding" | "Ready to start";
type OnboardingStep = { label: string; owner: string; status: StepStatus; dueDate: string };
type CandidateRecord = {
  id: string; name: string; initials: string; role: string; jobId: string;
  supplier: string; location: string; rate: string; availability: string;
  lifecycle: Lifecycle; daysInStage: number; manager: string; onboarding: number;
  onboardingStatus: OnboardingStatus; startDate: string; email: string; phone: string;
  skills: string[]; summary: string; nextAction: string; onboardingSteps: OnboardingStep[];
};

const candidates: CandidateRecord[] = [
  {
    id: "CAN-1048", name: "James Carter", initials: "JC", role: "Senior Backend Engineer",
    jobId: "JP-2024-041", supplier: "TEKsystems", location: "Remote – US", rate: "$108/hr",
    availability: "2 weeks", lifecycle: "Interview", daysInStage: 6, manager: "Alex Morgan",
    onboarding: 0, onboardingStatus: "Not started", startDate: "TBD",
    email: "j.carter@example.com", phone: "+1 (312) 555-0148", skills: ["Golang", "Kubernetes", "AWS"],
    summary: "10+ years of experience in distributed systems with a strong technical screen result.",
    nextAction: "Complete final architecture interview",
    onboardingSteps: [
      { label: "Personal information", owner: "Candidate", status: "Not started", dueDate: "After offer" },
      { label: "Right-to-work verification", owner: "People Ops", status: "Not started", dueDate: "After offer" },
      { label: "Contract and policies", owner: "Candidate", status: "Not started", dueDate: "After offer" },
      { label: "System access", owner: "IT", status: "Not started", dueDate: "Before start" },
    ],
  },
  {
    id: "CAN-1041", name: "Priya Shah", initials: "PS", role: "Business Analyst",
    jobId: "JP-2024-036", supplier: "Randstad", location: "Chicago, IL", rate: "$88/hr",
    availability: "Immediate", lifecycle: "Pre-boarding", daysInStage: 3, manager: "Rachel Adams",
    onboarding: 68, onboardingStatus: "In progress", startDate: "Oct 12, 2026",
    email: "p.shah@example.com", phone: "+1 (773) 555-0192", skills: ["SQL", "Agile", "Tableau"],
    summary: "Retail banking transformation specialist with consistently strong supplier feedback.",
    nextAction: "Candidate to sign confidentiality agreement",
    onboardingSteps: [
      { label: "Personal information", owner: "Candidate", status: "Complete", dueDate: "Sep 24" },
      { label: "Right-to-work verification", owner: "People Ops", status: "Complete", dueDate: "Sep 25" },
      { label: "Contract and policies", owner: "Candidate", status: "In progress", dueDate: "Sep 29" },
      { label: "System access", owner: "IT", status: "Not started", dueDate: "Oct 8" },
    ],
  },
  {
    id: "CAN-1035", name: "Daniel Wong", initials: "DW", role: "QA Automation Engineer",
    jobId: "JP-2024-028", supplier: "Insight Global", location: "New York, NY", rate: "$80/hr",
    availability: "1 week", lifecycle: "Ready to start", daysInStage: 2, manager: "Daniel Lee",
    onboarding: 100, onboardingStatus: "Complete", startDate: "Oct 1, 2026",
    email: "d.wong@example.com", phone: "+1 (646) 555-0131", skills: ["Selenium", "Python", "Jenkins"],
    summary: "Completed all interview rounds and pre-employment requirements ahead of schedule.",
    nextAction: "Ready for day-one welcome",
    onboardingSteps: [
      { label: "Personal information", owner: "Candidate", status: "Complete", dueDate: "Sep 18" },
      { label: "Right-to-work verification", owner: "People Ops", status: "Complete", dueDate: "Sep 19" },
      { label: "Contract and policies", owner: "Candidate", status: "Complete", dueDate: "Sep 21" },
      { label: "System access", owner: "IT", status: "Complete", dueDate: "Sep 25" },
    ],
  },
  {
    id: "CAN-1029", name: "Elena Rossi", initials: "ER", role: "UX Designer",
    jobId: "JP-2024-012", supplier: "Aquent", location: "Remote – Canada", rate: "$95/hr",
    availability: "Immediate", lifecycle: "Pre-boarding", daysInStage: 9, manager: "Sarah Jenkins",
    onboarding: 45, onboardingStatus: "Blocked", startDate: "Oct 5, 2026",
    email: "e.rossi@example.com", phone: "+1 (416) 555-0187", skills: ["Figma", "User Research", "Prototyping"],
    summary: "Senior product designer with deep research and design-system experience.",
    nextAction: "People Ops to review identity document",
    onboardingSteps: [
      { label: "Personal information", owner: "Candidate", status: "Complete", dueDate: "Sep 20" },
      { label: "Right-to-work verification", owner: "People Ops", status: "Blocked", dueDate: "Sep 26" },
      { label: "Contract and policies", owner: "Candidate", status: "In progress", dueDate: "Sep 29" },
      { label: "System access", owner: "IT", status: "Not started", dueDate: "Oct 2" },
    ],
  },
];

const lifecycleStages: Lifecycle[] = ["Submitted", "Interview", "Offer", "Pre-boarding", "Ready to start"];

function statusTone(status: OnboardingStatus | StepStatus) {
  if (status === "Complete") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Blocked") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "In progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function CandidatesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState<CandidateRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "onboarding">("profile");
  const [aiInput, setAiInput] = useState("");

  const filteredCandidates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return candidates.filter((candidate) => {
      const searchMatch = !query || [candidate.name, candidate.role, candidate.jobId, candidate.supplier]
        .some((value) => value.toLowerCase().includes(query));
      return searchMatch && (selectedStage === "All" || candidate.lifecycle === selectedStage);
    });
  }, [searchTerm, selectedStage]);

  useEffect(() => {
    if (!selectedRecord) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setSelectedRecord(null);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedRecord]);

  const openRecord = (candidate: CandidateRecord) => {
    setSelectedRecord(candidate);
    setActiveTab("profile");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-5 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Contingent workforce</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Candidate lifecycle</h1>
            <p className="mt-1 text-base font-medium text-slate-500">Track every candidate from submission through day-one readiness.</p>
          </div>
          <div className="relative flex w-full items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100/70 md:w-96">
            <div className="ml-1 rounded-xl bg-slate-950 p-2.5 text-cyan-400"><Sparkles size={18} /></div>
            <input value={aiInput} onChange={(event) => setAiInput(event.target.value)} placeholder="Ask Nova about onboarding risk..." aria-label="Ask Nova about candidates" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm font-semibold outline-none placeholder:text-slate-400" />
            <button type="button" className="pr-3 text-xs font-bold uppercase text-blue-600">Ask</button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Metric icon={UsersRound} label="Candidates" value={candidates.length} detail="Across 4 active roles" />
          <Metric icon={CircleDashed} label="Onboarding" value={candidates.filter((c) => c.onboarding > 0 && c.onboarding < 100).length} detail="Currently in progress" tone="blue" />
          <Metric icon={AlertCircle} label="Needs attention" value={candidates.filter((c) => c.onboardingStatus === "Blocked").length} detail="Blocked requirement" tone="rose" />
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end">
          <label className="block flex-1">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Lifecycle stage</span>
            <span className="relative block">
              <select value={selectedStage} onChange={(event) => setSelectedStage(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-10 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                <option value="All">All stages</option>
                {lifecycleStages.map((stage) => <option key={stage}>{stage}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </span>
          </label>
          <label className="block flex-[2]">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Search candidates</span>
            <span className="relative block">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Name, role, supplier, or job ID" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
            </span>
          </label>
          <button type="button" onClick={() => { setSearchTerm(""); setSelectedStage("All"); }} className="flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900"><X size={16} /> Reset</button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50/80"><tr>
                {['Candidate', 'Assignment', 'Lifecycle', 'Onboarding', 'Next action'].map((label) => <th key={label} className="px-5 py-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</th>)}
                <th className="w-12 px-5 py-4"><span className="sr-only">Open record</span></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCandidates.map((candidate) => (
                  <tr key={candidate.id} tabIndex={0} onClick={() => openRecord(candidate)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && openRecord(candidate)} className="group cursor-pointer outline-none transition-colors hover:bg-blue-50/50 focus:bg-blue-50/70">
                    <td className="px-5 py-5"><div className="flex items-center gap-3"><Avatar candidate={candidate} /><div><p className="font-bold">{candidate.name}</p><p className="mt-0.5 text-xs font-semibold text-slate-500">{candidate.id} · {candidate.supplier}</p></div></div></td>
                    <td className="px-5 py-5"><p className="text-sm font-bold text-slate-800">{candidate.role}</p><p className="mt-1 text-xs font-semibold text-blue-600">{candidate.jobId} · {candidate.manager}</p></td>
                    <td className="px-5 py-5">
                      <div className="mb-2 flex items-center gap-2"><span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{candidate.lifecycle}</span><span className="text-xs text-slate-400">{candidate.daysInStage}d</span></div>
                      <div className="flex w-40 gap-1" aria-label={`${candidate.lifecycle} lifecycle progress`}>{lifecycleStages.map((stage, index) => <span key={stage} className={`h-1.5 flex-1 rounded-full ${index <= lifecycleStages.indexOf(candidate.lifecycle) ? "bg-blue-500" : "bg-slate-200"}`} />)}</div>
                    </td>
                    <td className="px-5 py-5">
                      <div className="mb-2 flex items-center justify-between gap-3"><StatusBadge status={candidate.onboardingStatus} /><span className="text-sm font-extrabold">{candidate.onboarding}%</span></div>
                      <Progress candidate={candidate} className="w-44" />
                    </td>
                    <td className="max-w-[220px] px-5 py-5"><p className="text-sm font-semibold leading-5 text-slate-700">{candidate.nextAction}</p><p className="mt-1 text-xs text-slate-400">Start: {candidate.startDate}</p></td>
                    <td className="px-5 py-5"><ChevronRight size={20} className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredCandidates.length === 0 && <div className="px-6 py-14 text-center"><Search className="mx-auto mb-3 text-slate-300" /><p className="font-bold text-slate-700">No candidates match this view</p><p className="mt-1 text-sm text-slate-500">Try a different search or lifecycle stage.</p></div>}
        </div>
      </div>

      {selectedRecord && <CandidateDrawer candidate={selectedRecord} activeTab={activeTab} onTabChange={setActiveTab} onClose={() => setSelectedRecord(null)} />}
    </div>
  );
}

function CandidateDrawer({ candidate, activeTab, onTabChange, onClose }: { candidate: CandidateRecord; activeTab: "profile" | "onboarding"; onTabChange: (tab: "profile" | "onboarding") => void; onClose: () => void }) {
  return <>
    <button type="button" aria-label="Close candidate record" className="fixed inset-0 z-40 cursor-default bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
    <aside role="dialog" aria-modal="true" aria-labelledby="candidate-record-title" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 pt-5 md:px-8 md:pt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4"><Avatar candidate={candidate} large /><div className="min-w-0"><p className="mb-1 text-xs font-bold uppercase tracking-wider text-blue-600">Candidate record · {candidate.id}</p><h2 id="candidate-record-title" className="truncate text-2xl font-extrabold tracking-tight">{candidate.name}</h2><p className="truncate text-sm font-semibold text-slate-500">{candidate.role} · {candidate.jobId}</p></div></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm" aria-label="Close candidate record"><X size={20} /></button>
        </div>
        <div className="mt-6 flex gap-6" role="tablist" aria-label="Candidate record sections">
          <Tab selected={activeTab === "profile"} onClick={() => onTabChange("profile")} icon={UserRound}>Profile</Tab>
          <Tab selected={activeTab === "onboarding"} onClick={() => onTabChange("onboarding")} icon={ShieldCheck} badge={`${candidate.onboarding}%`}>Onboarding</Tab>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 md:p-8">{activeTab === "profile" ? <Profile candidate={candidate} /> : <Onboarding candidate={candidate} />}</div>
    </aside>
  </>;
}

function Profile({ candidate }: { candidate: CandidateRecord }) {
  return <div className="space-y-7">
    {candidate.daysInStage > 7 && <Alert tone="amber" title="Action is overdue">This candidate has spent {candidate.daysInStage} days in {candidate.lifecycle}. {candidate.nextAction}.</Alert>}
    <section><Heading>Contact information</Heading><div className="grid gap-3 sm:grid-cols-2"><Info icon={Mail} label="Email" value={candidate.email} /><Info icon={Phone} label="Phone" value={candidate.phone} /><Info icon={MapPin} label="Location" value={candidate.location} /><Info icon={CalendarDays} label="Availability" value={candidate.availability} /></div></section>
    <section><Heading>Candidate summary</Heading><div className="rounded-2xl border border-slate-200 p-5"><p className="text-sm font-medium leading-6 text-slate-600">{candidate.summary}</p><div className="mt-4 flex flex-wrap gap-2">{candidate.skills.map((skill) => <span key={skill} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{skill}</span>)}</div></div></section>
    <section><Heading>Assignment</Heading><div className="grid gap-x-8 gap-y-5 rounded-2xl border border-slate-200 p-5 sm:grid-cols-2"><Detail label="Job posting" value={`${candidate.role} · ${candidate.jobId}`} /><Detail label="Hiring manager" value={candidate.manager} /><Detail label="Supplier" value={candidate.supplier} /><Detail label="Proposed rate" value={candidate.rate} /><Detail label="Lifecycle stage" value={candidate.lifecycle} /><Detail label="Target start" value={candidate.startDate} /></div></section>
  </div>;
}

function Onboarding({ candidate }: { candidate: CandidateRecord }) {
  const completed = candidate.onboardingSteps.filter((step) => step.status === "Complete").length;
  return <div className="space-y-7">
    <section className="rounded-2xl bg-slate-950 p-6 text-white">
      <div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Onboarding completion</p><p className="mt-2 text-4xl font-black">{candidate.onboarding}%</p><p className="mt-1 text-sm text-slate-300">{completed} of {candidate.onboardingSteps.length} requirement groups complete</p></div><StatusBadge status={candidate.onboardingStatus} dark /></div>
      <Progress candidate={candidate} dark className="mt-5 w-full" />
    </section>
    {candidate.onboardingStatus === "Blocked" && <Alert tone="rose" title="Identity verification is blocking progress">People Ops needs to review the candidate&apos;s resubmitted identity document before downstream access can begin.</Alert>}
    <section>
      <div className="mb-4 flex items-end justify-between gap-3"><div><Heading>Requirements</Heading><p className="-mt-2 text-sm text-slate-500">Owners and deadlines for this candidate&apos;s onboarding plan.</p></div><p className="shrink-0 text-xs font-bold text-slate-500">Start {candidate.startDate}</p></div>
      <div className="space-y-3">{candidate.onboardingSteps.map((step) => <div key={step.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${step.status === "Complete" ? "bg-emerald-100 text-emerald-700" : step.status === "Blocked" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>{step.status === "Complete" ? <Check size={19} /> : <FileCheck2 size={19} />}</div><div className="min-w-0 flex-1"><p className="font-bold text-slate-800">{step.label}</p><p className="mt-0.5 text-xs text-slate-500">Owner: {step.owner} · Due {step.dueDate}</p></div><StatusBadge status={step.status} /></div>)}</div>
    </section>
    <div className="grid gap-3 sm:grid-cols-2"><DetailCard label="Next action" value={candidate.nextAction} /><DetailCard label="Hiring manager" value={candidate.manager} /></div>
  </div>;
}

function Metric({ icon: Icon, label, value, detail, tone = "slate" }: { icon: React.ElementType; label: string; value: number; detail: string; tone?: "slate" | "blue" | "rose" }) {
  const iconTone = tone === "rose" ? "bg-rose-50 text-rose-600" : tone === "blue" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600";
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`rounded-xl p-3 ${iconTone}`}><Icon size={21} /></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><div className="mt-0.5 flex items-baseline gap-2"><span className="text-2xl font-extrabold">{value}</span><span className="text-xs text-slate-400">{detail}</span></div></div></div>;
}
function Avatar({ candidate, large = false }: { candidate: CandidateRecord; large?: boolean }) { return <div className={`flex shrink-0 items-center justify-center rounded-xl bg-slate-950 font-extrabold text-cyan-300 ${large ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm"}`}>{candidate.initials}</div>; }
function Progress({ candidate, className, dark = false }: { candidate: CandidateRecord; className: string; dark?: boolean }) { return <div className={`h-2 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-slate-100"} ${className}`}><div className={`h-full rounded-full ${candidate.onboardingStatus === "Blocked" ? "bg-rose-500" : candidate.onboarding === 100 ? "bg-emerald-500" : "bg-cyan-500"}`} style={{ width: `${candidate.onboarding}%` }} /></div>; }
function StatusBadge({ status, dark = false }: { status: OnboardingStatus | StepStatus; dark?: boolean }) { return <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold ${dark ? "border-cyan-700 bg-cyan-500/15 text-cyan-300" : statusTone(status)}`}>{status}</span>; }
function Tab({ children, selected, onClick, icon: Icon, badge }: { children: React.ReactNode; selected: boolean; onClick: () => void; icon: React.ElementType; badge?: string }) { return <button type="button" role="tab" aria-selected={selected} onClick={onClick} className={`relative flex items-center gap-2 pb-4 text-sm font-bold ${selected ? "text-blue-700" : "text-slate-500"}`}><Icon size={17} />{children}{badge && <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">{badge}</span>}{selected && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600" />}</button>; }
function Heading({ children }: { children: React.ReactNode }) { return <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{children}</h3>; }
function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><Icon size={18} className="shrink-0 text-blue-600" /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="truncate text-sm font-semibold text-slate-800">{value}</p></div></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>; }
function DetailCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-sm font-bold text-slate-800">{value}</p></div>; }
function Alert({ title, children, tone }: { title: string; children: React.ReactNode; tone: "amber" | "rose" }) { const colors = tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-amber-200 bg-amber-50 text-amber-900"; return <div className={`flex gap-3 rounded-2xl border p-4 ${colors}`}><AlertCircle className="shrink-0" size={20} /><div><p className="text-sm font-bold">{title}</p><p className="mt-0.5 text-sm opacity-80">{children}</p></div></div>; }
