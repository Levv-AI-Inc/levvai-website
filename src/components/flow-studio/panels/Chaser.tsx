'use client';

import { BellRing } from 'lucide-react';
import { copy } from '@flow-studio/engine/copy';
import { chaserFor } from '@flow-studio/engine/text';
import type { ApproveNode, CollectNode, TaskNode } from '@flow-studio/model/workflow';
import { fieldLabelClass } from '../ui/primitives';
import { NumberBox } from './fields';

/** 04 §6.3. Values are kept as typed; the error and lint L18 say what is wrong with them. */
export function Chaser({ node, onChange }: { node: ApproveNode | TaskNode | CollectNode; onChange: (field: 'remind' | 'sla', value: number) => void }) {
  const chaser = chaserFor(node);
  const invalid = chaser.escalateAfterHours <= chaser.remindAfterHours;
  const set = (field: 'remind' | 'sla') => (value: number | null): void => {
    if (value !== null) onChange(field, value);
  };
  return (
    <div className="my-2.5 grid gap-1.5 rounded-[10px] border border-slate-200 bg-slate-50/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <BellRing aria-hidden className="h-4 w-4 text-violet-400" />
        <span className="text-[13px] font-semibold">{copy.chaserTitle}</span>
        <span className="rounded-full border border-slate-200 px-1.5 text-[11px] text-slate-500">{copy.chaserBuiltIn}</span>
      </div>
      <div className="grid grid-cols-2 items-end gap-2">
        <label>
          <span className={fieldLabelClass}>{copy.chaserRemindLabel}</span>
          <NumberBox value={chaser.remindAfterHours} min={1} invalid={invalid} onChange={set('remind')} />
        </label>
        <label>
          <span className={fieldLabelClass}>{chaser.label}</span>
          <NumberBox value={chaser.escalateAfterHours} min={1} invalid={invalid} onChange={set('sla')} />
        </label>
      </div>
      {invalid ? <div className="text-xs text-rose-700">{copy.escalationAfterReminder}</div> : null}
      <div className="text-xs text-slate-500">{copy.chaserRuns}</div>
    </div>
  );
}
