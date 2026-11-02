'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { EngineContext } from '@flow-studio/model/context';
import type { StepCode } from '@flow-studio/model/results';
import type { StepRun } from '@flow-studio/model/runtime';
import type { Workflow } from '@flow-studio/model/workflow';
import { Canvas } from '@flow-studio-ui/canvas/Canvas';
import { fitZoom, layoutWorkflow, softEdges, ZOOM_OPEN_COLUMN } from '@flow-studio-ui/canvas/layout';
import type { CanvasTest } from '@flow-studio-ui/canvas/test-look';
import { ZoomControls } from '@flow-studio-ui/canvas/ZoomControls';

const CODE: Record<StepRun['status'], StepCode> = {
  pending: 'wait',
  active: 'review',
  waiting: 'review',
  done: 'ok',
  skipped: 'ok',
  failed: 'fail',
  cancelled: 'fail',
};

export interface RunStatuses { [id: string]: { status: StepRun['status']; label?: string } }

const STRUCTURAL = ['trigger', 'parallel', 'end', 'cond'];

/**
 * 05 §6.2: the Flow Studio canvas in read-only mode. It reuses the canvas's Test look (04 §4.8): the path lit, and a ring
 * and short label on each box. Nothing here can edit: no "+", no drag, no panel. A click only points at the step's row.
 */
export function RunCanvas({ workflow, ctx, statuses, path, onSelect, selected }: { workflow: Workflow; ctx: EngineContext; statuses: RunStatuses; path: string[]; onSelect: (id: string) => void; selected: string | null }) {
  const nodes = workflow.draft.nodes;
  const layout = useMemo(() => layoutWorkflow(nodes), [nodes]);
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.6);

  // As /admin/workflows opens, for the same column: fit, but never smaller than can be read. Then the open step is in view.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const next = fitZoom(element.clientWidth, element.clientHeight, layout, ZOOM_OPEN_COLUMN);
    setZoom(next);
    const open = Object.keys(statuses).find((id) => statuses[id].status === 'waiting' || statuses[id].status === 'active' || statuses[id].status === 'failed');
    const place = open ? layout.byId[open] : undefined;
    element.scrollLeft = place ? Math.max(0, place.x * next - element.clientWidth / 3) : 0;
    // A finished run has nothing open: the main line, in the middle, rather than under the zoom controls.
    const line = place ?? layout.byId.T;
    element.scrollTop = line ? Math.max(0, line.y * next - element.clientHeight / (place ? 3 : 2)) : 0;
    // On the first paint of this run, not on every reload of its status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const test = useMemo<CanvasTest>(() => {
    const steps: CanvasTest['steps'] = {};
    const heldBack = new Set<string>();
    for (const [id, step] of Object.entries(statuses)) {
      const node = nodes[id];
      if (!node) continue;
      if (STRUCTURAL.includes(node.kind)) {
        if (step.status === 'pending') heldBack.add(id);
        continue;
      }
      steps[id] = { st: CODE[step.status], short: step.label ?? '' };
    }
    return { path: new Set(path), steps, soft: softEdges(nodes), heldBack };
  }, [statuses, path, nodes]);

  return (
    <div className="relative h-[440px] overflow-hidden rounded-[12px] bg-slate-950" style={{ colorScheme: 'dark' }}>
      <Canvas
        ref={scroller}
        workflow={workflow}
        ctx={ctx}
        layout={layout}
        zoom={zoom}
        selectedId={selected}
        flagged={new Set()}
        placing={false}
        fullWidth
        trailing={0}
        activeEdge={null}
        drag={null}
        test={test}
        readOnly
        onSelect={(id) => onSelect(id)}
        onPlus={() => undefined}
      />
      <ZoomControls scroller={scroller} layout={layout} onZoom={setZoom} />
    </div>
  );
}
