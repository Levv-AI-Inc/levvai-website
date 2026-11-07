'use client';

import { curl } from '@flow-studio/engine/copy';
import { subtitle, title, startTitle } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { WfNode, Workflow } from '@flow-studio/model/workflow';
import { DW_ICONS, iconOf } from '../kinds';
import type { CanvasDrag } from './Canvas';
import { TEST_RING, type CanvasTest } from './test-look';
import { NODE_SIZE, squarePortY, visualOuts, type PlacedNode } from './layout';

export const nodeTitle = (workflow: Workflow, node: WfNode, ctx: EngineContext): string =>
  curl(node.kind === 'trigger' ? startTitle(workflow, ctx.catalog) : title(node));

export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400';

/** 04 §4.2: a Digital Worker that does this step. */
function helperOf(node: WfNode): string | null {
  if (node.kind === 'collect' && node.checker?.startsWith('dw:')) return node.checker.slice(3);
  if (node.kind === 'system' && node.via) return node.via;
  return null;
}

interface StepNodeProps {
  workflow: Workflow;
  node: WfNode;
  place: PlacedNode;
  ctx: EngineContext;
  selected: boolean;
  flagged: boolean;
  test: CanvasTest | null;
  onSelect: (id: string, opener: HTMLElement) => void;
  drag?: CanvasDrag | null;
}

export function StepNode({ workflow, node, place, ctx, selected, flagged, test, onSelect, drag }: StepNodeProps) {
  const { icon: Icon, color } = iconOf(node);
  const name = nodeTitle(workflow, node, ctx);
  const outs = visualOuts(node);
  const helper = helperOf(node);
  const HelperIcon = helper ? DW_ICONS[helper] : null;
  const shape =
    node.kind === 'trigger' ? 'rounded-l-[44px] rounded-r-[18px]'
    : node.kind === 'end' ? 'rounded-full'
    : node.kind === 'dw' ? 'rounded-full'
    : 'rounded-[18px]';
  const lit = drag?.overStep === node.id && drag.canAttach(node.id);
  const tested = test?.steps[node.id];
  const onPath = test?.path.has(node.id) ?? false;
  // Start, Parallel and End have no status of their own: done unless something before them is holding the line.
  const ring = tested ? TEST_RING[tested.st] : onPath ? TEST_RING[test?.heldBack.has(node.id) ? 'wait' : 'ok'] : null;

  return (
    <div data-node-id={node.id} className={`absolute w-[88px] ${test && !onPath ? 'opacity-40' : ''}`} style={{ left: place.x, top: place.y }}>
      <button
        type="button"
        aria-label={name}
        onClick={(event) => onSelect(node.id, event.currentTarget)}
        onDragOver={(event) => {
          if (!drag?.accepts(node.id)) return;
          event.preventDefault();
          drag.overStepChange(node.id);
        }}
        onDragLeave={() => drag?.overStepChange(null)}
        onDrop={(event) => {
          if (!drag?.accepts(node.id)) return;
          event.preventDefault();
          drag.dropOnStep(node.id);
        }}
        style={{
          ...(node.kind === 'dw' ? { background: 'radial-gradient(circle at 35% 30%, #33255a, #171029)' } : {}),
          ...(lit ? { boxShadow: '0 0 16px rgba(167,139,250,.6)' } : {}),
        }}
        className={[
          'relative grid h-[88px] w-[88px] place-items-center border-[1.5px] bg-slate-900 transition-colors motion-reduce:transition-none',
          ring ?? 'shadow-[0_8px_20px_rgba(0,0,0,.45)] hover:border-slate-500',
          ring ? '' : lit ? 'border-violet-400' : node.kind === 'dw' ? 'border-violet-500' : 'border-slate-700',
          shape,
          selected ? 'outline outline-2 outline-offset-4 outline-cyan-300' : FOCUS_RING,
        ].join(' ')}
      >
        <Icon aria-hidden strokeWidth={1.8} className={`h-8 w-8 ${color}`} />
        {flagged ? (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 border-slate-950 bg-amber-500 text-[11px] font-extrabold text-amber-950">!</span>
        ) : null}
        {HelperIcon && helper ? (
          <span
            title={ctx.dws.DW[helper]?.n}
            className="absolute -bottom-[11px] left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full border-[1.5px] border-violet-500 bg-[#1f1638]"
          >
            <HelperIcon aria-hidden className="h-[11px] w-[11px] text-violet-200" />
          </span>
        ) : null}
      </button>
      {node.kind === 'trigger' ? null : (
        <span aria-hidden className="absolute -left-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-500 bg-slate-950" style={{ top: NODE_SIZE / 2 - 5 }} />
      )}
      {(node.outs ?? []).map((out) => {
        // Text stays in stored order ("Done | Failed", 06 UI-W12); the position follows the drawing order.
        const y = squarePortY(outs.indexOf(out), outs.length);
        return (
          <span key={out.key}>
            <span aria-hidden className="absolute -right-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-500 bg-slate-950" style={{ top: y - 5 }} />
            {outs.length > 1 ? (
              <span className="absolute left-[calc(100%+12px)] whitespace-nowrap rounded bg-slate-950 px-1 text-[10.5px] font-semibold text-slate-400" style={{ top: y - 19 }}>
                {curl(out.label ?? '')}
              </span>
            ) : null}
          </span>
        );
      })}
      <div className="pointer-events-none absolute left-1/2 top-[100px] w-[176px] -translate-x-1/2 text-center">
        <span className="block text-[13px] font-semibold leading-tight text-slate-100">{name}</span>
        <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-slate-400">{curl(tested ? tested.short : subtitle(workflow, node, ctx))}</span>
      </div>
    </div>
  );
}
