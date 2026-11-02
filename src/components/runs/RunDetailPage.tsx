'use client';

import { useMemo, useState } from 'react';
import type { EngineContext } from '@flow-studio/model/context';
import type { RunEvent, RunStatus } from '@flow-studio/model/runtime';
import type { Workflow } from '@flow-studio/model/workflow';
import { runtimeCopy as rc } from '@flow-studio/runtime/copy';
import { dateTimeText } from '@flow-studio/runtime/time';
import type { StepView } from '@flow-studio/runtime/views';
import { apiWrite } from '@flow-studio-ui/api';
import { buttonClass, primaryButtonClass } from '@flow-studio-ui/ui/primitives';
import { RunCanvas, type RunStatuses } from './RunCanvas';
import { Loading, Note, PageFrame, PageTitle, RunDialog, StatusChip, useLoad } from './shared';

const copy = rc.screen;

interface Proposal { by: string; v: string; total: number }
interface RunAnswer {
  now: string;
  run: { id: string; status: RunStatus; version: number; startedAt: string; recordId: string };
  recordTitle: string;
  workflow: Workflow;
  steps: StepView[];
  statuses: RunStatuses;
  path: string[];
  history: string[];
  log: RunEvent[];
  banner: { tone: 'paused' | 'stopped'; text: string } | null;
  simulated: boolean;
  conflict: { field: string; a: Proposal; b: Proposal } | null;
  canControl: boolean;
  record: { values: { field: string; label: string; value: string }[]; ids: { field: string; label: string; value: string }[] };
  context: Pick<EngineContext, 'catalog' | 'people' | 'dws' | 'presets' | 'systems' | 'rules'>;
}

const STATUS_TEXT: Record<StepView['status'], string> = {
  pending: 'text-slate-500',
  active: 'text-amber-700',
  waiting: 'text-amber-700',
  done: 'text-emerald-700',
  skipped: 'text-slate-500',
  failed: 'text-rose-700',
  cancelled: 'text-slate-500',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-[12px] border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-[13.5px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** 05 §6.2. */
export function RunDetailPage({ runId }: { runId: string }) {
  const [loaded, reload] = useLoad<RunAnswer>(`/api/runtime/runs/${encodeURIComponent(runId)}`);
  const [dialog, setDialog] = useState<'pause' | 'stop' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const data = loaded.state === 'ready' ? loaded.data : null;
  const ctx = useMemo<EngineContext | null>(() => (data ? ({ ...data.context, workflows: [], samples: [], history: [], asOf: data.now.slice(0, 10), now: data.now } as unknown as EngineContext) : null), [data]);

  if (loaded.state === 'failed') return <Note>{loaded.status === 403 ? copy.runsNoAccess : loaded.message}</Note>;
  if (!data || !ctx) return <Loading />;

  const { run, canControl } = data;
  const act = async (path: string, body: unknown): Promise<void> => {
    await apiWrite('POST', `/api/runtime/runs/${encodeURIComponent(run.id)}/${path}`, body);
    setDialog(null);
    reload();
  };

  return (
    <PageFrame
      title={
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <PageTitle>{`${data.recordTitle} (${run.recordId})`}</PageTitle>
            <span role="group" aria-label="Status"><StatusChip status={run.status} /></span>
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500">{copy.sub(data.workflow.name, run.version, dateTimeText(run.startedAt))}</p>
        </>
      }
      right={
        canControl ? (
          <div className="flex gap-2">
            {/* One element: Pause becoming Resume keeps its focus. */}
            {run.status === 'running' || run.status === 'paused' ? (
              <button type="button" className={run.status === 'paused' ? primaryButtonClass : buttonClass} onClick={() => (run.status === 'paused' ? void act('resume', {}) : setDialog('pause'))}>
                {run.status === 'paused' ? copy.resume : copy.pause}
              </button>
            ) : null}
            <button type="button" className={buttonClass} onClick={() => setDialog('stop')}>{copy.stop}</button>
          </div>
        ) : null
      }
    >
      {data.banner ? (
        <div role="status" className={`rounded-[10px] px-3.5 py-2.5 text-[13.5px] ${data.banner.tone === 'paused' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{data.banner.text}</div>
      ) : null}
      {data.simulated ? <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-600">{rc.simulated.banner}</div> : null}
      {data.conflict ? (
        <div className="flex flex-col gap-2 rounded-[10px] bg-amber-50 px-3.5 py-2.5 text-[13.5px] text-amber-900">
          <span>{copy.conflictText(data.conflict.field, data.conflict.a, data.conflict.b)}</span>
          {canControl ? (
            <span className="flex gap-2">
              <button type="button" className={buttonClass} onClick={() => void act('choose', { choice: 'a' })}>{copy.conflictChoose(data.conflict.a.v)}</button>
              <button type="button" className={buttonClass} onClick={() => void act('choose', { choice: 'b' })}>{copy.conflictChoose(data.conflict.b.v)}</button>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <RunCanvas
          workflow={data.workflow}
          ctx={ctx}
          statuses={data.statuses}
          path={data.path}
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            document.getElementById(`run-step-${id}`)?.scrollIntoView({ block: 'nearest' });
          }}
        />
        <Section title={copy.stepsHeading}>
          <ol tabIndex={0} aria-label={copy.stepsHeading} className="flex max-h-[390px] flex-col gap-2.5 overflow-y-auto rounded pr-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
            {data.steps.map((step) => (
              <li key={step.id} id={`run-step-${step.id}`} className={`rounded-lg px-2 py-1.5 ${selected === step.id ? 'bg-cyan-50' : ''}`}>
                <span className="block text-[13px] font-semibold">{step.name}</span>
                <span className={`block text-xs font-semibold ${STATUS_TEXT[step.status]}`}>{step.label}</span>
                {step.message ? <span className="block text-xs text-slate-500">{step.message}</span> : null}
                {step.timers ? <span className="block text-xs text-slate-500">{step.timers}</span> : null}
                {step.ref ? <span className="block text-xs text-slate-500">{copy.systemRef(step.ref)}</span> : null}
                {(step.values ?? []).map((value) => <span key={value.field} className="block text-xs text-slate-500">{`${value.field}: ${value.value}`}</span>)}
                {step.simulated ? <span className="mt-0.5 block text-xs italic text-slate-500">{step.simulated}</span> : null}
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Section title={copy.historyHeading}>
          <ol className="flex flex-col gap-1 text-[13px]">
            {data.history.map((line, index) => <li key={`${index}:${line}`}>{line}</li>)}
          </ol>
        </Section>
        <Section title={copy.recordHeading}>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12.5px]">
            {data.record.values.map((row) => (
              <div key={row.field} className="contents">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
          {data.record.ids.length > 0 ? (
            <>
              <h3 className="mb-1 mt-3 text-xs font-semibold text-slate-500">{copy.idsHeading}</h3>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12.5px]">
                {data.record.ids.map((row) => (
                  <div key={row.field} className="contents">
                    <dt className="text-slate-500">{row.label}</dt>
                    <dd className="break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
        </Section>
      </div>

      {dialog === 'pause' ? (
        <RunDialog
          title={copy.pauseTitle}
          text={copy.pauseText}
          field={{ label: copy.pauseReason, required: false }}
          confirm={copy.pauseConfirm}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => act('pause', { reason })}
        />
      ) : null}
      {dialog === 'stop' ? (
        <RunDialog
          title={copy.stopTitle}
          text={copy.stopText}
          field={{ label: copy.stopReason, required: true }}
          confirm={copy.stopConfirm}
          danger
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => act('stop', { reason })}
        />
      ) : null}
    </PageFrame>
  );
}
