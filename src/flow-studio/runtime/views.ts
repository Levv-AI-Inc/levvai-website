import { copy, curl } from '../engine/copy';
import { personLabel } from '../engine/resolve';
import { stepResult } from '../engine/simulate';
import { fmt } from '../engine/text';
import type { Catalog } from '../model/catalog';
import type { StepRun, WorkflowRun } from '../model/runtime';
import type { WfNode } from '../model/workflow';
import { runtimeCopy as rc } from './copy';
import { isRuleStep, stepName } from './machine';
import type { RunSession } from './session';
import { dateText, dateTimeText } from './time';

/** The run page's data (05 §6.2). The strings are built here so a test can read them without a browser. */

export interface StepView {
  id: string;
  name: string;
  status: StepRun['status'];
  label: string;
  message: string;
  timers?: string;
  ref?: string;
  values?: { field: string; value: string }[];
  simulated?: string;
}

function waitingLabel(s: RunSession, id: string, step: StepRun): string {
  const people = Array.from(new Set(s.items.filter((item) => item.nodeId === id && item.status === 'open' && !item.chaserOf).map((item) => item.assignee)));
  if (people.length > 0) return rc.screen.waitingOn(people.join(', '));
  if (step.waitUntil) return rc.screen.waitingOn(`${dateTimeText(step.waitUntil)} UTC`);
  if (s.env.nodes[id]?.kind === 'appr' && !step.resubmit) return rc.screen.waitingOn(rc.screen.someoneEligible);
  return rc.screen.inProgress;
}

export function statusLabel(s: RunSession, id: string, step: StepRun): string {
  switch (step.status) {
    case 'pending':
      return rc.screen.notStarted;
    case 'active':
      return rc.screen.inProgress;
    case 'waiting':
      return waitingLabel(s, id, step);
    case 'done':
      return rc.screen.done;
    case 'skipped':
      return rc.screen.skipped;
    case 'failed':
      return rc.screen.failed;
    default:
      return rc.screen.cancelled;
  }
}

function messageOf(s: RunSession, id: string, node: WfNode | undefined): string {
  if (!node) return '';
  if (node.kind === 'cond') return s.run.steps[id]?.outcome ? node.outs.find((out) => out.key === s.run.steps[id].outcome)?.label ?? '' : '';
  const step = s.run.steps[id];
  const finished = step?.status === 'done';
  const answered = (step?.decisions ?? []).map((entry) => (entry.decision === 'approved' ? rc.approved(entry.by) : entry.decision === 'rejected' ? rc.rejected(entry.by, entry.comment ?? '') : rc.sentBack(entry.by, entry.comment ?? ''))).join(' ');
  // Test's wording says what will happen. A step that was stopped never will: "Cancelled" and whatever was answered first.
  if (step?.status === 'cancelled') return answered;
  // Once a person has answered, the step says what they did.
  if (node.kind === 'appr' && finished && answered) return answered;
  const rec = s.rec0();
  if (node.kind === 'collect' && finished && node.verify === 'person') return `${copy.askedOf(personLabel(node.from ?? 'worker', rec, s.env.ctx), node.items.join(', ') || copy.nothingListedYet)}.`;
  return stepResult(node, rec, s.run.plan, s.env.wf, s.env.ctx)?.m ?? '';
}

export function stepViews(s: RunSession): StepView[] {
  const started = Object.entries(s.run.steps).filter(([, step]) => step.seq !== undefined).sort((a, b) => (a[1].seq as number) - (b[1].seq as number)).map(([id]) => id);
  const onPath = s.run.plan.walk.seen.filter((id) => !started.includes(id));
  const hidden = ['trigger', 'parallel', 'end'];
  return [...started, ...onPath]
    .filter((id) => isRuleStep(id) || (s.env.nodes[id] && !hidden.includes(s.env.nodes[id].kind)))
    .map((id): StepView => {
      const step = s.step(id);
      const node = s.env.nodes[id];
      const values = step.values ? Object.entries(step.values).map(([field, value]) => ({ field, value: String(value) })) : undefined;
      const waiting = step.status === 'waiting' && step.remindAt && step.escalateAt;
      return {
        id,
        name: stepName(s, id),
        status: step.status,
        label: statusLabel(s, id, step),
        message: messageOf(s, id, node),
        ...(waiting ? { timers: rc.screen.timers(dateTimeText(step.remindAt as string), dateTimeText(step.escalateAt as string)) } : {}),
        ...(step.systemRef ? { ref: step.systemRef } : {}),
        ...(values && values.length > 0 ? { values } : {}),
        ...(step.simulated ? { simulated: step.simulated } : {}),
      };
    });
}

/** 05 §6.2 "History". */
export function historyLines(run: Pick<WorkflowRun, 'log'>): string[] {
  return run.log.map((event) => {
    const date = dateTimeText(event.at);
    switch (event.type) {
      case 'paused':
        return rc.screen.log.paused(event.by, date, event.m);
      case 'resumed':
        return rc.screen.log.resumed(event.by, date);
      case 'stopped':
        return event.by === 'Levv' ? rc.screen.log.other(event.m, date) : rc.screen.log.stopped(event.by, date, event.m);
      default:
        return rc.screen.log.other(event.m, date);
    }
  });
}

export function bannerOf(s: RunSession): { tone: 'paused' | 'stopped'; text: string } | null {
  const { run } = s;
  if (run.status === 'paused') {
    if (run.pauseReason === 'system_failure') {
      const failed = Object.keys(run.steps).find((id) => run.steps[id].status === 'failed' && s.env.nodes[id]?.kind === 'system');
      const node = failed ? s.env.nodes[failed] : undefined;
      return { tone: 'paused', text: rc.screen.pausedBySystem(node?.kind === 'system' ? node.system : '') };
    }
    const reason = [...run.log].reverse().find((event) => event.type === 'paused')?.m ?? '';
    return { tone: 'paused', text: rc.screen.pausedBanner(run.pausedBy as string, dateTimeText(run.pausedAt as string), reason) };
  }
  if (run.status === 'stopped') {
    const date = `${dateTimeText(run.stoppedAt as string)} UTC`;
    return { tone: 'stopped', text: rc.screen.stoppedBanner(run.stoppedBy as string, date, run.stopReason as string) };
  }
  return null;
}

/** The path the canvas lights up: what actually ran, and what the plan still expects (05 §6.2). */
export function runPath(s: RunSession): string[] {
  const path = new Set<string>();
  for (const [id, step] of Object.entries(s.run.steps)) {
    if (step.status === 'pending' && !s.run.plan.walk.seen.includes(id)) continue;
    if (step.status === 'skipped' && step.completedAt === undefined) continue;
    path.add(id);
    for (const key of step.taken ?? []) path.add(`${id}:${key}`);
  }
  if (s.run.status === 'running' || s.run.status === 'paused') {
    for (const entry of Array.from(s.run.plan.walk.path)) {
      const [from] = entry.split(':');
      const step = s.run.steps[from];
      if (!step?.taken || step.status === 'pending') path.add(entry);
    }
  }
  return Array.from(path);
}

const toSnake = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Run and event bookkeeping, and what the page's title already says. */
const NOT_RECORD_VALUES = ['id', 'record', 'event', 'source', 'title', 'prev', 'conflict', 'outcomes', 'outcomesL', 'states', 'edit', 'decided'];

/** 05 §6.2 "Record panel": the catalog's labels and the spec's value formats, never field ids or raw numbers. */
export function recordValues(s: RunSession): { values: RecordRow[]; ids: RecordRow[] } {
  const data = s.record.data as Record<string, unknown>;
  const { catalog, systems } = s.env.ctx;
  const brought = new Map(Object.values(systems.SYS).flatMap((system) => system.back.map((field): [string, string] => [toSnake(field), field])));
  const levvLabels = new Map(catalog.LEVV_F.map((label): [string, string] => [toSnake(label), label]));
  const labelOf = (field: string): string =>
    brought.get(field) ?? catalog.FIELD[field]?.l ?? levvLabels.get(field) ?? (catalog.WAIT_DATES as Record<string, string | undefined>)[field] ?? rc.screen.recordLabels[field] ?? `${field.charAt(0).toUpperCase()}${field.slice(1).replace(/_/g, ' ')}`;
  const row = (field: string): RecordRow => ({ field, label: curl(labelOf(field)), value: recordValueText(field, data[field], catalog) });
  const keys = Object.keys(data).filter((key) => !NOT_RECORD_VALUES.includes(key) && data[key] !== null && data[key] !== undefined);
  return { values: keys.filter((key) => !brought.has(key)).map(row), ids: keys.filter((key) => brought.has(key)).map(row) };
}

export interface RecordRow {
  field: string;
  label: string;
  value: string;
}

/** 03 §1.1 for money, 03 §1.3 for percentages and lists, 05 §6's date format. */
function recordValueText(field: string, value: unknown, catalog: Pick<Catalog, 'FIELD'>): string {
  if (Array.isArray(value)) return value.map((item) => String(item).replace(/_/g, ' ')).join(', ');
  if (typeof value === 'boolean') return value ? rc.screen.yes : rc.screen.no;
  const type = catalog.FIELD[field]?.t;
  if (typeof value === 'number' && type === 'money') return fmt(value);
  if (typeof value === 'number' && type === 'pct') return `${value}%`;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateText(value);
  return String(value);
}
