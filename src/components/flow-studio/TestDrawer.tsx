'use client';

import { ArrowRight, Check, Eye, Flag, ListChecks, Play, Sigma } from 'lucide-react';
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { copy, curl } from '@flow-studio/engine/copy';
import type { TestRun, TestRunOptions, TestRunResult } from '@flow-studio/model/results';
import { uiCopy } from './copy';
import { Drawer } from './Drawer';
import { Badge, buttonClass, Emphasised, fieldLabelClass, Fine, FineLine, miniButtonClass, SayBox, type BadgeVariant } from './ui/primitives';

export interface TestState {
  run: TestRun;
  view: TestRunResult;
}

export interface SampleRow {
  id: string;
  title: string;
  note: string;
}

interface TestDrawerProps {
  samples: SampleRow[];
  sampleId: string | null;
  state: TestState | null;
  options: TestRunOptions;
  compact: boolean;
  onSample: (id: string) => void;
  onOptions: (options: TestRunOptions) => void;
  onClose: () => void;
}

const WARNING = ['Approval', 'Escalated', 'Flagged', 'Paused: not connected', 'Waiting'];
const WARNING_PREFIX = ['Review: ', 'Unsure: ', 'To do: '];
const ERROR = ['Paused', 'Choose who approves', 'Failed: decision needed', 'Failed: escalated'];

/** 04 §8.4. */
function statusVariant(status: string): BadgeVariant {
  if (status === 'No one to tell') return 'neutral';
  if (ERROR.includes(status)) return 'error';
  if (WARNING.includes(status) || WARNING_PREFIX.some((prefix) => status.startsWith(prefix))) return 'warning';
  return 'success';
}

/** 03 §11.1: what the summary shows in bold. */
function summaryPhrases(run: TestRun): string[] {
  const plan = run.plan;
  if (!plan) return [];
  return [
    'Needs information',
    'Approved automatically',
    'Part of the approval is paused',
    plan.rejected ? `Rejected at “${plan.rejected.by}”` : '',
    plan.stopped ? `Stopped at “${plan.stopped.by}”` : '',
    ...plan.rules.map((rule) => rule.name),
  ];
}

/** 04 §8.2 item 6: "1 {people} · {notes joined with "; "}", the round number standing where a fine line has its icon. */
function RoundLines({ rounds }: { rounds: { n: number; people: string; notes: string[] }[] }) {
  return (
    <ol className="ml-1.5 flex flex-col gap-[3px] border-l-2 border-slate-200 pl-2.5">
      {rounds.map((round) => (
        <li key={round.n} className="flex items-start gap-1.5 text-xs text-slate-500">
          <span className="mt-px w-3 flex-none text-center font-semibold">{round.n}</span>{' '}
          <span>{curl([round.people, round.notes.join('; ')].filter(Boolean).join(' · '))}</span>
        </li>
      ))}
    </ol>
  );
}

function TaskLines({ tasks }: { tasks: string[] }) {
  return (
    <ul className="ml-1.5 flex flex-col gap-[3px] border-l-2 border-slate-200 pl-2.5">
      {tasks.map((task) => (
        <li key={task}>
          <Fine icon={<ListChecks aria-hidden className="h-3 w-3" />}>{curl(task)}</Fine>
        </li>
      ))}
    </ul>
  );
}

function SampleList({ samples, sampleId, onSample }: Pick<TestDrawerProps, 'samples' | 'sampleId' | 'onSample'>) {
  const labelId = useId();
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + samples.length) % samples.length;
    onSample(samples[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
  return (
    <div>
      <span id={labelId} className={fieldLabelClass}>{uiCopy.tryRecord}</span>
      {samples.length === 0 ? (
        <p className="text-xs text-slate-500">{copy.noSampleRecords}</p>
      ) : (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-1.5">
          {samples.map((sample, index) => {
            const on = sample.id === sampleId;
            return (
              <button
                key={sample.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => onSample(sample.id)}
                onKeyDown={(event) => move(event, index)}
                className={`flex w-full flex-col items-start rounded-lg border px-2.5 py-1.5 text-left hover:border-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${on ? 'border-cyan-600 bg-cyan-50' : 'border-slate-200'}`}
              >
                <span className={`text-[13px] ${on ? 'font-semibold text-cyan-700' : 'font-medium text-slate-900'}`}>{curl(sample.title)}</span>
                <span className="text-xs text-slate-500">{curl(`${sample.id} · ${sample.note}`)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function noticeLine(text: string): ReactNode {
  if (text.startsWith('Comparing')) return <Fine icon={<Sigma aria-hidden className="h-3 w-3" />}>{curl(text)}</Fine>;
  if (text.startsWith('Using')) return <Fine tone="ok" icon={<Check aria-hidden className="h-3 w-3" />}>{curl(text)}</Fine>;
  if (text.startsWith('Marked')) return <Fine tone="ok" icon={<Flag aria-hidden className="h-3 w-3" />}>{curl(text)}</Fine>;
  return <Fine icon={<ArrowRight aria-hidden className="h-3 w-3" />}>{curl(text)}</Fine>;
}

/** 04 §8: the same result both the panel and the canvas read, for the record chosen here. */
export function TestDrawer({ samples, sampleId, state, options, compact, onSample, onOptions, onClose }: TestDrawerProps) {
  const sample = samples.find((row) => row.id === sampleId);
  const view = state?.view ?? null;
  const conflict = state?.run.sample.conflict;
  const hasBasis = !!state?.run.plan?.basis;
  const notices = view?.notices ?? [];
  // 03 §11 item 3: the Σ line, then the conflict box or its chosen line, then the rest.
  const before = hasBasis ? notices.slice(0, 1) : [];
  const after = hasBasis ? notices.slice(1) : notices;

  return (
    <Drawer title={uiCopy.test} subtitle={sample ? curl(sample.title) : undefined} compact={compact} onClose={onClose} icon={<Play aria-hidden className="h-[18px] w-[18px] text-cyan-600" />}>
      {view?.inactiveNotice ? (
        <SayBox className="border-l-[3px] border-l-amber-500">
          <Emphasised text={view.inactiveNotice} phrases={['This workflow is inactive.']} />
        </SayBox>
      ) : null}
      {view && state && view.summary !== null ? (
        <div role="group" aria-label={uiCopy.testSummary}>
          <SayBox>
            <Emphasised text={curl(view.summary)} phrases={summaryPhrases(state.run).map(curl)} />
          </SayBox>
        </div>
      ) : null}
      {before.length > 0 || after.length > 0 || view?.conflict || view?.editButton ? (
        <div className="flex flex-col gap-2">
          {before.length > 0 ? (
            <ul aria-label={uiCopy.testNotices} className="flex flex-col gap-1">
              {before.map((text) => <li key={text}>{noticeLine(text)}</li>)}
            </ul>
          ) : null}
          {view?.conflict && conflict ? (
            <div role="group" aria-label={copy.conflictBadge} className="flex flex-col gap-2 rounded-[10px] border border-slate-200 p-3 text-[13px]">
              <div>
                <Badge variant="warning" className="mr-1.5">{view.conflict.badge}</Badge>{' '}
                <Emphasised text={curl(view.conflict.message)} phrases={[conflict.a.v, conflict.b.v]} />
              </div>
              <div className="flex flex-wrap gap-2">
                {view.conflict.choices.map((choice, index) => (
                  <button key={choice} type="button" className={buttonClass} onClick={() => onOptions({ ...options, conflictChoice: index === 0 ? 'a' : 'b' })}>
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {after.length > 0 ? (
            <ul aria-label={uiCopy.testNotices} className="flex flex-col gap-1">
              {after.map((text) => (
                <li key={text} className="flex items-start justify-between gap-2">
                  {noticeLine(text)}
                  {text.startsWith('Using') && view?.undoButton ? (
                    <button type="button" className={`${miniButtonClass} flex-none`} onClick={() => onOptions({ ...options, conflictChoice: undefined })}>
                      {view.undoButton}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {view?.editButton ? (
            <button type="button" className={`${miniButtonClass} self-start text-left`} onClick={() => onOptions({ ...options, applyEdit: !options.applyEdit })}>
              {curl(view.editButton)}
            </button>
          ) : null}
        </div>
      ) : null}
      <SampleList samples={samples} sampleId={sampleId} onSample={onSample} />
      {view && view.path ? (
        <ul aria-label={uiCopy.testDecisions} className="flex flex-wrap gap-1.5">
          {view.path.split(' | ').map((chip, index) => (
            <li key={`${index}:${chip}`} className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs">{curl(chip)}</li>
          ))}
        </ul>
      ) : null}
      {view?.fromApprovalRules ? (
        <section aria-label={copy.fromApprovalRulesTitle} className="flex flex-col gap-[3px] rounded-[10px] border border-slate-200 px-2.5 py-2">
          <h3 className="text-[13px] font-semibold">{copy.fromApprovalRulesTitle}</h3>
          <RoundLines rounds={view.fromApprovalRules} />
          {view.fromApprovalRules.flatMap((round) => round.tasks ?? []).length > 0 ? <TaskLines tasks={view.fromApprovalRules.flatMap((round) => round.tasks ?? [])} /> : null}
        </section>
      ) : null}
      {view && view.steps.length > 0 ? (
        <ul aria-label={uiCopy.testSteps} className="flex flex-col gap-2">
          {view.steps.map((step) => (
            <li key={step.id} className="flex flex-col gap-[3px] rounded-[10px] border border-slate-200 px-2.5 py-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 text-[13px] font-semibold">{curl(step.title)}</h3>
                <Badge variant={statusVariant(step.status)}>{curl(step.status)}</Badge>
              </div>
              {step.message ? <FineLine>{curl(step.message)}</FineLine> : null}
              {step.workerSees !== undefined ? <Fine icon={<Eye aria-hidden className="h-3 w-3" />}>{uiCopy.workerSees(step.workerSees)}</Fine> : null}
              {step.rounds ? <RoundLines rounds={step.rounds} /> : null}
              {step.tasks ? <TaskLines tasks={step.tasks} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {view?.removedByEdit ? (
        <section aria-label={copy.removedByEditTitle} className="flex flex-col gap-[3px] rounded-[10px] border border-slate-200 px-2.5 py-2">
          <h3 className="text-[13px] font-semibold">{copy.removedByEditTitle}</h3>
          <ul className="flex flex-col gap-[3px]">
            {view.removedByEdit.map((line) => <li key={line}><FineLine>{curl(line)}</FineLine></li>)}
          </ul>
        </section>
      ) : null}
    </Drawer>
  );
}
