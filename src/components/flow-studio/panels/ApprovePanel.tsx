'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { copy, curl } from '@flow-studio/engine/copy';
import { approveSentence, conditionText, whoMode } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { Group, Row } from '@flow-studio/model/condition';
import type { ApproveNode, Workflow } from '@flow-studio/model/workflow';
import { ApiFailure, apiWrite } from '../api';
import { KIND_TITLES, uiCopy } from '../copy';
import { approvalGroupOptions, approverRoleOptions, materialOptions, peopleOptions, withCurrent } from '../options';
import { SelectMenu, type SelectOption } from '../SelectMenu';
import { Details, Field, Fine, FineLine, inputClass, miniButtonClass, SayBox, ToggleRow } from '../ui/primitives';
import { Chaser } from './Chaser';
import { ConditionEditor } from './ConditionEditor';
import { MultiField, NameField, SelectField, type PanelEdit } from './fields';

const WHO_OPTIONS: SelectOption[] = [
  { value: 'roles', label: uiCopy.whoRoles },
  { value: 'group', label: uiCopy.whoGroup },
  { value: 'person', label: uiCopy.whoPerson },
];
const HOW_MANY_OPTIONS: SelectOption[] = [
  { value: 'all', label: uiCopy.howManyAll },
  { value: 'any', label: uiCopy.howManyAny },
  { value: 'order', label: uiCopy.howManyOrder },
];
const REJECT_OPTIONS: SelectOption[] = [
  { value: 'requester', label: uiCopy.rejectRequester },
  { value: 'previous', label: uiCopy.rejectPrevious },
  { value: 'end', label: uiCopy.rejectEnd },
];

/** Leads with the names in bold, per 04 §7.3. */
function Sentence({ text, lead }: { text: string; lead: string }) {
  if (!lead || !text.startsWith(lead)) return <>{text}</>;
  return (
    <>
      <span className="font-semibold">{lead}</span>
      {text.slice(lead.length)}
    </>
  );
}

type SetMessage = { tone: 'ok' | 'warn'; text: string } | null;

/** 04 §7.3 item 6, "Only needed when". */
function OnlyNeededWhen({ node, workflow, ctx, edit }: { node: ApproveNode; workflow: Workflow; ctx: EngineContext; edit: PanelEdit }) {
  const [text, setText] = useState(node.whenPrompt ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<SetMessage>(null);
  const rows = node.when?.rows ?? [];
  const has = rows.length > 0;

  const run = async (): Promise<void> => {
    if (busy) return;
    if (!text.trim()) {
      edit.toast(copy.sayWhen);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      // The route looks the step up, so a step added a moment ago has to be saved first.
      await edit.editing.flush();
      const result = await apiWrite<{ rows: (Row | Group)[]; join: 'all' | 'any' }>('POST', '/api/flow-studio/nova/condition', { text, workflowId: workflow.id, nodeId: node.id });
      const when = { join: result.join, rows: result.rows };
      edit.editing.apply((nodes, ed) => ed.setWhen(nodes, node.id, when, text));
      setMessage({ tone: 'ok', text: copy.readAs(conditionText(when, ctx.catalog)) });
    } catch (error) {
      if (error instanceof ApiFailure && error.code === 'NO_MATCH') setMessage({ tone: 'warn', text: copy.couldNotMatch });
      else edit.toast(uiCopy.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const setCondition = (next: { join?: 'all' | 'any'; rows?: (Row | Group)[] }): void => {
    const when = { join: next.join ?? node.when?.join ?? 'all', rows: next.rows ?? rows };
    edit.editing.apply((nodes, ed) => ed.setWhenCondition(nodes, node.id, when));
  };

  return (
    <div className={`flex flex-col gap-2 rounded-[10px] border p-2.5 ${has ? 'border-cyan-600' : 'border-slate-200'}`}>
      <span className="text-xs font-semibold text-slate-500">{uiCopy.onlyNeededWhen}</span>
      <FineLine>{uiCopy.alwaysAsked}</FineLine>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          aria-label={uiCopy.onlyNeededWhen}
          value={text}
          placeholder={copy.whenPlaceholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void run();
            }
          }}
          className={inputClass}
        />
        <button type="button" disabled={busy} onClick={() => void run()} className={`${miniButtonClass} inline-flex flex-none items-center gap-1 whitespace-nowrap`}>
          {busy ? <Loader2 aria-hidden className="h-3 w-3 animate-spin" /> : null}
          {busy ? uiCopy.setting : uiCopy.setButton}
        </button>
      </div>
      {message ? (
        <Fine tone={message.tone} icon={<Sparkles aria-hidden className="h-3 w-3" />}>
          {message.text}
        </Fine>
      ) : null}
      {has ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span id={`${node.id}-asked`}>{uiCopy.askedOnlyIfLabel}</span>
            <SelectMenu
              size="sm"
              aria-labelledby={`${node.id}-asked`}
              options={[
                { value: 'all', label: uiCopy.allOfThese },
                { value: 'any', label: uiCopy.anyOfThese },
              ]}
              value={node.when?.join ?? 'all'}
              onChange={(join) => setCondition({ join: join as 'all' | 'any' })}
            />
          </div>
          <ConditionEditor rows={rows} ctx={ctx} onChange={(next) => setCondition({ rows: next })} />
          <div>
            <button
              type="button"
              className={miniButtonClass}
              onClick={() => {
                setText('');
                setMessage(null);
                edit.editing.apply((nodes, ed) => ed.clearWhen(nodes, node.id));
              }}
            >
              {uiCopy.alwaysAsk}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

interface ApprovePanelProps {
  node: ApproveNode;
  workflow: Workflow;
  ctx: EngineContext;
  edit: PanelEdit;
}

/** 04 §7.3. */
export function ApprovePanel({ node, workflow, ctx, edit }: ApprovePanelProps) {
  const who = whoMode(node);
  const set = (field: string, value: unknown): void => {
    edit.editing.apply((nodes, ed) => ed.setField(nodes, node.id, field, value));
  };
  const rolesLead = curl(node.roles.map((key) => ctx.people.ROLES[key]?.n ?? key).join(', '));
  const sentence = curl(approveSentence(node, ctx) ?? '');
  const groupKey = (node.roles[0] ?? '').slice(2);
  const personName = (node.roles[0] ?? '').slice(2);
  const people = peopleOptions(ctx);
  const hasWhen = (node.when?.rows?.length ?? 0) > 0;

  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.appr} onChange={(label) => set('label', label)} />
      <SelectField
        label={uiCopy.whoApproves}
        options={WHO_OPTIONS}
        value={who}
        onChange={(next) => {
          if (next !== who) edit.editing.apply((nodes, ed) => ed.setApprovers(nodes, node.id, { who: next as 'roles' | 'group' | 'person' }));
        }}
      />
      {who === 'roles' ? (
        <>
          <SayBox>
            <Sentence text={sentence} lead={node.roles.length > 0 ? rolesLead : ''} />
          </SayBox>
          <SelectMenu
            multiple
            aria-label={uiCopy.roles}
            placeholder={copy.chooseRoles}
            options={withCurrent(approverRoleOptions(ctx), node.roles, ctx)}
            value={node.roles}
            onChange={(roles) => edit.editing.apply((nodes, ed) => ed.setApprovers(nodes, node.id, { who: 'roles', roles }))}
          />
          {node.roles.length >= 2 ? <SelectField label={uiCopy.howMany} options={HOW_MANY_OPTIONS} value={node.mode ?? 'all'} onChange={(mode) => set('mode', mode)} /> : null}
        </>
      ) : null}
      {who === 'group' ? (
        <>
          <SelectMenu
            aria-label={uiCopy.group}
            placeholder={copy.chooseGroup}
            options={approvalGroupOptions(ctx)}
            value={node.roles[0] ?? null}
            onChange={(group) => edit.editing.apply((nodes, ed) => ed.setApprovers(nodes, node.id, { who: 'group', group }))}
          />
          {ctx.people.GROUPS[groupKey] ? (
            <SayBox>
              <Sentence text={sentence} lead={`${ctx.people.GROUPS[groupKey].n}:`} />
            </SayBox>
          ) : null}
        </>
      ) : null}
      {who === 'person' ? (
        <>
          <Field label={uiCopy.person}>
            {(labelId) => (
              <SelectMenu
                aria-labelledby={labelId}
                placeholder={copy.choosePerson}
                options={people}
                value={personName || null}
                onChange={(person) => edit.editing.apply((nodes, ed) => ed.setApprovers(nodes, node.id, { who: 'person', person }))}
              />
            )}
          </Field>
          <SelectField
            label={uiCopy.backup}
            options={[{ value: '', label: uiCopy.noBackup }, ...people.filter((option) => option.value !== personName)]}
            value={node.backup ?? ''}
            onChange={(backup) => set('backup', backup)}
          />
          <FineLine>{copy.approvePersonSentence}</FineLine>
        </>
      ) : null}
      <FineLine icon={<Sparkles aria-hidden className="h-3 w-3 text-cyan-600" />}>{uiCopy.briefNote}</FineLine>
      <Chaser node={node} onChange={set} />
      <Details summary={uiCopy.advanced} open={hasWhen}>
        <OnlyNeededWhen node={node} workflow={workflow} ctx={ctx} edit={edit} />
        <div className="w-1/2">
          <SelectField label={uiCopy.ifRejected} options={REJECT_OPTIONS} value={node.reject ?? 'requester'} onChange={(reject) => set('reject', reject)} />
        </div>
        <ToggleRow label={uiCopy.signingAuthority} help={uiCopy.signingAuthorityHelp} on={node.authority === true} onToggle={(on) => set('authority', on)} />
        <MultiField label={uiCopy.askAgainFields} placeholder={uiCopy.chooseFields} options={materialOptions(ctx)} value={node.material ?? []} onChange={(material) => set('material', material)} />
        <ToggleRow label={uiCopy.askAgainDown} help={uiCopy.askAgainDownHelp} on={node.reaskOnDecrease !== false} onToggle={(on) => set('reaskOnDecrease', on)} />
      </Details>
    </>
  );
}
