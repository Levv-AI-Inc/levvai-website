"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  ChevronRight,
  Mail,
  MapPin,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { DEFAULT_WORKER_STATUS, MOCK_WORKERS, type MockWorker } from "@/lib/mockWorkers";
import {
  LevvEmptyState,
  LevvLifecycle,
  LevvNotice,
  LevvNovaPrompt,
  LevvPage,
  LevvPageHeader,
  LevvSearchField,
  LevvStat,
  LevvStatStrip,
  LevvStatusBadge,
  LevvToolbar,
  levvUi,
  type LevvLifecycleStage,
  type LevvTone,
} from "@/components/ui/levv-app";

const workers = MOCK_WORKERS;
const STATUSES = ["All", "Active", "Onboarding", "Offboarded"] as const;

const COMPLIANCE_TONE: Record<MockWorker["compliance"], LevvTone> = {
  Compliant: "emerald",
  "Review Required": "amber",
  "Non-Compliant": "rose",
};

const LIFECYCLE: Record<MockWorker["status"], { stage: LevvLifecycleStage; closed: boolean }> = {
  Onboarding: { stage: "Onboarding", closed: false },
  Active: { stage: "In engagement", closed: false },
  Offboarded: { stage: "Offboarding", closed: true },
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("");

export default function WorkersIndexPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>(DEFAULT_WORKER_STATUS);
  const [selectedRecord, setSelectedRecord] = useState<MockWorker | null>(null);
  const [aiInput, setAiInput] = useState("");

  const filteredWorkers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return workers.filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(term) ||
        w.cwsId.toLowerCase().includes(term) ||
        w.role.toLowerCase().includes(term);
      const matchesStatus = selectedStatus === "All" || w.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus]);

  const counts = useMemo(
    () => ({
      active: workers.filter((w) => w.status === "Active").length,
      onboarding: workers.filter((w) => w.status === "Onboarding").length,
      alerts: workers.filter((w) => w.compliance !== "Compliant" && w.status !== "Offboarded").length,
    }),
    [],
  );

  const filtersChanged = searchTerm !== "" || selectedStatus !== DEFAULT_WORKER_STATUS;

  return (
    <LevvPage>
      <div className="space-y-6">
        <LevvPageHeader
          title="Workers"
          description="Master directory of contingent and SOW workforce records."
          actions={
            <LevvNovaPrompt
              className="w-full sm:w-96"
              placeholder="Ask Nova to audit compliance..."
              value={aiInput}
              onChange={setAiInput}
            />
          }
        />

        <LevvStatStrip>
          <LevvStat label="Workers on record" value={workers.length} />
          <LevvStat label="Active" value={counts.active} />
          <LevvStat label="Onboarding" value={counts.onboarding} />
          <LevvStat
            label="Compliance alerts"
            value={counts.alerts}
            tone={counts.alerts > 0 ? "critical" : "positive"}
            detail={counts.alerts > 0 ? "Need review before access renews" : "Every active worker is compliant"}
          />
        </LevvStatStrip>

        <section aria-label="Worker directory" className="space-y-3">
          <LevvToolbar>
            <LevvSearchField
              className="w-full sm:w-72"
              placeholder="Worker name, CWS ID, or role..."
              aria-label="Search workers"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <div role="group" aria-label="Worker status" className="flex rounded-lg border border-[var(--line-strong)] bg-white p-0.5">
              {STATUSES.map((status) => {
                const selected = selectedStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedStatus(status)}
                    className={`levv-press h-7 rounded-md px-3 text-[13px] font-medium ${
                      selected ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
            {filtersChanged ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedStatus(DEFAULT_WORKER_STATUS);
                }}
                className={levvUi.ghostButton}
              >
                <X /> Reset
              </button>
            ) : null}
            <span className="ml-auto text-[13px] tabular-nums text-slate-500">
              {filteredWorkers.length} of {workers.length}
            </span>
          </LevvToolbar>

          <div className={levvUi.tableShell}>
            <ul aria-label="Workers" className="divide-y divide-[var(--line)] sm:hidden">
              {filteredWorkers.map((w) => {
                const lifecycle = LIFECYCLE[w.status];
                return (
                  <li key={w.cwsId}>
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(w)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {initials(w.name)}
                      </span>
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span className="block truncate text-[13px] font-medium text-slate-950">{w.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {w.role} · {w.cwsId}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <LevvStatusBadge tone={COMPLIANCE_TONE[w.compliance]}>{w.compliance}</LevvStatusBadge>
                          <LevvLifecycle stage={lifecycle.stage} closed={lifecycle.closed} tone={w.status === "Onboarding" ? "amber" : "blue"} />
                        </span>
                      </span>
                      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[880px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className={levvUi.th}>Worker</th>
                    <th className={levvUi.th}>ID and type</th>
                    <th className={levvUi.th}>Lifecycle</th>
                    <th className={levvUi.th}>Ends</th>
                    <th className={levvUi.th}>Compliance</th>
                    <th className={levvUi.th}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.map((w) => {
                    const lifecycle = LIFECYCLE[w.status];
                    return (
                      <tr
                        key={w.cwsId}
                        tabIndex={0}
                        onClick={() => setSelectedRecord(w)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") setSelectedRecord(w);
                        }}
                        className="group cursor-pointer outline-none focus-visible:bg-blue-50"
                      >
                        <td className={`${levvUi.td} border-t border-[var(--line)]`}>
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {initials(w.name)}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-slate-950">{w.name}</div>
                              <div className="truncate text-xs text-slate-500">{w.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`${levvUi.td} border-t border-[var(--line)]`}>
                          <div className="font-medium tabular-nums text-slate-900">{w.cwsId}</div>
                          <div className="text-xs text-slate-500">
                            {w.workerType} via {w.supplier}
                          </div>
                        </td>
                        <td className={`${levvUi.td} border-t border-[var(--line)]`}>
                          <LevvLifecycle stage={lifecycle.stage} closed={lifecycle.closed} tone={w.status === "Onboarding" ? "amber" : "blue"} />
                        </td>
                        <td className={`${levvUi.td} border-t border-[var(--line)] tabular-nums`}>{w.end}</td>
                        <td className={`${levvUi.td} border-t border-[var(--line)]`}>
                          <LevvStatusBadge tone={COMPLIANCE_TONE[w.compliance]}>{w.compliance}</LevvStatusBadge>
                        </td>
                        <td className={`${levvUi.td} w-10 border-t border-[var(--line)] text-right`}>
                          <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredWorkers.length === 0 ? (
              <LevvEmptyState icon={Users} title="No workers match these filters">
                Try another name or ID, or switch the status filter to All.
              </LevvEmptyState>
            ) : null}
          </div>
        </section>
      </div>

      {selectedRecord ? <WorkerPreview worker={selectedRecord} onClose={() => setSelectedRecord(null)} /> : null}
    </LevvPage>
  );
}

function WorkerPreview({ worker, onClose }: { worker: MockWorker; onClose: () => void }) {
  const facts: [string, string][] = [
    ["CWS ID", worker.cwsId],
    ["HR ID", worker.hrSystemId],
    ["Department", worker.department],
    ["Location", worker.location],
    ["Supplier", worker.supplier],
    ["Owner", worker.owner],
    ["Start date", worker.start],
    ["End date", worker.end],
  ];
  const lifecycle = LIFECYCLE[worker.status];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/30 animate-in fade-in duration-200" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${worker.name} preview`}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-[var(--line)] bg-white shadow-xl animate-in slide-in-from-right duration-300 [animation-timing-function:cubic-bezier(0.32,0.72,0,1)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--rail)] text-sm font-semibold text-white">
              {initials(worker.name)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-950">{worker.name}</h2>
              <p className="truncate text-[13px] text-slate-500">{worker.role}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className={`${levvUi.ghostButton} w-9 px-0`}>
            <X />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <LevvLifecycle stage={lifecycle.stage} closed={lifecycle.closed} tone={worker.status === "Onboarding" ? "amber" : "blue"} />
            <LevvStatusBadge tone={COMPLIANCE_TONE[worker.compliance]}>{worker.compliance}</LevvStatusBadge>
          </div>

          {worker.compliance !== "Compliant" ? (
            <LevvNotice tone="rose" icon={AlertCircle} title="Compliance action required">
              Worker documentation is out of sync with current policy. Access may be restricted if not resolved.
            </LevvNotice>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className={`mt-0.5 truncate text-[13px] font-medium tabular-nums ${label === "End date" && worker.compliance !== "Compliant" ? "text-rose-700" : "text-slate-900"}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="space-y-2 border-t border-[var(--line)] pt-5 text-[13px]">
            <a href={`mailto:${worker.email}`} className="flex items-center gap-2 text-blue-700 hover:underline">
              <Mail className="h-4 w-4 text-slate-400" /> {worker.email}
            </a>
            <p className="flex items-center gap-2 text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400" /> {worker.location}
            </p>
            <p className="flex items-center gap-2 text-slate-600">
              <UserRound className="h-4 w-4 text-slate-400" /> {worker.workerType} via {worker.supplier}
            </p>
          </div>
        </div>

        <footer className="space-y-2 border-t border-[var(--line)] px-6 py-4">
          <button type="button" className={`${levvUi.primaryButton} group w-full`}>
            View full worker profile
            <ArrowRight className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={levvUi.secondaryButton}>
              <Calendar /> Extend contract
            </button>
            <button type="button" className={`${levvUi.secondaryButton} text-rose-700 hover:text-rose-800`}>
              <AlertCircle /> Offboard worker
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
