'use client';

import { X } from 'lucide-react';
import { useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { uiCopy } from './copy';

interface DrawerProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  compact: boolean;
  /** 04 §9: Nova is an AI surface, so its drawer is dark. */
  dark?: boolean;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]';

/** 04 §2.2 and §6.1: the one drawer slot of the stage, a non-modal dialog. */
export function Drawer({ title, subtitle, icon, compact, dark = false, onClose, children }: DrawerProps) {
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);

  // A button that removes itself (Delete path, a condition's ×, a conflict's choice) must not drop focus to the page: whatever took its place gets it.
  const keepFocus = (event: MouseEvent<HTMLDivElement>): void => {
    const pressed = event.target as Element;
    const focusables = (): HTMLElement[] => Array.from(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const at = focusables().findIndex((element) => element.contains(pressed));
    if (at < 0) return;
    requestAnimationFrame(() => {
      if (pressed.isConnected || document.activeElement !== document.body) return;
      const now = focusables();
      now[Math.min(at, now.length - 1)]?.focus();
    });
  };

  return (
    <div
      ref={root}
      role="dialog"
      aria-labelledby={titleId}
      onClickCapture={keepFocus}
      className={[
        'absolute top-2.5 bottom-2.5 z-[8] flex flex-col rounded-[14px] border shadow-[0_14px_50px_rgba(0,0,0,.45)]',
        dark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900',
        compact ? 'inset-x-2.5' : 'right-[var(--drawer-right,88px)] w-[390px] max-w-[calc(100%-20px)]',
      ].join(' ')}
    >
      <div className={`flex items-center gap-2.5 border-b px-4 py-3.5 ${dark ? 'border-slate-800' : 'border-slate-200'}`}>
        <span className={`grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] ${dark ? 'bg-slate-900' : 'bg-slate-100'}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[15.5px] font-semibold">{title}</h2>
          {subtitle ? <div className={`truncate text-xs font-normal ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</div> : null}
        </div>
        <button
          type="button"
          aria-label={uiCopy.close}
          onClick={onClose}
          className={`grid h-7 w-7 flex-none place-items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${dark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 py-3.5">{children}</div>
    </div>
  );
}
