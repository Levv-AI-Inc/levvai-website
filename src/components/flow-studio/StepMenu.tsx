'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { curl } from '@flow-studio/engine/copy';
import type { StepSpec } from '@flow-studio/engine/edit';
import { dwContext } from '@flow-studio/engine/text';
import type { EngineContext } from '@flow-studio/model/context';
import type { Workflow } from '@flow-studio/model/workflow';
import { uiCopy } from './copy';
import { Drawer } from './Drawer';
import { DW_ICONS, KIND_STYLE } from './kinds';

interface MenuOption {
  key: string;
  name: string;
  description: string;
  spec: StepSpec;
  setup?: boolean;
}

interface MenuGroup {
  heading: string;
  options: MenuOption[];
}

/** 04 §5, in order: ready-made steps where they apply, then the kinds, then this context's Digital Workers. */
function menuGroups(workflow: Workflow, ctx: EngineContext): MenuGroup[] {
  const groups: MenuGroup[] = [];
  const context = dwContext(workflow);
  if (context === 'onboarding' || context === 'offboarding') {
    const phase = context === 'onboarding' ? 'on' : 'off';
    groups.push({
      heading: context === 'onboarding' ? uiCopy.menuOnboarding : uiCopy.menuOffboarding,
      options: Object.entries(ctx.presets.PRESETS)
        .filter(([, preset]) => preset.ph === phase)
        .map(([key, preset]) => ({ key: `preset:${key}`, name: preset.n, description: preset.d, spec: { kind: preset.kind, preset: key } })),
    });
  }
  for (const [heading, kinds] of ctx.catalog.ADD.workflows) {
    groups.push({
      heading,
      options: kinds.map((kind) => ({ key: kind, name: ctx.catalog.K[kind], description: ctx.catalog.DESC[kind] ?? '', spec: { kind } })),
    });
  }
  groups.push({
    heading: uiCopy.menuDigitalWorkers,
    options: ctx.dws.DW_SET[context]
      .map((id) => ctx.dws.DW[id])
      .filter((worker) => worker.s !== 'off')
      .map((worker) => ({ key: `dw:${worker.id}`, name: worker.n, description: ctx.dws.DWD[worker.id] ?? '', spec: { kind: 'dw', worker: worker.id }, setup: worker.s === 'setup' })),
  });
  return groups;
}

function OptionTile({ option }: { option: MenuOption }) {
  if (option.spec.kind === 'dw') {
    const Icon = DW_ICONS[option.spec.worker ?? ''] ?? Sparkles;
    return (
      <span style={{ background: 'radial-gradient(circle at 35% 30%, #3b2a63, #1a1230)' }} className="grid h-9 w-9 flex-none place-items-center rounded-full border-[1.5px] border-violet-500">
        <Icon aria-hidden className="h-[18px] w-[18px] text-violet-200" />
      </span>
    );
  }
  const { icon: Icon, color } = KIND_STYLE[option.spec.kind];
  return (
    <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-slate-900">
      <Icon aria-hidden className={`h-[18px] w-[18px] ${color}`} />
    </span>
  );
}

interface StepMenuProps {
  workflow: Workflow;
  ctx: EngineContext;
  compact: boolean;
  onPick: (spec: StepSpec) => void;
  onClose: () => void;
}

/** 04 §5: opens in the drawer slot. */
export function StepMenu({ workflow, ctx, compact, onPick, onClose }: StepMenuProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => search.current?.focus(), []);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return menuGroups(workflow, ctx)
      .map((group) => ({ ...group, options: group.options.filter((option) => `${option.name} ${option.description}`.toLowerCase().includes(needle)) }))
      .filter((group) => group.options.length > 0);
  }, [workflow, ctx, query]);
  const flat = groups.flatMap((group) => group.options);
  const highlighted = Math.min(active, Math.max(0, flat.length - 1));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.max(0, Math.min(flat.length - 1, highlighted + (event.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
      body.current?.querySelector(`[data-menu-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (flat[highlighted]) onPick(flat[highlighted].spec);
    }
  };

  let index = -1;
  return (
    <Drawer title={uiCopy.menuTitle} subtitle={uiCopy.menuSubtitle} compact={compact} onClose={onClose} icon={<Plus aria-hidden className="h-[18px] w-[18px] text-cyan-600" />}>
      <input
        ref={search}
        type="text"
        aria-label={uiCopy.search}
        placeholder={uiCopy.menuSearch}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className="w-full flex-none rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-[9px] text-sm focus:border-cyan-600 focus:bg-white focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
      />
      <div ref={body} className="flex flex-col gap-3">
        {flat.length === 0 ? <p className="text-[13px] text-slate-500">{uiCopy.menuEmpty(query)}</p> : null}
        {groups.map((group) => (
          <div key={group.heading}>
            <h3 className="mb-1.5 mt-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">{group.heading}</h3>
            {group.options.map((option) => {
              index += 1;
              const at = index;
              return (
                <button
                  key={option.key}
                  type="button"
                  data-menu-index={at}
                  onClick={() => onPick(option.spec)}
                  onMouseMove={() => setActive(at)}
                  className={`flex w-full items-center gap-3 rounded-[10px] border px-2.5 py-2 text-left hover:border-slate-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${at === highlighted ? 'border-slate-200 bg-slate-50' : 'border-transparent'}`}
                >
                  <OptionTile option={option} />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold">
                      {curl(option.name)}
                      {option.setup ? <span className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-px text-[10px] font-black uppercase tracking-wider text-amber-700">{uiCopy.needsSetup}</span> : null}
                    </span>
                    <span className="block text-xs text-slate-500">{curl(option.description)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Drawer>
  );
}
