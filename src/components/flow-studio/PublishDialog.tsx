'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { copy, curl } from '@flow-studio/engine/copy';
import { goLiveError, overlapChoice, publishReview, type Precedence } from '@flow-studio/engine/publish';
import type { EngineContext } from '@flow-studio/model/context';
import type { Workflow } from '@flow-studio/model/workflow';
import { ApiFailure, apiWrite } from './api';
import { uiCopy } from './copy';
import { SelectMenu } from './SelectMenu';
import { buttonClass, fieldLabelClass, GroupBox, inputClass, invalidInputClass, primaryButtonClass } from './ui/primitives';
import type { Editing } from './use-editing';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** 04 §10.1 item 1: the number, in bold with tabular numerals, and only the number: "90" must not catch a count of 0 or 9. */
function impactSentence(impact: number): ReactNode {
  const sentence = copy.impact(impact);
  const at = sentence.indexOf(` ${impact} `) + 1;
  return (
    <>
      {sentence.slice(0, at)}
      <strong className="font-semibold tabular-nums">{impact}</strong>
      {sentence.slice(at + `${impact}`.length)}
    </>
  );
}

interface PublishDialogProps {
  workflow: Workflow;
  ctx: EngineContext;
  editing: Editing;
  onClose: () => void;
}

/**
 * 04 §10. Portaled to <body> so it covers the whole window, app chrome included: inside the embedded shell's fixed host
 * (z-index 10) it would sit under the app header and sidebar. Decisions are the server's; this is its advisory copy (conflict 7).
 */
export function PublishDialog({ workflow, ctx, editing, onClose }: PublishDialogProps) {
  const titleId = useId();
  const goLiveId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocus = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  const [precedence, setPrecedence] = useState<Precedence>([]);
  const review = publishReview(workflow, ctx, precedence);
  const [goLive, setGoLive] = useState(review.effective);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Already waiting: another send would be refused, so opening it just says where the change stands.
  const [sent, setSent] = useState(workflow.pending != null);

  useEffect(() => {
    if (sent) closeButton.current?.focus();
    else firstFocus.current?.focus();
  }, [sent]);

  const dateError = goLiveError(goLive, ctx);
  const canSend = review.canSend && !dateError && !sending;

  const choose = (otherId: string, winner: 'self' | 'other'): void =>
    setPrecedence((current) => [...current.filter((choice) => choice.otherId !== otherId), { otherId, winner }]);

  const send = async (): Promise<void> => {
    setSending(true);
    setFailure(null);
    try {
      const saved = await editing.flush();
      if (saved.ok === false) {
        setFailure(saved.message);
        return;
      }
      const request = await apiWrite<{ requestedBy: string; requestedAt: string }>('POST', `/api/flow-studio/workflows/${encodeURIComponent(workflow.id)}/publish-requests`, { goLive, precedence });
      editing.absorb({ pending: { submittedBy: request.requestedBy, submittedAt: request.requestedAt, effective: goLive, precedence } });
      setSent(true);
    } catch (error) {
      setFailure(error instanceof ApiFailure ? error.message : uiCopy.saveFailed);
    } finally {
      setSending(false);
    }
  };

  // 04 §14.3. A dropdown's list is portaled outside, so a key pressed there is its own business.
  const trapTab = (event: KeyboardEvent<HTMLDivElement>): void => {
    const dialog = dialogRef.current;
    if (event.key !== 'Tab' || !dialog || !dialog.contains(event.target as Node)) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // A click on the scrim while a dropdown is open closes only the dropdown, as Escape does (04 §14.2).
  // Read in the capture phase, from a listener older than any dropdown's: by the time the event reaches the scrim, the list has gone.
  useEffect(() => {
    const note = (): void => {
      menuWasOpen.current = document.querySelector('[role="listbox"]') !== null;
    };
    document.addEventListener('pointerdown', note, true);
    return () => document.removeEventListener('pointerdown', note, true);
  }, []);
  const onScrimClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget && !menuWasOpen.current) onClose();
  };

  return createPortal(
    <div
      onClick={onScrimClick}
      className="levv-spec fixed inset-0 z-40 grid place-items-center bg-slate-950/55 p-4 text-[14px] leading-[1.5] text-slate-900"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapTab}
        className="max-h-[calc(100vh-32px)] w-[min(520px,100%)] overflow-auto rounded-[14px] border border-slate-200 bg-white"
      >
        <div className="flex items-center justify-between gap-2.5 border-b border-slate-200 px-[18px] py-3">
          <h2 id={titleId} className="min-w-0 text-[15.5px] font-semibold">{curl(copy.publishTitle(workflow.name))}</h2>
          {sent ? null : (
            <button
              type="button"
              aria-label={uiCopy.close}
              onClick={onClose}
              className="grid h-7 w-7 flex-none place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>
        {sent ? (
          <>
            <div className="p-[18px] text-[15px] leading-normal">{copy.sentForApproval}</div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-[18px] py-3">
              <button ref={closeButton} type="button" className={buttonClass} onClick={onClose}>{copy.close}</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4 p-[18px]">
              <p className="text-[15px] leading-normal">{impactSentence(review.impact)}</p>
              {review.mustFix.map((issue) => (
                <div key={issue.m} className="flex items-start gap-2 text-[13px]">
                  <span aria-hidden className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-rose-600 text-[12px] font-bold leading-none text-white">×</span>{' '}
                  <span>{curl(issue.m)}</span>
                </div>
              ))}
              {review.overlaps.map((overlap) => {
                const choice = overlapChoice(workflow, overlap, precedence);
                const question = curl(copy.overlapQuestion(overlap.name, overlap.count));
                return (
                  <GroupBox key={overlap.id} title={question} labelId={`${titleId}-${overlap.id}`}>
                    <SelectMenu
                      aria-labelledby={`${titleId}-${overlap.id}`}
                      placeholder={copy.overlapPlaceholder}
                      options={[
                        { value: 'self', label: curl(workflow.name) },
                        { value: 'other', label: curl(overlap.name) },
                      ]}
                      value={choice}
                      onChange={(winner) => choose(overlap.id, winner as 'self' | 'other')}
                    />
                  </GroupBox>
                );
              })}
              {review.canSend ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <span aria-hidden className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-emerald-600 text-[12px] font-bold leading-none text-white">✓</span>{' '}
                  <span>{copy.readyToSend.replace('✓ ', '')}</span>
                </div>
              ) : null}
              <div>
                <label htmlFor={goLiveId} className={fieldLabelClass}>{copy.goesLiveOn}</label>
                <input
                  ref={firstFocus}
                  id={goLiveId}
                  type="date"
                  value={goLive}
                  aria-invalid={dateError !== null}
                  onChange={(event) => setGoLive(event.target.value)}
                  className={dateError ? invalidInputClass : inputClass}
                />
                {dateError ? <p className="mt-1 text-xs text-rose-700">{dateError}</p> : null}
              </div>
              {failure ? <p role="alert" className="text-[13px] text-rose-700">{failure}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-[18px] py-3">
              <button type="button" className={buttonClass} onClick={onClose}>{copy.cancel}</button>
              <button type="button" className={primaryButtonClass} disabled={!canSend} onClick={() => void send()}>{copy.sendForApproval}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
