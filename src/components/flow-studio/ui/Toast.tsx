'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const VISIBLE_MS = 2800;

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** 04 §6.6: the Undo link stays for 10 s. */
  ms?: number;
}

/** 04 §1.3: one toast at a time, a new one replaces the current one. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<ToastAction | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(null);
    setAction(null);
  }, []);
  const show = useCallback(
    (next: string, options: ToastOptions = {}) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      setAction(options.action ?? null);
      timer.current = setTimeout(dismiss, options.ms ?? VISIBLE_MS);
    },
    [dismiss],
  );
  const dropAction = useCallback(() => setAction(null), []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return { message, action, show, dismiss, dropAction };
}

/** Embedded, it centres in the admin column rather than the window, which would straddle the admin sidebar. */
export function Toast({ message, action, embedded }: { message: string | null; action: ToastAction | null; embedded: boolean }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${embedded ? 'absolute' : 'fixed'} bottom-4 left-1/2 z-[70] flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2.5 rounded-[9px] border border-slate-800 bg-slate-950 px-3.5 py-2 text-[13px] text-slate-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-5`}
    >
      <span>{message}</span>
      {action ? (
        <button type="button" onClick={action.run} className="font-bold text-cyan-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400">
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
