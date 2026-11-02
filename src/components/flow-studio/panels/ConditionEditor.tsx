'use client';

import { X } from 'lucide-react';
import { defaultConditionRow, defaultEitherOr, rowForField } from '@flow-studio/engine/edit';
import type { Group, Row } from '@flow-studio/model/condition';
import type { EngineContext } from '@flow-studio/model/context';
import { uiCopy } from '../copy';
import { conditionFieldOptions, conditionValueOptions } from '../options';
import { SelectMenu } from '../SelectMenu';
import { inputClass, linkButtonClass, miniButtonClass } from '../ui/primitives';
import { NumberBox } from './fields';

const isGroup = (row: Row | Group): row is Group => (row as Group).rows !== undefined;
const iconButton = 'grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600';

function ValueControl({ row, ctx, onChange }: { row: Row; ctx: EngineContext; onChange: (row: Row) => void }) {
  const field = ctx.catalog.FIELD[row.f];
  if (field.t === 'bool') return null;
  const number = (value: number | null): void => onChange({ ...row, v: value });
  if (field.t === 'money' || field.t === 'pct' || field.t === 'num') {
    return (
      <div className="flex min-w-0 items-center gap-1 text-[13px] text-slate-500">
        {field.t === 'money' ? <span aria-hidden>$</span> : null}
        <NumberBox aria-label={uiCopy.value} value={row.v as number | null | undefined} whole={false} allowEmpty onChange={number} />
        {field.t === 'pct' ? <span aria-hidden>%</span> : null}
      </div>
    );
  }
  if (field.t === 'enum') {
    return (
      <SelectMenu
        multiple
        aria-label={uiCopy.value}
        placeholder={uiCopy.chooseValues}
        options={conditionValueOptions(field, ctx)}
        value={(row.v as string[] | undefined) ?? []}
        onChange={(v) => onChange({ ...row, v })}
      />
    );
  }
  if (field.t === 'list') {
    return <SelectMenu aria-label={uiCopy.value} options={conditionValueOptions(field, ctx)} value={(row.v as string | undefined) ?? null} onChange={(v) => onChange({ ...row, v })} />;
  }
  return <input type="text" aria-label={uiCopy.value} value={(row.v as string | undefined) ?? ''} onChange={(event) => onChange({ ...row, v: event.target.value })} className={inputClass} />;
}

/** 04 §6.8: two lines, everywhere. */
function ConditionRow({ row, ctx, first, onChange, onRemove }: { row: Row; ctx: EngineContext; first: boolean; onChange: (row: Row) => void; onRemove: () => void }) {
  const field = ctx.catalog.FIELD[row.f];
  const comparisons = field ? ctx.catalog.OPS[field.t].map((op) => ({ value: op, label: ctx.catalog.OPL[op] })) : [];
  return (
    <div className={`grid grid-cols-[minmax(0,.9fr)_minmax(0,1.4fr)_auto] gap-x-1.5 gap-y-1.5 ${first ? '' : 'border-t border-dashed border-slate-200 pt-2'}`}>
      <div className="col-span-2 min-w-0">
        <SelectMenu aria-label={uiCopy.field} options={conditionFieldOptions(ctx)} value={row.f} onChange={(next) => onChange(rowForField(next, ctx.catalog))} />
      </div>
      <button type="button" aria-label={uiCopy.removeRule} onClick={onRemove} className={iconButton}>
        <X aria-hidden className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0">
        <SelectMenu aria-label={uiCopy.comparison} options={comparisons} value={row.op} onChange={(op) => onChange({ ...row, op: op as Row['op'] })} />
      </div>
      {field ? (
        <div className="col-span-2 min-w-0">
          <ValueControl row={row} ctx={ctx} onChange={onChange} />
        </div>
      ) : null}
    </div>
  );
}

function EitherOrBox({ group, ctx, onChange, onRemove }: { group: Group; ctx: EngineContext; onChange: (group: Group) => void; onRemove: () => void }) {
  const rows = group.rows as Row[];
  const setRows = (next: Row[]): void => onChange({ ...group, rows: next });
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-slate-200 border-l-[3px] border-l-cyan-600 bg-slate-50 p-2">
      <div className="flex items-center gap-1.5 text-[12.5px]">
        <span>{uiCopy.eitherOr}</span>
        <SelectMenu
          size="sm"
          aria-label={uiCopy.eitherOr}
          options={[
            { value: 'any', label: uiCopy.anyOne },
            { value: 'all', label: uiCopy.allWord },
          ]}
          value={group.join}
          onChange={(join) => onChange({ ...group, join: join as Group['join'] })}
        />
        <span className="flex-1">{uiCopy.ofThese}</span>
        <button type="button" aria-label={uiCopy.removeGroup} onClick={onRemove} className={iconButton}>
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
      {rows.map((row, index) => (
        <ConditionRow
          key={index}
          row={row}
          ctx={ctx}
          first={index === 0}
          onChange={(next) => setRows(rows.map((current, at) => (at === index ? next : current)))}
          onRemove={() => setRows(rows.filter((_, at) => at !== index))}
        />
      ))}
      <div>
        <button type="button" className={miniButtonClass} onClick={() => setRows([...rows, defaultConditionRow()])}>
          {uiCopy.addOption2}
        </button>
      </div>
    </div>
  );
}

/** 04 §6.8, for If paths and for Approve → Only needed when. The rows are the only state; each change hands back the new list. */
export function ConditionEditor({ rows, ctx, onChange }: { rows: (Row | Group)[]; ctx: EngineContext; onChange: (rows: (Row | Group)[]) => void }) {
  const replace = (index: number, next: Row | Group): void => onChange(rows.map((row, at) => (at === index ? next : row)));
  const remove = (index: number): void => onChange(rows.filter((_, at) => at !== index));
  return (
    <>
      {rows.map((row, index) =>
        isGroup(row) ? (
          <EitherOrBox key={index} group={row} ctx={ctx} onChange={(next) => replace(index, next)} onRemove={() => remove(index)} />
        ) : (
          <ConditionRow key={index} row={row} ctx={ctx} first={index === 0} onChange={(next) => replace(index, next)} onRemove={() => remove(index)} />
        ),
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={miniButtonClass} onClick={() => onChange([...rows, defaultConditionRow()])}>
          {uiCopy.addCondition}
        </button>
        <button type="button" title={uiCopy.addEitherOrTip} className={linkButtonClass} onClick={() => onChange([...rows, defaultEitherOr()])}>
          {uiCopy.addEitherOr}
        </button>
      </div>
    </>
  );
}
