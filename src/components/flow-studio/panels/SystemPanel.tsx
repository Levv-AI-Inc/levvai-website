'use client';

import { RotateCw, Sparkles, TriangleAlert, X } from 'lucide-react';
import { dwContext } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { SysAction, SystemConfig, SystemNode, Workflow } from '@flow-studio/model/workflow';
import { KIND_TITLES, uiCopy } from '../copy';
import { actorRoleOptions, withCurrent } from '../options';
import { SelectMenu } from '../SelectMenu';
import { Fine, FineLine, GroupBox, inputClass, miniButtonClass, SayBox } from '../ui/primitives';
import { entries, MultiField, NameField, NumberField, plain, SelectField, TwoColumns, type PanelEdit } from './fields';
import { GivesBlock } from './GivesBlock';
import { PresetBox } from './PresetBox';

/** 04 §7.11 item 12: only helpers that can do system work, by context. */
const SYSTEM_WORKERS: Record<ReturnType<typeof dwContext>, string[]> = { onboarding: ['access'], access: ['access'], offboarding: ['sweeper'], workflows: [] };

/** 04 §7.11. */
export function SystemPanel({ node, workflow, ctx, edit }: { node: SystemNode; workflow: Workflow; ctx: EngineContext; edit: PanelEdit }) {
  const { sys } = node;
  const def = ctx.systems.SYS[node.system] ?? ctx.systems.SYS.Workday;
  const set = (field: string, value: unknown): void => {
    edit.editing.apply((current, ed) => ed.setField(current, node.id, field, value));
  };
  const setSys = (fields: Partial<SystemConfig>): void => {
    edit.editing.apply((current, ed) => ed.setSysFields(current, node.id, fields));
  };
  const setMap = (map: [string, string][]): void => setSys({ map });
  const action = sys.action;
  const keys = Array.from(new Set([...(ctx.systems.SYS_KEY[node.system] ?? []), 'Work email', 'Levv worker ID']));
  const objects = def.obj.includes(sys.object) ? def.obj : [sys.object, ...def.obj];
  const failOptions = [
    { value: 'task', label: uiCopy.sysFailTask },
    { value: 'path', label: uiCopy.sysFailPath },
    { value: 'pause', label: uiCopy.sysFailPause },
  ];
  const workers = SYSTEM_WORKERS[dwContext(workflow)];
  const via = node.via ?? '';
  const doneBy = [{ value: '', label: uiCopy.levvConnection }, ...(via && !workers.includes(via) ? [via, ...workers] : workers).map((id) => ({ value: id, label: uiCopy.workerOption(ctx.dws.DW[id]?.n ?? id) }))];
  const levvFields = (current: string) => plain(ctx.catalog.LEVV_F.includes(current) ? ctx.catalog.LEVV_F : [current, ...ctx.catalog.LEVV_F]);

  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.system} onChange={(value) => set('label', value)} />
      <PresetBox node={node} workflow={workflow} ctx={ctx} edit={edit} />
      <SelectField
        label={uiCopy.system}
        options={plain(Object.keys(ctx.systems.SYS))}
        value={node.system}
        onChange={(next) => {
          if (next !== node.system) edit.editing.apply((current, ed) => ed.setSystem(current, node.id, next));
        }}
      />
      {def.st === 'off' ? (
        <Fine tone="warn" icon={<TriangleAlert aria-hidden className="h-3 w-3" />}>{uiCopy.notConnected(node.system)}</Fine>
      ) : (
        <Fine tone="ok" icon={<span aria-hidden className="mt-1 block h-2 w-2 rounded-full bg-emerald-500" />}>{uiCopy.connected(def.seen)}</Fine>
      )}
      <TwoColumns>
        <SelectField label={uiCopy.action} options={entries(ctx.systems.SYS_ACT)} value={action} onChange={(value) => setSys({ action: value as SysAction })} />
        {action !== 'check' ? (
          <SelectField
            label={uiCopy.what}
            options={plain(objects)}
            value={sys.object}
            onChange={(next) => {
              if (next !== sys.object) edit.editing.apply((current, ed) => ed.setSystemObject(current, node.id, next));
            }}
          />
        ) : null}
      </TwoColumns>
      {action === 'wait' ? (
        <>
          <SelectField label={uiCopy.waitUntilIts} options={plain(uiCopy.waitStates)} value={sys.state} onChange={(value) => setSys({ state: value as SystemConfig['state'] })} />
          <FineLine>{uiCopy.waitFine(node.system, sys.waitH)}</FineLine>
        </>
      ) : null}
      {action === 'check' ? <SayBox>{uiCopy.checkSay(node.system)}</SayBox> : null}
      {action === 'create' || action === 'update' ? (
        <GroupBox title={uiCopy.fieldsSent(node.system)}>
          <FineLine icon={<Sparkles aria-hidden className="h-3 w-3 text-cyan-600" />}>{uiCopy.novaMatched(node.system, sys.object.toLowerCase())}</FineLine>
          {sys.map.map(([from, to], index) => (
            <div key={index} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <SelectMenu aria-label={uiCopy.levvField} options={levvFields(from)} value={from} onChange={(next) => setMap(sys.map.map((row, at) => (at === index ? [next, row[1]] : row)))} />
              <span aria-hidden className="text-slate-500">→</span>
              <input
                type="text"
                aria-label={uiCopy.systemField(node.system)}
                value={to}
                onChange={(event) => setMap(sys.map.map((row, at) => (at === index ? [row[0], event.target.value] : row)))}
                className={inputClass}
              />
              <button type="button" aria-label={uiCopy.remove} onClick={() => setMap(sys.map.filter((_, at) => at !== index))} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div>
            <button type="button" className={miniButtonClass} onClick={() => setMap([...sys.map, ['Job title', '']])}>
              {uiCopy.addField}
            </button>
          </div>
          <SelectField label={uiCopy.findBy} options={plain(keys.includes(sys.match) ? keys : [sys.match, ...keys])} value={sys.match} onChange={(match) => setSys({ match })} />
          <FineLine>{uiCopy.findFine}</FineLine>
        </GroupBox>
      ) : null}
      {action !== 'wait' && action !== 'check' ? (
        <>
          <MultiField label={uiCopy.bringBack} placeholder={uiCopy.bringPlaceholder} options={plain(def.back)} value={sys.read} onChange={(read) => setSys({ read })} />
          <FineLine>{uiCopy.bringFine}</FineLine>
        </>
      ) : null}
      {action === 'create' || action === 'update' || action === 'close' ? (
        <>
          <SelectField
            label={uiCopy.afterSending}
            options={[
              { value: 'confirm', label: uiCopy.afterConfirm(node.system) },
              { value: 'none', label: uiCopy.afterNone },
            ]}
            value={sys.wait}
            onChange={(wait) => setSys({ wait: wait as SystemConfig['wait'] })}
          />
          {sys.wait === 'confirm' ? (
            <NumberField
              label={uiCopy.giveUpAfter}
              value={sys.waitH}
              min={1}
              max={168}
              onChange={(waitH) => {
                if (waitH !== null) setSys({ waitH });
              }}
            />
          ) : null}
        </>
      ) : null}
      <GroupBox>
        <FineLine icon={<RotateCw aria-hidden className="h-3 w-3" />}>{uiCopy.retries(sys.retries)}</FineLine>
        <SelectField
          label={uiCopy.ifItFails}
          options={failOptions}
          value={sys.onFail}
          onChange={(mode) => {
            if (mode !== sys.onFail) edit.editing.apply((current, ed) => ed.setSystemOnFail(current, node.id, mode as SystemConfig['onFail']));
          }}
        />
        {sys.onFail === 'task' ? <SelectField label={uiCopy.whoFixes} options={withCurrent(actorRoleOptions(ctx), [sys.failRole], ctx)} value={sys.failRole} onChange={(failRole) => setSys({ failRole })} /> : null}
      </GroupBox>
      <SelectField label={uiCopy.doneBy} options={doneBy} value={via} onChange={(value) => set('via', value)} />
      <GivesBlock node={node} ctx={ctx} onFields={(fields) => edit.editing.apply((current, ed) => ed.setFields(current, node.id, fields))} />
    </>
  );
}
