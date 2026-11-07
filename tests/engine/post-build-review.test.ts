import { describe, expect, it } from 'vitest';
import { planApprovals } from '../../src/flow-studio/engine/plan';
import { simulateTest } from '../../src/flow-studio/engine/simulate';
import { approvePublish, findOverlaps, publishReview, sendForApproval } from '../../src/flow-studio/engine/publish';
import { selectWorkflow } from '../../src/flow-studio/engine/selection';
import type { StoreDriver, StoreWrite } from '../../src/flow-studio/data/driver';
import { createMemoryDriver, emptyTables } from '../../src/flow-studio/data/memory/driver';
import type { EngineContext } from '../../src/flow-studio/model/context';
import type { RecordData } from '../../src/flow-studio/model/records';
import type { ApproveNode, Workflow } from '../../src/flow-studio/model/workflow';
import { mockAdapters, type Adapters } from '../../src/flow-studio/runtime/adapters';
import { ApiError } from '../../src/flow-studio/server/errors';
import { makeContext } from '../support/context';
import { actor, actorSets, createWorld, hoursAfter, recordOf, type World } from '../support/runtime-world';

/**
 * The independent review after M8 found these and every acceptance test missed them. Each test reproduced its finding on
 * the code as it stood at M8 and failed before the fix; the ids are the review's finding numbers. BUILD_REPORT's
 * "Post-build review" has the outcome of each.
 */

const openItems = async (world: World, runId: string): Promise<string[]> =>
  (await world.items(runId)).filter((item) => item.status === 'open').map((item) => `${item.kind}:${item.assignee}:${item.nodeId}`);

const codeOf = async (action: Promise<unknown>): Promise<string | null> => {
  try {
    await action;
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
};

const dataOf = async (world: World, id: string): Promise<Record<string, unknown>> => ((await world.store.rawGet('records', id))?.doc as { data: Record<string, unknown> }).data;

const contextOf = async (world: World): Promise<EngineContext> => ({
  ...(await world.store.reference.getAll()),
  workflows: await world.store.workflows.all(),
  samples: await world.store.records.samples(),
  history: await world.store.records.history(),
  asOf: world.clock.asOf(),
  now: world.clock.now(),
  idGen: { next: () => 'x', reserve() {} },
  approverAvailability: { othersCanApprove: true },
} as EngineContext);

/** A rejected WO-2231, with the requester's resubmit item open. */
async function rejected(world: World) {
  const run = await world.start('WO-2231');
  await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'rejected', 'No');
  return { run, item: await world.itemFor(run.id, 'Grace Kim', 'resubmit') };
}

const decideEveryone = async (world: World, runId: string): Promise<void> => {
  for (let i = 0; i < 20; i += 1) {
    const [next] = (await world.items(runId)).filter((item) => item.status === 'open' && ['approve', 'escalation'].includes(item.kind));
    if (!next) return;
    const answer = await world.decide(next.id, next.assignee, 'approved');
    if (!answer.ok) throw new Error(JSON.stringify(answer));
  }
};

describe('Finding 1: a resubmit may change business fields, never what controls approval', () => {
  it('1a refuses prev, which would make the plan say the roles approved the original', async () => {
    const world = await createWorld();
    const { run, item } = await rejected(world);
    expect(await codeOf(world.service.resubmit(actor('Grace Kim'), item.id, { prev: { total_value: 95000 } }))).toBe('FIELD_NOT_EDITABLE');
    const after = await world.run(run.id);
    expect(after.status).toBe('running');
    expect(after.steps.RA_A1.status).toBe('waiting');
    expect((await dataOf(world, 'WO-2231')).prev).toBeUndefined();
    expect((await world.store.workItems.get(item.id))?.status).toBe('open');
  });

  it('1b refuses a change of who raised it or who approves it, and writes nothing', async () => {
    const world = await createWorld();
    const { run, item } = await rejected(world);
    for (const change of [{ requester: 'Sam Patel' }, { hiring_manager: 'Grace Kim' }, { business_unit: 'Marketing' }, { country: 'UK' }, { cost_center: 'CC-100' }, { sponsor: 'Grace Kim' }, { worker_name: 'Raj Patel' }]) {
      expect(await codeOf(world.service.resubmit(actor('Grace Kim'), item.id, change))).toBe('FIELD_NOT_EDITABLE');
    }
    const data = await dataOf(world, 'WO-2231');
    expect(data.requester).toBe('Grace Kim');
    expect(data.business_unit).toBe('Operations');
    expect(data.hiring_manager).toBeUndefined();
    expect((await openItems(world, run.id)).filter((line) => line.startsWith('approve:'))).toEqual([]);
  });

  it('1c refuses states, so a prerequisite cannot be granted by the requester', async () => {
    const world = await createWorld();
    const { item } = await rejected(world);
    expect(await codeOf(world.service.resubmit(actor('Grace Kim'), item.id, { states: ['wo_approved'] }))).toBe('FIELD_NOT_EDITABLE');
    expect((await dataOf(world, 'WO-2231')).states).toEqual([]);
  });

  it('1d refuses what the checks and rules read: a requester cannot clear their own flag', async () => {
    const world = await createWorld();
    const { item } = await rejected(world);
    for (const change of [{ duplicate_found: false }, { budget_left_after: 900000 }, { rate_vs_card_pct: 0 }, { changed_fields: [] }, { data_access: false }, { conflict: null }, { outcomes: {} }]) {
      expect(await codeOf(world.service.resubmit(actor('Grace Kim'), item.id, change))).toBe('FIELD_NOT_EDITABLE');
    }
  });

  it('1e a business field goes through, and the people who answered are asked again', async () => {
    const world = await createWorld();
    const { run, item } = await rejected(world);
    await world.service.resubmit(actor('Grace Kim'), item.id, { total_value: 90000, site: 'Remote' });
    expect((await dataOf(world, 'WO-2231')).total_value).toBe(90000);
    expect(await openItems(world, run.id)).toEqual(['approve:Raj Patel:RA_A1']);
  });

  it('1f a resubmit that would take the step that rejected it off goes through, and that step still asks (the owner’s decision, round 2)', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      (nodes.RA_A1 as ApproveNode).when = { join: 'all', rows: [{ f: 'total_value', op: '>=', v: 50000 }] };
    });
    const { run, item } = await rejected(world);
    await world.service.resubmit(actor('Grace Kim'), item.id, { total_value: 49000 });
    expect((await dataOf(world, 'WO-2231')).total_value).toBe(49000);
    expect(await openItems(world, run.id)).toEqual(['approve:Raj Patel:RA_A1']);
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('waiting');
  });

  it('1g provide-field takes a value of the field’s own type, for that field only', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { rate_vs_card_pct: null });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const item = await world.itemFor(run.id, 'Owen Clarke', 'needs_information');
    expect(await codeOf(world.service.provideField(actor('Owen Clarke'), item.id, 'rate_vs_card_pct', { a: 1 }))).toBe('INVALID_VALUE');
    expect(await codeOf(world.service.provideField(actor('Owen Clarke'), item.id, 'rate_vs_card_pct', 'twelve'))).toBe('INVALID_VALUE');
    expect(await codeOf(world.service.provideField(actor('Owen Clarke'), item.id, 'requester', 'Owen Clarke'))).toBe('WRONG_FIELD');
    expect(await codeOf(world.service.provideField(actor('Owen Clarke'), item.id, 'rate_vs_card_pct', 12))).toBeNull();
  });

  it('1h provide-field: a requester can’t fill in a blank field that picks the approver, however they came to hold the item', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      (nodes.RA_C1 as { outs: { key: string; rows?: { f: string; op: string; v: unknown }[] }[] }).outs[0].rows = [{ f: 'cost_center', op: 'in', v: ['CC-100'] }];
    });
    const run = await world.start('WO-2231', {}, { cost_center: null });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const item = await world.itemFor(run.id, 'Raj Patel', 'needs_information');
    await world.service.editRecord('work_order', 'WO-2231', { requester: 'Raj Patel' });
    expect(await codeOf(world.service.provideField(actor('Raj Patel'), item.id, 'cost_center', 'CC-100'))).toBe('FIELD_NOT_EDITABLE');
    await world.service.editRecordAs(actor('Samira Khan'), 'work_order', 'WO-2231', { cost_center: 'CC-200' });
    expect((await world.store.workItems.get(item.id))?.status).toBe('done');
  });

  it('1i the record route: an admin edits fields, never what the runtime itself keeps', async () => {
    const world = await createWorld();
    await world.start('WO-2231');
    for (const change of [{ states: ['wo_approved'] }, { prev: { total_value: 1 } }, { conflict: null }, { outcomes: {} }, { changed_fields: ['total_value'] }, { original_total: 1 }]) {
      expect(await codeOf(world.service.editRecordAs(actor('Samira Khan'), 'work_order', 'WO-2231', change))).toBe('FIELD_NOT_EDITABLE');
    }
    expect(await codeOf(world.service.editRecordAs(actor('Samira Khan'), 'work_order', 'WO-2231', { total_value: 'lots' }))).toBe('INVALID_VALUE');
    expect(await codeOf(world.service.editRecordAs(actor('Samira Khan'), 'work_order', 'WO-2231', { site: 'Remote', hiring_manager: 'Sam Patel' }))).toBeNull();
    expect((await dataOf(world, 'WO-2231')).hiring_manager).toBe('Sam Patel');
  });
});

describe('Finding 3: an Approve step is never completed without a real decision', () => {
  it('3a Trigger A: a duplicate event raises the value, and Executive sign-off asks its approvers', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    expect((await world.event('WO-2231', {}, { total_value: 2000000 })).outcome).toBe('duplicate');
    expect((await world.run(run.id)).plan.stages.map((stage) => stage.label)).toContain('Executive sign-off (1 of 2)');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const after = await world.run(run.id);
    expect(after.status).toBe('running');
    expect(after.steps.RA_A4.status).toBe('waiting');
    expect(await openItems(world, run.id)).toEqual(['approve:David Okafor:RA_A4']);
    await decideEveryone(world, run.id);
    const done = await world.run(run.id);
    expect(done.status).toBe('completed');
    expect(done.steps.RA_A4.decisions?.map((decision) => decision.by)).toEqual(['David Okafor', 'Rebecca Stone']);
  });

  it('3b F9 still holds: an event that changes nothing about who approves does not touch the run', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const before = await world.run(run.id);
    await world.event('WO-2231', {}, { site: 'Remote', status_elsewhere: 'cancelled' });
    const after = await world.run(run.id);
    expect(after.rev).toBe(before.rev);
    expect(await openItems(world, run.id)).toEqual(['approve:Raj Patel:RA_A1']);
  });

  const failingWorkday = (ctx: EngineContext): Adapters => {
    const inner = mockAdapters(ctx);
    return { ...inner, system: (name, record) => ({ ...inner.system(name, record), execute: async () => ({ status: 'failed' as const, error: 'boom', retryable: false }) }) };
  };

  const withFailedExit = (nodes: Workflow['draft']['nodes']) => {
    nodes.SYS = {
      id: 'SYS', kind: 'system', label: 'Workday provisioning', system: 'Workday', actions: ['push'], via: '', preset: 'hris',
      outs: [{ key: 'next', to: 'END' }, { key: 'failed', to: 'MAN', label: 'If it failed' }],
      sys: { system: 'Workday', action: 'create', object: 'Contingent worker', match: 'Work email', map: [], read: [], wait: 'none', waitH: 24, state: 'Completed', onFail: 'path', failRole: 'people_ops', retries: 3, check: true },
    } as unknown as Workflow['draft']['nodes'][string];
    nodes.MAN = { id: 'MAN', kind: 'appr', label: 'Finance must sign off the failure', roles: ['fbp'], mode: 'all', authority: false, material: [], reaskOnDecrease: true, sla: 48, reject: 'requester', prechecks: ['brief'], outs: [{ key: 'next', to: 'END' }] } as unknown as Workflow['draft']['nodes'][string];
    (nodes.RA_C2.outs.find((out) => out.key === 'else') as { to: string }).to = 'SYS';
  };

  it('3c Trigger B: a System step’s failed exit leads to an Approve step, and its approver is asked', async () => {
    const world = await createWorld({ adapters: failingWorkday });
    await world.publishEdited('wf-wo-sub', withFailedExit);
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const after = await world.run(run.id);
    expect(after.steps.SYS.outcome).toBe('failed');
    expect(after.steps.MAN.status).toBe('waiting');
    expect(after.status).toBe('running');
    expect((await openItems(world, run.id))).toEqual(['approve:Chloe Martin:MAN']);
    await decideEveryone(world, run.id);
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('3d a later edit keeps the path the run actually took: the failed exit is not forgotten', async () => {
    const world = await createWorld({ adapters: failingWorkday });
    await world.publishEdited('wf-wo-sub', withFailedExit);
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    await world.service.editRecord('work_order', 'WO-2231', { site: 'Remote' });
    const after = await world.run(run.id);
    expect(after.steps.MAN.status).toBe('waiting');
    expect(await openItems(world, run.id)).toEqual(['approve:Chloe Martin:MAN']);
  });

  it('3e a covering decision has to be a real one: covered waits for its coverer, and same-role steps count', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      nodes.P = { id: 'P', kind: 'parallel', label: 'Both', outs: [{ key: 'a', to: 'A', label: 'A' }, { key: 'b', to: 'B', label: 'B' }] } as unknown as Workflow['draft']['nodes'][string];
      nodes.A = { id: 'A', kind: 'appr', label: 'First', roles: ['fbp'], mode: 'all', authority: false, material: [], reaskOnDecrease: true, sla: 48, reject: 'requester', outs: [{ key: 'next', to: 'END' }] } as unknown as Workflow['draft']['nodes'][string];
      nodes.B = { id: 'B', kind: 'appr', label: 'Second', roles: ['fbp'], mode: 'all', authority: false, material: [], reaskOnDecrease: true, sla: 48, reject: 'requester', outs: [{ key: 'next', to: 'END' }] } as unknown as Workflow['draft']['nodes'][string];
      (nodes.T.outs as { to: string }[])[0].to = 'P';
    });
    const run = await world.start('WO-2231');
    const mid = await world.run(run.id);
    expect(mid.steps.A.status).toBe('waiting');
    expect(mid.steps.B.status).toBe('waiting');
    expect(mid.steps.B.outcome).toBeUndefined();
    expect(mid.status).toBe('running');
    await decideEveryone(world, run.id);
    const after = await world.run(run.id);
    expect(after.steps.B.status).toBe('done');
    expect(after.status).toBe('completed');
  });
});

describe('Findings 4 to 7: re-planning reopens what a change makes necessary', () => {
  const optionalReview = (nodes: Workflow['draft']['nodes']) => {
    nodes.COND = { id: 'COND', kind: 'appr', label: 'Large value review', roles: ['legal'], mode: 'all', authority: false, material: ['total_value'], reaskOnDecrease: true, sla: 48, reject: 'requester', prechecks: ['brief'], when: { join: 'all', rows: [{ f: 'total_value', op: '>=', v: 500000 }] }, outs: [{ key: 'next', to: 'RA_A1' }] } as unknown as Workflow['draft']['nodes'][string];
    (nodes.RA_CD.outs.find((out) => out.key === 'pass') as { to: string }).to = 'COND';
  };

  it('4 an Approve step skipped as not needed is asked once an edit makes it needed', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', optionalReview);
    const run = await world.start('WO-2231');
    expect((await world.run(run.id)).steps.COND.status).toBe('skipped');
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 800000 });
    const mid = await world.run(run.id);
    expect(mid.steps.COND.status).toBe('waiting');
    expect(await openItems(world, run.id)).toContain('approve:Luis Romero:COND');
    await decideEveryone(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.COND.decisions?.map((decision) => decision.by)).toEqual(['Luis Romero']);
  });

  it('4b the reverse: when it stops being needed again it goes quiet, and nothing waits on it', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', optionalReview);
    const run = await world.start('WO-2231');
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 800000 });
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 90000 });
    const after = await world.run(run.id);
    expect(after.steps.COND.status).toBe('skipped');
    expect(await openItems(world, run.id)).toEqual(['approve:Raj Patel:RA_A1']);
    expect((await world.outbox({ runId: run.id })).some((message) => message.to === 'Luis Romero' && message.subject.startsWith('No longer needed'))).toBe(true);
  });

  it('4c what follows a reopened step is held and survives a second edit', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', optionalReview);
    const run = await world.start('WO-2231');
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 800000 });
    const raj = await world.itemFor(run.id, 'Raj Patel');
    await world.service.editRecord('work_order', 'WO-2231', { site: 'Remote' });
    const mid = await world.run(run.id);
    expect(mid.steps.RA_A1.status).toBe('waiting');
    expect(mid.steps.RA_A1.outcome).not.toBe('off_path');
    expect((await world.store.workItems.get(raj.id))?.status).toBe('open');
    await decideEveryone(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.RW.status).toBe('done');
    expect(after.steps.END.status).toBe('done');
  });

  it('5 a rule approver who joins a finished round is asked, and the answer already given stands', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { rate_vs_card_pct: 20 });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('done');
    await world.service.editRecord('work_order', 'WO-2231', { data_access: true });
    const mid = await world.run(run.id);
    expect(mid.steps.RA_A1.status).toBe('waiting');
    expect(await openItems(world, run.id)).toEqual(expect.arrayContaining(['approve:Ravi Kumar:RA_A1', 'approve:Fatima Zahra:RA_A1', 'approve:Owen Clarke:RA_A2']));
    expect((await openItems(world, run.id)).some((line) => line.startsWith('approve:Raj Patel'))).toBe(false);
    await decideEveryone(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.RA_A1.decisions?.map((decision) => decision.by).sort()).toEqual(['Fatima Zahra', 'Raj Patel', 'Ravi Kumar']);
  });

  const onlyTask = (nodes: Workflow['draft']['nodes']) => ({
    T: { ...nodes.T, outs: [{ key: 'next', to: 'TK' }] },
    TK: { id: 'TK', kind: 'task', label: 'Do it', role: 'people_ops', title: 'Do it', outs: [{ key: 'next', to: 'END' }] },
    END: nodes.END,
  }) as unknown as Workflow['draft']['nodes'];

  it('6a a rule-only round added while the last step waits is asked before the run ends', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', onlyTask);
    const run = await world.start('WO-2231');
    await world.service.editRecord('work_order', 'WO-2231', { data_access: true });
    await world.done((await world.itemFor(run.id, 'Jordan Lee')).id, 'Jordan Lee');
    const mid = await world.run(run.id);
    expect(mid.status).toBe('running');
    expect((await openItems(world, run.id)).map((line) => line.split(':')[1]).sort()).toEqual(['Fatima Zahra', 'Ravi Kumar']);
    await decideEveryone(world, run.id);
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('6b Start straight to End with a matching rule still asks the rule’s approvers', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'END' }] }, END: nodes.END }) as unknown as Workflow['draft']['nodes']);
    const run = await world.start('WO-2231', {}, { data_access: true });
    expect(run.status).toBe('running');
    expect((await openItems(world, run.id)).map((line) => line.split(':')[1]).sort()).toEqual(['Fatima Zahra', 'Ravi Kumar']);
    await decideEveryone(world, run.id);
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('6c a rule-only round that goes away tells its approvers', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', onlyTask);
    const run = await world.start('WO-2231', {}, { data_access: true });
    await world.service.editRecord('work_order', 'WO-2231', { data_access: false });
    const told = (await world.outbox({ runId: run.id })).filter((message) => message.subject.startsWith('No longer needed'));
    expect(told.map((message) => message.to).sort()).toEqual(['Fatima Zahra', 'Ravi Kumar']);
  });

  it('7a in order: an edit to a material field goes back to the first round', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { total_value: 1100000 });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const rebeccaFirst = await (async () => {
      await world.decide((await world.itemFor(run.id, 'David Okafor')).id, 'David Okafor', 'approved');
      return world.itemFor(run.id, 'Rebecca Stone');
    })();
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 1500000 });
    const mid = await world.run(run.id);
    expect(mid.steps.RA_A4.round).toBe(0);
    expect(mid.steps.RA_A4.approvals).toBeUndefined();
    expect(await openItems(world, run.id)).toEqual(expect.arrayContaining(['approve:Raj Patel:RA_A1', 'approve:David Okafor:RA_A4']));
    expect((await world.store.workItems.get(rebeccaFirst.id))?.status).toBe('cancelled');
    await decideEveryone(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.RA_A4.decisions?.filter((decision) => decision.decision === 'approved').map((decision) => decision.by)).toEqual(['David Okafor', 'David Okafor', 'Rebecca Stone']);
  });

  it('7b the edit a step depends on, going down with reaskOnDecrease off, stands (03 §8.4)', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      (nodes.RA_A4 as { reaskOnDecrease?: boolean }).reaskOnDecrease = false;
    });
    const run = await world.start('WO-2231', {}, { total_value: 1500000 });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    await world.decide((await world.itemFor(run.id, 'David Okafor')).id, 'David Okafor', 'approved');
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 1400000 });
    const after = await world.run(run.id);
    expect(after.steps.RA_A4.round).toBe(1);
    expect((await openItems(world, run.id))).toContain('approve:Rebecca Stone:RA_A4');
  });

  it('7c a rule approver’s answer is not undone by an edit to the step’s material field', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { data_access: true });
    await world.decide((await world.itemFor(run.id, 'Ravi Kumar')).id, 'Ravi Kumar', 'approved');
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 96000 });
    expect((await openItems(world, run.id)).some((line) => line.startsWith('approve:Ravi Kumar'))).toBe(false);
    expect((await openItems(world, run.id))).toContain('approve:Raj Patel:RA_A1');
  });
});

describe('Finding 8: a draft save changes nothing that runs until it is approved', () => {
  it('8a saving records and event on a live workflow does not reroute real events', async () => {
    const world = await createWorld();
    const found = await world.store.workflows.get('wf-ending');
    await world.store.workflows.saveDraft('wf-ending', { ...(found?.workflow as Workflow), records: ['work_order'], event: 'submitted' }, found?.draftRev as number, 'Owen Clarke');
    const result = await world.event('WO-2231');
    expect((await world.run(result.runIds[0])).workflowId).toBe('wf-wo-sub');
  });

  it('8b nor does it take a workflow out of what it was published for', async () => {
    const world = await createWorld();
    const found = await world.store.workflows.get('wf-wo-sub');
    await world.store.workflows.saveDraft('wf-wo-sub', { ...(found?.workflow as Workflow), event: 'changed', source: 'fieldglass' }, found?.draftRev as number, 'Owen Clarke');
    const result = await world.event('WO-2231');
    expect(result.outcome).toBe('started');
    expect((await world.run(result.runIds[0])).workflowId).toBe('wf-wo-sub');
  });

  it('8c a pinned run reads its version: a draft event, basis or owner does not reach it', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { data_access: true });
    const found = await world.store.workflows.get('wf-wo-sub');
    await world.store.workflows.saveDraft('wf-wo-sub', { ...(found?.workflow as Workflow), event: 'changed', owner: 'Nobody', onReject: { recipients: [] } }, found?.draftRev as number, 'Owen Clarke');
    await world.service.editRecord('work_order', 'WO-2231', { site: 'Remote' });
    const after = await world.run(run.id);
    expect(after.plan.rules.map((rule) => rule.id).length).toBeGreaterThan(0);
    expect(await openItems(world, run.id)).toEqual(expect.arrayContaining(['approve:Ravi Kumar:RA_A1', 'approve:Fatima Zahra:RA_A1']));
    expect((await world.pause(run, { by: 'Owen Clarke' })).ok).toBe(true);
  });

  it('8d after approval it does take effect: the version carries records and event', async () => {
    const world = await createWorld();
    const found = await world.store.workflows.get('wf-ending');
    const edited = { ...(found?.workflow as Workflow), records: ['work_order'], event: 'submitted', scope: { business_unit: ['Operations'] } };
    await world.store.workflows.saveDraft('wf-ending', edited as Workflow, found?.draftRev as number, 'Owen Clarke');
    await world.publishEdited('wf-ending', () => undefined);
    const version = (await world.store.workflows.get('wf-ending'))?.versions.at(-1) as unknown as { records: string[]; event: string };
    expect(version.records).toEqual(['work_order']);
    expect(version.event).toBe('submitted');
    const result = await world.event('WO-2231');
    expect((await world.run(result.runIds[0])).workflowId).toBe('wf-ending');
  });

  it('8e selectWorkflow on the live context reads the published record and event, while Test runs the draft', async () => {
    const world = await createWorld();
    const found = await world.store.workflows.get('wf-ending');
    await world.store.workflows.saveDraft('wf-ending', { ...(found?.workflow as Workflow), records: ['work_order'], event: 'submitted' }, found?.draftRev as number, 'Owen Clarke');
    const ctx = await contextOf(world);
    const selected = selectWorkflow({ ...recordOf('WO-2231'), record: 'work_order', event: 'submitted' }, ctx.workflows);
    expect(selected.workflow?.id).toBe('wf-wo-sub');
    const draft = ctx.workflows.find((workflow) => workflow.id === 'wf-ending') as Workflow;
    expect(draft.event).toBe('submitted');
    expect(planApprovals(draft, recordOf('WO-2231') as unknown as RecordData, ctx).walk.seen).toContain('K1');
  });

  it('8f the draft shows as unpublished when any published setting differs', async () => {
    const world = await createWorld();
    const { hasUnpublishedChanges } = await import('../../src/flow-studio/engine/publish');
    const found = (await world.store.workflows.get('wf-wo-sub'))?.workflow as Workflow;
    expect(hasUnpublishedChanges(found)).toBe(false);
    for (const change of [{ owner: 'Someone' }, { event: 'changed' }, { records: ['sow'] }, { source: 'fieldglass' }, { days: 9 }, { basis: 'change' }, { onReject: { recipients: [] } }]) {
      expect(hasUnpublishedChanges({ ...found, ...change } as Workflow)).toBe(true);
    }
  });

  it('8g findOverlaps compares with the other workflow as published, not its draft', async () => {
    const world = await createWorld();
    const other = (await world.store.workflows.get('wf-wo-sub-wo-uk-tech'))?.workflow as Workflow;
    const history = await world.store.records.history();
    const sample = history.find((record) => record.record === 'work_order' && record.event === 'submitted' && record.country === 'UK' && record.business_unit === 'Technology') as { job_family?: string };
    const probe = { ...other, id: 'probe', status: 'draft', scope: { job_family: [sample.job_family] }, versions: undefined, published: null } as unknown as Workflow;
    const before = findOverlaps(probe, await contextOf(world)).map((overlap) => overlap.id);
    expect(before).toContain(other.id);
    await world.store.workflows.saveDraft(other.id, { ...other, event: 'changed', scope: { country: ['Germany'] } }, (await world.store.workflows.get(other.id))?.draftRev as number, 'Owen Clarke');
    expect(findOverlaps(probe, await contextOf(world)).map((overlap) => overlap.id)).toEqual(before);
  });

  it('8h Run workflow starts its target’s published record and event', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes, ctx) => {
      nodes.RUN = { id: 'RUN', kind: 'runwf', label: 'Start ending', target: 'wf-ending', outs: [{ key: 'next', to: 'END' }] } as unknown as Workflow['draft']['nodes'][string];
      (nodes.RA_C2.outs.find((out) => out.key === 'else') as { to: string }).to = 'RUN';
      void ctx;
    });
    const target = (await world.store.workflows.get('wf-ending'))?.workflow as Workflow;
    await world.store.workflows.saveDraft('wf-ending', { ...target, event: 'submitted', records: ['sow'] }, (await world.store.workflows.get('wf-ending'))?.draftRev as number, 'Owen Clarke');
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const raised = (await world.store.inbound.findByRecord('WO-2231')).filter((event) => event.source === 'levv' && event.recordType !== 'work_order');
    expect(raised.map((event) => [event.recordType, event.event])).toEqual([[target.records[0], target.event]]);
  });

  it('8i the runs list names the version the run is on', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const found = (await world.store.workflows.get('wf-wo-sub'))?.workflow as Workflow;
    await world.store.workflows.saveDraft('wf-wo-sub', { ...found, name: 'Renamed in draft' }, (await world.store.workflows.get('wf-wo-sub'))?.draftRev as number, 'Owen Clarke');
    const [listed] = (await world.store.runs.list({ recordId: 'WO-2231' })).filter((summary) => summary.id === run.id);
    expect(listed.workflowName).toBe('Work order submitted');
  });
});

describe('Finding 9: while paused, the first answer still wins', () => {
  it('a rejection while paused stands when someone else then answers', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      (nodes.RA_A1 as { roles: string[]; mode: string }).roles = ['fbp', 'proc'];
      (nodes.RA_A1 as { roles: string[]; mode: string }).mode = 'any';
    });
    const run = await world.start('WO-2231');
    const owen = await world.itemFor(run.id, 'Owen Clarke');
    await world.pause(run, { by: 'Samira Khan' });
    expect((await world.decide((await world.itemFor(run.id, 'Chloe Martin')).id, 'Chloe Martin', 'rejected', 'No way')).ok).toBe(true);
    expect((await world.run(run.id)).steps.RA_A1.deferred).toBeDefined();
    expect(await world.decide(owen.id, 'Owen Clarke', 'approved')).toMatchObject({ ok: false, code: 'RUN_STOPPED' });
    await world.resume(run, { by: 'Samira Khan' });
    const after = await world.run(run.id);
    expect(after.status).toBe('running');
    expect(after.steps.RA_A1.resubmit).toBeDefined();
    expect(await openItems(world, run.id)).toEqual(['resubmit:Grace Kim:RA_A1']);
    expect(after.steps.RW.status).toBe('pending');
  });

  it('the same answers on a running run end the same way', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      (nodes.RA_A1 as { roles: string[]; mode: string }).roles = ['fbp', 'proc'];
      (nodes.RA_A1 as { roles: string[]; mode: string }).mode = 'any';
    });
    const run = await world.start('WO-2231');
    const owen = await world.itemFor(run.id, 'Owen Clarke');
    await world.decide((await world.itemFor(run.id, 'Chloe Martin')).id, 'Chloe Martin', 'rejected', 'No way');
    expect(await world.decide(owen.id, 'Owen Clarke', 'approved')).toMatchObject({ ok: false, code: 'RUN_STOPPED' });
    expect(await openItems(world, run.id)).toEqual(['resubmit:Grace Kim:RA_A1']);
  });

  it('a Chaser copy rejected while paused holds its step the same way', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.advanceTo(hoursAfter(49));
    const copyItem = (await world.items(run.id)).find((item) => item.chaserOf && item.status === 'open');
    await world.pause(run, { by: 'Samira Khan' });
    expect((await world.decide(copyItem?.id as string, copyItem?.assignee as string, 'rejected', 'No')).ok).toBe(true);
    const raj = await world.itemFor(run.id, 'Raj Patel').catch(() => null);
    expect(raj).toBeNull();
  });
});

describe('Finding 10: a Chaser copy goes with its original', () => {
  it('withdrawing an approver withdraws the copy, so the copy cannot satisfy the role', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { hiring_manager: 'Tom Reed', business_unit: 'Technology' });
    await world.advanceTo(hoursAfter(49));
    const copies = (await world.items(run.id)).filter((item) => item.chaserOf && item.status === 'open');
    expect(copies.length).toBeGreaterThan(0);
    const tomsCopy = copies.find((item) => item.stepName?.includes('Tom Reed')) as NonNullable<(typeof copies)[number]>;
    await world.service.editRecord('work_order', 'WO-2231', { hiring_manager: 'Omar Haddad' });
    expect((await world.store.workItems.get(tomsCopy.id))?.status).toBe('cancelled');
    expect(await world.decide(tomsCopy.id, tomsCopy.assignee, 'approved')).toMatchObject({ ok: false, code: 'RUN_STOPPED' });
    expect((await world.run(run.id)).steps.RA_A1.approvals?.hm).toBeUndefined();
    expect((await world.outbox({ runId: run.id })).some((message) => message.to === tomsCopy.assignee && message.subject.startsWith('No longer needed'))).toBe(true);
  });

  it('a copy of someone still asked stays and still answers', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.advanceTo(hoursAfter(49));
    const copyItem = (await world.items(run.id)).find((item) => item.chaserOf && item.status === 'open') as NonNullable<Awaited<ReturnType<World['items']>>[number]>;
    await world.service.editRecord('work_order', 'WO-2231', { site: 'Remote' });
    expect((await world.store.workItems.get(copyItem.id))?.status).toBe('open');
    expect((await world.decide(copyItem.id, copyItem.assignee, 'approved')).ok).toBe(true);
    expect((await world.run(run.id)).status).toBe('completed');
  });
});

describe('Finding 11: the worker never approves, reviews or is escalated to (AGENTS rule 4)', () => {
  it('11a the plan moves off the worker, and a run asks who Test shows', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { worker_name: 'Raj Patel' });
    const open = await openItems(world, run.id);
    expect(open.some((line) => line.includes('Raj Patel'))).toBe(false);
    const ctx = await contextOf(world);
    const wf = ctx.workflows.find((workflow) => workflow.id === 'wf-wo-sub') as Workflow;
    const rec = { ...recordOf('WO-2231'), worker_name: 'Raj Patel' } as unknown as RecordData;
    const plan = planApprovals(wf, rec, ctx);
    const people = plan.stages.flatMap((stage) => stage.items.flatMap((item) => item.people));
    expect(people).not.toContain('Raj Patel');
    expect(open.map((line) => line.split(':')[1]).every((person) => people.includes(person))).toBe(true);
    const test = simulateTest(wf, { ...rec, id: 'WO-2231' } as never, ctx);
    expect(JSON.stringify(test.plan?.stages.map((stage) => stage.items.map((item) => item.people)))).toBe(JSON.stringify(plan.stages.map((stage) => stage.items.map((item) => item.people))));
  });

  it('11b a specialist who is the worker moves to the backup, or pauses', async () => {
    const world = await createWorld();
    const ctx = await contextOf(world);
    const wf = structuredClone(ctx.workflows.find((workflow) => workflow.id === 'wf-wo-sub') as Workflow);
    wf.draft.nodes.RA_A1 = { ...wf.draft.nodes.RA_A1, roles: ['sec'] } as typeof wf.draft.nodes.RA_A1;
    const holder = planApprovals(wf, { ...recordOf('WO-2231') } as unknown as RecordData, ctx).stages[0].items[0].people[0];
    const moved = planApprovals(wf, { ...recordOf('WO-2231'), worker_name: holder } as unknown as RecordData, ctx).stages[0].items[0];
    expect(moved.people).not.toContain(holder);
    expect(moved.paused || moved.people[0] !== '—').toBe(true);
  });

  it('11c a group never asks the worker, and an any-one item drops them', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      (nodes.RA_A1 as { roles: string[]; mode: string }).roles = ['fbp', 'proc'];
      (nodes.RA_A1 as { roles: string[]; mode: string }).mode = 'any';
    });
    const run = await world.start('WO-2231', {}, { worker_name: 'Chloe Martin' });
    const open = await openItems(world, run.id);
    expect(open).toEqual(['approve:Owen Clarke:RA_A1']);
  });

  it('11d at decision: an item already open is refused once its assignee is the worker', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const item = await world.itemFor(run.id, 'Raj Patel');
    const data = await dataOf(world, 'WO-2231');
    const dataRev = ((await world.store.rawGet('records', 'WO-2231'))?.doc as { dataRev: number }).dataRev;
    await world.store.tx([{ op: 'patch', collection: 'records', id: 'WO-2231', set: { data: { ...data, worker_name: 'Raj Patel' } }, expect: { dataRev } }]);
    expect(await world.decide(item.id, 'Raj Patel', 'approved')).toMatchObject({ ok: false, code: 'WORKER_CANNOT_DECIDE' });
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('waiting');
  });

  it('11e the Chaser never lands on the worker, by manager', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { worker_name: 'Nadia Rahman' });
    await world.advanceTo(hoursAfter(49));
    const copies = (await world.items(run.id)).filter((item) => item.chaserOf);
    expect(copies.length).toBeGreaterThan(0);
    expect(copies.map((item) => item.assignee)).not.toContain('Nadia Rahman');
  });

  it('11f nor by “the hiring manager”, the other place it looks', async () => {
    const world = await createWorld({ autocomplete: false });
    const run = await world.start('WO-2214-A', {}, { hiring_manager: 'Tom Reed', worker_name: 'Tom Reed' });
    expect((await world.items(run.id)).some((item) => item.kind === 'collect' && item.status === 'open')).toBe(true);
    await world.advanceTo(hoursAfter(10 * 24));
    const escalated = (await world.run(run.id)).log.filter((line) => line.type === 'escalated').map((line) => line.m);
    expect(escalated.filter((line) => line.includes('Tom Reed'))).toEqual([]);
    expect((await world.items(run.id)).filter((item) => item.chaserOf).map((item) => item.assignee)).not.toContain('Tom Reed');
  });

  it('11g a reviewer who is the worker is not asked to review: their manager is', async () => {
    const world = await createWorld();
    let id = '';
    await world.publishEdited('wf-onboard', (nodes) => {
      const collect = Object.values(nodes).find((node) => node.kind === 'collect') as unknown as { id: string; verify: string; reviewer: string };
      collect.verify = 'person';
      collect.reviewer = 'hrbp';
      id = collect.id;
    });
    const run = await world.start('WO-2214-A');
    const before = (await world.items(run.id)).find((item) => item.kind === 'collect_review' && item.nodeId === id);
    expect(before).toBeDefined();
    const reviewer = before?.assignee as string;
    const second = await world.start('WO-2214-A', { recordId: 'WO-2214-B' }, { worker_name: reviewer });
    const moved = (await world.items(second.id)).find((item) => item.kind === 'collect_review' && item.nodeId === id);
    expect(moved?.assignee).not.toBe(reviewer);
  });

  it('11h a seeded record’s Test output does not change: seeded workers are not approvers', async () => {
    const ctx = makeContext();
    const people = new Set(ctx.people.PEOPLE);
    for (const sample of [...ctx.samples, ...ctx.history]) expect(people.has((sample as { worker_name?: string }).worker_name as string)).toBe(false);
  });
});

/** Fails the next transaction that has a write matching `when`, once, the way a crash or lost connection would. */
function flaky(inner: StoreDriver, when: (writes: StoreWrite[]) => boolean): StoreDriver & { armed: boolean } {
  const driver = {
    ...inner,
    armed: true,
    async tx(writes: StoreWrite[]) {
      if (driver.armed && when(writes)) {
        driver.armed = false;
        throw new Error('store went away');
      }
      return inner.tx(writes);
    },
  };
  return driver;
}

const newMemory = () => {
  const state = { tables: emptyTables() };
  return createMemoryDriver(state, { now: () => '2026-10-20T09:00:00Z', actingUsers: () => actorSets.default.users.map(({ name, permissions }) => ({ name, permissions })) });
};

describe('Finding 12: an event and its data are stored together', () => {
  it('12a a failure on the way in leaves neither, so the sender’s retry starts clean', async () => {
    const driver = flaky(newMemory(), (writes) => writes.some((write) => write.collection === 'records' && (write as { id: string }).id === 'WO-2231'));
    const world = await createWorld({ driver });
    driver.armed = true;
    await expect(world.event('WO-2231')).rejects.toThrow('store went away');
    expect(await world.store.inbound.findByRecord('WO-2231')).toEqual([]);
    expect(await world.store.rawGet('records', 'WO-2231')).toBeNull();
    expect((await world.event('WO-2231')).outcome).toBe('started');
  });

  it('12b the merge and the row go in one transaction', async () => {
    const seen: StoreWrite[][] = [];
    const memory = newMemory();
    const world = await createWorld({ driver: { ...memory, tx: (writes) => { seen.push(writes); return memory.tx(writes); } } });
    seen.length = 0;
    await world.event('WO-2231');
    const first = seen[0].map((write) => write.collection);
    expect(first).toContain('inbound');
    expect(first).toContain('records');
  });

  it('12c a date moved by an event commits with the event, on every open run', async () => {
    const world = await createWorld({ autocomplete: true });
    const run = await world.start('WO-2214-A');
    const seen: StoreWrite[][] = [];
    const original = world.store.tx;
    world.store.tx = (writes) => { seen.push(writes); return original(writes); };
    const before = (await world.run(run.id)).steps;
    expect(Object.keys(before).length).toBeGreaterThan(0);
    await world.service.intake({ source: 'levv', recordType: 'onboarding', recordId: 'WO-2214-A', event: 'ob_start', data: { start_date: '2027-01-11' } });
    const together = seen.find((writes) => writes.some((write) => write.collection === 'inbound') && writes.some((write) => write.collection === 'records'));
    expect(together?.map((write) => write.collection)).toContain('runs');
  });

  it('12d pollSource: the same as intake, and a poll that sees an event twice adds it once', async () => {
    const driver = flaky(newMemory(), (writes) => writes.some((write) => write.collection === 'records' && (write as { id: string }).id === 'WO-POLL'));
    const world = await createWorld({ driver });
    const record = recordOf('WO-2240');
    const polled = { source: 'fieldglass', recordType: record.record, recordId: 'WO-POLL', event: record.event, data: { ...record, id: 'WO-POLL' } };
    const source = { poll: async () => [polled] } as never;
    driver.armed = true;
    await expect(world.service.pollSource(source, '2026-10-20T00:00:00Z')).rejects.toThrow('store went away');
    expect(await world.store.rawGet('records', 'WO-POLL')).toBeNull();
    expect(await world.store.inbound.findByRecord('WO-POLL')).toEqual([]);
    expect(await world.service.pollSource(source, '2026-10-20T00:00:00Z')).toBe(1);
    expect(await world.service.pollSource(source, '2026-10-20T00:00:00Z')).toBe(0);
    expect((await world.store.inbound.findByRecord('WO-POLL'))).toHaveLength(1);
    expect(((await dataOf(world, 'WO-POLL')).title)).toBe(record.title);
  });

  it('12e a failure after the commit is picked up: a queued event still starts on the next tick', async () => {
    const memory = newMemory();
    let fail = false;
    const world = await createWorld({ driver: { ...memory, tx: (writes) => {
      if (fail && writes.some((write) => write.collection === 'runs')) { fail = false; throw new Error('store went away'); }
      return memory.tx(writes);
    } } });
    fail = true;
    await expect(world.event('WO-2231')).rejects.toThrow('store went away');
    const [event] = await world.store.inbound.findByRecord('WO-2231');
    expect(event.outcome).toBe('queued');
    expect(((await dataOf(world, 'WO-2231')).total_value)).toBe(95000);
    await world.tick();
    const [after] = await world.store.inbound.findByRecord('WO-2231');
    expect(after.outcome).toBe('started');
  });
});

describe('Finding 13: overlaps are checked again when a change is approved', () => {
  async function twoDrafts(world: World) {
    const a = (await world.store.workflows.get('wf-wo-sub-wo-data'))?.workflow as Workflow;
    const created = await world.store.workflows.create({ fromWorkflowId: 'wf-wo-sub-wo-data' }, 'Owen Clarke');
    const b = (await world.store.workflows.get(created.id))?.workflow as Workflow;
    await world.store.workflows.saveDraft(b.id, { ...b, name: 'Other', scope: { country: ['Canada'] } }, (await world.store.workflows.get(b.id))?.draftRev as number, 'Owen Clarke');
    await world.store.workflows.saveDraft(a.id, { ...a, scope: { business_unit: ['Finance'] } }, (await world.store.workflows.get(a.id))?.draftRev as number, 'Owen Clarke');
    const send = async (id: string) => {
      const ctx = await contextOf(world);
      const wf = ctx.workflows.find((candidate) => candidate.id === id) as Workflow;
      const review = publishReview(wf, ctx);
      const sent = sendForApproval(wf, ctx, { author: 'Owen Clarke', effective: world.clock.asOf() });
      if (sent.ok === false) throw new Error(sent.message);
      const snapshot = { ...wf };
      delete snapshot.versions;
      return world.store.publishRequests.create({ workflowId: id, snapshot, goLive: world.clock.asOf(), precedence: [], review, requestedBy: 'Owen Clarke' }, sent.workflow.pending as NonNullable<Workflow['pending']>, ['Samira Khan']);
    };
    return { first: await send(a.id), second: await send(b.id), aId: a.id, bId: b.id };
  }

  it('the second approval is refused rather than creating an unresolved overlap', async () => {
    const world = await createWorld();
    const { first, second, aId, bId } = await twoDrafts(world);
    await world.store.workflows.publishVersion(aId, first, 'Samira Khan');
    const code = await codeOf(world.store.workflows.publishVersion(bId, second, 'Samira Khan'));
    expect(code).toBe('OVERLAP_OPEN');
    const stored = (await world.store.workflows.get(bId))?.workflow as Workflow;
    expect(stored.status).toBe('draft');
    expect(stored.pending).not.toBeNull();
    expect((await world.store.publishRequests.get(second.id))?.status).toBe('pending');
  });

  it('a choice made when sending lets it through, and the priorities follow', async () => {
    const world = await createWorld();
    const { first, second, aId, bId } = await twoDrafts(world);
    await world.store.workflows.publishVersion(aId, first, 'Samira Khan');
    const pendingWith = { ...second, precedence: [{ otherId: aId, winner: 'self' as const }] };
    const found = (await world.store.workflows.get(bId)) as NonNullable<Awaited<ReturnType<World['store']['workflows']['get']>>>;
    await world.store.tx([{ op: 'patch', collection: 'workflows', id: bId, set: { pending: { ...(found.workflow.pending as object), precedence: pendingWith.precedence } } }]);
    await world.store.workflows.publishVersion(bId, pendingWith, 'Samira Khan');
    const stored = await world.store.workflows.all();
    expect(stored.find((workflow) => workflow.id === bId)?.priority).toBe(1);
    expect(stored.find((workflow) => workflow.id === aId)?.priority).toBe(2);
  });

  it('two approvals at once cannot both pass: each transaction checks the other has not moved', async () => {
    const world = await createWorld();
    const { first, second, aId, bId } = await twoDrafts(world);
    const answers = await Promise.allSettled([world.store.workflows.publishVersion(aId, first, 'Samira Khan'), world.store.workflows.publishVersion(bId, second, 'Samira Khan')]);
    expect(answers.filter((answer) => answer.status === 'fulfilled')).toHaveLength(1);
  });

  it('the engine says the same on its own', async () => {
    const world = await createWorld();
    const { first, aId, bId } = await twoDrafts(world);
    await world.store.workflows.publishVersion(aId, first, 'Samira Khan');
    const ctx = await contextOf(world);
    const wf = ctx.workflows.find((candidate) => candidate.id === bId) as Workflow;
    expect(approvePublish(wf, { name: 'Samira Khan', permissions: ['admin'] }, ctx).ok).toBe(false);
  });
});

describe('Finding 14: guards around publishing and starting', () => {
  it('14a a switch to Inactive during an approval is not overwritten', async () => {
    const memory = newMemory();
    let world: World | null = null;
    let switched = false;
    world = await createWorld({ driver: { ...memory, tx: async (writes) => {
      if (!switched && world && writes.some((write) => write.collection === 'versions' && write.op === 'insert')) {
        switched = true;
        await world.store.workflows.setActive('wf-wo-sub', false, 'Owen Clarke');
      }
      return memory.tx(writes);
    } } });
    await world.publishEdited('wf-wo-sub', () => undefined);
    expect(switched).toBe(true);
    const stored = (await world.store.workflows.get('wf-wo-sub'))?.workflow as Workflow;
    expect(stored.status).toBe('inactive');
    expect(stored.version).toBe(2);
  });

  it('14b a first publish still takes a draft live', async () => {
    const world = await createWorld();
    const created = await world.store.workflows.create({}, 'Owen Clarke');
    const draft = (await world.store.workflows.get(created.id)) as NonNullable<Awaited<ReturnType<World['store']['workflows']['get']>>>;
    await world.store.workflows.saveDraft(created.id, { ...draft.workflow, scope: { country: ['Germany'] } }, draft.draftRev, 'Owen Clarke');
    await world.publishEdited(created.id, () => undefined);
    expect(((await world.store.workflows.get(created.id))?.workflow as Workflow).status).toBe('live');
  });

  it('14c nothing is sent to a system before the run holds its claim', async () => {
    const memory = newMemory();
    const order: string[] = [];
    const world = await createWorld({
      driver: { ...memory, tx: (writes) => { if (writes.some((write) => write.collection === 'claims')) order.push('claim'); return memory.tx(writes); } },
      adapters: (ctx) => {
        const inner = mockAdapters(ctx);
        return { ...inner, system: (name, record) => ({ ...inner.system(name, record), execute: (req) => { order.push(`call:${req.idempotencyKey}`); return inner.system(name, record).execute(req); } }) };
      },
    });
    const run = await world.start('WO-2214-A');
    expect(order[0]).toBe('claim');
    const calls = order.filter((entry) => entry.startsWith('call:'));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.startsWith(`call:${run.id}:`)).toBe(true);
  });

  it('14d two copies of one event at once call each system once', async () => {
    const calls: string[] = [];
    const world = await createWorld({
      adapters: (ctx) => {
        const inner = mockAdapters(ctx);
        return { ...inner, system: (name, record) => ({ ...inner.system(name, record), execute: (req) => { calls.push(req.idempotencyKey); return inner.system(name, record).execute(req); } }) };
      },
    });
    const answers = await Promise.all([world.event('WO-2214-A'), world.event('WO-2214-A')]);
    expect(answers.filter((answer) => answer.outcome === 'started')).toHaveLength(1);
    expect(new Set(calls).size).toBe(calls.length);
    const started = answers.find((answer) => answer.outcome === 'started') as { runIds: string[] };
    for (const key of calls) expect(key.startsWith(started.runIds[0])).toBe(true);
  });

  it('14e a crash after the claim leaves a run the next tick carries on', async () => {
    const memory = newMemory();
    let fail = false;
    const world = await createWorld({ driver: { ...memory, tx: (writes) => {
      if (fail && writes.some((write) => write.collection === 'runs' && write.op === 'patch')) { fail = false; throw new Error('store went away'); }
      return memory.tx(writes);
    } } });
    fail = true;
    await expect(world.event('WO-2231')).rejects.toThrow('store went away');
    const [event] = await world.store.inbound.findByRecord('WO-2231');
    expect(event.outcome).toBe('started');
    await world.tick();
    const run = await world.run(event.runIds[0]);
    expect(run.steps.T.status).toBe('done');
    expect(run.steps.RA_A1.status).toBe('waiting');
  });
});

describe('Siblings of the findings', () => {
  it('an edit that blanks what a decided If read asks for it, rather than ending the run with no End reached', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { rate_vs_card_pct: 20 });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    await world.service.editRecord('work_order', 'WO-2231', { rate_vs_card_pct: null });
    const after = await world.run(run.id);
    expect(after.status).toBe('running');
    expect(after.steps.RA_C1.status).toBe('waiting');
    expect(await openItems(world, run.id)).toEqual(['needs_information:Owen Clarke:RA_C1']);
    await world.service.provideField(actor('Owen Clarke'), (await world.itemFor(run.id, 'Owen Clarke', 'needs_information')).id, 'rate_vs_card_pct', 2);
    await decideEveryone(world, run.id);
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('a second edit does not take what follows a re-asked step off the line (the run would complete past it)', async () => {
    const world = await createWorld();
    const run = await world.start('ASN-881');
    await world.decide((await world.itemFor(run.id, 'Erin Walsh', 'approve')).id, 'Erin Walsh', 'approved');
    await world.service.editRecord('assignment', 'ASN-881', { months_engaged_after: 17, total_value: 278000, end_date: '2027-03-31' });
    await world.decide((await world.itemFor(run.id, 'Lena Fischer', 'approve')).id, 'Lena Fischer', 'approved');
    await world.service.editRecord('assignment', 'ASN-881', { total_value: 400000 });
    const during = await world.run(run.id);
    expect(during.steps.RA_A2.status).toBe('waiting');
    expect(during.steps.RA_A3.status).toBe('waiting');
    const david = await world.itemFor(run.id, 'David Okafor', 'approve');
    await world.service.editRecord('assignment', 'ASN-881', { site: 'Remote' });
    const after = await world.run(run.id);
    expect(after.steps.RA_A3.status).toBe('waiting');
    expect(after.steps.RA_A3.outcome).toBeUndefined();
    expect((await world.store.workItems.get(david.id))?.status).toBe('open');
  });

  it('a rule’s flag is written when an edit makes the rule match, as it is at the start (03 §7.2 item 3)', async () => {
    const world = await createWorld();
    await world.start('WO-2231');
    await world.service.editRecord('work_order', 'WO-2231', { role_regulated: true });
    expect((await dataOf(world, 'WO-2231')).registration_required).toBe(true);
  });

  it('a value brought back from a system that changes who must approve is re-planned, not missed', async () => {
    const world = await createWorld({
      adapters: (ctx) => {
        const inner = mockAdapters(ctx);
        return { ...inner, system: (name, record) => ({ ...inner.system(name, record), execute: async (req) => ({ ...(await inner.system(name, record).execute(req)), values: { 'Data access': true } }) as never }) };
      },
    });
    await world.publishEdited('wf-wo-sub', (nodes) => {
      (nodes.T.outs as { to: string }[])[0].to = 'SYS';
      nodes.SYS = {
        id: 'SYS', kind: 'system', label: 'Workday provisioning', system: 'Workday', actions: ['push'], via: '', preset: 'hris',
        outs: [{ key: 'next', to: 'END' }],
        sys: { system: 'Workday', action: 'create', object: 'Contingent worker', match: 'Work email', map: [], read: [], wait: 'none', waitH: 24, state: 'Completed', onFail: 'task', failRole: 'people_ops', retries: 3, check: true },
      } as unknown as Workflow['draft']['nodes'][string];
    });
    const run = await world.start('WO-2231');
    expect((await world.run(run.id)).status).toBe('running');
    expect((await openItems(world, run.id)).map((line) => line.split(':')[1]).sort()).toEqual(['Fatima Zahra', 'Ravi Kumar']);
  });

  it('the 7-day prerequisite alert goes to the owner of the version in force, not the draft’s', async () => {
    const world = await createWorld();
    await world.event('INV-8812', {}, { states: [] });
    const [waiting] = await world.store.inbound.findByRecord('INV-8812');
    const found = await world.store.workflows.get(waiting.workflowId as string);
    const owner = found?.workflow.owner as string;
    await world.store.workflows.saveDraft(waiting.workflowId as string, { ...(found?.workflow as Workflow), owner: 'Somebody else' }, found?.draftRev as number, 'Owen Clarke');
    await world.advanceTo(hoursAfter(8 * 24));
    const alerts = (await world.outbox()).filter((message) => message.subject.includes('waiting to start') || message.body.includes('has waited 7 days'));
    expect(alerts.length).toBeGreaterThan(0);
    expect(new Set(alerts.map((message) => message.to))).toEqual(new Set([owner]));
  });

  it('a step the plan can’t account for waits: nobody is approved for want of someone (AGENTS rule 4)', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    // The one way to reach this with today's engine is a plan that doesn't know the step, so the step is one no walk reaches.
    await world.store.tx([{ op: 'patch', collection: 'records', id: 'WO-2231', set: { data: { ...(await dataOf(world, 'WO-2231')), rate_vs_card_pct: 3 } }, expect: { dataRev: ((await world.store.rawGet('records', 'WO-2231'))?.doc as { dataRev: number }).dataRev } }]);
    const { session } = await (world.service as unknown as { load(id: string): Promise<{ session: import('../../src/flow-studio/runtime/session').RunSession }> }).load(run.id);
    const { settleForTest } = await import('../../src/flow-studio/runtime/machine');
    session.env.nodes.GHOST = { id: 'GHOST', kind: 'appr', label: 'Ghost', roles: ['fbp'], mode: 'all', authority: false, material: [], reaskOnDecrease: true, sla: 48, reject: 'requester', outs: [{ key: 'next', to: 'END' }] } as unknown as Workflow['draft']['nodes'][string];
    settleForTest(session, 'GHOST');
    expect(session.run.steps.GHOST.status).toBe('waiting');
    expect(session.run.steps.GHOST.held).toBe(true);
    expect(session.run.steps.GHOST.outcome).toBeUndefined();
    expect(session.run.log.at(-1)?.m).toBe('Paused: Ghost');
  });
});
