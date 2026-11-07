import type { Catalog } from '../model/catalog';
import type { EngineContext } from '../model/context';
import type { Workflow } from '../model/workflow';
import { copy } from './copy';
import { findOverlaps } from './publish';
import { publishedFacts } from './selection';

/** Engine §14.3 and D29: "job posting" / "job postings", "SOW" / "SOWs". */
export function recordNouns(label: string): { one: string; many: string } {
  const one = label === label.toUpperCase() ? label : label.toLowerCase();
  return { one, many: `${one}s` };
}

/** Engine §14.3. */
export function inactiveWarning(wf: Workflow, ctx: Pick<EngineContext, 'workflows'> & { catalog: Pick<Catalog, 'RECORDS'> }): string | null {
  if (wf.status !== 'inactive') return null;
  // What stops running, and what would catch it, as published: a draft save on either doesn't change what real requests do.
  const facts = publishedFacts(wf);
  const holdsApprovals = Object.values((wf.published ?? wf.draft).nodes).some((node) => node.kind === 'appr' || node.kind === 'policy');
  if (!holdsApprovals) return null;
  const covered = ctx.workflows.some((other) => {
    const theirs = publishedFacts(other);
    return (
      other.id !== wf.id &&
      other.status === 'live' &&
      theirs.event === facts.event &&
      theirs.records.some((record) => facts.records.includes(record)) &&
      Object.values(theirs.scope).every((values) => !values || values.length === 0)
    );
  });
  if (covered) return null;
  const { one, many } = recordNouns(ctx.catalog.RECORDS[facts.records[0]]);
  return copy.inactiveWarning(one, many);
}

/**
 * 03 §14.4 makes the switch immediate, and 03 §14.5 takes an inactive workflow out of overlaps, so switching one back on can
 * leave two running with nothing to choose between them. It isn't blocked; it is said. An open product question: see the notes.
 */
function overlapWarning(wf: Workflow, ctx: Pick<EngineContext, 'workflows'> & Partial<Pick<EngineContext, 'history'>>): string | null {
  if (wf.status !== 'live' || !ctx.history || wf.priority != null) return null;
  const facts = publishedFacts(wf);
  const [open] = findOverlaps({ ...wf, records: facts.records, event: facts.event, scope: facts.scope }, { workflows: ctx.workflows, history: ctx.history }).filter((overlap) => overlap.priority == null);
  return open ? copy.overlapAfterSwitch(open.name) : null;
}

/** Engine §14.2: what the first box shows. */
export function activeState(wf: Workflow, ctx: Pick<EngineContext, 'workflows'> & Partial<Pick<EngineContext, 'history'>> & { catalog: Pick<Catalog, 'RECORDS'> }) {
  if (wf.status === 'draft') return { hasSwitch: false, on: false, title: copy.activeDraftTitle, text: copy.activeDraftText, warning: null };
  if (wf.status === 'live') return { hasSwitch: true, on: true, title: copy.activeLiveTitle, text: copy.activeLiveText, warning: overlapWarning(wf, ctx) };
  return { hasSwitch: true, on: false, title: copy.activeInactiveTitle, text: copy.activeInactiveText, warning: inactiveWarning(wf, ctx) };
}

/** Engine §14.4: immediate, needs no second person, and does not change the version. Drafts have no switch. */
export function setActive(wf: Workflow, on: boolean): { workflow: Workflow; toast: string } {
  const workflow = structuredClone(wf);
  workflow.status = on ? 'live' : 'inactive';
  return { workflow, toast: on ? copy.activeAgainToast(wf.name) : copy.inactiveToast(wf.name) };
}
