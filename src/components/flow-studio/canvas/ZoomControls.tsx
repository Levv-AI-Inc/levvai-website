'use client';

import type { RefObject } from 'react';
import { uiCopy } from '../copy';
import { clampZoom, fitZoom, ZOOM_MIN, type CanvasLayout } from './layout';

/** 04 §4.9: −, Fit and +, bottom left of the stage. */
export function ZoomControls({ scroller, layout, onZoom }: { scroller: RefObject<HTMLDivElement | null>; layout: CanvasLayout; onZoom: (next: number | ((current: number) => number)) => void }) {
  const fit = (): void => {
    const element = scroller.current;
    if (!element) return;
    onZoom(fitZoom(element.clientWidth, element.clientHeight, layout, ZOOM_MIN));
    element.scrollTo(0, 0);
  };
  const controls = [
    { label: '−', name: uiCopy.zoomOut, run: () => onZoom((current) => clampZoom(current - 0.1)) },
    { label: uiCopy.fit, name: uiCopy.fit, run: fit },
    { label: '+', name: uiCopy.zoomIn, run: () => onZoom((current) => clampZoom(current + 0.1)) },
  ];
  return (
    <div className="absolute bottom-3.5 left-3.5 z-[4] flex gap-1">
      {controls.map((control) => (
        <button
          key={control.name}
          type="button"
          aria-label={control.name}
          onClick={control.run}
          className="h-8 min-w-8 rounded-lg border border-[#2a3850] bg-[#121a2a] px-2 text-[13px] font-semibold text-slate-300 hover:border-cyan-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          {control.label}
        </button>
      ))}
    </div>
  );
}
