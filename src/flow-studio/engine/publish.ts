import type { EngineContext } from '../model/context';
import type { Issue, Overlap, PublishReview } from '../model/results';
import type { PendingPublish, Workflow, WorkflowVersion } from '../model/workflow';
import { scopeMatch } from './conditions';
import { copy } from './copy';
import { lintWorkflow, recordCount } from './lint';
import { publishedFacts, strictlyInside } from './selection';

export { publishedFacts };

export type Precedence = NonNullable<PendingPublish['precedence']>;

/** Who may approve: 01 §6.1. `admin` implies "Approve flow changes" (06 Part C: Samira Khan, admin). */
export interface ActingUser {
  id?: string;
  name: string;
  permissions: string[];
}

/**
 * Engine §13.4, decision 5: the author is the account that sent it. A display name can change; the id can't. Names are
 * compared only where there is no account to compare, which is engine tests and the seed.
 */
export function isAuthorOf(user: Pick<ActingUser, 'id' | 'name'>, pending: Pick<PendingPublish, 'submittedBy' | 'submittedById'>): boolean {
  return user.id !== undefined && pending.submittedById !== undefined ? user.id === pending.submittedById : user.name === pending.submittedBy;
}

/** Engine §13.3. Identical scopes overlap (D24). */
export function findOverlaps(wf: Workflow, ctx: Pick<EngineContext, 'workflows' | 'history'>): Overlap[] {
  const overlaps: Overlap[] = [];
  if (wf.status === 'inactive') return overlaps; // §14.5: inactive workflows are excluded from overlaps.
  for (const other of ctx.workflows) {
    // The other workflow as it runs: what someone has saved on its draft doesn't overlap anything until it's approved.
    const facts = publishedFacts(other);
    if (other.id === wf.id || other.status !== 'live' || facts.event !== wf.event) continue;
    if (!facts.records.some((record) => wf.records.includes(record))) continue;
    if (strictlyInside(wf.scope, facts.scope) || strictlyInside(facts.scope, wf.scope)) continue;
    const count = ctx.history.filter(
      (h) => wf.records.includes(h.record) && h.event === wf.event && scopeMatch(wf.scope, h) && scopeMatch(facts.scope, h),
    ).length;
    if (count > 0) overlaps.push({ id: other.id, name: facts.name, scope: facts.scope, priority: other.priority, count });
  }
  return overlaps;
}

/** Engine §13.1 item 5. */
export const defaultGoLive = (wf: Pick<Workflow, 'effective'>, ctx: Pick<EngineContext, 'asOf'>): string =>
  wf.effective >= ctx.asOf ? wf.effective : ctx.asOf;

/** Engine §13.1 item 5: the inline error, or null when the date is fine. */
export const goLiveError = (date: string, ctx: Pick<EngineContext, 'asOf'>): string | null => (date < ctx.asOf ? copy.pickLaterDate : null);

/** Engine §13.3: overlaps nothing decides between, neither a priority nor a choice. */
const unresolvedOverlaps = (wf: Pick<Workflow, 'priority'>, overlaps: Overlap[], precedence: Precedence): Overlap[] =>
  overlaps.filter((overlap) => wf.priority == null && overlap.priority == null && !precedence.some((choice) => choice.otherId === overlap.id));

/** Engine §13.1–§13.3. */
export function publishReview(wf: Workflow, ctx: EngineContext, precedence: Precedence = []): PublishReview {
  const mustFix: Issue[] = lintWorkflow(wf, ctx).issues.filter((issue) => issue.sev === 'bad' && !issue.overlap);
  if (!ctx.approverAvailability.othersCanApprove) mustFix.push({ sev: 'bad', m: copy.nobodyElseCanApprove });

  const overlaps = findOverlaps(wf, ctx);
  const openOverlaps = unresolvedOverlaps(wf, overlaps, precedence);
  return {
    impact: recordCount(wf, ctx),
    mustFix,
    overlaps,
    openOverlaps,
    canSend: mustFix.length === 0 && openOverlaps.length === 0,
    effective: defaultGoLive(wf, ctx),
  };
}

/** Engine §13.3: the option shown as chosen in the overlap dropdown. */
export function overlapChoice(wf: Workflow, overlap: Overlap, precedence: Precedence = []): 'self' | 'other' | null {
  const stored = precedence.find((choice) => choice.otherId === overlap.id);
  if (stored) return stored.winner;
  if (wf.priority != null && (overlap.priority == null || wf.priority < overlap.priority)) return 'self';
  if (overlap.priority != null && (wf.priority == null || overlap.priority < wf.priority)) return 'other';
  return null;
}

/** Engine §13.4: the author never approves their own change. */
export function canApprove(user: ActingUser, pending: Pick<PendingPublish, 'submittedBy' | 'submittedById'>): boolean {
  const permitted = user.permissions.includes('flow.approve_changes') || user.permissions.includes('admin');
  return permitted && !isAuthorOf(user, pending);
}

/** Engine §13.1 item 7: does anyone other than the author hold the permission? */
export function othersCanApprove(author: string | { id?: string; name: string }, users: ActingUser[]): boolean {
  const pending = typeof author === 'string' ? { submittedBy: author } : { submittedBy: author.name, submittedById: author.id };
  return users.some((user) => canApprove(user, pending));
}

export type SendResult = { ok: true; workflow: Workflow; message: string } | { ok: false; message: string };

/** Engine §13.4: nothing changes until the second person approves (the priority choice waits on `pending`). */
export function sendForApproval(
  wf: Workflow,
  ctx: EngineContext,
  request: { author: string; authorId?: string; effective?: string; precedence?: Precedence },
): SendResult {
  const precedence = request.precedence ?? [];
  const review = publishReview(wf, ctx, precedence);
  const effective = request.effective ?? review.effective;
  const dateError = goLiveError(effective, ctx);
  if (dateError) return { ok: false, message: dateError };
  if (!review.canSend) return { ok: false, message: copy.publishBlocked };
  const workflow = structuredClone(wf);
  workflow.pending = { submittedBy: request.author, ...(request.authorId === undefined || request.authorId === request.author ? {} : { submittedById: request.authorId }), submittedAt: ctx.now, effective, precedence };
  return { ok: true, workflow, message: copy.sentForApproval };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `d MMM yyyy` ("20 Oct 2026"), engine §13.5. */
export function formatToastDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export const publishedToast = (version: number, effective: string): string => copy.publishedToast(version, formatToastDate(effective));

export type ApproveResult = { ok: true; workflow: Workflow; others: Workflow[]; toast: string } | { ok: false; message: string; overlap?: true };

/** Engine §13.5. `others` holds every other workflow whose priority the overlap choice changes. */
export function approvePublish(wf: Workflow, approver: ActingUser, ctx: Pick<EngineContext, 'workflows' | 'now'> & Partial<Pick<EngineContext, 'history'>>): ApproveResult {
  const pending = wf.pending;
  if (!pending) return { ok: false, message: copy.nothingWaiting };
  if (isAuthorOf(approver, pending)) return { ok: false, message: copy.cannotApproveOwn };
  if (!canApprove(approver, pending)) return { ok: false, message: copy.noApprovePermission };
  // Checked when it was sent, but another workflow may have gone live since: approving mustn't leave two running with nothing to choose between them.
  if (ctx.history) {
    const [open] = unresolvedOverlaps(wf, findOverlaps(wf, { workflows: ctx.workflows, history: ctx.history }), pending.precedence ?? []);
    if (open) return { ok: false, message: copy.overlapOpenAtApproval(open.name), overlap: true };
  }

  const workflow = structuredClone(wf);
  const others: Workflow[] = [];
  for (const choice of pending.precedence ?? []) {
    const other = ctx.workflows.find((candidate) => candidate.id === choice.otherId);
    if (!other) continue;
    const updated = structuredClone(other);
    workflow.priority = choice.winner === 'self' ? 1 : 2;
    updated.priority = choice.winner === 'self' ? 2 : 1;
    others.push(updated);
  }
  workflow.version += 1;
  workflow.effective = pending.effective;
  if (workflow.status !== 'inactive') workflow.status = 'live';
  const nodes = structuredClone(workflow.draft.nodes);
  workflow.published = { nodes, scope: structuredClone(workflow.scope), name: workflow.name };
  const version: WorkflowVersion = {
    version: workflow.version,
    nodes: structuredClone(nodes),
    scope: structuredClone(workflow.scope),
    name: workflow.name,
    effective: pending.effective,
    publishedAt: ctx.now,
    submittedBy: pending.submittedBy,
    approvedBy: approver.name,
    ...(pending.submittedById === undefined ? {} : { submittedById: pending.submittedById }),
    ...(approver.id === undefined || approver.id === approver.name ? {} : { approvedById: approver.id }),
  };
  workflow.versions = [...(workflow.versions ?? []), version];
  workflow.pending = null;
  return { ok: true, workflow, others, toast: publishedToast(workflow.version, pending.effective) };
}

const VERSIONED_SETTINGS = ['records', 'event', 'source', 'owner', 'basis', 'days', 'onReject'] as const;

/** 02 §4: a live or inactive workflow is dirty when its draft differs from what is published. Drafts always are. */
export function hasUnpublishedChanges(wf: Pick<Workflow, 'draft' | 'scope' | 'name' | 'published'> & Partial<Workflow>): boolean {
  if (!wf.published) return true;
  const current = JSON.stringify({ nodes: wf.draft.nodes, scope: wf.scope, name: wf.name });
  const published = JSON.stringify({ nodes: wf.published.nodes, scope: wf.published.scope, name: wf.published.name });
  if (current !== published) return true;
  // The settings a version freezes (01 §4.1) wait for approval too, so changing one has to read as a change to publish.
  const latest = wf.versions?.find((version) => version.version === wf.version);
  if (latest?.records === undefined) return false;
  return VERSIONED_SETTINGS.some((key) => JSON.stringify(wf[key] ?? null) !== JSON.stringify(latest[key] ?? null));
}

/** Engine §13.6: the status text after the name in the top bar. */
export function statusText(wf: Workflow): string {
  if (wf.pending) return copy.statusWaitingForApproval;
  if (wf.status === 'inactive') return copy.statusInactive(wf.version);
  if (wf.status === 'draft') return copy.statusDraft;
  return hasUnpublishedChanges(wf) ? copy.statusDirty(wf.version) : copy.statusLive(wf.version);
}

/** Engine §13.6: the status dot. */
export function statusDot(wf: Workflow): 'off' | 'draft' | 'dirty' | 'live' {
  if (wf.status === 'inactive') return 'off';
  if (wf.status === 'draft' || wf.pending) return 'draft';
  return hasUnpublishedChanges(wf) ? 'dirty' : 'live';
}
