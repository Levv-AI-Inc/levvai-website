'use client';

import { useState } from 'react';
import type { WorkItem } from '@flow-studio/model/runtime';
import { runtimeCopy as rc } from '@flow-studio/runtime/copy';
import { dateText } from '@flow-studio/runtime/time';
import { apiWrite } from '@flow-studio-ui/api';
import { SelectMenu } from '@flow-studio-ui/SelectMenu';
import { buttonClass, inputClass, primaryButtonClass } from '@flow-studio-ui/ui/primitives';
import { failureText, RunDialog } from './shared';

const copy = rc.inbox;

const Card = ({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) => (
  <article aria-label={title} className="flex flex-col gap-2 rounded-[12px] border border-slate-200 bg-white p-4">
    <h3 className="text-[14px] font-bold">{title}</h3>
    {children}
    {footer ? <div className="mt-1 flex flex-wrap gap-2">{footer}</div> : null}
  </article>
);

const itemTitle = (item: WorkItem): string => `${item.stepName} · ${item.recordTitle} (${item.recordId})`;

/** Failed writes read out on the card: the item may have moved on while it was on the screen. */
function useAct(onChanged: () => void) {
  const [failure, setFailure] = useState<string | null>(null);
  const act = async (path: string, body: unknown): Promise<void> => {
    setFailure(null);
    try {
      await apiWrite('POST', path, body);
      onChanged();
    } catch (error) {
      setFailure(failureText(error));
      throw error;
    }
  };
  return { failure, act, quiet: (path: string, body: unknown) => act(path, body).catch(() => undefined) };
}

const FailureLine = ({ text }: { text: string | null }) => (text ? <p role="alert" className="text-[13px] text-rose-700">{text}</p> : null);

/** 05 §7 section 1. */
export function ApprovalCard({ item, onChanged }: { item: WorkItem; onChanged: () => void }) {
  const [dialog, setDialog] = useState<'reject' | 'back' | null>(null);
  const { failure, act, quiet } = useAct(onChanged);
  const path = `/api/runtime/work-items/${encodeURIComponent(item.id)}/decide`;
  const needsComment = item.kind !== 'approve';
  const title = item.recordTitle ?? '';
  return (
    <Card
      title={itemTitle(item)}
      footer={
        <>
          <button type="button" className={primaryButtonClass} onClick={() => void quiet(path, { decision: 'approved' })}>{copy.approve}</button>
          <button type="button" className={buttonClass} onClick={() => setDialog('reject')}>{copy.reject}</button>
          <button type="button" className={buttonClass} onClick={() => setDialog('back')}>{copy.sendBack}</button>
        </>
      }
    >
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-700">{item.brief}</p>
      {item.onBehalfOf ? <p className="text-xs font-semibold text-slate-500">{copy.onBehalf(item.onBehalfOf)}</p> : null}
      <FailureLine text={failure} />
      {dialog === 'reject' ? (
        <RunDialog title={copy.rejectTitle(title)} field={{ label: copy.comment, required: needsComment }} confirm={copy.reject} danger onCancel={() => setDialog(null)} onConfirm={(comment) => act(path, { decision: 'rejected', comment })} />
      ) : null}
      {dialog === 'back' ? (
        <RunDialog title={copy.sendBackTitle(item.requester ?? '')} field={{ label: copy.comment, required: true }} confirm={copy.sendBack} onCancel={() => setDialog(null)} onConfirm={(comment) => act(path, { decision: 'sent_back', comment })} />
      ) : null}
    </Card>
  );
}

function FieldEditor({ item, onChanged }: { item: WorkItem; onChanged: () => void }) {
  const field = item.field as NonNullable<WorkItem['field']>;
  const [value, setValue] = useState<string>('');
  const { failure, quiet } = useAct(onChanged);
  const options = field.type === 'bool' ? ['Yes', 'No'] : field.options;
  const save = (): void => {
    const numeric = field.type === 'money' || field.type === 'pct' || field.type === 'num';
    const answer = field.type === 'bool' ? value === 'Yes' : numeric ? Number(value) : value;
    void quiet(`/api/runtime/work-items/${encodeURIComponent(item.id)}/provide-field`, { field: field.id, value: answer });
  };
  return (
    <>
      <div className="max-w-[260px]">
        {options ? (
          <SelectMenu aria-label={field.label} options={options.map((option) => ({ value: option, label: option }))} value={value || null} onChange={setValue} />
        ) : (
          <input aria-label={field.label} value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} />
        )}
      </div>
      <FailureLine text={failure} />
      <div>
        <button type="button" disabled={value.trim() === ''} className={primaryButtonClass} onClick={save}>{copy.save}</button>
      </div>
    </>
  );
}

/** 05 §7 section 2. */
export function TaskCard({ item, onChanged }: { item: WorkItem; onChanged: () => void }) {
  const [review, setReview] = useState(false);
  const { failure, act, quiet } = useAct(onChanged);
  const base = `/api/runtime/work-items/${encodeURIComponent(item.id)}`;
  return (
    <Card title={itemTitle(item)}>
      <p className="text-[13px] leading-relaxed text-slate-700">{item.what}</p>
      <p className="text-xs text-slate-500">{`${item.recordTitle} (${item.recordId})`}</p>
      {item.dueAt ? <p className="text-xs font-semibold text-slate-500">{copy.due(dateText(item.dueAt))}</p> : null}
      {item.comment ? <p className="text-[13px] text-slate-700">{item.comment}</p> : null}
      <FailureLine text={failure} />
      {item.kind === 'needs_information' ? <FieldEditor item={item} onChanged={onChanged} /> : null}
      <div className="flex flex-wrap gap-2">
        {item.kind === 'task' ? <button type="button" className={primaryButtonClass} onClick={() => void quiet(`${base}/done`, {})}>{copy.markDone}</button> : null}
        {item.kind === 'collect' ? <button type="button" className={primaryButtonClass} onClick={() => void quiet(`${base}/submit-items`, { items: item.items ?? [] })}>{copy.handOver}</button> : null}
        {item.kind === 'resubmit' ? <button type="button" className={primaryButtonClass} onClick={() => void quiet(`${base}/resubmit`, {})}>{copy.resubmit}</button> : null}
        {item.kind === 'collect_review' ? (
          <>
            <button type="button" className={primaryButtonClass} onClick={() => void quiet(`${base}/decide`, { decision: 'verified' })}>{copy.verified}</button>
            <button type="button" className={buttonClass} onClick={() => setReview(true)}>{copy.notVerified}</button>
          </>
        ) : null}
      </div>
      {review ? (
        <RunDialog title={copy.notVerifiedTitle} field={{ label: copy.comment, required: true }} confirm={copy.notVerified} danger onCancel={() => setReview(false)} onConfirm={(comment) => act(`${base}/decide`, { decision: 'not_verified', comment })} />
      ) : null}
    </Card>
  );
}

export interface FlowCardData { item: WorkItem; requestId: string; title: string; sentBy: string; impact: string; overlaps: string[]; status: string }

/** 05 §7 section 3. The first decision closes every copy, so the second person's page says it has gone. */
export function FlowChangeCard({ card, onChanged }: { card: FlowCardData; onChanged: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const { failure, act, quiet } = useAct(onChanged);
  const base = `/api/flow-studio/publish-requests/${encodeURIComponent(card.requestId)}`;
  return (
    <Card
      title={card.title}
      footer={
        <>
          <button type="button" className={primaryButtonClass} onClick={() => void quiet(`${base}/approve`, {})}>{copy.approve}</button>
          <button type="button" className={buttonClass} onClick={() => setRejecting(true)}>{copy.reject}</button>
        </>
      }
    >
      <p className="text-xs font-semibold text-slate-500">{card.sentBy}</p>
      <p className="text-[13px] leading-relaxed text-slate-700">{card.impact}</p>
      {card.overlaps.map((line) => <p key={line} className="text-[13px] text-slate-700">{line}</p>)}
      <FailureLine text={failure} />
      {rejecting ? (
        <RunDialog title={copy.rejectTitle(card.title.split(' · ')[0])} field={{ label: copy.comment, required: true }} confirm={copy.reject} danger onCancel={() => setRejecting(false)} onConfirm={(comment) => act(`${base}/reject`, { comment })} />
      ) : null}
    </Card>
  );
}
