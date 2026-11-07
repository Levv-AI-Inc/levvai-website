import type { StepCode } from '@flow-studio/model/results';

/** 04 §4.8: what the open Test drawer shows on the canvas. */
export interface CanvasTest {
  path: Set<string>;
  steps: Record<string, { st: StepCode; short: string }>;
  soft: Set<string>;
  heldBack: Set<string>;
}

export const TEST_RING: Record<StepCode, string> = {
  ok: 'border-emerald-500 shadow-[0_0_0_1px_#10b981,0_0_22px_rgba(16,185,129,.25)]',
  review: 'border-amber-500 shadow-[0_0_0_1px_#f59e0b,0_0_22px_rgba(245,158,11,.25)]',
  fail: 'border-rose-500 shadow-[0_0_0_1px_#f43f5e,0_0_22px_rgba(244,63,94,.3)]',
  wait: 'border-dashed border-slate-600 opacity-75',
};
