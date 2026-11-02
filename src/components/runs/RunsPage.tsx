'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { RunStatus, RunSummary } from '@flow-studio/model/runtime';
import { runtimeCopy as rc } from '@flow-studio/runtime/copy';
import { dateText, relativeText } from '@flow-studio/runtime/time';
import { SelectMenu } from '@flow-studio-ui/SelectMenu';
import { Field, inputClass } from '@flow-studio-ui/ui/primitives';
import { Loading, Note, PageFrame, PageTitle, STATUS_LABELS, StatusChip, useLoad } from './shared';

const copy = rc.screen;
const ALL: RunStatus[] = ['running', 'paused', 'stopped', 'completed', 'rejected'];
const OPTION_ALL = 'all';

interface RunsAnswer { now: string; runs: RunSummary[]; workflows: { id: string; name: string }[] }

/** 05 §6.1. Everything filters on the client: the route answers the tenant's runs. 500 of them render at the numbers in BUILD_REPORT. */
export function RunsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [status, setStatus] = useState<string[]>(['running', 'paused']);
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [record, setRecord] = useState(search?.get('record') ?? '');
  const [loaded] = useLoad<RunsAnswer>('/api/runtime/runs');

  const data = loaded.state === 'ready' ? loaded.data : null;
  const rows = useMemo(() => {
    if (!data) return [];
    const needle = record.trim().toLowerCase();
    return data.runs
      .filter((run) => status.length === 0 || status.includes(OPTION_ALL) || status.includes(run.status))
      .filter((run) => workflows.length === 0 || workflows.includes(run.workflowId))
      .filter((run) => needle === '' || run.recordId.toLowerCase().includes(needle) || run.recordTitle.toLowerCase().includes(needle))
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  }, [data, status, workflows, record]);

  const statusOptions = [{ value: OPTION_ALL, label: copy.allStatuses }, ...ALL.map((value) => ({ value, label: STATUS_LABELS[value].label }))];
  const pickStatus = (next: string[]): void => {
    // "All statuses" is a shorthand: choosing it clears the others, and choosing another leaves it.
    const added = next.find((value) => !status.includes(value));
    if (added === OPTION_ALL) setStatus([OPTION_ALL]);
    else setStatus(next.filter((value) => value !== OPTION_ALL));
  };

  return (
    <PageFrame title={<PageTitle>{copy.runsTitle}</PageTitle>}>
      <div className="grid max-w-[820px] grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={copy.filterStatus}>
          {(labelId) => <SelectMenu multiple aria-labelledby={labelId} options={statusOptions} value={status} onChange={pickStatus} placeholder={copy.allStatuses} />}
        </Field>
        <Field label={copy.filterWorkflow}>
          {(labelId) => (
            <SelectMenu multiple aria-labelledby={labelId} options={(data?.workflows ?? []).map((workflow) => ({ value: workflow.id, label: workflow.name }))} value={workflows} onChange={setWorkflows} placeholder={copy.allWorkflows} />
          )}
        </Field>
        <Field label={copy.filterRecord}>
          {(labelId) => <input aria-labelledby={labelId} type="search" value={record} onChange={(event) => setRecord(event.target.value)} className={inputClass} />}
        </Field>
      </div>

      {loaded.state === 'loading' ? <Loading /> : null}
      {loaded.state === 'failed' ? <Note>{loaded.status === 403 ? copy.runsNoAccess : loaded.message}</Note> : null}
      {data && rows.length === 0 ? <Note>{copy.runsEmpty}</Note> : null}
      {rows.length > 0 && data ? (
        <div className="overflow-x-auto rounded-[12px] border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                {copy.columns.map((column) => <th key={column} scope="col" className="px-3 py-2.5 font-semibold">{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((run) => (
                <tr
                  key={run.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`${run.recordTitle} (${run.recordId})`}
                  onClick={() => router.push(`/runs/${run.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') router.push(`/runs/${run.id}`);
                  }}
                  className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-600"
                >
                  <td className="px-3 py-2.5"><span className="block font-semibold">{run.recordTitle}</span><span className="text-xs text-slate-500">{run.recordId}</span></td>
                  <td className="px-3 py-2.5"><span className="block">{run.workflowName}</span><span className="text-xs text-slate-500">{`v${run.version}`}</span></td>
                  <td className="px-3 py-2.5"><StatusChip status={run.status} /></td>
                  <td className="px-3 py-2.5">{run.waitingOn.length > 0 ? run.waitingOn.map((line) => <span key={line} className="block">{line}</span>) : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{dateText(run.startedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{relativeText(run.updatedAt, data.now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageFrame>
  );
}
