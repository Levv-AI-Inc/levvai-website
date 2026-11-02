'use client';

import { forwardRef } from 'react';
import type { EngineContext } from '@flow-studio/model/context';
import type { Workflow } from '@flow-studio/model/workflow';
import { uiCopy } from '../copy';
import { IfCard } from './IfCard';
import { StepNode } from './StepNode';
import type { CanvasLayout, PlacedEdge } from './layout';
import type { CanvasTest } from './test-look';

const DOTS = { backgroundImage: 'radial-gradient(#1b2537 1.1px, transparent 1.4px)', backgroundSize: '22px 22px' };

/** A Digital Worker being dragged from the rail (04 §4.10). */
export interface CanvasDrag {
  canAttach: (id: string) => boolean;
  accepts: (id: string) => boolean;
  overStep: string | null;
  overStepChange: (id: string | null) => void;
  overEdge: string | null;
  overEdgeChange: (key: string | null) => void;
  dropOnStep: (id: string) => void;
  dropOnEdge: (edge: PlacedEdge) => void;
}

interface CanvasProps {
  workflow: Workflow;
  ctx: EngineContext;
  layout: CanvasLayout;
  zoom: number;
  selectedId: string | null;
  flagged: Set<string>;
  placing: boolean;
  fullWidth: boolean;
  /** Room to scroll past the open drawer, so no box stays stuck under it. */
  trailing: number;
  activeEdge: string | null;
  drag: CanvasDrag | null;
  test: CanvasTest | null;
  /** 05 §6.2: a run's pinned version. No "+", nothing can be added. */
  readOnly?: boolean;
  onSelect: (id: string, opener: HTMLElement) => void;
  onPlus: (edge: PlacedEdge, opener: HTMLElement) => void;
}

/** 04 §2.2 and §4: the scroller, a sizer for the scrollable area, and the scaled layer holding edges, nodes and "+". */
export const Canvas = forwardRef<HTMLDivElement, CanvasProps>(function Canvas(
  { workflow, ctx, layout, zoom, selectedId, flagged, placing, fullWidth, trailing, activeEdge, drag, test, readOnly, onSelect, onPlus },
  ref,
) {
  const nodes = workflow.draft.nodes;
  return (
    <div
      ref={ref}
      role="group"
      aria-label={uiCopy.stageLabel}
      style={DOTS}
      className={`group/canvas absolute inset-y-0 left-0 overflow-auto ${fullWidth ? 'right-0' : 'right-[78px]'}`}
    >
      <div style={{ width: layout.width * zoom + trailing, height: layout.height * zoom }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
          <svg aria-hidden width={layout.width} height={layout.height} className="absolute left-0 top-0" fill="none">
            {layout.edges.map((edge) => {
              const key = `${edge.from}:${edge.key}`;
              return (
                <path
                  key={key}
                  data-from={edge.from}
                  data-to={edge.to}
                  data-key={edge.key}
                  d={edge.d}
                  strokeWidth={2}
                  strokeDasharray={test?.soft.has(key) ? '3 5' : undefined}
                  className={test?.path.has(key) ? 'stroke-cyan-400 stroke-[2.6]' : 'stroke-slate-600'}
                />
              );
            })}
          </svg>
          {layout.nodes.map((place) => {
            const node = nodes[place.id];
            const shared = { workflow, place, ctx, selected: selectedId === place.id, flagged: flagged.has(place.id), test, onSelect };
            if (node.kind !== 'cond') return <StepNode key={place.id} node={node} {...shared} drag={drag} />;
            return <IfCard key={place.id} node={node} {...shared} />;
          })}
          {readOnly ? null : layout.edges.map((edge) => {
            const key = `${edge.from}:${edge.key}`;
            const over = drag?.overEdge === key;
            const look = placing
              ? `absolute -ml-4 -mt-4 grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-dashed border-cyan-400 text-base opacity-100 transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${over ? 'scale-[1.3] bg-cyan-400 text-cyan-950' : 'bg-[#062029] text-cyan-400'}`
              : `absolute -ml-3 -mt-3 grid h-6 w-6 place-items-center rounded-full border bg-[#101828] text-base transition motion-reduce:transition-none hover:scale-110 hover:border-cyan-400 hover:text-white hover:opacity-100 focus-visible:scale-110 focus-visible:border-cyan-400 focus-visible:text-white focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${activeEdge === key ? 'scale-110 border-cyan-400 text-white opacity-100' : 'border-[#3a4a64] text-slate-400 opacity-35 group-hover/canvas:opacity-80'}`;
            return (
              <button
                key={key}
                type="button"
                aria-label={uiCopy.addStep}
                style={{ left: edge.mid.x, top: edge.mid.y }}
                className={look}
                onClick={(event) => onPlus(edge, event.currentTarget)}
                onDragOver={(event) => {
                  if (!drag) return;
                  event.preventDefault();
                  drag.overEdgeChange(key);
                }}
                onDragLeave={() => drag?.overEdgeChange(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  drag?.dropOnEdge(edge);
                }}
              >
                +
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
