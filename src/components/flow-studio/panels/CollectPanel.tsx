'use client';

import { useMemo, useState } from 'react';
import type { EngineContext } from '@flow-studio/model/context';
import type { CollectNode, WfNode, Workflow } from '@flow-studio/model/workflow';
import { KIND_TITLES, uiCopy } from '../copy';
import { actorRoleOptions, deciderRoleOptions, providerOptions, requiredItemOptions, withCurrent } from '../options';
import { SelectMenu, type SelectOption } from '../SelectMenu';
import { Field, FineLine, GroupBox } from '../ui/primitives';
import { Chaser } from './Chaser';
import { EscalateAfter, NameField, SelectField, type PanelEdit } from './fields';
import { GivesBlock } from './GivesBlock';
import { PresetBox } from './PresetBox';

const VERIFY: SelectOption[] = [
  { value: 'auto', label: uiCopy.verifyAuto },
  { value: 'auto_person', label: uiCopy.verifyAutoPerson },
  { value: 'person', label: uiCopy.verifyPerson },
];

/** 04 §7.8 item 7, in its own order. The seed names the second Digital Worker "Access"; 04 §16 item 9 says otherwise. */
const CHECKER_KEYS = ['persona', 'checkr', 'esign', 'workday', 'servicenow', 'dw:docs', 'dw:access', 'onfido', 'yoti'];

function checkerOptions(ctx: EngineContext): SelectOption[] {
  return CHECKER_KEYS.map((value) => ({
    value,
    label: value.startsWith('dw:') ? uiCopy.workerOption(ctx.dws.DW[value.slice(3)].n) : ctx.presets.CHECKERS[value] ?? value,
  }));
}

/** 04 §7.8. */
export function CollectPanel({ node, nodes, workflow, ctx, edit }: { node: CollectNode; nodes: Record<string, WfNode>; workflow: Workflow; ctx: EngineContext; edit: PanelEdit }) {
  const set = (field: string, value: unknown): void => {
    edit.editing.apply((current, ed) => ed.setField(current, node.id, field, value));
  };
  // An item typed here stays on the list after it is unticked, for as long as the panel is open.
  const [added, setAdded] = useState<string[]>([]);
  const items = node.items ?? [];
  const options = useMemo(() => {
    const base = requiredItemOptions(items, ctx);
    const known = new Set(base.map((option) => option.value));
    return [...base, ...added.filter((item) => !known.has(item)).map((item) => ({ value: item, label: item }))];
    // ctx.workflows follows the open workflow, so `workflow` stands in for it here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, added, ctx, workflow]);
  const generated = node.failNode ? nodes[node.failNode] : undefined;
  const failRole = node.failRole ?? 'people_ops';
  const provider = node.from ?? 'worker';

  return (
    <>
      <NameField value={node.label} placeholder={KIND_TITLES.collect} onChange={(value) => set('label', value)} />
      <PresetBox node={node} workflow={workflow} ctx={ctx} edit={edit} />
      <SelectField label={uiCopy.whoProvides} options={withCurrent(providerOptions(ctx), [provider], ctx)} value={provider} onChange={(value) => set('from', value)} />
      <Chaser node={node} onChange={set} />
      <Field label={uiCopy.whatRequired}>
        {(labelId) => (
          <SelectMenu
            multiple
            allowAdd
            aria-labelledby={labelId}
            placeholder={uiCopy.chooseOrAdd}
            options={options}
            value={items}
            onChange={(value) => set('items', value)}
            onAdd={(label) => {
              setAdded((current) => [...current, label]);
              set('items', [...items, label]);
            }}
          />
        )}
      </Field>
      <SelectField label={uiCopy.howVerified} options={VERIFY} value={node.verify} onChange={(value) => set('verify', value)} />
      {node.verify !== 'person' ? <SelectField label={uiCopy.checkedBy} options={checkerOptions(ctx)} value={node.checker} onChange={(value) => set('checker', value)} /> : null}
      {node.verify !== 'auto' ? <SelectField label={uiCopy.reviewer} options={withCurrent(actorRoleOptions(ctx), [node.reviewer], ctx)} value={node.reviewer} onChange={(value) => set('reviewer', value)} /> : null}
      <GroupBox>
        <SelectField
          label={uiCopy.ifItFails}
          options={[
            { value: 'role', label: uiCopy.thenEscalate },
            { value: 'approval', label: uiCopy.failAsk },
          ]}
          value={node.failTo}
          onChange={(value) => {
            if (value !== node.failTo) edit.editing.apply((current, ed) => ed.setCollectFail(current, node.id, value as CollectNode['failTo']));
          }}
        />
        {node.failTo === 'role' ? (
          <>
            <SelectMenu
              aria-label={uiCopy.escalateTo}
              options={withCurrent(actorRoleOptions(ctx), [failRole], ctx)}
              value={failRole}
              onChange={(role) => edit.editing.apply((current, ed) => ed.setCollectFail(current, node.id, 'role', role))}
            />
            <EscalateAfter
              hours={generated?.kind === 'appr' ? generated.sla : undefined}
              remind={generated?.kind === 'appr' ? generated.remind : undefined}
              onChange={(hours) => edit.editing.apply((current, ed) => ed.setEscalateAfter(current, node.id, null, hours))}
            />
          </>
        ) : (
          <>
            <SelectMenu multiple aria-label={uiCopy.whoDecides} placeholder={uiCopy.chooseDeciders} options={withCurrent(deciderRoleOptions(ctx), node.failRoles ?? [], ctx)} value={node.failRoles ?? []} onChange={(value) => set('failRoles', value)} />
            <FineLine>{uiCopy.decidersFine}</FineLine>
          </>
        )}
      </GroupBox>
      <GivesBlock node={node} ctx={ctx} onFields={(fields) => edit.editing.apply((current, ed) => ed.setFields(current, node.id, fields))} />
    </>
  );
}
