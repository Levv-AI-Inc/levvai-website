'use client';

import { Split } from 'lucide-react';
import { useId } from 'react';
import { curl } from '@flow-studio/engine/copy';
import { pathCardRow, title } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { CondNode, Workflow } from '@flow-studio/model/workflow';
import { FOCUS_RING } from './StepNode';
import type { CanvasTest } from './test-look';
import { ifCardTop, ifPortY, NODE_SIZE, type PlacedNode } from './layout';

interface IfCardProps {
  workflow: Workflow;
  node: CondNode;
  place: PlacedNode;
  ctx: EngineContext;
  selected: boolean;
  flagged: boolean;
  test: CanvasTest | null;
  onSelect: (id: string, opener: HTMLElement) => void;
}

/** 04 §4.4: an If is a card that lists its paths; the last row lines up with the main line. */
export function IfCard({ workflow, node, place, ctx, selected, flagged, test, onSelect }: IfCardProps) {
  const k = node.outs.length;
  const name = curl(title(node));
  const nodes = workflow.draft.nodes;
  const rowsId = useId();
  const onPath = test?.path.has(node.id) ?? false;

  return (
    <div data-node-id={node.id} className={`absolute w-[176px] ${test && !onPath ? 'opacity-40' : ''}`} style={{ left: place.x, top: place.y, height: NODE_SIZE }}>
      <button
        type="button"
        aria-label={name}
        aria-describedby={rowsId}
        onClick={(event) => onSelect(node.id, event.currentTarget)}
        style={{ top: ifCardTop(k) }}
        className={[
          'absolute left-0 w-[176px] rounded-[14px] border-[1.5px] border-slate-700 bg-slate-900 py-1.5 text-left text-slate-100 shadow-[0_8px_20px_rgba(0,0,0,.45)] hover:border-slate-500',
          selected ? 'outline outline-2 outline-offset-4 outline-cyan-300' : FOCUS_RING,
        ].join(' ')}
      >
        <span className="flex h-[34px] items-center gap-2 border-b border-[#22304a] px-3">
          <Split aria-hidden className="h-[18px] w-[18px] flex-none text-green-400" />
          <span className="flex-1 truncate text-[12.5px] font-semibold">{name}</span>
          {flagged ? (
            <span className="grid h-4 w-4 flex-none place-items-center rounded-full border-2 border-slate-950 bg-amber-500 text-[11px] font-extrabold text-amber-950">!</span>
          ) : null}
        </span>
        <span id={rowsId}>
        {node.outs.map((out) => (
          <span key={out.key} className="flex h-[26px] items-center justify-between gap-1.5 px-3 text-[11.5px]">
            <span className={out.key === 'else' ? 'truncate font-medium text-slate-400' : 'truncate font-semibold text-slate-100'}>{curl(out.label ?? '')}</span>
            <span className="max-w-[58%] flex-none truncate text-slate-400">{curl(pathCardRow(nodes, node.id, out.key, ctx))}</span>
          </span>
        ))}
        </span>
      </button>
      <span aria-hidden className="absolute -left-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-500 bg-slate-950" style={{ top: NODE_SIZE / 2 - 5 }} />
      {node.outs.map((out, i) => (
        <span key={out.key} aria-hidden className="absolute -right-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-500 bg-slate-950" style={{ top: ifPortY(i, k) - 5 }} />
      ))}
    </div>
  );
}
