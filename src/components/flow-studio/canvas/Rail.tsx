'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { dwsFor } from '@flow-studio/engine/text';
import { copy } from '@flow-studio/engine/copy';
import type { EngineContext } from '@flow-studio/model/context';
import type { DigitalWorker } from '@flow-studio/model/helpers';
import type { Workflow } from '@flow-studio/model/workflow';
import { uiCopy } from '../copy';
import { DW_ICONS } from '../kinds';

const STATUS_DOT: Record<DigitalWorker['s'], string> = { ready: 'bg-emerald-400', setup: 'bg-amber-400', off: 'bg-slate-500' };

interface RailProps {
  workflow: Workflow;
  ctx: EngineContext;
  placing: string | null;
  onPlace: (id: string | null) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onToast: (message: string) => void;
}

/** 04 §4.10. Only the Digital Workers of this workflow's context; the Chaser is never here. */
export function Rail({ workflow, ctx, placing, onPlace, onDragStart, onDragEnd, onToast }: RailProps) {
  const [hover, setHover] = useState<{ worker: DigitalWorker; top: number; right: number } | null>(null);

  return (
    <aside aria-label={`${uiCopy.railDigital} ${uiCopy.railWorkers}`} className="absolute inset-y-0 right-0 z-[3] flex w-[78px] flex-col items-center gap-0.5 overflow-auto border-l border-[#1b2536] bg-[#0c1220] px-1 py-3">
      <div className="mb-1.5 text-center text-[9.5px] font-extrabold uppercase leading-tight tracking-[0.08em] text-slate-400">
        {uiCopy.railDigital}
        <br />
        {uiCopy.railWorkers}
      </div>
      {dwsFor(workflow, ctx).map((worker) => {
        const Icon = DW_ICONS[worker.id] ?? Sparkles;
        const licensed = worker.s !== 'off';
        return (
          <button
            key={worker.id}
            type="button"
            draggable={licensed}
            aria-pressed={placing === worker.id}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData('text/plain', worker.id);
              setHover(null);
              onDragStart(worker.id);
            }}
            onDragEnd={onDragEnd}
            onClick={() => {
              if (!licensed) onToast(copy.dwNotLicensed(worker.n));
              else onPlace(placing === worker.id ? null : worker.id);
            }}
            onMouseEnter={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setHover({ worker, top: rect.top, right: window.innerWidth - rect.left + 8 });
            }}
            onMouseLeave={() => setHover(null)}
            onFocus={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setHover({ worker, top: rect.top, right: window.innerWidth - rect.left + 8 });
            }}
            onBlur={() => setHover(null)}
            className="flex w-full cursor-grab flex-col items-center gap-[3px] rounded-lg px-0.5 py-[5px] text-slate-300 hover:bg-[#141d2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            <span
              style={{ background: 'radial-gradient(circle at 35% 30%, #3b2a63, #1a1230)', boxShadow: '0 0 12px rgba(139,92,246,.35)' }}
              className={`relative grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-violet-500 ${licensed ? '' : 'opacity-40'}`}
            >
              <Icon aria-hidden className="h-[18px] w-[18px] text-violet-200" />
              <span aria-hidden className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-[#0c1220] ${STATUS_DOT[worker.s]}`} />
            </span>
            <span className="text-center text-[10px] leading-tight">{worker.n}</span>
          </button>
        );
      })}
      {hover ? <RailTooltip worker={hover.worker} top={hover.top} right={hover.right} ctx={ctx} /> : null}
    </aside>
  );
}

function RailTooltip({ worker, top, right, ctx }: { worker: DigitalWorker; top: number; right: number; ctx: EngineContext }) {
  const box = useRef<HTMLDivElement>(null);
  const [clampedTop, setClampedTop] = useState(top);
  useEffect(() => {
    const height = box.current?.offsetHeight ?? 0;
    setClampedTop(Math.max(8, Math.min(top, window.innerHeight - height - 8)));
  }, [top]);
  const about = ctx.dws.DWX[worker.id];
  return createPortal(
    <div
      ref={box}
      role="tooltip"
      style={{ position: 'fixed', top: clampedTop, right }}
      className="pointer-events-none z-[60] max-w-[260px] rounded-[10px] border border-slate-700 bg-slate-900 px-3 py-2.5 text-[12.5px] leading-snug text-slate-200 shadow-xl"
    >
      <div className="text-[13px] font-bold">{worker.n}</div>
      <div className="mt-1">{about?.d}</div>
      <div className="mt-1 text-slate-400">{about?.u}</div>
      <div className="mt-1 text-slate-400">{uiCopy.railNever}</div>
      {worker.s === 'setup' ? <div className="mt-1 text-amber-400">{uiCopy.railSetup}</div> : null}
    </div>,
    document.body,
  );
}
