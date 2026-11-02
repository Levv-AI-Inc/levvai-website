'use client';

import { CornerDownRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { evName } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { WorkflowSummary } from '@flow-studio/model/runtime';
import { uiCopy } from './copy';
import { dotClass } from './status';

interface FlowPickerProps {
  summaries: WorkflowSummary[];
  ctx: EngineContext;
  currentId: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onClose: (returnFocus: boolean) => void;
  button: RefObject<HTMLButtonElement | null>;
}

const optionId = (id: string): string => `flow-picker-${id}`;
const NEW_ID = '__new';
const KEYBOARD_ROW = 'outline outline-2 -outline-offset-2 outline-cyan-600';

/** 04 §3. A navigation list: rendered here rather than with SelectMenu, with the same keyboard model (§13.6). */
export function FlowPicker({ summaries, ctx, currentId, onOpen, onNew, onClose, button }: FlowPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(currentId);
  // The list holds focus, so once arrows are in use the row they reached shows it (04 §14.3). A pointer has its own highlight.
  const [byKeyboard, setByKeyboard] = useState(false);

  useEffect(() => {
    listRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || button.current?.contains(target)) return;
      onClose(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [button, onClose]);

  const ids = useMemo(() => [...summaries.map((summary) => summary.id), NEW_ID], [summaries]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = ids.indexOf(activeId);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setByKeyboard(true);
      const next = ids[Math.max(0, Math.min(ids.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
      setActiveId(next);
      listRef.current?.querySelector(`#${CSS.escape(optionId(next))}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeId === NEW_ID) onNew();
      else onOpen(activeId);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
    } else if (event.key === 'Tab') {
      onClose(true);
    }
  }

  let previousGroup = '';
  return (
    <div
      ref={listRef}
      role="listbox"
      tabIndex={-1}
      aria-label={uiCopy.flows}
      aria-activedescendant={optionId(activeId)}
      onKeyDown={onKeyDown}
      className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[70vh] w-[340px] max-w-[calc(100vw-32px)] overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-[0_14px_40px_rgba(0,0,0,.18)] outline-none"
    >
      {summaries.map((summary) => {
        const workflow = ctx.workflows.find((candidate) => candidate.id === summary.id);
        const group = `${ctx.catalog.RECORDS[summary.recordType]} · ${evName({ event: summary.event, days: workflow?.days }, ctx.catalog)}`;
        const showHeading = group !== previousGroup;
        previousGroup = group;
        const current = summary.id === currentId;
        return (
          <div key={summary.id} role="presentation">
            {showHeading ? (
              <div role="presentation" className="px-2.5 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                {group}
              </div>
            ) : null}
            <div
              id={optionId(summary.id)}
              role="option"
              aria-selected={current}
              aria-current={current ? 'true' : undefined}
              onMouseMove={() => setActiveId(summary.id)}
              onClick={() => onOpen(summary.id)}
              className={[
                'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[7px] text-left text-[13.5px]',
                summary.isVariationOf ? 'pl-[26px]' : '',
                current ? 'bg-cyan-50' : activeId === summary.id ? 'bg-slate-50' : '',
                byKeyboard && activeId === summary.id ? KEYBOARD_ROW : '',
              ].join(' ')}
            >
              {summary.isVariationOf ? <CornerDownRight aria-hidden className="h-3 w-3 flex-none text-slate-400" /> : null}
              <span aria-hidden className={`h-2 w-2 flex-none rounded-full ${workflow ? dotClass(workflow) : 'bg-slate-400'}`} />
              <span className="min-w-0 flex-1 truncate">{summary.name}</span>
              <span className="flex-none text-xs text-slate-500">{summary.scopeSummary}</span>
            </div>
          </div>
        );
      })}
      <div className="mt-1.5 border-t border-slate-200 pt-1.5">
        <div
          id={optionId(NEW_ID)}
          role="option"
          aria-selected={false}
          onMouseMove={() => setActiveId(NEW_ID)}
          onClick={onNew}
          className={`w-full cursor-pointer rounded-lg px-2.5 py-[7px] text-[13.5px] font-semibold text-cyan-700 ${activeId === NEW_ID ? 'bg-slate-50' : ''} ${byKeyboard && activeId === NEW_ID ? KEYBOARD_ROW : ''}`}
        >
          {uiCopy.newWorkflow}
        </div>
      </div>
    </div>
  );
}
