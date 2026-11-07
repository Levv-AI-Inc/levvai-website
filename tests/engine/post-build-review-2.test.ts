import { describe, expect, it } from 'vitest';
import { activeState } from '../../src/flow-studio/engine/active';
import { readRawSeed } from '../../src/flow-studio/data/seed-files';
import type { EngineContext } from '../../src/flow-studio/model/context';
import type { ApprovalRule } from '../../src/flow-studio/model/rules';
import type { Workflow } from '../../src/flow-studio/model/workflow';
import { mockAdapters } from '../../src/flow-studio/runtime/adapters';
import { ApiError } from '../../src/flow-studio/server/errors';
import { actor, createWorld, hoursAfter, type World } from '../support/runtime-world';

/**
 * The second round of the post-build review: the variants and new defects the re-review found after the first fixes. The
 * letters are the review's. Each test reproduced its item before the fix, unless it says it is a control.
 */

type Nodes = Workflow['draft']['nodes'];
type Node = Nodes[string];

const appr = (id: string, extra: Record<string, unknown> = {}): Node => ({ id, kind: 'appr', label: id, roles: ['fbp'], mode: 'all', authority: false, material: [], reaskOnDecrease: true, sla: 48, reject: 'requester', prechecks: ['brief'], outs: [{ key: 'next', to: 'END' }], ...extra }) as unknown as Node;
const task = (id: string, to: string, extra: Record<string, unknown> = {}): Node => ({ id, kind: 'task', label: id, role: 'people_ops', title: id, outs: [{ key: 'next', to }], ...extra }) as unknown as Node;
const system = (id: string, to: string, onFail = 'task'): Node => ({ id, kind: 'system', label: id, system: 'Workday', actions: ['push'], via: '', outs: [{ key: 'next', to }], preset: 'hris', sys: { system: 'Workday', action: 'create', object: 'Contingent worker', match: 'Work email', map: [], read: [], wait: 'none', waitH: 24, state: 'Completed', onFail, failRole: 'people_ops', retries: 3, check: true } }) as unknown as Node;
const collect = (nodes: Nodes): Nodes => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'C' }] }, C: { id: 'C', kind: 'collect', label: 'Check', items: ['ID'], from: 'worker', checker: 'checkr', verify: 'auto', failTo: 'approval', failRoles: ['hm'], failMode: 'all', reviewer: 'hm', sla: 48, remind: 24, outs: [{ key: 'next', to: 'END' }] }, END: nodes.END }) as unknown as Nodes;

const open = async (world: World, runId: string): Promise<string[]> => (await world.items(runId)).filter((item) => item.status === 'open').map((item) => `${item.kind}:${item.assignee}:${item.nodeId}`);
const openPeople = async (world: World, runId: string): Promise<string[]> => (await open(world, runId)).map((line) => line.split(':')[1]).sort();
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
const addRule = async (world: World, rule: Partial<ApprovalRule> & { act?: Partial<ApprovalRule['act']> }): Promise<void> => {
  const doc = JSON.parse(JSON.stringify(readRawSeed()['approval-rules'])) as { approvalRules: unknown[] };
  doc.approvalRules.push({ id: 'ao-x', name: 'Extra rule', status: 'live', records: ['work_order'], event: 'submitted', when: { join: 'all', rows: [{ f: 'security_clearance', op: 'in', v: ['Enhanced'] }] }, ...rule, act: { approve: true, roles: ['legal'], mode: 'all', position: 'with', task: false, taskRole: 'tax', taskTitle: '', flag: false, flagField: 'registration_required', ...rule.act } });
  await world.store.reference.replace('approval-rules', doc, 'test');
};
const addPeople = async (world: World, change: (people: { MGR: Record<string, string>; BY_COUNTRY: Record<string, Record<string, string>> }) => void): Promise<void> => {
  const doc = JSON.parse(JSON.stringify(readRawSeed()['people-and-authority'])) as Parameters<typeof change>[0];
  change(doc);
  await world.store.reference.replace('people-and-authority', doc, 'test');
};
const sowEvent = { source: 'levv', recordType: 'sow', recordId: 'SOW-X', event: 'created', data: { title: 'S', country: 'Canada', business_unit: 'Operations', job_family: 'Operations', total_value: 95000, requester: 'Grace Kim', terms_nonstandard: true, states: [] } };

describe('A: a requester’s resubmit never shrinks what is required', () => {
  it('A1 an If: Legal stays on a SOW when the requester flips Non-standard terms', async () => {
    const world = await createWorld();
    const { runIds } = await world.service.intake(sowEvent);
    const run = await world.run(runIds[0]);
    expect(run.workflowId).toBe('wf-sow-sub');
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'rejected', 'No');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, { terms_nonstandard: false });
    expect((await dataOf(world, 'SOW-X')).terms_nonstandard).toBe(false);
    expect((await world.run(run.id)).plan.stages.map((stage) => stage.label)).toEqual(['Procurement review', 'Legal review']);
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.RA_A2.decisions?.map((decision) => decision.by)).toEqual(['Luis Romero']);
    expect(after.log.some((line) => line.type === 'kept' && line.m === 'The resubmitted values no longer call for Legal (Luis Romero). A resubmit can’t take anyone off, so they stay on this request.')).toBe(true);
  });

  it('A2 a rule: its approver rejects, the requester edits the rule off, and they see it again', async () => {
    const world = await createWorld();
    await addRule(world, {});
    const run = await world.start('WO-2231', {}, { security_clearance: 'Enhanced' });
    await world.decide((await world.itemFor(run.id, 'Luis Romero')).id, 'Luis Romero', 'rejected', 'Legal says no');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, { security_clearance: 'None' });
    expect(await openPeople(world, run.id)).toEqual(['Luis Romero', 'Raj Patel']);
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.RA_A1.decisions?.filter((decision) => decision.decision === 'approved').map((decision) => decision.by).sort()).toEqual(['Luis Romero', 'Raj Patel']);
  });

  it('A3 a rule’s task: engagement changed, the tax team’s task stays', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { country: 'UK', engagement: 'Off-payroll', business_unit: 'Operations' });
    const taxTask = (await world.items(run.id)).find((item) => item.key === 'task:ao-ir35');
    expect(taxTask).toBeDefined();
    const approver = (await world.items(run.id)).find((item) => item.kind === 'approve' && item.status === 'open') as NonNullable<typeof taxTask>;
    await world.decide(approver.id, approver.assignee, 'rejected', 'No');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, { engagement: 'Payrolled' });
    expect((await world.items(run.id)).filter((item) => item.key === 'task:ao-ir35' && item.status === 'open')).toHaveLength(1);
    expect((await world.run(run.id)).log.some((line) => line.type === 'kept' && line.m.includes('Record IR35 status'))).toBe(true);
  });

  it('A4 Finance rejects at $300K asking for under $250K: the lower value goes through and Finance sees it again', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { total_value: 300000 });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    await world.decide((await world.itemFor(run.id, 'Chloe Martin')).id, 'Chloe Martin', 'rejected', 'Keep it under 250K');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, { total_value: 200000 });
    expect((await dataOf(world, 'WO-2231')).total_value).toBe(200000);
    expect(await openPeople(world, run.id)).toContain('Chloe Martin');
    expect((await world.run(run.id)).steps.RW.status).toBe('pending');
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.RA_A3.decisions?.at(-1)).toMatchObject({ by: 'Chloe Martin', decision: 'approved' });
    expect(after.steps.RW.status).toBe('done');
  });

  it('A5 whoever sent it back sees it again, even a manager answering a Chaser copy who was never on the plan', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.advanceTo(hoursAfter(49));
    const copyItem = (await world.items(run.id)).find((item) => item.chaserOf && item.status === 'open') as { id: string; assignee: string };
    await world.decide(copyItem.id, copyItem.assignee, 'rejected', 'Not at this price');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, { total_value: 90000 });
    expect(await openPeople(world, run.id)).toEqual([copyItem.assignee, 'Raj Patel'].sort());
    await answerAll(world, run.id);
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('A6 a signing limit: a lower amount doesn’t take the senior approver off, and the new holder is added', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      (nodes.RA_A1 as { authority: boolean }).authority = true;
      (nodes.RA_A1 as { roles: string[] }).roles = ['hm'];
    });
    const run = await world.start('WO-2231', {}, { total_value: 900000, hiring_manager: 'Omar Haddad' });
    const senior = (await world.items(run.id)).find((item) => item.kind === 'approve' && item.status === 'open') as { id: string; assignee: string };
    await world.decide(senior.id, senior.assignee, 'rejected', 'Too much');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, { total_value: 100 });
    const people = await openPeople(world, run.id);
    expect(people).toContain(senior.assignee);
    expect(people).toContain('Omar Haddad');
    expect(senior.assignee).not.toBe('Omar Haddad');
  });

  it('A7 it may add: a higher value asks Executive sign-off as well', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'rejected', 'No');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, { total_value: 2000000 });
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    expect(await openPeople(world, run.id)).toEqual(['David Okafor']);
  });

  it('A8 a blanked or negative amount isn’t a fix', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'rejected', 'No');
    const item = await world.itemFor(run.id, 'Grace Kim', 'resubmit');
    expect(await codeOf(world.service.resubmit(actor('Grace Kim'), item.id, { total_value: null }))).toBe('INVALID_VALUE');
    expect(await codeOf(world.service.resubmit(actor('Grace Kim'), item.id, { total_value: -5 }))).toBe('INVALID_VALUE');
  });

  it('A9 the approver is told why they’re still on it: the brief and the plan’s note say so', async () => {
    const world = await createWorld();
    const { runIds } = await world.service.intake(sowEvent);
    await world.decide((await world.itemFor(runIds[0], 'Owen Clarke')).id, 'Owen Clarke', 'rejected', 'No');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(runIds[0], 'Grace Kim', 'resubmit')).id, { terms_nonstandard: false });
    await world.decide((await world.itemFor(runIds[0], 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    const legal = await world.itemFor(runIds[0], 'Luis Romero');
    expect(legal.brief).toContain('The requester’s change no longer calls for you, but a resubmit can’t take anyone off.');
    const item = (await world.run(runIds[0])).plan.stages.flatMap((stage) => stage.items).find((one) => one.people.includes('Luis Romero'));
    expect(item?.notes.map((note) => note.m)).toContain('Stays on this: the requester’s change no longer calls for Luis Romero, but a resubmit can’t take anyone off');
  });

  it('A10 what an admin edits afterwards doesn’t lose it: the floor belongs to the run', async () => {
    const world = await createWorld();
    const { runIds } = await world.service.intake(sowEvent);
    await world.decide((await world.itemFor(runIds[0], 'Owen Clarke')).id, 'Owen Clarke', 'rejected', 'No');
    await world.service.resubmit(actor('Grace Kim'), (await world.itemFor(runIds[0], 'Grace Kim', 'resubmit')).id, { terms_nonstandard: false });
    await world.service.editRecord('sow', 'SOW-X', { project_code: 'P-9' });
    expect((await world.run(runIds[0])).plan.stages.map((stage) => stage.label)).toContain('Legal review');
    await world.tick();
    expect((await world.run(runIds[0])).plan.stages.map((stage) => stage.label)).toContain('Legal review');
  });

  it('A11 control: an edit that isn’t a requester’s resubmit still shrinks, as 03 §8.4 says', async () => {
    const world = await createWorld();
    const { runIds } = await world.service.intake(sowEvent);
    await world.service.editRecord('sow', 'SOW-X', { terms_nonstandard: false });
    expect((await world.run(runIds[0])).plan.stages.map((stage) => stage.label)).toEqual(['Procurement review']);
  });
});

describe('B: on a paused run, whoever the plan withdrew can’t decide', () => {
  const pausedMoved = async (via: (world: World) => Promise<unknown>) => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { hiring_manager: 'Tom Reed', business_unit: 'Technology' });
    await world.pause(run, { by: 'Samira Khan' });
    const tom = await world.itemFor(run.id, 'Tom Reed');
    await via(world);
    return { world, run, tom };
  };

  it('B1 by edit: their item goes at once, and the new holder is asked on Resume', async () => {
    const { world, run, tom } = await pausedMoved((world) => world.service.editRecord('work_order', 'WO-2231', { hiring_manager: 'Omar Haddad' }));
    expect((await world.store.workItems.get(tom.id))?.status).toBe('cancelled');
    expect(await world.decide(tom.id, 'Tom Reed', 'approved')).toMatchObject({ ok: false, code: 'RUN_STOPPED' });
    expect((await world.run(run.id)).steps.RA_A1.approvals?.hm).toBeUndefined();
    expect((await world.outbox({ runId: run.id })).some((message) => message.to === 'Tom Reed' && message.subject.startsWith('No longer needed'))).toBe(true);
    expect(await openPeople(world, run.id)).toEqual(['Priya Shah']);
    await world.resume(run, { by: 'Samira Khan' });
    expect(await openPeople(world, run.id)).toEqual(['Omar Haddad', 'Priya Shah']);
  });

  it('B2 by event, and for a rejection', async () => {
    const { world, run, tom } = await pausedMoved((world) => world.event('WO-2231', {}, { hiring_manager: 'Omar Haddad', business_unit: 'Technology' }));
    expect(await world.decide(tom.id, 'Tom Reed', 'rejected', 'No')).toMatchObject({ ok: false, code: 'RUN_STOPPED' });
    await world.resume(run, { by: 'Samira Khan' });
    const after = await world.run(run.id);
    expect(after.steps.RA_A1.resubmit).toBeUndefined();
    expect(await openPeople(world, run.id)).toEqual(['Omar Haddad', 'Priya Shah']);
  });

  it('B3 a step no longer needed lets its people go while paused, and a Chaser copy with them', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { hiring_manager: 'Tom Reed', business_unit: 'Technology' });
    await world.advanceTo(hoursAfter(49));
    await world.pause(run, { by: 'Samira Khan' });
    await world.service.editRecord('work_order', 'WO-2231', { hiring_manager: 'Omar Haddad' });
    const tomsCopy = (await world.items(run.id)).find((item) => item.chaserOf && item.stepName?.includes('Tom Reed'));
    expect(tomsCopy?.status).toBe('cancelled');
  });
});

describe('C: an event can’t do what the record route refuses', () => {
  it('C1 the token: requester and prev stay as they were on a record with an open run, and the rest merges', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.event('WO-2231', {}, { requester: 'Sam Patel', prev: { total_value: 95000 }, changed_fields: [], original_total: 1, site: 'Remote' });
    const data = await dataOf(world, 'WO-2231');
    expect(data.requester).toBe('Grace Kim');
    expect(data.prev).toBeUndefined();
    expect(data.changed_fields).toBeUndefined();
    expect(data.original_total).toBeUndefined();
    expect(data.site).toBe('Remote');
    expect(await openPeople(world, run.id)).toEqual(['Raj Patel']);
    expect((await world.run(run.id)).log.some((line) => line.type === 'event_ignored' && line.m.includes('requester'))).toBe(true);
    const [stored] = (await world.store.inbound.findByRecord('WO-2231')).slice(-1);
    expect((stored.payload as Record<string, unknown>).requester).toBe('Sam Patel');
  });

  it('C2 once no run is open the record can follow its source, and a new record comes as sent', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.stop(run, { by: 'Samira Khan', reason: 'Done' });
    await world.event('WO-2231', {}, { requester: 'Sam Patel' });
    expect((await dataOf(world, 'WO-2231')).requester).toBe('Sam Patel');
    await world.start('ASN-881');
    const asn = await dataOf(world, 'ASN-881');
    expect(asn.prev).toBeDefined();
    expect(asn.states).toEqual(['cleared', 'active']);
  });

  it('C3 05 §3.1 step 5: the token’s states still move a waiting prerequisite', async () => {
    const world = await createWorld();
    expect((await world.event('INV-8812', {}, { states: [] })).outcome).toBe('waiting_prerequisite');
    await world.event('INV-8812', {}, { states: ['ts_approved'] });
    await world.tick();
    const events = await world.store.inbound.findByRecord('INV-8812');
    expect(events.some((event) => event.outcome === 'started')).toBe(true);
  });

  it('C4 the admin’s session: what the deny list holds is refused, nothing is stored, and a change says who made it', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const admin = { id: '3', name: 'admin@example.com', person: null, permissions: ['admin' as const], ownerTeams: {} };
    const before = (await world.store.inbound.findByRecord('WO-2231')).length;
    const event = (data: Record<string, unknown>) => ({ source: 'levv', recordType: 'work_order', recordId: 'WO-2231', event: 'submitted', data });
    for (const data of [{ prev: { total_value: 1 } }, { states: ['wo_approved'] }, { changed_fields: ['total_value'] }, { conflict: { field: 'x' } }, { requester: 'Sam Patel' }]) {
      expect(await codeOf(world.service.intake(event(data), admin))).toBe('FIELD_NOT_EDITABLE');
    }
    expect((await world.store.inbound.findByRecord('WO-2231')).length).toBe(before);
    expect((await dataOf(world, 'WO-2231')).states).toEqual([]);
    await world.service.intake(event({ total_value: 2000000 }), admin);
    const changed = (await world.run(run.id)).log.find((line) => line.type === 'record_changed');
    expect(changed).toMatchObject({ by: 'admin@example.com', byId: '3' });
    expect((await world.store.inbound.findByRecord('WO-2231')).at(-1)).toMatchObject({ receivedBy: 'admin@example.com', receivedById: '3' });
  });

  it('C5 an admin resending what is already there is fine: only a change is refused', async () => {
    const world = await createWorld();
    await world.start('WO-2231');
    const admin = { id: '3', name: 'admin@example.com', person: null, permissions: ['admin' as const], ownerTeams: {} };
    const data = await dataOf(world, 'WO-2231');
    expect((await world.service.intake({ source: 'levv', recordType: 'work_order', recordId: 'WO-2231', event: 'submitted', data }, admin)).outcome).toBe('duplicate');
  });
});

describe('D: a failed check’s deciders follow the plan, like an approval’s', () => {
  const failed = (extra: Record<string, unknown> = {}) => ({ hiring_manager: 'Tom Reed', outcomes: { C: 'fail' }, ...extra });

  it('D1 the former holder is withdrawn and can’t clear it', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', collect);
    const run = await world.start('WO-2231', {}, failed());
    const tom = await world.itemFor(run.id, 'Tom Reed', 'decide_failed_check');
    await world.service.editRecord('work_order', 'WO-2231', { hiring_manager: 'Omar Haddad' });
    expect((await world.store.workItems.get(tom.id))?.status).toBe('cancelled');
    expect(await world.decide(tom.id, 'Tom Reed', 'approved')).toMatchObject({ ok: false, code: 'RUN_STOPPED' });
    expect(await open(world, run.id)).toEqual(['decide_failed_check:Omar Haddad:C']);
    expect((await world.run(run.id)).status).toBe('running');
  });

  it('D2 and so is their Chaser copy', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', collect);
    const run = await world.start('WO-2231', {}, failed());
    await world.advanceTo(hoursAfter(200));
    const copyItem = (await world.items(run.id)).find((item) => item.chaserOf && item.status === 'open') as { id: string; assignee: string };
    await world.service.editRecord('work_order', 'WO-2231', { hiring_manager: 'Omar Haddad' });
    expect(await world.decide(copyItem.id, copyItem.assignee, 'approved')).toMatchObject({ ok: false, code: 'RUN_STOPPED' });
    expect((await world.run(run.id)).status).toBe('running');
    expect((await world.outbox({ runId: run.id })).some((message) => message.to === copyItem.assignee && message.subject.startsWith('No longer needed'))).toBe(true);
  });

  it('D3 by event too, which adds the new holder', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', collect);
    const run = await world.start('WO-2231', {}, failed());
    await world.event('WO-2231', {}, { hiring_manager: 'Omar Haddad' });
    expect(await open(world, run.id)).toEqual(['decide_failed_check:Omar Haddad:C']);
  });

  it('D4 while paused, the withdrawal happens now and the new holder is asked on Resume', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', collect);
    const run = await world.start('WO-2231', {}, failed());
    const tom = await world.itemFor(run.id, 'Tom Reed', 'decide_failed_check');
    await world.pause(run, { by: 'Samira Khan' });
    await world.service.editRecord('work_order', 'WO-2231', { hiring_manager: 'Omar Haddad' });
    expect((await world.store.workItems.get(tom.id))?.status).toBe('cancelled');
    await world.resume(run, { by: 'Samira Khan' });
    expect(await open(world, run.id)).toEqual(['decide_failed_check:Omar Haddad:C']);
  });
});

describe('D, continued', () => {
  it('D5 a decider who becomes the worker is withdrawn, not just refused', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', collect);
    const run = await world.start('WO-2231', {}, { hiring_manager: 'Tom Reed', outcomes: { C: 'fail' } });
    const tom = await world.itemFor(run.id, 'Tom Reed', 'decide_failed_check');
    await world.service.editRecord('work_order', 'WO-2231', { worker_name: 'Tom Reed' });
    expect((await world.store.workItems.get(tom.id))?.status).toBe('cancelled');
    expect((await open(world, run.id)).some((line) => line.includes('Tom Reed'))).toBe(false);
    expect((await world.run(run.id)).status).toBe('running');
  });
});

describe('G: nothing external fires while an earlier approval is outstanding again', () => {
  const retrying = () => {
    const calls: unknown[] = [];
    const state = { fail: true };
    const adapters = (ctx: EngineContext) => {
      const inner = mockAdapters(ctx);
      return { ...inner, system: (name: string, record: Parameters<typeof inner.system>[1]) => ({ ...inner.system(name, record), execute: async () => { calls.push((record as { total_value?: number }).total_value); return state.fail ? { status: 'failed' as const, error: 'down', retryable: true } : { status: 'done' as const, ref: 'R', values: {} }; } }) };
    };
    return { calls, state, adapters };
  };
  const line = (nodes: Nodes): Nodes => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] }, A: appr('A', { roles: ['proc'], material: ['total_value'], outs: [{ key: 'next', to: 'SYS' }] }), SYS: system('SYS', 'END'), END: nodes.END }) as Nodes;

  it('G1 a System retry waits for the approval, then fires with the new value', async () => {
    const { calls, state, adapters } = retrying();
    const world = await createWorld({ adapters });
    await world.publishEdited('wf-wo-sub', line);
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    expect(calls).toHaveLength(1);
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 900000 });
    state.fail = false;
    await world.advanceTo(hoursAfter(1));
    expect(calls).toHaveLength(1);
    expect((await world.run(run.id)).steps.SYS.status).toBe('active');
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    await world.advanceTo(hoursAfter(2));
    expect(calls).toEqual([95000, 900000]);
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('G2 a held retry costs no write: the tick leaves the run alone', async () => {
    const { adapters, state } = retrying();
    const world = await createWorld({ adapters });
    await world.publishEdited('wf-wo-sub', line);
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 900000 });
    state.fail = false;
    const rev = (await world.run(run.id)).rev;
    await world.advanceTo(hoursAfter(1));
    expect((await world.run(run.id)).rev).toBe(rev);
  });

  it('G4 a verifier isn’t called with handed-over documents while the approval before it is outstanding', async () => {
    const verified: unknown[] = [];
    const world = await createWorld({
      autocomplete: false,
      adapters: (ctx) => {
        const inner = mockAdapters(ctx);
        return { ...inner, verifier: (name, record) => ({ ...inner.verifier(name, record), verify: (request) => { verified.push(name); return inner.verifier(name, record).verify(request); } }) };
      },
    });
    await world.publishEdited('wf-wo-sub', (nodes) => {
      const shaped = collect(nodes);
      return { T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] }, A: appr('A', { roles: ['proc'], material: ['total_value'], outs: [{ key: 'next', to: 'C' }] }), C: shaped.C, END: nodes.END } as Nodes;
    });
    const run = await world.start('WO-2231', {}, { hiring_manager: 'Tom Reed' });
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 900000 });
    const handOver = (await world.items(run.id)).find((item) => item.kind === 'collect' && item.status === 'open') as { id: string; assignee: string; items: string[] };
    await world.service.submitItems(actor(handOver.assignee), handOver.id, handOver.items);
    expect(verified).toEqual([]);
    expect((await world.run(run.id)).steps.C.received).toEqual(handOver.items);
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    expect(verified).toHaveLength(1);
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('G3 an open task can be finished: it doesn’t pass the approval, and its ledger line is written, because it happened', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] }, A: appr('A', { roles: ['proc'], material: ['total_value'], outs: [{ key: 'next', to: 'TK' }] }), TK: task('TK', 'TK2', { gives: 'Laptop', reverse: 'Return' }), TK2: task('TK2', 'END'), END: nodes.END }) as Nodes);
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    await world.service.editRecord('work_order', 'WO-2231', { total_value: 900000 });
    expect((await world.done((await world.itemFor(run.id, 'Jordan Lee')).id, 'Jordan Lee')).ok).toBe(true);
    const mid = await world.run(run.id);
    expect(mid.steps.TK.status).toBe('done');
    expect(mid.steps.TK2.status).toBe('pending');
    expect(await open(world, run.id)).toEqual(['approve:Owen Clarke:A']);
    expect(await world.ledger('wo-2231.worker@example.com')).toHaveLength(1);
    await world.decide((await world.itemFor(run.id, 'Owen Clarke')).id, 'Owen Clarke', 'approved');
    expect((await world.run(run.id)).steps.TK2.status).toBe('waiting');
  });
});

describe('E, F: a step is covered only by one that can really answer first', () => {
  it('E a step upstream of the one it would be covered by is asked', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'P' }] }, P: { id: 'P', kind: 'parallel', label: 'P', outs: [{ key: 'a', to: 'J' }, { key: 'b', to: 'K' }] }, K: appr('K', { roles: ['proc'], outs: [{ key: 'next', to: 'J' }] }), J: appr('J', { roles: ['proc'] }), END: nodes.END }) as unknown as Nodes);
    const run = await world.start('WO-2231');
    expect(await open(world, run.id)).toContain('approve:Owen Clarke:K');
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps.K.decisions?.map((decision) => decision.by)).toEqual(['Owen Clarke']);
  });

  it('F a position-first rule added by an edit, merged with the waiting step’s person, is asked and carries the step', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] }, A: appr('A', { roles: ['proc'] }), END: nodes.END }) as unknown as Nodes);
    await addRule(world, { when: { join: 'all', rows: [{ f: 'urgent', op: 'yes' }] } as ApprovalRule['when'], act: { roles: ['proc'], position: 'first' } as ApprovalRule['act'] });
    const run = await world.start('WO-2231');
    await world.service.editRecord('work_order', 'WO-2231', { urgent: true });
    expect(await open(world, run.id)).toEqual(['approve:Owen Clarke:rule:Extra rule']);
    await answerAll(world, run.id);
    const after = await world.run(run.id);
    expect(after.status).toBe('completed');
    expect(after.steps['rule:Extra rule'].decisions?.map((decision) => decision.by)).toEqual(['Owen Clarke']);
    expect(after.steps.A.status).toBe('done');
  });
});

describe('H: a blank value goes to someone who is allowed to answer', () => {
  const asksForCostCenter = (nodes: Nodes): Nodes => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'I' }] }, I: { id: 'I', kind: 'cond', label: 'Which center', outs: [{ key: 'p1', to: 'END', label: 'One', join: 'all', rows: [{ f: 'cost_center', op: 'in', v: ['CC-100'] }] }, { key: 'else', to: 'END', label: 'Otherwise' }] }, END: nodes.END }) as unknown as Nodes;

  it('H1 not the requester who can’t: their manager', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', asksForCostCenter);
    const run = await world.start('WO-2231', {}, { cost_center: null });
    expect(await open(world, run.id)).toEqual(['needs_information:Raj Patel:I']);
    const item = await world.itemFor(run.id, 'Raj Patel', 'needs_information');
    expect(item.what).toContain('Raj Patel');
    await world.service.provideField(actor('Raj Patel'), item.id, 'cost_center', 'CC-100');
    expect((await world.run(run.id)).status).toBe('completed');
  });

  it('H2 with no one above them it waits, and says why', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', asksForCostCenter);
    const run = await world.start('WO-2231', {}, { cost_center: null, requester: 'Rebecca Stone' });
    expect(await open(world, run.id)).toEqual([]);
    const after = await world.run(run.id);
    expect(after.status).toBe('running');
    expect(after.log.some((line) => line.type === 'paused_step' && line.m.startsWith('Paused: Needs information: Cost center'))).toBe(true);
  });
});

describe('I: an import wakes what was waiting on it', () => {
  it('I1 a requester with nobody above them, then given a manager', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231', {}, { requester: 'Rebecca Stone', hiring_manager: 'Rebecca Stone' });
    expect(await openPeople(world, run.id)).toEqual(['Raj Patel']);
    await addPeople(world, (people) => { people.MGR['Rebecca Stone'] = 'Samira Khan'; });
    await world.service.referenceChanged();
    expect(await openPeople(world, run.id)).toEqual(['Raj Patel', 'Samira Khan']);
  });

  it('I2 an import during a manual pause counts: Resume asks the person it found', async () => {
    const world = await createWorld();
    const { runIds } = await world.event('WO-2270');
    const run = await world.run(runIds[0]);
    expect(run.plan.paused).toBe(true);
    await world.pause(run, { by: 'Samira Khan' });
    await addPeople(world, (people) => { people.BY_COUNTRY.priv.Germany = 'Fatima Zahra'; });
    await world.service.referenceChanged();
    expect((await world.run(run.id)).plan.paused).toBe(false);
    expect((await world.run(run.id)).status).toBe('paused');
    await world.resume(run, { by: 'Samira Khan' });
    expect(await openPeople(world, run.id)).toContain('Fatima Zahra');
  });
});

describe('J: the switch can make an overlap: it says so, and doesn’t block', () => {
  async function bothLive() {
    const world = await createWorld();
    const created = await world.store.workflows.create({ fromWorkflowId: 'wf-wo-sub-wo-data' }, 'Owen Clarke');
    const found = (await world.store.workflows.get(created.id)) as NonNullable<Awaited<ReturnType<World['store']['workflows']['get']>>>;
    await world.store.workflows.saveDraft(created.id, { ...found.workflow, name: 'Other', scope: { country: ['Canada'] } }, found.draftRev, 'Owen Clarke');
    await world.publishEdited(created.id, () => undefined);
    await world.store.workflows.setActive(created.id, false, 'Owen Clarke');
    const a = (await world.store.workflows.get('wf-wo-sub-wo-data')) as NonNullable<Awaited<ReturnType<World['store']['workflows']['get']>>>;
    await world.store.workflows.saveDraft(a.workflow.id, { ...a.workflow, scope: { business_unit: ['Finance'] } }, a.draftRev, 'Owen Clarke');
    await world.publishEdited(a.workflow.id, () => undefined);
    await world.store.workflows.setActive(created.id, true, 'Owen Clarke');
    return { world, otherId: created.id };
  }
  const ctxOf = async (world: World) => ({ ...(await world.store.reference.getAll()), workflows: await world.store.workflows.all(), history: await world.store.records.history() });

  it('J1 the switch still works, at once, and the panel warns', async () => {
    const { world, otherId } = await bothLive();
    const ctx = await ctxOf(world);
    const other = ctx.workflows.find((workflow) => workflow.id === otherId) as Workflow;
    expect(other.status).toBe('live');
    expect(activeState(other, ctx as never).warning).toBe('This overlaps “Data and AI hires” and nothing says which one runs. Until someone chooses, Levv runs the one listed first. Publish a change to choose.');
  });

  it('J2 the run’s log doesn’t claim a priority that doesn’t exist', async () => {
    const { world } = await bothLive();
    const { runIds } = await world.service.intake({ source: 'levv', recordType: 'work_order', recordId: 'WO-Z', event: 'submitted', data: { title: 'Z', country: 'Canada', business_unit: 'Finance', job_family: 'Design', total_value: 1, requester: 'Grace Kim', states: [] } });
    const line = (await world.run(runIds[0])).log.find((entry) => entry.type === 'overlap');
    expect(line?.m).not.toContain('by priority');
    expect(line?.m).toMatch(/^Two workflows overlap and nothing says which one runs; ran “.+”, the one listed first\.$/);
  });

  it('J3 control: with a priority, it still says 03 §3’s sentence', async () => {
    const { world, otherId } = await bothLive();
    await world.store.tx([{ op: 'patch', collection: 'workflows', id: otherId, set: { priority: 1 } }]);
    const { runIds } = await world.service.intake({ source: 'levv', recordType: 'work_order', recordId: 'WO-Y', event: 'submitted', data: { title: 'Y', country: 'Canada', business_unit: 'Finance', job_family: 'Design', total_value: 1, requester: 'Grace Kim', states: [] } });
    expect((await world.run(runIds[0])).log.find((entry) => entry.type === 'overlap')?.m).toBe('Two workflows overlap; ran “Other” by priority.');
  });
});

describe('K: small things', () => {
  it('K1 a field name that is also a property of every object is not a field', async () => {
    for (const data of [{ constructor: 'x' }, { toString: 'x' }, { valueOf: 'x' }, { hasOwnProperty: 'x' }]) {
      const world = await createWorld();
      const run = await world.start('WO-2231');
      await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'rejected', 'No');
      expect(await codeOf(world.service.resubmit(actor('Grace Kim'), (await world.itemFor(run.id, 'Grace Kim', 'resubmit')).id, data))).toBe('FIELD_NOT_EDITABLE');
    }
  });

  it('K2 a key that would reach the prototype goes no further, on any path', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    const hostile = JSON.parse('{"__proto__":{"polluted":true},"site":"Remote"}') as Record<string, unknown>;
    await world.service.intake({ source: 'levv', recordType: 'work_order', recordId: 'WO-2231', event: 'submitted', data: hostile });
    await world.service.editRecordAs(actor('Samira Khan'), 'work_order', 'WO-2231', JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const stored = await dataOf(world, 'WO-2231');
    expect(Object.getPrototypeOf(stored)).toBe(Object.prototype);
    expect(Object.keys(stored)).not.toContain('__proto__');
    expect((await world.run(run.id)).status).toBe('running');
  });

  it('K3 Run workflow’s log line names the published target, not its draft', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => {
      nodes.RUN = { id: 'RUN', kind: 'runwf', label: 'Start ending', target: 'wf-ending', outs: [{ key: 'next', to: 'END' }] } as unknown as Node;
      (nodes.RA_C2.outs.find((out) => out.key === 'else') as { to: string }).to = 'RUN';
    });
    const target = (await world.store.workflows.get('wf-ending')) as NonNullable<Awaited<ReturnType<World['store']['workflows']['get']>>>;
    await world.store.workflows.saveDraft('wf-ending', { ...target.workflow, name: 'Renamed in draft' }, target.draftRev, 'Owen Clarke');
    const run = await world.start('WO-2231');
    await world.decide((await world.itemFor(run.id, 'Raj Patel')).id, 'Raj Patel', 'approved');
    const line = (await world.run(run.id)).log.find((entry) => entry.type === 'runwf');
    expect(line?.m).toContain(target.workflow.published?.name);
    expect(line?.m).not.toContain('Renamed in draft');
  });
});

describe('The safety net: a run with nothing to wait for says so', () => {
  const nobodyLeft = { requester: 'Rebecca Stone', hiring_manager: 'Rebecca Stone' };
  const onlyHm = (nodes: Nodes): Nodes => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'A' }] }, A: appr('A', { roles: ['hm'] }), END: nodes.END }) as Nodes;

  it('N1 the tick pauses it with a system reason, tells the owner once, and approves nothing', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', onlyHm);
    const run = await world.start('WO-2231', {}, nobodyLeft);
    expect((await world.run(run.id)).status).toBe('running');
    await world.advanceTo(hoursAfter(1));
    const after = await world.run(run.id);
    expect(after.status).toBe('paused');
    expect(after.pauseReason).toBe('stuck');
    expect(after.pausedBy).toBe('Levv');
    expect(after.steps.A.status).toBe('waiting');
    expect(after.steps.A.outcome).toBeUndefined();
    expect(after.log.at(-1)).toMatchObject({ type: 'paused', by: 'Levv', m: 'Nothing is open on this request and nothing is scheduled, so Levv paused it. Nothing was approved.' });
    const told = (await world.outbox({ runId: run.id })).filter((message) => message.to === 'Procurement operations');
    expect(told.map((message) => message.channel).sort()).toEqual(['Email', 'In-app']);
    await world.advanceTo(hoursAfter(2));
    expect((await world.outbox({ runId: run.id })).filter((message) => message.to === 'Procurement operations')).toHaveLength(2);
  });

  it('N2 it starts again by itself when something changes that can move it', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', onlyHm);
    const run = await world.start('WO-2231', {}, nobodyLeft);
    await world.advanceTo(hoursAfter(1));
    await addPeople(world, (people) => { people.MGR['Rebecca Stone'] = 'Samira Khan'; });
    await world.service.referenceChanged();
    const after = await world.run(run.id);
    expect(after.status).toBe('running');
    expect(await openPeople(world, run.id)).toEqual(['Samira Khan']);
    expect(after.log.some((line) => line.type === 'resumed' && line.by === 'Levv')).toBe(true);
  });

  it('N3 Resume by hand works, and with still nothing to do the next tick pauses it again', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', onlyHm);
    const run = await world.start('WO-2231', {}, nobodyLeft);
    await world.advanceTo(hoursAfter(1));
    expect((await world.resume(run, { by: 'Samira Khan' })).ok).toBe(true);
    expect((await world.run(run.id)).status).toBe('running');
    await world.advanceTo(hoursAfter(2));
    expect((await world.run(run.id)).status).toBe('paused');
  });

  it('N4 controls: an open item, a scheduled Wait or a choice between proposals isn’t a hang', async () => {
    const world = await createWorld();
    const run = await world.start('WO-2231');
    await world.advanceTo(hoursAfter(1));
    expect((await world.run(run.id)).status).toBe('running');
    const waiting = await createWorld();
    await waiting.publishEdited('wf-wo-sub', (nodes) => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'W' }] }, W: { id: 'W', kind: 'wait', label: 'W', w: { mode: 'for', amount: 30, unit: 'days' }, outs: [{ key: 'next', to: 'END' }] }, END: nodes.END }) as unknown as Nodes);
    const second = await waiting.start('WO-2231');
    await waiting.advanceTo(hoursAfter(1));
    expect((await waiting.run(second.id)).status).toBe('running');
    const choosing = await createWorld();
    const third = await choosing.start('WO-2231', {}, { conflict: { field: 'Bill rate', a: { by: 'A', v: '$96/h', total: 96000 }, b: { by: 'B', v: '$102/h', total: 102000 } } });
    await choosing.advanceTo(hoursAfter(1));
    expect((await choosing.run(third.id)).status).toBe('running');
    expect(await choosing.items(third.id)).toEqual([]);
  });

  it('N5 a run on a Wait with no date yet is told about too, and a date starts it again', async () => {
    const world = await createWorld();
    await world.publishEdited('wf-wo-sub', (nodes) => ({ T: { ...nodes.T, outs: [{ key: 'next', to: 'W' }] }, W: { id: 'W', kind: 'wait', label: 'W', w: { mode: 'date', field: 'start_date', amount: 0, unit: 'days', dir: 'before', time: '09:00', tz: 'worker' }, outs: [{ key: 'next', to: 'END' }] }, END: nodes.END }) as unknown as Nodes);
    const run = await world.start('WO-2231', {}, { start_date: null });
    await world.advanceTo(hoursAfter(1));
    expect((await world.run(run.id)).status).toBe('paused');
    await world.service.editRecord('work_order', 'WO-2231', { start_date: '2027-01-11' });
    const after = await world.run(run.id);
    expect(after.status).toBe('running');
    expect(after.steps.W.waitUntil).toBeDefined();
  });
});
