import { describe, expect, it } from 'vitest';
import { readRawSeed } from '../../src/flow-studio/data/seed-files';
import type { EngineContext } from '../../src/flow-studio/model/context';
import type { Workflow } from '../../src/flow-studio/model/workflow';
import { mockAdapters } from '../../src/flow-studio/runtime/adapters';
import { ApiError } from '../../src/flow-studio/server/errors';
import { actor, createWorld, hoursAfter, type World } from '../support/runtime-world';

/** The last round of the post-build review. The numbers are the final re-check's. Each failed first on the code before it (bc7ecc2), unless it says it is a control. */

type Nodes = Workflow['draft']['nodes'];
type Node = Nodes[string];

const appr = (id: string, extra: Record<string, unknown> = {}): Node => ({ id, kind: 'appr', label: id, roles: ['fbp'], mode: 'all', authority: false, material: [], reaskOnDecrease: true, sla: 48, reject: 'requester', prechecks: ['brief'], outs: [{ key: 'next', to: 'END' }], ...extra }) as unknown as Node;
const cond = (id: string, rows: unknown[], yes: string, no: string): Node => ({ id, kind: 'cond', label: id, outs: [{ key: 'p1', to: yes, label: 'Yes', join: 'all', rows }, { key: 'else', to: no, label: 'Otherwise' }] }) as unknown as Node;
const system = (id: string, to: string): Node => ({ id, kind: 'system', label: id, system: 'Workday', actions: ['push'], via: '', outs: [{ key: 'next', to }], preset: 'hris', sys: { system: 'Workday', action: 'create', object: 'Contingent worker', match: 'Work email', map: [], read: [], wait: 'none', waitH: 24, state: 'Completed', onFail: 'task', failRole: 'people_ops', retries: 3, check: true } }) as unknown as Node;
const notify = (id: string, to: string): Node => ({ id, kind: 'notify', label: id, recipients: ['fbp'], channel: 'Email', outs: [{ key: 'next', to }] }) as unknown as Node;
const big = [{ f: 'total_value', op: '>=', v: 500000 }];

const open = async (world: World, runId: string): Promise<string[]> => (await world.items(runId)).filter((item) => item.status === 'open').map((item) => `${item.kind}:${item.assignee}:${item.nodeId}`);
const answerAll = async (world: World, runId: string): Promise<void> => {
  for (let i = 0; i < 20; i += 1) {
    const [next] = (await world.items(runId)).filter((item) => item.status === 'open' && ['approve', 'escalation'].includes(item.kind));
    if (!next) return;
    const answer = await world.decide(next.id, next.assignee, 'approved');
    if (!answer.ok) throw new Error(JSON.stringify(answer));
  }
};
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
const rejectAndResubmit = async (world: World, runId: string, who: string, data: Record<string, unknown>): Promise<void> => {
  const item = (await world.items(runId)).find((one) => one.status === 'open' && one.assignee === who && one.kind === 'approve') as { id: string };
  await world.decide(item.id, who, 'rejected', 'No');
  await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(runId, 'Grace Kim', 'resubmit')).id, data);
};

/** A change: an Approve step L that the amount reaches, and that a Yes on terms also reaches. */
const prevGraph = (role: string) => (nodes: Nodes): Nodes => ({
  T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] },
  A: appr('A', { roles: ['proc'], material: ['total_value'], outs: [{ key: 'next', to: 'C1' }] }),
  C1: cond('C1', big, 'L', 'C2'),
  C2: cond('C2', [{ f: 'terms_nonstandard', op: 'yes' }], 'L', 'END'),
  L: appr('L', { roles: [role] }),
  END: nodes.END,
}) as Nodes;
const change = { total_value: 800000, terms_nonstandard: false, prev: { total_value: 100000 }, changed_fields: ['total_value'] };

describe('1: the floor is per step and role, and a resubmit doesn’t move the original', () => {
  for (const role of ['legal', 'g:fin_ctrl', 'g:exco']) {
    it(`1a ${role}: a resubmit can’t make the step read as approved before`, async () => {
      const world = await createWorld();
      await world.publishEdited('wf-wo-sub', prevGraph(role));
      const run = await world.start('WO-2231', {}, change);
      expect((await world.run(run.id)).plan.skipped).toEqual([]);
      await rejectAndResubmit(world, run.id, 'Owen Clarke', { terms_nonstandard: true });
      const mid = await world.run(run.id);
      expect(mid.plan.skipped).toEqual([]);
      expect(mid.plan.stages.map((stage) => stage.label)).toContain('L');
      await answerAll(world, run.id);
      const after = await world.run(run.id);
      expect(after.status).toBe('completed');
      expect(after.steps.L.outcome).toBe('approved');
      expect(after.steps.L.decisions?.length).toBeGreaterThan(0);
    });
  }

  it('1b the other way: a role that truly approved the original stays not asked, whatever the resubmit changes', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', prevGraph('legal'));
    const run = await world.start('WO-2231', {}, { ...change, terms_nonstandard: true });
    expect((await world.run(run.id)).plan.skipped.map((entry) => entry.nodeId)).toEqual(['L']);
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { terms_nonstandard: false });
    expect((await world.run(run.id)).plan.skipped.map((entry) => entry.nodeId)).toEqual(['L']);
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.L.outcome).toBe('not_asked_again');
    expect((await world.items(run.id)).filter((item) => item.nodeId === 'L')).toEqual([]);
  });

  const withLuisElsewhere = (nodes: Nodes): Nodes => {
    const graph = prevGraph('legal')(nodes);
    graph.A = appr('A', { roles: ['proc'], material: ['total_value'], outs: [{ key: 'next', to: 'M' }] });
    graph.M = appr('M', { roles: ['p:Luis Romero'], material: ['total_value'], outs: [{ key: 'next', to: 'C1' }] });
    return graph;
  };

  it('1c Legal’s decision isn’t lost because Luis is also asked for a different kind of decision', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', withLuisElsewhere);
    const run = await world.start('WO-2231', {}, change);
    expect((await world.run(run.id)).plan.stages.map((stage) => stage.label)).toEqual(['A', 'M', 'L']);
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { terms_nonstandard: true });
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.L.decisions?.map((decision) => decision.by)).toEqual(['Luis Romero']);
  });

  it('1d nor when the step goes off the path: the seat is what’s kept, not the person', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', withLuisElsewhere);
    const run = await world.start('WO-2231', {}, change);
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { total_value: 90000 });
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.L.decisions?.map((decision) => decision.by)).toEqual(['Luis Romero']);
  });

  it('1e a group that’s off the path now is kept too', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', prevGraph('g:exco'));
    const run = await world.start('WO-2231', {}, change);
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { total_value: 90000 });
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.L.decisions?.length).toBeGreaterThan(0);
  });

  it('1f a merged role still counts: same person, same kind of decision, on another step (control)', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] }, A: appr('A', { roles: ['proc'], outs: [{ key: 'next', to: 'B' }] }), B: appr('B', { roles: ['proc'] }), END: nodes.END }) as Nodes);
    const run = await world.start('WO-2231');
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { site: 'Remote' });
    expect((await world.run(run.id)).floor?.steps).toEqual([]);
    await answerAll(world, run.id);
    expect((await world.run(run.id)).status).toBe('completed');
  });
});

describe('2: the floor keeps people and rule tasks, and never runs a branch the record no longer selects', () => {
  const recording = () => {
    const calls: { to: string; total: unknown }[] = [];
    const adapters = (ctx: EngineContext) => {
      const inner = mockAdapters(ctx);
      return { ...inner, system: (name: string, record: Parameters<typeof inner.system>[1]) => ({ ...inner.system(name, record), execute: async (request: { idempotencyKey: string }) => { calls.push({ to: request.idempotencyKey.split(':').slice(-1)[0], total: (record as { total_value?: unknown }).total_value }); return { status: 'done' as const, ref: 'R', values: {} }; } }) } as never;
    };
    return { calls, adapters };
  };
  const band = (nodes: Nodes): Nodes => ({
    T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] },
    A: appr('A', { roles: ['proc'], outs: [{ key: 'next', to: 'I' }] }),
    I: cond('I', big, 'X', 'SYS'),
    X: appr('X', { roles: ['cfo'], outs: [{ key: 'next', to: 'SYS2' }] }),
    SYS2: system('SYS2', 'END'),
    SYS: system('SYS', 'N'),
    N: notify('N', 'END'),
    END: nodes.END,
  }) as Nodes;

  it('2a a raise: the If takes only its new exit, so the low-value System and Notify don’t fire', async () => {
    const { calls, adapters } = recording();
    const world = await createWorld({ adapters });
    await world.publishEdited('wf-wo-sub', band);
    const run = await world.start('WO-2231');
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { total_value: 900000 });
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    const mid = await world.run(run.id);
    expect(mid.steps.I.taken).toEqual(['p1']);
    expect(calls).toEqual([]);
    expect(mid.steps.SYS.status).toBe('pending');
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(calls).toEqual([{ to: 'SYS2', total: 900000 }]);
    expect(after.steps.SYS.status).toBe('skipped');
    expect(after.steps.N.status).toBe('skipped');
  });

  it('2b a cut: the old branch’s approver is still asked, its System doesn’t run, and what’s selected waits for them', async () => {
    const { calls, adapters } = recording();
    const world = await createWorld({ adapters });
    await world.publishEdited('wf-wo-sub', band);
    const run = await world.start('WO-2231', {}, { total_value: 800000 });
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { total_value: 90000 });
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    const mid = await world.run(run.id);
    expect(mid.steps.I.taken).toEqual(['else']);
    expect(mid.steps.X.status).toBe('waiting');
    expect(calls).toEqual([]);
    expect(mid.steps.N.status).toBe('pending');
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(calls).toEqual([{ to: 'SYS', total: 90000 }]);
    expect(after.steps.SYS2.status).toBe('skipped');
    expect(after.steps.N.status).toBe('done');
    expect(after.steps.X.decisions?.length).toBeGreaterThan(0);
  });

  it('2c X3: a corrected value doesn’t reach an unrelated rejecting If through an old exit', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => ({
      T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] },
      A: appr('A', { roles: ['proc'], outs: [{ key: 'next', to: 'I' }] }),
      I: cond('I', big, 'L', 'END'),
      L: appr('L', { roles: ['legal'], outs: [{ key: 'next', to: 'I2' }] }),
      I2: cond('I2', [{ f: 'total_value', op: '<', v: 100000 }], 'RJ', 'END'),
      RJ: { id: 'RJ', kind: 'end', label: 'Rejected', outcome: 'rejected', outs: [] },
      END: nodes.END,
    }) as unknown as Nodes);
    const run = await world.start('WO-2231', {}, { total_value: 800000 });
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { total_value: 50000 });
    expect((await world.run(run.id)).plan.rejected).toBeNull();
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.L.decisions?.map((decision) => decision.by)).toEqual(['Luis Romero']);
    expect(after.steps.I2.status).toBe('skipped');
  });

  it('2d a Task on a branch no longer selected isn’t run: it does something, it doesn’t decide', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => ({
      T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] },
      A: appr('A', { roles: ['proc'], outs: [{ key: 'next', to: 'I' }] }),
      I: cond('I', big, 'TK', 'END'),
      TK: { id: 'TK', kind: 'task', label: 'Issue the letter', role: 'people_ops', title: 'Issue the letter', outs: [{ key: 'next', to: 'END' }] },
      END: nodes.END,
    }) as unknown as Nodes);
    const run = await world.start('WO-2231', {}, { total_value: 800000 });
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { total_value: 90000 });
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.TK.status).toBe('skipped');
  });

  it('2e a kept approver who rejects sends it back as ever, and nothing has gone out', async () => {
    const { calls, adapters } = recording();
    const world = await createWorld({ adapters });
    await world.publishEdited('wf-wo-sub', band);
    const run = await world.start('WO-2231', {}, { total_value: 800000 });
    await rejectAndResubmit(world, run.id, 'Owen Clarke', { total_value: 90000 });
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    const cfo = (await world.items(run.id)).find((item) => item.status === 'open' && item.nodeId === 'X') as { id: string; assignee: string };
    await world.decide(cfo.id, cfo.assignee, 'rejected', 'Still no');
    expect(calls).toEqual([]);
    expect(await open(world, run.id)).toEqual(['resubmit:Grace Kim:X']);
  });

  it('2f X2: down, up, down keeps everyone ever required, and the run finishes', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { total_value: 300000 });
    await rejectAndResubmit(world, run.id, 'Raj Patel', { total_value: 90000 });
    await rejectAndResubmit(world, run.id, 'Raj Patel', { total_value: 2000000 });
    await rejectAndResubmit(world, run.id, 'Raj Patel', { total_value: 90000 });
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.RA_A3.decisions?.map((decision) => decision.by)).toEqual(['Chloe Martin']);
    expect(after.steps.RA_A4.decisions?.map((decision) => decision.by)).toEqual(['David Okafor', 'Rebecca Stone']);
    expect(after.steps.RW.status).toBe('done');
  });

  it('2g X4: a path that rejects by itself can be fixed, with nothing kept (control)', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => ({
      T: { ...nodes.T, outs: [{ key: 'next', to: 'I' }] },
      I: cond('I', big, 'RJ', 'A'),
      RJ: { id: 'RJ', kind: 'end', label: 'Rejected', outcome: 'rejected', outs: [] },
      A: appr('A', { roles: ['proc'] }),
      END: nodes.END,
    }) as unknown as Nodes);
    const run = await world.start('WO-2231', {}, { total_value: 800000 });
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, { total_value: 90000 });
    expect(await open(world, run.id)).toEqual(['approve:Owen Clarke:A']);
    expect((await world.run(run.id)).floor?.steps).toEqual([]);
  });

  it('2h X6: an unrelated change on a send-back re-asks no one who already answered (control)', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { total_value: 300000 });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    await world.decide((await world.itemFor(run.id, 'Chloe Martin')).id, 'Chloe Martin', 'sent_back', 'Fix');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, { site: 'Remote' });
    expect((await world.run(run.id)).steps.RA_A1.status).toBe('done');
    expect(await open(world, run.id)).toEqual(['approve:Chloe Martin:RA_A3']);
  });
});

describe('3: who raised it can’t be rewritten on an open run, by any door', () => {
  it('3a the record route: 422, nothing written, and the admin who raised it doesn’t get to approve it', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { requester: 'Samira Khan', hiring_manager: 'Samira Khan' });
    expect(await codeOf(world.service.editRecordAs(actor('Samira Khan'), 'work_order', 'WO-2231', { requester: 'Sam Patel' }))).toBe('FIELD_NOT_EDITABLE');
    expect((await dataOf(world, 'WO-2231')).requester).toBe('Samira Khan');
    expect((await open(world, run.id)).some((line) => line.includes('Samira Khan'))).toBe(false);
  });

  it('3b the same four as the event route, and only a change counts', async () => {
    const world = await createWorld();
    await world.start('WO-2231');
    expect(await codeOf(world.service.editRecordAs(actor('Samira Khan'), 'work_order', 'WO-2231', { requester: 'Grace Kim', site: 'Remote' }))).toBeNull();
    for (const data of [{ prev: { total_value: 1 } }, { original_total: 1 }, { changed_fields: ['x'] }, { requester: 'x' }]) {
      expect(await codeOf(world.service.editRecordAs(actor('Samira Khan'), 'work_order', 'WO-2231', data))).toBe('FIELD_NOT_EDITABLE');
    }
  });

  it('3c with no run open, an admin can correct it (control)', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.stop(run, { by: 'Samira Khan', reason: 'Done' });
    expect(await codeOf(world.service.editRecordAs(actor('Samira Khan'), 'work_order', 'WO-2231', { requester: 'Sam Patel' }))).toBeNull();
  });

  for (const field of ['Requester', 'Original total', 'Hiring manager', 'Changed fields']) {
    it(`3d a proposal on “${field}” can’t write it through /choose`, async () => {
      const world = await createWorld();
      const run = await world.start('WO-2231', {}, { conflict: { field, a: { by: 'A', v: '1', total: 95000 }, b: { by: 'B', v: '2', total: 95000 } } });
      const before = await dataOf(world, 'WO-2231');
      expect(await codeOf(world.service.chooseProposal(actor('Samira Khan'), run.id, 'a'))).toBe('FIELD_NOT_EDITABLE');
      expect(await dataOf(world, 'WO-2231')).toEqual(before);
    });
  }
});

describe('4: the stuck net sees a held retry, and tells the owner once', () => {
  const single = (nodes: Nodes): Nodes => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] }, A: appr('A', { roles: ['priv'] }), END: nodes.END }) as Nodes;
  const clean = { data_access: false, digital_worker_access: false, role_regulated: false };
  const toOwner = async (world: World, runId: string) => (await world.outbox({ runId })).filter((message) => message.subject.startsWith('Nothing is moving'));

  it('4a a retry held behind an approval nobody can give is a hang, not something scheduled', async () => {
    const world = await createWorld({
      adapters: (ctx) => {
        const inner = mockAdapters(ctx);
        return { ...inner, system: (name, record) => ({ ...inner.system(name, record), execute: async () => ({ status: 'failed' as const, error: 'down', retryable: true }) }) };
      },
    });
    await world.publishEdited('wf-wo-sub', (nodes) => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] }, A: appr('A', { roles: ['priv'], material: ['total_value'], outs: [{ key: 'next', to: 'SYS' }] }), SYS: system('SYS', 'END'), END: nodes.END }) as Nodes);
    const run = await world.start('WO-2231');
    const privacy = (await world.items(run.id)).find((item) => item.status === 'open') as { id: string; assignee: string };
    await world.decide(privacy.id, privacy.assignee, 'approved');
    const people = JSON.parse(JSON.stringify(readRawSeed()['people-and-authority'])) as { BY_COUNTRY: { priv: Record<string, string | null> } };
    people.BY_COUNTRY.priv.Canada = null;
    await world.store.reference.replace('people-and-authority', people, 'test');
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 900000 });
    expect(await open(world, run.id)).toEqual([]);
    await world.advanceTo(hoursAfter(1));
    const after = await world.run(run.id);
    expect(after.status).toBe('paused');
    expect(after.pauseReason).toBe('stuck');
    expect(after.steps.A.outcome).toBeUndefined();
  });

  it('4b Resume, an edit and an import of a run that’s still stuck tell the owner nothing new', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', single);
    const run = await world.start('WO-2270', {}, clean);
    await world.tick();
    expect((await world.run(run.id)).status).toBe('paused');
    expect(await toOwner(world, run.id)).toHaveLength(2);
    await world.resume(run, { by: 'Samira Khan' });
    await world.tick();
    await world.service.editRecord('work_order', 'WO-2270', { site: 'Remote' });
    await world.tick();
    await world.service.referenceChanged();
    await world.tick();
    expect((await world.run(run.id)).status).toBe('paused');
    expect(await toOwner(world, run.id)).toHaveLength(2);
  });

  it('4c a new episode is told again: once someone was asked, the run has moved', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', single);
    const run = await world.start('WO-2270', {}, clean);
    await world.tick();
    const people = JSON.parse(JSON.stringify(readRawSeed()['people-and-authority'])) as { BY_COUNTRY: { priv: Record<string, string | null> } };
    people.BY_COUNTRY.priv.Germany = 'Fatima Zahra';
    await world.store.reference.replace('people-and-authority', people, 'test');
    await world.service.referenceChanged();
    expect(await open(world, run.id)).toEqual(['approve:Fatima Zahra:A']);
    expect((await world.run(run.id)).stuckTold).toBeUndefined();
    people.BY_COUNTRY.priv.Germany = null as unknown as string;
    await world.store.reference.replace('people-and-authority', people, 'test');
    await world.service.editRecord('work_order', 'WO-2270', { site: 'Remote' });
    await world.tick();
    await world.tick();
    const told = await toOwner(world, run.id);
    expect(told.length).toBe((await open(world, run.id)).length === 0 ? 4 : 2);
  });
});
