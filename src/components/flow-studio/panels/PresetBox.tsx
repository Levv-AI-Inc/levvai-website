'use client';

import { Infinity as InfinityIcon, RotateCcw, TriangleAlert } from 'lucide-react';
import { dispOf } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { CollectNode, Disposition, SystemNode, TaskNode, WfNode, Workflow } from '@flow-studio/model/workflow';
import { uiCopy } from '../copy';
import { SelectMenu } from '../SelectMenu';
import { Fine, FineLine, GroupBox, ToggleRow } from '../ui/primitives';
import { entries, NumberField, plain, SelectField, type PanelEdit } from './fields';

type PresetNode = CollectNode | SystemNode | TaskNode;
type Given = WfNode & { gives?: string; reverse?: string };

/** What onboarding recorded in the ledger with this disposition (04 §7.9). */
function ledgerItems(ctx: EngineContext, disposition: Disposition): Given[] {
  return ctx.workflows
    .filter((workflow) => workflow.records[0] === 'onboarding')
    .flatMap((workflow) => Object.values(workflow.draft.nodes) as Given[])
    .filter((node) => !!node.gives && dispOf(node as Parameters<typeof dispOf>[0]) === disposition);
}

const Returned = ({ children }: { children: string }) => <FineLine icon={<RotateCcw aria-hidden className="h-3 w-3" />}>{children}</FineLine>;

/** 04 §7.9: the group box a ready-made step adds right after Name. Add to HR system and Accounts & access have none. */
export function PresetBox({ node, ctx, edit }: { node: PresetNode; workflow: Workflow; ctx: EngineContext; edit: PanelEdit }) {
  const set = (field: string, value: unknown): void => {
    edit.editing.apply((current, ed) => ed.setField(current, node.id, field, value));
  };
  const collect = node as CollectNode;
  const task = node as TaskNode;
  const system = node as SystemNode;
  switch (node.preset) {
    case 'idrtw':
      return (
        <GroupBox accent title={uiCopy.rtwTitle}>
          {Object.entries(ctx.presets.RTW).map(([country, rule]) => (
            <div key={country} className="flex gap-2 text-xs">
              <span className="w-16 flex-none font-bold">{country}</span>
              <span>{rule}</span>
            </div>
          ))}
          <ToggleRow label={uiCopy.rtwRevisit} help={uiCopy.rtwRevisitHelp} on={collect.revisit !== false} onToggle={(on) => set('revisit', on)} />
        </GroupBox>
      );
    case 'bgcheck':
      return (
        <GroupBox accent title={uiCopy.bgTitle}>
          <SelectField label={uiCopy.bgPackage} options={entries(ctx.presets.BGPKG)} value={collect.pkg ?? 'std'} onChange={(value) => set('pkg', value)} />
          <ToggleRow label={uiCopy.bgFsAuto} help={uiCopy.bgFsAutoHelp} on={collect.fsAuto !== false} onToggle={(on) => set('fsAuto', on)} />
          <Fine tone="warn" icon={<TriangleAlert aria-hidden className="h-3 w-3" />}>{uiCopy.bgAdverse}</Fine>
        </GroupBox>
      );
    case 'docs':
      return (
        <GroupBox accent title={uiCopy.docsTitle}>
          <SelectMenu multiple aria-label={uiCopy.docsTitle} placeholder={uiCopy.docsPlaceholder} options={plain(uiCopy.docsOptions)} value={collect.items ?? []} onChange={(value) => set('items', value)} />
          <SelectField label={uiCopy.signedBy} options={entries(uiCopy.signers)} value={collect.signer ?? 'worker'} onChange={(value) => set('signer', value)} />
        </GroupBox>
      );
    case 'training':
      return (
        <GroupBox accent title={uiCopy.coursesTitle}>
          <SelectMenu multiple aria-label={uiCopy.coursesTitle} placeholder={uiCopy.coursesPlaceholder} options={plain(uiCopy.coursesOptions)} value={collect.items ?? []} onChange={(value) => set('items', value)} />
          <SelectField label={uiCopy.due} options={entries(uiCopy.dueOptions)} value={collect.due ?? 'start'} onChange={(value) => set('due', value)} />
        </GroupBox>
      );
    case 'equip':
      return (
        <GroupBox accent title={uiCopy.equipTitle}>
          <SelectMenu multiple aria-label={uiCopy.equipTitle} placeholder={uiCopy.equipPlaceholder} options={plain(uiCopy.equipOptions)} value={collect.kit ?? []} onChange={(value) => set('kit', value)} />
          <SelectField label={uiCopy.shipTo} options={entries(uiCopy.shipOptions)} value={collect.ship ?? 'home'} onChange={(value) => set('ship', value)} />
        </GroupBox>
      );
    case 'pay':
      return (
        <GroupBox accent title={uiCopy.payTitle}>
          <FineLine>{uiCopy.payFine}</FineLine>
        </GroupBox>
      );
    case 'revoke': {
      const items = ledgerItems(ctx, 'remove');
      return (
        <GroupBox accent title={uiCopy.revokeTitle}>
          {items.length > 0 ? items.map((item) => <Returned key={item.id}>{uiCopy.revokeItem(item.gives ?? '', item.reverse ?? '')}</Returned>) : <FineLine>{uiCopy.nothingRecorded}</FineLine>}
          <SelectField label={uiCopy.revokeWhen} options={entries(uiCopy.revokeOptions)} value={system.when ?? 'last'} onChange={(value) => set('when', value)} />
        </GroupBox>
      );
    }
    case 'recover': {
      const items = ledgerItems(ctx, 'return');
      return (
        <GroupBox accent title={uiCopy.recoverTitle}>
          {items.length > 0 ? items.map((item) => <Returned key={item.id}>{item.gives ?? ''}</Returned>) : <FineLine>{uiCopy.nothingIssued}</FineLine>}
          <SelectField label={uiCopy.recoverHow} options={entries(uiCopy.recoverOptions)} value={task.method ?? 'courier'} onChange={(value) => set('method', value)} />
          <NumberField
            label={uiCopy.recoverDays}
            value={task.chaseDays ?? 5}
            min={1}
            onChange={(value) => {
              if (value !== null) set('chaseDays', value);
            }}
          />
          <FineLine>{uiCopy.recoverFine}</FineLine>
        </GroupBox>
      );
    }
    case 'finalts':
      return <Plain title={uiCopy.finalTitle} text={uiCopy.finalFine} />;
    case 'handover':
      return <Plain title={uiCopy.handoverTitle} text={uiCopy.handoverFine} />;
    case 'exitconf':
      return (
        <GroupBox accent title={uiCopy.exitTitle}>
          <FineLine icon={<InfinityIcon aria-hidden className="h-3 w-3" />}>{uiCopy.exitFine}</FineLine>
        </GroupBox>
      );
    case 'hrclose':
      return <Plain title={uiCopy.hrCloseTitle} text={uiCopy.hrCloseFine} />;
    case 'wclose':
      return <Plain title={uiCopy.woCloseTitle} text={uiCopy.woCloseFine} />;
    case 'ledger':
      return <Plain title={uiCopy.ledgerTitle} text={uiCopy.ledgerFine} />;
    default:
      return null;
  }
}

function Plain({ title, text }: { title: string; text: string }) {
  return (
    <GroupBox accent title={title}>
      <FineLine>{text}</FineLine>
    </GroupBox>
  );
}
