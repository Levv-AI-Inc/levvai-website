'use client';

import { TriangleAlert } from 'lucide-react';
import { isCheck } from '@flow-studio/engine/checks';
import { copy } from '@flow-studio/engine/copy';
import { roleName } from '@flow-studio/engine/resolve';
import { dwContext } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { DwNode, FlagDo, WfNode, Workflow } from '@flow-studio/model/workflow';
import { KIND_TITLES, uiCopy } from '../copy';
import { actorRoleOptions, whoTargetOptions, withCurrent } from '../options';
import { Fine, FineLine, GroupBox, SayBox } from '../ui/primitives';
import { EscalateAfter, NameField, SelectField, type PanelEdit } from './fields';

/** 04 §7.6, §7.7. */
export function DwPanel({ node, nodes, workflow, ctx, edit }: { node: DwNode; nodes: Record<string, WfNode>; workflow: Workflow; ctx: EngineContext; edit: PanelEdit }) {
  const check = isCheck(node.worker, ctx);
  const inContext = ctx.dws.DW_SET[dwContext(workflow)].filter((id) => isCheck(id, ctx) === check);
  const ids = inContext.includes(node.worker) ? inContext : [node.worker, ...inContext];
  const workers = ids.map((id) => ({ value: id, label: ctx.dws.DW[id].n }));
  const worker = ctx.dws.DW[node.worker];
  const set = (field: string, value: unknown): void => {
    edit.editing.apply((current, ed) => ed.setField(current, node.id, field, value));
  };
  const flagDo = node.flagDo ?? 'note';
  const who = node.flagWho ?? (flagDo === 'stop' ? 'hm' : 'proc');
  const targets = withCurrent(whoTargetOptions(ctx), [who], ctx);
  const setFlag = (mode: FlagDo, target?: string): void => {
    edit.editing.apply((current, ed) => ed.setFlag(current, node.id, mode, target));
  };
  const generated = node.flagNode ? nodes[node.flagNode] : undefined;
  const fallback = node.fallback ?? 'proc';

  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.dw} onChange={(value) => set('label', value)} />
      <SelectField
        label={uiCopy.digitalWorker}
        options={workers}
        value={node.worker}
        onChange={(next) => {
          if (next !== node.worker) edit.editing.apply((current, ed) => ed.setWorker(current, node.id, next));
        }}
      />
      <SayBox>{uiCopy.neverApproves(ctx.dws.DWX[node.worker]?.d ?? '')}</SayBox>
      {check ? (
        <GroupBox>
          <SelectField
            label={uiCopy.flagBox}
            options={ctx.catalog.FLAG_OPTS.workflows.map(([value, label]) => ({ value, label }))}
            value={flagDo}
            onChange={(mode) => {
              if (mode !== flagDo) setFlag(mode as FlagDo);
            }}
          />
          {flagDo === 'escalate' ? (
            <>
              <SelectField label={uiCopy.escalateTo} options={targets} value={who} onChange={(target) => setFlag('escalate', target)} />
              <SayBox>
                <span className="font-semibold">{uiCopy.theyMustAct}</span>
                {uiCopy.flagActRest}
              </SayBox>
              <EscalateAfter
                hours={generated?.kind === 'appr' ? generated.sla : undefined}
                remind={generated?.kind === 'appr' ? generated.remind : undefined}
                onChange={(hours) => edit.editing.apply((current, ed) => ed.setEscalateAfter(current, node.id, null, hours))}
              />
            </>
          ) : null}
          {flagDo === 'stop' ? <SelectField label={uiCopy.whoToTell} options={targets} value={who} onChange={(target) => setFlag('stop', target)} /> : null}
          <FineLine>{copy.panelFlagAlways}</FineLine>
        </GroupBox>
      ) : (
        <>
          {worker?.s === 'setup' ? (
            <Fine tone="warn" icon={<TriangleAlert aria-hidden className="h-3 w-3" />}>
              {uiCopy.helperSetup(roleName(ctx, fallback))}
            </Fine>
          ) : null}
          <SelectField label={uiCopy.handTo} options={withCurrent(actorRoleOptions(ctx), [fallback], ctx)} value={fallback} onChange={(value) => set('fallback', value)} />
        </>
      )}
    </>
  );
}
