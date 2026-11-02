'use client';

import { ChevronDown, Play, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { statusText } from '@flow-studio/engine/publish';
import type { EngineContext } from '@flow-studio/model/context';
import type { WorkflowSummary } from '@flow-studio/model/runtime';
import type { Workflow } from '@flow-studio/model/workflow';
import { uiCopy } from './copy';
import { FlowPicker } from './FlowPicker';
import type { ShellFit } from './FlowStudioShell';
import { dotClass } from './status';
import { buttonClass, primaryButtonClass } from './ui/primitives';

/** 04 §1.3, written out: buttonClass's own bg-white and border would otherwise win. */
const PRESSED = '!border-cyan-600 !bg-cyan-50 !text-cyan-700';

interface TopBarProps {
  embedded: boolean;
  fit: ShellFit;
  workflow: Workflow | null;
  summaries: WorkflowSummary[] | null;
  ctx: EngineContext | null;
  novaCount: number | null;
  /** Which of the top bar's two drawers is open (04 §2.3). */
  panel: 'test' | 'nova' | null;
  onNova: (opener: HTMLElement) => void;
  onTest: (opener: HTMLElement) => void;
  onPublish: (opener: HTMLElement) => void;
  onOpenWorkflow: (id: string) => void;
  onNewWorkflow: () => void;
}

/**
 * 04 §2.3. Embedded it stays on one line and the picker button gives way; a <header> there would be a second banner.
 * `narrow` keeps the two halves whole, on one line or two as the width allows.
 */
export function TopBar({ embedded, fit, workflow, summaries, ctx, novaCount, panel, onNova, onTest, onPublish, onOpenWorkflow, onNewWorkflow }: TopBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const closePicker = useCallback((returnFocus: boolean) => {
    setPickerOpen(false);
    if (returnFocus) pickerButton.current?.focus();
  }, []);

  // The button is gone while the next workflow loads, so focus comes back to it when it returns.
  const refocusPicker = useRef(false);
  const shownWorkflow = workflow?.id ?? null;
  useEffect(() => {
    if (!shownWorkflow || !refocusPicker.current) return;
    refocusPicker.current = false;
    pickerButton.current?.focus();
  }, [shownWorkflow]);

  const ready = !!workflow && !!ctx;
  const compact = fit === 'phone';
  const wrap = compact || !embedded || fit === 'narrow';
  const lead = (
    <>
      <Link href="/home" className="flex-none rounded text-[19px] font-bold tracking-[-0.03em] text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
        {uiCopy.logo}
        <span className="text-cyan-600">.</span>
      </Link>
      <span className="flex-none rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-bold">{uiCopy.flows}</span>
      {compact ? <span className="basis-full" aria-hidden /> : null}
      {workflow && summaries && ctx ? (
        <>
          <div className="relative min-w-0">
            <button
              ref={pickerButton}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              aria-label={workflow.name}
              onClick={() => setPickerOpen((open) => !open)}
              className="flex w-full max-w-[min(420px,60vw)] items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-base font-bold hover:border-slate-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              <span aria-hidden className={`h-2 w-2 flex-none rounded-full ${dotClass(workflow)}`} />
              <span className="min-w-0 truncate">{workflow.name}</span>
              <ChevronDown aria-hidden className="h-3 w-3 flex-none text-slate-500" />
            </button>
            {pickerOpen ? (
              <FlowPicker
                summaries={summaries}
                ctx={ctx}
                currentId={workflow.id}
                button={pickerButton}
                onClose={closePicker}
                onOpen={(id) => {
                  setPickerOpen(false);
                  if (id === workflow.id) pickerButton.current?.focus();
                  else refocusPicker.current = true;
                  onOpenWorkflow(id);
                }}
                onNew={() => {
                  setPickerOpen(false);
                  onNewWorkflow();
                }}
              />
            ) : null}
          </div>
          <span className="flex-none whitespace-nowrap text-xs text-slate-500">{statusText(workflow)}</span>
        </>
      ) : null}
    </>
  );
  const actions = (
    <>
      <button type="button" disabled={!ready} aria-pressed={panel === 'nova'} onClick={(event) => onNova(event.currentTarget)} className={`${buttonClass} flex-none ${panel === 'nova' ? PRESSED : ''}`}>
        <Sparkles aria-hidden className="h-3.5 w-3.5" />
        {uiCopy.nova}
        {novaCount === null ? null : (
          <span className={`inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[11px] font-bold text-white ${novaCount > 0 ? 'bg-amber-600' : 'bg-slate-500'}`}>
            {novaCount}
          </span>
        )}
      </button>
      <button type="button" disabled={!ready} aria-pressed={panel === 'test'} onClick={(event) => onTest(event.currentTarget)} className={`${buttonClass} flex-none ${panel === 'test' ? PRESSED : ''}`}>
        <Play aria-hidden className="h-3.5 w-3.5" />
        {uiCopy.test}
      </button>
      <button type="button" disabled={!ready} onClick={(event) => onPublish(event.currentTarget)} className={`${primaryButtonClass} flex-none`}>
        {uiCopy.publish}
      </button>
    </>
  );

  const bar =
    fit === 'narrow' ? (
      <>
        <div className="flex min-w-0 flex-[1_1_320px] items-center gap-2.5">{lead}</div>
        <div className="ml-auto flex flex-none items-center gap-2.5">{actions}</div>
      </>
    ) : (
      <>
        {lead}
        {compact ? <span className="basis-full" aria-hidden /> : <span className="flex-1" />}
        {actions}
      </>
    );
  const barClass = `relative mb-2.5 flex flex-none items-center gap-2.5 ${wrap ? 'flex-wrap' : 'min-w-0 flex-nowrap'}`;
  return embedded ? <div className={barClass}>{bar}</div> : <header role="banner" className={barClass}>{bar}</header>;
}
