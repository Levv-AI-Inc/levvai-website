'use client';

import { CornerDownRight } from 'lucide-react';
import { copy, curl } from '@flow-studio/engine/copy';
import { ifTopLine, laneSteps, mergeTitle, pathMode } from '@flow-studio/engine/text';
import type { Group, Row } from '@flow-studio/model/condition';
import type { EngineContext } from '@flow-studio/model/context';
import type { CondNode, CondPath, Out, PathThen, WfNode } from '@flow-studio/model/workflow';
import { KIND_TITLES, uiCopy } from '../copy';
import { whoTargetOptions, withCurrent } from '../options';
import { SelectMenu, type SelectOption } from '../SelectMenu';
import { Details, Field, FineLine, inputClass, miniButtonClass } from '../ui/primitives';
import { ConditionEditor } from './ConditionEditor';
import { EscalateAfter, NameField, SelectField, type PanelEdit } from './fields';

type PathOut = Out & Partial<CondPath>;

function thenOptions(mode: PathThen, merge: string): SelectOption[] {
  const options: SelectOption[] = [
    { value: 'continue', label: copy.carryOnTo(merge) },
    { value: 'approve', label: uiCopy.thenApprove },
    { value: 'escalate', label: uiCopy.thenEscalate },
    { value: 'reject', label: uiCopy.thenReject },
    { value: 'stop', label: uiCopy.thenStop },
  ];
  return mode === 'custom' ? [...options, { value: 'custom', label: uiCopy.thenCustom }] : options;
}

/** The "Then" section of a path card or the Otherwise card (04 §7.2). */
function ThenSection({ cond, out, nodes, ctx, edit }: { cond: CondNode; out: PathOut; nodes: Record<string, WfNode>; ctx: EngineContext; edit: PanelEdit }) {
  const mode = pathMode(nodes, cond.id, out.key);
  const merge = curl(mergeTitle(nodes, cond));
  const isElse = out.key === 'else';
  const who = (isElse ? cond.elseWho : out.who) ?? (mode === 'stop' ? 'hm' : mode === 'approve' ? 'proc' : 'cco');
  const generatedId = isElse ? cond.elseNode : out.node;
  const generated = generatedId ? nodes[generatedId] : undefined;
  const set = (next: PathThen, target?: string): void => {
    edit.editing.apply((current, ed) => ed.setPathThen(current, cond.id, out.key, next, target));
  };
  const targets = withCurrent(whoTargetOptions(ctx), [who], ctx);
  return (
    <div className="flex flex-col gap-2 border-t border-dashed border-slate-200 pt-2.5">
      <SelectField
        label={uiCopy.then}
        options={thenOptions(mode, merge)}
        value={mode}
        onChange={(next) => {
          if (next !== 'custom' && next !== mode) set(next as PathThen);
        }}
      />
      {mode === 'approve' ? (
        <>
          <SelectField label={uiCopy.whoApprovesLabel} options={targets} value={who} onChange={(target) => set('approve', target)} />
          <FineLine>{copy.thenCarriesOn(merge)}</FineLine>
        </>
      ) : null}
      {mode === 'escalate' ? (
        <>
          <SelectField label={uiCopy.escalateTo} options={targets} value={who} onChange={(target) => set('escalate', target)} />
          <FineLine>{copy.escalateExplain}</FineLine>
          <EscalateAfter
            hours={generated?.kind === 'appr' ? generated.sla : undefined}
            remind={generated?.kind === 'appr' ? generated.remind : undefined}
            onChange={(hours) => edit.editing.apply((current, ed) => ed.setEscalateAfter(current, cond.id, out.key, hours))}
          />
        </>
      ) : null}
      {mode === 'stop' ? <SelectField label={uiCopy.whoToTell} options={targets} value={who} onChange={(target) => set('stop', target)} /> : null}
      {mode === 'custom' ? <FineLine>{curl(copy.customPath(laneSteps(nodes, cond.id, out.key)))}</FineLine> : null}
    </div>
  );
}

function PathCard({ cond, out, index, count, nodes, ctx, edit }: { cond: CondNode; out: PathOut; index: number; count: number; nodes: Record<string, WfNode>; ctx: EngineContext; edit: PanelEdit }) {
  const setCondition = (next: { join?: 'all' | 'any'; rows?: (Row | Group)[] }): void => {
    edit.editing.apply((current, ed) => ed.setPathCondition(current, cond.id, out.key, next));
  };
  const joinLabel = `${cond.id}-${out.key}-join`;
  return (
    <div role="group" aria-label={out.label || uiCopy.namePath} className="flex flex-col gap-2.5 rounded-[10px] border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-700">{index + 1}</span>
        <input
          type="text"
          aria-label={uiCopy.pathName}
          placeholder={uiCopy.namePath}
          value={out.label ?? ''}
          onChange={(event) => edit.editing.apply((current, ed) => ed.renamePath(current, cond.id, out.key, event.target.value))}
          className={`${inputClass} flex-1`}
        />
        {count >= 2 ? (
          <button
            type="button"
            onClick={() => {
              if (edit.editing.apply((current, ed) => ed.deletePath(current, cond.id, out.key))) edit.toast(copy.pathDeleted);
            }}
            className="flex-none rounded-md px-1.5 py-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
          >
            {uiCopy.deletePath}
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <span id={joinLabel}>{uiCopy.takePath}</span>
        <SelectMenu
          size="sm"
          aria-labelledby={joinLabel}
          options={[
            { value: 'all', label: uiCopy.allWord },
            { value: 'any', label: uiCopy.anyWord },
          ]}
          value={out.join ?? 'all'}
          onChange={(join) => setCondition({ join: join as 'all' | 'any' })}
        />
        <span>{uiCopy.ofTheseTrue}</span>
      </div>
      <ConditionEditor rows={out.rows ?? []} ctx={ctx} onChange={(rows) => setCondition({ rows })} />
      <ThenSection cond={cond} out={out} nodes={nodes} ctx={ctx} edit={edit} />
    </div>
  );
}

/** 04 §7.2. */
export function IfPanel({ node, nodes, ctx, edit }: { node: CondNode; nodes: Record<string, WfNode>; ctx: EngineContext; edit: PanelEdit }) {
  const outs = node.outs as PathOut[];
  const paths = outs.filter((out) => out.key !== 'else');
  const otherwise = outs.find((out) => out.key === 'else') as PathOut;
  const label = curl(otherwise.label ?? copy.otherwise);
  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.cond} onChange={(value) => edit.editing.apply((current, ed) => ed.setField(current, node.id, 'label', value))} />
      <FineLine>{curl(ifTopLine(nodes, node))}</FineLine>
      {paths.map((out, index) => (
        <PathCard key={out.key} cond={node} out={out} index={index} count={paths.length} nodes={nodes} ctx={ctx} edit={edit} />
      ))}
      <div role="group" aria-label={label} className="flex flex-col gap-2.5 rounded-[10px] border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2">
          <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-slate-200 text-slate-500">
            <CornerDownRight aria-hidden className="h-3 w-3" />
          </span>
          <span className="font-bold">{label}</span>
          <span className="text-xs text-slate-500">{copy.otherwiseCard}</span>
        </div>
        <ThenSection cond={node} out={otherwise} nodes={nodes} ctx={ctx} edit={edit} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={miniButtonClass} onClick={() => edit.editing.apply((current, ed) => ed.addPath(current, node.id))}>
          {uiCopy.addPath}
        </button>
        <button type="button" className={miniButtonClass} onClick={(event) => edit.openJoinMenu(node.id, event.currentTarget)}>
          {uiCopy.addStepAfterPaths}
        </button>
      </div>
      <Details summary={uiCopy.advanced}>
        <Field label={uiCopy.whenMissing}>
          {(labelId) => (
            <SelectMenu
              aria-labelledby={labelId}
              options={[
                { value: 'ask', label: uiCopy.missingAsk },
                { value: 'cautious', label: uiCopy.missingCautious },
                { value: 'otherwise', label: uiCopy.missingOtherwise(label) },
              ]}
              value={node.onMissing ?? 'ask'}
              onChange={(value) => edit.editing.apply((current, ed) => ed.setField(current, node.id, 'onMissing', value))}
            />
          )}
        </Field>
      </Details>
    </>
  );
}
