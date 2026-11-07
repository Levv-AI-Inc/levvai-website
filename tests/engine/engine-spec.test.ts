import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { activeState, inactiveWarning, setActive } from '@flow-studio/engine/active';
import { checkResult } from '@flow-studio/engine/checks';
import { composeTest, runTest, samplesFor } from '@flow-studio/engine/compose';
import { evalCondition, scopeMatch } from '@flow-studio/engine/conditions';
import { copy } from '@flow-studio/engine/copy';
import { computeMergeAt, createEditor, createWorkflowIn, gc, isRefusal, type EditResult, type Nodes } from '@flow-studio/engine/edit';
import { createIdGen } from '@flow-studio/engine/ids';
import { lintWorkflow } from '@flow-studio/engine/lint';
import { briefFor, planApprovals, planFailedCheck, planRecord } from '@flow-studio/engine/plan';
import { hasUnpublishedChanges, overlapChoice, statusDot, statusText } from '@flow-studio/engine/publish';
import { isAway, personLabel, resolveRoleHolder } from '@flow-studio/engine/resolve';
import { inside, prereqFor, selectWorkflow, strictlyInside } from '@flow-studio/engine/selection';
import { simulateTest } from '@flow-studio/engine/simulate';
import {
  approveSentence,
  chaseDefaults,
  chaserFor,
  chaseTo,
  dispOf,
  dwContext,
  ensureSys,
  evName,
  ifTopLine,
  pathCardRow,
  pathMode,
  roleList,
  scopeLabel,
  scopeText,
  startTitle,
  subtitle,
  sysSentence,
  sysShort,
  waitText,
} from '@flow-studio/engine/text';
import { walkOutcome, walkWorkflow } from '@flow-studio/engine/walk';
import type {
  ApproveNode,
  CollectNode,
  CondNode,
  DwNode,
  EngineContext,
  ParallelNode,
  PlanNode,
  SampleRecord,
  StageItem,
  SystemNode,
  TaskNode,
  WfNode,
  Workflow,
} from '@flow-studio/model';
import { iGraph, normDeep, newWorkflow } from '../support/acceptance-doc';
import { makeContext, workflowById } from '../support/context';

const sample = (ctx: EngineContext, id: string) => ctx.samples.find((s) => s.id === id) as SampleRecord;
const ok = (result: EditResult): Nodes => {
  if (isRefusal(result)) throw new Error(result.message);
  return result;
};
const q = (text: string) => normDeep(text);

/** A one-Approve-step graph, for the people rules. */
function approveWorkflow(approve: Partial<ApproveNode>, fields: Partial<Workflow> = {}): Workflow {
  const nodes: Record<string, WfNode> = {
    T: { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: 'A' }] },
    A: {
      id: 'A',
      kind: 'appr',
      label: 'Sign-off',
      roles: ['hm'],
      who: 'roles',
      mode: 'all',
      authority: false,
      material: [],
      reaskOnDecrease: true,
      sla: 48,
      remind: 24,
      reject: 'requester',
      outs: [{ key: 'next', to: 'END' }],
      ...approve,
    } as ApproveNode,
    END: { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] },
  };
  return { ...newWorkflow(nodes), ...fields };
}

const round = (result: ReturnType<typeof runTest>, id = 'A') => result.steps.find((s) => s.id === id)?.rounds?.[0];

describe('01 §2: the engine is pure', () => {
  const dir = join(__dirname, '..', '..', 'src', 'flow-studio', 'engine');
  it.each(readdirSync(dir).filter((file) => file.endsWith('.ts')))('%s has no clock, randomness, I/O or UI', (file) => {
    const source = readFileSync(join(dir, file), 'utf8');
    expect(source).not.toMatch(/Date\.now|new Date\(\)|Math\.random|\bfetch\(|from 'react|from 'node:|require\(|document\.|window\./);
  });
});

describe('§1 text helpers', () => {
  const ctx = makeContext();

  it.each([
    [{}, 'Everywhere'],
    [{ country: ['UK'], business_unit: ['Technology'] }, 'UK · Technology'],
    [{ job_family: ['Data'] }, 'Data'],
    [{ country: ['UK', 'Canada'] }, 'UK / Canada'],
    [{ country: [] }, 'Everywhere'],
  ])('scopeText(%j) = %s', (scope, text) => {
    expect(scopeText(scope)).toBe(text);
  });

  it('§1.4 scopeLabel', () => {
    expect(scopeLabel('legal_entity', 'Levv Bank UK Ltd', ctx)).toBe('UK entity');
    expect(scopeLabel('cost_center', 'CC-100', ctx)).toBe('CC-100 Platform engineering');
    expect(scopeLabel('country', 'UK', ctx)).toBe('UK');
  });

  it('§1.5 roleList', () => {
    expect(roleList(['hm', 'cco'], ctx)).toBe('Hiring manager + Cost center owner');
    expect(roleList(['hm', 'cco', 'dh'], ctx)).toBe('Hiring manager + 2 more');
  });

  it.each([
    ['wf-wo-sub', 'Work order submitted'],
    ['wf-access', 'Access request submitted in Zip'],
    ['wf-doc', 'Worker document expiring in 30 days'],
    ['wf-onboard', 'Onboarding starts'],
  ])('§1.6 Start box title of %s', (id, text) => {
    expect(startTitle(workflowById(ctx, id), ctx.catalog)).toBe(text);
  });

  it('§1.6 evName uses the open workflow’s days', () => {
    expect(evName(workflowById(ctx, 'wf-offboard'), ctx.catalog, 'end_30')).toBe('End date in 14 days');
  });

  it.each([
    ['hm', { business_unit: 'Technology' }, 'Hiring manager (Tom Reed)'],
    ['supplier_am', {}, 'Supplier account manager'],
    ['worker', {}, 'the worker'],
    ['worker', { worker_name: 'Jordan Ellis' }, 'Worker (Jordan Ellis)'],
    ['sponsor', { sponsor: 'Grace Kim', sponsor_delegate: 'Raj Patel' }, 'Sponsor (Grace Kim, or their delegate Raj Patel)'],
    ['sow_owner', { business_unit: 'Operations' }, 'SOW owner (Grace Kim)'],
  ])('§1.7 personLabel(%s, %j)', (role, rec, text) => {
    expect(personLabel(role, rec, ctx)).toBe(text);
  });

  const date = { mode: 'date', field: 'start_date', time: '09:00', tz: 'worker' } as const;
  it.each([
    [{ mode: 'for', amount: 3, unit: 'business_days' }, true, 'Waits 3 working days'],
    [{ mode: 'at', at: '2026-12-01T09:30' }, true, 'Until 2026-12-01 at 09:30'],
    [{ mode: 'at' }, true, 'Pick a date and time'],
    [date, true, 'Waits until Start date, 09:00 in the worker’s time zone'],
    [date, false, 'Until Start date, 09:00'],
    [{ ...date, amount: 5, unit: 'business_days', dir: 'before', tz: 'company' }, true, 'Waits until 5 working days before start date, 09:00 company time'],
    [{ mode: 'date', field: 'end_date', amount: 2, unit: 'weeks', dir: 'after', tz: 'worker' }, true, 'Waits until 2 weeks after end date in the worker’s time zone'],
  ] as const)('§1.8 waitText(%j, %s) = %s', (w, long, text) => {
    expect(waitText(w, long, ctx.catalog)).toBe(text);
  });

  it('§1.9 dispOf', () => {
    expect(dispOf({ kind: 'system' })).toBe('remove');
    expect(dispOf({ kind: 'task', gives: 'Laptop and badge' })).toBe('return');
    expect(dispOf({ kind: 'collect', gives: 'Confidentiality obligations' })).toBe('retain');
    expect(dispOf({ kind: 'collect', gives: 'Portal login' })).toBe('remove');
    expect(dispOf({ kind: 'collect', gives: 'Laptop', disp: 'retain' })).toBe('retain');
  });

  it('§1.10 sysShort and sysSentence', () => {
    const wd = workflowById(ctx, 'wf-onboard').draft.nodes.WD as SystemNode;
    expect(sysShort(wd, ctx.systems)).toBe('Create contingent worker in Workday');
    expect(sysSentence(wd, ctx)).toBe(
      'Create contingent worker in Workday, matched on Work email, 7 fields sent; reads back Workday worker ID; waits up to 24h for Workday to confirm; then checks it matches the ledger',
    );
    const close = workflowById(ctx, 'wf-offboard').draft.nodes.RV as SystemNode;
    expect(sysShort(close, ctx.systems)).toBe('Close or deactivate user in Okta');
  });

  it('§1.10 ensureSys', () => {
    const built = ensureSys({ label: 'Remove access', system: 'Okta', actions: ['push', 'reconcile'] }, ctx.systems);
    expect(built).toMatchObject({ system: 'Okta', action: 'close', wait: 'confirm', waitH: 24, state: 'Completed', onFail: 'task', failRole: 'people_ops', retries: 3, check: true });
    expect(ensureSys({ label: 'Check', system: 'Okta', actions: ['reconcile'] }, ctx.systems).action).toBe('check');
    expect(ensureSys({ label: 'Read', system: 'Workday', actions: ['pull'] }, ctx.systems).action).toBe('read');
  });

  it('§1.11 dwContext', () => {
    expect(dwContext({ records: ['onboarding'] })).toBe('onboarding');
    expect(dwContext({ records: ['offboarding'] })).toBe('offboarding');
    expect(dwContext({ records: ['access_request'] })).toBe('access');
    expect(dwContext({ records: ['sow'] })).toBe('workflows');
  });

  it('§1.12 chaseDefaults and chaseTo', () => {
    expect(chaseDefaults({ kind: 'appr' })).toEqual({ remind: 24, sla: 48 });
    expect(chaseDefaults({ kind: 'task' })).toEqual({ remind: 48, sla: 96 });
    expect(chaseDefaults({ kind: 'collect', remind: 5, sla: 6 })).toEqual({ remind: 5, sla: 6 });
    expect(chaseTo({ kind: 'collect' })).toBe('the hiring manager');
    expect(chaseTo({ kind: 'collect', from: 'supplier_am' })).toBe('the hiring manager');
    expect(chaseTo({ kind: 'collect', from: 'sponsor' })).toBe('their manager');
    expect(chaseTo({ kind: 'appr' })).toBe('their manager');
  });
});

describe('§2 conditions', () => {
  it('§2.1 every operator', () => {
    const rec = { n: 5, s: 'Hello', list: ['a'], yes: true, blank: null };
    const row = (f: string, op: string, v?: unknown) => ({ join: 'all' as const, rows: [{ f, op, v }] as never[] });
    expect(evalCondition(row('s', 'is', 'hello'), rec)).toBe(true);
    expect(evalCondition(row('s', 'contains', 'ELL'), rec)).toBe(true);
    expect(evalCondition(row('n', '>=', 5), rec)).toBe(true);
    expect(evalCondition(row('n', '>', 5), rec)).toBe(false);
    expect(evalCondition(row('n', '<', 6), rec)).toBe(true);
    expect(evalCondition(row('n', '<=', 4), rec)).toBe(false);
    expect(evalCondition(row('blank', '>=', 0), rec)).toBe(false);
    expect(evalCondition(row('s', 'in', ['Hello']), rec)).toBe(true);
    expect(evalCondition(row('s', 'not_in', ['x']), rec)).toBe(true);
    expect(evalCondition(row('absent', 'not_in', ['x']), rec)).toBe(false);
    expect(evalCondition(row('yes', 'yes'), rec)).toBe(true);
    expect(evalCondition(row('absent', 'no'), rec)).toBe(true);
    expect(evalCondition(row('list', 'includes', 'a'), rec)).toBe(true);
    expect(evalCondition(row('absent', 'includes', 'a'), rec)).toBe(false);
  });

  it('§2.2 groups nest; no rows is true', () => {
    expect(evalCondition({ join: 'any', rows: [] }, {})).toBe(true);
    const nested = { join: 'any' as const, rows: [{ join: 'all' as const, rows: [{ f: 'a', op: 'yes' as const }, { f: 'b', op: 'yes' as const }] }] };
    expect(evalCondition(nested, { a: true, b: true })).toBe(true);
    expect(evalCondition(nested, { a: true })).toBe(false);
  });

  it('§2.3 scopeMatch', () => {
    expect(scopeMatch({}, {})).toBe(true);
    expect(scopeMatch({ country: ['UK'] }, { country: 'UK' })).toBe(true);
    expect(scopeMatch({ country: ['UK'] }, { country: 'US' })).toBe(false);
    expect(scopeMatch({ country: [] }, { country: 'US' })).toBe(true);
  });

  describe('§2.4 missing values', () => {
    const graph = (onMissing?: CondNode['onMissing']): Nodes => ({
      T: { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: 'C' }] },
      C: {
        id: 'C',
        kind: 'cond',
        label: 'Risky?',
        onMissing,
        outs: [
          { key: 'p1', to: 'A', label: 'Yes', join: 'all', rows: [{ f: 'data_access', op: 'yes' }] },
          { key: 'else', to: 'END', label: 'No' },
        ],
      } as CondNode,
      A: { id: 'A', kind: 'notify', label: 'Tell', recipients: ['hm'], channel: 'Email', outs: [{ key: 'next', to: 'END' }] },
      END: { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] },
    });
    const ctx = makeContext();

    it('ask stops at the If', () => {
      const walk = walkWorkflow(graph('ask'), { data_access: null }, ctx);
      expect(walk.needInfo).toEqual([{ nodeId: 'C', missing: ['data_access'] }]);
      expect(walk.decisions).toEqual([{ nodeId: 'C', label: 'Needs information' }]);
      expect(walk.seen).toEqual(['T', 'C']);
    });

    it('cautious treats a blank risk question as yes', () => {
      expect(walkWorkflow(graph('cautious'), { data_access: null }, ctx).decisions).toEqual([{ nodeId: 'C', label: 'Yes' }]);
    });

    it('cautious with a non-risk blank is as ask', () => {
      const nodes = graph('cautious');
      (nodes.C as CondNode).outs[0] = { key: 'p1', to: 'A', label: 'Yes', join: 'all', rows: [{ f: 'urgent', op: 'yes' }] } as never;
      expect(walkWorkflow(nodes, { urgent: null }, ctx).needInfo).toHaveLength(1);
    });

    it('otherwise evaluates normally', () => {
      expect(walkWorkflow(graph('otherwise'), { data_access: null }, ctx).decisions).toEqual([{ nodeId: 'C', label: 'No' }]);
    });

    it('absent is not missing', () => {
      expect(walkWorkflow(graph('ask'), {}, ctx).needInfo).toEqual([]);
    });
  });
});

describe('§3 selection', () => {
  const ctx = makeContext();

  it('§3.1 inside and strictlyInside', () => {
    expect(inside({ country: ['UK'] }, {})).toBe(true);
    expect(inside({}, { country: ['UK'] })).toBe(false);
    expect(strictlyInside({ country: ['UK'] }, {})).toBe(true);
    expect(strictlyInside({}, {})).toBe(false);
  });

  it.each([
    ['WO-2214', 'UK Technology work orders'],
    ['WO-2240', 'UK Technology work orders'],
    ['WO-2260', 'UK Technology work orders'],
    ['WO-2231', 'Work order submitted'],
    ['WO-2270', 'Work order submitted'],
    ['WO-2275', 'Work order submitted'],
    ['WO-2280', 'Work order submitted'],
  ])('§3.2 %s → %s', (id, name) => {
    expect(selectWorkflow(sample(ctx, id), ctx.workflows).workflow?.name).toBe(name);
  });

  it('§3.2 if “Data and AI hires” were live: WO-2240 ties, WO-2270 → Data and AI hires', () => {
    const live = makeContext();
    workflowById(live, 'wf-wo-sub-wo-data').status = 'live';
    const tied = selectWorkflow(sample(live, 'WO-2240'), live.workflows);
    expect(tied.tie).toBe(true);
    expect([tied.workflow?.name, ...tied.tied.map((w) => w.name)].sort()).toEqual(['Data and AI hires', 'UK Technology work orders']);
    expect(selectWorkflow(sample(live, 'WO-2270'), live.workflows).workflow?.name).toBe('Data and AI hires');
  });

  it('§3.2 inactive and draft workflows never run; nothing matches → null', () => {
    const off = makeContext();
    for (const w of off.workflows) w.status = 'inactive';
    expect(selectWorkflow(sample(off, 'WO-2214'), off.workflows)).toEqual({ workflow: null, tie: false, tied: [], beaten: [] });
  });

  it('§3.2 production: a live workflow selects on its published scope, not the draft being edited', () => {
    const edited = makeContext();
    workflowById(edited, 'wf-wo-sub-wo-uk-tech').scope = { country: ['Canada'] };
    expect(selectWorkflow(sample(edited, 'WO-2214'), edited.workflows).workflow?.id).toBe('wf-wo-sub-wo-uk-tech');
  });

  it('§3.2 lower priority wins a tie', () => {
    const live = makeContext();
    workflowById(live, 'wf-wo-sub-wo-data').status = 'live';
    workflowById(live, 'wf-wo-sub-wo-data').priority = 1;
    workflowById(live, 'wf-wo-sub-wo-uk-tech').priority = 2;
    expect(selectWorkflow(sample(live, 'WO-2240'), live.workflows).workflow?.id).toBe('wf-wo-sub-wo-data');
  });
});

describe('§5 checks', () => {
  const ctx = makeContext();
  it.each([
    ['rate', {}, true, 'No rate on this record'],
    ['rate', { rate_vs_card_pct: 14, rate_vs_market_pct: 6 }, false, '14% over rate card, 6% over market median'],
    ['rate', { rate_vs_card_pct: 8, rate_vs_market_pct: -3 }, true, '8% over rate card, 3% under market median'],
    ['budget', {}, true, 'No budget data on this record'],
    ['budget', { budget_left_after: 120000 }, true, '$120K left in plan after this request'],
    ['budget', { budget_left_after: -36000 }, false, '$36K over the approved plan'],
    ['dup', { record: 'access_request', duplicate_found: true }, false, 'This person already has an active badge from an earlier request'],
    ['dup', { record: 'access_request' }, true, 'No active badge or open request for this person'],
    ['dup', { duplicate_found: true }, false, 'Same person is active through another supplier (WO-1877)'],
    ['dup', {}, true, 'No duplicate worker or leftover access found'],
    ['tenure', {}, true, 'No tenure data'],
    ['tenure', { months_engaged_after: 20 }, false, '20 months engaged after this change (cap 18)'],
    ['tenure', { months_engaged_after: 18 }, true, '18 months engaged after this change (cap 18)'],
  ])('checkResult(%s, %j)', (worker, rec, resultOk, m) => {
    expect(checkResult(worker, rec, ctx)).toEqual({ ok: resultOk, m });
  });
});

describe('§6 planApprovals', () => {
  it('§6.6 resolveRoleHolder precedence', () => {
    const ctx = makeContext();
    expect(resolveRoleHolder('hm', { hiring_manager: 'Omar Haddad', business_unit: 'Technology' }, ctx).person).toBe('Omar Haddad');
    expect(resolveRoleHolder('cco', { business_unit: 'Technology' }, ctx, 'Finance').person).toBe('Lena Fischer');
    expect(resolveRoleHolder('priv', { country: 'Germany' }, ctx).person).toBeNull();
    expect(resolveRoleHolder('sec', { country: 'UK' }, ctx).person).toBe('Kenji Watanabe');
    expect(resolveRoleHolder('p:Chloe Martin', {}, ctx).person).toBe('Chloe Martin');
    expect(resolveRoleHolder('sponsor', { business_unit: 'Technology' }, ctx).person).toBe('Tom Reed');
    expect(resolveRoleHolder('sponsor', {}, ctx).person).toBe('the sponsor');
    expect(resolveRoleHolder('sow_owner', {}, ctx).person).toBe('SOW owner');
  });

  it('§6.7 B6 signing authority walks up the chain (the 03 example)', () => {
    const ctx = makeContext();
    const wf = approveWorkflow({ roles: ['cco'], authority: true });
    const record = { ...sample(ctx, 'WO-2214'), requester: 'Coordinator', total_value: 2400000, data_access: false };
    expect(normDeep(round(runTest({ workflow: wf, record, ctx })))).toEqual(
      normDeep({
        n: 1,
        people: 'Cost center owner (Rebecca Stone)',
        notes: [
          'Priya Shah’s signing limit is $250K, so it moves up to Alan Brooks',
          'Alan Brooks’s signing limit is $500K, so it moves up to Samira Khan',
          'Samira Khan’s signing limit is $2M, so it moves up to Rebecca Stone',
        ],
      }),
    );
  });

  it('§6.7 B5 a specialist who raised the request: the role backup approves', () => {
    const ctx = makeContext();
    const wf = approveWorkflow({ roles: ['sec'] });
    const record = { ...sample(ctx, 'WO-2231'), requester: 'Kenji Watanabe' };
    expect(round(runTest({ workflow: wf, record, ctx }))).toEqual({
      n: 1,
      people: 'Information Security (Ravi Kumar)',
      notes: ['Kenji Watanabe raised this request, so another Information Security reviewer, Ravi Kumar, approves'],
    });
  });

  it('§6.7 B5 a specialist with no backup who raised it: paused', () => {
    const ctx = makeContext();
    const wf = approveWorkflow({ roles: ['hrbp'] });
    const record = { ...sample(ctx, 'WO-2231'), requester: 'Erin Walsh' };
    const result = runTest({ workflow: wf, record, ctx });
    expect(result.steps[0].status).toBe('Paused');
    expect(round(result)?.people).toBe('HR business partner (—)');
    expect(round(result)?.notes[0]).toBe(
      'Paused: Erin Walsh raised this and no other HR business partner reviewer is set. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in',
    );
  });

  it('§6.7 B7 away with an ineligible delegate and no backup: paused, never approved automatically', () => {
    const ctx = makeContext();
    ctx.people.BACKUP.sec = 'Kenji Watanabe';
    const wf = approveWorkflow({ roles: ['sec'] });
    const result = runTest({ workflow: wf, record: sample(ctx, 'WO-2231'), ctx });
    expect(result.summary).toContain('Part of the approval is paused');
    expect(round(result)?.notes[0]).toContain('Kenji Watanabe is away and has no eligible delegate');
  });

  it('AGENTS rule 4: a delegate who raised the request does not approve it', () => {
    const ctx = makeContext();
    const wf = approveWorkflow({ roles: ['legal'] });
    const record = { ...sample(ctx, 'WO-2231'), requester: 'Luis Romero' };
    const result = runTest({ workflow: wf, record, ctx });
    expect(result.steps[0].status).toBe('Paused');
    expect(round(result)?.people).toBe('Legal (—)');
    expect(round(result)?.notes).toEqual([
      'Hannah Brooks is out until Oct 24. Delegated to Luis Romero',
      'Paused: Luis Romero raised this and no other Legal reviewer is set. It waits until someone eligible is assigned (owner: Procurement operations). No one unqualified stands in',
    ]);
  });

  it('AGENTS rule 4: a signing limit that lands on the requester moves on', () => {
    const ctx = makeContext();
    const wf = approveWorkflow({ roles: ['cco'], authority: true });
    const record = { ...sample(ctx, 'WO-2214'), requester: 'Alan Brooks', total_value: 300000, data_access: false };
    const person = round(runTest({ workflow: wf, record, ctx }))?.people;
    expect(person).not.toContain('Alan Brooks');
  });

  it('D9 the paused note names the workflow’s owner', () => {
    const ctx = makeContext();
    const wf = approveWorkflow({ roles: ['priv'] }, { owner: 'Legal operations' });
    const result = runTest({ workflow: wf, record: sample(ctx, 'WO-2270'), ctx });
    expect(round(result)?.notes).toContain('Paused: no eligible Privacy reviewer for Germany. It waits until someone eligible is assigned (owner: Legal operations). No one unqualified stands in');
  });

  it('D28 absences use asOf, and `from`', () => {
    const ctx = makeContext();
    expect(isAway(ctx, 'Hannah Brooks')).toBe(true);
    expect(isAway({ ...ctx, asOf: '2026-10-24' }, 'Hannah Brooks')).toBe(true);
    expect(isAway({ ...ctx, asOf: '2026-10-25' }, 'Hannah Brooks')).toBe(false);
    ctx.people.OOO['Hannah Brooks'].from = '2026-10-22';
    expect(isAway(ctx, 'Hannah Brooks')).toBe(false);
  });

  it('§6.5 mode any: one item, “or” roles, the requester dropped; no delegation or move-up (D30)', () => {
    const ctx = makeContext();
    const wf = approveWorkflow({ roles: ['hm', 'cco', 'dh'], mode: 'any' });
    const record = { ...sample(ctx, 'WO-2231'), requester: 'Grace Kim' };
    const result = runTest({ workflow: wf, record, ctx });
    expect(round(result)).toEqual({ n: 1, people: 'Hiring manager or Cost center owner or Department head (Raj Patel, Nadia Rahman)', notes: [] });
    expect(result.steps[0].message.startsWith('Any one. If rejected')).toBe(true);
  });

  it('§6.7 A any-one with nobody eligible pauses', () => {
    const ctx = makeContext();
    const wf = approveWorkflow({ roles: ['priv', 'cco'], mode: 'any' });
    const record = { ...sample(ctx, 'WO-2270'), requester: 'Priya Shah', data_access: false };
    const result = runTest({ workflow: wf, record, ctx });
    expect(result.steps[0].status).toBe('Paused');
    expect(round(result)?.people).toBe('Privacy or Cost center owner (—)');
    const plan = planApprovals(wf, record, ctx);
    expect(plan.stages[0].items[0].pausedWhy).toBe('no eligible Privacy or Cost center owner');
  });

  it('§6.5 mode order: one round per role, labelled, numbered on the card', () => {
    const ctx = makeContext();
    const wf = approveWorkflow({ roles: ['proc', 'fbp'], mode: 'order' });
    const record = sample(ctx, 'WO-2231');
    const plan = planApprovals(wf, record, ctx);
    expect(plan.stages.map((s) => s.label)).toEqual(['Sign-off (1 of 2)', 'Sign-off (2 of 2)']);
    const step = runTest({ workflow: wf, record, ctx }).steps[0];
    expect(step.message.startsWith('In order. ')).toBe(true);
    expect(step.rounds?.map((r) => r.n)).toEqual([1, 2]);
  });

  it('§6.8 groups: any and all, requester and absentees dropped, everyone if that leaves nobody', () => {
    const ctx = makeContext();
    const any = approveWorkflow({ roles: ['g:fin_ctrl'], who: 'group' });
    const record = { ...sample(ctx, 'WO-2231'), requester: 'Lena Fischer' };
    expect(round(runTest({ workflow: any, record, ctx }))?.people).toBe('Finance controllers (any one of Chloe Martin, David Okafor)');

    const all = approveWorkflow({ roles: ['g:exco'], who: 'group' });
    const members = ctx.people.GROUPS.exco.members;
    expect(round(runTest({ workflow: all, record: sample(ctx, 'WO-2231'), ctx }))?.people).toBe(`Executive committee (all of ${members.join(', ')})`);

    ctx.people.GROUPS.fin_ctrl.members = ['Kenji Watanabe'];
    expect(round(runTest({ workflow: any, record: sample(ctx, 'WO-2231'), ctx }))?.people).toBe('Finance controllers (any one of Kenji Watanabe)');
  });

  it('§6.10 a later step, same kind of decision: “(a later step)”', () => {
    const ctx = makeContext();
    const nodes = approveWorkflow({ roles: ['proc'] }).draft.nodes;
    (nodes.A as ApproveNode).outs = [{ key: 'next', to: 'B' }];
    nodes.B = { ...(nodes.A as ApproveNode), id: 'B', label: 'Second', roles: ['ap'], outs: [{ key: 'next', to: 'END' }] };
    ctx.people.CENTRAL.ap = 'Owen Clarke';
    const result = runTest({ workflow: newWorkflow(nodes), record: sample(ctx, 'WO-2231'), ctx });
    expect(round(result)?.notes).toEqual(['Owen Clarke also covers Accounts payable (a later step). Same kind of decision, so one approval']);
    expect(result.steps[1].status).toBe('Covered');
  });

  it('D12 a different class: “an executive sign-off”, asked separately', () => {
    const ctx = makeContext();
    ctx.people.CENTRAL.vpf = 'Owen Clarke';
    const nodes = approveWorkflow({ roles: ['proc'] }).draft.nodes;
    (nodes.A as ApproveNode).outs = [{ key: 'next', to: 'B' }];
    nodes.B = { ...(nodes.A as ApproveNode), id: 'B', label: 'Second', roles: ['vpf'], outs: [{ key: 'next', to: 'END' }] };
    const result = runTest({ workflow: newWorkflow(nodes), record: sample(ctx, 'WO-2231'), ctx });
    expect(round(result, 'B')?.notes).toEqual(['Owen Clarke also gives the commercial review. This is an executive sign-off, a different decision, so they’re asked separately']);
  });

  it('§6.11 a stop or rejection removes rule-only rounds, and auto never fires with an empty Approve (D6)', () => {
    const ctx = makeContext();
    const nodes = approveWorkflow({ roles: [] }).draft.nodes;
    (nodes.A as ApproveNode).outs = [{ key: 'next', to: 'P' }];
    nodes.P = { id: 'P', kind: 'policy', label: 'Auto-approve', receipt: 'Approved automatically', fyi: '', outs: [{ key: 'next', to: 'END' }] };
    const plan = planApprovals(newWorkflow(nodes), sample(ctx, 'WO-2231'), ctx);
    expect(plan.auto).toBe(false);
    expect(plan.stages).toEqual([]);
  });

  it('§6.2 change basis: “Comparing the change amount”', () => {
    const ctx = makeContext();
    const wf = { ...workflowById(ctx, 'wf-asn-chg'), basis: 'change' as const };
    const plan = planApprovals(wf, sample(ctx, 'ASN-881'), ctx);
    expect(plan.basis).toEqual({ basis: 'change', v: 96000, m: 'Comparing the change amount: $96K (was $230K, now $326K)' });
  });

  it('§6.2 running basis (the 03 example)', () => {
    const ctx = makeContext();
    const plan = planApprovals(workflowById(ctx, 'wf-sow-co'), sample(ctx, 'SOW-77-CO3'), ctx);
    expect(plan.basis?.m).toBe('Comparing the running total of changes: $360K since the original $820K. This change alone is $60K');
    expect(plan.walk.decisions.map((d) => d.label)).toEqual(['No', 'Over $250K']);
  });

  it('D1 only one walk: rules and checks read the actual record, conditions the adjusted one', () => {
    const ctx = makeContext();
    const run = simulateTest(workflowById(ctx, 'wf-sow-co'), sample(ctx, 'SOW-77-CO3'), ctx);
    expect(run.walk).toBe(run.plan?.walk);
    expect(run.rec.total_value).toBe(sample(ctx, 'SOW-77-CO3').total_value);
  });

  describe('§6.13 briefFor', () => {
    const planFor = (ctx: EngineContext, wfId: string, recId: string) => {
      const wf = workflowById(ctx, wfId);
      const rec = sample(ctx, recId);
      return { wf, rec0: planRecord(wf, rec), plan: planApprovals(wf, rec, ctx) };
    };
    const itemFor = (plan: ReturnType<typeof planApprovals>, role: string): StageItem =>
      plan.stages.flatMap((s) => s.items).find((i) => i.roles.includes(role)) as StageItem;

    it('§6.13 the Hiring manager example (Work order submitted × WO-2214)', () => {
      const ctx = makeContext();
      const { wf, rec0, plan } = planFor(ctx, 'wf-wo-sub', 'WO-2214');
      expect(q(briefFor(itemFor(plan, 'hm'), plan, rec0, wf, ctx))).toBe(
        q(
          'Business sign-off: Senior cloud engineer (WO-2214)\nWhat’s asked: approve as Hiring manager, together with Alan Brooks, Ravi Kumar, Fatima Zahra.\nWhy it’s here: Duplicate & ghost worker: No duplicate worker or leftover access found.\nChecks: Budget check passed: $120K left in plan after this request; Duplicate & ghost worker passed: No duplicate worker or leftover access found.',
        ),
      );
    });

    it('§6.13 the Information Security item (added by the rule, on behalf of)', () => {
      const ctx = makeContext();
      const { wf, rec0, plan } = planFor(ctx, 'wf-wo-sub', 'WO-2214');
      const brief = briefFor(itemFor(plan, 'sec'), plan, rec0, wf, ctx);
      expect(q(brief)).toContain(q('Added by the company-wide rule “Client data access”: Client data access is yes or Vendor’s digital worker has system access is yes.'));
      expect(brief).not.toContain('Why it’s here');
      expect(brief.endsWith('On behalf of Information Security (Kenji Watanabe).')).toBe(true);
    });

    it('§6.13 what changed, with the basis line', () => {
      const ctx = makeContext();
      const { wf, rec0, plan } = planFor(ctx, 'wf-sow-co', 'SOW-77-CO3');
      const brief = briefFor(plan.stages[0].items[0], plan, rec0, wf, ctx);
      expect(brief).toContain('What changed: Total value $1.12M → $1.18M; Fields changed  → total value.');
      expect(brief).toContain('Comparing the running total of changes: $360K since the original $820K. This change alone is $60K.');
    });

    it('§6.13 an escalation step', () => {
      const ctx = makeContext();
      const { wf, rec0, plan } = planFor(ctx, 'wf-wo-sub', 'WO-2240');
      const brief = briefFor(itemFor(plan, 'proc'), plan, rec0, wf, ctx);
      expect(brief).toContain('What’s asked: decide. Approve to carry on, reject with a comment to stop, or send it back to the requester.');
    });

    it('§6.13 a failed-check decision', () => {
      const ctx = makeContext();
      const wf = workflowById(ctx, 'wf-onboard');
      const rec0 = planRecord(wf, sample(ctx, 'WO-2251-A'));
      const plan = planApprovals(wf, rec0, ctx);
      const [stage] = planFailedCheck(wf.draft.nodes.BG as CollectNode, rec0, wf, ctx);
      const brief = briefFor(stage.items[1], plan, rec0, wf, ctx);
      expect(brief.split('\n')[0]).toBe('Background check: Analyst, checks need attention (WO-2251-A)');
      expect(brief).toContain('What’s asked: decide whether to carry on after “Background check” failed. Approve to carry on, reject to stop.');
      expect(brief.endsWith('On behalf of Legal (Hannah Brooks).')).toBe(true);
    });

    it('§6.13 flags', () => {
      const ctx = makeContext();
      const { wf, rec0, plan } = planFor(ctx, 'wf-wo-sub', 'WO-2240');
      expect(briefFor(itemFor(plan, 'compliance'), plan, rec0, wf, ctx)).toContain('Marked: Registration required.');
    });
  });
});

describe('§7 rules', () => {
  const ruleCtx = (patch: Record<string, unknown>) => {
    const ctx = makeContext();
    const rule = ctx.rules.find((r) => r.id === 'ao-data') as (typeof ctx.rules)[number];
    Object.assign(rule.act, patch);
    return ctx;
  };

  it('§7.2 position first and last make their own round, labelled with the rule name', () => {
    const wf = approveWorkflow({ roles: ['proc'] });
    const first = ruleCtx({ position: 'first' });
    const firstStages = planApprovals(wf, sample(first, 'WO-2214'), first).stages;
    expect(firstStages[0].items.map((i) => i.roles[0])).toEqual(['sec', 'priv']);
    expect(firstStages[0].label.startsWith('Client data access')).toBe(true);
    const last = ruleCtx({ position: 'last' });
    const labels = planApprovals(wf, sample(last, 'WO-2214'), last).stages.map((s) => s.label);
    expect(labels[labels.length - 1]).toBe('Client data access');
  });

  it('§7.2 mode any makes one any-one item', () => {
    const ctx = ruleCtx({ mode: 'any' });
    const plan = planApprovals(approveWorkflow({ roles: ['proc'] }), sample(ctx, 'WO-2214'), ctx);
    expect(plan.stages[0].items.find((i) => i.ruleId)?.roles).toEqual(['sec', 'priv']);
    expect(plan.stages[0].items.find((i) => i.ruleId)?.any).toBe(true);
  });

  it('§7.2 draft and inactive rules do not apply', () => {
    const ctx = makeContext();
    for (const rule of ctx.rules) rule.status = 'inactive';
    expect(planApprovals(approveWorkflow({ roles: ['proc'] }), sample(ctx, 'WO-2214'), ctx).rules).toEqual([]);
  });

  it('§7.2 rules are skipped when the walk hit Needs information (no rule output on WO-2280)', () => {
    const ctx = makeContext();
    const plan = planApprovals(workflowById(ctx, 'wf-wo-sub'), { ...sample(ctx, 'WO-2280'), data_access: true }, ctx);
    expect(plan.rules).toEqual([]);
  });

  it('§7.3 a flag-only rule is listed but adds no round', () => {
    const ctx = makeContext();
    ctx.rules = [
      {
        ...ctx.rules[0],
        act: { approve: false, roles: [], mode: 'all', position: 'with', task: false, taskRole: 'tax', taskTitle: '', flag: true, flagField: 'registration_required' },
      },
    ];
    const nodes = approveWorkflow({ roles: ['proc'] }).draft.nodes;
    const plan = planApprovals(newWorkflow(nodes), sample(ctx, 'WO-2214'), ctx);
    expect(plan.rules).toHaveLength(1);
    expect(plan.stages).toHaveLength(1);
    expect(plan.flags).toEqual([{ field: 'registration_required', ruleId: ctx.rules[0].id }]);
  });
});

describe('§8.4 Try an edit statuses', () => {
  const run = (decided: string[], edit: boolean, patch: Partial<ApproveNode>) => {
    const ctx = makeContext();
    const record: SampleRecord = {
      ...sample(ctx, 'WO-2231'),
      decided,
      edit: { label: 'Shorter', set: { total_value: 1 }, decreased: ['end_date'] },
    };
    return runTest({ workflow: approveWorkflow({ roles: ['proc'], material: ['end_date'], ...patch }), record, ctx, options: { applyEdit: edit } });
  };

  it('Approved: nothing it depends on changed', () => {
    expect(round(run(['proc'], false, {}))?.people).toBe('Procurement (Owen Clarke): Approved');
  });
  it('Asked again: a material field changed and reaskOnDecrease is on', () => {
    expect(round(run(['proc'], true, {}))?.people).toBe('Procurement (Owen Clarke): Asked again');
  });
  it('Stands: every changed one went down and reaskOnDecrease is off', () => {
    expect(round(run(['proc'], true, { reaskOnDecrease: false }))?.people).toBe('Procurement (Owen Clarke): Stands');
  });
  it('Waiting: not approved and in the plan before the edit', () => {
    expect(round(run(['hm'], true, {}))?.people).toBe('Procurement (Owen Clarke): Waiting');
  });
  it('New: not approved and not in the plan before the edit', () => {
    const ctx = makeContext();
    const record: SampleRecord = {
      ...sample(ctx, 'WO-2231'),
      total_value: 10,
      decided: ['hm'],
      edit: { label: 'Bigger', set: { total_value: 500000 }, decreased: [] },
    };
    const when = { join: 'all' as const, rows: [{ f: 'total_value', op: '>=' as const, v: 100000 }] };
    const result = runTest({ workflow: approveWorkflow({ roles: ['proc'], when }), record, ctx, options: { applyEdit: true } });
    expect(round(result)?.people).toBe('Procurement (Owen Clarke): New');
  });
});

describe('D-numbered deviations with no Part A test (06 §7.2)', () => {
  it('D21 every Needs-information hit, “are missing” for 2+ fields', () => {
    const ctx = makeContext();
    const nodes = approveWorkflow({ roles: ['proc'] }).draft.nodes;
    nodes.T.outs = [{ key: 'next', to: 'C' }];
    nodes.C = {
      id: 'C',
      kind: 'cond',
      label: 'Blank?',
      outs: [
        { key: 'p1', to: 'A', label: 'Yes', join: 'all', rows: [{ f: 'urgent', op: 'yes' }, { f: 'bill_rate', op: '>', v: 1 }] },
        { key: 'else', to: 'A', label: 'No' },
      ],
    } as CondNode;
    const record = { ...sample(ctx, 'WO-2231'), urgent: null, bill_rate: null };
    const result = runTest({ workflow: newWorkflow(nodes), record: record as SampleRecord, ctx });
    expect(q(result.summary as string)).toBe(
      q('No one needs to approve on this path. Needs information: Urgent start, Bill rate per hour are missing, so “Blank?” can’t decide. Grace Kim has been asked to fill it in.'),
    );
  });

  it('D10 one resolver: reviewers and recipients follow BY_COUNTRY and the record', () => {
    const ctx = makeContext();
    expect(personLabel('priv', { country: 'Germany' }, ctx)).toBe('Privacy');
    expect(personLabel('hm', { hiring_manager: 'Omar Haddad', business_unit: 'Technology' }, ctx)).toBe('Hiring manager (Omar Haddad)');
  });

  it('D29 proper plurals in the inactive warning', () => {
    const ctx = makeContext();
    const jp = setActive(workflowById(ctx, 'wf-jp'), false).workflow;
    expect(inactiveWarning(jp, ctx)).toBe(
      'No other active workflow covers every job posting, so new job postings that only this one covers won’t start or be approved until one is active. Nothing is approved automatically.',
    );
    const sow = setActive(workflowById(ctx, 'wf-sow-sub'), false).workflow;
    expect(inactiveWarning(sow, ctx)).toContain('every SOW, so new SOWs that only');
  });

  it('D25 a new Background check is not blocked and its deciders are set', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const wf = workflowById(ctx, 'wf-onboard');
    const nodes = ed.insertStep(wf.draft.nodes, 'BG', 'next', { kind: 'collect', preset: 'bgcheck' });
    const created = nodes[(nodes.BG.outs as { to: string }[])[0].to] as unknown as Record<string, unknown>;
    expect(created.failFlow).toBeUndefined();
  });

  it('V12 Approve with no approvers and Auto-approve before it', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const wf = ed.createWorkflow(workflowById(ctx, 'wf-wo-sub'));
    let nodes = ed.insertStep(wf.draft.nodes, 'T', 'next', { kind: 'appr' });
    nodes = ed.insertStep(nodes, 'T', 'next', { kind: 'policy' });
    const draft = { ...wf, draft: { nodes } };
    const result = runTest({ workflow: draft, record: sample(ctx, 'WO-2231'), ctx });
    expect(result.summary).toBe('No one needs to approve on this path.');
    expect(q(result.notices?.[0] as string)).toBe(q('For real requests, “Work order submitted” runs for this record.'));
    expect(result.steps.map((s) => [s.title, s.status])).toEqual([
      ['Auto-approve', 'Not used'],
      ['Approval', 'Choose who approves'],
    ]);
    expect(q(lintWorkflow(draft, ctx).issues[0].m)).toBe(q('“Approval” doesn’t say who approves yet.'));
  });
});

describe('§15 and §19.1 odds and ends', () => {
  it.each([
    ['work_order', 'changed', 'wo_approved'],
    ['work_order', 'accepted', 'wo_approved'],
    ['work_order', 'submitted', 'none'],
    ['onboarding', 'ob_done', 'wo_approved'],
    ['offboarding', 'off_start', 'active'],
    ['offboarding', 'off_done', 'none'],
    ['sow', 'change_order', 'sow_approved'],
    ['sow', 'created', 'none'],
    ['invoice', 'received', 'ts_approved'],
    ['assignment', 'end_30', 'cleared'],
    ['timesheet', 'submitted', 'active'],
    ['expense', 'approved', 'active'],
    ['job_posting', 'created', 'none'],
  ] as const)('§15 item 2 prereqFor(%s, %s) = %s', (record, event, prereq) => {
    expect(prereqFor(record, event)).toBe(prereq);
  });

  it('§15 item 2 the built-in line', () => {
    const { presets } = makeContext();
    expect(copy.builtIn(presets.PRE_SHORT.wo_approved)).toBe(
      '🔒 Built in: Levv only starts this once the work order is approved. Anything that arrives earlier waits, and the owner is told if it waits more than 7 days.',
    );
  });

  it('V7 the sponsor provides: card subtitle and Chaser label', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const wf = workflowById(ctx, 'wf-access');
    wf.draft.nodes = ed.setField(wf.draft.nodes, 'ID', 'from', 'sponsor');
    expect(subtitle(wf, wf.draft.nodes.ID, ctx)).toBe('Sponsor provides · Persona, then Information Security');
    expect(chaserFor(wf.draft.nodes.ID as CollectNode).label).toBe('Then escalate to their manager after (hours)');
  });

  it('§11 item 4 the “Try a record” rows', () => {
    const ctx = makeContext();
    const rows = samplesFor(workflowById(ctx, 'wf-wo-sub'), ctx);
    expect(rows.map((row) => row.id)).toEqual(['WO-2214', 'WO-2240', 'WO-2231', 'WO-2260', 'WO-2270', 'WO-2275', 'WO-2280']);
    expect(rows[0]).toEqual({ id: 'WO-2214', title: 'Senior cloud engineer', note: 'Worked example 1' });
  });

  it('§17.1 storing and clearing “Only needed when”', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const nodes = workflowById(ctx, 'wf-wo-sub').draft.nodes;
    const when = { join: 'all' as const, rows: [{ f: 'rate_vs_card_pct', op: '>' as const, v: 15 }] };
    const stored = ed.setWhen(nodes, 'RA_A2', when, '  over 15%  ');
    expect(stored.RA_A2).toMatchObject({ when, whenPrompt: 'over 15%' });
    const cleared = ed.clearWhen(stored, 'RA_A2') as Nodes;
    expect((cleared.RA_A2 as ApproveNode).when).toBeUndefined();
    expect((cleared.RA_A2 as ApproveNode).whenPrompt).toBe('');
  });
});

describe('§10 and §11 odds and ends', () => {
  it('§10.5 a Collect & verify failure with Escalate: Failed, then the generated step, then held', () => {
    const ctx = makeContext();
    const record = { ...sample(ctx, 'WO-2214-A'), outcomesL: { 'Identity & eligibility': 'fail' as const } };
    const result = runTest({ workflow: workflowById(ctx, 'wf-onboard'), record, ctx });
    const byTitle = (t: string) => result.steps.find((s) => s.title === t);
    expect(byTitle('Identity & eligibility')).toMatchObject({
      status: 'Failed: escalated',
      message: 'Asked of the worker: Photo ID, Right to work. Failed. Escalated to People Ops (Jordan Lee): they approve to carry on, reject with a comment, or send it back',
      workerSees: 'In progress',
    });
    expect(byTitle('Identity & eligibility failed: escalation')).toMatchObject({
      status: 'Escalated',
      rounds: [{ n: 1, people: 'People Ops (Jordan Lee)', notes: [] }],
    });
    expect(result.summary).toBe('1 approval round on this path.');
  });

  it('§10.3 Ask people to decide with no deciders', () => {
    const ctx = makeContext();
    const wf = workflowById(ctx, 'wf-onboard');
    (wf.draft.nodes.BG as CollectNode).failRoles = [];
    const result = runTest({ workflow: wf, record: sample(ctx, 'WO-2251-A'), ctx });
    expect(result.steps.find((s) => s.id === 'BG')?.message).toBe('Asked of the worker: Criminal record, Employment history. Failed. Nobody is set to decide yet');
  });

  it('§10.3 a done Task', () => {
    const ctx = makeContext();
    const nodes: Nodes = {
      T: { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: 'K' }] },
      K: { id: 'K', kind: 'task', label: 'Do it', role: 'hm', title: 'Enter it', outs: [{ key: 'next', to: 'END' }] } as TaskNode,
      END: { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] },
    };
    const record = { ...sample(ctx, 'WO-2231'), outcomes: { K: 'done' as const } };
    expect(runTest({ workflow: newWorkflow(nodes), record, ctx }).steps[0]).toEqual({ id: 'K', title: 'Do it', status: 'Done', message: 'Enter it: done by Hiring manager (Grace Kim)' });
  });

  it('§10.3 Notify with nobody', () => {
    const ctx = makeContext();
    const nodes: Nodes = {
      T: { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: 'N' }] },
      N: { id: 'N', kind: 'notify', label: 'Tell', recipients: [], channel: 'Email', outs: [{ key: 'next', to: 'END' }] },
      END: { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] },
    };
    expect(runTest({ workflow: newWorkflow(nodes), record: sample(ctx, 'WO-2231'), ctx }).steps[0]).toEqual({ id: 'N', title: 'Tell', status: 'No one to tell', message: 'Pick who to tell' });
  });

  it('§4 walkOutcome: rejected and stopped', () => {
    const ctx = makeContext();
    const nodes = ok(createEditor(ctx).setPathThen(workflowById(ctx, 'wf-wo-sub').draft.nodes, 'RA_C1', 'else', 'stop', 'hm'));
    const walk = walkWorkflow(nodes, sample(ctx, 'WO-2231'), ctx);
    expect(walkOutcome(nodes, walk, ctx)).toEqual({
      rejected: null,
      stopped: { nodeId: 'RA_C1', by: 'Rate over card?', told: ['Hiring manager'] },
    });
    const rejected = ok(createEditor(ctx).setPathThen(workflowById(ctx, 'wf-wo-sub').draft.nodes, 'RA_C1', 'else', 'reject'));
    expect(walkOutcome(rejected, walkWorkflow(rejected, sample(ctx, 'WO-2231'), ctx), ctx).rejected).toEqual({ nodeId: 'RA_C1', by: 'Rate over card?' });
  });

  it('composeTest takes a run and the context', () => {
    const ctx = makeContext();
    const run = simulateTest(workflowById(ctx, 'wf-jp'), sample(ctx, 'JP-5120'), ctx);
    expect(composeTest(run, ctx).summary).toBe('No one needs to approve on this path. Approved automatically. No one had to act.');
  });
});

describe('§13 publish', () => {
  it('§13.6 status texts and dots', () => {
    const ctx = makeContext();
    const live = workflowById(ctx, 'wf-wo-sub');
    expect(statusText(live)).toBe('Live v1');
    expect(statusDot(live)).toBe('live');
    expect(statusText(workflowById(ctx, 'wf-wo-sub-wo-data'))).toBe('Draft');
    expect(statusDot(workflowById(ctx, 'wf-wo-sub-wo-data'))).toBe('draft');
    expect(statusText({ ...live, status: 'inactive' })).toBe('Inactive · v1');
    expect(statusDot({ ...live, status: 'inactive' })).toBe('off');
    const pending = { ...live, pending: { submittedBy: 'x', submittedAt: 'y', effective: 'z' } };
    expect(statusText(pending)).toBe('Waiting for approval');
    expect(statusDot(pending)).toBe('draft');
    const dirty = { ...live, name: 'Renamed' };
    expect(hasUnpublishedChanges(dirty)).toBe(true);
    expect(statusDot(dirty)).toBe('dirty');
  });

  it('§13.3 overlapChoice: stored choice, then priority', () => {
    const ctx = makeContext();
    const wf = workflowById(ctx, 'wf-wo-sub-wo-data');
    const overlap = { id: 'x', name: 'x', scope: {}, priority: null, count: 1 };
    expect(overlapChoice(wf, overlap)).toBeNull();
    expect(overlapChoice(wf, overlap, [{ otherId: 'x', winner: 'other' }])).toBe('other');
    expect(overlapChoice({ ...wf, priority: 1 }, overlap)).toBe('self');
    expect(overlapChoice(wf, { ...overlap, priority: 1 })).toBe('other');
  });
});

describe('§14 active / inactive', () => {
  it('§14.2 what the first box shows', () => {
    const ctx = makeContext();
    expect(activeState(workflowById(ctx, 'wf-wo-sub-wo-data'), ctx)).toMatchObject({ hasSwitch: false, title: 'Draft', text: 'Publish it to make it active.' });
    expect(activeState(workflowById(ctx, 'wf-wo-sub'), ctx)).toMatchObject({ hasSwitch: true, on: true, title: 'Active', text: 'New events start this workflow.' });
    const off = setActive(workflowById(ctx, 'wf-wo-sub-wo-uk-tech'), false).workflow;
    expect(activeState(off, ctx)).toMatchObject({
      on: false,
      title: 'Inactive',
      text: 'Nothing new uses this workflow. Anything already running finishes on it. Turn it back on any time.',
      warning: null, // the catch-all "Work order submitted" still covers everything
    });
  });

  it('§14.4 toasts; version does not change', () => {
    const ctx = makeContext();
    const wf = workflowById(ctx, 'wf-jp');
    const off = setActive(wf, false);
    expect(off.toast).toBe('“Job posting created” is inactive. It can’t be deleted, only turned back on');
    expect(off.workflow.version).toBe(wf.version);
    expect(setActive(off.workflow, true).toast).toBe('“Job posting created” is active again');
  });
});

describe('§16 graph editing', () => {
  const setup = () => {
    const ctx = makeContext();
    return { ctx, ed: createEditor(ctx), nodes: structuredClone(workflowById(ctx, 'wf-wo-sub').draft.nodes) };
  };

  it('§16.0 ids: one shared counter from 101, reserving what is already there', () => {
    const gen = createIdGen();
    expect(gen.next('workflow')).toBe('nf101');
    expect(gen.next('node')).toBe('n102');
    expect(gen.next('path')).toBe('p103');
    expect(gen.next('branch')).toBe('b104');
    gen.reserve(['n200', 'RA_A1', 'p1', 'n103_else']);
    expect(gen.next('node')).toBe('n201');
  });

  it('§16.1 Fits plan? comes with its Outside plan step', () => {
    const { ed, nodes } = setup();
    const after = ed.insertStep(nodes, 'T', 'next', { kind: 'plan' });
    const plan = after[(after.T.outs as { to: string }[])[0].to] as PlanNode;
    expect(plan.label).toBe('Fits plan?');
    const out = plan.outs.find((o) => o.key === 'out');
    expect(out?.to).toBe(`${plan.id}x`);
    expect(after[`${plan.id}x`]).toMatchObject({ kind: 'appr', label: 'Outside plan', roles: ['cco'] });
  });

  it('§16.1 a new Collect & verify (failTo role) gets its generated escalation; inserting after it moves that too', () => {
    const { ed, nodes } = setup();
    const withCollect = ed.insertStep(nodes, 'T', 'next', { kind: 'collect' });
    const collectId = (withCollect.T.outs as { to: string }[])[0].to;
    const collect = withCollect[collectId] as CollectNode;
    expect(collect.failNode).toBe(`${collectId}_fail`);
    expect(collect.outs.map((o) => [o.key, o.label])).toEqual([['next', 'Done'], ['fail', 'Failed']]);

    const after = ed.insertStep(withCollect, collectId, 'next', { kind: 'notify' });
    const next = (after[collectId] as CollectNode).outs[0].to;
    expect((after[`${collectId}_fail`] as ApproveNode).outs[0].to).toBe(next);
  });

  it.each([
    [{ kind: 'policy' }, { label: 'Auto-approve', receipt: 'Approved automatically', fyi: '' }],
    [{ kind: 'task' }, { label: 'New task', role: 'proc', title: 'Enter the PO number' }],
    [{ kind: 'notify' }, { label: 'Notify', recipients: ['cco'], channel: 'Email' }],
    [{ kind: 'wait' }, { label: 'Wait', w: { mode: 'date', field: 'start_date', amount: 5, unit: 'business_days', dir: 'before', time: '09:00', tz: 'worker' } }],
    [{ kind: 'runwf' }, { label: 'Run workflow', target: 'wf-ending' }],
    [{ kind: 'dw', worker: 'budget' }, { label: 'Budget check', worker: 'budget', flagDo: 'note' }],
    [{ kind: 'dw', worker: 'invoice' }, { worker: 'invoice', fallback: 'proc' }],
  ] as const)('02 §5.14 defaults for %j', (spec, expected) => {
    const { ed, nodes } = setup();
    const after = ed.insertStep(nodes, 'T', 'next', spec);
    expect(after[(after.T.outs as { to: string }[])[0].to]).toMatchObject(expected);
  });

  it('02 §5.14 System step defaults', () => {
    const { ed, nodes } = setup();
    const after = ed.insertStep(nodes, 'T', 'next', { kind: 'system' });
    expect(after[(after.T.outs as { to: string }[])[0].to]).toMatchObject({
      label: 'System step',
      system: 'Workday',
      via: '',
      sys: { action: 'create', object: 'Contingent worker', match: 'Work email', read: [], wait: 'confirm', waitH: 24, state: 'Completed', onFail: 'task', failRole: 'people_ops', retries: 3, check: false },
    });
  });

  it('02 §5.14 a preset: label, kind defaults, then p, then preset', () => {
    const { ed, nodes } = setup();
    const after = ed.insertStep(nodes, 'T', 'next', { kind: 'system', preset: 'revoke' });
    expect(after[(after.T.outs as { to: string }[])[0].to]).toMatchObject({ label: 'Remove access', preset: 'revoke', system: 'Okta', via: 'sweeper', when: 'last', sys: { action: 'close', check: true } });
  });

  it('§16.2 computeMergeAt', () => {
    const { ctx, nodes } = setup();
    expect(computeMergeAt(nodes, 'RA_C1')).toBe('RA_C2');
    const rejected = ok(createEditor(ctx).setPathThen(nodes, 'RA_C1', 'else', 'reject'));
    expect(computeMergeAt(rejected, 'RA_C1')).toBe('RA_A2');
  });

  it('§16.3 pathMode and §16.4 the card rows', () => {
    const { ctx, ed, nodes } = setup();
    expect(pathMode(nodes, 'RA_C1', 'p1')).toBe('custom');
    expect(pathMode(nodes, 'RA_C1', 'else')).toBe('continue');
    expect(pathCardRow(nodes, 'RA_C1', 'p1', ctx)).toBe('→ Rate review');
    expect(pathCardRow(nodes, 'RA_C1', 'else', ctx)).toBe('carries on');
    const escalated = ok(ed.setPathThen(nodes, 'RA_C1', 'else', 'escalate', 'g:fin_ctrl'));
    expect(pathMode(escalated, 'RA_C1', 'else')).toBe('escalate');
    expect(pathCardRow(escalated, 'RA_C1', 'else', ctx)).toBe('escalate · Finance controllers');
    expect(pathCardRow(ok(ed.setPathThen(nodes, 'RA_C1', 'else', 'approve', 'p:Chloe Martin')), 'RA_C1', 'else', ctx)).toBe('approval · Chloe Martin');
    expect(pathCardRow(ok(ed.setPathThen(nodes, 'RA_C1', 'else', 'reject')), 'RA_C1', 'else', ctx)).toBe('rejected');
    expect(pathCardRow(ok(ed.setPathThen(nodes, 'RA_C1', 'else', 'stop', 'hm')), 'RA_C1', 'else', ctx)).toBe('stop');
  });

  it('§16.4 renaming a path renames its generated step', () => {
    const { ed, nodes } = setup();
    const on = ok(ed.setPathThen(nodes, 'RA_C1', 'else', 'escalate', 'g:fin_ctrl'));
    expect(ed.renamePath(on, 'RA_C1', 'else', 'Low').RA_C1_else.label).toBe('Low: escalation');
    const stop = ok(ed.setPathThen(nodes, 'RA_C1', 'else', 'stop', 'hm'));
    expect(ed.renamePath(stop, 'RA_C1', 'else', 'Low').RA_C1_else.label).toBe('Low: tell them it stopped');
  });

  it('§16.5 deleting back to one path named Yes renames Otherwise to No', () => {
    const { ed } = setup();
    const added = ed.addPath(iGraph('I3'), 'n103');
    expect((added.n103 as CondNode).outs[2].label).toBe('Otherwise');
    const key = (added.n103 as CondNode).outs[1].key;
    expect((ed.deletePath(added, 'n103', key).n103 as CondNode).outs[1].label).toBe('No');
  });

  it('§16.5 addCondition, addOption, removeRow, setRowField', () => {
    const { ed } = setup();
    const graph = iGraph('I4');
    const rows = (nodes: Nodes) => ((nodes.n103 as CondNode).outs[0] as unknown as { rows: unknown[] }).rows;
    const one = ed.addCondition(graph, 'n103', 'p1');
    expect(rows(one)[1]).toEqual({ f: 'total_value', op: '>=', v: 250000 });
    const group = ed.addEitherOr(graph, 'n103', 'p1');
    const option = ed.addOption(group, 'n103', 'p1', 1);
    expect((rows(option)[1] as { rows: unknown[] }).rows[2]).toEqual({ f: 'total_value', op: '>=', v: 250000 });
    expect(rows(ed.removeRow(one, 'n103', 'p1', 1))).toHaveLength(1);
    expect((rows(ed.removeRow(option, 'n103', 'p1', 1, 2))[1] as { rows: unknown[] }).rows).toHaveLength(2);
    expect(rows(ed.setRowField(graph, 'n103', 'p1', 0, 'country'))[0]).toEqual({ f: 'country', op: 'in', v: [] });
    expect(rows(ed.setRowField(graph, 'n103', 'p1', 0, 'changed_fields'))[0]).toEqual({ f: 'changed_fields', op: 'includes', v: 'end_date' });
    expect(rows(ed.setRowField(graph, 'n103', 'p1', 0, 'urgent'))[0]).toEqual({ f: 'urgent', op: 'yes' });
    expect(rows(ed.setRowField(graph, 'n103', 'p1', 0, 'project_code'))[0]).toEqual({ f: 'project_code', op: 'is', v: '' });
    expect(rows(ed.setRowField(graph, 'n103', 'p1', 0, 'bill_rate'))[0]).toEqual({ f: 'bill_rate', op: '>=', v: 0 });
  });

  it('§16.6 setFlag: note, and a generated label drops “ check”', () => {
    const { ed, nodes } = setup();
    const note = ed.setFlag(nodes, 'RA_CD', 'note');
    expect((note.RA_CD as DwNode).outs[0].to).toBe('RA_A1');
    expect((note.RA_CD as DwNode).flagNode).toBeNull();
    expect(note.RA_CDe).toBeUndefined();
    const budget = ed.setFlag(nodes, 'RA_CB', 'escalate');
    expect(budget.RA_CBf.label).toBe('Budget flagged: escalation');
  });

  it('§16.7 deleting the merge step moves mergeAt; Start and End cannot be deleted', () => {
    const { ed, nodes } = setup();
    const after = ed.deleteStep(nodes, 'RA_C2');
    expect((after.RA_C1 as CondNode).mergeAt).not.toBe('RA_C2');
    expect(ed.deleteStep(nodes, 'T')).toEqual(nodes);
    expect(ed.deleteStep(nodes, 'END')).toEqual(nodes);
  });

  it('§16.7 deleting a Collect & verify removes its generated step; a generated escalation whose next was deleted rejoins', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const nodes = workflowById(ctx, 'wf-onboard').draft.nodes;
    expect(ed.deleteStep(nodes, 'ID').ID_fail).toBeUndefined();
    const next = (nodes.ID as CollectNode).outs[0].to;
    const after = ed.deleteStep(nodes, next);
    expect((after.ID_fail as ApproveNode).outs[0].to).toBe((after.ID as CollectNode).outs[0].to);
  });

  it('§16.8 gc keeps END and what can be reached', () => {
    const { nodes } = setup();
    nodes.OLD = { id: 'OLD', kind: 'notify', label: 'x', recipients: [], channel: 'Email', outs: [{ key: 'next', to: 'END' }] };
    gc(nodes);
    expect(nodes.OLD).toBeUndefined();
    expect(nodes.END).toBeDefined();
  });

  it('§16.9 branches', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const nodes = ed.insertStep(workflowById(ctx, 'wf-wo-sub').draft.nodes, 'T', 'next', { kind: 'parallel' });
    const id = (nodes.T.outs as { to: string }[])[0].to;
    expect((nodes[id] as ParallelNode).outs.map((o) => o.label)).toEqual(['Branch 1', 'Branch 2']);
    expect(ed.removeBranch(nodes, id, 'b1')).toEqual(nodes);
    const three = ed.addBranch(nodes, id);
    expect((three[id] as ParallelNode).outs[2]).toMatchObject({ label: 'Branch 3' });
    expect((ed.removeBranch(three, id, 'b1')[id] as ParallelNode).outs).toHaveLength(2);
  });

  it('§16.10 insertAfterMerge', () => {
    const { ed, nodes } = setup();
    const after = ok(ed.insertAfterMerge(nodes, 'RA_C1', { kind: 'notify' })) as Nodes;
    const created = (after.RA_C1 as CondNode).mergeAt as string;
    expect(after[created].kind).toBe('notify');
    expect((after[created].outs as { to: string }[])[0].to).toBe('RA_C2');
    expect((after.RA_A2.outs as { to: string }[])[0].to).toBe(created);
    expect((after.RA_C1 as CondNode).outs.find((o) => o.key === 'else')?.to).toBe(created);
  });

  it('§16.10 paths that never meet are refused', () => {
    const { ctx, ed } = setup();
    const nodes: Nodes = {
      T: { id: 'T', kind: 'trigger', label: '', outs: [{ key: 'next', to: 'P' }] },
      P: { id: 'P', kind: 'parallel', label: 'x', outs: [{ key: 'b1', to: 'E1', label: 'a' }, { key: 'b2', to: 'END', label: 'b' }] } as ParallelNode,
      E1: { id: 'E1', kind: 'end', label: 'Rejected', outcome: 'rejected', outs: [] },
      END: { id: 'END', kind: 'end', label: '', outcome: 'completed', outs: [] },
    };
    expect(ed.insertAfterMerge(nodes, 'P', { kind: 'notify' })).toEqual({ ok: false, message: copy.pathsNeverMeet });
    void ctx;
  });

  it('§16.11 setPlanOutside: changes the role, or creates the step', () => {
    const { ed, nodes } = setup();
    const withPlan = ed.insertStep(nodes, 'T', 'next', { kind: 'plan' });
    const id = (withPlan.T.outs as { to: string }[])[0].to;
    expect((ed.setPlanOutside(withPlan, id, 'fbp')[`${id}x`] as ApproveNode).roles).toEqual(['fbp']);
    const direct = structuredClone(withPlan);
    (direct[id] as PlanNode).outs[1].to = (direct[`${id}x`].outs as { to: string }[])[0].to;
    delete direct[`${id}x`];
    expect(ed.setPlanOutside(direct, id, 'dh')[`${id}x`]).toMatchObject({ label: 'Outside plan', roles: ['dh'] });
  });

  it('§16.11 setSystem keeps a non-create action; setSystemObject resets the map', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const nodes = workflowById(ctx, 'wf-offboard').draft.nodes;
    const moved = ed.setSystem(nodes, 'RV', 'Microsoft Entra ID');
    expect((moved.RV as SystemNode).sys).toMatchObject({ system: 'Microsoft Entra ID', action: 'close' });
    const object = ctx.systems.SYS.Workday.obj[0];
    const remapped = ed.setSystemObject(nodes, 'RV', object);
    expect((remapped.RV as SystemNode).sys.map).toEqual(ctx.systems.SYS_MAP[object] ?? ctx.systems.SYS_MAP._);
  });

  it('§16.11 setField: “Equipment” sets gives', () => {
    const { ed, nodes } = setup();
    const after = ed.setField(nodes, 'RW', 'kit', ['Laptop', 'Phone']);
    expect((after.RW as unknown as { gives: string }).gives).toBe('Laptop and Phone');
  });

  it('§16.12 changing the role updates roles; an edited sla survives', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const nodes = ed.setEscalateAfter(workflowById(ctx, 'wf-onboard').draft.nodes, 'ID', null, 60);
    const after = ed.setCollectFail(nodes, 'ID', 'role', 'it');
    expect(after.ID_fail).toMatchObject({ roles: ['it'], sla: 60 });
    expect((after.ID as CollectNode).failRole).toBe('it');
  });

  it('§16.13 dropping a Digital Worker', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const nodes = workflowById(ctx, 'wf-onboard').draft.nodes;
    const onCollect = ed.dropWorker(nodes, 'VI', 'docs');
    expect(onCollect.nodes.VI).toMatchObject({ checker: 'dw:docs', verify: 'auto_person' });
    expect(onCollect.toast).toBe('Document collector now verifies “Vendor insurance”');
    const onSystem = ed.dropWorker(nodes, 'WD', 'access');
    expect((onSystem.nodes.WD as SystemNode).via).toBe('access');
    expect(onSystem.toast).toBe('Access provisioner now does “Workday provisioning”');
    const approve = ed.dropWorker(workflowById(ctx, 'wf-wo-sub').draft.nodes, 'RA_A1', 'budget');
    expect(approve.toast).toBe('Checks go on the line before an approver: drop it on a +');
  });

  it('§12 the one-click fixes', () => {
    const { ctx, ed } = setup();
    const nodes = workflowById(ctx, 'wf-wo-sub').draft.nodes;
    nodes.RW = { ...nodes.RW, gives: 'Portal login' } as WfNode;
    expect(lintWorkflow(workflowById(ctx, 'wf-wo-sub'), ctx).issues).toEqual([
      { sev: 'bad', node: 'RW', m: '“Tell the supplier” gives Portal login but has no reverse step, so offboarding would leave it behind.', fix: 'rev:RW', fl: 'Add a reverse step' },
    ]);
    const fixed = ed.applyLintFix(nodes, 'rev:RW');
    expect(fixed.toast).toBe('Added reverse step “Remove Portal login”');
    expect((fixed.nodes.RW as unknown as { reverse: string }).reverse).toBe('Remove Portal login');
  });

  it('§12 L3, the tip, and its fix', () => {
    const { ctx, ed } = setup();
    const wf = workflowById(ctx, 'wf-wo-sub');
    const withSystem = ed.insertStep(wf.draft.nodes, 'T', 'next', { kind: 'system' });
    const id = (withSystem.T.outs as { to: string }[])[0].to;
    wf.draft.nodes = withSystem;
    expect(lintWorkflow(wf, ctx).issues).toContainEqual({
      sev: 'tip',
      node: id,
      m: '“System step” creates something in Workday that isn’t in the ledger, so offboarding won’t know to remove it.',
      fix: `gr:${id}`,
      fl: 'Record it in the ledger',
    });
    const fixed = ed.applyLintFix(withSystem, `gr:${id}`);
    expect(fixed.nodes[id]).toMatchObject({ gives: 'Workday account', reverse: 'Close Workday account' });
    expect(fixed.toast).toBe('Recorded in the ledger, with a reverse step');
  });

  it('§12 L5 and L6', () => {
    const ctx = makeContext();
    const ed = createEditor(ctx);
    const a = workflowById(ctx, 'wf-ending');
    const b = workflowById(ctx, 'wf-wo-sub');
    b.draft.nodes = ed.setField(ed.insertStep(b.draft.nodes, 'T', 'next', { kind: 'runwf' }), 'n101', 'target', 'wf-ending');
    a.draft.nodes = ed.setField(ed.insertStep(a.draft.nodes, 'T', 'next', { kind: 'runwf' }), 'n102', 'target', 'wf-wo-sub');
    expect(lintWorkflow(b, ctx).issues.map((i) => i.m)).toContain('“Run workflow” starts “Assignment ending”, which starts this workflow again. They would start each other forever.');
    const gives = makeContext();
    gives.workflows = gives.workflows.filter((w) => !w.records.includes('offboarding'));
    expect(lintWorkflow(workflowById(gives, 'wf-onboard'), gives).issues.map((i) => i.m)).toContain('Things are given to workers, but there is no Offboarding workflow to take them back.');
  });

  it('§16.13 createWorkflow without a source; the date rolls over the year', () => {
    const created = createWorkflowIn(null, { idGen: createIdGen(), asOf: '2026-12-15' });
    expect(created.records).toEqual(['work_order']);
    expect(created.event).toBe('submitted');
    expect(created.effective).toBe('2027-02-01');
  });
});

describe('§18 canvas and panel texts', () => {
  const ctx = makeContext();
  const sub = workflowById(ctx, 'wf-wo-sub');

  it.each([
    ['wf-wo-sub', 'T', 'Everywhere'],
    ['wf-wo-sub-wo-uk-tech', 'T', 'UK · Technology'],
    ['wf-wo-sub', 'RA_C2', 'Over $1M · Over $250K'],
    ['wf-onboard', 'WD', 'Create contingent worker in Workday · gives Workday account'],
    ['wf-onboard', 'VI', 'Supplier account manager provides · Procurement'],
    ['wf-onboard', 'ID', 'Worker provides · Persona, then People Ops'],
    ['wf-ending', 'K1', 'Hiring manager'],
    ['wf-onboard', 'W1', 'Until Start date, 09:00'],
    ['wf-wo-sub', 'RA_A1', 'Together: Hiring manager + Cost center owner'],
    ['wf-wo-sub', 'RA_CD', 'If flagged: escalate to Procurement'],
    ['wf-wo-sub', 'END', 'Completed'],
  ])('§18.1 subtitle of %s %s', (workflowId, nodeId, text) => {
    const wf = workflowById(ctx, workflowId);
    expect(subtitle(wf, wf.draft.nodes[nodeId], ctx)).toBe(text);
  });

  it('§18.1 Approve with nobody, and a named person', () => {
    const wf = approveWorkflow({ roles: [] });
    expect(subtitle(wf, wf.draft.nodes.A, ctx)).toBe('Choose who approves');
    const named = approveWorkflow({ roles: ['p:Chloe Martin'], who: 'person', backup: 'Lena Fischer' });
    expect(subtitle(named, named.draft.nodes.A, ctx)).toBe('Chloe Martin · backup Lena Fischer');
    const alone = approveWorkflow({ roles: ['p:Chloe Martin'], who: 'person' });
    expect(subtitle(alone, alone.draft.nodes.A, ctx)).toBe('Chloe Martin · no backup');
  });

  it('§18.2 the If top line', () => {
    expect(q(ifTopLine(sub.draft.nodes, sub.draft.nodes.RA_C1 as CondNode))).toBe(
      q('Levv checks the paths from the top and takes the first one that matches. If none match, it goes to “Otherwise”. All paths meet again at “Value band”.'),
    );
    const i3 = iGraph('I3');
    expect(q(ifTopLine(i3, i3.n103 as CondNode))).toBe(
      q('Levv checks the paths from the top and takes the first one that matches. If none match, it goes to “No”. All paths meet again at “Approval”.'),
    );
  });

  it('§18.3 the Approve sentence', () => {
    expect(approveSentence(sub.draft.nodes.RA_A1 as ApproveNode, ctx)).toBe('Hiring manager, Cost center owner approve, together. Levv finds the right person for each request.');
    expect(approveSentence(sub.draft.nodes.RA_A2 as ApproveNode, ctx)).toBe('Procurement approve. Levv finds the right person for each request.');
    const none = approveWorkflow({ roles: [] }).draft.nodes.A as ApproveNode;
    expect(approveSentence(none, ctx)).toBe('Pick roles. Levv finds the right person for each request.');
    const group = approveWorkflow({ roles: ['g:fin_ctrl'], who: 'group' }).draft.nodes.A as ApproveNode;
    expect(approveSentence(group, ctx)).toBe('Finance controllers: Chloe Martin, Lena Fischer, David Okafor. Any one of them can approve.');
    const person = approveWorkflow({ roles: ['p:Chloe Martin'], who: 'person' }).draft.nodes.A as ApproveNode;
    expect(approveSentence(person, ctx)).toBe('A named person doesn’t follow reorgs. If they leave or change role, Nova flags every step that names them.');
  });
});
