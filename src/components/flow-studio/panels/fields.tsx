'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { copy } from '@flow-studio/engine/copy';
import type { Editing } from '../use-editing';
import { SelectMenu, type SelectOption } from '../SelectMenu';
import { Field, fieldLabelClass, inputClass, invalidInputClass } from '../ui/primitives';
import { uiCopy } from '../copy';

/** What every panel is handed. */
export interface PanelEdit {
  editing: Editing;
  toast: (message: string) => void;
  openJoinMenu: (nodeId: string, opener: HTMLElement) => void;
}

export function TextField({ label, value, placeholder, onChange, type = 'text' }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void; type?: 'text' | 'date' | 'time' | 'datetime-local' }) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={inputClass} />
    </label>
  );
}

/** 04 §6.2. */
export function NameField({ value, placeholder, onChange }: { value: string; placeholder?: string; onChange: (value: string) => void }) {
  return <TextField label={uiCopy.name} value={value} placeholder={placeholder} onChange={onChange} />;
}

interface NumberBoxProps {
  value: number | null | undefined;
  min?: number;
  max?: number;
  whole?: boolean;
  /** Empty stores null (04 §6.8); elsewhere an empty box keeps the stored value until it holds a number again. */
  allowEmpty?: boolean;
  invalid?: boolean;
  label?: string;
  'aria-label'?: string;
  onChange: (value: number | null) => void;
}

/** Shows what is typed; only a number the field accepts reaches the step. Leaving the box shows the stored value again. */
export function NumberBox({ value, min, max, whole = true, allowEmpty = false, invalid = false, onChange, ...aria }: NumberBoxProps) {
  const stored = value === null || value === undefined ? '' : String(value);
  const [text, setText] = useState(stored);
  useEffect(() => setText((current) => (current === stored || Number(current) === value ? current : stored)), [stored, value]);

  const change = (next: string): void => {
    setText(next);
    if (next === '') {
      if (allowEmpty) onChange(null);
      return;
    }
    const parsed = Number(next);
    if (Number.isNaN(parsed) || (whole && !Number.isInteger(parsed))) return;
    if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max)) return;
    onChange(parsed);
  };

  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      aria-label={aria['aria-label']}
      onChange={(event) => change(event.target.value)}
      onBlur={() => setText(stored)}
      className={invalid ? invalidInputClass : inputClass}
    />
  );
}

export function NumberField({ label, ...box }: NumberBoxProps & { label: string }) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      <NumberBox {...box} />
    </label>
  );
}

export function SelectField({ label, options, value, placeholder, onChange }: { label: string; options: SelectOption[]; value: string | null; placeholder?: string; onChange: (value: string) => void }) {
  return <Field label={label}>{(labelId) => <SelectMenu aria-labelledby={labelId} options={options} value={value} placeholder={placeholder} onChange={onChange} />}</Field>;
}

export function MultiField({ label, options, value, placeholder, emptySummary, onChange }: { label: string; options: SelectOption[]; value: string[]; placeholder?: string; emptySummary?: string; onChange: (value: string[]) => void }) {
  return <Field label={label}>{(labelId) => <SelectMenu multiple aria-labelledby={labelId} options={options} value={value} placeholder={placeholder} emptySummary={emptySummary} onChange={onChange} />}</Field>;
}

export const entries = (record: Record<string, string>): SelectOption[] => Object.entries(record).map(([value, label]) => ({ value, label }));
export const plain = (values: readonly string[]): SelectOption[] => values.map((value) => ({ value, label: value }));

/** 04 §4.5, 03 §16.13: reads and writes the generated escalation step's `sla`; nothing else stores hours. */
export function EscalateAfter({ hours, remind, onChange }: { hours: number | undefined; remind: number | undefined; onChange: (hours: number) => void }) {
  const invalid = hours !== undefined && hours <= (remind ?? 24);
  return (
    <div>
      <NumberField
        label={uiCopy.escalateAfter}
        value={hours ?? 48}
        min={1}
        max={336}
        invalid={invalid}
        onChange={(value) => {
          if (value !== null) onChange(value);
        }}
      />
      {invalid ? <div className="mt-1 text-xs text-rose-700">{copy.escalationAfterReminder}</div> : null}
    </div>
  );
}

export function TwoColumns({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 items-end gap-2">{children}</div>;
}
