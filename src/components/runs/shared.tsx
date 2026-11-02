'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RunStatus } from '@flow-studio/model/runtime';
import { runtimeCopy as rc } from '@flow-studio/runtime/copy';
import { ApiFailure, apiGet } from '@flow-studio-ui/api';
import { uiCopy } from '@flow-studio-ui/copy';
import { buttonClass, fieldLabelClass, inputClass, primaryButtonClass } from '@flow-studio-ui/ui/primitives';

/** 05 §6: status chips are badges. Cyan, amber, slate, emerald, rose. */
const CHIP: Record<RunStatus, { label: string; tone: string }> = {
  running: { label: 'Running', tone: 'bg-cyan-50 text-cyan-700' },
  paused: { label: 'Paused', tone: 'bg-amber-50 text-amber-700' },
  stopped: { label: 'Stopped', tone: 'bg-slate-100 text-slate-600' },
  completed: { label: 'Completed', tone: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected', tone: 'bg-rose-50 text-rose-700' },
};

export const STATUS_LABELS = CHIP;

export function StatusChip({ status }: { status: RunStatus }) {
  const { label, tone } = CHIP[status];
  return <span className={`inline-block rounded-md px-1.5 py-px text-[10px] font-black uppercase tracking-wider ${tone}`}>{label}</span>;
}

/** What a person reads when a write fails: the server's sentence when it refused, never a status or a code. */
export function failureText(error: unknown): string {
  return error instanceof ApiFailure && error.status < 500 ? error.message : rc.screen.writeFailed;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export interface DialogField {
  label: string;
  required: boolean;
}

interface RunDialogProps {
  title: string;
  text?: string;
  field?: DialogField;
  confirm: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => Promise<void>;
}

/** One dialog for Pause, Stop, Reject and Send back (05 §6.2, §7). Portaled, because the app's globals restyle anything inside its `main`. */
export function RunDialog({ title, text, field, confirm, danger, onCancel, onConfirm }: RunDialogProps) {
  const titleId = useId();
  const fieldId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    dialog.current?.querySelector<HTMLElement>(field ? 'textarea' : FOCUSABLE)?.focus();
    const previous = opener;
    return () => (previous.current as HTMLElement | null)?.focus?.();
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trap = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const all = Array.from(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (all.length === 0) return;
    const first = all[0];
    const last = all[all.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const blocked = busy || (field?.required === true && value.trim() === '');

  const submit = async (): Promise<void> => {
    setBusy(true);
    setFailure(null);
    try {
      await onConfirm(value);
    } catch (error) {
      setFailure(failureText(error));
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4"
      onMouseDown={(event: MouseEvent) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={trap} className="flex w-full max-w-[460px] flex-col gap-3 rounded-[14px] border border-slate-200 bg-white p-5 text-slate-900 shadow-xl">
        <h2 id={titleId} className="text-[17px] font-bold">{title}</h2>
        {text ? <p className="text-[13.5px] leading-normal text-slate-600">{text}</p> : null}
        {field ? (
          <div>
            <label htmlFor={fieldId} className={fieldLabelClass}>{field.label}</label>
            <textarea id={fieldId} rows={3} value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} />
          </div>
        ) : null}
        {failure ? <p role="alert" className="text-[13px] text-rose-700">{failure}</p> : null}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={buttonClass}>{rc.screen.cancel}</button>
          <button type="button" disabled={blocked} onClick={() => void submit()} className={danger ? `${primaryButtonClass} !border-rose-600 !bg-rose-600 hover:!bg-rose-700` : primaryButtonClass}>
            {confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type Loaded<T> = { state: 'loading' } | { state: 'failed'; status: number; message: string } | { state: 'ready'; data: T };

/** A page's title, and where focus goes when an action removes what held it (a card once answered, Stop once stopped). */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 tabIndex={-1} data-page-title className="rounded text-[22px] font-bold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
      {children}
    </h1>
  );
}

/** Reads a route, and again whenever `reload` is called. Not signed in any more goes to sign-in, as Flow Studio does (decision 5). */
export function useLoad<T>(path: string): [Loaded<T>, () => void] {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded<T>>({ state: 'loading' });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<T>(path, controller.signal)
      .then((data) => {
        setLoaded({ state: 'ready', data });
        requestAnimationFrame(() => {
          if (nonce > 0 && document.activeElement === document.body) document.querySelector<HTMLElement>('[data-page-title]')?.focus({ preventScroll: true });
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiFailure && error.status === 401) {
          router.replace(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        const seeded = !(error instanceof ApiFailure && error.code === 'NOT_SEEDED');
        const told = error instanceof ApiFailure && error.status < 500;
        setLoaded({ state: 'failed', status: error instanceof ApiFailure ? error.status : 0, message: !seeded ? uiCopy.notSeeded : told ? error.message : rc.screen.loadFailed });
      });
    return () => controller.abort();
  }, [path, nonce, router]);
  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return [loaded, reload];
}

export function PageFrame({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 text-[14px] leading-normal text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export const Loading = () => <Note status>{rc.screen.loading}</Note>;

export const Note = ({ children, status }: { children: ReactNode; status?: boolean }) => (
  <p role={status ? 'status' : undefined} className="rounded-[10px] border border-slate-200 bg-white px-4 py-5 text-center text-[13.5px] text-slate-500">{children}</p>
);
