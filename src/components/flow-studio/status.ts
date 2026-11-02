import { statusDot } from '@flow-studio/engine/publish';
import type { Workflow } from '@flow-studio/model/workflow';

/** 04 §2.4. */
const DOT_CLASS = { live: 'bg-emerald-600', dirty: 'bg-cyan-600', draft: 'bg-amber-600', off: 'bg-slate-400' } as const;

export const dotClass = (workflow: Workflow): string => DOT_CLASS[statusDot(workflow)];
