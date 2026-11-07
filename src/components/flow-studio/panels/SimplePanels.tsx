'use client';

import { copy } from '@flow-studio/engine/copy';
import { roleName } from '@flow-studio/engine/resolve';
import { waitText } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { WorkflowSummary } from '@flow-studio/model/runtime';
import type { EndNode, NotifyNode, ParallelNode, PlanNode, PolicyNode, RunWorkflowNode, TaskNode, WaitConfig, WaitNode, WfNode, Workflow } from '@flow-studio/model/workflow';
import { X } from 'lucide-react';
import { KIND_TITLES, uiCopy } from '../copy';
import { assigneeRoleOptions, fyiRoleOptions, otherWorkflowOptions, planOutsideOptions, withCurrent } from '../options';
import { SelectMenu } from '../SelectMenu';
import { FineLine, inputClass, miniButtonClass, SayBox } from '../ui/primitives';
import { Chaser } from './Chaser';
import { entries, MultiField, NameField, NumberField, plain, SelectField, TextField, TwoColumns, type PanelEdit } from './fields';
import { GivesBlock } from './GivesBlock';
import { PresetBox } from './PresetBox';

const setter = (edit: PanelEdit, id: string) => (field: string, value: unknown): void => {
  edit.editing.apply((nodes, ed) => ed.setField(nodes, id, field, value));
};

/** 04 §7.4. */
export function PolicyPanel({ node, ctx, edit }: { node: PolicyNode; ctx: EngineContext; edit: PanelEdit }) {
  const set = setter(edit, node.id);
  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.policy} onChange={(value) => set('label', value)} />
      <SayBox>{uiCopy.policySay}</SayBox>
      <TextField label={uiCopy.receipt} value={node.receipt} onChange={(value) => set('receipt', value)} />
      <SelectField label={uiCopy.letKnow} options={withCurrent(fyiRoleOptions(ctx, uiCopy.noPlaceholder), [node.fyi ?? ''], ctx)} value={node.fyi ?? ''} onChange={(value) => set('fyi', value)} />
    </>
  );
}

/** 04 §7.5. */
export function PlanPanel({ node, nodes, ctx, edit }: { node: PlanNode; nodes: Record<string, WfNode>; ctx: EngineContext; edit: PanelEdit }) {
  const set = setter(edit, node.id);
  const target = nodes[node.outs.find((out) => out.key === 'out')?.to ?? ''];
  const roles = target?.kind === 'appr' ? target.roles : [];
  const several = roles.length > 1;
  const options = withCurrent(planOutsideOptions(ctx), several ? [] : roles, ctx);
  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.plan} onChange={(value) => set('label', value)} />
      <SelectField label={uiCopy.plan} options={plain(uiCopy.planOptions)} value={node.plan} onChange={(value) => set('plan', value)} />
      <SayBox>{uiCopy.planSay}</SayBox>
      <SelectField
        label={uiCopy.planOutside}
        options={several ? [{ value: 'several', label: roles.map((key) => roleName(ctx, key)).join(' + ') }, ...options] : options}
        value={several ? 'several' : roles[0] ?? null}
        onChange={(role) => {
          if (role !== 'several') edit.editing.apply((current, ed) => ed.setPlanOutside(current, node.id, role));
        }}
      />
      <FineLine>{uiCopy.planFine}</FineLine>
    </>
  );
}

/** 04 §7.10. */
export function TaskPanel({ node, workflow, ctx, edit }: { node: TaskNode; workflow: Workflow; ctx: EngineContext; edit: PanelEdit }) {
  const set = setter(edit, node.id);
  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.task} onChange={(value) => set('label', value)} />
      <PresetBox node={node} workflow={workflow} ctx={ctx} edit={edit} />
      <SayBox>{uiCopy.taskSay}</SayBox>
      <SelectField label={uiCopy.who} options={withCurrent(assigneeRoleOptions(ctx), [node.role], ctx)} value={node.role} onChange={(value) => set('role', value)} />
      <TextField label={uiCopy.whatTheyDo} value={node.title} onChange={(value) => set('title', value)} />
      <Chaser node={node} onChange={set} />
      <GivesBlock node={node} ctx={ctx} onFields={(fields) => edit.editing.apply((nodes, ed) => ed.setFields(nodes, node.id, fields))} />
    </>
  );
}

/** 04 §7.12. */
export function NotifyPanel({ node, ctx, edit }: { node: NotifyNode; ctx: EngineContext; edit: PanelEdit }) {
  const set = setter(edit, node.id);
  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.notify} onChange={(value) => set('label', value)} />
      <MultiField label={uiCopy.who} placeholder={uiCopy.chooseWhoToTell} options={withCurrent(assigneeRoleOptions(ctx), node.recipients, ctx)} value={node.recipients} onChange={(value) => set('recipients', value)} />
      <SelectField label={uiCopy.how} options={plain(uiCopy.channels)} value={node.channel} onChange={(value) => set('channel', value)} />
    </>
  );
}

function waitSentence(w: WaitConfig, ctx: EngineContext): string {
  if (w.mode === 'for') return `${waitText(w, true, ctx.catalog)}.`;
  if (w.mode === 'date') return `${waitText(w, true, ctx.catalog)}.${uiCopy.waitMoves}`;
  if (!w.at) return `${copy.pickDateTime}.`;
  const [date, time] = w.at.split('T');
  return uiCopy.waitsAt(date, time ?? '');
}

/** 04 §7.13. */
export function WaitPanel({ node, ctx, edit }: { node: WaitNode; ctx: EngineContext; edit: PanelEdit }) {
  const set = setter(edit, node.id);
  const { w } = node;
  const write = (fields: Partial<WaitConfig>): void => set('w', { ...w, ...fields });
  const units = entries(ctx.catalog.WAIT_UNITS);
  const dateUnits = units.filter((option) => option.value !== 'hours');
  const changeMode = (mode: WaitConfig['mode']): void => {
    if (mode === w.mode) return;
    if (mode === 'date') {
      write({ mode, unit: w.unit === 'hours' || !w.unit ? 'days' : w.unit, amount: w.amount ?? 0, dir: w.dir ?? 'before', field: w.field ?? 'start_date', time: w.time ?? '09:00', tz: w.tz ?? 'worker' });
    } else if (mode === 'for') {
      write({ mode, unit: w.unit ?? 'days', amount: Math.max(1, w.amount ?? 1) });
    } else {
      write({ mode, at: w.at ?? '' });
    }
  };
  const amount = (value: number | null): void => {
    if (value !== null) write({ amount: value });
  };
  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.wait} onChange={(value) => set('label', value)} />
      <SelectField label={uiCopy.waitLabel} options={entries(uiCopy.waitModes)} value={w.mode} onChange={(value) => changeMode(value as WaitConfig['mode'])} />
      {w.mode === 'for' ? (
        <TwoColumns>
          <NumberField label={uiCopy.howLong} value={w.amount} min={1} onChange={amount} />
          <SelectMenu aria-label={uiCopy.unit} options={units} value={w.unit ?? 'days'} onChange={(unit) => write({ unit: unit as WaitConfig['unit'] })} />
        </TwoColumns>
      ) : null}
      {w.mode === 'date' ? (
        <>
          <div className="grid grid-cols-[90px_1fr] items-end gap-2">
            <NumberField label={uiCopy.offset} value={w.amount ?? 0} min={0} onChange={amount} />
            <SelectMenu aria-label={uiCopy.unit} options={dateUnits} value={w.unit ?? 'days'} onChange={(unit) => write({ unit: unit as WaitConfig['unit'] })} />
          </div>
          <TwoColumns>
            <SelectField
              label={uiCopy.beforeOrAfter}
              options={[
                { value: 'before', label: uiCopy.before },
                { value: 'after', label: uiCopy.after },
              ]}
              value={w.dir ?? 'before'}
              onChange={(dir) => write({ dir: dir as WaitConfig['dir'] })}
            />
            <SelectField label={uiCopy.dateLabel} options={entries(ctx.catalog.WAIT_DATES)} value={w.field ?? 'start_date'} onChange={(field) => write({ field: field as WaitConfig['field'] })} />
          </TwoColumns>
          <TwoColumns>
            <TextField label={uiCopy.at} type="time" value={w.time ?? '09:00'} onChange={(time) => write({ time })} />
            <SelectField label={uiCopy.timeZone} options={entries(uiCopy.zones)} value={w.tz ?? 'worker'} onChange={(tz) => write({ tz: tz as WaitConfig['tz'] })} />
          </TwoColumns>
        </>
      ) : null}
      {w.mode === 'at' ? <TextField label={uiCopy.dateAndTime} type="datetime-local" value={w.at ?? ''} onChange={(at) => write({ at })} /> : null}
      <SayBox>{waitSentence(w, ctx)}</SayBox>
    </>
  );
}

/** 04 §7.14. */
export function ParallelPanel({ node, edit }: { node: ParallelNode; edit: PanelEdit }) {
  const set = setter(edit, node.id);
  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.parallel} onChange={(value) => set('label', value)} />
      <SayBox>{uiCopy.parallelSay}</SayBox>
      {node.outs.map((out) => (
        <div key={out.key} className="grid grid-cols-[1fr_auto] items-center gap-2">
          <input
            type="text"
            aria-label={uiCopy.branchName}
            value={out.label}
            onChange={(event) => edit.editing.apply((nodes, ed) => ed.renameBranch(nodes, node.id, out.key, event.target.value))}
            className={inputClass}
          />
          {node.outs.length > 2 ? (
            <button type="button" aria-label={uiCopy.removeBranch} onClick={() => edit.editing.apply((nodes, ed) => ed.removeBranch(nodes, node.id, out.key))} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={miniButtonClass} onClick={() => edit.editing.apply((nodes, ed) => ed.addBranch(nodes, node.id))}>
          {uiCopy.addBranch}
        </button>
        <button type="button" className={miniButtonClass} onClick={(event) => edit.openJoinMenu(node.id, event.currentTarget)}>
          {uiCopy.addStepAfterBranches}
        </button>
      </div>
    </>
  );
}

/** 04 §7.15. */
export function RunWorkflowPanel({ node, workflow, summaries, ctx, edit }: { node: RunWorkflowNode; workflow: Workflow; summaries: WorkflowSummary[]; ctx: EngineContext; edit: PanelEdit }) {
  const set = setter(edit, node.id);
  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.runwf} onChange={(value) => set('label', value)} />
      <SelectField label={uiCopy.workflow} placeholder={copy.pickWorkflow} options={otherWorkflowOptions(workflow.id, summaries, ctx)} value={node.target || null} onChange={(value) => set('target', value)} />
    </>
  );
}

/** 04 §7.16. No Delete on End. */
export function EndPanel({ node, edit }: { node: EndNode; edit: PanelEdit }) {
  const set = setter(edit, node.id);
  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.end} onChange={(value) => set('label', value)} />
      <SelectField label={uiCopy.outcome} options={entries(uiCopy.outcomes)} value={node.outcome} onChange={(value) => set('outcome', value)} />
    </>
  );
}
