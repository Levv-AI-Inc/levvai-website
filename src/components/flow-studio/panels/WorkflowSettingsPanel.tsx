'use client';

import { ArrowRight, Lock, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { activeState, recordNouns } from '@flow-studio/engine/active';
import { copy, curl } from '@flow-studio/engine/copy';
import { prereqFor } from '@flow-studio/engine/selection';
import { evName, scopeText } from '@flow-studio/engine/text';
import type { EventKey, RecordKey, ScopeDimKey } from '@flow-studio/model/catalog';
import type { EngineContext } from '@flow-studio/model/context';
import type { Scope, Workflow } from '@flow-studio/model/workflow';
import { runtimeCopy } from '@flow-studio/runtime/copy';
import { apiGet, apiWrite } from '../api';
import { uiCopy } from '../copy';
import { finalRejectOptions, ownerOptions, runsWhenOptions, scopeOptions, sourceOptions, withCurrent } from '../options';
import { Details, Fine, FineLine, miniButtonClass, SayBox, Switch } from '../ui/primitives';
import { MultiField, NumberField, SelectField, TextField, TwoColumns, type PanelEdit } from './fields';

/** Workflows Levv itself approves this record in (04 §7.1 item 7): live, on "submitted", started in Levv, with an Approve step. */
function levvApprovers(record: RecordKey, ctx: EngineContext): Workflow[] {
  return ctx.workflows.filter(
    (workflow) =>
      workflow.status === 'live' &&
      workflow.records.includes(record) &&
      workflow.event === 'submitted' &&
      (workflow.source ?? 'levv') === 'levv' &&
      Object.values(workflow.draft.nodes).some((node) => node.kind === 'appr'),
  );
}

const Say = ({ lead, children }: { lead: string; children: string }) => (
  <SayBox>
    <span className="font-semibold">{lead}</span>
    {children}
  </SayBox>
);

/** 04 §7.1 item 7: every one whose condition holds, in this order. */
function Explainers({ workflow, ctx }: { workflow: Workflow; ctx: EngineContext }) {
  const record = workflow.records[0];
  const { event } = workflow;
  const source = workflow.source ?? 'levv';
  const system = ctx.catalog.SOURCES[source];
  const lifecycle = event === 'ob_start' || event === 'off_start';
  const nouns = recordNouns(ctx.catalog.RECORDS[record]);
  const prereq = prereqFor(record, event);
  const approvers = event === 'approved' && source === 'levv' ? levvApprovers(record, ctx) : [];
  const workOrderApprover = event === 'ob_start' ? levvApprovers('work_order', ctx)[0] : undefined;
  return (
    <>
      {!lifecycle && source !== 'levv' ? <SayBox>{uiCopy.sourceSay(system, nouns.one, evName(workflow, ctx.catalog).toLowerCase())}</SayBox> : null}
      {event === 'approved' && source === 'levv' ? (
        <Say lead={uiCopy.whatStarts}>
          {approvers.length > 0
            ? uiCopy.whatStartsApprove(approvers.map((workflowItem) => `“${workflowItem.name}”`).join(', '), nouns.one)
            : uiCopy.whatStartsNothing(nouns.many, ctx.catalog.RECORDS[record])}
        </Say>
      ) : null}
      {event === 'approved' && source !== 'levv' ? <Say lead={uiCopy.whatStarts}>{uiCopy.whatStartsExternal(nouns.one, system)}</Say> : null}
      {event === 'ob_start' ? (
        <SayBox>
          <span className="font-semibold">{uiCopy.startsByItself}</span>
          {uiCopy.onboardingOnce}
          <p className="mt-1.5">{workOrderApprover ? uiCopy.onboardingLevv(workOrderApprover.name) : uiCopy.onboardingOutside}</p>
        </SayBox>
      ) : null}
      {event === 'off_start' ? (
        <SayBox>
          <span className="font-semibold">{uiCopy.startsByItself}</span>
          {uiCopy.offboardingFirst}
          {uiCopy.offboardingLines(workflow.days ?? 14).map((line) => (
            <div key={line}>{line}</div>
          ))}
          <p className="mt-1.5">{uiCopy.offboardingEarly}</p>
        </SayBox>
      ) : null}
      {prereq !== 'none' && event !== 'ob_start' ? (
        <FineLine icon={<Lock aria-hidden className="h-3 w-3" />}>{copy.builtIn(ctx.presets.PRE_SHORT[prereq]).replace('🔒 ', '')}</FineLine>
      ) : null}
    </>
  );
}

/** New picks go in 04's field order; keys already there keep theirs, so a seeded "UK · Technology" still reads that way (notes). */
function nextScope(scope: Scope, dim: ScopeDimKey, values: string[], order: ScopeDimKey[]): Scope {
  const keys = Object.keys(scope) as ScopeDimKey[];
  if (values.length > 0 && !keys.includes(dim)) {
    const at = keys.findIndex((key) => order.indexOf(key) > order.indexOf(dim));
    keys.splice(at === -1 ? keys.length : at, 0, dim);
  }
  const next: Scope = {};
  for (const key of keys) {
    const current = key === dim ? values : scope[key];
    if (current && current.length > 0) next[key] = current;
  }
  return next;
}

/** 04 §11, §7.1 item 1. The switch is immediate and needs no second person (03 §14.4). */
function ActiveRow({ workflow, ctx, edit }: { workflow: Workflow; ctx: EngineContext; edit: PanelEdit }) {
  const state = activeState(workflow, ctx);
  const [confirming, setConfirming] = useState<number | null>(null);
  const apply = async (on: boolean): Promise<void> => {
    try {
      const result = await apiWrite<{ workflow: Workflow; toast: string }>('POST', `/api/flow-studio/workflows/${encodeURIComponent(workflow.id)}/active`, { active: on });
      edit.editing.absorb({ status: result.workflow.status });
      edit.toast(result.toast);
    } catch {
      edit.toast(uiCopy.saveFailed);
    }
  };
  /** 04 §11 "Recommended": say so before switching off a workflow with requests in progress. If the count can't be read, nothing stands in the way: the switch never touches them (RT-14). */
  const toggle = async (on: boolean): Promise<void> => {
    if (on) {
      await apply(on);
      return;
    }
    const running = await apiGet<{ count: number }>(`/api/flow-studio/workflows/${encodeURIComponent(workflow.id)}/running`).then((answer) => answer.count, () => 0);
    if (running > 0) setConfirming(running);
    else await apply(on);
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2.5 ${state.on ? '' : 'border-dashed'}`}>
      {state.hasSwitch ? <Switch label={copy.activeLiveTitle} on={state.on} onToggle={(on) => void toggle(on)} /> : null}
      <div className="min-w-0 text-[13px]">
        <span className="font-bold">{state.title}</span>
        <small className="block text-xs text-slate-500">{state.text}</small>
        {state.warning ? (
          <div className="mt-1">
            <Fine tone="warn" icon={<TriangleAlert aria-hidden className="h-3 w-3" />}>{state.warning}</Fine>
          </div>
        ) : null}
        {confirming !== null ? (
          <div role="alertdialog" aria-label={runtimeCopy.switchOff} className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2">
            <p className="text-[13px] text-amber-900">{runtimeCopy.switchOffConfirm(confirming)}</p>
            <div className="mt-1.5 flex gap-2">
              <button type="button" className={miniButtonClass} onClick={() => setConfirming(null)}>{runtimeCopy.screen.cancel}</button>
              <button
                type="button"
                className={miniButtonClass}
                onClick={() => {
                  setConfirming(null);
                  void apply(false);
                }}
              >
                {runtimeCopy.switchOff}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 04 §7.1. */
export function WorkflowSettingsPanel({ workflow, ctx, edit }: { workflow: Workflow; ctx: EngineContext; edit: PanelEdit }) {
  const record = workflow.records[0];
  const { event } = workflow;
  const patch = edit.editing.patch;
  const lifecycle = event === 'ob_start' || event === 'off_start';
  const hasApprove = Object.values(workflow.draft.nodes).some((node) => node.kind === 'appr');
  const dims = ctx.catalog.SCOPE_DIMS;
  const more = ctx.catalog.SCOPE_MORE;
  const order = [...dims, ...more].map(([key]) => key);
  const recipients = workflow.onReject?.recipients ?? [];
  const dayEvent = event === 'end_30' || event === 'doc_expiring';

  const changeRunsWhen = (value: string): void => {
    const [nextRecord, nextEvent] = value.split('|') as [RecordKey, EventKey];
    if (nextRecord === record && nextEvent === event) return;
    const fields: Partial<Workflow> = { records: [nextRecord], event: nextEvent };
    // Hidden for the lifecycle events, so nothing may keep adding " in {System}" to the title (notes, M5).
    if (nextEvent === 'ob_start' || nextEvent === 'off_start') fields.source = 'levv';
    fields.days = nextEvent === 'off_start' ? 14 : nextEvent === 'end_30' || nextEvent === 'doc_expiring' ? 30 : undefined;
    if (nextEvent !== 'changed' && nextEvent !== 'change_order') fields.basis = undefined;
    patch(fields);
  };

  const scopeField = ([dim, caption]: [ScopeDimKey, string]) => (
    <div key={dim}>
      <MultiField
        label={caption}
        placeholder={uiCopy.appliesAny(caption)}
        emptySummary={uiCopy.noneSelectedScope}
        options={scopeOptions(dim, ctx)}
        value={workflow.scope[dim] ?? []}
        onChange={(values) => patch({ scope: nextScope(workflow.scope, dim, values, order) })}
      />
    </div>
  );

  return (
    <>
      <ActiveRow workflow={workflow} ctx={ctx} edit={edit} />
      <TextField label={uiCopy.name} value={workflow.name} onChange={(name) => patch({ name })} />
      {record === 'work_order' ? <FineLine icon={<ArrowRight aria-hidden className="h-3 w-3" />}>{uiCopy.workOrderNote}</FineLine> : null}
      <SelectField label={uiCopy.runsWhen} options={runsWhenOptions(workflow, ctx)} value={`${record}|${event}`} onChange={changeRunsWhen} />
      {event === 'changed' || event === 'change_order' ? (
        <>
          <SelectField
            label={uiCopy.amountToCompare}
            options={[
              { value: 'total', label: uiCopy.basisTotal },
              { value: 'change', label: uiCopy.basisChange },
              { value: 'running', label: uiCopy.basisRunning },
            ]}
            value={workflow.basis ?? 'total'}
            onChange={(basis) => patch({ basis: basis as Workflow['basis'] })}
          />
          <FineLine>{uiCopy.amountHelp}</FineLine>
        </>
      ) : null}
      {dayEvent ? (
        <NumberField
          label={uiCopy.daysBefore}
          value={workflow.days ?? 30}
          min={1}
          max={365}
          onChange={(days) => {
            if (days !== null) patch({ days });
          }}
        />
      ) : null}
      {event === 'off_start' ? (
        <NumberField
          label={uiCopy.daysBeforeEnd}
          value={workflow.days ?? 14}
          min={1}
          max={90}
          onChange={(days) => {
            if (days !== null) patch({ days });
          }}
        />
      ) : null}
      {lifecycle ? null : <SelectField label={uiCopy.startsFrom} options={sourceOptions(ctx, uiCopy.sourceOption)} value={workflow.source ?? 'levv'} onChange={(source) => patch({ source: source as Workflow['source'] })} />}
      <Explainers workflow={workflow} ctx={ctx} />
      {hasApprove ? (
        <>
          <MultiField
            label={uiCopy.finalReject}
            placeholder={uiCopy.noPlaceholder}
            options={withCurrent(finalRejectOptions(ctx), recipients, ctx)}
            value={recipients}
            onChange={(next) => patch({ onReject: { ...workflow.onReject, recipients: next } })}
          />
          <FineLine>{uiCopy.finalRejectHelp}</FineLine>
        </>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-500">{uiCopy.appliesTo}</span>
        {dims.map(scopeField)}
      </div>
      <Details summary={uiCopy.appliesMore} open={more.some(([dim]) => (workflow.scope[dim]?.length ?? 0) > 0)}>
        {more.map(scopeField)}
      </Details>
      <SayBox>
        {uiCopy.appliesSay}
        <span className="font-semibold">{curl(scopeText(workflow.scope))}</span>
        {uiCopy.appliesRest}
      </SayBox>
      <Details summary={uiCopy.advanced}>
        <TwoColumns>
          <TextField label={uiCopy.effectiveDate} type="date" value={workflow.effective} onChange={(effective) => patch({ effective })} />
          <SelectField label={uiCopy.owner} options={ownerOptions(ctx, uiCopy.teams, uiCopy.aPerson)} value={workflow.owner} onChange={(owner) => patch({ owner })} />
        </TwoColumns>
      </Details>
    </>
  );
}
