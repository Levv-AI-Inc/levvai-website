import type { EventKey, RecordKey } from '../model/catalog';
import type { PrereqKey } from '../model/helpers';
import type { Workflow, Scope } from '../model/workflow';
import { scopeMatch, type Rec } from './conditions';

export interface Selection {
  workflow: Workflow | null;
  tie: boolean;
  tied: Workflow[];
  beaten: Workflow[];
}

const listed = (scope: Scope, key: string): string[] => (scope as Record<string, string[] | undefined>)[key] ?? [];

/** Engine §3.1: a is the same as or narrower than b. */
export function inside(a: Scope, b: Scope): boolean {
  return Object.keys(b).every((key) => {
    const allowed = listed(b, key);
    if (allowed.length === 0) return true;
    const values = listed(a, key);
    return values.length > 0 && values.every((value) => allowed.includes(value));
  });
}

export const strictlyInside = (a: Scope, b: Scope): boolean => inside(a, b) && !inside(b, a);

/**
 * Engine §3.2: a live workflow runs on what was published, not on what is being edited. A draft save changes the workflow's
 * own record, event and Applies to; none of it counts until the second person approves. The version row is the record of
 * that. Before a workflow has one (a draft, or engine tests with no store), its own fields are all there is.
 */
export function publishedFacts(workflow: Workflow): { records: Workflow['records']; event: Workflow['event']; scope: Scope; name: string } {
  const latest = workflow.versions?.find((version) => version.version === workflow.version);
  return {
    records: latest?.records ?? workflow.records,
    event: latest?.event ?? workflow.event,
    scope: workflow.published?.scope ?? workflow.scope,
    name: workflow.published?.name ?? workflow.name,
  };
}

const liveScope = (workflow: Workflow): Scope => publishedFacts(workflow).scope;

/** Engine §3.2. Drafts and inactive workflows never run. */
export function selectWorkflow(rec: Rec & { record?: unknown; event?: unknown }, workflows: Workflow[]): Selection {
  const cands = workflows.filter(
    (w) =>
      w.status === 'live' &&
      publishedFacts(w).records.includes(rec.record as Workflow['records'][number]) &&
      publishedFacts(w).event === rec.event &&
      scopeMatch(liveScope(w), rec),
  );
  if (cands.length === 0) return { workflow: null, tie: false, tied: [], beaten: [] };

  const top = cands.filter((x) => !cands.some((y) => y !== x && strictlyInside(liveScope(y), liveScope(x))));
  const sorted = top.map((w, i) => ({ w, i })).sort((a, b) => (a.w.priority ?? 99) - (b.w.priority ?? 99) || a.i - b.i).map(({ w }) => w);
  return {
    workflow: sorted[0],
    tie: sorted.length > 1,
    tied: sorted.slice(1),
    beaten: cands.filter((w) => !top.includes(w)),
  };
}

/** Engine §15 item 2: the built-in start condition of a record and event. */
export function prereqFor(record: RecordKey, event: EventKey): PrereqKey {
  if (record === 'work_order' && (event === 'changed' || event === 'approved' || event === 'accepted')) return 'wo_approved';
  if (record === 'onboarding') return 'wo_approved';
  if (record === 'offboarding' && event === 'off_start') return 'active';
  if (record === 'sow' && (event === 'change_order' || event === 'milestone' || event === 'closed')) return 'sow_approved';
  if (record === 'invoice' && event === 'received') return 'ts_approved';
  if (record === 'assignment') return 'cleared';
  if (record === 'timesheet' || record === 'expense') return 'active';
  return 'none';
}
