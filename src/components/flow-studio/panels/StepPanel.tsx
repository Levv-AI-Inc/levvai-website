'use client';

import { curl } from '@flow-studio/engine/copy';
import { statusText } from '@flow-studio/engine/publish';
import { title } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { WorkflowSummary } from '@flow-studio/model/runtime';
import type { WfNode, Workflow } from '@flow-studio/model/workflow';
import { KIND_TITLES, uiCopy } from '../copy';
import { Drawer } from '../Drawer';
import { iconOf } from '../kinds';
import { ApprovePanel } from './ApprovePanel';
import { CollectPanel } from './CollectPanel';
import { DwPanel } from './DwPanel';
import type { PanelEdit } from './fields';
import { IfPanel } from './IfPanel';
import { EndPanel, NotifyPanel, ParallelPanel, PlanPanel, PolicyPanel, RunWorkflowPanel, TaskPanel, WaitPanel } from './SimplePanels';
import { SystemPanel } from './SystemPanel';
import { WorkflowSettingsPanel } from './WorkflowSettingsPanel';

interface StepPanelProps {
  workflow: Workflow;
  node: WfNode;
  ctx: EngineContext;
  summaries: WorkflowSummary[];
  compact: boolean;
  edit: PanelEdit;
  onClose: () => void;
  onDelete: (id: string) => void;
}

function PanelBody({ workflow, node, ctx, summaries, edit }: Pick<StepPanelProps, 'workflow' | 'node' | 'ctx' | 'summaries' | 'edit'>) {
  const { nodes } = workflow.draft;
  switch (node.kind) {
    case 'trigger':
      return <WorkflowSettingsPanel workflow={workflow} ctx={ctx} edit={edit} />;
    case 'cond':
      return <IfPanel node={node} nodes={nodes} ctx={ctx} edit={edit} />;
    case 'appr':
      return <ApprovePanel node={node} workflow={workflow} ctx={ctx} edit={edit} />;
    case 'policy':
      return <PolicyPanel node={node} ctx={ctx} edit={edit} />;
    case 'plan':
      return <PlanPanel node={node} nodes={nodes} ctx={ctx} edit={edit} />;
    case 'dw':
      return <DwPanel node={node} nodes={nodes} workflow={workflow} ctx={ctx} edit={edit} />;
    case 'collect':
      return <CollectPanel node={node} nodes={nodes} workflow={workflow} ctx={ctx} edit={edit} />;
    case 'task':
      return <TaskPanel node={node} workflow={workflow} ctx={ctx} edit={edit} />;
    case 'system':
      return <SystemPanel node={node} workflow={workflow} ctx={ctx} edit={edit} />;
    case 'notify':
      return <NotifyPanel node={node} ctx={ctx} edit={edit} />;
    case 'wait':
      return <WaitPanel node={node} ctx={ctx} edit={edit} />;
    case 'parallel':
      return <ParallelPanel node={node} edit={edit} />;
    case 'runwf':
      return <RunWorkflowPanel node={node} workflow={workflow} summaries={summaries} ctx={ctx} edit={edit} />;
    case 'end':
      return <EndPanel node={node} edit={edit} />;
    default:
      return null;
  }
}

/** 04 §6: the frame every panel shares. */
export function StepPanel({ workflow, node, ctx, summaries, compact, edit, onClose, onDelete }: StepPanelProps) {
  const { icon: Icon, color } = iconOf(node);
  const kindTitle = KIND_TITLES[node.kind];
  const name = node.kind === 'trigger' ? statusText(workflow) : curl(title(node));
  const deletable = node.kind !== 'trigger' && node.kind !== 'end';
  return (
    <Drawer
      title={kindTitle}
      subtitle={name === kindTitle ? undefined : name}
      compact={compact}
      onClose={onClose}
      icon={<Icon aria-hidden className={`h-[18px] w-[18px] ${node.kind === 'dw' ? 'text-[#7c5cd6]' : color}`} />}
    >
      <PanelBody key={node.id} workflow={workflow} node={node} ctx={ctx} summaries={summaries} edit={edit} />
      {deletable ? (
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          className="self-start rounded-lg border border-rose-100 bg-white px-3 py-2 text-[13px] font-semibold text-rose-700 hover:border-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
        >
          {uiCopy.deleteStep}
        </button>
      ) : null}
    </Drawer>
  );
}
