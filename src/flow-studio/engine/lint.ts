import type { EngineContext } from '../model/context';
import type { Issue, LintResult } from '../model/results';
import type { CondNode, CondPath, Out, WfNode, Workflow } from '../model/workflow';
import { scopeMatch } from './conditions';
import { copy } from './copy';
import { findOverlaps } from './publish';
import { chaseDefaults, scopeText, title, whoMode } from './text';

const LEDGER_SYSTEMS = ['Workday', 'ServiceNow', 'Okta', 'Microsoft Entra ID'];

/** Engine §12.1. */
export function recordCount(wf: Pick<Workflow, 'records' | 'event' | 'scope'>, ctx: Pick<EngineContext, 'history'>): number {
  return ctx.history.filter((h) => wf.records.includes(h.record) && h.event === wf.event && scopeMatch(wf.scope, h)).length;
}

/** Engine §12.1: the Nova panel header. */
export const novaHeader = (recs: number): string => (recs > 0 ? copy.novaChecked(recs) : copy.novaDesignOnly);

/** The ✦ Nova button count (engine §12.1). */
export const novaCount = (issues: Issue[]): number => issues.filter((issue) => issue.sev === 'bad' || issue.sev === 'warn').length;

function reachableFromStart(nodes: Record<string, WfNode>): Set<string> {
  const seen = new Set<string>();
  const stack = ['T'];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id) || !nodes[id]) continue;
    seen.add(id);
    for (const out of nodes[id].outs ?? []) stack.push(out.to);
  }
  return seen;
}

/** L15: the worker as an approver, decider or reviewer. */
function asksTheWorker(node: WfNode): boolean {
  switch (node.kind) {
    case 'appr':
      return node.roles.includes('worker');
    case 'cond': {
      const paths = node.outs as (Out & Partial<CondPath>)[];
      const deciding = (mode: string | undefined) => mode === 'approve' || mode === 'escalate';
      return paths.some((out) => out.key !== 'else' && out.who === 'worker' && deciding(out.do)) || (node.elseWho === 'worker' && deciding(node.elseDo));
    }
    case 'dw':
      return node.flagWho === 'worker' && node.flagDo === 'escalate';
    case 'collect':
      return (
        (node.failTo === 'role' && node.failRole === 'worker') ||
        (node.failTo === 'approval' && (node.failRoles ?? []).includes('worker')) ||
        (node.verify !== 'auto' && node.reviewer === 'worker')
      );
    default:
      return false;
  }
}

/** Engine §12.2. Each rule runs over `draft.nodes` in stored key order; the rules come in table order. */
export function lintWorkflow(wf: Workflow, ctx: EngineContext): LintResult {
  const nodes = wf.draft.nodes;
  const all = Object.values(nodes);
  const issues: Issue[] = [];
  const each = (rule: (node: WfNode, t: string) => Issue | null | undefined) => {
    for (const node of all) {
      const issue = rule(node, title(node));
      if (issue) issues.push(issue);
    }
  };
  const givesOf = (node: WfNode): string | undefined => (node as { gives?: string }).gives;

  each((n, t) => (n.kind === 'collect' && n.items.length === 0 ? { sev: 'warn', node: n.id, m: copy.l1(t) } : null)); // L1
  each((n, t) => {
    const gives = givesOf(n);
    if (!gives || (n as { reverse?: string }).reverse) return null;
    return { sev: 'bad', node: n.id, m: copy.l2(t, gives), fix: `rev:${n.id}`, fl: copy.l2Fix }; // L2
  });
  each((n, t) => {
    if (n.kind !== 'system' || n.gives || !LEDGER_SYSTEMS.includes(n.system) || n.sys?.action !== 'create' || /payroll|sync|run/i.test(n.label)) return null;
    return { sev: 'tip', node: n.id, m: copy.l3(t, n.system), fix: `gr:${n.id}`, fl: copy.l3Fix }; // L3
  });
  each((n, t) => {
    if (n.kind !== 'cond' && n.kind !== 'plan') return null;
    const outs = n.outs as Out[];
    return outs.length >= 2 && outs.every((out) => out.to === outs[0].to) ? { sev: 'warn', node: n.id, m: copy.l4(t) } : null; // L4
  });
  each((n, t) => {
    if (n.kind !== 'runwf') return null;
    const target = ctx.workflows.find((w) => w.id === n.target);
    const loops = target && Object.values(target.draft.nodes).some((m) => m.kind === 'runwf' && m.target === wf.id);
    return loops ? { sev: 'bad', node: n.id, m: copy.l5(t, (target as Workflow).name) } : null; // L5
  });
  if (all.some((n) => givesOf(n)) && !ctx.workflows.some((w) => w.records.includes('offboarding'))) {
    issues.push({ sev: 'warn', m: copy.l6 }); // L6
  }
  each((n, t) => {
    if (n.kind !== 'appr' || whoMode(n) !== 'person' || n.roles.length === 0 || n.backup) return null;
    return { sev: 'warn', node: n.id, m: copy.l7(t, n.roles[0].slice(2)) }; // L7
  });
  each((n, t) => (n.kind === 'system' && ctx.systems.SYS[n.system]?.st === 'off' ? { sev: 'warn', node: n.id, m: copy.l8(t, n.system) } : null)); // L8
  each((n, t) => (n.kind === 'notify' && n.recipients.length === 0 ? { sev: 'warn', node: n.id, m: copy.l9(t) } : null)); // L9
  for (const n of all) {
    if (n.kind !== 'cond') continue;
    const paths = (n as CondNode).outs.filter((out) => out.key !== 'else') as CondPath[];
    paths.forEach((path, i) => {
      if ((path.rows ?? []).length === 0) issues.push({ sev: 'warn', node: n.id, m: copy.l10(path.label, title(n), i < paths.length - 1) }); // L10
    });
  }
  each((n, t) => (n.kind === 'appr' && n.roles.length === 0 ? { sev: 'bad', node: n.id, m: copy.l11(t) } : null)); // L11
  each((n, t) => (n.kind === 'collect' && n.failTo === 'approval' && (n.failRoles ?? []).length === 0 ? { sev: 'bad', node: n.id, m: copy.l12(t) } : null)); // L12

  const reached = reachableFromStart(nodes);
  each((n, t) => (n.id !== 'END' && !reached.has(n.id) ? { sev: 'warn', node: n.id, m: copy.l13(t) } : null)); // L13

  for (const other of findOverlaps(wf, ctx)) {
    const undecided = wf.priority == null && other.priority == null;
    const write = undecided ? copy.l14Bad : copy.l14Info;
    issues.push({ sev: undecided ? 'bad' : 'info', overlap: other.id, m: write(other.name, other.count, scopeText(wf.scope), scopeText(other.scope)) }); // L14
  }

  each((n, t) => (asksTheWorker(n) ? { sev: 'bad', node: n.id, m: copy.l15(t) } : null)); // L15
  each((n, t) => (n.kind === 'runwf' && !ctx.workflows.some((w) => w.id === n.target) ? { sev: 'bad', node: n.id, m: copy.l16(t) } : null)); // L16
  each((n, t) => (n.kind === 'wait' && n.w?.mode === 'at' && !n.w.at ? { sev: 'warn', node: n.id, m: copy.l17(t) } : null)); // L17
  each((n, t) => {
    if (n.kind !== 'appr' && n.kind !== 'task' && n.kind !== 'collect') return null;
    const { remind, sla } = chaseDefaults(n);
    return sla <= remind ? { sev: 'bad', node: n.id, m: copy.l18(t) } : null; // L18
  });

  return { issues, recs: recordCount(wf, ctx) };
}
