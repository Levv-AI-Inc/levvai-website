import type { RunSession } from './session';
import { ApiError } from '../server/errors';
import { runtimeCopy as rc } from './copy';
import { advance, cancelOpen } from './machine';
import { shift } from './time';

/** 05 §4. Permission is the service's; these are the rules that depend on the run's state at this moment. */

const refusal = {
  stopped: () => new ApiError(409, 'RUN_STOPPED', rc.runStopped),
  ended: () => new ApiError(409, 'RUN_ENDED', rc.runEnded),
};

export function pauseSession(s: RunSession, by: string, reason?: string): void {
  const { run } = s;
  if (run.status === 'stopped') throw refusal.stopped();
  if (run.status === 'paused') throw new ApiError(409, 'ALREADY_PAUSED', rc.alreadyPaused);
  if (run.status !== 'running') throw refusal.ended();
  run.status = 'paused';
  run.pausedBy = by;
  run.pausedAt = s.env.now;
  run.pauseReason = 'manual';
  s.log('paused', reason?.trim() ?? '', { by });
}

/** 05 §3.5: "every frozen timer is pushed forward by the paused duration". */
function shiftTimers(s: RunSession, ms: number): void {
  for (const step of Object.values(s.run.steps)) {
    if (step.remindAt) step.remindAt = shift(step.remindAt, ms);
    if (step.escalateAt) step.escalateAt = shift(step.escalateAt, ms);
    if (step.waitUntil && step.status === 'waiting') step.waitUntil = shift(step.waitUntil, ms);
    if (step.confirmBy) step.confirmBy = shift(step.confirmBy, ms);
    if (step.retry) step.retry = { ...step.retry, firstFailedAt: shift(step.retry.firstFailedAt, ms), nextAt: shift(step.retry.nextAt, ms) };
    if (step.resubmit) step.resubmit = { ...step.resubmit, by: shift(step.resubmit.by, ms) };
  }
  for (const item of s.items) {
    if (item.status !== 'open') continue;
    if (item.remindAt) item.remindAt = shift(item.remindAt, ms);
    if (item.escalateAt) item.escalateAt = shift(item.escalateAt, ms);
    if (item.dueAt) item.dueAt = shift(item.dueAt, ms);
    s.touchItem(item);
  }
}

export async function resumeSession(s: RunSession, by: string): Promise<void> {
  const { run } = s;
  if (run.status === 'stopped') throw refusal.stopped();
  if (run.status === 'running') throw new ApiError(409, 'NOT_PAUSED', rc.notPaused);
  if (run.status !== 'paused') throw refusal.ended();
  const pausedAt = run.pausedAt as string;
  const systemFailure = run.pauseReason === 'system_failure';
  run.status = 'running';
  delete run.pausedBy;
  delete run.pausedAt;
  delete run.pauseReason;
  shiftTimers(s, Date.parse(s.env.now) - Date.parse(pausedAt));
  if (systemFailure) {
    // "Resume retries the step" (05 §3.4.7): from the top, with its three retries.
    for (const [id, step] of Object.entries(run.steps)) {
      if (step.status === 'failed' && s.env.nodes[id]?.kind === 'system') {
        step.status = 'pending';
        delete step.retry;
        delete step.outcome;
      }
    }
  }
  s.log('resumed', '', { by });
  await advance(s);
}

export function stopSession(s: RunSession, by: string, reason: string | undefined): void {
  const { run } = s;
  if (run.status === 'stopped') throw refusal.stopped();
  if (run.status !== 'running' && run.status !== 'paused') throw refusal.ended();
  const text = reason?.trim() ?? '';
  if (!text) throw new ApiError(422, 'REASON_REQUIRED', rc.reasonRequired);
  cancelOpen(s);
  run.status = 'stopped';
  run.stoppedBy = by;
  run.stoppedAt = s.env.now;
  run.stopReason = text;
  run.endedAt = s.env.now;
  delete run.pausedBy;
  delete run.pausedAt;
  delete run.pauseReason;
  s.log('stopped', text, { by });
}
