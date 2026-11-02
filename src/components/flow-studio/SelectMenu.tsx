'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { uiCopy } from './copy';

/** 04 §13: every selection in Flow Studio goes through this one component. */

export type SelectOption = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
};

type Base = {
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  size?: 'md' | 'sm';
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
};

export type SingleSelectProps = Base & {
  multiple?: false;
  value: string | null;
  onChange: (value: string) => void;
};

export type MultiSelectProps = Base & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
  emptySummary?: string;
  maxSummaryItems?: number;
  allowAdd?: boolean;
  onAdd?: (label: string) => void;
};

const ADD_KEY = '\u0000add';

type Row = { type: 'header'; text: string } | { type: 'option'; option: SelectOption } | { type: 'add'; label: string };

interface Position {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

/** 04 §13.5 "Opening another SelectMenu closes this one", also when it opens by keyboard and no click lands outside. */
let closeOpenMenu: (() => void) | null = null;

function buildRows(options: SelectOption[], query: string, addable: boolean): Row[] {
  const needle = query.trim().toLowerCase();
  const shown = options.filter((option) => (option.value !== '' || option.label !== '') && option.label.toLowerCase().includes(needle));
  const groups: (string | undefined)[] = [];
  for (const option of shown) if (!groups.includes(option.group)) groups.push(option.group);
  const rows: Row[] = [];
  for (const group of groups) {
    if (group) rows.push({ type: 'header', text: group });
    for (const option of shown) if (option.group === group) rows.push({ type: 'option', option });
  }
  const typed = query.trim();
  if (addable && typed && !options.some((option) => option.label.toLowerCase() === typed.toLowerCase())) {
    rows.push({ type: 'add', label: typed });
  }
  return rows;
}

const keyOf = (row: Row): string | null => {
  if (row.type === 'add') return ADD_KEY;
  if (row.type === 'option' && !row.option.disabled) return row.option.value;
  return null;
};

function measure(button: HTMLElement): Position | null {
  const rect = button.getBoundingClientRect();
  const { innerWidth, innerHeight } = window;
  if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return null;
  const width = Math.max(rect.width, 240);
  const left = Math.min(Math.max(8, rect.left), Math.max(8, innerWidth - width - 8));
  const spaceBelow = innerHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  // 04 §13.4's placement. Its height, `min(320, max(below, above))`, is capped here by the side actually used: otherwise a list
  // opening below with less than 320 runs off the screen, and takes the footer's Clear with it.
  if (spaceBelow >= Math.min(220, spaceAbove)) return { left, width, maxHeight: Math.min(320, spaceBelow), top: rect.bottom + 4 };
  return { left, width, maxHeight: Math.min(320, spaceAbove), bottom: innerHeight - rect.top + 4 };
}

export function SelectMenu(props: SingleSelectProps | MultiSelectProps) {
  const { options, placeholder, searchPlaceholder = uiCopy.searchPlaceholder, size = 'md', disabled = false, invalid = false, id, className } = props;
  const multi = props.multiple === true;
  const selected = useMemo<string[]>(() => {
    if (props.multiple === true) return props.value;
    return props.value === null ? [] : [props.value];
  }, [props.multiple, props.value]);
  const addable = props.multiple === true && props.allowAdd === true;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const reactId = useId();
  const listId = `${reactId}-list`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollActiveIntoView = useRef(false);

  const rows = useMemo(() => buildRows(options, query, addable), [options, query, addable]);
  const keys = useMemo(() => rows.map(keyOf).filter((key): key is string => key !== null), [rows]);
  const active = activeKey !== null && keys.includes(activeKey) ? activeKey : keys[0] ?? null;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const closeSilently = useCallback(() => close(false), [close]);

  function openMenu() {
    if (disabled || !buttonRef.current) return;
    closeOpenMenu?.();
    const next = measure(buttonRef.current);
    if (!next) return;
    setPosition(next);
    setQuery('');
    setActiveKey(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return undefined;
    closeOpenMenu = closeSilently;
    inputRef.current?.focus();
    if (listRef.current) listRef.current.scrollTop = 0;
    return () => {
      if (closeOpenMenu === closeSilently) closeOpenMenu = null;
    };
  }, [open, closeSilently]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    // 04 §13.5: stays attached on every scroll frame; closes once its button has left the viewport.
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && popoverRef.current?.contains(event.target)) return;
      const button = buttonRef.current;
      if (!button) return;
      const next = measure(button);
      if (next) setPosition(next);
      else setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !scrollActiveIntoView.current) return;
    scrollActiveIntoView.current = false;
    if (active === null) return;
    listRef.current?.querySelector<HTMLElement>(`[data-active="true"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function setSearch(next: string) {
    setQuery(next);
    setActiveKey(null);
    if (listRef.current) listRef.current.scrollTop = 0;
  }

  function pick(key: string) {
    if (props.multiple === true) {
      if (key === ADD_KEY) {
        const typed = query.trim();
        setSearch('');
        props.onAdd?.(typed);
        return;
      }
      const has = props.value.includes(key);
      props.onChange(has ? props.value.filter((value) => value !== key) : [...props.value, key]);
      setActiveKey(key);
      return;
    }
    props.onChange(key);
    close(true);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        event.stopPropagation();
        const index = active === null ? -1 : keys.indexOf(active);
        const next = event.key === 'ArrowDown' ? Math.min(keys.length - 1, index + 1) : Math.max(0, index - 1);
        if (keys[next] !== undefined) {
          scrollActiveIntoView.current = true;
          setActiveKey(keys[next]);
        }
        return;
      }
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        if (active !== null) pick(active);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case 'Tab':
        // Back on the button first, so the browser moves focus on from the field rather than from the portal.
        buttonRef.current?.focus();
        setOpen(false);
        return;
      default:
    }
  }

  const summary = valueText(props, options);
  const small = size === 'sm';
  const optionId = (key: string): string => `${reactId}-opt-${keys.indexOf(key)}`;

  return (
    <div className={[small ? 'inline-block w-auto min-w-[80px] align-middle' : 'w-full', className].filter(Boolean).join(' ')}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        title={summary ?? undefined}
        onClick={() => (open ? close(false) : openMenu())}
        className={[
          'flex w-full items-center justify-between gap-2 rounded-lg border bg-slate-50 text-left text-[13px] text-slate-900 hover:border-cyan-600 aria-expanded:border-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-600 disabled:cursor-not-allowed disabled:hover:border-slate-200',
          small ? 'min-h-[30px] px-2 py-1' : 'min-h-9 px-2.5 py-[7px]',
          invalid ? 'border-rose-500' : 'border-slate-200',
        ].join(' ')}
      >
        <span className={['flex-1 truncate', summary === null ? 'text-slate-500' : ''].join(' ')}>{summary ?? placeholder}</span>
        <ChevronDown aria-hidden className="h-3 w-3 flex-none text-slate-500" />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={popoverRef}
              onKeyDown={(event) => event.stopPropagation()}
              style={{ position: 'fixed', zIndex: 9999, left: position.left, width: position.width, maxHeight: position.maxHeight, top: position.top, bottom: position.bottom }}
              className="flex flex-col overflow-hidden rounded-[10px] border border-slate-200 bg-white text-slate-900 shadow-[0_12px_32px_rgba(15,23,42,.18)]"
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                aria-label={uiCopy.search}
                placeholder={searchPlaceholder}
                aria-activedescendant={active === null ? undefined : optionId(active)}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={onSearchKeyDown}
                className="flex-none border-0 border-b border-slate-200 bg-transparent px-3 py-[9px] text-[13px] outline-none"
              />
              <div
                ref={listRef}
                id={listId}
                role="listbox"
                aria-multiselectable={multi ? true : undefined}
                aria-label={props['aria-label']}
                aria-labelledby={props['aria-labelledby']}
                className="min-h-0 flex-1 overflow-auto p-1"
              >
                {rows.length === 0 ? <div className="px-2.5 py-2.5 text-[13px] text-slate-500">{uiCopy.noMatches}</div> : null}
                {rows.map((row) => {
                  if (row.type === 'header') {
                    return (
                      <div key={`header-${row.text}`} role="presentation" className="px-2.5 pb-1 pt-2 text-[11px] uppercase tracking-[0.04em] text-slate-500">
                        {row.text}
                      </div>
                    );
                  }
                  const key = keyOf(row);
                  const isActive = key !== null && key === active;
                  if (row.type === 'add') {
                    return (
                      <div
                        key="add"
                        id={optionId(ADD_KEY)}
                        role="option"
                        aria-selected={false}
                        data-active={isActive}
                        onMouseMove={() => setActiveKey(ADD_KEY)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(ADD_KEY)}
                        className={['flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px] leading-tight text-cyan-700', isActive ? 'bg-cyan-50' : ''].join(' ')}
                      >
                        <span className="w-[15px] flex-none text-center font-bold">+</span>{' '}
                        <span>{uiCopy.addOption(row.label).slice(2)}</span>
                      </div>
                    );
                  }
                  const { option } = row;
                  const isSelected = selected.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      id={key === null ? undefined : optionId(key)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled ? true : undefined}
                      data-active={isActive}
                      onMouseMove={() => {
                        if (key !== null) setActiveKey(key);
                      }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (key !== null) pick(key);
                      }}
                      className={[
                        'flex items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px] leading-tight',
                        option.disabled ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer',
                        isSelected ? 'font-semibold text-cyan-700' : '',
                        isActive ? 'bg-cyan-50' : '',
                      ].join(' ')}
                    >
                      {multi ? (
                        <span
                          aria-hidden
                          className={[
                            'grid h-[15px] w-[15px] flex-none place-items-center rounded border-[1.5px] text-[10px] leading-none text-white',
                            isSelected ? 'border-cyan-600 bg-cyan-600' : 'border-slate-200',
                          ].join(' ')}
                        >
                          {isSelected ? '✓' : ''}
                        </span>
                      ) : null}
                      <span className="min-w-0">{option.label}</span>
                    </div>
                  );
                })}
              </div>
              {props.multiple === true ? (
                <div className="flex flex-none items-center justify-between border-t border-slate-200 px-2.5 py-1.5 text-xs text-slate-500">
                  <span>{props.value.length > 0 ? uiCopy.selected(props.value.length) : props.emptySummary ?? uiCopy.noneSelected}</span>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => props.onChange([])} className="rounded text-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
                    {uiCopy.clear}
                  </button>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** 04 §13.3. `null` means "show the placeholder". */
function valueText(props: SingleSelectProps | MultiSelectProps, options: SelectOption[]): string | null {
  const labelOf = (value: string): string => options.find((option) => option.value === value)?.label ?? value;
  if (props.multiple === true) {
    if (props.value.length === 0) return null;
    const limit = props.maxSummaryItems ?? 2;
    const labels = props.value.slice(0, limit).map(labelOf).join(', ');
    return props.value.length > limit ? `${labels} +${props.value.length - limit}` : labels;
  }
  if (props.value === null) return null;
  const match = options.find((option) => option.value === props.value);
  return match ? match.label : null;
}
